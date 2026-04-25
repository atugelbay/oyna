# CRM ↔ game-engine mapping

Сводный контракт между NestJS API (`../backend`), черновиком [INTEGRATION.md](INTEGRATION.md)/[openapi.yaml](openapi.yaml) и WebSocket [WS_PROTOCOL.md](WS_PROTOCOL.md).

Глобальный префикс HTTP: **`/api`** (`../backend/src/main.ts`).

## Маршруты Nest ↔ черновик openapi

| Назначение | Реальный Nest (JWT оператор) | Черновик openapi |
|------------|------------------------------|------------------|
| Создать сессию | `POST /api/game-sessions/start` | `POST /api/v1/sessions` |
| Активировать (UE/агент) | `POST /api/game-sessions/:token/activate` | `POST /api/v1/sessions/{id}/start` (аналог по смыслу) |
| Пауза | `POST /api/game-sessions/:id/pause` | `POST .../pause` |
| Resume | `POST /api/game-sessions/:id/resume` | `POST .../resume` |
| Отмена лобби | `POST /api/game-sessions/:id/cancel-pending` | `POST .../cancel` |
| Завершение + очки | `POST /api/game-sessions/:id/end` или **`POST /api/station/rooms/:roomId/sessions/:sessionId/end`** (ключ станции) | `POST .../end` |
| Активация без JWT | **`POST /api/station/rooms/:roomId/sessions/activate-by-token`** `{ "sessionToken" }` | — |
| Сессия по токену | `GET /api/game-sessions/by-token/:token` | — |
| Список сессий | `GET /api/game-sessions` | — |
| Heartbeat станции | `POST /api/station/rooms/:roomId/heartbeat` | `POST /api/v1/stations/{id}/heartbeat` |
| Команды CRM → агент | `GET /api/station/rooms/:roomId/commands` | `GET .../sessions/{id}/events` (аналог) |
| Ack команд | `POST /api/station/rooms/:roomId/commands/ack` | — |
| Отчёт уровня (идемп.) | `POST /api/station/rooms/:roomId/sessions/:sessionId/match-reports` | `POST .../matches` |

`roomId` в путях станции = UUID комнаты в CRM (= «station» в терминах железа для одной комнаты = один ноутбук).

## Аутентификация

| Клиент | Заголовок |
|--------|-----------|
| CRM UI / оператор | `Authorization: Bearer <JWT>` |
| Room Agent | `Authorization: Bearer <STATION_API_KEY>` + маршруты под `/api/station/...` |

Ключ станции: bcrypt-хэш в `Room.stationApiKeyHash`. Выдаётся администратором (см. API комнат); в логах не хранить.

## Статусы `GameSession` (Prisma) ↔ события WS

| Prisma `SessionStatus` | Смысл | Типичные WS к UE (через очередь команд) |
|------------------------|-------|----------------------------------------|
| `PENDING` | Лобби после `start` | `session_created`; при джойне игроков — `player_joined`* |
| `ACTIVE` | Игра идёт | `session_start` / `session_pause` / `session_resume` |
| `COMPLETED` | Успешное завершение | — |
| `CANCELLED` | Отмена | `session_cancel` |
| `ERROR` | Авария | `session_cancel` или расширение `error` |

\*В текущей CRM игроки задаются при `start` (`playerIds`); событие `player_joined` из QR-потока может появиться позже при расширении бэкенда. Пока агент может слать в UE только состав из ответа `start`.

## Тела запросов (ключи JSON на английском)

### `POST /api/game-sessions/start`

```json
{
  "roomId": "uuid",
  "modeId": "uuid",
  "venueId": "uuid",
  "playerIds": ["uuid", "uuid"]
}
```

### `POST /api/game-sessions/:id/end`

```json
{
  "durationSeconds": 600,
  "results": [{ "userId": "uuid", "score": 1500 }]
}
```

Идемпотентность: повтор того же завершения после `COMPLETED` возвращает `200` без повторного списания/очков.

### `POST /api/station/rooms/:roomId/heartbeat`

```json
{
  "buildVersion": "1.0.0",
  "uptimeSeconds": 3600,
  "currentSessionId": "uuid-or-null"
}
```

### `POST /api/station/rooms/:roomId/sessions/:sessionId/match-reports`

```json
{
  "level": 1,
  "attemptNumber": 1,
  "durationSeconds": 105,
  "completedAt": "2026-04-19T15:31:48.000Z",
  "result": {
    "finalScore": 1920,
    "livesLeft": 3,
    "bVictory": true,
    "mode": "classic"
  }
}
```

Повтор с тем же `(sessionId, level, attemptNumber)` → `200`, запись не дублируется.

## Payload очереди команд (`RoomAgentCommand`)

Текущий C++ движок читает root-level поле `event` в `OLMain.cpp::DispatchEvent`, поэтому `payload` команды уже является готовым WebSocket-фреймом для UE:

- `session_created` — после успешного `startSession`: `{ "event": "session_created", "session_id": "...", ... }`
- `session_start` — после `activateSession`: `{ "event": "session_start", "session_id": "...", "mode": "classic", "level": 1 }`
- `session_pause` / `session_resume` — после pause/resume
- `session_cancel` — после `cancel-pending`

Агент [agent/room_agent.py](agent/room_agent.py) поднимает локальный WebSocket-сервер `ws://localhost:8080/ws/laser`, ждёт подключение UE-клиента, отправляет эти payload-фреймы и ack'ает команду только после доставки хотя бы одному UE-клиенту.

## UE → CRM

Движок отправляет в агента `match_completed`:

```json
{
  "event": "match_completed",
  "session_id": "uuid",
  "level": 1,
  "attempt_number": 1,
  "duration_seconds": 42,
  "final_score": 1920,
  "lives_left": 3,
  "victory": true,
  "mode": "classic"
}
```

Агент сохраняет это через `POST /api/station/rooms/:roomId/sessions/:sessionId/match-reports`.

## Таймер и пауза

- **CRM**: `pausedAt`, сдвиг `startTime` при resume — логика в `../backend/src/game-sessions/game-sessions.service.ts`.
- **UE**: игровое время не тикает при паузе (`bPaused`); длительность для списания — источник истины CRM/оператор при `end`.

## Документы-источники правды

- Схема БД: только `../backend/prisma/schema.prisma`, не [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md).
- OpenAPI в репозитории: [openapi.yaml](openapi.yaml) (синхронизирован с `/api/...`).
