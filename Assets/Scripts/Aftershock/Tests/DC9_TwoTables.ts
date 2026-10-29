import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {computeScore} from "../ScoreCalculator"
import {DUCKED_HEAD_CM, atHeight, expectState, getController, levelLook, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC9 (5j-15a/c): with two tables, the arrow targets the nearer one, cover
// under the farther one counts too, and the speed score forgives the walk.
@component
export class DC9_TwoTables extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
      c.disableFallsForTest(true) // Slice 7D: no falls in this scenario
      c.config.testMode = true
      c.config.testDurationSeconds = 12
      await toFreshBriefing(c, {tables: 2, hazards: ["cabinet", "shelf", "glass"]})
      const zones = c.activeSafeZones
      expect(zones.length).toBe(2)
      const start = startSpot(c)
      const d0 = zones[0].distanceTo(start)
      const d1 = zones[1].distanceTo(start)
      const near = d0 <= d1 ? zones[0] : zones[1]
      const far = d0 <= d1 ? zones[1] : zones[0]
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)
      expect(c.targetSafeZone === near).toBe(true)
      expect(Math.abs(c.nearestTableDistance - Math.min(d0, d1))).toBeLessThan(15)
      expect(Math.abs(c.walkAllowance - c.nearestTableDistance / c.config.walkSpeed)).toBeLessThan(0.01)
      // Take cover under the FARTHER table.
      c.headPose.setOverride(atHeight(c, far.center, DUCKED_HEAD_CM), levelLook(start, far.center))
      const safe = await waitFor(() => c.hasBeenSafe, 4000)
      expect(safe).toBe(true)
      expect(c.inZone).toBe(true)
      expect(c.targetSafeZone === far).toBe(true)
      // Like DC5: after the shaking the drill waits in POST_QUAKE until the user comes out.
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 4) * 1000)
      await sleep(500)
      expect(c.state).toBe("POST_QUAKE")
      c.headPose.setOverride(start, levelLook(start, far.center))
      await expectState(c, "RESULT", 3000)
      const s = c.lastScore
      expect(s !== null).toBe(true)
      expect(Math.abs(s.walkAllowance - c.walkAllowance)).toBeLessThan(0.001)
      expect(Math.abs(s.speedTime - Math.max(0, s.tSafe - s.walkAllowance))).toBeLessThan(0.001)
      const expected = computeScore(s.tSafe, s.healthLeft, s.secondsStanding, s.walkAllowance)
      expect(s.score).toBe(expected.score)
      const without = computeScore(s.tSafe, s.healthLeft, s.secondsStanding, 0)
      expect(s.score).toBeGreaterThan(without.score - 1)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
