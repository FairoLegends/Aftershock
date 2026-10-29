import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {atHeight, expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC13 (Slice 7D, ENGINEERING_PLAN 5j items 8, 17e, 19b): on Normal with the
// CLASSIC set (shelf and cabinet present), an item landing on a standing head
// outside every danger zone does nothing; inside the shelf's danger zone it
// costs fallHitDamage and shows hit.fell; one landing on a head ducked under
// the table does nothing. Easy schedules no falls; Normal schedules
// fallCountMin..fallCountMax.
@component
export class DC13_FallingObjects extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true) // only the forced falls below
      c.config.testMode = true
      c.config.testDurationSeconds = 15 // room for both forced falls
      await toFreshBriefing(c)
      expect(c.level).toBe("normal")
      const start = startSpot(c)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)

      // (a) At the start spot (outside every danger zone), not safe: an item landing on the head does not hit (5j-19b).
      expect(c.inDanger).toBe(false)
      expect(c.isSafe).toBe(false)
      const landedOut = c.fallsLanded
      const hitsOut = c.fallHits
      expect(c.forceFallForTest("shelf", start)).toBe(true)
      await waitFor(() => c.fallsLanded > landedOut, 2000)
      expect(c.fallsLanded).toBe(landedOut + 1)
      expect(c.fallHits).toBe(hitsOut)

      // Inside the shelf's danger zone, standing, not safe: a shelf item lands on the head.
      const shelf = c.shelfDanger.sceneObject.getTransform().getWorldPosition()
      const inShelf = atHeight(c, shelf, c.config.eyeHeight)
      expect(c.shelfDanger.contains(inShelf)).toBe(true)
      c.headPose.setOverride(inShelf, levelLook(start, shelf))
      await sleep(300)
      expect(c.inDanger).toBe(true)
      expect(c.isSafe).toBe(false)
      const landed0 = c.fallsLanded
      const hits0 = c.fallHits
      const h0 = c.health
      const d0 = c.secondsInDanger
      expect(c.forceFallForTest("shelf", inShelf)).toBe(true)
      await waitFor(() => c.fallsLanded > landed0, 2000)
      const h1 = c.health
      expect(c.fallsLanded).toBe(landed0 + 1)
      expect(c.fallHits).toBe(hits0 + 1)
      // Audit: exact again. Lost = the hit + the danger drain for the seconds actually spent in the
      // zone while the item fell (Normal level: multiplier 1).
      const drained = (c.secondsInDanger - d0) * c.config.healthDrainPerSecond
      const lost = h0 - h1
      expect(Math.abs(lost - (c.config.fallHitDamage + drained))).toBeLessThan(0.5)
      expect(c.hud.isNoticeShown).toBe(true)
      expect(c.hud.noticeKey).toBe("hit.fell")

      // (b) Ducked under the table, safe: a cabinet item lands on the head, no hit.
      pinDucked(c)
      await waitFor(() => c.isSafe, 2000)
      expect(c.isSafe).toBe(true)
      expect(c.state).toBe("QUAKE")
      const landed1 = c.fallsLanded
      const hits1 = c.fallHits
      const h2 = c.health
      expect(c.forceFallForTest("cabinet", c.headPose.position)).toBe(true)
      await waitFor(() => c.fallsLanded > landed1, 2000)
      expect(c.fallsLanded).toBe(landed1 + 1)
      expect(c.fallHits).toBe(hits1)
      expect(Math.abs(c.health - h2) <= 0.5).toBe(true)

      // (c) Easy: nothing is scheduled.
      c.disableFallsForTest(false)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      c.setLevelForTest("easy")
      await toFreshBriefing(c)
      expect(c.level).toBe("easy")
      expect(c.fallsScheduled).toBe(0)
      const easyStart = startSpot(c)
      c.headPose.setOverride(easyStart, levelLook(easyStart, c.safeZone.center))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)
      expect(c.fallsScheduled).toBe(0)

      // Normal again: the quake schedules fallCountMin..fallCountMax falls.
      c.setLevelForTest("normal")
      await toFreshBriefing(c)
      expect(c.level).toBe("normal")
      const normalStart = startSpot(c)
      c.headPose.setOverride(normalStart, levelLook(normalStart, c.safeZone.center))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)
      expect(c.fallsScheduled >= c.config.fallCountMin && c.fallsScheduled <= c.config.fallCountMax).toBe(true)
    } finally {
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}
