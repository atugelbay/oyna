# OYNA Lasers × CRM Integration — Backend Developer Package

> Welcome! Этот архив содержит всё что нужно для backend интеграции с игровым движком OYNA Lasers.

---

## 🎯 Ваша задача

Построить backend CRM (NestJS + PostgreSQL + Prisma) который интегрируется с игровым клиентом на Unreal Engine. Игроки регистрируются на oyna.pro, оператор пополняет баланс на ресепшн, игрок сканирует QR на мониторе в игровой комнате → играет → рейтинг обновляется.

---

## 📦 Что в этом архиве

```
.
├── README.md                   ← этот файл (5 минут)
├── INTEGRATION.md              ← главная спека (30-40 минут)
├── CRM_ENGINE_MAPPING.md       ← сводка: Nest /api ↔ WS ↔ draft openapi
├── UE_P0_IMPLEMENTATION.md     ← чеклист задач UE (код вне этого репо)
├── agent/                      ← пример polling очереди команд (Python)
├── openapi.yaml                ← REST (реализованные пути + draft)
├── WS_PROTOCOL.md              ← WebSocket протокол UE ↔ middleware
├── BACKEND_SCHEMA.md           ← предложение схемы PostgreSQL (Prisma)
├── RISKS.md                    ← что нужно доработать в движке UE
├── .env.example                ← пример конфига станции
├── 01_happy_path.mmd … 05_operator_cancel.mmd  ← mermaid диаграммы
└── (INTEGRATION_SURVEY.md — опционально, если добавите)
```

---

## 🚀 Recommended reading order

**День 1 (4-5 часов):**

1. **[ README.md ]** (этот файл) — 5 минут, общая картина
2. **[ INTEGRATION.md ]** — 40 минут, главная спека. Прочесть полностью.
3. **[ diagrams/01_happy_path.mmd ]** — 10 минут, открыть в Mermaid viewer или https://mermaid.live
4. **[ BACKEND_SCHEMA.md ]** — 20 минут, схема БД

**День 2 (3-4 часа):**

5. **[ openapi.yaml ]** — 30 минут, открыть в Swagger Editor (editor.swagger.io). Импортировать если используете NSwag/OpenAPI Generator.
6. **[ WS_PROTOCOL.md ]** — 30 минут, формат сообщений
7. **[ RISKS.md ]** — 30 минут, что нужно доработать в движке
8. Остальные **[ diagrams/ ]** — 30 минут

**День 3:**

9. Начать реализацию backend. Первая цель — heartbeat endpoint работает.

---

## 🏗 Архитектура коротко

```
Игрок (телефон)          Оператор (ресепшн)
     │                        │
     ▼                        ▼
┌─────────────────────────────────────────┐
│  oyna.pro (React WebClient)              │
│  - Регистрация/логин игроков             │
│  - /join/{joinCode} после скана QR       │
│  - Админка операторов                    │
└─────────────────────────────────────────┘
              │ REST
              ▼
┌─────────────────────────────────────────┐
│  Backend (YOUR CODE)                     │
│  NestJS + PostgreSQL + Prisma            │
└─────────────────────────────────────────┘
              │ REST + WS push
              ▼
┌─────────────────────────────────────────┐
│  Room Agent (Python, уже существует)     │
│  Работает на ноутбуке в комнате          │
│  Будет расширен для вашей интеграции     │
└─────────────────────────────────────────┘
              │ WebSocket (локально)
              ▼
┌─────────────────────────────────────────┐
│  Unreal Engine (игровой клиент)          │
│  Работает на том же ноутбуке             │
└─────────────────────────────────────────┘
```

**Ключевое:** UE не делает HTTPS напрямую в backend. Только через middleware (Room Agent). Это упрощает безопасность и offline mode.

---

## 📋 Your deliverables (для обсуждения)

### Phase 1 (~1 неделя)
- [ ] Setup проекта: NestJS + PostgreSQL + Prisma + initial схема из `BACKEND_SCHEMA.md`
- [ ] Auth endpoints (JWT, регистрация/логин)
- [ ] Station management (регистрация станций, heartbeat)
- [ ] Session endpoints (создание, get, cancel)
- [ ] Join session endpoint (проверка balance, создание MatchPlayer)

