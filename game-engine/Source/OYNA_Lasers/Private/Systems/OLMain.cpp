#include "OYNA_Lasers/Public/Systems/OLMain.h"

#include "UI/OLMainWidget.h"
#include "Blueprint/UserWidget.h"
#include "CMD/OLCmdIO_YDGZObject.h"
#include "CMD/OLDriverWSClient.h"
#include "CMD/OLUARTSerialPluginObject.h"
#include "Games/OLGame01.h"
#include "Games/OLDynamicMode.h"
#include "Helpers/OLFrameBuffer.h"
#include "HUD/OLGameHUDWidget.h"
#include "Kismet/GameplayStatics.h"

static bool bInitSent = false;

static FString CrmModeToString(EOLGameMode Mode)
{
	switch (Mode)
	{
	case EOLGameMode::Classic:
		return TEXT("classic");
	case EOLGameMode::Dynamic:
		return TEXT("dynamic");
	case EOLGameMode::Chaos:
		return TEXT("chaos");
	default:
		return TEXT("none");
	}
}

AOLMain::AOLMain()
{
	PrimaryActorTick.bCanEverTick = true;
}

void AOLMain::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);
	
	// Mirror active mode's time/score into HUD state during gameplay.
	if (CurrentState == EOLGameState::Playing)
	{
		if (IsValid(ClassicMode))
		{
			SetRemainingSeconds(ClassicMode->GetTimeRemaining());
			SetScore(ClassicMode->GetScore());
		}
		else if (IsValid(DynamicMode))
		{
			SetRemainingSeconds(DynamicMode->GetTimeRemaining());
			SetScore(DynamicMode->GetScore());
		}
		else if (IsValid(ChaosMode))
		{
			SetRemainingSeconds(ChaosMode->GetTimeRemaining());
			SetScore(ChaosMode->GetScore());
		}
	}
}

void AOLMain::SetDebugReceiving(int32 Byte)
{
	if (Serial)
	{
		Serial->DebugReceivingByte(Byte);
	}
}

void AOLMain::ToggleBitValueZeroYDGZ() const
{
	if (uartYDGZ)
	{
		uartYDGZ->ToggleBitValueZero();
	}
}

void AOLMain::SendModeSwitchYDGZ() const
{
	if (uartYDGZ)
	{
		uartYDGZ->CMD0_SendCmd_ModeSwitch();
	}
}

void AOLMain::BeginPlay()
{
	Super::BeginPlay();

	UE_LOG(LogTemp, Warning, TEXT("~~[AOLMain::BeginPlay]~~"));
	
	if (!GetWorld())
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] World is NUll"));
		return;
	}
	
	CreateMainWidget();
	
	Serial = NewObject<UOLUARTSerialPluginObject>(this);
	uartYDGZ = NewObject<UOLCmdIO_YDGZObject>(this);

	if (!uartYDGZ)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] UOLCmdIO_YDGZObject is Null"));
		return;
	}
	if (!Serial)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] UOLUARTSerialPluginObject is Null"));
		return;
	}
	
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::BeginPlay] UOLCmdIO_YDGZObject is Created"));
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::BeginPlay] UOLUARTSerialPluginObject is Created"));

	// -------- connect transport -> protocol --------
	Serial->OnUartByte.BindUObject(uartYDGZ, &UOLCmdIO_YDGZObject::ProcessIncomingByte);

	// -------- connect protocol -> transport --------
	uartYDGZ->OnSendPacket.AddUObject(Serial, &UOLUARTSerialPluginObject::SendData);

	// -------- protocol -> gameplay --------
	uartYDGZ->OnLaserTriggered.AddUObject(this, &AOLMain::HandleButton);
	uartYDGZ->OnCoinInserted.AddUObject(this, &AOLMain::HandleCoin);
	uartYDGZ->OnButtonPressed.AddUObject(this, &AOLMain::HandlePhysicalButton);

	uartYDGZ->InitWorldObject(this);
	Serial->Init(3, 115200);

	// Delay first Init by 3 seconds — controller needs time after USB power-up
	FTimerHandle InitDelayHandle;
	GetWorldTimerManager().SetTimer(InitDelayHandle, [this]()
	{
		if (uartYDGZ)
		{
			uartYDGZ->CMD0_SendCmd_ModeSwitch();
			uartYDGZ->CMD0_SendCmd_Line();
			uartYDGZ->CMD0_SendCmd_Protocol();
			SetAllLEDs(EOLColorTypes::Off);
			UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Delayed Init sent (3s after port open)"));

			// Lobby: listen for START. SetActiveButton selects ch=0x04 and the
			// 20 Hz timer below alternates intensity 0x7F/0x00 on that channel,
			// which is what the controller needs to activate its touch pad
			// (canon 3.6 activation mechanism).
			uartYDGZ->SetActiveButton(0);
			GetWorldTimerManager().SetTimer(HeartbeatTimer,
				[this]() { if (uartYDGZ) uartYDGZ->SendHeartbeat(); },
				0.05f, true, 0.05f);  // 20 Hz
		}
	}, 3.0f, false);
	
	SetLEDInfo();
	
	DriverWSClient = NewObject<UOLDriverWSClient>(this);
	if (!DriverWSClient)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] DriverWSClient is Null"));
		return;
	}
	
	DriverWSClient->Connect();
	DriverWSClient->OnMessageDelegate.AddUObject(this, &AOLMain::DriverWSClient_OnMessage);
}

void AOLMain::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	bInitSent = false;
	GetWorldTimerManager().ClearTimer(HeartbeatTimer);
	Disconnect();

	if (Serial)
	{
		Serial->Close();
		Serial->MarkAsGarbage();
	}
	if (uartYDGZ)
	{
		uartYDGZ->MarkAsGarbage();
	}
	if (MainWidget)
	{
		MainWidget->RemoveFromParent();
	}
	if (GameHUDWidget)
	{
		GameHUDWidget->RemoveFromParent();
	}
	
	Super::EndPlay(EndPlayReason);
}

