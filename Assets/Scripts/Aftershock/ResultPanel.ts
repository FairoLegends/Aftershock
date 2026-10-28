import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {ScoreBreakdown} from "./ScoreCalculator"
import {lines, onLanguageChanged, setLinePair, StringKey} from "./Strings"
import {createLightBacking} from "./UiBacking"

// DESIGN_BRIEF §5 type scale (same as SafetyPanel).
type TextRole = "Headline2" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline2: {size: 48, weight: 700},
  Caption: {size: 38, weight: 500}
}
const ENGLISH_SCALE = 0.8

// Panel layout (cm). Not drill tunables: they only shape the panel.
const INNER_W = 40 // Slice 5L: widened from 32 for the longest German line (over.why.stood);
const PAD = 2.5
const ROW_GAP = 1.6 // above each bilingual pair
const LINE_ID_H = 1.8
const LINE_EN_H = 1.5
const HIDDEN_H = 0.001 // an unused line collapses to this
const DETAIL_LINES = 3
const BUTTON_W = 14 // DESIGN_BRIEF §5: buttons at least 12 x 5 cm
const BUTTON_H = 5
const BUTTON_LABEL_Z = 0.08 // lifts the label off the button face
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

const WHITE = new vec4(1, 1, 1, 1)

export type ResultMode = "result" | "gameOver"

/** One bilingual line pair: Indonesian on top, English below at 80%. */
interface LinePair {
  id: Text
  en: Text
  idItem: FlexItem
  enItem: FlexItem
}

/**
 * Result and game-over panel (TDD §3.1, §7, R12, R13): a title, up to three
 * detail lines and one Restart button. Text comes from Strings.ts only. It
 * owns no drill state: DrillController fills it and listens to onRestart.
 */
