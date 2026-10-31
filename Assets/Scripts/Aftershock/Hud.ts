import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {getLanguage, latinFont, lines, onLanguageChanged, setLinePair, setLineText, StringKey} from "./Strings"
import {
  drawOnTopWhenReady,
  SOFT_DIM,
  SOFT_GREEN,
  SOFT_PANEL_RADIUS_CM,
  SOFT_RED,
  SOFT_WHITE,
  SoftFrame,
  TabularText
} from "./UiBacking"

// DESIGN_BRIEF §5–6 type sizes. size / 43.886 = em-square in cm. The banner's
// size, place and fill are DrillConfig tunables (5m-1, 5m-9: warnEmCm, warnWidthCm, warnFill,
// warnAboveGazeDeg, warnPitchMinDeg, warnPitchMaxDeg).
const SIZE_PER_CM = 43.886
const INSTRUCTION_EM_CM = 3.5
const SMALL_EM_CM = 2

// HUD layout (cm). Not drill tunables: they only shape the HUD.
// Slice 7A-soft: one language (5j-13d), so every English line is collapsed to HIDDEN_H.
const INNER_W = 46
const PAD = 2
const ROW_GAP = 0.8
const INSTR_ID_H = 9.5 // two wrapped lines; also the step cells' height (9.5: a two-line step name clears the cell's bottom edge)
const HIDDEN_H = 0.001
const ROW_H = 5
const LABEL_W = 8
const LABEL_H = 2.6
const BAR_W = 16
const BAR_H = 1.6
const TIMER_W = 10 // 5j-12 defect 4: its own column, wide enough for "00:59" at TIMER_EM_CM
const TIMER_EM_CM = 2.5
const ROW_COL_GAP = 1.2 // label, bar, label, timer: 8 + 16 + 8 + 10 + 3 x 1.2 = 45.6 <= INNER_W
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

// Numbered steps (01 goUnder, 02 duck, 03 hold, 04 evac): four rounded cells over the
// instruction area (mockup .st): a small number on top, the name below.
// Slice 8B (5k item 8): a fourth cell; the cells shrink to fit the same width.
const STEP_KEYS: StringKey[] = ["step.goUnder", "step.duck", "step.hold", "step.evac"]
const STEP_W = 10
const STEP_H = INSTR_ID_H
const STEP_GAP = 2 // 4 x 10 + 3 x 2 = INNER_W
const STEP_RADIUS_CM = 1.3
const STEP_TEXT_W = 9.2
const STEP_FIT_W = STEP_TEXT_W - 0.4 // a word wider than this would break mid-word
const STEP_PAD = 0.7
const STEP_NUMBER_EM = 1.6
const STEP_NUMBER_H = STEP_NUMBER_EM * 1.25
const STEP_NUMBER_Y = STEP_H / 2 - STEP_PAD - STEP_NUMBER_H / 2
const STEP_NAME_EM = 2 // Manrope bold; wraps at word boundaries, two lines at most
const STEP_NAME_MIN_EM = 1.3
const STEP_NAME_TOP = STEP_NUMBER_Y - STEP_NUMBER_H / 2 - 0.3
const STEP_NAME_BOTTOM = -STEP_H / 2 + STEP_PAD
const LINE_H_PER_EM = 1.25 // as ResultPanel
const STEP_DONE_ALPHA = 0.45
const STEP_TEXT_Z = 0.1
const STEP_FILL = new vec4(1, 1, 1, 0.06)
const STEP_ON_FILL = new vec4(0.239, 0.863, 0.518, 0.22)
const STEP_ON_BORDER_CM = 0.18
const STEP_DONE = new vec4(1, 1, 1, STEP_DONE_ALPHA)

// 5m-2: a notice takes the step row's place inside the panel, on a soft red
// tint (red at the active step's 22%, red outline), so it is never a second panel.
const NOTICE_FILL = new vec4(SOFT_RED.x, SOFT_RED.y, SOFT_RED.z, STEP_ON_FILL.w)
const NOTICE_TEXT_W = INNER_W - STEP_PAD * 2

