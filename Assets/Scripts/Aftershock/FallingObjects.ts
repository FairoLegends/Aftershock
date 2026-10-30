import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {DrillConfig} from "./DrillConfig"
import {FOOTPRINTS, Placement} from "./LayoutGenerator"
import {createRoundRect} from "./UiBacking"

// Falling objects (Slice 7D, ENGINEERING_PLAN 5j items 8, 17e). DrillController
// starts a schedule for each QUAKE and AFTERSHOCK; at each random time a small
// book or box slides off the top of a present shelf and falls in front of it,
// landing inside its danger zone (Slice 9A, 5l item 2: the closed cabinet drops
// nothing; the TV topples instead, in DrillController). Animation only, no physics:
// y = y0 - ½gt², a small forward drift and a tumble, one hop, a rest, then it
// shrinks away. Lives under the Room, so every position here is Room-local cm
// (the Room's origin is the start spot on the floor). The hit rule lives in
// DrillController, which gets each landing through onLanded. Slice 8C (5k
// item 5): each item shows the Book / StorageBox model (the unit cube stays as
// the fallback) and each landing puffs a little dust.

export type FallSource = "shelf" | "cabinet" | "tv"
/** Slice 9A (5l item 2): only the open shelf drops items. The type keeps the old names for the TOP_CM table. */
export const FALL_SOURCES: FallSource[] = ["shelf"]

export interface FallFrom {
  source: FallSource
  at: Placement // the hazard's Room-local placement
}

/** Each source's top above the floor (cm): items fall from here. */
const TOP_CM: Record<FallSource, number> = {shelf: 180, cabinet: 190, tv: 110}
const GRAVITY = 980 // cm/s²
const HOP_CM = 10 // one hop after landing
const REST_SECONDS = 4
const SHRINK_SECONDS = 0.4 // the opaque material cannot fade; shrinking stands in
const POOL_SIZE = 6 // at most this many alive
const START_OUT = 12 // start this far out from the hazard's front face, on top of it (cm)
const LAND_EDGE = 20 // land at least this far from the footprint and from the zone's outer edge (cm)
const SIDE_INSET = 10 // stay this far inside the hazard's sides (cm)
const SPIN_MAX = 3 // rad/s, Y spin while falling
const BOOK = new vec3(20, 4, 15)
const BOX = new vec3(25, 15, 20)
const DUST_POOL = 24 // quads, three landings at once
const DUST_MIN = 6 // quads per landing
const DUST_MAX = 8
const DUST_SECONDS = 0.6
const DUST_SPREAD_MIN = 15 // cm outward
const DUST_SPREAD_MAX = 25
const DUST_SIZE = 7 // cm, grows to 1.6x as it fades
const DUST_COLOR = new vec4(0.847, 0.847, 0.847, 0.6) // #D8D8D8 at 60 %
const LOG = "[Aftershock]"

interface Puff {
  so: SceneObject
  rect: RoundedRectangle
  alive: boolean
  t0: number
  x: number
  z: number
  dx: number
  dz: number
  dist: number
}

type Phase = "fall" | "hop" | "rest" | "shrink"

interface Item {
  so: SceneObject
  id: number // unique per drop
  size: vec3
  busy: boolean
  phase: Phase
  t0: number // s, when this phase began
  source: FallSource
  from: vec3
  to: vec3
  fallTime: number // s
  tumbleAxis: vec3 // horizontal, across the fall direction
  yaw0: number // rad
  spin: number // rad/s
}

interface Pending {
  time: number // s, getTime()
  from: FallFrom
}

@component
export class FallingObjects extends BaseScriptComponent {
  @input
  config: DrillConfig

  @input
  @hint("Unit cube mesh for the items (Aftershock/Meshes/AS_Box.mesh)")
  boxMesh: RenderMesh

  @input
  @hint("Item material, used as authored (Aftershock/Materials/AS_ItemA.mat)")
  itemMaterial: Material

  @input
  @hint("Review only: landed items stay on the floor until the next BRIEFING instead of shrinking after 4 s, so a screenshot can catch one. Keep off.")
  holdForReview: boolean = false

  @input
  @allowUndefined
  @hint("Book model (Aftershock/Prefabs/Book.prefab): root at bottom center, 20 x 4 x 15 cm. Missing: the cube.")
  bookPrefab: ObjectPrefab

  @input
  @allowUndefined
  @hint("Box model (Aftershock/Prefabs/StorageBox.prefab): root at bottom center, 25 x 15 x 20 cm. Missing: the cube.")
  boxPrefab: ObjectPrefab

