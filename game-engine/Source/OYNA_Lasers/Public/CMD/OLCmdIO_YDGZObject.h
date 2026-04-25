#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "OLCmdIO_YDGZObject.generated.h"

DECLARE_MULTICAST_DELEGATE_OneParam(FSendPacket, const TArray<uint8>&);
DECLARE_MULTICAST_DELEGATE_OneParam(FOnLaserTriggered, int32 LaserID);
DECLARE_MULTICAST_DELEGATE(FArcadeCoinEvent);
DECLARE_MULTICAST_DELEGATE_OneParam(FButtonPressEvent, int32 ButtonID);

// Parser state machine. The controller emits 34-byte status frames in one of two
// headers:
//   NEW: 9E 00 04 ...  — events-based payload (7 × 4-byte slots)
//   OLD: 9E 80 82 ...  — legacy bitmap (28 bytes × 7 bits = 48 laser states)
// Our physical stand sits in OLD mode; NEW is kept for when the controller is
// flipped. Buttons are (in NEW only) events inside the same frame with SENSOR_ID
// 1/2 — there is no separate 6-byte button packet in either format.
enum class EParserState : uint8
{
	Idle,
	Got9E,
	Got9E_00,
	Got9E_80,
	ReadSensor
};

UCLASS()
class OYNA_LASERS_API UOLCmdIO_YDGZObject : public UObject
{
	GENERATED_BODY()

public:
	void InitWorldObject(UObject* InWorldContextObject);

	void BuildAndSendCommand(uint8 Cmd, const TArray<uint8>& Payload);
	void SendRawBytes(const TArray<uint8>& Data);

	void SendLedOne(uint8 Channel, uint32 Color, const TArray<uint32>& Ids);
	void SendLedAll(uint32 Color);
	void SetButtonLight(int32 Channel, bool bOn);
	// Silent poll for heartbeat timer. Same packet as SetButtonLight but
	// without log spam and with direct intensity byte — called at 20 Hz.
	void SendButtonPoll(int32 Channel, uint8 Intensity);
	// Select which button channel the 20 Hz heartbeat polls.
	//   0  -> ch=0x04 (START)
	//   1  -> ch=0x05 (END)
	//   -1 -> none (heartbeat becomes a no-op; backlight turns off)
	// Per canon 3.6: the controller activates a button channel only when it
	// sees alternating-intensity polls on that channel at >10 Hz. This is the
	// activation mechanism, not cosmetic blink.
	void SetActiveButton(int32 ButtonID);
	void CMD0_SendCmd_Line();
	void CMD0_SendCmd_Protocol();
	void CMD0_SendCmd_ModeSwitch();
	void SendFullChineseInit();
	void SendHeartbeat();
	void ProcessIncomingByte(uint8 Value);

	void ToggleBitValueZero() { bBitZero = !bBitZero; }
	// Parser-only reset (called internally by ProcessIncomingByte).
	void ResetState() { ParserState = EParserState::Idle; CmdBufIndex = 0; }
	// Baseline reset — call when laser pattern changes (start of level, etc.).
	// Causes the next sensor packet to re-snapshot laser state.
	void ResetBaseline()
	{
		bFirstPacketReceived = false;
		FMemory::Memzero(PrevTriggered, sizeof(PrevTriggered));
	}
	void StartGracePeriod(float Seconds);

	// Bitmask of currently active (visible/lit) lasers. Bit N = laser ID (N+1).
	// Only active lasers produce LASER BLOCKED triggers — inactive lasers that
	// toggle off due to animation won't be misread as player triggers.
	// Default: all 48 active. Game modes call SetActiveLaserMask on pattern change.
	void SetActiveLaserMask(uint64 Mask);

	// Test helpers — used by OLCheatManager to exercise parser without hardware.
	void SetActiveLaserMaskBit(int32 LaserID);
	void ClearActiveLaserMask();
	uint64 GetActiveLaserMask() const { return ActiveLaserMask; }

	FSendPacket OnSendPacket;
	FOnLaserTriggered OnLaserTriggered;
	FArcadeCoinEvent OnCoinInserted;
	FButtonPressEvent OnButtonPressed;

protected:
	static const int32 CMD_BUF_SIZE = 512;

	uint8 CmdBuf[CMD_BUF_SIZE];
	int32 CmdIn = 0;
	EParserState ParserState = EParserState::Idle;
	int32 CmdBufIndex = 0;

	void HandleSensorPacket(const uint8* Packet, int32 Len);

	UPROPERTY()
	TWeakObjectPtr<UObject> WorldContextObject = nullptr;

	bool bBitZero = false;
	bool PrevTriggered[256] = {};
	bool bFirstPacketReceived = false;
	double GraceUntilTime = 0.0;
	uint64 ActiveLaserMask = 0xFFFFFFFFFFFFull;  // all 48 on by default

	// Button state (canon 3.4, 3.6, 5.2 — corrected after stand test).
	// Two separate mechanisms:
	//   * ACTIVATION — we poll ch=0x04 (START) or ch=0x05 (END) at 20 Hz with
	//     alternating intensity 0x7F / 0x00. Without this the controller's
	//     capacitive touch pad stays silent. ActiveButtonChannel + bBlinkPhase
	//     are the state of that outbound 20 Hz loop.
	//   * DETECTION — the pressed state is NOT in frame[28,29] (that was a
	//     wrong guess; those bytes read (0x01, 0x60) in both pressed and idle
	//     states). Actual press is encoded in Packet[5] == 0x02 on SEQ=4 for
	//     START and SEQ=5 for END. Edge-detect per channel via the two Prev
	//     flags so a held button fires exactly once.
	int32 ActiveButtonChannel = -1;  // -1 / 0x04 / 0x05
	bool bBlinkPhase = false;        // heartbeat alternates 0x7F / 0x00
	bool bStartButtonPrev = false;   // edge-detect on SEQ=4 / Packet[5]
	bool bEndButtonPrev = false;     // edge-detect on SEQ=5 / Packet[5]

};