### Phase 2 (~1 неделя)
- [ ] Match endpoints (submit match, idempotent)
- [ ] End session endpoint + расчёт рейтинга
- [ ] Admin endpoints (topup, list stations)
- [ ] Rating endpoints (leaderboard, user rating)
- [ ] Transactions endpoints

### Phase 3 (~1 неделя)
- [ ] WebSocket push к middleware (session_created → UE)
- [ ] Integration tests (happy path + failure scenarios)
- [ ] Deployment (dev / staging / production)

**Итого:** ~3 недели при full-time работе. Можно параллелить с UE engine изменениями (см. RISKS.md).

---

## 🔗 Открытые вопросы для обсуждения

См. `INTEGRATION.md` §12 и `BACKEND_SCHEMA.md` в конце. Ключевые:

1. **Гостевая игра без регистрации?** Сейчас модель требует регистрацию. MVP = только зарегистрированные?
2. **Backend → middleware push — как?** WebSocket подписка middleware к backend? Или long-polling `GET /sessions/{id}/events`?
3. **Rating normalization** — коэффициенты для Classic/Dynamic/Chaos. В INTEGRATION.md предложены, но можно обсудить.
4. **Retention данных** — сколько хранить Match записи? Год? Всегда?
5. **Многоязычие backend responses** — error messages на русском или английском?
6. **Rate limiting стратегия** — уточнить лимиты для публичных endpoints (логин, топап).

---

## 🧪 Testing

### Локальная разработка без UE

Можете работать без реального движка. Для этого:

1. Запустить backend локально на порту 3000
2. Использовать Postman/Insomnia коллекцию (сгенерить из `openapi.yaml`)
3. Симулировать mock middleware — простой Python скрипт который шлёт `match_completed` через REST

Пример mock payload:
```bash
curl -X POST http://localhost:3000/api/v1/sessions/sess_test/matches \
  -H "Authorization: Bearer station_live_dev_key" \
  -H "Idempotency-Key: sess_test-L1-A1" \
  -H "Content-Type: application/json" \
  -d '{
    "level": 1,
    "attemptNumber": 1,
    "startedAt": "2026-04-19T15:00:00Z",
    "completedAt": "2026-04-19T15:01:45Z",
    "durationSeconds": 105,
    "finalScore": 1920,
    "livesLeft": 3,
    "bVictory": true,
    "mode": "classic"
  }'
```

### Интеграционные тесты с реальным UE

После того как Azamat доработает движок (см. RISKS.md), возможно полное end-to-end тестирование:
1. Запустить backend (dev/staging)
2. Запустить UE на ноутбуке + middleware
3. Создать сессию через admin API
4. UE покажет QR
5. Сканировать QR телефоном → join session
6. Нажать start → играть

---

## 📞 Contact

- **Заказчик:** Azamat (русскоязычный)
- **Канал связи:** Telegram
- **UE engine side:** работает параллельно над доработкой (см. RISKS.md)
- **Frontend/Mobile:** отдельная команда

Вопросы → спрашивайте в Telegram. Azamat обсудит с UE engine и даст ответ.

---

## ⚠️ Важные ограничения

1. **Никогда не trustить `userId` из UE.** UE получает userId только от backend через `player_joined`. Если UE прислало `match_completed` с несуществующим userId — игнорировать или ошибку.

2. **Идемпотентность критична.** `match_completed` и `session_ended` могут прийти 2+ раза (retry after network glitch). Без idempotency → двойные очки в рейтинг.

3. **API keys не в логах.** Middleware и backend не должны логировать полный `STATION_API_KEY` и `USER_JWT`. Только prefix (первые 8 символов).

4. **Session timeout = 10 минут wall-clock.** Пауза продлевает session time (не тратит). Это важно для расчёта когда сессия должна автозакрыться.

---

## 🎉 Готово?

Прочтите INTEGRATION.md → выпишите вопросы → спишитесь с Azamat → начинайте кодить.

Удачи!
