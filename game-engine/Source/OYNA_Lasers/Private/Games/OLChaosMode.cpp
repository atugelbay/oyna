#include "Games/OLChaosMode.h"

AOLChaosMode::AOLChaosMode() { PrimaryActorTick.bCanEverTick = true; }

static int32 RandCell(const TSet<int32>& Used)
{
	int32 Cell;
	int32 Attempts = 0;
	do { Cell = FMath::RandRange(0, 47); } while (Used.Contains(Cell) && ++Attempts < 200);
	return Cell;
}

// Row 0=top in cell grid, GetLaserID uses Row 0=bottom — flip before mapping.
// S-shaped: Even col: Col*6+Row+1, Odd col: Col*6+(5-Row)+1
static int32 CellToLaserID(int32 CellIdx)
{
	int32 Row = CellIdx / 8;
	int32 Col = CellIdx % 8;
	int32 FlippedRow = 5 - Row;
	if (Col % 2 == 0)
		return Col * 6 + FlippedRow + 1;
	else
		return Col * 6 + (5 - FlippedRow) + 1;
}

FOLChaosLevelCfg AOLChaosMode::BuildLevelConfig(int32 Level)
{
	FOLChaosLevelCfg C;
	switch (Level)
	{
	case 1: // Mission Impossible — simple start
		C.NumStatic=6; C.NumMoving=2;
		C.MoveDirs={EOLColumnMode::Down, EOLColumnMode::Down};
		C.MoveSpeed=0.8f;
		C.IntroType=0;
		break;
	case 2: // Battle Without Honor — expanding
		C.NumStatic=6; C.NumMoving=2;
		C.MoveDirs={EOLColumnMode::Up, EOLColumnMode::Up};
		C.MoveSpeed=0.8f;
		C.ExpandEvery=8.f; C.ExpandCount=2;
		C.IntroType=1;
		break;
	case 3: // Linkin Park — first swap
		C.NumStatic=6; C.NumMoving=3;
		C.MoveDirs={EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up};
		C.MoveSpeed=0.6f;
		C.SwapEvery=12.f;
		C.IntroType=2;
		break;
	case 4: // AUTOMOTIVO — 4 columns, pure movement
		C.NumStatic=4; C.NumMoving=4;
		C.MoveDirs={EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down};
		C.MoveSpeed=0.5f;
		C.IntroType=3;
		break;
	case 5: // Skrillex — blackout drops
		C.NumStatic=6; C.NumMoving=3;
		C.MoveDirs={EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down};
		C.MoveSpeed=0.5f;
		C.BlackoutEvery=8.f; C.BlackoutDuration=1.f;
		C.IntroType=4;
		break;
	case 6: // Like Wooh Wooh — swap + expand
		C.NumStatic=4; C.NumMoving=4;
		C.MoveDirs={EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Down, EOLColumnMode::Up};
		C.MoveSpeed=0.5f;
		C.SwapEvery=10.f;
		C.ExpandEvery=10.f; C.ExpandCount=2;
		C.IntroType=5;
		break;
	case 7: // Gesaffelstein — 6 columns + blackout
		C.NumStatic=4; C.NumMoving=6;
		C.MoveDirs={EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down};
		C.MoveSpeed=0.4f;
		C.BlackoutEvery=10.f; C.BlackoutDuration=1.f;
		C.IntroType=6;
		break;
	case 8: // Pump It — 6 columns + swap + expand
		C.NumStatic=4; C.NumMoving=6;
		C.MoveDirs={EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up};
		C.MoveSpeed=0.4f;
		C.SwapEvery=8.f;
		C.ExpandEvery=10.f; C.ExpandCount=2;
		C.IntroType=7;
		break;
	case 9: // Rammstein — all 8 columns + swap + blackout
		C.NumStatic=4; C.NumMoving=8;
		C.MoveDirs={EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down, EOLColumnMode::Up, EOLColumnMode::Down};
		C.MoveSpeed=0.35f;
		C.SwapEvery=10.f;
		C.BlackoutEvery=12.f; C.BlackoutDuration=1.f;
		C.IntroType=8;
		break;
	case 10: // BOUNTYHUNTER — all 8 Both + swap + blackout + expand
		C.NumStatic=2; C.NumMoving=8;
		C.MoveDirs={EOLColumnMode::Both, EOLColumnMode::Both, EOLColumnMode::Both, EOLColumnMode::Both,
		             EOLColumnMode::Both, EOLColumnMode::Both, EOLColumnMode::Both, EOLColumnMode::Both};
		C.MoveSpeed=0.3f;
		C.SwapEvery=6.f;
		C.BlackoutEvery=8.f; C.BlackoutDuration=1.f;
		C.ExpandEvery=8.f; C.ExpandCount=2;
		C.IntroType=9;
		break;
	default:
		C.NumStatic=6; C.NumMoving=2;
		C.MoveDirs={EOLColumnMode::Down, EOLColumnMode::Down};
		C.MoveSpeed=0.8f; C.IntroType=0;
		break;
	}
	return C;
}

