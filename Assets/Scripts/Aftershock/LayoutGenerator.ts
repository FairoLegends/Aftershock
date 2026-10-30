// Procedural room layout (ENGINEERING_PLAN Slice 5P, §5j items 14–15). Pure and
// seedable: no scene access. Positions are Room-local cm with the user's start
// spot at the origin facing −Z, items standing on the floor (Y = 0). Yaw is
// radians about +Y (the runtime unit), so local +Z turns to (sin yaw, 0, cos yaw).

export type LayoutItem = "table" | "table2" | "cabinet" | "shelf" | "glass" | "lamp" | "tv" | "bed" | "chair"

/** Tables: cover under ANY of them counts (§5j-15a). The first is always present. */
export const TABLES: LayoutItem[] = ["table", "table2"]
/** Hazards: 3–5 of these per drill, no kind twice (§5j-15b). Each has a danger zone and a label. */
export const HAZARDS: LayoutItem[] = ["cabinet", "shelf", "glass", "lamp", "tv"]
/** Plain furniture, always present (§5j-14b): no danger zone, never cover. */
export const FURNITURE: LayoutItem[] = ["bed", "chair"]
export const ALL_ITEMS: LayoutItem[] = TABLES.concat(HAZARDS, FURNITURE)
/** Slice 9A (§5l-1): these stand with their back flush on a wall, facing into the room. */
export const WALL_BACKED: LayoutItem[] = ["cabinet", "shelf", "tv", "glass", "bed"]

export interface Footprint {
  halfX: number // cm, along the item's local X
  halfZ: number // cm, along the item's local Z
  front: number // radians: yaw of the item's front in its own frame (0 = +Z, π/2 = +X)
  model?: number // radians: extra turn of the model under its anchor when the prefab's mesh is not on the footprint's axes
}

/** Slice 11 (5l-7b): the headboard end's center in the Bed prefab's own frame (cm): its mesh lies along X, headboard at −X. */
export const BED_MODEL_HEAD = {x: -100, z: 0}

// The real model sizes (Assets/Aftershock/Prefabs, front +Z), on the axes the
// scene anchors use: the first four keep the box fallback's axes, so their
// models turn by `front` under the anchor. Not drill tunables.
export const FOOTPRINTS: Record<LayoutItem, Footprint> = {
  table: {halfX: 60, halfZ: 35, front: 0}, // 120 W × 70 D; square to the walls, the long side toward the start spot (5l-7f)
  table2: {halfX: 60, halfZ: 35, front: 0},
  cabinet: {halfX: 22.5, halfZ: 45, front: Math.PI / 2}, // 90 W × 45 D, front +X
  shelf: {halfX: 15, halfZ: 40, front: -Math.PI / 2}, // 80 W × 30 D, front −X
  glass: {halfX: 68, halfZ: 5, front: Math.PI}, // 136 W × 10 D: 120 cm pane in an 8 cm frame (Slice 8A); front −Z, back on a wall
  lamp: {halfX: 20, halfZ: 20, front: 0}, // 40 × 40
  tv: {halfX: 60, halfZ: 20, front: 0}, // 120 W × 40 D
  bed: {halfX: 45, halfZ: 100, front: 0, model: -Math.PI / 2}, // 90 W × 200 L, head end at −Z (on its wall), foot end at +Z; the model turns −90° so BED_MODEL_HEAD lands at −Z
  chair: {halfX: 22.5, halfZ: 25, front: 0} // 45 W × 50 D
}

export interface Placement {
  x: number // cm
  z: number // cm
  yaw: number // radians
}

export interface Layout {
  seed: number
  tries: number // whole-layout draws used; MAX_TRIES when it fell back
  fallback: boolean // true = no valid draw, FIXED_LAYOUT used
  /** Present items only; an absent item has no entry. */
  items: Partial<Record<LayoutItem, Placement>>
  tables: LayoutItem[] // present tables, "table" first
  hazards: LayoutItem[] // present hazards, in HAZARDS order
  /** Slice 9A: the walls, drawn first (ROOM_SIDE_MIN..MAX a side) with the start spot inside. */
  room: RoomRect
  /** The wall the glass stands on, or null without glass. */
  glassWall: WallSide | null
  /** Slice 11: the wall each wall-backed item stands on (the bed's head wall). */
  walls: Partial<Record<LayoutItem, WallSide>>
  door: DoorPlacement
}

/** A wall by its outward direction: "+z" is behind the start spot, "-z" in front of it. */
export type WallSide = "+x" | "-x" | "+z" | "-z"
export const WALL_SIDES: WallSide[] = ["+x", "-x", "+z", "-z"]

export interface RoomRect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface DoorPlacement {
  x: number // cm: the doorway's center on the wall line, on the floor
  z: number
  nx: number // unit normal into the room
  nz: number
  wall: WallSide
}

// Slice 8A walls and door (ENGINEERING_PLAN §5k items 1–3). Not drill tunables.
export const ROOM_MIN = 400 // cm: shortest wall (DC14 bound)
export const ROOM_MAX = 700 // cm: longest wall (DC14 bound)
export const DOOR_W = 90 // cm: doorway width
export const DOOR_H = 210 // cm: doorway height
export const DOOR_ZONE_DEPTH = 60 // cm: doorContains() floor rect in front of the door
const DOOR_CLEAR = 120 // cm in front of the door kept free of footprints, danger and safe zones
const DOOR_GLASS_GAP = 100 // cm: least distance from the doorway to the glass
const DOOR_CORNER = 20 // cm: least distance from a corner to the doorway
const DOOR_TRIES = 12 // spots per wall