  /** Set by DrillController: an item touched the floor at Room-local (x, z). */
  onLanded: ((source: FallSource, x: number, z: number) => void) | null = null

  /** Set by DrillController (5k item 8): while on, landed items stay on the floor (they can be tripped over during EVACUATE); releaseLanded() lets them shrink. */
  keepLanded: boolean = false

  private items: Item[] = []
  private puffs: Puff[] = []
  private nextPuff = 0
  private pending: Pending[] = []
  private nextItem = 0
  private nextId = 1
  private _fallsScheduled = 0
  private _fallsLanded = 0

  // Read-only getters for LEAF assertions (TDD §8).
  /** Falls scheduled this drill (every shake since BRIEFING). */
  get fallsScheduled(): number {
    return this._fallsScheduled
  }
  /** Items that touched the floor this drill, forced ones included. */
  get fallsLanded(): number {
    return this._fallsLanded
  }
  /** Items on screen: falling, hopping, resting or shrinking. */
  get aliveCount(): number {
    return this.items.filter((i) => i.busy).length
  }
  /** Slice 8C: dust puff quads on screen. */
  get dustPuffsAlive(): number {
    return this.puffs.filter((p) => p.alive).length
  }

  /** Items on the floor (hopping or resting), Room-local cm; `id` is unique per drop, so a trip counts once per item. */
  landedPoints(): {id: number; x: number; z: number}[] {
    return this.items.filter((i) => i.busy && (i.phase === "hop" || i.phase === "rest")).map((i) => ({id: i.id, x: i.to.x, z: i.to.z}))
  }

  /** RESULT / GAME_OVER: keepLanded off and resting items shrink away. */
  releaseLanded(): void {
    this.keepLanded = false
    const now = getTime()
    for (const item of this.items) {
      if (item.busy && item.phase === "rest" && !this.holdForReview) {
        item.phase = "shrink"
        item.t0 = now
      }
    }
  }