void AOLChaosMode::RegeneratePattern()
{
	PrevActiveLasers.Empty();
	TSet<int32> Used;
	StaticLasers.Empty();
	int32 TotalStatic = FMath::Min(CurrentConfig.NumStatic + ExtraStaticCount, 20);
	for (int32 i = 0; i < TotalStatic; i++)
	{
		int32 Cell = RandCell(Used);
		StaticLasers.Add(Cell);
		Used.Add(Cell);
	}
}

TArray<int32> AOLChaosMode::GetAllActiveLasers() const
{
	TSet<int32> ActiveSet;
	for (int32 Cell : StaticLasers)
		ActiveSet.Add(CellToLaserID(Cell));
	for (int32 ID : MovingLaserIDs)
		ActiveSet.Add(ID);
	return ActiveSet.Array();
}

void AOLChaosMode::StartLevel(int32 Level)
{
	CurrentLevel = FMath::Clamp(Level, 1, 10);
	Lives = 3;
	TimeRemaining = LevelDuration;
	Score = 0;
	ExtraStaticCount = 0;
	MovingLaserIDs.Empty();
	SwapTimer = BlackoutTimer = ExpandTimer = 0.f;
	bBlackoutActive = false;
	bSwapWarning = false;
	SwapWarningStart = 0.f;
	IntroTimer = 0.f;

	CurrentConfig = BuildLevelConfig(CurrentLevel);
	PrevActiveLasers.Empty();
	RegeneratePattern();

	State = EChaosState::WaitingStart;
	UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] Level %d ARMED: %dS+%dM, Swap=%.0fs, BO=%.0fs, Exp=%.0fs"),
		CurrentLevel, CurrentConfig.NumStatic, CurrentConfig.NumMoving,
		CurrentConfig.SwapEvery, CurrentConfig.BlackoutEvery, CurrentConfig.ExpandEvery);
}

void AOLChaosMode::OnStartPressed()
{
	if (State != EChaosState::WaitingStart) return;
	State = EChaosState::Intro;
	IntroTimer = 0.f;
	UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] INTRO started (%.1fs)"), IntroDuration);
}

void AOLChaosMode::StopGame()
{
	State = EChaosState::Idle;
	MovingLaserIDs.Empty();
}

void AOLChaosMode::OnGame01StepChanged(const TArray<int32>& InMovingLaserIDs)
{
	MovingLaserIDs = InMovingLaserIDs;
}

void AOLChaosMode::OnLaserTriggered(int32 LaserID)
{
	if (State != EChaosState::Playing) return;
	if (bBlackoutActive) return;

	TArray<int32> Active = GetAllActiveLasers();
	if (!Active.Contains(LaserID)) return;

	Lives--;
	UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] Life lost! Laser %d. Lives: %d"), LaserID, Lives);
	OnLifeLost.Broadcast(Lives, LaserID);

	if (Lives <= 0)
	{
		State = EChaosState::LevelEnded;
		UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] GAME OVER at level %d"), CurrentLevel);
		OnGameOver.Broadcast();
	}
}

