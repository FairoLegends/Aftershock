import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DrillController} from "../DrillController"
import {HazardLabel} from "../HazardLabel"
import {FOOTPRINTS} from "../LayoutGenerator"
import {expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

const SAMPLE_MS = 50
const SAMPLE_SECONDS = 3
const AFTER_BANNER_SECONDS = 0.3
const FAR_CM = 300 // beyond labelNearCm
const OFF_DEG = 90 // the risotto "away" look, well past labelFocusDeg
const EM_DISTANCES_M = [1, 2.5, 4]
const LIGHT_MIN = 0.8
const SETTLE_MS = 300
const REACT_MS = 1000
const DOWN_DEG = 35 // 5m-9: the head looks this far down at the table at the quake start
const BANNER_SLACK_DEG = 6 // 5m-9: the banner center within warnAboveGazeDeg + this of the head's forward
// 5m-10 (M1): the widest hazard label, in em (HazardLabel's layout: ⚠ 1.5 × 1.155 + ICON_GAP 0.4 + INNER_W 13.6 + SLACK 0.12 + 2 × PAD_X 0.64), halved
const LABEL_MAX_HALF_W_EM = (1.5 * 1.155 + 0.4 + 13.6 + 0.12 + 2 * 0.64) / 2
const POS_TOL_CM = 1 // the label is placed with the previous frame's em
const FAR_MIN_CM = 175 // the window look-away spot: still beyond labelNearCm
const FAR_STEP_CM = 25

// DC23 (Slice 12, ENGINEERING_PLAN 5m): the warning banner and the HUD panel
// take turns at quake and aftershock start (5m-1); a notice shows inside the
// panel (5m-2); the label em follows the head distance and every backing is
// light (5m-3); Normal collapses hazard labels to the ⚠ until looked at,
// Easy keeps them full, Hard has none (5m-4).
// 5m-9: the banner follows the head's pitch (looking down at the table, it is in view).
// 5m-10 (M1): the window label sits beside the frame, inside the room, and collapses with risotto.
@component
export class DC23_DesignPass extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      // Normal, with an aftershock.
      c.setLevelForTest("normal")
      c.forceAftershockForTest(true)
      c.disableFallsForTest(true)
      c.config.testMode = true
      await toFreshBriefing(c)
      expect(c.level).toBe("normal")
      const start = startSpot(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await bannerThenPanel(c, getTime())

      // 5m-2: a forced notice shows in the panel; no banner.
      c.hud.showNotice(c.config.bedWarnSeconds, "warn.bed")
      await sleep(SAMPLE_MS * 2)
      expect(c.hud.isNoticeShown).toBe(true)
      expect(c.hud.noticeKey).toBe("warn.bed")
      expect(c.hud.isWarningShown).toBe(false)
      expect(c.hud.isPanelShown).toBe(true)
      expect(isUnder(findSceneObjectByName("Notice.id"), c.hud.getSceneObject())).toBe(true)

      // 5m-4 Normal: collapsed looking 90° off from far, full within
      // labelFocusDeg. The label moves as its em and collapse state change
      // (5m-8), so the head stays INSIDE the room on the start side and every
      // poll re-reads the label's current position and re-aims at it.
      const labels = c.activeHazardLabels
      expect(labels.length > 0).toBe(true)
      const label = labels[0]
      expect(label.isShown).toBe(true)
      const p = labelPosition(label)
      const away = levelLook(start, p)
      const far = new vec3(p.x - away.x * FAR_CM, p.y, p.z - away.z * FAR_CM) // the start side, FAR_CM back
      expect(isInsideRoom(c, far)).toBe(true)
      aim(c, far, label, OFF_DEG)
      await sleep(SETTLE_MS)
      expect(await waitFor(() => aimThen(c, far, label, OFF_DEG, () => label.isCollapsed), REACT_MS)).toBe(true)
      expect(await waitFor(() => aimThen(c, far, label, c.config.labelFocusDeg / 2, () => !label.isCollapsed), REACT_MS)).toBe(true)

      // 5m-10 (M1): the window label is measured on its GlassPane and sits
      // beside it: along the anchor's side axis, past the pane's half-width +
      // labelGapCm, no farther than that + the widest label's half at
      // labelEmMaxCm; centered at most labelBesideCenterCm high; inside the
      // room. Risotto collapses and expands it as the cabinet's above.
      expect(!!(c.layout && c.layout.items.glass)).toBe(true)
      const glass = c.glassLabel
      expect(glass.isShown).toBe(true)
      const anchor = glass.getSceneObject().getParent()
      const pane = anchor ? childNamed(anchor, "GlassPane") : null
      expect(!!pane).toBe(true)
      expect(glass.isBeside).toBe(true)
      const g = labelPosition(glass)
      const side = anchor.getTransform().getWorldRotation().multiplyVec3(vec3.right())
      const lateral = Math.abs(g.sub(pane.getTransform().getWorldPosition()).dot(side))
      const edge = FOOTPRINTS.glass.halfX + c.config.labelGapCm
      console.log(`[Aftershock] DC23: window label ${lateral.toFixed(1)} cm beside the pane center (frame edge + gap ${edge} cm), ${(g.y - c.floorY).toFixed(1)} cm high`)
      expect(lateral > edge).toBe(true)
      expect(lateral <= edge + LABEL_MAX_HALF_W_EM * c.config.labelEmMaxCm + POS_TOL_CM).toBe(true)
      expect(g.y - c.floorY <= c.config.labelBesideCenterCm + POS_TOL_CM).toBe(true)
      expect(isInsideRoom(c, g)).toBe(true)
      const awayG = levelLook(start, g)
      const farG = insideBack(c, g, awayG)
      expect(farG !== null).toBe(true)
      aim(c, farG, glass, OFF_DEG)
      await sleep(SETTLE_MS)
      expect(await waitFor(() => aimThen(c, farG, glass, OFF_DEG, () => glass.isCollapsed), REACT_MS)).toBe(true)
      expect(await waitFor(() => aimThen(c, farG, glass, c.config.labelFocusDeg / 2, () => !glass.isCollapsed), REACT_MS)).toBe(true)

      // Aftershock start: the banner again, then the panel.
      pinDucked(c)
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 1) * 1000)
      await bannerThenPanel(c, getTime())

      // Easy: full labels in the quake; em by distance; light backings.
      c.setLevelForTest("easy")
      c.forceAftershockForTest(false)
      await toFreshBriefing(c)
      expect(c.level).toBe("easy")
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      // 5m-9: looking level (pinDucked), the banner center is above eye level.
      await sleep(SAMPLE_MS * 2)
      expect(c.hud.isWarningShown).toBe(true)
      expect(c.hud.warningPosition.y > c.headPose.position.y).toBe(true)
      const easy = c.activeHazardLabels[0]
      const q = labelPosition(easy)
      const out = levelLook(startSpot(c), q)
      const easyFar = new vec3(q.x + out.x * FAR_CM, q.y, q.z + out.z * FAR_CM)
      c.headPose.setOverride(easyFar, out)
      await sleep(SETTLE_MS)
      expect(easy.isShown).toBe(true)
      expect(easy.isCollapsed).toBe(false)

      // 5m-3: em at 1, 2.5 and 4 m, non-decreasing and within labelEmMinCm..labelEmMaxCm.
      let last = 0
      for (const m of EM_DISTANCES_M) {
        const at = new vec3(q.x - out.x * m * 100, q.y, q.z - out.z * m * 100)
        c.headPose.setOverride(at, out)
        await sleep(SETTLE_MS)
        const em = easy.currentEmCm
        expect(em >= c.config.labelEmMinCm && em <= c.config.labelEmMaxCm).toBe(true)
        expect(em >= last).toBe(true)
        last = em
      }

      // 5m-3: every backing is light: alpha at most 1, RGB at least LIGHT_MIN.
      const all: HazardLabel[] = c.activeHazardLabels.slice()
      expect(c.safeZone.label !== null).toBe(true)
      all.push(c.safeZone.label)
      expect(!!c.roomWalls.doorLabel).toBe(true)
      all.push(c.roomWalls.doorLabel)
      for (const l of all) {
        const b = l.backingColor
        expect(b.w <= 1).toBe(true)
        expect(b.x >= LIGHT_MIN && b.y >= LIGHT_MIN && b.z >= LIGHT_MIN).toBe(true)
      }

      // Hard: no hazard labels in the quake.
      c.setLevelForTest("hard")
      c.forceAftershockForTest(false)
      await toFreshBriefing(c)
      expect(c.level).toBe("hard")
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(SETTLE_MS)
      for (const l of c.activeHazardLabels) {
        expect(l.isShown).toBe(false)
      }
      expect(c.hazardLabelsShown).toBe(false)

      // 5m-9: at a quake start with the head at the start spot looking DOWN_DEG
      // down at the table, the banner shows and its center lies within
      // warnAboveGazeDeg + BANNER_SLACK_DEG of the head's forward.
      c.setLevelForTest("normal")
      c.forceAftershockForTest(false)
      await toFreshBriefing(c)
      const eye = startSpot(c)
      const flat = levelLook(eye, c.safeZone.center)
      const r = (DOWN_DEG * Math.PI) / 180
      c.headPose.setOverride(eye, flat.uniformScale(Math.cos(r)).add(new vec3(0, -Math.sin(r), 0)))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(SAMPLE_MS * 2)
      expect(c.hud.isWarningShown).toBe(true)
      const gazeToBanner = (c.headPose.forward.angleTo(c.hud.warningPosition.sub(eye)) * 180) / Math.PI
      expect(gazeToBanner <= c.config.warnAboveGazeDeg + BANNER_SLACK_DEG).toBe(true)
    } finally {
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}

