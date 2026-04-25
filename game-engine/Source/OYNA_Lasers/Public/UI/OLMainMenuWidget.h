#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Games/OLGameManager.h"
#include "OLMainMenuWidget.generated.h"

class UButton;
class UTextBlock;
class UUniformGridPanel;

UCLASS()
class OYNA_LASERS_API UOLMainMenuWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    virtual void NativeConstruct() override;

    // ── Bound widget components ───────────────────────────────────────────────

    /** Mode selection buttons */
    UPROPERTY(meta = (BindWidget))
    UButton* BtnClassic;

    UPROPERTY(meta = (BindWidget))
    UButton* BtnDynamic;

    UPROPERTY(meta = (BindWidget))
    UButton* BtnAdvanced;

    /** 2-column × 5-row grid filled with 10 level buttons at runtime */
    UPROPERTY(meta = (BindWidget))
    UUniformGridPanel* LevelsGrid;

    /** Confirms the current selection and starts the game */
    UPROPERTY(meta = (BindWidget))
    UButton* BtnStartGame;

    /** Shows selected mode name, e.g. "КЛАССИЧЕСКИЙ" */
    UPROPERTY(meta = (BindWidget))
    UTextBlock* SelectedModeText;

    /** Shows selected level, e.g. "УРОВЕНЬ 3" */
    UPROPERTY(meta = (BindWidget))
    UTextBlock* SelectedLevelText;

    // ── Public selection API ──────────────────────────────────────────────────

    UFUNCTION(BlueprintCallable, Category = "LaserGame|UI")
    void SelectMode(int32 Mode);

    UFUNCTION(BlueprintCallable, Category = "LaserGame|UI")
    void SelectLevel(int32 Level);

    // ── Current selection (read from Blueprint if needed) ────────────────────

    UPROPERTY(BlueprintReadOnly, Category = "LaserGame|UI")
    int32 SelectedMode = 1;

    UPROPERTY(BlueprintReadOnly, Category = "LaserGame|UI")
    int32 SelectedLevel = 1;

private:
    // ── Internals ─────────────────────────────────────────────────────────────

    /** Creates 10 numbered level buttons and inserts them into LevelsGrid */
    void BuildLevelButtons();

    UFUNCTION()
    void OnClassicClicked();

    UFUNCTION()
    void OnDynamicClicked();

    UFUNCTION()
    void OnAdvancedClicked();

    UFUNCTION()
    void OnStartClicked();

    /** Called when a dynamically created level button is clicked */
    UFUNCTION()
    void OnLevelButtonClicked();

    /** Updates button visual style to show which mode is active */
    void RefreshModeButtonStyles();

    /** Updates level button styles to show which level is active */
    void RefreshLevelButtonStyles();

    UPROPERTY()
    AOLGameManager* GameManager = nullptr;

    /** Dynamically created level buttons — index 0 = Level 1 */
    UPROPERTY()
    TArray<UButton*> LevelButtons;
};
