import {mulberry32} from "./LayoutGenerator"

// Slice 14A (ENGINEERING_PLAN 5m item 15): the drill plan. Every random value
// that decides who gets hurt comes from one plan made from one seed (the same
// mulberry32 as the layout): the quake wait and duration, the aftershock, each
// shake's falls, the TV topple, the glass shards and the room shake's phases.
// Pure logic, no scene access. The plan keeps uniforms (0..1), never absolute
// times: the callers map them onto the actual durations with the same formulas
// Math.random had, so testMode durations still work. A repeat
// (DrillController.repeatSameQuake) keeps the plan; a fastened source is
// dropped after its pick, so every other event keeps its place.

/** One fall's uniforms: its time, its source pick, and where and how it lands. */
export interface FallDraw {
  timeU: number
  sourceU: number
  sideU: number
  depthU: number
  yawU: number
  spinU: number
}

/** One shake (the quake or the aftershock). */
export interface ShakePlan {
  countU: number // how many falls, fallCountMin..fallCountMax
  falls: FallDraw[] // the first `count` are used
  tvU: number // the TV topple's fraction, TV_TOPPLE_FROM..TO of the shake
  phases: number[] // QuakeShaker's phases (× 2π)
}

/** One glass shard's start on the pane and landing point on the floor. */
export interface ShardDraw {
  fromX: number
  fromY: number
  toX: number
  toZ: number
}

export interface ShardPlan {
  countU: number
  shards: ShardDraw[]
}

export interface AftershockPlan {
  happensU: number // the aftershock comes when this is below the level's chance
  delayU: number
  durationU: number
}

export interface DrillPlan {
  seed: number
  quakeWaitU: number
  quakeDurationU: number
  aftershock: AftershockPlan
  shakes: ShakePlan[] // [QUAKE_SHAKE, AFTERSHOCK_SHAKE]
  glass: ShardPlan
}

/** How many draws each list gets (the plan's shape). */
export interface PlanRanges {
  fallsMax: number // the most falls one shake can have (DrillConfig fallCountMax)
  phases: number // QuakeShaker SHAKE_PHASES
  shardsMax: number // ShakeFx SHARDS_MAX
}

export const QUAKE_SHAKE = 0
export const AFTERSHOCK_SHAKE = 1

/** The plan for `seed`. The draws come in a fixed order, so one seed always gives one plan. */
export function makePlan(seed: number, ranges: PlanRanges): DrillPlan {
  const rnd = mulberry32(seed)
  const quakeWaitU = rnd()
  const quakeDurationU = rnd()
  const aftershock: AftershockPlan = {happensU: rnd(), delayU: rnd(), durationU: rnd()}
  const shakes = [makeShake(rnd, ranges), makeShake(rnd, ranges)]
  const glass: ShardPlan = {countU: rnd(), shards: []}
  for (let i = 0; i < Math.max(0, ranges.shardsMax); i++) {
    glass.shards.push({fromX: rnd(), fromY: rnd(), toX: rnd(), toZ: rnd()})
  }
  return {seed, quakeWaitU, quakeDurationU, aftershock, shakes, glass}
}

function makeShake(rnd: () => number, r: PlanRanges): ShakePlan {
  const countU = rnd()
  const tvU = rnd()
  const phases: number[] = []
  for (let i = 0; i < r.phases; i++) {
    phases.push(rnd())
  }
  const falls: FallDraw[] = []
  for (let k = 0; k < Math.max(0, r.fallsMax); k++) {
    falls.push({timeU: rnd(), sourceU: rnd(), sideU: rnd(), depthU: rnd(), yawU: rnd(), spinU: rnd()})
  }
  return {countU, falls, tvU, phases}
}

/** min..max at u (0..1); max below min gives min. */
export function between(u: number, min: number, max: number): number {
  return min + u * Math.max(0, max - min)
}

export interface FallRanges {
  fallCountMin: number
  fallCountMax: number
  fallMarginSeconds: number
}

/** One planned fall: `t` s after the shake began, from `from`. */
export interface PlannedFall<T> {
  index: number // its place in the shake's fall list
  t: number
  from: T
  draw: FallDraw
}

export interface ShakeFalls<T> {
  falls: PlannedFall<T>[] // the ones that drop, in plan order
  fastened: number // picked from a fastened source: nothing drops
}

/**
 * This shake's falls over `durationSeconds`: fallCountMin..fallCountMax of
 * them at fallMarginSeconds after the start to fallMarginSeconds before the
 * end (a shake too short for the margins: the middle), each from one of
 * `sources`. A fall whose pick is in `fastened` is dropped after the pick, so
 * the others keep their times, sources and landings.
 */
export function planFalls<T extends {source: string}>(
  shake: ShakePlan,
  durationSeconds: number,
  sources: readonly T[],
  fastened: readonly string[],
  c: FallRanges
): ShakeFalls<T> {
  const out: ShakeFalls<T> = {falls: [], fastened: 0}
  if (sources.length === 0) {
    return out
  }
  const lo = Math.max(0, Math.round(Math.min(c.fallCountMin, c.fallCountMax)))
  const hi = Math.max(lo, Math.round(c.fallCountMax))
  const n = Math.min(shake.falls.length, lo + Math.floor(shake.countU * (hi - lo + 1)))
  let first = c.fallMarginSeconds
  let last = durationSeconds - c.fallMarginSeconds
  if (last < first) {
    first = last = durationSeconds / 2
  }
  for (let k = 0; k < n; k++) {
    const draw = shake.falls[k]
    const from = sources[Math.min(sources.length - 1, Math.floor(draw.sourceU * sources.length))]
    if (fastened.indexOf(from.source) >= 0) {
      out.fastened++
      continue
    }
    out.falls.push({index: k, t: first + draw.timeU * (last - first), from, draw})
  }
  return out
}

/** The TV topple's time (s after the shake began): `from`..`to` of `durationSeconds` at the shake's tvU. */
export function tvToppleTime(shake: ShakePlan, durationSeconds: number, from: number, to: number): number {
  return (from + shake.tvU * (to - from)) * durationSeconds
}
