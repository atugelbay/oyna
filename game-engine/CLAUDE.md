# OYNA_Lasers — Claude Working Notes

Unreal Engine 5.5 C++ project controlling a 48-laser hardware grid (8 cols × 6 rows) over serial UART using the YDGZ protocol.

## UE5 C++ Conventions (UHT rules that have bitten us)

- **No `uint32` in `UFUNCTION` parameters.** Use `int32`. UHT rejects `uint32` on reflected functions.
- **No overloaded `UFUNCTION`s.** Reflected functions must have unique names — rename, don't overload.
- **Avoid variable names that shadow `UWidget::Slot`.** Don't name locals or members `Slot` inside UserWidget-derived classes.
- **CheatManager requires the right base class.** `AGameModeBase` has no `CheatClass` property — use `AGameMode` (or set `CheatClass` on a custom GameMode that exposes it). Our `AOLMain` is an `AActor`, so cheats reach it via `UGameplayStatics::GetActorOfClass(GetWorld(), AOLMain::StaticClass())`, **not** `GetAuthGameMode()`.
- **Verify include paths before referencing a header.** Headers live under `Source/OYNA_Lasers/Public/<Subdir>/`; include as `"<Subdir>/Header.h"` (e.g. `"Games/OLGame01.h"`, `"GameMode/OLCheatManager.h"`).
- **Module export macro.** Public `UCLASS`es in this module use `OYNA_LASERS_API`. Add it on any new public class.
- **Delegate macros.** Blueprint-exposed: `DECLARE_DYNAMIC_MULTICAST_DELEGATE_*` + `AddDynamic`. C++-only: `DECLARE_MULTICAST_DELEGATE_*` + `AddUObject`.

## Build Verification (definition of done)

After editing any `.cpp` or `.h`, the build must compile. Don't declare a task done until UBT succeeds. If UHT or compile errors appear, fix the root cause before moving on — don't paper over with unrelated edits.

## Domain Conventions

- **Laser IDs are 1-based** in the software API (the chain subtracts 1 internally). `GetLaserID` and friends return `Col*6 + ... + 1`.
- **S-shaped (serpentine) wiring.** Even columns go bottom→top, odd columns go top→bottom:
  - Even col: `ID = Col*6 + Row + 1`
  - Odd col:  `ID = Col*6 + (5 - Row) + 1`
- **Hardware color.** The laser hardware only responds to `EOLColorTypes::White`. Other colors will not light.
- **YDGZ packets.** 34 bytes, header `0x9E 0x80`, channel filter `0x40`. Parser uses a state machine with `PrevTriggered[]` state-change detection + `bFirstPacketReceived` baseline to suppress false triggers from status reports. Call `ResetState()` after every LED change.
- **Serial throttle.** `Game01LedStateChange` has a 50 ms throttle to avoid 64 KB buffer overflow; don't broadcast redundant Off frames that consume the slot.

## Architecture Quick Map

- `AOLMain` (AActor) — central coordinator; owns serial, game instances, LED state. Holds `GameDirection`.
- `AOLGame01` — sweep game (Right/Left across 8 cols, Down/Up across 6 rows) using `EOLDirection`.
- `AOLClassicMode` — 10-level survival mode. BFS-guaranteed pathable patterns, 3 lives, 90s timer. `CompleteLevel()` = success path (scores `Lives*500 + floor(TimeLeft)*10`); `Tick` timeout → `OnGameOver`.
- `UOLCheatManager` — console cheats; reaches `AOLMain` via `GetActorOfClass`.
- `UOLCmdIO_YDGZObject` — serial parser/encoder.