void AOLMain::CreateMainWidget()
{
	/*if (MainWidgetClass)
	{
		MainWidget = CreateWidget<UOLMainWidget>(UGameplayStatics::GetPlayerController(GetWorld(), 0), MainWidgetClass);
		if(MainWidget)
		{
			MainWidget->AddToViewport();
			MainWidget->OnConfirmConfigs.AddDynamic(this, &AOLMain::SetOneLED);
			MainWidget->OnConfirmAllLeds.AddDynamic(this, &AOLMain::SetAllLEDs);
			MainWidget->OnConfirmPortChange.AddDynamic(this, &AOLMain::Connect);
			MainWidget->OnSelectGameType.AddDynamic(this, &AOLMain::TurnOnGame);
			MainWidget->OnStopGames.AddDynamic(this, &AOLMain::StopGames);
			MainWidget->OnChangeConnectionType.AddDynamic(this, &AOLMain::ChangeConnectionType);

			UE_LOG(LogTemp, Warning, TEXT("[AOLMain::BeginPlay] MainWidget is Created"));
		}
	}
	else
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] MainWidgetClass is Null"));
	}

	if (!MainWidget)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] MainWidget is Null"));
	}*/

	// === GameHUDWidget (new game HUD layer, optional — nullptr-safe) ===
	if (GameHUDClass)
	{
		if (APlayerController* PC = UGameplayStatics::GetPlayerController(GetWorld(), 0))
		{
			GameHUDWidget = CreateWidget<UOLGameHUDWidget>(PC, GameHUDClass);
			if (GameHUDWidget)
			{
				GameHUDWidget->AddToViewport(10); // Z-order 10: above MainWidget operator panel
				GameHUDWidget->OnGameStart.AddDynamic(this, &AOLMain::StartGame);
				
				UE_LOG(LogTemp, Warning, TEXT("[AOLMain] GameHUDWidget created and added to viewport"));
			}
			else
			{
				UE_LOG(LogTemp, Error, TEXT("[AOLMain] Failed to create GameHUDWidget"));
			}
		}
	}
	else
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain] GameHUDClass not set - HUD will not be shown"));
	}
	
	if (!GameHUDWidget)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] GameHUDWidget is Null"));
	}
}

void AOLMain::Connect(const int32 Port, int32 Baud)
{
	if (bInitSent)
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::Connect] Already initialized — skipping"));
		return;
	}

	//Serial->Init(3, 115200);
	if (!IsValid(Serial))
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::Connect] UART Serial Plugin is Null"));
		return;
	}
	if (!IsValid(uartYDGZ))
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::Connect] uartYDGZ is Null"));
		return;
	}

	if ((Port != Serial->GetPortNo()) || (Baud != Serial->GetBaudRate()))
	{
		Serial->Init(Port, Baud);
		uartYDGZ->CMD0_SendCmd_ModeSwitch();
		FPlatformProcess::Sleep(0.05f);
		uartYDGZ->CMD0_SendCmd_Line();
		FPlatformProcess::Sleep(0.05f);
		uartYDGZ->CMD0_SendCmd_Protocol();
		FPlatformProcess::Sleep(0.05f);
		// Ensure 20 Hz heartbeat is running after user-initiated Connect.
		// Lobby: listen for START (canon 3.6 activation via alternating poll).
		if (!HeartbeatTimer.IsValid() || !GetWorldTimerManager().IsTimerActive(HeartbeatTimer))
		{
			uartYDGZ->SetActiveButton(0);
			GetWorldTimerManager().SetTimer(HeartbeatTimer,
				[this]() { if (uartYDGZ) uartYDGZ->SendHeartbeat(); },
				0.05f, true, 0.05f);  // 20 Hz
		}
		bInitSent = true;
	}
	else
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::OnPortChange] Port change is the same as current port connection"));
	}
}

void AOLMain::Disconnect()
{
	if (!Serial)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::Disconnect] UART Serial Plugin is Null"));
		return;
	}
	
	Serial->Close();
}

void AOLMain::SetLEDInfo()
{
	UOLFrameBuffer* FrameBuffer = UOLFrameBuffer::Get(GetWorld());
	if (!IsValid(FrameBuffer))
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetLEDInfo] FrameBuffer is Null"));
		return;
	}
	
	FrameBuffer->SetLEDMap(EOLLEDMapType::Type1, 6, 8);
}

void AOLMain::StartGame(const EOLGameMode GameType, const int32 Level)
{
	if (GameType == EOLGameMode::Classic)
	{
		StartClassicGame(Level);
	}
	else if (GameType == EOLGameMode::Dynamic)
	{
		StartDynamicGame(Level);
	}
	else if (GameType == EOLGameMode::Chaos)
	{
		StartChaosGame(Level);
	}
}

void AOLMain::TurnOnGame(EOLGameType GameType, TArray<int32> Raws, float IntervalTime)
{
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::TurnOnGame] Called! GameType=%d, Raws=%d, Interval=%f"), (int32)GameType, Raws.Num(), IntervalTime);

	// If Game01 already running, stop and destroy it before starting fresh
	if (IsValid(Game01))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::TurnOnGame] Restarting Game01 with new params"));
		Game01->StopGame();
		Game01->Destroy();
		Game01 = nullptr;
	}

	if (!GetWorld())
	{
		return;
	}
	
	if (GameType == EOLGameType::Type1)
	{
		Game01 = GetWorld()->SpawnActor<AOLGame01>();
		if (!IsValid(Game01))
		{
			UE_LOG(LogTemp, Error, TEXT("[AOLMain::TurnOnGame] Game01 is Null"));
			return;
		}
		
		Connect(3, 115200);

		Game01->SetOwner(this);
		Game01->OnLEDStateChange.AddUObject(this, &AOLMain::Game01LedStateChange);
		Game01->StartGame(Raws, IntervalTime, GameDirection);
	}
}

void AOLMain::StopGames()
{
	if (IsValid(Game01))
	{
		SetAllLEDs(EOLColorTypes::Off);
		Game01->StopGame();
		Disconnect();
	}
}

void AOLMain::Game01LedStateChange(TArray<int32>& Array, EOLLEDState EOLLEDState)
{
	float Now = GetWorld()->GetTimeSeconds();
	if (Now - LastLedChangeTime < 0.05f) return;  // minimum 50ms between commands
	LastLedChangeTime = Now;

	SetAllLEDs(EOLColorTypes::Off);

	const UOLFrameBuffer* FrameBuffer = GetWorld()->GetSubsystem<UOLFrameBuffer>();
	if (!FrameBuffer)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetAllLEDs] FrameBuffer is NUll"));
		return;
	}

	SetOneLED(1, Array, EOLColorTypes::White);

	// Reset laser state baseline so the controller's immediate status response
	// (reflecting the newly lit beams) is not misread as a player trigger
	if (uartYDGZ)
		uartYDGZ->ResetState();
}

