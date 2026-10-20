#!/usr/bin/env python3
"""
Room Agent — мост CRM Nest ↔ Room API v1 (игра на моноблоке).

Архитектура v1:
  Игра = HTTP/WS сервер http://127.0.0.1:8080/v1 (X-Room-Key)
  Агент = клиент игры + клиент CRM (Bearer STATION_API_KEY)

Потоки:
  1) Long-poll GET /v1/events → POST CRM /station/rooms/{id}/room-events → POST /v1/events/ack
  2) Poll CRM /station/.../commands → HTTP-вызов в Room API (method/path/body)
  3) Heartbeat CRM
  4) GET /v1/catalog → POST CRM /station/rooms/{id}/catalog (при старте и смене catalog_hash)

Env:
  BACKEND_BASE_URL   http://localhost:3000/api
  ROOM_ID            UUID комнаты в CRM
  STATION_API_KEY    ключ станции CRM
  ROOM_API_BASE      http://127.0.0.1:8080/v1
  ROOM_API_KEY       X-Room-Key (у заглушки: dev)
  POLL_INTERVAL_SEC  2
  EVENTS_WAIT_SEC    20
  HEARTBEAT_INTERVAL 30
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None or value == "":
        raise SystemExit(f"Missing required env: {name}")
    return value


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
    timeout: float = 30,
) -> Any:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req_headers = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else None


def crm_json(
    method: str,
    path: str,
    token: str,
    body: dict[str, Any] | None = None,
    timeout: float = 30,
) -> Any:
    base = os.environ.get("BACKEND_BASE_URL", "http://localhost:3000/api").rstrip("/")
    return http_json(
        method,
        f"{base}{path}",
        headers={"Authorization": f"Bearer {token}"},
        body=body,
        timeout=timeout,
    )


def room_json(
    method: str,
    path: str,
    room_key: str,
    body: dict[str, Any] | None = None,
    *,
    idempotency_key: str | None = None,
    timeout: float = 30,
) -> Any:
    base = os.environ.get("ROOM_API_BASE", "http://127.0.0.1:8080/v1").rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    headers = {"X-Room-Key": room_key}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return http_json(
        method,
        f"{base}{path}",
        headers=headers,
        body=body,
        timeout=timeout,
    )


_last_catalog_hash: str | None = None


def sync_catalog(force: bool = False, catalog_hash: str | None = None) -> None:
    """Выгрузить GET /v1/catalog в CRM (режимы для UI)."""
    global _last_catalog_hash
    room_id = env("ROOM_ID")
    station_key = env("STATION_API_KEY")
    room_key = env("ROOM_API_KEY", "dev")

    if (
        not force
        and catalog_hash
        and _last_catalog_hash
        and catalog_hash == _last_catalog_hash
    ):
        return

    try:
        catalog = room_json("GET", "/catalog", room_key, timeout=15)
    except Exception as exc:
        print("Room catalog fetch error:", exc)
        return

    if not isinstance(catalog, dict):
        print("Room catalog: unexpected body")
        return

    body = dict(catalog)
    if catalog_hash:
        body["catalog_hash"] = catalog_hash
    elif isinstance(body.get("catalog_hash"), str):
        catalog_hash = body["catalog_hash"]

    try:
        res = crm_json(
            "POST",
            f"/station/rooms/{room_id}/catalog",
            station_key,
            body,
        )
        _last_catalog_hash = catalog_hash or _last_catalog_hash or "synced"
        print("CRM catalog sync:", res)
    except urllib.error.HTTPError as exc:
        print(
            "CRM catalog error:",
            exc.code,
            exc.read().decode("utf-8", errors="replace")[:500],
        )
    except Exception as exc:
        print("CRM catalog error:", exc)


def events_loop() -> None:
    room_id = env("ROOM_ID")
    station_key = env("STATION_API_KEY")
    room_key = env("ROOM_API_KEY", "dev")
    wait = float(os.environ.get("EVENTS_WAIT_SEC", "20"))
    after: int | None = None

    # Стартовый курсор из health
    try:
        health = room_json("GET", "/health", room_key, timeout=10)
        after = int(health.get("acked_up_to") or 0)
        print(f"Room health ok, acked_up_to={after}, state={health.get('state')}")
    except Exception as exc:
        print("Room health error (will retry from after=0):", exc)
        after = 0

    sync_catalog(force=True)

    while True:
        try:
            qs = urllib.parse.urlencode(
                {"after": after if after is not None else 0, "limit": 100, "wait": wait}
            )
            page = room_json("GET", f"/events?{qs}", room_key, timeout=wait + 10)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:400]
            print("Room events error:", exc.code, body)
            time.sleep(2)
            continue
        except Exception as exc:
            print("Room events error:", exc)
            time.sleep(2)
            continue

        events = page.get("events") or []
        next_cursor = int(page.get("next_cursor") or after or 0)

        if events:
            for ev in events:
                if isinstance(ev, dict) and ev.get("type") == "room_online":
                    payload = ev.get("payload") or {}
                    ch = payload.get("catalog_hash")
                    if isinstance(ch, str) and ch:
                        sync_catalog(catalog_hash=ch)

            try:
                res = crm_json(
                    "POST",
                    f"/station/rooms/{room_id}/room-events",
                    station_key,
                    {"events": events},
                )
                print(f"CRM room-events ({len(events)}):", res)
            except urllib.error.HTTPError as exc:
                print(
                    "CRM room-events error:",
                    exc.code,
                    exc.read().decode("utf-8", errors="replace")[:500],
                )
                time.sleep(2)
                continue
            except Exception as exc:
                print("CRM room-events error:", exc)
                time.sleep(2)
                continue

            try:
                ack = room_json(
                    "POST",
                    "/events/ack",
                    room_key,
                    {"up_to": next_cursor},
                    idempotency_key=str(uuid.uuid4()),
                )
                print("Room events ack:", ack)
            except Exception as exc:
                print("Room events ack error:", exc)

        after = next_cursor


def execute_room_command(payload: dict[str, Any], room_key: str) -> None:
    method = str(payload.get("method") or "GET").upper()
    path = str(payload.get("path") or "")
    if not path:
        raise ValueError("command payload missing path")
    body = payload.get("body")
    if body is not None and not isinstance(body, dict):
        raise ValueError("command body must be object or null")
    idem = payload.get("idempotency_key") or str(uuid.uuid4())

    # Старые flat WS-payloads больше не шлём в игру
    if "event" in payload and "path" not in payload:
        print("Skip legacy WS payload:", payload.get("event"))
        return

    res = room_json(
        method,
        path,
        room_key,
        body if isinstance(body, dict) else None,
        idempotency_key=str(idem),
        timeout=20,
    )
    print(f"Room {method} {path} ->", res)


def poll_commands() -> None:
    room_id = env("ROOM_ID")
    station_key = env("STATION_API_KEY")
    room_key = env("ROOM_API_KEY", "dev")
    interval = float(os.environ.get("POLL_INTERVAL_SEC", "2"))

    while True:
        try:
            commands = crm_json(
                "GET",
                f"/station/rooms/{room_id}/commands",
                station_key,
            )
        except Exception as exc:
            print("CRM poll error:", exc)
            time.sleep(interval)
            continue

        ack_ids: list[str] = []
        for command in commands or []:
            payload = command.get("payload") or {}
            try:
                if isinstance(payload, dict) and payload.get("path"):
                    execute_room_command(payload, room_key)
                    ack_ids.append(command["id"])
                else:
                    print("Skip unknown command payload:", command.get("type"), payload)
                    ack_ids.append(command["id"])  # не блокируем очередь legacy
            except urllib.error.HTTPError as exc:
                # 404 на /_dev/* в зальной сборке — ack, чтобы не крутить вечно
                body = exc.read().decode("utf-8", errors="replace")[:400]
                print("Room command HTTP error:", exc.code, body)
                if exc.code in (404, 409):
                    ack_ids.append(command["id"])
            except Exception as exc:
                print("Room command error:", exc)

        if ack_ids:
            try:
                crm_json(
                    "POST",
                    f"/station/rooms/{room_id}/commands/ack",
                    station_key,
                    {"commandIds": ack_ids},
                )
            except Exception as exc:
                print("CRM ack error:", exc)

        time.sleep(interval)


def heartbeat_loop() -> None:
    room_id = env("ROOM_ID")
    station_key = env("STATION_API_KEY")
    room_key = env("ROOM_API_KEY", "dev")
    interval = float(os.environ.get("HEARTBEAT_INTERVAL", "30"))
    started = time.time()

    while True:
        build = os.environ.get("UE_BUILD_VERSION", "agent")
        try:
            room = room_json("GET", "/room", room_key, timeout=10)
            build = str(room.get("build") or build)
        except Exception:
            pass

        try:
            crm_json(
                "POST",
                f"/station/rooms/{room_id}/heartbeat",
                station_key,
                {
                    "buildVersion": build,
                    "uptimeSeconds": int(time.time() - started),
                },
            )
        except Exception as exc:
            print("CRM heartbeat error:", exc)
        time.sleep(interval)


def main() -> None:
    env("ROOM_ID")
    env("STATION_API_KEY")
    room_base = os.environ.get("ROOM_API_BASE", "http://127.0.0.1:8080/v1")
    print(f"Room Agent v1 → game {room_base}, CRM {os.environ.get('BACKEND_BASE_URL', 'http://localhost:3000/api')}")

    threading.Thread(target=events_loop, daemon=True, name="events").start()
    threading.Thread(target=poll_commands, daemon=True, name="commands").start()
    threading.Thread(target=heartbeat_loop, daemon=True, name="heartbeat").start()

    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
