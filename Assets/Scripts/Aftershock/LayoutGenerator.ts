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

export interface Footprint {
  halfX: number // cm, along the item's local X
  halfZ: number // cm, along the item's local Z
  front: number // radians: yaw of the item's front in its own frame (0 = +Z, π/2 = +X)
}

// The real model sizes (Assets/Aftershock/Prefabs, front +Z), on the axes the
// scene anchors use: the first four keep the box fallback's axes, so their
// models turn by `front` under the anchor. Not drill tunables.
export const FOOTPRINTS: Record<LayoutItem, Footprint> = {
  table: {halfX: 60, halfZ: 35, front: 0}, // 120 W × 70 D; the long side faces the start spot
  table2: {halfX: 60, halfZ: 35, front: 0},
  cabinet: {halfX: 22.5, halfZ: 45, front: Math.PI / 2}, // 90 W × 45 D, front +X
  shelf: {halfX: 15, halfZ: 40, front: -Math.PI / 2}, // 80 W × 30 D, front −X
  glass: {halfX: 68, halfZ: 5, front: Math.PI}, // 136 W × 10 D: 120 cm pane in an 8 cm frame (Slice 8A); front −Z, back on a wall
  lamp: {halfX: 20, halfZ: 20, front: 0}, // 40 × 40
  tv: {halfX: 60, halfZ: 20, front: 0}, // 120 W × 40 D
  bed: {halfX: 45, halfZ: 100, front: 0}, // 90 W × 200 L, foot end at +Z
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
  /** Slice 8A: the walls, an axis-aligned rect (cm) around every footprint and the start spot. */
  room: RoomRect
  /** The wall the glass stands on, or null without glass. */
  glassWall: WallSide | null
  door: DoorPlacement
}

/** A wall by its outward direction: "+z" is behind the start spot, "-z" in front of it. */
export type WallSide = "+x" | "-x" | "+z" | "-z"

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
export const WALL_MARGIN = 40 // cm: walls stand this far outside every footprint and the start spot
export const ROOM_MIN = 400 // cm: shortest wall
export const ROOM_MAX = 700 // cm: longest wall; a draw that needs more is rejected
export const DOOR_W = 90 // cm: doorway width
export const DOOR_H = 210 // cm: doorway height
export const DOOR_ZONE_DEPTH = 60 // cm: doorContains() floor rect in front of the door
const DOOR_CLEAR = 120 // cm in front of the door kept free of footprints, danger and safe zones
const DOOR_GLASS_GAP = 100 // cm: least distance from the doorway to the glass
const DOOR_CORNER = 20 // cm: least distance from a corner to the doorway
const DOOR_TRIES = 12 // spots per wall

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

// Slice 2 fixed layout (DESIGN_BRIEF §6), used when no draw is valid, plus the
// bed and chair (§5j-15): 1 table, cabinet, shelf, glass, bed, chair. Slice 8A:
// the glass backs onto the +Z wall and nothing reaches past it.
const FIXED_LAYOUT: Partial<Record<LayoutItem, Placement>> = {
  table: {x: 0, z: -150, yaw: 0},
  cabinet: {x: -150, z: -40, yaw: 0},
  shelf: {x: 130, z: -60, yaw: 0}, // Slice 8A: was x 150; its danger zone left the +X wall's door spots
  glass: {x: 0, z: 200, yaw: 0},
  bed: {x: 190, z: 90, yaw: Math.PI / 2},
  chair: {x: -170, z: 120, yaw: 0}
}
const FIXED_DOOR: DoorPlacement = {x: 330, z: -80, nx: -1, nz: 0, wall: "+x"} // on the fixed layout's +X wall; used only if placeDoor finds no spot

