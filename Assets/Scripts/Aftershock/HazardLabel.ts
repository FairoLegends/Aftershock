import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {splitBilingual, STRINGS, StringKey} from "./Strings"
import {createLightBacking} from "./UiBacking"

// DESIGN_BRIEF §5–6: labels use 2.5 cm type. size / 43.886 = em-square in cm.
const SIZE_PER_CM = 43.886
const LABEL_EM_CM = 2.5
const ENGLISH_SCALE = 0.8

// Label layout (cm). Not drill tunables: they only shape the label.
const INNER_W = 34
const PAD = 1.5
const ROW_GAP = 0.6
const LINE_ID_H = 3.0
const LINE_EN_H = 2.4
const CONTENT_Z = 0.6 // keeps content off the back plate (z-fighting)

/**
 * A world-space bilingual label on a hazard or on the safe zone (R3, R4).
 * Its scene rotation makes it face the room center; DrillController shows it
 * in BRIEFING and hides it in SAFETY.
 */
@component
export class HazardLabel extends BaseScriptComponent {
  @ui.label("World label on a hazard or the safe zone (R3, R4)")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Strings.ts key this label shows")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Cabinet", "label.cabinet"),
      new ComboBoxItem("Shelf", "label.shelf"),
      new ComboBoxItem("Glass", "label.glass"),
      new ComboBoxItem("Safe zone", "label.safe")
    ])
  )
  key: string = "label.cabinet"

  @input
  @hint("Text color: dark orange #D9480F for hazards (learner, 27 Oct), green #3DDC84 for the safe zone")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(0.851, 0.282, 0.059, 1)

  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.25)
  @ui.group_end

  private readonly shownTexts: Text[] = []

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const backing = createLightBacking(this.sceneObject, this.backingColor)

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
      backing.size = new vec2(r.containerWidth, r.containerHeight)
    })

    const key = this.key as StringKey
    const parts = splitBilingual(STRINGS[key])
    this.addLine(content, key + ".id", parts.id, LINE_ID_H, 1)
    this.addLine(content, key + ".en", parts.en, LINE_EN_H, ENGLISH_SCALE)
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

  /** Read-only: the label's text lines, Indonesian first. */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text)
  }

  private addLine(parent: SceneObject, name: string, text: string, height: number, scale: number): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.size = LABEL_EM_CM * SIZE_PER_CM * scale
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = this.textColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -height / 2, height / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    this.shownTexts.push(t)
  }
}