// Slice 9A wall-backed layout (ENGINEERING_PLAN §5l item 1). Not drill tunables.
export const ROOM_SIDE_MIN = 420 // cm: each side of the room is drawn in ROOM_SIDE_MIN..MAX
export const ROOM_SIDE_MAX = 600
export const WALL_GAP = 2 // cm between a wall-backed item's back and its wall
const START_WALL_CLEAR = 60 // cm: the start spot keeps startClearRadius + this from every wall
const WALL_CORNER = 20 // cm: a wall-backed item keeps this from the room's corners
const TABLE_WALL_CLEAR = 50 // cm: tables keep this from every wall
const LAMP_NEAR_WALL = 40 // cm: the lamp prefers a spot within this of a wall
const CHAIR_TABLE_REACH = 150 // cm: a chair faces a table whose center is this close
const RELAX = 60 // cm: a wall item's max distance grows to reach its wall's center line + this

// Slice 11 room rules (ENGINEERING_PLAN §5l item 7b–e). Not drill tunables.
export const BED_WALKWAY = 60 // cm kept free of footprints and danger zones beside each long side not on a wall
export const BED_TABLE_GAP = 100 // cm: least distance from a table's footprint to the bed's
export const TV_BED_GAP = 150 // cm: least distance from the TV's footprint to the bed's
export const GLASS_FRONT_CLEAR = 80 // cm in front of the glass kept free of footprints
export const GLASS_SIDE_CLEAR = 30 // cm beside the glass frame kept free of footprints
export const LAMP_HEAD_BAND = 30 // cm: a bedside lamp's near edge is this close to the bed's head wall or closer
const BED_CORNER = 0.4 // odds the bed stands in a corner, a long side WALL_GAP from the other wall
const LAMP_BY_BED = 0.6 // odds the lamp stands beside the bed's head end when both are in the layout

/** The DrillConfig fields the layout reads (cm). DrillConfig satisfies this. */
export interface LayoutParams {
  tableDistanceMin: number
  tableDistanceMax: number
  hazardDistanceMin: number // every item except tables
  hazardDistanceMax: number
  tableCountMin: number
  tableCountMax: number
  hazardCountMin: number
  hazardCountMax: number
  dangerMargin: number
  tvDangerFront: number // the TV zone's reach in front (5l-4e)
  safeZoneMargin: number
  startClearRadius: number
  layoutSeed: number
}

/** Test-only override of the item set (DrillController.forceLayoutForTest). Positions stay random. */
export interface LayoutForce {
  tables?: number // 1 or 2
  hazards?: LayoutItem[] // which hazards, no kind twice
}

const SPACING = 30 // cm: footprints grown by this may not overlap (walkable gaps)
const MAX_TRIES = 1000
const ITEM_TRIES = 40 // draws per item inside one try before the try restarts
// Placement order after the tables: the big wall items first, the free ones last.
const PLACE_ORDER: LayoutItem[] = ["bed", "glass", "tv", "cabinet", "shelf", "lamp", "chair"]

// Slice 2 fixed layout (DESIGN_BRIEF §6), used when no draw is valid, plus the
// bed and chair (§5j-15): 1 table, cabinet, shelf, glass, bed, chair. Slice 9A:
// the cabinet (−X wall), shelf (+X wall), glass (+Z wall) and bed stand with
// their backs WALL_GAP from FIXED_ROOM's walls. Slice 11: the bed's head on the
// +X wall, its long side on the +Z wall (a corner), its walkway at z 68..128;
// the glass and chair moved clear of the bed and the glass front.
const FIXED_ROOM: RoomRect = {minX: -250, maxX: 250, minZ: -300, maxZ: 220}
const FIXED_LAYOUT: Partial<Record<LayoutItem, Placement>> = {
  table: {x: 0, z: -150, yaw: 0},
  cabinet: {x: -225.5, z: -60, yaw: 0},
  shelf: {x: 233, z: -150, yaw: 0},
  glass: {x: -120, z: 213, yaw: 0},
  bed: {x: 148, z: 173, yaw: -Math.PI / 2},
  chair: {x: -170, z: 60, yaw: 0}
}
const FIXED_WALLS: Partial<Record<LayoutItem, WallSide>> = {cabinet: "-x", shelf: "+x", glass: "+z", bed: "+x"}
const FIXED_DOOR: DoorPlacement = {x: -150, z: -300, nx: 0, nz: 1, wall: "-z"} // on the fixed room's −Z wall; used only if placeDoor finds no spot

interface Spot {
  at: Placement
  side: WallSide | null // the wall a wall-backed item stands on
}

/**
 * A new layout (§5j-14d, 15; Slice 9A §5l-1): first the room, each side
 * ROOM_SIDE_MIN..MAX, with the start spot inside at least startClearRadius +
 * START_WALL_CLEAR from every wall (not always centred). Then
 * tableCountMin..Max tables (centers tableDistanceMin..Max from the start spot,
 * TABLE_WALL_CLEAR from the walls, square to the walls with the long side
 * toward the start spot as best it can, 5l-7f), hazardCountMin..Max
 * hazards drawn from HAZARDS without repeats, and the bed and chair. The
 * WALL_BACKED items stand back to a wall (WALL_GAP), facing straight in,
 * WALL_CORNER from the corners, centers hazardDistanceMin..Max from the start
 * spot (the max grows to what the wall allows); the bed with its long side or
 * its head end on the wall. The lamp prefers a spot near a wall, any facing;
 * the chair, square to the walls too, faces a table within CHAIR_TABLE_REACH
 * as best it can, else any of the four ways.
 * Valid when no two footprints grown by SPACING overlap, no table, bed, chair
 * or danger zone comes within startClearRadius of the start spot, no danger
 * zone overlaps a safe zone and the bed and chair stay out of every safe zone;
 * a door on a wall keeps DOOR_CLEAR free in front (placeDoor). A draw that
 * breaks any of these is rejected.
 * layoutSeed 0 = a new seed each call; any other value = that seed, so the
 * same layout every time.
 */