/**
 * A new layout (§5j-14d, 15): tableCountMin..Max tables (centers
 * tableDistanceMin..Max from the start spot), hazardCountMin..Max hazards
 * drawn from HAZARDS without repeats, and the bed and chair (centers
 * hazardDistanceMin..Max), each at a random bearing and facing the start spot.
 * Valid when no two footprints grown by SPACING overlap, no table, bed, chair
 * or danger zone comes within startClearRadius of the start spot, no danger
 * zone overlaps a safe zone and the bed and chair stay out of every safe zone.
 * Slice 8A: the glass goes last, back flush on a wall; the walls (room) hold
 * every footprint and the start spot grown by WALL_MARGIN, each ROOM_MIN to
 * ROOM_MAX long; a door on a wall keeps DOOR_CLEAR free in front (placeDoor).
 * A draw that breaks any of these is rejected.
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
  const order = tables.concat(hazards.filter((h) => h !== "glass"), FURNITURE)
  const glass = hazards.indexOf("glass") >= 0
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    const items = placeAll(random, order, p)
    const room = items ? placeWalls(random, items, order, glass, p) : null
    if (room) {
      return {seed: seed, tries: tries, fallback: false, items: items, tables: tables, hazards: hazards, room: room.rect, glassWall: room.glassWall, door: room.door}
    }
  }
  const items = copyItems(FIXED_LAYOUT)
  const fixedOrder: LayoutItem[] = ["table", "cabinet", "shelf", "bed", "chair"]
  const rect = roomRect(items, fixedOrder, "+z", FIXED_LAYOUT.glass.z + FOOTPRINTS.glass.halfZ) || boundsOf(items, fixedOrder)
  return {
    seed: seed,
    tries: MAX_TRIES,
    fallback: true,
    items: items,
    tables: ["table"],
    hazards: ["cabinet", "shelf", "glass"],
    room: rect,
    glassWall: "+z",
    door: placeDoor(mulberry32(seed), items, fixedOrder.concat(["glass"]), rect, "+z", p) || FIXED_DOOR
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

interface Rect {
  x: number
  z: number
  yaw: number
  hx: number
  hz: number
}

/**
 * Places `order` one item at a time against the items already placed; null
 * when one item finds no spot. Slice 8A: the start spot and every footprint,
 * grown by WALL_MARGIN, must fit in ROOM_MAX × ROOM_MAX.
 */
function placeAll(random: () => number, order: LayoutItem[], p: LayoutParams): Partial<Record<LayoutItem, Placement>> | null {
  const items: Partial<Record<LayoutItem, Placement>> = {}
  const placed: LayoutItem[] = []
  for (const item of order) {
    const min = isTable(item) ? p.tableDistanceMin : p.hazardDistanceMin
    const max = isTable(item) ? p.tableDistanceMax : p.hazardDistanceMax
    let ok = false
    for (let i = 0; i < ITEM_TRIES && !ok; i++) {
      items[item] = draw(random, item, min, max)
      ok = fits(items, item, placed, p) && fitsRoom(boundsOf(items, placed.concat([item])))
    }
    if (!ok) {
      return null
    }
    placed.push(item)
  }
  return items
}

const SIDES: WallSide[] = ["+x", "-x", "+z", "-z"]

/**
 * Slice 8A: stands the glass (when present) with its back flush on a wall,
 * facing in, then the walls around everything and the door. Null when the
 * glass or the door finds no spot or a wall would pass ROOM_MAX.
 */
function placeWalls(
  random: () => number,
  items: Partial<Record<LayoutItem, Placement>>,
  order: LayoutItem[],
  glass: boolean,
  p: LayoutParams
): {rect: RoomRect; glassWall: WallSide | null; door: DoorPlacement} | null {
  let glassWall: WallSide | null = null
  let rect: RoomRect | null = null
  if (glass) {
    const b = boundsOf(items, order)
    for (let i = 0; i < ITEM_TRIES && !glassWall; i++) {
      const side = SIDES[Math.floor(random() * SIDES.length)]
      const wall = drawGlassOnWall(random, side, b, items)
      if (wall === null) continue
      const at = items.glass
      const d = Math.sqrt(at.x * at.x + at.z * at.z)
      if (d >= p.hazardDistanceMin && d <= p.hazardDistanceMax && fits(items, "glass", order, p)) {
        rect = roomRect(items, order, side, wall)
        if (rect) glassWall = side
      }
    }
    if (!glassWall) {
      delete items.glass
      return null
    }
  } else {
    rect = roomRect(items, order, null, 0)
  }
  if (!rect) {
    return null
  }
  const door = placeDoor(random, items, glass ? order.concat(["glass"]) : order, rect, glassWall, p)
  return door ? {rect: rect, glassWall: glassWall, door: door} : null
}

/**
 * Draws a wall line on `side` beyond the bounds `b` (so the span stays within
 * ROOM_MAX) and puts the glass on it, back to the wall; returns the wall line,
 * or null when that side has no room.
 */
