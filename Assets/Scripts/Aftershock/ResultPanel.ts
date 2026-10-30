import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {ScoreBreakdown} from "./ScoreCalculator"
import {getLanguage, latinFont, Lines, lines, onLanguageChanged, setLinePair, setLineText, StringKey} from "./Strings"
import {
  createRoundRect,
  drawOnTopWhenReady,
  PinchGuard,
  SOFT_DIM,
  SOFT_GREEN_TEXT,
  SOFT_INNER_RADIUS_CM,
  SoftButton,
  SoftFrame,
  TabularText
} from "./UiBacking"

// Panel text at the HUD scale (ENGINEERING_PLAN 5i item 4): em heights in cm,
// Text.size = em (cm) x SIZE_PER_CM, as in Hud.ts.
const SIZE_PER_CM = 43.886
const BIG_EM_CM = 3.5 // title
const SMALL_EM_CM = 2 // detail rows
const LINE_H_PER_EM = 1.25 // one line's slot; measured wrap advance of the panel font is 1.25 em

// Panel layout (cm). Not drill tunables: they only shape the panel.
// Slice 7A-soft (mockup .score, .stats): title, a rounded score row, detail
// rows (label left dimmed, value right bold, thin rule between), Restart.
const INNER_W = 40 // Slice 5L: widened from 32 for the longest German line (over.why.stood); longer lines wrap
const PAD = 2.5
const HIDDEN_H = 0.001 // an unused line collapses to this
const DETAIL_LINES = 9 // Slice 8B: four base rows (speed, health, grip, evac) plus aftershock, level and reveal; Slice 8D: new best and best
const DETAIL_PAD = 0.5 // above and below a detail row's text
const DETAIL_GAP = 1.0 // above the first detail row
const VALUE_W = 12 // detail value column, right
const RULE_H = 0.1
const RULE_COLOR = new vec4(1, 1, 1, 0.14)
const SCORE_ROW_H = 6
const SCORE_ROW_FILL = new vec4(1, 1, 1, 0.08)
const SCORE_ROW_GAP = 1.2 // above the score row
const SCORE_EM_CM = 4 // the number, right
const SCORE_LABEL_EM_CM = 2.5 // "Skor", left
const SCORE_INSET = 1.4 // text inset from the row's ends
const BUTTON_GAP = 1.6 // above Restart
const BUTTON_W = 14 // DESIGN_BRIEF §5: buttons at least 12 x 5 cm
const BUTTON_H = 5
const BUTTON_EM_CM = 2
const BUTTON_LABEL_Z = 0.08 // lifts the label off the button face
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)
const ROW_Z = 0.05 // row text above the score row's backing

const WHITE = new vec4(1, 1, 1, 1)

export type ResultMode = "result" | "gameOver"

/** An extra detail row (Slice 7C): `split` false keeps a sentence with ":" centered (result.reveal). */
export interface ResultLine {
  text: Lines
  split: boolean
}

/** One row: the selected language (`id`), the collapsed English line (`en`) and, when split at ":", a value on the right. */
interface Row {
  id: Text
  en: Text
  value: Text | null
  rule: SceneObject | null
  item: FlexItem
}

/**
 * Result and game-over panel (TDD §3.1, §7, R12, R13): a title, the score,
 * up to two detail rows and one Restart button. Text comes from Strings.ts
 * only. It owns no drill state: DrillController fills it and listens to
 * onRestart.
 */
@component
export class ResultPanel extends BaseScriptComponent {
  @ui.label("Result / game-over panel (R12, R13)")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive. 75% white (Slice 8A P1: readable over furniture).")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.75)

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

