/// <reference path="./.config/sa.d.ts" />

// CJ Flight v1.0 - GitHub release; gameplay preserved from user-tested v0.8.7
// Release build: version/documentation text only; flight behavior is unchanged from v0.8.7.
// GTA San Andreas Classic 1.0 (PC x86). Keep [mem] in the filename.
//
// Type FLY to enable/disable the power.
// While enabled:
//   LEFT SHIFT   Take off; while airborne hold to descend / land
//   W            Fly straight / accelerate
//   A            Steer left
//   D            Steer right
//   SPACE        Ascend
//
// v0.8.7 flight-pitch polish:
//   - Space ascent smoothly pitches CJ upward to +15 degrees.
//   - Shift descent smoothly pitches CJ downward to -15 degrees.
//   - Neutral cruise and the near-ground landing zone return smoothly to level.
//   - Vertical speeds, FLY controls, health protection and working blur are unchanged.
//
// v0.8.6 final vertical-speed tuning:
//   - Space ascent: 16.0 -> 32.0. Main Shift descent remains -32.0.
//   - FLY, near-ground slowdown, takeoff, animation, health and blur are unchanged.
//
// v0.8.5 control update:
//   - FLY replaces both HANCOCK and HANDCOCK.
//   - Main descent: -16.0 -> -32.0. Space ascent remains 16.0.
//   - Near-ground slowdown, takeoff, animation, health and blur are unchanged.
//
// v0.8.4 vertical-speed update:
//   - Space ascent: 8.0 -> 16.0. Shift descent: -8.0 -> -16.0.
//   - Final near-ground descent stays at -2.5 for the existing gentle landing.
//   - Takeoff, forward speed, animation, health and blur logic are unchanged.
//
// v0.8.3 blur-only repair:
//   - BlurOnExplosion.txt and the user's native-code trace identify 0x704D9C:
//     a six-byte JZ which skips SpeedFX if the camera's per-frame flag is zero.
//   - Bypass ONLY that branch, ONLY during an eligible fast-flight request.
//   - Validate exact surrounding instructions before touching code; restore
//     original bytes on slowdown, landing, safety stop or normal JS unwind.
//   - Do not override global/user graphics switches, move the camera, inject
//     calls to JS from rendering, allocate executable code, or add explosions.
//   - Close GTA before replacing/removing this file. Forced script termination
//     can skip finally; restarting GTA always discards this in-memory patch.
//
// v0.8.2 blur-only repair (historical):
//   - Replace unsupported SET_MOTION_BLUR (0374) with SA's current-frame SpeedFX.
//   - Refresh a bounded float request each fast-flight frame; respect graphics flags.
//   - Only the current-frame SpeedFX float is written. No persistent renderer patches.
//   - Controls, flight/landing logic, animation, acceleration and health are unchanged.
//
// v0.8.1 hotfix:
//   - Use SET_CHAR_HEALTH (0223) with CJ's Char, not Player.setHealth.
//   - No changes to flight controls, motion, animation, blur, or health timing.
//
// v0.8 changes:
//   - CJ is continuously given a large temporary health buffer while flying.
//   - Landing keeps that health buffer briefly to cover delayed fall damage.
//   - After the landing grace period, health is normalized to CJ's actual current maximum.
//
// v0.7 changes:
//   - Removed S as the descend control.
//   - Left Shift/Jump now descends while held after takeoff.
//   - The takeoff press must be released once before Shift can descend, preventing instant drop.
//   - CJ keeps the horizontal flight animation all the way down.
//   - Flight ends automatically only when CJ reaches the ground.
//   - Fast W acceleration and high-speed motion blur from v0.6 are retained.

const CHEAT = "FLY";

// Windows virtual-key codes used by CLEO Input.cleo / IS_KEY_PRESSED.
const VK_SPACE = 0x20;
const VK_W = 0x57;
const VK_A = 0x41;
const VK_D = 0x44;
const VK_LSHIFT = 0xA0;

