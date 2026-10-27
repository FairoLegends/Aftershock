import {DrillConfig} from "./DrillConfig"

// Layered sine noise: each axis sums LAYERS sines spread across
// shakeFrequencyMinHz..shakeFrequencyMaxHz with random phases, divided by
// LAYERS so the peak never exceeds the amplitude.
const LAYERS = 3
const AXIS_POS_X = 0
const AXIS_POS_Y = 1
const AXIS_POS_Z = 2
const AXIS_TILT_X = 3
const AXIS_TILT_Z = 4
const AXES = 5
const TWO_PI = Math.PI * 2
const DEG_TO_RAD = Math.PI / 180

/**
 * Moves and tilts the Room with layered sine noise while active (TDD §3.1,
 * DESIGN_BRIEF §6.2): ramps up over the first shakeRampSeconds and down over
 * the last, and puts the Room back exactly at its rest transform when stopped.
 * DrillController starts and stops it; nothing else moves the Room meanwhile.
 */
@component
export class QuakeShaker extends BaseScriptComponent {
  @ui.label("Room shake (R6)")
  @ui.separator
  @input
  @hint("DrillConfig component (shake amplitude, tilt, frequencies, ramp)")
  config: DrillConfig

  @input
  @allowUndefined
  @hint("Object to shake (the Room). Empty = the object this script is on.")
  target: SceneObject

  private targetTransform: Transform | null = null
  private updateEvent: UpdateEvent | null = null
  private readonly restPosition = new vec3(0, 0, 0)
  private readonly restRotation = quat.quatIdentity()
  private readonly shakenPosition = new vec3(0, 0, 0)
  private readonly shakenRotation = quat.quatIdentity()
  private readonly phases: number[] = new Array(AXES * LAYERS).fill(0)
  private readonly frequencies: number[] = new Array(LAYERS).fill(0) // Hz
  private startTime = 0 // s
  private duration = 0 // s; 0 = no ramp-down
  private _shaking = false
  private _envelope = 0

  /** True between startShake() and stopShake(). */
  get isShaking(): boolean {
    return this._shaking
  }

  /** Current ramp, 0..1 (0 when stopped). The rumble volume follows it. */
  get envelope(): number {
    return this._envelope
  }

  onAwake(): void {
    const so = this.target ? this.target : this.sceneObject
    this.targetTransform = so.getTransform()
    this.updateEvent = this.createEvent("UpdateEvent")
    this.updateEvent.bind(() => this.onUpdate())
    this.updateEvent.enabled = false
  }

  /** Starts shaking from the target's current (rest) transform for `durationSeconds`. */
  startShake(durationSeconds: number): void {
    if (!this.config || !this.targetTransform) {
      console.error("[Aftershock] QuakeShaker: config is not assigned")
      return
    }
    if (!this._shaking) {
      const p = this.targetTransform.getLocalPosition()
      const r = this.targetTransform.getLocalRotation()
      this.restPosition.x = p.x
      this.restPosition.y = p.y
      this.restPosition.z = p.z
      this.restRotation.w = r.w
      this.restRotation.x = r.x
      this.restRotation.y = r.y
      this.restRotation.z = r.z
    }
    const fMin = this.config.shakeFrequencyMinHz
    const fMax = this.config.shakeFrequencyMaxHz
    for (let i = 0; i < LAYERS; i++) {
      this.frequencies[i] = LAYERS > 1 ? fMin + ((fMax - fMin) * i) / (LAYERS - 1) : fMin
    }
    for (let i = 0; i < this.phases.length; i++) {
      this.phases[i] = Math.random() * TWO_PI
    }
    this.duration = durationSeconds
    this.startTime = getTime()
    this._envelope = 0
    this._shaking = true
    this.updateEvent.enabled = true
  }

  /** Stops shaking and puts the target back exactly at its rest transform. */
  stopShake(): void {
    if (!this._shaking) {
      return
    }
    this.updateEvent.enabled = false
    this._shaking = false
    this._envelope = 0
    this.targetTransform.setLocalPosition(this.restPosition)
    this.targetTransform.setLocalRotation(this.restRotation)
  }

  private onUpdate(): void {
    const t = getTime() - this.startTime
    const env = this.computeEnvelope(t)
    this._envelope = env

    const amp = this.config.shakeAmplitudeCm * env
    this.shakenPosition.x = this.restPosition.x + this.noise(AXIS_POS_X, t) * amp
    this.shakenPosition.y = this.restPosition.y + this.noise(AXIS_POS_Y, t) * amp
    this.shakenPosition.z = this.restPosition.z + this.noise(AXIS_POS_Z, t) * amp
    this.targetTransform.setLocalPosition(this.shakenPosition)

    // Tilt around local X then Z. Half-angles in radians for the quaternion.
    const halfTilt = this.config.shakeTiltDeg * DEG_TO_RAD * env * 0.5
    const ax = this.noise(AXIS_TILT_X, t) * halfTilt
    const az = this.noise(AXIS_TILT_Z, t) * halfTilt
    const sx = Math.sin(ax)
    const cx = Math.cos(ax)
    const sz = Math.sin(az)
    const cz = Math.cos(az)
    // tilt = qx * qz
    const tw = cx * cz
    const tx = sx * cz
    const ty = -sx * sz
    const tz = cx * sz
    // shaken = rest * tilt (Hamilton product, no allocation)
    const r = this.restRotation
    const out = this.shakenRotation
    out.w = r.w * tw - r.x * tx - r.y * ty - r.z * tz
    out.x = r.w * tx + r.x * tw + r.y * tz - r.z * ty
    out.y = r.w * ty - r.x * tz + r.y * tw + r.z * tx
    out.z = r.w * tz + r.x * ty - r.y * tx + r.z * tw
    this.targetTransform.setLocalRotation(out)
  }

  /** 0..1: up over the first shakeRampSeconds, down over the last. */
  private computeEnvelope(t: number): number {
    const ramp = this.config.shakeRampSeconds
    if (ramp <= 0) {
      return 1
    }
    let e = Math.min(1, t / ramp)
    if (this.duration > 0) {
      e = Math.min(e, (this.duration - t) / ramp)
    }
    return Math.max(0, e)
  }

  /** Layered sine noise for one axis, in -1..1. */
  private noise(axis: number, t: number): number {
    let sum = 0
    const base = axis * LAYERS
    for (let i = 0; i < LAYERS; i++) {
      sum += Math.sin(TWO_PI * this.frequencies[i] * t + this.phases[base + i])
    }
    return sum / LAYERS
  }
}