// Health: one rounded bar (mockup .bar): track white 18%, fill white, red below healthAlarmBelow.
const BAR_TRACK = new vec4(1, 1, 1, 0.18)

/** Height of the HUD panel backing (cm): the instruction area and the health/timer row (buildPanel). */
export const HUD_PANEL_HEIGHT = PAD * 2 + INSTR_ID_H + ROW_GAP + ROW_H

/**
 * The quake HUD (TDD §3.1, DESIGN_BRIEF §6.1): a lazy-follow panel below eye
 * level with one instruction, health and the elapsed timer, plus a warning
 * banner at the center of view. It sits under AftershockRoot, not the Room,
 * so it never shakes. It owns no drill state: DrillController calls it.
 * 5m-1/5m-2: one panel at a time. The panel is hidden while the banner shows,
 * and a notice shows inside the panel in the step row's place.
 * 5m-9: the panel keeps its level lazy follow; the banner follows the head's
 * pitch (placeBanner).
 */
@component
export class Hud extends BaseScriptComponent {
  @ui.label("Quake HUD (R5, R7, R8)")
  @ui.separator
  @input
  @hint("DrillConfig component (hudDistance, hudBelowEye, warningShowSeconds, warn*, healthStart, healthAlarmBelow)")
  config: DrillConfig

  @input
  @hint("HeadPose component the HUD follows")
  headPose: HeadPose

  @ui.group_start("Settings")
  @input
  @hint("How fast the HUD catches up with the head (per second). Higher = stiffer.")
  @widget(new SliderWidget(0.5, 10, 0.5))
  followSpeed: number = 3

