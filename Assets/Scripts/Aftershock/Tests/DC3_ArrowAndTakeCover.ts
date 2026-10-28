import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {atHeight, DUCKED_HEAD_CM, expectState, getController, levelLook, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

const SETTLE_MS = 400

// DC3: facing away from the safe zone shows the off-screen arrow; facing it
// hides it. Walking into the zone standing asks to duck; ducking asks to hold,
// and after safeHoldSeconds the controller reports safe.
@component
export class DC3_ArrowAndTakeCover extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.config.testMode = true
      await toFreshBriefing(c)
      const start = startSpot(c)
      const aim = c.safeZone.aimPoint
      c.headPose.setOverride(start, levelLook(start, aim, true))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + 2) * 1000)
      await sleep(SETTLE_MS)

      // Facing away, outside the zone.
      expect(c.inZone).toBe(false)
      expect(c.instructionKey).toBe("instr.goUnder")
      expect(c.hud.instructionKey).toBe("instr.goUnder")
      expect(c.arrowVisible).toBe(true)
      expect(c.offscreenArrow.isShown).toBe(true)

      // Facing the zone: the arrow hides.
      c.headPose.setOverride(start, aim.sub(start).normalize())
      await sleep(SETTLE_MS)
      expect(c.arrowVisible).toBe(false)
      expect(c.offscreenArrow.isShown).toBe(false)
      expect(c.instructionKey).toBe("instr.goUnder")

      // In the zone, standing.
      const center = c.safeZone.center
      const look = levelLook(start, center)
      c.headPose.setOverride(atHeight(c, center, c.config.eyeHeight), look)
      await sleep(SETTLE_MS)
      expect(c.inZone).toBe(true)
      expect(c.ducked).toBe(false)
      expect(c.isSafe).toBe(false)
      expect(c.instructionKey).toBe("instr.duck")
      expect(c.arrowVisible).toBe(false)

      // Ducked under the table.
      const healthBefore = c.health
      c.headPose.setOverride(atHeight(c, center, DUCKED_HEAD_CM), look)
      await sleep(SETTLE_MS)
      expect(c.ducked).toBe(true)
      expect(c.isSafe).toBe(true)
      expect(c.instructionKey).toBe("instr.hold")
      expect(c.hud.instructionKey).toBe("instr.hold")
      await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 1) * 1000)
      expect(c.hasBeenSafe).toBe(true)
      expect(c.tSafe).not.toBe(null)
      expect(c.tSafe).toBeGreaterThan(c.config.safeHoldSeconds - 0.05)
      expect(c.health).toBe(healthBefore) // safe: no drain
      expect(c.state).toBe("QUAKE")
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
