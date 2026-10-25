# OYNA — спецификация клиентской части (для реализации / другой модели)

Документ для нейронки или разработчика: **что уже есть**, **как устроен поток**, **какие API и экраны**, **что доделать**.  
Репозиторий: монорепо `oyna`, клиент в каталоге `client/`. CRM — `backend/` + `frontend/`. Игра — Room API v1 на моноблоке.

Актуально на: 2026-10-22.

---

## 1. Роль клиента в системе

Клиент — **мобильный личный кабинет игрока** (телефон в ТРЦ):

| Делает клиент | Не делает клиент |
|---------------|------------------|
| Регистрация с паролем / вход по нику или телефону + пароль | Касса, пополнение (только CRM на ресепшене) |
| Баланс минут, профиль, история | Старт режима на железе (только HUD комнаты) |
| Вход в лобби по QR с экрана комнаты | Управление комнатами / сотрудниками |
| Рейтинг, промо, турниры (просмотр/участие) | Прямые HTTP-вызовы в игру (`:8080`) |

Игра **не знает** про клиентский сайт. Связь только через CRM:

```
Телефон → Client Frontend → Client API → PostgreSQL (+ очередь RoomAgentCommand)
                                              ↓
                                    Room Agent (на моноблоке)
                                              ↓
                                    Room API /v1 (игра)
```

CRM Nest (`backend/`, порт **3000**, префикс `/api`) — админка и станция.  
Client Nest (`client/backend/`, порт **3002**, префикс `/client-api`) — только игроки.  
**Одна и та же PostgreSQL.** Миграции делает **только CRM backend**. Client только `prisma generate`.

---

## 2. Стек и порты

| Часть | Стек | Dev URL |
|-------|------|---------|
| Client frontend | Next.js 15, React 19, Tailwind, axios | `http://localhost:3003` |
| Client backend | NestJS, Prisma, JWT (отдельные секреты от CRM) | `http://localhost:3002/client-api` |
| Swagger | — | `http://localhost:3002/client-api/docs` |
| CRM API | NestJS | `http://localhost:3000/api` |
| CRM UI | Next.js | `http://localhost:3001` |
| Room API (игра) | на моноблоке | `http://127.0.0.1:8080/v1` |

Env frontend: `NEXT_PUBLIC_CLIENT_API_URL` (по умолчанию `http://localhost:3002/client-api`).  
Env client backend: `DATABASE_URL` (тот же, что CRM), JWT secrets, `CLIENT_FRONTEND_URL` для CORS, `PORT=3002`.

---

## 3. Канон продукта (владелец) — обязательные правила

Источник: `CRM TEST 2026-10-20 for backend.md` + Room API v1.

1. **Минимум для лобби / старта: 10 минут** (600 секунд) на балансе.  
   Текст отказа: **«Недостаточно минут на балансе. Пополните баланс»**.
2. **Списание 10 минут** — только на событии игры `session_started` (кнопка «НАЧАТЬ ИГРУ» на HUD), **не** при входе в лобби и не при QR-join.
3. **Пополнение** — только на ресепшене (CRM). Онлайн-оплата — вне текущего MVP.
4. **Старт сеанса и выбор режима** — на экране комнаты. CRM/клиент **не** стартуют зальную игру (нет прод-команды start/select; `/_dev/*` только virtual).
5. **Минуты** действуют во всех 4 комнатах точки. Срок сгорания 30 дней — продуктовое решение, в коде может быть ещё не реализовано.
6. QR: токен и URL выпускает **CRM**, игра только рисует (`PUT /v1/lobby/qr`).

---

## 4. Что уже реализовано в `client/`

### 4.1 Frontend (`client/frontend`)

| Маршрут | Назначение |
|---------|------------|
| `/welcome` | Выбор «Войти» / «Зарегистрироваться» |
| `/auth/login` | Никнейм или телефон + пароль |
| `/auth/register` | Телефон, ник латиницей, пароль и подтверждение; ДР опциональна |
| `/home` | Главная (protected) |
| `/profile`, `/balance`, `/sessions` | Кабинет |
| `/promos`, `/tournaments/...` | Промо и турниры |
| **`/j/[token]`** | **Вход в лобби по QR** (есть) |

