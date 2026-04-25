#include "UI/OLGameScreenWidget.h"
#include "Components/TextBlock.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/Image.h"
#include "Kismet/GameplayStatics.h"
#include "Systems/OLMain.h"

// ─────────────────────────────────────────────────────────────────────────────
// NativeConstruct — find GameManager and bind all delegates
// ─────────────────────────────────────────────────────────────────────────────
void UOLGameScreenWidget::NativeConstruct()
{
    Super::NativeConstruct();

    /*GameManager = Cast<AOLGameManager>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLGameManager::StaticClass()));
    if (!IsValid(GameManager))
    {
        UE_LOG(LogTemp, Warning, TEXT("OLGameScreenWidget: AOLGameManager not found in world"));
        return;
    }
    GameManager->OnTimeChanged      .AddDynamic(this, &UOLGameScreenWidget::OnTimeChanged);
    GameManager->OnLivesChanged     .AddDynamic(this, &UOLGameScreenWidget::OnLivesChanged);
    GameManager->OnGameStateChanged .AddDynamic(this, &UOLGameScreenWidget::OnGameStateChanged);
    GameManager->OnLifeLost         .AddDynamic(this, &UOLGameScreenWidget::OnLifeLost);
    GameManager->OnLevelWon         .AddDynamic(this, &UOLGameScreenWidget::OnLevelWon);
    GameManager->OnGameOverEvent    .AddDynamic(this, &UOLGameScreenWidget::OnGameOverEvent);
    GameManager->OnLevelChanged     .AddDynamic(this, &UOLGameScreenWidget::OnLevelChanged);
    GameManager->OnModeChanged      .AddDynamic(this, &UOLGameScreenWidget::OnModeChanged);*/

    Main = Cast<AOLMain>(UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass()));
    if (!IsValid(Main))
    {
        UE_LOG(LogTemp, Warning, TEXT("OLGameScreenWidget: AOLGameManager not found in world"));
        return;
    }
    Main->OnTimeChanged     .AddDynamic(this, &UOLGameScreenWidget::OnTimeChanged);
    Main->OnLivesChanged    .AddDynamic(this, &UOLGameScreenWidget::OnLivesChanged);
    Main->OnStateChanged    .AddDynamic(this, &UOLGameScreenWidget::OnStateChanged);
    Main->OnLevelComplete   .AddDynamic(this, &UOLGameScreenWidget::OnLevelComplete);
    
    // Set initial values from current game state
    OverallTime = Main->GetRemainingSeconds();
    GameLives = Main->GetCurrentLives();
    
    UpdateTimer(Main->GetRemainingSeconds());
    UpdateLives(Main->GetCurrentLives());
    OnLevelChanged(Main->GetCurrentLevel());
    OnModeChanged(static_cast<int32>(Main->GetCurrentMode()));

    // Hide countdown and warning by default
    if (CountdownText) CountdownText->SetVisibility(ESlateVisibility::Hidden);
    if (WarningText)   WarningText  ->SetVisibility(ESlateVisibility::Hidden);
}

// ─────────────────────────────────────────────────────────────────────────────
// NativeDestruct — unbind all delegates
// ─────────────────────────────────────────────────────────────────────────────
void UOLGameScreenWidget::NativeDestruct()
{
    if (IsValid(GameManager))
    {
        GameManager->OnTimeChanged      .RemoveDynamic(this, &UOLGameScreenWidget::OnTimeChanged);
        GameManager->OnLivesChanged     .RemoveDynamic(this, &UOLGameScreenWidget::OnLivesChanged);
        GameManager->OnGameStateChanged .RemoveDynamic(this, &UOLGameScreenWidget::OnGameStateChanged);
        GameManager->OnLifeLost         .RemoveDynamic(this, &UOLGameScreenWidget::OnLifeLost);
        GameManager->OnLevelWon         .RemoveDynamic(this, &UOLGameScreenWidget::OnLevelWon);
        GameManager->OnGameOverEvent    .RemoveDynamic(this, &UOLGameScreenWidget::OnGameOverEvent);
        GameManager->OnLevelChanged     .RemoveDynamic(this, &UOLGameScreenWidget::OnLevelChanged);
        GameManager->OnModeChanged      .RemoveDynamic(this, &UOLGameScreenWidget::OnModeChanged);
    }
    
    if (IsValid(Main))
    {
        Main->OnTimeChanged     .RemoveDynamic(this, &UOLGameScreenWidget::OnTimeChanged);
        Main->OnLivesChanged    .RemoveDynamic(this, &UOLGameScreenWidget::OnLivesChanged);
        Main->OnStateChanged    .RemoveDynamic(this, &UOLGameScreenWidget::OnStateChanged);
        Main->OnLevelComplete   .RemoveDynamic(this, &UOLGameScreenWidget::OnLevelComplete);
    }

    Super::NativeDestruct();
}

void UOLGameScreenWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);
    
    if (CurrentState == EOLGameState::Playing)
    {
        CurrentTime -= InDeltaTime;
        CurrentPercentage = CurrentTime / OverallTime; 
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public update methods
// ─────────────────────────────────────────────────────────────────────────────
void UOLGameScreenWidget::UpdateTimer(float Seconds)
{
    CurrentTime = Seconds;
    if (TimerText)
        TimerText->SetText(FormatTime(Seconds));
}

void UOLGameScreenWidget::UpdateLives(int32 Lives)
{
    if (!LivesBox || !HeartIcon) return;
    LivesBox->ClearChildren();
    
    for (int32 i = 0; i < GameLives; ++i)
    {
        UImage* Heart = NewObject<UImage>(this);
        if (!Heart) continue;

        Heart->SetBrushFromTexture(HeartIcon);
        FSlateBrush Brush = Heart->GetBrush();
        Brush.ImageSize = FVector2D(48.f, 48.f);
        Heart->SetBrush(Brush);
        
        // Tint: full color for remaining lives, dark for lost lives
        const FLinearColor Tint = (i < Lives)
            ? FLinearColor(1.f, 0.1f, 0.1f, 1.f)   // red heart
            : FLinearColor(0.2f, 0.2f, 0.2f, 0.5f); // grey empty slot
        Heart->SetColorAndOpacity(Tint);

        UHorizontalBoxSlot* HBoxSlot = LivesBox->AddChildToHorizontalBox(Heart);
        if (HBoxSlot)
        {
            HBoxSlot->SetPadding(FMargin(4.f, 0.f));
            HBoxSlot->SetSize(FSlateChildSize(ESlateSizeRule::Automatic));
        }
    }
}

void UOLGameScreenWidget::UpdateCountdown(int32 Step)
{
    if (!CountdownText) return;

    CountdownText->SetVisibility(ESlateVisibility::Visible);

    if (Step > 0)
    {
        CountdownText->SetText(FText::AsNumber(Step));
    }
    else
    {
        // Step 0 = GO!
        CountdownText->SetText(FText::FromString(TEXT("GO!")));
    }
}

void UOLGameScreenWidget::ShowGameOver()
{
    if (CountdownText) CountdownText->SetVisibility(ESlateVisibility::Hidden);
    if (WarningText)   WarningText  ->SetVisibility(ESlateVisibility::Hidden);

    // Show "GAME OVER" in the countdown slot as a quick repurpose
    if (CountdownText)
    {
        CountdownText->SetText(FText::FromString(TEXT("GAME OVER")));
        CountdownText->SetVisibility(ESlateVisibility::Visible);
    }
}

void UOLGameScreenWidget::ShowLevelComplete()
{
    if (WarningText) WarningText->SetVisibility(ESlateVisibility::Hidden);

    if (CountdownText)
    {
        //CountdownText->SetText(FText::FromString(TEXT("УРОВЕНЬ ПРОЙДЕН!")));
        //CountdownText->SetVisibility(ESlateVisibility::Visible);
    }
    if (WinText)
    {
        WinText->SetVisibility(ESlateVisibility::Visible);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delegate handlers
// ─────────────────────────────────────────────────────────────────────────────
void UOLGameScreenWidget::OnTimeChanged(float NewTime)
{
    UpdateTimer(NewTime);
    
    // Show warning text when 10 seconds remain
    if (WarningText)
    {
        const bool bShowWarning = (NewTime <= 10.f && NewTime > 0.f);
        WarningText->SetVisibility(
            bShowWarning ? ESlateVisibility::Visible : ESlateVisibility::Hidden);
        if (bShowWarning)
        {
            SetWarningTimer(true);
        }
    }
}

void UOLGameScreenWidget::OnLivesChanged(int32 NewLives)
{
    if (GameLives > NewLives)
    {
        OnLifeLost();
    }
    
    UpdateLives(NewLives);
}

void UOLGameScreenWidget::OnGameStateChanged(EGameState NewState)
{
    switch (NewState)
    {
    case EGameState::Countdown:
        if (CountdownText) CountdownText->SetVisibility(ESlateVisibility::Visible);
        if (WarningText)   WarningText  ->SetVisibility(ESlateVisibility::Hidden);
        UpdateCountdown(3); // will be updated per-tick via OnCountdownTick in GameManager
        break;

    case EGameState::Playing:
        if (CountdownText) CountdownText->SetVisibility(ESlateVisibility::Hidden);
        break;

    case EGameState::LevelComplete:
        ShowLevelComplete();
        break;

    case EGameState::GameOver:
        ShowGameOver();
        break;

    case EGameState::Idle:
        if (CountdownText) CountdownText->SetVisibility(ESlateVisibility::Hidden);
        if (WarningText)   WarningText  ->SetVisibility(ESlateVisibility::Hidden);
        break;
    }
}

void UOLGameScreenWidget::OnStateChanged(EOLGameMode Mode, EOLGameState State)
{
    if (!Main) return;
    
    CurrentState = State;
    OnModeChanged(static_cast<int32>(Mode));
    switch (State)
    {
    case EOLGameState::Countdown:
        if (CountdownText)CountdownText->SetVisibility(ESlateVisibility::Visible);
        if (WarningText)  WarningText  ->SetVisibility(ESlateVisibility::Hidden);
        if (StartHint)    StartHint    ->SetVisibility(ESlateVisibility::Hidden);
        if (WinText)      WinText      ->SetVisibility(ESlateVisibility::Hidden);
        UpdateCountdown(3); // will be updated per-tick via OnCountdownTick in GameManager
        break;

    case EOLGameState::Playing:
        CurrentPercentage = 1.0f;
        OverallTime = Main->GetRemainingSeconds();
        UpdateTimer(Main->GetRemainingSeconds());
        UpdateLives(Main->GetCurrentLives());
        OnLevelChanged(Main->GetCurrentLevel());
        OnModeChanged(static_cast<int32>(Main->GetCurrentMode()));
        SetWarningTimer(false);
        if (CountdownText)CountdownText->SetVisibility(ESlateVisibility::Hidden);
        if (StartHint)    StartHint    ->SetVisibility(ESlateVisibility::Hidden);
        if (WinText)      WinText      ->SetVisibility(ESlateVisibility::Hidden);
        break;
        
    case EOLGameState::LevelEnded:
        ShowLevelComplete();
        break;

    case EOLGameState::Idle:
        if (CountdownText)CountdownText->SetVisibility(ESlateVisibility::Hidden);
        if (WarningText)  WarningText  ->SetVisibility(ESlateVisibility::Hidden);
        if (StartHint)    StartHint    ->SetVisibility(ESlateVisibility::Hidden);
        if (WinText)      WinText      ->SetVisibility(ESlateVisibility::Hidden);
        break;
        
    case EOLGameState::WaitingStart:
        if (CountdownText)CountdownText->SetVisibility(ESlateVisibility::Hidden);
        if (StartHint)    StartHint    ->SetVisibility(ESlateVisibility::Visible);
        if (WinText)      WinText      ->SetVisibility(ESlateVisibility::Hidden);
        break;
    }
}

void UOLGameScreenWidget::OnLifeLost()
{
    if (!TimerText) return;

    const FSlateColor& WarningColor = FSlateColor(FLinearColor(1.f, 0.f, 0.f, 1.f));
    if (TimerText->GetColorAndOpacity() == WarningColor) return;
    
    // Brief red tint flash on the whole widget — handled by Blueprint animation
    // or simple color modulation here as a fallback
    TimerText->SetColorAndOpacity(WarningColor);
    
    // Reset color after 0.3 s via timer
    FTimerHandle ResetTimer;
    GetWorld()->GetTimerManager().SetTimer(ResetTimer, [this]()
    {
        if (IsValid(this) && TimerText)
            TimerText->SetColorAndOpacity(FSlateColor(FLinearColor::White));
    }, 0.5f, false);
}

void UOLGameScreenWidget::OnLevelWon()
{
    ShowLevelComplete();
}

void UOLGameScreenWidget::OnLevelComplete(const FOLLevelResult& LevelResult)
{
    if (LevelResult.bVictory)
    {
        ShowLevelComplete();
    }
    else
    {
        ShowGameOver();
    }
}

void UOLGameScreenWidget::OnGameOverEvent()
{
    ShowGameOver();
}

void UOLGameScreenWidget::OnLevelChanged(int32 NewLevel)
{
    if (LevelText)
        LevelText->SetText(FText::Format(
            FText::FromString(TEXT("{0}")), FText::AsNumber(NewLevel)));
}

void UOLGameScreenWidget::OnModeChanged(int32 NewMode)
{
    if (ModeText)
        ModeText->SetText(ModeDisplayName(NewMode));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
FText UOLGameScreenWidget::FormatTime(float Seconds)
{
    const int32 TotalSec = FMath::Max(0, FMath::CeilToInt(Seconds));
    const int32 Min = TotalSec / 60;
    const int32 Sec = TotalSec % 60;
    return FText::FromString(FString::Printf(TEXT("%d:%02d"), Min, Sec));
}

FText UOLGameScreenWidget::ModeDisplayName(int32 Mode)
{
    switch (Mode)
    {
    case 1:  return FText::FromString(TEXT("КЛАССИЧЕСКИЙ"));
    case 2:  return FText::FromString(TEXT("ДИНАМИЧЕСКИЙ"));
    case 3:  return FText::FromString(TEXT("ХАОС"));
    default: return FText::FromString(TEXT("—"));
    }
}
