#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Types/Types.h"
#include "OLGameHUDWidget.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnGameStart, const EOLGameMode, GameMode, const int32, Level);

UCLASS(Abstract)
class OYNA_LASERS_API UOLGameHUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	virtual void NativeConstruct() override;
	virtual void NativeDestruct() override;

	UPROPERTY(BlueprintAssignable, BlueprintCallable)
	FOnGameStart OnGameStart;
	
protected:
	void BindToMain();
	void UnbindFromMain();

	UFUNCTION()
	void HandleLivesChanged(int32 NewLives);

	UFUNCTION()
	void HandleScoreChanged(int32 NewScore);

	UFUNCTION()
	void HandleTimeChanged(float RemainingSeconds);

	UFUNCTION()
	void HandleStateChanged(EOLGameMode Mode, EOLGameState State);

	UFUNCTION()
	void HandleLevelStarted(EOLGameMode Mode, int32 Level);

	UFUNCTION()
	void HandleLevelComplete(const FOLLevelResult& Result);

	UFUNCTION()
	void HandleGameOver(const FOLLevelResult& Result);

	UFUNCTION()
	void HandleLaserHit(int32 LaserID);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnLivesUpdated(int32 NewLives);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnScoreUpdated(int32 NewScore);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnTimeUpdated(float RemainingSeconds);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnStateUpdated(EOLGameMode Mode, EOLGameState State);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnLevelStartedEvent(EOLGameMode Mode, int32 Level);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnLevelCompleteEvent(const FOLLevelResult& Result);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnGameOverEvent(const FOLLevelResult& Result);

	UFUNCTION(BlueprintImplementableEvent, Category = "OYNA|HUD")
	void OnLaserHitEvent(int32 LaserID);

	UFUNCTION(BlueprintPure, Category = "OYNA|HUD")
	static FString FormatTime(float Seconds);

	UFUNCTION(BlueprintPure, Category = "OYNA|HUD")
	static FText GetModeDisplayName(EOLGameMode Mode);

	UFUNCTION(BlueprintPure, Category = "OYNA|HUD")
	bool IsPlaying() const;
};
