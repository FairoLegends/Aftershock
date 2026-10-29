import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {ScoreBreakdown} from "./ScoreCalculator"
import {FontRole, latinFont, lines, onLanguageChanged, setLinePair, StringKey} from "./Strings"
import {BrutalFrame, createSquareRect, drawOnTop, makeBrutalButton, PinchGuard, resetBrutalButton} from "./UiBacking"

// DESIGN_BRIEF §5 type scale (same as SafetyPanel). Used by the Restart label only.
type TextRole = "Headline2" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline2: {size: 48, weight: 700},
  Caption: {size: 38, weight: 500}
}
const ENGLISH_SCALE = 0.8

// Panel text at the HUD scale (ENGINEERING_PLAN 5i item 4): em heights in cm,
// Text.size = em (cm) x SIZE_PER_CM, as in Hud.ts.
const SIZE_PER_CM = 43.886
const BIG_EM_CM = 3.5 // title and score line
const SMALL_EM_CM = 2 // the other detail lines
const LINE_H_PER_EM = 1.25 // one line's slot; measured wrap advance of the panel font is 1.25 em

// Panel layout (cm). Not drill tunables: they only shape the panel.
const INNER_W = 40 // Slice 5L: widened from 32 for the longest German line (over.why.stood); longer lines wrap
const PAD = 2.5
const ROW_GAP = 1.6 // above each bilingual pair
const LINE_ID_H = 1.8 // Restart label lines
const LINE_EN_H = 1.5
const HIDDEN_H = 0.001 // an unused line collapses to this
const DETAIL_LINES = 2 // Slice 7A: the score has its own row
const SCORE_EM_CM = 5 // big Syne number
const SCORE_LABEL_EM_CM = 2.5 // "Skor" beside it; English below at SMALL_EM_CM
const SCORE_ROW_H = 7
const SCORE_RULE_H = 0.6 // thick rule under the score
const SCORE_SPLIT = 0.8 // half the gap between the number and its label
const BUTTON_FILL = new vec4(1, 1, 1, 0.12)
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
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive. 50% white (ENGINEERING_PLAN 5i item 3).")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.5)

  @input
  @hint("Thin outline around every panel text, so white text reads over light furniture seen through the backing (same as the HUD)")
  @widget(new ColorWidget())
  textOutlineColor: vec4 = new vec4(0.2, 0.2, 0.2, 1)

  @input
  @hint("Outline strength, 0 (none) to 1 (very strong)")
  @widget(new SliderWidget(0, 1, 0.05))
  textOutlineSize: number = 0.2
  @ui.group_end

  private readonly restartEvent = new Event()
  /** Raised when Restart is pressed (pinch or click). */
  readonly onRestart: PublicApi<void> = this.restartEvent.publicApi()
  /** 5h item 1: presses are ignored for pinchGuard.seconds after the panel shows. */
  readonly pinchGuard = new PinchGuard()

  private title: LinePair | null = null
  private details: LinePair[] = []
  private shownTexts: Text[] = []
  private _mode: ResultMode | null = null
  private scoreRow: SceneObject
  private scoreItem: FlexItem
  private scoreNumber: Text
  private scoreId: Text
  private scoreEn: Text
  private restartButton: Button
  private restartFrame: BrutalFrame

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
    flex.rowGap = 0 // gaps are margins, so collapsed lines leave none
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
    })

    this.title = this.addPair(content, "Title")
    for (let i = 0; i < DETAIL_LINES; i++) {
      this.details.push(this.addPair(content, "Line" + (i + 1)))
    }
    this.addScoreRow(content)
    this.addRestartButton(content)
    this.setPair(this.title, null, false, BIG_EM_CM, "title")
    for (const pair of this.details) {
      this.setPair(pair, null, true, SMALL_EM_CM)
    }
    this.setScore(null)
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
    this.setPair(this.title, lines("result.title"), false, BIG_EM_CM, "title")
    if (b.tSafe === null) {
      this.setPair(this.details[0], lines("result.never"), true, SMALL_EM_CM)
      this.setPair(this.details[1], null, true, SMALL_EM_CM)
    } else {
      this.setPair(this.details[0], fill("result.speed", "{s}", b.tSafe.toFixed(1)), true, SMALL_EM_CM)
      this.setPair(this.details[1], fill("result.health", "{h}", "" + Math.round(b.healthLeft)), true, SMALL_EM_CM)
    }
    this.setScore(b.score)
    this.showPanel()
  }

  /** Out of health: what went wrong (over.why.stood or over.why.danger), no score (TDD §7). */
  showGameOver(reason: StringKey): void {
    this._mode = "gameOver"
    this.setPair(this.title, lines("over.title"), false, BIG_EM_CM, "title")
    this.setPair(this.details[0], lines(reason), true, SMALL_EM_CM)
    this.setPair(this.details[1], null, true, SMALL_EM_CM)
    this.setScore(null)
    this.showPanel()
  }

  private showPanel(): void {
    this.sceneObject.enabled = true
    if (this.restartButton) resetBrutalButton(this.restartButton, this.restartFrame)
    drawOnTop(this.sceneObject)
    this.pinchGuard.arm()
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

  /**
   * Fills a line pair from a bilingual string at `emCm` (English at 80%), or
   * collapses it when text is null.
   */
  private setPair(pair: LinePair, text: ReturnType<typeof lines> | null, gapAbove: boolean, emCm: number, role: FontRole = "body"): void {
    const shown = text !== null
    setLinePair(pair.id, pair.en, shown ? text : {primary: "", secondary: ""}, role)
    this.fitLine(pair.id, pair.idItem, shown, emCm)
    this.fitLine(pair.en, pair.enItem, shown, emCm * ENGLISH_SCALE)
    pair.idItem.marginTop = shown && gapAbove ? ROW_GAP : 0
  }

  /**
   * Sizes a line and grows its slot to the number of lines it wraps to inside
   * INNER_W. getBoundingBox is limited to 5 calls per Text per frame (measured);
   * this makes one per line per show.
   */
  private fitLine(t: Text, item: FlexItem, shown: boolean, emCm: number): void {
    t.size = emCm * SIZE_PER_CM
    const lineH = emCm * LINE_H_PER_EM
    let h = shown ? lineH : HIDDEN_H
    if (shown && t.text.length > 0) {
      const box = t.getBoundingBox()
      h = Math.max(1, Math.round((box.top - box.bottom) / lineH)) * lineH
    }
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -h / 2, h / 2)
    item.overrideHeight = h
  }

  private addPair(parent: SceneObject, name: string): LinePair {
    const id = this.addLine(parent, name + ".id")
    const en = this.addLine(parent, name + ".en")
    return {id: id.text, en: en.text, idItem: id.item, enItem: en.item}
  }

  private addLine(parent: SceneObject, name: string): {text: Text; item: FlexItem} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, SMALL_EM_CM * SIZE_PER_CM, true)
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -HIDDEN_H / 2, HIDDEN_H / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = INNER_W
    item.overrideHeight = HIDDEN_H
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
    item.marginTop = ROW_GAP

    // Slice 7A: the same brutal button as Continue; the label rides on the face.
    this.restartButton = btn
    this.restartFrame = makeBrutalButton(btn, BUTTON_W, BUTTON_H, BUTTON_FILL, () => {
      if (this.pinchGuard.open) this.restartEvent.invoke()
    })

    // Bilingual label: Indonesian on top, English below at 80%.
    const label = global.scene.createSceneObject("RestartLabel")
    label.setParent(this.restartFrame.face)
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
    restartPrimary.capitilizationOverride = CapitilizationOverride.AllUpper
    const refreshRestart = (): void => setLinePair(restartPrimary, restartSecondary, lines("btn.restart"), "title")
    refreshRestart()
    onLanguageChanged.add(refreshRestart)
  }

  /** Slice 7A score row: big Syne number, "Skor / Score" beside it, a thick rule under it. */
  private addScoreRow(parent: SceneObject): void {
    const so = global.scene.createSceneObject("Score")
    so.setParent(parent)
    this.scoreRow = so
    this.scoreItem = so.createComponent(FlexItem.getTypeName()) as FlexItem
    this.scoreItem.overrideWidth = INNER_W
    this.scoreItem.overrideHeight = SCORE_ROW_H
    this.scoreItem.alignSelf = FlexAlignSelf.Center
    this.scoreNumber = this.scoreText(so, "Score.number", SCORE_EM_CM, -INNER_W / 2, -SCORE_SPLIT, 0.5, HorizontalAlignment.Right)
    this.scoreId = this.scoreText(so, "Score.id", SCORE_LABEL_EM_CM, SCORE_SPLIT, INNER_W / 2, 1.4, HorizontalAlignment.Left)
    this.scoreEn = this.scoreText(so, "Score.en", SMALL_EM_CM, SCORE_SPLIT, INNER_W / 2, -1.2, HorizontalAlignment.Left)
    const rule = global.scene.createSceneObject("Score.rule")
    rule.setParent(so)
    rule.getTransform().setLocalPosition(new vec3(0, -SCORE_ROW_H / 2 + SCORE_RULE_H / 2, 0))
    createSquareRect(rule, WHITE, INNER_W, SCORE_RULE_H)
  }

  private scoreText(parent: SceneObject, name: string, emCm: number, left: number, right: number, y: number, align: HorizontalAlignment): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, y, 0))
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, emCm * SIZE_PER_CM, false)
    t.horizontalAlignment = align
    t.layoutRect = Rect.create(left, right, -emCm * 0.7, emCm * 0.7)
    this.shownTexts.push(t)
    return t
  }

  /** Shows the score row (null hides it: game over). */
  private setScore(score: number | null): void {
    const shown = score !== null
    this.scoreRow.enabled = shown
    this.scoreItem.overrideHeight = shown ? SCORE_ROW_H : HIDDEN_H
    this.scoreItem.marginTop = shown ? ROW_GAP : 0
    const l = lines("result.score", {"{score}": ""})
    const strip = (s: string): string => s.replace(/[:：]\s*$/, "").trim()
    setLinePair(this.scoreId, this.scoreEn, shown ? {primary: strip(l.primary), secondary: strip(l.secondary)} : {primary: "", secondary: ""}, "title")
    this.scoreNumber.text = shown ? "" + score : ""
    const f = latinFont("title")
    if (f) this.scoreNumber.font = f
  }

  private addButtonLine(parent: SceneObject, name: string, text: string, height: number, scale: number): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    // Restart label unchanged: Headline2, English at 80% but never under the Caption floor.
    this.styleText(t, Math.max(TYPE_SCALE.Headline2.size * scale, TYPE_SCALE.Caption.size), false)
    const w = BUTTON_W - 0.5
    t.layoutRect = Rect.create(-w / 2, w / 2, -height / 2, height / 2)
    so.createComponent(FlexItem.getTypeName())
    this.shownTexts.push(t)
  }

  private styleText(t: Text, size: number, wrap: boolean): void {
    t.size = size
    ;(t as Text & {weight?: number}).weight = TYPE_SCALE.Headline2.weight
    t.depthTest = true
    t.textFill.color = WHITE
    if (this.textOutlineSize > 0) {
      t.outlineSettings.enabled = true
      t.outlineSettings.size = this.textOutlineSize
      t.outlineSettings.fill.color = this.textOutlineColor
    }
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
  }
}

/** A Strings.ts entry (selected language + English) with its placeholder filled in. */
function fill(key: StringKey, placeholder: string, value: string): ReturnType<typeof lines> {
  return lines(key, {[placeholder]: value})
}
