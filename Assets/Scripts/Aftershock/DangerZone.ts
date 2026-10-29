import {DrillConfig} from "./DrillConfig"
import {FOOTPRINTS, insideRect, LayoutItem} from "./LayoutGenerator"
import {lines, onLanguageChanged, setLinePair} from "./Strings"
import {BrutalFrame, BRUTAL_RED, BRUTAL_WHITE, createLightBacking} from "./UiBacking"

// DESIGN_BRIEF §5.2: labels use 2.5 cm type. size / 43.886 = em-square in cm.
const SIZE_PER_CM = 43.886
const LABEL_EM_CM = 2.5
const ENGLISH_SCALE = 0.8

// Zone look (cm). Not drill tunables: they only shape the visuals.
const FILL_LIFT = 0.3 // fill just above the floor
const OUTLINE_LIFT = 0.6 // outline above the fill (z-fighting)
const OUTLINE_W = 1.5
const LINE_GAP = 3 // primary line center to English line center
/** Half the danger label's height (cm), for HazardLabel.attachAbove (ENGINEERING_PLAN 5i item 1). */
export const DANGER_LABEL_HALF_H = LINE_GAP + 0.5 // half the red-outlined tag (Slice 7A)
const TAG_BORDER_CM = 0.3
const TAG_FILL = new vec4(1, 0, 0, 0.15)
const TAG_TEXT_Z = 0.1
const LABEL_W = 30
const FLAT = quat.angleAxis(-Math.PI / 2, vec3.right()) // a UI rectangle's +Z (its face) turned to +Y

/**
 * The red floor area around one hazard (ENGINEERING_PLAN Slice 5P): the
 * hazard's footprint (LayoutGenerator FOOTPRINTS) grown by dangerMargin, a
 * faint red fill, a red outline and a label.danger label, built at runtime.
 * Put it on a child of its hazard at local (0, 0, 0), unrotated: the hazard
 * is this object's parent. It owns no drill state: DrillController shows,
 * hides and asks contains().
 */
@component
export class DangerZone extends BaseScriptComponent {
  @ui.label("Danger zone around a hazard (R17)")
  @ui.separator
  @input
  @hint("DrillConfig component (dangerMargin)")
  config: DrillConfig

