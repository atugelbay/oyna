# Деплой OYNA на VPS (ps.kz) + GitHub Actions

Краткий чеклист: DNS на Namecheap → сервер (Node, PostgreSQL, Redis, nginx, PM2) → env-файлы → клон репозитория → первый деплой вручную → секреты GitHub → push в `main`.

**Важно:** скрипт `server-build.sh` выполняет только `prisma migrate deploy`. **Seed не вызывается** — прод пустой, данные появятся из CRM.

---

## 1. DNS (Namecheap)

Укажите **A Record** на публичный IP VPS:

| Тип | Host | Value   |
|-----|------|---------|
| A   | `@`  | IP VPS  |
| A   | `crm`| IP VPS  |
| A   | `api`| IP VPS  |

Либо один домен без поддоменов — только `@` и при необходимости `www`.

---

## 2. Сервер (Ubuntu 22.04+)

```bash
sudo apt update && sudo apt install -y git nginx postgresql redis-server certbot python3-certbot-nginx
```

**Node.js 20+** (через NodeSource или nvm):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

**PostgreSQL:** создайте БД и пользователя, строку подключения положите в `backend/.env` как `DATABASE_URL`.

```bash
sudo -u postgres psql -c "CREATE USER oyna WITH PASSWORD 'сильный_пароль';"
sudo -u postgres psql -c "CREATE DATABASE oyna_db OWNER oyna;"
```

---

## 3. Клон репозитория и ключи

Рекомендуется отдельный пользователь `deploy` и каталог, например `/var/www/oyna`.

**Deploy key (только чтение):** в GitHub → Repo → Settings → Deploy keys → добавить публичный ключ сервера. На сервере:

```bash
sudo mkdir -p /var/www/oyna && sudo chown $USER:$USER /var/www/oyna
cd /var/www/oyna
git clone git@github.com:YOUR_ORG/oyna.git .
```

**SSH для GitHub Actions:** на своём ПК сгенерируйте пару ключей *только для деплоя*, публичный ключ в `~/.ssh/authorized_keys` пользователя, с которым заходит Action (часто тот же `deploy`). Приватный ключ целиком — в секрет `VPS_SSH_KEY`.

---

## 4. Переменные окружения

```bash
cp deploy/env/backend.env.example /var/www/oyna/backend/.env
cp deploy/env/frontend.env.example /var/www/oyna/frontend/.env.production
# отредактировать оба файла
```

- **`CORS_ORIGINS`** — URL CRM с протоколом, например `https://crm.example.com`. Несколько значений через запятую. В production без этого списка CORS для браузера будет отключён (см. `backend/src/main.ts`).
- **`NEXT_PUBLIC_API_URL`** — должен совпадать с тем, как nginx отдаёт API (см. ниже), с суффиксом `/api`.

---

## 5. nginx

```bash
sudo cp /var/www/oyna/deploy/nginx/oyna.example.conf /etc/nginx/sites-available/oyna
# правка server_name и при необходимости upstream-портов
sudo ln -sf /etc/nginx/sites-available/oyna /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Вариант **один домен**: `deploy/nginx/oyna-single-host.example.conf` и тогда `NEXT_PUBLIC_API_URL=https://ваш-домен/api`.

---

## 6. Первый запуск вручную

```bash
cd /var/www/oyna
chmod +x deploy/server-build.sh
bash deploy/server-build.sh
pm2 startup   # один раз, выполнить команду, которую выведет pm2
```

Проверка: `curl -sI http://127.0.0.1:3000/api/docs`, `curl -sI http://127.0.0.1:3001`.

---

## 7. SSL (Certbot)

После того как по HTTP открываются `crm` и `api` (или один домен):

```bash
sudo certbot --nginx -d crm.example.com -d api.example.com
```

Для одного домена: `sudo certbot --nginx -d example.com -d www.example.com`. Certbot сам допишет `listen 443 ssl` в конфиг.

Обновите в `.env` / `.env.production` URL на `https://...` и пересоберите фронт (`bash deploy/server-build.sh`).

---

## 8. GitHub Actions

Секреты репозитория:

| Secret            | Пример              |
|-------------------|---------------------|
| `VPS_HOST`        | `123.45.67.89` или домен |
| `VPS_USER`        | `deploy`            |
| `VPS_SSH_KEY`     | приватный ключ PEM  |
| `VPS_DEPLOY_PATH` | `/var/www/oyna`     |

При каждом push в ветку **`main`** (или ручной запуск workflow) на сервере выполняется `git fetch` + `reset --hard origin/main` и `deploy/server-build.sh`.

---

## 9. Пустой прод без seed

- Миграции: `npm run db:migrate:prod` внутри скрипта.
- **Не запускайте** `npm run db:seed` на проде, если нужна «чистая» CRM.
- Первого владельца/админа нужно создать через ваш сценарий регистрации или разовый безопасный скрипт (в репозитории seed для демо — отдельно).

---

## 10. Частые проблемы

- **CORS error:** проверьте `CORS_ORIGINS` и точное совпадение схемы/домена с адресом в браузере.
- **Фронт бьёт не в тот API:** `NEXT_PUBLIC_*` вшиваются при `next build` — после смены URL пересоберите фронт.
- **502 от nginx:** `pm2 status`, логи `pm2 logs oyna-api`, `pm2 logs oyna-web`.
- **`nest: not found` при сборке:** на сервере перед `npm ci` не должно быть `NODE_ENV=production` (в актуальном `server-build.sh` это учтено). Иначе не ставятся devDependencies с Nest CLI и TypeScript.
