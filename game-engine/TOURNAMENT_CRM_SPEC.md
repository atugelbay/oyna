# Турнир — спецификация для CRM (Nest + панель)

Источник владельца: `TOURNAMENT CRM for backend.md` (22.10.2026).  
Контракт игры: Room API v1.2 §10 (`GET /tournament/sets`, `PUT/DELETE /lobby/tournament`, `POST /lobby/tournament/start`).

**Правило:** только добавления к обычному сеансу. Минуты/рейтинг/unlocks для турнира — выключены.

---

## 1. Продукт (канон)

| Правило | Деталь |
|---------|--------|
| Формат | Турнирная таблица, не «команда vs команда» |
| Команда | Ровно **4** аккаунта, без гостей |
| День | Команда проходит все турнирные комнаты подряд за день |
| Комнаты сейчас | Mega Grid, Hide, Arena (Лазеры — позже, sets пустые) |
| Итог | Сумма очков по комнатам → место |
| Попытка | **1** на команду; сброс — только админ CRM |
| Минуты | **Не списывать** |
| Рейтинг / unlocks | **Не писать**; `level_finished` в турнире игра не шлёт |
| Замена | Только админ, между комнатами (травма) |
| 1 игрок | Не больше одной команды в одном турнире |

### Зачёт матча (`session_finished.tournament`)

| Исход | Признак | CRM |
|-------|---------|-----|
| Норма (10 мин) | `reason: time`, `aborted: false` | Засчитать `total_score` комнаты |
| Отмена до старта | `DELETE` → cancelled | Ничего |
| Abort админом / сбой | `aborted: true` | **Не** засчитывать, разрешить переигровку (новый `match_id`, тот же `set_id`) |

Попытка израсходована, когда во **всех** турнирных комнатах есть засчитанный матч.

---

## 2. Room API (агент шлёт от CRM)

| Шаг | HTTP | Назначение |
|-----|------|------------|
| 1 | `GET /v1/tournament/sets` | Наборы: `<room>_group_v1`, `<room>_final_v1` |
| 2 | Лобби пустое | Иначе `409 lobby_not_empty` |
| 3 | `PUT /v1/lobby/tournament` | `{ tournament_id, stage, match_id, set_id, team: [{player_id, nickname}×4] }` |
| 4 | Старт | HUD «НАЧАТЬ» **или** `POST /v1/lobby/tournament/start` (CRM — несколько комнат одной кнопкой) |
| 5 | Отмена / abort | `DELETE /v1/lobby/tournament` ; abort с `?abort=1` |
| 6 | Итог | `session_finished` + блок `tournament` (`total_score`, `aborted`, …) |

Пока турнир активен: обычный `POST/DELETE /lobby/players` → `409 tournament_active`.  
`PUT` с ≠4 игроками → `422 team_size`.

Очередь Nest → агент (как остальные команды):

```json
{ "method": "PUT", "path": "/lobby/tournament", "body": { ... }, "idempotency_key": "uuid" }
```

Типы команд (предложение): `room_api.tournament_put` | `tournament_start` | `tournament_delete`.

---

## 3. Что уже есть в `oyna` vs пробелы

| Есть | Нет |
|------|-----|
| CRUD `Tournament` (name, dates, venue, maxTeams, status) | `stage`, set_id по комнатам |
| Команды / join в **client** API | Жёстко 4 игрока; замена админом |
| CRM UI список/создание турнира | Экран «посадить команду в комнату → start/abort» |
| `TournamentResult` (заготовка) | `TournamentMatch`, запись очков, таблица |
| — | Enqueue tournament Room API |
| — | `session_finished` ветка tournament (без debit/rating) |
| — | Клиент: место и очки команды после игр |

---

## 4. Модель данных (целевая)

```
Tournament
  + stage                 // "group" | "final" | custom
  + roomSetIds Json?      // { "<crmRoomId>": "<set_id>" }  — зафиксировать на этап

TournamentTeam
  + attemptConsumed Boolean @default(false)
  // participantsCount уже есть — держать = members.length, max 4

TournamentMatch          // НОВАЯ
  id, tournamentId, teamId, roomId
  matchId          String @unique   // UUID в PUT
  setId            String
  status           PREPARED | PLAYING | COUNTED | ABORTED | CANCELLED
  engineSessionId  String?
  totalScore       Int?
  aborted          Boolean @default(false)
  finishedPayload  Json?            // сырой tournament-блок
  createdAt, finishedAt

// опционально: GameSession.tournamentMatchId — если биндим сессию
```

