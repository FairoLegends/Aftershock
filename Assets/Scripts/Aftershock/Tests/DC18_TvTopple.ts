import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LayoutForce} from "../LayoutGenerator"
import {atHeight, expectState, getController, itemWorld, levelLook, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

/** Slice 9A: a drill with the TV. */
const TV_SET: LayoutForce = {tables: 1, hazards: ["cabinet", "shelf", "glass", "tv"]}

// DC18 (Slice 9A, ENGINEERING_PLAN 5l item 2, 5j-19b): on Normal, a head
// standing in the TV's danger zone where its top lands, not safe, is hit when
// the TV topples: fallHitDamage plus the danger drain, and hit.fell. The TV
// topples once per drill (forcing again does nothing) and stands upright again
// at the next BRIEFING after a Restart.
@component
export class DC18_TvTopple extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true) // no shelf items and no scheduled topple: only the forced one
      c.config.testMode = true
      c.config.testDurationSeconds = 15
      c.setLevelForTest("normal")
      await toFreshBriefing(c, TV_SET)
      expect(c.level).toBe("normal")
      expect(c.layout.items.tv !== undefined).toBe(true)
      expect(c.tvToppled).toBe(false)
      expect(c.tvTipDegrees).toBe(0)
      const start = startSpot(c)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)

      // Standing where the TV's top lands (10 cm back toward the TV, clear of the zone's edge under the shake), not safe.
      const land = c.tvLandingPoint
      expect(land !== null).toBe(true)
      const tv = c.layout.items.tv
      const toTv = levelLook(land, itemWorld(c, tv.x, tv.z, 0))
      const head = atHeight(c, land.add(toTv.uniformScale(10)), c.config.eyeHeight)
      expect(c.tvDanger.contains(head)).toBe(true)
      c.headPose.setOverride(head, toTv)
      await sleep(300)
      expect(c.inDanger).toBe(true)
      expect(c.isSafe).toBe(false)
      const hits0 = c.fallHits
      const h0 = c.health
      const d0 = c.secondsInDanger
      expect(c.forceTvToppleForTest()).toBe(true)
      expect(c.tvToppled).toBe(true)
      await waitFor(() => c.fallHits > hits0, 1000)
      expect(c.fallHits).toBe(hits0 + 1)
      const drained = (c.secondsInDanger - d0) * c.config.healthDrainPerSecond
      expect(Math.abs(h0 - c.health - (c.config.fallHitDamage + drained))).toBeLessThan(0.5)
      expect(c.hud.isNoticeShown).toBe(true)
      expect(c.hud.noticeKey).toBe("hit.fell")
      expect(c.tvTipDegrees).toBeGreaterThan(80)

      // Once per drill: forcing again does nothing.
      expect(c.forceTvToppleForTest()).toBe(false)
      await sleep(700)
      expect(c.fallHits).toBe(hits0 + 1)
      expect(c.tvToppled).toBe(true)

      // Restart: a new BRIEFING, the TV upright again.
      await toFreshBriefing(c, TV_SET)
      expect(c.tvToppled).toBe(false)
      expect(c.tvTipDegrees).toBe(0)
    } finally {
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}