export function generateLayout(p: LayoutParams, force: LayoutForce | null = null): Layout {
  const seed = p.layoutSeed !== 0 ? Math.floor(p.layoutSeed) : 1 + Math.floor(Math.random() * 2147483646)
  const random = mulberry32(seed)
  const tableCount = force && force.tables ? clampCount(force.tables, 1, TABLES.length) : drawCount(random, p.tableCountMin, p.tableCountMax, 1, TABLES.length)
  const tables = TABLES.slice(0, tableCount)
  const forced = force && force.hazards ? force.hazards : null
  const hazards = forced ? HAZARDS.filter((h) => forced.indexOf(h) >= 0) : pickHazards(random, drawCount(random, p.hazardCountMin, p.hazardCountMax, 0, HAZARDS.length))
  const present = hazards.concat(FURNITURE)
  const order = tables.concat(PLACE_ORDER.filter((i) => present.indexOf(i) >= 0))
  const lampByBed = present.indexOf("lamp") >= 0 && random() < LAMP_BY_BED // Slice 11 (5l-7c): once per layout
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    const room = drawRoom(random, p)
    const placed = placeAll(random, order, room, lampByBed, p)
    const door = placed ? placeDoor(random, placed.items, order, room, placed.glassWall, p) : null
    if (placed && door) {
      return {seed: seed, tries: tries, fallback: false, items: placed.items, tables: tables, hazards: hazards, room: room, glassWall: placed.glassWall, walls: placed.walls, door: door}
    }
  }
  const items = copyItems(FIXED_LAYOUT)
  const fixedOrder: LayoutItem[] = ["table", "cabinet", "shelf", "glass", "bed", "chair"]
  const rect = {minX: FIXED_ROOM.minX, maxX: FIXED_ROOM.maxX, minZ: FIXED_ROOM.minZ, maxZ: FIXED_ROOM.maxZ}
  return {
    seed: seed,
    tries: MAX_TRIES,
    fallback: true,
    items: items,
    tables: ["table"],
    hazards: ["cabinet", "shelf", "glass"],
    room: rect,
    glassWall: "+z",
    walls: {...FIXED_WALLS},
    door: placeDoor(mulberry32(seed), items, fixedOrder, rect, "+z", p) || FIXED_DOOR
  }
}

/** Slice 8A: true when (px, pz) is in the doorContains() floor rect, DOOR_W × DOOR_ZONE_DEPTH in front of the door. */
export function inDoorZone(door: DoorPlacement, px: number, pz: number): boolean {
  const dx = px - door.x
  const dz = pz - door.z
  const depth = dx * door.nx + dz * door.nz // into the room
  const lateral = dx * -door.nz + dz * door.nx
  return depth >= 0 && depth <= DOOR_ZONE_DEPTH && Math.abs(lateral) <= DOOR_W / 2
}

/** Yaw (radians) that turns an item at (x, z) so its front faces the start spot. */
export function yawFacingStart(x: number, z: number, front: number): number {
  return Math.atan2(-x, -z) - front
}

/**
 * Slice 9A: the item-frame yaws that may face into the room when the item is
 * wall-backed: their footprint front. Slice 11 (5l-7b): the bed only with its
 * head end on the wall (front 0, foot end out), never a long side.
 */
export function wallFronts(item: LayoutItem): number[] {
  return [FOOTPRINTS[item].front]
}

/** Slice 11: rect `r`'s four corners (Room-local cm). */
function corners(r: Rect): {x: number; z: number}[] {
  const c = Math.cos(r.yaw)
  const s = Math.sin(r.yaw)
  const out: {x: number; z: number}[] = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      out.push({x: r.x + sx * r.hx * c + sz * r.hz * s, z: r.z - sx * r.hx * s + sz * r.hz * c})
    }
  }
  return out
}

/** Slice 11: the shortest distance between two floor rects (0 when they overlap); exact for convex shapes: a corner of one is always in the closest pair. */
export function rectDistance(a: Rect, b: Rect): number {
  if (overlaps(a, b)) {
    return 0
  }
  let d = Infinity
  for (const [r, o] of [[a, b], [b, a]]) {
    for (const k of corners(r)) {
      d = Math.min(d, distanceToRect(k.x, k.z, o.x, o.z, o.yaw, o.hx, o.hz))
    }
  }
  return d
}

/** Slice 11: an item's footprint rect, grown by `grow` cm. */
export function footprintRect(item: LayoutItem, at: Placement, grow: number = 0): Rect {
  return footRect(item, at, grow)
}

/** Slice 11 (5l-7b): the BED_WALKWAY strips beside the bed's long sides that are inside the room (a side on a wall has none). */
export function bedWalkways(bed: Placement, room: RoomRect): Rect[] {
  const f = FOOTPRINTS.bed
  const out: Rect[] = []
  for (const side of [-1, 1]) {
    const off = side * (f.halfX + BED_WALKWAY / 2) // bed-local X; local X = (cos, −sin)
    const strip = {x: bed.x + off * Math.cos(bed.yaw), z: bed.z - off * Math.sin(bed.yaw), yaw: bed.yaw, hx: BED_WALKWAY / 2 - 0.5, hz: f.halfZ}
    if (insideRoom(strip, room, 0)) out.push(strip)
  }
  return out
}

