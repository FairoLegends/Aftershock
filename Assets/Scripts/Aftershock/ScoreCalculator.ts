// Score formula (ENGINEERING_PLAN 5k item 10). Pure: no scene access, no components.
const SPEED_MAX_POINTS = 450 // speedTime at or under 5 s
const SPEED_ZERO_AT_S = 30 // speedTime at or over this scores no cover points
const SPEED_RAMP_S = 25 // so cover points are full at 30 - 25 = 5 s
const HEALTH_POINTS_PER_HP = 3 // 0–300 for health 0–100
const HOLD_MAX_POINTS = 100 // holding the table leg the whole time safe
const EVAC_MAX_POINTS = 150 // door reached at or under EVAC_FAST_S
const EVAC_MIN_POINTS = 75 // door reached at EVAC_SLOW_S
const EVAC_FAST_S = 10
const EVAC_SLOW_S = 30
const EVAC_EVENT_POINTS = 25 // per danger-zone entry or trip during EVACUATE
const PENALTY_PER_SECOND = 10 // per second standing after first taking cover
const SCORE_MIN = 0
const SCORE_MAX = 1000

/** The evacuation part (5k item 8): whether the door was reached, how fast, and the slips on the way. */
export interface EvacInput {
  reached: boolean
  /** Seconds from EVACUATE start to the door. */
  seconds: number
  /** Danger-zone entries plus trips during EVACUATE. */
  events: number
}

/** Every part of the score, so the result panel can show why (TDD §7, 5k item 10). */
export interface ScoreBreakdown {
  /** Seconds from quake start until first safe, or null if never (Q6). */
  tSafe: number | null
  /** Seconds of walking forgiven (§5j-15c): nearest table distance at quake start ÷ walkSpeed. */
  walkAllowance: number
  /** The time the speed curve scores: max(0, tSafe − walkAllowance), or null if never safe. */
  speedTime: number | null
  /** Cover points, 0–450. */
  speedPoints: number
  healthLeft: number
  /** 0–300. */
  healthPoints: number
  /** Seconds holding while safe ÷ seconds safe, main quake (0 to 1). */
  holdShare: number
  /** 0–100. */
  holdPoints: number
  evacReached: boolean
  /** Seconds to the door, or null when not reached. */
  evacTime: number | null
  evacEvents: number
  /** 0–150. */
  evacPoints: number
  secondsStanding: number
  penalty: number
  score: number
}

/**
 * speedTime   = tSafe == null ? null : max(0, tSafe - walkAllowance)   (§5j-15c fair score)
 * speedPoints = tSafe == null ? 0 : round(450 * clamp((30 - speedTime) / 25, 0, 1))
 * healthPts   = tSafe == null ? 0 : round(3 * healthLeft)
 * holdPts     = tSafe == null ? 0 : round(100 * clamp(holdShare, 0, 1))
 * evacPts     = reached ? max(0, round(150 - 75 * clamp((seconds - 10) / 20, 0, 1)) - 25 * events) : 0
 * penalty     = round(10 * secondsStandingAfterFirstSafe)
 * score       = clamp(speedPoints + healthPts + holdPts + evacPts - penalty, 0, 1000)
 */
export function computeScore(
  tSafe: number | null,
  healthLeft: number,
  secondsStandingAfterFirstSafe: number,
  walkAllowance: number = 0,
  holdShare: number = 0,
  evac: EvacInput | null = null
): ScoreBreakdown {
  const speedTime = tSafe === null ? null : Math.max(0, tSafe - Math.max(0, walkAllowance))
  const speedPoints =
    speedTime === null ? 0 : Math.round(SPEED_MAX_POINTS * clamp((SPEED_ZERO_AT_S - speedTime) / SPEED_RAMP_S, 0, 1))
  const healthPoints = tSafe === null ? 0 : Math.round(HEALTH_POINTS_PER_HP * healthLeft)
  const share = clamp(holdShare, 0, 1)
  const holdPoints = tSafe === null ? 0 : Math.round(HOLD_MAX_POINTS * share)
  const reached = evac !== null && evac.reached
  const events = evac === null ? 0 : Math.max(0, Math.round(evac.events))
  let evacPoints = 0
  if (reached) {
    const slow = clamp((evac.seconds - EVAC_FAST_S) / (EVAC_SLOW_S - EVAC_FAST_S), 0, 1)
    const base = Math.round(EVAC_MAX_POINTS - (EVAC_MAX_POINTS - EVAC_MIN_POINTS) * slow)
    evacPoints = Math.max(0, base - EVAC_EVENT_POINTS * events)
  }
  const penalty = Math.round(PENALTY_PER_SECOND * secondsStandingAfterFirstSafe)
  const score = clamp(speedPoints + healthPoints + holdPoints + evacPoints - penalty, SCORE_MIN, SCORE_MAX)
  return {
    tSafe,
    walkAllowance: Math.max(0, walkAllowance),
    speedTime,
    speedPoints,
    healthLeft,
    healthPoints,
    holdShare: share,
    holdPoints,
    evacReached: reached,
    evacTime: reached ? evac.seconds : null,
    evacEvents: events,
    evacPoints,
    secondsStanding: secondsStandingAfterFirstSafe,
    penalty,
    score
  }
}

/** The same inputs as `b`, for recomputing it in tests. */
export function evacOf(b: ScoreBreakdown): EvacInput | null {
  return b.evacReached ? {reached: true, seconds: b.evacTime as number, events: b.evacEvents} : {reached: false, seconds: 0, events: b.evacEvents}
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
