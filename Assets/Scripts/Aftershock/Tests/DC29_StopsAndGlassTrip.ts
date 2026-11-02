import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DrillController} from "../DrillController"
import {atHeight, CLASSIC, expectState, getController, itemWorld, levelLook, pinDucked, press, restore, startSpot, toFreshBriefing, waitFor} from "./DrillTestKit"

// DC29 (Slice 16, ENGINEERING_PLAN 5m item 16, audit L6–L8):
// L6: after a held duck in CALIBRATE, calib.done is not still playing when BRIEFING begins.
// L7: GAME_OVER and Restart stop the one-shot effect sounds (chime, crack, glass break, thud).
// L8: in EVACUATE, a trip over the glass shards that empties health is GAME_OVER with hit.glass.
@component
export class DC29_StopsAndGlassTrip extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.config.testMode = true

      // L6: LANGUAGE → SAFETY → LEVEL → Normal opens CALIBRATE; stand, then duck and hold.
      c.resetForTest(true)
      c.setLevelForTest("normal")
      c.forceLayoutForTest(CLASSIC)
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true)
      await press("LangButton.id")
      await press("ContinueButton")
      await press("LevelButton.normal")
      expect(c.state).toBe("CALIBRATE")
      const vg = c.voiceGuide
      c.headPose.setOverride(startSpot(c), c.headPose.forward)
      await sleep(300)
      c.headPose.setOverride(atHeight(c, startSpot(c), 50), c.headPose.forward)
      expect(await waitFor(() => c.calibratePanel.isDone, (c.config.calibHoldSeconds + 1) * 1000)).toBe(true)
      await expectState(c, "BRIEFING", (c.config.calibDoneSeconds + 1) * 1000)
      const last = vg.lastSaid
      console.log(`[Aftershock] DC29 L6: at BRIEFING last said ${last ? last.key : "none"}, speaking ${vg.isSpeaking} (calibDoneSeconds ${c.config.calibDoneSeconds})`)
      expect(vg.said.some((l) => l.key === "calib.done")).toBe(true)
      expect(vg.isSpeaking && last !== null && last.key === "calib.done").toBe(false)

      // L7: the effect sounds playing in a QUAKE stop at GAME_OVER; played again in GAME_OVER, they stop at Restart.
      c.headPose.setOverride(startSpot(c), c.headPose.forward) // standing, so toFreshBriefing's Skip is not taken for a duck
      await toFreshBriefing(c, CLASSIC)
      const inGlass = glassZonePoint(c)
      c.headPose.setOverride(inGlass, levelLook(startSpot(c), inGlass))
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await sleep(300)
      expect(c.inDanger).toBe(true)
      playEffects(c)
      const playing = c.effectSoundsPlaying
      expect(playing).toBeGreaterThan(0)
      c.setHealthForTest(0.01) // the next drain frame empties it
      await expectState(c, "GAME_OVER", 2000)
      console.log(`[Aftershock] DC29 L7: ${playing} effect sounds before GAME_OVER, ${c.effectSoundsPlaying} after`)
      expect(c.effectSoundsPlaying).toBe(0)
      playEffects(c)
      expect(c.effectSoundsPlaying).toBeGreaterThan(0)
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      expect(c.effectSoundsPlaying).toBe(0)

      // L8: shards on the floor after the aftershock, then in EVACUATE a trip over them with health = tripDamage.
      c.forceAftershockForTest(true)
      await toFreshBriefing(c, CLASSIC)
      c.gripHandles.setHoldingForTest(true) // under the table nothing drains
      c.forceAftershockForTest(true)
      c.disableFallsForTest(true) // only the shards to trip over
      expect(c.layout.items.glass !== undefined).toBe(true)
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      c.headPose.setOverride(startSpot(c), levelLook(startSpot(c), c.safeZone.center)) // leave cover: the quiet wait
      await waitFor(() => c.aftershockWaiting, 2000)
      pinDucked(c)
      await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 1) * 1000)
      await waitFor(() => c.glassBroken, c.config.testAftershockDurationSeconds * 1000)
      expect(c.glassBroken).toBe(true)
      await waitFor(() => c.shakeFx.shardPoints().length === c.shardCount, 2000)
      const shard = c.shakeFx.shardPoints()[0]
      expect(shard !== undefined).toBe(true)
      await expectState(c, "POST_QUAKE", (c.config.testAftershockDurationSeconds + 2) * 1000)
      c.headPose.setOverride(startSpot(c), levelLook(startSpot(c), c.safeZone.center))
      await expectState(c, "EVACUATE", 2000)
      const trips0 = c.tripCount
      c.setHealthForTest(c.config.tripDamage)
      const onShard = itemWorld(c, shard.x, shard.z, c.config.eyeHeight)
      c.headPose.setOverride(onShard, levelLook(startSpot(c), onShard))
      await expectState(c, "GAME_OVER", 2000)
      console.log(`[Aftershock] DC29 L8: trips ${trips0} -> ${c.tripCount}, health ${c.health.toFixed(2)}, reason ${c.gameOverReason}`)
      expect(c.tripCount).toBe(trips0 + 1)
      expect(c.health).toBe(0)
      expect(c.gameOverReason).toBe("hit.glass")
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}

/** Starts each effect sound that has a track. */
function playEffects(c: DrillController): void {
  for (const a of [c.chimeAudio, c.crackAudio, c.glassBreakAudio, c.thudAudio]) {
    if (a && a.audioTrack) a.play(1)
  }
}

/** A standing head point in the glass danger zone (as DC22). */
function glassZonePoint(c: DrillController): vec3 {
  const g = c.layout.items.glass
  const d = c.config.dangerMargin / 2
  return itemWorld(c, g.x - Math.sin(g.yaw) * d, g.z - Math.cos(g.yaw) * d, c.config.eyeHeight)
}