Таблица мест: агрегат по `TournamentMatch` со `status=COUNTED` → сумма `totalScore` → rank (тай-брейк владелец ещё не утвердил: max_step, errors).

---

## 5. Nest API (добавить)

### Админ / оператор CRM (JWT)

| Method | Path | Действие |
|--------|------|----------|
| GET | `/tournaments/:id/standings` | Места, сумма, очки по комнатам |
| POST | `/tournaments/:id/teams/:teamId/reset-attempt` | Сброс попытки (ADMIN) |
| POST | `/tournaments/:id/teams/:teamId/substitute` | `{ outUserId, inUserId }` |
| GET | `/station/rooms/:roomId/tournament/sets` | Прокси: enqueue read или агент отдаёт sets (см. ниже) |
| POST | `/tournaments/:id/matches` | Подготовить матч: проверить 4 игрока, попытку, лобби; enqueue `PUT /lobby/tournament` |
| POST | `/tournaments/matches/:matchId/start` | enqueue `POST /lobby/tournament/start` |
| DELETE | `/tournaments/matches/:matchId` | `?abort=0\|1` → DELETE lobby/tournament |

**Sets:** агент может сделать `GET /v1/tournament/sets` и `POST` в CRM cache, либо CRM просит агента one-shot. MVP: оператор выбирает `set_id` вручную из известных `*_group_v1` / `*_final_v1`, плюс кнопка «обновить sets» через команду агенту.

### Client API (уже join) — добить

- Create/join: отказ если в команде уже 4; отказ если игрок уже в другой команде турнира.
- `GET /tournaments/:id/standings` или блок в `GET :id` — очки/место своей команды.

---

## 6. Station / session_finished

```
if payload.tournament:
  find TournamentMatch by match_id / engineSessionId
  if aborted → status ABORTED, не в сумму, attempt не жечь
  else if reason time → COUNTED, totalScore = tournament.total_score
  проверить: все турнирные комнаты COUNTED → team.attemptConsumed = true
  НЕ вызывать debitBalanceOnSessionStart / endSession с рейтингом
  НЕ hall_records из турнирных очков в общий рейтинг (hall — по продукту отдельно)
  return
else:
  обычный поток (debit, scores, unlocks, hall_records)
```

`session_started` с tournament: не списывать минуты (матч уже PREPARED→PLAYING).

---

## 7. UI CRM (оператор)

На странице турнира вкладка **«Матч»**:

1. Выбрать команду (только с 4 игроками, attempt не израсходован или переигровка abort).  
2. Выбрать комнату (Mega Grid / Hide / Arena).  
3. `set_id` (group/final для этапа).  
4. Кнопка **«Подготовить»** → PUT.  
5. **«Старт»** → POST start (и/или ждать HUD).  
6. **«Отмена»** / **«Прервать (abort)»**.  
7. Таблица: место | команда | сумма | MG | Hide | Arena.

---

## 8. Порядок внедрения

1. **Схема** + миграция (`TournamentMatch`, поля stage/attempt/set).  
2. **Station:** ветка `session_finished` / `session_started` для tournament (no debit).  
3. **Nest:** prepare/start/abort + standings + reset/substitute.  
4. **Client API:** лимит 4 + standings в кабинете.  
5. **CRM UI:** экран матча + таблица.  
6. **Стенд:** чеклист §8 владельца (422/409, abort, две комнаты, обычный сеанс после).

---

## 9. Открыто (владелец)

- Тай-брейк при равной сумме (предложение: сумма `max_step`, затем меньше `errors`).  
- Лазеры — когда появятся sets.

---

## 10. Промпт для другой модели (кратко)

> Допиши турниры в Nest CRM по `game-engine/TOURNAMENT_CRM_SPEC.md` и файлу владельца. Игра уже умеет `/v1/tournament/*` и `session_finished.tournament`. Нужны TournamentMatch, PUT/start/DELETE через RoomAgentCommand, зачёт/abort без списания минут и без рейтинга, таблица мест, админ UI «команда→комната→старт». Команда ровно 4. Обычный сеанс не ломать.
