// TDD §7 score formula (default). Pure: no scene access, no components.
const SPEED_MAX_POINTS = 600 // tSafe at or under 5 s
const SPEED_ZERO_AT_S = 30 // tSafe at or over this scores no speed points
const SPEED_RAMP_S = 25 // so speed points are full at 30 - 25 = 5 s
const HEALTH_POINTS_PER_HP = 4 // 0–400 for health 0–100
const PENALTY_PER_SECOND = 10 // per second standing after first taking cover
const SCORE_MIN = 0
const SCORE_MAX = 1000

/** Every part of the score, so the result panel can show why (TDD §7). */
export interface ScoreBreakdown {
  /** Seconds from quake start until first safe, or null if never (Q6). */
  tSafe: number | null
  /** Seconds of walking forgiven (§5j-15c): nearest table distance at quake start ÷ walkSpeed. */
  walkAllowance: number
  /** The time the speed curve scores: max(0, tSafe − walkAllowance), or null if never safe. */
  speedTime: number | null
  speedPoints: number
  healthLeft: number
  healthPoints: number
  secondsStanding: number
  penalty: number
  score: number
}

/**
 * speedTime   = tSafe == null ? null : max(0, tSafe - walkAllowance)   (§5j-15c fair score)
 * speedPoints = tSafe == null ? 0 : round(600 * clamp((30 - speedTime) / 25, 0, 1))
 * healthPts   = tSafe == null ? 0 : round(4 * healthLeft)
 * penalty     = round(10 * secondsStandingAfterFirstSafe)
 * score       = clamp(speedPoints + healthPts - penalty, 0, 1000)
 */
export function computeScore(
  tSafe: number | null,
  healthLeft: number,
  secondsStandingAfterFirstSafe: number,
  walkAllowance: number = 0
): ScoreBreakdown {
  const speedTime = tSafe === null ? null : Math.max(0, tSafe - Math.max(0, walkAllowance))
  const speedPoints =
    speedTime === null ? 0 : Math.round(SPEED_MAX_POINTS * clamp((SPEED_ZERO_AT_S - speedTime) / SPEED_RAMP_S, 0, 1))
  const healthPoints = tSafe === null ? 0 : Math.round(HEALTH_POINTS_PER_HP * healthLeft)
  const penalty = Math.round(PENALTY_PER_SECOND * secondsStandingAfterFirstSafe)
  const score = clamp(speedPoints + healthPoints - penalty, SCORE_MIN, SCORE_MAX)
  return {
    tSafe,
    walkAllowance: Math.max(0, walkAllowance),
    speedTime,
    speedPoints,
    healthLeft,
    healthPoints,
    secondsStanding: secondsStandingAfterFirstSafe,
    penalty,
    score
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
