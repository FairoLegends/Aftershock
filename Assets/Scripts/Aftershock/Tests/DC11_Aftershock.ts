import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {lines} from "../Strings"
import {expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC11 (Slice 7C, ENGINEERING_PLAN 5j items 7, 18): on Normal with the
// aftershock forced, leaving the zone after the main quake starts a quiet
// wait, then AFTERSHOCK (warn.aftershock banner, shake on). Taking cover again
// records its time to cover; when it ends, leaving gives RESULT with the
// result.aftershock row.
@component
export class DC11_Aftershock extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(true)
      c.config.testMode = true
      await toFreshBriefing(c)
      expect(c.level).toBe("normal")
      const start = startSpot(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)
      expect(c.hasBeenSafe).toBe(true)
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      expect(c.aftershockHappened).toBe(false)

      // Leave the zone: the quiet wait, then the aftershock.
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 1) * 1000)
      expect(c.aftershockHappened).toBe(true)
      expect(c.hud.isWarningShown).toBe(true)
      expect(c.hud.warningKey).toBe("warn.aftershock")
      expect(c.quakeShaker.isShaking).toBe(true)
      expect(c.aftershockTimeToCover).toBe(null)

      // Take cover again.
      pinDucked(c)
      await waitFor(() => c.aftershockTimeToCover !== null, (c.config.safeHoldSeconds + 2) * 1000)
      expect(c.aftershockTimeToCover).not.toBe(null)

      // The aftershock ends; leaving gives RESULT.
      await expectState(c, "POST_QUAKE", (c.config.testAftershockDurationSeconds + 2) * 1000)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "RESULT", 2000)
      expect(c.aftershockHappened).toBe(true)
      const s = (c.aftershockTimeToCover as number).toFixed(1)
      const shown = c.resultPanel.texts.join(" | ")
      const label = lines("result.aftershock", {"{s}": s}).primary.split(/[:：]/)[0].trim()
      expect(shown.indexOf(label) >= 0).toBe(true)
      expect(shown.indexOf(s) >= 0).toBe(true)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
