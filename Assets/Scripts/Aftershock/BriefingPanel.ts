import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {splitBilingual, STRINGS} from "./Strings"

// DESIGN_BRIEF §5: instruction type is 3.5 cm at 110 cm. size / 43.886 = em-square in cm.
const SIZE_PER_CM = 43.886
const INSTRUCTION_EM_CM = 3.5
const ENGLISH_SCALE = 0.8

// Panel layout (cm). Not drill tunables: they only shape this panel.
const INNER_W = 46
const PAD = 2.5
const ROW_GAP = 1.0
const LINE_ID_H = 8.4 // two wrapped lines
const LINE_EN_H = 6.8
const CONTENT_Z = 0.6 // keeps content off the back plate (z-fighting)

const WHITE = new vec4(1, 1, 1, 1)

/**
 * The briefing instruction (R5, `instr.brief`). Placed once in front of the
 * head when BRIEFING starts; it never follows the head (not a HUD).
 */
@component
export class BriefingPanel extends BaseScriptComponent {
  @ui.label("Briefing instruction panel (R5)")
  @ui.separator
  private readonly shownTexts: Text[] = []

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    backPlate.style = "default"

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = INNER_W + PAD * 2
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = ROW_GAP
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const parts = splitBilingual(STRINGS["instr.brief"])
    this.addLine(content, "instr.brief.id", parts.id, LINE_ID_H, 1)
    this.addLine(content, "instr.brief.en", parts.en, LINE_EN_H, ENGLISH_SCALE)
  }

  /**
   * Places the panel `distance` cm in front of the head along its level look
   * direction and `below` cm under eye level, facing the head.
   */
  placeInFront(headPosition: vec3, headForward: vec3, distance: number, below: number): void {
    let flat = new vec3(headForward.x, 0, headForward.z)
    flat = flat.length > 0.0001 ? flat.normalize() : new vec3(0, 0, -1)
    const position = headPosition.add(flat.uniformScale(distance)).add(new vec3(0, -below, 0))
    const t = this.sceneObject.getTransform()
    t.setWorldPosition(position)
    t.setWorldRotation(quat.lookAt(flat.uniformScale(-1), vec3.up()))
  }

  show(): void {
    this.sceneObject.enabled = true
  }

  hide(): void {
    this.sceneObject.enabled = false
  }

  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }

  /** Read-only: every text line the panel shows, in order. */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text)
  }

  private addLine(parent: SceneObject, name: string, text: string, height: number, scale: number): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.size = INSTRUCTION_EM_CM * SIZE_PER_CM * scale
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = WHITE
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -height / 2, height / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    this.shownTexts.push(t)
  }
}
