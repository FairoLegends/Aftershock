import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {FontRole, fontFor, getLanguage, latinFont, lines, onLanguageChanged, primaryLine, setLinePair, StringKey} from "./Strings"
import {BrutalFrame, BRUTAL_BORDER_CM, BRUTAL_RED, BRUTAL_WHITE, BRUTAL_YELLOW, createSquareRect, drawOnTop, Marquee} from "./UiBacking"

// DESIGN_BRIEF §5–6 type sizes. size / 43.886 = em-square in cm.
const SIZE_PER_CM = 43.886
const WARNING_EM_CM = 7
const INSTRUCTION_EM_CM = 3.5
const SMALL_EM_CM = 2
const ENGLISH_SCALE = 0.8

// HUD layout (cm). Not drill tunables: they only shape the HUD.
const INNER_W = 46
const PAD = 2
const ROW_GAP = 0.8
const INSTR_ID_H = 8.4 // two wrapped lines
const INSTR_EN_H = 6.8
const ROW_H = 5
const LABEL_W = 8
const LABEL_ID_H = 2.6
const LABEL_EN_H = 2.1
const BAR_W = 16
const BAR_H = 1.6
const TIMER_W = 10 // 5j-12 defect 4: its own column, wide enough for "00:59" at TIMER_EM_CM
const TIMER_EM_CM = 2.5
const ROW_COL_GAP = 1.2 // label, bar, label, timer: 8 + 16 + 8 + 10 + 3 x 1.2 = 45.6 <= INNER_W
const WARN_W = 40
const WARN_ID_H = 9
const WARN_EN_H = 7.2
const WARN_RAISE = 2 // banner sits this far above eye level so it clears the HUD panel (learner, 27 Oct)
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

// Slice 7A numbered steps (01 goUnder, 02 duck, 03 hold): three cells over the instruction area.
const STEP_KEYS: StringKey[] = ["step.goUnder", "step.duck", "step.hold"]
const STEP_W = 14
const STEP_H = 14
const STEP_GAP = 2 // 3 x 14 + 2 x 2 = INNER_W
const STEP_TEXT_W = 13
const STEP_FIT_W = STEP_TEXT_W - 0.4 // a word wider than this would break mid-word
const STEP_NUMBER_EM = 3 // Syne, above the name (5j-12 (a))
const STEP_NUMBER_Y = 4.6
const STEP_NAME_EM = 2 // Manrope; wraps at word boundaries, two lines at most
const STEP_NAME_MIN_EM = 1.6
const STEP_NAME_Y = 0
const STEP_EN_EM = 1.5 // the English line, smaller Manrope
const STEP_EN_Y = -4.6
const LINE_H_PER_EM = 1.25 // as ResultPanel
const STEP_THIN_CM = 0.15 // upcoming-step border
const STEP_DONE_ALPHA = 0.4
const STEP_TEXT_Z = 0.1
const STRIKE_H = 0.25
const STEP_WHITE = new vec4(1, 1, 1, 1)
const STEP_DIM = new vec4(1, 1, 1, STEP_DONE_ALPHA)

// Slice 7A health bar: 10 square segments, filled white, empty as thin outlined cells.
const SEGMENTS = 10
const SEG_GAP = 0.35
const SEG_BORDER = 0.15
const SEG_EMPTY_FILL = new vec4(1, 1, 1, 0)
const SEG_EMPTY_BORDER = new vec4(1, 1, 1, 0.35)

// Slice 7A marquee.dch strip, with the banner for its first warningShowSeconds.
const DCH_W = 70
const DCH_H = 3.2
const DCH_EM = 2 // 5j-12 defect 5: 2 cm Syne
const DCH_GAP = 1.5
const DCH_SPEED = 5 // cm/s
const DCH_WORD_GAP = 6 // cm between the end of one copy and the next

/** Height of the HUD panel backing (cm): two instruction lines and the health/timer row (buildPanel). */
export const HUD_PANEL_HEIGHT = PAD * 2 + INSTR_ID_H + INSTR_EN_H + ROW_H + ROW_GAP * 2

/**
 * The quake HUD (TDD §3.1, DESIGN_BRIEF §6.1): a lazy-follow panel below eye
 * level with one instruction, health and the elapsed timer, plus a warning
 * banner at the center of view. It sits under AftershockRoot, not the Room,
 * so it never shakes. It owns no drill state: DrillController calls it.
 */
