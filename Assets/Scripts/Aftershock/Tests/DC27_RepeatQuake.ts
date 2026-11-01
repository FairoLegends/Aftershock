import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DrillController} from "../DrillController"
import {makePlan, planFalls, PlanRanges, tvToppleTime} from "../DrillPlan"
import {FOOTPRINTS, LayoutForce} from "../LayoutGenerator"
import {SHAKE_PHASES} from "../QuakeShaker"
import {SHARDS_MAX} from "../ShakeFx"
import {expectState, getController, itemWorld, levelLook, press, restore, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

/** Slice 14A: a drill with the shelf (falls), the TV (topple) and the glass (shards). */
const REPEAT_SET: LayoutForce = {tables: 1, hazards: ["shelf", "tv", "glass"]}
const PLAN_SEED = 14001
const HEAD_OUT_CM = 30 // the head stands this far in front of the shelf's front face: half the danger margin
const EDGE_CLEAR_CM = 15 // and at least this far inside the shelf's danger zone every way
const LAND_TOLERANCE_CM = 0.5

/** One finished drill, as DC27 compares them. */
interface DrillRecord {
  layoutSeed: number
  planSeed: number
  plan: string // the plan as JSON
  falls: {shake: number; index: number; t: number; source: string}[]
  drops: {source: string; planned: number | null; x: number; z: number}[]
  tv: {shake: number; t: number}[]
  tvToppled: boolean
  aftershockDelay: number | null
  aftershockLength: number | null
  landed: number
  hit: number
  landedBy: Record<string, number>
  hitBy: Record<string, number>
}

// DC27 (Slice 14A, ENGINEERING_PLAN 5m item 15, decisions 1a 2a 3a 4a): one
// drill plan decides every fall, the TV topple, the aftershock and the shards.
// (a) makePlan is pure and seedable, and fastening a source keeps the other
// events. (b) Drill 1 on Normal, falls on, aftershock forced, a fixed plan
// seed: the head stands still in the shelf's danger zone through both shakes,
// then walks out. (c) repeatSameQuake([]) gives the same schedule, landings,
// counts, TV topple and aftershock. (d) A fastened shelf drops nothing; the TV
// topples at the same time. (e) A fastened TV never topples; the shelf falls
// as before. (f) Restart drops the plan: the next drill has a new layout seed
// and a new plan seed.
@component
export class DC27_RepeatQuake extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevPlanSeed = c.config.planSeed
    const prevHitDamage = c.config.fallHitDamage
    try {
      // (a) Pure: one seed, one plan; a fastened source is dropped after its pick.
      this.checkPurePlan(c)

      c.forceAftershockForTest(true)
      c.disableFallsForTest(false)
      c.config.testMode = true
      c.config.testDurationSeconds = 12 // room for three falls between the 3 s margins
      c.config.planSeed = PLAN_SEED
      c.config.fallHitDamage = 1 // every hit counted, but the drill lives to the aftershock
      c.setLevelForTest("normal")
      // The room is placed at the head at every BRIEFING: each drill starts from this pose.
      const p0 = c.headPose.position
      const f0 = c.headPose.forward
      const f0Level = new vec3(f0.x, 0, f0.z).length > 0.01 ? new vec3(f0.x, 0, f0.z) : new vec3(0, 0, -1)
      c.headPose.setOverride(p0, f0Level)

      // (b) Drill 1.
      await toFreshBriefing(c, REPEAT_SET)
      expect(c.level).toBe("normal")
      expect(c.isRepeat).toBe(false)
      expect(c.planSeed).toBe(PLAN_SEED)
      expect(c.layout.items.shelf !== undefined).toBe(true)
      expect(c.layout.items.tv !== undefined).toBe(true)
      const head = this.headSpot(c)
      const drill1 = await this.runDrill(c, head)
      expect(drill1.falls.length).toBeGreaterThan(0)
      expect(drill1.tv.length).toBe(1)
      expect(drill1.tvToppled).toBe(true)
      expect(drill1.aftershockDelay !== null).toBe(true)
      expect(drill1.aftershockLength !== null).toBe(true)
      print(`DC27 drill 1 landings, cm from the head (hit radius ${c.config.fallHitRadius}): ${drill1.drops.map((d) => `${d.source} ${Math.sqrt((d.x - head.x) * (d.x - head.x) + (d.z - head.y) * (d.z - head.y)).toFixed(1)}`).join(", ")}`)

      // (c) The same quake again: an identical schedule and outcome.
      c.headPose.setOverride(p0, f0Level)
      expect(c.repeatSameQuake([])).toBe(true)
      expect(c.state).toBe("BRIEFING")
      expect(c.isRepeat).toBe(true)
      expect(c.fastened.length).toBe(0)
      const b1 = c.baseline
      expect(b1 !== null).toBe(true)
      expect(b1 ? b1.landed : -1).toBe(drill1.landed)
      expect(b1 ? b1.hit : -1).toBe(drill1.hit)
      const repeat = await this.runDrill(c, head)
      expect(repeat.layoutSeed).toBe(drill1.layoutSeed)
      expect(repeat.planSeed).toBe(drill1.planSeed)
      expect(repeat.plan === drill1.plan).toBe(true)
      expect(sameFalls(repeat.falls, drill1.falls)).toBe(true)
      expect(sameDrops(repeat.drops, drill1.drops)).toBe(true)
      expect(repeat.landed).toBe(drill1.landed)
      expect(repeat.hit).toBe(drill1.hit)
      expect(sameTv(repeat.tv, drill1.tv)).toBe(true)
      expect(repeat.tvToppled).toBe(true)
      expect(repeat.aftershockDelay).toBe(drill1.aftershockDelay)
      expect(repeat.aftershockLength).toBe(drill1.aftershockLength)

      // (d) The shelf fastened: nothing from the shelf; the TV topples at the same time.
      c.headPose.setOverride(p0, f0Level)
      expect(c.repeatSameQuake(["shelf"])).toBe(true)
      const b2 = c.baseline
      expect(b2 ? b2.landed : -1).toBe(repeat.landed) // the baseline is the drill that just ended
      expect(c.fastened.join(",")).toBe("shelf")
      const shelfFast = await this.runDrill(c, head)
      expect(shelfFast.layoutSeed).toBe(drill1.layoutSeed)
      expect(shelfFast.plan === drill1.plan).toBe(true)
      expect(shelfFast.falls.length).toBe(0)
      expect(shelfFast.drops.filter((d) => d.source === "shelf").length).toBe(0)
      expect(shelfFast.landedBy["shelf"] || 0).toBe(0)
      expect(shelfFast.hitBy["shelf"] || 0).toBe(0)
      expect(sameTv(shelfFast.tv, drill1.tv)).toBe(true)
      expect(shelfFast.tvToppled).toBe(true)
      expect(shelfFast.landedBy["tv"] || 0).toBe(drill1.landedBy["tv"] || 0)
      expect(shelfFast.hitBy["tv"] || 0).toBe(drill1.hitBy["tv"] || 0)
      expect(shelfFast.aftershockDelay).toBe(drill1.aftershockDelay)
      expect(shelfFast.aftershockLength).toBe(drill1.aftershockLength)

      // (e) The TV fastened: it never topples; the shelf falls as in drill 1.
      c.headPose.setOverride(p0, f0Level)
      expect(c.repeatSameQuake(["tv"])).toBe(true)
      const tvFast = await this.runDrill(c, head)
      expect(tvFast.layoutSeed).toBe(drill1.layoutSeed)
      expect(tvFast.tv.length).toBe(0)
      expect(tvFast.tvToppled).toBe(false)
      expect(tvFast.landedBy["tv"] || 0).toBe(0)
      expect(sameFalls(tvFast.falls, drill1.falls)).toBe(true)
      expect(sameDrops(tvFast.drops, drill1.drops)).toBe(true)
      expect(tvFast.landedBy["shelf"] || 0).toBe(drill1.landedBy["shelf"] || 0)
      expect(tvFast.hitBy["shelf"] || 0).toBe(drill1.hitBy["shelf"] || 0)
      expect(tvFast.aftershockDelay).toBe(drill1.aftershockDelay)
      expect(tvFast.aftershockLength).toBe(drill1.aftershockLength)

      // (f) Restart drops the plan, the fastened list and the baseline; the next drill is new.
      c.config.planSeed = 0
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      expect(c.plan).toBe(null)
      expect(c.baseline).toBe(null)
      expect(c.fastened.length).toBe(0)
      expect(c.isRepeat).toBe(false)
      c.headPose.setOverride(p0, f0Level)
      await toFreshBriefing(c, REPEAT_SET)
      expect(c.isRepeat).toBe(false)
      const nextLayoutSeed = c.layout.seed
      const nextPlanSeed = c.planSeed
      if (c.config.layoutSeed === 0) {
        expect(nextLayoutSeed !== drill1.layoutSeed).toBe(true)
      }
      expect(nextPlanSeed !== 0).toBe(true)
      expect(nextPlanSeed !== drill1.planSeed).toBe(true)

      print(
        `DC27: plan seed ${drill1.planSeed}, layout seed ${drill1.layoutSeed}; drill 1: falls [${describeFalls(drill1)}], TV ${describeTv(drill1)}, aftershock delay ${fmt(drill1.aftershockDelay)} s length ${fmt(drill1.aftershockLength)} s, landed ${drill1.landed} hit ${drill1.hit}` +
          ` | repeat []: falls [${describeFalls(repeat)}], TV ${describeTv(repeat)}, aftershock ${fmt(repeat.aftershockDelay)}/${fmt(repeat.aftershockLength)} s, landed ${repeat.landed} hit ${repeat.hit}` +
          ` | [shelf]: ${shelfFast.falls.length} falls, shelf landed ${shelfFast.landedBy["shelf"] || 0}, TV ${describeTv(shelfFast)}, landed ${shelfFast.landed} hit ${shelfFast.hit}` +
          ` | [tv]: TV ${tvFast.tvToppled ? "toppled" : "upright"}, falls [${describeFalls(tvFast)}], landed ${tvFast.landed} hit ${tvFast.hit}` +
          ` | Restart: layout seed ${nextLayoutSeed}, plan seed ${nextPlanSeed}`
      )
    } finally {
      c.config.planSeed = prevPlanSeed
      c.config.fallHitDamage = prevHitDamage
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }

  /** (a) makePlan twice is deep-equal, another seed differs, and a fastened shelf keeps every other fall. */
  private checkPurePlan(c: DrillController): void {
    const ranges: PlanRanges = {fallsMax: 3, phases: SHAKE_PHASES, shardsMax: SHARDS_MAX}
    expect(JSON.stringify(makePlan(PLAN_SEED, ranges)) === JSON.stringify(makePlan(PLAN_SEED, ranges))).toBe(true)
    expect(JSON.stringify(makePlan(PLAN_SEED, ranges)) === JSON.stringify(makePlan(PLAN_SEED + 1, ranges))).toBe(false)
    const sources = [{source: "shelf"}, {source: "cabinet"}]
    const fall = {fallCountMin: c.config.fallCountMin, fallCountMax: 3, fallMarginSeconds: c.config.fallMarginSeconds}
    let fastenedSeen = 0
    let keptSeen = 0
    for (let seed = 1; seed <= 40; seed++) {
      const plan = makePlan(seed, ranges)
      for (const shake of plan.shakes) {
        const all = planFalls(shake, 12, sources, [], fall)
        const some = planFalls(shake, 12, sources, ["shelf"], fall)
        const kept = all.falls.filter((f) => f.from.source !== "shelf")
        expect(some.falls.length).toBe(kept.length)
        expect(some.fastened).toBe(all.falls.length - kept.length)
        for (let i = 0; i < kept.length; i++) {
          expect(some.falls[i].index).toBe(kept[i].index)
          expect(some.falls[i].t).toBe(kept[i].t)
          expect(JSON.stringify(some.falls[i].draw) === JSON.stringify(kept[i].draw)).toBe(true)
        }
        expect(tvToppleTime(shake, 12, 0.25, 0.75)).toBe(tvToppleTime(shake, 12, 0.25, 0.75))
        fastenedSeen += some.fastened
        keptSeen += kept.length
      }
    }
    expect(fastenedSeen).toBeGreaterThan(0)
    expect(keptSeen).toBeGreaterThan(0)
  }

  /** Room-local XZ (x, y = z) of the head spot: HEAD_OUT_CM in front of the shelf's front face, at its middle. */
  private headSpot(c: DrillController): vec2 {
    const at = c.layout.items.shelf
    const f = FOOTPRINTS.shelf
    const theta = at.yaw + f.front
    const depth = Math.abs(Math.sin(f.front)) > 0.5 ? f.halfX : f.halfZ
    const out = depth + HEAD_OUT_CM
    return new vec2(at.x + Math.sin(theta) * out, at.z + Math.cos(theta) * out)
  }

  /** From BRIEFING: the head stands still at `head` through the quake and the aftershock, then walks out to RESULT. */
  private async runDrill(c: DrillController, head: vec2): Promise<DrillRecord> {
    expect(c.state).toBe("BRIEFING")
    const eye = itemWorld(c, head.x, head.y, c.config.eyeHeight)
    const shelf = c.layout.items.shelf
    const look = levelLook(eye, itemWorld(c, shelf.x, shelf.z, 0))
    expect(c.shelfDanger.contains(eye)).toBe(true)
    for (const [dx, dz] of [[EDGE_CLEAR_CM, 0], [-EDGE_CLEAR_CM, 0], [0, EDGE_CLEAR_CM], [0, -EDGE_CLEAR_CM]]) {
      expect(c.shelfDanger.contains(itemWorld(c, head.x + dx, head.y + dz, c.config.eyeHeight))).toBe(true)
    }
    c.headPose.setOverride(eye, look)
    const layoutSeed = c.layout.seed
    const planSeed = c.planSeed
    const plan = JSON.stringify(c.plan)
    await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
    // A head outside cover rolls the aftershock (and after it, EVACUATE) the frame POST_QUAKE begins.
    await waitFor(() => c.state === "POST_QUAKE" || c.state === "AFTERSHOCK", (c.config.testDurationSeconds + 2) * 1000)
    await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 2) * 1000)
    await waitFor(() => c.state === "POST_QUAKE" || c.state === "EVACUATE", (c.config.testAftershockDurationSeconds + 2) * 1000)
    expect(c.state === "POST_QUAKE" || c.state === "EVACUATE").toBe(true)
    const record: DrillRecord = {
      layoutSeed,
      planSeed,
      plan,
      falls: c.fallPlan.map((f) => ({shake: f.shake, index: f.index, t: f.t, source: f.source})),
      drops: c.fallingObjects.drops.map((d) => ({source: d.source, planned: d.planned, x: d.x, z: d.z})),
      tv: c.tvPlan.map((t) => ({shake: t.shake, t: t.t})),
      tvToppled: c.tvToppled,
      aftershockDelay: c.aftershockDelay,
      aftershockLength: c.aftershockLength,
      landed: c.replayTrack.count("landed"),
      hit: c.replayTrack.count("hit"),
      landedBy: bySource(c, "landed"),
      hitBy: bySource(c, "hit")
    }
    await walkOut(c)
    return record
  }
}

