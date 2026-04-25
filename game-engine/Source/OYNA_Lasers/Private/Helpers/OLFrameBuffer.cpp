#include "Helpers/OLFrameBuffer.h"

UOLFrameBuffer* UOLFrameBuffer::Get(UWorld* World)
{
    if (!World) return nullptr;
    return World->GetSubsystem<UOLFrameBuffer>();
}

void UOLFrameBuffer::SetLEDMap(EOLLEDMapType MapType, int32 Cols, int32 Rows)
{
    GridCols = Cols;
    GridRows = Rows;

    LEDs.Empty();
    LEDs.SetNum(Cols * Rows);

    for (int32 Row = 0; Row < Rows; ++Row)
    {
        for (int32 Col = 0; Col < Cols; ++Col)
        {
            const int32 ID = GridToID(Row, Col, Cols);
            LEDs[ID].ID     = ID;
            LEDs[ID].Row    = Row;
            LEDs[ID].Col    = Col;
            LEDs[ID].Status = EOLLEDState::Off;
            LEDs[ID].Color  = EOLColorTypes::Off;
        }
    }
}

void UOLFrameBuffer::ChangeLEDStateAll(EOLLEDState State)
{
    for (FOLLedInfo& Info : LEDs)
        Info.Status = State;
}

void UOLFrameBuffer::ChangeLEDStateByID(int32 ID, EOLLEDState State)
{
    FOLLedInfo* Info = GetLEDInfoByID(ID);
    if (Info) Info->Status = State;
}

TArray<FOLLedInfo> UOLFrameBuffer::GetLEDInfo() const
{
    return LEDs;
}

const FOLLedInfo* UOLFrameBuffer::GetLEDInfoByID(int32 ID) const
{
    if (ID < 0 || ID >= LEDs.Num()) return nullptr;
    return &LEDs[ID];
}

FOLLedInfo* UOLFrameBuffer::GetLEDInfoByID(int32 ID)
{
    if (ID < 0 || ID >= LEDs.Num()) return nullptr;
    return &LEDs[ID];
}

EOLColorTypes UOLFrameBuffer::CovertStateToColor(EOLLEDState State) const
{
    return (State == EOLLEDState::On) ? EOLColorTypes::Red : EOLColorTypes::Off;
}

EOLLEDState UOLFrameBuffer::GetStatusTypeForColor(EOLColorTypes Color) const
{
    return (Color == EOLColorTypes::Off) ? EOLLEDState::Off : EOLLEDState::On;
}

uint32 UOLFrameBuffer::GetUINTTypeForColor(EOLColorTypes Color) const
{
    switch (Color)
    {
    case EOLColorTypes::Red:   return (127u << 17);
    case EOLColorTypes::Green: return (127u <<  9);
    case EOLColorTypes::Blue:  return (127u <<  1);
    case EOLColorTypes::White: return (127u << 17) | (127u << 9) | (127u << 1);
    default:                   return 0u;
    }
}

int32 UOLFrameBuffer::GridToID(int32 Row, int32 Col, int32 Cols)
{
    // S-chain: even rows left→right, odd rows right→left
    const int32 ActualCol = (Row % 2 == 0) ? Col : (Cols - 1 - Col);
    return Row * Cols + ActualCol;
}
