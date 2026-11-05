import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DrillConfig} from "../DrillConfig"
import {DrillController, FIXABLE} from "../DrillController"
import {AFTERSHOCK_SHAKE, between, makePlan, planFalls, PlanRanges, QUAKE_SHAKE} from "../DrillPlan"
import {FALL_SOURCES} from "../FallingObjects"
import {generateLayout, Layout} from "../LayoutGenerator"
import {aftershockChance, fallsOn, layoutParamsFor, Level} from "../Levels"
import {SHAKE_PHASES} from "../QuakeShaker"
import {SHARDS_MAX} from "../ShakeFx"
import {expectState, getController, restore, sameLayout, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

// The published counts: docs/review/fix-room-stats/README.md (computed by tools/fix-room-stats/fixroom_stats.mjs).
const LEVEL: Level = "normal"
const SEED_FIRST = 1
const SEED_LAST = 30 // each seed as layoutSeed and planSeed
const FALLS_NO_FIX = 82
const FALLS_SHELF = 54 // from FALL_SOURCES (the shelf)
const FALLS_TV = 28 // TV topples
const FALLS_SHELF_FASTENED = 28 // still land with the shelf fastened (54 of 82 prevented)
const FALLS_ALL_FASTENED = 0 // every FIXABLE hazard fastened
const ROOMS_SHELF = 22
const ROOMS_TV = 28
const ROOMS_AFTERSHOCK = 15
const ROOMS_FALLBACK = 0
// The demo take (README "Check against a real drill"); both seeds are float32-exact, so DrillConfig keeps them.
const DEMO_LAYOUT_SEED = 208930688
const DEMO_PLAN_SEED = 1066210688
const DEMO_LANDED = 5
const DEMO_LANDED_SHELF_FASTENED = 1
const TIME_TOL_S = 0.001 // 1 ms
const TEST_DURATION_S = 12 // as DC27: room for three falls between the 3 s margins

/** Falls in one room for one fastened list. */
interface RoomCount {
  shelf: number // from FALL_SOURCES, both shakes
  tv: number // 0 or 1
  total: number
}

/** One seeded room, counted as fixroom_stats.mjs `measure`. */
interface RoomStats {
  layoutSeed: number
  planSeed: number
  shelfHazard: boolean
  tvHazard: boolean
  sources: number
  aftershock: boolean
  fallback: boolean
  base: RoomCount
  shelfOnly: RoomCount
  allFix: RoomCount
}

// DC30 (fix-room stats): (a) a pure count over Normal seeds 1..30 with the
// Lens's own generateLayout, makePlan and planFalls, the way DrillController
// counts (scheduleFalls, canTopple, the plan's aftershock draw), on the
// quakeDuration*/aftershockDuration* tunables, never the test durations.
// (b) The totals, room counts and the demo take are the published ones,
// exactly. (c) One live drill on the demo take's seeds schedules the same
// quake falls as the pure planFalls, and repeatSameQuake(["shelf"]) schedules
// none from the shelf.
@component
export class DC30_FixRoomStats extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevPlanSeed = c.config.planSeed
    const prevLayoutSeed = c.config.layoutSeed
    const prevLevel = c.level
    const prevAftershock = c.aftershockForcedForTest
    const prevFallsOff = c.fallsDisabledForTest
    try {
      // (a) Pure: seeds 1..30.
      const rooms: RoomStats[] = []
      for (let s = SEED_FIRST; s <= SEED_LAST; s++) {
        rooms.push(measure(c.config, s, s))
      }
      const sum = (f: (r: RoomStats) => number) => rooms.reduce((n, r) => n + f(r), 0)
      const base = sum((r) => r.base.total)
      const baseShelf = sum((r) => r.base.shelf)
      const baseTv = sum((r) => r.base.tv)
      const shelfLeft = sum((r) => r.shelfOnly.total)
      const allLeft = sum((r) => r.allFix.total)
      const roomsShelf = sum((r) => (r.shelfHazard ? 1 : 0))
      const roomsTv = sum((r) => (r.tvHazard ? 1 : 0))
      const roomsAftershock = sum((r) => (r.aftershock ? 1 : 0))
      const roomsFallback = sum((r) => (r.fallback ? 1 : 0))
      const roomsZero = sum((r) => (r.allFix.total === 0 ? 1 : 0))
      const medianBase = median(rooms.map((r) => r.base.total))
      const medianShelf = median(rooms.map((r) => r.shelfOnly.total))
      console.log(
        `[Aftershock] DC30 rooms (seed: shelf/tv/aftershock, no fix -> shelf -> all): ${rooms
          .map((r) => `${r.layoutSeed}: ${yn(r.shelfHazard)}/${yn(r.tvHazard)}/${yn(r.aftershock)} ${r.base.total}->${r.shelfOnly.total}->${r.allFix.total}`)
          .join(", ")}`
      )

      // (b) 1-3: the published totals.
      expect(base).toBe(FALLS_NO_FIX)
      expect(baseShelf).toBe(FALLS_SHELF)
      expect(baseTv).toBe(FALLS_TV)
      expect(shelfLeft).toBe(FALLS_SHELF_FASTENED)
      expect(allLeft).toBe(FALLS_ALL_FASTENED)
      expect(roomsShelf).toBe(ROOMS_SHELF)
      expect(roomsTv).toBe(ROOMS_TV)
      expect(roomsAftershock).toBe(ROOMS_AFTERSHOCK)
      expect(roomsFallback).toBe(ROOMS_FALLBACK)
      // (b) 4: nothing to fall, nothing counted; fastening never adds a fall.
      const calmNonZero = rooms.filter((r) => r.sources === 0 && !r.tvHazard && (r.base.total > 0 || r.shelfOnly.total > 0 || r.allFix.total > 0))
      expect(calmNonZero.map((r) => r.layoutSeed).join(",")).toBe("")
      const more = rooms.filter((r) => r.shelfOnly.total > r.base.total || r.allFix.total > r.base.total)
      expect(more.map((r) => r.layoutSeed).join(",")).toBe("")
      // (b) 5: the demo take.
      const demo = measure(c.config, DEMO_LAYOUT_SEED, DEMO_PLAN_SEED)
      expect(demo.base.total).toBe(DEMO_LANDED)
      expect(demo.shelfOnly.total).toBe(DEMO_LANDED_SHELF_FASTENED)

      // (c) The live controller on the demo take's seeds: the generator's own layout, the plan's own aftershock draw.
      c.config.planSeed = DEMO_PLAN_SEED
      c.config.layoutSeed = DEMO_LAYOUT_SEED
      c.config.testMode = true
      c.config.testDurationSeconds = TEST_DURATION_S
      c.setLevelForTest(LEVEL)
      c.forceAftershockForTest(null)
      c.disableFallsForTest(false)
      const p0 = c.headPose.position
      const f0 = c.headPose.forward
      const f0Level = new vec3(f0.x, 0, f0.z).length > 0.01 ? new vec3(f0.x, 0, f0.z) : new vec3(0, 0, -1)
      c.headPose.setOverride(p0, f0Level)
      await toFreshBriefing(c, null)
      expect(c.isRepeat).toBe(false)
      expect(c.planSeed).toBe(DEMO_PLAN_SEED)
      expect(c.layout.seed).toBe(DEMO_LAYOUT_SEED)
      const pureLayout = generateLayout({...layoutParamsFor(LEVEL, c.config), layoutSeed: DEMO_LAYOUT_SEED})
      const purePlan = makePlan(DEMO_PLAN_SEED, planRanges(c.config))
      expect(sameLayout(c.layout, pureLayout)).toBe(true)
      expect(c.layout.hazards.join(",")).toBe(pureLayout.hazards.join(","))
      expect(JSON.stringify(c.plan) === JSON.stringify(purePlan)).toBe(true)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      const quakeDur = c.quakeDuration // what enterQuake used (testDurationSeconds in test mode)
      expect(quakeDur).toBeGreaterThan(0)
      const live = c.fallPlan.filter((f) => f.shake === QUAKE_SHAKE)
      const pure = planFalls(purePlan.shakes[QUAKE_SHAKE], quakeDur, fallSources(pureLayout), c.fastened, c.config).falls
      expect(c.fastened.length).toBe(0)
      expect(pure.length).toBeGreaterThan(0)
      expect(live.length).toBe(pure.length)
      for (let i = 0; i < Math.min(live.length, pure.length); i++) {
        expect(live[i].index).toBe(pure[i].index)
        expect(live[i].source).toBe(pure[i].from.source)
        expect(Math.abs(live[i].t - pure[i].t)).toBeLessThan(TIME_TOL_S)
      }
      const matched = live.length
      const liveLog = live.map((f) => `#${f.index} ${f.t.toFixed(3)} s ${f.source}`).join(", ")
      await finishDrill(c)

      // (c) The same quake with the shelf fastened: nothing scheduled from the shelf.
      c.headPose.setOverride(p0, f0Level)
      expect(c.repeatSameQuake(["shelf"])).toBe(true)
      expect(c.state).toBe("BRIEFING")
      expect(c.fastened.join(",")).toBe("shelf")
      expect(c.planSeed).toBe(DEMO_PLAN_SEED)
      expect(c.layout.seed).toBe(DEMO_LAYOUT_SEED)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      expect(c.fallPlan.filter((f) => f.source === "shelf").length).toBe(0)
      const repeatLive = c.fallPlan.filter((f) => f.shake === QUAKE_SHAKE).length
      const repeatPure = planFalls(purePlan.shakes[QUAKE_SHAKE], c.quakeDuration, fallSources(pureLayout), c.fastened, c.config).falls
      expect(repeatLive).toBe(repeatPure.length)
      await finishDrill(c)
      console.log(`[Aftershock] DC30 live: quake ${quakeDur.toFixed(2)} s, falls [${liveLog}]; repeat [shelf]: ${repeatLive} quake falls scheduled`)

      print(
        `DC30: Normal seeds ${SEED_FIRST}..${SEED_LAST}: falls ${base} (shelf ${baseShelf}, TV ${baseTv}); shelf fastened ${base - shelfLeft} of ${base} prevented; all fixable ${base - allLeft} of ${base}` +
          `; rooms shelf ${roomsShelf} tv ${roomsTv} aftershock ${roomsAftershock} fallback ${roomsFallback}; median per room ${medianBase} -> ${medianShelf}; rooms at 0 after all fixes ${roomsZero}` +
          `; demo take ${demo.base.total} -> ${demo.shelfOnly.total}; live quake schedule matches pure (${matched} falls)`
      )
    } finally {
      c.config.planSeed = prevPlanSeed
      c.config.layoutSeed = prevLayoutSeed
      c.setLevelForTest(prevLevel)
      restore(c, prevTestMode, prevDuration)
      c.forceAftershockForTest(prevAftershock)
      c.disableFallsForTest(prevFallsOff)
    }
  }
}

