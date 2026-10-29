import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"
import {getLanguage, getString, lines} from "../Strings"
import {copyLayout, expectState, getController, press, restore, sameLayout} from "./DrillTestKit"

// DC7: picking ja shows the safety screen in Japanese; after a drill, Restart
// gives BRIEFING in ja, and with layoutSeed 0 two Restarts give two layouts.
@component
export class DC7_LanguagesAndRestart extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
      expect(c.config.layoutSeed).toBe(0)
      c.resetForTest(true)
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
      expect(c.state).toBe("BRIEFING")
      const runS = c.config.testWaitSeconds + c.config.testScanSeconds + c.config.testDurationSeconds + 3
      // Head untouched at the start spot: the quake ends outside the zone, straight to RESULT.
      await expectState(c, "RESULT", runS * 1000)
      const first = copyLayout(c.layout)

      await press("RestartButton")
      expect(c.state).toBe("BRIEFING")
      expect(c.language).toBe("ja")
      expect(getLanguage()).toBe("ja")
      const second = copyLayout(c.layout)
      expect(sameLayout(first, second)).toBe(false)
      await expectState(c, "RESULT", runS * 1000)

      await press("RestartButton")
      expect(c.state).toBe("BRIEFING")
      expect(c.language).toBe("ja")
      const third = copyLayout(c.layout)
      expect(sameLayout(second, third)).toBe(false)
      await expectState(c, "RESULT", runS * 1000)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}
