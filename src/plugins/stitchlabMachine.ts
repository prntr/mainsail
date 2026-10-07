// StitchLAB machine rules that the UI mirrors. The machine enforces them in
// stitchlabos-config (embroidery_macros.cfg); the UI only stops offering what
// the machine refuses, so every browser on one machine shows the same thing.

// One stitch is one handwheel turn, 5 mm of Z. The needle is up at every
// multiple of 5 and down half a turn later.
export const STITCH_TRAVEL_MM = 5
export const NEEDLE_DOWN_PHASE_MM = 2.5
// How far from an exact up or down position still counts as that position,
// the same window NEEDLE_TOGGLE uses on the machine.
export const NEEDLE_POSITION_TOLERANCE_MM = 0.5

export type NeedleState = 'up' | 'down' | 'between' | 'unknown'

// Needle state from Klipper's toolhead position, which G92 does not change.
// Before Z is homed the position means nothing, so the state is unknown.
export function needleState(toolheadZ: number | null | undefined, homedAxes: string | null | undefined): NeedleState {
    if (!(homedAxes ?? '').toLowerCase().includes('z')) return 'unknown'
    if (typeof toolheadZ !== 'number' || !Number.isFinite(toolheadZ)) return 'unknown'

    const phase = ((toolheadZ % STITCH_TRAVEL_MM) + STITCH_TRAVEL_MM) % STITCH_TRAVEL_MM
    if (Math.min(phase, STITCH_TRAVEL_MM - phase) < NEEDLE_POSITION_TOLERANCE_MM) return 'up'
    if (Math.abs(phase - NEEDLE_DOWN_PHASE_MM) <= NEEDLE_POSITION_TOLERANCE_MM) return 'down'
    return 'between'
}

export type JobPhase = 'idle' | 'printing' | 'paused'

// Mainsail's printer state ('printing', 'paused', 'standby', 'complete', ...)
// reduced to what the guards need.
export function jobPhase(printerState: string | null | undefined): JobPhase {
    if (printerState === 'printing') return 'printing'
    if (printerState === 'paused') return 'paused'
    return 'idle'
}

// Needle moves that put the logical Z back afterwards. Rethreading during a
// pause needs them.
const NEEDLE_MOVES_KEEPING_Z = ['NEEDLE_TOGGLE', 'STITCH', 'LOCK_STITCH']
// Commands that change the logical Z or home. Klipper would run them between
// two lines of a job, so they wait until the job is over.
const COMMANDS_CHANGING_Z_OR_HOMING = ['NEEDLE_ADJUST', 'ZERO_NEEDLE_POSITION', 'EMBROIDERY_HOME']

// Whether the UI may offer a command in this job phase. Commands outside the
// StitchLAB needle set are not this rule's business and stay allowed.
export function embroideryCommandAllowed(command: string, phase: JobPhase): boolean {
    const name = command.trim().split(/\s+/)[0].toUpperCase()
    const keepsZ = NEEDLE_MOVES_KEEPING_Z.includes(name)
    if (!keepsZ && !COMMANDS_CHANGING_Z_OR_HOMING.includes(name)) return true
    if (phase === 'printing') return false
    if (phase === 'paused') return keepsZ
    return true
}

// What the toolhead panel does: home (motors off counts, it drops the
// homing), jog X/Y, jog Z.
export type ToolheadAction = 'home' | 'jogXY' | 'jogZ'

// The machine cannot refuse a plain G1 jog. An XY jog during a pause drags
// the fabric if the needle is down, and homing loses the job's position, so
// both wait until the job is over. A Z jog during a pause only turns the
// handwheel, and RESUME moves Z back.
export function toolheadActionAllowed(action: ToolheadAction, phase: JobPhase): boolean {
    if (phase === 'printing') return false
    if (phase === 'paused') return action === 'jogZ'
    return true
}