const START_FORWARD_SPEED = 12.0;
const MAX_FORWARD_SPEED = 90.0;
const FORWARD_ACCEL_PER_SEC = 72.0;
const FORWARD_DECEL_PER_SEC = 120.0;
const TURN_SPEED = 3.0;

// SET_MOTION_BLUR (0374) is unsupported in SA. Its actual SpeedFX renderer
// accepts m_fSpeedFXManualSpeedCurrentFrame in 0..1, then resets it after rendering.
// SA 1.0 addresses/types: plugin-sdk CPostEffects.cpp; lifetime: gta-reversed PostEffects.cpp.
// Never call a rendering function from the script phase. Leave permanent
// graphics flags untouched. v0.8.3 temporarily bypasses the per-frame gate.
const BLUR_START_SPEED = 28.0;
const BLUR_MIN_REQUEST = 0.60;
const SPEED_FX_MANUAL = 0xC402C8;       // float, current-frame only
const SPEED_FX_ENABLED = 0x8D5100;      // bool, read-only
const SPEED_FX_USER = 0x8D5108;         // bool, read-only
const SPEED_FX_FRAME = 0x8D5109;        // bool, read-only
const POST_FX_DISABLED = 0xC402CF;      // bool, read-only
const BLUR_GATE = 0x704D9C;
const BLUR_GATE_ORIGINAL = [0x0F, 0x84, 0xF0, 0x00, 0x00, 0x00]; // JZ 0x704E92
const BLUR_GATE_PATCH = [0x90, 0x90, 0x90, 0x90, 0x90, 0x90];
// Exact bytes from cleo_redux(20260919-195040).log, decoded with objdump.
// Keep the preceding global/user gates and following manual-value logic intact.
const BLUR_GATE_PREFIX = [
    0xA0,0x00,0x51,0x8D,0x00,0x84,0xC0,0x0F,0x84,0x0A,0x01,0x00,0x00,
    0xA0,0x08,0x51,0x8D,0x00,0x84,0xC0,0x0F,0x84,0xFD,0x00,0x00,0x00,
    0xA0,0x09,0x51,0x8D,0x00,0x84,0xC0
];
const BLUR_GATE_SUFFIX = [
    0x6A,0x00,0x6A,0xFF,0xE8,0x25,0x93,0xE6,0xFF,
    0xD9,0x05,0xC8,0x02,0xC4,0x00,0xD8,0x1D,0x50,0x8B,0x85,0x00
];
const ASCEND_SPEED = 32.0;
const DESCEND_SPEED = -32.0;
const FINAL_DESCEND_SPEED = -2.5;

const ASCEND_PITCH = 15.0;
const DESCEND_PITCH = -15.0;
const PITCH_RATE_PER_SEC = 90.0;

const TAKEOFF_Z = 7.0;
const TAKEOFF_FRAMES = 28;
const LAND_HEIGHT = 1.25;
const LOW_FLIGHT_HEIGHT = 1.8;

// Flight health protection. 1000 is only temporary; after landing we use
// INCREASE_PLAYER_MAX_HEALTH(0) via Player.increaseMaxHealth(0) to restore
// CJ to his real current maximum without permanently changing that maximum.
const FLIGHT_HEALTH_BUFFER = 1000;
const LANDING_HEALTH_GRACE_MS = 2000;

const player = new Player(0);

let powerEnabled = false;
let flying = false;
let takeoffFrames = 0;
let jumpWasDown = false;
let descentArmed = false;
let cheatWasMatched = false;
let currentForwardSpeed = 0.0;
let currentFlightPitch = 0.0;
let lastFrameMs = Date.now();
let blurActive = false;
let blurAvailable = true;
let blurInitialized = false;
let blurGateOwned = false;
let blurGateAttempted = [false, false, false, false, false, false];
let blurRestoreWarning = false;
let blurGatesLogged = false;
let blurOwnsValue = false;
let blurPreviousValue = 0.0;
let blurLastWritten = 0.0;
let landingHealthGraceUntil = 0;

