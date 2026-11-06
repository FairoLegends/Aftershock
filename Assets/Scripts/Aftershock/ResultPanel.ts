import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {anchorInFront, faceHead, PanelFollow} from "./PanelFollow"
import {ScoreBreakdown} from "./ScoreCalculator"
import {getLanguage, latinFont, Lines, lines, onLanguageChanged, setLinePair, setLineText, StringKey} from "./Strings"
import {
  createRoundRect,
  drawOnTopWhenReady,
  GLASS_GREEN,
  GLASS_INSET,
  GLASS_PANEL,
  PinchGuard,
  SOFT_DIM,
  SOFT_GREEN,
  SOFT_GREEN_TEXT,
  SOFT_INNER_RADIUS_CM,
  SoftButton,
  SoftFrame,
  TabularText,
  tinted
} from "./UiBacking"

// Panel text at the HUD scale (ENGINEERING_PLAN 5i item 4): em heights in cm,
// Text.size = em (cm) x SIZE_PER_CM, as in Hud.ts.
const SIZE_PER_CM = 43.886
const SMALL_EM_CM = 2 // detail rows
const LINE_H_PER_EM = 1.25 // one line's slot; measured wrap advance of the panel font is 1.25 em

// Panel layout (cm). Not drill tunables: they only shape the panel.
// Slice 7A-soft (mockup .score, .stats): title, a rounded score row, detail
// rows (label left dimmed, value right bold, thin rule between), then a row
// of two buttons: Change language (secondary) and Restart (primary).
const INNER_W = 40 // Slice 5L: widened from 32 for the longest German line (over.why.stood); longer lines wrap
const PAD = 2.5
const HIDDEN_H = 0.001 // an unused line collapses to this
const DETAIL_LINES = 17 // Slice 8B: four base rows (speed, health, grip, evac) plus aftershock, level and reveal; Slice 8D: new best and best; Slice 14B: three compare rows and up to five repair lines
// Slice 17 (plan 17): the first result and the first game over are compact:
// COMPACT_W of content and COMPACT_PAD around it (backing 33 cm wide, was 45).
// Slice 18 (plan 19a): the second result is as wide (it was INNER_W and PAD).
// The detail rows, the score row and the cards show only on a first result.
const COMPACT_W = 29 // Slice 17 (plan 17): content width of the first result (40 → 29); Slice 18 (plan 19): and of the second
const COMPACT_PAD = 2 // Slice 17 (plan 17): its padding (2.5 → 2)
const TITLE_EM_CM = 3 // Slice 17 (plan 17): the first result's title (3.5 → 3); Slice 18 (plan 19): the second's too (was 3.5)
const ROW_EM_CM = 1.8 // Slice 17 (plan 17): the detail rows (SMALL_EM_CM 2 → 1.8; the compare rows keep SMALL_EM_CM)
const COMPACT_BUTTON_GAP = 1 // Slice 17 (plan 17): above each button row on the first result (BUTTON_GAP 1.6 → 1); Slice 18 (plan 19): on the second too
const DETAIL_PAD = 0.25 // above and below a detail row's text (Slice 9B: 0.5 → 0.35, room for the cards); Slice 17 (plan 17): 0.35 → 0.25
const DETAIL_GAP = 0.6 // above the first detail row; Slice 17 (plan 17): 1.0 → 0.6
const VALUE_W = 7 // detail value column, right; Slice 17 (plan 17): 12 → 7 ("12.3 s" at 1.8 cm em is about 6.3 cm)
const RULE_H = 0.1
const RULE_COLOR = new vec4(1, 1, 1, 0.14)
const SCORE_ROW_H = 5.5 // Slice 17 (plan 17): 6 → 5.5 (the number stays SCORE_EM_CM)
const SCORE_ROW_FILL = new vec4(1, 1, 1, 0.08)
const SCORE_ROW_GAP = 0.8 // above the score row; Slice 17 (plan 17): 1.2 → 0.8
const SCORE_EM_CM = 4 // the number, right
const SCORE_LABEL_EM_CM = 2.5 // "Skor", left
const SCORE_INSET = 1.4 // text inset from the row's ends
const BUTTON_GAP = 1.6 // above the button row
// DESIGN_BRIEF §5: buttons at least 12 x 5 cm; Slice 10B: 14 → 17 so "Change language" fits at 2 cm em.
// Slice 17 (plan 17): 17 → 13, two and BUTTON_ROW_GAP fit COMPACT_W (28 cm); longer labels shrink.
// One size on both results: SoftButton is built once at its size.
const BUTTON_W = 13
const BUTTON_H = 5
const BUTTON_ROW_GAP = 2 // Slice 10B: between Change language (left) and Restart (right); Slice 17 (plan 17): 3 → 2
const BUTTON_X = BUTTON_W / 2 + BUTTON_ROW_GAP / 2 // each button's center, either side of the panel's
const BUTTON_EM_CM = 2
const BUTTON_LABEL_Z = 0.08 // lifts the label off the button face
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)
const ROW_Z = 0.05 // row text above the score row's backing
// Slice 9B (F4, EDUCATION_CARDS.md): up to two soft education cards under the
// rows, each a faint green rounded row with a thin green bar on the left.
const CARD_SLOTS = 2
const CARD_SHOWN = 1 // Slice 17 (plan 17): one card on the first result (cards[0]); the second slot stays collapsed
const CARD_EM_CM = 1.8 // Slice 17 (plan 17): 2 → 1.8
const CARD_MAX_LINES = 3 // a longer text shrinks to fit three lines
const CARD_PAD_Y = 0.5 // above and below the card text; Slice 17 (plan 17): 0.7 → 0.5
const CARD_GAP = 0.6 // above the first card; Slice 17 (plan 17): 1.0 → 0.6
const CARD_GAP_NEXT = 0.6 // between the cards
const CARD_TEXT_LEFT = 1.8 // text inset from the card's left edge, clear of the bar
const CARD_TEXT_RIGHT = 1.0
const CARD_FILL = new vec4(SOFT_GREEN.x, SOFT_GREEN.y, SOFT_GREEN.z, 0.16)
const CARD_BAR_W = 0.4
const CARD_BAR_INSET = 0.7 // bar from the card's left edge
const CARD_BAR_PAD_Y = 0.6 // bar ends inside the card's top and bottom
const CARD_BAR_Z = 0.02 // bar above the card face
// Slice 9B: the whole panel stays within ±FIT_HALF_ANGLE_DEG of eye level at
// its distance: it moves up from `below` first and shrinks only if still too tall.
const FIT_HALF_ANGLE_DEG = 18
// Slice 15A (5m item 15a, S1 R1; Glass UI screen 08, option S1): the second
// result after a repeat. Under the title, in place of the score row, the
// detail rows and the cards: a headline with a bar (n of m falls prevented),
// a small compare table and one checklist card. The first result is unchanged.
// Slice 18 (plan 19a): all of it at COMPACT_W, the headline and the checklist
// one step smaller and the bar column and compare columns narrower.
// Slice 18b (plan 19 a2): the because line and the checklist title one step smaller too.
const HERO_GAP = 1.2 // above the headline (as SCORE_ROW_GAP)
const HERO_EM_CM = 2.4 // "2 dari 3 benda jatuh tercegah": between the title (3) and the rows (2); Slice 18 (plan 19): 2.8 → 2.4
const BECAUSE_EM_CM = 1.6 // "karena rak sudah kamu ikat", dimmed, under it; Slice 18b (plan 19 a2): 1.8 → 1.6 (second result only)
const BECAUSE_GAP = 0.4 // between the two
const BAR_COL_W = 6.5 // the bar and its "n/m", right of the headline (the mockup's ring is 7.6 cm); Slice 18 (plan 19): 8 → 6.5
const BAR_COL_GAP = 1.5 // headline text to the bar column
const BAR_H = 1.2
const BAR_TRACK = new vec4(1, 1, 1, 0.22) // the unfilled part: light, never dark
const BAR_COUNT_EM_CM = 2.4 // "2/3", above the bar
const BAR_COUNT_GAP = 0.5 // between "n/m" and the bar
const LAYER_Z = 0.02 // a bar fill or a check above the shape under it
const CMP_ROWS = 3 // fell, hit, score
const CMP_GAP = 1.2 // above the compare table
const CMP_PAD = 0.35 // above and below a row's text (as DETAIL_PAD)
const CMP_BEFORE_W = 5 // "before", right-aligned against the arrow ("1000" at 2 cm em is about 4.7 cm in Manrope's advances); Slice 18 (plan 19): 6 → 5
const CMP_ARROW_W = 3 // "→"
const CMP_AFTER_W = 5 // "after", left-aligned, green when better; Slice 18 (plan 19): 6 → 5
const LIST_ROWS = 4 // up to the three FIXABLE items, then "Simpan benda berat di bawah"
const LIST_GAP = 1.2 // above the checklist card
const LIST_PAD_X = 1.5 // inside the card (mockup .repair padding 1.2 / 1.5)
const LIST_PAD_Y = 1.2
const LIST_TITLE_EM_CM = 1.8 // "Untuk kamarmu malam ini", left; Slice 18b (plan 19 a2): 2 → 1.8 (second result only)
const LIST_SOURCE_EM_CM = 1.5 // "Sumber: BMKG", right, dimmed
const LIST_HEAD_COL_GAP = 1 // between the title and the source
const LIST_HEAD_GAP = 0.8 // header to the first row
const LIST_ROW_GAP = 0.55 // between rows
const LIST_EM_CM = 1.6 // a row's text; Slice 18 (plan 19): 1.8 → 1.6
const LIST_REASON_EM_CM = 1.35 // its reason, dimmed, under it; Slice 18 (plan 19): 1.5 → 1.35 (no panel text below it)
const BOX_CM = 2 // the check box (mockup 2.1 cm, radius 0.6)
const BOX_RADIUS = 0.5
const BOX_BORDER_CM = 0.22 // an open box: a green outline only
const BOX_TEXT_GAP = 1.2 // box to text
const BOX_OPEN = new vec4(SOFT_GREEN.x, SOFT_GREEN.y, SOFT_GREEN.z, 0) // no fill
// The check is drawn, not a glyph (Manrope has no ✓): an L, a long stroke on
// the right and a short one along the bottom, turned 45° clockwise, dark on
// the green box (as the dark label on the green button).
const CHECK_LONG = 1.1
const CHECK_SHORT = 0.55
const CHECK_STROKE = 0.28
const CHECK_UP = 0.1 // the turned L spans -0.53..0.33 cm (rounded ends): this centers it in the box

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