@component
export class Hud extends BaseScriptComponent {
  @ui.label("Quake HUD (R5, R7, R8)")
  @ui.separator
  @input
  @hint("DrillConfig component (hudDistance, hudBelowEye, warningShowSeconds, healthStart, healthAlarmBelow)")
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
  private banner: SceneObject | null = null
  private warningTimer: DelayedCallbackEvent | null = null
  private instructionId: Text | null = null
  private instructionEn: Text | null = null
  private timerLabel: Text | null = null
  private readonly segments: RoundedRectangle[] = []
  private stepsRoot: SceneObject | null = null
  private readonly stepFrames: BrutalFrame[] = []
  private readonly stepNumbers: Text[] = []
  private readonly stepNames: Text[] = []
  private readonly stepEnglish: Text[] = []
  private readonly stepStrikes: SceneObject[] = []
  private readonly stepNameText: string[] = ["", "", ""] // last fitted name per step
  private readonly stepNameEm: number[] = [STEP_NAME_EM, STEP_NAME_EM, STEP_NAME_EM]
  private marquee: Marquee | null = null
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

    this.createEvent("UpdateEvent").bind(() => {
      if (this.marquee && this.banner && this.banner.enabled) {
        this.marquee.tick(getDeltaTime())
      }
      this.follow()
    })
  }

  /** Shows the HUD and snaps it in front of the head. Latin fonts go on here, after DrillController registered them. */
  show(): void {
    const title = latinFont("title")
    if (title) {
      this.timerLabel.font = title
      for (const t of this.stepNumbers) {
        t.font = title
      }
    }
    this.snapNext = true
    this.sceneObject.enabled = true
    drawOnTop(this.sceneObject) // 5h item 3: panel and warning banner draw over the room
  }

  /** Hides the HUD and the warning banner. */
  hide(): void {
    this.hideWarning()
    this.sceneObject.enabled = false
  }

  /** warn.quake banner at the center of view for warningShowSeconds. */
  showWarning(): void {
    this.marquee.setText(primaryLine("marquee.dch"), latinFont("title"), fontFor(getLanguage(), "title"))
    this.banner.enabled = true
    this.warningTimer.reset(this.config.warningShowSeconds)
  }

  private readonly pairs: {key: StringKey; primary: Text; secondary: Text; role: FontRole}[] = []

  /** Re-renders the banner, the labels and the current instruction in the selected language (Slice 5L). */
  private refreshTexts(): void {
    for (const p of this.pairs) {
      setLinePair(p.primary, p.secondary, lines(p.key), p.role)
    }
    if (this._instructionKey) {
      this.setInstruction(this._instructionKey)
    }
  }

  private addPair(key: StringKey, primary: Text, secondary: Text, role: FontRole): void {
    this.pairs.push({key, primary, secondary, role})
    setLinePair(primary, secondary, lines(key), role)
  }

  /**
   * goUnder / duck / hold show the numbered steps (that step active, earlier
   * ones done); any other key (instr.brief, instr.comeOut) the single line.
   */
  setInstruction(key: StringKey): void {
    const step = key === "instr.goUnder" ? 0 : key === "instr.duck" ? 1 : key === "instr.hold" ? 2 : -1
    this.stepsRoot.enabled = step >= 0
    this.instructionId.enabled = step < 0
    this.instructionEn.enabled = step < 0
    if (step < 0) {
      setLinePair(this.instructionId, this.instructionEn, lines(key), "body")
    } else {
      this.setSteps(step)
    }
    this._instructionKey = key
  }

  /** Active: yellow border, plate and number. Done: 40% and struck through. Upcoming: thin border, no plate. */
  private setSteps(active: number): void {
    for (let i = 0; i < STEP_KEYS.length; i++) {
      const frame = this.stepFrames[i]
      const done = i < active
      const on = i === active
      setLinePair(this.stepNames[i], this.stepEnglish[i], lines(STEP_KEYS[i]), "body")
      this.fitStepName(i)
      frame.setAccent(on ? BRUTAL_YELLOW : BRUTAL_WHITE)
      frame.setBorderSize(i > active ? STEP_THIN_CM : BRUTAL_BORDER_CM)
      frame.setPlateVisible(i <= active)
      frame.setOpacity(done ? STEP_DONE_ALPHA : 1)
      const color = done ? STEP_DIM : STEP_WHITE
      this.stepNumbers[i].textFill.color = on ? BRUTAL_YELLOW : color
      this.stepNames[i].textFill.color = color
      this.stepEnglish[i].textFill.color = color
      this.stepStrikes[i].enabled = done
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

  /** Health in 0..healthStart, as 10 segments. Filled segments turn red below healthAlarmBelow. */
  setHealth(value: number): void {
    const max = this.config.healthStart
    const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
    const alarm = value < this.config.healthAlarmBelow
    if (fraction === this.lastFraction && alarm === this.lastAlarm) {
      return
    }
    this.lastFraction = fraction
    this.lastAlarm = alarm
    const filled = Math.ceil(fraction * SEGMENTS - 1e-6) // any health left shows one segment
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = this.segments[i]
      const on = i < filled
      seg.backgroundColor = on ? (alarm ? BRUTAL_RED : this.barColor) : SEG_EMPTY_FILL
      seg.border = !on
    }
  }

  /** Elapsed quake time as mm:ss. The text only changes once per second. */
  setElapsed(seconds: number): void {
    const whole = Math.max(0, Math.floor(seconds))
    if (whole === this.lastWholeSecond) {
      return
    }
    this.lastWholeSecond = whole
    this.timerLabel.text = pad2(Math.floor(whole / 60)) + ":" + pad2(whole % 60)
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }
  get isWarningShown(): boolean {
    return this.banner !== null && this.banner.isEnabledInHierarchy
  }
  get instructionKey(): StringKey | null {
    return this._instructionKey
  }
  get timerText(): string {
    return this.timerLabel ? this.timerLabel.text : ""
  }

  private hideWarning(): void {
    if (this.warningTimer) {
      this.warningTimer.cancel()
    }
    if (this.banner) {
      this.banner.enabled = false
    }
  }

  /** Lazy follow: eases toward hudDistance in front of the head, hudBelowEye below it, facing the head. */
  private follow(): void {
    if (!this.config || !this.headPose) {
      return
    }
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

  private buildPanel(): void {
    const panel = this.child(this.sceneObject, "Panel")
    const backing = new BrutalFrame(panel, this.backingColor)
    const content = this.child(panel, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = this.column(content, ROW_GAP, PAD)
    flex.width = INNER_W + PAD * 2
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
    })

    this.instructionId = this.addText(content, "InstructionText.id", "", INSTRUCTION_EM_CM, INNER_W, INSTR_ID_H, this.textColor, true)
    this.instructionEn = this.addText(content, "InstructionText.en", "", INSTRUCTION_EM_CM * ENGLISH_SCALE, INNER_W, INSTR_EN_H, this.textColor, true)
    this.buildSteps(panel)

    const row = this.child(content, "Row")
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = INNER_W
    rowItem.overrideHeight = ROW_H
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
    const segW = (BAR_W - SEG_GAP * (SEGMENTS - 1)) / SEGMENTS
    for (let i = 0; i < SEGMENTS; i++) {
      const so = this.child(bar, "Segment")
      so.getTransform().setLocalPosition(new vec3(-BAR_W / 2 + segW / 2 + i * (segW + SEG_GAP), 0, 0))
      const seg = createSquareRect(so, this.barColor, segW, BAR_H)
      seg.borderSize = SEG_BORDER
      seg.borderSoftness = 0
      seg.borderColor = SEG_EMPTY_BORDER
      seg.border = false
      this.segments.push(seg)
    }

    this.addLabel(row, "TimerLabel", "hud.time")
    this.timerLabel = this.addText(row, "TimerText", "00:00", TIMER_EM_CM, TIMER_W, ROW_H, this.textColor, false)
    this.timerLabel.horizontalOverflow = HorizontalOverflow.Shrink
  }

  /**
   * Three numbered cells over the instruction lines (not flex items, so the
   * panel keeps HUD_PANEL_HEIGHT). Shown for goUnder / duck / hold only.
   */
  private buildSteps(panel: SceneObject): void {
    const root = this.child(panel, "Steps")
    const areaTop = HUD_PANEL_HEIGHT / 2 - PAD
    const areaH = INSTR_ID_H + ROW_GAP + INSTR_EN_H
    root.getTransform().setLocalPosition(new vec3(0, areaTop - areaH / 2, CONTENT_Z))
    for (let i = 0; i < STEP_KEYS.length; i++) {
      const cell = this.child(root, "Step" + (i + 1))
      cell.getTransform().setLocalPosition(new vec3(-INNER_W / 2 + STEP_W / 2 + i * (STEP_W + STEP_GAP), 0.5, 0))
      const frame = new BrutalFrame(cell, new vec4(1, 1, 1, 0.12))
      frame.setSize(STEP_W, STEP_H)
      this.stepFrames.push(frame)
      const n = this.stepText(cell, "Step" + (i + 1) + ".number", STEP_NUMBER_EM, STEP_NUMBER_Y, 3.8)
      n.text = "0" + (i + 1)
      this.stepNumbers.push(n)
      const name = this.stepText(cell, "Step" + (i + 1) + ".name", STEP_NAME_EM, STEP_NAME_Y, 2 * STEP_NAME_EM * LINE_H_PER_EM)
      name.capitilizationOverride = CapitilizationOverride.AllUpper
      this.stepNames.push(name)
      this.stepEnglish.push(this.stepText(cell, "Step" + (i + 1) + ".en", STEP_EN_EM, STEP_EN_Y, 3.8))
      const strike = this.child(cell, "Step" + (i + 1) + ".strike")
      strike.getTransform().setLocalPosition(new vec3(0, STEP_NAME_Y, STEP_TEXT_Z * 2))
      createSquareRect(strike, STEP_WHITE, STEP_TEXT_W, STRIKE_H)
      strike.enabled = false
      this.stepStrikes.push(strike)
    }
    root.enabled = false
    this.stepsRoot = root
  }

  private stepText(cell: SceneObject, name: string, emCm: number, y: number, height: number): Text {
    const so = this.child(cell, name)
    so.getTransform().setLocalPosition(new vec3(0, y, STEP_TEXT_Z))
    const t = so.createComponent("Component.Text") as Text
    t.size = emCm * SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = STEP_WHITE
    if (this.textOutlineSize > 0) {
      t.outlineSettings.enabled = true
      t.outlineSettings.size = this.textOutlineSize
      t.outlineSettings.fill.color = this.textOutlineColor
    }
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-STEP_TEXT_W / 2, STEP_TEXT_W / 2, -height / 2, height / 2)
    return t
  }

  /** Created after Panel so it draws on top; WARN_RAISE above eye level (center of view). Slice 7A: red block, white plate. */
  private buildBanner(): void {
    const banner = this.child(this.sceneObject, "WarningBanner")
    banner.getTransform().setLocalPosition(new vec3(0, (this.config ? this.config.hudBelowEye : 0) + WARN_RAISE, 0))
    const backing = new BrutalFrame(banner, BRUTAL_RED)
    const content = this.child(banner, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    this.marquee = new Marquee(banner, "MarqueeDch", DCH_W, DCH_H, DCH_EM, BRUTAL_YELLOW, DCH_SPEED, DCH_WORD_GAP)
    const flex = this.column(content, ROW_GAP, PAD)
    flex.width = WARN_W + PAD * 2
    flex.onLayoutComplete.add((r) => {
      backing.setSize(r.containerWidth, r.containerHeight)
      this.marquee.root.getTransform().setLocalPosition(new vec3(0, r.containerHeight / 2 + DCH_GAP + DCH_H / 2, CONTENT_Z))
    })
    this.addPair(
      "warn.quake",
      this.addText(content, "Warning.id", "", WARNING_EM_CM, WARN_W, WARN_ID_H, BRUTAL_WHITE, false),
      this.addText(content, "Warning.en", "", WARNING_EM_CM * ENGLISH_SCALE, WARN_W, WARN_EN_H, BRUTAL_WHITE, false),
      "title"
    )
    onLanguageChanged.add(() => this.refreshTexts())
    banner.enabled = false
    this.banner = banner
  }

  /** Small bilingual label stacked in two lines (hud.health, hud.time). */
  private addLabel(parent: SceneObject, name: string, key: StringKey): void {
    const so = this.child(parent, name)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = LABEL_W
    item.overrideHeight = LABEL_ID_H + LABEL_EN_H
    const flex = this.column(so, 0, 0)
    flex.width = LABEL_W
    const primary = this.addText(so, name + ".id", "", SMALL_EM_CM, LABEL_W, LABEL_ID_H, this.textColor, false)
    const secondary = this.addText(so, name + ".en", "", SMALL_EM_CM * ENGLISH_SCALE, LABEL_W, LABEL_EN_H, this.textColor, false)
    primary.horizontalOverflow = HorizontalOverflow.Shrink // 5j-12 defect 4: never wider than its column
    secondary.horizontalOverflow = HorizontalOverflow.Shrink
    this.addPair(key, primary, secondary, "body")
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
