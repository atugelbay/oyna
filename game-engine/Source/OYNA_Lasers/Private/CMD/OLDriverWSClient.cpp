#include "CMD/OLDriverWSClient.h"

#include "WebSocketsModule.h"

void UOLDriverWSClient::Connect()
{
	if (!FModuleManager::Get().IsModuleLoaded("WebSockets"))
	{
		FModuleManager::Get().LoadModule("WebSockets");
	}

	Socket = FWebSocketsModule::Get().CreateWebSocket("ws://localhost:8080/ws/laser");

	Socket->OnConnected().AddUObject(this, &UOLDriverWSClient::OnConnected);
	Socket->OnMessage().AddUObject(this, &UOLDriverWSClient::OnMessage);

	Socket->Connect();
}

void UOLDriverWSClient::OnConnected()
{
	UE_LOG(LogTemp, Warning, TEXT("[UOLDriverWSClient::OnConnected] Connected to Laser Middleware"));
	GEngine->AddOnScreenDebugMessage(-1, 50.0f, FColor::Green, TEXT("Connected to Laser Middleware"));
}

void UOLDriverWSClient::OnMessage(const FString& Message)
{
	UE_LOG(LogTemp, Warning, TEXT("Received: %s"), *Message);
	OnMessageDelegate.Broadcast(Message);
}

void UOLDriverWSClient::SendMessage(const FString& Message)
{
	if (Socket.IsValid())
	{
		Socket->Send(Message);
	}
}