/**
 * 5m-1 from a quake or aftershock start at `t0`: the banner shows without the
 * panel; after warningShowSeconds + AFTER_BANNER_SECONDS the banner is gone and
 * the panel shows; sampled every SAMPLE_MS for SAMPLE_SECONDS, never both.
 */
async function bannerThenPanel(c: DrillController, t0: number): Promise<void> {
  expect(c.hud.isWarningShown).toBe(true)
  expect(c.hud.isPanelShown).toBe(false)
  const after = t0 + c.config.warningShowSeconds + AFTER_BANNER_SECONDS
  let overlap = false
  let checked = false
  while (getTime() < t0 + SAMPLE_SECONDS) {
    if (c.hud.isWarningShown && c.hud.isPanelShown) overlap = true
    if (!checked && getTime() >= after) {
      checked = true
      expect(c.hud.isWarningShown).toBe(false)
      expect(c.hud.isPanelShown).toBe(true)
    }
    await sleep(SAMPLE_MS)
  }
  expect(checked).toBe(true)
  expect(overlap).toBe(false)
}

function labelPosition(l: HazardLabel): vec3 {
  return l.getSceneObject().getTransform().getWorldPosition()
}

/** Pins the head at `head`, looking at the label's CURRENT position turned `deg` about up. */
function aim(c: DrillController, head: vec3, l: HazardLabel, deg: number): void {
  const to = labelPosition(l).sub(head).normalize()
  c.headPose.setOverride(head, quat.angleAxis((deg * Math.PI) / 180, vec3.up()).multiplyVec3(to))
}

