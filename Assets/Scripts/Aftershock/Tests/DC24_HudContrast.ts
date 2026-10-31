import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {CLASSIC, expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

const SEED = 1155577471 // DC10's fixed layout
const OPAQUE_MIN = 0.9
const LIGHT_MIN = 0.5 // additive display: a fill whose brightest channel is below this reads as a hole
const SHOWN_ALPHA = 0.1 // fills fainter than this are not checked
const TOL = 1e-3
const SETTLE_MS = 200

// DC24 (Slice 13A, ENGINEERING_PLAN 5m item 11): HUD contrast. In a quake at
// step 01 the upcoming step numbers and names (02–04) and the Nyawa/Waktu
// labels use the DrillConfig colors, opaque; no shown HUD fill is dark
// (brightest of r, g, b ≥ LIGHT_MIN wherever alpha > SHOWN_ALPHA, so a green
// tint counts as light). At step 03 the done steps (01, 02) use the done
// color, fill and opacity, unlike the upcoming one.
@component
export class DC24_HudContrast extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevSeed = c.config.layoutSeed
    const cfg = c.config
    try {
      c.setLevelForTest("normal")
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true)
      cfg.testMode = true
      cfg.layoutSeed = SEED
      await toFreshBriefing(c, CLASSIC)
      c.gripHandles.setHoldingForTest(false)
      const start = startSpot(c)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "QUAKE", (cfg.testWaitSeconds + cfg.testScanSeconds + 2) * 1000)
      expect(await waitFor(() => c.hud.isPanelShown, (cfg.warningShowSeconds + 1) * 1000)).toBe(true)
      expect(c.hud.instructionKey).toBe("instr.goUnder")
      await sleep(SETTLE_MS)
      const hud = c.hud.getSceneObject()

      // Step 01: 02–04 are upcoming.
      for (let n = 2; n <= 4; n++) {
        checkColor(textColor(hud, `Step${n}.number`), cfg.hudStepNumberColor, `Step${n}.number`)
        checkColor(textColor(hud, `Step${n}.name`), cfg.hudStepNameColor, `Step${n}.name`)
        expect(textColor(hud, `Step${n}.number`).w >= OPAQUE_MIN).toBe(true)
        expect(textColor(hud, `Step${n}.name`).w >= OPAQUE_MIN).toBe(true)
        checkColor(cellFill(hud, n).backgroundColor, cfg.hudStepFill, `Step${n} fill`)
      }
      for (const label of ["HealthLabel.id", "TimerLabel.id"]) {
        checkColor(textColor(hud, label), cfg.hudLabelColor, label)
        expect(textColor(hud, label).w >= OPAQUE_MIN).toBe(true)
      }
      checkLight(hud)

      // Step 03: hold the table leg under cover.
      pinDucked(c)
      expect(await waitFor(() => c.hasBeenSafe, (cfg.safeHoldSeconds + 2) * 1000)).toBe(true)
      c.gripHandles.setHoldingForTest(true)
      expect(await waitFor(() => c.hud.instructionKey === "instr.hold", 2000)).toBe(true)
      await sleep(SETTLE_MS)
      for (let n = 1; n <= 2; n++) {
        checkColor(textColor(hud, `Step${n}.number`), cfg.hudStepDoneColor, `Step${n}.number (done)`)
        checkColor(textColor(hud, `Step${n}.name`), cfg.hudStepDoneColor, `Step${n}.name (done)`)
        const fill = cellFill(hud, n)
        checkColor(fill.backgroundColor, cfg.hudStepDoneFill, `Step${n} fill (done)`)
        expect(Math.abs(fill.opacity - cfg.hudStepDoneAlpha) < TOL).toBe(true)
      }
      checkColor(textColor(hud, "Step4.name"), cfg.hudStepNameColor, "Step4.name (upcoming)")
      expect(same(cfg.hudStepDoneColor, cfg.hudStepNameColor)).toBe(false)
      expect(same(cfg.hudStepDoneColor, cfg.hudStepNumberColor)).toBe(false)
      expect(same(cfg.hudStepDoneFill, cfg.hudStepFill) && Math.abs(cfg.hudStepDoneAlpha - 1) < TOL).toBe(false)
      checkLight(hud)
    } finally {
      cfg.layoutSeed = prevSeed
      c.gripHandles.setHoldingForTest(false)
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}

function find(root: SceneObject, name: string): SceneObject | null {
  if (root.name === name) return root
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const hit = find(root.getChild(i), name)
    if (hit) return hit
  }
  return null
}

function textColor(hud: SceneObject, name: string): vec4 {
  const so = find(hud, name)
  expect(!!so).toBe(true)
  return (so.getComponent("Component.Text") as Text).textFill.color
}

/** The rounded backing of step cell `n` (1–4). */
function cellFill(hud: SceneObject, n: number): RoundedRectangle {
  const cell = find(hud, "Step" + n)
  expect(!!cell).toBe(true)
  const rects = rectsUnder(cell, false)
  expect(rects.length > 0).toBe(true)
  return rects[0]
}

function rectsUnder(root: SceneObject, enabledOnly: boolean): RoundedRectangle[] {
  const out: RoundedRectangle[] = []
  const walk = (so: SceneObject): void => {
    if (enabledOnly && !so.isEnabledInHierarchy) return
    for (const r of so.getComponents(RoundedRectangle.getTypeName()) as unknown as RoundedRectangle[]) out.push(r)
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  walk(root)
  return out
}

/** Every shown HUD fill is light: its brightest channel is at least LIGHT_MIN. */
function checkLight(hud: SceneObject): void {
  const rects = rectsUnder(hud, true)
  expect(rects.length > 2).toBe(true)
  for (const r of rects) {
    const b = r.backgroundColor
    expect(b !== undefined && b !== null).toBe(true)
    if (b.w * r.opacity <= SHOWN_ALPHA) continue
    const light = Math.max(b.x, b.y, b.z) >= LIGHT_MIN
    if (!light) {
      console.log(`[Aftershock] DC24: dark fill on ${r.getSceneObject().name}: (${b.x}, ${b.y}, ${b.z}, ${b.w})`)
    }
    expect(light).toBe(true)
  }
}

function same(a: vec4, b: vec4): boolean {
  return Math.abs(a.x - b.x) < TOL && Math.abs(a.y - b.y) < TOL && Math.abs(a.z - b.z) < TOL && Math.abs(a.w - b.w) < TOL
}

function checkColor(actual: vec4, want: vec4, label: string): void {
  if (!same(actual, want)) {
    console.log(`[Aftershock] DC24: ${label} is (${actual.x}, ${actual.y}, ${actual.z}, ${actual.w}), config (${want.x}, ${want.y}, ${want.z}, ${want.w})`)
  }
  expect(same(actual, want)).toBe(true)
}
