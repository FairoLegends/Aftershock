import {DrillConfig} from "./DrillConfig"
import {FOOTPRINTS, LayoutItem} from "./LayoutGenerator"
import {getLanguage, hazardFontFor, lines, onLanguageChanged, setLinePair, StringKey} from "./Strings"
import {createRoundRect, SOFT_GREEN, SOFT_RED, SOFT_WHITE, SoftFrame} from "./UiBacking"

// size / 43.886 = em-square in cm. 5m-3: the label is built at 1 cm per em and
// its Body scales to the distance em every frame (DrillConfig labelEm*).
const SIZE_PER_CM = 43.886
const LINE_H_PER_EM = 1.25 // as ResultPanel
const CM_PER_M = 100
const DEG_TO_RAD = Math.PI / 180

// Label layout, in em. Not drill tunables: they only shape the label.
// Slice 7A-soft (mockup .lbl), 5m-3: a light rounded panel, an icon or a dot, bold text.
const INNER_W = 13.6 // widest text; longer lines wrap
const PAD_X = 0.64
const PAD_Y = 0.4
const RADIUS = 0.56
const ICON_GAP = 0.4 // icon or dot to text
const CHAR_W = 0.55 // estimated character width until the text can be measured
const SLACK = 0.12 // keeps a measured line from wrapping
const CONTENT_Z = 0.24 // keeps content off the backing (z-fighting)
const DOT_PER_ICON = 0.5 // the safe and door dot, as a share of the ⚠ icon
const EM_STEP_CM = 0.02 // the Body rescales only past this change
const KEY_PREFIX = "label." // label.cabinet → the layout item "cabinet"

// The ⚠ icon, in shares of its height: a red triangle of stacked pills (rounded apex and sides) and a white "!".
const ICON_ROWS = 6
const TRI_W_PER_H = 1.155 // equilateral: 2 / √3
const BANG_W = 0.14
const BANG_STEM_TOP = 0.16
const BANG_STEM_BOTTOM = -0.22
const BANG_DOT_Y = -0.36
const BANG_Z = 0.05

/** What a label needs from the head (HeadPose). */
interface HeadLike {
  readonly position: vec3
  readonly forward: vec3
}

/** A hazard's measured box (cm above the floor) and its front and side directions in its anchor's frame. */
interface ItemBox {
  top: number
  sideX: number
  sideZ: number
  sideReach: number
  frontX: number
  frontZ: number
  frontReach: number
}

let ctxConfig: DrillConfig | null = null
let ctxHead: HeadLike | null = null
let ctxFloorY = 0

/** DrillController registers the tunables, the head and the floor height (cm, world) once at start (5m-3). */
export function setLabelContext(config: DrillConfig, head: HeadLike, floorY: number): void {
  ctxConfig = config
  ctxHead = head
  ctxFloorY = floorY
}

/**
 * A world-space label on a hazard, the safe zone or the exit door (R3, R4), in
 * the selected language only (5j-13d). 5m-3: a hazard label is a red ⚠ icon,
 * a red extra-bold hazard line and a smaller label.danger line on a light
 * backing; it sits labelGapCm above its item (beside it on the wall when that
 * is too high), stays upright and faces the head. Every label's em follows the
 * head distance each frame. 5m-4: in risotto mode a hazard label shrinks to its
 * ⚠ unless the head looks at it or is near. DrillController shows and hides it.
 */