function bySource(c: DrillController, kind: "landed" | "hit"): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of c.replayTrack.events) {
    if (e.kind === kind && e.source) {
      out[e.source] = (out[e.source] || 0) + 1
    }
  }
  return out
}

function sameFalls(a: DrillRecord["falls"], b: DrillRecord["falls"]): boolean {
  return a.length === b.length && a.every((f, i) => f.shake === b[i].shake && f.index === b[i].index && f.source === b[i].source && Math.abs(f.t - b[i].t) < 1e-6)
}

function sameDrops(a: DrillRecord["drops"], b: DrillRecord["drops"]): boolean {
  return (
    a.length === b.length &&
    a.every((d, i) => d.source === b[i].source && d.planned === b[i].planned && Math.abs(d.x - b[i].x) <= LAND_TOLERANCE_CM && Math.abs(d.z - b[i].z) <= LAND_TOLERANCE_CM)
  )
}

function sameTv(a: DrillRecord["tv"], b: DrillRecord["tv"]): boolean {
  return a.length === b.length && a.every((t, i) => t.shake === b[i].shake && Math.abs(t.t - b[i].t) < 1e-6)
}

function describeFalls(r: DrillRecord): string {
  return r.drops.map((d) => `${d.source}@${d.planned === null ? "-" : d.planned.toFixed(2)}s(${d.x.toFixed(1)},${d.z.toFixed(1)})`).join(" ")
}

function describeTv(r: DrillRecord): string {
  return r.tv.length > 0 ? `${r.tv[0].shake === 0 ? "quake" : "aftershock"}@${r.tv[0].t.toFixed(2)}s${r.tvToppled ? "" : " (not toppled)"}` : r.tvToppled ? "toppled (unplanned)" : "none"
}

function fmt(n: number | null): string {
  return n === null ? "-" : n.toFixed(2)
}
