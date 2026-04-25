#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Types/Types.h"
#include "Types/Structs.h"
#include "OLFrameBuffer.generated.h"

UCLASS()
class OYNA_LASERS_API UOLFrameBuffer : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	/** Convenience accessor — same as GetWorld()->GetSubsystem<UOLFrameBuffer>(). */
	static UOLFrameBuffer* Get(UWorld* World);

	// ── Setup ─────────────────────────────────────────────────────────────────

	/** Initialize the LED grid. Call once in AOLMain::SetLEDInfo(). */
	void SetLEDMap(EOLLEDMapType MapType, int32 Cols, int32 Rows);

	// ── State mutations ───────────────────────────────────────────────────────

	void ChangeLEDStateAll(EOLLEDState State);
	void ChangeLEDStateByID(int32 ID, EOLLEDState State);

	// ── Queries ───────────────────────────────────────────────────────────────

	/** Returns all 48 LED info entries. */
	TArray<FOLLedInfo> GetLEDInfo() const;

	/** Returns pointer to the info for a given laser ID, or nullptr if invalid. */
	const FOLLedInfo* GetLEDInfoByID(int32 ID) const;
	FOLLedInfo*       GetLEDInfoByID(int32 ID);

	// ── Color conversion helpers ──────────────────────────────────────────────

	/** EOLLEDState → EOLColorTypes (On→Red, Off→Off). */
	EOLColorTypes CovertStateToColor(EOLLEDState State) const;

	/** EOLColorTypes → EOLLEDState (Off→Off, everything else→On). */
	EOLLEDState GetStatusTypeForColor(EOLColorTypes Color) const;

	/** EOLColorTypes → hardware uint32 color value. */
	uint32 GetUINTTypeForColor(EOLColorTypes Color) const;

private:
	TArray<FOLLedInfo> LEDs;
	int32 GridCols = 0;
	int32 GridRows = 0;

	/** Convert a grid (Row, Col) to flat LaserID respecting S-chain wiring. */
	static int32 GridToID(int32 Row, int32 Col, int32 Cols);
};
