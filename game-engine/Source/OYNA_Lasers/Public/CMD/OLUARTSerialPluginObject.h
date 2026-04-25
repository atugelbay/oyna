#pragma once

#include "CoreMinimal.h"
#include "SerialCom.h"
#include "UObject/Object.h"
#include "OLUARTSerialPluginObject.generated.h"

DECLARE_DELEGATE_OneParam(FOnUartByte, uint8);

UCLASS(BlueprintType)
class OYNA_LASERS_API UOLUARTSerialPluginObject : public UObject, public FTickableGameObject
{
	GENERATED_BODY()

public:
	void Init(const int32 Port, int32 Baud);
	void Close();
	
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override
	{
		RETURN_QUICK_DECLARE_CYCLE_STAT(UMyObject, STATGROUP_Tickables);
	}
	virtual bool IsTickable() const override
	{
		return true;
	}
	
	void SendData(const TArray<uint8>& Data);

	void ReadThreadFunc();
	void SendThreadFunc();
	
	bool IsOpen() const;
	
	FOnUartByte OnUartByte;

	int32 GetPortNo() const { return PortNo; }
	int32 GetBaudRate() const { return BaudRate; };

	void DebugReceivingByte(uint8 Byte);
	
private:
	UPROPERTY()
	TObjectPtr<USerialCom> SerialCom = nullptr;

	int32 PortNo = -1;
	int32 BaudRate = 0;

	// Buffers
	static constexpr int32 RecvSize = 8192;
	static constexpr int32 SendSize = 65536;

	uint8 RecvBuf[RecvSize];
	uint8 SendBuf[SendSize];

	int32 ReadIn = 0;
	int32 ReadOut = 0;
	int32 WriteIn = 0;
	int32 WriteOut = 0;

	// Threads
	FRunnableThread* ReadThread = nullptr;
	FRunnableThread* SendThread = nullptr;
	bool bRunThreads = false;

	float ConnectTime = 0.f;
};
