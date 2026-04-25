#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Types/Types.h"
#include "OLGame01.generated.h"

UENUM(BlueprintType)
enum class EOLDirection : uint8
{
	Right = 0,   // row sweep: col 0→7 (left to right)
	Left  = 1,   // row sweep: col 7→0 (right to left)
	Down  = 2,   // column sweep: row 0→5 (top to bottom)
	Up    = 3    // column sweep: row 5→0 (bottom to top)
};

UENUM(BlueprintType)
enum class EOLColumnMode : uint8
{
	Off    UMETA(DisplayName = "Off"),
	Up     UMETA(DisplayName = "Up"),
	Down   UMETA(DisplayName = "Down"),
	Both   UMETA(DisplayName = "Up and Down")
};

USTRUCT(BlueprintType)
struct FOLColumnConfig
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite)
	EOLColumnMode Mode = EOLColumnMode::Off;

	UPROPERTY(BlueprintReadWrite)
	float StartDelay = 0.0f;
};

DECLARE_MULTICAST_DELEGATE_TwoParams(FOnLEDStateChange, TArray<int32>& IDs, EOLLEDState State);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnGame01Step, const TArray<int32>&);

UCLASS()
class OYNA_LASERS_API AOLGame01 : public AActor
{
	GENERATED_BODY()

public:
	AOLGame01();

	void StartGame(TArray<int32> InRows, float InTime, EOLDirection InDirection = EOLDirection::Right);
	void StopGame();

	TArray<int32> GetStepIDs(int32 Step) const;

	FOnLEDStateChange OnLEDStateChange;
	FOnGame01Step OnStepChanged;

	// Per-column animation config (size 8, one per column). When non-empty,
	// Tick drives per-column animation instead of the row-sweep behavior.
	UPROPERTY(BlueprintReadWrite)
	TArray<FOLColumnConfig> ColumnConfigs;

	UPROPERTY(BlueprintReadWrite)
	float StepInterval = 0.7f;

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;

	struct FColState
	{
		int32 PosUp = 0;
		int32 PosDown = 5;
		bool bInitialized = false;
	};

	TArray<int32> Rows = {};
	float TimeInterval = 0.0f;

	EOLDirection Direction  = EOLDirection::Right;
	int32 CurrentStep = 0;
	int32 NumSteps    = 8;
	float CurrentTime = 0.0f;
	bool  bStartedGame = false;

private:
	TArray<FColState> ColStates;
	float ElapsedTime = 0.f;
	float StepAccumulator = 0.f;
};
