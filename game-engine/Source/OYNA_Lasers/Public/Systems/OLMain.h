#pragma once

#include "CoreMinimal.h"
#include "CMD/OLCmdIO_YDGZObject.h"
#include "CMD/OLDriverWSClient.h"
#include "CMD/OLUARTSerialPluginObject.h"
#include "UI/OLMainWidget.h"
#include "Blueprint/UserWidget.h"
#include "GameFramework/Actor.h"
#include "Games/OLGame01.h"
#include "Games/OLClassicMode.h"
#include "Games/OLDynamicMode.h"
#include "Games/OLChaosMode.h"
#include "HUD/OLGameHUDWidget.h"
#include "OLMain.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOLLivesChanged, int32, NewLives);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOLScoreChanged, int32, NewScore);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOLTimeChanged, float, RemainingSeconds);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnOLStateChanged, EOLGameMode, Mode, EOLGameState, State);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnOLLevelStarted, EOLGameMode, Mode, int32, Level);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOLLevelCompleteEvent, const FOLLevelResult&, Result);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOLGameOverEvent, const FOLLevelResult&, Result);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnOLLaserHit, int32, LaserID);

UCLASS()
class OYNA_LASERS_API AOLMain : public AActor
{
	GENERATED_BODY()

public:
	AOLMain();
	virtual void Tick(float DeltaTime) override;

	void SetDebugSending(const bool DebugSending) { bDebugSending = DebugSending; }
	bool GetDebugSending() const { return bDebugSending; }

	void SetDebugReceiving(int32 Byte);

	// Parser accessor — used by OLCheatManager for hardware-free parser tests.
	UOLCmdIO_YDGZObject* GetUartYDGZ() const { return uartYDGZ; }

	void SetGameMode(const int32 Game005) { GameMode = Game005; }
	int32 GetGameMode() const { return GameMode; }

	void ToggleBitValueZeroYDGZ() const;

	void SendModeSwitchYDGZ() const;
	void CreateMainWidget();

	// Called by AOLGameManager to drive the hardware LEDs
	UFUNCTION()
	void SetAllLEDs(EOLColorTypes ColorType);

	UFUNCTION()
	void SetOneLED(int32 Channel, TArray<int32> IDs, EOLColorTypes ColorType);

	UFUNCTION(BlueprintCallable)
	void SetStartButtonLight(bool bOn);

	UFUNCTION(BlueprintCallable)
	void SetEndButtonLight(bool bOn);

	void SetButtonLightDirect(int32 Channel, bool bOn);

	// Keyboard workaround for physical START/END (old-protocol controller
	// does not route physical buttons through UART).
	void OnKeyboardStart();
	void OnKeyboardEnd();

	// ==== HUD EVENTS ====
	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLLivesChanged OnLivesChanged;

	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLScoreChanged OnScoreChanged;

	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLTimeChanged OnTimeChanged;

	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLStateChanged OnStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLLevelStarted OnLevelStarted;

	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLLevelCompleteEvent OnLevelComplete;

	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLGameOverEvent OnGameOver;

	UPROPERTY(BlueprintAssignable, Category = "OYNA|HUD")
	FOnOLLaserHit OnLaserHit;

	UFUNCTION(BlueprintCallable, Category = "OYNA|HUD")
	int32 GetCurrentLives() const { return CurrentLives; }

	UFUNCTION(BlueprintCallable, Category = "OYNA|HUD")
	int32 GetCurrentScore() const { return CurrentScore; }

	UFUNCTION(BlueprintCallable, Category = "OYNA|HUD")
	float GetRemainingSeconds() const { return RemainingSeconds; }

	UFUNCTION(BlueprintCallable, Category = "OYNA|HUD")
	EOLGameMode GetCurrentMode() const { return CurrentMode; }

	UFUNCTION(BlueprintCallable, Category = "OYNA|HUD")
	EOLGameState GetCurrentState() const { return CurrentState; }

	UFUNCTION(BlueprintCallable, Category = "OYNA|HUD")
	int32 GetCurrentLevel() const { return CurrentLevel; }

	// ==== NEW: Game HUD (Part 2A infra — widget class set from BP_OLMain) ====
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "OYNA|HUD")
	TSubclassOf<UUserWidget> GameHUDClass;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|HUD")
	TObjectPtr<UOLGameHUDWidget> GameHUDWidget = nullptr;

	// Debug broadcast hooks — used by cheat commands to exercise HUD without hardware.
	UFUNCTION(BlueprintCallable, Category = "OYNA|Debug")
	void DebugBroadcastLivesChanged(int32 NewLives) { OnLivesChanged.Broadcast(NewLives); }

	UFUNCTION(BlueprintCallable, Category = "OYNA|Debug")
	void DebugBroadcastScoreChanged(int32 NewScore) { OnScoreChanged.Broadcast(NewScore); }

	UFUNCTION(BlueprintCallable, Category = "OYNA|Debug")
	void DebugBroadcastTimeChanged(float Seconds) { OnTimeChanged.Broadcast(Seconds); }

	UFUNCTION(BlueprintCallable, Category = "OYNA|Debug")
	void DebugBroadcastLaserHit(int32 LaserID) { OnLaserHit.Broadcast(LaserID); }

	UFUNCTION(BlueprintCallable, Category = "OYNA|Debug")
	void DebugBroadcastLevelComplete(const FOLLevelResult& R) { OnLevelComplete.Broadcast(R); }

	UFUNCTION(BlueprintCallable, Category = "OYNA|Debug")
	void DebugBroadcastGameOver(const FOLLevelResult& R) { OnGameOver.Broadcast(R); }

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	UFUNCTION()
	void Connect(int32 Port, int32 Baud);
	void Disconnect();
	void SetLEDInfo();

	UFUNCTION()
	void StartGame(const EOLGameMode GameType, const int32 Level);
	
	UFUNCTION()
	void TurnOnGame(EOLGameType GameType, TArray<int32> Raws, float IntervalTime);
	
	UFUNCTION()
	void StopGames();
	
	void Game01LedStateChange(TArray<int32>& Array, EOLLEDState EOLLEDState);
	
	void HandleButton(int32 Index);
	void HandleCoin();

