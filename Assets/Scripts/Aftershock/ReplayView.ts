import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {ReplaySample, ReplayTrack} from "./ReplayTrack"
import {getLanguage, getString, onLanguageChanged, setLineText, StringKey} from "./Strings"
import {createRoundRect, drawOnTopWhenReady, PinchGuard, SOFT_GREEN, SOFT_RED, SoftButton, SoftFrame} from "./UiBacking"

// Slice 13B (ENGINEERING_PLAN 5m item 12): the ghost replay on the room floor.
// The trail draws over replaySeconds (arc length, not drill time) with a head
// dot leading it, green where safe and red where in danger, small white dots
// along it and rings where items landed, the user was hit and took cover. A
// small light caption panel says one line and has a Lewati (skip) button. All
// shapes are pooled: built parked and enabled once (a UI Kit shape makes its
// visual on its own OnStartEvent), then hidden. Soft palette, never dark.

const FLAT = quat.angleAxis(-Math.PI / 2, vec3.right()) // rect face up on the floor
const PARKED = new vec3(0, -100000, 0)
const POOL_SEG = 160
const POOL_DOT = 64
const POOL_MARK = 12
const PARK_SECONDS = 0.5 // pools hide once their shapes have started
const SAFE_COLOR = new vec4(SOFT_GREEN.x, SOFT_GREEN.y, SOFT_GREEN.z, 0.85)
const DANGER_COLOR = new vec4(SOFT_RED.x, SOFT_RED.y, SOFT_RED.z, 0.9)
const DOT_COLOR = new vec4(1, 1, 1, 0.95)
const DOT_PER_LINE = 1.5 // dot diameter as a multiple of the line width
const HEAD_PER_LINE = 2.6
const RING_CM = 2 // marker ring stroke
const RING_FILL_ALPHA = 0.2
const ORDER_SEG = 3 // after the danger zone fills (0), like the floor path
const ORDER_DOT = 4
const ORDER_MARK = 5
const ORDER_HEAD = 6

// Caption panel (cm at 110 cm), as CalibratePanel. Not drill tunables: they only shape this panel.
const CAPTION_W = 42
const PAD = 2.5
const TEXT_H = 3
const GAP = 1.6
const BUTTON_W = 16
const BUTTON_H = 5
const CAPTION_H = PAD + TEXT_H + GAP + BUTTON_H + PAD
const CONTENT_Z = 0.6
const BUTTON_LABEL_Z = 0.08
const TEXT_SIZE = 44
const CAPTION_FILL = new vec4(1, 1, 1, 0.25)

interface Placed {
  start: number // arc length at the segment's first point (cm)
  len: number
  a: vec3
  ux: number
  uz: number
  danger: boolean
}

export class ReplayView {
  private readonly root: SceneObject
  private readonly segs: RoundedRectangle[] = []
  private readonly dots: RoundedRectangle[] = []
  private readonly marks: RoundedRectangle[] = []
  private readonly head: RoundedRectangle
  private readonly caption: SceneObject
  private readonly captionText: Text
  private readonly skipButton: SoftButton
  private readonly guard = new PinchGuard()
  private readonly update: SceneEvent
  private placed: Placed[] = []
  private dotAt: number[] = []
  private markAt: number[] = []
  private points: ReplaySample[] = []
  private total = 0
  private y = 0
  private toWorld: (x: number, z: number) => vec3 = () => vec3.zero()
  private startedAt = -1
  private _captionKey: StringKey | null = null
  private onDone: (() => void) | null = null

