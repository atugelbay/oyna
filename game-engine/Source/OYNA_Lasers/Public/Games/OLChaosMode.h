#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Games/OLGame01.h"
#include "OLChaosMode.generated.h"

enum class EChaosState : uint8 { Idle, Intro, WaitingStart, Playing, LevelEnded };

USTRUCT()
struct FOLChaosLevelCfg
{
	GENERATED_BODY()
	int32 NumStatic = 6;
	int32 NumMoving = 2;
	TArray<EOLColumnMode> MoveDirs;
	float MoveSpeed = 0.8f;
	float SwapEvery = 0.f;
	float BlackoutEvery = 0.f;
	float BlackoutDuration = 1.f;
	float ExpandEvery = 0.f;
	int32 ExpandCount = 2;
	int32 IntroType = 0;
};

DECLARE_MULTICAST_DELEGATE_OneParam(FOnChaosLasersReady, const FOLChaosLevelCfg&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnChaosLEDUpdate, const TArray<int32>&);
DECLARE_MULTICAST_DELEGATE(FOnChaosLevelComplete);
DECLARE_MULTICAST_DELEGATE(FOnChaosGameOver);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnChaosLifeLost, int32 /*LivesRemaining*/, int32 /*LaserID*/);
DECLARE_MULTICAST_DELEGATE(FOnChaosIntroEnd);

UCLASS()
class OYNA_LASERS_API AOLChaosMode : public AActor
{
	GENERATED_BODY()

public:
	AOLChaosMode();
	virtual void Tick(float DeltaTime) override;

	void StartLevel(int32 Level);
	void OnStartPressed();
	void StopGame();
	void CompleteLevel();
	void OnLaserTriggered(int32 LaserID);
	void OnGame01StepChanged(const TArray<int32>& MovingLaserIDs);

	EChaosState GetState() const { return State; }
	bool IsPlaying() const { return State == EChaosState::Playing; }
	int32 GetCurrentLevel() const { return CurrentLevel; }
	int32 GetLives() const { return Lives; }
	int32 GetScore() const { return Score; }
	float GetTimeRemaining() const { return TimeRemaining; }
	const FOLChaosLevelCfg& GetCurrentConfig() const { return CurrentConfig; }

	void SetLevelDuration(float Seconds);
	void SetLives(int32 NewLives);

	FOnChaosLasersReady   OnLasersReady;
	FOnChaosLEDUpdate     OnLEDUpdate;
	FOnChaosLevelComplete OnLevelComplete;
	FOnChaosGameOver      OnGameOver;
	FOnChaosLifeLost      OnLifeLost;
	FOnChaosIntroEnd      OnIntroEnd;

private:
	static FOLChaosLevelCfg BuildLevelConfig(int32 Level);
	void RegeneratePattern();
	TArray<int32> GetAllActiveLasers() const;

	int32 CurrentLevel = 0;
	int32 Lives = 3;
	float LevelDuration = 90.f;
	float TimeRemaining = 90.f;
	int32 Score = 0;
	EChaosState State = EChaosState::Idle;
	FOLChaosLevelCfg CurrentConfig;

	TArray<int32> StaticLasers;

	TArray<int32> MovingLaserIDs;

	float SwapTimer = 0.f;
	float BlackoutTimer = 0.f;
	bool bBlackoutActive = false;
	float BlackoutEndTime = 0.f;
	float ExpandTimer = 0.f;
	int32 ExtraStaticCount = 0;

	bool bSwapWarning = false;
	float SwapWarningStart = 0.f;

	float IntroTimer = 0.f;
	static constexpr float IntroDuration = 5.0f;

	TArray<int32> PrevActiveLasers;
};
