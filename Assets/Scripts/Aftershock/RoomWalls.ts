import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {HazardLabel} from "./HazardLabel"
import {DOOR_H, DOOR_W, DoorPlacement, inDoorZone, RoomRect, WallSide} from "./LayoutGenerator"
import {createLightBacking} from "./UiBacking"

// Slice 8A walls and exit door (ENGINEERING_PLAN §5k items 1, 3). Built in
// Room-local cm under this object, which sits at the Room origin.
const SIDES: WallSide[] = ["+x", "-x", "+z", "-z"]
const WALL_RENDER_ORDER = -10 // before the room (0), so furniture and labels in front draw over the walls
const LINE_Z = 0.2 // cm: the edge lines sit just inside the wall panel
const DOOR_LEAF_Z = 1 // cm inside the wall line
const DOOR_FRAME_Z = 1.5
const DOOR_LABEL_Z = 3
const LOG = "[Aftershock]"

/**
 * Four thin light walls on the layout's room rect (LayoutGenerator.room),
 * facing in, with brighter lines along their top and bottom edges, and the
 * exit door (frame, leaf, label.door label) on its wall. DrillController
 * calls apply() after every layout and captureRest() while the Room is at
 * rest; the door getters are world-space at that rest pose (Slice 8B).
 */
@component
export class RoomWalls extends BaseScriptComponent {
  @ui.label("Room walls and exit door (Slice 8A)")
  @ui.separator
  @input
  @hint("Wall panel color: #E8EEF2 at 25% (light only: the display is additive)")
  @widget(new ColorWidget())
  wallColor: vec4 = new vec4(0.91, 0.933, 0.949, 0.25)

  @input
  @hint("Top and bottom edge lines, slightly brighter than the panel")
  @widget(new ColorWidget())
  lineColor: vec4 = new vec4(0.96, 0.97, 0.98, 0.6)

  @input
  @hint("Wall height (cm)")
  wallHeight: number = 250

  @input
  @hint("Edge line width (cm)")
  lineWidth: number = 1.5

  @input
  @hint("Door frame: light oak")
  @widget(new ColorWidget())
  doorFrameColor: vec4 = new vec4(0.87, 0.75, 0.56, 1)

  @input
  @hint("Door leaf: slightly darker than the frame, still light")
  @widget(new ColorWidget())
  doorLeafColor: vec4 = new vec4(0.8, 0.67, 0.48, 1)

  @input
  @hint("Door frame width (cm)")
  doorFrameWidth: number = 8

  @input
  @hint("HazardLabel with key label.door, a child of this object")
  doorLabel: HazardLabel

  @input
  @hint("Door label height above the floor (cm)")
  doorLabelHeight: number = 235

  private wallObjects: SceneObject[] = []
  private panels: RoundedRectangle[] = []
  private lines: RoundedRectangle[][] = []
  private doorRoot: SceneObject
  private doorParts: {rect: RoundedRectangle; x: number; y: number; w: number; h: number}[] = []
  private _rect: RoomRect | null = null
  private _door: DoorPlacement | null = null
  private restCenter: vec3 | null = null
  private restNormal: vec3 | null = null
  private restInverse: mat4 | null = null // world → this object's local frame at rest

  onAwake(): void {
    for (const side of SIDES) {
      const so = global.scene.createSceneObject("Wall" + side)
      so.setParent(this.sceneObject)
      this.panels.push(this.addRect(so, "Panel", this.wallColor, WALL_RENDER_ORDER))
      const top = this.addRect(so, "EdgeTop", this.lineColor, WALL_RENDER_ORDER + 1)
      const bottom = this.addRect(so, "EdgeBottom", this.lineColor, WALL_RENDER_ORDER + 1)
      this.lines.push([top, bottom])
      so.enabled = false
      this.wallObjects.push(so)
    }
    this.doorRoot = global.scene.createSceneObject("Door")
    this.doorRoot.setParent(this.sceneObject)
    const fw = this.doorFrameWidth
    const leaf = this.addRect(this.doorRoot, "Leaf", this.doorLeafColor, WALL_RENDER_ORDER + 2)
    this.doorParts.push({rect: leaf, x: 0, y: DOOR_H / 2, w: DOOR_W, h: DOOR_H})
    leaf.getSceneObject().getTransform().setLocalPosition(new vec3(0, DOOR_H / 2, DOOR_LEAF_Z))
    const frame: [string, number, number, number, number][] = [
      ["FrameLeft", -(DOOR_W + fw) / 2, DOOR_H / 2, fw, DOOR_H],
      ["FrameRight", (DOOR_W + fw) / 2, DOOR_H / 2, fw, DOOR_H],
      ["FrameTop", 0, DOOR_H + fw / 2, DOOR_W + fw * 2, fw]
    ]
    for (const [name, x, y, w, h] of frame) {
      const r = this.addRect(this.doorRoot, name, this.doorFrameColor, WALL_RENDER_ORDER + 3)
      r.getSceneObject().getTransform().setLocalPosition(new vec3(x, y, DOOR_FRAME_Z))
      this.doorParts.push({rect: r, x: x, y: y, w: w, h: h})
    }
    for (const part of this.doorParts) {
      part.rect.size = new vec2(part.w, part.h)
    }
    if (this.doorLabel) {
      this.doorLabel.sceneObject.setParent(this.doorRoot)
      this.doorLabel.sceneObject.getTransform().setLocalPosition(new vec3(0, this.doorLabelHeight, DOOR_LABEL_Z))
      this.doorLabel.sceneObject.getTransform().setLocalRotation(quat.quatIdentity())
    } else {
      console.warn(`${LOG} RoomWalls: doorLabel is not assigned`)
    }
    this.doorRoot.enabled = false
  }