/** Slice 11 (5l-7e): the rect kept free of footprints at the glass: GLASS_SIDE_CLEAR beside its frame, from its wall to GLASS_FRONT_CLEAR in front. */
export function glassClearRect(glass: Placement): Rect {
  const f = FOOTPRINTS.glass // front −Z in its frame (front π)
  const oz = (WALL_GAP - GLASS_FRONT_CLEAR) / 2 // the center moves toward the room; local Z = (sin, cos)
  return {
    x: glass.x + oz * Math.sin(glass.yaw),
    z: glass.z + oz * Math.cos(glass.yaw),
    yaw: glass.yaw,
    hx: f.halfX + GLASS_SIDE_CLEAR,
    hz: f.halfZ + (WALL_GAP + GLASS_FRONT_CLEAR) / 2
  }
}

/** Slice 11 (5l-7c): true when the lamp stands beside the bed's head end: its near edge LAMP_HEAD_BAND or less from the head wall, beside a long side (within 100 cm). */
export function isLampByBed(items: Partial<Record<LayoutItem, Placement>>): boolean {
  const bed = items.bed
  const lamp = items.lamp
  if (!bed || !lamp) {
    return false
  }
  const dx = lamp.x - bed.x
  const dz = lamp.z - bed.z
  const lx = dx * Math.cos(bed.yaw) - dz * Math.sin(bed.yaw) // bed-local
  const lz = dx * Math.sin(bed.yaw) + dz * Math.cos(bed.yaw)
  const b = FOOTPRINTS.bed
  const edge = lz - FOOTPRINTS.lamp.halfZ + b.halfZ + WALL_GAP // the lamp's near edge from the head wall
  return Math.abs(lx) > b.halfX && Math.abs(lx) <= b.halfX + 100 && edge >= 0 && edge <= LAMP_HEAD_BAND
}

/** Slice 9A: the wall's line, x for "+x"/"-x" and z for "+z"/"-z" (Room-local cm). */
export function wallLine(room: RoomRect, side: WallSide): number {
  return side === "+x" ? room.maxX : side === "-x" ? room.minX : side === "+z" ? room.maxZ : room.minZ
}

/** Slice 9A: the wall's unit floor normal into the room. */
export function wallInward(side: WallSide): {x: number; z: number} {
  return side === "+x" ? {x: -1, z: 0} : side === "-x" ? {x: 1, z: 0} : side === "+z" ? {x: 0, z: -1} : {x: 0, z: 1}
}

/**
 * True when (px, pz) lies in the rectangle centered at (cx, cz), turned by yaw
 * (radians), with half-sizes hx along its local X and hz along its local Z.
 */
export function insideRect(px: number, pz: number, cx: number, cz: number, yaw: number, hx: number, hz: number): boolean {
  const dx = px - cx
  const dz = pz - cz
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  // Local X = (cos, −sin), local Z = (sin, cos) on (x, z).
  return Math.abs(dx * c - dz * s) <= hx && Math.abs(dx * s + dz * c) <= hz
}

/** Shortest XZ distance from (px, pz) to a turned rectangle (0 when inside). */
export function distanceToRect(px: number, pz: number, cx: number, cz: number, yaw: number, hx: number, hz: number): number {
  return distanceFrom({x: cx - px, z: cz - pz, yaw: yaw, hx: hx, hz: hz})
}

export function isTable(item: LayoutItem): boolean {
  return TABLES.indexOf(item) >= 0
}

export function isHazard(item: LayoutItem): boolean {
  return HAZARDS.indexOf(item) >= 0
}

/** A turned floor rectangle (cm, radians): half-sizes hx along its local X, hz along its local Z. */
export interface Rect {
  x: number
  z: number
  yaw: number
  hx: number
  hz: number
}

/**
 * A hazard's danger zone (5l-4e/h), Room-local. A wall-backed hazard (cabinet,
 * shelf, TV, glass) grows `margin` to both sides and to the front only, never
 * behind into its wall; the TV grows `tvFront` to the front (it topples
 * forward). The lamp stands free: its turned footprint's room-aligned box grown
 * by `margin` all round. Every zone is room-aligned, so clipToRoom is exact.
 */
export function dangerRect(item: LayoutItem, at: Placement, margin: number, tvFront: number): Rect {
  const f = FOOTPRINTS[item]
  if (WALL_BACKED.indexOf(item) < 0) {
    const c = Math.abs(Math.cos(at.yaw))
    const s = Math.abs(Math.sin(at.yaw))
    return {x: at.x, z: at.z, yaw: 0, hx: f.halfX * c + f.halfZ * s + margin, hz: f.halfX * s + f.halfZ * c + margin}
  }
  const grow = item === "tv" ? tvFront : margin
  const fx = Math.round(Math.sin(f.front)) // the front in the item's frame: ±local X or ±local Z
  const fz = Math.round(Math.cos(f.front))
  const ox = (fx * grow) / 2 // the center moves half the front growth forward
  const oz = (fz * grow) / 2
  const c = Math.cos(at.yaw)
  const s = Math.sin(at.yaw)
  return {
    x: at.x + ox * c + oz * s, // local X = (cos, −sin), local Z = (sin, cos)
    z: at.z - ox * s + oz * c,
    yaw: at.yaw,
    hx: f.halfX + (fx !== 0 ? grow / 2 : margin),
    hz: f.halfZ + (fz !== 0 ? grow / 2 : margin)
  }
}