void AOLMain::SetAllLEDs(EOLColorTypes ColorType)
{
	if (!uartYDGZ)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetAllLEDs] uartYDGZ is Null"));
		return;
	}

	if (!GetWorld())
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetAllLEDs] World is NUll"));
		return;
	}
	
	UOLFrameBuffer* FrameBuffer = GetWorld()->GetSubsystem<UOLFrameBuffer>();
	if (!FrameBuffer)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetAllLEDs] FrameBuffer is NUll"));
		return;
	}
	
	if (!Serial)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetAllLEDs] UART Serial Plugin is Null"));
		return;
	}
	
	if (!Serial->IsOpen())
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::SetAllLEDs] UART Serial Plugin is not Opened"));
		Serial->Init(3, 115200);
		uartYDGZ->CMD0_SendCmd_ModeSwitch();
		FPlatformProcess::Sleep(0.05f);
		uartYDGZ->CMD0_SendCmd_Line();
		FPlatformProcess::Sleep(0.05f);
		uartYDGZ->CMD0_SendCmd_Protocol();
		FPlatformProcess::Sleep(0.05f);
	}

	if (!Serial->IsOpen() && !bDebugSending)
	{
		UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetAllLEDs] UART Serial Plugin is not Opened"));
		return;
	}
	
	FrameBuffer->ChangeLEDStateAll(FrameBuffer->GetStatusTypeForColor(ColorType));
	uartYDGZ->SendLedAll(FrameBuffer->GetUINTTypeForColor(ColorType));
}

void AOLMain::SetOneLED(int32 Channel, TArray<int32> IDs, EOLColorTypes ColorType)
{
	if (bUART)
	{
		if (!GetWorld())
		{
			UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetOneLED] World is NUll"));
			return;
		}
	
		UOLFrameBuffer* FrameBuffer = GetWorld()->GetSubsystem<UOLFrameBuffer>();
		if (!FrameBuffer)
		{
			UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetOneLED] FrameBuffer is NUll"));
			return;
		}

		if (!uartYDGZ)
		{
			UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetOneLED] uartYDGZ is Null"));
			return;
		}
	
		if (!Serial)
		{
			UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetOneLED] UART Serial Plugin is Null"));
			return;
		}
	
		if (!Serial->IsOpen())
		{
			UE_LOG(LogTemp, Warning, TEXT("[AOLMain::SetOneLED] UART Serial Plugin is not Opened"));
			Serial->Init(3, 115200);
			uartYDGZ->CMD0_SendCmd_ModeSwitch();
			FPlatformProcess::Sleep(0.05f);
			uartYDGZ->CMD0_SendCmd_Line();
			FPlatformProcess::Sleep(0.05f);
			uartYDGZ->CMD0_SendCmd_Protocol();
			FPlatformProcess::Sleep(0.05f);
		}

		if (!Serial->IsOpen() && !bDebugSending)
		{
			UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetOneLED] UART Serial Plugin is not Opened"));
			return;
		}
	
		TArray<uint32> Ids;
		for (int32 ID : IDs)
		{
			--ID;
			if (ID < 0)
			{
				UE_LOG(LogTemp, Error, TEXT("[AOLMain::SetOneLED] Channel is InValid"));
				continue;
			}

			Ids.Add(ID);
			FrameBuffer->ChangeLEDStateByID(ID, FrameBuffer->GetStatusTypeForColor(ColorType));
		}

		Ids.Sort();
		uartYDGZ->SendLedOne(--Channel, FrameBuffer->GetUINTTypeForColor(ColorType), Ids);
	}
	else
	{
		if (!IsValid(DriverWSClient))
		{
			UE_LOG(LogTemp, Error, TEXT("[AOLMain::BeginPlay] DriverWSClient is Null"));
			return;
		}
	}
}

void AOLMain::HandleButton(int32 Index)
{
	// Route to ClassicMode if active (PRIORITY)
	if (IsValid(ClassicMode) && ClassicMode->IsPlaying())
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HandleButton] Routing laser %d to ClassicMode"), Index);
		ClassicMode->OnLaserTriggered(Index);
		return;
	}

	// Route to DynamicMode if active
	if (IsValid(DynamicMode) && DynamicMode->IsPlaying())
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HandleButton] Routing laser %d to DynamicMode"), Index);
		DynamicMode->OnLaserTriggered(Index);
		return;
	}

	// Route to ChaosMode if active
	if (IsValid(ChaosMode) && ChaosMode->IsPlaying())
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HandleButton] Routing laser %d to ChaosMode"), Index);
		ChaosMode->OnLaserTriggered(Index);
		return;
	}

	// No active game mode
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HandleButton] No active game — ignoring trigger %d"), Index);
}

void AOLMain::HandleCoin()
{
	
}

void AOLMain::SetGameOver()
{
	UE_LOG(LogTemp, Warning, TEXT("~~[AOLMain::SetGameOver]~~"));
	if (MainWidget)
	{
		MainWidget->ShowGameOver();
	}
	if (Serial)
	{
		Serial->Close();
	}
}

void AOLMain::ChangeConnectionType(bool UART)
{
	bUART = UART;
}

void AOLMain::DriverWSClient_OnMessage(const FString& Message)
{
	TSharedPtr<FJsonObject> Json;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);

	if (FJsonSerializer::Deserialize(Reader, Json) && Json.IsValid())
	{
		DispatchEvent(Json);
	}
	else
	{
		UE_LOG(LogTemp, Warning, TEXT("[LaserMatrix] Failed to parse JSON: %s"), *Message);
	}
}

