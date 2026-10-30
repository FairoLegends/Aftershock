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
// the anchors, zones, labels and colliders stay still. 5l-7a: at an
// aftershock's stage 4 the pane breaks; its shards fall into the glass danger
// zone and stay on the floor until the next BRIEFING.

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
const SHARDS_MIN = 8 // 5l-7a: shards when the pane breaks
const SHARDS_MAX = 14
const SHARD_MIN = 4 // cm, a shard's side
const SHARD_MAX = 12
const SHARD_COLOR = new vec4(0.75, 0.9, 1, 0.55) // light blue, light tint
const SHARD_GRAVITY = 980 // cm/s², as FallingObjects
const SHARD_FLOOR_Y = 0.4 // cm, just over the floor so they do not z-fight it
const SHARD_EDGE = 6 // cm, landing spots stay this far inside the danger zone
const SHARD_SPIN = 6 // rad/s, the most a shard turns about each axis while falling
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

interface Shard {
  so: SceneObject
  rect: RoundedRectangle
  from: vec3 // GlassWindow-local, on the pane
  to: vec3 // GlassWindow-local, on the floor
  fallSeconds: number
  yaw0: number // rad
  tilt0: number
  spinY: number // rad/s
  spinX: number
  landed: boolean
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
  private shardsRoot: SceneObject | null = null
  private shards: Shard[] = []
  private shardsUsed = 0
  private breakTime = 0
  private _glassBroken = false

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
  /** 5l-7a: the pane broke this drill (an aftershock's crack stage 4). */
  get glassBroken(): boolean {
    return this._glassBroken
  }
  /** Shards from the broken pane, falling or on the floor. */
  get shardCount(): number {
    return this.shardsUsed
  }
  /** The GlassPane child is showing (false once broken). */
  get paneShown(): boolean {
    const pane = this.pane()
    return !!pane && pane.enabled
  }

  /** Room-local XZ (cm) of the shards on the floor; x, z as FallingObjects.landedPoints. */
  shardPoints(): {x: number; z: number}[] {
    const out: {x: number; z: number}[] = []
    const room = this.glassWindow ? this.glassWindow.getParent() : null
    if (!room) {
      return out
    }
    const toRoom = room.getTransform().getInvertedWorldTransform()
    for (let i = 0; i < this.shardsUsed; i++) {
      const s = this.shards[i]
      if (s.landed) {
        const p = toRoom.multiplyPoint(s.so.getTransform().getWorldPosition())
        out.push({x: p.x, z: p.z})
      }
    }
    return out
  }

  /**
   * 5l-7a: the pane breaks. Hides the pane and its cracks; SHARDS_MIN..MAX
   * shards fall from it under gravity, spinning, into the glass danger zone
   * (the room side, `zoneDepth` cm deep from the pane) and lie flat there until
   * resetGlass. Returns false if the glass is already broken or there is none.
   */
  breakGlass(zoneDepth: number): boolean {
    if (this._glassBroken || !this.glassWindow) {
      return false
    }
    this._glassBroken = true
    const pane = this.pane()
    if (pane) {
      pane.enabled = false
    }
    if (this.cracksRoot) {
      this.cracksRoot.enabled = false
    }
    if (!this.shardsRoot) {
      this.shardsRoot = global.scene.createSceneObject("Shards")
      this.shardsRoot.setParent(this.glassWindow)
      const t = this.shardsRoot.getTransform()
      t.setLocalPosition(vec3.zero())
      t.setLocalRotation(quat.quatIdentity())
      t.setLocalScale(vec3.one())
    }
    this.shardsRoot.enabled = true
    const near = SHARD_EDGE
    const far = Math.max(near + 4, zoneDepth - SHARD_EDGE)
    const n = SHARDS_MIN + Math.floor(Math.random() * (SHARDS_MAX - SHARDS_MIN + 1))
    for (let i = 0; i < n; i++) {
      const s = this.takeShard(i)
      const from = new vec3((Math.random() * 2 - 1) * PANE_HALF, PANE_Y + (Math.random() * 2 - 1) * PANE_HALF, CRACK_Z)
      const to = new vec3((Math.random() * 2 - 1) * (PANE_HALF - SHARD_EDGE), SHARD_FLOOR_Y + i * 0.02, -(near + Math.random() * (far - near)))
      s.from = from
      s.to = to
      s.fallSeconds = Math.sqrt((2 * (from.y - to.y)) / SHARD_GRAVITY)
      s.yaw0 = Math.random() * Math.PI * 2
      s.tilt0 = Math.random() * Math.PI * 2
      s.spinY = (Math.random() * 2 - 1) * SHARD_SPIN
      s.spinX = (Math.random() * 2 - 1) * SHARD_SPIN
      s.landed = false
      this.placeShard(s, 0)
      s.so.enabled = true
    }
    this.shardsUsed = n
    this.breakTime = getTime()
    console.log(`${LOG} glass: broke, ${n} shards`)
    return true
  }

