import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {lines, onLanguageChanged, setLinePair} from "./Strings"
import {BrutalFrame, drawOnTop} from "./UiBacking"

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
const HIDDEN_H = 0.001 // the English line collapses to this when English is selected
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

const WHITE = new vec4(1, 1, 1, 1)

/**
 * The briefing instruction (R5, `instr.brief`). Placed once in front of the
 * head when BRIEFING starts; it never follows the head (not a HUD).
 */
@component
export class BriefingPanel extends BaseScriptComponent {
  @ui.label("Briefing instruction panel (R5)")
  @ui.separator
  @ui.group_start("Look")
  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.25)
  @ui.group_end

  private readonly shownTexts: Text[] = []
  private primary: Text
  private secondary: Text
  private secondaryItem: FlexItem

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const backing = new BrutalFrame(this.sceneObject, this.backingColor)

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
      backing.setSize(r.containerWidth, r.containerHeight)
    })

    this.primary = this.addLine(content, "instr.brief.id", LINE_ID_H, 1).text
    const secondary = this.addLine(content, "instr.brief.en", LINE_EN_H, ENGLISH_SCALE)
    this.secondary = secondary.text
    this.secondaryItem = secondary.item
    this.refresh()
    onLanguageChanged.add(() => this.refresh())
  }

  /** Re-renders instr.brief in the selected language (Slice 5L); English only collapses the second line. */
  private refresh(): void {
    const l = lines("instr.brief")
    setLinePair(this.primary, this.secondary, l)
    this.secondaryItem.overrideHeight = l.secondary.length > 0 ? LINE_EN_H : HIDDEN_H
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
    drawOnTop(this.sceneObject) // 5h item 3; no button here, so no pinch guard
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

  private addLine(parent: SceneObject, name: string, height: number, scale: number): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
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
    item.overrideHeight = height
    this.shownTexts.push(t)
    return {text: t, item}
  }
}
