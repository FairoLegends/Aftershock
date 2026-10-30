import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CLASSIC, expectState, getController, HoldInteractor, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

// DC16 (5k item 9): on Normal, safe without holding past the grip grace shows
// instr.grip and drains about 1/s; holding stops it (instr.hold), and letting
// go of the pinch ends the hold (5l-4a). At RESULT the hold share is 0..1 and
// the parts add up to the score. On Easy: no drain.
@component
export class DC16_HoldOn extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.setLevelForTest("normal")
      c.forceAftershockForTest(false) // no aftershock in this scenario
      c.disableFallsForTest(true) // no falls in this scenario
      c.config.testMode = true
      c.config.testDurationSeconds = 14 // 5l-4a: room for the release checks
      await toFreshBriefing(c, CLASSIC)
      c.gripHandles.setHoldingForTest(false) // hooks after toFreshBriefing (5j-19f)
      const start = startSpot(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      expect(await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)).toBe(true)
      expect(await waitFor(() => c.gripOverdue, (c.config.testGripGraceSeconds + 2) * 1000)).toBe(true)
      await sleep(200)
      expect(c.instructionKey).toBe("instr.grip")
      const h1 = c.health
      await sleep(1000)
      const drained = h1 - c.health
      expect(drained).toBeGreaterThan(0.5)
      expect(drained).toBeLessThan(1.6)

      c.gripHandles.setHoldingForTest(true)
      await sleep(300)
      expect(c.isHolding).toBe(true)
      expect(c.instructionKey).toBe("instr.hold")
      const h2 = c.health
      await sleep(1000)
      expect(Math.abs(h2 - c.health)).toBeLessThan(0.05)

      // 5l-4a: letting go ends the hold. The hook first, then a real LEAF pinch on a handle.
      c.gripHandles.setHoldingForTest(false)
      await sleep(300)
      expect(c.isHolding).toBe(false)
      c.gripHandles.setHoldingForTest(null) // holding from the pinch again
      const hand = new HoldInteractor()
      await hand.hold("GripHandle0")
      expect(await waitFor(() => c.isHolding, 2000)).toBe(true)
      await hand.release()
      expect(await waitFor(() => !c.isHolding, 2000)).toBe(true)
      c.gripHandles.setHoldingForTest(true) // keep the hold share from here as before

      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await walkOut(c)
      const s = c.lastScore
      expect(s !== null).toBe(true)
      expect(s.holdShare).toBeGreaterThan(-0.001)
      expect(s.holdShare).toBeLessThan(1.001)
      const sum = s.speedPoints + s.healthPoints + s.holdPoints + s.evacPoints - s.penalty
      expect(s.score).toBe(Math.max(0, Math.min(1000, sum)))

      // Easy: the grip is a hint only, no drain.
      c.headPose.clearOverride()
      c.setLevelForTest("easy")
      await toFreshBriefing(c, CLASSIC)
      c.gripHandles.setHoldingForTest(false)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      expect(await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)).toBe(true)
      await sleep((c.config.testGripGraceSeconds + 1.5) * 1000)
      expect(c.state).toBe("QUAKE")
      expect(c.health).toBe(c.config.healthStart)
    } finally {
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}
