import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DrillController} from "../DrillController"
import {FixRoomView} from "../FixRoomView"
import {FOOTPRINTS, LayoutForce} from "../LayoutGenerator"
import {PlaneBox} from "../ResultPanel"
import {getString} from "../Strings"
import {
  expectState,
  getController,
  itemWorld,
  levelLook,
  LOOK_AWAY_DEG,
  lookAwayFromMarkers,
  markerAngleDeg,
  press,
  restore,
  toFreshBriefing,
  waitFor,
  walkOut
} from "./DrillTestKit"

/** As DC28: the three fixable items and one table, so the shelf (and the TV once it topples) makes a problem. */
const FIX_SET: LayoutForce = {tables: 1, hazards: ["shelf", "cabinet", "tv"]}
const PLAN_SEED = 14001 // as DC28
const HEAD_OUT_CM = 30 // as DC28: the head this far in front of the shelf's front face
const PILL_WAIT_MS = 1500 // the pill shows on the first frame the gaze is on a marker
const SETTLE_MS = 2500 // the panel follows the turned head (lerp speed 3) before the boxes are read
const HOLD_TOL_S = 0.05 // a frame: how much sooner than fixPillHoldSeconds the full panel may come back

// DC32 (Slice 18, ENGINEERING_PLAN 19b): the fix panel's pill. Drill 1 as DC28
// (FIX_SET rather than CLASSIC: it is the set whose seeded quake makes the shelf
// a problem with the head in its zone, so Perbaiki kamar shows). In the fix room,
// looking straight at each shown marker (its position re-read every poll) shrinks
// the panel to the pill, and the pill's backing, in the head's view plane, does
// not cover that marker. Picking the shelf while looking at it leaves Ulangi
// gempa alone in the pill. Looking LOOK_AWAY_DEG from every marker brings back
// the full panel (Kembali and the instruction) after fixPillHoldSeconds.
@component
export class DC32_FixPill extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevPlanSeed = c.config.planSeed
    const prevHitDamage = c.config.fallHitDamage
    try {
      c.forceAftershockForTest(true)
      c.disableFallsForTest(false)
      c.config.testMode = true
      c.config.testDurationSeconds = 12 // as DC28
      c.config.planSeed = PLAN_SEED
      c.config.fallHitDamage = 1 // as DC28
      c.setLevelForTest("normal")
      const p0 = c.headPose.position
      const f0 = c.headPose.forward
      const f0Level = new vec3(f0.x, 0, f0.z).length > 0.01 ? new vec3(f0.x, 0, f0.z) : new vec3(0, 0, -1)
      c.headPose.setOverride(p0, f0Level)
      await toFreshBriefing(c, FIX_SET)
      await this.runDrill(c, this.headSpot(c))
      expect(c.state).toBe("RESULT")
      expect(c.problemItems.indexOf("shelf") >= 0).toBe(true)

      await press("FixRoomButton")
      const v = c.fixRoomView as FixRoomView
      expect(v !== null).toBe(true)
      expect(v.isOpen).toBe(true)
      const items = v.markersShown
      expect(items.indexOf("shelf") >= 0).toBe(true)

      // A look at each marker: the pill, clear of that marker.
      const hits: string[] = []
      for (const item of items) {
        expect(await waitFor(() => this.lookAt(c, v, item) && v.pillShown, PILL_WAIT_MS)).toBe(true)
        await waitFor(() => !this.lookAt(c, v, item), SETTLE_MS)
        expect(v.pillShown).toBe(true)
        const panel = v.panelBox
        const marker = v.markerBoxes.filter((b) => b.name === item)[0]
        expect(marker !== undefined).toBe(true)
        if (marker) {
          print(`DC32: looking at ${item}: pill ${box(panel)}, marker ${box(marker)} cm`)
          if (overlap(panel, marker)) hits.push(item)
        }
      }
      expect(hits.join(",")).toBe("")

      // The shelf picked while looking at it: Ulangi gempa alone in the pill.
      expect(await waitFor(() => this.lookAt(c, v, "shelf") && v.pillShown, PILL_WAIT_MS)).toBe(true)
      await press("FixShelfButton")
      expect(c.fixSelection.join(",")).toBe("shelf")
      expect(v.pillShown).toBe(true)
      expect(v.repeatShown).toBe(true)
      expect(v.backShown).toBe(false)
      expect(v.instrText).toBe("")

      // Looking away: the full panel after fixPillHoldSeconds.
      const t0 = getTime()
      expect(await lookAwayFromMarkers(c, v)).toBe(true)
      const back = getTime() - t0
      const awayDeg = markerAngleDeg(c, v, c.headPose.forward)
      expect(awayDeg >= LOOK_AWAY_DEG).toBe(true)
      expect(back >= c.config.fixPillHoldSeconds - HOLD_TOL_S).toBe(true)
      expect(v.pillShown).toBe(false)
      expect(v.backShown).toBe(true)
      expect(v.repeatShown).toBe(true)
      expect(v.instrText).toBe(getString("fix.instr"))

      await press("FixBackButton")
      expect(c.fixMode).toBe(false)
      expect(v.isOpen).toBe(false)

      print(`DC32: markers ${items.join(", ")}, pill at each, no overlap; full panel back after ${back.toFixed(2)} s (looking ${awayDeg.toFixed(0)}° from the nearest marker)`)
    } finally {
      c.config.planSeed = prevPlanSeed
      c.config.fallHitDamage = prevHitDamage
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }

  /** Points the head, where it stands, straight at the item's marker as it is now; false when the marker is hidden. */
  private lookAt(c: DrillController, v: FixRoomView, item: string): boolean {
    const p = v.markerPosition(item)
    if (!p) return false
    const eye = c.headPose.position
    c.headPose.setOverride(eye, p.sub(eye).normalize())
    return true
  }

  /** Room-local XZ (x, y = z) of the head spot: HEAD_OUT_CM in front of the shelf's front face, as DC28. */
  private headSpot(c: DrillController): vec2 {
    const at = c.layout.items.shelf
    const f = FOOTPRINTS.shelf
    const theta = at.yaw + f.front
    const depth = Math.abs(Math.sin(f.front)) > 0.5 ? f.halfX : f.halfZ
    const out = depth + HEAD_OUT_CM
    return new vec2(at.x + Math.sin(theta) * out, at.z + Math.cos(theta) * out)
  }

  /** From BRIEFING, as DC28: the head in the shelf's zone through both shakes, then out to RESULT. */
  private async runDrill(c: DrillController, head: vec2): Promise<void> {
    expect(c.state).toBe("BRIEFING")
    const eye = itemWorld(c, head.x, head.y, c.config.eyeHeight)
    const shelf = c.layout.items.shelf
    c.headPose.setOverride(eye, levelLook(eye, itemWorld(c, shelf.x, shelf.z, 0)))
    expect(c.shelfDanger.contains(eye)).toBe(true)
    await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
    await waitFor(() => c.state === "POST_QUAKE" || c.state === "AFTERSHOCK", (c.config.testDurationSeconds + 2) * 1000)
    await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 2) * 1000)
    await waitFor(() => c.state === "POST_QUAKE" || c.state === "EVACUATE", (c.config.testAftershockDurationSeconds + 2) * 1000)
    expect(c.state === "POST_QUAKE" || c.state === "EVACUATE").toBe(true)
    await walkOut(c)
  }
}

function overlap(a: PlaneBox, b: PlaneBox): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY
}

function box(b: PlaneBox): string {
  return `x ${b.minX.toFixed(1)}..${b.maxX.toFixed(1)} y ${b.minY.toFixed(1)}..${b.maxY.toFixed(1)}`
}
