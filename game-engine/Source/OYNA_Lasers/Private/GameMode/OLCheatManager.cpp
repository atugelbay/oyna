#include "GameMode/OLCheatManager.h"

#include "CMD/OLCmdIO_YDGZObject.h"
#include "Kismet/GameplayStatics.h"
#include "Systems/OLMain.h"
#include "Games/OLGame01.h"
#include "Games/OLClassicMode.h"

void UOLCheatManager::ToggleDebugSending() const
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->SetDebugSending(!Main->GetDebugSending());
	}
}

void UOLCheatManager::DebugReceivingByte(int32 Byte) const
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->SetDebugReceiving(Byte);
	}
}

void UOLCheatManager::DebugReceivingBytes(const FString& Bytes) const
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		TArray<FString> BytesIntArray;
		Bytes.ParseIntoArray(BytesIntArray, TEXT(","));
		
		for (const FString& Byte : BytesIntArray)
		{
			Main->SetDebugReceiving(FCString::Atoi(*Byte));
		}
	}
}

void UOLCheatManager::SetGame005(const int32 Game005) const
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->SetGameMode(Game005);
	}
}

void UOLCheatManager::ToggleBitValueZero() const
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->ToggleBitValueZeroYDGZ();
	}
}

void UOLCheatManager::SetDirRight()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->GameDirection = EOLDirection::Right;
		UE_LOG(LogTemp, Warning, TEXT("Direction: RIGHT"));
	}
}

void UOLCheatManager::SetDirLeft()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->GameDirection = EOLDirection::Left;
		UE_LOG(LogTemp, Warning, TEXT("Direction: LEFT"));
	}
}

void UOLCheatManager::SetDirDown()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->GameDirection = EOLDirection::Down;
		UE_LOG(LogTemp, Warning, TEXT("Direction: DOWN"));
	}
}

void UOLCheatManager::SetDirUp()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->GameDirection = EOLDirection::Up;
		UE_LOG(LogTemp, Warning, TEXT("Direction: UP"));
	}
}

void UOLCheatManager::StartClassic()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->StartClassicGame(1);
		UE_LOG(LogTemp, Warning, TEXT("Classic mode started at level 1"));
	}
}

void UOLCheatManager::StartClassicLevel(int32 Level)
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->StartClassicGame(Level);
		UE_LOG(LogTemp, Warning, TEXT("Classic mode started at level %d"), Level);
	}
}

void UOLCheatManager::SimulateStartButton()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
		Main->HandlePhysicalButton(0);  // 0 = START
}

void UOLCheatManager::SimulateEndButton()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->HandlePhysicalButton(1);
		UE_LOG(LogTemp, Warning, TEXT("Simulated END button press"));
	}
}

void UOLCheatManager::SetClassicTime(float Seconds)
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		if (AOLClassicMode* Classic = Main->GetClassicMode())
		{
			Classic->SetLevelDuration(Seconds);
		}
		else
		{
			UE_LOG(LogTemp, Warning, TEXT("[SetClassicTime] No active ClassicMode — start one first"));
		}
	}
}

void UOLCheatManager::SetClassicLives(int32 Lives)
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		if (AOLClassicMode* Classic = Main->GetClassicMode())
		{
			Classic->SetLives(Lives);
		}
		else
		{
			UE_LOG(LogTemp, Warning, TEXT("[SetClassicLives] No active ClassicMode — start one first"));
		}
	}
}

void UOLCheatManager::StartLight(bool bOn)
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
		Main->SetStartButtonLight(bOn);
}

void UOLCheatManager::EndLight(bool bOn)
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
		Main->SetEndButtonLight(bOn);
}

void UOLCheatManager::StartDynamic()
{
	StartDynamicLevel(1);
}

void UOLCheatManager::StartDynamicLevel(int32 Level)
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->StartDynamicGame(Level);
		UE_LOG(LogTemp, Warning, TEXT("Dynamic mode started at level %d"), Level);
	}
}

