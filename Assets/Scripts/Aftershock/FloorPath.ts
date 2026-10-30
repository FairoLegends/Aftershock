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
const ARM_RENDER_ORDER = 3 // after the danger zone fills and outlines (0) and the scan brackets (2)
const PARKED = new vec3(0, -100000, 0) // the pool is built here, out of sight, while its shapes initialize
const POINT_DONE_CM = 10 // a point target (the door, 5k item 8) hides the path this close

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
  private point: vec3 | null = null
  private floorY = 0
  private mode: PathMode = "off"
  private shown = 0
  private marchStart = 0
  private armColor = SOFT_GREEN

  onAwake(): void {
    this.update = this.createEvent("UpdateEvent")
    this.update.bind(() => this.onUpdate())
    this.update.enabled = false
    this.buildPool()
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
    this.point = null
  }

  /** EVACUATE (5k item 8): the path ends at a world point (in front of the door) instead of a table. Null clears it. */
  setPointTarget(p: vec3 | null): void {
    this.point = p
    if (p) this.target = null
  }

  setMode(mode: PathMode): void {
    if (mode === this.mode) return
    if (mode === "bright") this.marchStart = getTime()
    this.mode = mode
    const alpha = mode === "faint" ? this.config.pathFaintOpacity : 1
    this.armColor = new vec4(SOFT_GREEN.x, SOFT_GREEN.y, SOFT_GREEN.z, alpha)
    for (const a of this.arms) a.backgroundColor = this.armColor
    this.update.enabled = mode !== "off"
    if (mode === "off") this.showCount(0)
    else this.onUpdate()
  }

  private onUpdate(): void {
    const head = this.headPose.position
    if (this.mode === "off" || (!this.target && !this.point) || (this.target && this.target.contains(head))) {
      this.showCount(0)
      return
    }
    const y = this.floorY + this.config.pathLift
    const end = this.point ? this.point : this.target.nearestPoint(head)
    const dx = end.x - head.x
    const dz = end.z - head.z
    const len = Math.hypot(dx, dz)
    if (len < (this.point ? POINT_DONE_CM : 1)) {
      this.showCount(0)
      return
    }
    const ux = dx / len
    const uz = dz / len
    const spacing = Math.max(5, this.config.pathSpacing)
    const offset = this.mode === "bright" ? ((getTime() - this.marchStart) * this.config.pathMarchSpeed) % spacing : 0
    const rot = quat.angleAxis(Math.atan2(ux, uz), vec3.up()) // local +Z (the V's tip) along the path
    let n = 0
    if (len < spacing) {
      // Shorter than one step, so the marching line would place nothing: one
      // chevron at the midpoint, so a real gap always shows a path (5j-5).
      this.placeChevron(n++, head, ux, uz, len / 2, y, rot)
    } else {
      for (let s = spacing * 0.5 + offset; s <= len && n < POOL; s += spacing) {
        this.placeChevron(n++, head, ux, uz, s, y, rot)
      }
    }
    this.showCount(n)
  }

  /** Chevron `i` at `s` cm along the path from `head`, facing the target. */
  private placeChevron(i: number, head: vec3, ux: number, uz: number, s: number, y: number, rot: quat): void {
    const t = this.chevrons[i].getTransform()
    t.setWorldPosition(new vec3(head.x + ux * s, y, head.z + uz * s))
    t.setWorldRotation(rot)
  }

  private showCount(n: number): void {
    if (n === this.shown) return
    for (let i = 0; i < this.chevrons.length; i++) {
      this.chevrons[i].enabled = i < n
    }
    this.shown = n
  }

  /**
   * POOL chevrons: two flat arms meeting at a tip on local +Z (wide and flat,
   * like the mockup). Built at awake under this enabled object and parked out
   * of sight: a UI Kit shape makes its RenderMeshVisual on its own OnStartEvent,
   * which never fires while its object is disabled. A chevron hides once both
   * arms exist; each arm takes the current mode's color on its own material.
   */
  private buildPool(): void {
    const armLen = Math.hypot(CHEVRON_HALF_W_CM, CHEVRON_DEPTH_CM)
    const tilt = Math.atan2(CHEVRON_DEPTH_CM, CHEVRON_HALF_W_CM)
    for (let i = 0; i < POOL; i++) {
      const root = global.scene.createSceneObject("Chevron" + i)
      root.setParent(this.getSceneObject())
      root.getTransform().setWorldPosition(PARKED)
      let ready = 0
      for (const side of [-1, 1]) {
        // Arm from the tip (0, 0, depth/2) back to (side·halfW, 0, −depth/2).
        const so = global.scene.createSceneObject(side < 0 ? "ArmL" : "ArmR")
        so.setParent(root)
        const t = so.getTransform()
        t.setLocalPosition(new vec3((side * CHEVRON_HALF_W_CM) / 2, 0, 0))
        // Rotation about Y by θ maps +X to (cos θ, 0, −sin θ): the arm's long axis runs tip to end.
        const theta = side < 0 ? -tilt : tilt
        t.setLocalRotation(quat.angleAxis(theta, vec3.up()).multiply(FLAT))
        const rect = createRoundRect(so, this.armColor, armLen, ARM_THICK_CM, ARM_THICK_CM / 2)
        rect.renderOrder = ARM_RENDER_ORDER
        rect.onInitialized.add(() => {
          rect.backgroundColor = this.armColor
          rect.renderOrder = ARM_RENDER_ORDER
          if (++ready === 2 && i >= this.shown) root.enabled = false
        })
        this.arms.push(rect)
      }
      this.chevrons.push(root)
    }
  }
}
