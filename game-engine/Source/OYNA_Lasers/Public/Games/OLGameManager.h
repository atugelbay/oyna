#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "OLGameManager.generated.h"

// Forward declarations
class AOLMain;

// ─────────────────────────────────────────────────────────────────────────────
// Game state enum
// ─────────────────────────────────────────────────────────────────────────────
UENUM(BlueprintType)
enum class EGameState : uint8
{
    Idle           UMETA(DisplayName = "Idle"),
    Countdown      UMETA(DisplayName = "Countdown"),
    Playing        UMETA(DisplayName = "Playing"),
    LevelComplete  UMETA(DisplayName = "LevelComplete"),
    GameOver       UMETA(DisplayName = "GameOver")
};

// ─────────────────────────────────────────────────────────────────────────────
// Laser pattern for one level
// ─────────────────────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FLaserLevelPattern
{
    GENERATED_BODY()

    // Laser IDs that are ON (barriers). Lasers NOT in this list are the passage.
    UPROPERTY(BlueprintReadOnly)
    TArray<int32> ActiveLaserIDs;

    UPROPERTY(BlueprintReadOnly)
    FString LevelName;

    // 1 = Classic, 2 = Dynamic, 3 = Advanced
    UPROPERTY(BlueprintReadOnly)
    int32 Mode = 1;

    // 1-10
    UPROPERTY(BlueprintReadOnly)
    int32 Level = 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// Delegates for UI binding
// ─────────────────────────────────────────────────────────────────────────────
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLivesChanged,      int32,       NewLives);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTimeChanged,       float,       NewTime);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnLevelChanged,      int32,       NewLevel);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnModeChanged,       int32,       NewMode);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnGameStateChanged,  EGameState,  NewState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnLifeLost);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnLevelWon);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnGameOverEvent);

// ─────────────────────────────────────────────────────────────────────────────
// AOLGameManager
// ─────────────────────────────────────────────────────────────────────────────
UCLASS()
class OYNA_LASERS_API AOLGameManager : public AActor
{
    GENERATED_BODY()

public:
    AOLGameManager();

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;

    // ── Public API ────────────────────────────────────────────────────────────

    /** Start the game in a given mode (1-3) from a starting level (1-10). */
    UFUNCTION(BlueprintCallable, Category = "LaserGame")
    void StartGame(int32 Mode, int32 StartLevel = 1);

    /** Stop / abort whatever is running and return to Idle. */
    UFUNCTION(BlueprintCallable, Category = "LaserGame")
    void StopGame();

    /** Manually advance to the next level (debug / external call). */
    UFUNCTION(BlueprintCallable, Category = "LaserGame")
    void NextLevel();

    /**
     * Entry point for every laser / button event.
     * Called from AOLMain::HandleButton every time a laser state changes.
     *   LaserID 46 = START button
     *   LaserID 47 = FINISH button
     */
    UFUNCTION(BlueprintCallable, Category = "LaserGame")
    void OnLaserTriggered(int32 LaserID);

    // ── Delegates ─────────────────────────────────────────────────────────────

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnLivesChanged OnLivesChanged;

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnTimeChanged OnTimeChanged;

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnLevelChanged OnLevelChanged;

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnModeChanged OnModeChanged;

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnGameStateChanged OnGameStateChanged;

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnLifeLost OnLifeLost;

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnLevelWon OnLevelWon;

    UPROPERTY(BlueprintAssignable, Category = "LaserGame|Events")
    FOnGameOverEvent OnGameOverEvent;

    // ── Read-only state for UI ─────────────────────────────────────────────────

    UPROPERTY(BlueprintReadOnly, Category = "LaserGame")
    int32 CurrentLives = 3;

    UPROPERTY(BlueprintReadOnly, Category = "LaserGame")
    int32 CurrentLevel = 1;

    UPROPERTY(BlueprintReadOnly, Category = "LaserGame")
    int32 CurrentMode = 1;

    UPROPERTY(BlueprintReadOnly, Category = "LaserGame")
    float TimeRemaining = 90.0f;

    UPROPERTY(BlueprintReadOnly, Category = "LaserGame")
    EGameState GameState = EGameState::Idle;

