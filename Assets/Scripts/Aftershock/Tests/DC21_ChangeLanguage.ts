import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getLanguage, getString, Lang} from "../Strings"
import {VoiceGuide, VoiceLine} from "../VoiceGuide"
import {
  atHeight,
  expectState,
  getController,
  levelLook,
  pinDucked,
  press,
  restore,
  skipCalibrate,
  startSpot,
  toFreshBriefing,
  waitFor,
  walkOut
} from "./DrillTestKit"

const GAME_OVER_DURATION_S = 40 // as DC4: the quake outlasts the drain to health 0
const STANDING_HEAD_CM = 160 // as DC4: standing in the zone

function textOf(name: string): string {
  return (findSceneObjectByName(name).getComponent("Component.Text") as Text).text
}

/** The first voice line started after `t`, or null. */
function firstSince(vg: VoiceGuide, t: number): VoiceLine | null {
  const said = vg.said.filter((l) => l.time > t)
  return said.length > 0 ? said[0] : null
}

// DC21 (Slice 10B, 5l item 6): after a drill in id, Change language on RESULT
// opens the picker with id highlighted; picking de goes straight to LEVEL
// (never SAFETY) in German, and the next drill's voice and HUD are de. From a
// quick GAME_OVER (as DC4) the button is there too and leads back to id.
@component
export class DC21_ChangeLanguage extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const vg = c.voiceGuide
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevWait = c.config.testWaitSeconds
    // Every state the controller passes through, frame by frame.
    const seen: string[] = []
    const recorder = this.createEvent("UpdateEvent")
    recorder.bind(() => {
      const s = String(c.state)
      if (seen.length === 0 || seen[seen.length - 1] !== s) seen.push(s)
    })
    recorder.enabled = false
    try {
      // (a) A short drill in id, as DC7.
      c.config.testWaitSeconds = 3
      c.resetForTest(true)
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true)
      expect(c.state).toBe("LANGUAGE")
      expect(c.languagePanel.highlighted).toBe(null) // the opening picker marks nothing
      await press("LangButton.id")
      expect(c.state).toBe("SAFETY") // the first run still shows the safety panel
      c.config.testMode = true
      await press("ContinueButton")
      expect(c.state).toBe("LEVEL")
      await press("LevelButton.normal")
      await skipCalibrate(c)
      expect(c.state).toBe("BRIEFING")
      const runS = c.config.testWaitSeconds + c.config.testScanSeconds + c.config.testDurationSeconds + 3
      await expectState(c, "EVACUATE", runS * 1000)
      await walkOut(c)
      c.headPose.clearOverride()
      await expectState(c, "RESULT", 3000)
      expect(c.resultPanel.mode).toBe("result")

      // (b) RESULT: Change language is there, in id.
      expect(findSceneObjectByName("ChangeLangButton").isEnabledInHierarchy).toBe(true)
      expect(textOf("btn.changeLang.id")).toBe(getString("btn.changeLang", "id"))
      expect(textOf("btn.changeLang.id")).toBe("Ganti bahasa")
      expect(findSceneObjectByName("RestartButton").isEnabledInHierarchy).toBe(true)

      await press("ChangeLangButton")
      expect(c.state).toBe("LANGUAGE")
      expect(c.languagePanel.isShown).toBe(true)
      expect(c.languagePanel.highlighted).toBe("id")
      expect(c.resultPanel.isShown).toBe(false)
      expect(vg.isSpeaking).toBe(false) // the voice stopped with the drill

      seen.length = 0
      recorder.enabled = true
      const tPick = getTime()
      await press("LangButton.de")
      recorder.enabled = false
      expect(c.state).toBe("LEVEL")
      expect(seen.indexOf("SAFETY")).toBe(-1)
      expect(c.safetyPanel.isShown).toBe(false)
      expect(c.languagePanel.isShown).toBe(false)
      expect(c.levelPanel.isShown).toBe(true)
      expect(c.language).toBe("de")
      expect(getLanguage()).toBe("de")
      expect(c.level).toBe("normal") // the last level stays preselected
      expect(textOf("level.title")).toBe(getString("level.title", "de"))
      expect(textOf("level.title")).not.toBe(getString("level.title", "id"))

      // (c) The next drill speaks and shows de.
      await press("LevelButton.normal")
      expect(c.state).toBe("CALIBRATE")
      expect(await waitFor(() => firstSince(vg, tPick) !== null, 2000)).toBe(true)
      const first = firstSince(vg, tPick)
      expect(first.key).toBe("calib.title")
      expect(first.lang).toBe("de")
      await skipCalibrate(c)
      expect(c.state).toBe("BRIEFING")
      const tBrief = getTime()
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      // 5m-1: the banner shows only warningShowSeconds, so check it at quake start, before waiting on the voice.
      expect(c.hud.isWarningShown).toBe(true)
      expect(c.hud.warningKey).toBe("warn.quake")
      expect(textOf("Warning.id")).toBe(getString("warn.quake", "de"))
      expect(textOf("Warning.id")).not.toBe(getString("warn.quake", "id"))
      expect(
        await waitFor(() => vg.lastSaid !== null && vg.lastSaid.key === "warn.quake" && vg.lastSaid.time > tBrief, 2000)
      ).toBe(true)
      expect(vg.lastSaid.lang).toBe("de")

      // (d) A quick GAME_OVER (as DC4), still in de.
      c.config.testDurationSeconds = GAME_OVER_DURATION_S
      await toFreshBriefing(c) // from QUAKE: reset, LangButton.de, SAFETY, LEVEL, Skip
      expect(c.language).toBe("de")
      pinDucked(c)
      await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
      await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)
      expect(c.hasBeenSafe).toBe(true)
      const center = c.safeZone.center
      c.headPose.setOverride(atHeight(c, center, STANDING_HEAD_CM), levelLook(startSpot(c), center))
      const drainS = c.config.healthStart / c.config.healthDrainPerSecond
      await expectState(c, "GAME_OVER", (drainS + 3) * 1000)
      expect(c.resultPanel.mode).toBe("gameOver")
      c.headPose.clearOverride()
      await sleep(100)

      expect(findSceneObjectByName("ChangeLangButton").isEnabledInHierarchy).toBe(true)
      expect(textOf("btn.changeLang.id")).toBe(getString("btn.changeLang", "de"))
      await press("ChangeLangButton")
      expect(c.state).toBe("LANGUAGE")
      expect(c.languagePanel.highlighted).toBe("de" as Lang)
      expect(c.resultPanel.isShown).toBe(false)

      seen.length = 0
      recorder.enabled = true
      await press("LangButton.id")
      recorder.enabled = false
      expect(c.state).toBe("LEVEL")
      expect(seen.indexOf("SAFETY")).toBe(-1)
      expect(c.safetyPanel.isShown).toBe(false)
      expect(c.language).toBe("id")
      expect(textOf("level.title")).toBe(getString("level.title", "id"))
    } finally {
      recorder.enabled = false
      c.headPose.clearOverride()
      if (c.language !== "id") {
        c.resetForTest(true) // stops the voice; back to id for the other scenarios
        await press("LangButton.id")
      }
      c.setLevelForTest("normal")
      c.config.testWaitSeconds = prevWait
      restore(c, prevTestMode, prevDuration)
    }
  }
}
