import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {layoutParamsFor} from "../Levels"
import {
  dangerRect,
  EVENING_CORRIDOR,
  EVENING_DOOR,
  EVENING_FIXED,
  EVENING_GLASS_FRONT_CLEAR,
  EVENING_NEAR_GAP,
  EVENING_NEAR_PAIRS,
  EVENING_NO_GO,
  EVENING_ON,
  EVENING_ROOM,
  footprintRect,
  generateLayout,
  glassClearRect,
  isHazard,
  isTable,
  Layout,
  LayoutItem,
  LayoutParams,
  overlaps,
  Placement,
  Rect,
  rectDistance,
  TV_BED_GAP
} from "../LayoutGenerator"
import {CLASSIC, DUCKED_HEAD_CM, expectState, getController, itemWorld, levelLook, restore, sameLayout, startSpot, toFreshBriefing} from "./DrillTestKit"

// DC33 (Slice 20, plan 21): the Evening Room preview mode (DrillConfig.previewRoom).
// (a) Pure generateLayout with previewRoom on over the fixed seeds 1..30: no
// fallback; the table, bed and chair on their fixed spots; every footprint inside
// the Evening Room's walls and off its furniture but the mapped piece (EVENING_ON);
// every pair rule; the left corridor free; the TV, shelf, cabinet and lamp each
// on at least DISTINCT_MIN spots. (b) One live drill start in the mode: the Room at
// the preview origin (0, floorY, 0), heading 0; the four wall panels off, the door
// on. (c) previewRoom off again: the next normal BRIEFING shows the walls.
// Slice 20b (plan 21h): seed RECORD_SEED in the mode draws layout A (all five
// hazards); live, the bed anchor is off and ducking on the bed spot during the
// quake gives no warn.bed; off again, the bed anchor is back.
// Slice 20d (plan 21j): live, the floor path from the start runs three legs
// round the sofa through EVENING_PATH_VIAS, no sample on the sofa's no-go rect.
const SEEDS = 30
const DISTINCT_MIN = 3
const SPACING_CM = 30 // the generator's SPACING: footprints grown by this may not overlap
const LIVE_SEED = 7
const POS_TOL = 0.01 // cm
const YAW_TOL = 1e-4 // radians
const EDGE_TOL = 1e-6 // cm: float noise on a wall-backed footprint's edge
const SPOT_ITEMS: LayoutItem[] = ["tv", "shelf", "cabinet", "lamp"]
// Slice 20b (plan 21h): the recording room, layout A (the learner's numbers, 7 Nov), and the bed-spot duck.
const RECORD_SEED = 2106
const LAYOUT_A: Partial<Record<LayoutItem, [number, number]>> = {
  table: [0, -300],
  tv: [-45, -518],
  shelf: [-288, -320],
  cabinet: [-280, -160],
  glass: [198, -220],
  lamp: [-255, -490],
  bed: [-20, -170],
  chair: [125, -375]
}
const LAYOUT_A_TOL = 1 // cm
const ALL_HAZARDS = "cabinet,glass,lamp,shelf,tv" // sorted
const PATH_SAMPLE_CM = 5 // Slice 20d (plan 21j): the floor path's legs are checked this often
const BED_DUCK_MS = 1800 // as DC8: ducked on the bed spot this long
const QUAKE_SECONDS = 30 // as DC8

