#include "CMD/OLUARTSerialPluginObject.h"

class FSerialReadRunnable : public FRunnable
{
public:
	UOLUARTSerialPluginObject* Owner;
	FSerialReadRunnable(UOLUARTSerialPluginObject* InOwner) : Owner(InOwner) {}
	virtual uint32 Run() override { Owner->ReadThreadFunc(); return 0; }
};

class FSerialSendRunnable : public FRunnable
{
public:
	UOLUARTSerialPluginObject* Owner;
	FSerialSendRunnable(UOLUARTSerialPluginObject* InOwner) : Owner(InOwner) {}
	virtual uint32 Run() override { Owner->SendThreadFunc(); return 0; }
};

void UOLUARTSerialPluginObject::Init(const int32 Port, int32 Baud)
{
	UE_LOG(LogTemp, Warning, TEXT("~~[UOLUARTSerialPluginObject::Init]~~"));
	UE_LOG(LogTemp, Warning, TEXT("[UOLUARTSerialPluginObject::Init] Trying to Open Port No: %d, BaudRate: %d"), Port, Baud);

	PortNo = Port;
	BaudRate = Baud;

	SerialCom = NewObject<USerialCom>();
	if (!SerialCom)
	{
		UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::Init] SerialCom is NUll"));
		return;
	}
	
	const bool bOpened = SerialCom->OpenWFC(PortNo, BaudRate);
	if (!bOpened)
	{
		GEngine->AddOnScreenDebugMessage(-1, 50.0f, FColor::Red, TEXT("SerialCom could not Open"));
		UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::Init] SerialCom could not Open"));
	}
	else
	{
		GEngine->AddOnScreenDebugMessage(-1, 50.0f, FColor::Green, TEXT("SerialCom is Opened"));
		UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::Init] SerialCom is Opened"));
	}

	bRunThreads = true;
	ReadThread = FRunnableThread::Create(new FSerialReadRunnable(this), TEXT("SerialPluginReadThread"));
	SendThread = FRunnableThread::Create(new FSerialSendRunnable(this), TEXT("SerialPluginSendThread"));

	if (ReadThread && SendThread)
	{
		UE_LOG(LogTemp, Warning, TEXT("[UOLUARTSerialPluginObject::Init] ReadThread and SendThread are Opened"));
	}
	else if (!ReadThread)
	{
		UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::Init] ReadThread is NUll"));
	}
	else if (!SendThread)
	{
		UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::Init] SendThread is NUll"));
	}
}

void UOLUARTSerialPluginObject::Close()
{
	UE_LOG(LogTemp, Warning, TEXT("[UOLUARTSerialPluginObject::Close] Trying to Close Port No: %d, BaudRate: %d"), PortNo, BaudRate);

	bRunThreads = false;
	if (!SerialCom)
	{
		UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::Init] SerialCom is NUll"));
		return;
	}

	PortNo = -1;
	BaudRate = 0;
	
	SerialCom->Close();
}

void UOLUARTSerialPluginObject::Tick(float DeltaTime)
{
	if (!SerialCom || !SerialCom->IsOpened())
	{
		if (PortNo > 0 && BaudRate > 0)
		{
			ConnectTime -= DeltaTime;
			if (ConnectTime <= 0.f)
			{
				ConnectTime = 2.5f;
				SerialCom->OpenWFC(PortNo, BaudRate);
			}
		}
	}
	
	while (ReadOut != ReadIn)
	{
		uint8 B = RecvBuf[ReadOut];
		ReadOut = (ReadOut + 1) % RecvSize;

		OnUartByte.ExecuteIfBound(B);
	}
}

void UOLUARTSerialPluginObject::SendData(const TArray<uint8>& Data)
{
	for (uint8 B : Data)
	{
		SendBuf[WriteIn] = B;
		WriteIn = (WriteIn + 1) % SendSize;
	}
}

void UOLUARTSerialPluginObject::ReadThreadFunc()
{
	while (bRunThreads)
	{
		FPlatformProcess::Sleep(0.02f);
		
		if (!IsValid(SerialCom))
		{
			UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::ReadThreadFunc] SerialCom is NUll"));
			continue;
		}
		if (!SerialCom->IsOpened())
		{
			UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::ReadThreadFunc] SerialCom is not Opened"));
			continue;
		}
		
		while (IsValid(SerialCom) && SerialCom->IsOpened())
		{
			const TArray<uint8>& Bytes = SerialCom->ReadBytes();
			
			for (const uint8 Byte : Bytes)
			{
				RecvBuf[ReadIn] = Byte;
				ReadIn = (ReadIn + 1) % RecvSize;
			}
		}
	}
}

void UOLUARTSerialPluginObject::SendThreadFunc()
{
	while (bRunThreads)
	{
		FPlatformProcess::Sleep(0.02f);

		if (!IsValid(SerialCom))
		{
			UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::SendThreadFunc] SerialCom is NUll"));
			continue;
		}
		if (!SerialCom->IsOpened())
		{
			UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::SendThreadFunc] SerialCom is not Opened"));
			continue;
		}
		
		if (IsValid(SerialCom) && SerialCom->IsOpened() && WriteIn != WriteOut)
		{
			int32 Len = (WriteOut >= WriteIn) ? SendSize - WriteOut : WriteIn - WriteOut;
			Len = FMath::Min(Len, 128);

			// Copy to TArray
			TArray<uint8> BytesToSend;
			for (int32 i = 0; i < Len; ++i)
			{
				BytesToSend.Add(SendBuf[(WriteOut + i) % SendSize]);
			}

			UE_LOG(LogTemp, Warning, TEXT("[UOLUARTSerialPluginObject::SendThreadFunc] Trying to send bytes len: %d"), BytesToSend.Num());

			if (SerialCom->WriteBytes(BytesToSend))
			{
				WriteOut = (WriteOut + Len) % SendSize;
				UE_LOG(LogTemp, Warning, TEXT("[UOLUARTSerialPluginObject::SendThreadFunc] Sent bytes"));
			}
			else
			{
				UE_LOG(LogTemp, Error, TEXT("[UOLUARTSerialPluginObject::ReadThreadFunc] SerialCom does not Send"));
			}
		}
	}
}

bool UOLUARTSerialPluginObject::IsOpen() const
{
	if (SerialCom)
	{
		return SerialCom->IsOpened();
	}
	return false;
}

void UOLUARTSerialPluginObject::DebugReceivingByte(uint8 Byte)
{
	RecvBuf[ReadIn] = Byte;
	ReadIn = (ReadIn + 1) % RecvSize;
	
	UE_LOG(LogTemp, Log, TEXT("[UOLUARTSerialPluginObject::ReadThreadFunc] Received byte: %d"), Byte);
	UE_LOG(LogTemp, Log, TEXT("[UOLUARTSerialPluginObject::ReadThreadFunc] ReadIn: %d"), ReadIn);
	UE_LOG(LogTemp, Log, TEXT("[UOLUARTSerialPluginObject::ReadThreadFunc] ReadOut: %d"), ReadOut);
}
