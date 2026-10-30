import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {getLanguage, getString, lines} from "../Strings"
import {copyLayout, expectState, getController, press, restore, sameLayout, skipCalibrate, walkOut} from "./DrillTestKit"

// DC7: picking ja shows the safety screen in Japanese; after a drill, Restart
// opens the level picker in ja (5j-19a), and with layoutSeed 0 two Restarts
// give two layouts.
@component
export class DC7_LanguagesAndRestart extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevWait = c.config.testWaitSeconds
    try {
      // Audit (29 Oct): BRIEFING lasts testScan + testWait; with 9 models built on
      // Restart a 1 s wait could pass before the BRIEFING check ran. 3 s removes the race.
      c.config.testWaitSeconds = 3
      expect(c.config.layoutSeed).toBe(0)
      c.resetForTest(true)
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario (after the reset, which clears test hooks, 5j-19f)
      c.disableFallsForTest(true) // Slice 7D: no falls in this scenario
      expect(c.state).toBe("LANGUAGE")

      await press("LangButton.ja")
      expect(c.state).toBe("SAFETY")
      expect(getLanguage()).toBe("ja")
      expect(c.language).toBe("ja")
      const drill = (findSceneObjectByName("safety.drill.id").getComponent("Component.Text") as Text).text
      expect(drill).toBe(lines("safety.drill").primary)
      expect(drill).not.toBe(getString("safety.drill", "id"))

      c.config.testMode = true
      await press("ContinueButton")
      expect(c.state).toBe("LEVEL") // Slice 7C: the level picker
      await press("LevelButton.normal")
      await skipCalibrate(c) // Slice 8D: duck practice
      expect(c.state).toBe("BRIEFING")
      const runS = c.config.testWaitSeconds + c.config.testScanSeconds + c.config.testDurationSeconds + 3
      // Head untouched at the start spot: the quake ends outside the zone, straight to EVACUATE (Slice 8B).
      await expectState(c, "EVACUATE", runS * 1000) // Slice 8B: EVACUATE, then the door
      await walkOut(c)
      c.headPose.clearOverride() // the next run starts at the start spot again
      const first = copyLayout(c.layout)

      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      await press("LevelButton.normal")
      await skipCalibrate(c) // Slice 8D: duck practice
      expect(c.state).toBe("BRIEFING")
      expect(c.language).toBe("ja")
      expect(getLanguage()).toBe("ja")
      const second = copyLayout(c.layout)
      expect(sameLayout(first, second)).toBe(false)
      await expectState(c, "EVACUATE", runS * 1000) // Slice 8B: EVACUATE, then the door
      await walkOut(c)
      c.headPose.clearOverride() // the next run starts at the start spot again

      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      await press("LevelButton.normal")
      await skipCalibrate(c) // Slice 8D: duck practice
      expect(c.state).toBe("BRIEFING")
      expect(c.language).toBe("ja")
      const third = copyLayout(c.layout)
      expect(sameLayout(second, third)).toBe(false)
      await expectState(c, "EVACUATE", runS * 1000) // Slice 8B: EVACUATE, then the door
      await walkOut(c)
      c.headPose.clearOverride() // the next run starts at the start spot again
    } finally {
      c.config.testWaitSeconds = prevWait
      restore(c, prevTestMode, prevDuration)
    }
  }
}