  @ui.group_start("Settings")
  @input
  @hint("Which hazard this zone guards (its footprint comes from LayoutGenerator)")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Cabinet", "cabinet"),
      new ComboBoxItem("Shelf", "shelf"),
      new ComboBoxItem("Glass", "glass")
    ])
  )
  kind: string = "cabinet"

  @input
  @hint("Floor fill: alarm red #FF5A4F, faint (DESIGN_BRIEF §5.1). Light colors only: the display is additive.")
  @widget(new ColorWidget())
  fillColor: vec4 = new vec4(1, 0, 0, 0.25)

  @input
  @hint("Outline and label: alarm red #FF5A4F")
  @widget(new ColorWidget())
  lineColor: vec4 = new vec4(1, 0, 0, 1)
  @ui.group_end

  private visual: SceneObject | null = null
  private _label: SceneObject | null = null
  private labelPrimary: Text
  private labelSecondary: Text
  private halfX = 0 // cm, zone half-size along the hazard's local X
  private halfZ = 0 // cm, along its local Z
  private restX = 0 // cm, world
  private restZ = 0 // cm, world
  private restYaw = 0 // radians, world
  private captured = false

  onAwake(): void {
    if (!this.config) {
      console.error("[Aftershock] DangerZone: config is not assigned")
      return
    }
    const f = FOOTPRINTS[this.item]
    if (!f) {
      console.error(`[Aftershock] DangerZone: unknown kind "${this.kind}"`)
      return
    }
    this.halfX = f.halfX + this.config.dangerMargin
    this.halfZ = f.halfZ + this.config.dangerMargin
    this.buildVisual()
    this.buildLabel()
  }

  /**
   * The upright label.danger label (Slice 5L, 5i item 1). DrillController sets it
   * above the hazard's HazardLabel; this zone still shows and hides it.
   */
  get label(): SceneObject | null {
    return this._label
  }

  /** The layout item this zone guards. */
  get item(): LayoutItem {
    return this.kind as LayoutItem
  }

  /** The hazard (this object's parent), or null. */
  get hazard(): SceneObject | null {
    return this.sceneObject.getParent()
  }

  /**
   * Stores the zone's rest center and heading. DrillController calls this on
   * entering BRIEFING after the layout, when the Room is at rest, so shaking
   * never flips contains().
   */
  captureRest(): void {
    const t = this.sceneObject.getTransform()
    const p = t.getWorldPosition()
    const localX = t.getWorldRotation().multiplyVec3(vec3.right())
    this.restX = p.x
    this.restZ = p.z
    this.restYaw = Math.atan2(-localX.z, localX.x) // local X = (cos yaw, −sin yaw)
    this.captured = true
  }

  /** True when the position's XZ is inside the rest zone (footprint grown by dangerMargin). */
  contains(position: vec3): boolean {
    return (
      this.captured &&
      insideRect(position.x, position.z, this.restX, this.restZ, this.restYaw, this.halfX, this.halfZ)
    )
  }

  show(): void {
    this.setShown(true)
  }

  hide(): void {
    this.setShown(false)
  }

  private setShown(shown: boolean): void {
    if (this.visual) {
      this.visual.enabled = shown
    }
    if (this._label) {
      this._label.enabled = shown
    }
  }

  // Read-only getter for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.visual !== null && this.visual.isEnabledInHierarchy
  }

  private buildVisual(): void {
    const visual = global.scene.createSceneObject("DangerZoneVisual")
    visual.setParent(this.sceneObject)
    const w = this.halfX * 2
    const d = this.halfZ * 2
    this.addRect(visual, "Fill", 0, FILL_LIFT, 0, w, d, this.fillColor)
    this.addRect(visual, "EdgeNear", 0, OUTLINE_LIFT, this.halfZ, w + OUTLINE_W, OUTLINE_W, this.lineColor)
    this.addRect(visual, "EdgeFar", 0, OUTLINE_LIFT, -this.halfZ, w + OUTLINE_W, OUTLINE_W, this.lineColor)
    this.addRect(visual, "EdgeLeft", -this.halfX, OUTLINE_LIFT, 0, OUTLINE_W, d + OUTLINE_W, this.lineColor)
    this.addRect(visual, "EdgeRight", this.halfX, OUTLINE_LIFT, 0, OUTLINE_W, d + OUTLINE_W, this.lineColor)
    visual.enabled = false
    this.visual = visual
  }

  /** A flat rectangle on the floor, `sizeX` along local X and `sizeZ` along local Z. */
  private addRect(parent: SceneObject, name: string, x: number, y: number, z: number, sizeX: number, sizeZ: number, color: vec4): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.getTransform()
    t.setLocalPosition(new vec3(x, y, z))
    t.setLocalRotation(FLAT) // rectangle Y runs along −Z, so its size stays (X, Z)
    const rect = createLightBacking(so, color)
    rect.size = new vec2(sizeX, sizeZ)
  }

  /** Upright label.danger, hidden until show(); placed by DrillController under the HazardLabel. */
  private buildLabel(): void {
    const so = global.scene.createSceneObject("DangerLabel")
    so.setParent(this.sceneObject)
    so.createComponent("Component.Canvas")
    const tag = new BrutalFrame(so, TAG_FILL, BRUTAL_RED, TAG_BORDER_CM)
    tag.setPlateVisible(false)
    tag.setSize(LABEL_W, DANGER_LABEL_HALF_H * 2)
    this.labelPrimary = this.addLine(so, "label.danger.id", 1)
    this.labelSecondary = this.addLine(so, "label.danger.en", ENGLISH_SCALE)
    so.enabled = false
    this._label = so
    this.refreshLabel()
    onLanguageChanged.add(() => this.refreshLabel())
  }

  /** Selected language on top, English below; with English selected one centered line. */
  private refreshLabel(): void {
    const l = lines("label.danger")
    setLinePair(this.labelPrimary, this.labelSecondary, l, "body")
    const two = l.secondary.length > 0
    this.labelPrimary.getSceneObject().getTransform().setLocalPosition(new vec3(0, two ? LINE_GAP / 2 : 0, TAG_TEXT_Z))
    this.labelSecondary.getSceneObject().getTransform().setLocalPosition(new vec3(0, -LINE_GAP / 2, TAG_TEXT_Z))
  }

  private addLine(parent: SceneObject, name: string, scale: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    t.size = LABEL_EM_CM * SIZE_PER_CM * scale
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = BRUTAL_WHITE // Slice 7A: white uppercase text on the red-outlined tag
    t.capitilizationOverride = CapitilizationOverride.AllUpper
    t.letterSpacing = 0.25
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-LABEL_W / 2, LABEL_W / 2, -LINE_GAP / 2, LINE_GAP / 2)
    return t
  }
}
