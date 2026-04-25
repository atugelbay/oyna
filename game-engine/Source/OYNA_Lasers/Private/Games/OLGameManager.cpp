#include "Games/OLGameManager.h"
#include "Systems/OLMain.h"  // AOLMain — SetOneLED, SetAllLEDs
#include "TimerManager.h"
#include "Engine/World.h"
#include "Math/RandomStream.h"

// ─────────────────────────────────────────────────────────────────────────────
// Constructor
// ─────────────────────────────────────────────────────────────────────────────
AOLGameManager::AOLGameManager()
{
    PrimaryActorTick.bCanEverTick = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// BeginPlay
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::BeginPlay()
{
    Super::BeginPlay();
    BuildAllPatterns();
    SetGameState(EGameState::Idle);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick — game timer countdown
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    if (GameState != EGameState::Playing)
        return;

    TimeRemaining -= DeltaTime;
    OnTimeChanged.Broadcast(TimeRemaining);

    // Activate warning flash when < 10 s remain
    if (TimeRemaining <= WarningTimeThreshold && !bWarningActive)
    {
        bWarningActive = true;
        // Start yellow blink: active lasers flash yellow every 0.5 s
        GetWorldTimerManager().SetTimer(WarningFlashTimer, this,
            &AOLGameManager::UpdateWarningFlash, 0.5f, true);
    }

    if (TimeRemaining <= 0.f)
    {
        TimeRemaining = 0.f;
        FailLevel();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::StartGame(int32 Mode, int32 StartLevel)
{
    CurrentMode  = FMath::Clamp(Mode,       1, 3);
    CurrentLevel = FMath::Clamp(StartLevel, 1, 10);
    CurrentLives = MaxLives;

    OnModeChanged .Broadcast(CurrentMode);
    OnLevelChanged.Broadcast(CurrentLevel);
    OnLivesChanged.Broadcast(CurrentLives);

    ClearAllTimers();
    LoadLevel(CurrentMode, CurrentLevel);
    StartCountdown();
}

void AOLGameManager::StopGame()
{
    ClearAllTimers();
    SetAllLEDs(COLOR_OFF);
    SetGameState(EGameState::Idle);
}

void AOLGameManager::NextLevel()
{
    ClearAllTimers();

    if (CurrentLevel >= 10)
    {
        // Completed all levels — treat as full game win
        SetAllLEDs(COLOR_GREEN);
        SetGameState(EGameState::LevelComplete);
        return;
    }

    ++CurrentLevel;
    CurrentLives = MaxLives;
    OnLevelChanged.Broadcast(CurrentLevel);
    OnLivesChanged.Broadcast(CurrentLives);

    LoadLevel(CurrentMode, CurrentLevel);
    StartCountdown();
}

// ─────────────────────────────────────────────────────────────────────────────
// OnLaserTriggered — main event dispatcher
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::OnLaserTriggered(int32 LaserID)
{
    // ── Button: START (ID 46) ──────────────────────────────────────────────
    if (LaserID == LASER_START)
    {
        if (GameState == EGameState::Idle || GameState == EGameState::GameOver)
        {
            StartGame(CurrentMode, 1);
        }
        return;
    }

    // ── Button: FINISH (ID 47) ────────────────────────────────────────────
    if (LaserID == LASER_FINISH)
    {
        if (GameState == EGameState::Playing && CurrentLives > 0)
        {
            WinLevel();
        }
        return;
    }

    // ── Regular laser: only active during Playing ─────────────────────────
    if (GameState != EGameState::Playing)
        return;

    // Check whether this laser is an active barrier
    if (!CurrentPattern.ActiveLaserIDs.Contains(LaserID))
        return;

    // Anti-debounce: ignore repeated triggers within DebounceTime seconds
    const float Now = GetWorld()->GetTimeSeconds();
    const float* LastTime = LastTriggerTime.Find(LaserID);
    if (LastTime && (Now - *LastTime) < DebounceTime)
        return;

    LastTriggerTime.Add(LaserID, Now);
    LoseLife();
}

// ─────────────────────────────────────────────────────────────────────────────
// Level loading
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::LoadLevel(int32 Mode, int32 Level)
{
    // Flat index: (Mode-1)*10 + (Level-1)
    const int32 Idx = (FMath::Clamp(Mode, 1, 3) - 1) * 10 + (FMath::Clamp(Level, 1, 10) - 1);
    if (AllPatterns.IsValidIndex(Idx))
    {
        CurrentPattern = AllPatterns[Idx];
    }
    else
    {
        // Fallback: generate a random pattern of medium density
        CurrentPattern = GenerateRandomPattern(10, Mode, Level);
    }
}

void AOLGameManager::ApplyPattern(const FLaserLevelPattern& Pattern)
{
    // Turn all lasers off first, then light up barriers in red
    SetAllLEDs(COLOR_OFF);
    for (int32 ID : Pattern.ActiveLaserIDs)
    {
        SetOneLED(ID, COLOR_RED);
    }
}

void AOLGameManager::ApplyCurrentPattern()
{
    ApplyPattern(CurrentPattern);
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown  3 … 2 … 1 … GO
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::StartCountdown()
{
    SetGameState(EGameState::Countdown);
    SetAllLEDs(COLOR_OFF);
    CountdownStep = 3;

    // Immediately flash first step
    OnCountdownTick();
}

void AOLGameManager::OnCountdownTick()
{
    if (CountdownStep > 0)
    {
        // Single blue flash for each count step
        SetAllLEDs(COLOR_BLUE);

        // Schedule: turn off after 0.3 s, then schedule next tick at 1 s
        FTimerHandle TempOff;
        GetWorldTimerManager().SetTimer(TempOff, [this]()
        {
            SetAllLEDs(COLOR_OFF);
        }, 0.3f, false);

        --CountdownStep;
        GetWorldTimerManager().SetTimer(CountdownTimer, this,
            &AOLGameManager::OnCountdownTick, 1.0f, false);
    }
    else
    {
        // GO — start playing
        TimeRemaining  = LevelDuration;
        bWarningActive = false;
        LastTriggerTime.Empty();

        ApplyCurrentPattern();
        SetGameState(EGameState::Playing);

        // For Dynamic / Advanced, schedule first pattern change
        if (CurrentMode == 2 || CurrentMode == 3)
        {
            ScheduleNextPatternChange();
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Life / outcome
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::LoseLife()
{
    --CurrentLives;
    OnLivesChanged.Broadcast(CurrentLives);
    OnLifeLost.Broadcast();

    // Flash white 3 times quickly
    FlashAll(COLOR_WHITE, 3, 0.15f, [this]()
    {
        if (CurrentLives <= 0)
        {
            FailLevel();
        }
        else
        {
            // Restore pattern after flash
            ApplyCurrentPattern();
        }
    });
}

void AOLGameManager::WinLevel()
{
    ClearAllTimers();
    SetGameState(EGameState::LevelComplete);
    OnLevelWon.Broadcast();

    // Flash green for 2 s, then advance
    SetAllLEDs(COLOR_GREEN);
    FTimerHandle WinTimer;
    GetWorldTimerManager().SetTimer(WinTimer, [this]()
    {
        NextLevel();
    }, 2.0f, false);
}

void AOLGameManager::FailLevel()
{
    ClearAllTimers();
    SetGameState(EGameState::GameOver);
    OnGameOverEvent.Broadcast();

    // Flash red 3 times, then go idle
    FlashAll(COLOR_RED, 3, 0.4f, [this]()
    {
        SetAllLEDs(COLOR_OFF);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic / Advanced: pattern changes
// ─────────────────────────────────────────────────────────────────────────────
float AOLGameManager::GetPatternChangeInterval() const
{
    if (CurrentMode == 3) // Advanced: random 2-8 s
    {
        return FMath::RandRange(2.0f, 8.0f);
    }

    // Dynamic intervals by level bracket
    if (CurrentLevel <= 3)  return 15.0f;
    if (CurrentLevel <= 6)  return 10.0f;
    if (CurrentLevel <= 9)  return  7.0f;
    return 4.0f; // Level 10
}

void AOLGameManager::ScheduleNextPatternChange()
{
    const float Interval = GetPatternChangeInterval();
    GetWorldTimerManager().SetTimer(PatternChangeTimer, this,
        &AOLGameManager::ChangePattern, Interval, false);
}

void AOLGameManager::ChangePattern()
{
    if (GameState != EGameState::Playing)
        return;

    // Generate a fresh random pattern with the same laser count as the base pattern
    const int32 NumActive = CurrentPattern.ActiveLaserIDs.Num();
    CurrentPattern = GenerateRandomPattern(NumActive, CurrentMode, CurrentLevel);
    ApplyCurrentPattern();

    // For Advanced mode, some lasers may randomly blink
    if (CurrentMode == 3)
    {
        // Pick up to 3 random active lasers and make them flicker once
        TArray<int32> ActiveCopy = CurrentPattern.ActiveLaserIDs;
        const int32 BlinkCount = FMath::Min(3, ActiveCopy.Num());
        for (int32 i = 0; i < BlinkCount; ++i)
        {
            const int32 RandIdx = FMath::RandRange(0, ActiveCopy.Num() - 1);
            const int32 BlinkID = ActiveCopy[RandIdx];
            ActiveCopy.RemoveAt(RandIdx);

            // Briefly turn off the laser then back on
            SetOneLED(BlinkID, COLOR_OFF);
            FTimerHandle TempTimer;
            GetWorldTimerManager().SetTimer(TempTimer, [this, BlinkID]()
            {
                if (GameState == EGameState::Playing &&
                    CurrentPattern.ActiveLaserIDs.Contains(BlinkID))
                {
                    SetOneLED(BlinkID, COLOR_RED);
                }
            }, 0.25f, false);
        }
    }

    ScheduleNextPatternChange();
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning flash (last 10 s): active lasers blink yellow
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::UpdateWarningFlash()
{
    if (GameState != EGameState::Playing)
    {
        GetWorldTimerManager().ClearTimer(WarningFlashTimer);
        return;
    }

    bWarningFlashState = !bWarningFlashState;
    const uint32 Color = bWarningFlashState ? COLOR_YELLOW : COLOR_RED;

    for (int32 ID : CurrentPattern.ActiveLaserIDs)
    {
        SetOneLED(ID, Color);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FlashAll — generic flash helper using a recurring FTimerHandle
// Each call toggles ALL LEDs on/off.  Total flashes = Times on+off pairs.
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::FlashAll(uint32 Color, int32 Times, float Interval, TFunction<void()> OnComplete)
{
    GetWorldTimerManager().ClearTimer(FlashTimer);

    FlashRemaining        = Times * 2;  // on-tick + off-tick per flash
    FlashState            = false;
    FlashColor            = Color;
    FlashCompleteCallback = MoveTemp(OnComplete);

    // Use a recurring timer; each tick we toggle and decrement the counter.
    GetWorldTimerManager().SetTimer(
        FlashTimer,
        FTimerDelegate::CreateLambda([this]()
        {
            FlashState = !FlashState;
            SetAllLEDs(FlashState ? FlashColor : COLOR_OFF);
            --FlashRemaining;

            if (FlashRemaining <= 0)
            {
                GetWorldTimerManager().ClearTimer(FlashTimer);
                SetAllLEDs(COLOR_OFF);
                if (FlashCompleteCallback)
                {
                    TFunction<void()> CB = MoveTemp(FlashCompleteCallback);
                    FlashCompleteCallback = nullptr;
                    CB();
                }
            }
        }),
        Interval,
        /*bLoop=*/true
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// State helper
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::SetGameState(EGameState NewState)
{
    GameState = NewState;
    OnGameStateChanged.Broadcast(NewState);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear all FTimerHandles
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::ClearAllTimers()
{
    UWorld* W = GetWorld();
    if (!W) return;
    W->GetTimerManager().ClearTimer(CountdownTimer);
    W->GetTimerManager().ClearTimer(PatternChangeTimer);
    W->GetTimerManager().ClearTimer(FlashTimer);
    W->GetTimerManager().ClearTimer(WarningFlashTimer);
    bWarningActive     = false;
    bWarningFlashState = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// LED helpers — delegate to AOLMain
// ─────────────────────────────────────────────────────────────────────────────

// Map internal uint32 hardware color constants to the EOLColorTypes enum that
// AOLMain's original API accepts. Yellow/Purple have no enum equivalent — they
// map to White so the flash is still visible.
static EOLColorTypes ToColorType(uint32 Color)
{
    if (Color == 0)                                                         return EOLColorTypes::Off;
    if (Color == (127u << 17))                                              return EOLColorTypes::Red;
    if (Color == (127u <<  9))                                              return EOLColorTypes::Green;
    if (Color == (127u <<  1))                                              return EOLColorTypes::Blue;
    if (Color == ((127u << 17) | (127u <<  9) | (127u <<  1)))             return EOLColorTypes::White;
    return EOLColorTypes::White; // Yellow, Purple, and any other combo → White
}

void AOLGameManager::SetAllLEDs(uint32 Color)
{
    if (IsValid(MainActor))
        MainActor->SetAllLEDs(ToColorType(Color));
}

void AOLGameManager::SetOneLED(int32 LaserID, uint32 Color)
{
    if (IsValid(MainActor))
    {
        TArray<int32> IDs = { LaserID };
        MainActor->SetOneLED(/*Channel=*/1, IDs, ToColorType(Color));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid → LaserID  (S-chain wiring)
//   Even rows: left→right  col 0..5
//   Odd  rows: right→left  col 5..0
// ─────────────────────────────────────────────────────────────────────────────
int32 AOLGameManager::GridToLaserID(int32 Row, int32 Col)
{
    const int32 ActualCol = (Row % 2 == 0) ? Col : (GRID_COLS - 1 - Col);
    return Row * GRID_COLS + ActualCol;
}

// ─────────────────────────────────────────────────────────────────────────────
// HasValidPath — BFS/flood-fill: does any OFF-cell path exist from row 0 to row 7?
// A player can move horizontally or vertically through OFF cells.
// ─────────────────────────────────────────────────────────────────────────────
bool AOLGameManager::HasValidPath(const TSet<int32>& ActiveSet)
{
    // Build a free-cell grid (true = passable)
    // We add two virtual rows: -1 (entry) and 8 (exit)
    // and connect all free cells in row 0 to entry and row 7 to exit.

    auto IsPassable = [&](int32 Row, int32 Col) -> bool
    {
        if (Row < 0 || Row >= GRID_ROWS || Col < 0 || Col >= GRID_COLS)
            return false;
        const int32 ID = GridToLaserID(Row, Col);
        return !ActiveSet.Contains(ID);
    };

    // BFS from all free cells in row 0
    TSet<int32> Visited;
    TQueue<int32> Queue;

    for (int32 C = 0; C < GRID_COLS; ++C)
    {
        if (IsPassable(0, C))
        {
            const int32 Node = 0 * GRID_COLS + C;
            if (!Visited.Contains(Node))
            {
                Visited.Add(Node);
                Queue.Enqueue(Node);
            }
        }
    }

    const int32 DRow[] = {-1, 1, 0, 0};
    const int32 DCol[] = { 0, 0,-1, 1};

    while (!Queue.IsEmpty())
    {
        int32 Node;
        Queue.Dequeue(Node);
        const int32 R = Node / GRID_COLS;
        const int32 C = Node % GRID_COLS;

        if (R == GRID_ROWS - 1)
            return true; // reached exit row

        for (int32 d = 0; d < 4; ++d)
        {
            const int32 NR = R + DRow[d];
            const int32 NC = C + DCol[d];
            if (IsPassable(NR, NC))
            {
                const int32 NNode = NR * GRID_COLS + NC;
                if (!Visited.Contains(NNode))
                {
                    Visited.Add(NNode);
                    Queue.Enqueue(NNode);
                }
            }
        }
    }

    return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// GenerateRandomPattern
// Strategy: start with all cells free, randomly add lasers one by one,
// keeping the path valid (HasValidPath check after each addition).
// ─────────────────────────────────────────────────────────────────────────────
FLaserLevelPattern AOLGameManager::GenerateRandomPattern(int32 NumActiveLasers, int32 Mode, int32 Level, int32 Seed)
{
    FRandomStream RNG;
    if (Seed >= 0)
        RNG.Initialize(Seed);
    else
        RNG.GenerateNewSeed();

    // Game-laser IDs only (0-45); 46 and 47 are buttons
    TArray<int32> Candidates;
    Candidates.Reserve(46);
    for (int32 i = 0; i < 46; ++i)
        Candidates.Add(i);

    // Shuffle
    for (int32 i = Candidates.Num() - 1; i > 0; --i)
    {
        const int32 j = RNG.RandRange(0, i);
        Candidates.Swap(i, j);
    }

    TSet<int32> ActiveSet;
    int32 Added = 0;

    for (int32 Candidate : Candidates)
    {
        if (Added >= NumActiveLasers)
            break;

        ActiveSet.Add(Candidate);
        if (!HasValidPath(ActiveSet))
        {
            // This laser blocks the path — remove it
            ActiveSet.Remove(Candidate);
        }
        else
        {
            ++Added;
        }
    }

    FLaserLevelPattern Out;
    Out.ActiveLaserIDs = ActiveSet.Array();
    Out.Mode  = Mode;
    Out.Level = Level;
    Out.LevelName = FString::Printf(TEXT("Mode%d L%d (gen)"), Mode, Level);
    return Out;
}

// ─────────────────────────────────────────────────────────────────────────────
// BuildAllPatterns — 30 hand-crafted Classic patterns + generated Dynamic/Advanced
//
// Grid reference (LaserID layout after S-chain mapping):
//   Row 0 (even): IDs  0  1  2  3  4  5   (col 0→5)
//   Row 1 (odd) : IDs 11 10  9  8  7  6   (col 0→5, physically right→left)
//   Row 2 (even): IDs 12 13 14 15 16 17
//   Row 3 (odd) : IDs 23 22 21 20 19 18
//   Row 4 (even): IDs 24 25 26 27 28 29
//   Row 5 (odd) : IDs 35 34 33 32 31 30
//   Row 6 (even): IDs 36 37 38 39 40 41
//   Row 7 (odd) : IDs 47 46 45 44 43 42  ← 46=START, 47=FINISH are buttons; skip them
//
// For patterns below, "Active" means BARRIER (red). OFF cells form the passage.
// Each row must have at least one OFF cell so a path exists.
// ─────────────────────────────────────────────────────────────────────────────
void AOLGameManager::BuildAllPatterns()
{
    AllPatterns.Empty();
    AllPatterns.SetNum(30); // [0-9] Classic, [10-19] Dynamic, [20-29] Advanced

    // ─── Helper lambdas ───────────────────────────────────────────────────────
    // GridToID already handles S-chain; we expose a short alias for patterns.
    auto G = [](int32 Row, int32 Col) { return AOLGameManager::GridToLaserID(Row, Col); };

    // Build a pattern from an array of (Row, Col) pairs that should be ACTIVE.
    auto MakePattern = [&](int32 Mode, int32 Level, FString Name,
                           TArray<TTuple<int32,int32>> ActiveCells) -> FLaserLevelPattern
    {
        FLaserLevelPattern P;
        P.Mode  = Mode;
        P.Level = Level;
        P.LevelName = Name;
        for (auto& Cell : ActiveCells)
            P.ActiveLaserIDs.Add(G(Cell.Key, Cell.Value));
        return P;
    };

    // ═════════════════════════════════════════════════════════════════════════
    // MODE 1 — CLASSIC  (static, hand-crafted)
    // ═════════════════════════════════════════════════════════════════════════

    // Level 1 — 5 lasers, wide passage on the right side
    AllPatterns[0] = MakePattern(1, 1, TEXT("Classic L1 — Wide passage"),
    {
        {0,0},{0,1},{0,2},   // row 0: cols 3,4,5 free
        {2,0},{2,1}          // row 2: cols 2..5 free
        // rows 1,3,4,5,6,7: all free
    });

    // Level 2 — 6 lasers, small diagonal
    AllPatterns[1] = MakePattern(1, 2, TEXT("Classic L2 — Diagonal"),
    {
        {0,0},{1,1},{2,2},{3,3},   // diagonal (4)
        {4,0},{5,5}                // two extra (2)
    });

    // Level 3 — 7 lasers, simple zigzag
    AllPatterns[2] = MakePattern(1, 3, TEXT("Classic L3 — Zigzag"),
    {
        {0,0},{0,1},
        {1,3},{1,4},
        {2,0},{2,1},
        {3,3}
    });

    // Level 4 — 10 lasers, multiple passages
    AllPatterns[3] = MakePattern(1, 4, TEXT("Classic L4 — Multi-passage"),
    {
        {0,0},{0,1},{0,2},
        {1,3},{1,4},{1,5},
        {2,0},{2,1},
        {3,3},{3,4}
    });

    // Level 5 — 12 lasers, narrow passages
    AllPatterns[4] = MakePattern(1, 5, TEXT("Classic L5 — Narrow"),
    {
        {0,0},{0,1},{0,2},{0,3},
        {1,2},{1,3},{1,4},
        {2,1},{2,2},{2,3},
        {3,0},{3,1}
    });

    // Level 6 — 15 lasers, complex
    AllPatterns[5] = MakePattern(1, 6, TEXT("Classic L6 — Complex"),
    {
        {0,0},{0,1},{0,2},{0,3},
        {1,1},{1,2},{1,3},{1,4},
        {2,2},{2,3},{2,4},
        {3,0},{3,1},{3,2},
        {4,4}
    });

    // Level 7 — 18 lasers, snake path
    AllPatterns[6] = MakePattern(1, 7, TEXT("Classic L7 — Snake"),
    {
        {0,0},{0,1},{0,2},{0,3},{0,4},   // row 0: only col 5 free
        {1,0},{1,1},{1,2},{1,3},         // row 1: cols 4,5 free
        {2,1},{2,2},{2,3},{2,4},         // row 2: cols 0,5 free
        {3,0},{3,2},{3,3},{3,4},{3,5}    // row 3: col 1 free
    });

    // Level 8 — 22 lasers, crossing zones
    AllPatterns[7] = MakePattern(1, 8, TEXT("Classic L8 — Crossing zones"),
    {
        {0,0},{0,1},{0,2},{0,3},{0,4},
        {1,1},{1,2},{1,3},{1,4},{1,5},
        {2,0},{2,1},{2,2},{2,3},{2,4},
        {3,1},{3,2},{3,3},{3,4},
        {4,0},{4,1},{4,4},{4,5}         // row 4: cols 2,3 free
    });

    // Level 9 — 25 lasers, extreme narrow
    AllPatterns[8] = MakePattern(1, 9, TEXT("Classic L9 — Extreme narrow"),
    {
        {0,0},{0,1},{0,2},{0,3},{0,4},   // col 5 free
        {1,0},{1,1},{1,2},{1,3},{1,5},   // col 4 free
        {2,0},{2,1},{2,2},{2,4},{2,5},   // col 3 free
        {3,0},{3,1},{3,3},{3,4},{3,5},   // col 2 free
        {4,0},{4,2},{4,3},{4,4},{4,5},   // col 1 free
        // 25 total — rows 5,6,7 all free for exit
    });

    // Level 10 — 30 lasers, master
    AllPatterns[9] = MakePattern(1, 10, TEXT("Classic L10 — Master"),
    {
        {0,0},{0,1},{0,2},{0,3},{0,4},   // col 5 free
        {1,0},{1,1},{1,2},{1,3},{1,5},   // col 4 free
        {2,0},{2,1},{2,3},{2,4},{2,5},   // col 2 free
        {3,0},{3,2},{3,3},{3,4},{3,5},   // col 1 free
        {4,1},{4,2},{4,3},{4,4},{4,5},   // col 0 free
        {5,0},{5,1},{5,2},{5,3},{5,5},   // col 4 free
        // 30 total
    });

    // ═════════════════════════════════════════════════════════════════════════
    // MODE 2 — DYNAMIC  (base patterns; ChangePattern() re-generates on timer)
    // Same laser counts as Classic but different starting arrangements.
    // ═════════════════════════════════════════════════════════════════════════

    AllPatterns[10] = GenerateRandomPattern(5,  2, 1,  101);
    AllPatterns[11] = GenerateRandomPattern(6,  2, 2,  102);
    AllPatterns[12] = GenerateRandomPattern(7,  2, 3,  103);
    AllPatterns[13] = GenerateRandomPattern(10, 2, 4,  104);
    AllPatterns[14] = GenerateRandomPattern(12, 2, 5,  105);
    AllPatterns[15] = GenerateRandomPattern(15, 2, 6,  106);
    AllPatterns[16] = GenerateRandomPattern(18, 2, 7,  107);
    AllPatterns[17] = GenerateRandomPattern(22, 2, 8,  108);
    AllPatterns[18] = GenerateRandomPattern(25, 2, 9,  109);
    AllPatterns[19] = GenerateRandomPattern(30, 2, 10, 110);

    // ═════════════════════════════════════════════════════════════════════════
    // MODE 3 — ADVANCED / CHAOS (base patterns; ChangePattern() changes faster)
    // ═════════════════════════════════════════════════════════════════════════

    AllPatterns[20] = GenerateRandomPattern(5,  3, 1,  201);
    AllPatterns[21] = GenerateRandomPattern(6,  3, 2,  202);
    AllPatterns[22] = GenerateRandomPattern(7,  3, 3,  203);
    AllPatterns[23] = GenerateRandomPattern(10, 3, 4,  204);
    AllPatterns[24] = GenerateRandomPattern(12, 3, 5,  205);
    AllPatterns[25] = GenerateRandomPattern(15, 3, 6,  206);
    AllPatterns[26] = GenerateRandomPattern(18, 3, 7,  207);
    AllPatterns[27] = GenerateRandomPattern(22, 3, 8,  208);
    AllPatterns[28] = GenerateRandomPattern(25, 3, 9,  209);
    AllPatterns[29] = GenerateRandomPattern(30, 3, 10, 210);

    // Label Dynamic and Advanced entries
    for (int32 i = 0; i < 10; ++i)
    {
        AllPatterns[10 + i].LevelName = FString::Printf(TEXT("Dynamic L%d"), i + 1);
        AllPatterns[20 + i].LevelName = FString::Printf(TEXT("Advanced L%d"), i + 1);
    }
}
