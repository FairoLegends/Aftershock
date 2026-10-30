import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {QuakeShaker} from "./QuakeShaker"
import {createRoundRect} from "./UiBacking"

// Shake effects (Slice 8C, ENGINEERING_PLAN 5k item 4). DrillController hands
// over this drill's furniture models and the crack stages. Every frame the
// cabinet, shelf, TV and lamp models rock about their base (two sines per axis
// with random phases, scaled by QuakeShaker's envelope and strength) and settle
// back to rest within settleSeconds once the shake stops; the lamp's shade glow
// dims in random steps while shaking; the glass pane collects thin white crack
// lines, one set per stage. Only the model instances under the anchors move:
// the anchors, zones, labels and colliders stay still.

export type WobbleItem = "cabinet" | "shelf" | "tv" | "lamp"
export const WOBBLE_ITEMS: WobbleItem[] = ["cabinet", "shelf", "tv", "lamp"]

const LAMP_SHADE_Y = 145 // cm above the lamp's base: the middle of the shade
const GLOW_SIZE = 34 // cm, the round glow quad
const GLOW_OUT = 22 // cm toward the viewer from the shade's axis, so the opaque shade does not hide it
const GLOW_COLOR = new vec4(1, 0.82, 0.55, 0.38) // warm, soft
const FLICKER_MIN = 0.4 // dims to 40-100 % while shaking
const STEP_MIN = 0.08 // s, one flicker step
const STEP_MAX = 0.2
const FREQ_MIN = 1.3 // Hz, wobble sines
const FREQ_MAX = 2.7
const PANE_HALF = 58 // cm, crack lines stay inside the 120 cm pane
const PANE_Y = 150 // cm, the pane's center, GlassWindow-local
const CRACK_Z = -0.8 // cm, just in front of the pane on the room side (GlassWindow-local -Z)
const CRACK_COLOR = new vec4(1, 1, 1, 0.9)
const CRACK_W_MIN = 0.3 // cm, line width
const CRACK_W_MAX = 0.5
const CRACK_POOL = 64 // at most this many lines
const MAX_TIPS = 8 // line ends extended per stage
const MAX_STAGE = 4
const LOG = "[Aftershock]"

interface Wobbler {
  so: SceneObject
  rest: quat // the local rotation addModel set (front yaw)
  ampRad: number
  f: number[] // Hz: x1, x2, z1, z2
  p: number[] // rad, random phases
}

interface Tip {
  x: number
  y: number
  angle: number // rad, the line's direction at this end
}

interface Strip {
  so: SceneObject
  rect: RoundedRectangle
}

@component
export class ShakeFx extends BaseScriptComponent {
  @input
  @hint("QuakeShaker on the Room: isShaking, envelope and shakeStrength drive the wobble and flicker")
  shaker: QuakeShaker

  @input
  @allowUndefined
  @hint("GlassWindow anchor under the Room (its GlassPane child sits at local y 150): cracks go just in front of the pane")
  glassWindow: SceneObject

  @input
  @allowUndefined
  @hint("Camera object: the lamp glow turns to face it")
  viewer: SceneObject

  @ui.group_start("Wobble (degrees about local X and Z)")
  @input
  cabinetDeg: number = 1.5

  @input
  shelfDeg: number = 2

  @input
  tvDeg: number = 2.5

  @input
  lampDeg: number = 5

  @input
  @hint("Back to rest within this many seconds after the shake stops")
  settleSeconds: number = 0.5
  @ui.group_end

  private wobblers: Partial<Record<WobbleItem, Wobbler>> = {}
  private level = 0 // 0..1, envelope x strength while shaking, then eases to 0
  private moving = false // models are off their rest rotation
  private glow: SceneObject | null = null
  private glowRect: RoundedRectangle | null = null
  private flicker = 1
  private nextFlicker = 0
  private cracksRoot: SceneObject | null = null
  private strips: Strip[] = []
  private stripsUsed = 0
  private tips: Tip[] = []
  private impacts: vec2[] = []
  private _crackStage = 0

