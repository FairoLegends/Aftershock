import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DangerZone} from "../DangerZone"
import {DrillController} from "../DrillController"
import {layoutParamsFor} from "../Levels"
import {
  BED_TABLE_GAP,
  BED_WALKWAY,
  bedWalkways,
  FOOTPRINTS,
  footprintRect,
  generateLayout,
  glassClearRect,
  isLampByBed,
  Layout,
  LayoutItem,
  overlaps,
  Placement,
  rectDistance,
  ROOM_MAX,
  ROOM_MIN,
  RoomRect,
  TV_BED_GAP,
  WALL_BACKED,
  WALL_GAP,
  WALL_SIDES,
  wallFronts,
  wallInward,
  wallLine
} from "../LayoutGenerator"
import {CLASSIC, getController, itemWorld, restore, sameLayout, copyLayout, startSpot, toFreshBriefing} from "./DrillTestKit"

// DC14 (Slice 8A, §5k items 1–3): four walls stand around the layout, the
// glass sits on a wall line, the exit door is on a wall with its floor rect
// clear of every zone, and a Restart moves the walls with the new layout.
// Slice 9A (§5l item 1): every wall-backed item (cabinet, shelf, TV, glass,
// bed) has its back within 5 cm of a wall line and faces into the room, in the
// live layout and in 30 pure generateLayout calls with random seeds.
// Slice 11 (§5l item 7b–f): the same 30 layouts keep the room rules
// (checkRoomRules), the lamp stands by the bed in 40–80 % of those with a lamp,
// and fewer than 4 fall back to the fixed layout.
@component
export class DC14_WallsAndDoor extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      const params = layoutParamsFor("normal", c.config)
      let fallbacks = 0
      let lamps = 0
      let byBed = 0
      for (let k = 0; k < 30; k++) {
        const seed = 1 + Math.floor(Math.random() * 2147483646)
        const layout = generateLayout({...params, layoutSeed: seed})
        checkWallBacked(layout, `seed ${seed}`)
        checkRoomRules(layout, `seed ${seed}`)
        if (layout.fallback) fallbacks++
        if (layout.items.lamp) {
          lamps++
          if (isLampByBed(layout.items)) byBed++
        }
      }
      // Slice 11 (5l-7c): the lamp stands by the bed in 40–80 % of the layouts with a lamp; fewer than 4 of 30 fall back.
      console.log(`[Aftershock] DC14: ${fallbacks} of 30 fell back; lamp by the bed ${byBed} of ${lamps}`)
      expect(fallbacks).toBeLessThan(4)
      expect(lamps).toBeGreaterThan(0)
      if (lamps > 0) {
        expect(byBed / lamps).toBeGreaterThan(0.4 - 1e-9)
        expect(byBed / lamps).toBeLessThan(0.8 + 1e-9)
      }
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
      c.disableFallsForTest(true) // Slice 7D: no falls in this scenario
      c.config.testMode = true
      await toFreshBriefing(c, CLASSIC)
      checkRoom(c)
      const before = copyLayout(c.layout)
      const rectBefore = copyRect(c.roomWalls.rect)
      // Restart (LEVEL → same level): a new layout, and the walls follow it.
      await toFreshBriefing(c, CLASSIC)
      checkRoom(c)
      const r = c.roomWalls.rect
      const l = c.layout.room
      expect(r.minX === l.minX && r.maxX === l.maxX && r.minZ === l.minZ && r.maxZ === l.maxZ).toBe(true)
      if (!sameLayout(before, c.layout)) {
        expect(sameRect(rectBefore, r)).toBe(false)
      }
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}

/** Every Slice 8A wall and door check on the current BRIEFING layout. */
function checkRoom(c: DrillController): void {
  const w = c.roomWalls
  expect(w.walls.length).toBe(4)
  for (const wall of w.walls) {
    expect(wall.isEnabledInHierarchy).toBe(true)
  }
  const r = w.rect
  expect(r !== null).toBe(true)
  for (const side of [r.maxX - r.minX, r.maxZ - r.minZ]) {
    expect(side).toBeGreaterThan(ROOM_MIN - 0.01)
    expect(side).toBeLessThan(ROOM_MAX + 0.01)
  }
  const layout = c.layout
  checkWallBacked(layout, "live")
  for (const key of Object.keys(layout.items)) {
    const at = layout.items[key as LayoutItem]
    expect(w.insideWalls(itemWorld(c, at.x, at.z, 0))).toBe(true)
  }
  expect(w.insideWalls(startSpot(c))).toBe(true)
  // The window: flush on a wall line.
  const glass = layout.items.glass
  expect(glass !== undefined).toBe(true)
  expect(w.distanceToWall(itemWorld(c, glass.x, glass.z, 0))).toBeLessThan(15)
  // The door: on a wall line, its floor rect in front, outside every zone.
  const center = c.doorCenter
  const normal = c.doorNormal
  expect(center !== null && normal !== null).toBe(true)
  expect(w.distanceToWall(center)).toBeLessThan(1)
  const p = center.add(normal.uniformScale(30))
  expect(c.doorContains(p)).toBe(true)
  expect(w.insideWalls(p)).toBe(true)
  const zones: [LayoutItem, DangerZone][] = [
    ["cabinet", c.cabinetDanger],
    ["shelf", c.shelfDanger],
    ["glass", c.glassDanger],
    ["lamp", c.lampDanger],
    ["tv", c.tvDanger]
  ]
  for (const [item, zone] of zones) {
    if (zone && layout.items[item]) {
      expect(zone.contains(p)).toBe(false)
    }
  }
  for (const zone of c.activeSafeZones) {
    expect(zone.contains(p)).toBe(false)
  }
}

