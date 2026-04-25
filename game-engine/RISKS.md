# OYNA Lasers — Riscs & Required engine changes

> Для backend-разработчика: что в движке UE НЕ готово и должно быть доработано
> до того как интеграция может работать.
> Каждый пункт со ссылкой на файл:строка в текущем коде.

---

## Priority legend

- **P0** — Blocker. Без этого интеграция не работает даже в happy path.
- **P1** — Critical. Без этого интеграция работает, но есть серьёзные функциональные пробелы.
- **P2** — Nice to have. Полировка, качество.

---

## P0 — Blockers (обязательно перед MVP)

### P0-1. Нет session концепции в UE

**Текущий код:** `AOLMain` знает только про уровни (level timer). Нет `sessionId`, нет session timer (10 минут), нет агрегации результатов.

**Файлы:** `Public/Systems/OLMain.h` (нет полей), `Private/Systems/OLMain.cpp` (нет методов)

**Что добавить:**

```cpp
// OLMain.h — новые поля
UPROPERTY() FString CurrentSessionId;
UPROPERTY() FString CurrentSessionToken;
UPROPERTY() float SessionTimeRemaining = 600.f;
UPROPERTY() float SessionDuration = 600.f;
UPROPERTY() TArray<FOLPlayerSlot> SessionPlayers;
UPROPERTY() TArray<FOLLevelResult> SessionResults;
UPROPERTY() int32 SessionMatchesPlayed = 0;
UPROPERTY() int32 SessionTotalScore = 0;

// Новые методы
void StartSession(const FString& SessionId, const FString& Token,
                  const TArray<FOLPlayerSlot>& Players, float Duration);
void EndSession(EOLSessionEndReason Reason);
void RegisterLevelResult(const FOLLevelResult& Result);  // добавляет в массив

// Новые делегаты
UPROPERTY(BlueprintAssignable) FOnOLSessionStarted OnSessionStarted;
UPROPERTY(BlueprintAssignable) FOnOLSessionEnded OnSessionEnded;
UPROPERTY(BlueprintAssignable) FOnOLPlayerJoined OnPlayerJoined;
```

**Estimation:** 1 рабочий день C++

---

### P0-2. Session timer в Tick отсутствует

**Текущий код:** `OLMain.cpp` Tick только декрементит уровневый таймер. Session timer вообще не существует.

**Файл:** `Private/Systems/OLMain.cpp` (Tick метод)

**Что добавить:**

```cpp
void AOLMain::Tick(float DeltaTime) {
    Super::Tick(DeltaTime);

    if (bPaused) return;

    // Existing level timer logic...

    // NEW: Session timer
    if (!CurrentSessionId.IsEmpty() && CurrentState != EOLGameState::Idle) {
        SessionTimeRemaining = FMath::Max(0.f, SessionTimeRemaining - DeltaTime);

        // Broadcast изменения HUD (каждую секунду)
        static float LastBroadcastSecond = -1.f;
        float CurrentSecond = FMath::FloorToFloat(SessionTimeRemaining);
        if (CurrentSecond != LastBroadcastSecond) {
            OnSessionTimeChanged.Broadcast(SessionTimeRemaining);
            LastBroadcastSecond = CurrentSecond;
        }

        // Session ended by timeout
        if (SessionTimeRemaining <= 0.f) {
            EndSession(EOLSessionEndReason::TimeElapsed);
        }
    }
}
```

**Важный нюанс:** если в момент истечения session timer идёт уровень — текущий уровень должен быть засчитан как `bVictory=false, failReason="session_ended"` перед остановкой игры.

**Estimation:** 0.5 дня

---

### P0-3. Нет outgoing WebSocket сообщений

**Текущий код:** `UOLDriverWSClient::SendMessage` существует (`Public/CMD/OLDriverWSClient.h`), но **никто не вызывает**. UE принимает события от middleware, но не отвечает.

**Файлы:**
- `Private/CMD/OLDriverWSClient.cpp` (метод есть)
- `Private/Systems/OLMain.cpp` (нет вызовов)

**Что добавить:**

Новый класс или методы для сериализации сообщений:

```cpp
// Новый хелпер class или методы в AOLMain
void AOLMain::SendWSMessage(const FString& Type, const TSharedPtr<FJsonObject>& Payload) {
    if (!DriverWSClient || !DriverWSClient->IsConnected()) {
        // TODO: buffer for retry
        return;
    }

    TSharedPtr<FJsonObject> Msg = MakeShared<FJsonObject>();
    Msg->SetStringField(TEXT("type"), Type);
    Msg->SetObjectField(TEXT("payload"), Payload);

    FString OutString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutString);
    FJsonSerializer::Serialize(Msg.ToSharedRef(), Writer);

    DriverWSClient->SendMessage(OutString);
}

// Convenience методы
void SendMatchCompleted(const FOLLevelResult& Result);
void SendSessionEnded(EOLSessionEndReason Reason);
void SendHeartbeat();
void SendQrShown();
void SendLifeLost(int32 LaserId, int32 LivesRemaining);
```

**Estimation:** 0.5 дня

---

### P0-4. Нет incoming handlers для session-команд

**Текущий код:** `Private/Systems/OLMain.cpp:601` — `DispatchEvent` обрабатывает только hardware events (`controller_connected`, `laser_triggered`, `button_pressed` и т.д.). Session-команды от backend не обрабатываются.

**Файл:** `Private/Systems/OLMain.cpp:601` (метод DispatchEvent)

**Что добавить:**

```cpp
void AOLMain::DispatchEvent(const FString& Type, const TSharedPtr<FJsonObject>& Payload) {
    // Existing hardware events...

    // NEW: CRM integration events
    if (Type == TEXT("session_created")) {
        HandleSessionCreated(Payload);
    } else if (Type == TEXT("player_joined")) {
        HandlePlayerJoined(Payload);
    } else if (Type == TEXT("session_start")) {
        HandleSessionStart(Payload);
    } else if (Type == TEXT("session_pause")) {
        HandleSessionPause(Payload);
    } else if (Type == TEXT("session_resume")) {
        HandleSessionResume(Payload);
    } else if (Type == TEXT("session_cancel")) {
        HandleSessionCancel(Payload);
    }
}

void AOLMain::HandleSessionCreated(const TSharedPtr<FJsonObject>& Payload) {
    CurrentSessionId = Payload->GetStringField(TEXT("sessionId"));
    CurrentSessionToken = Payload->GetStringField(TEXT("sessionToken"));
    FString JoinCode = Payload->GetStringField(TEXT("joinCode"));
    FString QrImageUrl = Payload->GetStringField(TEXT("qrImageUrl"));

    // Set mode/level from payload
    FString ModeStr = Payload->GetStringField(TEXT("mode"));
    int32 StartLevel = Payload->GetIntegerField(TEXT("startLevel"));

    SessionDuration = Payload->GetIntegerField(TEXT("waitingTimeoutSeconds"));
    SessionTimeRemaining = SessionDuration;

    OnSessionCreated.Broadcast(JoinCode, QrImageUrl);

    // UE Widget показывает QR на экране
    // ...

    // Подтверждаем backend что QR виден
    SendQrShown();
}

// И так далее для остальных handlers
```

**Estimation:** 1 рабочий день

---

### P0-5. Нет slot концепции

**Текущий код:** игра однопользовательская. Нигде в коде нет понятия "игрок 1 / игрок 2".

**Файлы:** везде в game modes (`OLClassicMode`, `OLDynamicMode`, `OLChaosMode`) и `AOLMain`.

**Что добавить:**

```cpp
// Новый struct
USTRUCT(BlueprintType)
struct FOLPlayerSlot {
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) int32 Slot = -1;
    UPROPERTY(BlueprintReadOnly) FString UserId;
    UPROPERTY(BlueprintReadOnly) FString DisplayName;
    UPROPERTY(BlueprintReadOnly) FLinearColor Color;

    FOLPlayerSlot() = default;
    FOLPlayerSlot(int32 InSlot, FString InUserId, FString InName)
        : Slot(InSlot), UserId(InUserId), DisplayName(InName) {}
};
```

**Shared lives решение:** поскольку жизни общие (все теряют при любом лазере), slot концепция нужна только для UI (показать имя/цвет каждого игрока). Логика `Lives--` остаётся глобальной.

**HUD отображение слотов:** WBP_GameHUD должен показывать список `SessionPlayers` с именами и цветами. Это часть UI задачи (идёт параллельно с backend работой).

**Estimation:** 0.5 дня (C++ часть)

---

### P0-6. Нет конфига станции

**Текущий код:** `Config/DefaultGame.ini` содержит только:
```ini
[/Script/EngineSettings.GameMapsSettings]
GlobalDefaultGameMode=/Script/OYNA_Lasers.OLGameMode
```

Нет `StationId`, `VenueId`, `RoomId`, `BuildVersion`.

