# CRM ↔ Room API v1 mapping

Контракт между NestJS (`../backend`) и игровым **Room API v1**
(`Docs/api/room_api_v1` в репозитории комнаты / моноблок).

Глобальный префикс Nest: **`/api`**.

Игра на моноблоке: **`http://<host>:8080/v1`**, заголовок **`X-Room-Key`**.
Агент комнаты — клиент обоих API (не WS-сервер для UE).

## Поток

```
CRM UI (JWT)
  → Nest enqueue RoomAgentCommand { method, path, body, idempotency_key }
Room Agent
  → HTTP Room API (lobby/players, session/stop, _dev/…)
Room Agent
  ← GET /v1/events (journal)
  → POST /api/station/rooms/:roomId/room-events
Nest
  ← session_started → ACTIVE + engineSessionId + debit 10 мин
  ← level_finished  → SessionMatchReport (+ unlocks_next → PlayerModeUnlock)
  ← lobby_changed(exit_button / empty) → CANCELLED pending
  ← session_finished → end + scores + PUT /hall_records
```

## Маршруты Nest (станция)

| Назначение | Nest (Bearer station key) |
|------------|---------------------------|
| Heartbeat | `POST /api/station/rooms/:roomId/heartbeat` |
| Очередь команд | `GET /api/station/rooms/:roomId/commands` |
| Ack команд | `POST /api/station/rooms/:roomId/commands/ack` |
| Журнал Room API | **`POST /api/station/rooms/:roomId/room-events`** `{ "events": [ envelope… ] }` |
| Каталог режимов | **`POST /api/station/rooms/:roomId/catalog`** ← тело `GET /v1/catalog` (+ `catalog_hash`) |
| Match report (legacy) | `POST .../sessions/:sessionId/match-reports` |
| End (legacy / от агента) | `POST .../sessions/:sessionId/end` |

Каталог: агент при старте и при `room_online` с новым `catalog_hash` забирает `GET /v1/catalog` и шлёт в Nest.
Nest пишет `Room.catalogJson` / `engineRoomId` и upsert’ит `GameMode` с `config.mode_id` + название из `title.ru`.
Launch UI показывает эти режимы как «Режим с моноблока».

`roomId` = UUID комнаты в CRM.

## Команды в очереди (payload)

```json
{
  "method": "POST",
  "path": "/lobby/players",
  "body": { "player_id": "uuid", "nick": "Aru", "source": "operator" },
  "idempotency_key": "uuid"
}
```

| CRM действие | type | Room API |
|--------------|------|----------|
| `POST /game-sessions/start` | `room_api.lobby_add_player` (+ `dev_select` если `Room.useDevCommands`) | `POST /lobby/players` (`minutes_left`, `unlocked`, `rating_month`, `rank_month`), опц. `POST /_dev/select` |
| activate | `room_api.dev_start` | `POST /_dev/start` (только `useDevCommands`; зал — кнопка на HUD) |
| cancel pending | `room_api.lobby_remove_player` | `DELETE /lobby/players/{id}` |
| end с score=0 + есть `engineSessionId` | `room_api.session_stop` | `POST /session/stop` (финал ждём `session_finished`) |
| после `session_finished` / `room_online` | `room_api.hall_records` | `PUT /hall_records` |
| pause / resume | — | только таймер CRM |

`mode_id` для `_dev/select` берётся из `GameMode.config.mode_id` (например `"lasers.corridor"`).

## События журнала → Nest

| `type` | Действие CRM |
|--------|----------------|
| `room_online` | heartbeat + QR + `PUT /hall_records` |
| `room_status` | ignore |
| `lobby_changed` | `reason=exit_button` или пустые `players` → PENDING → CANCELLED; иначе ignore |
| `session_started` | PENDING/ACTIVE → `engineSessionId`, ACTIVE, списание 10 мин (`balanceDebitedAt`) |
| `level_finished` | upsert `SessionMatchReport`; при `unlocks_next` — открыть `level+1` в `PlayerModeUnlock` |
| `session_finished` | `endSession` + `PUT /hall_records` |

Связка сессий: `GameSession.engineSessionId` = `session_id` из Room API.

## Аутентификация

| Клиент | Заголовок |
|--------|-----------|
| CRM UI | `Authorization: Bearer <JWT>` |
| Room Agent → Nest | `Authorization: Bearer <STATION_API_KEY>` |
| Room Agent → игра | `X-Room-Key: <ROOM_API_KEY>` |

## Статусы

| Prisma | Смысл |
|--------|-------|
| `PENDING` | Игроки в лобби; зал ждёт «НАЧАТЬ ИГРУ» на HUD |
| `ACTIVE` | `session_started` (или CRM activate при `useDevCommands`) |
| `COMPLETED` | `session_finished` / end |
| `CANCELLED` | отмена лобби + remove players |

`Room.useDevCommands`: **false** (зал) — только `lobby/players`, без `/_dev/*`. **true** (virtual/mock) — `dev_select` + `activate` → `dev_start`.

## Запуск агента

См. [agent/README.md](agent/README.md).
