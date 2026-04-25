#!/usr/bin/env python3
"""
Minimal Room Agent for local CRM -> Unreal Engine integration.

Responsibilities:
- Listen as a local WebSocket server on ws://localhost:8080/ws/laser.
- Poll CRM station commands from /api/station/rooms/{ROOM_ID}/commands.
- Forward command payloads to all connected UE clients as text frames.
- Ack commands only after they were sent to at least one UE client.

No third-party dependencies; Python 3.10+ standard library only.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import socketserver
import struct
import threading
import time
import urllib.error
import urllib.request
from typing import Any


WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
CLIENTS: set["WsHandler"] = set()
CLIENTS_LOCK = threading.Lock()
SESSION_PLAYERS: dict[str, list[str]] = {}
SESSION_TOTALS: dict[str, dict[str, int]] = {}
ENDED_SESSIONS: set[str] = set()


def http_json(
    method: str,
    url: str,
    token: str,
    body: dict[str, Any] | None = None,
    timeout: int = 15,
) -> Any:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else None


def ws_text_frame(message: str) -> bytes:
    payload = message.encode("utf-8")
    header = bytearray([0x81])
    length = len(payload)
    if length < 126:
        header.append(length)
    elif length < 65536:
        header.append(126)
        header.extend(struct.pack("!H", length))
    else:
        header.append(127)
        header.extend(struct.pack("!Q", length))
    return bytes(header) + payload


class WsHandler(socketserver.BaseRequestHandler):
    def setup(self) -> None:
        self.alive = False

    def handle(self) -> None:
        try:
            self.handshake()
        except Exception as exc:
            print("WS handshake failed:", exc)
            return

        with CLIENTS_LOCK:
            CLIENTS.add(self)
        self.alive = True
        print("UE connected:", self.client_address)

        try:
            while self.alive:
                if not self.read_frame():
                    break
        except (ConnectionResetError, OSError):
            pass
        finally:
            self.alive = False
            with CLIENTS_LOCK:
                CLIENTS.discard(self)
            print("UE disconnected:", self.client_address)

    def handshake(self) -> None:
        data = self.request.recv(4096).decode("utf-8", errors="ignore")
        headers: dict[str, str] = {}
        for line in data.split("\r\n")[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()

        key = headers.get("sec-websocket-key")
        if not key:
            raise ValueError("missing Sec-WebSocket-Key")

        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "\r\n"
        )
        self.request.sendall(response.encode("utf-8"))

    def read_frame(self) -> bool:
        first = self.request.recv(2)
        if not first:
            return False

        opcode = first[0] & 0x0F
        masked = bool(first[1] & 0x80)
        length = first[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", self.request.recv(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self.request.recv(8))[0]

        mask = self.request.recv(4) if masked else b""
        payload = bytearray(self.request.recv(length)) if length else bytearray()
        if masked:
            for i in range(len(payload)):
                payload[i] ^= mask[i % 4]

        if opcode == 0x8:  # close
            return False
        if opcode == 0x9:  # ping
            self.request.sendall(bytes([0x8A, 0x00]))
            return True
        if opcode == 0x1 and payload:
            message = payload.decode("utf-8", errors="replace")
            print("UE -> agent:", message)
            handle_ue_message(message)
        return True

    def send_text(self, message: str) -> bool:
        try:
            self.request.sendall(ws_text_frame(message))
            return True
        except OSError:
            self.alive = False
            return False


class ThreadingWsServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


def broadcast_to_ue(message: str) -> int:
    sent = 0
    with CLIENTS_LOCK:
        clients = list(CLIENTS)
    for client in clients:
        if client.send_text(message):
            sent += 1
    return sent


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("1", "true", "yes", "y")
    return bool(value)


def remember_session_payload(payload: dict[str, Any]) -> None:
    session_id = payload.get("session_id") or payload.get("sessionId")
    if not session_id:
        return

    players = []
    for player in payload.get("players") or []:
        user_id = player.get("user_id") or player.get("userId")
        if user_id:
            players.append(str(user_id))

    if players:
        SESSION_PLAYERS[str(session_id)] = players
        SESSION_TOTALS.setdefault(
            str(session_id),
            {"score": 0, "durationSeconds": 0},
        )


def handle_ue_message(message: str) -> None:
    try:
        event = json.loads(message)
    except json.JSONDecodeError:
        return

    if event.get("event") != "match_completed":
        return

    base = os.environ.get("BACKEND_BASE_URL", "http://localhost:3000/api").rstrip("/")
    room_id = os.environ["ROOM_ID"]
    key = os.environ["STATION_API_KEY"]
    session_id = event.get("session_id")
    if not session_id:
        print("UE match_completed ignored: missing session_id")
        return

    duration_seconds = int(event.get("duration_seconds") or 1)
    final_score = int(event.get("final_score") or 0)
    victory = truthy(event.get("victory"))
    totals = SESSION_TOTALS.setdefault(
        str(session_id),
        {"score": 0, "durationSeconds": 0},
    )
    totals["score"] += final_score
    totals["durationSeconds"] += max(1, duration_seconds)

    body = {
        "level": int(event.get("level") or 1),
        "attemptNumber": int(event.get("attempt_number") or 1),
        "durationSeconds": duration_seconds,
        "result": {
            "finalScore": final_score,
            "livesLeft": int(event.get("lives_left") or 0),
            "livesBonus": int(event.get("lives_bonus") or 0),
            "timeBonus": int(event.get("time_bonus") or 0),
            "timeUsed": float(event.get("time_used") or 0),
            "bVictory": victory,
            "reason": event.get("reason") or "",
            "mode": event.get("mode") or "classic",
        },
    }

    try:
        res = http_json(
            "POST",
            f"{base}/station/rooms/{room_id}/sessions/{session_id}/match-reports",
            key,
            body,
        )
        print("UE match_completed -> CRM:", res)
    except urllib.error.HTTPError as exc:
        print("CRM match-report error:", exc.code, exc.read().decode("utf-8", errors="replace")[:500])
    except Exception as exc:
        print("CRM match-report error:", exc)

    if not victory:
        end_session_after_game_over(base, room_id, key, str(session_id))


def end_session_after_game_over(
    base: str,
    room_id: str,
    key: str,
    session_id: str,
) -> None:
    if session_id in ENDED_SESSIONS:
        return

    players = SESSION_PLAYERS.get(session_id) or []
    if not players:
        print("CRM end skipped: no players remembered for session", session_id)
        return

    totals = SESSION_TOTALS.get(session_id) or {"score": 0, "durationSeconds": 1}
    total_score = int(totals.get("score") or 0)
    total_duration = int(totals.get("durationSeconds") or 1)

    body = {
        "durationSeconds": max(1, total_duration),
        "results": [{"userId": user_id, "score": total_score} for user_id in players],
    }

    try:
        res = http_json(
            "POST",
            f"{base}/station/rooms/{room_id}/sessions/{session_id}/end",
            key,
            body,
        )
        ENDED_SESSIONS.add(session_id)
        print("UE game over -> CRM session end:", res)
    except urllib.error.HTTPError as exc:
        print("CRM session-end error:", exc.code, exc.read().decode("utf-8", errors="replace")[:500])
    except Exception as exc:
        print("CRM session-end error:", exc)


def poll_commands() -> None:
    base = os.environ.get("BACKEND_BASE_URL", "http://localhost:3000/api").rstrip("/")
    room_id = os.environ["ROOM_ID"]
    key = os.environ["STATION_API_KEY"]
    interval = float(os.environ.get("POLL_INTERVAL_SEC", "2"))

    while True:
        try:
            commands = http_json(
                "GET",
                f"{base}/station/rooms/{room_id}/commands",
                key,
            )
        except urllib.error.HTTPError as exc:
            print("CRM poll error:", exc.code, exc.read().decode("utf-8", errors="replace")[:500])
            time.sleep(interval)
            continue
        except Exception as exc:
            print("CRM poll error:", exc)
            time.sleep(interval)
            continue

        ack_ids: list[str] = []
        for command in commands or []:
            payload = command.get("payload") or {}
            if isinstance(payload, dict):
                remember_session_payload(payload)
            frame = json.dumps(payload, ensure_ascii=False)
            sent = broadcast_to_ue(frame)
            if sent:
                print(f"CRM -> UE ({sent} clients): {frame}")
                ack_ids.append(command["id"])
            else:
                print("Command pending, no UE client connected:", frame)

        if ack_ids:
            try:
                http_json(
                    "POST",
                    f"{base}/station/rooms/{room_id}/commands/ack",
                    key,
                    {"commandIds": ack_ids},
                )
            except Exception as exc:
                print("CRM ack error:", exc)

        time.sleep(interval)


def heartbeat_loop() -> None:
    base = os.environ.get("BACKEND_BASE_URL", "http://localhost:3000/api").rstrip("/")
    room_id = os.environ["ROOM_ID"]
    key = os.environ["STATION_API_KEY"]
    build_version = os.environ.get("UE_BUILD_VERSION", "dev")
    interval = float(os.environ.get("HEARTBEAT_INTERVAL", "30"))
    started = time.time()

    while True:
        try:
            http_json(
                "POST",
                f"{base}/station/rooms/{room_id}/heartbeat",
                key,
                {
                    "buildVersion": build_version,
                    "uptimeSeconds": int(time.time() - started),
                },
            )
        except Exception as exc:
            print("CRM heartbeat error:", exc)
        time.sleep(interval)


def main() -> None:
    host = os.environ.get("AGENT_WS_HOST", "127.0.0.1")
    port = int(os.environ.get("AGENT_WS_PORT", "8080"))

    threading.Thread(target=poll_commands, daemon=True).start()
    threading.Thread(target=heartbeat_loop, daemon=True).start()

    with ThreadingWsServer((host, port), WsHandler) as server:
        print(f"Room Agent listening on ws://{host}:{port}/ws/laser")
        server.serve_forever()


if __name__ == "__main__":
    main()
