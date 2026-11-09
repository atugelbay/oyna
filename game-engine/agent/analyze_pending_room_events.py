#!/usr/bin/env python3
"""
Диагностика очереди Room API до ack (на моноблоке, журнал не трогаем).

Читает GET /v1/health и GET /v1/events?after=…&limit=… — показывает размер
той пачки, которую агент пытается отправить в CRM.

  cd game-engine\\agent
  python analyze_pending_room_events.py
"""
from __future__ import annotations

import json
import os
import urllib.parse
from pathlib import Path

from room_agent import env, load_dotenv_file, room_json


def main() -> None:
    agent_dir = Path(__file__).resolve().parent
    load_dotenv_file(agent_dir / ".env")
    load_dotenv_file(agent_dir / "room_agent.env")
    room_key = env("ROOM_API_KEY", "dev")
    fetch_limit = max(1, int(os.environ.get("EVENTS_FETCH_LIMIT", "50")))

    health = room_json("GET", "/health", room_key, timeout=10)
    after = int(health.get("acked_up_to") or 0)
    qs = urllib.parse.urlencode({"after": after, "limit": fetch_limit, "wait": 0})
    page = room_json("GET", f"/events?{qs}", room_key, timeout=15)
    events = page.get("events") or []

    body = {"events": events}
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
    print(f"acked_up_to={after}, pending events={len(events)}")
    print(f"POST /room-events body≈{len(raw)} bytes ({len(raw) / 1024:.1f} KiB)")
    if not events:
        return

    ranked: list[tuple[int, str, str]] = []
    for ev in events:
        chunk = json.dumps(ev, ensure_ascii=False).encode("utf-8")
        if isinstance(ev, dict):
            ranked.append(
                (
                    len(chunk),
                    str(ev.get("type") or "?"),
                    str(ev.get("cursor") or ev.get("event_id") or "?"),
                )
            )
        else:
            ranked.append((len(chunk), "?", "?"))
    ranked.sort(reverse=True)
    for nbytes, typ, ref in ranked[:15]:
        print(f"  · {typ} ({ref}): {nbytes} bytes ({nbytes / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
