#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "OLMenuSelectGameWidget.generated.h"

UCLASS()
class OYNA_LASERS_API UOLMenuSelectGameWidget : public UUserWidget
{
	GENERATED_BODY()
	
public:
	virtual void NativeConstruct() override;
	virtual void NativeDestruct() override;
};