void UOLCheatManager::StartChaos()
{
	StartChaosLevel(1);
}

void UOLCheatManager::StartChaosLevel(int32 Level)
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->StartChaosGame(Level);
		UE_LOG(LogTemp, Warning, TEXT("Chaos mode started at level %d"), Level);
	}
}

void UOLCheatManager::SendModeSwitch()
{
	if (AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())))
	{
		Main->SendModeSwitchYDGZ();
		UE_LOG(LogTemp, Warning, TEXT("[Cheat] Mode switch sent"));
	}
}

void UOLCheatManager::TestEndChannel(int32 Channel)
{
	UWorld* World = GetWorld();
	if (!World) return;

	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(World, AOLMain::StaticClass()));
	if (!Main) { UE_LOG(LogTemp, Warning, TEXT("[CHEAT] OLMain not found")); return; }

	UE_LOG(LogTemp, Warning, TEXT("[CHEAT] Testing END light on ch=0x%02X"), Channel);
	Main->SetButtonLightDirect(Channel, true);

	TWeakObjectPtr<AOLMain> WeakMain(Main);
	FTimerHandle H;
	World->GetTimerManager().SetTimer(H,
		FTimerDelegate::CreateLambda([WeakMain, Channel]()
		{
			if (AOLMain* M = WeakMain.Get())
			{
				M->SetButtonLightDirect(Channel, false);
				UE_LOG(LogTemp, Warning, TEXT("[CHEAT] ch=0x%02X off"), Channel);
			}
		}),
		2.0f, false);
}

void UOLCheatManager::TestEndChannelAll()
{
	UWorld* World = GetWorld();
	if (!World) return;

	UE_LOG(LogTemp, Warning,
		TEXT("[CHEAT] Sweeping ch=0..7 with 3s window. Watch END button physically."));

	TWeakObjectPtr<UOLCheatManager> WeakSelf(this);
	for (int32 Ch = 0; Ch <= 7; ++Ch)
	{
		FTimerHandle H;
		World->GetTimerManager().SetTimer(H,
			FTimerDelegate::CreateLambda([WeakSelf, Ch]()
			{
				if (UOLCheatManager* Self = WeakSelf.Get())
				{
					UE_LOG(LogTemp, Warning, TEXT("[CHEAT] >>> Testing ch=0x%02X <<<"), Ch);
					Self->TestEndChannel(Ch);
				}
			}),
			Ch * 3.0f + 0.1f, false);
	}
}

// ==== HUD simulation cheats ====

void UOLCheatManager::SimulateLifeLost(int32 LaserID)
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main)
	{
		UE_LOG(LogTemp, Error, TEXT("[Cheat] SimulateLifeLost: AOLMain not found"));
		return;
	}

	const int32 NewLives = FMath::Max(0, Main->GetCurrentLives() - 1);
	Main->DebugBroadcastLaserHit(LaserID);
	Main->DebugBroadcastLivesChanged(NewLives);

	UE_LOG(LogTemp, Warning, TEXT("[Cheat] SimulateLifeLost: Laser=%d, Lives -> %d"),
		LaserID, NewLives);
}

void UOLCheatManager::SimulateScoreChange(int32 NewScore)
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) return;
	Main->DebugBroadcastScoreChanged(NewScore);
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] SimulateScoreChange: %d"), NewScore);
}

void UOLCheatManager::SimulateLevelComplete()
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) return;

	FOLLevelResult R;
	R.Mode = Main->GetCurrentMode() != EOLGameMode::None
		? Main->GetCurrentMode() : EOLGameMode::Classic;
	R.Level = Main->GetCurrentLevel() > 0 ? Main->GetCurrentLevel() : 5;
	R.LivesLeft = Main->GetCurrentLives();
	R.LivesBonus = R.LivesLeft * 500;
	R.TimeUsed = 47.f;
	R.TimeBonus = 430;
	R.FinalScore = R.LivesBonus + R.TimeBonus;
	R.bVictory = true;
	R.Reason = TEXT("Уровень пройден");

	Main->DebugBroadcastLevelComplete(R);
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] SimulateLevelComplete: %s Lvl %d, Score=%d"),
		*UEnum::GetValueAsString(R.Mode), R.Level, R.FinalScore);
}

