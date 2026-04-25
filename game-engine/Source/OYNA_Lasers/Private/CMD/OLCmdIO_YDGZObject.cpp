#include "CMD/OLCmdIO_YDGZObject.h"

#include "Helpers/OLFrameBuffer.h"
#include "Kismet/GameplayStatics.h"
#include "Systems/OLMain.h"

void UOLCmdIO_YDGZObject::InitWorldObject(UObject* InWorldContextObject)
{
	WorldContextObject = InWorldContextObject;
}

void UOLCmdIO_YDGZObject::StartGracePeriod(float Seconds)
{
	// Clamp: never longer than 0.4s. Longer grace collides with Dynamic
	// StepInterval (0.5s) and Chaos pattern changes, suppressing real triggers.
	const float Clamped = FMath::Min(Seconds, 0.4f);
	GraceUntilTime = FPlatformTime::Seconds() + Clamped;
	bFirstPacketReceived = false;  // also re-capture baseline
	UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] Grace period started for %.2fs"), Clamped);
}

void UOLCmdIO_YDGZObject::SetActiveLaserMask(uint64 Mask)
{
	// Only flips which lasers matter for trigger detection — baseline is left
	// untouched because the physical sensors themselves are stable.
	ActiveLaserMask = Mask;
	UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] ActiveLaserMask=0x%012llX"),
		(unsigned long long)Mask);
}

void UOLCmdIO_YDGZObject::SetActiveLaserMaskBit(int32 LaserID)
{
	if (LaserID < 1 || LaserID > 48) return;
	ActiveLaserMask |= (1ull << (LaserID - 1));
	UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] ActiveLaserMask bit %d set; mask=0x%012llX"),
		LaserID, (unsigned long long)ActiveLaserMask);
}

void UOLCmdIO_YDGZObject::ClearActiveLaserMask()
{
	ActiveLaserMask = 0;
	UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] ActiveLaserMask cleared"));
}

void UOLCmdIO_YDGZObject::BuildAndSendCommand(uint8 Cmd, const TArray<uint8>& Payload)
{
	int32 Len = Payload.Num();
	TArray<uint8> Packet;

	// Length (7-bit encoding)
	Packet.Add(0x80 | (Len & 0x7F));
	Packet.Add((Len >> 7) & 0x7F);

	// Command
	Packet.Add(Cmd);

	// Data
	for (uint8 B : Payload)
	{
		Packet.Add(B & 0x7F);
	}

	// Checksum
	uint8 Sum = 0;
	for (uint8 B : Packet)
	{
		Sum += B;
	}

	Packet.Add(Sum & 0x7F);
	if (OnSendPacket.IsBound())
	{
		OnSendPacket.Broadcast(Packet);
	}
	else
	{
		UE_LOG(LogTemp, Error, TEXT("[UOLCmdIO_YDGZObject::BuildAndSendCommand] OnSendPacket is not Bound"));
	}
}

void UOLCmdIO_YDGZObject::SendLedOne(uint8 Channel, uint32 Color, const TArray<uint32>& Ids)
{
	TArray<uint8> Data;

	Data.Add(Channel & 0x7F);

	for (const uint16 Id : Ids)
	{
		Data.Add((Id >> 0) & 0x7F);
		Data.Add((Id >> 7) & 0x7F);
	}

	Data.Add((Color >> 17) & 0x7F);
	Data.Add((Color >> 9)  & 0x7F);
	Data.Add((Color >> 1)  & 0x7F);
	
	BuildAndSendCommand(3, Data);
}

void UOLCmdIO_YDGZObject::SendLedAll(uint32 Color)
{
	TArray<uint8> Data;

	Data.Add((Color >> 17) & 0x7F);
	Data.Add((Color >> 9)  & 0x7F);
	Data.Add((Color >> 1)  & 0x7F);
	Data.Add((Color >> 25) & 0x7F);
	
	BuildAndSendCommand(2, Data);
}

