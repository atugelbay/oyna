# CRM Audit (без API игрового движка)

Цель: проверить ключевые CRM-функции: формы (UI) и связность сущностей (front/back). Исключаем API игрового движка: `backend/src/game-sessions/*` и `backend/src/game-modes/*`.

---

## 1) Frontend: какие экраны/формы есть в CRM-панели

Маршруты под `frontend/src/app/(crm)/(panel)/`:

### `dashboard`
Файл: `frontend/src/app/(crm)/(panel)/dashboard/page.tsx`
- Данные: `statsService.getDashboard()` -> `GET /stats/dashboard`
- Статус: wiring работает (нет заглушек форм).

### `players`
Файл: `frontend/src/app/(crm)/(panel)/players/page.tsx`
- Список: `playersService.list({ q, page, limit })` -> `GET /users/search`
- Итого: `playersService.getStats()` -> `GET /users/stats`
- Модалка добавления игрока: `frontend/src/components/crm/AddPlayerModal.tsx`
  - Проблема: модалка не делает API-запрос (`// TODO: API`) и `players/page.tsx` не передает `onAdded`, поэтому после “Добавить” нет реальной записи и нет обновления.

### `players/[id]` (профиль)
Файл: `frontend/src/app/(crm)/(panel)/players/[id]/page.tsx`
- Профиль: `playersService.getById(id)` -> `GET /users/:id`
- Пополнение баланса: `frontend/src/components/crm/BalanceTopUpModal.tsx`
  - Проблема: расчеты/оплата сделаны как mock (`const totalPay = 4648`) и нет `balanceService.topup()`.
  - Дополнительно: модалка сейчас не получает `playerId`, значит ей не из чего собрать payload для `TopupDto` (`userId`, `seconds`, `amountTenge`).

### `rooms`
Файл: `frontend/src/app/(crm)/(panel)/rooms/page.tsx`
- Список комнат: `venuesService.list()` -> `GET /venues` + `roomsService.listByVenue(venueId)` -> `GET /rooms/venue/:venueId`
- Модалка добавления комнаты: `frontend/src/components/crm/AddRoomModal.tsx`
  - Проблема: `AddRoomModal` возвращает только `name` и вызывает `onAdded`, но фактически не вызывает `roomsService.create()` на бэкенде.
  - Дополнительно: `backend/src/rooms/dto/create-room.dto.ts` требует `venueId` и `type`, а текущий UI этого не собирает.

### `results`
Файл: `frontend/src/app/(crm)/(panel)/results/page.tsx`
- Лидерборд: `resultsService.getLeaderboard()` -> `GET /scores/leaderboard`
- Статус: wiring работает (но таблица команд помечена как “в разработке”).

### `tournaments`
Файлы:
- `frontend/src/app/(crm)/(panel)/tournaments/page.tsx` (список)
  - `tournamentsService.list()` -> `GET /tournaments`
- `frontend/src/app/(crm)/(panel)/tournaments/new/page.tsx` (создание)
  - `tournamentsService.create()` -> `POST /tournaments`
- `frontend/src/app/(crm)/(panel)/tournaments/[id]/page.tsx` (детали)
  - Загружает `tournamentsService.getById(id)` -> `GET /tournaments/:id`
  - Кнопки `Изменить` и `Удалить` не имеют обработчиков (удаление не реализовано).

### `promos`
Файлы:
- `frontend/src/app/(crm)/(panel)/promos/page.tsx` (список)
  - `promosService.list()` -> `GET /promos`
- `frontend/src/app/(crm)/(panel)/promos/new/page.tsx` (создание)
  - `promosService.create()` -> `POST /promos` (частично рабочее, но есть риски по маппингу reward/quantity)
- `frontend/src/app/(crm)/(panel)/promos/[id]/page.tsx` (детали)
  - Загружает `promosService.getById(id)` -> `GET /promos/:id`
  - Кнопки `Изменить` и `Удалить` не имеют обработчиков (удаление не реализовано).

### `stats`
Файл: `frontend/src/app/(crm)/(panel)/stats/page.tsx`
- `statsService.getRevenue()` -> `GET /stats/revenue`
- `statsService.getOverview()` -> `GET /stats/overview`
- Статус: wiring работает (есть потенциальные UX-огрехи с кастомным периодом, но не критично для “ключевых функций”).

### `settings`
Файлы:
- `frontend/src/app/(crm)/(panel)/settings/roles/page.tsx`
  - Проблема: UI переключает toggles, но нет сохранения в бэкенд (`updateRolePermissions` не вызывается), и “Обновить”/“Regenerate access code” не реализован.
- `frontend/src/app/(crm)/(panel)/settings/*/page.tsx`
  - Списки читаются из бэкенда корректно (`settingsService.getRoles/getPricePackages/getLoyaltyLevels/getEmployees`).
- `frontend/src/app/(crm)/(panel)/settings/*/new/page.tsx`
  - Проблема: все “new” страницы сейчас не создают сущности, а просто делают `window.location.href = ...` (редирект) без вызова API.
  - Также есть несоответствие типов:
    - `backend/src/settings/dto/create-employee.dto.ts` требует `role: Role` (enum `OPERATOR` / `MANAGER`).
    - UI для employee-new использует русские строки (`"Оператор"`, `"Менеджер"`, ...).