void AOLMain::DispatchEvent(const TSharedPtr<FJsonObject>& Json)
{
	FString EventType;
	if (!Json->TryGetStringField(TEXT("event"), EventType))
	{
		return;
	}

	FString IncomingSessionId;
	if (Json->TryGetStringField(TEXT("session_id"), IncomingSessionId))
	{
		CurrentCrmSessionId = IncomingSessionId;
	}

	if (EventType == TEXT("controller_connected"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] controller_connected"));
	}
	else if (EventType == TEXT("controller_disconnected"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] controller_disconnected"));
	}
	else if (EventType == TEXT("laser_triggered") || EventType == TEXT("laser_restored"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] laser_triggered || laser_restored"));
		const auto LaserID = (int32)Json->GetNumberField(TEXT("laser_id"));
		const auto Row = (int32)Json->GetNumberField(TEXT("row"));
		const auto Column = (int32)Json->GetNumberField(TEXT("col"));
		FString Timestamp;
		Json->TryGetStringField(TEXT("timestamp"), Timestamp);

		GEngine->AddOnScreenDebugMessage(-1, 50.0f, FColor::Green, 
			FString::Printf(TEXT("Laser %d triggered at (%d, %d) at %s"), LaserID, Row, Column, *Timestamp));
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] Laser %d triggered at (%d, %d) at %s"), LaserID, Row, Column, *Timestamp);
		
		SetGameOver();
	}
	else if (EventType == TEXT("button_pressed"))
	{
		FString Button;
		bool bPressed;
		FString Timestamp;
		Json->TryGetStringField(TEXT("button"), Button);
		Json->TryGetBoolField(TEXT("pressed"), bPressed);
		Json->TryGetStringField(TEXT("timestamp"), Timestamp);

		GEngine->AddOnScreenDebugMessage(-1, 50.0f, FColor::Green, 
			FString::Printf(TEXT("Button %s %s pressed at %s"), *Button, bPressed ? TEXT("") : TEXT("not"), *Timestamp));
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] game_started: Button %s %s pressed at %s"), *Button, bPressed ? TEXT("") : TEXT("not"), *Timestamp);
	}
	else if (EventType == TEXT("game_started"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] game_started"));
		FString Mode;
		Json->TryGetStringField(TEXT("mode"), Mode);
		double LevelNumber = 1.0;
		Json->TryGetNumberField(TEXT("level"), LevelNumber);
		const int32 Level = FMath::Clamp(FMath::RoundToInt(LevelNumber), 1, 10);

		if (Mode.Equals(TEXT("dynamic"), ESearchCase::IgnoreCase))
		{
			StartDynamicGame(Level);
		}
		else if (Mode.Equals(TEXT("chaos"), ESearchCase::IgnoreCase))
		{
			StartChaosGame(Level);
		}
		else
		{
			StartClassicGame(Level);
		}

		// CRM command should physically start the room, not only arm it.
		HandlePhysicalButton(0);
	}
	else if (EventType == TEXT("session_start"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] session_start"));
		FString Mode;
		Json->TryGetStringField(TEXT("mode"), Mode);
		double LevelNumber = 1.0;
		Json->TryGetNumberField(TEXT("level"), LevelNumber);
		const int32 Level = FMath::Clamp(FMath::RoundToInt(LevelNumber), 1, 10);

		if (Mode.Equals(TEXT("dynamic"), ESearchCase::IgnoreCase))
		{
			StartDynamicGame(Level);
		}
		else if (Mode.Equals(TEXT("chaos"), ESearchCase::IgnoreCase))
		{
			StartChaosGame(Level);
		}
		else
		{
			StartClassicGame(Level);
		}

		HandlePhysicalButton(0);
	}
	else if (EventType == TEXT("session_created"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] session_created"));
	}
	else if (EventType == TEXT("session_pause"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] session_pause"));
		// Do not call StopGames() here: it can flood UART with stop/off commands
		// while the controller thread is active. CRM pause currently freezes only
		// the backend timer; full in-engine pause needs mode-level support.
	}
	else if (EventType == TEXT("session_resume"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] session_resume"));
	}
	else if (EventType == TEXT("game_ended"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] game_ended"));
		HandlePhysicalButton(1);
	}
	else if (EventType == TEXT("session_cancel"))
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain::DispatchEvent] session_cancel"));
		HandlePhysicalButton(1);
	}
	else
	{
		UE_LOG(LogTemp, Warning, TEXT("[LaserMatrix] Unknown event: %s"), *EventType);
	}
}

void AOLMain::SendLevelResultEvent(const TCHAR* EventName, const FOLLevelResult& Result)
{
	if (!DriverWSClient || CurrentCrmSessionId.IsEmpty())
	{
		return;
	}

	TSharedPtr<FJsonObject> Json = MakeShared<FJsonObject>();
	Json->SetStringField(TEXT("event"), EventName);
	Json->SetStringField(TEXT("session_id"), CurrentCrmSessionId);
	Json->SetNumberField(TEXT("level"), Result.Level);
	Json->SetNumberField(TEXT("attempt_number"), 1);
	Json->SetNumberField(TEXT("duration_seconds"), FMath::Max(1, FMath::RoundToInt(Result.TimeUsed)));
	Json->SetNumberField(TEXT("final_score"), Result.FinalScore);
	Json->SetNumberField(TEXT("lives_left"), Result.LivesLeft);
	Json->SetNumberField(TEXT("lives_bonus"), Result.LivesBonus);
	Json->SetNumberField(TEXT("time_bonus"), Result.TimeBonus);
	Json->SetNumberField(TEXT("time_used"), Result.TimeUsed);
	Json->SetBoolField(TEXT("victory"), Result.bVictory);
	Json->SetStringField(TEXT("reason"), Result.Reason);
	Json->SetStringField(TEXT("mode"), CrmModeToString(Result.Mode));

	FString OutString;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutString);
	FJsonSerializer::Serialize(Json.ToSharedRef(), Writer);
	DriverWSClient->SendMessage(OutString);
}

void AOLMain::OnKeyboardStart()
{
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Keyboard START pressed (Enter/Space)"));
	HandlePhysicalButton(0);
}

void AOLMain::OnKeyboardEnd()
{
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Keyboard END pressed (Escape)"));
	HandlePhysicalButton(1);
}