  // Read-only getters for LEAF assertions (TDD §8).
  /** Wobble or flicker running: shaking, or still settling back to rest. */
  get shakeFxActive(): boolean {
    return this.level > 0 || (!!this.shaker && this.shaker.isShaking)
  }
  /** Crack stages shown on the glass: 0 (clean) to 4. */
  get crackStage(): number {
    return this._crackStage
  }
  /** Crack lines on the glass. */
  get crackLines(): number {
    return this.stripsUsed
  }

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** addModel: this drill's model instance for a wobbling item (bottom-centered, under its anchor). */
  setModel(item: WobbleItem, so: SceneObject): void {
    const deg = {cabinet: this.cabinetDeg, shelf: this.shelfDeg, tv: this.tvDeg, lamp: this.lampDeg}[item]
    const f: number[] = []
    const p: number[] = []
    for (let k = 0; k < 4; k++) {
      f.push(FREQ_MIN + Math.random() * (FREQ_MAX - FREQ_MIN))
      p.push(Math.random() * Math.PI * 2)
    }
    this.wobblers[item] = {so, rest: so.getTransform().getLocalRotation(), ampRad: (deg * Math.PI) / 180, f, p}
    if (item === "lamp") {
      this.showGlow(so)
    }
  }

  /** Slice 9A: the toppled TV stops wobbling; its topple owns the model's rotation until the next layout. */
  stopWobble(item: WobbleItem): void {
    delete this.wobblers[item]
  }

  /** applyLayout, before the old models are destroyed. */
  clearModels(): void {
    this.wobblers = {}
    this.moving = false
    if (this.glow) {
      this.glow.enabled = false
    }
  }

  /** Shows crack stages up to n (1-3 in the QUAKE, 4 in an AFTERSHOCK). Returns true when a new stage appeared. */
  setCrackStage(n: number): boolean {
    const target = Math.min(MAX_STAGE, Math.round(n))
    if (target <= this._crackStage) {
      return false
    }
    while (this._crackStage < target) {
      this._crackStage++
      this.buildStage(this._crackStage)
    }
    console.log(`${LOG} cracks: stage ${this._crackStage}, ${this.stripsUsed} lines`)
    return true
  }

  /** BRIEFING: clean glass. */
  resetCracks(): void {
    for (const s of this.strips) {
      s.so.enabled = false
    }
    this.stripsUsed = 0
    this.tips = []
    this.impacts = []
    this._crackStage = 0
  }

  private onUpdate(): void {
    const s = this.shaker
    const shaking = !!s && s.isShaking
    if (shaking) {
      this.level = Math.max(0, s.envelope * s.shakeStrength)
    } else if (this.level > 0) {
      this.level = Math.max(0, this.level - getDeltaTime() / Math.max(0.01, this.settleSeconds))
    }
    const now = getTime()
    if (this.level > 0) {
      this.wobble(now)
      this.moving = true
    } else if (this.moving) {
      this.toRest()
      this.moving = false
    }
    this.updateGlow(now, shaking)
  }

  private wobble(now: number): void {
    const w2 = Math.PI * 2 * now
    for (const item of WOBBLE_ITEMS) {
      const w = this.wobblers[item]
      if (!w) {
        continue
      }
      const a = w.ampRad * this.level
      const ax = a * (0.65 * Math.sin(w2 * w.f[0] + w.p[0]) + 0.35 * Math.sin(w2 * w.f[1] + w.p[1]))
      const az = a * (0.65 * Math.sin(w2 * w.f[2] + w.p[2]) + 0.35 * Math.sin(w2 * w.f[3] + w.p[3]))
      const off = quat.angleAxis(ax, vec3.right()).multiply(quat.angleAxis(az, vec3.forward()))
      w.so.getTransform().setLocalRotation(w.rest.multiply(off))
    }
  }

  private toRest(): void {
    for (const item of WOBBLE_ITEMS) {
      const w = this.wobblers[item]
      if (w) {
        w.so.getTransform().setLocalRotation(w.rest)
      }
    }
  }

  /** The GLB's material is shared with the lamp's pole, so a soft warm round quad stands in for the shade's glow. */
  private showGlow(lamp: SceneObject): void {
    const anchor = lamp.getParent()
    if (!anchor) {
      return
    }
    if (!this.glow) {
      this.glow = global.scene.createSceneObject("LampGlow")
      this.glowRect = createRoundRect(this.glow, GLOW_COLOR, GLOW_SIZE, GLOW_SIZE, GLOW_SIZE / 2)
    }
    this.glow.setParent(anchor)
    this.glow.getTransform().setWorldScale(vec3.one())
    this.glow.enabled = true
    this.flicker = 1
    this.glowRect.backgroundColor = GLOW_COLOR
  }

