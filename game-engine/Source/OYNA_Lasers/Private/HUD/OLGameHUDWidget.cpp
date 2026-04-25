#include "HUD/OLGameHUDWidget.h"
#include "Kismet/GameplayStatics.h"
#include "Systems/OLMain.h"

void UOLGameHUDWidget::NativeConstruct()
{
	Super::NativeConstruct();
	BindToMain();
	UE_LOG(LogTemp, Warning, TEXT("[OLGameHUDWidget] Constructed and bound to AOLMain"));
}

void UOLGameHUDWidget::NativeDestruct()
{
	UnbindFromMain();
	Super::NativeDestruct();
}

void UOLGameHUDWidget::BindToMain()
{
	AActor* Found = UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass());
	AOLMain* OwningMain = Cast<AOLMain>(Found);
	if (!OwningMain)
	{
		UE_LOG(LogTemp, Error, TEXT("[OLGameHUDWidget] AOLMain not found! HUD will be inert."));
		return;
	}

	OwningMain->OnLivesChanged.AddDynamic(this, &UOLGameHUDWidget::HandleLivesChanged);
	OwningMain->OnScoreChanged.AddDynamic(this, &UOLGameHUDWidget::HandleScoreChanged);
	OwningMain->OnTimeChanged.AddDynamic(this, &UOLGameHUDWidget::HandleTimeChanged);
	OwningMain->OnStateChanged.AddDynamic(this, &UOLGameHUDWidget::HandleStateChanged);
	OwningMain->OnLevelStarted.AddDynamic(this, &UOLGameHUDWidget::HandleLevelStarted);
	OwningMain->OnLevelComplete.AddDynamic(this, &UOLGameHUDWidget::HandleLevelComplete);
	OwningMain->OnGameOver.AddDynamic(this, &UOLGameHUDWidget::HandleGameOver);
	OwningMain->OnLaserHit.AddDynamic(this, &UOLGameHUDWidget::HandleLaserHit);

	OnLivesUpdated(OwningMain->GetCurrentLives());
	OnScoreUpdated(OwningMain->GetCurrentScore());
	OnTimeUpdated(OwningMain->GetRemainingSeconds());
	OnStateUpdated(OwningMain->GetCurrentMode(), OwningMain->GetCurrentState());
	OnLevelStartedEvent(OwningMain->GetCurrentMode(), OwningMain->GetCurrentLevel());
}

void UOLGameHUDWidget::UnbindFromMain()
{
	AActor* Found = UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass());
	AOLMain* OwningMain = Cast<AOLMain>(Found);
	if (!OwningMain) return;
	OwningMain->OnLivesChanged.RemoveDynamic(this, &UOLGameHUDWidget::HandleLivesChanged);
	OwningMain->OnScoreChanged.RemoveDynamic(this, &UOLGameHUDWidget::HandleScoreChanged);
	OwningMain->OnTimeChanged.RemoveDynamic(this, &UOLGameHUDWidget::HandleTimeChanged);
	OwningMain->OnStateChanged.RemoveDynamic(this, &UOLGameHUDWidget::HandleStateChanged);
	OwningMain->OnLevelStarted.RemoveDynamic(this, &UOLGameHUDWidget::HandleLevelStarted);
	OwningMain->OnLevelComplete.RemoveDynamic(this, &UOLGameHUDWidget::HandleLevelComplete);
	OwningMain->OnGameOver.RemoveDynamic(this, &UOLGameHUDWidget::HandleGameOver);
	OwningMain->OnLaserHit.RemoveDynamic(this, &UOLGameHUDWidget::HandleLaserHit);
	OwningMain = nullptr;
}

void UOLGameHUDWidget::HandleLivesChanged(int32 NewLives)
{
	OnLivesUpdated(NewLives);
}

void UOLGameHUDWidget::HandleScoreChanged(int32 NewScore)
{
	OnScoreUpdated(NewScore);
}

void UOLGameHUDWidget::HandleTimeChanged(float RemainingSeconds)
{
	OnTimeUpdated(RemainingSeconds);
}

void UOLGameHUDWidget::HandleStateChanged(EOLGameMode Mode, EOLGameState State)
{
	OnStateUpdated(Mode, State);
}

void UOLGameHUDWidget::HandleLevelStarted(EOLGameMode Mode, int32 Level)
{
	OnLevelStartedEvent(Mode, Level);
}

void UOLGameHUDWidget::HandleLevelComplete(const FOLLevelResult& Result)
{ 
	OnLevelCompleteEvent(Result); 
}

void UOLGameHUDWidget::HandleGameOver(const FOLLevelResult& Result)
{
	OnGameOverEvent(Result);
}

void UOLGameHUDWidget::HandleLaserHit(int32 LaserID)
{
	OnLaserHitEvent(LaserID);
}

FString UOLGameHUDWidget::FormatTime(float Seconds)
{
	const int32 Total = FMath::Max(0, FMath::FloorToInt(Seconds));
	const int32 Min = Total / 60;
	const int32 Sec = Total % 60;
	return FString::Printf(TEXT("%d:%02d"), Min, Sec);
}

FText UOLGameHUDWidget::GetModeDisplayName(EOLGameMode Mode)
{
	switch (Mode)
	{
		case EOLGameMode::Classic: return FText::FromString(TEXT("Классический"));
		case EOLGameMode::Dynamic: return FText::FromString(TEXT("Динамичный"));
		case EOLGameMode::Chaos:   return FText::FromString(TEXT("Хаос"));
		default:                   return FText::FromString(TEXT("—"));
	}
}

bool UOLGameHUDWidget::IsPlaying() const
{
	AActor* Found = UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass());
	AOLMain* OwningMain = Cast<AOLMain>(Found);
	return OwningMain && OwningMain->GetCurrentState() == EOLGameState::Playing;
}