void AOLMain::HandlePhysicalButton(int32 ButtonID)
{
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HandlePhysicalButton] Button %d pressed!"), ButtonID);

	if (GEngine)
	{
		GEngine->AddOnScreenDebugMessage(-1, 5.f, FColor::Yellow,
			FString::Printf(TEXT("BUTTON %d PRESSED"), ButtonID));
	}

	// Button 0 = START
	if (ButtonID == 0)
	{
		if (IsValid(ClassicMode))
		{
			// Armed and waiting — activate the lasers
			if (ClassicMode->GetState() == EClassicState::WaitingStart)
			{
				ClassicMode->OnStartPressed();
				return;
			}
			// Idle or previous level ended — arm current (or level 1) again
			if (ClassicMode->GetState() == EClassicState::Idle || ClassicMode->GetState() == EClassicState::LevelEnded)
			{
				int32 Level = ClassicMode->GetCurrentLevel() > 0 ? ClassicMode->GetCurrentLevel() : 1;
				StartClassicGame(Level);
				return;
			}
			// Already playing — ignore
			UE_LOG(LogTemp, Warning, TEXT("[AOLMain] START button — Classic level already running, ignored"));
			return;
		}

		if (IsValid(DynamicMode))
		{
			if (DynamicMode->GetState() == EDynamicState::WaitingStart)
			{
				DynamicMode->OnStartPressed();
				return;
			}
			if (DynamicMode->GetState() == EDynamicState::Idle || DynamicMode->GetState() == EDynamicState::LevelEnded)
			{
				int32 Level = DynamicMode->GetCurrentLevel() > 0 ? DynamicMode->GetCurrentLevel() : 1;
				StartDynamicGame(Level);
				return;
			}
			UE_LOG(LogTemp, Warning, TEXT("[AOLMain] START button — Dynamic level already running, ignored"));
			return;
		}

		if (IsValid(ChaosMode))
		{
			if (ChaosMode->GetState() == EChaosState::WaitingStart)
			{
				ChaosMode->OnStartPressed();
				return;
			}
			if (ChaosMode->GetState() == EChaosState::Idle || ChaosMode->GetState() == EChaosState::LevelEnded)
			{
				int32 Level = ChaosMode->GetCurrentLevel() > 0 ? ChaosMode->GetCurrentLevel() : 1;
				StartChaosGame(Level);
				return;
			}
			UE_LOG(LogTemp, Warning, TEXT("[AOLMain] START button — Chaos level already running"));
			return;
		}

		// No mode spawned — default to Classic (preserves existing behavior)
		StartClassicGame(1);
	}
	// Button 1 = END (complete level)
	else if (ButtonID == 1)
	{
		if (IsValid(ClassicMode) && ClassicMode->IsPlaying())
		{
			ClassicMode->CompleteLevel();
		}
		else if (IsValid(DynamicMode) && DynamicMode->IsPlaying())
		{
			DynamicMode->CompleteLevel();
		}
		else if (IsValid(ChaosMode) && ChaosMode->IsPlaying())
		{
			ChaosMode->CompleteLevel();
		}
	}
}

void AOLMain::SetStartButtonLight(bool bOn)
{
	if (uartYDGZ) uartYDGZ->SetButtonLight(4, bOn);  // channel 4 = START
}

void AOLMain::SetEndButtonLight(bool bOn)
{
	if (uartYDGZ) uartYDGZ->SetButtonLight(5, bOn);  // channel 5 = END
}

void AOLMain::SetButtonLightDirect(int32 Channel, bool bOn)
{
	if (uartYDGZ) uartYDGZ->SetButtonLight(Channel, bOn);
}

void AOLMain::StartClassicGame(int32 Level)
{
	if (!GetWorld()) return;

	if (IsValid(Game01))
	{
		Game01->StopGame();
		Game01->Destroy();
		Game01 = nullptr;
	}
	if (IsValid(ClassicMode))
	{
		ClassicMode->StopGame();
		ClassicMode->Destroy();
		ClassicMode = nullptr;
	}

	ClassicMode = GetWorld()->SpawnActor<AOLClassicMode>();
	if (!IsValid(ClassicMode)) return;

	ClassicMode->OnLasersReady.AddUObject(this, &AOLMain::OnClassicLasersReady);
	ClassicMode->OnLevelComplete.AddUObject(this, &AOLMain::OnClassicLevelComplete);
	ClassicMode->OnGameOver.AddUObject(this, &AOLMain::OnClassicGameOver);
	ClassicMode->OnLifeLost.AddUObject(this, &AOLMain::OnClassicLifeLost);

	ClassicMode->StartLevel(Level);

	SetStartButtonLight(true);   // START lit — waiting for press
	SetEndButtonLight(false);
	
	if (uartYDGZ) uartYDGZ->SetActiveButton(0);
	
	SetGameState(EOLGameMode::Classic, EOLGameState::WaitingStart);
	SetGameLevel(Level);
	SetLives(ClassicMode->GetLives());
	SetScore(ClassicMode->GetScore());
	SetRemainingSeconds(ClassicMode->GetTimeRemaining());

	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Classic game started, level %d"), Level);
}

void AOLMain::OnClassicLasersReady(const TArray<int32>& LaserIDs)
{
	// === Diagnostic: log exact IDs being sent to controller ===
	{
		FString IdsStr;
		for (int32 ID : LaserIDs)
		{
			IdsStr += FString::Printf(TEXT("%d, "), ID);
		}
		UE_LOG(LogTemp, Warning,
			TEXT("[AOLMain::Classic] Sending %d laser IDs to controller: {%s}"),
			LaserIDs.Num(), *IdsStr);
	}

	SetAllLEDs(EOLColorTypes::Off);

	TArray<int32> Arr;
	for (int32 ID : LaserIDs)
		Arr.Add(ID);

	SetOneLED(1, Arr, EOLColorTypes::White);

	// Update parser's ActiveLaserMask to match current pattern.
	// Without this, mask stays at default 0xFFFFFFFFFFFF and ANY laser
	// crossing triggers life loss — even lasers not part of this level's
	// pattern. Verified in stand test 2026-04-25: pattern was 8 lasers
	// {5, 6, 8, 22, 25, 27, 30, 46}, mask must reflect this exact set.
	if (uartYDGZ)
	{
		uint64 Mask = 0;
		for (int32 ID : LaserIDs)
		{
			if (ID >= 1 && ID <= 48)
				Mask |= (1ull << (ID - 1));
		}
		uartYDGZ->SetActiveLaserMask(Mask);
		UE_LOG(LogTemp, Warning,
			TEXT("[AOLMain::Classic] ActiveLaserMask set: 0x%012llX (%d lasers)"),
			(long long)Mask, LaserIDs.Num());
	}

	if (uartYDGZ)
	{
		uartYDGZ->ResetState();
		uartYDGZ->StartGracePeriod(1.0f);  // ignore triggers for 1s while sensors stabilize
	}

	SetStartButtonLight(false);  // START off while playing
	SetEndButtonLight(true);     // END lit — available as exit
	if (uartYDGZ) uartYDGZ->SetActiveButton(1);
	
	SetGameState(EOLGameMode::Classic, EOLGameState::Playing);

	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Classic lasers ready: %d lasers ON"), LaserIDs.Num());
}

