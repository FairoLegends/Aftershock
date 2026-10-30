import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Lang, LANGS, setLineText, STRINGS} from "./Strings"
import {drawOnTop, PinchGuard, SOFT_WHITE, SoftButton, SoftFrame} from "./UiBacking"

// Same type scale as SafetyPanel (size / 43.886 = em-square in cm at 110 cm).
const TITLE_SIZE = 38 // Caption: five title lines stay small
const BUTTON_SIZE = 48 // Headline2
const WEIGHT = 700

// Panel layout (cm). Not drill tunables: they only shape this panel.
const INNER_W = 32
const PAD = 2.5
const TITLE_GAP = 0.3
const TITLE_H = 1.5
const BUTTON_GAP = 0.8 // 5h item 2: packed tighter (was 1.2)
const BUTTON_W = 18
const BUTTON_H = 4 // 5h item 2 (learner): 4 cm tall so all five fit in view at eye level
const BUTTON_LABEL_Z = 0.08 // lifts the label off the button face
const LABEL_W = BUTTON_W - 2 // the label shrinks only if it would not fit
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

/**
 * Language picker (Slice 5L, R16; Slice 7A-soft look): the picker title in all
 * five languages (the one place with more than one language, 5j-13d) and five
 * secondary buttons, each line in its own language and font. Placed once at
 * start by DrillController, before the safety panel. It owns no drill state:
 * DrillController listens to onPick and sets the language.
 */
@component
export class LanguagePanel extends BaseScriptComponent {
  @ui.label("Language picker (Slice 5L)")
  @ui.separator
  @ui.group_start("Look")
  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.25)
  @ui.group_end

  private readonly pickEvent = new Event<Lang>()
  /** Raised with the picked language when a button is pressed (pinch or click). */
  readonly onPick: PublicApi<Lang> = this.pickEvent.publicApi()
  /** 5h item 1: presses are ignored for pinchGuard.seconds after show(). */
  readonly pinchGuard = new PinchGuard()

  private readonly shownTexts: Text[] = []
  private readonly textLangs: Lang[] = []
  private readonly buttons: SoftButton[] = []
  private _highlighted: Lang | null = null

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const frame = new SoftFrame(this.sceneObject, this.backingColor)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = INNER_W + PAD * 2
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = TITLE_GAP
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      frame.setSize(r.containerWidth, r.containerHeight)
    })

    for (const lang of LANGS) {
      this.addTitleLine(content, lang)
    }
    for (let i = 0; i < LANGS.length; i++) {
      this.addLanguageButton(content, LANGS[i], i)
    }
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

  /**
   * Shows the picker. Fonts are applied here, after DrillController registered
   * them. Slice 10B: `current` (reopened after a drill) keeps the green focus
   * look, as the level picker does; null at the first start.
   */
  show(current: Lang | null = null): void {
    for (let i = 0; i < this.shownTexts.length; i++) {
      setLineText(this.shownTexts[i], this.shownTexts[i].text, this.textLangs[i])
    }
    this.sceneObject.enabled = true
    for (let i = 0; i < this.buttons.length; i++) {
      this.buttons[i].reset()
      this.buttons[i].setSelected(LANGS[i] === current)
    }
    this._highlighted = current
    drawOnTop(this.sceneObject)
    this.pinchGuard.arm()
  }

  hide(): void {
    this.sceneObject.enabled = false
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }
  /** Slice 10B: the language show() highlighted, or null. */
  get highlighted(): Lang | null {
    return this._highlighted
  }
  /** Every text line the panel shows, in order (five title lines, then five button labels). */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text)
  }

  private addTitleLine(parent: SceneObject, lang: Lang): void {
    const so = global.scene.createSceneObject("picker.title." + lang)
    so.setParent(parent)
    this.addText(so, STRINGS["picker.title"][lang], TITLE_SIZE, INNER_W, TITLE_H, lang)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = INNER_W
    item.overrideHeight = TITLE_H
    item.alignSelf = FlexAlignSelf.Center
  }

  private addLanguageButton(parent: SceneObject, lang: Lang, index: number): void {
    const so = global.scene.createSceneObject("LangButton." + lang)
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.marginTop = index === 0 ? BUTTON_GAP * 1.5 : BUTTON_GAP - TITLE_GAP

    // Slice 7A-soft: a secondary button (see-through, thin border), no number.
    const button = new SoftButton(this, btn, BUTTON_W, BUTTON_H, false, () => {
      if (this.pinchGuard.open) this.pickEvent.invoke(lang)
    })
    this.buttons.push(button)

    const label = global.scene.createSceneObject("lang.name." + lang)
    label.setParent(button.face)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = this.addText(label, STRINGS["lang.name"][lang], BUTTON_SIZE, LABEL_W, BUTTON_H - 0.5, lang)
    t.horizontalOverflow = HorizontalOverflow.Shrink
  }

  private addText(so: SceneObject, text: string, size: number, width: number, height: number, lang: Lang): Text {
    const t = so.createComponent("Component.Text") as Text
    t.size = size
    ;(t as Text & {weight?: number}).weight = WEIGHT
    t.depthTest = true
    t.textFill.color = SOFT_WHITE
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    setLineText(t, text, lang)
    this.shownTexts.push(t)
    this.textLangs.push(lang)
    return t
  }
}
