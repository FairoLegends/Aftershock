import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {HUD_PANEL_HEIGHT} from "./Hud"
import {createLightBacking} from "./UiBacking"

// Arrow shape and placement (cm). Not drill tunables: they only shape the arrow.
const ARROW_LENGTH = 4 // DESIGN_BRIEF §6.1: about 4 cm
const BAR_T = 0.7 // bar thickness
const HEAD_BAR = 2 // length of each arrowhead bar
const EDGE_INSET = 3 // keeps the whole arrow inside the view edge
const NEARER_THAN_HUD = 2 // a little in front of the HUD plane so it draws over it
const HUD_CLEARANCE = ARROW_LENGTH / 2 + 1 // arrow center stays this far above the HUD panel's top edge
const DEG_TO_RAD = Math.PI / 180 // config FOV is in degrees; runtime math is radians
const HEAD_ANGLE = 135 * DEG_TO_RAD // arrowhead bars sweep back from the tip

/**
 * A small green arrow at the edge of the view nearest the safe zone, pointing
 * toward it, while the zone is outside the view cone (TDD §3.1, DESIGN_BRIEF
 * §6.1). It sits under AftershockRoot, not the Room, so it never shakes. It
 * owns no drill state: DrillController calls track() each QUAKE frame.
 */
@component
export class OffscreenArrow extends BaseScriptComponent {
  @ui.label("Off-screen arrow toward the safe zone (TDD §3.1)")
  @ui.separator
  @input
  @hint("DrillConfig component (fovHalfAngleHorizontal for the in-view test; fovHalfAngleVertical, hudDistance for the edge spot)")
  config: DrillConfig

  @input
  @hint("HeadPose component (view cone origin and direction)")
  headPose: HeadPose

  @ui.group_start("Settings")
  @input
  @hint("Safe green #3DDC84 (DESIGN_BRIEF §5.1). Light colors only: the display is additive.")
  @widget(new ColorWidget())
  color: vec4 = new vec4(0.239, 0.863, 0.518, 1)
  @ui.group_end

  private transform: Transform | null = null
  private visual: SceneObject | null = null
  private readonly pos = new vec3(0, 0, 0)
  private readonly rot = quat.quatIdentity()
  private shown = false

  onAwake(): void {
    if (!this.config || !this.headPose) {
      console.error("[Aftershock] OffscreenArrow: config or headPose is not assigned")
    }
    this.transform = this.sceneObject.getTransform()
    this.buildArrow()
  }

  /**
   * Shows the arrow at the view edge nearest `target` (world, cm), never over
   * the HUD panel, pointing toward it, when it is outside the view cone; hides
   * it when inside. Returns whether the arrow shows.
   */
  track(target: vec3): boolean {
    if (!this.config || !this.headPose) {
      return false
    }
    const head = this.headPose.position
    const f = this.headPose.forward
    // Head right = forward × world up; head up = right × forward (head roll ignored).
    const flat = Math.sqrt(f.x * f.x + f.z * f.z)
    if (flat < 1e-4) {
      return this.shown // looking straight up or down: keep the last state
    }
    const rx = -f.z / flat
    const rz = f.x / flat
    const ux = -rz * f.y
    const uy = rz * f.x - rx * f.z
    const uz = rx * f.y

    const vx = target.x - head.x
    const vy = target.y - head.y
    const vz = target.z - head.z
    const vf = vx * f.x + vy * f.y + vz * f.z
    const vr = vx * rx + vz * rz
    const vu = vx * ux + vy * uy + vz * uz
    const halfH = this.config.fovHalfAngleHorizontal * DEG_TO_RAD
    const halfV = this.config.fovHalfAngleVertical * DEG_TO_RAD
    const tanH = Math.tan(halfH)
    const tanV = Math.tan(halfV)
    // In view by yaw alone: height is ignored (ENGINEERING_PLAN 5d item 2), so the
    // arrow shows only when the zone is to the side or behind.
    const hf = (vx * f.x + vz * f.z) / flat // level distance ahead
    if (hf > 0 && Math.abs(vr) <= hf * tanH) {
      this.setShown(false)
      return false
    }

    // Which way to turn, in view half-angles (yaw right, pitch up); the larger picks the edge.
    // Out of view by yaw means |dx| > 1, so the arrow always sits on a side edge.
    let dx = Math.atan2(vr, hf) / halfH
    let dy = Math.atan2(vu, Math.sqrt(vf * vf + vr * vr)) / halfV
    const m = Math.max(Math.abs(dx), Math.abs(dy))
    if (m < 1e-6) {
      dx = 1
      dy = 0
    } else {
      dx /= m
      dy /= m
    }

    // Spot on the inset view rectangle, just in front of the HUD plane.
    const d = this.config.hudDistance - NEARER_THAN_HUD
    const ex = (d * tanH - EDGE_INSET) * dx // cm right of the view center
    let ey = (d * tanV - EDGE_INSET) * dy // cm above the view center

    // Local +X (the arrow) points outward from the view center, toward the target.
    const len = Math.sqrt(ex * ex + ey * ey)
    const c = len > 1e-6 ? ex / len : 1
    const s = len > 1e-6 ? ey / len : 0

    // Never over the HUD panel (ENGINEERING_PLAN 5a item 7): stay above its top
    // edge, projected onto this plane. The HUD sits hudDistance ahead on the level
    // and hudBelowEye below the eye, whatever the head pitch.
    const hudTop = HUD_PANEL_HEIGHT / 2 - this.config.hudBelowEye // cm above eye level
    const hudF = this.config.hudDistance * flat + hudTop * f.y
    if (hudF > 1e-4) {
      const minEy = (d * (hudTop * flat - this.config.hudDistance * f.y)) / hudF + HUD_CLEARANCE
      if (ey < minEy) {
        ey = minEy
      }
    }

    const p = this.pos
    p.x = head.x + f.x * d + rx * ex + ux * ey
    p.y = head.y + f.y * d + uy * ey
    p.z = head.z + f.z * d + rz * ex + uz * ey
    this.transform.setWorldPosition(p)

    // Local +Z faces the head.
    setFromBasis(
      this.rot,
      rx * c + ux * s, uy * s, rz * c + uz * s,
      -rx * s + ux * c, uy * c, -rz * s + uz * c,
      -f.x, -f.y, -f.z
    )
    this.transform.setWorldRotation(this.rot)
    this.setShown(true)
    return true
  }

