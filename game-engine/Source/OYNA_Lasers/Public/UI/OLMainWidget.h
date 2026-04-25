#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Types/Structs.h"
#include "OLMainWidget.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FOnConfirmConfigs,   int32, Channel, TArray<int32>, IDs, EOLColorTypes, ColorType);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam   (FOnConfirmAllLeds,   EOLColorTypes, ColorType);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams  (FOnConfirmPortChange, int32, Port, int32, Baud);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FOnSelectGameType,    EOLGameType, GameType, TArray<int32>, Raws, float, IntervalTime);
DECLARE_DYNAMIC_MULTICAST_DELEGATE           (FOnStopGames);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam  (FOnChangeConnectionType, bool, bUART);

UCLASS()
class OYNA_LASERS_API UOLMainWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintNativeEvent)
	void ShowGameOver();

	UPROPERTY(BlueprintAssignable, BlueprintCallable)
	FOnConfirmConfigs OnConfirmConfigs;

	UPROPERTY(BlueprintAssignable, BlueprintCallable)
	FOnConfirmAllLeds OnConfirmAllLeds;

	UPROPERTY(BlueprintAssignable, BlueprintCallable)
	FOnConfirmPortChange OnConfirmPortChange;

	UPROPERTY(BlueprintAssignable, BlueprintCallable)
	FOnSelectGameType OnSelectGameType;

	UPROPERTY(BlueprintAssignable, BlueprintCallable)
	FOnStopGames OnStopGames;

	UPROPERTY(BlueprintAssignable, BlueprintCallable)
	FOnChangeConnectionType OnChangeConnectionType;
};