---

## 2) Backend: какие CRUD/эндпоинты есть (CRM-модуль)

Проверенные контроллеры (в рамках CRM):
- `GET /users/search`, `GET /users/:id`, `PATCH /users/:id`, `GET /users/stats` (`backend/src/users/*`)
- `GET /rooms/venue/:venueId`, `POST /rooms`, `PATCH /rooms/:id`, `DELETE /rooms/:id` (`backend/src/rooms/*`)
- `GET /balance/me`, `POST /balance/topup` (`backend/src/balance/*`)
- `settings/*`:
  - `GET/POST/PATCH/DELETE /settings/price-packages/:...`
  - `GET/POST/PATCH/DELETE /settings/loyalty-levels/:...`
  - `GET/PATCH /settings/roles`
  - `POST /settings/roles/:role/regenerate-code` (требует `venueId`)
  - `GET/POST/PATCH/DELETE /settings/employees/:...` (`venueId` требуется при создании)
- `promos`:
  - `GET /promos`, `POST /promos`, `GET /promos/:id`, `PATCH /promos/:id`, `DELETE /promos/:id`
- `tournaments`:
  - `GET /tournaments`, `POST /tournaments`, `GET /tournaments/:id`, `PATCH /tournaments/:id`, `DELETE /tournaments/:id`
- `stats`:
  - `GET /stats/dashboard`, `GET /stats/revenue`, `GET /stats/overview`
- `scores` (используется в `results`):
  - `GET /scores/leaderboard`, `GET /scores/top/:roomId`
- `venues`:
  - `GET /venues`, `GET /venues/:id` и админ CRUD.

Исключено из проверки: `backend/src/game-sessions/*` (модуль сессий/окончаний) и `backend/src/game-modes/*`.

---

## 3) Критические разрывы (что “сломано” / не работает сейчас)

### A) Добавление игрока
- UI: `frontend/src/components/crm/AddPlayerModal.tsx` — `// TODO: API`, нет вызова `POST /auth/register`.
- Back DTO: `backend/src/auth/dto/register.dto.ts` требует `phone`, `nickname`, `name` (и опционально `birthDate`).
- Проблема: в UI есть только `phone`, `nickname`, `birthday`, но нет `name` (ФИО).

### B) Пополнение баланса
- UI: `frontend/src/components/crm/BalanceTopUpModal.tsx` — mock-стоимость, нет `balanceService.topup()`.
- Back DTO: `backend/src/balance/dto/topup.dto.ts` требует `userId`, `seconds` (>=60), `amountTenge` (>=0) и опционально `venueId` / `description`.
- Проблема: модалка не знает `playerId` (userId) и не маппит выбранный пакет на `seconds`/`amountTenge`.

### C) Добавление комнаты
- UI: `AddRoomModal` не вызывает API, `rooms/page.tsx` делает локальное добавление фейкового `id`.
- Back DTO: `backend/src/rooms/dto/create-room.dto.ts` требует `venueId` и `type`.
- Проблема: UI собирает только `name`.

### D) Создание сущностей в settings/*/new
- `employees/new`, `loyalty/new`, `prices/new` — нет вызовов `settingsService.*create*` (сейчас только редирект).
- Несоответствие типов для employee:
  - UI использует русские названия ролей, а back ждёт enum `Role` (`OPERATOR`, `MANAGER`).

### E) Настройки ролей
- `settings/roles/page.tsx` не делает:
  - сохранение toggles -> `PATCH /settings/roles/:role` через `settingsService.updateRolePermissions`
  - генерацию access code -> `POST /settings/roles/:role/regenerate-code`
- Дополнительно: regenerate backend требует `venueId` (body или query). Front сейчас вызывает regenerate-code без venueId.

### F) Удаление promos/tournaments
- Detail-страницы (`promos/[id]`, `tournaments/[id]`) показывают кнопки, но без обработчиков.

---

## 4) Связность сущностей (Promo/Loyalty/loyaltyStatus) — вероятный gap

По текущей CRM-логике:
- `backend/src/settings` позволяет создать `Promo` и `LoyaltyLevel`.
- `backend/src/users`/`auth` возвращают `user.loyaltyStatus` как поле, но в коде нет мест, где оно обновляется.
- `backend/src/stats/stats.service.ts` учитывает `TransactionType.BONUS`, но в коде нет генерации `TransactionType.BONUS` или `TransactionType.PROMO` (по поиску по проекту).
- `backend/src/game-sessions/game-sessions.service.ts` (который мы исключаем по scope) делает:
  - создание `Score`
  - списание `accountBalance` и `TransactionType.GAME_DEBIT`
  - но не выполняет начисление bonus/minutes/promo и не обновляет `loyaltyStatus`.

Вывод: текущая CRM-часть (кроме game-domain) не замыкает `Promo`/`LoyaltyLevel` на `TransactionType.BONUS` и `User.loyaltyStatus`. Это требует отдельной задачи, затрагивающей доменную логику game-сессий/наград (вне текущего scope исключённых эндпоинтов).

