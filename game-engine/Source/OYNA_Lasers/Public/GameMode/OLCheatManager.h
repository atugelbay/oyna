#pragma once

#include "CoreMinimal.h"
#include "GameFramework/CheatManager.h"
#include "OLCheatManager.generated.h"

UCLASS()
class OYNA_LASERS_API UOLCheatManager : public UCheatManager
{
	GENERATED_BODY()
	
public:
	UFUNCTION(Exec)
	void ToggleDebugSending() const;
	
	UFUNCTION(Exec)
	void DebugReceivingByte(int32 Byte) const;
	
	UFUNCTION(Exec)
	void DebugReceivingBytes(const FString& Bytes) const;
	
	UFUNCTION(Exec)
	void SetGame005(const int32 Game005) const;
	
	UFUNCTION(Exec)
	void ToggleBitValueZero() const;

	UFUNCTION(Exec)
	void SetDirRight();
	UFUNCTION(Exec)
	void SetDirLeft();
	UFUNCTION(Exec)
	void SetDirDown();
	UFUNCTION(Exec)
	void SetDirUp();

	UFUNCTION(Exec)
	void StartClassic();

	UFUNCTION(Exec)
	void StartClassicLevel(int32 Level);

	UFUNCTION(Exec)
	void SimulateStartButton();

	UFUNCTION(Exec)
	void SimulateEndButton();

	UFUNCTION(Exec)
	void SetClassicTime(float Seconds);

	UFUNCTION(Exec)
	void SetClassicLives(int32 Lives);

	UFUNCTION(Exec)
	void StartLight(bool bOn);

	UFUNCTION(Exec)
	void EndLight(bool bOn);

	UFUNCTION(Exec)
	void StartDynamic();

	UFUNCTION(Exec)
	void StartDynamicLevel(int32 Level);

	UFUNCTION(Exec)
	void StartChaos();

	UFUNCTION(Exec)
	void StartChaosLevel(int32 Level);

	UFUNCTION(Exec)
	void SendModeSwitch();

	UFUNCTION(Exec)
	void TestEndChannel(int32 Channel);

	UFUNCTION(Exec)
	void TestEndChannelAll();

	// ==== HUD simulation cheats (Part 2A) — exercise HUD without hardware ====
	UFUNCTION(Exec)
	void SimulateLifeLost(int32 LaserID = 42);

	UFUNCTION(Exec)
	void SimulateScoreChange(int32 NewScore);

	UFUNCTION(Exec)
	void SimulateLevelComplete();

	UFUNCTION(Exec)
	void SimulateGameOver(const FString& Reason);

	UFUNCTION(Exec)
	void SimulateTimeRemaining(float Seconds);

	// ==== Parser test cheats (Commit 2) — no hardware required ====
	UFUNCTION(Exec)
	void CheatInjectFrameHex(const FString& HexStr);

	UFUNCTION(Exec)
	void CheatSetActiveMaskBit(int32 LaserID);

	UFUNCTION(Exec)
	void CheatClearActiveMask();

	UFUNCTION(Exec)
	void CheatResetBaseline();
};
