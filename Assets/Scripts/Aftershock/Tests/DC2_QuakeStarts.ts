import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {lines} from "../Strings"
import {expectState, getController, restore, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

const SHAKE_SAMPLES = 15

// DC2: with testMode, BRIEFING turns into QUAKE after testWaitSeconds. The Room
// moves off its rest pose, the rumble plays, the warn.quake banner shows, the
// safe-zone marker blinks, and the HUD shows full health and the timer.
@component
export class DC2_QuakeStarts extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
      c.disableFallsForTest(true) // Slice 7D: no falls in this scenario
      c.config.testMode = true
      await toFreshBriefing(c)
      const rest = c.room.getTransform().getWorldPosition()
      expect(c.quakeShaker.isShaking).toBe(false)
      expect(c.rumbleAudio.isPlaying()).toBe(false)

      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      expect(c.quakeDuration).toBe(c.config.testDurationSeconds)
      expect(c.health).toBe(c.config.healthStart)
      expect(c.rumbleAudio.isPlaying()).toBe(true)
      expect(c.safeZone.isBlinking).toBe(true)

      const warn = lines("warn.quake")
      expect(c.hud.isWarningShown).toBe(true)
      expect((findSceneObjectByName("Warning.id").getComponent("Component.Text") as Text).text).toBe(warn.primary)
      expect((findSceneObjectByName("Warning.en").getComponent("Component.Text") as Text).text).toBe(warn.secondary)
      expect(c.hud.timerText).toBe("00:00") // 5m-1: read at quake start, before the banner's warningShowSeconds pass

      expect(c.hud.isShown).toBe(true)
      // 5m-1: the panel (timer included) shows only after the banner.
      expect(await waitFor(() => c.hud.isPanelShown, (c.config.warningShowSeconds + 1) * 1000)).toBe(true)
      const timer = findSceneObjectByName("TimerText")
      expect(timer.isEnabledInHierarchy).toBe(true)

      // The shake envelope ramps up, so sample a while and keep the largest offset.
      let moved = 0
      for (let i = 0; i < SHAKE_SAMPLES; i++) {
        await sleep(100)
        moved = Math.max(moved, c.room.getTransform().getWorldPosition().distance(rest))
      }
      expect(c.quakeShaker.isShaking).toBe(true)
      expect(moved).toBeGreaterThan(0.1)
      expect(c.hud.timerText).not.toBe("00:00")
      expect(c.health).toBe(c.config.healthStart) // standing at the start spot, never safe: no drain

      // Unattended, the quake ends with the head outside the zone: straight to EVACUATE (Slice 8B), then the door.
      await expectState(c, "EVACUATE", (c.config.testDurationSeconds + 2) * 1000)
      expect(c.quakeShaker.isShaking).toBe(false)
      expect(c.rumbleAudio.isPlaying()).toBe(false)
      await walkOut(c)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