/** One room as fixroom_stats.mjs `measure`: falls from the plan with nothing, the shelf, and every fixable hazard fastened. */
function measure(cfg: DrillConfig, layoutSeed: number, planSeed: number): RoomStats {
  const layout = generateLayout({...layoutParamsFor(LEVEL, cfg), layoutSeed})
  const plan = makePlan(planSeed, planRanges(cfg))
  const hazards: readonly string[] = layout.hazards
  const sources = fallSources(layout)
  const aftershock = plan.aftershock.happensU < aftershockChance(LEVEL, cfg)
  const quakeDur = between(plan.quakeDurationU, cfg.quakeDurationMin, cfg.quakeDurationMax)
  const afterDur = between(plan.aftershock.durationU, cfg.aftershockDurationMin, cfg.aftershockDurationMax)
  const count = (fastened: readonly string[]): RoomCount => {
    if (!fallsOn(LEVEL)) return {shelf: 0, tv: 0, total: 0}
    let shelf = planFalls(plan.shakes[QUAKE_SHAKE], quakeDur, sources, fastened, cfg).falls.length
    if (aftershock) shelf += planFalls(plan.shakes[AFTERSHOCK_SHAKE], afterDur, sources, fastened, cfg).falls.length
    // canTopple: present, a hazard, not fastened; the quake always reaches its topple time and the topple counts as landed
    const tv = layout.items.tv && hazards.indexOf("tv") >= 0 && fastened.indexOf("tv") < 0 ? 1 : 0
    return {shelf, tv, total: shelf + tv}
  }
  const fixableHere = FIXABLE.filter((h) => hazards.indexOf(h) >= 0)
  return {
    layoutSeed,
    planSeed,
    shelfHazard: hazards.indexOf("shelf") >= 0,
    tvHazard: hazards.indexOf("tv") >= 0,
    sources: sources.length,
    aftershock,
    fallback: layout.fallback,
    base: count([]),
    shelfOnly: count(["shelf"]),
    allFix: count(fixableHere)
  }
}

