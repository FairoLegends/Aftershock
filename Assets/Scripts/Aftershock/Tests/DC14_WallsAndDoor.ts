import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DangerZone} from "../DangerZone"
import {DrillController} from "../DrillController"
import {LayoutItem, ROOM_MAX, ROOM_MIN, RoomRect} from "../LayoutGenerator"
import {CLASSIC, getController, itemWorld, restore, sameLayout, copyLayout, startSpot, toFreshBriefing} from "./DrillTestKit"

// DC14 (Slice 8A, §5k items 1–3): four walls stand around the layout, the
// glass sits on a wall line, the exit door is on a wall with its floor rect
// clear of every zone, and a Restart moves the walls with the new layout.
@component
export class DC14_WallsAndDoor extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
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

function sameRect(a: RoomRect, b: RoomRect): boolean {
  return a.minX === b.minX && a.maxX === b.maxX && a.minZ === b.minZ && a.maxZ === b.maxZ
}