  /** Stands the walls on `rect` and the door at `door` (Room-local cm). */
  apply(rect: RoomRect, door: DoorPlacement): void {
    this._rect = {minX: rect.minX, maxX: rect.maxX, minZ: rect.minZ, maxZ: rect.maxZ}
    this._door = {x: door.x, z: door.z, nx: door.nx, nz: door.nz, wall: door.wall}
    this.restCenter = null
    const cx = (rect.minX + rect.maxX) / 2
    const cz = (rect.minZ + rect.maxZ) / 2
    const h = this.wallHeight
    for (let i = 0; i < SIDES.length; i++) {
      const side = SIDES[i]
      const alongX = side === "+z" || side === "-z"
      const w = alongX ? rect.maxX - rect.minX : rect.maxZ - rect.minZ
      const x = side === "+x" ? rect.maxX : side === "-x" ? rect.minX : cx
      const z = side === "+z" ? rect.maxZ : side === "-z" ? rect.minZ : cz
      const t = this.wallObjects[i].getTransform()
      t.setLocalPosition(new vec3(x, h / 2, z))
      t.setLocalRotation(quat.angleAxis(inwardYaw(side), vec3.up())) // panel +Z faces into the room
      this.panels[i].size = new vec2(w, h)
      const [top, bottom] = this.lines[i]
      top.size = new vec2(w, this.lineWidth)
      bottom.size = new vec2(w, this.lineWidth)
      top.getSceneObject().getTransform().setLocalPosition(new vec3(0, h / 2 - this.lineWidth / 2, LINE_Z))
      bottom.getSceneObject().getTransform().setLocalPosition(new vec3(0, -h / 2 + this.lineWidth / 2, LINE_Z))
      this.wallObjects[i].enabled = true
    }
    const dt = this.doorRoot.getTransform()
    dt.setLocalPosition(new vec3(door.x, 0, door.z))
    dt.setLocalRotation(quat.angleAxis(Math.atan2(door.nx, door.nz), vec3.up())) // +Z = into the room
    this.doorRoot.enabled = true
    if (this.doorLabel) this.doorLabel.show()
    console.log(
      `${LOG} BRIEFING: walls x ${rect.minX.toFixed(0)}..${rect.maxX.toFixed(0)}, z ${rect.minZ.toFixed(0)}..${rect.maxZ.toFixed(0)} cm (${(rect.maxX - rect.minX).toFixed(0)} × ${(rect.maxZ - rect.minZ).toFixed(0)}); door on ${door.wall} at (${door.x.toFixed(0)}, ${door.z.toFixed(0)})`
    )
  }

  /** Stores the door's world pose at rest. Call while the Room is at rest, after apply(). */
  captureRest(): void {
    if (!this._door) {
      return
    }
    const t = this.sceneObject.getTransform()
    this.restCenter = t.getWorldTransform().multiplyPoint(new vec3(this._door.x, 0, this._door.z))
    this.restNormal = t.getWorldRotation().multiplyVec3(new vec3(this._door.nx, 0, this._door.nz)).normalize()
    this.restInverse = t.getInvertedWorldTransform()
  }

  // Read-only getters for Slice 8B and LEAF assertions (TDD §8).
  /** The doorway's center on the wall line, on the floor (world, at rest), or null before the first layout. */
  get doorCenter(): vec3 | null {
    return this.restCenter
  }
  /** Unit floor normal from the door into the room (world, at rest). */
  get doorNormal(): vec3 | null {
    return this.restNormal
  }
  /** True when the XZ of `pos` is in the DOOR_W × DOOR_ZONE_DEPTH floor rect in front of the door. */
  doorContains(pos: vec3): boolean {
    const l = this.toLocal(pos)
    return l !== null && inDoorZone(this._door, l.x, l.z)
  }
  /** The walls' rect (Room-local cm), or null before the first layout. */
  get rect(): RoomRect | null {
    return this._rect
  }
  get door(): DoorPlacement | null {
    return this._door
  }
  /** The four wall objects (+x, −x, +z, −z). */
  get walls(): SceneObject[] {
    return this.wallObjects
  }
  /** True when the XZ of `pos` (world) is inside the walls at rest. */
  insideWalls(pos: vec3): boolean {
    const l = this.toLocal(pos)
    const r = this._rect
    return l !== null && l.x > r.minX && l.x < r.maxX && l.z > r.minZ && l.z < r.maxZ
  }
  /** XZ distance (cm) from `pos` (world) to the nearest wall line at rest, or -1 before the first layout. */
  distanceToWall(pos: vec3): number {
    const l = this.toLocal(pos)
    const r = this._rect
    if (l === null) {
      return -1
    }
    return Math.min(Math.abs(l.x - r.minX), Math.abs(l.x - r.maxX), Math.abs(l.z - r.minZ), Math.abs(l.z - r.maxZ))
  }

  private toLocal(pos: vec3): vec3 | null {
    if (!this.restInverse || !this._rect || !this._door) {
      return null
    }
    return this.restInverse.multiplyPoint(pos)
  }

  private addRect(parent: SceneObject, name: string, color: vec4, order: number): RoundedRectangle {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const r = createLightBacking(so, color)
    r.cornerRadius = 0
    r.renderOrder = order
    return r
  }
}

/** Yaw (radians) that turns local +Z into the room from `side`. */
function inwardYaw(side: WallSide): number {
  return side === "+x" ? -Math.PI / 2 : side === "-x" ? Math.PI / 2 : side === "+z" ? Math.PI : 0
}