log("[CJ Flight] v1.0 loaded - type FLY; ascend=32 descend=32; +/-15 degree vertical pitch; working frame-gate blur retained");

function keyHeld(vk) {
    // Use the Input plugin command directly. This is the documented held-key
    // path in CLEO Redux and avoids any ambiguity around keyboard bindings.
    return native("IS_KEY_PRESSED", vk);
}

function getVisibleArea() {
    return native("GET_AREA_VISIBLE");
}

// Return false for any mismatch, including another blur mod's hook. Do not
// assume that NOPs already present belong to us; ownership starts with a match.
function blurBytesMatch(address, expected) {
    for (let i = 0; i < expected.length; i++) {
        if (Memory.ReadU8(address + i, false) !== expected[i]) return false;
    }
    return true;
}

function installFlightBlurGate() {
    if (blurGateOwned) {
        if (!blurBytesMatch(BLUR_GATE, BLUR_GATE_PATCH)) {
            throw new Error("flight blur branch changed while active; not fighting another patch");
        }
        return;
    }
    if (!blurBytesMatch(0x704D7B, BLUR_GATE_PREFIX) ||
        !blurBytesMatch(BLUR_GATE, BLUR_GATE_ORIGINAL) ||
        !blurBytesMatch(0x704DA2, BLUR_GATE_SUFFIX)) {
        throw new Error("blur layout mismatch or another blur patch is installed; no code overwritten");
    }

    // All six writes run synchronously, with no wait/yield inside the patch.
    // Record each attempted byte BEFORE writing, so a partial failure is
    // recoverable even if the memory API writes and then throws.
    blurGateOwned = true;
    blurGateAttempted.fill(false);
    for (let i = 0; i < BLUR_GATE_PATCH.length; i++) {
        blurGateAttempted[i] = true;
        Memory.WriteU8(BLUR_GATE + i, BLUR_GATE_PATCH[i], true);
    }
    if (!blurBytesMatch(BLUR_GATE, BLUR_GATE_PATCH)) {
        throw new Error("blur branch write did not verify");
    }
}

function restoreFlightBlurGate() {
    if (!blurGateOwned) return;
    try {
        const current = BLUR_GATE_ORIGINAL.map((_, i) => Memory.ReadU8(BLUR_GATE + i, false));
        const recognized = current.every((v, i) => v === BLUR_GATE_ORIGINAL[i] ||
            (blurGateAttempted[i] && v === BLUR_GATE_PATCH[i]));
        if (!recognized) {
            // A different mod now owns this instruction. Never restore over it.
            blurGateOwned = false;
            blurAvailable = false;
            log("[CJ Flight] blur branch changed externally; foreign bytes left untouched; restart GTA before retesting");
            return;
        }
        for (let i = 0; i < current.length; i++) {
            if (current[i] !== BLUR_GATE_ORIGINAL[i]) {
                Memory.WriteU8(BLUR_GATE + i, BLUR_GATE_ORIGINAL[i], true);
            }
        }
        if (!blurBytesMatch(BLUR_GATE, BLUR_GATE_ORIGINAL)) {
            throw new Error("restored branch did not verify");
        }
        blurGateOwned = false;
        blurGateAttempted.fill(false);
        blurRestoreWarning = false;
    } catch (e) {
        // Keep ownership so a later tick can retry. Disable further blur use.
        blurAvailable = false;
        if (!blurRestoreWarning) {
            blurRestoreWarning = true;
            log(`[CJ Flight] blur branch restoration pending; restart GTA if this persists: ${e}`);
        }
    }
}