void UOLCmdIO_YDGZObject::SetButtonLight(int32 Channel, bool bOn)
{
	uint8 Intensity = bOn ? 0x7F : 0x00;

	// Packet: 86 00 03 [channel] 01 00 00 00 [intensity] [checksum]
	TArray<uint8> Data;
	Data.Add(Channel & 0x7F);
	Data.Add(0x01);
	Data.Add(0x00);
	Data.Add(0x00);
	Data.Add(0x00);
	Data.Add(Intensity);

	BuildAndSendCommand(3, Data);

	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] ButtonLight ch=%d %s"), Channel, bOn ? TEXT("ON") : TEXT("OFF"));
}

void UOLCmdIO_YDGZObject::SendButtonPoll(int32 Channel, uint8 Intensity)
{
	TArray<uint8> Data;
	Data.Add(Channel & 0x7F);
	Data.Add(0x01);
	Data.Add(0x00);
	Data.Add(0x00);
	Data.Add(0x00);
	Data.Add(Intensity & 0x7F);
	BuildAndSendCommand(3, Data);
	// No log — called at 20 Hz from heartbeat timer
}

void UOLCmdIO_YDGZObject::SetActiveButton(int32 ButtonID)
{
	// Map logical button id -> controller channel byte.
	// Per canon 3.6: polling a channel at >10 Hz with alternating intensity
	// (0x7F/0x00) activates that channel — without this, the controller
	// never emits press events for its physical touch pad.
	switch (ButtonID)
	{
	case 0:  ActiveButtonChannel = 0x04; break;  // START
	case 1:  ActiveButtonChannel = 0x05; break;  // END
	default: ActiveButtonChannel = -1;   break;  // none (heartbeat no-op)
	}
	bBlinkPhase = false;
	bStartButtonPrev = false;
	bEndButtonPrev = false;
	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] ActiveButton -> %d (ch=0x%02X)"),
		ButtonID, ActiveButtonChannel < 0 ? 0 : ActiveButtonChannel);
}

void UOLCmdIO_YDGZObject::SendRawBytes(const TArray<uint8>& Data)
{
	if (OnSendPacket.IsBound())
		OnSendPacket.Broadcast(Data);
}

void UOLCmdIO_YDGZObject::SendHeartbeat()
{
	// Called at 20 Hz by AOLMain's HeartbeatTimer. Polls ONE channel per tick
	// with alternating intensity (0x7F / 0x00). The alternation is the
	// controller's activation signal — constant intensity is ignored and the
	// touch pad stays silent. See SetActiveButton for channel selection.
	// No log: 20 Hz would flood the output.
	if (ActiveButtonChannel < 0) return;
	const uint8 Intensity = bBlinkPhase ? 0x7F : 0x00;
	SendButtonPoll(ActiveButtonChannel, Intensity);
	bBlinkPhase = !bBlinkPhase;
}

void UOLCmdIO_YDGZObject::CMD0_SendCmd_ModeSwitch()
{
	// Mode switch — switches controller to new protocol.
	// Must be sent BEFORE RAW Init. Chinese SW sends this first.
	TArray<uint8> Raw;
	Raw.Add(0x83); Raw.Add(0x00); Raw.Add(0x02);
	Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x05);
	SendRawBytes(Raw);
	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] Mode switch command sent (83 00 02 00 00 00 05)"));
}

void UOLCmdIO_YDGZObject::CMD0_SendCmd_Line()
{
	// Send EXACT bytes from Python driver (raw, no 7-bit framing!)
	// 8c 00 00 30 00 00 00 30 00 00 00 02 00 00 00 6e
	// Where 0x30 = 48 (total lasers)
	TArray<uint8> Raw;
	Raw.Add(0x8C); Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x30);
	Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x30);
	Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x02);
	Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x00); Raw.Add(0x6E);
	SendRawBytes(Raw);
	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] RAW Init sent (48 lasers)"));
}