void AOLChaosMode::CompleteLevel()
{
	if (State != EChaosState::Playing) return;
	State = EChaosState::LevelEnded;
	Score += Lives * 500 + FMath::FloorToInt(TimeRemaining) * 10;
	UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] Level %d COMPLETE! Lives=%d, Time=%.0f, Score=%d"),
		CurrentLevel, Lives, TimeRemaining, Score);
	OnLevelComplete.Broadcast();
}

void AOLChaosMode::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	// === INTRO PHASE ===
	if (State == EChaosState::Intro)
	{
		IntroTimer += DeltaTime;

		// === INTRO LIGHT SHOW (unique per level) ===
		TArray<int32> IntroLasers;
		float t = IntroTimer;

		switch (CurrentConfig.IntroType)
		{
		case 0: // Level 1 "Mission Impossible" — diagonal sweep like laser scan
		{
			int32 step = FMath::FloorToInt(t / 0.1f) % (8 + 6);
			for (int32 r = 0; r < 6; r++)
				for (int32 c = 0; c < 8; c++)
					if (r + c <= step)
						IntroLasers.Add(CellToLaserID(r * 8 + c));
			if (t > 4.2f && t < 4.5f)
			{
				IntroLasers.Empty();
				for (int32 i = 1; i <= 48; i++) IntroLasers.Add(i);
			}
			else if (t > 4.5f) IntroLasers.Empty();
			break;
		}
		case 1: // Level 2 "Battle Without Honor" — curtain rises bottom to top
		{
			int32 row = FMath::FloorToInt(t / 0.7f);
			for (int32 r = 5; r >= FMath::Max(0, 5 - row); r--)
				for (int32 c = 0; c < 8; c++)
					IntroLasers.Add(CellToLaserID(r * 8 + c));
			if (t > 4.2f && t < 4.5f)
			{
				IntroLasers.Empty();
				for (int32 i = 1; i <= 48; i++) IntroLasers.Add(i);
			}
			else if (t > 4.5f) IntroLasers.Empty();
			break;
		}
		case 2: // Level 3 "Linkin Park" — BOM BOM BOM (3 big flashes + rapid)
		{
			bool bOn = false;
			float flashes[] = {0.f, 0.35f, 0.7f, 1.4f, 1.6f, 1.8f, 2.0f, 2.8f, 3.15f, 3.5f};
			for (float ft : flashes)
				if (t >= ft && t < ft + 0.18f) bOn = true;
			if (bOn)
				for (int32 i = 1; i <= 48; i++) IntroLasers.Add(i);
			break;
		}
		case 3: // Level 4 "AUTOMOTIVO" — bouncing row up and down
		{
			int32 frame = FMath::FloorToInt(t / 0.12f) % 12;
			int32 row = frame < 6 ? frame : 11 - frame;
			for (int32 c = 0; c < 8; c++)
				IntroLasers.Add(CellToLaserID(row * 8 + c));
			break;
		}
		case 4: // Level 5 "Skrillex" — silence then FLASH-dark-FLASH-dark-FLASH
		{
			if (t >= 1.8f && t < 2.1f)
				for (int32 i = 1; i <= 48; i++) IntroLasers.Add(i);
			else if (t >= 2.8f && t < 3.0f)
				for (int32 i = 1; i <= 48; i++) IntroLasers.Add(i);
			else if (t >= 3.8f && t < 4.0f)
				for (int32 i = 1; i <= 48; i++) IntroLasers.Add(i);
			break;
		}
		case 5: // Level 6 "Like Wooh Wooh" — running light around perimeter
		{
			TArray<int32> perim;
			for (int32 c = 0; c < 8; c++) perim.Add(5 * 8 + c);      // bottom L→R
			for (int32 r = 4; r >= 0; r--) perim.Add(r * 8 + 7);     // right B→T
			for (int32 c = 6; c >= 0; c--) perim.Add(0 * 8 + c);     // top R→L
			for (int32 r = 1; r < 5; r++) perim.Add(r * 8 + 0);      // left T→B
			float speed = t < 2.f ? 0.08f : (t < 3.5f ? 0.05f : 0.03f);
			int32 pos = FMath::FloorToInt(t / speed) % perim.Num();
			int32 trail = 3;
			for (int32 i = 0; i < trail; i++)
			{
				int32 pi = (pos - i + perim.Num()) % perim.Num();
				IntroLasers.Add(CellToLaserID(perim[pi]));
			}
			break;
		}
		case 6: // Level 7 "Gesaffelstein" — strobe alternating even/odd columns (intro-only)
		{
			int32 phase = FMath::FloorToInt(t / 0.08f) % 4;
			for (int32 r = 0; r < 6; r++)
				for (int32 c = 0; c < 8; c++)
				{
					if (phase == 0 && c % 2 == 0)
						IntroLasers.Add(CellToLaserID(r * 8 + c));
					if (phase == 2 && c % 2 == 1)
						IntroLasers.Add(CellToLaserID(r * 8 + c));
				}
			break;
		}
		case 7: // Level 8 "Pump It" — waves from both sides meeting in middle
		{
			int32 left = FMath::FloorToInt(t / 0.2f);
			int32 right = FMath::FloorToInt(t / 0.2f);
			for (int32 r = 0; r < 6; r++)
			{
				for (int32 c = 0; c < FMath::Min(left, 4); c++)
					IntroLasers.Add(CellToLaserID(r * 8 + c));
				for (int32 c = 7; c >= FMath::Max(8 - right, 4); c--)
					IntroLasers.Add(CellToLaserID(r * 8 + c));
			}
			break;
		}
		case 8: // Level 9 "Rammstein" — countdown flashes, escalating intensity
		{
			int32 beat = FMath::FloorToInt(t / 0.45f);
			float beatPos = FMath::Fmod(t, 0.45f);
			if (beat < 10 && beatPos < 0.25f)
			{
				int32 count = (beat + 1) * 4;
				FRandomStream RS(beat * 1337);
				TSet<int32> used;
				for (int32 i = 0; i < FMath::Min(count, 48); i++)
				{
					int32 cell = RS.RandRange(0, 47);
					if (!used.Contains(cell)) { used.Add(cell); IntroLasers.Add(CellToLaserID(cell)); }
				}
			}
			break;
		}
		case 9: // Level 10 "BOUNTYHUNTER" — total chaos random flash
		{
			int32 frame = FMath::FloorToInt(t / 0.06f);
			FRandomStream RS(frame * 42);
			for (int32 i = 0; i < 48; i++)
				if (RS.FRand() > 0.5f)
					IntroLasers.Add(CellToLaserID(i));
			break;
		}
		default:
		{
			if ((t < 0.5f) || (t > 1.0f && t < 1.5f))
				for (int32 i = 1; i <= 48; i++) IntroLasers.Add(i);
			break;
		}
		}

		// Broadcast intro LEDs (hit detection OFF during intro).
		// Use change-detection to avoid flooding serial buffer (see Bug 2 fix).
		IntroLasers.Sort();
		if (IntroLasers != PrevActiveLasers)
		{
			PrevActiveLasers = IntroLasers;
			OnLEDUpdate.Broadcast(IntroLasers);
		}

		if (IntroTimer >= IntroDuration)
		{
			State = EChaosState::Playing;
			UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] INTRO ended, GAMEPLAY started"));
			OnLasersReady.Broadcast(CurrentConfig);
			OnIntroEnd.Broadcast();
		}
		return;
	}

	if (State != EChaosState::Playing) return;

	TimeRemaining -= DeltaTime;
	if (TimeRemaining <= 0.f)
	{
		TimeRemaining = 0.f;
		State = EChaosState::LevelEnded;
		UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] TIME'S UP at level %d"), CurrentLevel);
		OnGameOver.Broadcast();
		return;
	}

	// === BLACKOUT ===
	if (CurrentConfig.BlackoutEvery > 0.f)
	{
		BlackoutTimer += DeltaTime;
		if (!bBlackoutActive && BlackoutTimer >= CurrentConfig.BlackoutEvery)
		{
			bBlackoutActive = true;
			BlackoutEndTime = CurrentConfig.BlackoutDuration;
			BlackoutTimer = 0.f;
			UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] BLACKOUT started"));
		}
		if (bBlackoutActive)
		{
			BlackoutEndTime -= DeltaTime;
			if (BlackoutEndTime <= 0.f)
			{
				bBlackoutActive = false;
				RegeneratePattern();
				UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] BLACKOUT ended, new pattern"));
			}
			TArray<int32> Empty;
			Empty.Sort();
			if (Empty != PrevActiveLasers) { PrevActiveLasers = Empty; OnLEDUpdate.Broadcast(Empty); }
			return;
		}
	}

	// === SWAP WITH WARNING ===
	if (CurrentConfig.SwapEvery > 0.f)
	{
		SwapTimer += DeltaTime;
		float TimeToSwap = CurrentConfig.SwapEvery - SwapTimer;

		// Warning phase: 1.5s before swap — static lasers flash as warning
		if (TimeToSwap > 0.f && TimeToSwap < 1.5f)
		{
			if (!bSwapWarning) { bSwapWarning = true; SwapWarningStart = SwapTimer; }
			// During warning: moving continues, static flashes on/off every 0.3s
			bool bStaticVisible = (FMath::FloorToInt((SwapTimer - SwapWarningStart) / 0.3f) % 2 == 0);
			TArray<int32> WarnLasers;
			if (bStaticVisible)
				for (int32 Cell : StaticLasers)
					WarnLasers.Add(CellToLaserID(Cell));
			for (int32 ID : MovingLaserIDs)
				WarnLasers.Add(ID);
			WarnLasers.Sort();
			if (WarnLasers != PrevActiveLasers) { PrevActiveLasers = WarnLasers; OnLEDUpdate.Broadcast(WarnLasers); }
			return;
		}

		// Swap execution: dark 1s then new pattern
		if (SwapTimer >= CurrentConfig.SwapEvery)
		{
			SwapTimer = 0.f;
			bSwapWarning = false;
			RegeneratePattern();
			UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] SWAP — new pattern"));
		}
	}

	// === EXPAND ===
	if (CurrentConfig.ExpandEvery > 0.f)
	{
		ExpandTimer += DeltaTime;
		if (ExpandTimer >= CurrentConfig.ExpandEvery)
		{
			ExpandTimer = 0.f;
			ExtraStaticCount += CurrentConfig.ExpandCount;
			int32 MaxExtra = 20 - CurrentConfig.NumStatic;
			if (ExtraStaticCount > MaxExtra) ExtraStaticCount = MaxExtra;
			RegeneratePattern();
			UE_LOG(LogTemp, Warning, TEXT("[ChaosMode] EXPAND +%d (total static: %d)"),
				CurrentConfig.ExpandCount, CurrentConfig.NumStatic + ExtraStaticCount);
		}
	}

	// === BROADCAST ACTIVE LASERS (only on change) ===
	TArray<int32> Active = GetAllActiveLasers();
	Active.Sort();
	if (Active != PrevActiveLasers)
	{
		PrevActiveLasers = Active;
		OnLEDUpdate.Broadcast(Active);
	}
}

void AOLChaosMode::SetLevelDuration(float Seconds) { LevelDuration = Seconds; if (IsPlaying()) TimeRemaining = Seconds; }
void AOLChaosMode::SetLives(int32 NewLives) { Lives = FMath::Max(0, NewLives); }
