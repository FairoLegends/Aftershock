// Procedural room layout (ENGINEERING_PLAN Slice 5P). Pure and seedable: no
// scene access. Positions are Room-local cm with the user's start spot at the
// origin facing −Z, items standing on the floor (Y = 0). Yaw is radians about
// +Y (the runtime unit), so local +Z turns to (sin yaw, 0, cos yaw).

export type LayoutItem = "table" | "cabinet" | "shelf" | "glass"

export const HAZARDS: LayoutItem[] = ["cabinet", "shelf", "glass"]

export interface Footprint {
  halfX: number // cm, along the item's local X
  halfZ: number // cm, along the item's local Z
  front: number // radians: yaw of the item's front in its own frame (0 = +Z, π/2 = +X)
}

// DESIGN_BRIEF §6 sizes, on the axes the scene meshes use. Not drill tunables.
export const FOOTPRINTS: Record<LayoutItem, Footprint> = {
  table: {halfX: 60, halfZ: 35, front: 0}, // 120 W × 70 D; the long side faces the start spot
  cabinet: {halfX: 22.5, halfZ: 45, front: Math.PI / 2}, // 90 W × 45 D, front +X
  shelf: {halfX: 15, halfZ: 40, front: -Math.PI / 2}, // 80 W × 30 D, front −X
  glass: {halfX: 60, halfZ: 1.5, front: Math.PI} // 120 wide; no depth in the brief, 3 cm = frame; front −Z
}

export interface Placement {
  x: number // cm
  z: number // cm
  yaw: number // radians
}

export interface Layout {
  seed: number
  tries: number // draws used; MAX_TRIES when it fell back
  fallback: boolean // true = no valid draw, FIXED_LAYOUT used
  items: Record<LayoutItem, Placement>
}

/** The DrillConfig fields the layout reads (cm). DrillConfig satisfies this. */
export interface LayoutParams {
  tableDistanceMin: number
  tableDistanceMax: number
  hazardDistanceMin: number
  hazardDistanceMax: number
  dangerMargin: number
  safeZoneMargin: number
  startClearRadius: number
  layoutSeed: number
}

const SPACING = 30 // cm: footprints grown by this may not overlap (walkable gaps)
const MAX_TRIES = 1000

// Slice 2 fixed layout (DESIGN_BRIEF §6), used when no draw is valid.
const FIXED_LAYOUT: Record<LayoutItem, Placement> = {
  table: {x: 0, z: -150, yaw: 0},
  cabinet: {x: -150, z: -40, yaw: 0},
  shelf: {x: 150, z: -60, yaw: 0},
  glass: {x: 0, z: 170, yaw: 0}
}

/**
 * A new layout: the table center tableDistanceMin..Max from the start spot at
 * a random bearing, each hazard hazardDistanceMin..Max away; every item faces
 * the start spot. Valid when no two footprints grown by SPACING overlap, no
 * furniture or danger zone comes within startClearRadius of the start spot,
 * and no danger zone overlaps the safe zone. layoutSeed 0 = a new seed each
 * call; any other value = that seed, so the same layout every time.
 */
export function generateLayout(p: LayoutParams): Layout {
  const seed = p.layoutSeed !== 0 ? Math.floor(p.layoutSeed) : 1 + Math.floor(Math.random() * 2147483646)
  const random = mulberry32(seed)
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    const items = {
      table: draw(random, "table", p.tableDistanceMin, p.tableDistanceMax),
      cabinet: draw(random, "cabinet", p.hazardDistanceMin, p.hazardDistanceMax),
      shelf: draw(random, "shelf", p.hazardDistanceMin, p.hazardDistanceMax),
      glass: draw(random, "glass", p.hazardDistanceMin, p.hazardDistanceMax)
    }
    if (isValid(items, p)) {
      return {seed: seed, tries: tries, fallback: false, items: items}
    }
  }
  return {seed: seed, tries: MAX_TRIES, fallback: true, items: copyLayout(FIXED_LAYOUT)}
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

interface Rect {
  x: number
  z: number
  yaw: number
  hx: number
  hz: number
}

function draw(random: () => number, item: LayoutItem, min: number, max: number): Placement {
  const d = min + random() * Math.max(0, max - min)
  const bearing = (random() * 2 - 1) * Math.PI // 0 = straight ahead (−Z)
  const x = d * Math.sin(bearing)
  const z = -d * Math.cos(bearing)
  return {x: x, z: z, yaw: yawFacingStart(x, z, FOOTPRINTS[item].front)}
}

function isValid(items: Record<LayoutItem, Placement>, p: LayoutParams): boolean {
  if (distanceFromStart(rectOf(items, "table", 0)) < p.startClearRadius) {
    return false
  }
  const safe = rectOf(items, "table", p.safeZoneMargin)
  for (const h of HAZARDS) {
    const danger = rectOf(items, h, p.dangerMargin) // contains the footprint, so this covers both
    if (distanceFromStart(danger) < p.startClearRadius || overlaps(danger, safe)) {
      return false
    }
  }
  const all: LayoutItem[] = ["table", "cabinet", "shelf", "glass"]
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (overlaps(rectOf(items, all[i], SPACING), rectOf(items, all[j], SPACING))) {
        return false
      }
    }
  }
  return true
}

function rectOf(items: Record<LayoutItem, Placement>, item: LayoutItem, grow: number): Rect {
  const at = items[item]
  const f = FOOTPRINTS[item]
  return {x: at.x, z: at.z, yaw: at.yaw, hx: f.halfX + grow, hz: f.halfZ + grow}
}

/** Shortest distance from the start spot (origin) to the rectangle (0 when inside). */
function distanceFromStart(r: Rect): number {
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

function copyLayout(src: Record<LayoutItem, Placement>): Record<LayoutItem, Placement> {
  return {
    table: {x: src.table.x, z: src.table.z, yaw: src.table.yaw},
    cabinet: {x: src.cabinet.x, z: src.cabinet.z, yaw: src.cabinet.yaw},
    shelf: {x: src.shelf.x, z: src.shelf.z, yaw: src.shelf.yaw},
    glass: {x: src.glass.x, z: src.glass.z, yaw: src.glass.yaw}
  }
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