Auth: `localStorage` `accessToken` / `refreshToken`, axios interceptor refresh.  
QR хранится в `localStorage.oyna_pending_lobby`: `{ token, path, savedAt }`.
После логина/регистрации — возврат на `/j/...`; запись удаляется только после успешного join.
Обновление страницы и неуспешная авторизация не теряют комнату. Новый QR заменяет предыдущий.
С активной сессией QR сразу открывает лобби; без сессии отправляет на Welcome.
Одноразовые коды клиентам не используются. Старые `/auth/verify` и `/auth/profile` — редиректы.

### 4.2 Backend (`client/backend`)

Уже есть модули: `auth`, `profile`, `balance`, `sessions`, `promos`, `leaderboard`, `venues`, `tournaments`, **`lobby`**.

Prisma-схема клиента должна отражать таблицы CRM (в т.ч. `lobbyJoinToken`, `RoomAgentCommand`, `PlayerModeUnlock`).  
**Не запускать** `prisma migrate` из client — только `npx prisma generate`.

---

## 5. Поток QR end-to-end (главный интеграционный сценарий)

### 5.1 Кто что делает

```
1. CRM (Nest) при room_online / session_finished / refresh:
     - генерирует token, expiresAt
     - пишет Room.lobbyJoinToken, lobbyJoinExpiresAt
     - URL = {PLAYER_APP_PUBLIC_URL}/j/{token}
     - enqueue PUT /v1/lobby/qr { url, expires_at }

2. Room Agent забирает команду → HTTP в игру → QR на HUD

3. Игрок сканирует → открывается Client Frontend /j/{token}

4. Client:
     GET  /client-api/lobby/join/:token     (без JWT) → превью комнаты
     сохранить токен в localStorage; если нет сессии → /welcome → вход или регистрация
     POST /client-api/lobby/join/:token     (JWT) → проверки + enqueue
         RoomAgentCommand: POST /v1/lobby/players

5. Agent → игра: ник в лобби

6. На HUD: режим + «НАЧАТЬ ИГРУ» → session_started
     CRM списывает 10 мин, создаёт/биндит GameSession
     (если не было PENDING из CRM — createSessionFromRoomStart)
```

### 5.2 Env CRM (обязательно для QR на экране)

```env
# backend/.env — origin клиентского фронта БЕЗ слэша
PLAYER_APP_PUBLIC_URL=http://192.168.8.75:3003
# или https://play.oyna.pro

# опционально TTL секунд (дефолт 600)
LOBBY_QR_TTL_SEC=600
```

Если `PLAYER_APP_PUBLIC_URL` пустой — CRM **не** шлёт QR (no-op).  
В Wi‑Fi зале указывать **LAN IP хоста CRM/клиента**, не WSL IP.

### 5.3 API лобби (client-api) — контракт

**GET `/client-api/lobby/join/:token`** — публичный

Ответ 200:
```json
{
  "roomId": "uuid",
  "roomName": "Arena",
  "venueName": "Forum",
  "expiresAt": "2026-10-22T15:20:00.000Z",
  "expired": false,
  "minBalanceMinutes": 10
}
```

Ошибки: `404` — токен не найден.

**POST `/client-api/lobby/join/:token`** — Bearer JWT игрока

Успех 201/200:
```json
{
  "ok": true,
  "roomId": "uuid",
  "roomName": "Arena",
  "venueName": "Forum",
  "minutesLeft": 56,
  "message": "Вы в лобби. На экране комнаты нажмите «НАЧАТЬ ИГРУ»."
}
```

Ошибки:
| HTTP | Когда | message (ориентир) |
|------|--------|---------------------|
| 401 | нет/битый JWT | Требуется авторизация |
| 400 | баланс &lt; 10 мин | Недостаточно минут на балансе. Пополните баланс |
| 400 | уже в другом PENDING/ACTIVE лобби | Вы уже в лобби комнаты «…» |
| 404 | токен / юзер | … |
| 410 Gone | QR просрочен | QR истёк. Попросите на ресепшене обновить код… |

Реализация join (уже в `LobbyService`):
1. Найти `Room` по `lobbyJoinToken`, проверить `lobbyJoinExpiresAt`.
2. Проверить `AccountBalance.availableSeconds >= 600`.
3. Запретить, если игрок уже в PENDING/ACTIVE сессии **другой** комнаты.
4. Собрать body для Room API и создать `RoomAgentCommand`:

```json
{
  "method": "POST",
  "path": "/lobby/players",
  "body": {
    "player_id": "<user uuid>",
    "nick": "<nickname max 32>",
    "minutes_left": 56,
    "source": "qr",
    "unlocked": { "megagrid.jumps": 5 },
    "rating_month": 1840,
    "rank_month": 12
  },
  "idempotency_key": "<uuid>"
}
```

- `unlocked` — из таблицы `player_mode_unlocks` (пишет CRM на `level_finished.unlocks_next`).
- `rating_month` / `rank_month` — сумма `Score` за текущий месяц (Asia/Almaty) и место; если не играл — поля можно не слать / null.
- Баланс **не** уменьшать здесь.

Тип команды в очереди: `room_api.lobby_add_player`.

---

## 6. Auth API (client-api)

Префикс: `/client-api/auth`.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/login` | `{ "identifier", "password" }` | Никнейм или телефон; ответ tokens+user |
| POST | `/auth/register` | `{ "phone", "password", "nickname", "name?", "birthDate?" }` | Пароль от 8 символов, bcrypt до 72 байт; ник 3–32, латиница/цифры/`_`, хотя бы одна буква |
| POST | `/auth/refresh` | `{ "refreshToken" }` | → новые access+refresh |

JWT **отдельные** от CRM (`JWT_ACCESS_SECRET` / refresh в `.env` client backend).  
Роль пользователя: `USER`.

Профиль:
- `GET /client-api/profile/me` (Bearer)
- `PATCH /client-api/profile/me`

Баланс:
- `GET /client-api/balance` → `{ availableSeconds, displayMinutes, … }`
- `GET /client-api/balance/transactions?page&limit`

Сессии игрока:
- `GET /client-api/sessions`

Прочее (уже есть): promos, leaderboard, venues, tournaments — см. Swagger.

---

## 7. Связь с CRM / игрой (что клиент не трогает)

Клиент **не** вызывает:
- `/api/station/...`
- Room API напрямую
- `/api/game-sessions/start` (это оператор CRM)

Клиент только пишет строку в `room_agent_commands`. Агент на моноблоке поллит CRM station API и исполняет.

На `session_started` (CRM `StationService`):
- если была PENDING из CRM → bind + debit 10 мин;
- если только QR → **создать** `GameSession` по `mode_id` из каталога + игроки с `player_id` + debit.

Очки в профиль: `session_finished` → `endSession` → `User.totalScore` += score.

---

## 8. UI / UX требования для доработки клиента

### 8.1 Общие

- Mobile-first, max-width как сейчас (`max-w-mobile`), тёмный фон `#090D17`, акцент cyan/brand.
- Не плодить «дашборд» на первом экране welcome: бренд OYNA + телефон + CTA.
- Все пользовательские ошибки — **русский текст**, не `Request failed with status code 400`.
- После QR-join явно сказать: «Ждите старт на экране комнаты», списание будет при старте.

### 8.2 Экран `/j/[token]` (есть — довести)

Состояния:
1. Загрузка превью  
2. QR не найден / истёк  
3. Не авторизован → CTA «Войти и продолжить»  
4. Авторизован, баланс &lt; 10 → кнопка disabled + текст про пополнение на ресепшене  
5. Успех join → сообщение + ссылка в кабинет  
6. Уже в другом лобби → показать ошибку API  

Не класть `/j` внутрь `(protected)` layout: страница сначала сохраняет QR в localStorage, затем при необходимости перенаправляет на Welcome. Токен сохраняется до успешного добавления в лобби.

### 8.3 Кабинет (доработки по ТЗ)

| Экран | Сделать / проверить |
|-------|---------------------|
| Home | Баланс минут, статус лояльности, CTA «как играть» (QR) |
| Balance | Минуты + история; пометка «пополнение на ресепшене» |
| Profile | Ник, телефон, ДР, totalScore; **срок сгорания минут (30 дней)** — когда появится в API |
| Sessions | История игр / очки |
| Leaderboard | День/месяц/всё (если API готово) |
| Promos | Список активных |

Онлайн-оплата пакетов — **не в MVP**.

### 8.4 Гость

«Добавить гостя» — **из CRM**, не из клиентского сайта.  
Команда Room API для гостя от игры ещё может прийти отдельно. На клиенте гостевого входа нет.

