#pragma once

#include "CoreMinimal.h"
#include "Types/Types.h"
#include "Structs.generated.h"

USTRUCT(BlueprintType)
struct OYNA_LASERS_API FOLLedInfo
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly)
	int32 ID = 0;

	UPROPERTY(BlueprintReadOnly)
	int32 Row = 0;

	UPROPERTY(BlueprintReadOnly)
	int32 Col = 0;

	UPROPERTY(BlueprintReadOnly)
	EOLLEDState Status = EOLLEDState::Off;

	UPROPERTY(BlueprintReadOnly)
	EOLColorTypes Color = EOLColorTypes::Off;
};
