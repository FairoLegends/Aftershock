import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {atHeight, expectState, getController, levelLook, restore, startSpot, toFreshBriefing} from "./DrillTestKit"

// Long enough for health to reach 0: healthStart / healthDrainPerSecond = 25 s at the defaults.
const DURATION_S = 40

// DC6: during a quake, never taking cover, a head inside the cabinet danger
// zone drains health; at 0 the drill is GAME_OVER with over.why.danger.
@component
export class DC6_DangerZoneDrains extends Scenario {
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
      const start = startSpot(c)
      const cabinet = c.cabinetDanger.sceneObject.getTransform().getWorldPosition()
      const inCabinet = atHeight(c, cabinet, c.config.eyeHeight)
      expect(c.cabinetDanger.contains(inCabinet)).toBe(true)
      expect(c.safeZone.contains(inCabinet)).toBe(false)

      // At the start spot during the quake: never safe, out of danger, no drain.
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(500)
      expect(c.inDanger).toBe(false)
      const healthBefore = c.health
      const dangerBefore = c.secondsInDanger

      c.headPose.setOverride(inCabinet, levelLook(start, cabinet))
      await sleep(1000)
      expect(c.inDanger).toBe(true)
      expect(c.hasBeenSafe).toBe(false)
      expect(c.secondsInDanger).toBeGreaterThan(dangerBefore)
      expect(healthBefore).toBeGreaterThan(c.health)

      const drainS = c.config.healthStart / c.config.healthDrainPerSecond
      await expectState(c, "GAME_OVER", (drainS + 3) * 1000)
      expect(c.health).toBe(0)
      expect(c.gameOverReason).toBe("over.why.danger")
      expect(c.resultPanel.isShown).toBe(true)
      expect(c.resultPanel.mode).toBe("gameOver")
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
