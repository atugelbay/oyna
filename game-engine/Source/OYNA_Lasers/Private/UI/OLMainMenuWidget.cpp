#include "UI/OLMainMenuWidget.h"
#include "Components/Button.h"
#include "Components/TextBlock.h"
#include "Components/UniformGridPanel.h"
#include "Components/UniformGridSlot.h"
#include "Kismet/GameplayStatics.h"

// ─────────────────────────────────────────────────────────────────────────────
// NativeConstruct
// ─────────────────────────────────────────────────────────────────────────────
void UOLMainMenuWidget::NativeConstruct()
{
    Super::NativeConstruct();

    GameManager = Cast<AOLGameManager>(
        UGameplayStatics::GetActorOfClass(GetWorld(), AOLGameManager::StaticClass()));

    if (!IsValid(GameManager))
    {
        UE_LOG(LogTemp, Warning, TEXT("OLMainMenuWidget: AOLGameManager not found in world"));
    }

    // Bind mode buttons
    if (BtnClassic)  BtnClassic ->OnClicked.AddDynamic(this, &UOLMainMenuWidget::OnClassicClicked);
    if (BtnDynamic)  BtnDynamic ->OnClicked.AddDynamic(this, &UOLMainMenuWidget::OnDynamicClicked);
    if (BtnAdvanced) BtnAdvanced->OnClicked.AddDynamic(this, &UOLMainMenuWidget::OnAdvancedClicked);
    if (BtnStartGame)BtnStartGame->OnClicked.AddDynamic(this, &UOLMainMenuWidget::OnStartClicked);

    BuildLevelButtons();

    // Apply defaults
    SelectMode(1);
    SelectLevel(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectMode / SelectLevel
// ─────────────────────────────────────────────────────────────────────────────
void UOLMainMenuWidget::SelectMode(int32 Mode)
{
    SelectedMode = FMath::Clamp(Mode, 1, 3);

    FString ModeName;
    switch (SelectedMode)
    {
    case 1: ModeName = TEXT("КЛАССИЧЕСКИЙ"); break;
    case 2: ModeName = TEXT("ДИНАМИЧЕСКИЙ"); break;
    case 3: ModeName = TEXT("ХАОС");         break;
    }

    if (SelectedModeText)
        SelectedModeText->SetText(FText::FromString(ModeName));

    RefreshModeButtonStyles();
}

void UOLMainMenuWidget::SelectLevel(int32 Level)
{
    SelectedLevel = FMath::Clamp(Level, 1, 10);

    if (SelectedLevelText)
        SelectedLevelText->SetText(FText::Format(
            FText::FromString(TEXT("УРОВЕНЬ {0}")), FText::AsNumber(SelectedLevel)));

    RefreshLevelButtonStyles();
}

// ─────────────────────────────────────────────────────────────────────────────
// BuildLevelButtons — 10 buttons in a 2-column grid (5 rows)
// ─────────────────────────────────────────────────────────────────────────────
void UOLMainMenuWidget::BuildLevelButtons()
{
    if (!LevelsGrid) return;

    LevelsGrid->ClearChildren();
    LevelButtons.Empty();

    for (int32 i = 0; i < 10; ++i)
    {
        UButton* Btn = NewObject<UButton>(this);
        if (!Btn) continue;

        // Label the button with a text block child
        UTextBlock* Label = NewObject<UTextBlock>(this);
        if (Label)
        {
            Label->SetText(FText::AsNumber(i + 1));
            Btn->AddChild(Label);
        }

        Btn->OnClicked.AddDynamic(this, &UOLMainMenuWidget::OnLevelButtonClicked);

        // Grid layout: 2 columns — column = i % 2, row = i / 2
        UUniformGridSlot* GridSlot = LevelsGrid->AddChildToUniformGrid(Btn);
        if (GridSlot)
        {
            GridSlot->SetColumn(i % 2);
            GridSlot->SetRow(i / 2);
        }

        LevelButtons.Add(Btn);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Button click handlers
// ─────────────────────────────────────────────────────────────────────────────
void UOLMainMenuWidget::OnClassicClicked()  { SelectMode(1); }
void UOLMainMenuWidget::OnDynamicClicked()  { SelectMode(2); }
void UOLMainMenuWidget::OnAdvancedClicked() { SelectMode(3); }

void UOLMainMenuWidget::OnLevelButtonClicked()
{
    // Identify which button was clicked by finding it in our list
    for (int32 i = 0; i < LevelButtons.Num(); ++i)
    {
        // UMG doesn't pass the caller directly; find the focused / hovered button.
        // Workaround: compare each button's IsHovered() right after click fires.
        // This works because the click event fires while the button is still hovered.
        if (IsValid(LevelButtons[i]) && LevelButtons[i]->IsHovered())
        {
            SelectLevel(i + 1);
            break;
        }
    }
}

void UOLMainMenuWidget::OnStartClicked()
{
    if (IsValid(GameManager))
    {
        GameManager->StartGame(SelectedMode, SelectedLevel);
        // AOLMain listens to OnGameStateChanged and switches widgets when Playing begins
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual style helpers
// ─────────────────────────────────────────────────────────────────────────────
void UOLMainMenuWidget::RefreshModeButtonStyles()
{
    // Highlight the active mode button with a brighter tint; dim the others
    const FLinearColor Active  (1.0f, 0.8f, 0.0f, 1.0f); // yellow
    const FLinearColor Inactive(0.5f, 0.5f, 0.5f, 1.0f); // grey

    if (BtnClassic)  BtnClassic ->SetColorAndOpacity(SelectedMode == 1 ? Active : Inactive);
    if (BtnDynamic)  BtnDynamic ->SetColorAndOpacity(SelectedMode == 2 ? Active : Inactive);
    if (BtnAdvanced) BtnAdvanced->SetColorAndOpacity(SelectedMode == 3 ? Active : Inactive);
}

void UOLMainMenuWidget::RefreshLevelButtonStyles()
{
    const FLinearColor Active  (1.0f, 0.8f, 0.0f, 1.0f);
    const FLinearColor Inactive(0.8f, 0.8f, 0.8f, 1.0f);

    for (int32 i = 0; i < LevelButtons.Num(); ++i)
    {
        if (IsValid(LevelButtons[i]))
            LevelButtons[i]->SetColorAndOpacity(
                (i + 1 == SelectedLevel) ? Active : Inactive);
    }
}
