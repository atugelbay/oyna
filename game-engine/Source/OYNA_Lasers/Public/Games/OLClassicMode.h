#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Types/Types.h"
#include "OLClassicMode.generated.h"

DECLARE_MULTICAST_DELEGATE_OneParam(FOnClassicLasersReady, const TArray<int32>& LaserIDs);
DECLARE_MULTICAST_DELEGATE(FOnClassicLevelComplete);
DECLARE_MULTICAST_DELEGATE(FOnClassicGameOver);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnClassicLifeLost, int32 LivesRemaining, int32 LaserID);

enum class EClassicState : uint8
{
    Idle,           // no game running
    WaitingStart,   // pattern generated, waiting for START button
    Playing,        // lasers ON, timer running
    LevelEnded      // END pressed, score shown
};

UCLASS()
class OYNA_LASERS_API AOLClassicMode : public AActor
{
    GENERATED_BODY()
public:
    AOLClassicMode();

    void StartLevel(int32 Level);
    void StopGame();
    void OnLaserTriggered(int32 LaserID);
    void CompleteLevel();

    // Called when physical START pressed — activates lasers
    void OnStartPressed();
    EClassicState GetState() const { return State; }

    // Sets the timer for the current level (if running) and the default for future levels
    void SetLevelDuration(float Seconds);
    float GetLevelDuration() const { return LevelDuration; }

    // Directly set lives on the running level (for testing/balancing)
    void SetLives(int32 NewLives);

    bool IsPlaying() const { return State == EClassicState::Playing; }

    FOnClassicLasersReady   OnLasersReady;
    FOnClassicLevelComplete OnLevelComplete;
    FOnClassicGameOver      OnGameOver;
    FOnClassicLifeLost      OnLifeLost;

    int32               GetCurrentLevel()    const { return CurrentLevel; }
    int32               GetLives()           const { return Lives; }
    float               GetTimeRemaining()   const { return TimeRemaining; }
    int32               GetScore()           const { return Score; }
    const TArray<int32>& GetActiveLasers()   const { return ActiveLasers; }

protected:
    virtual void Tick(float DeltaTime) override;

private:
    // Level config: how many lasers per level (levels 1-10)
    static constexpr int32 LevelLaserCount[10] = {8, 10, 12, 14, 16, 18, 20, 22, 24, 26};

    // Grid constants
    static constexpr int32 NUM_COLS     = 8;
    static constexpr int32 NUM_ROWS     = 6;
    static constexpr int32 TOTAL_LASERS = 48;

    // Generate random pattern guaranteed to have a passable path
    TArray<int32> GeneratePattern(int32 Count);
    bool HasPath(const TSet<int32>& BlockedCells);
    int32 GridIndex(int32 Col, int32 Row) const { return Col * NUM_ROWS + Row; }

    // Convert grid position to physical laser ID (1-based, S-shaped)
    static int32 GridToLaserID(int32 Col, int32 Row);
    // Convert physical laser ID back to grid position
    static bool LaserIDToGrid(int32 LaserID, int32& OutCol, int32& OutRow);

    TArray<int32> ActiveLasers;    // 1-based physical IDs of active lasers
    TSet<int32>   ActiveGridCells; // grid indices of active lasers

    int32 CurrentLevel  = 0;
    int32 Lives         = 3;
    float LevelDuration = 90.f;
    float TimeRemaining = 90.f;
    int32 Score         = 0;
    bool  bPlaying      = false;
    EClassicState State = EClassicState::Idle;
};