/** Slice 9B: one education card slot; `key` is null when the slot is collapsed. */
interface Card {
  item: FlexItem
  frame: SoftFrame
  bar: ReturnType<typeof createRoundRect>
  text: Text
  key: StringKey | null
}

/** Where placeInFront put the panel, kept so a new layout height can re-fit it. */
interface Placement {
  head: vec3
  flat: vec3
  distance: number
  below: number
}

/** Slice 15A: one compare table row; `text` is the full line (label: before → after), `better` greens `after`. */
export interface CompareRow {
  text: Lines
  before: string
  after: string
  better: boolean
}

/** Slice 15A: one checklist row, `checked` when the item was fastened and tried in the drill. */
export interface RepairRow {
  text: Lines
  reason: Lines | null
  checked: boolean
}

/** Slice 15A (S1 R1): what the second result shows in place of the score row, the detail rows and the cards. */
export interface SecondResult {
  headline: Lines // compare.prevented, or compare.notPrevented with no bar
  because: Lines | null // compare.because
  prevented: number // n: the bar fills n / of; 0 hides it
  of: number // m: landed in the drill before the repeat
  compare: CompareRow[]
  title: Lines // repair.title
  rows: RepairRow[]
  source: Lines // repair.source
}

/** Slice 15A (DC28): a box in the panel's plane, in world cm from the panel's center (x right, y up). */
export interface PlaneBox {
  name: string
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type Shape = ReturnType<typeof createRoundRect>

/** Slice 15A: one compare table row: label (dimmed), before, arrow, after. */
interface CompareView {
  so: SceneObject
  item: FlexItem
  label: Text
  before: Text
  arrow: Text
  after: Text
  rule: SceneObject | null
}

/** Slice 15A: one checklist row: a box (checked or open), its text and reason. */
interface ListRowView {
  so: SceneObject
  box: SoftFrame
  check: SceneObject
  strokes: {so: SceneObject; w: number; h: number}[]
  text: Text
  reason: Text
}

/**
 * Result and game-over panel (TDD §3.1, §7, R12, R13): a title, the score,
 * up to two detail rows, a Restart button and (Slice 10B, 5l item 6) a
 * Change language button beside it. Text comes from Strings.ts only. It owns
 * no drill state: DrillController fills it and listens to onRestart and
 * onChangeLanguage.
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
  textOutlineSize: number = 0.28
  @ui.group_end

  private readonly restartEvent = new Event()
  /** Raised when Restart is pressed (pinch or click). */
  readonly onRestart: PublicApi<void> = this.restartEvent.publicApi()
  private readonly changeLanguageEvent = new Event()
  /** Slice 10B: raised when Change language is pressed (pinch or click). */
  readonly onChangeLanguage: PublicApi<void> = this.changeLanguageEvent.publicApi()
  private readonly replayEvent = new Event()
  /** Slice 13B: raised when Lihat ulang (watch again) is pressed. */
  readonly onReplay: PublicApi<void> = this.replayEvent.publicApi()
  private readonly fixRoomEvent = new Event()
  /** Slice 14B: Perbaiki kamar pressed. */
  readonly onFixRoom: PublicApi<void> = this.fixRoomEvent.publicApi()
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
  private changeLang: SoftButton | null = null
  private replay: SoftButton | null = null
  private fixRoom: SoftButton | null = null // Slice 14B
  private replayObject: SceneObject | null = null
  private fixRoomObject: SceneObject | null = null
  private fixTexts: Text[] = [] // the Perbaiki kamar label lines, left out of texts while it is hidden
  private greenTexts: Text[] = [] // Slice 15C: the Ulangi label lines, dark on the green button
  private second: SecondResult | null = null // Slice 15A: set after a repeat, null on a first drill
  private backing: SoftFrame
  private hero: SceneObject // Slice 15A: the headline, the line under it and the bar
  private heroItem: FlexItem
  private headlineText: Text
  private becauseText: Text
  private barCount: Text
  private bar: SceneObject
  private barTrack: Shape
  private barFillObject: SceneObject
  private barFill: Shape
  private compareViews: CompareView[] = []
  private list: SceneObject // Slice 15A: the checklist card
  private listItem: FlexItem
  private listFrame: SoftFrame
  private listTitle: Text
  private listSource: Text
  private listRows: ListRowView[] = []
  private cards: Card[] = []
  private placement: Placement | null = null
  private panelH = 0 // the last layout's height (local units)
  private fitScale = 1
  private baseScale = vec3.one()
  // Slice 13C: the panel follows the head past a dead zone (ENGINEERING_PLAN 5m item 13).
  private readonly follow = new PanelFollow()
  private fitBelow = 0 // the fitted `below` applyPlacement last used
  private config: DrillConfig | null = null
  private headPose: HeadPose | null = null
  private flex: FlexLayout // Slice 17 (plan 17): its width follows the mode
  private items: FlexItem[] = [] // every top-level item, as wide as the content
  private buttonItems: FlexItem[] = [] // the two button rows
  private innerW = COMPACT_W // the content width now laid out

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.baseScale = this.sceneObject.getTransform().getLocalScale()

