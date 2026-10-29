import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {getLanguage, lines, onLanguageChanged, setLineText} from "./Strings"
import {createLightBacking, createRoundRect, drawOnTopWhenReady, SOFT_LINE, SOFT_RED, SOFT_WHITE, SoftFrame} from "./UiBacking"

// ENGINEERING_PLAN 5j items 4 and 17d: at the start of BRIEFING a soft light
// ring sweeps out over the floor from the start spot. Each item it reaches is
// revealed: hazards get four red corner brackets and their label, tables their
// safe-zone marker. A head-locked chip counts the hazards (scan.title n/N).
// Visual only; DrillController starts the quake wait after the scan.

const SIZE_PER_CM = 43.886 // size / 43.886 = em-square in cm
const FLAT = quat.angleAxis(-Math.PI / 2, vec3.right()) // rect face up on the floor
const RING_COLOR = new vec4(0.85, 1, 0.9, 0.8)
const RING_FILL = new vec4(0.85, 1, 0.9, 0.06)
const RING_BORDER_CM = 3
const RING_LIFT_CM = 1
const RING_REACH_CM = 40 // the ring ends this far past the farthest item
const RING_MIN_CM = 150
const BRACKET_W_CM = 1.2
const BRACKET_ARM_CM = 25
const BRACKET_PAD_CM = 4
const BRACKET_LIFT_CM = 1
const CHIP_FILL = new vec4(1, 1, 1, 0.16)
const CHIP_EM_CM = 2.2
const CHIP_H_CM = 5
const CHIP_PAD_X_CM = 2.5
const CHIP_POS = new vec3(-14, 26, -110) // camera-local: upper left of the view

/** One thing the scan reveals. Hazards count toward n/N and get brackets. */
export interface ScanItem {
  pos: vec3
  hazard: boolean
  reveal: () => void
  /** Hazards: the danger zone object (at the hazard origin, turning with it) and the footprint half sizes (cm). */
  bracketParent?: SceneObject
  halfX?: number
  halfZ?: number
}

@component
export class ScanIntro extends BaseScriptComponent {
  @ui.label("Scan intro at the start of BRIEFING (5j-4)")
  @ui.separator
  @input
  @hint("DrillConfig component")
  config: DrillConfig

  @input
  @hint("HeadPose component; the chip hangs under its camera object")
  headPose: HeadPose

  private update: UpdateEvent
  private ring: SceneObject | null = null
  private ringRect: RoundedRectangle | null = null
  private chip: SceneObject | null = null
  private chipFrame: SoftFrame | null = null
  private chipText: Text | null = null
  private readonly brackets: SceneObject[] = []
  private items: {item: ScanItem; dist: number; done: boolean}[] = []
  private startTime = 0
  private seconds = 3
  private maxR = RING_MIN_CM
  private _active = false
  private _count = 0
  private _total = 0

  onAwake(): void {
    this.update = this.createEvent("UpdateEvent")
    this.update.bind(() => this.onUpdate())
    this.update.enabled = false
    onLanguageChanged.add(() => this.refreshChip())
  }

  get scanActive(): boolean {
    return this._active
  }
  get scanCount(): number {
    return this._count
  }
  get scanTotal(): number {
    return this._total
  }

  /** Sweeps out from `center` (floor level) over `seconds`, revealing `items` as the ring reaches them. */
  start(center: vec3, items: ScanItem[], seconds: number): void {
    this.stop()
    this.hideBrackets()
    this.seconds = Math.max(0.05, seconds)
    this.items = items.map((item) => ({
      item: item,
      dist: Math.hypot(item.pos.x - center.x, item.pos.z - center.z),
      done: false
    }))
    let far = 0
    for (const e of this.items) far = Math.max(far, e.dist)
    this.maxR = Math.max(RING_MIN_CM, far + RING_REACH_CM)
    this._total = items.filter((i) => i.hazard).length
    this._count = 0
    this.ensureRing()
    this.ring.getTransform().setWorldPosition(new vec3(center.x, center.y + RING_LIFT_CM, center.z))
    this.setRingRadius(1)
    this.ring.enabled = true
    this.ensureChip()
    this.chip.enabled = true
    this.refreshChip()
    drawOnTopWhenReady(this, this.chip)
    this.startTime = getTime()
    this._active = true
    this.update.enabled = true
  }

  /** Ends the scan without revealing the rest (guides off, state change). Brackets stay until hideBrackets(). */
  stop(): void {
    this._active = false
    this.update.enabled = false
    if (this.ring) this.ring.enabled = false
    if (this.chip) this.chip.enabled = false
  }

  /** Reveals everything at once and ends the scan. */
  finishNow(): void {
    if (!this._active) return
    for (const e of this.items) this.revealItem(e)
    this.stop()
  }