/** The room-aligned rect `r` cut to the walls (5l-4h): a zone never reaches past them. */
export function clipToRoom(r: Rect, room: RoomRect): Rect {
  const turned = Math.abs(Math.sin(r.yaw)) > 0.5 // local X runs along room Z
  const ex = turned ? r.hz : r.hx
  const ez = turned ? r.hx : r.hz
  const minX = Math.max(room.minX, r.x - ex)
  const maxX = Math.max(minX, Math.min(room.maxX, r.x + ex))
  const minZ = Math.max(room.minZ, r.z - ez)
  const maxZ = Math.max(minZ, Math.min(room.maxZ, r.z + ez))
  const hx = (maxX - minX) / 2
  const hz = (maxZ - minZ) / 2
  return {x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, yaw: r.yaw, hx: turned ? hz : hx, hz: turned ? hx : hz}
}

/** The room: each side ROOM_SIDE_MIN..MAX, the start spot (origin) startClearRadius + START_WALL_CLEAR from every wall. */
function drawRoom(random: () => number, p: LayoutParams): RoomRect {
  const c = p.startClearRadius + START_WALL_CLEAR
  const w = ROOM_SIDE_MIN + random() * (ROOM_SIDE_MAX - ROOM_SIDE_MIN)
  const d = ROOM_SIDE_MIN + random() * (ROOM_SIDE_MAX - ROOM_SIDE_MIN)
  const minX = -(c + random() * Math.max(0, w - 2 * c))
  const minZ = -(c + random() * Math.max(0, d - 2 * c))
  return {minX: minX, maxX: minX + w, minZ: minZ, maxZ: minZ + d}
}

/**
 * Places `order` one item at a time against the items already placed; null
 * when one item finds no spot. Also returns the glass's wall.
 */
function placeAll(
  random: () => number,
  order: LayoutItem[],
  room: RoomRect,
  lampByBed: boolean,
  p: LayoutParams
): {items: Partial<Record<LayoutItem, Placement>>; glassWall: WallSide | null; walls: Partial<Record<LayoutItem, WallSide>>} | null {
  const items: Partial<Record<LayoutItem, Placement>> = {}
  const walls: Partial<Record<LayoutItem, WallSide>> = {}
  const placed: LayoutItem[] = []
  let glassWall: WallSide | null = null
  for (const item of order) {
    let ok = false
    for (let i = 0; i < ITEM_TRIES && !ok; i++) {
      const spot = item === "lamp" && lampByBed && items.bed ? drawBedside(random, items.bed, room) : drawItem(random, item, i, items, walls, room, p)
      if (!spot) continue
      items[item] = spot.at
      ok = fits(items, item, placed, room, lampByBed, p)
      if (ok && item === "glass") glassWall = spot.side
      if (ok && spot.side) walls[item] = spot.side
    }
    if (!ok) {
      return null
    }
    placed.push(item)
  }
  return {items: items, glassWall: glassWall, walls: walls}
}

/** Slice 11 (5l-7c): the lamp beside the bed's head end, on a free long side, 61-75 cm out (SPACING both ways), its near edge WALL_GAP..LAMP_HEAD_BAND from the head wall. */
function drawBedside(random: () => number, bed: Placement | undefined, room: RoomRect): Spot | null {
  if (!bed) {
    return null
  }
  const b = FOOTPRINTS.bed
  const f = FOOTPRINTS.lamp
  const side = random() < 0.5 ? -1 : 1
  const lx = side * (b.halfX + 2 * SPACING + f.halfX + 1 + random() * 14) // bed-local
  const lz = -b.halfZ + f.halfZ + random() * (LAMP_HEAD_BAND - WALL_GAP - 2)
  const c = Math.cos(bed.yaw)
  const s = Math.sin(bed.yaw)
  const at = {x: bed.x + lx * c + lz * s, z: bed.z - lx * s + lz * c, yaw: bed.yaw}
  return insideRoom(footRect("lamp", at, 0), room, WALL_GAP) ? {at: at, side: null} : null
}

/** One candidate spot for `item` (attempt `i` of ITEM_TRIES), or null when the draw missed the room. */
function drawItem(
  random: () => number,
  item: LayoutItem,
  i: number,
  items: Partial<Record<LayoutItem, Placement>>,
  walls: Partial<Record<LayoutItem, WallSide>>,
  room: RoomRect,
  p: LayoutParams
): Spot | null {
  if (WALL_BACKED.indexOf(item) >= 0) {
    return drawOnWall(random, item, room, p, item === "tv" ? walls.bed : undefined) // 5l-7d: never on the bed's wall
  }
  if (isTable(item)) {
    const at = draw(random, item, p.tableDistanceMin, p.tableDistanceMax)
    at.yaw = squareYaw(at.yaw) // 5l-7f: square to the walls, the long side toward the start spot as best it can
    return insideRoom(footRect(item, at, 0), room, TABLE_WALL_CLEAR) ? {at: at, side: null} : null
  }
  if (item === "lamp" && i < ITEM_TRIES / 2) {
    return drawNearWall(random, room, p)
  }
  const at = draw(random, item, p.hazardDistanceMin, p.hazardDistanceMax)
  if (item === "lamp") at.yaw = (random() * 2 - 1) * Math.PI
  if (item === "chair") at.yaw = chairYaw(random, at, items)
  return insideRoom(footRect(item, at, 0), room, WALL_GAP) ? {at: at, side: null} : null
}