**Файлы:**
- `Config/DefaultGame.ini` (пустой от OYNA)
- `Public/Systems/OLMain.h` (нет Config полей)

**Что добавить:**

В `OLMain.h`:
```cpp
UCLASS(Config=Game)  // уже так по идее, проверить
class AOLMain : public AActor {
    // ...
    UPROPERTY(Config, EditAnywhere, Category="OYNA|Station")
    FString StationId;

    UPROPERTY(Config, EditAnywhere, Category="OYNA|Station")
    FString RoomId;

    UPROPERTY(Config, EditAnywhere, Category="OYNA|Station")
    FString VenueId;

    UPROPERTY(Config, EditAnywhere, Category="OYNA|Station")
    FString BuildVersion;

    UPROPERTY(Config, EditAnywhere, Category="OYNA|Session")
    float SessionDurationSeconds = 600.f;

    UPROPERTY(Config, EditAnywhere, Category="OYNA|Session")
    float HeartbeatIntervalSeconds = 30.f;
};
```

В `Config/DefaultGame.ini`:
```ini
[/Script/OYNA_Lasers.OLMain]
StationId=laser-matrix-01
RoomId=laser-matrix-01
VenueId=almaty-downtown
BuildVersion=1.0.0
SessionDurationSeconds=600
HeartbeatIntervalSeconds=30
```

На каждой станции `DefaultGame.ini` имеет свои `StationId` и `VenueId`. Либо использовать override `DedicatedServerEngine.ini` + переменные окружения.

**Estimation:** 0.25 дня

---

### P0-7. Баг в FOLLevelResult Dynamic/Chaos

**Текущий код:** `Private/Systems/OLMain.cpp:1020, 1184`

```cpp
// Плохо:
Result.TimeUsed = TimeRemaining;  // должно быть LevelDuration - TimeRemaining
Result.TimeBonus = 0;  // не заполняется
```

**Что исправить (OLMain.cpp:1020 для Dynamic):**
```cpp
// Было:
// Result.TimeUsed = TimeRemaining;

// Стало:
float LevelDur = /* получить из DynamicMode */ 90.f;
Result.TimeUsed = LevelDur - TimeRemaining;
Result.TimeBonus = FMath::FloorToInt(TimeRemaining) * 10;
```

Аналогично для Chaos (OLMain.cpp:1184).

**Почему критично:** Backend использует TimeUsed для метрик длительности матчей. Неверные данные = неверная статистика и рейтинг.

**Estimation:** 0.5 часа

---

## P1 — Critical

### P1-1. Пауза не реализована

**Текущий код:** `rg "Pause|Resume" Source/` → 0 матчей. Игра не может быть приостановлена.

**Что добавить:**

```cpp
UPROPERTY(BlueprintReadOnly) bool bPaused = false;

void AOLMain::PauseSession() {
    if (!bPaused) {
        bPaused = true;
        OnSessionPaused.Broadcast(true);
        // TODO: заморозить все движения (Dynamic/Chaos anim)
    }
}

void AOLMain::ResumeSession() {
    if (bPaused) {
        bPaused = false;
        OnSessionPaused.Broadcast(false);
    }
}
```

В Tick: при `bPaused` — return early, не декрементить таймеры.

В Dynamic/Chaos: приостановить tick анимации лазеров (AOLGame01::StepInterval).

**Estimation:** 1 рабочий день (включая pause анимаций в режимах)

---

### P1-2. Session Summary UI widget нужен

**Текущий код:** Есть WBP_LevelComplete и WBP_GameOver (или будут — в работе у UI разработчика). Нет WBP_SessionSummary.

**Что:** после `OnSessionEnded` показать экран с результатами всех уровней сессии + итог.

**Файл:** создать `Content/UI/HUD/WBP_SessionSummary.uasset` в UI задаче.

**ТЗ:** уже включен в пакет для UI разработчика (P2 → переносится на P0).

**Estimation:** 1 рабочий день UI

---

### P1-3. Автопереход уровней только в Classic

**Текущий код:** `OLMain.cpp:868-884` — только Classic имеет 5-секундный автопереход на следующий уровень. Dynamic и Chaos — нет.

**Что исправить:** добавить аналогичную логику в Dynamic и Chaos. Или:
- Новая модель "игрок проходит сколько успеет за 10 минут" → после level complete автопереход на следующий во всех режимах.

**Почему критично для CRM:** сессия 10 минут может содержать несколько уровней. Если автоперехода нет, игроки застрянут на одном уровне после прохождения.

