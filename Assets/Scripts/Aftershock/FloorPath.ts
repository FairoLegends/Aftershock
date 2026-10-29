import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {SafeZone} from "./SafeZone"
import {createRoundRect, SOFT_GREEN} from "./UiBacking"

// ENGINEERING_PLAN 5j items 5 and 17b: green chevrons on the floor in a
// straight line from the head's floor point to the nearest edge of the target
// table's safe zone. Faint in BRIEFING; bright and marching toward the table
// during the quake. No pathfinding: the line crosses danger zones too.

const FLAT = quat.angleAxis(-Math.PI / 2, vec3.right()) // rect face up on the floor
const POOL = 32
const CHEVRON_HALF_W_CM = 8 // the V is 16 cm wide
const CHEVRON_DEPTH_CM = 7 // tip to arm ends
const ARM_THICK_CM = 2.5

export type PathMode = "off" | "faint" | "bright"

@component
export class FloorPath extends BaseScriptComponent {
  @ui.label("Floor path to the safe zone (5j-5)")
  @ui.separator
  @input
  @hint("DrillConfig component (pathSpacing, pathLift, pathMarchSpeed, pathFaintOpacity)")
  config: DrillConfig

  @input
  @hint("HeadPose component")
  headPose: HeadPose

  private update: UpdateEvent
  private readonly chevrons: SceneObject[] = []
  private readonly arms: RoundedRectangle[] = []
  private target: SafeZone | null = null
  private floorY = 0
  private mode: PathMode = "off"
  private shown = 0
  private marchStart = 0

  onAwake(): void {
    this.update = this.createEvent("UpdateEvent")
    this.update.bind(() => this.onUpdate())
    this.update.enabled = false
  }

  /** True while chevrons are drawn (mode on, a target, head outside its zone). */
  get pathVisible(): boolean {
    return this.shown > 0
  }

  get pathBright(): boolean {
    return this.pathVisible && this.mode === "bright"
  }

  setFloorY(y: number): void {
    this.floorY = y
  }

  setTarget(zone: SafeZone | null): void {
    this.target = zone
  }

  setMode(mode: PathMode): void {
    if (mode === this.mode) return
    this.ensurePool()
    if (mode === "bright") this.marchStart = getTime()
    this.mode = mode
    const alpha = mode === "faint" ? this.config.pathFaintOpacity : 1
    for (const a of this.arms) {
      a.backgroundColor = new vec4(SOFT_GREEN.x, SOFT_GREEN.y, SOFT_GREEN.z, alpha)
    }
    this.update.enabled = mode !== "off"
    if (mode === "off") this.showCount(0)
    else this.onUpdate()
  }

  private onUpdate(): void {
    const head = this.headPose.position
    if (this.mode === "off" || !this.target || this.target.contains(head)) {
      this.showCount(0)
      return
    }
    const y = this.floorY + this.config.pathLift
    const end = this.target.nearestPoint(head)
    const dx = end.x - head.x
    const dz = end.z - head.z
    const len = Math.hypot(dx, dz)
    if (len < 1) {
      this.showCount(0)
      return
    }
    const ux = dx / len
    const uz = dz / len
    const spacing = Math.max(5, this.config.pathSpacing)
    const offset = this.mode === "bright" ? ((getTime() - this.marchStart) * this.config.pathMarchSpeed) % spacing : 0
    const rot = quat.angleAxis(Math.atan2(ux, uz), vec3.up()) // local +Z (the V's tip) along the path
    let n = 0
    for (let s = spacing * 0.5 + offset; s <= len && n < POOL; s += spacing) {
      const t = this.chevrons[n].getTransform()
      t.setWorldPosition(new vec3(head.x + ux * s, y, head.z + uz * s))
      t.setWorldRotation(rot)
      n++
    }
    this.showCount(n)
  }

  private showCount(n: number): void {
    if (n === this.shown) return
    for (let i = 0; i < this.chevrons.length; i++) {
      this.chevrons[i].enabled = i < n
    }
    this.shown = n
  }

  /** POOL chevrons: two flat arms meeting at a tip on local +Z (wide and flat, like the mockup). */
  private ensurePool(): void {
    if (this.chevrons.length > 0) return
    const armLen = Math.hypot(CHEVRON_HALF_W_CM, CHEVRON_DEPTH_CM)
    const tilt = Math.atan2(CHEVRON_DEPTH_CM, CHEVRON_HALF_W_CM)
    for (let i = 0; i < POOL; i++) {
      const root = global.scene.createSceneObject("Chevron" + i)
      root.setParent(this.getSceneObject())
      for (const side of [-1, 1]) {
        // Arm from the tip (0, 0, depth/2) back to (side·halfW, 0, −depth/2).
        const so = global.scene.createSceneObject(side < 0 ? "ArmL" : "ArmR")
        so.setParent(root)
        const t = so.getTransform()
        t.setLocalPosition(new vec3((side * CHEVRON_HALF_W_CM) / 2, 0, 0))
        // Rotation about Y by θ maps +X to (cos θ, 0, −sin θ): the arm's long axis runs tip to end.
        const theta = side < 0 ? -tilt : tilt
        t.setLocalRotation(quat.angleAxis(theta, vec3.up()).multiply(FLAT))
        const rect = createRoundRect(so, SOFT_GREEN, armLen, ARM_THICK_CM, ARM_THICK_CM / 2)
        rect.renderOrder = 1 // after the danger zone fills
        this.arms.push(rect)
      }
      root.enabled = false
      this.chevrons.push(root)
    }
  }
}
