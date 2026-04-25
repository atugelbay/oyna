#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Games/OLGameManager.h"
#include "Slate/SlateBrushAsset.h"
#include "Systems/OLMain.h"
#include "OLGameScreenWidget.generated.h"

class UTextBlock;
class UHorizontalBox;

UCLASS()
class OYNA_LASERS_API UOLGameScreenWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    virtual void NativeConstruct() override;
    virtual void NativeDestruct() override;
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

    // ── Bound widget components ───────────────────────────────────────────────

    /** Big countdown timer, e.g. "1:30" */
    UPROPERTY(meta = (BindWidget), BlueprintReadWrite)
    UTextBlock* TimerText;

    /** Current level display, e.g. "УРОВЕНЬ 3" */
    UPROPERTY(meta = (BindWidget))
    UTextBlock* LevelText;

    /** Current mode display, e.g. "КЛАССИЧЕСКИЙ" */
    UPROPERTY(meta = (BindWidget))
    UTextBlock* ModeText;

    /** 3 / 2 / 1 / GO! — hidden when not in countdown */
    UPROPERTY(meta = (BindWidget))
    UTextBlock* CountdownText;
    
    UPROPERTY(meta = (BindWidget))
    UTextBlock* WinText;

    /** Horizontal row of heart / life icons — rebuilt dynamically */
    UPROPERTY(meta = (BindWidget))
    UHorizontalBox* LivesBox;

    /** "ОСТАЛОСЬ 10 СЕКУНД" — shown only in last 10 seconds */
    UPROPERTY(meta = (BindWidget))
    UTextBlock* WarningText;
    
    UPROPERTY(meta = (BindWidget))
    UTextBlock* StartHint;

    // ── Public update methods (also usable from Blueprint) ───────────────────

    UFUNCTION(BlueprintCallable, Category = "LaserGame|UI")
    void UpdateTimer(float Seconds);

    UFUNCTION(BlueprintCallable, Category = "LaserGame|UI")
    void UpdateLives(int32 Lives);

    UFUNCTION(BlueprintCallable, Category = "LaserGame|UI")
    void UpdateCountdown(int32 Step);

    UFUNCTION(BlueprintCallable, Category = "LaserGame|UI")
    void ShowGameOver();

    UFUNCTION(BlueprintCallable, Category = "LaserGame|UI")
    void ShowLevelComplete();
    
protected:
    // ── Delegate handlers ─────────────────────────────────────────────────────

    UFUNCTION()
    void OnTimeChanged(float NewTime);

    UFUNCTION()
    void OnLivesChanged(int32 NewLives);

    UFUNCTION()
    void OnGameStateChanged(EGameState NewState);

    UFUNCTION()
    void OnStateChanged(EOLGameMode Mode, EOLGameState State);
    
    UFUNCTION()
    void OnLifeLost();

    UFUNCTION()
    void OnLevelWon();
    
    UFUNCTION()
    void OnLevelComplete(const FOLLevelResult& LevelResult);

    UFUNCTION()
    void OnGameOverEvent();

    UFUNCTION()
    void OnLevelChanged(int32 NewLevel);

    UFUNCTION()
    void OnModeChanged(int32 NewMode);

    UFUNCTION(BlueprintImplementableEvent)
    void SetWarningTimer(const bool Warning);
    
    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Format seconds as "M:SS", e.g. 90.0 → "1:30", 9.5 → "0:09" */
    static FText FormatTime(float Seconds);

    /** Returns mode display name in Russian */
    static FText ModeDisplayName(int32 Mode);

    // ── Assets ────────────────────────────────────────────────────────────────

    UPROPERTY(blueprintReadOnly, EditDefaultsOnly)
    TObjectPtr<UTexture2D> HeartIcon = nullptr;
    
    // ── Variables ─────────────────────────────────────────────────────────────
    
    UPROPERTY()
    AOLGameManager* GameManager = nullptr;
    
    UPROPERTY()
    TObjectPtr<AOLMain> Main = nullptr;

    int32 GameLives = 0;
    
    UPROPERTY(blueprintReadOnly)
    float OverallTime = 90.0f;
    
    UPROPERTY(blueprintReadOnly)
    float CurrentTime = 90.0f;
    
    UPROPERTY(BlueprintReadWrite, meta = (ClampMin = 0.0f, ClampMax = 1.0f))
    float CurrentPercentage = 1.0f;
    
    bool bWarning = false;
    
    UPROPERTY(blueprintReadOnly)
    EOLGameState CurrentState = EOLGameState::Idle;
    
    
};
