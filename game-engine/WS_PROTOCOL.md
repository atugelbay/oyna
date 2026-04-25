# OYNA Lasers — WebSocket Protocol (UE ↔ Middleware)

> Подробная справка по всем JSON сообщениям между UE и middleware.
> Middleware проксирует их в backend REST.

---

## General format

> **Важно:** текущий C++ в `OLMain.cpp::DispatchEvent` уже работает с root-level полем `event`.
> Формат `type` + `payload` ниже оставлен как целевой контракт. Для физического запуска сейчас агент отправляет в UE плоский JSON:
>
> ```json
> { "event": "session_start", "session_id": "uuid", "mode": "classic", "level": 1 }
> ```
>
> См. `agent/room_agent.py` и `CRM_ENGINE_MAPPING.md`.

```json
{
  "type": "event_name",
  "payload": { /* event-specific */ }
}
```

- `type` — snake_case имя события
- `payload` — всегда объект, не массив
- Кодировка: UTF-8
- Transport: WebSocket text frames, одно сообщение = один frame

---

## Connection

- **URL:** `ws://localhost:8080/ws/laser` (hardcoded сейчас, можно вынести в config)
- **Open:** UE автоматически подключается в `BeginPlay`
- **Reconnect:** UE пытается reconnect 1s/2s/5s/10s backoff (currently существует)
- **Close:** UE при `EndPlay` должен слать `disconnect` перед закрытием

---

## Messages: Backend → UE (incoming)

### `session_created`

Backend создал новую сессию, UE должен показать QR и ждать игроков.

```json
{
  "type": "session_created",
  "payload": {
    "sessionId": "sess_8f3a2c1d-b4f5-4e8a-9c3d-1f2a3b4c5d6e",
    "sessionToken": "tok_9K7xPmN2vQ8rB5tL3wZ6yC1hJ4fD",
    "stationId": "laser-matrix-01",
    "mode": "classic",
    "startLevel": 1,
    "maxPlayers": 6,
    "joinCode": "7AB-KZ9",
    "qrImageUrl": "https://api.oyna.pro/v1/qr/7AB-KZ9.png",
    "durationSeconds": 600,
    "waitingTimeoutSeconds": 600,
    "createdAt": "2026-04-19T15:30:00.000Z"
  }
}
```

**UE должен:**
1. Сохранить `sessionId`, `sessionToken`, `durationSeconds`
2. Показать QR на экране (использовать `qrImageUrl` — fetch и render)
3. Показать `joinCode` крупным текстом (для случая если игрок не может сканировать)
4. Ответить `qr_shown` как только QR виден
5. Перейти в UI состояние "Waiting for players"

### `player_joined`

Игрок отсканировал QR и был успешно добавлен в сессию. Backend уже списал 10 минут с баланса.

```json
{
  "type": "player_joined",
  "payload": {
    "sessionId": "sess_...",
    "slot": 0,
    "userId": "user_1234567890",
    "displayName": "Aybar",
    "color": "#FF3355",
    "joinedAt": "2026-04-19T15:32:18.000Z",
    "totalPlayers": 1
  }
}
```

**UE должен:**
1. Добавить игрока в `SessionPlayers[slot]`
2. Обновить HUD — показать имя и цвет в нужном слоте
3. Проиграть sound effect "player joined"
4. Broadcast `OnPlayerJoined` delegate для UMG

### `session_start`

Оператор нажал "Начать". UE запускает Countdown → Playing.

```json
{
  "type": "session_start",
  "payload": {
    "sessionId": "sess_...",
    "countdownSeconds": 3,
    "players": [
      { "slot": 0, "userId": "user_1234567890", "displayName": "Aybar", "color": "#FF3355" },
      { "slot": 1, "userId": "user_5678901234", "displayName": "Alibek", "color": "#33FF88" }
    ]
  }
}
```

**UE должен:**
1. Сохранить финальный список players
2. Перейти в состояние `Countdown`
3. Показать WBP_Countdown (3-2-1)
4. После countdown — `Playing`, запустить 1-й уровень (по `startLevel` из session_created)
5. Запустить session timer (600 секунд по умолчанию)
6. Ответить `countdown_started` + позже `match_started` для level 1

### `session_pause`

Оператор приостановил игру.

