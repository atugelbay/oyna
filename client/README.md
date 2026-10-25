# OYNA Client App

Mobile-first player portal for OYNA gaming centers.

## Запуск из корня монорепозитория

```bash
npm run install:client
# Скопировать client/backend/.env.example в client/backend/.env,
# указать общую с CRM DATABASE_URL и отдельные JWT-секреты.
npm --prefix client/backend run db:generate
npm run dev:client
```

`npm run dev` запускает CRM и клиент вместе: API CRM :3000, CRM UI :3001,
Client API :3002, Client UI :3003. `npm run dev:crm` — только CRM.
Зависимости и lock-файлы у приложений отдельные; корневые команды объединяют запуск.

Проверка: `npm run check:client`. Сборка клиента и API: `npm run build:client`.
Миграции общей БД выполняет только `backend/` CRM.

## Интерфейс и подключение с телефона

Клиент использует логотипы CRM, графитовые поверхности и cyan-акцент.
На телефоне — одна колонка и нижняя навигация с учётом safe area;
на планшете и компьютере главная раскрывается в две колонки.
Добавлены `/how-to-play` и `/leaderboard` (общий рейтинг за всё время,
согласно существующему API). Баланс пополняется на ресепшене.

По умолчанию браузер обращается к `/client-api` на том же origin.
Next.js проксирует запросы к `CLIENT_API_ORIGIN=http://127.0.0.1:3002`.
Это работает и с телефона в локальной сети: открывайте `http://<LAN-IP>:3003`.
При отдельном API можно задать `NEXT_PUBLIC_CLIENT_API_URL` и CORS
через `CLIENT_FRONTEND_URL` на клиентском backend.

Для QR задайте в `backend/.env` CRM:
`PLAYER_APP_PUBLIC_URL=http://<LAN-IP>:3003` (в production — `https://play.oyna.pro`).
QR-ссылка `/j/{token}` сохраняет комнату в `localStorage.oyna_pending_lobby`.
При активной сессии открывается страница входа в лобби; без сессии — Welcome
с кнопками входа и регистрации. После авторизации игрок возвращается в нужную
комнату. Данные QR удаляются только после успешного POST добавления в лобби;
обновление страницы, ошибки входа и недостаток минут их не сбрасывают.
Клиент проверяет актуальный баланс и блокирует вход при недостатке минут или истечении QR.
Баланс обновляется при возврате во вкладку и каждые 15 секунд на QR-странице.
Вход в лобби не списывает минуты; старт и списание происходят на экране комнаты.

Production: PM2-конфиг `deploy/ecosystem.config.cjs` содержит все четыре процесса;
пример nginx для клиентского домена — `deploy/nginx/oyna-client.example.conf`.
Настройте HTTPS перед публикацией. Manifest и иконка добавлены; офлайн-режим не реализован.
Срок сгорания минут не отображается до появления достоверных полей в CRM API.

## Structure

```
client/
├── backend/    NestJS API (port 3002, prefix /client-api)
└── frontend/   Next.js 15 mobile-first app (port 3003)
```

## Setup

### Backend

```bash
cd client/backend
npm install
npx prisma generate   # generate Prisma client (do NOT run migrate — CRM backend owns migrations)
npm run start:dev
```

Swagger docs available at: http://localhost:3002/client-api/docs

### Frontend

```bash
cd client/frontend
npm install
npm run dev
```

App available at: http://localhost:3003

## Notes

- Backend connects to the **same PostgreSQL database** as the CRM backend
- Client backend NEVER runs `prisma migrate` — only the CRM backend manages migrations
- Players registered here (role=USER) are immediately visible in the CRM's players list
- JWT secrets are **separate** from CRM backend secrets
- Вход: никнейм (без учёта регистра) или телефон + пароль.
- Регистрация: телефон, никнейм, собственный пароль от 8 символов, дата рождения опциональна.
- Пароли хранятся в существующем `User.passwordHash` как bcrypt-хеши; миграция БД не нужна.
- Одноразовые коды и endpoint `request-otp` удалены. Старый `/auth/verify` перенаправляет на вход.
- Ранее созданные аккаунты без `passwordHash` не получают пароль автоматически.
  Их нельзя перерегистрировать поверх существующего телефона; настройка восстановления доступа — отдельный сценарий.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /client-api/auth/register | Register new player |
| POST | /client-api/auth/login | `{ identifier, password }` → user + tokens |
| POST | /client-api/auth/refresh | Refresh tokens |
| GET | /client-api/profile/me | Get profile |
| PATCH | /client-api/profile/me | Update profile |
| GET | /client-api/balance | Get balance |
| GET | /client-api/balance/transactions | Transaction history |
| GET | /client-api/sessions | My game sessions |
| GET | /client-api/promos | Active promotions |
| GET | /client-api/lobby/join/:token | Превью комнаты по QR |
| POST | /client-api/lobby/join/:token | Войти в лобби (JWT) |

QR на HUD: CRM (`PLAYER_APP_PUBLIC_URL=/j/{token}`) → клиент `http://…:3003/j/…` → join → агент `POST /lobby/players`.

## Проверки авторизации

`npm --prefix client/backend run test:auth` проверяет bcrypt, вход по нику и телефону,
отказ при неверном пароле, блокировке, роли сотрудника и отсутствии пароля,
валидацию DTO и защиту от перезаписи существующего аккаунта.
`npm --prefix client/frontend test` проверяет сохранение QR через перезагрузку и вход,
очистку после join, одновременные вкладки и проверку сохранённых маршрутов.
