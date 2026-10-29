import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {createRoundRect, drawOnTopWhenReady, SOFT_RED} from "./UiBacking"

// ENGINEERING_PLAN 5j item 6: a head-locked red frame at the view edges while
// health drains. The middle edgeClearFraction of the view (per axis) stays
// clear; the frame pulses at edgePulseHz and draws on top of everything.

const DISTANCE_CM = 50 // in front of the eye, camera-local −Z
const OUTER = 1.4 // the frame reaches past the view edge by this factor
const BASE_ALPHA = 0.25
const PULSE_ALPHA = 0.35

@component
export class EdgeWarning extends BaseScriptComponent {
  @ui.label("Red edge warning while health drains (5j-6)")
  @ui.separator
  @input
  @hint("DrillConfig component (fov, edgePulseHz, edgeClearFraction)")
  config: DrillConfig

  @input
  @hint("HeadPose component; the frame hangs under its camera object")
  headPose: HeadPose

  private update: UpdateEvent
  private root: SceneObject | null = null
  private readonly rects: RoundedRectangle[] = []
  private _active = false
  private startTime = 0

  onAwake(): void {
    this.update = this.createEvent("UpdateEvent")
    this.update.bind(() => this.onUpdate())
    this.update.enabled = false
  }

  get edgeWarningActive(): boolean {
    return this._active
  }

  setActive(on: boolean): void {
    if (on === this._active) return
    this._active = on
    if (on) {
      this.ensureFrame()
      this.root.enabled = true
      drawOnTopWhenReady(this, this.root) // after the rects exist (the 7A-soft bug)
      this.startTime = getTime()
      this.onUpdate()
    } else if (this.root) {
      this.root.enabled = false
    }
    this.update.enabled = on
  }

  private onUpdate(): void {
    const phase = 2 * Math.PI * this.config.edgePulseHz * (getTime() - this.startTime)
    const alpha = BASE_ALPHA + PULSE_ALPHA * (0.5 + 0.5 * Math.sin(phase))
    for (const r of this.rects) r.opacity = alpha
  }

  /** Four bands (top, bottom, left, right) around a clear middle. */
  private ensureFrame(): void {
    if (this.root) return
    this.root = global.scene.createSceneObject("EdgeWarningFrame")
    this.root.setParent(this.headPose.cameraObject)
    this.root.getTransform().setLocalPosition(new vec3(0, 0, -DISTANCE_CM))
    this.root.getTransform().setLocalRotation(quat.quatIdentity())
    const halfW = DISTANCE_CM * Math.tan((this.config.fovHalfAngleHorizontal * Math.PI) / 180)
    const halfH = DISTANCE_CM * Math.tan((this.config.fovHalfAngleVertical * Math.PI) / 180)
    const f = Math.max(0, Math.min(1, this.config.edgeClearFraction))
    const inW = halfW * f
    const inH = halfH * f
    const outW = halfW * OUTER
    const outH = halfH * OUTER
    const bandH = outH - inH
    const bandW = outW - inW
    this.addBand("Top", 0, (inH + outH) / 2, outW * 2, bandH)
    this.addBand("Bottom", 0, -(inH + outH) / 2, outW * 2, bandH)
    this.addBand("Left", -(inW + outW) / 2, 0, bandW, inH * 2)
    this.addBand("Right", (inW + outW) / 2, 0, bandW, inH * 2)
    this.root.enabled = false
  }

  private addBand(name: string, x: number, y: number, w: number, h: number): void {
    const so = global.scene.createSceneObject("Edge" + name)
    so.setParent(this.root)
    so.getTransform().setLocalPosition(new vec3(x, y, 0))
    const rect = createRoundRect(so, SOFT_RED, w, h, 0)
    rect.opacity = BASE_ALPHA
    this.rects.push(rect)
  }
}