function setFlightBlur(speed) {
    if (!Number.isFinite(speed) || speed < BLUR_START_SPEED) {
        clearFlightBlur();
        return;
    }
    if (!blurAvailable) {
        if (blurGateOwned) clearFlightBlur();
        return;
    }

    try {
        // Fixed SA 1.0 addresses must never be used on a different host.
        if (typeof HOST === "undefined" || HOST !== "sa") {
            throw new Error("this blur backend requires GTA SA Classic 1.0");
        }

        const enabled = Memory.ReadU8(SPEED_FX_ENABLED, false);
        const user = Memory.ReadU8(SPEED_FX_USER, false);
        const frame = Memory.ReadU8(SPEED_FX_FRAME, false);
        const disabled = Memory.ReadU8(POST_FX_DISABLED, false);
        if (![enabled, user, frame, disabled].every(v => v === 0 || v === 1)) {
            throw new Error("unexpected SpeedFX flag values; fixed-address backend disabled");
        }

        if (!blurInitialized) {
            blurInitialized = true;
            log(`[CJ Flight] SpeedFX backend ready: enabled=${enabled} user=${user} frame=${frame} postFxDisabled=${disabled}; frame is a transient camera gate, not a persistent graphics setting`);
        }
        // The old code incorrectly treated FRAME like a permanent graphics
        // option. Camera processing can clear it AFTER the script has run.
        if (!enabled || !user || disabled) {
            clearFlightBlur();
            if (!blurGatesLogged) {
                blurGatesLogged = true;
                log(`[CJ Flight] SpeedFX blocked by graphics flags: enabled=${enabled} user=${user} frame=${frame} postFxDisabled=${disabled}; flags left unchanged`);
            }
            return;
        }

        // Scope the override to live free-roam gameplay only. These checks
        // affect blur, not the existing flight/control/health state machine.
        if (ONMISSION || getVisibleArea() !== 0 ||
            !native("IS_PLAYER_CONTROL_ON", 0) ||
            Memory.ReadU8(0xB5F851, false) !== 0 ||
            Memory.ReadU8(0xB5F852, false) !== 0) {
            clearFlightBlur();
            return;
        }

        // Validate/install before submitting a manual value. An incompatible
        // code layout must leave BOTH the renderer and its request untouched.
        installFlightBlurGate();

        const current = Memory.ReadFloat(SPEED_FX_MANUAL, false);
        if (!Number.isFinite(current) || current < 0.0 || current > 1.0) {
            throw new Error("unexpected current-frame SpeedFX value; refusing to overwrite it");
        }

        const progress = Math.min(1.0, Math.max(0.0,
            (speed - BLUR_START_SPEED) / (MAX_FORWARD_SPEED - BLUR_START_SPEED)));
        const desired = BLUR_MIN_REQUEST + (1.0 - BLUR_MIN_REQUEST) * progress;

        // Save only a same-frame contribution, never a value from a prior flight.
        // If Render has consumed ours, the slot will already have returned to 0.
        const stillOurs = blurOwnsValue && Math.abs(current - blurLastWritten) < 0.000001;
        const prior = stillOurs ? blurPreviousValue : current;
        if (desired > prior) {
            blurPreviousValue = prior;
            blurLastWritten = desired;
            blurOwnsValue = true;
            Memory.WriteFloat(SPEED_FX_MANUAL, desired, false);
        } else {
            if (stillOurs) Memory.WriteFloat(SPEED_FX_MANUAL, prior, false);
            blurOwnsValue = false;
        }

        if (!blurActive) {
            // This confirms a request, not that an external renderer displayed it.
            log(`[CJ Flight] SpeedFX request ON + frame-gate bypass: speed=${speed.toFixed(1)} request=${Math.max(prior, desired).toFixed(2)} sampledFrame=${frame}; visible result needs gameplay verification`);
        }
        blurActive = true;
        // No early return just because blurActive is true: Render resets this
        // slot every frame, so the request has to be refreshed every frame too.
    } catch (e) {
        clearFlightBlur();
        if (blurAvailable) {
            blurAvailable = false;
            log(`[CJ Flight] blur unavailable; flight continues. Keep [mem] in filename. ${e}`);
        }
    }
}