  /** BRIEFING and Restart: the pane back, no shards. */
  resetGlass(): void {
    for (const s of this.shards) {
      s.so.enabled = false
    }
    this.shardsUsed = 0
    this._glassBroken = false
    const pane = this.pane()
    if (pane) {
      pane.enabled = true
    }
    if (this.cracksRoot) {
      this.cracksRoot.enabled = true
    }
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
    this.updateShards(now)
  }

  private updateShards(now: number): void {
    const t = now - this.breakTime
    for (let i = 0; i < this.shardsUsed; i++) {
      const s = this.shards[i]
      if (!s.landed) {
        this.placeShard(s, t)
      }
    }
  }

  /** A shard `t` s after the break: gravity down from the pane, a straight line across, spinning; flat once it lands. */
  private placeShard(s: Shard, t: number): void {
    const tr = s.so.getTransform()
    if (t >= s.fallSeconds) {
      s.landed = true
      tr.setLocalPosition(s.to)
      // Flat on the floor: the rect faces its own +Z, turned to face up, then a random yaw.
      tr.setLocalRotation(quat.angleAxis(s.yaw0 + s.spinY * s.fallSeconds, vec3.up()).multiply(quat.angleAxis(-Math.PI / 2, vec3.right())))
      return
    }
    const k = t / Math.max(0.01, s.fallSeconds)
    const y = s.from.y - 0.5 * SHARD_GRAVITY * t * t
    tr.setLocalPosition(new vec3(s.from.x + (s.to.x - s.from.x) * k, y, s.from.z + (s.to.z - s.from.z) * k))
    tr.setLocalRotation(quat.angleAxis(s.yaw0 + s.spinY * t, vec3.up()).multiply(quat.angleAxis(s.tilt0 + s.spinX * t, vec3.right())))
  }

  private takeShard(i: number): Shard {
    const w = SHARD_MIN + Math.random() * (SHARD_MAX - SHARD_MIN)
    const h = SHARD_MIN + Math.random() * (SHARD_MAX - SHARD_MIN)
    const r = Math.min(w, h) * 0.12
    if (i < this.shards.length) {
      const s = this.shards[i]
      s.rect.size = new vec2(w, h)
      s.rect.cornerRadius = r
      return s
    }
    const so = global.scene.createSceneObject("Shard" + i)
    so.setParent(this.shardsRoot)
    const rect = createRoundRect(so, SHARD_COLOR, w, h, r)
    const s: Shard = {so, rect, from: vec3.zero(), to: vec3.zero(), fallSeconds: 0, yaw0: 0, tilt0: 0, spinY: 0, spinX: 0, landed: false}
    this.shards.push(s)
    return s
  }

  /** The GlassWindow's GlassPane child. */
  private pane(): SceneObject | null {
    if (!this.glassWindow) {
      return null
    }
    for (let i = 0; i < this.glassWindow.getChildrenCount(); i++) {
      const child = this.glassWindow.getChild(i)
      if (child.name === "GlassPane") {
        return child
      }
    }
    return null
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