  private updateGlow(now: number, shaking: boolean): void {
    const lamp = this.wobblers.lamp
    if (!lamp || !this.glow || !this.glow.enabled) {
      return
    }
    let k = 1
    if (shaking) {
      if (now >= this.nextFlicker) {
        this.flicker = FLICKER_MIN + Math.random() * (1 - FLICKER_MIN)
        this.nextFlicker = now + STEP_MIN + Math.random() * (STEP_MAX - STEP_MIN)
      }
      k = this.flicker
    } else {
      this.flicker = 1
    }
    const c = GLOW_COLOR
    this.glowRect.backgroundColor = new vec4(c.x, c.y, c.z, c.w * k)

    // The shade follows the lamp's wobble: its rotation about the base, in the anchor's space.
    const anchorT = lamp.so.getParent().getTransform()
    const shade = lamp.so.getTransform().getLocalRotation().multiplyVec3(new vec3(0, LAMP_SHADE_Y, 0))
    let pos = anchorT.getWorldTransform().multiplyPoint(shade)
    const gt = this.glow.getTransform()
    if (this.viewer) {
      const d = this.viewer.getTransform().getWorldPosition().sub(pos)
      const flat = new vec3(d.x, 0, d.z)
      if (flat.length > 1) {
        const dir = flat.normalize()
        pos = pos.add(dir.uniformScale(GLOW_OUT))
        gt.setWorldRotation(quat.lookAt(dir, vec3.up()))
      }
    }
    gt.setWorldPosition(pos)
  }

  /** Stage 1: 1-2 impact points with 3 rays each. Later stages extend the line ends (some branch) and add a ray per impact. */
  private buildStage(stage: number): void {
    if (!this.glassWindow) {
      return
    }
    if (stage === 1) {
      const n = 1 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n; i++) {
        const c = new vec2((Math.random() * 2 - 1) * 35, (Math.random() * 2 - 1) * 35)
        this.impacts.push(c)
        const a0 = Math.random() * Math.PI * 2
        for (let j = 0; j < 3; j++) {
          this.ray(c.x, c.y, a0 + (j * Math.PI * 2) / 3 + (Math.random() - 0.5) * 0.8, 10 + Math.random() * 12)
        }
      }
      return
    }
    const tips = this.tips.slice(-MAX_TIPS)
    this.tips = []
    const longest = stage >= 3 ? 40 : 30
    for (const tip of tips) {
      this.ray(tip.x, tip.y, tip.angle + (Math.random() - 0.5) * 0.9, 10 + Math.random() * (longest - 10))
      if (Math.random() < 0.5) {
        const side = Math.random() < 0.5 ? -1 : 1
        this.ray(tip.x, tip.y, tip.angle + side * (0.6 + Math.random() * 0.5), 10 + Math.random() * 15)
      }
    }
    for (const c of this.impacts) {
      this.ray(c.x, c.y, Math.random() * Math.PI * 2, 12 + Math.random() * 18)
    }
  }

  /** One line from (x, y) at angle, shortened to stay on the pane; its end becomes a tip. */
  private ray(x: number, y: number, angle: number, length: number): void {
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    let len = length
    if (dx > 1e-3) len = Math.min(len, (PANE_HALF - x) / dx)
    if (dx < -1e-3) len = Math.min(len, (-PANE_HALF - x) / dx)
    if (dy > 1e-3) len = Math.min(len, (PANE_HALF - y) / dy)
    if (dy < -1e-3) len = Math.min(len, (-PANE_HALF - y) / dy)
    if (len < 4 || this.stripsUsed >= CRACK_POOL) {
      return
    }
    const w = CRACK_W_MIN + Math.random() * (CRACK_W_MAX - CRACK_W_MIN)
    const strip = this.takeStrip(len, w)
    const t = strip.so.getTransform()
    t.setLocalPosition(new vec3(x + (dx * len) / 2, y + (dy * len) / 2, 0))
    t.setLocalRotation(quat.angleAxis(angle, vec3.forward()))
    strip.so.enabled = true
    this.tips.push({x: x + dx * len, y: y + dy * len, angle})
  }

  private takeStrip(len: number, w: number): Strip {
    if (!this.cracksRoot) {
      // Facing the room: GlassWindow-local -Z is the room side, and the rect faces its own +Z.
      this.cracksRoot = global.scene.createSceneObject("Cracks")
      this.cracksRoot.setParent(this.glassWindow)
      const t = this.cracksRoot.getTransform()
      t.setLocalPosition(new vec3(0, PANE_Y, CRACK_Z))
      t.setLocalRotation(quat.angleAxis(Math.PI, vec3.up()))
      t.setLocalScale(vec3.one())
    }
    const i = this.stripsUsed++
    if (i < this.strips.length) {
      const s = this.strips[i]
      s.rect.size = new vec2(len, w)
      s.rect.cornerRadius = w / 2
      return s
    }
    const so = global.scene.createSceneObject("Crack" + i)
    so.setParent(this.cracksRoot)
    const rect = createRoundRect(so, CRACK_COLOR, len, w, w / 2)
    const s = {so, rect}
    this.strips.push(s)
    return s
  }
}