  /** Hides every hazard bracket (the quake starts). */
  hideBrackets(): void {
    for (const b of this.brackets) b.enabled = false
  }

  private onUpdate(): void {
    const t = (getTime() - this.startTime) / this.seconds
    if (t >= 1) {
      this.finishNow()
      return
    }
    const r = this.maxR * t
    this.setRingRadius(r)
    for (const e of this.items) {
      if (!e.done && r >= e.dist) this.revealItem(e)
    }
  }

  private revealItem(e: {item: ScanItem; dist: number; done: boolean}): void {
    if (e.done) return
    e.done = true
    e.item.reveal()
    if (e.item.hazard) {
      this._count++
      if (e.item.bracketParent) this.showBracket(e.item.bracketParent, e.item.halfX || 30, e.item.halfZ || 30)
      this.refreshChip()
    }
  }

  private setRingRadius(r: number): void {
    const d = Math.max(2, r * 2)
    this.ringRect.size = new vec2(d, d)
    this.ringRect.cornerRadius = d / 2
    this.ringRect.borderSize = Math.min(RING_BORDER_CM, d / 4)
  }

  private ensureRing(): void {
    if (this.ring) return
    this.ring = global.scene.createSceneObject("ScanRing")
    this.ring.setParent(this.getSceneObject())
    this.ring.getTransform().setWorldRotation(FLAT)
    this.ringRect = createRoundRect(this.ring, RING_FILL, 2, 2, 1)
    this.ringRect.border = true
    this.ringRect.borderColor = RING_COLOR
    this.ringRect.borderSize = RING_BORDER_CM
    this.ringRect.borderSoftness = 0.5
  }

  /** Four red L corners around the footprint, built once per hazard and kept under its zone object. */
  private showBracket(parent: SceneObject, halfX: number, halfZ: number): void {
    const name = "ScanBrackets"
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      const child = parent.getChild(i)
      if (child.name === name) {
        child.enabled = true
        return
      }
    }
    const root = global.scene.createSceneObject(name)
    root.setParent(parent)
    root.getTransform().setLocalPosition(new vec3(0, BRACKET_LIFT_CM, 0))
    const hx = halfX + BRACKET_PAD_CM
    const hz = halfZ + BRACKET_PAD_CM
    const arm = Math.min(BRACKET_ARM_CM, 0.4 * hx * 2, 0.4 * hz * 2)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // Along X from the corner, then along Z.
        this.addBar(root, sx * (hx - arm / 2), sz * (hz - BRACKET_W_CM / 2), arm, BRACKET_W_CM)
        this.addBar(root, sx * (hx - BRACKET_W_CM / 2), sz * (hz - arm / 2), BRACKET_W_CM, arm)
      }
    }
    this.brackets.push(root)
  }

  private addBar(root: SceneObject, x: number, z: number, sizeX: number, sizeZ: number): void {
    const so = global.scene.createSceneObject("Bar")
    so.setParent(root)
    const t = so.getTransform()
    t.setLocalPosition(new vec3(x, 0, z))
    t.setLocalRotation(FLAT)
    const rect = createLightBacking(so, SOFT_RED)
    rect.size = new vec2(sizeX, sizeZ)
    rect.cornerRadius = 0
    rect.renderOrder = 2 // after the danger zone fills
  }

  private ensureChip(): void {
    if (this.chip) return
    this.chip = global.scene.createSceneObject("ScanChip")
    this.chip.setParent(this.headPose.cameraObject)
    this.chip.getTransform().setLocalPosition(CHIP_POS)
    this.chip.getTransform().setLocalRotation(quat.quatIdentity())
    this.chipFrame = new SoftFrame(this.chip, CHIP_FILL, CHIP_H_CM / 2, SOFT_LINE, "ChipFace")
    const so = global.scene.createSceneObject("scan.title")
    so.setParent(this.chip)
    so.getTransform().setLocalPosition(new vec3(0, 0, 0.1))
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    t.size = CHIP_EM_CM * SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = 600
    t.depthTest = true
    t.textFill.color = SOFT_WHITE
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-20, 20, -CHIP_H_CM / 2, CHIP_H_CM / 2)
    this.chipText = t
    this.chip.enabled = false
  }

  /** "Memindai ruangan 2/4"; the pill fits the text. */
  private refreshChip(): void {
    if (!this.chipText) return
    const text = lines("scan.title").primary + " " + this._count + "/" + this._total
    setLineText(this.chipText, text, getLanguage())
    const w = text.length * CHIP_EM_CM * 0.55 + CHIP_PAD_X_CM * 2
    this.chipFrame.setSize(w, CHIP_H_CM)
  }
}
