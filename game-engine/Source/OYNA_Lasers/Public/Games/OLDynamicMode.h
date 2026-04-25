#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Games/OLGame01.h"
#include "OLDynamicMode.generated.h"

enum class EDynamicState : uint8
{
	Idle,
	WaitingStart,
	Playing,
	LevelEnded
};

USTRUCT()
struct FOLDynamicLevelCfg
{
	GENERATED_BODY()

	UPROPERTY()
	TArray<FOLColumnConfig> Columns;

	UPROPERTY()
	float StepInterval = 0.7f;
};

DECLARE_MULTICAST_DELEGATE_OneParam(FOnDynamicLasersReady, const FOLDynamicLevelCfg&);
DECLARE_MULTICAST_DELEGATE(FOnDynamicLevelComplete);
DECLARE_MULTICAST_DELEGATE(FOnDynamicGameOver);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnDynamicLifeLost, int32 /*LivesRemaining*/, int32 /*LaserID*/);

UCLASS()
class OYNA_LASERS_API AOLDynamicMode : public AActor
{
	GENERATED_BODY()

public:
	AOLDynamicMode();
	virtual void Tick(float DeltaTime) override;

	void StartLevel(int32 Level);
	void OnStartPressed();
	void StopGame();
	void CompleteLevel();
	void OnLaserTriggered(int32 LaserID);

	void OnGame01StepChanged(const TArray<int32>& CurrentlyOnLaserIDs);

	EDynamicState GetState() const { return State; }
	bool IsPlaying() const { return State == EDynamicState::Playing; }
	int32 GetCurrentLevel() const { return CurrentLevel; }
	int32 GetLives() const { return Lives; }
	int32 GetScore() const { return Score; }
	float GetTimeRemaining() const { return TimeRemaining; }
	const FOLDynamicLevelCfg& GetCurrentConfig() const { return CurrentConfig; }

	void SetLevelDuration(float Seconds) { LevelDuration = Seconds; if (IsPlaying()) TimeRemaining = Seconds; }
	void SetLives(int32 NewLives);

	FOnDynamicLasersReady   OnLasersReady;
	FOnDynamicLevelComplete OnLevelComplete;
	FOnDynamicGameOver      OnGameOver;
	FOnDynamicLifeLost      OnLifeLost;

private:
	static FOLDynamicLevelCfg BuildLevelConfig(int32 Level);

	int32 CurrentLevel  = 0;
	int32 Lives         = 3;
	float LevelDuration = 90.f;
	float TimeRemaining = 90.f;
	int32 Score         = 0;
	EDynamicState State = EDynamicState::Idle;

	FOLDynamicLevelCfg CurrentConfig;
	TSet<int32> ActiveLaserSet;
};