void UOLCmdIO_YDGZObject::SendFullChineseInit()
{
	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] Starting full Chinese-style init"));

	// Step 1: Mode Switch — twice, matching the Chinese SW capture
	CMD0_SendCmd_ModeSwitch();
	CMD0_SendCmd_ModeSwitch();

	// Step 2: A4 group configuration (3 raw 40-byte packets)
	{
		const uint8 G1[40] = {
			0xA4, 0x00, 0x03,
			0x00,0x00, 0x00,0x01, 0x00,0x02, 0x00,0x03,
			0x00,0x04, 0x00,0x05, 0x00,0x06, 0x00,0x07,
			0x00,0x28, 0x00,0x29, 0x00,0x2A, 0x00,0x2B,
			0x00,0x2C, 0x00,0x2D, 0x00,0x2E, 0x00,0x2F,
			0x00,0x7D, 0x00,0x00,
			0x1C
		};
		TArray<uint8> P; P.Append(G1, sizeof(G1));
		SendRawBytes(P);
	}
	{
		const uint8 G2[40] = {
			0xA4, 0x00, 0x03,
			0x00,0x08, 0x00,0x09, 0x00,0x0A, 0x00,0x0B,
			0x00,0x0C, 0x00,0x0D, 0x00,0x0E, 0x00,0x0F,
			0x00,0x20, 0x00,0x21, 0x00,0x22, 0x00,0x23,
			0x00,0x24, 0x00,0x25, 0x00,0x26, 0x00,0x27,
			0x00,0x7D, 0x00,0x00,
			0x1C
		};
		TArray<uint8> P; P.Append(G2, sizeof(G2));
		SendRawBytes(P);
	}
	{
		const uint8 G3[40] = {
			0xA4, 0x00, 0x03,
			0x00,0x10, 0x00,0x11, 0x00,0x12, 0x00,0x13,
			0x00,0x14, 0x00,0x15, 0x00,0x16, 0x00,0x17,
			0x00,0x18, 0x00,0x19, 0x00,0x1A, 0x00,0x1B,
			0x00,0x1C, 0x00,0x1D, 0x00,0x1E, 0x00,0x1F,
			0x00,0x7D, 0x00,0x00,
			0x1C
		};
		TArray<uint8> P; P.Append(G3, sizeof(G3));
		SendRawBytes(P);
	}

	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] A4 groups sent (3 packets)"));

	// Step 3: Per-laser calibration PARAM stream (83 values).
	// BuildAndSendCommand emits: 83 00 02 [V] 00 00 [cs]
	static const uint8 ParamValues[] = {
		0x7D, 0x7B, 0x7A, 0x78, 0x77, 0x75, 0x74, 0x72, 0x71, 0x6F,
		0x6E, 0x6C, 0x6B, 0x69, 0x68, 0x66, 0x65, 0x63, 0x62, 0x60,
		0x5F, 0x5D, 0x5C, 0x5A, 0x59, 0x57, 0x56, 0x54, 0x53, 0x51,
		0x50, 0x4E, 0x4D, 0x4B, 0x4A, 0x48, 0x47, 0x45, 0x44, 0x42,
		0x41, 0x3F, 0x3E, 0x3C, 0x3B, 0x39, 0x38, 0x36, 0x35, 0x33,
		0x32, 0x30, 0x2F, 0x2D, 0x2C, 0x2A, 0x29, 0x27, 0x26, 0x24,
		0x23, 0x21, 0x20, 0x1E, 0x1D, 0x1B, 0x1A, 0x18, 0x17, 0x15,
		0x14, 0x12, 0x11, 0x0F, 0x0E, 0x0C, 0x0B, 0x09, 0x08, 0x06,
		0x05, 0x03, 0x02
	};
	for (uint8 V : ParamValues)
	{
		TArray<uint8> Data;
		Data.Add(V);
		Data.Add(0x00);
		Data.Add(0x00);
		BuildAndSendCommand(0x02, Data);
	}
	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] Sent %d laser calibration params"), (int32)sizeof(ParamValues));

	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] Full init complete"));
}

void UOLCmdIO_YDGZObject::CMD0_SendCmd_Protocol()
{
	// 86 00 01 01 01 02 02 02 02 11
	TArray<uint8> Raw;
	Raw.Add(0x86); Raw.Add(0x00); Raw.Add(0x01); Raw.Add(0x01);
	Raw.Add(0x01); Raw.Add(0x02); Raw.Add(0x02); Raw.Add(0x02);
	Raw.Add(0x02); Raw.Add(0x11);
	SendRawBytes(Raw);
	UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] RAW Protocol sent"));
}

