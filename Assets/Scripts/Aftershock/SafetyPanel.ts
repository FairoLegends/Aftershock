import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {lines, onLanguageChanged, setLinePair, StringKey} from "./Strings"
import {drawOnTop, PinchGuard, SOFT_GREEN_TEXT, SoftButton, SoftFrame} from "./UiBacking"

/** One string's line and its collapsed English line (5j-13d: one language per screen). */
interface LinePair {
  key: StringKey
  primary: Text
  secondary: Text
  secondaryItem: FlexItem
  height: number // secondary line height when shown (cm)
}

// Snap Specs type scale (em-square size at 110 cm). size / 43.886 = em-square in cm.
type TextRole = "Headline2" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline2: {size: 48, weight: 700},
  Caption: {size: 38, weight: 500} // floor at 110 cm
}

function applyTextRole(t: Text, role: TextRole): void {
  t.size = TYPE_SCALE[role].size
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

// DESIGN_BRIEF §5: English sits below Indonesian in the same color at 80% size.
const ENGLISH_SCALE = 0.8

// Panel layout (cm). Not drill tunables: they only shape this panel.
const INNER_W = 40 // Slice 5L: widened from 32 so the longest German line (safety.room, ~34 cm) fits
const PAD = 2.5
const ROW_GAP = 1.6
const LINE_ID_H = 1.8
const LINE_EN_H = 1.5
const HIDDEN_H = 0.001 // the English line collapses to this when English is selected
const BUTTON_W = 14 // DESIGN_BRIEF §5: buttons at least 12 x 5 cm
const BUTTON_H = 5
const BUTTON_LABEL_Z = 0.08 // lifts the label off the button face
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

const WHITE = new vec4(1, 1, 1, 1)

/**
 * Safety reminder (R1) with the Continue button (R2). Placed once at start by
 * DrillController; it never follows the head. Raises onContinue on pinch.
 */
@component
export class SafetyPanel extends BaseScriptComponent {
  @ui.label("Safety reminder panel (R1, R2)")
  @ui.separator
  @ui.group_start("Look")
  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.25)
  @ui.group_end

  private readonly continueEvent = new Event()
  readonly onContinue: PublicApi<void> = this.continueEvent.publicApi()
  /** 5h item 1: presses are ignored for pinchGuard.seconds after show(). */
  readonly pinchGuard = new PinchGuard()

  private readonly shownTexts: Text[] = []
  private readonly pairs: LinePair[] = []
  private continueButton: SoftButton | null = null

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const backing = new SoftFrame(this.sceneObject, this.backingColor)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = INNER_W + PAD * 2
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0 // gaps are margins, so a collapsed English line leaves none
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
    })

    this.addBilingual(content, "safety.drill", false)
    this.addBilingual(content, "safety.room", true)
    this.addContinueButton(content)
    this.refresh()
    onLanguageChanged.add(() => this.refresh())
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
    if (this.continueButton) this.continueButton.reset()
    drawOnTop(this.sceneObject)
    this.pinchGuard.arm()
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

  private addBilingual(parent: SceneObject, key: StringKey, gapAbove: boolean): void {
    const primary = this.addLine(parent, key + ".id", LINE_ID_H, 1)
    if (gapAbove) {
      primary.item.marginTop = ROW_GAP
    }
    const secondary = this.addLine(parent, key + ".en", LINE_EN_H, ENGLISH_SCALE)
    this.pairs.push({key, primary: primary.text, secondary: secondary.text, secondaryItem: secondary.item, height: LINE_EN_H})
  }

  /** Re-renders every line in the selected language only (5j-13d); the English slot collapses. */
  private refresh(): void {
    for (const p of this.pairs) {
      const l = lines(p.key)
      setLinePair(p.primary, p.secondary, l)
      p.secondaryItem.overrideHeight = l.secondary.length > 0 ? p.height : HIDDEN_H
    }
  }

  private addLine(parent: SceneObject, name: string, height: number, scale: number): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, "Headline2", scale)
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -height / 2, height / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = height
    this.shownTexts.push(t)
    return {text: t, item}
  }

  private addContinueButton(parent: SceneObject): void {
    const so = global.scene.createSceneObject("ContinueButton")
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.marginTop = ROW_GAP

    // Slice 7A-soft: the primary (green) button; the label rides on the face so it moves on press.
    this.continueButton = new SoftButton(this, btn, BUTTON_W, BUTTON_H, true, () => {
      if (this.pinchGuard.open) this.continueEvent.invoke()
    })

    const label = global.scene.createSceneObject("ContinueLabel")
    label.setParent(this.continueButton.face)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const labelFlex = label.createComponent(FlexLayout.getTypeName()) as FlexLayout
    labelFlex.width = BUTTON_W - 0.5
    labelFlex.height = BUTTON_H - 0.5
    labelFlex.direction = FlexDirection.Column
    labelFlex.alignItems = FlexAlign.Stretch
    labelFlex.justifyContent = FlexJustify.Center
    labelFlex.rowGap = 0

    const primary = this.addButtonLine(label, "btn.continue.id", LINE_ID_H, 1)
    const secondary = this.addButtonLine(label, "btn.continue.en", LINE_EN_H, ENGLISH_SCALE)
    this.pairs.push({key: "btn.continue", primary: primary.text, secondary: secondary.text, secondaryItem: secondary.item, height: LINE_EN_H})
    primary.text.textFill.color = SOFT_GREEN_TEXT // dark text on solid green
    secondary.text.textFill.color = SOFT_GREEN_TEXT
  }

  private addButtonLine(parent: SceneObject, name: string, height: number, scale: number): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, "Headline2", scale)
    const w = BUTTON_W - 0.5
    t.layoutRect = Rect.create(-w / 2, w / 2, -height / 2, height / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = height
    this.shownTexts.push(t)
    return {text: t, item}
  }

  private styleText(t: Text, role: TextRole, scale: number): void {
    applyTextRole(t, role)
    // English line: 80% of the Indonesian size, never under the Caption floor.
    t.size = Math.max(TYPE_SCALE[role].size * scale, TYPE_SCALE.Caption.size)
    t.depthTest = true
    t.textFill.color = WHITE
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
  }
}
