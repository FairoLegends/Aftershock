import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Level, LEVELS, levelLineKeys, levelNameKey, DEFAULT_LEVEL} from "./Levels"
import {getLanguage, getString, setLineText, StringKey} from "./Strings"
import {
  createRoundRect,
  drawOnTopWhenReady,
  PinchGuard,
  SOFT_DIM,
  SOFT_GREEN,
  SOFT_GREEN_TEXT,
  SOFT_INNER_RADIUS_CM,
  SOFT_WHITE,
  SoftButton,
  SoftFrame
} from "./UiBacking"

// Same type scale as LanguagePanel (size / 43.886 = em-square in cm at 110 cm).
const TITLE_SIZE = 48
const NAME_SIZE = 52
const LINE_SIZE = 26
const PILL_SIZE = 22
const WEIGHT = 700

// Panel layout (cm). Not drill tunables: they only shape this panel.
const PAD = 2.5
const CARD_W = 14
const CARD_H = 13
const CARD_GAP = 1.2
const TITLE_H = 2.4
const TITLE_GAP = 1.2
const PANEL_W = CARD_W * 3 + CARD_GAP * 2 + PAD * 2
const PANEL_H = PAD + TITLE_H + TITLE_GAP + CARD_H + PAD
const TITLE_Y = PANEL_H / 2 - PAD - TITLE_H / 2
const CARD_Y = PANEL_H / 2 - PAD - TITLE_H - TITLE_GAP - CARD_H / 2
const NAME_Y = 2.6 // card-local
const NAME_H = 2
const LINE_W = CARD_W - 1.6
const LINE_H = 2.1
const LINE_Y = [-0.2, -2.4, -4.6] // card-local slot centers
const PILL_W = 8.4
const PILL_H = 1.6
const PILL_Y = CARD_H / 2 - PILL_H / 2 - 0.5
const LABEL_Z = 0.08 // lifts labels off the card face
const PILL_Z = 0.04
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

/**
 * Level picker (Slice 7C, ENGINEERING_PLAN 5j item 18): title and three cards
 * (Easy, Normal, Hard) side by side, each with its name and three lines;
 * Normal carries the recommended pill. Cards are Slice 7A-soft secondary
 * buttons; the current level keeps the green focus look. Shown between the
 * safety panel and the briefing. It owns no drill state: DrillController
 * listens to onPick and sets the level.
 */
@component
export class LevelPanel extends BaseScriptComponent {
  @ui.label("Level picker (Slice 7C)")
  @ui.separator
  @ui.group_start("Look")
  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.25)
  @ui.group_end

  private readonly pickEvent = new Event<Level>()
  /** Raised with the picked level when a card is pressed (pinch or click). */
  readonly onPick: PublicApi<Level> = this.pickEvent.publicApi()
  /** 5h item 1: presses are ignored for pinchGuard.seconds after show(). */
  readonly pinchGuard = new PinchGuard()

  private readonly shownTexts: Text[] = []
  private readonly textKeys: StringKey[] = []
  private readonly cards: SoftButton[] = []

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const frame = new SoftFrame(this.sceneObject, this.backingColor)
    frame.setSize(PANEL_W, PANEL_H)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const title = global.scene.createSceneObject("level.title")
    title.setParent(content)
    title.getTransform().setLocalPosition(new vec3(0, TITLE_Y, 0))
    this.addText(title, "level.title", TITLE_SIZE, PANEL_W - PAD * 2, TITLE_H, SOFT_WHITE)

    for (let i = 0; i < LEVELS.length; i++) {
      this.addCard(content, LEVELS[i], (i - 1) * (CARD_W + CARD_GAP))
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

  /** Shows the picker in the selected language, with `selected` marked as the current level. */
  show(selected: Level = DEFAULT_LEVEL): void {
    const lang = getLanguage()
    for (let i = 0; i < this.shownTexts.length; i++) {
      setLineText(this.shownTexts[i], getString(this.textKeys[i], lang), lang)
    }
    this.sceneObject.enabled = true
    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].reset()
      this.cards[i].setSelected(LEVELS[i] === selected)
    }
    // After enabling, so the RoundedRectangle meshes exist when the order is set (7A-soft fix).
    drawOnTopWhenReady(this, this.sceneObject)
    this.pinchGuard.arm()
  }

  hide(): void {
    this.sceneObject.enabled = false
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }
  /** Every text line the panel shows, in order (title, then per card: name, three lines, pill on Normal). */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text)
  }

  private addCard(parent: SceneObject, level: Level, x: number): void {
    const so = global.scene.createSceneObject("LevelButton." + level)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(x, CARD_Y, 0))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(CARD_W, CARD_H, 1)

    const card = new SoftButton(this, btn, CARD_W, CARD_H, false, () => {
      if (this.pinchGuard.open) this.pickEvent.invoke(level)
    })
    this.cards.push(card)

    const name = this.child(card.face, levelNameKey(level), 0, NAME_Y, LABEL_Z)
    this.addText(name, levelNameKey(level), NAME_SIZE, LINE_W, NAME_H, SOFT_WHITE).horizontalOverflow =
      HorizontalOverflow.Shrink

    const keys = levelLineKeys(level)
    for (let i = 0; i < keys.length; i++) {
      const line = this.child(card.face, keys[i], 0, LINE_Y[i], LABEL_Z)
      const t = this.addText(line, keys[i], LINE_SIZE, LINE_W, LINE_H, SOFT_DIM)
      t.horizontalOverflow = HorizontalOverflow.Wrap
      t.verticalOverflow = VerticalOverflow.Shrink
    }

    if (level === DEFAULT_LEVEL) {
      const pill = this.child(card.face, "level.recommended", 0, PILL_Y, PILL_Z)
      createRoundRect(pill, SOFT_GREEN, PILL_W, PILL_H, SOFT_INNER_RADIUS_CM)
      const label = this.child(pill, "level.recommended.text", 0, 0, LABEL_Z - PILL_Z)
      this.addText(label, "level.recommended", PILL_SIZE, PILL_W - 0.8, PILL_H, SOFT_GREEN_TEXT).horizontalOverflow =
        HorizontalOverflow.Shrink
    }
  }

  private child(parent: SceneObject, name: string, x: number, y: number, z: number): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(x, y, z))
    return so
  }

  private addText(so: SceneObject, key: StringKey, size: number, width: number, height: number, color: vec4): Text {
    const t = so.createComponent("Component.Text") as Text
    t.size = size
    ;(t as Text & {weight?: number}).weight = WEIGHT
    t.depthTest = true
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    setLineText(t, getString(key), getLanguage())
    this.shownTexts.push(t)
    this.textKeys.push(key)
    return t
  }
}
