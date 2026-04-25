#pragma once

#include "CoreMinimal.h"
#include "Types.generated.h"

constexpr uint32 HEX_COLOR_RED   = 0x00FF0000;
constexpr uint32 HEX_COLOR_GREEN = 0x0000FF00;
constexpr uint32 HEX_COLOR_BLUE  = 0x000000FF;
constexpr uint32 HEX_COLOR_WHITE = 0x00FFFFFF;
constexpr uint32 HEX_COLOR_OFF   = 0x00000000;

constexpr uint32 DEC_COLOR_RED   = 16711680U;
constexpr uint32 DEC_COLOR_GREEN = 65280U;
constexpr uint32 DEC_COLOR_BLUE  = 255U;
constexpr uint32 DEC_COLOR_WHITE = 16777215U;
constexpr uint32 DEC_COLOR_OFF   = 0U;

UENUM(BlueprintType, Blueprintable)
enum class EOLColorTypes : uint8
{
	White,
	Red,
	Green,
	Blue,
	Off,
};

UENUM(BlueprintType, Blueprintable)
enum class EOLLEDState : uint8
{
	On,
	Off,
};

UENUM(BlueprintType, Blueprintable)
enum class EOLLEDMapType : uint8
{
	Type1,
	Type2,
	Type3,
	Type4,
};

UENUM(BlueprintType, Blueprintable)
enum class EOLGameType : uint8
{
	Type1,
	Type2,
	Type3,
	Type4,
};

UENUM(BlueprintType)
enum class EOLGameMode : uint8
{
	None     UMETA(DisplayName = "None"),
	Classic  UMETA(DisplayName = "Classic"),
	Dynamic  UMETA(DisplayName = "Dynamic"),
	Chaos    UMETA(DisplayName = "Chaos"),
};

UENUM(BlueprintType)
enum class EOLGameState : uint8
{
	Idle           UMETA(DisplayName = "Idle"),
	WaitingStart   UMETA(DisplayName = "WaitingStart"),
	Countdown      UMETA(DisplayName = "Countdown"),
	Playing        UMETA(DisplayName = "Playing"),
	LevelEnded     UMETA(DisplayName = "LevelEnded"),
};

USTRUCT(BlueprintType)
struct FOLLevelResult
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	EOLGameMode Mode = EOLGameMode::None;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	int32 Level = 0;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	int32 FinalScore = 0;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	int32 LivesLeft = 0;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	int32 LivesBonus = 0;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	float TimeUsed = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	int32 TimeBonus = 0;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	bool bVictory = false;

	UPROPERTY(BlueprintReadOnly, Category = "OYNA|Result")
	FString Reason;
};