void AOLMain::OnClassicLevelComplete()
{
	SetAllLEDs(EOLColorTypes::Off);
	SetStartButtonLight(false);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(-1);
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Classic level %d COMPLETE! Score: %d"),
		ClassicMode ? ClassicMode->GetCurrentLevel() : 0,
		ClassicMode ? ClassicMode->GetScore() : 0);

	FOLLevelResult R;
	R.Mode = EOLGameMode::Classic;
	R.Level = ClassicMode ? ClassicMode->GetCurrentLevel() : 0;
	R.FinalScore = ClassicMode ? ClassicMode->GetScore() : 0;
	R.LivesLeft = ClassicMode ? ClassicMode->GetLives() : 0;
	R.LivesBonus = R.LivesLeft * 500;
	R.TimeUsed = ClassicMode ? FMath::Max(0.f, 90.f - ClassicMode->GetTimeRemaining()) : 0.f;
	R.TimeBonus = FMath::RoundToInt(ClassicMode ? ClassicMode->GetTimeRemaining() : 0.f) * 10;
	R.bVictory = true;
	R.Reason = TEXT("Уровень пройден");

	SetScore(R.FinalScore);
	SetGameState(EOLGameMode::Classic, EOLGameState::LevelEnded);
	OnLevelComplete.Broadcast(R);
	SendLevelResultEvent(TEXT("match_completed"), R);
	
	if (ClassicMode && ClassicMode->GetCurrentLevel() < 10)
	{
		FTimerHandle TimerHandle;
		int32 NextLevel = ClassicMode->GetCurrentLevel() + 1;
		GetWorldTimerManager().SetTimer(TimerHandle, [this, NextLevel]()
		{
			StartClassicGame(NextLevel);
		}, 5.0f, false);

		UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Next level %d in 5 seconds..."), NextLevel);
	}
	else
	{
		UE_LOG(LogTemp, Warning, TEXT("[AOLMain] ALL 10 LEVELS COMPLETE! Final score: %d"),
			ClassicMode ? ClassicMode->GetScore() : 0);
	}
}

void AOLMain::OnClassicGameOver()
{
	SetAllLEDs(EOLColorTypes::Off);
	SetStartButtonLight(false);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(-1);
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Classic GAME OVER at level %d"),
		ClassicMode ? ClassicMode->GetCurrentLevel() : 0);
	
	FOLLevelResult R;
	R.Mode = EOLGameMode::Classic;
	R.Level = ClassicMode ? ClassicMode->GetCurrentLevel() : 0;
	R.FinalScore = ClassicMode ? ClassicMode->GetScore() : 0;
	R.LivesLeft = 0;
	R.TimeUsed = ClassicMode ? FMath::Max(0.f, 90.f - ClassicMode->GetTimeRemaining()) : 0.f;
	R.bVictory = false;
	R.Reason = (ClassicMode && ClassicMode->GetTimeRemaining() <= 0.f)
		? TEXT("Время вышло") : TEXT("Все жизни потеряны");
	
	SetScore(R.FinalScore);
	SetGameState(EOLGameMode::Classic, EOLGameState::LevelEnded);
	OnGameOver.Broadcast(R);
	SendLevelResultEvent(TEXT("match_completed"), R);
}

void AOLMain::OnClassicLifeLost(int32 LivesRemaining, int32 LaserID)
{
	SetLives(LivesRemaining);
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Life lost! Laser %d. Lives: %d"), LaserID, LivesRemaining);

	if (GEngine)
		GEngine->AddOnScreenDebugMessage(-1, 3.f, FColor::Red,
			FString::Printf(TEXT("LIFE LOST! Laser %d — %d lives left"), LaserID, LivesRemaining));
}

void AOLMain::StartDynamicGame(int32 Level)
{
	if (!GetWorld()) return;

	// Cleanup Classic if present
	if (IsValid(ClassicMode))
	{
		ClassicMode->StopGame();
		ClassicMode->Destroy();
		ClassicMode = nullptr;
	}

	// Cleanup previous Dynamic
	if (IsValid(DynamicMode))
	{
		DynamicMode->StopGame();
		DynamicMode->Destroy();
		DynamicMode = nullptr;
	}

	DynamicMode = GetWorld()->SpawnActor<AOLDynamicMode>();
	if (!IsValid(DynamicMode)) return;

	DynamicMode->OnLasersReady.AddUObject(this, &AOLMain::OnDynamicLasersReady);
	DynamicMode->OnLevelComplete.AddUObject(this, &AOLMain::OnDynamicLevelComplete);
	DynamicMode->OnGameOver.AddUObject(this, &AOLMain::OnDynamicGameOver);
	DynamicMode->OnLifeLost.AddUObject(this, &AOLMain::OnDynamicLifeLost);

	DynamicMode->StartLevel(Level);

	SetStartButtonLight(true);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(0);
	
	SetGameState(EOLGameMode::Dynamic, EOLGameState::WaitingStart);
	SetGameLevel(Level);
	SetLives(DynamicMode->GetLives());
	SetScore(DynamicMode->GetScore());
	SetRemainingSeconds(DynamicMode->GetTimeRemaining());

	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Dynamic game started, level %d"), Level);
}

void AOLMain::OnDynamicLasersReady(const FOLDynamicLevelCfg& Cfg)
{
	// === Diagnostic: Dynamic mode entered (actual IDs emerge later in
	// Game01LedStateChange via AOLGame01::GetStepIDs — instrument there if
	// per-step IDs are needed). ===
	UE_LOG(LogTemp, Warning,
		TEXT("[AOLMain::Dynamic] Lasers ready: %d columns, StepInterval=%.2f"),
		Cfg.Columns.Num(), Cfg.StepInterval);

	if (IsValid(Game01))
	{
		Game01->StopGame();
		Game01->Destroy();
		Game01 = nullptr;
	}

	Game01 = GetWorld()->SpawnActor<AOLGame01>();
	if (!IsValid(Game01)) return;

	Game01->SetOwner(this);
	Game01->ColumnConfigs = Cfg.Columns;
	Game01->StepInterval  = Cfg.StepInterval;

	Game01->OnLEDStateChange.AddUObject(this, &AOLMain::Game01LedStateChange);
	Game01->OnStepChanged.AddUObject(this, &AOLMain::OnGame01Step);

	// Column path requires bStartedGame=true; StartGame flips it (Rows can be empty for this mode).
	Game01->StartGame({}, Cfg.StepInterval, GameDirection);

	if (uartYDGZ)
	{
		uartYDGZ->ResetState();
		uartYDGZ->StartGracePeriod(1.0f);
	}

	SetStartButtonLight(false);
	SetEndButtonLight(true);
	if (uartYDGZ) uartYDGZ->SetActiveButton(1);

	SetGameState(EOLGameMode::Dynamic, EOLGameState::Playing);

	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Dynamic lasers animating (StepInterval=%.2f)"), Cfg.StepInterval);
}

