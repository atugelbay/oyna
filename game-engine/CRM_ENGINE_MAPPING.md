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
  ← session_started → ACTIVE + engineSessionId
  ← level_finished  → SessionMatchReport
  ← session_finished → end + scores + debit
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
| `POST /game-sessions/start` | `room_api.lobby_add_player` (+ опц. `room_api.dev_select`) | `POST /lobby/players`, `POST /_dev/select` |
| activate | `room_api.dev_start` | `POST /_dev/start` (только dev/mock) |
| cancel pending | `room_api.lobby_remove_player` | `DELETE /lobby/players/{id}` |
| end с score=0 + есть `engineSessionId` | `room_api.session_stop` | `POST /session/stop` (финал ждём `session_finished`) |
| pause / resume | — | только таймер CRM |

`mode_id` для `_dev/select` берётся из `GameMode.config.mode_id` (например `"lasers.corridor"`).

## События журнала → Nest

| `type` | Действие CRM |
|--------|----------------|
| `room_online` | heartbeat build |
| `lobby_changed` / `room_status` | пока ignore |
| `session_started` | PENDING/ACTIVE → `engineSessionId`, status ACTIVE |
| `level_finished` | upsert `SessionMatchReport` |
| `session_finished` | `endSession` (очки из `payload.players[].total_score` / `total_score`) |

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
| `PENDING` | Игроки поставлены в лобби, игра ещё не стартовала |
| `ACTIVE` | `session_started` (или CRM activate) |
| `COMPLETED` | `session_finished` / end |
| `CANCELLED` | отмена лобби + remove players |

## Запуск агента

См. [agent/README.md](agent/README.md).
