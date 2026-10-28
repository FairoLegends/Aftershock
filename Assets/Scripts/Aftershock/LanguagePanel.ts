import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Lang, LANGS, setLineText, STRINGS} from "./Strings"
import {createLightBacking} from "./UiBacking"

// Same type scale as SafetyPanel (size / 43.886 = em-square in cm at 110 cm).
const TITLE_SIZE = 38 // Caption: five title lines stay small
const BUTTON_SIZE = 48 // Headline2
const WEIGHT = 700

// Panel layout (cm). Not drill tunables: they only shape this panel.
const INNER_W = 32
const PAD = 2.5
const TITLE_GAP = 0.3
const TITLE_H = 1.5
const BUTTON_GAP = 1.2
const BUTTON_W = 18 // DESIGN_BRIEF §6.1: at least 12 x 5 cm
const BUTTON_H = 5
const BUTTON_LABEL_Z = 0.08 // lifts the label off the button face
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

const WHITE = new vec4(1, 1, 1, 1)

/**
 * Language picker (Slice 5L, R16): the picker title in all five languages and
 * five buttons, each line in its own language and font. Placed once at start
 * by DrillController, before the safety panel. It owns no drill state:
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

  private readonly shownTexts: Text[] = []
  private readonly textLangs: Lang[] = []

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
    flex.rowGap = TITLE_GAP
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      backing.size = new vec2(r.containerWidth, r.containerHeight)
    })

    for (const lang of LANGS) {
      this.addTitleLine(content, lang)
    }
    for (const lang of LANGS) {
      this.addLanguageButton(content, lang, lang === LANGS[0])
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

  /** Shows the picker. Fonts are applied here, after DrillController registered them. */
  show(): void {
    for (let i = 0; i < this.shownTexts.length; i++) {
      setLineText(this.shownTexts[i], this.shownTexts[i].text, this.textLangs[i])
    }
    this.sceneObject.enabled = true
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

  private addLanguageButton(parent: SceneObject, lang: Lang, first: boolean): void {
    const so = global.scene.createSceneObject("LangButton." + lang)
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.marginTop = first ? BUTTON_GAP * 1.5 : BUTTON_GAP - TITLE_GAP

    const label = global.scene.createSceneObject("lang.name." + lang)
    label.setParent(so)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    this.addText(label, STRINGS["lang.name"][lang], BUTTON_SIZE, BUTTON_W - 0.5, BUTTON_H - 0.5, lang)

    btn.onTriggerUp.add(() => this.pickEvent.invoke(lang))
  }

  private addText(so: SceneObject, text: string, size: number, width: number, height: number, lang: Lang): Text {
    const t = so.createComponent("Component.Text") as Text
    t.size = size
    ;(t as Text & {weight?: number}).weight = WEIGHT
    t.depthTest = true
    t.textFill.color = WHITE
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