void AOLMain::OnGame01Step(const TArray<int32>& CurrentLasers)
{
	if (IsValid(DynamicMode))
		DynamicMode->OnGame01StepChanged(CurrentLasers);
}

void AOLMain::OnDynamicLevelComplete()
{
	SetAllLEDs(EOLColorTypes::Off);
	SetStartButtonLight(false);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(-1);
	if (IsValid(Game01)) { Game01->StopGame(); Game01->Destroy(); Game01 = nullptr; }
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Dynamic level %d COMPLETE! Score: %d"),
		DynamicMode ? DynamicMode->GetCurrentLevel() : 0,
		DynamicMode ? DynamicMode->GetScore() : 0);
	
	FOLLevelResult R;
	R.Mode = EOLGameMode::Dynamic;
	R.Level = DynamicMode ? DynamicMode->GetCurrentLevel() : 0;
	R.FinalScore = DynamicMode ? DynamicMode->GetScore() : 0;
	R.LivesLeft = DynamicMode ? DynamicMode->GetLives() : 0;
	R.LivesBonus = R.LivesLeft * 500;
	R.TimeUsed = DynamicMode ? DynamicMode->GetTimeRemaining() : 0.f;
	R.bVictory = true;
	R.Reason = TEXT("Уровень пройден");

	SetScore(R.FinalScore);
	SetGameState(EOLGameMode::Dynamic, EOLGameState::LevelEnded);
	OnLevelComplete.Broadcast(R);
	SendLevelResultEvent(TEXT("match_completed"), R);
}

void AOLMain::OnDynamicGameOver()
{
	SetAllLEDs(EOLColorTypes::Off);
	SetStartButtonLight(false);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(-1);
	if (IsValid(Game01)) { Game01->StopGame(); Game01->Destroy(); Game01 = nullptr; }
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Dynamic GAME OVER at level %d"),
		DynamicMode ? DynamicMode->GetCurrentLevel() : 0);
	
	FOLLevelResult R;
	R.Mode = EOLGameMode::Dynamic;
	R.Level = DynamicMode ? DynamicMode->GetCurrentLevel() : 0;
	R.FinalScore = DynamicMode ? DynamicMode->GetScore() : 0;
	R.LivesLeft = 0;
	R.bVictory = false;
	R.Reason = TEXT("Все жизни потеряны");

	SetScore(R.FinalScore);
	SetGameState(EOLGameMode::Dynamic, EOLGameState::LevelEnded);
	OnGameOver.Broadcast(R);
	SendLevelResultEvent(TEXT("match_completed"), R);
}

void AOLMain::OnDynamicLifeLost(int32 LivesRemaining, int32 LaserID)
{
	SetLives(LivesRemaining);
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Dynamic life lost! Laser %d, Lives: %d"), LaserID, LivesRemaining);

	if (GEngine)
		GEngine->AddOnScreenDebugMessage(-1, 3.f, FColor::Red,
			FString::Printf(TEXT("LIFE LOST (Dynamic)! Laser %d — %d left"), LaserID, LivesRemaining));
}

void AOLMain::StartChaosGame(int32 Level)
{
	if (!GetWorld()) return;

	if (IsValid(ClassicMode)) { ClassicMode->StopGame(); ClassicMode->Destroy(); ClassicMode = nullptr; }
	if (IsValid(DynamicMode)) { DynamicMode->StopGame(); DynamicMode->Destroy(); DynamicMode = nullptr; }
	if (IsValid(ChaosMode))   { ChaosMode->StopGame();   ChaosMode->Destroy();   ChaosMode = nullptr; }
	if (IsValid(Game01))      { Game01->StopGame();       Game01->Destroy();       Game01 = nullptr; }

	ChaosMode = GetWorld()->SpawnActor<AOLChaosMode>();
	if (!IsValid(ChaosMode)) return;

	ChaosMode->OnLasersReady.AddUObject(this, &AOLMain::OnChaosLasersReady);
	ChaosMode->OnLEDUpdate.AddUObject(this, &AOLMain::OnChaosLEDUpdate);
	ChaosMode->OnLevelComplete.AddUObject(this, &AOLMain::OnChaosLevelComplete);
	ChaosMode->OnGameOver.AddUObject(this, &AOLMain::OnChaosGameOver);
	ChaosMode->OnLifeLost.AddUObject(this, &AOLMain::OnChaosLifeLost);
	ChaosMode->OnIntroEnd.AddUObject(this, &AOLMain::OnChaosIntroEnd);

	ChaosMode->StartLevel(Level);
	SetStartButtonLight(true);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(0);
	
	SetGameState(EOLGameMode::Chaos, EOLGameState::WaitingStart);
	SetGameLevel(Level);
	SetLives(ChaosMode->GetLives());
	SetScore(ChaosMode->GetScore());
	SetRemainingSeconds(ChaosMode->GetTimeRemaining());

	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Chaos game started, level %d"), Level);
}

void AOLMain::OnChaosLasersReady(const FOLChaosLevelCfg& Cfg)
{
	// === Diagnostic: Chaos mode entered (actual IDs emerge later via
	// Game01LedStateChange and OnChaosLEDUpdate — instrument there if
	// per-step IDs are needed). ===
	UE_LOG(LogTemp, Warning,
		TEXT("[AOLMain::Chaos] Lasers ready: NumStatic=%d, NumMoving=%d, MoveSpeed=%.2f"),
		Cfg.NumStatic, Cfg.NumMoving, Cfg.MoveSpeed);

	if (IsValid(Game01)) { Game01->StopGame(); Game01->Destroy(); Game01 = nullptr; }

	if (Cfg.NumMoving > 0)
	{
		Game01 = GetWorld()->SpawnActor<AOLGame01>();
		if (IsValid(Game01))
		{
			Game01->SetOwner(this);
			Game01->ColumnConfigs.SetNum(Cfg.NumMoving);
			for (int32 i = 0; i < Cfg.NumMoving; i++)
			{
				Game01->ColumnConfigs[i].Mode = (i < Cfg.MoveDirs.Num()) ? Cfg.MoveDirs[i] : EOLColumnMode::Down;
				Game01->ColumnConfigs[i].StartDelay = 0.f;
			}
			Game01->StepInterval = Cfg.MoveSpeed;
			Game01->OnLEDStateChange.AddUObject(this, &AOLMain::Game01LedStateChange);
			Game01->OnStepChanged.AddUObject(this, &AOLMain::OnGame01StepChaos);
			Game01->StartGame({}, Cfg.MoveSpeed, GameDirection);
		}
	}

	if (uartYDGZ)
	{
		uartYDGZ->ResetState();
		uartYDGZ->StartGracePeriod(1.0f);
	}

	SetStartButtonLight(false);
	SetEndButtonLight(true);
	if (uartYDGZ) uartYDGZ->SetActiveButton(1);
	
	SetGameState(EOLGameMode::Chaos, EOLGameState::Playing);

	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Chaos lasers ready"));
}