function clearFlightBlur() {
    const wasActive = blurActive;
    if (blurOwnsValue) {
        try {
            const current = Memory.ReadFloat(SPEED_FX_MANUAL, false);
            if (Math.abs(current - blurLastWritten) < 0.000001) {
                Memory.WriteFloat(SPEED_FX_MANUAL, blurPreviousValue, false);
            }
            // A reset or a different value belongs to Render/another effect;
            // leave it alone. Global/user graphics switches were not changed.
        } catch (e) {
            if (blurAvailable) {
                blurAvailable = false;
                log(`[CJ Flight] blur unavailable during cleanup; flight continues. ${e}`);
            }
        }
    }
    restoreFlightBlurGate();
    blurOwnsValue = false;
    blurActive = false;
    blurPreviousValue = 0.0;
    blurLastWritten = 0.0;
    if (wasActive) log(`[CJ Flight] SpeedFX request OFF; branch restoration ${blurGateOwned ? "pending" : "finished"}`);
}


function protectFlightHealth() {
    // SET_PLAYER_HEALTH (0222) is unsupported in GTA SA: Player has no
    // setHealth method. Use SET_CHAR_HEALTH (0223) on CJ's character instead.
    // Preserve v0.8's temporary buffer and two-second landing grace period.
    native("SET_CHAR_HEALTH", player.getChar(), FLIGHT_HEALTH_BUFFER);
}

function normalizePlayerHealth() {
    // Opcode 055E also sets current health to the new maximum. Passing zero
    // leaves CJ's max-health upgrade unchanged and simply refills to that max.
    player.increaseMaxHealth(0);
}

function canUseFlight(char) {
    if (ONMISSION) return false;
    if (getVisibleArea() !== 0) return false;
    if (char.isInAnyCar()) return false;
    if (char.isInWater()) return false;
    return true;
}

function requestFlightAnimation() {
    native("REQUEST_ANIMATION", "PARACHUTE");
}

function flightAnimationLoaded() {
    return native("HAS_ANIMATION_LOADED", "PARACHUTE");
}

function playFlightAnim(char) {
    if (!flightAnimationLoaded()) return;

    // Lock the horizontal arms-back flying pose. The normal interruptible
    // PlayAnim task can be replaced by GTA's automatic airborne/fall task.
    // The original Hancock script uses the non-interruptible opcode here.
    native(
        "TASK_PLAY_ANIM_NON_INTERRUPTABLE",
        char,
        "FALL_SKYDIVE_ACCEL",
        "PARACHUTE",
        4.0,
        true,   // loop
        false,  // lock X
        false,  // lock Y
        true,   // keep last frame
        -1
    );
}

function resetPose(char) {
    const heading = char.getHeading();
    char.clearTasksImmediately();
    char.setRotation(0.0, 0.0, heading);
}

function beginFlight(char) {
    requestFlightAnimation();

    flying = true;
    takeoffFrames = TAKEOFF_FRAMES;
    descentArmed = false;
    currentForwardSpeed = 0.0;
    currentFlightPitch = 0.0;
    lastFrameMs = Date.now();
    clearFlightBlur();
    landingHealthGraceUntil = 0;
    protectFlightHealth();

    char.clearTasksImmediately();
    playFlightAnim(char);
    char.setVelocity(0.0, 0.0, TAKEOFF_Z);

    showTextBox("FLY: Airborne");
    log("[CJ Flight] takeoff");
}

function finishLanding(char) {
    // Keep the oversized health buffer alive across the actual physics/contact
    // frame. GTA may apply fall damage just after the script declares landing.
    protectFlightHealth();
    landingHealthGraceUntil = Date.now() + LANDING_HEALTH_GRACE_MS;

    flying = false;
    takeoffFrames = 0;
    descentArmed = false;
    currentForwardSpeed = 0.0;
    currentFlightPitch = 0.0;
    clearFlightBlur();

    char.setVelocity(0.0, 0.0, 0.0);
    resetPose(char);

    log("[CJ Flight] landed");
}

