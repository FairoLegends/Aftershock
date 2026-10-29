import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {atHeight, expectState, getController, levelLook, pinDucked, press, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// Long enough for health to reach 0: healthStart / healthDrainPerSecond = 25 s at the defaults.
const DURATION_S = 40
const STANDING_HEAD_CM = 160 // well above the stand-up line at floorY + 80

// DC4: after taking cover, standing up in the zone drains health and grows
// the standing penalty; at health 0 the drill is GAME_OVER (over.why.stood),
// and Restart starts a fresh BRIEFING.
@component
export class DC4_StandUpDrainsAndGameOver extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
      c.disableFallsForTest(true) // Slice 7D: no falls in this scenario
      c.config.testMode = true
      c.config.testDurationSeconds = DURATION_S
      await toFreshBriefing(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)
      expect(c.hasBeenSafe).toBe(true)

      // Stand up in the zone, out of every danger zone.
      const healthBefore = c.health
      const standingBefore = c.secondsStanding
      const center = c.safeZone.center
      c.headPose.setOverride(atHeight(c, center, STANDING_HEAD_CM), levelLook(startSpot(c), center))
      await sleep(1500)
      expect(c.state).toBe("QUAKE")
      expect(c.inZone).toBe(true)
      expect(c.ducked).toBe(false)
      expect(c.inDanger).toBe(false)
      expect(healthBefore).toBeGreaterThan(c.health)
      expect(c.secondsStanding).toBeGreaterThan(standingBefore)

      const healthMid = c.health
      const standingMid = c.secondsStanding
      await sleep(1000)
      expect(healthMid).toBeGreaterThan(c.health)
      expect(c.secondsStanding).toBeGreaterThan(standingMid)

      const drainS = c.config.healthStart / c.config.healthDrainPerSecond
      await expectState(c, "GAME_OVER", (drainS + 3) * 1000)
      expect(c.health).toBe(0)
      expect(c.gameOverReason).toBe("over.why.stood")
      expect(c.lastScore).toBe(null)
      expect(c.resultPanel.isShown).toBe(true)
      expect(c.resultPanel.mode).toBe("gameOver")
      expect(findSceneObjectByName("RestartButton").isEnabledInHierarchy).toBe(true)

      await press("RestartButton")
      expect(c.state).toBe("BRIEFING")
      expect(c.health).toBe(c.config.healthStart)
      expect(c.resultPanel.isShown).toBe(false)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