  @input
  @hint("Backing color: light, opaque enough that room labels behind it do not show through (ENGINEERING_PLAN 5d item 3). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.6)

  @input
  @hint("Instruction, label and timer text color (white)")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Thin outline around every HUD text, so white text reads on the light backing")
  @widget(new ColorWidget())
  textOutlineColor: vec4 = new vec4(0.2, 0.2, 0.2, 1)

  @input
  @hint("Outline strength, 0 (none) to 1 (very strong)")
  @widget(new SliderWidget(0, 1, 0.05))
  textOutlineSize: number = 0.2

  @input
  @hint("Health bar fill color at or above healthAlarmBelow")
  @widget(new ColorWidget())
  barColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  private transform: Transform | null = null
  private panel: SceneObject | null = null
  private banner: SceneObject | null = null
  private bannerTransform: Transform | null = null
  private readonly bannerPos = new vec3(0, 0, 0)
  private readonly bannerRot = quat.quatIdentity()
  private bannerFx = 0 // last level heading of the head (unit XZ); the camera looks down −Z
  private bannerFz = -1
  private bannerSnapNext = true
  private warningTimer: DelayedCallbackEvent | null = null
  private notice: SceneObject | null = null
  private noticeTimer: DelayedCallbackEvent | null = null
  private instructionId: Text | null = null
  private instructionEn: Text | null = null
  private timerLabel: Text | null = null
  private timerDigits: TabularText | null = null
  private barFill: SoftFrame | null = null
  private stepsRoot: SceneObject | null = null
  private readonly stepFrames: SoftFrame[] = []
  private readonly stepNumbers: Text[] = []
  private readonly stepNames: Text[] = []
  private readonly stepNameText: string[] = STEP_KEYS.map(() => "") // last fitted name per step
  private readonly stepNameEm: number[] = STEP_KEYS.map(() => STEP_NAME_EM)
  private readonly followPos = new vec3(0, 0, 0)
  private readonly followRot = quat.quatIdentity()
  private snapNext = true
  private lastWholeSecond = -1
  private lastFraction = -1
  private lastAlarm = false
  private _instructionKey: StringKey | null = null

  onAwake(): void {
    this.transform = this.sceneObject.getTransform()
    this.sceneObject.createComponent("Component.Canvas")
    this.buildPanel()
    this.buildBanner()

    this.warningTimer = this.createEvent("DelayedCallbackEvent")
    this.warningTimer.bind(() => this.hideWarning())
    this.noticeTimer = this.createEvent("DelayedCallbackEvent")
    this.noticeTimer.bind(() => this.hideNotice())

    this.createEvent("UpdateEvent").bind(() => this.follow())
  }

  /** Shows the HUD and snaps it in front of the head. The Latin font goes on here, after DrillController registered it. */
  show(): void {
    const latin = latinFont()
    if (latin) {
      this.timerDigits.setFont(latin)
      for (const t of this.stepNumbers) {
        t.font = latin
      }
    }
    this.snapNext = true
    this.sceneObject.enabled = true
    drawOnTopWhenReady(this, this.sceneObject) // 5h item 3, 5j-19f: panel and warning banner draw over the room, again once the layout settles
  }

  /** Hides the HUD, the warning banner and the notice. */
  hide(): void {
    this.hideWarning()
    this.hideNotice()
    this.sceneObject.enabled = false
  }

  /**
   * Warning banner (warn.quake, or warn.aftershock in Slice 7C) at the center of
   * view for warningShowSeconds. 5m-1: the panel (steps, health, timer) is hidden
   * until the banner has gone. 5m-9: it snaps along the head's forward now.
   */
  showWarning(key: StringKey = "warn.quake"): void {
    this.hideNotice()
    if (this.bannerPair && this.bannerPair.key !== key) {
      this.bannerPair.key = key
      setLinePair(this.bannerPair.primary, this.bannerPair.secondary, lines(key))
    }
    this.panel.enabled = false
    this.banner.enabled = true
    if (this.config && this.headPose) {
      this.placeBanner(true)
    }
    this.bannerSnapNext = true // and again in this frame's follow, if the root moves after this call
    this.warningTimer.reset(this.config.warningShowSeconds)
  }

  /**
   * A notice (warn.bed §5j-15 bed trap, hit.fell Slice 7D, hit.glass, warn.trip)
   * for `seconds`. 5m-2: inside the panel in the step row's place, on a soft red
   * tint, with health and the timer still shown; it ends the warning banner.
   */
  showNotice(seconds: number, key: StringKey = "warn.bed"): void {
    this.hideWarning()
    if (this.noticePair && this.noticePair.key !== key) {
      this.noticePair.key = key
      setLinePair(this.noticePair.primary, this.noticePair.secondary, lines(key))
    }
    this.notice.enabled = true
    this.stepsRoot.enabled = false
    this.instructionId.enabled = false
    this.instructionEn.enabled = false
    this.noticeTimer.reset(seconds)
  }

  private readonly pairs: {key: StringKey; primary: Text; secondary: Text}[] = []
  private bannerPair: {key: StringKey; primary: Text; secondary: Text} | null = null
  private noticePair: {key: StringKey; primary: Text; secondary: Text} | null = null

  /** Re-renders the banner, the labels and the current instruction in the selected language (Slice 5L). */
  private refreshTexts(): void {
    for (const p of this.pairs) {
      setLinePair(p.primary, p.secondary, lines(p.key))
    }
    if (this._instructionKey) {
      this.setInstruction(this._instructionKey)
    }
  }

  private addPair(key: StringKey, primary: Text, secondary: Text): void {
    this.pairs.push({key, primary, secondary})
    setLinePair(primary, secondary, lines(key))
  }

  /**
   * goUnder / duck / hold / evac show the numbered steps (that step active,
   * earlier ones done); any other key (instr.brief, instr.comeOut, instr.grip)
   * the single line. Slice 8B: instr.grip is a single line so "Hold the table
   * leg" can be read; step 03 is still the open step while it shows. While a
   * notice shows (5m-2) the new key is kept and shown when the notice ends.
   */
  setInstruction(key: StringKey): void {
    const step =
      key === "instr.goUnder" ? 0 : key === "instr.duck" ? 1 : key === "instr.hold" ? 2 : key === "instr.evac" ? 3 : -1
    const noticeUp = this.notice !== null && this.notice.enabled
    this.stepsRoot.enabled = !noticeUp && step >= 0
    this.instructionId.enabled = !noticeUp && step < 0
    this.instructionEn.enabled = !noticeUp && step < 0
    if (step < 0) {
      setLinePair(this.instructionId, this.instructionEn, lines(key))
    } else {
      this.setSteps(step)
    }
    this._instructionKey = key
  }

  /** Active: green fill 22%, green outline, green number. Done: 45%, number dimmed. Upcoming: plain. */
  private setSteps(active: number): void {
    for (let i = 0; i < STEP_KEYS.length; i++) {
      const frame = this.stepFrames[i]
      const done = i < active
      const on = i === active
      setLineText(this.stepNames[i], lines(STEP_KEYS[i]).primary, getLanguage())
      this.fitStepName(i)
      frame.setFill(on ? STEP_ON_FILL : STEP_FILL)
      frame.setBorder(on ? SOFT_GREEN : null, STEP_ON_BORDER_CM)
      frame.setOpacity(done ? STEP_DONE_ALPHA : 1)
      // The Manrope subset has no ✓, so a done step shows its number only, dimmed.
      this.stepNumbers[i].textFill.color = on ? SOFT_GREEN : done ? STEP_DONE : SOFT_DIM
      this.stepNames[i].textFill.color = done ? STEP_DONE : SOFT_WHITE
    }
  }

  /**
   * 5j-12 (a): a step name wraps at word boundaries only, to two lines at
   * most. A word wider than the cell, or a third line, shrinks the name (never
   * under STEP_NAME_MIN_EM). Measures once per text, at most 3 getBoundingBox
   * calls (the limit is 5 per Text per frame).
   */
  private fitStepName(i: number): void {
    const t = this.stepNames[i]
    const text = t.text
    if (text !== this.stepNameText[i]) {
      this.stepNameText[i] = text
      let em = STEP_NAME_EM
      t.size = em * SIZE_PER_CM
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.text = text.split(" ").reduce((a, b) => (b.length > a.length ? b : a), "")
      const box = t.getBoundingBox()
      const w = box.right - box.left
      if (w > STEP_FIT_W) {
        em = Math.max(STEP_NAME_MIN_EM, (em * STEP_FIT_W) / w)
      }
      t.text = text
      t.horizontalOverflow = HorizontalOverflow.Wrap
      for (let k = 0; k < 2 && em > STEP_NAME_MIN_EM; k++) {
        t.size = em * SIZE_PER_CM
        const b = t.getBoundingBox()
        if (Math.round((b.top - b.bottom) / (em * LINE_H_PER_EM)) <= 2) {
          break
        }
        em = Math.max(STEP_NAME_MIN_EM, em * 0.85)
      }
      this.stepNameEm[i] = em
    }
    t.size = this.stepNameEm[i] * SIZE_PER_CM
  }

  /** Health in 0..healthStart, as one rounded bar. The fill turns red below healthAlarmBelow. */
  setHealth(value: number): void {
    const max = this.config.healthStart
    const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
    const alarm = value < this.config.healthAlarmBelow
    if (fraction === this.lastFraction && alarm === this.lastAlarm) {
      return
    }
    this.lastFraction = fraction
    this.lastAlarm = alarm
    const w = BAR_W * fraction
    this.barFill.face.enabled = w > 0.01
    this.barFill.setSize(Math.max(0.01, w), BAR_H)
    this.barFill.face.getTransform().setLocalPosition(new vec3(-BAR_W / 2 + w / 2, 0, 0.02))
    this.barFill.setFill(alarm ? SOFT_RED : this.barColor)
  }

  /** Elapsed quake time as mm:ss in fixed-width digits. The text only changes once per second. */
  setElapsed(seconds: number): void {
    const whole = Math.max(0, Math.floor(seconds))
    if (whole === this.lastWholeSecond) {
      return
    }
    this.lastWholeSecond = whole
    this.timerDigits.set(pad2(Math.floor(whole / 60)) + ":" + pad2(whole % 60))
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }
  get isWarningShown(): boolean {
    return this.banner !== null && this.banner.isEnabledInHierarchy
  }
  /** 5m-1: the panel (instruction or steps, health, timer); false while the warning banner shows. */
  get isPanelShown(): boolean {
    return this.panel !== null && this.panel.isEnabledInHierarchy
  }
  /** String key the warning banner shows ("warn.quake" or "warn.aftershock"). */
  get warningKey(): StringKey | null {
    return this.bannerPair ? this.bannerPair.key : null
  }
  /** 5m-9: the banner's world center (cm). */
  get warningPosition(): vec3 {
    return this.bannerTransform ? this.bannerTransform.getWorldPosition() : vec3.zero()
  }
  /** 5m-2: the notice row inside the panel (there is no floating notice). */
  get isNoticeShown(): boolean {
    return this.notice !== null && this.notice.isEnabledInHierarchy
  }
  /** The notice's current key (warn.bed, hit.fell, hit.glass or warn.trip), or null before it is built. */
  get noticeKey(): StringKey | null {
    return this.noticePair ? this.noticePair.key : null
  }
  get instructionKey(): StringKey | null {
    return this._instructionKey
  }
  get timerText(): string {
    return this.timerLabel ? this.timerLabel.text : ""
  }

  /** Ends the banner and shows the panel again (5m-1). */
  private hideWarning(): void {
    if (this.warningTimer) {
      this.warningTimer.cancel()
    }
    if (this.banner) {
      this.banner.enabled = false
    }
    if (this.panel) {
      this.panel.enabled = true
    }
  }

  /** Ends the notice and puts the current instruction or steps back in its row. */
  private hideNotice(): void {
    if (this.noticeTimer) {
      this.noticeTimer.cancel()
    }
    if (this.notice && this.notice.enabled) {
      this.notice.enabled = false
      if (this._instructionKey) {
        this.setInstruction(this._instructionKey)
      } else {
        this.instructionId.enabled = true
      }
    }
  }

  /** The panel's level follow, then the banner's (5m-9), each frame the HUD shows. */
  private follow(): void {
    if (!this.config || !this.headPose) {
      return
    }
    this.followPanel()
    // After the root moved: the banner's world pose is set, so the root's move does not carry it.
    if (this.banner && this.banner.enabled) {
      this.placeBanner(this.bannerSnapNext)
      this.bannerSnapNext = false
    }
  }

  /** Lazy follow: eases toward hudDistance in front of the head, hudBelowEye below it, facing the head. */
  private followPanel(): void {
    const head = this.headPose.position
    const f = this.headPose.forward
    const len = Math.sqrt(f.x * f.x + f.z * f.z)
    if (len < 1e-4) {
      return // looking straight up or down: keep the last spot
    }
    const d = this.config.hudDistance / len
    const tx = head.x + f.x * d
    const ty = head.y - this.config.hudBelowEye
    const tz = head.z + f.z * d
    const k = this.snapNext ? 1 : 1 - Math.exp(-this.followSpeed * getDeltaTime())
    this.snapNext = false
    const p = this.followPos
    p.x += (tx - p.x) * k
    p.y += (ty - p.y) * k
    p.z += (tz - p.z) * k
    this.transform.setWorldPosition(p)

    // Yaw only, local +Z toward the head (same facing as BriefingPanel).
    const half = Math.atan2(head.x - p.x, head.z - p.z) * 0.5
    const q = this.followRot
    q.w = Math.cos(half)
    q.x = 0
    q.y = Math.sin(half)
    q.z = 0
    this.transform.setWorldRotation(q)
  }

  /**
   * 5m-9: the banner along the head's real forward, warnAboveGazeDeg above the
   * center of view at hudDistance, the gaze pitch clamped to
   * warnPitchMinDeg..warnPitchMaxDeg (never on the floor or the ceiling),
   * facing the head (yaw and pitch, no roll). It snaps when it shows, then
   * eases at followSpeed like the panel, so it does not jitter with the head.
   */
  private placeBanner(snap: boolean): void {
    const cfg = this.config
    const head = this.headPose.position
    const f = this.headPose.forward
    const len = Math.sqrt(f.x * f.x + f.z * f.z)
    if (len > 1e-4) {
      this.bannerFx = f.x / len // looking straight up or down: keep the last heading
      this.bannerFz = f.z / len
    }
    const gaze = (Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI
    const pitch = Math.max(cfg.warnPitchMinDeg, Math.min(cfg.warnPitchMaxDeg, gaze))
    const el = ((pitch + cfg.warnAboveGazeDeg) * Math.PI) / 180
    const flat = cfg.hudDistance * Math.cos(el)
    const k = snap ? 1 : 1 - Math.exp(-this.followSpeed * getDeltaTime())
    const p = this.bannerPos
    p.x += (head.x + this.bannerFx * flat - p.x) * k
    p.y += (head.y + cfg.hudDistance * Math.sin(el) - p.y) * k
    p.z += (head.z + this.bannerFz * flat - p.z) * k
    this.bannerTransform.setWorldPosition(p)

    // Local +Z toward the head: pitch about X, then yaw about Y (half angles).
    const dx = head.x - p.x
    const dy = head.y - p.y
    const dz = head.z - p.z
    const yaw = Math.atan2(dx, dz) * 0.5
    const tilt = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz)) * 0.5
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    const cp = Math.cos(tilt)
    const sp = Math.sin(tilt)
    const q = this.bannerRot
    q.w = cy * cp
    q.x = cy * sp
    q.y = sy * cp
    q.z = -sy * sp
    this.bannerTransform.setWorldRotation(q)
  }

