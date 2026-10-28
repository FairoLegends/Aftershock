import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {computeScore} from "../ScoreCalculator"
import {expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC5: staying safe until the quake ends gives POST_QUAKE with instr.comeOut;
// leaving the zone gives RESULT with the ScoreCalculator score for the
// recorded inputs, and the Restart button shows.
@component
export class DC5_QuakeEndsScore extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.config.testMode = true
      await toFreshBriefing(c)
      const start = startSpot(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + 2) * 1000)
      await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)
      expect(c.hasBeenSafe).toBe(true)

      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      expect(c.instructionKey).toBe("instr.comeOut")
      expect(c.hud.instructionKey).toBe("instr.comeOut")
      expect(c.quakeShaker.isShaking).toBe(false)
      await sleep(500)
      expect(c.state).toBe("POST_QUAKE") // still under the table: waits

      // The inputs the score is made from, read before leaving the zone.
      const tSafe = c.tSafe
      const health = c.health
      const standing = c.secondsStanding
      expect(tSafe).not.toBe(null)

      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "RESULT", 2000)
      const want = computeScore(tSafe, health, standing)
      const got = c.lastScore
      expect(got).not.toBe(null)
      expect(got.tSafe).toBe(want.tSafe)
      expect(got.healthLeft).toBe(want.healthLeft)
      expect(got.secondsStanding).toBe(want.secondsStanding)
      expect(got.speedPoints).toBe(want.speedPoints)
      expect(got.healthPoints).toBe(want.healthPoints)
      expect(got.penalty).toBe(want.penalty)
      expect(got.score).toBe(want.score)
      expect(got.score).toBeGreaterThan(0)

      expect(c.resultPanel.isShown).toBe(true)
      expect(c.resultPanel.mode).toBe("result")
      expect(findSceneObjectByName("RestartButton").isEnabledInHierarchy).toBe(true)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