/**
 * A wall-backed spot: a random wall, the back WALL_GAP from its line, the front
 * straight into the room, WALL_CORNER from both corners, the center
 * hazardDistanceMin..max from the start spot, where max is hazardDistanceMax or,
 * when that cannot reach this wall, the wall's center-line distance + RELAX.
 */
function drawOnWall(random: () => number, item: LayoutItem, room: RoomRect, p: LayoutParams, avoid?: WallSide): Spot | null {
  const f = FOOTPRINTS[item]
  const sides = WALL_SIDES.filter((w) => w !== avoid)
  const side = sides[Math.floor(random() * sides.length)]
  const front = wallFronts(item)[0]
  const sideways = Math.abs(Math.sin(front)) > 0.5 // front along the item's X
  const depth = sideways ? f.halfX : f.halfZ
  const width = sideways ? f.halfZ : f.halfX
  const n = wallInward(side)
  const wallX = side === "+x" || side === "-x" // the wall line is x = const
  const perp = wallLine(room, side) + (wallX ? n.x : n.z) * (WALL_GAP + depth)
  const along = item === "bed" ? bedAlong(random, room, wallX, width, perp, p) : alongSpan(random, room, wallX, WALL_CORNER + width, perp, p)
  if (along === null) {
    return null
  }
  const yaw = wrap(Math.atan2(n.x, n.z) - front)
  const at = wallX ? {x: perp, z: along, yaw: yaw} : {x: along, z: perp, yaw: yaw}
  return {at: at, side: side}
}

/** Slice 11 (5l-7b): the bed along its head wall: with odds BED_CORNER in a corner (a long side WALL_GAP from the other wall), else BED_WALKWAY free beside both long sides. */
function bedAlong(random: () => number, room: RoomRect, wallX: boolean, width: number, perp: number, p: LayoutParams): number | null {
  if (random() < BED_CORNER) {
    const u = random() < 0.5 ? (wallX ? room.minZ : room.minX) + WALL_GAP + width : (wallX ? room.maxZ : room.maxX) - WALL_GAP - width
    return Math.sqrt(u * u + perp * perp) >= p.hazardDistanceMin ? u : null
  }
  return alongSpan(random, room, wallX, WALL_GAP + BED_WALKWAY + width, perp, p)
}

/** The lamp near a wall or corner: its footprint LAMP_NEAR_WALL or less from a random wall, any facing. */
function drawNearWall(random: () => number, room: RoomRect, p: LayoutParams): Spot | null {
  const f = FOOTPRINTS.lamp
  const side = WALL_SIDES[Math.floor(random() * WALL_SIDES.length)]
  const yaw = (random() * 2 - 1) * Math.PI
  const c = Math.abs(Math.cos(yaw))
  const s = Math.abs(Math.sin(yaw))
  const ex = f.halfX * c + f.halfZ * s
  const ez = f.halfX * s + f.halfZ * c
  const wallX = side === "+x" || side === "-x"
  const n = wallInward(side)
  const gap = WALL_GAP + random() * (LAMP_NEAR_WALL - WALL_GAP)
  const perp = wallLine(room, side) + (wallX ? n.x : n.z) * (gap + (wallX ? ex : ez))
  const along = alongSpan(random, room, wallX, WALL_GAP + (wallX ? ez : ex), perp, p)
  if (along === null) {
    return null
  }
  return {at: wallX ? {x: perp, z: along, yaw: yaw} : {x: along, z: perp, yaw: yaw}, side: null}
}

/**
 * A random coordinate along a wall (z for an x = const wall, else x), `inset`
 * from both corners, whose point at `perp` lies hazardDistanceMin..reach from
 * the start spot; null when there is none.
 */
function alongSpan(random: () => number, room: RoomRect, wallX: boolean, inset: number, perp: number, p: LayoutParams): number | null {
  const reach = Math.max(p.hazardDistanceMax, Math.abs(perp) + RELAX)
  const half = Math.sqrt(Math.max(0, reach * reach - perp * perp))
  const lo = Math.max((wallX ? room.minZ : room.minX) + inset, -half)
  const hi = Math.min((wallX ? room.maxZ : room.maxX) - inset, half)
  if (hi < lo) {
    return null
  }
  const u = lo + random() * (hi - lo)
  return Math.sqrt(u * u + perp * perp) >= p.hazardDistanceMin ? u : null
}

/** A chair square to the walls (5l-7f): of the four ways, the one that best faces the nearest table whose center is CHAIR_TABLE_REACH or closer, else any of the four. */
function chairYaw(random: () => number, at: Placement, items: Partial<Record<LayoutItem, Placement>>): number {
  let best: Placement | null = null
  let bestD = CHAIR_TABLE_REACH
  for (const t of TABLES) {
    const tp = items[t]
    if (!tp) continue
    const d = Math.sqrt((tp.x - at.x) * (tp.x - at.x) + (tp.z - at.z) * (tp.z - at.z))
    if (d <= bestD) {
      best = tp
      bestD = d
    }
  }
  return best ? squareYaw(Math.atan2(best.x - at.x, best.z - at.z) - FOOTPRINTS.chair.front) : wrap((Math.floor(random() * 4) * Math.PI) / 2)
}