function stopFlightState(char, clearTasks) {
    flying = false;
    takeoffFrames = 0;
    descentArmed = false;
    currentForwardSpeed = 0.0;
    currentFlightPitch = 0.0;
    clearFlightBlur();

    if (clearTasks) resetPose(char);
}

function togglePower(char) {
    powerEnabled = !powerEnabled;

    if (powerEnabled) {
        requestFlightAnimation();
        showTextBox("FLY: ON - Jump to fly / descend");
        log("[CJ Flight] Flight power enabled");
        return;
    }

    if (flying) stopFlightState(char, true);

    showTextBox("FLY: OFF");
    log("[CJ Flight] Flight power disabled");
}

function getSafetyStopReason(char) {
    if (ONMISSION) return "mission";
    if (getVisibleArea() !== 0) return "interior";
    if (char.isInAnyCar()) return "vehicle";
    if (char.isInWater()) return "water";
    return null;
}

function wrapHeading(heading) {
    while (heading >= 360.0) heading -= 360.0;
    while (heading < 0.0) heading += 360.0;
    return heading;
}

function getFlightPitchTarget(spaceHeld, descending, height, automaticTakeoff) {
    if (automaticTakeoff) return 0.0;
    if (spaceHeld && !descending) return ASCEND_PITCH;
    if (descending && !spaceHeld) {
        if (height <= LOW_FLIGHT_HEIGHT) return 0.0;
        return DESCEND_PITCH;
    }
    return 0.0;
}

function approachFlightPitch(current, target, dt) {
    const maxStep = PITCH_RATE_PER_SEC * dt;
    if (current < target) return Math.min(current + maxStep, target);
    if (current > target) return Math.max(current - maxStep, target);
    return target;
}