  constructor(
    private readonly owner: BaseScriptComponent,
    private readonly config: DrillConfig,
    private readonly headPose: HeadPose
  ) {
    this.root = global.scene.createSceneObject("GhostReplay")
    const w = config.replayLineWidthCm
    for (let i = 0; i < POOL_SEG; i++) this.segs.push(this.shape("Seg" + i, SAFE_COLOR, w, w, ORDER_SEG))
    const dot = w * DOT_PER_LINE
    for (let i = 0; i < POOL_DOT; i++) this.dots.push(this.shape("Dot" + i, DOT_COLOR, dot, dot, ORDER_DOT))
    const m = config.replayMarkerCm
    for (let i = 0; i < POOL_MARK; i++) this.marks.push(this.shape("Mark" + i, SOFT_RED, m, m, ORDER_MARK))
    this.head = this.shape("HeadDot", SOFT_GREEN, w * HEAD_PER_LINE, w * HEAD_PER_LINE, ORDER_HEAD)
    this.head.border = true
    this.head.borderColor = DOT_COLOR
    this.head.borderSize = w * 0.4

    this.caption = global.scene.createSceneObject("ReplayCaption")
    this.caption.createComponent("Component.Canvas")
    this.caption.getTransform().setWorldPosition(PARKED)
    new SoftFrame(this.caption, CAPTION_FILL).setSize(CAPTION_W, CAPTION_H)
    const content = global.scene.createSceneObject("Content")
    content.setParent(this.caption)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    this.captionText = this.addText(content, "ReplayCaptionText", CAPTION_W - PAD * 2, TEXT_H)
    this.captionText.getSceneObject().getTransform().setLocalPosition(new vec3(0, CAPTION_H / 2 - PAD - TEXT_H / 2, 0))

    const so = global.scene.createSceneObject("ReplaySkipButton")
    so.setParent(content)
    so.getTransform().setLocalPosition(new vec3(0, -CAPTION_H / 2 + PAD + BUTTON_H / 2, 0))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    this.skipButton = new SoftButton(owner, btn, BUTTON_W, BUTTON_H, false, () => {
      if (this.guard.open) this.skip()
    })
    const label = global.scene.createSceneObject("ReplaySkipLabel")
    label.setParent(this.skipButton.face)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const skipText = this.addText(label, "btn.skip", BUTTON_W - 1, BUTTON_H - 1)
    const refresh = (): void => {
      setLineText(skipText, getString("btn.skip"), getLanguage())
      if (this._captionKey) setLineText(this.captionText, getString(this._captionKey), getLanguage())
    }
    refresh()
    onLanguageChanged.add(refresh)

    this.update = owner.createEvent("UpdateEvent")
    this.update.bind(() => this.onUpdate())
    this.update.enabled = false
    const park = owner.createEvent("DelayedCallbackEvent")
    park.bind(() => {
      if (!this.isPlaying) this.hideAll()
    })
    park.reset(PARK_SECONDS)
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isPlaying(): boolean {
    return this.startedAt >= 0
  }
  /** getTime() when the replay started (-1 when not playing). */
  get startTime(): number {
    return this.startedAt
  }
  get captionShown(): boolean {
    return this.caption.isEnabledInHierarchy
  }
  get captionKey(): StringKey | null {
    return this.isPlaying ? this._captionKey : null
  }
  get captionLine(): string {
    return this.captionText.text
  }
  get segmentsShown(): number {
    return this.segs.filter((r) => r.getSceneObject().enabled).length
  }
  /** Shown trail segments drawn in the danger color. */
  get redSegmentsShown(): number {
    return this.segs.filter((r) => {
      const b = r.backgroundColor
      const red = Math.abs(b.x - DANGER_COLOR.x) < 1e-3 && Math.abs(b.y - DANGER_COLOR.y) < 1e-3 && Math.abs(b.z - DANGER_COLOR.z) < 1e-3
      return r.getSceneObject().enabled && red
    }).length
  }
  /** Shown trail segments whose run is inDanger. */
  get dangerSegmentsShown(): number {
    return this.placed.filter((p, i) => p.danger && this.segs[i].getSceneObject().enabled).length
  }
  get dotsShown(): number {
    return this.dots.filter((r) => r.getSceneObject().enabled).length
  }
  get markersShown(): number {
    return this.marks.filter((r) => r.getSceneObject().enabled).length
  }
  /** World floor point of shown marker `i` (in event order), or null. */
  markerPosition(i: number): vec3 | null {
    const so = this.marks[i] ? this.marks[i].getSceneObject() : null
    return so && so.enabled ? so.getTransform().getWorldPosition() : null
  }
  get headDotShown(): boolean {
    return this.head.getSceneObject().enabled
  }
  /** The points the trail is drawn through (after simplify). */
  get drawnPoints(): readonly ReplaySample[] {
    return this.points
  }

  /**
   * Draws `track` on the floor at `floorY` (room-local to world by `toWorld`)
   * with the caption `key`; `onDone` runs when it ends by itself or by Lewati.
   * Returns the points drawn (after simplify).
   */
  play(track: ReplayTrack, toWorld: (x: number, z: number) => vec3, floorY: number, key: StringKey, onDone: () => void): ReplaySample[] {
    this.stop()
    this.toWorld = toWorld
    this.y = floorY + this.config.replayLiftCm
    let step = Math.max(0.1, this.config.replaySimplifyCm)
    let pts = track.simplify(step)
    while (pts.length - 1 > POOL_SEG) {
      step *= 1.5
      pts = track.simplify(step)
    }
    this.points = pts
    this.placed = []
    let s = 0
    for (let i = 1; i < pts.length; i++) {
      const a = this.world(pts[i - 1].x, pts[i - 1].z)
      const b = this.world(pts[i].x, pts[i].z)
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const ux = len > 0 ? (b.x - a.x) / len : 1
      const uz = len > 0 ? (b.z - a.z) / len : 0
      const danger = pts[i - 1].inDanger || pts[i].inDanger
      this.placed.push({start: s, len, a, ux, uz, danger})
      this.segs[i - 1].backgroundColor = danger ? DANGER_COLOR : SAFE_COLOR
      s += len
    }
    this.total = s
    const spacing = Math.max(this.config.replayDotSpacingCm, this.total / POOL_DOT, 1)
    this.dotAt = []
    for (let d = spacing / 2; d < this.total && this.dotAt.length < POOL_DOT; d += spacing) this.dotAt.push(d)
    for (let i = 0; i < this.dotAt.length; i++) {
      const p = track.positionAt(this.dotAt[i] / this.total, pts)
      this.dots[i].getSceneObject().getTransform().setWorldPosition(this.world(p.x, p.z))
    }
    this.markAt = []
    const events = track.events.slice(0, POOL_MARK)
    const m = this.config.replayMarkerCm
    events.forEach((e, i) => {
      const r = this.marks[i]
      const hit = e.kind === "hit"
      const color = e.kind === "cover" ? SOFT_GREEN : SOFT_RED
      const size = hit ? m * 0.6 : m
      r.size = new vec2(size, size)
      r.cornerRadius = size / 2
      r.backgroundColor = hit ? color : new vec4(color.x, color.y, color.z, RING_FILL_ALPHA)
      r.border = true
      r.borderColor = hit ? DOT_COLOR : color
      r.borderSize = hit ? RING_CM / 2 : RING_CM
      r.getSceneObject().getTransform().setWorldPosition(this.world(e.x, e.z))
      this.markAt.push(this.arcAtTime(e.t))
    })
    this._captionKey = key
    setLineText(this.captionText, getString(key), getLanguage())
    this.onDone = onDone
    this.placeCaption()
    this.caption.enabled = true
    drawOnTopWhenReady(this.owner, this.caption)
    this.skipButton.reset()
    this.guard.seconds = this.config.pinchGuardSeconds
    this.guard.arm()
    this.startedAt = getTime()
    this.update.enabled = true
    this.onUpdate()
    return pts
  }

  /** Lewati: ends the replay now (onDone runs). */
  skip(): void {
    if (!this.isPlaying) return
    const done = this.onDone
    this.stop()
    if (done) done()
  }

  /** Hides everything without onDone (Restart, Change language, test reset). */
  stop(): void {
    this.startedAt = -1
    this.onDone = null
    this._captionKey = null
    this.update.enabled = false
    this.hideAll()
  }

  private onUpdate(): void {
    if (!this.isPlaying) return
    const elapsed = getTime() - this.startedAt
    const replay = Math.max(0.1, this.config.replaySeconds)
    if (elapsed >= replay + this.config.replayHoldSeconds) {
      this.skip()
      return
    }
    const u = Math.min(1, elapsed / replay)
    const drawn = u * this.total
    const w = this.config.replayLineWidthCm
    this.placed.forEach((p, i) => {
      const so = this.segs[i].getSceneObject()
      const len = Math.min(p.len, drawn - p.start)
      if (len <= 0 || p.len <= 0) {
        so.enabled = false
        return
      }
      const rect = this.segs[i]
      rect.size = new vec2(len + w, w)
      rect.cornerRadius = w / 2
      const t = so.getTransform()
      t.setWorldPosition(new vec3(p.a.x + (p.ux * len) / 2, this.y, p.a.z + (p.uz * len) / 2))
      t.setWorldRotation(quat.angleAxis(Math.atan2(-p.uz, p.ux), vec3.up()).multiply(FLAT))
      so.enabled = true
    })
    this.dotAt.forEach((d, i) => (this.dots[i].getSceneObject().enabled = d <= drawn))
    this.markAt.forEach((d, i) => (this.marks[i].getSceneObject().enabled = d <= drawn + 0.01))
    const h = this.points.length > 0 ? this.positionAt(u) : null
    const headSo = this.head.getSceneObject()
    headSo.enabled = h !== null
    if (h) headSo.getTransform().setWorldPosition(new vec3(h.x, this.y + 0.1, h.z))
  }

  /** World point a share `u` along the drawn trail. */
  private positionAt(u: number): vec3 {
    const d = u * this.total
    for (const p of this.placed) {
      if (d <= p.start + p.len) {
        const k = Math.max(0, d - p.start)
        return new vec3(p.a.x + p.ux * k, this.y, p.a.z + p.uz * k)
      }
    }
    const last = this.points[this.points.length - 1]
    return this.world(last.x, last.z)
  }

  /** Arc length of the drawn trail at recording time `t` (the first drawn point at or after it). */
  private arcAtTime(t: number): number {
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i].t >= t) return i === 0 ? 0 : this.placed[i - 1].start + this.placed[i - 1].len
    }
    return this.total
  }

  private world(x: number, z: number): vec3 {
    const p = this.toWorld(x, z)
    return new vec3(p.x, this.y, p.z)
  }

  private placeCaption(): void {
    const f = this.headPose.forward
    let flat = new vec3(f.x, 0, f.z)
    flat = flat.length > 0.0001 ? flat.normalize() : new vec3(0, 0, -1)
    const pos = this.headPose.position.add(flat.uniformScale(this.config.hudDistance)).add(new vec3(0, -this.config.resultBelowEye, 0))
    const t = this.caption.getTransform()
    t.setWorldPosition(pos)
    t.setWorldRotation(quat.lookAt(flat.uniformScale(-1), vec3.up()))
  }

  private hideAll(): void {
    for (const r of [...this.segs, ...this.dots, ...this.marks, this.head]) r.getSceneObject().enabled = false
    this.caption.enabled = false
  }

  private shape(name: string, color: vec4, w: number, h: number, order: number): RoundedRectangle {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.root)
    const t = so.getTransform()
    t.setWorldPosition(PARKED)
    t.setWorldRotation(FLAT)
    const rect = createRoundRect(so, color, w, h, Math.min(w, h) / 2)
    rect.renderOrder = order
    rect.onInitialized.add(() => (rect.renderOrder = order))
    return rect
  }

  private addText(parent: SceneObject, name: string, w: number, h: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    t.size = TEXT_SIZE
    t.depthTest = true
    t.textFill.color = new vec4(1, 1, 1, 1)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    return t
  }
}
