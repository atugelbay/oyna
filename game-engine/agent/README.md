# Room Agent — канал CRM → UE

## Выбор: polling команд вместо WebSocket от бэкенда

Для MVP выбран **HTTP long-poll / короткий polling** (`GET /api/station/rooms/:roomId/commands`) вместо постоянного WebSocket от NestJS к агенту:

- Не нужен отдельный WS-сервер и sticky sessions на API.
- Проще файрволы: исходящий HTTPS с ноутбука, как и остальные вызовы.
- Команды буферизуются в PostgreSQL (`room_agent_commands`); при обрыве агент подтянет очередь после восстановления.

При необходимости позже можно добавить Server-Sent Events или WS от CRM. В сторону текущего UE агент отправляет **реальный формат движка**: root-level JSON с полем `event`, например `{ "event": "session_start", "mode": "classic", "level": 1 }`.

## Поток

1. Агент периодически вызывает `GET .../commands` с `Authorization: Bearer <STATION_API_KEY>`.
2. Агент сам поднимает локальный WebSocket server `ws://localhost:8080/ws/laser`; UE уже является клиентом и подключается туда из `UOLDriverWSClient`.
3. Для каждой команды агент проксирует `payload` команды в UE.
4. После успешной доставки хотя бы одному UE-клиенту — `POST .../commands/ack` с массивом `commandIds`.
5. Параллельно: `POST .../heartbeat`, приём событий от UE и прокси на `POST /api/station/rooms/{roomId}/sessions/{sessionId}/end`, `POST .../match-reports`, при старте игры — `POST .../sessions/activate-by-token` с `sessionToken`.

## Запуск

Основной агент:

```powershell
cd game-engine\agent
$env:BACKEND_BASE_URL = "http://localhost:3000/api"
$env:ROOM_ID = "<uuid комнаты>"
$env:STATION_API_KEY = "station_live_dev_key_12345678901234567890"
python room_agent.py
```

UE должен быть запущен на той же машине: он подключится к `ws://localhost:8080/ws/laser`.

## Скрипт-пример

См. [poll_commands.py](poll_commands.py) — только минимальный опрос/ack для диагностики. Для физического запуска комнаты используйте [room_agent.py](room_agent.py).

Переменные окружения:

| Переменная | Пример |
|------------|--------|
| `BACKEND_BASE_URL` | `http://localhost:3000/api` |
| `ROOM_ID` | UUID комнаты в CRM |
| `STATION_API_KEY` | ключ, заданный админом |
