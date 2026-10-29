import {DrillConfig} from "./DrillConfig"
import {FOOTPRINTS, insideRect, LayoutItem} from "./LayoutGenerator"
import {lines, onLanguageChanged, setLinePair} from "./Strings"
import {createLightBacking, SOFT_BORDER_CM, SOFT_RED, SoftFrame} from "./UiBacking"

// size / 43.886 = em-square in cm. Slice 7A-soft: the danger label is a small
// red pill (mockup .tag), one language.
const SIZE_PER_CM = 43.886
const LABEL_EM_CM = 2
const LINE_H_PER_EM = 1.25

// Zone look (cm). Not drill tunables: they only shape the visuals.
const FILL_LIFT = 0.3 // fill just above the floor
const OUTLINE_LIFT = 0.6 // outline above the fill (z-fighting)
const OUTLINE_W = 1.5
const PILL_PAD_Y = 0.6
const PILL_PAD_X = 1.8
/** Half the danger label's height (cm), for HazardLabel.attachAbove (ENGINEERING_PLAN 5i item 1). */
export const DANGER_LABEL_HALF_H = (LABEL_EM_CM * LINE_H_PER_EM) / 2 + PILL_PAD_Y
const PILL_FILL = new vec4(SOFT_RED.x, SOFT_RED.y, SOFT_RED.z, 0.16)
const PILL_BORDER = new vec4(SOFT_RED.x, SOFT_RED.y, SOFT_RED.z, 0.7)
const PILL_TEXT_Z = 0.1
const LABEL_W = 30 // widest text slot; the pill shrinks to the text
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
      new ComboBoxItem("Glass", "glass"),
      new ComboBoxItem("Lamp", "lamp"),
      new ComboBoxItem("TV", "tv")
    ])
  )
  kind: string = "cabinet"

  @input
  @hint("Floor fill: alarm red #FF5A4F at 20% (Slice 7A-soft). Light colors only: the display is additive.")
  @widget(new ColorWidget())
  fillColor: vec4 = new vec4(1, 0.353, 0.31, 0.2)

  @input
  @hint("Floor outline: alarm red #FF5A4F")
  @widget(new ColorWidget())
  lineColor: vec4 = new vec4(1, 0.353, 0.31, 1)
  @ui.group_end

  private visual: SceneObject | null = null
  private _label: SceneObject | null = null
  private labelPrimary: Text
  private labelSecondary: Text
  private pill: SoftFrame
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
      if (shown) this.refreshLabel() // fonts are registered by now, so measure in the real font
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

  /** Upright label.danger pill, hidden until show(); placed by DrillController above the HazardLabel. */
  private buildLabel(): void {
    const so = global.scene.createSceneObject("DangerLabel")
    so.setParent(this.sceneObject)
    so.createComponent("Component.Canvas")
    // Slice 7A-soft (mockup .tag): red text on a red 16% pill with a thin red border.
    this.pill = new SoftFrame(so, PILL_FILL, DANGER_LABEL_HALF_H, PILL_BORDER)
    this.pill.setBorder(PILL_BORDER, SOFT_BORDER_CM)
    this.labelPrimary = this.addLine(so, "label.danger.id")
    this.labelSecondary = this.addLine(so, "label.danger.en")
    so.enabled = false
    this._label = so
    this.refreshLabel()
    onLanguageChanged.add(() => this.refreshLabel())
  }

  /** The selected language only (5j-13d); the pill shrinks to the measured text. */
  private refreshLabel(): void {
    setLinePair(this.labelPrimary, this.labelSecondary, lines("label.danger"))
    const t = this.labelPrimary
    let textW = t.text.length * LABEL_EM_CM * 0.6 // estimate until the text can be measured
    if (t.text.length > 0 && this._label && this._label.isEnabledInHierarchy) {
      const box = t.getBoundingBox()
      if (box.right > box.left) textW = box.right - box.left
    }
    this.pill.setSize(Math.min(LABEL_W, textW) + PILL_PAD_X * 2, DANGER_LABEL_HALF_H * 2)
  }

  private addLine(parent: SceneObject, name: string): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, PILL_TEXT_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    t.size = LABEL_EM_CM * SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = SOFT_RED
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const h = LABEL_EM_CM * LINE_H_PER_EM
    t.layoutRect = Rect.create(-LABEL_W / 2, LABEL_W / 2, -h / 2, h / 2)
    return t
  }
}