void UOLCmdIO_YDGZObject::ProcessIncomingByte(uint8 Value)
{
	// Trace raw byte stream — enable via: Log LogTemp VeryVerbose
	UE_LOG(LogTemp, VeryVerbose, TEXT("[OLCmdIO] RX byte: %02X"), Value);

	switch (ParserState)
	{
	case EParserState::Idle:
		if (Value == 0x9E)
		{
			CmdBuf[0] = Value;
			CmdBufIndex = 1;
			ParserState = EParserState::Got9E;
		}
		break;

	case EParserState::Got9E:
		CmdBuf[CmdBufIndex++] = Value;
		if (Value == 0x00)
		{
			ParserState = EParserState::Got9E_00;
		}
		else if (Value == 0x80)
		{
			ParserState = EParserState::Got9E_80;
		}
		else
		{
			UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] Dropped: 9E %02X (unknown 2nd byte)"), Value);
			ResetState();
		}
		break;

	case EParserState::Got9E_00:
		CmdBuf[CmdBufIndex++] = Value;
		if (Value == 0x04)
		{
			// NEW-format status frame: 9E 00 04 [seq] [flag] [28 event bytes] [cs]  (34 bytes)
			ParserState = EParserState::ReadSensor;
		}
		else
		{
			UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] Dropped: 9E 00 %02X"), Value);
			ResetState();
		}
		break;

	case EParserState::Got9E_80:
		CmdBuf[CmdBufIndex++] = Value;
		if (Value == 0x82)
		{
			// OLD-format sensor frame: 9E 80 82 [ch] [pad] [28 bitmap bytes] [cs]  (34 bytes)
			ParserState = EParserState::ReadSensor;
		}
		else
		{
			UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] Dropped: 9E 80 %02X"), Value);
			ResetState();
		}
		break;

	case EParserState::ReadSensor:
		CmdBuf[CmdBufIndex++] = Value;
		if (CmdBufIndex >= 34)
		{
			HandleSensorPacket(CmdBuf, 34);
			ResetState();
		}
		else if (CmdBufIndex >= CMD_BUF_SIZE)
		{
			UE_LOG(LogTemp, Error, TEXT("[OLCmdIO] Sensor buffer overrun — resetting"));
			ResetState();
		}
		break;
	}
}