```json
{
  "type": "session_pause",
  "payload": {
    "sessionId": "sess_...",
    "reason": "operator_request",
    "pausedAt": "2026-04-19T15:35:00.000Z"
  }
}
```

**UE должен:**
1. `bPaused = true`
2. Остановить tick игровой логики (включая session timer, level timer)
3. Приостановить анимации лазеров
4. Показать UI "GAME PAUSED"
5. Broadcast `OnSessionPaused(true)`

### `session_resume`

```json
{
  "type": "session_resume",
  "payload": {
    "sessionId": "sess_...",
    "resumedAt": "2026-04-19T15:36:12.000Z"
  }
}
```

**UE должен:** `bPaused = false`, скрыть pause UI, возобновить tick.

### `session_cancel`

Оператор полностью отменил сессию.

```json
{
  "type": "session_cancel",
  "payload": {
    "sessionId": "sess_...",
    "reason": "operator_request",
    "message": "Session cancelled by operator"
  }
}
```

**UE должен:**
1. Остановить всё
2. Показать экран "Session cancelled" (5-10 секунд)
3. Очистить все session fields
4. Вернуться в Idle состояние

---

## Messages: UE → Backend (outgoing)

Все outgoing сообщения должны содержать `sessionToken` в payload для аутентификации на backend.

### `qr_shown`

UE подтверждает что QR виден игрокам. Backend переводит status → WAITING.

```json
{
  "type": "qr_shown",
  "payload": {
    "sessionId": "sess_...",
    "sessionToken": "tok_...",
    "shownAt": "2026-04-19T15:30:01.500Z"
  }
}
```

### `countdown_started`

Опционально, для логов.

```json
{
  "type": "countdown_started",
  "payload": {
    "sessionId": "sess_...",
    "sessionToken": "tok_...",
    "countdownSeconds": 3,
    "startedAt": "2026-04-19T15:35:00.000Z"
  }
}
```

### `match_started` ⭐

Начался очередной уровень в сессии.

```json
{
  "type": "match_started",
  "payload": {
    "sessionId": "sess_...",
    "sessionToken": "tok_...",
    "level": 1,
    "attemptNumber": 1,
    "mode": "classic",
    "startedAt": "2026-04-19T15:35:03.000Z",
    "levelConfig": {
      "lasersCount": 8,
      "durationSeconds": 90
    }
  }
}
```

**`attemptNumber`:** если в сессии игрок переигрывает уровень (например прошёл, потом опять пошёл на него) — инкрементируется. Для первой попытки — 1.

### `match_completed` ⭐⭐⭐ КРИТИЧЕСКИ ВАЖНО

**Обязательно идемпотентно.** Middleware должен добавить `Idempotency-Key: {sessionId}-L{level}-A{attemptNumber}` в REST запрос к backend.

```json
{
  "type": "match_completed",
  "payload": {
    "sessionId": "sess_...",
    "sessionToken": "tok_...",
    "level": 1,
    "attemptNumber": 1,
    "startedAt": "2026-04-19T15:35:03.000Z",
    "completedAt": "2026-04-19T15:36:48.000Z",
    "durationSeconds": 105.0,
    "result": {
      "finalScore": 1920,
      "livesLeft": 3,
      "livesBonus": 1500,
      "timeBonus": 420,
      "timeUsed": 42.0,
      "bVictory": true,
      "reason": "Уровень пройден",
      "failReason": null,
      "mode": "classic"
    }
  }
}
```

**Для failed match:**
```json
{
  "type": "match_completed",
  "payload": {
    "sessionId": "sess_...",
    "result": {
      "finalScore": 0,
      "livesLeft": 0,
      "bVictory": false,
      "reason": "Все жизни потеряны",
      "failReason": "lives_lost",
      ...
    }
  }
}
```

`failReason`: `"time_out"` | `"lives_lost"` | `"session_ended"` (сессия кончилась в середине уровня) | `null`.

### `life_lost` (optional, low priority)

Для live-таймлайна на TV экране или личном кабинете игрока.

```json
{
  "type": "life_lost",
  "payload": {
    "sessionId": "sess_...",
    "level": 1,
    "laserId": 23,
    "livesRemaining": 2,
    "at": "2026-04-19T15:35:45.500Z"
  }
}
```

Отправлять только если backend запросил live updates (флаг в session_created). В противном случае — лишний трафик.

### `session_ended` ⭐⭐ КРИТИЧЕСКИ ВАЖНО