@component
export class ResultPanel extends BaseScriptComponent {
  @ui.label("Result / game-over panel (R12, R13)")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.25)
  @ui.group_end

  private readonly restartEvent = new Event()
  /** Raised when Restart is pressed (pinch or click). */
  readonly onRestart: PublicApi<void> = this.restartEvent.publicApi()

  private title: LinePair | null = null
  private details: LinePair[] = []
  private shownTexts: Text[] = []
  private _mode: ResultMode | null = null

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
    flex.rowGap = 0 // gaps are margins, so collapsed lines leave none
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      backing.size = new vec2(r.containerWidth, r.containerHeight)
    })

    this.title = this.addPair(content, "Title")
    for (let i = 0; i < DETAIL_LINES; i++) {
      this.details.push(this.addPair(content, "Line" + (i + 1)))
    }
    this.addRestartButton(content)
    this.setPair(this.title, null, false)
    for (const pair of this.details) {
      this.setPair(pair, null, true)
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
   * Drill complete: time to take cover, health left and score (TDD §7).
   * Never took cover (tSafe null): result.never and score 0 (Q6).
   */
  showResult(b: ScoreBreakdown): void {
    this._mode = "result"
    this.setPair(this.title, lines("result.title"), false)
    const score = fill("result.score", "{score}", "" + b.score)
    if (b.tSafe === null) {
      this.setPair(this.details[0], lines("result.never"), true)
      this.setPair(this.details[1], score, true)
      this.setPair(this.details[2], null, true)
    } else {
      this.setPair(this.details[0], fill("result.speed", "{s}", b.tSafe.toFixed(1)), true)
      this.setPair(this.details[1], fill("result.health", "{h}", "" + Math.round(b.healthLeft)), true)
      this.setPair(this.details[2], score, true)
    }
    this.sceneObject.enabled = true
  }

  /** Out of health: what went wrong (over.why.stood or over.why.danger), no score (TDD §7). */
  showGameOver(reason: StringKey): void {
    this._mode = "gameOver"
    this.setPair(this.title, lines("over.title"), false)
    this.setPair(this.details[0], lines(reason), true)
    this.setPair(this.details[1], null, true)
    this.setPair(this.details[2], null, true)
    this.sceneObject.enabled = true
  }

  hide(): void {
    this._mode = null
    this.sceneObject.enabled = false
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }
  /** What the panel shows, or null when hidden. */
  get mode(): ResultMode | null {
    return this._mode
  }
  /** Every non-empty text line the panel shows, in order (button label last). */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text).filter((s) => s.length > 0)
  }

  /** Fills a line pair from a bilingual string, or collapses it when text is null. */
  private setPair(pair: LinePair, text: ReturnType<typeof lines> | null, gapAbove: boolean): void {
    const shown = text !== null
    setLinePair(pair.id, pair.en, shown ? text : {primary: "", secondary: ""})
    pair.idItem.overrideHeight = shown ? LINE_ID_H : HIDDEN_H
    pair.enItem.overrideHeight = shown ? LINE_EN_H : HIDDEN_H
    pair.idItem.marginTop = shown && gapAbove ? ROW_GAP : 0
  }

  private addPair(parent: SceneObject, name: string): LinePair {
    const id = this.addLine(parent, name + ".id", LINE_ID_H, 1)
    const en = this.addLine(parent, name + ".en", LINE_EN_H, ENGLISH_SCALE)
    return {id: id.text, en: en.text, idItem: id.item, enItem: en.item}
  }

  private addLine(parent: SceneObject, name: string, height: number, scale: number): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, "Headline2", scale)
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -height / 2, height / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = INNER_W
    item.overrideHeight = height
    item.alignSelf = FlexAlignSelf.Center
    this.shownTexts.push(t)
    return {text: t, item}
  }

  private addRestartButton(parent: SceneObject): void {
    const so = global.scene.createSceneObject("RestartButton")
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.marginTop = ROW_GAP * 1.5

    // Bilingual label: Indonesian on top, English below at 80%.
    const label = global.scene.createSceneObject("RestartLabel")
    label.setParent(so)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const labelFlex = label.createComponent(FlexLayout.getTypeName()) as FlexLayout
    labelFlex.width = BUTTON_W - 0.5
    labelFlex.height = BUTTON_H - 0.5
    labelFlex.direction = FlexDirection.Column
    labelFlex.alignItems = FlexAlign.Stretch
    labelFlex.justifyContent = FlexJustify.Center
    labelFlex.rowGap = 0.2

    this.addButtonLine(label, "btn.restart.id", "", LINE_ID_H, 1)
    this.addButtonLine(label, "btn.restart.en", "", LINE_EN_H, ENGLISH_SCALE)
    // Slice 5L: the button label follows the selected language (child 0 = primary, 1 = English).
    const restartPrimary = label.getChild(0).getComponent("Component.Text") as Text
    const restartSecondary = label.getChild(1).getComponent("Component.Text") as Text
    const refreshRestart = (): void => setLinePair(restartPrimary, restartSecondary, lines("btn.restart"))
    refreshRestart()
    onLanguageChanged.add(refreshRestart)

    btn.onTriggerUp.add(() => this.restartEvent.invoke())
  }

  private addButtonLine(parent: SceneObject, name: string, text: string, height: number, scale: number): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    this.styleText(t, "Headline2", scale)
    const w = BUTTON_W - 0.5
    t.layoutRect = Rect.create(-w / 2, w / 2, -height / 2, height / 2)
    so.createComponent(FlexItem.getTypeName())
    this.shownTexts.push(t)
  }

  private styleText(t: Text, role: TextRole, scale: number): void {
    // English line: 80% of the Indonesian size, never under the Caption floor.
    t.size = Math.max(TYPE_SCALE[role].size * scale, TYPE_SCALE.Caption.size)
    ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
    t.depthTest = true
    t.textFill.color = WHITE
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
  }
}

/** A Strings.ts entry (selected language + English) with its placeholder filled in. */
function fill(key: StringKey, placeholder: string, value: string): ReturnType<typeof lines> {
  return lines(key, {[placeholder]: value})
}
