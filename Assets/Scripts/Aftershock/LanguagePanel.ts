import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Lang, LANGS, latinFont, primaryLine, setLineText, STRINGS} from "./Strings"
import {BrutalFrame, BRUTAL_WHITE, drawOnTop, makeBrutalButton, Marquee, PinchGuard, resetBrutalButton} from "./UiBacking"

// Same type scale as SafetyPanel (size / 43.886 = em-square in cm at 110 cm).
const TITLE_SIZE = 38 // Caption: five title lines stay small
const BUTTON_SIZE = 48 // Headline2
const NUMBER_SIZE = 38
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
const NUMBER_INSET = 1.6 // "01".."05" sit this far in from the button's left edge
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)
const BUTTON_FILL = new vec4(1, 1, 1, 0.12)

// Slice 7A marquee.drill strip above the picker.
const MARQUEE_H = 2.6
const MARQUEE_EM = 1.4
const MARQUEE_GAP = 1.5
const MARQUEE_SPEED = 4 // cm/s
const MARQUEE_PERIOD = 40 // cm between copies

const NUMBER_COLOR = new vec4(1, 1, 1, 0.65)

/**
 * Language picker (Slice 5L, R16; Slice 7A look): the picker title in all five
 * languages and five numbered buttons, each line in its own language and font,
 * under a marquee.drill strip. Placed once at start by DrillController, before
 * the safety panel. It owns no drill state: DrillController listens to onPick
 * and sets the language.
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
  private readonly numberTexts: Text[] = []
  private readonly buttons: Button[] = []
  private readonly frames: BrutalFrame[] = []
  private marquee: Marquee

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const frame = new BrutalFrame(this.sceneObject, this.backingColor)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const panelW = INNER_W + PAD * 2
    this.marquee = new Marquee(this.sceneObject, "MarqueeDrill", panelW, MARQUEE_H, MARQUEE_EM, BRUTAL_WHITE, MARQUEE_SPEED, MARQUEE_PERIOD)

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = panelW
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
      this.marquee.root.getTransform().setLocalPosition(new vec3(0, r.containerHeight / 2 + MARQUEE_GAP + MARQUEE_H / 2, CONTENT_Z))
    })

    for (const lang of LANGS) {
      this.addTitleLine(content, lang)
    }
    for (let i = 0; i < LANGS.length; i++) {
      this.addLanguageButton(content, LANGS[i], i)
    }

    this.createEvent("UpdateEvent").bind(() => {
      if (this.sceneObject.isEnabledInHierarchy) {
        this.marquee.tick(getDeltaTime())
      }
    })
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

  /** Shows the picker. Fonts are applied here, after DrillController registered them. */
  show(): void {
    for (let i = 0; i < this.shownTexts.length; i++) {
      setLineText(this.shownTexts[i], this.shownTexts[i].text, this.textLangs[i])
    }
    const numberFont = latinFont("title")
    for (const t of this.numberTexts) {
      if (numberFont) t.font = numberFont
    }
    this.marquee.setText(primaryLine("marquee.drill"), latinFont("title"))
    this.sceneObject.enabled = true
    for (let i = 0; i < this.buttons.length; i++) {
      resetBrutalButton(this.buttons[i], this.frames[i])
    }
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

    const frame = makeBrutalButton(btn, BUTTON_W, BUTTON_H, BUTTON_FILL, () => {
      if (this.pinchGuard.open) this.pickEvent.invoke(lang)
    })
    this.buttons.push(btn)
    this.frames.push(frame)

    const label = global.scene.createSceneObject("lang.name." + lang)
    label.setParent(frame.face)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = this.addText(label, STRINGS["lang.name"][lang], BUTTON_SIZE, BUTTON_W - 0.5, BUTTON_H - 0.5, lang)
    t.capitilizationOverride = CapitilizationOverride.AllUpper

    // "01".."05": not a language line, so it stays out of `texts`.
    const num = global.scene.createSceneObject("lang.num." + lang)
    num.setParent(frame.face)
    num.getTransform().setLocalPosition(new vec3(-BUTTON_W / 2 + NUMBER_INSET, 0, BUTTON_LABEL_Z))
    const n = num.createComponent("Component.Text") as Text
    n.size = NUMBER_SIZE
    ;(n as Text & {weight?: number}).weight = WEIGHT
    n.depthTest = true
    n.textFill.color = NUMBER_COLOR
    n.horizontalAlignment = HorizontalAlignment.Center
    n.verticalAlignment = VerticalAlignment.Center
    n.horizontalOverflow = HorizontalOverflow.Overflow
    n.verticalOverflow = VerticalOverflow.Overflow
    n.layoutRect = Rect.create(-1.5, 1.5, -BUTTON_H / 2, BUTTON_H / 2)
    n.text = (index + 1 < 10 ? "0" : "") + (index + 1)
    this.numberTexts.push(n)
  }

  private addText(so: SceneObject, text: string, size: number, width: number, height: number, lang: Lang): Text {
    const t = so.createComponent("Component.Text") as Text
    t.size = size
    ;(t as Text & {weight?: number}).weight = WEIGHT
    t.depthTest = true
    t.textFill.color = BRUTAL_WHITE
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
