import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {DrillController} from "../DrillController"
import {splitBilingual, STRINGS, StringKey} from "../Strings"

// DC1 first half (Slice 1): the Lens opens in SAFETY with both reminder lines
// visible, and pinching Continue moves the drill to BRIEFING.
// The room half of DC1 is added in Slice 2.
@component
export class DC1_SafetyThenRoom extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)

    const controller = findSceneObjectByName("DrillController").getComponent(
      DrillController.getTypeName()
    ) as DrillController
    expect(controller.state).toBe("SAFETY")

    const panel = findSceneObjectByName("SafetyPanel")
    expect(panel.isEnabledInHierarchy).toBe(true)
    this.expectBilingualVisible("safety.drill")
    this.expectBilingualVisible("safety.room")

    const interactor = new DefaultLeafInteractor()
    await interactor.trigger(findInteractableByName("ContinueButton"))
    await sleep(500)

    expect(controller.state).toBe("BRIEFING")
    expect(controller.instructionKey).toBe("instr.brief")
    expect(panel.isEnabledInHierarchy).toBe(false)
  }

  private expectBilingualVisible(key: StringKey): void {
    const parts = splitBilingual(STRINGS[key])
    const id = findSceneObjectByName(key + ".id")
    const en = findSceneObjectByName(key + ".en")
    expect((id.getComponent("Component.Text") as Text).text).toBe(parts.id)
    expect((en.getComponent("Component.Text") as Text).text).toBe(parts.en)
    expect(id.isEnabledInHierarchy).toBe(true)
    expect(en.isEnabledInHierarchy).toBe(true)
  }
}