  private title: Row
  private details: Row[] = []
  private shownTexts: Text[] = []
  private _mode: ResultMode | null = null
  private scoreRow: SceneObject
  private scoreItem: FlexItem
  private scoreNumber: TabularText
  private scoreId: Text
  private scoreEn: Text
  private restart: SoftButton | null = null

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
    flex.rowGap = 0 // gaps are margins, so collapsed rows leave none
    flex.paddingTop = PAD
    flex.paddingBottom = PAD
    flex.paddingLeft = PAD
    flex.paddingRight = PAD
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
    })

    this.title = this.addRow(content, "Title", false)
    this.addScoreRow(content)
    for (let i = 0; i < DETAIL_LINES; i++) {
      this.details.push(this.addRow(content, "Line" + (i + 1), i > 0))
    }
    this.addRestartButton(content)
    this.setRow(this.title, null, BIG_EM_CM)
    for (const row of this.details) {
      this.setRow(row, null, SMALL_EM_CM)
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
  showResult(b: ScoreBreakdown, extra: ResultLine[] = []): void {
    this._mode = "result"
    this.sceneObject.enabled = true // measure the rows in the real font
    this.setRow(this.title, lines("result.title"), BIG_EM_CM)
    this.setScore(b.score)
    // Slice 8B (5k item 10): the grip share and the evacuation, after speed and health.
    const evac: ResultLine = b.evacReached
      ? {text: fill("result.evac", "{s}", (b.evacTime as number).toFixed(1)), split: true}
      : {text: lines("result.evacFail"), split: true}
    if (b.tSafe === null) {
      this.setDetails([{text: lines("result.never"), split: true}, evac], extra)
    } else {
      this.setDetails(
        [
          {text: fill("result.speed", "{s}", b.tSafe.toFixed(1)), split: true},
          {text: fill("result.health", "{h}", "" + Math.round(b.healthLeft)), split: true},
          {text: fill("result.grip", "{p}", "" + Math.round(b.holdShare * 100)), split: true},
          evac
        ],
        extra
      )
    }
    this.showPanel()
  }

  /** Out of health: what went wrong (over.why.stood, over.why.danger or hit.fell, 5j-19b), no score (TDD §7). */
  showGameOver(reason: StringKey, extra: ResultLine[] = []): void {
    this._mode = "gameOver"
    this.sceneObject.enabled = true
    this.setRow(this.title, lines("over.title"), BIG_EM_CM)
    this.setScore(null)
    this.setDetails([{text: lines(reason), split: true}], extra)
    this.showPanel()
  }

  /** Fills the detail rows with `base` then `extra` and collapses the rest. */
  private setDetails(base: ResultLine[], extra: ResultLine[]): void {
    const all = base.concat(extra)
    for (let i = 0; i < this.details.length; i++) {
      const l = i < all.length ? all[i] : null
      this.setRow(this.details[i], l ? l.text : null, SMALL_EM_CM, l ? l.split : true)
    }
  }

  private showPanel(): void {
    this.sceneObject.enabled = true
    if (this.restart) this.restart.reset()
    drawOnTopWhenReady(this, this.sceneObject) // 5j-19f: again once the layout settles
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
   * Fills a row at `emCm`, or collapses it when text is null. A detail row
   * splits at the first ":" into a dimmed label (left) and a bold value
   * (right); a line without one is centered and wraps (5i-4 readability).
   */
  private setRow(row: Row, text: Lines | null, emCm: number, split: boolean = true): void {
    const shown = text !== null
    const l = shown ? text : {primary: "", secondary: ""}
    const lineH = emCm * LINE_H_PER_EM
    const m = row.value && split ? /^(.*?)\s*[:：]\s*(.+)$/.exec(l.primary) : null
    const label = m ? m[1] : l.primary
    setLinePair(row.id, row.en, {primary: label, secondary: l.secondary})
    row.id.size = emCm * SIZE_PER_CM
    row.id.textFill.color = m ? SOFT_DIM : WHITE
    row.id.horizontalAlignment = m ? HorizontalAlignment.Left : HorizontalAlignment.Center
    const left = -INNER_W / 2
    const right = m ? INNER_W / 2 - VALUE_W : INNER_W / 2
    row.id.layoutRect = Rect.create(left, right, -lineH / 2, lineH / 2)
    if (row.value) {
      setLineText(row.value, m ? m[2] : "", getLanguage())
    }
    // Grow the slot to the number of lines the text wraps to. getBoundingBox
    // is limited to 5 calls per Text per frame (measured); this makes one.
    let h = shown ? lineH : HIDDEN_H
    if (shown && label.length > 0 && row.id.getSceneObject().isEnabledInHierarchy) {
      const box = row.id.getBoundingBox()
      h = Math.max(1, Math.round((box.top - box.bottom) / lineH)) * lineH
    }
    row.id.layoutRect = Rect.create(left, right, -h / 2, h / 2)
    const pad = shown && row.value ? DETAIL_PAD : 0
    row.item.overrideHeight = h + pad * 2
    if (row.rule) {
      row.rule.enabled = shown
      row.rule.getTransform().setLocalPosition(new vec3(0, h / 2 + pad, 0))
    }
    if (row === this.details[0]) {
      row.item.marginTop = shown ? DETAIL_GAP : 0
    }
  }

  private addRow(parent: SceneObject, name: string, ruleAbove: boolean): Row {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = INNER_W
    item.overrideHeight = HIDDEN_H
    item.alignSelf = FlexAlignSelf.Center
    const id = this.addText(so, name + ".id", SMALL_EM_CM, true)
    const en = this.addText(so, name + ".en", SMALL_EM_CM, true)
    let value: Text | null = null
    let rule: SceneObject | null = null
    if (name !== "Title") {
      value = this.addText(so, name + ".value", SMALL_EM_CM, false)
      value.horizontalAlignment = HorizontalAlignment.Right
      const h = SMALL_EM_CM * LINE_H_PER_EM
      value.layoutRect = Rect.create(INNER_W / 2 - VALUE_W, INNER_W / 2, -h / 2, h / 2)
    }
    if (ruleAbove) {
      rule = global.scene.createSceneObject(name + ".rule")
      rule.setParent(so)
      createRoundRect(rule, RULE_COLOR, INNER_W, RULE_H, 0)
    }
    return {id, en, value, rule, item}
  }

  private addText(parent: SceneObject, name: string, emCm: number, wrap: boolean): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, ROW_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, emCm * SIZE_PER_CM, wrap)
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -HIDDEN_H / 2, HIDDEN_H / 2)
    this.shownTexts.push(t)
    return t
  }

  /** Slice 7A-soft: the primary (green) button; the label rides on the face. */
  private addRestartButton(parent: SceneObject): void {
    const so = global.scene.createSceneObject("RestartButton")
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.marginTop = BUTTON_GAP

    this.restart = new SoftButton(this, btn, BUTTON_W, BUTTON_H, true, () => {
      if (this.pinchGuard.open) this.restartEvent.invoke()
    })

    const label = global.scene.createSceneObject("RestartLabel")
    label.setParent(this.restart.face)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const primary = this.addButtonLine(label, "btn.restart.id")
    const secondary = this.addButtonLine(label, "btn.restart.en")
    const refreshRestart = (): void => setLinePair(primary, secondary, lines("btn.restart"))
    refreshRestart()
    onLanguageChanged.add(refreshRestart)
  }

  private addButtonLine(parent: SceneObject, name: string): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, BUTTON_EM_CM * SIZE_PER_CM, false)
    t.textFill.color = SOFT_GREEN_TEXT
    t.outlineSettings.enabled = false // dark text on solid green
    t.horizontalOverflow = HorizontalOverflow.Shrink
    const w = BUTTON_W - 1
    const h = BUTTON_EM_CM * LINE_H_PER_EM
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    this.shownTexts.push(t)
    return t
  }

  /** Slice 7A-soft score row (mockup .score): rounded, "Skor" left, the number right in fixed-width digits. */
  private addScoreRow(parent: SceneObject): void {
    const so = global.scene.createSceneObject("Score")
    so.setParent(parent)
    this.scoreRow = so
    this.scoreItem = so.createComponent(FlexItem.getTypeName()) as FlexItem
    this.scoreItem.overrideWidth = INNER_W
    this.scoreItem.overrideHeight = SCORE_ROW_H
    this.scoreItem.alignSelf = FlexAlignSelf.Center
    const row = new SoftFrame(so, SCORE_ROW_FILL, SOFT_INNER_RADIUS_CM, null, "Score.backing")
    row.setSize(INNER_W, SCORE_ROW_H)
    const x = INNER_W / 2 - SCORE_INSET
    this.scoreId = this.scoreText(so, "Score.id", SCORE_LABEL_EM_CM, -x, x, HorizontalAlignment.Left)
    this.scoreId.textFill.color = SOFT_DIM
    this.scoreEn = this.scoreText(so, "Score.en", SMALL_EM_CM, -x, x, HorizontalAlignment.Left)
    const number = this.scoreText(so, "Score.number", SCORE_EM_CM, -x, x, HorizontalAlignment.Right)
    number.getSceneObject().getTransform().setLocalPosition(new vec3(x, 0, ROW_Z))
    this.scoreNumber = new TabularText(number, "0000", SCORE_EM_CM, 1) // four cells: the score runs 0–1000
  }

  private scoreText(parent: SceneObject, name: string, emCm: number, left: number, right: number, align: HorizontalAlignment): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, ROW_Z))
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
    this.scoreItem.marginTop = shown ? SCORE_ROW_GAP : 0
    const l = lines("result.score", {"{score}": ""})
    const strip = (s: string): string => s.replace(/[:：]\s*$/, "").trim()
    setLinePair(this.scoreId, this.scoreEn, shown ? {primary: strip(l.primary), secondary: strip(l.secondary)} : {primary: "", secondary: ""})
    this.scoreNumber.set(shown ? "" + score : "")
    this.scoreNumber.setFont(latinFont())
  }

  private styleText(t: Text, size: number, wrap: boolean): void {
    t.size = size
    ;(t as Text & {weight?: number}).weight = 700
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

/** A Strings.ts entry with its placeholder filled in. */
function fill(key: StringKey, placeholder: string, value: string): Lines {
  return lines(key, {[placeholder]: value})
}
