import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {StringKey} from "../Strings"
import {VoiceGuide, VoiceLine} from "../VoiceGuide"
import {atHeight, CLASSIC, expectState, getController, levelLook, pinDucked, press, restore, startSpot, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

const SETTLE_MS = 150

/** The last line with `key` said after `t` (s), or null. */
function lineSince(vg: VoiceGuide, key: StringKey, t: number): VoiceLine | null {
  const lines = vg.said.filter((l) => l.key === key && l.time > t)
  return lines.length > 0 ? lines[lines.length - 1] : null
}

/** The keys said after `t` (s), oldest first. */
function keysSince(vg: VoiceGuide, t: number): StringKey[] {
  return vg.said.filter((l) => l.time > t).map((l) => l.key)
}

function lastKey(vg: VoiceGuide): StringKey | null {
  return vg.lastSaid ? vg.lastSaid.key : null
}

// DC20 (5l item 5, Slice 10): F6 voice. (a) A Normal drill in id says
// warn.quake within 2 s of the quake, then each instruction the screen shows
// (goUnder, duck, hold, comeOut). (e) While a clip plays the rumble is at 60%
// of its unducked volume, and back after. (d) RESULT: silent, no new line.
// (b) The same key twice within 1 s plays once. (c) In ja the quake start
// says warn.quake in ja (and the practice calib.title in ja).
@component
export class DC20_VoiceGuide extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const vg = c.voiceGuide
    expect(vg !== null && vg !== undefined).toBe(true)
    expect(vg.clipCount).toBe(60)
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      // (a) Normal, id, CLASSIC, no falls, no aftershock.
      c.setLevelForTest("normal")
      c.resetForTest(true) // LANGUAGE; clears the hooks
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true)
      await press("LangButton.id")
      expect(c.language).toBe("id")
      c.config.testMode = true
      c.config.testDurationSeconds = 12 // room for five lines before the quake ends
      await toFreshBriefing(c, CLASSIC)
      c.gripHandles.setHoldingForTest(true) // hooks after toFreshBriefing (5j-19f): instr.hold, not instr.grip
      const start = startSpot(c)
      const center = c.safeZone.center
      const look = levelLook(start, center)
      c.headPose.setOverride(start, look)
      const tBrief = getTime()
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      expect(await waitFor(() => lastKey(vg) === "warn.quake" && vg.lastSaid.time > tBrief, 2000)).toBe(true)
      expect(vg.lastSaid.lang).toBe("id")

      // (e) Ducking while warn.quake plays.
      expect(await waitFor(() => vg.isSpeaking && c.rumbleUnducked > 0.01, 2000)).toBe(true)
      await sleep(SETTLE_MS)
      expect(vg.isSpeaking).toBe(true)
      const ducked = c.rumbleAudio.volume / c.rumbleUnducked
      expect(ducked).toBeGreaterThan(0.55)
      expect(ducked).toBeLessThan(0.65)

      // goUnder after the warning, as the screen shows it.
      expect(await waitFor(() => lastKey(vg) === "instr.goUnder", 4000)).toBe(true)
      expect(c.instructionKey).toBe("instr.goUnder")
      expect(c.hud.instructionKey).toBe("instr.goUnder")
      expect(await waitFor(() => !vg.isSpeaking, 3000)).toBe(true)
      await sleep(SETTLE_MS)
      const restored = c.rumbleAudio.volume / c.rumbleUnducked
      expect(restored).toBeGreaterThan(0.95)
      expect(restored).toBeLessThan(1.05)

      // In the zone, standing: instr.duck.
      c.headPose.setOverride(atHeight(c, center, c.config.eyeHeight), look)
      expect(await waitFor(() => lastKey(vg) === "instr.duck", 2000)).toBe(true)
      expect(c.instructionKey).toBe("instr.duck")
      expect(c.hud.instructionKey).toBe("instr.duck")

      // Ducked, holding: instr.hold.
      pinDucked(c)
      expect(await waitFor(() => lastKey(vg) === "instr.hold", 2000)).toBe(true)
      expect(c.instructionKey).toBe("instr.hold")
      expect(c.hud.instructionKey).toBe("instr.hold")

      // After the quake: instr.comeOut.
      await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
      expect(await waitFor(() => lastKey(vg) === "instr.comeOut", 1000)).toBe(true)
      expect(c.instructionKey).toBe("instr.comeOut")
      expect(c.hud.instructionKey).toBe("instr.comeOut")

      c.headPose.setOverride(start, look)
      await walkOut(c)
      expect(keysSince(vg, tBrief).join(",")).toBe("warn.quake,instr.goUnder,instr.duck,instr.hold,instr.comeOut,instr.evac")
      for (const l of vg.said.filter((s) => s.time > tBrief)) {
        expect(l.lang).toBe("id")
      }

      // (d) RESULT: silent, and nothing new is said there.
      expect(vg.isSpeaking).toBe(false)
      const atResult = vg.playCount
      await sleep(1500)
      expect(c.state).toBe("RESULT")
      expect(vg.playCount).toBe(atResult)
      expect(vg.isSpeaking).toBe(false)

      // (b) The repeat rule: the same key twice within 1 s plays once.
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      vg.stopAll() // forgets the repeat times
      const n0 = vg.playCount
      vg.say("warn.trip", "id")
      expect(vg.playCount).toBe(n0 + 1)
      await sleep(500)
      vg.say("warn.trip", "id")
      await sleep(200)
      expect(vg.playCount).toBe(n0 + 1)
      expect(lastKey(vg)).toBe("warn.trip")
      vg.stopAll()
      expect(vg.isSpeaking).toBe(false)

      // (c) The same drill start in ja.
      c.headPose.clearOverride()
      c.resetForTest(true)
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true)
      await press("LangButton.ja")
      expect(c.language).toBe("ja")
      const tLang = getTime()
      await toFreshBriefing(c, CLASSIC) // SAFETY, LEVEL, CALIBRATE (calib.title), Skip
      const title = lineSince(vg, "calib.title", tLang)
      expect(title !== null).toBe(true)
      expect(title.lang).toBe("ja")
      c.gripHandles.setHoldingForTest(true)
      const startJa = startSpot(c)
      c.headPose.setOverride(startJa, levelLook(startJa, c.safeZone.center))
      const tBriefJa = getTime()
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      expect(await waitFor(() => lastKey(vg) === "warn.quake" && vg.lastSaid.time > tBriefJa, 2000)).toBe(true)
      expect(vg.lastSaid.lang).toBe("ja")
    } finally {
      c.headPose.clearOverride()
      if (c.language !== "id") {
        c.resetForTest(true) // stops the voice; back to id for the other scenarios
        await press("LangButton.id")
      }
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}
