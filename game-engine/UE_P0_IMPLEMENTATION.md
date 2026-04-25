# UE P0 — чеклист для интеграции с CRM (репозиторий движка)

Исходники Unreal в монорепозитории **oyna** не хранятся. Ниже — перенос [RISKS.md](RISKS.md) в формат задач для C++ (файлы по инвентаризации Claude).

## P0 (блокеры)

| ID | Задача | Файлы / действие |
|----|--------|------------------|
| P0-1 | Поля сессии: `CurrentSessionId`, `CurrentSessionToken`, `SessionTimeRemaining`, `SessionDuration`, `SessionPlayers`, агрегация результатов, `EndSession(reason)` | `OLMain.h` / `OLMain.cpp` |
| P0-2 | Таймер сессии в `Tick` (не тикать при паузе); по нулю — завершить уровень и `EndSession(TimeElapsed)` | `OLMain.cpp` |
| P0-3 | Вызовы `UOLDriverWSClient::SendMessage` для `qr_shown`, `match_completed`, `session_ended`, `heartbeat` | `OLMain.cpp`, при необходимости хелпер |
| P0-4 | `DispatchEvent`: обработка `session_created`, `player_joined`, `session_start`, `session_pause`, `session_resume`, `session_cancel` | `OLMain.cpp` |
| P0-5 | Структура `FOLPlayerSlot` (slot, userId, displayName, color); HUD показывает слоты | `OLMain.h`, UI |
| P0-6 | Конфиг станции: `RoomId` / `VenueId` / `BuildVersion` / интервал heartbeat в `DefaultGame.ini` + `UPROPERTY(Config)` | `OLMain`, `Config/DefaultGame.ini` |
| P0-7 | Исправить `TimeUsed` / `TimeBonus` в Dynamic и Chaos | `OLMain.cpp` (~1020, ~1184) |

## P1 (сразу после MVP)

| ID | Задача |
|----|--------|
| P1-1 | `bPaused`, `PauseSession` / `ResumeSession`; не декрементить таймеры; останов анимаций лазеров |
| P1-2 | Виджет итогов сессии |
| P1-3 | Автопереход на следующий уровень в Dynamic/Chaos (как в Classic) |
| P1-4 | Таймер CRM heartbeat (например 30 с) в сторону middleware |

## Флаги / модуль

Рекомендация: завести `#define OYNA_CRM_INTEGRATION 1` или отдельный компонент `UOLCrmBridge`, чтобы локальные тесты без CRM не ломались.

## Соответствие WS

Типы и поля входящих/исходящих сообщений — [WS_PROTOCOL.md](WS_PROTOCOL.md). Очередь команд с бэкенда дублирует те же `type` + `payload` (см. [agent/README.md](agent/README.md)).