/** 5l-7f: the multiple of 90° nearest `a`, in (−π, π]. */
function squareYaw(a: number): number {
  return wrap(Math.round(a / (Math.PI / 2)) * (Math.PI / 2))
}

/** True when the turned rect `r` lies inside `room` shrunk by `clear` on every side. */
function insideRoom(r: Rect, room: RoomRect, clear: number): boolean {
  const c = Math.abs(Math.cos(r.yaw))
  const s = Math.abs(Math.sin(r.yaw))
  const ex = r.hx * c + r.hz * s
  const ez = r.hx * s + r.hz * c
  return r.x - ex >= room.minX + clear && r.x + ex <= room.maxX - clear && r.z - ez >= room.minZ + clear && r.z + ez <= room.maxZ - clear
}

/** Angle in (−π, π]. */
function wrap(a: number): number {
  let r = a
  while (r > Math.PI) r -= 2 * Math.PI
  while (r <= -Math.PI) r += 2 * Math.PI
  return r
}

/**
 * The door: on a side or the back wall (not the glass wall) first, then the
 * front wall, then the glass wall. Its DOOR_CLEAR × DOOR_W floor in front stays
 * out of every footprint, danger zone and safe zone and off the start spot,
 * and the doorway keeps DOOR_GLASS_GAP from the glass.
 */
function placeDoor(
  random: () => number,
  items: Partial<Record<LayoutItem, Placement>>,
  all: LayoutItem[],
  room: RoomRect,
  glassWall: WallSide | null,
  p: LayoutParams
): DoorPlacement | null {
  const walls = shuffle(random, (["+x", "-x", "+z"] as WallSide[]).filter((s) => s !== glassWall))
  if (glassWall !== "-z") walls.push("-z")
  if (glassWall) walls.push(glassWall)
  for (const wall of walls) {
    for (let i = 0; i < DOOR_TRIES; i++) {
      const door = doorOn(random, wall, room)
      if (door && doorFits(door, items, all, p)) {
        return door
      }
    }
  }
  return null
}

function doorOn(random: () => number, wall: WallSide, room: RoomRect): DoorPlacement | null {
  const alongX = wall === "+z" || wall === "-z" // the wall runs along X
  const lo = (alongX ? room.minX : room.minZ) + DOOR_W / 2 + DOOR_CORNER
  const hi = (alongX ? room.maxX : room.maxZ) - DOOR_W / 2 - DOOR_CORNER
  if (hi < lo) {
    return null
  }
  const t = lo + random() * (hi - lo)
  if (wall === "+x") return {x: room.maxX, z: t, nx: -1, nz: 0, wall: wall}
  if (wall === "-x") return {x: room.minX, z: t, nx: 1, nz: 0, wall: wall}
  if (wall === "+z") return {x: t, z: room.maxZ, nx: 0, nz: -1, wall: wall}
  return {x: t, z: room.minZ, nx: 0, nz: 1, wall: wall}
}

function doorFits(door: DoorPlacement, items: Partial<Record<LayoutItem, Placement>>, all: LayoutItem[], p: LayoutParams): boolean {
  const clear = doorRect(door, DOOR_CLEAR, 0)
  if (distanceFrom(clear) < p.startClearRadius) {
    return false
  }
  for (const item of all) {
    if (!items[item]) continue
    const zone = isHazard(item) ? zoneOf(items, item, p) : rectOf(items, item, isTable(item) ? p.safeZoneMargin : 0) // a zone holds its footprint
    if (overlaps(clear, zone)) {
      return false
    }
    if (item === "glass" && overlaps(doorRect(door, 0, DOOR_GLASS_GAP), rectOf(items, item, 0))) {
      return false
    }
  }
  return true
}

/** The floor rect `depth` cm into the room from the doorway, DOOR_W wide, grown by `grow`. */
function doorRect(door: DoorPlacement, depth: number, grow: number): Rect {
  const x = door.x + (door.nx * depth) / 2
  const z = door.z + (door.nz * depth) / 2
  const along = DOOR_W / 2 + grow
  const across = depth / 2 + grow
  return door.nx !== 0 ? {x: x, z: z, yaw: 0, hx: across, hz: along} : {x: x, z: z, yaw: 0, hx: along, hz: across}
}

function shuffle<T>(random: () => number, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const t = list[i]
    list[i] = list[j]
    list[j] = t
  }
  return list
}

/** True when `item` (already in `items`) keeps every rule against the `placed` items. */
function fits(
  items: Partial<Record<LayoutItem, Placement>>,
  item: LayoutItem,
  placed: LayoutItem[],
  room: RoomRect,
  lampByBed: boolean,
  p: LayoutParams
): boolean {
  // Hazards keep their whole danger zone clear of the start spot; the rest their footprint.
  const own = isHazard(item) ? zoneOf(items, item, p) : rectOf(items, item, 0)
  if (distanceFrom(own) < p.startClearRadius) {
    return false
  }
  const spaced = rectOf(items, item, SPACING)
  for (const other of placed) {
    if (overlaps(spaced, rectOf(items, other, SPACING))) {
      return false
    }
    if (!roomRules(items, item, other)) {
      return false
    }
    if (isTable(item) !== isTable(other)) {
      // A danger zone, the bed or the chair may not reach into any safe zone.
      const table = isTable(item) ? item : other
      const thing = isTable(item) ? other : item
      const safe = rectOf(items, table, p.safeZoneMargin)
      if (overlaps(safe, isHazard(thing) ? zoneOf(items, thing, p) : rectOf(items, thing, 0))) {
        return false
      }
    }
  }
  return walkwaysClear(items, placed.concat([item]), room, lampByBed, p)
}