  private buildPanel(): void {
    const panel = this.child(this.sceneObject, "Panel")
    this.panel = panel
    const backing = new SoftFrame(panel, this.backingColor)
    const content = this.child(panel, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = this.column(content, 0, PAD) // gaps are margins, so the collapsed English line leaves none
    flex.width = INNER_W + PAD * 2
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
    })

    this.instructionId = this.addText(content, "InstructionText.id", "", INSTRUCTION_EM_CM, INNER_W, INSTR_ID_H, this.textColor, true)
    this.instructionEn = this.addText(content, "InstructionText.en", "", INSTRUCTION_EM_CM, INNER_W, HIDDEN_H, this.textColor, true)
    this.buildSteps(panel)
    this.buildNotice(panel)

    const row = this.child(content, "Row")
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = INNER_W
    rowItem.overrideHeight = ROW_H
    rowItem.marginTop = ROW_GAP
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.justifyContent = FlexJustify.Center
    rowFlex.columnGap = ROW_COL_GAP
    rowFlex.width = INNER_W
    rowFlex.height = ROW_H

    this.addLabel(row, "HealthLabel", "hud.health")

    const bar = this.child(row, "HealthBar")
    const barItem = bar.createComponent(FlexItem.getTypeName()) as FlexItem
    barItem.overrideWidth = BAR_W
    barItem.overrideHeight = BAR_H
    const track = new SoftFrame(bar, BAR_TRACK, BAR_H / 2, null, "Track")
    track.setSize(BAR_W, BAR_H)
    this.barFill = new SoftFrame(bar, this.barColor, BAR_H / 2, null, "Fill")
    this.barFill.setSize(BAR_W, BAR_H)
    this.barFill.face.getTransform().setLocalPosition(new vec3(0, 0, 0.02))

