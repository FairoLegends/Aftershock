import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CLASSIC, doorPoint, expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC15 (5k item 8): after the last shake, leaving cover gives EVACUATE with
// the door as the target. A landed item on the way trips once (warn.trip,
// -10 health); the door gives RESULT with the evac time. Staying put past
// testEvacSeconds gives RESULT with the evacuation failed and 0 evac points.
@component
export class DC15_Evacuation extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.setLevelForTest("normal")
      c.forceAftershockForTest(false) // no aftershock in this scenario
      c.disableFallsForTest(true) // no random falls; the one fall below is forced
      c.config.testMode = true
      await toFreshBriefing(c, CLASSIC)
      const start = startSpot(c)
      const door = doorPoint(c)
      const mid = new vec3((start.x + door.x) / 2, start.y, (start.z + door.z) / 2)
      expect(door.distance(start)).toBeGreaterThan(c.config.tripRadius * 2)

      // Run 1: cover, a fall lands between the start spot and the door, then out.
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      expect(await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)).toBe(true)
      expect(c.forceFallForTest("shelf", mid)).toBe(true)
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      c.headPose.setOverride(start, levelLook(start, door))
      await expectState(c, "EVACUATE", 2000)
      expect(c.hud.instructionKey).toBe("instr.evac")
      expect(c.evacTarget !== null || c.pathVisible).toBe(true)

      const before = c.health
      c.headPose.setOverride(mid, levelLook(start, door))
      expect(await waitFor(() => c.tripCount === 1, 2000)).toBe(true)
      expect(c.hud.noticeKey).toBe("warn.trip")
      expect(before - c.health).toBeGreaterThan(c.config.tripDamage - 0.01)
      await sleep(500)
      expect(c.tripCount).toBe(1) // once per item

      c.headPose.setOverride(door, levelLook(start, door))
      await expectState(c, "RESULT", 2000)
      expect(c.evacTime).not.toBe(null)
      expect(c.evacFailed).toBe(false)
      expect(c.lastScore.evacReached).toBe(true)
      expect(c.lastScore.evacEvents).toBe(c.evacEvents)
      expect(c.resultPanel.isShown).toBe(true)

      // Run 2: out of cover but never to the door: the evacuation times out.
      c.headPose.clearOverride()
      await toFreshBriefing(c, CLASSIC)
      const start2 = startSpot(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      c.headPose.setOverride(start2, levelLook(start2, c.safeZone.center, true))
      await expectState(c, "EVACUATE", 2000)
      await expectState(c, "RESULT", (c.config.testEvacSeconds + 2) * 1000)
      expect(c.evacFailed).toBe(true)
      expect(c.evacTime).toBe(null)
      expect(c.lastScore.evacReached).toBe(false)
      expect(c.lastScore.evacPoints).toBe(0)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
