# Room Agent — CRM ↔ Room API v1

Агент на моноблоке комнаты. Игра поднимает **HTTP API** `http://127.0.0.1:8080/v1`
(ключ `X-Room-Key`). Агент — клиент игры и клиент Nest CRM.

## Потоки

1. **События игры → CRM**  
   Long-poll `GET /v1/events?after=&wait=` → `POST /api/station/rooms/:roomId/room-events` → `POST /v1/events/ack`.

2. **Команды CRM → игра**  
   Poll `GET /api/station/rooms/:roomId/commands` → HTTP в Room API по payload:
   ```json
   { "method": "POST", "path": "/lobby/players", "body": {...}, "idempotency_key": "uuid" }
   ```
   Затем `POST .../commands/ack`.

3. **Heartbeat** → `POST /api/station/rooms/:roomId/heartbeat` (build из `GET /v1/room`).
4. **Каталог** → `GET /v1/catalog` → `POST /api/station/rooms/:roomId/catalog` (старт + смена `catalog_hash`).

## Типы событий (журнал)

`room_online`, `room_status`, `lobby_changed`, `session_started`, `level_finished`, `session_finished`  
Оболочка: `type` + `payload` + `cursor` / `event_id` (не старый flat `event`).

## Запуск (для сотрудников — один клик)

1. Один раз: скопировать `.env.example` → `.env`, вписать `ROOM_ID` и `STATION_API_KEY` (из CRM).
2. Двойной клик по **`start_room_agent.bat`** (или ярлык на рабочий стол).
3. Окно оставить открытым, пока зал работает. Сначала лучше запустить **игру**, потом агент.

Переменные из PowerShell (`$env:...`) **сбрасываются** после закрытия окна / перезагрузки.  
Храните их в **`.env`** рядом с `room_agent.py` — bat подхватывает файл сам.

### Запуск из терминала (отладка)

```powershell
cd game-engine\agent
# либо заполненный .env, либо вручную:
$env:BACKEND_BASE_URL = "https://api.oyna.pro/api"
$env:ROOM_ID = "<uuid комнаты CRM>"
$env:STATION_API_KEY = "<ключ станции>"
$env:ROOM_API_BASE = "http://127.0.0.1:8080/v1"
$env:ROOM_API_KEY = "dev"
python room_agent.py
```

С заглушкой договора:

```powershell
python -m Tools.RoomAPI.mock_room --room lasers --port 8080 --key dev
```

(из корня репозитория `oyna-room-api` / game engine с Tools/RoomAPI.)

## Env

| Переменная | Пример |
|------------|--------|
| `BACKEND_BASE_URL` | `http://localhost:3000/api` |
| `ROOM_ID` | UUID комнаты в CRM |
| `STATION_API_KEY` | ключ станции CRM |
| `ROOM_API_BASE` | `http://127.0.0.1:8080/v1` |
| `ROOM_API_KEY` | `dev` (или ключ из `room_api.json`) |
| `EVENTS_WAIT_SEC` | `20` |
| `POLL_INTERVAL_SEC` | `2` |
| `CRM_SSL_VERIFY` | `1` (по умолчанию). `0` — не проверять HTTPS-серт CRM (только отладка) |

## SSL на моноблоке

Браузер может открывать `https://api.oyna.pro`, а Python — нет: на Windows OpenSSL
иногда падает на просроченном корне в системном store (`certificate has expired`),
хотя сайт в Chrome нормальный.

**Фикс (рекомендуется):**

```powershell
pip install -U certifi
python -c "import certifi,ssl,urllib.request; ctx=ssl.create_default_context(cafile=certifi.where()); print(urllib.request.urlopen('https://api.oyna.pro/api/docs', context=ctx).status)"
```

Агент сам подхватит `certifi`, если пакет установлен. Временно без проверки:

```powershell
$env:CRM_SSL_VERIFY = "0"
```

## Замечания

- `POST /v1/_dev/*` есть только у заглушки / virtual build. В зальной сборке 404 — агент ack’ает и не зацикливается; старт игры — кнопка на моноблоке.
- HTTP **422** (невалидное тело, напр. старый `hall_records`) тоже ack’ается — иначе одна битая команда крутится вечно.
- Старый WS `ws://…/ws/laser` + `event: session_start` больше не используется этим агентом.