@component
export class HazardLabel extends BaseScriptComponent {
  @ui.label("World label on a hazard, the safe zone or the door (R3, R4, 5m-3)")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Strings.ts key this label shows")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Cabinet", "label.cabinet"),
      new ComboBoxItem("Shelf", "label.shelf"),
      new ComboBoxItem("Glass", "label.glass"),
      new ComboBoxItem("Lamp", "label.lamp"),
      new ComboBoxItem("TV", "label.tv"),
      new ComboBoxItem("Safe zone", "label.safe"),
      new ComboBoxItem("Exit door", "label.door")
    ])
  )
  key: string = "label.cabinet"

  @input
  @hint("Safe zone text and dot color: green #3DDC84. Hazards use red #FF5A4F text and a red ⚠; the door is green (5m-3).")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(0.851, 0.282, 0.059, 1)
  @ui.group_end

  private readonly shownTexts: Text[] = []
  private body: SceneObject
  private backing: SoftFrame
  private icon: SceneObject // hazards: the ⚠; safe zone and door: a dot
  private primary: Text
  private secondary: Text
  private danger: Text | null = null
  private dangerEn: Text | null = null
  private ready = false // laid out with the tunables
  private fullW = 1 // em, backing of the full label
  private fullH = 1
  private iconX = 0 // em, icon center in the full label
  private iconY = 0
  private iconW = 1 // em
  private iconH = 1
  private em = 0 // cm, current
  private risotto = false
  private _collapsed = false
  private model: SceneObject | null = null
  private box: ItemBox | null = null
  private beside = false // 5m-8a: decided once per measured layout, at labelEmMaxCm

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.body = global.scene.createSceneObject("Body")
    this.body.setParent(this.sceneObject)
    this.backing = new SoftFrame(this.body, this.backingColor, RADIUS, null)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.body)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    this.icon = this.buildIcon(content)

    const key = this.key as StringKey
    const color = this.isHazard ? SOFT_RED : this.isDoor ? SOFT_GREEN : this.textColor
    this.primary = this.addLine(content, key + ".id", color)
    this.secondary = this.addLine(content, key + ".en", color)
    if (this.isHazard) {
      this.danger = this.addLine(content, key + ".danger", SOFT_RED)
      this.dangerEn = this.addLine(content, key + ".danger.en", SOFT_RED)
    }
    this.refresh()
    onLanguageChanged.add(() => this.refresh())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  show(): void {
    this.sceneObject.enabled = true
    this.refresh() // fonts are registered by now, so measure in the real font
    this.tick()
  }

  hide(): void {
    this.sceneObject.enabled = false
  }

  /**
   * 5m-4 risotto (Normal, quake to evacuation): on, a hazard label shows only
   * its ⚠ unless the head looks within labelFocusDeg of it or is nearer than
   * labelNearCm; off, the full label.
   */
  setRisotto(on: boolean): void {
    this.risotto = on
    if (!on && this._collapsed) {
      this._collapsed = false
      this.applyCollapse()
    }
  }

  /**
   * The item's model under this label's anchor (5m-3). The label measures it
   * on its next shown frame and sits labelGapCm above it, or beside it on the
   * wall when the center would pass labelMaxCenterCm. Null: the authored spot.
   */
  setModel(model: SceneObject | null): void {
    this.model = model
    this.box = null
    this.beside = false // 5m-8a: a new layout re-decides above vs beside
  }

  private get isHazard(): boolean {
    return this.key !== "label.safe" && !this.isDoor
  }

  /** Slice 8A exit door: a soft green dot and green text, never the hazard red. */
  private get isDoor(): boolean {
    return this.key === "label.door"
  }

  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }

  /** Read-only: the label's text lines, selected language first. */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text)
  }

  // Read-only getters for LEAF assertions (5m-3, 5m-4).
  /** The em size (cm) from the head distance, clamped to labelEmMinCm..labelEmMaxCm; 0 before the first frame. */
  get currentEmCm(): number {
    return this.em
  }
  /** White at labelBackingAlpha: never dark (the display is additive). */
  get backingColor(): vec4 {
    return new vec4(1, 1, 1, ctxConfig ? ctxConfig.labelBackingAlpha : 1)
  }
  get isCollapsed(): boolean {
    return this._collapsed
  }

  /**
   * Re-renders the key in the selected language and lays the label out in em:
   * the backing fits the icon and the measured text; a long line wraps inside
   * INNER_W. getBoundingBox: one call per Text per refresh (limit 5 per frame).
   */
  private refresh(): void {
    setLinePair(this.primary, this.secondary, lines(this.key as StringKey))
    if (this.danger && this.dangerEn) {
      const font = hazardFontFor(getLanguage())
      if (font) this.primary.font = font
      setLinePair(this.danger, this.dangerEn, lines("label.danger"))
    }
    const c = ctxConfig
    this.ready = c !== null
    this.backing.setFill(this.backingColor)
    const iconPerEm = c ? c.labelIconPerEm : 1
    this.iconH = this.isHazard ? iconPerEm : iconPerEm * DOT_PER_ICON
    this.iconW = this.isHazard ? this.iconH * TRI_W_PER_H : this.iconH

    this.primary.enabled = true
    const lineH = LINE_H_PER_EM
    const p = this.measure(this.primary, 1, lineH)
    let textW = p.w
    let textH = p.lines * lineH
    let dangerH = 0
    if (this.danger) {
      this.danger.enabled = true
      const r = c ? c.labelDangerEmRatio : 1
      this.danger.size = r * SIZE_PER_CM
      dangerH = r * lineH
      textW = Math.max(textW, this.measure(this.danger, r, dangerH).w)
      textH += dangerH
    }
    const contentH = Math.max(this.iconH, textH)
    const contentW = this.iconW + ICON_GAP + textW + SLACK
    const left = -contentW / 2
    const x0 = left + this.iconW + ICON_GAP
    this.iconX = left + this.iconW / 2
    this.iconY = this.isHazard ? 0 : (textH - lineH) / 2 // the dot by the first line
    const top = textH / 2
    const ph = p.lines * lineH
    this.placeText(this.primary, x0, top - ph / 2, ph)
    if (this.danger) {
      this.placeText(this.danger, x0, top - ph - dangerH / 2, dangerH)
    }
    this.fullW = contentW + PAD_X * 2
    this.fullH = contentH + PAD_Y * 2
    this.applyCollapse()
  }

  /** Width (em) and line count of a Text at `emScale` em, measured once shown, estimated before. */
  private measure(t: Text, emScale: number, lineH: number): {w: number; lines: number} {
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -lineH / 2, lineH / 2)
    const est = t.text.length * CHAR_W * emScale
    let w = Math.min(INNER_W, est)
    let n = Math.max(1, Math.ceil(est / INNER_W))
    if (t.text.length > 0 && this.sceneObject.isEnabledInHierarchy) {
      const box = t.getBoundingBox()
      if (box.right > box.left) {
        w = Math.min(INNER_W, box.right - box.left)
        n = Math.max(1, Math.round((box.top - box.bottom) / lineH))
      }
    }
    return {w: w, lines: n}
  }

  /** Left-aligned at `x0` (em), centered on `y`, `h` tall; wraps at INNER_W. */
  private placeText(t: Text, x0: number, y: number, h: number): void {
    t.getSceneObject().getTransform().setLocalPosition(new vec3(x0 + INNER_W / 2, y, 0))
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -h / 2, h / 2)
  }

  /** Full label, or the ⚠ alone on a small backing (5m-4). */
  private applyCollapse(): void {
    const full = !this._collapsed
    this.primary.enabled = full
    if (this.danger) this.danger.enabled = full
    const it = this.icon.getTransform()
    it.setLocalScale(new vec3(this.iconH, this.iconH, 1))
    it.setLocalPosition(full ? new vec3(this.iconX, this.iconY, 0) : vec3.zero())
    if (full) {
      this.backing.setSize(this.fullW, this.fullH)
    } else {
      this.backing.setSize(this.iconW + PAD_Y * 2, this.iconH + PAD_Y * 2)
    }
  }

  /** Every frame while shown: place (hazards), em from the head distance, risotto, upright facing the head. */
  private tick(): void {
    const c = ctxConfig
    const head = ctxHead
    if (!c || !head || !this.sceneObject.isEnabledInHierarchy) {
      return
    }
    if (!this.ready) this.refresh()
    if (this.model && !this.box) this.measureItem(c, head)
    if (this.box) this.place(c)
    const t = this.sceneObject.getTransform()
    const toLabel = t.getWorldPosition().sub(head.position)
    const d = toLabel.length
    const em = Math.min(c.labelEmMaxCm, Math.max(c.labelEmMinCm, (c.labelEmPerMeterCm * d) / CM_PER_M))
    if (Math.abs(em - this.em) > EM_STEP_CM) {
      this.em = em
      const s = em / Math.max(t.getWorldScale().x, EM_STEP_CM) // the Body's world em, whatever the label's scale
      this.body.getTransform().setLocalScale(new vec3(s, s, s))
    }
    const focused = d < c.labelNearCm || (d > 0 && toLabel.angleTo(head.forward) <= c.labelFocusDeg * DEG_TO_RAD)
    const collapsed = this.risotto && this.isHazard && !focused
    if (collapsed !== this._collapsed) {
      this._collapsed = collapsed
      this.applyCollapse()
    }
    if (this.box && toLabel.x * toLabel.x + toLabel.z * toLabel.z > 1e-4) {
      t.setWorldRotation(quat.angleAxis(Math.atan2(-toLabel.x, -toLabel.z), vec3.up())) // yaw only: +Z to the head
    }
  }

  /**
   * labelGapCm above the item's top, or (this.beside, 5m-8a) beside the item
   * at its front face, on the side of the head, centered at
   * min(labelBesideCenterCm, item top − half the label height) (5m-8b).
   */
  private place(c: DrillConfig): void {
    const b = this.box
    const anchor = this.sceneObject.getParent()
    if (!b || !anchor) {
      return
    }
    const em = this.em > 0 ? this.em : c.labelEmMinCm
    const w = this._collapsed ? this.iconW + PAD_Y * 2 : this.fullW
    const h = this._collapsed ? this.iconH + PAD_Y * 2 : this.fullH
    let cy = b.top + c.labelGapCm + (h * em) / 2
    let lx = 0
    let lz = 0
    if (this.beside) {
      cy = Math.min(c.labelBesideCenterCm, b.top - (h * em) / 2)
      const r = b.sideReach + c.labelGapCm + (w * em) / 2
      lx = b.sideX * r + b.frontX * b.frontReach
      lz = b.sideZ * r + b.frontZ * b.frontReach
    }
    const at = anchor.getTransform()
    const p = at.getWorldPosition().add(at.getWorldRotation().multiplyVec3(new vec3(lx, 0, lz)))
    this.sceneObject.getTransform().setWorldPosition(new vec3(p.x, ctxFloorY + cy, p.z))
  }

  /**
   * The model's mesh bounds (world, at rest in BRIEFING) and its footprint's
   * front and side, head side first. 5m-8a: above vs beside is decided here,
   * once, on the full label at labelEmMaxCm (the largest size).
   */
  private measureItem(c: DrillConfig, head: HeadLike): void {
    const anchor = this.sceneObject.getParent()
    const fp = FOOTPRINTS[this.key.slice(KEY_PREFIX.length) as LayoutItem]
    if (!this.model || !anchor || !fp) {
      this.model = null
      return
    }
    let top = -Infinity
    let bottom = Infinity
    const stack: SceneObject[] = [this.model]
    while (stack.length > 0) {
      const so = stack.pop()
      for (const v of so.getComponents("Component.RenderMeshVisual")) {
        top = Math.max(top, v.worldAabbMax().y)
        bottom = Math.min(bottom, v.worldAabbMin().y)
      }
      for (let i = 0; i < so.getChildrenCount(); i++) {
        stack.push(so.getChild(i))
      }
    }
    if (top < bottom) {
      this.model = null // no mesh: keep the authored spot
      return
    }
    const fx = Math.sin(fp.front) // the model's +Z front, turned by front (DrillController.addModel)
    const fz = Math.cos(fp.front)
    const at = anchor.getTransform()
    const side = at.getWorldRotation().multiplyVec3(new vec3(fz, 0, -fx))
    const sign = side.dot(head.position.sub(at.getWorldPosition())) < 0 ? -1 : 1
    this.box = {
      top: top - ctxFloorY,
      sideX: sign * fz,
      sideZ: -sign * fx,
      sideReach: Math.abs(fz) * fp.halfX + Math.abs(fx) * fp.halfZ,
      frontX: fx,
      frontZ: fz,
      frontReach: Math.abs(fx) * fp.halfX + Math.abs(fz) * fp.halfZ
    }
    this.beside = this.box.top + c.labelGapCm + (this.fullH * c.labelEmMaxCm) / 2 > c.labelMaxCenterCm
  }

  /** Hazards: the ⚠ (unit height, centered); safe zone and door: a unit dot. applyCollapse scales it. */
  private buildIcon(parent: SceneObject): SceneObject {
    const icon = global.scene.createSceneObject("Icon")
    icon.setParent(parent)
    if (!this.isHazard) {
      this.addIconPart(icon, "Dot", this.isDoor ? SOFT_GREEN : this.textColor, 0, 0, 1, 1)
      return icon
    }
    const rowH = 1 / ICON_ROWS
    for (let i = 0; i < ICON_ROWS; i++) {
      this.addIconPart(icon, "Tri" + i, SOFT_RED, 0.5 - (i + 0.5) * rowH, 0, (TRI_W_PER_H * (i + 1)) / ICON_ROWS, rowH)
    }
    const stemH = BANG_STEM_TOP - BANG_STEM_BOTTOM
    this.addIconPart(icon, "BangStem", SOFT_WHITE, (BANG_STEM_TOP + BANG_STEM_BOTTOM) / 2, BANG_Z, BANG_W, stemH)
    this.addIconPart(icon, "BangDot", SOFT_WHITE, BANG_DOT_Y, BANG_Z, BANG_W, BANG_W)
    return icon
  }

  /** A pill (radius half its height) centered at (0, y, z). */
  private addIconPart(parent: SceneObject, name: string, color: vec4, y: number, z: number, w: number, h: number): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, y, z))
    createRoundRect(so, color, w, h, h / 2)
  }

  private addLine(parent: SceneObject, name: string, color: vec4): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    t.size = SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = this.isHazard ? 800 : 700
    t.depthTest = true
    t.textFill.color = color
    t.horizontalAlignment = HorizontalAlignment.Left
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    this.shownTexts.push(t)
    return t
  }
}