void UOLCmdIO_YDGZObject::HandleSensorPacket(const uint8* Packet, int32 Len)
{
	if (Len != 34) return;

	const uint8 b1 = Packet[1];
	const uint8 b2 = Packet[2];
	const uint8 ch = Packet[3];

	// Two formats carried by the same 34-byte frame:
	//   NEW: 9E 00 04 [ch=0x02] [pad] [7 × 4-byte events]   [cs]
	//   OLD: 9E 80 82 [ch=0x40] [pad] [28 bytes of bitmap]  [cs]
	// Physical controller on the stand currently emits OLD.
	const bool bNewFormat = (b1 == 0x00 && b2 == 0x04);
	const bool bOldFormat = (b1 == 0x80 && b2 == 0x82);
	if (!bNewFormat && !bOldFormat) return;

	// Scan-phase / SEQ filter.
	//   OLD: controller cycles ch through 0x20/0x40/0x41/0xC0/0xC3. Only ch=0x40
	//        is edge-detectable; others are mid-scan noise. Filter here.
	//   NEW: ch is the SEQ id (0..5). SEQ=2 carries laser sensor bitmap; SEQ=4
	//        carries START press in Packet[5]; SEQ=5 carries END press in
	//        Packet[5]. Per-SEQ routing happens inside the NEW branch below.
	if (bOldFormat && ch != 0x40) return;

	// -----------------------------------------------------------------
	// NEW format — per canon 3.3/3.4/5.1/5.2 (5.2 corrected after stand test).
	// Payload = 6 slots × 4 bytes: [bitmap][status_flag][00][00].
	// LocalLaserID = Slot*8 + Bit + 1 (1-based, range 1..48).
	// Button press state is carried in Packet[5]:
	//   * on SEQ=4 frames, Packet[5]==0x02 means START is currently pressed
	//   * on SEQ=5 frames, Packet[5]==0x02 means END is currently pressed
	// (Earlier revisions watched frame[28,29]=(0x01,0x60) — that field turned
	// out to be constant in both idle and pressed states on the stand rig and
	// is not a press indicator. Stand-test log 2026-04-22.)
	// Activation — the controller only emits presses of a channel we are
	// actively polling at 20 Hz with alternating intensity; see
	// SetActiveButton / SendHeartbeat.
	// Laser sensor data is carried on SEQ=2 (port 1). SEQ=3 (port 2) is unused
	// in current room configs.
	// -----------------------------------------------------------------
	if (bNewFormat)
	{
		const uint8 Seq = ch;  // ch = Packet[3] = SEQ in NEW format

		// === BUTTONS (both on SEQ=4, differentiated by Packet[5] code) ===
		//
		// Stand rig config (verified 2026-04-22):
		//   On SEQ=4 frames, Packet[5] encodes button state:
		//     0x00 — idle
		//     0x02 — START pressed
		//     0x01 — END pressed
		//   SEQ=5 frames are always zero and carry no button info.
		//
		// Chinese reference controllers (per pcap captures) use a different
		// layout: START on SEQ=4 with Packet[5]==0x02, END on SEQ=5 with
		// Packet[5]==0x02. If that configuration appears on a future rig,
		// add detection in the SEQ=5 branch below (currently empty no-op).
		if (Seq == 0x04)
		{
			const uint8 P5 = Packet[5];

			// START: SEQ=4 + Packet[5]==0x02
			const bool bStartPressed = (P5 == 0x02);
			if (bStartPressed && !bStartButtonPrev)
			{
				UE_LOG(LogTemp, Warning,
					TEXT("[OLCmdIO] START button pressed (Frame[5]=0x02 on SEQ=4)"));
				if (OnButtonPressed.IsBound()) OnButtonPressed.Broadcast(0);
			}
			bStartButtonPrev = bStartPressed;

			// END: SEQ=4 + Packet[5]==0x01
			const bool bEndPressed = (P5 == 0x01);
			if (bEndPressed && !bEndButtonPrev)
			{
				UE_LOG(LogTemp, Warning,
					TEXT("[OLCmdIO] END button pressed (Frame[5]=0x01 on SEQ=4)"));
				if (OnButtonPressed.IsBound()) OnButtonPressed.Broadcast(1);
			}
			bEndButtonPrev = bEndPressed;
		}
		else if (Seq == 0x05)
		{
			// No-op on our stand rig — END fires on SEQ=4 via Packet[5]==0x01.
			// If a future controller config puts END on SEQ=5, detection code
			// can be added here. For now we receive these frames but don't
			// process them (SEQ=5 Packet[5] has been verified to be all-zero
			// across 81 frames in the 2026-04-22 stand test).
		}

		// === LASER SENSORS — only SEQ=2 ===
		if (Seq != 0x02) return;

		bool bNowBlocked[256] = {};
		// === NEW format SEQ=2 — verified 2026-04-25 stand test ===
		// Layout:
		//   Data area: 7 bytes at offsets [5..11]
		//   7 bits per byte (MSB always 0; YDGZ controllers limit to 7-bit ASCII-safe)
		//   LaserID = byteIdx * 7 + bitIdx + 1 (1-based, range 1..48)
		//   Polarity: bit SET   = laser ON  / beam intact
		//             bit CLEAR = laser OFF / beam blocked (player crossed)
		//
		// Mapping:
		//   byte[5]  bits 0..6 → LaserIDs 1..7
		//   byte[6]  bits 0..6 → LaserIDs 8..14
		//   byte[7]  bits 0..6 → LaserIDs 15..21
		//   byte[8]  bits 0..6 → LaserIDs 22..28
		//   byte[9]  bits 0..6 → LaserIDs 29..35
		//   byte[10] bits 0..6 → LaserIDs 36..42
		//   byte[11] bits 0..5 → LaserIDs 43..48 (bit 6 unused)
		for (int32 ByteIdx = 0; ByteIdx < 7; ++ByteIdx)
		{
			const int32 ByteOff = 5 + ByteIdx;
			const uint8 SlotBits = Packet[ByteOff];

			for (int32 BitIdx = 0; BitIdx < 7; ++BitIdx)
			{
				const int32 LaserID = ByteIdx * 7 + BitIdx + 1;
				if (LaserID < 1 || LaserID > 48)
					continue;

				const bool bIntact = (SlotBits & (1u << BitIdx)) != 0;
				bNowBlocked[LaserID] = !bIntact;  // INVERTED polarity (canon: 1=ON, 0=blocked)
			}
		}

		// Baseline: only on first SEQ=2 frame, not on first-any-frame.
		if (!bFirstPacketReceived)
		{
			FMemory::Memcpy(PrevTriggered, bNowBlocked, sizeof(PrevTriggered));
			bFirstPacketReceived = true;
			UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] Baseline captured (NEW)"));
			return;
		}

		// Edge detect: intact(0) -> blocked(1) = player crossed beam.
		// Life lost only if laser is in ActiveLaserMask (canon 5.1 rule 1).
		const bool bInGrace = (FPlatformTime::Seconds() < GraceUntilTime);
		for (int32 LaserID = 1; LaserID <= 48; ++LaserID)
		{
			const bool bWas = PrevTriggered[LaserID];
			const bool bNow = bNowBlocked[LaserID];
			if (!bWas && bNow)
			{
				const int32 LaserIdx = LaserID - 1;
				const bool bActive = (LaserIdx < 64) &&
				                     ((ActiveLaserMask & (1ull << LaserIdx)) != 0);
				if (bActive && !bInGrace)
				{
					UE_LOG(LogTemp, Warning,
						TEXT("[OLCmdIO] Laser #%d crossed (active, life lost)"), LaserID);
					if (OnLaserTriggered.IsBound()) OnLaserTriggered.Broadcast(LaserID);
				}
				// else: silently ignore (not in active pattern, or in grace)
			}
			PrevTriggered[LaserID] = bNow;
		}
		return;
	}

	// -----------------------------------------------------------------
	// OLD format — bitmap protocol (EXACT restoration of pre-Phase 2 logic)
	// -----------------------------------------------------------------
	// Bitmap: 28 bytes at Packet[5..32], 7 bits per byte, 48 lasers.
	// LaserID (1-based) = byteIdx*7 + bitIdx + 1.  bit=1 → OK, bit=0 → BLOCKED.
	// No debounce, no masks, no transformations. Baseline is taken on the FIRST
	// packet and edge detection fires on transitions only. This is the exact
	// logic that ran in production before Phase 2.
	const uint8* Data = &Packet[5];

	if (!bFirstPacketReceived)
	{
		for (int32 L = 0; L < 48; ++L)
		{
			const int32 ByteIdx = L / 7;
			const int32 BitIdx  = L % 7;
			const uint8 NowBit  = (Data[ByteIdx] >> BitIdx) & 0x01;
			PrevTriggered[L + 1] = (NowBit == 0);
		}
		bFirstPacketReceived = true;
		UE_LOG(LogTemp, Verbose, TEXT("[OLCmdIO] Baseline captured (OLD)"));
		return;
	}

	const bool bInGrace = (FPlatformTime::Seconds() < GraceUntilTime);

	for (int32 L = 0; L < 48; ++L)
	{
		const int32 ByteIdx = L / 7;
		const int32 BitIdx  = L % 7;
		const uint8 NowBit  = (Data[ByteIdx] >> BitIdx) & 0x01;
		const bool bBlocked = (NowBit == 0);
		const int32 LaserID = L + 1;

		if (bBlocked != PrevTriggered[LaserID])
		{
			PrevTriggered[LaserID] = bBlocked;
			const bool bActive = (ActiveLaserMask & (1ull << L)) != 0;

			if (bBlocked && !bInGrace && bActive)
			{
				UE_LOG(LogTemp, Warning, TEXT("[OLCmdIO] LASER BLOCKED: ID=%d"), LaserID);
				if (OnLaserTriggered.IsBound())
					OnLaserTriggered.Broadcast(LaserID);
			}
		}
	}
}

