#include "Games/OLClassicMode.h"

AOLClassicMode::AOLClassicMode()
{
    PrimaryActorTick.bCanEverTick = true;
}

int32 AOLClassicMode::GridToLaserID(int32 Col, int32 Row)
{
    // Same S-shaped formula as OLGame01
    if (Col % 2 == 0)
        return Col * 6 + Row + 1;
    else
        return Col * 6 + (5 - Row) + 1;
}

bool AOLClassicMode::LaserIDToGrid(int32 LaserID, int32& OutCol, int32& OutRow)
{
    if (LaserID < 1 || LaserID > 48) return false;
    int32 ZeroBased = LaserID - 1;
    OutCol = ZeroBased / 6;
    int32 PosInCol = ZeroBased % 6;
    if (OutCol % 2 == 0)
        OutRow = PosInCol;      // even col: bottom to top
    else
        OutRow = 5 - PosInCol;  // odd col: top to bottom
    return true;
}

bool AOLClassicMode::HasPath(const TSet<int32>& BlockedCells)
{
    // BFS from any open cell in Col 0 to any cell in Col 7
    // 8-directional movement (player can step diagonally)
    TSet<int32>   Visited;
    TArray<int32> Queue;

    // Seed from all open cells in column 0
    for (int32 Row = 0; Row < NUM_ROWS; Row++)
    {
        int32 Idx = GridIndex(0, Row);
        if (!BlockedCells.Contains(Idx))
        {
            Queue.Add(Idx);
            Visited.Add(Idx);
        }
    }

    while (Queue.Num() > 0)
    {
        int32 Current = Queue[0];
        Queue.RemoveAt(0);

        int32 CurCol = Current / NUM_ROWS;
        int32 CurRow = Current % NUM_ROWS;

        // Reached the last column — path exists
        if (CurCol == NUM_COLS - 1)
            return true;

        // Expand all 8 neighbours
        static const int32 DCol[] = {-1, -1, -1, 0, 0, 1, 1, 1};
        static const int32 DRow[] = {-1,  0,  1,-1, 1,-1, 0, 1};

        for (int32 i = 0; i < 8; i++)
        {
            int32 NC = CurCol + DCol[i];
            int32 NR = CurRow + DRow[i];
            if (NC < 0 || NC >= NUM_COLS || NR < 0 || NR >= NUM_ROWS) continue;

            int32 NIdx = GridIndex(NC, NR);
            if (Visited.Contains(NIdx) || BlockedCells.Contains(NIdx)) continue;

            Visited.Add(NIdx);
            Queue.Add(NIdx);
        }
    }

    return false;
}

TArray<int32> AOLClassicMode::GeneratePattern(int32 Count)
{
    TArray<int32> Result;
    TSet<int32>   Blocked;
    int32         Attempts = 0;

    while (Result.Num() < Count && Attempts < 1000)
    {
        Attempts++;
        int32 Col = FMath::RandRange(0, NUM_COLS - 1);
        int32 Row = FMath::RandRange(0, NUM_ROWS - 1);
        int32 Idx = GridIndex(Col, Row);

        if (Blocked.Contains(Idx)) continue;

        // Tentatively place this laser
        Blocked.Add(Idx);

        if (HasPath(Blocked))
        {
            // Path still exists — keep it
            Result.Add(GridToLaserID(Col, Row));
        }
        else
        {
            // Would block the only path — discard
            Blocked.Remove(Idx);
        }
    }

    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] Generated %d lasers in %d attempts"), Result.Num(), Attempts);
    return Result;
}

void AOLClassicMode::StartLevel(int32 Level)
{
    CurrentLevel  = FMath::Clamp(Level, 1, 10);
    Lives         = 3;
    TimeRemaining = LevelDuration;
    State         = EClassicState::WaitingStart;
    bPlaying      = false;  // timer paused until START pressed

    int32 Count = LevelLaserCount[CurrentLevel - 1];
    ActiveLasers = GeneratePattern(Count);

    // Build grid lookup for fast trigger checking
    ActiveGridCells.Empty();
    for (int32 LaserID : ActiveLasers)
    {
        int32 Col, Row;
        if (LaserIDToGrid(LaserID, Col, Row))
            ActiveGridCells.Add(GridIndex(Col, Row));
    }

    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] Level %d ARMED: %d lasers, waiting for START button"), CurrentLevel, ActiveLasers.Num());
    // Don't broadcast OnLasersReady yet — wait for OnStartPressed()
}

void AOLClassicMode::OnStartPressed()
{
    if (State != EClassicState::WaitingStart) return;

    State = EClassicState::Playing;
    bPlaying = true;

    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] START pressed — activating %d lasers"), ActiveLasers.Num());
    OnLasersReady.Broadcast(ActiveLasers);
}

void AOLClassicMode::StopGame()
{
    bPlaying = false;
    State = EClassicState::Idle;
    ActiveLasers.Empty();
    ActiveGridCells.Empty();
    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] Game stopped"));
}

void AOLClassicMode::OnLaserTriggered(int32 LaserID)
{
    if (State != EClassicState::Playing) return;

    // Only react if this laser is part of the active pattern
    if (!ActiveLasers.Contains(LaserID)) return;

    Lives--;
    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] Life lost! Laser %d. Lives remaining: %d"), LaserID, Lives);

    OnLifeLost.Broadcast(Lives, LaserID);

    if (Lives <= 0)
    {
        bPlaying = false;
        State = EClassicState::LevelEnded;
        UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] GAME OVER at level %d"), CurrentLevel);
        OnGameOver.Broadcast();
    }
}

void AOLClassicMode::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    if (State != EClassicState::Playing) return;

    TimeRemaining -= DeltaTime;

    if (TimeRemaining <= 0.f)
    {
        TimeRemaining = 0.f;
        bPlaying      = false;
        State         = EClassicState::LevelEnded;

        // Time ran out = failed, not a clean level complete
        UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] TIME'S UP at level %d"), CurrentLevel);
        OnGameOver.Broadcast();
    }
}

void AOLClassicMode::SetLevelDuration(float Seconds)
{
    LevelDuration = FMath::Max(1.f, Seconds);
    if (bPlaying)
        TimeRemaining = LevelDuration;
    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] LevelDuration set to %.1fs (applied to current level: %s)"),
        LevelDuration, bPlaying ? TEXT("yes") : TEXT("no"));
}

void AOLClassicMode::SetLives(int32 NewLives)
{
    Lives = FMath::Max(0, NewLives);
    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] Lives set to %d"), Lives);
}

void AOLClassicMode::CompleteLevel()
{
    if (State != EClassicState::Playing) return;

    bPlaying = false;
    State = EClassicState::LevelEnded;
    Score += Lives * 500 + FMath::FloorToInt(TimeRemaining) * 10;

    UE_LOG(LogTemp, Warning, TEXT("[ClassicMode] Level %d COMPLETE! Lives=%d, TimeLeft=%.0f, Score=%d"),
        CurrentLevel, Lives, TimeRemaining, Score);

    OnLevelComplete.Broadcast();
}