/** Slice 11 (5l-7b, d, e): tables BED_TABLE_GAP and the TV TV_BED_GAP from the bed; no footprint in the glass's clear rect. */
function roomRules(items: Partial<Record<LayoutItem, Placement>>, a: LayoutItem, b: LayoutItem): boolean {
  const pair = (x: LayoutItem, y: LayoutItem): boolean => (a === x && b === y) || (a === y && b === x)
  const gap = (): number => rectDistance(rectOf(items, a, 0), rectOf(items, b, 0))
  if ((a === "bed" && isTable(b)) || (b === "bed" && isTable(a))) {
    if (gap() < BED_TABLE_GAP) return false
  }
  if (pair("bed", "tv") && gap() < TV_BED_GAP) {
    return false
  }
  if (a === "glass" || b === "glass") {
    const other = a === "glass" ? b : a
    if (overlaps(glassClearRect(items.glass as Placement), rectOf(items, other, 0))) return false
  }
  return true
}

/** Slice 11 (5l-7b): the bed has a walkway, and no footprint or danger zone of `present` reaches into one (the bedside lamp stands just past it). */
function walkwaysClear(items: Partial<Record<LayoutItem, Placement>>, present: LayoutItem[], room: RoomRect, lampByBed: boolean, p: LayoutParams): boolean {
  if (present.indexOf("bed") < 0) {
    return true
  }
  const strips = bedWalkways(items.bed as Placement, room)
  if (strips.length === 0) {
    return false
  }
  const bedside = lampByBed && isLampByBed(items)
  for (const strip of strips) {
    for (const other of present) {
      if (other === "bed" || (other === "lamp" && bedside)) continue
      if (overlaps(strip, rectOf(items, other, 0)) || (isHazard(other) && overlaps(strip, zoneOf(items, other, p)))) return false
    }
  }
  return true
}

/** A center min..max from the start spot at a random bearing, facing the start spot. */
function draw(random: () => number, item: LayoutItem, min: number, max: number): Placement {
  const d = min + random() * Math.max(0, max - min)
  const bearing = (random() * 2 - 1) * Math.PI // 0 = straight ahead (−Z)
  const x = d * Math.sin(bearing)
  const z = -d * Math.cos(bearing)
  return {x: x, z: z, yaw: yawFacingStart(x, z, FOOTPRINTS[item].front)}
}

function drawCount(random: () => number, min: number, max: number, lo: number, hi: number): number {
  const a = clampCount(Math.min(min, max), lo, hi)
  const b = clampCount(Math.max(min, max), lo, hi)
  return a + Math.min(b - a, Math.floor(random() * (b - a + 1)))
}

function clampCount(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

/** `count` hazards without repeats, in HAZARDS order. */
function pickHazards(random: () => number, count: number): LayoutItem[] {
  const pool = HAZARDS.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  const chosen = pool.slice(0, count)
  return HAZARDS.filter((h) => chosen.indexOf(h) >= 0)
}

function rectOf(items: Partial<Record<LayoutItem, Placement>>, item: LayoutItem, grow: number): Rect {
  return footRect(item, items[item], grow)
}

/** A hazard's danger zone (dangerRect), unclipped: the walls only cut parts no rule tests. */
function zoneOf(items: Partial<Record<LayoutItem, Placement>>, item: LayoutItem, p: LayoutParams): Rect {
  return dangerRect(item, items[item], p.dangerMargin, p.tvDangerFront)
}

function footRect(item: LayoutItem, at: Placement, grow: number): Rect {
  const f = FOOTPRINTS[item]
  return {x: at.x, z: at.z, yaw: at.yaw, hx: f.halfX + grow, hz: f.halfZ + grow}
}

/** Shortest distance from the origin to the rectangle (0 when inside). */
function distanceFrom(r: Rect): number {
  const c = Math.cos(r.yaw)
  const s = Math.sin(r.yaw)
  const lx = -r.x * c + r.z * s
  const lz = -r.x * s - r.z * c
  const ox = Math.max(0, Math.abs(lx) - r.hx)
  const oz = Math.max(0, Math.abs(lz) - r.hz)
  return Math.sqrt(ox * ox + oz * oz)
}

/** Separating-axis test for two turned rectangles on the floor. */
export function overlaps(a: Rect, b: Rect): boolean {
  const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2]
  const dx = b.x - a.x
  const dz = b.z - a.z
  for (const yaw of axes) {
    // Test axis = local X of a frame turned by yaw: (cos, −sin).
    const nx = Math.cos(yaw)
    const nz = -Math.sin(yaw)
    if (Math.abs(dx * nx + dz * nz) > projectedHalf(a, nx, nz) + projectedHalf(b, nx, nz)) {
      return false
    }
  }
  return true
}

function projectedHalf(r: Rect, nx: number, nz: number): number {
  const c = Math.cos(r.yaw)
  const s = Math.sin(r.yaw)
  return r.hx * Math.abs(c * nx - s * nz) + r.hz * Math.abs(s * nx + c * nz)
}

function copyItems(src: Partial<Record<LayoutItem, Placement>>): Partial<Record<LayoutItem, Placement>> {
  const out: Partial<Record<LayoutItem, Placement>> = {}
  for (const item of ALL_ITEMS) {
    const at = src[item]
    if (at) out[item] = {x: at.x, z: at.z, yaw: at.yaw}
  }
  return out
}

/** Small seedable PRNG (mulberry32): the same seed gives the same draws, in 0..1. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