    this.addLabel(row, "TimerLabel", "hud.time")
    this.timerLabel = this.addText(row, "TimerText", "00:00", TIMER_EM_CM, TIMER_W, ROW_H, this.textColor, false)
    this.timerDigits = new TabularText(this.timerLabel, "00:00", TIMER_EM_CM, 0)
  }

  /**
   * Three numbered cells over the instruction line (not flex items, so the
   * panel keeps HUD_PANEL_HEIGHT). Shown for goUnder / duck / hold only.
   */
  private buildSteps(panel: SceneObject): void {
    const root = this.child(panel, "Steps")
    const areaTop = HUD_PANEL_HEIGHT / 2 - PAD
    root.getTransform().setLocalPosition(new vec3(0, areaTop - STEP_H / 2, CONTENT_Z))
    for (let i = 0; i < STEP_KEYS.length; i++) {
      const cell = this.child(root, "Step" + (i + 1))
      cell.getTransform().setLocalPosition(new vec3(-INNER_W / 2 + STEP_W / 2 + i * (STEP_W + STEP_GAP), 0, 0))
      const frame = new SoftFrame(cell, STEP_FILL, STEP_RADIUS_CM, null)
      frame.setSize(STEP_W, STEP_H)
      this.stepFrames.push(frame)
      const n = this.stepText(cell, "Step" + (i + 1) + ".number", STEP_NUMBER_EM, STEP_NUMBER_Y + STEP_NUMBER_H / 2, STEP_NUMBER_Y - STEP_NUMBER_H / 2)
      n.text = "0" + (i + 1)
      n.textFill.color = SOFT_DIM
      this.stepNumbers.push(n)
      const name = this.stepText(cell, "Step" + (i + 1) + ".name", STEP_NAME_EM, STEP_NAME_TOP, STEP_NAME_BOTTOM)
      name.verticalAlignment = VerticalAlignment.Center // one- and two-line names sit alike in the two-line slot
      this.stepNames.push(name)
    }
    root.enabled = false
    this.stepsRoot = root
  }

  private stepText(cell: SceneObject, name: string, emCm: number, top: number, bottom: number): Text {
    const so = this.child(cell, name)
    so.getTransform().setLocalPosition(new vec3(0, 0, STEP_TEXT_Z))
    const t = so.createComponent("Component.Text") as Text
    t.size = emCm * SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = SOFT_WHITE
    if (this.textOutlineSize > 0) {
      t.outlineSettings.enabled = true
      t.outlineSettings.size = this.textOutlineSize
      t.outlineSettings.fill.color = this.textOutlineColor
    }
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-STEP_TEXT_W / 2, STEP_TEXT_W / 2, bottom, top)
    return t
  }

  /**
   * Created after Panel so it draws on top. A child of the HUD root, so it
   * shows, hides and draws on top with it, but placed in world space by
   * placeBanner (5m-9), not by the root's level follow. 5m-1 option B:
   * narrower, one step smaller. Slice 7A-soft: rounded red block, no plate.
   */
  private buildBanner(): void {
    const cfg = this.config
    const banner = this.child(this.sceneObject, "WarningBanner")
    this.bannerTransform = banner.getTransform()
    const backing = new SoftFrame(banner, cfg.warnFill, SOFT_PANEL_RADIUS_CM, null)
    const content = this.child(banner, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = this.column(content, 0, PAD)
    flex.width = cfg.warnWidthCm + PAD * 2
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
    })
    const lineH = cfg.warnEmCm * LINE_H_PER_EM
    const primary = this.addText(content, "Warning.id", "", cfg.warnEmCm, cfg.warnWidthCm, lineH, SOFT_WHITE, false)
    const secondary = this.addText(content, "Warning.en", "", cfg.warnEmCm, cfg.warnWidthCm, HIDDEN_H, SOFT_WHITE, false)
    primary.horizontalOverflow = HorizontalOverflow.Shrink // a long word (de) stays inside the narrower banner
    secondary.horizontalOverflow = HorizontalOverflow.Shrink
    this.addPair("warn.quake", primary, secondary)
    this.bannerPair = this.pairs[this.pairs.length - 1]
    onLanguageChanged.add(() => this.refreshTexts())
    banner.enabled = false
    this.banner = banner
  }

  /**
   * 5m-2: the notice row, in the step row's place inside the panel (not a flex
   * item, so the panel keeps HUD_PANEL_HEIGHT): a soft red tint with the notice
   * text, wrapped to two lines and shrunk if it is longer. Hidden until showNotice.
   */
  private buildNotice(panel: SceneObject): void {
    const notice = this.child(panel, "Notice")
    const areaTop = HUD_PANEL_HEIGHT / 2 - PAD
    notice.getTransform().setLocalPosition(new vec3(0, areaTop - STEP_H / 2, CONTENT_Z))
    const frame = new SoftFrame(notice, NOTICE_FILL, STEP_RADIUS_CM, null)
    frame.setSize(INNER_W, STEP_H)
    frame.setBorder(SOFT_RED, STEP_ON_BORDER_CM)
    const top = STEP_H / 2 - STEP_PAD
    const primary = this.noticeText(notice, "Notice.id", top)
    const secondary = this.noticeText(notice, "Notice.en", -top + HIDDEN_H)
    this.addPair("warn.bed", primary, secondary)
    this.noticePair = this.pairs[this.pairs.length - 1]
    notice.enabled = false
    this.notice = notice
  }

  private noticeText(parent: SceneObject, name: string, top: number): Text {
    const so = this.child(parent, name)
    so.getTransform().setLocalPosition(new vec3(0, 0, STEP_TEXT_Z))
    const t = so.createComponent("Component.Text") as Text
    t.size = INSTRUCTION_EM_CM * SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = SOFT_WHITE
    if (this.textOutlineSize > 0) {
      t.outlineSettings.enabled = true
      t.outlineSettings.size = this.textOutlineSize
      t.outlineSettings.fill.color = this.textOutlineColor
    }
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Shrink
    t.layoutRect = Rect.create(-NOTICE_TEXT_W / 2, NOTICE_TEXT_W / 2, -STEP_H / 2 + STEP_PAD, top)
    return t
  }

  /** Small dimmed label (hud.health, hud.time); its English line is collapsed. */
  private addLabel(parent: SceneObject, name: string, key: StringKey): void {
    const so = this.child(parent, name)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = LABEL_W
    item.overrideHeight = LABEL_H
    const flex = this.column(so, 0, 0)
    flex.width = LABEL_W
    const primary = this.addText(so, name + ".id", "", SMALL_EM_CM, LABEL_W, LABEL_H, SOFT_DIM, false)
    const secondary = this.addText(so, name + ".en", "", SMALL_EM_CM, LABEL_W, HIDDEN_H, SOFT_DIM, false)
    primary.horizontalOverflow = HorizontalOverflow.Shrink // 5j-12 defect 4: never wider than its column
    secondary.horizontalOverflow = HorizontalOverflow.Shrink
    this.addPair(key, primary, secondary)
  }

  private column(so: SceneObject, gap: number, pad: number): FlexLayout {
    const flex = so.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Center
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = gap
    flex.paddingTop = pad
    flex.paddingBottom = pad
    flex.paddingLeft = pad
    flex.paddingRight = pad
    return flex
  }

  private addText(
    parent: SceneObject,
    name: string,
    text: string,
    emCm: number,
    width: number,
    height: number,
    color: vec4,
    wrap: boolean
  ): Text {
    const so = this.child(parent, name)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.size = emCm * SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = color
    if (this.textOutlineSize > 0) {
      t.outlineSettings.enabled = true
      t.outlineSettings.size = this.textOutlineSize
      t.outlineSettings.fill.color = this.textOutlineColor
    }
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = width
    item.overrideHeight = height
    item.alignSelf = FlexAlignSelf.Center
    return t
  }

  private child(parent: SceneObject, name: string): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    return so
  }
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : "" + n
}