/** scheduleFalls' sources: each FALL_SOURCES item present and among the hazards. */
function fallSources(layout: Layout): {source: string}[] {
  return FALL_SOURCES.filter((s) => !!layout.items[s] && layout.hazards.indexOf(s) >= 0).map((s) => ({source: s}))
}

/** DrillController.planRanges, from this config. */
function planRanges(cfg: DrillConfig): PlanRanges {
  return {fallsMax: Math.max(0, Math.round(Math.max(cfg.fallCountMin, cfg.fallCountMax))), phases: SHAKE_PHASES, shardsMax: SHARDS_MAX}
}

/** From QUAKE, as DC28's calm drill: to RESULT or GAME_OVER, walking out from EVACUATE. */
async function finishDrill(c: DrillController): Promise<void> {
  const cfg = c.config
  const ms = (cfg.testDurationSeconds + cfg.testAftershockDelaySeconds + cfg.testAftershockDurationSeconds + 8) * 1000
  await waitFor(() => c.state === "EVACUATE" || c.state === "RESULT" || c.state === "GAME_OVER", ms)
  if (c.state === "EVACUATE") {
    await walkOut(c)
  }
  expect(c.state === "RESULT" || c.state === "GAME_OVER").toBe(true)
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

function yn(v: boolean): string {
  return v ? "yes" : "no"
}