@component
export class DC33_EveningRoom extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    let wallsBack = false
    let bedBack = false
    try {
      const params: LayoutParams = {...layoutParamsFor("normal", c.config), previewRoom: true}
      let fallbacks = 0
      let triesSum = 0
      let triesMax = 0
      const problems: string[] = []
      const spots: Record<string, string[]> = {}
      const seen: Record<string, number> = {}
      for (const item of SPOT_ITEMS.concat(["glass"])) {
        spots[item] = []
        seen[item] = 0
      }
      for (let seed = 1; seed <= SEEDS; seed++) {
        const layout = generateLayout({...params, layoutSeed: seed})
        if (layout.fallback) fallbacks++
        triesSum += layout.tries
        triesMax = Math.max(triesMax, layout.tries)
        checkEvening(layout, params, `seed ${seed}`, problems)
        for (const item of Object.keys(spots)) {
          const at = layout.items[item as LayoutItem]
          if (!at) continue
          seen[item]++
          const key = `${Math.round(at.x)},${Math.round(at.z)}`
          if (spots[item].indexOf(key) < 0) spots[item].push(key)
        }
      }
      const counts = Object.keys(spots).map((k) => `${k} ${spots[k].length} (in ${seen[k]})`).join(", ")
      console.log(`[Aftershock] DC33: ${fallbacks} of ${SEEDS} fell back; tries mean ${(triesSum / SEEDS).toFixed(1)}, max ${triesMax}; distinct spots ${counts}; ${problems.length} rule breaks`)
      for (const msg of problems.slice(0, 10)) console.log(`[Aftershock] DC33: ${msg}`)
      expect(fallbacks).toBe(0)
      expect(problems.length).toBe(0)
      for (const item of SPOT_ITEMS) {
        expect(spots[item].length).toBeGreaterThan(DISTINCT_MIN - 1)
      }

      // Slice 20b (plan 21h): the recording room
      const rec = generateLayout({...params, layoutSeed: RECORD_SEED})
      const recRead = (Object.keys(rec.items) as LayoutItem[])
        .map((k) => {
          const at = rec.items[k] as Placement
          return `${k} (${at.x.toFixed(1)}, ${at.z.toFixed(1)})`
        })
        .join(", ")
      console.log(`[Aftershock] DC33: seed ${RECORD_SEED}: ${recRead}; hazards ${rec.hazards.join(", ")}; ${rec.tries} tries${rec.fallback ? ", FELL BACK" : ""}`)
      const offA = (Object.keys(LAYOUT_A) as LayoutItem[]).filter((k) => {
        const at = rec.items[k]
        const want = LAYOUT_A[k] as [number, number]
        return !at || Math.abs(at.x - want[0]) > LAYOUT_A_TOL || Math.abs(at.z - want[1]) > LAYOUT_A_TOL
      })
      expect(offA.join(",")).toBe("")
      expect(Object.keys(rec.items).sort().join(",")).toBe(Object.keys(LAYOUT_A).sort().join(","))
      expect(rec.hazards.slice().sort().join(",")).toBe(ALL_HAZARDS)
      expect(rec.fallback).toBe(false)

      // (b) one live drill start in the mode
      c.forceAftershockForTest(false) // no aftershock in this scenario
      c.disableFallsForTest(true) // no falls in this scenario
      c.config.testMode = true
      c.config.testDurationSeconds = QUAKE_SECONDS // Slice 20b: room for the bed-spot duck
      c.config.previewRoom = true
      c.config.layoutSeed = LIVE_SEED
      await toFreshBriefing(c, null)
      const live = c.layout
      expect(live !== null).toBe(true)
      expect(sameLayout(live, generateLayout({...params, layoutSeed: LIVE_SEED}))).toBe(true)
      const liveProblems: string[] = []
      checkEvening(live, params, "live", liveProblems)
      for (const msg of liveProblems) console.log(`[Aftershock] DC33: ${msg}`)
      expect(liveProblems.length).toBe(0)
      const t = c.room.getTransform()
      const pos = t.getWorldPosition()
      const ahead = t.getWorldRotation().multiplyVec3(new vec3(0, 0, 1)) // the Room's +Z in world
      const heading = Math.atan2(ahead.x, ahead.z)
      const wallsOn = c.roomWalls.walls.filter((w) => w.enabled).length
      const doorOn = c.roomWalls.doorObject.isEnabledInHierarchy
      console.log(
        `[Aftershock] DC33: live seed ${live.seed}: Room at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}), floorY ${c.floorY.toFixed(2)}, heading ${((heading * 180) / Math.PI).toFixed(3)} deg; walls on ${wallsOn} of ${c.roomWalls.walls.length}; door ${doorOn ? "on" : "off"}; hazards ${live.hazards.join(", ")}`
      )
      expect(Math.abs(pos.x)).toBeLessThan(POS_TOL)
      expect(Math.abs(pos.z)).toBeLessThan(POS_TOL)
      expect(Math.abs(pos.y - c.floorY)).toBeLessThan(POS_TOL)
      expect(Math.abs(heading)).toBeLessThan(YAW_TOL)
      expect(c.roomWalls.walls.length).toBe(4)
      expect(wallsOn).toBe(0)
      expect(doorOn).toBe(true)

      // Slice 20d (plan 21j): the floor path from the start goes round the sofa: three legs, none on it
      const inv = t.getInvertedWorldTransform()
      const legs = c.floorPath.tablePath(startSpot(c)).map((p) => inv.multiplyPoint(p))
      let samples = 0
      let onSofa = 0
      let nearest = Infinity
      for (let k = 0; k + 1 < legs.length; k++) {
        const a = legs[k]
        const b = legs[k + 1]
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / PATH_SAMPLE_CM))
        for (let i = 0; i <= n; i++) {
          const q: Rect = {x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n, yaw: 0, hx: 0, hz: 0}
          samples++
          if (overlaps(q, EVENING_NO_GO.sofa)) onSofa++
          nearest = Math.min(nearest, rectDistance(q, EVENING_NO_GO.sofa))
        }
      }
      const at = (p: vec3): string => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`
      console.log(
        `[Aftershock] DC33: path from the start: ${legs.length - 1} legs, ${legs.map(at).join(" -> ")}; ${onSofa} of ${samples} samples (every ${PATH_SAMPLE_CM} cm) on the sofa, nearest ${nearest.toFixed(1)} cm`
      )
      expect(legs.length).toBe(4)
      expect(onSofa).toBe(0)
      // Slice 20b (plan 21h): no bed model, and no bed trap on the sofa
      expect(c.bed.enabled).toBe(false)
      const bed = live.items.bed as Placement
      const onBed = itemWorld(c, bed.x, bed.z, DUCKED_HEAD_CM)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      const warnsBefore = c.bedWarnCount
      c.headPose.setOverride(onBed, levelLook(startSpot(c), onBed))
      await sleep(BED_DUCK_MS)
      const bedNotice = c.hud.isNoticeShown && c.hud.noticeKey === "warn.bed"
      console.log(
        `[Aftershock] DC33: ducked on the bed spot (${bed.x.toFixed(1)}, ${bed.z.toFixed(1)}) in ${c.state}: bed anchor ${c.bed.enabled ? "on" : "off"}, ducked ${c.ducked}, nearBed ${c.nearBed}, warn.bed ${c.bedWarnCount - warnsBefore}x, notice ${bedNotice ? "warn.bed" : "none"}`
      )
      expect(c.state).toBe("QUAKE")
      expect(c.ducked).toBe(true)
      expect(c.nearBed).toBe(false)
      expect(c.bedWarnCount).toBe(warnsBefore)
      expect(bedNotice).toBe(false)
    } finally {
      // (c) the mode off again; the next normal BRIEFING shows the walls
      c.config.previewRoom = false
      c.config.layoutSeed = 0
      c.headPose.clearOverride() // Slice 20b: off the bed spot before the next BRIEFING
      try {
        await toFreshBriefing(c, CLASSIC)
        wallsBack = c.roomWalls.walls.length === 4 && c.roomWalls.walls.every((w) => w.isEnabledInHierarchy)
        bedBack = c.bed.isEnabledInHierarchy
        console.log(`[Aftershock] DC33: previewRoom off: walls ${wallsBack ? "shown" : "NOT shown"}, bed anchor ${bedBack ? "on" : "OFF"} on the next normal BRIEFING (seed ${c.layout ? c.layout.seed : "-"})`)
      } finally {
        restore(c, prevTestMode, prevDuration)
      }
    }
    expect(wallsBack).toBe(true)
    expect(bedBack).toBe(true)
  }
}

/** Every plan-21 rule on one Evening Room layout; each break goes to `problems`. */
function checkEvening(layout: Layout, p: LayoutParams, label: string, problems: string[]): void {
  const bad = (msg: string): void => {
    problems.push(`${label}: ${msg}`)
  }
  const r = layout.room
  const w = EVENING_ROOM
  if (r.minX !== w.minX || r.maxX !== w.maxX || r.minZ !== w.minZ || r.maxZ !== w.maxZ) bad("room is not the Evening Room's walls")
  const d = layout.door
  if (d.x !== EVENING_DOOR.x || d.z !== EVENING_DOOR.z || d.nx !== EVENING_DOOR.nx || d.nz !== EVENING_DOOR.nz || d.wall !== EVENING_DOOR.wall) bad("door is not on −x at z 0")
  if (layout.tables.length !== 1 || layout.tables[0] !== "table") bad(`tables ${layout.tables.join(",")}`)
  if (layout.glassWall !== (layout.items.glass ? "+x" : null)) bad(`glassWall ${layout.glassWall}`)
  if (layout.walls.bed) bad("the bed has a wall")
  for (const item of ["table", "bed", "chair"] as LayoutItem[]) {
    const at = layout.items[item]
    const f = EVENING_FIXED[item]
    if (!at) {
      bad(`${item} missing`)
    } else if (Math.abs(at.x - f.x) > POS_TOL || Math.abs(at.z - f.z) > POS_TOL || Math.abs(angleDiff(at.yaw, f.yaw)) > YAW_TOL) {
      bad(`${item} at (${at.x.toFixed(1)}, ${at.z.toFixed(1)}, ${at.yaw.toFixed(3)}), not its fixed spot`)
    }
  }
  const present = Object.keys(layout.items) as LayoutItem[]
  for (const item of present) {
    if (!isTable(item) && !isHazard(item) && item !== "bed" && item !== "chair") bad(`unexpected ${item}`)
    if (isHazard(item) && layout.hazards.indexOf(item) < 0) bad(`${item} placed but not in hazards`)
  }
  for (const h of layout.hazards) {
    if (!layout.items[h]) bad(`hazard ${h} not placed`)
  }
  for (const item of present) {
    const at = layout.items[item] as Placement
    const foot = footprintRect(item, at, 0)
    if (!insideWalls(foot)) bad(`${item} footprint outside the walls`)
    for (const k of Object.keys(EVENING_NO_GO)) {
      if (k !== EVENING_ON[item] && overlaps(foot, EVENING_NO_GO[k])) bad(`${item} on ${k}`)
      if (item === "glass" && overlaps(glassClearRect(at, EVENING_GLASS_FRONT_CLEAR), EVENING_NO_GO[k])) bad(`glass clear rect on ${k}`)
    }
    if (item !== "table" && overlaps(EVENING_CORRIDOR, foot)) bad(`${item} in the left corridor`)
  }
  const safe = footprintRect("table", layout.items.table as Placement, p.safeZoneMargin)
  for (let i = 0; i < present.length; i++) {
    const a = present[i]
    const fa = footprintRect(a, layout.items[a] as Placement, 0)
    if (a !== "table") {
      const own = isHazard(a) ? dangerRect(a, layout.items[a] as Placement, p.dangerMargin, p.tvDangerFront) : fa
      if (overlaps(safe, own)) bad(`${a} ${isHazard(a) ? "zone" : "footprint"} in the safe zone`)
    }
    for (let j = i + 1; j < present.length; j++) {
      const b = present[j]
      const fb = footprintRect(b, layout.items[b] as Placement, 0)
      const near = EVENING_NEAR_PAIRS.indexOf([a, b].sort().join("+")) >= 0
      const gap = rectDistance(fa, fb)
      if (overlaps(footprintRect(a, layout.items[a] as Placement, SPACING_CM), footprintRect(b, layout.items[b] as Placement, SPACING_CM))) {
        if (!near || gap < EVENING_NEAR_GAP) bad(`${a}~${b} ${gap.toFixed(1)} cm apart`)
      }
      if ((a === "bed" && b === "tv") || (a === "tv" && b === "bed")) {
        if (gap < TV_BED_GAP) bad(`bed–TV ${gap.toFixed(1)} cm`)
      }
      if (a === "glass" || b === "glass") {
        if (overlaps(glassClearRect(layout.items.glass as Placement, EVENING_GLASS_FRONT_CLEAR), a === "glass" ? fb : fa)) bad(`${a === "glass" ? b : a} in the glass clear rect`)
      }
    }
  }
}

/** True when the turned rect lies inside the Evening Room's walls. */
function insideWalls(r: Rect): boolean {
  const c = Math.abs(Math.cos(r.yaw))
  const s = Math.abs(Math.sin(r.yaw))
  const ex = r.hx * c + r.hz * s
  const ez = r.hx * s + r.hz * c
  const w = EVENING_ROOM
  return r.x - ex >= w.minX - EDGE_TOL && r.x + ex <= w.maxX + EDGE_TOL && r.z - ez >= w.minZ - EDGE_TOL && r.z + ez <= w.maxZ + EDGE_TOL
}

/** a − b wrapped to (−π, π]. */
function angleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}