// --- Flight loop ---
try {
while (true) {
    wait(0);

    // Retry only a pending blur rollback; no gameplay state is changed here.
    if (!blurAvailable && blurGateOwned) clearFlightBlur();

    if (!player.isPlaying()) {
        flying = false;
        landingHealthGraceUntil = 0;
        takeoffFrames = 0;
        descentArmed = false;
        currentForwardSpeed = 0.0;
        currentFlightPitch = 0.0;
        clearFlightBlur();
        jumpWasDown = keyHeld(VK_LSHIFT);
        continue;
    }

    const char = player.getChar();

    // Continue protecting CJ briefly after the script detects ground contact.
    // This catches GTA's delayed fall-damage application. Once the grace ends,
    // refill to CJ's genuine current max health (including any max-health upgrades).
    if (!flying && landingHealthGraceUntil > 0) {
        if (Date.now() < landingHealthGraceUntil) {
            protectFlightHealth();
        } else {
            landingHealthGraceUntil = 0;
            normalizePlayerHealth();
            log("[CJ Flight] landing health protection ended - health normalized");
        }
    }

    // FLY is the only activation code; old spellings are no longer checked.
    const cheatMatched = Pad.TestCheat(CHEAT);
    if (cheatMatched && !cheatWasMatched) togglePower(char);
    cheatWasMatched = cheatMatched;

    if (powerEnabled) requestFlightAnimation();

    // User's GTA setup has LEFT SHIFT bound to Jump.
    const jumpDown = keyHeld(VK_LSHIFT);
    const jumpPressed = jumpDown && !jumpWasDown;
    jumpWasDown = jumpDown;

    if (powerEnabled && jumpPressed && !flying) {
        if (canUseFlight(char)) {
            beginFlight(char);
            continue;
        }

        showTextBox("FLY unavailable here");
        log("[CJ Flight] takeoff blocked by safety check");
    }

    if (!flying) continue;

    // Do not let the same Shift press used for takeoff immediately become a
    // descend command. Once the player releases Shift, descending is armed.
    if (!jumpDown) descentArmed = true;

    const stopReason = getSafetyStopReason(char);
    if (stopReason !== null) {
        stopFlightState(char, false);
        showTextBox("FLY: safety stop");
        log(`[CJ Flight] safety stop: ${stopReason}`);
        continue;
    }

    // --- Flying ---
    protectFlightHealth();

    // Reassert only if GTA somehow knocked the task out. Because the task is
    // non-interruptible, this should normally remain true for the whole flight.
    if (!char.isPlayingAnim("FALL_SKYDIVE_ACCEL")) {
        playFlightAnim(char);
    }

    const wHeld = keyHeld(VK_W);
    const aHeld = keyHeld(VK_A);
    const dHeld = keyHeld(VK_D);
    const spaceHeld = keyHeld(VK_SPACE);

    let heading = char.getHeading();

    if (aHeld && !dHeld) heading += TURN_SPEED;
    if (dHeld && !aHeld) heading -= TURN_SPEED;
    heading = wrapHeading(heading);

    char.setHeading(heading);

    // W is an accelerator now instead of a fixed-speed switch. At normal
    // frame rates this reaches the 90.0 cap in roughly one second. Use a
    // clamped real-time delta so acceleration stays consistent across FPS.
    const nowMs = Date.now();
    let dt = (nowMs - lastFrameMs) / 1000.0;
    lastFrameMs = nowMs;
    if (dt < 0.0) dt = 0.0;
    if (dt > 0.05) dt = 0.05;

    if (wHeld) {
        if (currentForwardSpeed < START_FORWARD_SPEED) {
            currentForwardSpeed = START_FORWARD_SPEED;
        } else {
            currentForwardSpeed += FORWARD_ACCEL_PER_SEC * dt;
        }
        if (currentForwardSpeed > MAX_FORWARD_SPEED) currentForwardSpeed = MAX_FORWARD_SPEED;
    } else {
        currentForwardSpeed -= FORWARD_DECEL_PER_SEC * dt;
        if (currentForwardSpeed < 0.0) currentForwardSpeed = 0.0;
    }

    // Submit SA's native speed-effect request with a scoped camera-gate bypass.
    setFlightBlur(currentForwardSpeed);

    const radians = (360.0 - heading) * Math.PI / 180.0;
    const vx = Math.sin(radians) * currentForwardSpeed;
    const vy = Math.cos(radians) * currentForwardSpeed;

    let vz = 0.0;
    const descending = descentArmed && jumpDown;
    const height = char.getHeightAboveGround();
    const automaticTakeoff = takeoffFrames > 0 && !spaceHeld && !descending;

    // Space climbs. Once the initial takeoff press has been released, holding
    // Left Shift/Jump descends while keeping the same flight animation. Flight
    // is not cancelled in mid-air; it ends only when CJ actually reaches ground.
    if (spaceHeld && !descending) {
        vz = ASCEND_SPEED;
        takeoffFrames = 0;
    } else if (descending && !spaceHeld) {
        takeoffFrames = 0;

        if (height <= LAND_HEIGHT) {
            finishLanding(char);
            continue;
        }

        // Slow the final few feet so CJ settles onto the ground rather than
        // being driven into it at full descent speed.
        vz = height > LOW_FLIGHT_HEIGHT ? DESCEND_SPEED : FINAL_DESCEND_SPEED;
    } else if (takeoffFrames > 0) {
        vz = TAKEOFF_Z;
        takeoffFrames--;
    }

    const targetPitch = getFlightPitchTarget(spaceHeld, descending, height, automaticTakeoff);
    currentFlightPitch = approachFlightPitch(currentFlightPitch, targetPitch, dt);

    char.setRotation(currentFlightPitch, 0.0, heading);
    char.setVelocity(vx, vy, vz);
}
} finally {
    // Best effort on normal JS unwind. Forced runtime teardown may skip this;
    // close GTA before replacing/removing the script, never hot-reload in flight.
    clearFlightBlur();
}
