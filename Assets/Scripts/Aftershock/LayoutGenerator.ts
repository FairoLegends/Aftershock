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
  glass: {halfX: 70, halfZ: 5, front: Math.PI}, // 140 W × 10 D model; front −Z
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
}

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
// bed and chair (§5j-15): 1 table, cabinet, shelf, glass, bed, chair.
const FIXED_LAYOUT: Partial<Record<LayoutItem, Placement>> = {
  table: {x: 0, z: -150, yaw: 0},
  cabinet: {x: -150, z: -40, yaw: 0},
  shelf: {x: 150, z: -60, yaw: 0},
  glass: {x: 0, z: 170, yaw: 0},
  bed: {x: 200, z: 170, yaw: 0},
  chair: {x: -170, z: 150, yaw: 0}
}

/**
 * A new layout (§5j-14d, 15): tableCountMin..Max tables (centers
 * tableDistanceMin..Max from the start spot), hazardCountMin..Max hazards
 * drawn from HAZARDS without repeats, and the bed and chair (centers
 * hazardDistanceMin..Max), each at a random bearing and facing the start spot.
 * Valid when no two footprints grown by SPACING overlap, no table, bed, chair
 * or danger zone comes within startClearRadius of the start spot, no danger
 * zone overlaps a safe zone and the bed and chair stay out of every safe zone.
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
  const order = tables.concat(hazards, FURNITURE)
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    const items = placeAll(random, order, p)
    if (items) {
      return {seed: seed, tries: tries, fallback: false, items: items, tables: tables, hazards: hazards}
    }
  }
  return {
    seed: seed,
    tries: MAX_TRIES,
    fallback: true,
    items: copyItems(FIXED_LAYOUT),
    tables: ["table"],
    hazards: ["cabinet", "shelf", "glass"]
  }
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

/** Places `order` one item at a time against the items already placed; null when one item finds no spot. */
function placeAll(random: () => number, order: LayoutItem[], p: LayoutParams): Partial<Record<LayoutItem, Placement>> | null {
  const items: Partial<Record<LayoutItem, Placement>> = {}
  const placed: LayoutItem[] = []
  for (const item of order) {
    const min = isTable(item) ? p.tableDistanceMin : p.hazardDistanceMin
    const max = isTable(item) ? p.tableDistanceMax : p.hazardDistanceMax
    let ok = false
    for (let i = 0; i < ITEM_TRIES && !ok; i++) {
      items[item] = draw(random, item, min, max)
      ok = fits(items, item, placed, p)
    }
    if (!ok) {
      return null
    }
    placed.push(item)
  }
  return items
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
