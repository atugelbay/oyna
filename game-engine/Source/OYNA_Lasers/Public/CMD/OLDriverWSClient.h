#pragma once

#include "CoreMinimal.h"
#include "IWebSocket.h"
#include "UObject/Object.h"
#include "OLDriverWSClient.generated.h"

DECLARE_MULTICAST_DELEGATE_OneParam(FOnMessage, const FString& Message);

UCLASS()
class OYNA_LASERS_API UOLDriverWSClient : public UObject
{
	GENERATED_BODY()
	
public:
	void Connect();
	void SendMessage(const FString& Message);

	FOnMessage OnMessageDelegate;
	
private:
	TSharedPtr<IWebSocket> Socket;

	void OnConnected();
	void OnMessage(const FString& Message);
};