Идемпотентно. Триггерит расчёт рейтинга на backend. Отправляется ровно один раз за сессию.

```json
{
  "type": "session_ended",
  "payload": {
    "sessionId": "sess_...",
    "sessionToken": "tok_...",
    "endedAt": "2026-04-19T15:40:00.000Z",
    "reason": "time_elapsed",
    "durationSeconds": 600,
    "matchesPlayed": 3,
    "matchesWon": 2,
    "totalScore": 4280,
    "matches": [
      {
        "level": 1,
        "attemptNumber": 1,
        "finalScore": 1920,
        "bVictory": true,
        "reason": "Уровень пройден"
      },
      {
        "level": 2,
        "attemptNumber": 1,
        "finalScore": 1500,
        "bVictory": true,
        "reason": "Уровень пройден"
      },
      {
        "level": 3,
        "attemptNumber": 1,
        "finalScore": 860,
        "bVictory": false,
        "reason": "Время вышло"
      }
    ]
  }
}
```

`reason`: `"time_elapsed"` | `"operator_cancelled"` | `"all_levels_completed"` | `"network_error"` | `"error"`

Backend gets full summary of session. Rating recalc starts.

### `heartbeat`

Каждые 30 секунд. Подтверждение что UE жив и работает.

```json
{
  "type": "heartbeat",
  "payload": {
    "stationId": "laser-matrix-01",
    "buildVersion": "1.0.0",
    "uptime": 3600,
    "currentSessionId": "sess_..." ,
    "currentSessionStatus": "playing",
    "hardwareStatus": "connected"
  }
}
```

`currentSessionId` = null если сессии нет сейчас.
Middleware обновляет своё состояние + шлёт в backend каждый N-й heartbeat.

---

## Error messages

Middleware может ответить UE на плохое сообщение:

```json
{
  "type": "error",
  "payload": {
    "code": "INVALID_SESSION_TOKEN",
    "message": "Session token does not match sessionId",
    "originalType": "match_completed",
    "originalIdempotencyKey": "sess_xyz-L5-A2"
  }
}
```

Codes:
- `INVALID_SESSION_TOKEN` — UE шлёт неверный token
- `UNKNOWN_SESSION` — sessionId не найден
- `OUT_OF_ORDER` — например session_ended до match_completed для последнего уровня
- `MALFORMED_JSON`
- `RATE_LIMITED` — слишком частые сообщения
- `INTERNAL` — backend error

UE должен логировать все errors, но не крашиться. В случае `INVALID_SESSION_TOKEN` — попытаться `session_recovery` flow.

---

## Recovery flow

Если UE теряет соединение с middleware или рестартует в середине сессии:

1. UE пытается reconnect
2. При установке соединения — UE шлёт:

```json
{
  "type": "recovery_request",
  "payload": {
    "stationId": "laser-matrix-01",
    "currentSessionId": "sess_..." /* если помнит */
  }
}
```

3. Middleware проверяет в backend состояние сессии, отвечает:

```json
{
  "type": "session_recovery",
  "payload": {
    "sessionId": "sess_...",
    "status": "ACTIVE",
    "players": [...],
    "matchesCompleted": [
      { "level": 1, "finalScore": 1920 }
    ],
    "sessionTimeRemaining": 425.3
  }
}
```

4. UE восстанавливает UI состояние: показывает текущий список игроков, правильное session time, продолжает с текущего уровня.

Либо middleware отвечает:

```json
{
  "type": "no_active_session"
}
```

И UE возвращается в Idle.

---

## Timing & ordering

- **Order matters:** события должны быть в хронологическом порядке (match_started → match_completed → next match_started).
- **No ordering guarantees across sessions** — но внутри одной сессии middleware не должен переставлять.
- **Timestamps в UTC ISO 8601** с миллисекундами.

---

## Rate limits

Middleware локально — нет лимитов.
Middleware → Backend — ограничения:
- `heartbeat`: max 1/second
- `life_lost`: max 10/second (разумный предел физики)
- `match_completed`, `session_ended`: без лимитов (редко)
- Переполнение → middleware дропает или агрегирует `life_lost` события.

---

## Backward compatibility

Добавление новых полей в payload — совместимо. Удаление — breaking change.

Протокол версионируется через поле `protocolVersion` в каждом сообщении (будущее улучшение P2).