**Estimation:** 0.5 дня

---

### P1-4. Heartbeat в middleware

**Текущий код:** В UE heartbeat 1 Hz уходит только на hardware (через UART). Нет отдельного heartbeat для CRM.

**Что:** периодический (30s) heartbeat от UE в middleware, middleware дальше в backend.

**Реализация в UE:**

```cpp
// AOLMain::BeginPlay
GetWorldTimerManager().SetTimer(
    CrmHeartbeatTimer,
    this, &AOLMain::SendCrmHeartbeat,
    HeartbeatIntervalSeconds,
    true
);

void AOLMain::SendCrmHeartbeat() {
    TSharedPtr<FJsonObject> Payload = MakeShared<FJsonObject>();
    Payload->SetStringField(TEXT("stationId"), StationId);
    Payload->SetStringField(TEXT("buildVersion"), BuildVersion);
    Payload->SetNumberField(TEXT("uptime"), FApp::GetCurrentTime() - AppStartTime);
    Payload->SetStringField(TEXT("currentSessionId"), CurrentSessionId);
    SendWSMessage(TEXT("heartbeat"), Payload);
}
```

**Estimation:** 0.25 дня

---

## P2 — Nice to have

### P2-1. Версионирование протокола

Добавить поле `protocolVersion` во все сообщения. Сейчас при изменении формата будет обратная несовместимость. С версионированием backend может поддерживать несколько версий UE одновременно.

```json
{
  "type": "match_completed",
  "protocolVersion": "1.0",
  "payload": { ... }
}
```

**Estimation:** 0.25 дня

---

### P2-2. Admin console в UE (для оператора на ноутбуке)

Сейчас оператор управляет сессиями через oyna.pro/admin. Если удобнее — можно сделать прямо в UE экран (простейший UMG) с кнопками "Создать сессию", "Начать", "Отменить".

**Estimation:** 1-2 дня UI

---

### P2-3. Replay / дебаг режима

Логировать все входящие/исходящие WS сообщения в файл, чтобы потом можно было проиграть сессию для дебага.

**Estimation:** 0.5 дня

---

### P2-4. Настройка за точку — конфиги уровней

Сейчас все конфиги уровней (кол-во лазеров, длительность, параметры Dynamic/Chaos) зашиты в C++. Нельзя "сделать Classic легче" на конкретной точке без перекомпиляции.

**Что:** вынести конфиги уровней в Data Asset или JSON, загружаемый при старте.

**Estimation:** 2-3 дня

---

## Summary estimation

| Приоритет | Дней |
|-----------|------|
| P0 (обязательный минимум) | 3.5-4 дня C++ |
| P1 | 3 дня C++ + 1 день UI |
| P2 | опционально, 4-6 дней |

**MVP CRM:** P0 + P1 = **~7-8 рабочих дней** в UE engine side.

Параллельно backend-команда работает ~7-14 дней (их оценка).

Итого: **~2 недели до готовой интеграции** при параллельной работе.

---

## Зависимости и порядок

1. **Сначала:** P0-7 (баг-фиксы) — 0.5 часа, можно сделать сразу
2. **Потом P0-6** (config station) — 2 часа, до всего остального
3. **Далее P0-1 + P0-2** (session concept + timer) — день
4. **Параллельно P0-3 + P0-4** (WS send/receive) — 1.5 дня
5. **P0-5** (slots) — 0.5 дня
6. **Backend может начинать работать** (у них есть спека)
7. **P1 пункты** — по готовности
8. **Интеграционные тесты** — с обеих сторон

---

## Что точно НЕ менять

В ответе Claude Code инвентаризации нашлись критичные файлы которые менять опасно:

- `OLCmdIO_YDGZObject.h/.cpp` — парсер протокола железа (одно изменение = риск сломать детекцию)
- `OLUARTSerialPluginObject` — UART работы с контроллером
- `Private/CMD/OLDriverWSClient.cpp:12` (URL hardcoded) — можно вынести в config, но связь с middleware работает, не ломать

## Вопросы для backend-команды

1. Предусмотрено ли в вашей архитектуре WS push от backend в middleware? Или middleware должен polling делать `GET /sessions/{id}/events`?
2. Как ротировать `STATION_API_KEY` без даунтайма?
3. Длительность сессии (600s) — в будущем захотите менять динамически (VIP-сессии на 20 минут)? Тогда лучше передавать в session_created payload.
4. Что делаем если игрок оставил комнату до окончания (ушёл)? Refund? Засчитывается ли partial?
