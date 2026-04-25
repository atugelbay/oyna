#include "Games/OLGame01.h"

// Get all 6 software IDs for a column (0-based column index), 1-based laser IDs
static TArray<int32> GetColumnIDs(int32 ColIndex)
{
    TArray<int32> IDs;
    for (int32 i = 0; i < 6; i++)
        IDs.Add(ColIndex * 6 + i + 1);  // +1 for 1-based
    return IDs;
}

// Get all 8 software IDs for a horizontal row (0=top, 5=bottom), 1-based laser IDs
// S-shaped wiring: even columns go top→bottom, odd columns go bottom→top
static TArray<int32> GetRowIDs(int32 RowIndex)
{
    TArray<int32> IDs;
    for (int32 Col = 0; Col < 8; Col++)
    {
        if (Col % 2 == 0)
            IDs.Add(Col * 6 + (5 - RowIndex) + 1);  // +1 for 1-based
        else
            IDs.Add(Col * 6 + RowIndex + 1);          // +1 for 1-based
    }
    return IDs;
}

// Get ONE laser ID at grid position (row, col), 1-based (chain subtracts 1 internally)
// row: 0=bottom, 5=top. col: 0-7 left to right
// S-shaped: even cols (0,2,4,6) go bottom→top, odd cols (1,3,5,7) go top→bottom
static int32 GetLaserID(int32 Row, int32 Col)
{
    if (Col % 2 == 0)
        return Col * 6 + Row + 1;
    else
        return Col * 6 + (5 - Row) + 1;
}

AOLGame01::AOLGame01()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AOLGame01::BeginPlay()
{
    Super::BeginPlay();
}

TArray<int32> AOLGame01::GetStepIDs(int32 Step) const
{
    TArray<int32> IDs;

    switch (Direction)
    {
    case EOLDirection::Right:
        // One laser per selected row, sweeping columns left→right
        for (int32 Row : Rows)
        {
            int32 RowIdx = FMath::Clamp(Row - 1, 0, 5);
            IDs.Add(GetLaserID(RowIdx, Step));
        }
        break;

    case EOLDirection::Left:
        // One laser per selected row, sweeping columns right→left
        for (int32 Row : Rows)
        {
            int32 RowIdx = FMath::Clamp(Row - 1, 0, 5);
            IDs.Add(GetLaserID(RowIdx, 7 - Step));  // reverse column order
        }
        break;

    case EOLDirection::Down:
        // One laser per selected column, sweeping rows top→bottom
        for (int32 Col : Rows)
        {
            int32 ColIdx = FMath::Clamp(Col - 1, 0, 7);
            IDs.Add(GetLaserID(5 - Step, ColIdx));  // row 5=top, counting down
        }
        break;

    case EOLDirection::Up:
        // One laser per selected column, sweeping rows bottom→top
        for (int32 Col : Rows)
        {
            int32 ColIdx = FMath::Clamp(Col - 1, 0, 7);
            IDs.Add(GetLaserID(Step, ColIdx));  // row 0=bottom, counting up
        }
        break;
    }

    return IDs;
}

void AOLGame01::StartGame(TArray<int32> InRows, float InTime, EOLDirection InDirection)
{
    Rows         = InRows;
    TimeInterval = InTime;
    Direction    = InDirection;

    // Determine NumSteps based on direction
    if (Direction == EOLDirection::Right || Direction == EOLDirection::Left)
        NumSteps = 8;  // 8 columns
    else
        NumSteps = 6;  // 6 rows

    CurrentStep  = 0;
    CurrentTime  = 0.f;
    bStartedGame = true;

    if (Rows.Num() == 0) return;

    // Fire initial position immediately
    TArray<int32> ActiveIDs = GetStepIDs(CurrentStep);
    OnLEDStateChange.Broadcast(ActiveIDs, EOLLEDState::On);

    UE_LOG(LogTemp, Warning, TEXT("[OLGame01] StartGame: Rows=%d, NumSteps=%d, Direction=%d"), Rows.Num(), NumSteps, (int32)Direction);
}

void AOLGame01::StopGame()
{
    bStartedGame = false;
    CurrentStep  = 0;
    CurrentTime  = 0.f;
}

void AOLGame01::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    if (!bStartedGame) return;

    // Fallback: old row/column sweep when no per-column config is set.
    if (ColumnConfigs.Num() == 0)
    {
        if (Rows.Num() == 0) return;

        CurrentTime += DeltaTime;
        if (CurrentTime < TimeInterval) return;
        CurrentTime = 0.f;

        CurrentStep = (CurrentStep + 1) % NumSteps;

        if (CurrentStep == 0)
            UE_LOG(LogTemp, Warning, TEXT("[OLGame01] Full cycle complete"));

        // Off is handled by Game01LedStateChange via SetAllLEDs(Off)
        TArray<int32> NewIDs = GetStepIDs(CurrentStep);
        OnLEDStateChange.Broadcast(NewIDs, EOLLEDState::On);

        UE_LOG(LogTemp, Warning, TEXT("[OLGame01] Step %d/%d, %d lasers, Direction=%d"), CurrentStep, NumSteps, NewIDs.Num(), (int32)Direction);
        return;
    }

    // Per-column animation path.
    ElapsedTime   += DeltaTime;
    StepAccumulator += DeltaTime;

    if (StepAccumulator < StepInterval) return;
    StepAccumulator = 0.f;

    if (ColStates.Num() != 8)
        ColStates.SetNum(8);

    TArray<int32> CurrentLasers;

    for (int32 ColIdx = 0; ColIdx < 8; ColIdx++)
    {
        if (!ColumnConfigs.IsValidIndex(ColIdx)) continue;
        const FOLColumnConfig& Cfg = ColumnConfigs[ColIdx];

        if (ElapsedTime < Cfg.StartDelay) continue;
        if (Cfg.Mode == EOLColumnMode::Off) continue;

        FColState& State = ColStates[ColIdx];
        if (!State.bInitialized)
        {
            // Row convention: 0 = bottom, 5 = top.
            if (Cfg.Mode == EOLColumnMode::Up)   { State.PosUp   = 0; }
            if (Cfg.Mode == EOLColumnMode::Down) { State.PosDown = 5; }
            if (Cfg.Mode == EOLColumnMode::Both) { State.PosUp   = 0; State.PosDown = 5; }
            State.bInitialized = true;
        }

        if (Cfg.Mode == EOLColumnMode::Up || Cfg.Mode == EOLColumnMode::Both)
        {
            CurrentLasers.Add(GetLaserID(State.PosUp, ColIdx));
            State.PosUp++;
            if (State.PosUp > 5) State.PosUp = 0;   // respawn at bottom
        }
        if (Cfg.Mode == EOLColumnMode::Down || Cfg.Mode == EOLColumnMode::Both)
        {
            CurrentLasers.Add(GetLaserID(State.PosDown, ColIdx));
            State.PosDown--;
            if (State.PosDown < 0) State.PosDown = 5; // respawn at top
        }
    }

    if (OnStepChanged.IsBound())
        OnStepChanged.Broadcast(CurrentLasers);

    // Drive hardware through the existing LED state path (Off handled by OLMain).
    OnLEDStateChange.Broadcast(CurrentLasers, EOLLEDState::On);
}
