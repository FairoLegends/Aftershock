import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {SafeZone} from "./SafeZone"
import {createRoundRect, SOFT_GREEN} from "./UiBacking"

// HOLD ON (Slice 8B, ENGINEERING_PLAN 5k item 9). Each active table gets two
// grip handles at its front legs (the long side nearer the start spot): small
// soft-green rounded markers, gripHandleSize square at gripHandleHeight. A
// handle shows only while the head is in that table's zone (never on Hard,
// visualsOn false), but its collider and SIK Interactable stay on either way:
// a pinch held on a handle of the table the head is under is "holding"
// (onTriggerStart → true, onTriggerEnd / onTriggerCanceled → false; in the
// preview, a mouse press-and-hold). Handle positions are Room-local, so the
// handles shake with the room. The drain rule lives in DrillController.

const POOL = 4 // two tables at most, two legs each
const LEG_INSET_CM = 6 // leg center in from the footprint's corner
const TOWARD_HEAD_CM = 5 // the marker sits this far off the leg, toward the head, so the leg mesh does not cut it
const COLLIDER_CM = 14 // the pinch target is bigger than the marker
const RADIUS_SHARE = 0.3
const PARKED = new vec3(0, -100000, 0) // built here, out of sight, while the shapes initialize

interface Handle {
  so: SceneObject // collider + Interactable; never disabled (the marker's shape must initialize)
  visual: SceneObject // the rounded marker
  collider: ColliderComponent
  interactable: Interactable
  ready: boolean // the marker's shape exists
  zone: SafeZone | null
  local: vec3 // Room-local cm
}

@component
export class GripHandles extends BaseScriptComponent {
  @ui.label("Grip handles at the table legs (Slice 8B, 5k item 9)")
  @ui.separator
  @input
  @hint("DrillConfig component (gripHandleSize, gripHandleHeight)")
  config: DrillConfig

  @input
  @hint("HeadPose component")
  headPose: HeadPose

  /** Set by DrillController: false on Hard (markers hidden, holding still works). */
  visualsOn: boolean = true

  private readonly handles: Handle[] = []
  private room: SceneObject | null = null
  private active = false
  private held: Handle | null = null
  private holdingForTest: boolean | null = null
  private zoneNow: SafeZone | null = null
  private shown = 0