public:
	void HandlePhysicalButton(int32 ButtonID);
	void StartClassicGame(int32 Level);
	AOLClassicMode* GetClassicMode() const { return ClassicMode; }
	void OnClassicLasersReady(const TArray<int32>& LaserIDs);
	void OnClassicLevelComplete();
	void OnClassicGameOver();
	void OnClassicLifeLost(int32 LivesRemaining, int32 LaserID);

	UFUNCTION(BlueprintCallable)
	void StartDynamicGame(int32 Level);

	AOLDynamicMode* GetDynamicMode() const { return DynamicMode; }
	void OnDynamicLasersReady(const FOLDynamicLevelCfg& Cfg);
	void OnDynamicLevelComplete();
	void OnDynamicGameOver();
	void OnDynamicLifeLost(int32 LivesRemaining, int32 LaserID);
	void OnGame01Step(const TArray<int32>& CurrentLasers);

	UFUNCTION(BlueprintCallable)
	void StartChaosGame(int32 Level);

	AOLChaosMode* GetChaosMode() const { return ChaosMode; }
	void OnChaosLasersReady(const FOLChaosLevelCfg& Cfg);
	void OnChaosLEDUpdate(const TArray<int32>& ActiveLasers);
	void OnChaosLevelComplete();
	void OnChaosGameOver();
	void OnChaosLifeLost(int32 LivesRemaining, int32 LaserID);
	void OnChaosIntroEnd();
	void OnGame01StepChaos(const TArray<int32>& CurrentLasers);

protected:
	UPROPERTY()
	TObjectPtr<AOLClassicMode> ClassicMode = nullptr;

	UPROPERTY()
	TObjectPtr<AOLDynamicMode> DynamicMode = nullptr;

	UPROPERTY()
	TObjectPtr<AOLChaosMode> ChaosMode = nullptr;

	UFUNCTION(BlueprintCallable)
	void SetGameOver();

	UFUNCTION()
	void ChangeConnectionType(bool UART);
	
	void DriverWSClient_OnMessage(const FString& String);
	void DispatchEvent(const TSharedPtr<FJsonObject>& Json);
	void SendLevelResultEvent(const TCHAR* EventName, const FOLLevelResult& Result);

	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TSubclassOf<UOLMainWidget> MainWidgetClass = nullptr;

	UPROPERTY(BlueprintReadOnly)
	TObjectPtr<UOLMainWidget> MainWidget = nullptr;

	FString CurrentCrmSessionId;

	UPROPERTY()
	TObjectPtr<UOLCmdIO_YDGZObject> uartYDGZ = nullptr;

	UPROPERTY()
	TObjectPtr<UOLUARTSerialPluginObject> Serial = nullptr;
	
	bool bDebugSending = false;
	bool bDebugReceiving = false;

	UPROPERTY()
	TObjectPtr<AOLGame01> Game01 = nullptr;
	
	UPROPERTY()
	TObjectPtr<UOLDriverWSClient> DriverWSClient = nullptr;
	
	bool bUART = true;
	int32 GameMode = 5;
	float LastLedChangeTime = 0.f;

public:
	UPROPERTY(BlueprintReadWrite, Category = "Game")
	EOLDirection GameDirection = EOLDirection::Right;

protected:
	// Mirror of game state, kept in sync via Set* helpers.
	UPROPERTY() int32 CurrentLives = 3;
	UPROPERTY() int32 CurrentScore = 0;
	UPROPERTY() float RemainingSeconds = 0.f;
	UPROPERTY() EOLGameMode CurrentMode = EOLGameMode::None;
	UPROPERTY() EOLGameState CurrentState = EOLGameState::Idle;
	UPROPERTY() int32 CurrentLevel = 0;

	void SetLives(int32 NewLives);
	void SetScore(int32 NewScore);
	void SetRemainingSeconds(float Seconds);
	void SetGameState(EOLGameMode Mode, EOLGameState State);
	void SetGameLevel(int32 Level);

private:
	int32 ModeSwitchSentCount = 0;
	bool bFullInitDone = false;
	FTimerHandle HeartbeatTimer;
};
