import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {DrillController} from "../DrillController"
import {SafeZone} from "../SafeZone"
import {lines, StringKey} from "../Strings"
import {CLASSIC, waitFor} from "./DrillTestKit"

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
    // Slice 7R-2: the room is procedural (1–2 tables, 3–5 hazards); DC1 checks its
    // rules on the classic item set, so the four named items must all be present.
    controller.forceLayoutForTest(CLASSIC)
    controller.forceAftershockForTest(false) // Slice 7C: no aftershock in this scenario
    controller.disableFallsForTest(true) // Slice 7D: no falls in this scenario

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

    // Slice 7C: Continue opens the level picker; Normal → BRIEFING (after its 0.5 s pinch guard).
    expect(controller.state).toBe("LEVEL")
    await sleep(800)
    await interactor.trigger(findInteractableByName("LevelButton.normal"))
    await sleep(500)

    expect(controller.state).toBe("BRIEFING")
    expect(controller.instructionKey).toBe("instr.brief")
    expect(panel.isEnabledInHierarchy).toBe(false)

    // Slice 7B (5j-4): labels and the marker appear as the scan sweep reaches them.
    await waitFor(() => !controller.scanActive, (controller.config.scanSeconds + 1) * 1000)

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
    controller.forceLayoutForTest(null)
    controller.forceAftershockForTest(null)
    controller.disableFallsForTest(false) // audit: put random falls back like restore() does
  }

  /**
   * Slice 7A-soft (5j item 13d, learner spec change): one language per screen.
   * The line in the selected language is visible; the English line must not be
   * shown at all, so its object is missing, disabled, or holds empty text.
   */
  private expectBilingualVisible(key: StringKey): void {
    const l = lines(key)
    const id = findSceneObjectByName(key + ".id")
    expect((id.getComponent("Component.Text") as Text).text).toBe(l.primary)
    expect(id.isEnabledInHierarchy).toBe(true)
    const en = findSceneObjectByName(key + ".en")
    const enText = en ? (en.getComponent("Component.Text") as Text) : null
    const hidden = !en || !en.isEnabledInHierarchy || !enText || !enText.enabled || enText.text.length === 0
    expect(hidden).toBe(true)
  }
}