    // Glass tier 1 (15B); the input alpha keeps the 8A P1 readability over furniture.
    const backing = new SoftFrame(this.sceneObject, GLASS_PANEL)
    backing.setTierAlpha(this.backingColor.w)
    this.backing = backing

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    this.flex = flex
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 0 // gaps are margins, so collapsed rows leave none
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
      this.panelH = r.containerHeight
      this.applyPlacement() // Slice 9B: a taller panel (cards) moves up to stay in view
    })

    this.title = this.addRow(content, "Title", false)
    this.addScoreRow(content)
    this.addHero(content) // Slice 15A: collapsed on a first result, as the items below
    for (let i = 0; i < CMP_ROWS; i++) {
      this.compareViews.push(this.addCompareRow(content, "Compare" + (i + 1), i > 0))
    }
    for (let i = 0; i < DETAIL_LINES; i++) {
      this.details.push(this.addRow(content, "Line" + (i + 1), i > 0))
    }
    for (let i = 0; i < CARD_SLOTS; i++) {
      this.cards.push(this.addCard(content, "Card" + (i + 1))) // before the buttons: the Restart label stays last in texts
    }
    this.addList(content) // Slice 15A: before the buttons too
    this.addReplayRow(content) // 13B: above the Restart row, so the Restart label stays last in texts
    this.addButtonRow(content)
    this.setWidth(false)
    this.setRow(this.title, null, TITLE_EM_CM)
    for (const row of this.details) {
      this.setRow(row, null, ROW_EM_CM)
    }
    this.setScore(null)
    this.setCards([])
    this.layoutSecond()
  }

  /**
   * Slice 13C: gives the panel the head and the follow tunables, so it eases
   * back in front of the head once the user turns or walks past the dead zone.
   * DrillController calls it once. The tick runs only while the panel is shown
   * (component events are off on a disabled SceneObject).
   */
  setFollow(config: DrillConfig, headPose: HeadPose): void {
    this.config = config
    this.headPose = headPose
    const tick = this.createEvent("UpdateEvent")
    tick.bind(() => this.followTick())
  }

  /**
   * Places the panel `distance` cm in front of the head along its level look
   * direction and `below` cm under eye level, facing the head. Slice 9B: kept,
   * so each new layout height re-fits it (applyPlacement). Slice 13C: this
   * first placement snaps, and arms the dead zone where the head stands.
   */
  placeInFront(headPosition: vec3, headForward: vec3, distance: number, below: number): void {
    let flat = new vec3(headForward.x, 0, headForward.z)
    flat = flat.length > 0.0001 ? flat.normalize() : new vec3(0, 0, -1)
    this.placement = {head: headPosition, flat, distance, below}
    this.follow.reset()
    this.applyPlacement()
  }

  /**
   * Slice 9B: the panel center goes `below` under eye level, moved up just
   * enough that the bottom edge stays within ±FIT_HALF_ANGLE_DEG; a panel too
   * tall even centered on eye level shrinks to fit. Slice 13C: once placed, a
   * re-fit only shifts it vertically, leaving the follow where it is.
   */
  private applyPlacement(): void {
    const p = this.placement
    if (!p) return
    const t = this.sceneObject.getTransform()
    const unit = t.getWorldScale().y / this.fitScale // world cm per layout unit at full size
    const height = this.panelH * unit
    const maxHalf = p.distance * Math.tan((FIT_HALF_ANGLE_DEG * Math.PI) / 180)
    this.fitScale = height > maxHalf * 2 ? (maxHalf * 2) / height : 1
    const half = (height * this.fitScale) / 2
    const below = Math.max(half - maxHalf, Math.min(maxHalf - half, p.below))
    t.setLocalScale(this.baseScale.uniformScale(this.fitScale))
    const was = this.fitBelow
    this.fitBelow = below
    if (!this.follow.isPlaced) {
      const at = p.head.add(p.flat.uniformScale(p.distance)).add(new vec3(0, -below, 0))
      t.setWorldPosition(this.follow.snap(at, p.head))
      t.setWorldRotation(faceHead(at, p.head))
    } else if (Math.abs(was - below) > 1e-4) {
      t.setWorldPosition(this.follow.shiftY(was - below))
    }
  }

  /** Slice 13C: one follow step toward the spot in front of the head. */
  private followTick(): void {
    const p = this.placement
    const cfg = this.config
    const hp = this.headPose
    if (!p || !cfg || !hp || !this.follow.isPlaced) return
    // A pinch held on one of the panel's own buttons freezes it: the button
    // must not slide (or rotate) out from under the finger.
    if (this.isPinchHeld) return
    const head = hp.position
    const forward = hp.forward
    const anchor = anchorInFront(head, forward, p.distance, this.fitBelow)
    if (!anchor) return // looking straight up or down: nothing to aim at
    const at = this.follow.step(head, forward, anchor, getDeltaTime(), {deg: cfg.panelFollowDeg, cm: cfg.panelFollowCm, speed: cfg.panelFollowSpeed}, false)
    const t = this.sceneObject.getTransform()
    t.setWorldPosition(at)
    t.setWorldRotation(faceHead(at, head))
  }

  /** Slice 13C: a pinch is down on Restart, Change language or Lihat ulang (the follow is frozen). */
  get isPinchHeld(): boolean {
    return (this.restart !== null && this.restart.isPressed) || (this.changeLang !== null && this.changeLang.isPressed) || (this.replay !== null && this.replay.isPressed) || (this.fixRoom !== null && this.fixRoom.isPressed)
  }

  /**
   * Drill complete: time to take cover, health left and score (TDD §7).
   * Never took cover (tSafe null): result.never and score 0 (Q6).
   * Slice 17 (plan 17): the first result is compact: the score, ROW_COUNT
   * rows (speed or never, health, grip) and CARD_SHOWN card; `extra` is not
   * shown (DrillController still stores the best).
   */
  showResult(b: ScoreBreakdown, extra: ResultLine[] = [], cards: StringKey[] = []): void {
    this._mode = "result"
    this.sceneObject.enabled = true // measure the rows in the real font
    const second = this.second !== null
    this.setWidth(false) // Slice 18 (plan 19a): both results at COMPACT_W
    this.setRow(this.title, lines("result.title"), TITLE_EM_CM)
    this.setScore(second ? null : b.score) // Slice 15A: the second result's score is in the compare table
    if (second) {
      this.setDetails([]) // Slice 15A: the headline, table and checklist take the rows' place
    } else {
      this.setDetails([
        {text: b.tSafe === null ? lines("result.never") : fill("result.speed", "{s}", b.tSafe.toFixed(1)), split: true},
        {text: fill("result.health", "{h}", "" + Math.round(b.healthLeft)), split: true},
        {text: fill("result.grip", "{p}", "" + Math.round(b.holdShare * 100)), split: true}
      ])
    }
    this.setCards(second ? [] : cards)
    this.layoutSecond()
    this.showPanel()
  }

  /** Out of health: what went wrong (hit.fell, over.why.grip, over.why.stood or over.why.danger, 5j-19b, 5l-4f), no score (TDD §7). Slice 17 (plan 17): the reason row and CARD_SHOWN card only. */
  showGameOver(reason: StringKey, extra: ResultLine[] = [], cards: StringKey[] = []): void {
    this._mode = "gameOver"
    this.sceneObject.enabled = true
    const second = this.second !== null // Slice 15A: as showResult
    this.setWidth(false) // Slice 18 (plan 19a): as showResult
    this.setRow(this.title, lines("over.title"), TITLE_EM_CM)
    this.setScore(null)
    this.setDetails(second ? [] : [{text: lines(reason), split: true}])
    this.setCards(second ? [] : cards)
    this.layoutSecond()
    this.showPanel()
  }

  /** Slice 17 (plan 17): the first result at COMPACT_W, the second at INNER_W. Slice 18 (plan 19a): both pass false. */
  private setWidth(wide: boolean): void {
    const pad = wide ? PAD : COMPACT_PAD
    this.innerW = wide ? INNER_W : COMPACT_W
    this.flex.width = this.innerW + pad * 2
    this.flex.paddingTop = pad
    this.flex.paddingBottom = pad
    this.flex.paddingLeft = pad
    this.flex.paddingRight = pad
    for (const item of this.items) {
      item.overrideWidth = this.innerW
    }
    for (const item of this.buttonItems) {
      item.marginTop = wide ? BUTTON_GAP : COMPACT_BUTTON_GAP
    }
  }

  /**
   * Slice 9B education cards (F4): one soft card per key (EducationCards.pickCards,
   * at most CARD_SLOTS) under the rows, in the selected language, wrapped to
   * the card and shrunk past CARD_MAX_LINES; the rest collapse. Slice 17
   * (plan 17): only the first CARD_SHOWN keys; the cards show only on a
   * first result, so they are COMPACT_W wide.
   */
  private setCards(keys: StringKey[]): void {
    const lineH = CARD_EM_CM * LINE_H_PER_EM
    const left = -COMPACT_W / 2 + CARD_TEXT_LEFT
    const right = COMPACT_W / 2 - CARD_TEXT_RIGHT
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      const key = i < keys.length && i < CARD_SHOWN ? keys[i] : null
      card.key = key
      card.frame.face.enabled = key !== null
      setLineText(card.text, key !== null ? lines(key).primary : "", getLanguage())
      card.text.verticalOverflow = VerticalOverflow.Overflow
      card.text.layoutRect = Rect.create(left, right, -lineH / 2, lineH / 2)
      if (key === null) {
        card.item.overrideHeight = HIDDEN_H
        card.item.marginTop = 0
        continue
      }
      // As setRow: one getBoundingBox call gives the wrapped line count.
      let n = 1
      if (card.text.getSceneObject().isEnabledInHierarchy) {
        const box = card.text.getBoundingBox()
        n = Math.max(1, Math.round((box.top - box.bottom) / lineH))
      }
      if (n > CARD_MAX_LINES) {
        n = CARD_MAX_LINES
        card.text.verticalOverflow = VerticalOverflow.Shrink
      }
      const h = n * lineH
      card.text.layoutRect = Rect.create(left, right, -h / 2, h / 2)
      const cardH = h + CARD_PAD_Y * 2
      card.frame.setSize(COMPACT_W, cardH)
      const barH = Math.max(CARD_BAR_W, cardH - CARD_BAR_PAD_Y * 2)
      card.bar.size = new vec2(CARD_BAR_W, barH)
      card.bar.cornerRadius = CARD_BAR_W / 2
      card.item.overrideHeight = cardH
      card.item.marginTop = i === 0 ? CARD_GAP : CARD_GAP_NEXT
    }
  }

  /** Fills the detail rows with `rows` and collapses the rest. */
  private setDetails(rows: ResultLine[]): void {
    for (let i = 0; i < this.details.length; i++) {
      const l = i < rows.length ? rows[i] : null
      this.setRow(this.details[i], l ? l.text : null, ROW_EM_CM, l ? l.split : true)
    }
  }

  private showPanel(): void {
    this.sceneObject.enabled = true
    if (this.restart) this.restart.reset()
    if (this.changeLang) this.changeLang.reset()
    if (this.replay) this.replay.reset()
    if (this.fixRoom) this.fixRoom.reset()
    drawOnTopWhenReady(this, this.sceneObject) // 5j-19f: again once the layout settles
    this.pinchGuard.arm()
  }

  /** Slice 13B: hidden while the ghost replay plays; mode and cards stay. */
  hideForReplay(): void {
    this.sceneObject.enabled = false
  }

  /** Slice 13B: back after the replay, as it was. */
  showAgain(): void {
    if (this._mode !== null) this.showPanel()
  }

  hide(): void {
    this._mode = null
    this.setCards([])
    this.second = null
    this.layoutSecond()
    this.sceneObject.enabled = false
  }

  /**
   * Slice 14B (5m item 15), Slice 15A (S1 R1): the next showResult or
   * showGameOver after a repeat shows `second` (headline, compare table,
   * checklist) in place of the score row, the detail rows and the cards.
   * Null on a first drill: the panel as before.
   */
  setComparison(second: SecondResult | null): void {
    this.second = second
  }

  /** Slice 14B: Perbaiki kamar right of Lihat ulang (same size, as the row below), or Lihat ulang alone, centered. */
  setFixShown(on: boolean): void {
    if (!this.replayObject || !this.fixRoomObject) return
    this.replayObject.getTransform().setLocalPosition(new vec3(on ? -BUTTON_X : 0, 0, 0))
    this.fixRoomObject.enabled = on
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }
  /** Slice 13C: easing toward the head (outside the dead zone, not yet settled). */
  get isFollowing(): boolean {
    return this.follow.isMoving
  }
  /** Slice 13C: the fitted cm below eye level the follow anchor uses. */
  get followBelow(): number {
    return this.fitBelow
  }
  /** What the panel shows, or null when hidden. */
  get mode(): ResultMode | null {
    return this._mode
  }
  /** Every non-empty text line the panel shows, in order (button label last). */
  get texts(): string[] {
    return this.shownTexts
      .filter((t) => this.fixRoomShown || this.fixTexts.indexOf(t) < 0)
      .map((t) => t.text)
      .filter((s) => s.length > 0)
  }
  /** Slice 14B: Perbaiki kamar is on the panel. */
  get fixRoomShown(): boolean {
    return this.fixRoomObject !== null && this.fixRoomObject.enabled
  }
  /**
   * Slice 14B: the compare rows (label: a → b, full lines) and, Slice 15A,
   * the checklist (title, each row's text, source) shown, selected language
   * ([] on a first drill).
   */
  get compareLines(): string[] {
    return this.second ? this.second.compare.map((r) => r.text.primary) : []
  }
  get repairLines(): string[] {
    const s = this.second
    return s ? [s.title.primary].concat(s.rows.map((r) => r.text.primary), [s.source.primary]) : []
  }
  /** Slice 15A: the headline and the line under it as shown ("" when none). */
  get headline(): string {
    return this.headlineText.text
  }
  get becauseLine(): string {
    return this.becauseText.text
  }
  /** Slice 15A: the bar is shown; its fill share (fill width over the track's, 0 when hidden) and its "n/m". */
  get barShown(): boolean {
    return this.second !== null && this.bar.enabled
  }
  get preventedFill(): number {
    return this.barShown ? this.barFill.size.x / this.barTrack.size.x : 0
  }
  get barText(): string {
    return this.barCount.text
  }
  /** Slice 15A: the compare table's "after" values as shown, and which are green. */
  get compareAfter(): string[] {
    return this.compareViews.filter((v) => v.after.text.length > 0).map((v) => v.after.text)
  }
  get compareGreen(): boolean[] {
    return this.compareViews.filter((v) => v.after.text.length > 0).map((v) => v.after.textFill.color.equal(SOFT_GREEN))
  }
  /** Slice 15A: per checklist row shown, true when its box is checked. */
  get repairChecked(): boolean[] {
    return this.listRows.filter((r) => r.so.enabled).map((r) => r.check.enabled)
  }
  /** Slice 15A: the checklist rows' reasons as shown ("" for none). */
  get repairReasons(): string[] {
    return this.listRows.filter((r) => r.so.enabled).map((r) => r.reason.text)
  }
  /** Slice 15A: the detail rows shown (0 on the second result). */
  get shownDetailRows(): number {
    return this.details.filter((r) => r.id.text.length > 0).length
  }
  /** Slice 15A (DC28 d): the panel backing, in its own plane. */
  get backingBox(): PlaneBox {
    const w = this.backing.width
    const h = this.backing.height
    return this.planeBox("backing", this.backing.face, -w / 2, w / 2, -h / 2, h / 2)
  }
  /** Slice 15A (DC28 d): every shape and non-empty text of the headline, the table and the checklist shown. */
  get secondBoxes(): PlaneBox[] {
    const out: PlaneBox[] = []
    if (!this.second || !this.isShown) return out
    const texts = [this.headlineText, this.becauseText, this.barCount, this.listTitle, this.listSource]
    for (const v of this.compareViews) {
      if (v.after.text.length > 0) texts.push(v.label, v.before, v.arrow, v.after)
    }
    for (const r of this.listRows) {
      if (r.so.enabled) texts.push(r.text, r.reason)
    }
    for (const t of texts) {
      const b = this.textBox(t)
      if (b) out.push(b)
    }
    if (this.barShown) {
      out.push(this.shapeBox("bar.track", this.bar, this.barTrack))
      out.push(this.shapeBox("bar.fill", this.barFillObject, this.barFill))
    }
    out.push(this.shapeBox("list.card", this.listFrame.face, this.listFrame.backing))
    for (const r of this.listRows) {
      if (r.so.enabled) out.push(this.rowShapes(r))
    }
    return out
  }
  /** Slice 15A (DC28 d): each checklist row shown, its box, text and reason together. */
  get listRowBoxes(): PlaneBox[] {
    return this.listRows
      .filter((r) => r.so.enabled)
      .map((r) => {
        const parts = [this.rowShapes(r), this.textBox(r.text), this.textBox(r.reason)].filter((b) => b !== null) as PlaneBox[]
        return union(r.so.name, parts)
      })
  }
  /** Slice 9B: the education card keys shown, in order ([] when none). */
  get shownCards(): StringKey[] {
    return this.cards.filter((c) => c.key !== null).map((c) => c.key as StringKey)
  }
  /** Slice 15C (DC23): every non-empty text shown on the panel and its fill; `onGreen` marks the dark text on the green button. */
  get shownTextFills(): {name: string; color: vec4; onGreen: boolean}[] {
    const out: {name: string; color: vec4; onGreen: boolean}[] = []
    const stack: SceneObject[] = [this.sceneObject]
    while (stack.length > 0) {
      const so = stack.pop()
      if (!so.isEnabledInHierarchy) continue
      for (const t of so.getComponents("Component.Text") as Text[]) {
        if (t.enabled && t.text.length > 0) out.push({name: so.name, color: t.textFill.color, onGreen: this.greenTexts.indexOf(t) >= 0})
      }
      for (let i = 0; i < so.getChildrenCount(); i++) {
        stack.push(so.getChild(i))
      }
    }
    return out
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
    const left = -this.innerW / 2 // Slice 17 (plan 17): the mode's width
    const right = m ? this.innerW / 2 - VALUE_W : this.innerW / 2
    row.id.layoutRect = Rect.create(left, right, -lineH / 2, lineH / 2)
    if (row.value) {
      setLineText(row.value, m ? m[2] : "", getLanguage())
      row.value.size = emCm * SIZE_PER_CM
      row.value.layoutRect = Rect.create(right, this.innerW / 2, -lineH / 2, lineH / 2)
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
    this.items.push(item) // Slice 17 (plan 17)
    const id = this.addText(so, name + ".id", SMALL_EM_CM, true)
    const en = this.addText(so, name + ".en", SMALL_EM_CM, true)
    let value: Text | null = null
    let rule: SceneObject | null = null
    if (name !== "Title") {
      value = this.addText(so, name + ".value", ROW_EM_CM, false)
      value.horizontalAlignment = HorizontalAlignment.Right
      const h = ROW_EM_CM * LINE_H_PER_EM
      value.layoutRect = Rect.create(COMPACT_W / 2 - VALUE_W, COMPACT_W / 2, -h / 2, h / 2)
    }
    if (ruleAbove) {
      rule = global.scene.createSceneObject(name + ".rule")
      rule.setParent(so)
      createRoundRect(rule, RULE_COLOR, COMPACT_W, RULE_H, 0) // Slice 17 (plan 17): detail rows show only on a first result
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

  /** Slice 9B: a soft, lightly tinted card with a thin green bar on the left; its text left-aligned beside the bar. */
  private addCard(parent: SceneObject, name: string): Card {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = INNER_W
    item.overrideHeight = HIDDEN_H
    item.alignSelf = FlexAlignSelf.Center
    this.items.push(item) // Slice 17 (plan 17)
    const frame = new SoftFrame(so, tinted(GLASS_GREEN, CARD_FILL), SOFT_INNER_RADIUS_CM, null, name + ".backing")
    frame.setSize(COMPACT_W, 1)
    const barSo = global.scene.createSceneObject(name + ".bar")
    barSo.setParent(frame.face)
    barSo.getTransform().setLocalPosition(new vec3(-COMPACT_W / 2 + CARD_BAR_INSET + CARD_BAR_W / 2, 0, CARD_BAR_Z)) // Slice 17 (plan 17): cards show only on a first result
    const bar = createRoundRect(barSo, SOFT_GREEN, CARD_BAR_W, 1, CARD_BAR_W / 2)
    const text = this.addText(so, name + ".text", CARD_EM_CM, true)
    text.horizontalAlignment = HorizontalAlignment.Left
    return {item, frame, bar, text, key: null}
  }

  /** Slice 15A: the headline (wraps), the dimmed line under it and, right of both, "n/m" over a bar. */
  private addHero(parent: SceneObject): void {
    const so = global.scene.createSceneObject("Hero")
    so.setParent(parent)
    this.hero = so
    this.heroItem = this.addItem(so)
    this.headlineText = this.addText(so, "Hero.headline", HERO_EM_CM, true)
    this.becauseText = this.addText(so, "Hero.because", BECAUSE_EM_CM, true)
    this.becauseText.textFill.color = SOFT_DIM
    this.barCount = this.addText(so, "Hero.count", BAR_COUNT_EM_CM, false)
    this.bar = global.scene.createSceneObject("Hero.bar")
    this.bar.setParent(so)
    this.barTrack = createRoundRect(this.bar, BAR_TRACK, BAR_COL_W, BAR_H, BAR_H / 2)
    this.barFillObject = global.scene.createSceneObject("Hero.bar.fill")
    this.barFillObject.setParent(this.bar)
    this.barFill = createRoundRect(this.barFillObject, SOFT_GREEN, BAR_COL_W, BAR_H, BAR_H / 2)
  }

  /** Slice 15A: one compare table row: label (dimmed, left, wraps), before (right-aligned), "→", after. */
  private addCompareRow(parent: SceneObject, name: string, ruleAbove: boolean): CompareView {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const item = this.addItem(so)
    const label = this.addText(so, name + ".label", SMALL_EM_CM, true)
    label.textFill.color = SOFT_DIM
    label.horizontalAlignment = HorizontalAlignment.Left
    const before = this.addText(so, name + ".before", SMALL_EM_CM, false)
    before.horizontalAlignment = HorizontalAlignment.Right
    const arrow = this.addText(so, name + ".arrow", SMALL_EM_CM, false)
    arrow.textFill.color = SOFT_DIM
    const after = this.addText(so, name + ".after", SMALL_EM_CM, false)
    after.horizontalAlignment = HorizontalAlignment.Left
    let rule: SceneObject | null = null
    if (ruleAbove) {
      rule = global.scene.createSceneObject(name + ".rule")
      rule.setParent(so)
      createRoundRect(rule, RULE_COLOR, COMPACT_W, RULE_H, 0) // Slice 18 (plan 19a): the compare rows show only on a second result, at COMPACT_W
    }
    return {so, item, label, before, arrow, after, rule}
  }

  /** Slice 15A: the checklist, one card in the 9B card look (no bar): a header row, then LIST_ROWS row slots. */
  private addList(parent: SceneObject): void {
    const so = global.scene.createSceneObject("Checklist")
    so.setParent(parent)
    this.list = so
    this.listItem = this.addItem(so)
    this.listFrame = new SoftFrame(so, tinted(GLASS_GREEN, CARD_FILL), SOFT_INNER_RADIUS_CM, null, "Checklist.backing")
    this.listFrame.setSize(COMPACT_W, 1) // Slice 18 (plan 19a)
    this.listTitle = this.addText(so, "Checklist.title", LIST_TITLE_EM_CM, true)
    this.listTitle.horizontalAlignment = HorizontalAlignment.Left
    this.listSource = this.addText(so, "Checklist.source", LIST_SOURCE_EM_CM, false)
    this.listSource.horizontalAlignment = HorizontalAlignment.Right
    this.listSource.textFill.color = SOFT_DIM
    for (let i = 0; i < LIST_ROWS; i++) {
      this.listRows.push(this.addListRow(so, "Checklist.Row" + (i + 1)))
    }
  }

  /** Slice 15A: a checklist row: the box (with its drawn check) left, the text and the dimmed reason right of it. */
  private addListRow(parent: SceneObject, name: string): ListRowView {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const box = new SoftFrame(so, SOFT_GREEN, BOX_RADIUS, null, name + ".box")
    box.setSize(BOX_CM, BOX_CM)
    const check = global.scene.createSceneObject(name + ".check")
    check.setParent(box.face)
    check.getTransform().setLocalPosition(new vec3(0, CHECK_UP, LAYER_Z))
    check.getTransform().setLocalRotation(quat.angleAxis(-Math.PI / 4, vec3.forward()))
    const strokes = [
      this.addStroke(check, name + ".check.long", (CHECK_SHORT - CHECK_STROKE) / 2, 0, CHECK_STROKE, CHECK_LONG),
      this.addStroke(check, name + ".check.short", 0, (CHECK_STROKE - CHECK_LONG) / 2, CHECK_SHORT, CHECK_STROKE)
    ]
    const text = this.addText(so, name + ".text", LIST_EM_CM, true)
    text.horizontalAlignment = HorizontalAlignment.Left
    const reason = this.addText(so, name + ".reason", LIST_REASON_EM_CM, true)
    reason.horizontalAlignment = HorizontalAlignment.Left
    reason.textFill.color = SOFT_DIM
    return {so, box, check, strokes, text, reason}
  }

  private addStroke(parent: SceneObject, name: string, x: number, y: number, w: number, h: number): {so: SceneObject; w: number; h: number} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(x, y, 0))
    createRoundRect(so, SOFT_GREEN_TEXT, w, h, Math.min(w, h) / 2)
    return {so, w, h}
  }

  /** A collapsed full-width flex item on `so`. Never disable `so`: FlexLayout discovers only enabled children, once at OnStart. */
  private addItem(so: SceneObject): FlexItem {
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = INNER_W
    item.overrideHeight = HIDDEN_H
    item.alignSelf = FlexAlignSelf.Center
    this.items.push(item) // Slice 17 (plan 17)
    return item
  }

  /** Slice 15A: lays out the headline, the compare table and the checklist from `second`, or collapses them. */
  private layoutSecond(): void {
    const s = this.second
    this.layoutHero(s)
    for (let i = 0; i < this.compareViews.length; i++) {
      this.layoutCompareRow(this.compareViews[i], s && i < s.compare.length ? s.compare[i] : null, i === 0)
    }
    this.layoutList(s)
  }

  /** Slice 15A: the bar column right of the headline when n > 0; otherwise the headline alone, centered. */
  private layoutHero(s: SecondResult | null): void {
    const lang = getLanguage()
    const bar = s !== null && s.prevented > 0 && s.of > 0
    this.bar.enabled = bar
    setLineText(this.headlineText, s ? s.headline.primary : "", lang)
    setLineText(this.becauseText, s && bar && s.because ? s.because.primary : "", lang)
    setLineText(this.barCount, s && bar ? s.prevented + "/" + s.of : "", "en") // digits in Manrope, as the score
    if (!s) {
      this.heroItem.overrideHeight = HIDDEN_H
      this.heroItem.marginTop = 0
      return
    }
    const left = -this.innerW / 2 // Slice 18 (plan 19a): the mode's width
    const right = bar ? this.innerW / 2 - BAR_COL_W - BAR_COL_GAP : this.innerW / 2
    const align = bar ? HorizontalAlignment.Left : HorizontalAlignment.Center
    this.headlineText.horizontalAlignment = align
    this.becauseText.horizontalAlignment = align
    const headH = this.wrapLines(this.headlineText, left, right, HERO_EM_CM) * HERO_EM_CM * LINE_H_PER_EM
    const becauseH = this.wrapLines(this.becauseText, left, right, BECAUSE_EM_CM) * BECAUSE_EM_CM * LINE_H_PER_EM
    const textH = headH + (becauseH > 0 ? BECAUSE_GAP + becauseH : 0)
    const top = textH / 2
    this.headlineText.layoutRect = Rect.create(left, right, top - headH, top)
    const becauseTop = top - headH - BECAUSE_GAP
    this.becauseText.layoutRect = becauseH > 0 ? Rect.create(left, right, becauseTop - becauseH, becauseTop) : Rect.create(left, right, -HIDDEN_H / 2, HIDDEN_H / 2)
    const countH = BAR_COUNT_EM_CM * LINE_H_PER_EM
    const colH = countH + BAR_COUNT_GAP + BAR_H
    if (bar) {
      const x = this.innerW / 2 - BAR_COL_W / 2
      this.barCount.layoutRect = Rect.create(x - BAR_COL_W / 2, x + BAR_COL_W / 2, colH / 2 - countH, colH / 2)
      this.bar.getTransform().setLocalPosition(new vec3(x, BAR_H / 2 - colH / 2, 0))
      const w = BAR_COL_W * Math.min(1, s.prevented / s.of)
      this.barFill.size = new vec2(w, BAR_H)
      this.barFill.cornerRadius = Math.min(BAR_H / 2, w / 2)
      this.barFillObject.getTransform().setLocalPosition(new vec3(w / 2 - BAR_COL_W / 2, 0, LAYER_Z))
    }
    this.heroItem.overrideHeight = Math.max(textH, bar ? colH : 0)
    this.heroItem.marginTop = HERO_GAP
  }

  /** Slice 15A: label | before → after; after green when better (fewer falls or hits, a higher score). */
  private layoutCompareRow(v: CompareView, r: CompareRow | null, first: boolean): void {
    const lang = getLanguage()
    if (v.rule) v.rule.enabled = r !== null
    const m = r ? /^(.*?)\s*[:：]/.exec(r.text.primary) : null
    setLineText(v.label, r ? (m ? m[1] : r.text.primary) : "", lang)
    setLineText(v.before, r ? r.before : "", "en")
    setLineText(v.arrow, r ? "→" : "", lang) // in the line's font, as the 14B rows
    setLineText(v.after, r ? r.after : "", "en")
    if (!r) {
      v.item.overrideHeight = HIDDEN_H
      v.item.marginTop = 0
      return
    }
    v.after.textFill.color = r.better ? SOFT_GREEN : WHITE
    const xAfter = this.innerW / 2 - CMP_AFTER_W // Slice 18 (plan 19a): the mode's width
    const xArrow = xAfter - CMP_ARROW_W
    const xBefore = xArrow - CMP_BEFORE_W
    const lineH = SMALL_EM_CM * LINE_H_PER_EM
    const h = Math.max(1, this.wrapLines(v.label, -this.innerW / 2, xBefore, SMALL_EM_CM)) * lineH
    v.label.layoutRect = Rect.create(-this.innerW / 2, xBefore, -h / 2, h / 2)
    v.before.layoutRect = Rect.create(xBefore, xArrow, -lineH / 2, lineH / 2)
    v.arrow.layoutRect = Rect.create(xArrow, xAfter, -lineH / 2, lineH / 2)
    v.after.layoutRect = Rect.create(xAfter, this.innerW / 2, -lineH / 2, lineH / 2)
    v.item.overrideHeight = h + CMP_PAD * 2
    v.item.marginTop = first ? CMP_GAP : 0
    if (v.rule) {
      v.rule.getTransform().setLocalPosition(new vec3(0, h / 2 + CMP_PAD, 0))
    }
  }

  /**
   * Slice 15A: the checklist card. Header: the title (wraps) left, the source
   * on one line right. Each row: the box on the text's first line, the
   * reason under the text; rows LIST_ROW_GAP apart.
   */
  private layoutList(s: SecondResult | null): void {
    const lang = getLanguage()
    this.listFrame.face.enabled = s !== null
    setLineText(this.listTitle, s ? s.title.primary : "", lang)
    setLineText(this.listSource, s ? s.source.primary : "", lang)
    const rows = s ? s.rows.slice(0, this.listRows.length) : []
    for (let i = 0; i < this.listRows.length; i++) {
      const v = this.listRows[i]
      const r = i < rows.length ? rows[i] : null
      v.so.enabled = r !== null
      setLineText(v.text, r ? r.text.primary : "", lang)
      setLineText(v.reason, r && r.reason ? r.reason.primary : "", lang)
    }
    if (!s) {
      this.listItem.overrideHeight = HIDDEN_H
      this.listItem.marginTop = 0
      return
    }
    const left = -this.innerW / 2 + LIST_PAD_X // Slice 18 (plan 19a): the mode's width
    const right = this.innerW / 2 - LIST_PAD_X
    const sourceLineH = LIST_SOURCE_EM_CM * LINE_H_PER_EM
    this.listSource.layoutRect = Rect.create(left, right, -sourceLineH / 2, sourceLineH / 2)
    let sourceW = 0
    if (this.listSource.getSceneObject().isEnabledInHierarchy) {
      const b = this.listSource.getBoundingBox()
      sourceW = b.right - b.left
    }
    const titleRight = right - sourceW - LIST_HEAD_COL_GAP
    const titleLineH = LIST_TITLE_EM_CM * LINE_H_PER_EM
    const titleH = this.wrapLines(this.listTitle, left, titleRight, LIST_TITLE_EM_CM) * titleLineH
    const headH = Math.max(titleH, sourceLineH)
    const textLeft = left + BOX_CM + BOX_TEXT_GAP
    const lineH = LIST_EM_CM * LINE_H_PER_EM
    const reasonLineH = LIST_REASON_EM_CM * LINE_H_PER_EM
    const sizes = rows.map((r, i) => {
      const main = this.wrapLines(this.listRows[i].text, textLeft, right, LIST_EM_CM) * lineH
      const reason = this.wrapLines(this.listRows[i].reason, textLeft, right, LIST_REASON_EM_CM) * reasonLineH
      return {main, reason, h: Math.max(main + reason, lineH / 2 + BOX_CM / 2)}
    })
    const rowsH = sizes.reduce((a, z) => a + z.h, 0) + LIST_ROW_GAP * Math.max(0, rows.length - 1)
    const cardH = LIST_PAD_Y * 2 + headH + LIST_HEAD_GAP + rowsH
    const top = cardH / 2 - LIST_PAD_Y
    this.listTitle.layoutRect = Rect.create(left, titleRight, top - titleH, top)
    const sourceY = top - titleLineH / 2 // on the title's first line
    this.listSource.layoutRect = Rect.create(left, right, sourceY - sourceLineH / 2, sourceY + sourceLineH / 2)
    let y = top - headH - LIST_HEAD_GAP
    for (let i = 0; i < rows.length; i++) {
      const v = this.listRows[i]
      const z = sizes[i]
      v.so.getTransform().setLocalPosition(new vec3(0, y - z.h / 2, 0))
      const rowTop = z.h / 2
      v.text.layoutRect = Rect.create(textLeft, right, rowTop - z.main, rowTop)
      v.reason.layoutRect = z.reason > 0 ? Rect.create(textLeft, right, rowTop - z.main - z.reason, rowTop - z.main) : Rect.create(textLeft, right, -HIDDEN_H / 2, HIDDEN_H / 2)
      v.box.face.getTransform().setLocalPosition(new vec3(left + BOX_CM / 2, rowTop - lineH / 2, LAYER_Z))
      v.box.setFill(rows[i].checked ? SOFT_GREEN : BOX_OPEN)
      v.box.setBorder(rows[i].checked ? null : SOFT_GREEN, BOX_BORDER_CM)
      v.check.enabled = rows[i].checked
      y -= z.h + LIST_ROW_GAP
    }
    this.listFrame.setSize(this.innerW, cardH)
    this.listItem.overrideHeight = cardH
    this.listItem.marginTop = LIST_GAP
  }

  /** Lines `t` wraps to between `left` and `right` at `emCm`, 0 when empty (one getBoundingBox call, as setRow). */
  private wrapLines(t: Text, left: number, right: number, emCm: number): number {
    if (t.text.length === 0) return 0
    const lineH = emCm * LINE_H_PER_EM
    t.layoutRect = Rect.create(left, right, -lineH / 2, lineH / 2)
    if (!t.getSceneObject().isEnabledInHierarchy) return 1
    const box = t.getBoundingBox()
    return Math.max(1, Math.round((box.top - box.bottom) / lineH))
  }

  /** Slice 15A (DC28 d): a local rect of `so` in the panel's plane, world cm from the panel's center. */
  private planeBox(name: string, so: SceneObject, l: number, r: number, b: number, t: number): PlaneBox {
    const m = so.getTransform().getWorldTransform()
    const panel = this.sceneObject.getTransform()
    const o = panel.getWorldPosition()
    const ax = panel.right
    const ay = panel.up
    const box: PlaneBox = {name, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity}
    for (const [x, y] of [
      [l, b],
      [r, b],
      [l, t],
      [r, t]
    ]) {
      const p = m.multiplyPoint(new vec3(x, y, 0)).sub(o)
      box.minX = Math.min(box.minX, p.dot(ax))
      box.maxX = Math.max(box.maxX, p.dot(ax))
      box.minY = Math.min(box.minY, p.dot(ay))
      box.maxY = Math.max(box.maxY, p.dot(ay))
    }
    return box
  }

  private shapeBox(name: string, so: SceneObject, shape: Shape): PlaneBox {
    const s = shape.size
    return this.planeBox(name, so, -s.x / 2, s.x / 2, -s.y / 2, s.y / 2)
  }

  /** The glyphs' box of a shown, non-empty Text, or null. */
  private textBox(t: Text): PlaneBox | null {
    const so = t.getSceneObject()
    if (t.text.length === 0 || !so.isEnabledInHierarchy) return null
    const b = t.getBoundingBox()
    return this.planeBox(so.name, so, b.left, b.right, b.bottom, b.top)
  }

  /** A checklist row's box and, when checked, its two check strokes. */
  private rowShapes(r: ListRowView): PlaneBox {
    const parts = [this.shapeBox(r.so.name + ".box", r.box.face, r.box.backing)]
    if (r.check.enabled) {
      for (const s of r.strokes) parts.push(this.planeBox(s.so.name, s.so, -s.w / 2, s.w / 2, -s.h / 2, s.h / 2))
    }
    return union(r.so.name + ".shapes", parts)
  }

  /** Slice 13B (5m item 12): Lihat ulang on its own row above the two buttons, secondary style, centered. */
  private addReplayRow(parent: SceneObject): void {
    const row = global.scene.createSceneObject("ReplayRow")
    row.setParent(parent)
    const item = row.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.marginTop = BUTTON_GAP
    item.overrideWidth = INNER_W
    item.overrideHeight = BUTTON_H
    this.items.push(item) // Slice 17 (plan 17)
    this.buttonItems.push(item)
    this.replay = this.addButton(row, "Replay", 0, false, "btn.replay", () => {
      if (this.pinchGuard.open) this.replayEvent.invoke()
    })
    this.replayObject = row.getChild(0)
    // Slice 14B: Perbaiki kamar, secondary like Lihat ulang; shown only when an item made a problem.
    const n = this.shownTexts.length
    this.fixRoom = this.addButton(row, "FixRoom", BUTTON_X, false, "btn.fixRoom", () => {
      if (this.pinchGuard.open) this.fixRoomEvent.invoke()
    })
    this.fixRoomObject = row.getChild(1)
    this.fixTexts = this.shownTexts.slice(n)
    this.setFixShown(false)
  }

  /**
   * Slice 10B (5l item 6): one flex row, as wide as the text, holding two
   * buttons of the same size: Change language (secondary, left) and Restart
   * (primary green, right). The row is BUTTON_H tall like the old Restart
   * slot, so the panel height and its fit are unchanged.
   */
  private addButtonRow(parent: SceneObject): void {
    const row = global.scene.createSceneObject("Buttons")
    row.setParent(parent)
    const item = row.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    item.marginTop = BUTTON_GAP
    item.overrideWidth = INNER_W // a naked item: the row declares its size (scale stays 1)
    item.overrideHeight = BUTTON_H
    this.items.push(item) // Slice 17 (plan 17)
    this.buttonItems.push(item)

    this.changeLang = this.addButton(row, "ChangeLang", -BUTTON_X, false, "btn.changeLang", () => {
      if (this.pinchGuard.open) this.changeLanguageEvent.invoke()
    })
    this.restart = this.addButton(row, "Restart", BUTTON_X, true, "btn.restart", () => {
      if (this.pinchGuard.open) this.restartEvent.invoke()
    })
  }

  /**
   * Slice 7A-soft: a soft button ("<name>Button") at `x` in the row, the label
   * riding on the face. Primary: green fill, dark label. Secondary: the light
   * fill and soft outline, label in the normal text color.
   */
  private addButton(row: SceneObject, name: string, x: number, primary: boolean, key: StringKey, action: () => void): SoftButton {
    const so = global.scene.createSceneObject(name + "Button")
    so.setParent(row)
    so.getTransform().setLocalPosition(new vec3(x, 0, 0))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    const soft = new SoftButton(this, btn, BUTTON_W, BUTTON_H, primary, action)

    const label = global.scene.createSceneObject(name + "Label")
    label.setParent(soft.face)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const first = this.addButtonLine(label, key + ".id", primary)
    const second = this.addButtonLine(label, key + ".en", primary)
    const refresh = (): void => setLinePair(first, second, lines(key))
    refresh()
    onLanguageChanged.add(refresh)
    return soft
  }

  private addButtonLine(parent: SceneObject, name: string, primary: boolean): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    this.styleText(t, BUTTON_EM_CM * SIZE_PER_CM, false)
    if (primary) {
      t.textFill.color = SOFT_GREEN_TEXT
      t.outlineSettings.enabled = false // dark text on solid green
      this.greenTexts.push(t)
    }
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
    this.items.push(this.scoreItem) // Slice 17 (plan 17)
    const row = new SoftFrame(so, GLASS_INSET, SOFT_INNER_RADIUS_CM, null, "Score.backing") // glass tier 0 (15B)
    row.setSize(COMPACT_W, SCORE_ROW_H) // Slice 17 (plan 17): the score row shows only on a first result
    const x = COMPACT_W / 2 - SCORE_INSET
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

/** Slice 15A: the box around `parts`. */
function union(name: string, parts: PlaneBox[]): PlaneBox {
  return {
    name,
    minX: Math.min(...parts.map((b) => b.minX)),
    maxX: Math.max(...parts.map((b) => b.maxX)),
    minY: Math.min(...parts.map((b) => b.minY)),
    maxY: Math.max(...parts.map((b) => b.maxY))
  }
}