  onAwake(): void {
    this.buildPool()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // Read-only getters for LEAF assertions (TDD §8).
  /** Holding a handle of the table the head is in (or the test hook says so). */
  get isHolding(): boolean {
    if (this.holdingForTest !== null) return this.holdingForTest
    return this.active && this.held !== null && this.held.zone !== null && this.held.zone === this.zoneNow
  }
  /** Markers drawn now. */
  get shownCount(): number {
    return this.shown
  }
  /** Handles placed for this drill (two per active table). */
  get handleCount(): number {
    return this.handles.filter((h) => h.zone !== null).length
  }

  /** Test hook (5k item 9): true or false pins isHolding; null gives it back to the pinch. */
  setHoldingForTest(on: boolean | null): void {
    this.holdingForTest = on
  }

  /**
   * BRIEFING, after the tables' captureRest: two handles per zone at the legs
   * of the long side nearer the Room origin (the start spot), Room-local.
   */
  place(zones: SafeZone[], room: SceneObject, floorY: number): void {
    this.room = room
    this.held = null
    const roomT = room.getTransform()
    const start = roomT.getWorldPosition()
    const toLocal = roomT.getInvertedWorldTransform()
    let k = 0
    for (const zone of zones) {
      const c = zone.center
      const cos = Math.cos(zone.yaw)
      const sin = Math.sin(zone.yaw)
      const lx = new vec3(cos, 0, -sin)
      const lz = new vec3(sin, 0, cos)
      const a = zone.footprintWidth / 2 - LEG_INSET_CM
      const b0 = zone.footprintDepth / 2 - LEG_INSET_CM
      const toStart = new vec3(start.x - c.x, 0, start.z - c.z)
      const b = toStart.dot(lz) >= 0 ? b0 : -b0
      for (const side of [-1, 1]) {
        if (k >= POOL) break
        const w = c.add(lx.uniformScale(side * a)).add(lz.uniformScale(b))
        const h = this.handles[k++]
        h.zone = zone
        h.local = toLocal.multiplyPoint(new vec3(w.x, floorY + this.config.gripHandleHeight, w.z))
      }
    }
    for (; k < this.handles.length; k++) {
      this.handles[k].zone = null
    }
    this.setActive(false)
  }

  /** QUAKE through AFTERSHOCK: colliders on. Off elsewhere, so no handle catches a ray meant for a panel. */
  setActive(on: boolean): void {
    this.active = on
    if (!on) this.held = null
    for (const h of this.handles) {
      const live = on && h.zone !== null
      h.collider.enabled = live
      h.interactable.enabled = live
      if (!live) h.so.getTransform().setWorldPosition(PARKED)
    }
    this.onUpdate()
  }

  private onUpdate(): void {
    if (!this.active || !this.room) {
      this.zoneNow = null
      this.showVisuals(null)
      return
    }
    const head = this.headPose.position
    this.zoneNow = null
    for (const h of this.handles) {
      if (h.zone && h.zone.contains(head)) {
        this.zoneNow = h.zone
        break
      }
    }
    const roomW = this.room.getTransform().getWorldTransform()
    for (const h of this.handles) {
      if (!h.zone) continue
      const leg = roomW.multiplyPoint(h.local)
      const to = new vec3(head.x - leg.x, 0, head.z - leg.z)
      const len = to.length
      const dir = len > 0.01 ? to.uniformScale(1 / len) : vec3.forward()
      const t = h.so.getTransform()
      t.setWorldPosition(leg.add(dir.uniformScale(TOWARD_HEAD_CM)))
      t.setWorldRotation(quat.lookAt(dir, vec3.up())) // the marker's face (+Z) toward the head
    }
    this.showVisuals(this.visualsOn ? this.zoneNow : null)
  }

  private showVisuals(zone: SafeZone | null): void {
    let n = 0
    for (const h of this.handles) {
      if (!h.ready) continue // onInitialized hides it
      const on = zone !== null && h.zone === zone
      if (h.visual.enabled !== on) h.visual.enabled = on
      if (on) n++
    }
    this.shown = n
  }

  /**
   * POOL handles, built at awake under this enabled object and parked: a UI
   * Kit shape makes its RenderMeshVisual on its own OnStartEvent, which never
   * fires while its object is disabled (as FloorPath). A marker hides once its
   * shape exists.
   */
  private buildPool(): void {
    const size = this.config.gripHandleSize
    for (let i = 0; i < POOL; i++) {
      const so = global.scene.createSceneObject("GripHandle" + i)
      so.setParent(this.getSceneObject())
      so.getTransform().setWorldPosition(PARKED)
      const collider = so.createComponent("Physics.ColliderComponent") as ColliderComponent
      const shape = Shape.createBoxShape()
      shape.size = new vec3(COLLIDER_CM, COLLIDER_CM, COLLIDER_CM)
      collider.shape = shape
      collider.fitVisual = false
      const interactable = so.createComponent(Interactable.getTypeName()) as Interactable
      interactable.colliders = [collider]
      const visual = global.scene.createSceneObject("Marker")
      visual.setParent(so)
      const rect: RoundedRectangle = createRoundRect(visual, SOFT_GREEN, size, size, size * RADIUS_SHARE)
      const h: Handle = {so, visual, collider, interactable, ready: false, zone: null, local: vec3.zero()}
      rect.onInitialized.add(() => {
        rect.backgroundColor = SOFT_GREEN
        h.ready = true
        visual.enabled = false
        this.onUpdate()
      })
      collider.enabled = false
      interactable.enabled = false
      interactable.onTriggerStart.add(() => {
        this.held = h
      })
      const release = (): void => {
        if (this.held === h) this.held = null
      }
      interactable.onTriggerEnd.add(release)
      interactable.onTriggerCanceled.add(release)
      this.handles.push(h)
    }
  }
}
