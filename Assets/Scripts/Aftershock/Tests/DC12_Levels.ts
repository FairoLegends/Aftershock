import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getString, lines} from "../Strings"
import {CLASSIC, expectState, getController, levelLook, pinDucked, press, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC12 (Slice 7C, ENGINEERING_PLAN 5j item 18): SAFETY Continue opens the
// level picker. Hard: no guides (no scan, arrow or path), drain x1.5, and the
// reveal on RESULT; Restart keeps Hard with guides hidden again. Easy: a table
// within easyTableMax and the hazard labels stay through the quake.
@component
export class DC12_Levels extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false) // Hard always rolls one; this scenario goes straight to RESULT
      c.disableFallsForTest(true) // Slice 7D: no falls in this scenario
      c.forceLayoutForTest(CLASSIC)
      c.resetForTest(true)
      expect(c.state).toBe("LANGUAGE")
      await press("LangButton.id")
      expect(c.state).toBe("SAFETY")
      c.config.testMode = true
      await press("ContinueButton")
      expect(c.state).toBe("LEVEL")
      expect(c.levelPanel.isShown).toBe(true)
      expect(c.levelPanel.texts.indexOf(getString("level.recommended")) >= 0).toBe(true)

      await press("LevelButton.hard")
      expect(c.state).toBe("BRIEFING")
      expect(c.level).toBe("hard")
      expect(c.levelPanel.isShown).toBe(false)
      expect(c.guidesVisible).toBe(false)
      expect(c.scanActive).toBe(false)
      expect(c.pathVisible).toBe(false)

      const start = startSpot(c)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)
      expect(c.arrowVisible).toBe(false)
      expect(c.pathVisible).toBe(false)

      // Drain x hardDrainMultiplier: stand up at the start spot after cover.
      pinDucked(c)
      await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)
      expect(c.hasBeenSafe).toBe(true)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await sleep(200)
      const h0 = c.health
      const t0 = getTime()
      await sleep(1000)
      const rate = (h0 - c.health) / (getTime() - t0)
      const want = c.config.healthDrainPerSecond * c.config.hardDrainMultiplier
      expect(rate > want * 0.8 && rate < want * 1.2).toBe(true)
      expect(c.inDanger).toBe(false)

      // Back under cover until the quake ends, then leave: RESULT with the reveal.
      pinDucked(c)
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "RESULT", 2000)
      expect(c.guidesVisible).toBe(true)
      expect(c.revealShown).toBe(true)
      expect(c.hazardLabelsShown).toBe(true)
      expect(c.resultPanel.texts.indexOf(lines("result.reveal").primary) >= 0).toBe(true)

      // Restart keeps Hard and hides the guides again.
      await press("RestartButton")
      expect(c.state).toBe("BRIEFING")
      expect(c.level).toBe("hard")
      expect(c.guidesVisible).toBe(false)
      expect(c.revealShown).toBe(false)
      expect(c.scanActive).toBe(false)

      // Easy: a table within easyTableMax, labels stay through the quake.
      c.setLevelForTest("easy")
      await toFreshBriefing(c)
      expect(c.level).toBe("easy")
      expect(c.guidesVisible).toBe(true)
      const easyStart = startSpot(c)
      c.headPose.setOverride(easyStart, levelLook(easyStart, c.safeZone.center))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)
      expect(c.nearestTableDistance <= c.config.easyTableMax).toBe(true)
      expect(c.hazardLabelsShown).toBe(true)
    } finally {
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}
