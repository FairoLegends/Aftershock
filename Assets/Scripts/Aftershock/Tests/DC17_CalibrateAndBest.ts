import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DrillController} from "../DrillController"
import {lines} from "../Strings"
import {atHeight, CLASSIC, expectState, getController, levelLook, pinDucked, press, restore, saveBests, startSpot, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

/** ResultPanel.setRow's split: a ":" row shows a label and a value as two texts. */
const SPLIT = /^(.*?)\s*[:：]\s*(.+)$/

// DC17 (Slice 8D, 5k items 7 and 12): LEVEL → CALIBRATE with the room hidden;
// standing, then a duck held for calibHoldSeconds shows calib.done, then
// BRIEFING (calibDucked); Skip → BRIEFING at once (not calibrated). On RESULT a
// score over the stored best is kept with result.newBest; result.best always
// shows the best. The wearer's stored bests are saved first and put back by
// restore() (5l-4i).
@component
export class DC17_CalibrateAndBest extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    saveBests(c) // 5l-4i (getController already did, unless an earlier scenario did)
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      // Duck practice: a duck held long enough.
      await this.toCalibrate(c)
      expect(c.calibratePanel.isShown).toBe(true)
      expect(c.calibratePanel.isDone).toBe(false)
      expect(findSceneObjectByName("SafeZoneMarker").isEnabledInHierarchy).toBe(false)
      expect(findSceneObjectByName("CabinetLabel").isEnabledInHierarchy).toBe(false)
      c.headPose.setOverride(startSpot(c), c.headPose.forward) // 5l-4g: standing first, so the duck counts
      await sleep(300)
      c.headPose.setOverride(atHeight(c, startSpot(c), 50), c.headPose.forward)
      expect(await waitFor(() => c.calibratePanel.isDone, (c.config.calibHoldSeconds + 1) * 1000)).toBe(true)
      expect(c.calibratePanel.texts.indexOf(lines("calib.done").primary) >= 0).toBe(true)
      await expectState(c, "BRIEFING", (c.config.calibHoldSeconds + c.config.calibDoneSeconds + 1) * 1000)
      expect(c.calibDucked).toBe(true)
      expect(c.calibrated).toBe(true)
      expect(c.calibratePanel.isShown).toBe(false)
      c.headPose.clearOverride()

      // Skip: BRIEFING at once, not calibrated.
      await this.toCalibrate(c)
      await press("SkipButton")
      expect(c.state).toBe("BRIEFING")
      expect(c.calibDucked).toBe(false)
      expect(c.calibratePanel.isShown).toBe(false)

      // Best, first drill: a fast covered, held drill beats a stored 100.
      c.clearBestsForTest()
      c.setBestForTest("normal", 100)
      expect(c.bestFor("normal")).toBe(100)
      const first = await this.drill(c)
      expect(first).toBeGreaterThan(100)
      expect(c.bestFor("normal")).toBe(first)
      expect(c.resultPanel.texts.indexOf(lines("result.newBest").primary) >= 0).toBe(true)
      this.expectBestRow(c, first)

      // Best, second drill: a stored 1000 is not beaten and stays.
      c.setBestForTest("normal", 1000)
      await this.drill(c)
      expect(c.bestFor("normal")).toBe(1000)
      expect(c.resultPanel.texts.indexOf(lines("result.newBest").primary) >= 0).toBe(false)
      this.expectBestRow(c, 1000)
    } finally {
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }

  /** A fresh LANGUAGE → SAFETY → LEVEL → Normal, which must open CALIBRATE. */
  private async toCalibrate(c: DrillController): Promise<void> {
    c.resetForTest(true) // clears every test hook (5j-19f), so the hooks come after it
    c.setLevelForTest("normal")
    c.forceLayoutForTest(CLASSIC)
    c.forceAftershockForTest(false)
    c.disableFallsForTest(true)
    expect(c.state).toBe("LANGUAGE")
    await press("LangButton.id")
    expect(c.state).toBe("SAFETY")
    await press("ContinueButton")
    expect(c.state).toBe("LEVEL")
    await press("LevelButton.normal")
    expect(c.state).toBe("CALIBRATE")
  }

  /** A 10 s Normal drill: covered at once, holding on, then out the door. Returns the score. */
  private async drill(c: DrillController): Promise<number> {
    c.headPose.clearOverride() // standing, so toFreshBriefing's Skip is not taken for a duck
    c.forceAftershockForTest(false)
    c.disableFallsForTest(true)
    c.config.testMode = true
    c.config.testDurationSeconds = 10
    await toFreshBriefing(c, CLASSIC)
    c.gripHandles.setHoldingForTest(true) // hooks after toFreshBriefing (5j-19f)
    const start = startSpot(c)
    pinDucked(c)
    await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
    expect(await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)).toBe(true)
    await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
    c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
    await walkOut(c)
    expect(c.lastScore !== null).toBe(true)
    return c.lastScore.score
  }

  /** result.best with {score} = `best`: its label and value rows are shown. */
  private expectBestRow(c: DrillController, best: number): void {
    const text = lines("result.best", {"{score}": String(best)}).primary
    const m = SPLIT.exec(text)
    const shown = c.resultPanel.texts
    if (m) {
      expect(shown.indexOf(m[1]) >= 0).toBe(true)
      expect(shown.indexOf(m[2]) >= 0).toBe(true)
    } else {
      expect(shown.indexOf(text) >= 0).toBe(true)
    }
  }
}
