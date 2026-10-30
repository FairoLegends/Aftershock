import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC10 (Slice 7B, ENGINEERING_PLAN 5j items 4, 5, 6, 17): BRIEFING opens with
// the scan (n/N over the three classic hazards), then the quake wait. The
// floor path is faint in BRIEFING, bright in the quake until the user is in
// the zone. Standing up after being safe turns on the red edge warning. With
// guides off there is no path and no scan.
@component
export class DC10_ScanPathEdge extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevWait = c.config.testWaitSeconds
    const prevScan = c.config.testScanSeconds
    const prevSeed = c.config.layoutSeed
    try {
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
      c.disableFallsForTest(true) // Slice 7D: no falls in this scenario
      c.config.testMode = true
      c.config.testWaitSeconds = 3 // BRIEFING outlasts the scan check below
      c.config.testScanSeconds = 2 // the scan outlasts the press latency before the first check (0.5 s lost the race once)
      c.config.layoutSeed = 1155577471 // fixed layout: table 136 cm from start, its zone edge 67 cm away (3 chevrons)
      await toFreshBriefing(c)
      const start = startSpot(c)
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))

      expect(c.scanActive).toBe(true)
      expect(c.scanTotal).toBe(3)
      expect(c.pathVisible).toBe(true)
      expect(c.pathBright).toBe(false)

      await sleep((c.config.testScanSeconds + 1) * 1000)
      expect(c.state).toBe("BRIEFING")
      expect(c.scanActive).toBe(false)
      expect(c.scanCount).toBe(c.scanTotal)

      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(200)
      expect(c.pathBright).toBe(true)
      expect(c.edgeWarningActive).toBe(false)

      pinDucked(c)
      await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)
      expect(c.inZone).toBe(true)
      expect(c.pathVisible).toBe(false)

      // Stand up back at the start spot: exposed after cover, so health drains.
      c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
      await waitFor(() => c.edgeWarningActive, 1000)
      expect(c.edgeWarningActive).toBe(true)
      expect(c.pathVisible).toBe(true)

      c.setGuidesVisible(false)
      await sleep(200)
      expect(c.pathVisible).toBe(false)

      // Guides off: a fresh BRIEFING has no scan and no path.
      await toFreshBriefing(c)
      expect(c.scanActive).toBe(false)
      expect(c.pathVisible).toBe(false)
      expect(c.edgeWarningActive).toBe(false)
    } finally {
      c.setGuidesVisible(true)
      c.config.testWaitSeconds = prevWait
      c.config.testScanSeconds = prevScan
      c.config.layoutSeed = prevSeed
      restore(c, prevTestMode, prevDuration)
    }
  }
}