  hide(): void {
    this.setShown(false)
  }

  // Read-only getter for LEAF assertions (TDD §8).
  get isShown(): boolean {
    return this.visual !== null && this.visual.isEnabledInHierarchy
  }

  private setShown(on: boolean): void {
    if (on === this.shown) {
      return
    }
    this.shown = on
    this.visual.enabled = on
  }

  /** Shaft and two head bars along local +X, centered on the origin; all share one round cap at the tip. */
  private buildArrow(): void {
    const visual = global.scene.createSceneObject("Arrow")
    visual.setParent(this.sceneObject)
    const tipX = ARROW_LENGTH / 2 - BAR_T / 2
    const back = (HEAD_BAR - BAR_T) / 2
    this.addBar(visual, "Shaft", ARROW_LENGTH, 0, 0, 0)
    this.addBar(visual, "HeadUp", HEAD_BAR, tipX + Math.cos(HEAD_ANGLE) * back, Math.sin(HEAD_ANGLE) * back, HEAD_ANGLE)
    this.addBar(visual, "HeadDown", HEAD_BAR, tipX + Math.cos(-HEAD_ANGLE) * back, Math.sin(-HEAD_ANGLE) * back, -HEAD_ANGLE)
    visual.enabled = false
    this.visual = visual
  }

  private addBar(parent: SceneObject, name: string, length: number, x: number, y: number, angle: number): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.getTransform()
    t.setLocalPosition(new vec3(x, y, 0))
    t.setLocalRotation(quat.angleAxis(angle, vec3.forward()))
    const bar = createLightBacking(so, this.color)
    bar.size = new vec2(length, BAR_T)
    bar.cornerRadius = BAR_T / 2
  }
}

/** Writes into q the rotation whose local X, Y, Z axes are the given orthonormal world vectors. */
function setFromBasis(
  q: quat,
  xx: number, xy: number, xz: number,
  yx: number, yy: number, yz: number,
  zx: number, zy: number, zz: number
): void {
  const trace = xx + yy + zz
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    q.w = 0.25 / s
    q.x = (yz - zy) * s
    q.y = (zx - xz) * s
    q.z = (xy - yx) * s
  } else if (xx > yy && xx > zz) {
    const s = 2 * Math.sqrt(1 + xx - yy - zz)
    q.w = (yz - zy) / s
    q.x = 0.25 * s
    q.y = (yx + xy) / s
    q.z = (zx + xz) / s
  } else if (yy > zz) {
    const s = 2 * Math.sqrt(1 + yy - xx - zz)
    q.w = (zx - xz) / s
    q.x = (yx + xy) / s
    q.y = 0.25 * s
    q.z = (zy + yz) / s
  } else {
    const s = 2 * Math.sqrt(1 + zz - xx - yy)
    q.w = (xy - yx) / s
    q.x = (zx + xz) / s
    q.y = (zy + yz) / s
    q.z = 0.25 * s
  }
}