    // ── Editable defaults ─────────────────────────────────────────────────────

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LaserGame|Config")
    float LevelDuration = 90.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LaserGame|Config")
    int32 MaxLives = 3;

    /** Minimum seconds between registering the same laser as a hit (anti-debounce). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LaserGame|Config")
    float DebounceTime = 0.5f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LaserGame|Config")
    float WarningTimeThreshold = 10.0f;

    /** Reference to the main actor that owns the serial / LED hardware. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "LaserGame|Config")
    AOLMain* MainActor = nullptr;

    // ── Laser constants ────────────────────────────────────────────────────────
    static constexpr int32 LASER_START  = 46;
    static constexpr int32 LASER_FINISH = 47;
    static constexpr int32 TOTAL_LASERS = 48;
    static constexpr int32 GRID_COLS    = 6;
    static constexpr int32 GRID_ROWS    = 8;

    // ── Color constants ────────────────────────────────────────────────────────
    static constexpr uint32 COLOR_OFF    = 0;
    static constexpr uint32 COLOR_RED    = (127u << 17);
    static constexpr uint32 COLOR_GREEN  = (127u <<  9);
    static constexpr uint32 COLOR_BLUE   = (127u <<  1);
    static constexpr uint32 COLOR_WHITE  = (127u << 17) | (127u <<  9) | (127u <<  1);
    static constexpr uint32 COLOR_YELLOW = (127u << 17) | (127u <<  9);
    static constexpr uint32 COLOR_PURPLE = (127u << 17) | (127u <<  1);

private:
    // ── Level management ──────────────────────────────────────────────────────
    void LoadLevel(int32 Mode, int32 Level);
    void ApplyPattern(const FLaserLevelPattern& Pattern);
    void SetGameState(EGameState NewState);

    // ── Countdown ─────────────────────────────────────────────────────────────
    void StartCountdown();
    void OnCountdownTick();
    int32 CountdownStep = 3;         // 3, 2, 1 → go
    FTimerHandle CountdownTimer;

    // ── Life / level outcome ──────────────────────────────────────────────────
    void LoseLife();
    void WinLevel();
    void FailLevel();

    // ── Dynamic / Advanced pattern changes ───────────────────────────────────
    void ChangePattern();
    void ScheduleNextPatternChange();
    FTimerHandle PatternChangeTimer;
    float GetPatternChangeInterval() const;   // seconds between changes

    // ── Visual feedback helpers ───────────────────────────────────────────────
    void FlashAll(uint32 Color, int32 Times, float Interval, TFunction<void()> OnComplete = nullptr);
    void UpdateWarningFlash();            // yellow blink for last 10 s
    void ApplyCurrentPattern();           // (re-)apply red/off to hardware

    FTimerHandle FlashTimer;
    int32  FlashRemaining  = 0;
    bool   FlashState      = false;
    uint32 FlashColor      = COLOR_WHITE;
    TFunction<void()> FlashCompleteCallback;

    FTimerHandle WarningFlashTimer;
    bool bWarningFlashState = false;
    bool bWarningActive     = false;

    // ── Timer helpers ─────────────────────────────────────────────────────────
    void ClearAllTimers();

    // ── Debounce ──────────────────────────────────────────────────────────────
    TMap<int32, float> LastTriggerTime;   // LaserID → game time of last trigger

    // ── Pattern data ──────────────────────────────────────────────────────────
    FLaserLevelPattern CurrentPattern;
    TArray<FLaserLevelPattern> AllPatterns;   // indexed [Mode-1][Level-1], stored flat
    void BuildAllPatterns();

    // ── Random pattern generator ──────────────────────────────────────────────
    /** Generates a random valid pattern ensuring at least one free cell per row. */
    FLaserLevelPattern GenerateRandomPattern(int32 NumActiveLasers, int32 Mode, int32 Level, int32 Seed = -1);

    /** Returns the flat LaserID for a grid position, respecting the S-chain wiring. */
    static int32 GridToLaserID(int32 Row, int32 Col);

    /** Checks whether any path from row 0 to row 7 exists through the off-cells. */
    static bool HasValidPath(const TSet<int32>& ActiveSet);

    // ── LED helper via AOLMain ────────────────────────────────────────────────
    void SetAllLEDs(uint32 Color);
    void SetOneLED(int32 LaserID, uint32 Color);
};
