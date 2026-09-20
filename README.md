# CJ Flight v1.0

A CLEO Redux flight mod for **GTA San Andreas Classic 1.0 PC (x86)**. Type `FLY` to enable the ability, then take off and control CJ in the air with a locked horizontal flight animation, fast acceleration, vertical leaning, high-speed motion blur, and protected landings.

## Features

- Typed `FLY` cheat enables or disables the flight ability.
- Left Shift launches CJ from the ground.
- Hold **W** to accelerate forward rapidly up to a speed cap of **90.0**.
- **A / D** steer left and right.
- Hold **Space** to ascend at **32.0**.
- Hold **Left Shift** while airborne to descend at **32.0** and land automatically.
- CJ smoothly leans about **+15°** while ascending and **-15°** while descending.
- The horizontal `FALL_SKYDIVE_ACCEL` pose is kept active during flight.
- High-speed GTA SA SpeedFX motion blur appears during fast forward flight.
- CJ receives temporary health protection during flight and briefly after touchdown to prevent fall-damage deaths.
- Near the ground, descent automatically slows for a gentler landing.
- Flight is suspended in missions, interiors, vehicles, and water.

## Requirements

- **Grand Theft Auto: San Andreas Classic 1.0 PC (x86)**
- **CLEO Redux** — tested with CLEO Redux 1.5.0 (x86)
- CLEO Redux Input support (`Input.cleo` / `IS_KEY_PRESSED`)

This mod uses fixed GTA SA 1.0 memory addresses for its SpeedFX blur fix. It is **not intended for the Definitive Edition or other executable versions**.

## Installation

1. Close GTA San Andreas completely.
2. Remove any older `CJ_Flight` script from your CLEO folder, including copies in subfolders.
3. Remove the temporary `SA_SpeedBlurProbe` and `SA_SpeedBlurTrace` test scripts if they are still installed.
4. Copy `CJ_Flight_v1.0[mem].js` into your GTA San Andreas `CLEO` folder.
5. **Keep `[mem]` in the filename.** The blur implementation needs CLEO Redux memory permission.
6. Start the game normally.

Run only **one** version of CJ Flight at a time.

## Controls

| Input | Action |
| --- | --- |
| Type `FLY` | Enable / disable the flight ability |
| Left Shift on the ground | Take off |
| Hold `W` | Accelerate forward up to 90.0 |
| `A` / `D` | Steer left / right |
| Hold `Space` | Ascend at 32.0 and lean upward |
| Hold Left Shift while flying | Descend at 32.0 and lean downward |
| Release the vertical key | Stop climbing / descending and smoothly return level |
| `S` | No flight action |

After takeoff, release Left Shift once before using it to descend. Space and Left Shift held together cancel vertical movement and return CJ toward a level pose.

## Landing and health protection

During normal flight CJ is given a temporary health buffer. When the script detects touchdown, that protection remains active for about two seconds to cover GTA's delayed fall-damage timing, then CJ's current health is refilled to his real current maximum.

Full-speed descent is reduced to a gentle final descent close to the ground before the flight state ends.

## Motion blur

CJ Flight uses GTA SA's native **SpeedFX** effect during fast forward flight. The mod temporarily bypasses a per-frame SpeedFX camera gate only while the flight blur is needed, then restores the original game code when CJ slows down, lands, disables flight, or hits a safety stop.

The patch validates the expected GTA SA 1.0 code before writing. If another mod has already changed that renderer section, CJ Flight refuses to overwrite unknown bytes.

### Blur compatibility

Do **not** run the legacy `BlurOnExplosion` script alongside CJ Flight. It modifies the same SpeedFX renderer area. Other mods that patch the same post-effects code may also conflict.

Do not hot-reload, replace, or remove CJ Flight while GTA is running. Close and restart the game before changing the script so all temporary in-memory patches are discarded safely.

## Troubleshooting

### `FLY` activates but CJ will not take off

Takeoff is intentionally blocked during missions, inside interiors, while CJ is in a vehicle, and while CJ is in water.

### The mod does not load

Make sure:

- `CJ_Flight_v1.0[mem].js` is inside the CLEO folder.
- `[mem]` is still present in the filename.
- Only one CJ Flight version is installed.
- CLEO Redux and its Input plugin are loading normally.

### Motion blur does not appear

Remove `BlurOnExplosion`, old SpeedBlur diagnostic scripts, and other mods that patch the same SpeedFX renderer code. Also make sure GTA's post-processing effects are enabled.

## Release notes — v1.0

v1.0 preserves the gameplay of the completed v0.8.7 build:

- `FLY` activation.
- 90.0 maximum forward speed with rapid W acceleration.
- 32.0 ascent and 32.0 descent.
- Smooth +15° / -15° vertical flight pitch.
- Locked horizontal flying animation.
- Working high-speed SpeedFX motion blur.
- Automatic gentle landing and temporary fall-damage protection.
- Mission, interior, vehicle, and water safety restrictions.

The v1.0 JavaScript release changes only version/release text from v0.8.7; gameplay logic is unchanged.

## Credits

Rebuilt for CLEO Redux using the legacy `HANCOCK` flight script as a behavior reference, then redesigned around a cleaner GTA SA Classic flight-control system.