void AOLMain::OnGame01StepChaos(const TArray<int32>& CurrentLasers)
{
	if (IsValid(ChaosMode))
		ChaosMode->OnGame01StepChanged(CurrentLasers);
}

void AOLMain::OnChaosLEDUpdate(const TArray<int32>& ActiveLasers)
{
	float Now = GetWorld()->GetTimeSeconds();
	if (Now - LastLedChangeTime < 0.05f) return;
	LastLedChangeTime = Now;

	SetAllLEDs(EOLColorTypes::Off);
	if (ActiveLasers.Num() > 0)
	{
		TArray<int32> IDs(ActiveLasers);
		SetOneLED(1, IDs, EOLColorTypes::White);
	}
}

void AOLMain::OnChaosIntroEnd()
{
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Chaos intro finished, gameplay starting"));
}

void AOLMain::OnChaosLevelComplete()
{
	SetAllLEDs(EOLColorTypes::Off);
	SetStartButtonLight(false);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(-1);
	if (IsValid(Game01)) { Game01->StopGame(); Game01->Destroy(); Game01 = nullptr; }
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Chaos level %d COMPLETE! Score: %d"),
		ChaosMode ? ChaosMode->GetCurrentLevel() : 0,
		ChaosMode ? ChaosMode->GetScore() : 0);
	
	FOLLevelResult R;
	R.Mode = EOLGameMode::Chaos;
	R.Level = ChaosMode ? ChaosMode->GetCurrentLevel() : 0;
	R.FinalScore = ChaosMode ? ChaosMode->GetScore() : 0;
	R.LivesLeft = ChaosMode ? ChaosMode->GetLives() : 0;
	R.LivesBonus = R.LivesLeft * 500;
	R.TimeUsed = ChaosMode ? ChaosMode->GetTimeRemaining() : 0.f;
	R.bVictory = true;
	R.Reason = TEXT("Уровень пройден");

	SetScore(R.FinalScore);
	SetGameState(EOLGameMode::Chaos, EOLGameState::LevelEnded);
	OnLevelComplete.Broadcast(R);
	SendLevelResultEvent(TEXT("match_completed"), R);
}

void AOLMain::OnChaosGameOver()
{
	SetAllLEDs(EOLColorTypes::Off);
	SetStartButtonLight(false);
	SetEndButtonLight(false);
	if (uartYDGZ) uartYDGZ->SetActiveButton(-1);
	if (IsValid(Game01)) { Game01->StopGame(); Game01->Destroy(); Game01 = nullptr; }
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Chaos GAME OVER at level %d"),
		ChaosMode ? ChaosMode->GetCurrentLevel() : 0);
	
	FOLLevelResult R;
	R.Mode = EOLGameMode::Chaos;
	R.Level = ChaosMode ? ChaosMode->GetCurrentLevel() : 0;
	R.FinalScore = ChaosMode ? ChaosMode->GetScore() : 0;
	R.LivesLeft = 0;
	R.bVictory = false;
	R.Reason = TEXT("Все жизни потеряны");

	SetScore(R.FinalScore);
	SetGameState(EOLGameMode::Chaos, EOLGameState::LevelEnded);
	OnGameOver.Broadcast(R);
	SendLevelResultEvent(TEXT("match_completed"), R);
}

void AOLMain::OnChaosLifeLost(int32 LivesRemaining, int32 LaserID)
{
	SetLives(LivesRemaining);
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain] Chaos life lost! Laser %d, Lives: %d"), LaserID, LivesRemaining);
	if (GEngine)
		GEngine->AddOnScreenDebugMessage(-1, 3.f, FColor::Red,
			FString::Printf(TEXT("CHAOS LIFE LOST! Laser %d — %d left"), LaserID, LivesRemaining));
}

// ===== HUD STATE BROADCASTERS =====

void AOLMain::SetLives(int32 NewLives)
{
	if (CurrentLives == NewLives) return;
	CurrentLives = NewLives;
	OnLivesChanged.Broadcast(NewLives);
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HUD] Lives -> %d"), NewLives);
}

void AOLMain::SetScore(int32 NewScore)
{
	if (CurrentScore == NewScore) return;
	CurrentScore = NewScore;
	OnScoreChanged.Broadcast(NewScore);
}

void AOLMain::SetRemainingSeconds(float Seconds)
{
	const int32 OldInt = FMath::FloorToInt(RemainingSeconds);
	const int32 NewInt = FMath::FloorToInt(Seconds);
	RemainingSeconds = Seconds;
	if (OldInt != NewInt)
	{
		OnTimeChanged.Broadcast(Seconds);
	}
}

void AOLMain::SetGameState(EOLGameMode Mode, EOLGameState State)
{
	if (CurrentMode == Mode && CurrentState == State) return;
	CurrentMode = Mode;
	CurrentState = State;
	OnStateChanged.Broadcast(Mode, State);

	const TCHAR* ModeName = TEXT("None");
	switch (Mode) {
		case EOLGameMode::Classic: ModeName = TEXT("Classic"); break;
		case EOLGameMode::Dynamic: ModeName = TEXT("Dynamic"); break;
		case EOLGameMode::Chaos:   ModeName = TEXT("Chaos");   break;
		default: break;
	}
	const TCHAR* StateName = TEXT("Idle");
	switch (State) {
		case EOLGameState::WaitingStart: StateName = TEXT("WaitingStart"); break;
		case EOLGameState::Countdown:    StateName = TEXT("Countdown");    break;
		case EOLGameState::Playing:      StateName = TEXT("Playing");      break;
		case EOLGameState::LevelEnded:   StateName = TEXT("LevelEnded");   break;
		default: break;
	}
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HUD] State -> %s / %s"), ModeName, StateName);
}

void AOLMain::SetGameLevel(int32 Level)
{
	if (CurrentLevel == Level) return;
	CurrentLevel = Level;
	OnLevelStarted.Broadcast(CurrentMode, Level);
	UE_LOG(LogTemp, Warning, TEXT("[AOLMain::HUD] Level -> %d"), Level);
}