---

## 9. Четыре комнаты

В CRM — 4 `Room` (Mega Grid, Arena, Hide, Лазеры и т.д.).  
На каждой — свой агент (`ROOM_ID`, `STATION_API_KEY`, свой `room_api.json`).  
Клиентский join по токену автоматически попадает в **ту** комнату, чей QR на экране — отдельной логики «выбора комнаты» на телефоне не нужно.

---

## 10. Локальный прогон (чеклист для другой модели)

1. Postgres + CRM backend migrate + `PLAYER_APP_PUBLIC_URL=http://<LAN>:3003`  
2. `npm run start:dev` в `backend`, `frontend` (CRM)  
3. `npm run start:dev` в `client/backend`, `client/frontend`  
4. Агент + игра (или mock Room API) с верным `ROOM_ID` / ключами  
5. Heartbeat/room_online → на HUD появляется QR с URL на `:3003/j/...`  
6. Телефон/браузер: открыть URL → Welcome → вход по нику/телефону и паролю или регистрация → нужное лобби → join при балансе ≥ 10 мин  
7. На HUD ник → «НАЧАТЬ ИГРУ» → в CRM списалось 10 мин  

С активной сессией шаг Welcome пропускается. Коды подтверждения не используются.

---

## 11. Файлы-ориентиры в репо

| Путь | Зачем |
|------|--------|
| `client/frontend/src/app/j/[token]/page.tsx` | UI QR join |
| `client/backend/src/lobby/*` | API join |
| `client/frontend/src/lib/api.ts` | axios + JWT |
| `client/frontend/src/lib/auth-context.tsx` | сессия игрока |
| `backend/src/station/lobby-qr.service.ts` | выпуск QR URL |
| `backend/src/station/station.service.ts` | room-events, debit, create from QR |
| `backend/src/station/player-lobby.service.ts` | unlocked / rating для CRM-посадки |
| `game-engine/CRM_ENGINE_MAPPING.md` | карта CRM ↔ Room API |
| `game-engine/agent/room_agent.py` | мост команд/событий |
| `Docs` на Desktop: `oyna-room-api/Docs/api/ROOM_API_v1.md` | договор игры |

---

## 12. Задачи «сделать клиентскую часть» — приоритеты

Уже есть каркас кабинета + QR join API/UI. Дальше по ценности:

1. **Довести UX** `/j/[token]` + понятные ошибки баланса; проверить возврат после входа и регистрации.  
2. **Home / Balance / Profile** под канон 10 мин и «пополнение только на ресепшене».  
3. **Прод-конфиг**: `PLAYER_APP_PUBLIC_URL`, CORS, один origin play.oyna.pro.  
4. **Срок минут 30 дней** — поля в API + отображение (когда CRM начнёт писать expiry).  
5. **PWA / manifest** — уже есть задел; иконки, офлайн не критично.  
6. **Не делать:** старт игры с телефона; онлайн-оплата; выбор режима с телефона для зала.

---

## 13. Антипаттерны (не ломать договор)

- Не списывать минуты в `POST /lobby/join`.  
- Не вызывать `/_dev/select` или `/_dev/start` из клиента.  
- Не делать `prisma migrate` из `client/backend`.  
- Не ходить в Room API с телефона мимо агента.  
- Не путать порты: клиент API **3002**, клиент UI **3003**, CRM API **3000**.

---

## 14. Краткая схема для промпта другой модели

> Реализуй/доработай OYNA Client в `client/`: Next.js :3003 + Nest `/client-api` :3002, общая Postgres с CRM.  
> Auth: ник/телефон + пароль, регистрация с собственным паролем (bcrypt в существующий User.passwordHash). QR: CRM кладёт URL `{PLAYER_APP_PUBLIC_URL}/j/{token}` на HUD; клиент сохраняет токен в localStorage до успешного join. Без сессии — Welcome → вход/регистрация → нужное лобби; с сессией — сразу лобби. Страница join → GET/POST `/client-api/lobby/join/:token`; POST пишет `RoomAgentCommand` на `POST /lobby/players` с `source: qr`, минимум 10 мин баланса, без списания. Старт только на HUD. Списание 10 мин на CRM при `session_started`. Не мигрировать БД из client. Спека: `client/CLIENT_APP_SPEC.md`.
