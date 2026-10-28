import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {lines, onLanguageChanged, setLinePair, StringKey} from "./Strings"
import {createLightBacking} from "./UiBacking"

// DESIGN_BRIEF §5–6: labels use 2.5 cm type. size / 43.886 = em-square in cm.
const SIZE_PER_CM = 43.886
const LABEL_EM_CM = 2.5
const ENGLISH_SCALE = 0.8
const CHAR_EM = 0.55 // rough Latin glyph width (em) to tell when a line needs to wrap

// Label layout (cm). Not drill tunables: they only shape the label.
const INNER_W = 34
const PAD = 1.5
const ROW_GAP = 0.6
const LINE_ID_H = 3.0
const LINE_ID_WRAP_H = 6.0 // Slice 5L: long German lines wrap to two lines instead of clipping
const LINE_EN_H = 2.4
const HIDDEN_H = 0.001 // the English line collapses to this when English is selected
const BELOW_GAP = 1.0 // gap between the label's backing and an attached line below it (danger label)
const CONTENT_Z = 0.6 // keeps content off the back plate (z-fighting)

/**
 * A world-space label on a hazard or on the safe zone (R3, R4): the selected
 * language on top, English below at 80% (Slice 5L). Its scene rotation makes
 * it face the start spot; DrillController shows it in BRIEFING and hides it
 * in SAFETY. attachBelow() hangs another label (the danger label) under it.
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
  private primary: Text
  private primaryItem: FlexItem
  private secondary: Text
  private secondaryItem: FlexItem
  private height = PAD * 2 + LINE_ID_H + ROW_GAP + LINE_EN_H // cm, backing height (until the first layout)
  private below: SceneObject | null = null
  private belowHalfH = 0 // cm

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
      this.height = r.containerHeight
      this.placeBelow()
    })

    const key = this.key as StringKey
    const primary = this.addLine(content, key + ".id", LINE_ID_H, 1)
    const secondary = this.addLine(content, key + ".en", LINE_EN_H, ENGLISH_SCALE)
    this.primary = primary.text
    this.primaryItem = primary.item
    this.secondary = secondary.text
    this.secondaryItem = secondary.item
    this.primary.horizontalOverflow = HorizontalOverflow.Wrap
    this.refresh()
    onLanguageChanged.add(() => this.refresh())
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

  /** Read-only: the label's text lines, selected language first. */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text)
  }

  /**
   * Parents `so` to this label, centered just below its backing with the same
   * facing (ENGINEERING_PLAN 5g). `halfHeight` is half of `so`'s height (cm).
   * It follows the backing when the label's height changes.
   */
  attachBelow(so: SceneObject, halfHeight: number): void {
    so.setParent(this.sceneObject)
    so.getTransform().setLocalRotation(quat.quatIdentity())
    this.below = so
    this.belowHalfH = halfHeight
    this.placeBelow()
  }

  private placeBelow(): void {
    if (this.below) {
      const y = -(this.height / 2 + BELOW_GAP + this.belowHalfH)
      this.below.getTransform().setLocalPosition(new vec3(0, y, CONTENT_Z))
    }
  }

  /** Re-renders the key in the selected language; a long primary line wraps to two lines. */
  private refresh(): void {
    const l = lines(this.key as StringKey)
    setLinePair(this.primary, this.secondary, l)
    const wraps = l.primary.length * LABEL_EM_CM * CHAR_EM > INNER_W
    const h = wraps ? LINE_ID_WRAP_H : LINE_ID_H
    this.primary.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -h / 2, h / 2)
    this.primaryItem.overrideHeight = h
    this.secondaryItem.overrideHeight = l.secondary.length > 0 ? LINE_EN_H : HIDDEN_H
  }

  private addLine(parent: SceneObject, name: string, height: number, scale: number): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
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
    item.overrideHeight = height
    this.shownTexts.push(t)
    return {text: t, item}
  }
}