void UOLCheatManager::SimulateGameOver(const FString& Reason)
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) return;

	FOLLevelResult R;
	R.Mode = Main->GetCurrentMode() != EOLGameMode::None
		? Main->GetCurrentMode() : EOLGameMode::Classic;
	R.Level = Main->GetCurrentLevel() > 0 ? Main->GetCurrentLevel() : 5;
	R.LivesLeft = 0;
	R.FinalScore = 0;
	R.bVictory = false;
	R.Reason = Reason.IsEmpty() ? TEXT("Все жизни потеряны") : Reason;

	Main->DebugBroadcastGameOver(R);
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] SimulateGameOver: %s, Reason=%s"),
		*UEnum::GetValueAsString(R.Mode), *R.Reason);
}

void UOLCheatManager::SimulateTimeRemaining(float Seconds)
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) return;
	Main->DebugBroadcastTimeChanged(Seconds);
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] SimulateTimeRemaining: %.1f sec"), Seconds);
}

// ==== Parser test cheats (Commit 2) ====
// Inject a 34-byte (or any length) hex frame directly into the parser, byte
// by byte, as if it came from the serial plugin. Spaces and tabs are stripped.

void UOLCheatManager::CheatInjectFrameHex(const FString& HexStr)
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) { UE_LOG(LogTemp, Error, TEXT("[Cheat] AOLMain not found")); return; }

	FString Clean = HexStr;
	Clean.ReplaceInline(TEXT(" "), TEXT(""));
	Clean.ReplaceInline(TEXT("\t"), TEXT(""));

	if (Clean.Len() == 0 || Clean.Len() % 2 != 0)
	{
		UE_LOG(LogTemp, Error, TEXT("[Cheat] Hex string must be non-empty and even-length"));
		return;
	}

	const int32 NumBytes = Clean.Len() / 2;
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] Injecting %d bytes"), NumBytes);

	for (int32 i = 0; i < NumBytes; ++i)
	{
		const FString ByteStr = Clean.Mid(i * 2, 2);
		const int32 ByteVal = FCString::Strtoi(*ByteStr, nullptr, 16);
		Main->SetDebugReceiving(ByteVal);
	}
}

void UOLCheatManager::CheatSetActiveMaskBit(int32 LaserID)
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) return;
	UOLCmdIO_YDGZObject* Parser = Main->GetUartYDGZ();
	if (!Parser) { UE_LOG(LogTemp, Error, TEXT("[Cheat] parser not ready")); return; }

	if (LaserID < 1 || LaserID > 48)
	{
		UE_LOG(LogTemp, Error, TEXT("[Cheat] LaserID must be 1..48"));
		return;
	}
	Parser->SetActiveLaserMaskBit(LaserID);
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] ActiveLaserMask bit %d set; mask=0x%012llX"),
		LaserID, (unsigned long long)Parser->GetActiveLaserMask());
}

void UOLCheatManager::CheatClearActiveMask()
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) return;
	UOLCmdIO_YDGZObject* Parser = Main->GetUartYDGZ();
	if (!Parser) return;
	Parser->ClearActiveLaserMask();
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] ActiveLaserMask cleared"));
}

void UOLCheatManager::CheatResetBaseline()
{
	AOLMain* Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
	if (!Main) return;
	UOLCmdIO_YDGZObject* Parser = Main->GetUartYDGZ();
	if (!Parser) return;
	Parser->ResetBaseline();
	UE_LOG(LogTemp, Warning, TEXT("[Cheat] Baseline reset"));
}