/** aim, then `test`: a waitFor poll that re-aims every time. */
function aimThen(c: DrillController, head: vec3, l: HazardLabel, deg: number, test: () => boolean): boolean {
  aim(c, head, l, deg)
  return test()
}

/** Whether `at` (world) is inside the layout's room rect. */
function isInsideRoom(c: DrillController, at: vec3): boolean {
  const r = c.layout ? c.layout.room : null
  const q = c.room.getTransform().getInvertedWorldTransform().multiplyPoint(at)
  return !!r && q.x > r.minX && q.x < r.maxX && q.z > r.minZ && q.z < r.maxZ
}

/**
 * 5m-10: FAR_CM back from `p` along -`away` (the start side), or the farthest
 * point inside the room at least FAR_MIN_CM back; null if none.
 */
function insideBack(c: DrillController, p: vec3, away: vec3): vec3 | null {
  for (let d = FAR_CM; d >= FAR_MIN_CM; d -= FAR_STEP_CM) {
    const at = new vec3(p.x - away.x * d, p.y, p.z - away.z * d)
    if (isInsideRoom(c, at)) return at
  }
  return null
}

function childNamed(so: SceneObject, name: string): SceneObject | null {
  for (let i = 0; i < so.getChildrenCount(); i++) {
    if (so.getChild(i).name === name) return so.getChild(i)
  }
  return null
}

function isUnder(so: SceneObject | null, root: SceneObject): boolean {
  for (let p = so; p; p = p.getParent()) {
    if (p === root) return true
  }
  return false
}
