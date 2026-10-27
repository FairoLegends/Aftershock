import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {splitBilingual, STRINGS, StringKey} from "./Strings"
import {createLightBacking} from "./UiBacking"

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
const LABEL_W = 9
const LABEL_ID_H = 2.6
const LABEL_EN_H = 2.1
const BAR_W = 16
const BAR_H = 1.6
const TIMER_W = 9
const WARN_W = 40
const WARN_ID_H = 9
const WARN_EN_H = 7.2
const WARN_RAISE = 2 // banner sits this far above eye level so it clears the HUD panel (learner, 27 Oct)
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)
const FILL_Z = 0.05 // health fill just in front of its track
const MIN_FILL_W = 0.001

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
  @hint("Alarm red #FF5A4F: warning banner, and the health bar below healthAlarmBelow")
  @widget(new ColorWidget())
  alarmColor: vec4 = new vec4(1, 0.353, 0.31, 1)

  @input
  @hint("Health bar fill color at or above healthAlarmBelow")
  @widget(new ColorWidget())
  barColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Health bar track (empty part) color")
  @widget(new ColorWidget())
  trackColor: vec4 = new vec4(1, 1, 1, 0.2)
  @ui.group_end

  private transform: Transform | null = null
  private banner: SceneObject | null = null
  private warningTimer: DelayedCallbackEvent | null = null
  private instructionId: Text | null = null
  private instructionEn: Text | null = null
  private timerLabel: Text | null = null
  private fill: RoundedRectangle | null = null
  private fillTransform: Transform | null = null
  private readonly followPos = new vec3(0, 0, 0)
  private readonly followRot = quat.quatIdentity()
  private readonly fillSize = new vec2(BAR_W, BAR_H)
  private readonly fillPos = new vec3(0, 0, FILL_Z)
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

    this.createEvent("UpdateEvent").bind(() => this.follow())
  }

  /** Shows the HUD and snaps it in front of the head. */
  show(): void {
    this.snapNext = true
    this.sceneObject.enabled = true
  }

  /** Hides the HUD and the warning banner. */
  hide(): void {
    this.hideWarning()
    this.sceneObject.enabled = false
  }

  /** warn.quake banner at the center of view for warningShowSeconds. */
  showWarning(): void {
    this.banner.enabled = true
    this.warningTimer.reset(this.config.warningShowSeconds)
  }

  setInstruction(key: StringKey): void {
    const parts = splitBilingual(STRINGS[key])
    this.instructionId.text = parts.id
    this.instructionEn.text = parts.en
    this._instructionKey = key
  }

  /** Health in 0..healthStart. The bar turns alarm red below healthAlarmBelow. */
  setHealth(value: number): void {
    const max = this.config.healthStart
    const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
    const alarm = value < this.config.healthAlarmBelow
    if (fraction === this.lastFraction && alarm === this.lastAlarm) {
      return
    }
    this.lastFraction = fraction
    this.lastAlarm = alarm
    const w = Math.max(MIN_FILL_W, BAR_W * fraction)
    this.fillSize.x = w
    this.fill.size = this.fillSize
    this.fillPos.x = -BAR_W / 2 + w / 2
    this.fillTransform.setLocalPosition(this.fillPos)
    this.fill.backgroundColor = alarm ? this.alarmColor : this.barColor
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
    const backing = createLightBacking(panel, this.backingColor)
    const content = this.child(panel, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = this.column(content, ROW_GAP, PAD)
    flex.width = INNER_W + PAD * 2
    flex.onLayoutComplete.add((r) => {
      backing.size = new vec2(r.containerWidth, r.containerHeight)
    })

    this.instructionId = this.addText(content, "InstructionText.id", "", INSTRUCTION_EM_CM, INNER_W, INSTR_ID_H, this.textColor, true)
    this.instructionEn = this.addText(content, "InstructionText.en", "", INSTRUCTION_EM_CM * ENGLISH_SCALE, INNER_W, INSTR_EN_H, this.textColor, true)

    const row = this.child(content, "Row")
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = INNER_W
    rowItem.overrideHeight = ROW_H
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.justifyContent = FlexJustify.SpaceBetween
    rowFlex.width = INNER_W
    rowFlex.height = ROW_H

    this.addLabel(row, "HealthLabel", "hud.health")

    const bar = this.child(row, "HealthBar")
    const barItem = bar.createComponent(FlexItem.getTypeName()) as FlexItem
    barItem.overrideWidth = BAR_W
    barItem.overrideHeight = BAR_H
    const track = createLightBacking(bar, this.trackColor)
    track.size = new vec2(BAR_W, BAR_H)
    track.cornerRadius = BAR_H / 2
    const fillObject = this.child(bar, "Fill")
    this.fillTransform = fillObject.getTransform()
    this.fill = createLightBacking(fillObject, this.barColor)
    this.fill.cornerRadius = BAR_H / 2
    this.fill.size = this.fillSize
    this.fillTransform.setLocalPosition(this.fillPos)

    this.addLabel(row, "TimerLabel", "hud.time")
    this.timerLabel = this.addText(row, "TimerText", "00:00", INSTRUCTION_EM_CM, TIMER_W, ROW_H, this.textColor, false)
  }

  /** Created after Panel so it draws on top; WARN_RAISE above eye level (center of view). */
  private buildBanner(): void {
    const banner = this.child(this.sceneObject, "WarningBanner")
    banner.getTransform().setLocalPosition(new vec3(0, (this.config ? this.config.hudBelowEye : 0) + WARN_RAISE, 0))
    const backing = createLightBacking(banner, this.backingColor)
    const content = this.child(banner, "Content")
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = this.column(content, ROW_GAP, PAD)
    flex.width = WARN_W + PAD * 2
    flex.onLayoutComplete.add((r) => {
      backing.size = new vec2(r.containerWidth, r.containerHeight)
    })
    const parts = splitBilingual(STRINGS["warn.quake"])
    this.addText(content, "Warning.id", parts.id, WARNING_EM_CM, WARN_W, WARN_ID_H, this.alarmColor, false)
    this.addText(content, "Warning.en", parts.en, WARNING_EM_CM * ENGLISH_SCALE, WARN_W, WARN_EN_H, this.alarmColor, false)
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
    const parts = splitBilingual(STRINGS[key])
    this.addText(so, name + ".id", parts.id, SMALL_EM_CM, LABEL_W, LABEL_ID_H, this.textColor, false)
    this.addText(so, name + ".en", parts.en, SMALL_EM_CM * ENGLISH_SCALE, LABEL_W, LABEL_EN_H, this.textColor, false)
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
