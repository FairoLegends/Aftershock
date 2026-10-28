import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {DrillController} from "../DrillController"
import {SafeZone} from "../SafeZone"
import {lines, StringKey} from "../Strings"

const FURNITURE = ["Table", "Cabinet", "Shelf", "GlassWindow"]
const HAZARD_LABELS = ["CabinetLabel", "ShelfLabel", "GlassLabel"]
const LABEL_KEYS: StringKey[] = ["label.cabinet", "label.shelf", "label.glass", "label.safe"]

// DC1: the Lens opens in SAFETY with both reminder lines visible and the room
// labels hidden. Pinching Continue moves the drill to BRIEFING, which shows the
// hazard labels, the safe-zone marker and instr.brief over the furniture.
@component
export class DC1_SafetyThenRoom extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)

    const controller = findSceneObjectByName("DrillController").getComponent(
      DrillController.getTypeName()
    ) as DrillController
    const interactor = new DefaultLeafInteractor()

    // Slice 5L: the Lens opens on the language picker; Bahasa Indonesia → SAFETY.
    expect(controller.state).toBe("LANGUAGE")
    await interactor.trigger(findInteractableByName("LangButton.id"))
    await sleep(500)
    expect(controller.state).toBe("SAFETY")

    const panel = findSceneObjectByName("SafetyPanel")
    expect(panel.isEnabledInHierarchy).toBe(true)
    this.expectBilingualVisible("safety.drill")
    this.expectBilingualVisible("safety.room")

    const marker = findSceneObjectByName("SafeZoneMarker")
    expect(marker.isEnabledInHierarchy).toBe(false)
    for (const name of HAZARD_LABELS) {
      expect(findSceneObjectByName(name).isEnabledInHierarchy).toBe(false)
    }

    await interactor.trigger(findInteractableByName("ContinueButton"))
    await sleep(500)

    expect(controller.state).toBe("BRIEFING")
    expect(controller.instructionKey).toBe("instr.brief")
    expect(panel.isEnabledInHierarchy).toBe(false)

    for (const name of FURNITURE) {
      expect(findSceneObjectByName(name).isEnabledInHierarchy).toBe(true)
    }
    for (const name of HAZARD_LABELS) {
      expect(findSceneObjectByName(name).isEnabledInHierarchy).toBe(true)
    }
    expect(marker.isEnabledInHierarchy).toBe(true)
    for (const key of LABEL_KEYS) {
      this.expectBilingualVisible(key)
    }
    this.expectBilingualVisible("instr.brief")

    // Containment only (Slice 2): the table center is inside, the start spot is not.
    const zone = marker.getComponent(SafeZone.getTypeName()) as SafeZone
    expect(zone.contains(zone.center)).toBe(true)
    expect(zone.contains(controller.headPose.position)).toBe(false)
  }

  private expectBilingualVisible(key: StringKey): void {
    const l = lines(key)
    const parts = {id: l.primary, en: l.secondary}
    const id = findSceneObjectByName(key + ".id")
    const en = findSceneObjectByName(key + ".en")
    expect((id.getComponent("Component.Text") as Text).text).toBe(parts.id)
    expect((en.getComponent("Component.Text") as Text).text).toBe(parts.en)
    expect(id.isEnabledInHierarchy).toBe(true)
    expect(en.isEnabledInHierarchy).toBe(true)
  }
}
