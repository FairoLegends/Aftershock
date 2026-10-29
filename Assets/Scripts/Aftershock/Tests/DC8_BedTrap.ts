import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DUCKED_HEAD_CM, expectState, getController, itemWorld, levelLook, restore, startSpot, toFreshBriefing} from "./DrillTestKit"

// DC8 (5j-14b bed trap): ducked on the bed during the quake shows warn.bed,
// never counts as cover, and the usual drain rules stay (no cover yet: no drain).
@component
export class DC8_BedTrap extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
      c.config.testMode = true
      c.config.testDurationSeconds = 30
      await toFreshBriefing(c)
      const bed = c.layout.items.bed
      expect(!!bed).toBe(true)
      const onBed = itemWorld(c, bed.x, bed.z, DUCKED_HEAD_CM)
      for (const z of c.activeSafeZones) {
        expect(z.contains(onBed)).toBe(false)
      }
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      const before = c.bedWarnCount
      const healthBefore = c.health
      c.headPose.setOverride(onBed, levelLook(startSpot(c), onBed))
      await sleep(1800)
      expect(c.ducked).toBe(true)
      expect(c.nearBed).toBe(true)
      expect(c.bedWarnCount).toBe(before + 1)
      expect(c.hud.isNoticeShown).toBe(true)
      expect(c.inZone).toBe(false)
      expect(c.isSafe).toBe(false)
      expect(c.hasBeenSafe).toBe(false)
      expect(c.tSafe).toBe(null)
      // Not covered yet and not in a danger zone: health does not drain (Q5 rule unchanged).
      if (!c.inDanger) {
        expect(c.health).toBe(healthBefore)
      }
      // Staying there does not count again (once per entry).
      await sleep(1000)
      expect(c.bedWarnCount).toBe(before + 1)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