function copyRect(r: RoomRect): RoomRect {
  return {minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ}
}

/**
 * Slice 9A: each wall-backed item in `layout` has, for one of its wall fronts,
 * a wall it faces away from (front · inward > 0.95) with its back edge within
 * 5 cm of that wall line. Room-local cm; front θ = yaw + front → (sin θ, cos θ).
 */
function checkWallBacked(layout: Layout, label: string): void {
  for (const item of WALL_BACKED) {
    const at = layout.items[item]
    if (!at) {
      continue
    }
    const f = FOOTPRINTS[item]
    let ok = false
    let seen = ""
    for (const front of wallFronts(item)) {
      const theta = at.yaw + front
      const dx = Math.sin(theta)
      const dz = Math.cos(theta)
      const depth = Math.abs(Math.sin(front)) > 0.5 ? f.halfX : f.halfZ
      for (const side of WALL_SIDES) {
        const n = wallInward(side)
        if (n.x * dx + n.z * dz <= 0.95) {
          continue
        }
        const back = side === "+x" || side === "-x" ? at.x - dx * depth : at.z - dz * depth
        const gap = Math.abs(back - wallLine(layout.room, side))
        seen += ` ${side}:${gap.toFixed(1)}`
        if (gap <= 5) {
          ok = true
        }
      }
    }
    if (!ok) {
      console.log(`[Aftershock] DC14 ${label}: ${item} at (${at.x.toFixed(1)}, ${at.z.toFixed(1)}) yaw ${at.yaw.toFixed(3)} not wall-backed (facing walls:${seen || " none"})`)
    }
    expect(ok).toBe(true)
  }
}

function sameRect(a: RoomRect, b: RoomRect): boolean {
  return a.minX === b.minX && a.maxX === b.maxX && a.minZ === b.minZ && a.maxZ === b.maxZ
}

/**
 * Slice 11 (5l-7b–f) on a pure layout: the bed's head end on its wall and its
 * yaw square; a long-side walkway with no footprint in it; tables BED_TABLE_GAP
 * and the TV TV_BED_GAP from the bed, the TV off the bed's wall; nothing in the
 * glass's clear rect; tables and the chair square to the walls.
 */
function checkRoomRules(layout: Layout, label: string): void {
  const items = layout.items
  const bed = items.bed
  expect(bed !== undefined).toBe(true)
  if (!bed) {
    return
  }
  const bedRect = footprintRect("bed", bed)
  // Head end at bed-local −Z; local Z = (sin, cos).
  const hx = bed.x - Math.sin(bed.yaw) * FOOTPRINTS.bed.halfZ
  const hz = bed.z - Math.cos(bed.yaw) * FOOTPRINTS.bed.halfZ
  const side = layout.walls.bed
  expect(side !== undefined).toBe(true)
  if (side) {
    const gap = Math.abs((side === "+x" || side === "-x" ? hx : hz) - wallLine(layout.room, side))
    if (gap > WALL_GAP + 1) {
      console.log(`[Aftershock] DC14 ${label}: bed head end ${gap.toFixed(1)} cm from its ${side} wall`)
    }
    expect(gap).toBeLessThan(WALL_GAP + 1 + 1e-6)
  }
  checkSquare("bed", bed, label)
  const bedside = isLampByBed(items)
  let freeWalkway = false
  for (const strip of bedWalkways(bed, layout.room)) {
    let clear = true
    for (const key of Object.keys(items)) {
      const item = key as LayoutItem
      if (item === "bed" || (item === "lamp" && bedside)) continue
      if (overlaps(strip, footprintRect(item, items[item]))) clear = false
    }
    if (clear) freeWalkway = true
  }
  if (!freeWalkway) {
    console.log(`[Aftershock] DC14 ${label}: no free ${BED_WALKWAY} cm walkway beside the bed`)
  }
  expect(freeWalkway).toBe(true)
  for (const t of layout.tables) {
    const at = items[t]
    if (!at) continue
    expect(rectDistance(footprintRect(t, at), bedRect)).toBeGreaterThan(BED_TABLE_GAP - 0.01)
    checkSquare(t, at, label)
  }
  if (items.tv) {
    expect(layout.walls.tv !== layout.walls.bed).toBe(true)
    expect(rectDistance(footprintRect("tv", items.tv), bedRect)).toBeGreaterThan(TV_BED_GAP - 0.01)
  }
  if (items.glass) {
    const clearRect = glassClearRect(items.glass)
    for (const key of Object.keys(items)) {
      const item = key as LayoutItem
      if (item === "glass") continue
      const inFront = overlaps(clearRect, footprintRect(item, items[item]))
      if (inFront) {
        console.log(`[Aftershock] DC14 ${label}: ${item} in front of the glass`)
      }
      expect(inFront).toBe(false)
    }
  }
  if (items.chair) {
    checkSquare("chair", items.chair, label)
  }
}

/** 5l-7b/f: the yaw is a multiple of 90° (±0.5°). */
function checkSquare(item: LayoutItem, at: Placement, label: string): void {
  const q = at.yaw / (Math.PI / 2)
  const offDeg = Math.abs(q - Math.round(q)) * 90
  if (offDeg > 0.5) {
    console.log(`[Aftershock] DC14 ${label}: ${item} yaw ${((at.yaw * 180) / Math.PI).toFixed(1)}° not square`)
  }
  expect(offDeg).toBeLessThan(0.5 + 1e-6)
}
