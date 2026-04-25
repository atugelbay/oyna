#include "Games/OLDynamicMode.h"

AOLDynamicMode::AOLDynamicMode()
{
	PrimaryActorTick.bCanEverTick = true;
}

FOLDynamicLevelCfg AOLDynamicMode::BuildLevelConfig(int32 Level)
{
	FOLDynamicLevelCfg Cfg;
	Cfg.Columns.SetNum(8);

	auto Set = [&Cfg](int32 Idx, EOLColumnMode Mode, float Delay)
	{
		Cfg.Columns[Idx].Mode = Mode;
		Cfg.Columns[Idx].StartDelay = Delay;
	};

	switch (Level)
	{
	case 1: // Synchronous wave down
		Cfg.StepInterval = 0.7f;
		for (int32 i = 0; i < 8; i++) Set(i, EOLColumnMode::Down, 0.f);
		break;
	case 2: // Running wave up, 0.4s stagger
		Cfg.StepInterval = 0.7f;
		for (int32 i = 0; i < 8; i++) Set(i, EOLColumnMode::Up, i * 0.4f);
		break;
	case 3: // Pair alternation
		Cfg.StepInterval = 0.7f;
		Set(0, EOLColumnMode::Up,   0.f);
		Set(1, EOLColumnMode::Up,   0.f);
		Set(2, EOLColumnMode::Down, 0.f);
		Set(3, EOLColumnMode::Down, 0.f);
		Set(4, EOLColumnMode::Up,   0.f);
		Set(5, EOLColumnMode::Up,   0.f);
		Set(6, EOLColumnMode::Down, 0.f);
		Set(7, EOLColumnMode::Down, 0.f);
		break;
	case 4: // Left half up, right half down, stagger 0.3s
		Cfg.StepInterval = 0.5f;
		for (int32 i = 0; i < 4; i++) Set(i, EOLColumnMode::Up, i * 0.3f);
		for (int32 i = 0; i < 4; i++) Set(i + 4, EOLColumnMode::Down, i * 0.3f);
		break;
	case 5: // Checkerboard, stagger 0.25s
		Cfg.StepInterval = 0.5f;
		for (int32 i = 0; i < 8; i++)
		{
			Set(i, (i % 2 == 0) ? EOLColumnMode::Up : EOLColumnMode::Down, i * 0.25f);
		}
		break;
	case 6: // Edges to center
		Cfg.StepInterval = 0.5f;
		Set(0, EOLColumnMode::Down, 0.0f);
		Set(1, EOLColumnMode::Down, 0.4f);
		Set(2, EOLColumnMode::Down, 0.8f);
		Set(3, EOLColumnMode::Down, 1.2f);
		Set(4, EOLColumnMode::Up,   1.2f);
		Set(5, EOLColumnMode::Up,   0.8f);
		Set(6, EOLColumnMode::Up,   0.4f);
		Set(7, EOLColumnMode::Up,   0.0f);
		break;
	case 7: // Pseudo-random fixed
		Cfg.StepInterval = 0.4f;
		Set(0, EOLColumnMode::Down, 0.0f);
		Set(1, EOLColumnMode::Up,   0.3f);
		Set(2, EOLColumnMode::Up,   0.0f);
		Set(3, EOLColumnMode::Down, 0.4f);
		Set(4, EOLColumnMode::Up,   0.2f);
		Set(5, EOLColumnMode::Down, 0.6f);
		Set(6, EOLColumnMode::Down, 0.1f);
		Set(7, EOLColumnMode::Up,   0.5f);
		break;
	case 8: // Chaos intervals
		Cfg.StepInterval = 0.35f;
		Set(0, EOLColumnMode::Up,   0.00f);
		Set(1, EOLColumnMode::Down, 0.45f);
		Set(2, EOLColumnMode::Down, 0.15f);
		Set(3, EOLColumnMode::Up,   0.60f);
		Set(4, EOLColumnMode::Down, 0.30f);
		Set(5, EOLColumnMode::Up,   0.10f);
		Set(6, EOLColumnMode::Up,   0.55f);
		Set(7, EOLColumnMode::Down, 0.35f);
		break;
	case 9: // Doubles in half (alternating both/single)
		Cfg.StepInterval = 0.35f;
		Set(0, EOLColumnMode::Both, 0.00f);
		Set(1, EOLColumnMode::Up,   0.30f);
		Set(2, EOLColumnMode::Both, 0.10f);
		Set(3, EOLColumnMode::Down, 0.40f);
		Set(4, EOLColumnMode::Both, 0.20f);
		Set(5, EOLColumnMode::Up,   0.50f);
		Set(6, EOLColumnMode::Both, 0.30f);
		Set(7, EOLColumnMode::Down, 0.15f);
		break;
	case 10: // Final chaos — all doubles
		Cfg.StepInterval = 0.3f;
		Set(0, EOLColumnMode::Both, 0.00f);
		Set(1, EOLColumnMode::Both, 0.20f);
		Set(2, EOLColumnMode::Both, 0.10f);
		Set(3, EOLColumnMode::Both, 0.35f);
		Set(4, EOLColumnMode::Both, 0.05f);
		Set(5, EOLColumnMode::Both, 0.25f);
		Set(6, EOLColumnMode::Both, 0.15f);
		Set(7, EOLColumnMode::Both, 0.30f);
		break;
	default:
		Cfg.StepInterval = 0.7f;
		for (int32 i = 0; i < 8; i++) Set(i, EOLColumnMode::Down, 0.f);
		break;
	}

	return Cfg;
}