  onAwake(): void {
    // Audit (29 Oct): a runtime clone with mainPass.baseColor drew dark grey in the
    // preview (near invisible on the floor); the material as authored draws light oak.
    const colors = [this.itemMaterial, this.itemMaterial]
    for (let i = 0; i < POOL_SIZE; i++) {
      const book = i % 2 === 0
      const size = book ? BOOK : BOX
      // The item root stays unscaled (the shrink scales it); the cube or the model hangs under it.
      const so = global.scene.createSceneObject((book ? "FallBook" : "FallBox") + i)
      so.setParent(this.sceneObject)
      const prefab = book ? this.bookPrefab : this.boxPrefab
      if (prefab) {
        const model = prefab.instantiate(so)
        model.getTransform().setLocalPosition(new vec3(0, -size.y / 2, 0)) // its bottom on the item's bottom face
      } else {
        const cube = global.scene.createSceneObject("Cube")
        cube.setParent(so)
        const v = cube.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
        v.mesh = this.boxMesh
        v.mainMaterial = colors[(i + Math.floor(i / 2)) % 2]
        cube.getTransform().setLocalScale(size)
      }
      so.enabled = false
      this.items.push({
        so,
        id: 0,
        size,
        busy: false,
        phase: "rest",
        t0: 0,
        source: "shelf",
        from: vec3.zero(),
        to: vec3.zero(),
        fallTime: 0,
        tumbleAxis: vec3.right(),
        yaw0: 0,
        spin: 0
      })
    }
    for (let i = 0; i < DUST_POOL; i++) {
      const so = global.scene.createSceneObject("Dust" + i)
      so.setParent(this.sceneObject)
      const rect = createRoundRect(so, DUST_COLOR, DUST_SIZE, DUST_SIZE, DUST_SIZE / 2)
      so.getTransform().setLocalRotation(quat.angleAxis(-Math.PI / 2, vec3.right())) // flat on the floor, facing up
      so.enabled = false
      this.puffs.push({so, rect, alive: false, t0: 0, x: 0, z: 0, dx: 0, dz: 0, dist: 0})
    }
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /**
   * Schedules fallCountMin..fallCountMax falls at random times from
   * fallMarginSeconds after now to fallMarginSeconds before the shake ends,
   * each from one of `sources`. No sources, nothing falls.
   */
  scheduleShake(durationSeconds: number, sources: FallFrom[]): void {
    const c = this.config
    if (sources.length === 0) {
      console.log(`${LOG} falls: none (no shelf in this drill)`)
      return
    }
    const lo = Math.max(0, Math.round(Math.min(c.fallCountMin, c.fallCountMax)))
    const hi = Math.max(lo, Math.round(c.fallCountMax))
    const n = lo + Math.floor(Math.random() * (hi - lo + 1))
    let first = c.fallMarginSeconds
    let last = durationSeconds - c.fallMarginSeconds
    if (last < first) {
      first = last = durationSeconds / 2 // too short for the margins: the middle
    }
    const now = getTime()
    const times: string[] = []
    for (let k = 0; k < n; k++) {
      const t = first + Math.random() * (last - first)
      const from = sources[Math.floor(Math.random() * sources.length)]
      this.pending.push({time: now + t, from})
      times.push(`${from.source} at ${t.toFixed(1)} s`)
    }
    this._fallsScheduled += n
    console.log(`${LOG} falls: ${n} scheduled (${times.join(", ")})`)
  }

  /** Starts one fall now. With landAt (Room-local x, z), it lands there; otherwise in front of the hazard. Returns false when the pool is full. */
  drop(from: FallFrom, landAt: vec2 | null = null): boolean {
    const item = this.takeItem()
    if (!item) {
      console.warn(`${LOG} falls: pool full (${POOL_SIZE} alive); ${from.source} item skipped`)
      return false
    }
    const at = from.at
    const f = FOOTPRINTS[from.source]
    const theta = at.yaw + f.front
    const fx = Math.sin(theta) // front direction, Room-local
    const fz = Math.cos(theta)
    const lx = Math.cos(theta) // across the front
    const lz = -Math.sin(theta)
    const sideways = Math.abs(Math.sin(f.front)) > 0.5 // front along the item's X
    const depth = sideways ? f.halfX : f.halfZ
    const width = sideways ? f.halfZ : f.halfX
    const side = (Math.random() * 2 - 1) * Math.max(0, width - SIDE_INSET)
    const out = depth + START_OUT
    item.from = new vec3(at.x + fx * out + lx * side, TOP_CM[from.source] + item.size.y / 2, at.z + fz * out + lz * side)
    if (landAt) {
      item.to = new vec3(landAt.x, item.size.y / 2, landAt.y)
    } else {
      const m = this.config.dangerMargin
      const d = depth + Math.min(LAND_EDGE, m / 2) + Math.random() * Math.max(0, m - 2 * LAND_EDGE)
      item.to = new vec3(at.x + fx * d + lx * side, item.size.y / 2, at.z + fz * d + lz * side)
    }
    item.fallTime = Math.sqrt((2 * Math.max(1, item.from.y - item.to.y)) / GRAVITY)
    item.tumbleAxis = new vec3(lx, 0, lz)
    item.yaw0 = theta + (Math.random() - 0.5) * 0.6
    item.spin = (Math.random() * 2 - 1) * SPIN_MAX
    item.source = from.source
    item.id = this.nextId++
    item.busy = true
    item.phase = "fall"
    item.t0 = getTime()
    const t = item.so.getTransform()
    t.setLocalScale(vec3.one())
    t.setLocalPosition(item.from)
    t.setLocalRotation(quat.angleAxis(item.yaw0, vec3.up()))
    item.so.enabled = true
    console.log(
      `${LOG} falls: ${from.source} item falls from (${item.from.x.toFixed(0)}, ${item.from.y.toFixed(0)}, ${item.from.z.toFixed(0)}) to (${item.to.x.toFixed(0)}, ${item.to.z.toFixed(0)}) in ${item.fallTime.toFixed(2)} s`
    )
    return true
  }

  /** Drops the falls not started yet (the shake ended or the drill left it). Items in the air still land. */
  cancelPending(): void {
    this.pending = []
  }

  /** BRIEFING: no schedule, every item hidden, counts back to 0. */
  clear(): void {
    this.pending = []
    for (const item of this.items) {
      item.busy = false
      item.so.enabled = false
    }
    for (const p of this.puffs) {
      p.alive = false
      p.so.enabled = false
    }
    this._fallsScheduled = 0
    this._fallsLanded = 0
  }

  private onUpdate(): void {
    const now = getTime()
    if (this.pending.length > 0) {
      const due = this.pending.filter((p) => p.time <= now)
      if (due.length > 0) {
        this.pending = this.pending.filter((p) => p.time > now)
        for (const p of due) {
          this.drop(p.from)
        }
      }
    }
    for (const item of this.items) {
      if (item.busy) {
        this.animate(item, now)
      }
    }
    for (const p of this.puffs) {
      if (p.alive) {
        this.animatePuff(p, now)
      }
    }
  }

  /** 6-8 flat light-grey discs at the landing spot, spreading outward. */
  private puff(x: number, z: number, now: number): void {
    const n = DUST_MIN + Math.floor(Math.random() * (DUST_MAX - DUST_MIN + 1))
    const a0 = Math.random() * Math.PI * 2
    for (let k = 0; k < n; k++) {
      const p = this.puffs[this.nextPuff]
      this.nextPuff = (this.nextPuff + 1) % this.puffs.length
      const a = a0 + (k * Math.PI * 2) / n + (Math.random() - 0.5) * 0.5
      p.alive = true
      p.t0 = now
      p.x = x
      p.z = z
      p.dx = Math.sin(a)
      p.dz = Math.cos(a)
      p.dist = DUST_SPREAD_MIN + Math.random() * (DUST_SPREAD_MAX - DUST_SPREAD_MIN)
      p.rect.backgroundColor = DUST_COLOR
      p.so.getTransform().setLocalScale(vec3.one())
      p.so.getTransform().setLocalPosition(new vec3(x, 1, z))
      p.so.enabled = true
    }
  }

  private animatePuff(p: Puff, now: number): void {
    const s = Math.min(1, (now - p.t0) / DUST_SECONDS)
    const out = p.dist * (1 - (1 - s) * (1 - s)) // ease out
    const t = p.so.getTransform()
    t.setLocalPosition(new vec3(p.x + p.dx * out, 1 + 3 * s, p.z + p.dz * out))
    const g = 1 + 0.6 * s
    t.setLocalScale(new vec3(g, g, 1))
    const c = DUST_COLOR
    p.rect.backgroundColor = new vec4(c.x, c.y, c.z, c.w * (1 - s))
    if (s >= 1) {
      p.alive = false
      p.so.enabled = false
    }
  }

  private animate(item: Item, now: number): void {
    const t = item.so.getTransform()
    const e = now - item.t0
    if (item.phase === "fall") {
      const s = Math.min(1, e / item.fallTime)
      const tf = s * item.fallTime
      const y = Math.max(item.to.y, item.from.y - 0.5 * GRAVITY * tf * tf)
      const p = vec3.lerp(item.from, item.to, s)
      t.setLocalPosition(new vec3(p.x, y, p.z))
      t.setLocalRotation(this.rotation(item, s, tf))
      if (s >= 1) {
        this._fallsLanded++
        item.phase = "hop"
        item.t0 = now
        this.puff(item.to.x, item.to.z, now)
        if (this.onLanded) {
          this.onLanded(item.source, item.to.x, item.to.z)
        }
      }
    } else if (item.phase === "hop") {
      const v0 = Math.sqrt(2 * GRAVITY * HOP_CM)
      const hopTime = (2 * v0) / GRAVITY
      const h = e < hopTime ? Math.max(0, v0 * e - 0.5 * GRAVITY * e * e) : 0
      t.setLocalPosition(new vec3(item.to.x, item.to.y + h, item.to.z))
      if (e >= hopTime) {
        item.phase = "rest"
        item.t0 = now
      }
    } else if (item.phase === "rest") {
      // An item is on the floor only ~4.7 s (rest + shrink), shorter than one
      // query-aim-screenshot round trip; holdForReview keeps it there. keepLanded
      // keeps it for the evacuation's trip rule (5k item 8).
      if (e >= REST_SECONDS && !this.holdForReview && !this.keepLanded) {
        item.phase = "shrink"
        item.t0 = now
      }
    } else {
      const k = Math.max(0, 1 - e / SHRINK_SECONDS)
      t.setLocalScale(vec3.one().uniformScale(Math.max(0.001, k)))
      t.setLocalPosition(new vec3(item.to.x, item.to.y * k, item.to.z)) // stays on the floor
      if (k <= 0) {
        item.busy = false
        item.so.enabled = false
      }
    }
  }

  /** Spins about Y while falling and tips half a turn forward, so it lands flat. */
  private rotation(item: Item, s: number, tf: number): quat {
    const spin = quat.angleAxis(item.yaw0 + item.spin * tf, vec3.up())
    return quat.angleAxis(Math.PI * s, item.tumbleAxis).multiply(spin)
  }

  /** A free item, else the oldest one at rest or shrinking, else null (all six in the air). */
  private takeItem(): Item | null {
    for (let k = 0; k < this.items.length; k++) {
      const i = (this.nextItem + k) % this.items.length
      if (!this.items[i].busy) {
        this.nextItem = (i + 1) % this.items.length
        return this.items[i]
      }
    }
    let oldest: Item | null = null
    for (const item of this.items) {
      if ((item.phase === "rest" || item.phase === "shrink") && (!oldest || item.t0 < oldest.t0)) {
        oldest = item
      }
    }
    return oldest
  }
}