function drawGlassOnWall(random: () => number, side: WallSide, b: RoomRect, items: Partial<Record<LayoutItem, Placement>>): number | null {
  const wallX = side === "+x" || side === "-x" // the wall line is x = const
  const sign = side.charAt(0) === "+" ? 1 : -1
  const lo = wallX ? b.minX : b.minZ
  const hi = wallX ? b.maxX : b.maxZ
  const wMin = sign > 0 ? hi : hi - ROOM_MAX
  const wMax = sign > 0 ? lo + ROOM_MAX : lo
  const reach = FOOTPRINTS.glass.halfX + WALL_MARGIN
  const llo = wallX ? b.minZ : b.minX
  const lhi = wallX ? b.maxZ : b.maxX
  const uMin = lhi - ROOM_MAX + reach
  const uMax = llo + ROOM_MAX - reach
  if (wMax < wMin || uMax < uMin) {
    return null
  }
  const wall = wMin + random() * (wMax - wMin)
  const u = uMin + random() * (uMax - uMin)
  const c = wall - sign * FOOTPRINTS.glass.halfZ
  // Glass front is its local −Z (FOOTPRINTS.glass.front = π): yaw 0 faces −Z.
  const yaw = side === "+z" ? 0 : side === "-z" ? Math.PI : side === "+x" ? Math.PI / 2 : -Math.PI / 2
  items.glass = wallX ? {x: c, z: u, yaw: yaw} : {x: u, z: c, yaw: yaw}
  return wall
}

/**
 * The walls: the bounds of `list` (and the glass, whose wall is `wall` on
 * `glassWall`), each side at least ROOM_MIN (grown evenly, or away from the
 * glass wall); null when a side passes ROOM_MAX.
 */
function roomRect(items: Partial<Record<LayoutItem, Placement>>, list: LayoutItem[], glassWall: WallSide | null, wall: number): RoomRect | null {
  const b = boundsOf(items, list)
  if (glassWall) {
    growBounds(b, rectOf(items, "glass", WALL_MARGIN))
    if (glassWall === "+x") b.maxX = wall
    else if (glassWall === "-x") b.minX = wall
    else if (glassWall === "+z") b.maxZ = wall
    else b.minZ = wall
  }
  const wx = Math.max(0, ROOM_MIN - (b.maxX - b.minX))
  const wz = Math.max(0, ROOM_MIN - (b.maxZ - b.minZ))
  b.minX -= glassWall === "+x" ? wx : glassWall === "-x" ? 0 : wx / 2
  b.maxX += glassWall === "-x" ? wx : glassWall === "+x" ? 0 : wx / 2
  b.minZ -= glassWall === "+z" ? wz : glassWall === "-z" ? 0 : wz / 2
  b.maxZ += glassWall === "-z" ? wz : glassWall === "+z" ? 0 : wz / 2
  return fitsRoom(b) ? b : null
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
    const zone = isHazard(item) ? p.dangerMargin : isTable(item) ? p.safeZoneMargin : 0 // a zone holds its footprint
    if (overlaps(clear, rectOf(items, item, zone))) {
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

/** Axis-aligned bounds of the start spot and the `list` footprints, each grown by WALL_MARGIN. */
function boundsOf(items: Partial<Record<LayoutItem, Placement>>, list: LayoutItem[]): RoomRect {
  const b = {minX: -WALL_MARGIN, maxX: WALL_MARGIN, minZ: -WALL_MARGIN, maxZ: WALL_MARGIN}
  for (const item of list) {
    growBounds(b, rectOf(items, item, WALL_MARGIN))
  }
  return b
}

function growBounds(b: RoomRect, r: Rect): void {
  const c = Math.abs(Math.cos(r.yaw))
  const s = Math.abs(Math.sin(r.yaw))
  const ex = r.hx * c + r.hz * s
  const ez = r.hx * s + r.hz * c
  b.minX = Math.min(b.minX, r.x - ex)
  b.maxX = Math.max(b.maxX, r.x + ex)
  b.minZ = Math.min(b.minZ, r.z - ez)
  b.maxZ = Math.max(b.maxZ, r.z + ez)
}

function fitsRoom(b: RoomRect): boolean {
  return b.maxX - b.minX <= ROOM_MAX + 0.001 && b.maxZ - b.minZ <= ROOM_MAX + 0.001
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
function fits(items: Partial<Record<LayoutItem, Placement>>, item: LayoutItem, placed: LayoutItem[], p: LayoutParams): boolean {
  // Hazards keep their whole danger zone clear of the start spot; the rest their footprint.
  const own = rectOf(items, item, isHazard(item) ? p.dangerMargin : 0)
  if (distanceFrom(own) < p.startClearRadius) {
    return false
  }
  const spaced = rectOf(items, item, SPACING)
  for (const other of placed) {
    if (overlaps(spaced, rectOf(items, other, SPACING))) {
      return false
    }
    if (isTable(item) !== isTable(other)) {
      // A danger zone, the bed or the chair may not reach into any safe zone.
      const table = isTable(item) ? item : other
      const thing = isTable(item) ? other : item
      const safe = rectOf(items, table, p.safeZoneMargin)
      if (overlaps(safe, rectOf(items, thing, isHazard(thing) ? p.dangerMargin : 0))) {
        return false
      }
    }
  }
  return true
}

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
  const at = items[item]
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
function overlaps(a: Rect, b: Rect): boolean {
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