void AOLDynamicMode::StartLevel(int32 Level)
{
	CurrentLevel  = FMath::Clamp(Level, 1, 10);
	Lives         = 3;
	TimeRemaining = LevelDuration;
	State         = EDynamicState::WaitingStart;
	ActiveLaserSet.Empty();

	CurrentConfig = BuildLevelConfig(CurrentLevel);

	UE_LOG(LogTemp, Warning, TEXT("[DynamicMode] Level %d ARMED: StepInterval=%.2fs, waiting for START"),
		CurrentLevel, CurrentConfig.StepInterval);
}

void AOLDynamicMode::OnStartPressed()
{
	if (State != EDynamicState::WaitingStart) return;
	State = EDynamicState::Playing;
	UE_LOG(LogTemp, Warning, TEXT("[DynamicMode] START pressed — activating animation"));
	OnLasersReady.Broadcast(CurrentConfig);
}

void AOLDynamicMode::StopGame()
{
	State = EDynamicState::Idle;
	ActiveLaserSet.Empty();
}

void AOLDynamicMode::OnGame01StepChanged(const TArray<int32>& CurrentlyOnLaserIDs)
{
	ActiveLaserSet.Empty();
	for (int32 ID : CurrentlyOnLaserIDs)
		ActiveLaserSet.Add(ID);
}

void AOLDynamicMode::OnLaserTriggered(int32 LaserID)
{
	if (State != EDynamicState::Playing) return;
	if (!ActiveLaserSet.Contains(LaserID)) return;

	Lives--;
	UE_LOG(LogTemp, Warning, TEXT("[DynamicMode] Life lost! Laser %d. Lives: %d"), LaserID, Lives);
	OnLifeLost.Broadcast(Lives, LaserID);

	if (Lives <= 0)
	{
		State = EDynamicState::LevelEnded;
		UE_LOG(LogTemp, Warning, TEXT("[DynamicMode] GAME OVER at level %d"), CurrentLevel);
		OnGameOver.Broadcast();
	}
}

void AOLDynamicMode::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
	if (State != EDynamicState::Playing) return;

	TimeRemaining -= DeltaTime;
	if (TimeRemaining <= 0.f)
	{
		TimeRemaining = 0.f;
		State = EDynamicState::LevelEnded;
		UE_LOG(LogTemp, Warning, TEXT("[DynamicMode] TIME'S UP at level %d"), CurrentLevel);
		OnGameOver.Broadcast();
	}
}

void AOLDynamicMode::CompleteLevel()
{
	if (State != EDynamicState::Playing) return;
	State = EDynamicState::LevelEnded;
	Score += Lives * 500 + FMath::FloorToInt(TimeRemaining) * 10;
	UE_LOG(LogTemp, Warning, TEXT("[DynamicMode] Level %d COMPLETE! Lives=%d, TimeLeft=%.0f, Score=%d"),
		CurrentLevel, Lives, TimeRemaining, Score);
	OnLevelComplete.Broadcast();
}

void AOLDynamicMode::SetLives(int32 NewLives)
{
	Lives = FMath::Max(0, NewLives);
}
