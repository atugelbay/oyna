#!/usr/bin/env python3
"""
Minimal Room Agent loop: poll CRM command queue and print payloads.
Extend: forward each command to UE WebSocket, then POST .../commands/ack.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request


def main() -> None:
    base = os.environ.get("BACKEND_BASE_URL", "http://localhost:3000/api").rstrip("/")
    room_id = os.environ["ROOM_ID"]
    key = os.environ["STATION_API_KEY"]
    interval = float(os.environ.get("POLL_INTERVAL_SEC", "2"))

    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }

    while True:
        url = f"{base}/station/rooms/{room_id}/commands"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                commands = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            print("poll error:", e.code, e.read().decode()[:500])
            time.sleep(interval)
            continue
        except urllib.error.URLError as e:
            print("network error:", e)
            time.sleep(interval)
            continue

        if commands:
            print(json.dumps(commands, ensure_ascii=False, indent=2))
            ids = [c["id"] for c in commands if "id" in c]
            if ids:
                ack_url = f"{base}/station/rooms/{room_id}/commands/ack"
                body = json.dumps({"commandIds": ids}).encode()
                ack_req = urllib.request.Request(
                    ack_url,
                    data=body,
                    headers={**headers, "Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(ack_req, timeout=30) as aresp:
                        print("ack:", aresp.read().decode())
                except urllib.error.HTTPError as e:
                    print("ack error:", e.code, e.read().decode()[:500])

        time.sleep(interval)


if __name__ == "__main__":
    main()
