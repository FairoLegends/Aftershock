import {FOOTPRINTS, Layout, LayoutItem} from "./LayoutGenerator"

// Slice 8A P1 (ENGINEERING_PLAN §5k item 14): turn a panel off its look
// direction when furniture would stand between the eye and the panel. Pure:
// Room-local cm and radians, no scene access.

/** Yaw offsets tried, in order (degrees about +Y); a tie keeps the earlier one. */
export const PANEL_AIM_OFFSETS_DEG = [0, 20, -20, 40, -40]
const RAY_CM = 400

/**
 * The offset (degrees) from PANEL_AIM_OFFSETS_DEG whose level ray from the
 * eye (eyeX, eyeZ) along (dirX, dirZ) turned by it crosses the fewest of the
 * layout's footprints within RAY_CM, and that count.
 */
export function panelYawOffset(layout: Layout | null, eyeX: number, eyeZ: number, dirX: number, dirZ: number): {offsetDeg: number; hits: number} {
  let best = {offsetDeg: 0, hits: Number.MAX_VALUE}
  const len = Math.sqrt(dirX * dirX + dirZ * dirZ)
  if (!layout || len < 0.0001) {
    return {offsetDeg: 0, hits: 0}
  }
  for (const deg of PANEL_AIM_OFFSETS_DEG) {
    const [x, z] = turn(dirX / len, dirZ / len, (deg * Math.PI) / 180)
    let hits = 0
    for (const key of Object.keys(layout.items)) {
      const item = key as LayoutItem
      const at = layout.items[item]
      const f = FOOTPRINTS[item]
      if (rayHitsRect(eyeX, eyeZ, x, z, at.x, at.z, at.yaw, f.halfX, f.halfZ)) {
        hits++
      }
    }
    if (hits < best.hits) {
      best = {offsetDeg: deg, hits: hits}
    }
  }
  return best
}

/** (x, z) turned by `a` radians about +Y, as quat.angleAxis(a, vec3.up()) turns it: +Z goes toward +X. */
export function turn(x: number, z: number, a: number): [number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, -x * s + z * c]
}

/** Slab test: does the segment from (ox, oz) along unit (dx, dz), RAY_CM long, cross the turned rect? */
function rayHitsRect(ox: number, oz: number, dx: number, dz: number, cx: number, cz: number, yaw: number, hx: number, hz: number): boolean {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  // Into the rect's frame: local X = (cos, −sin), local Z = (sin, cos) on (x, z).
  const px = (ox - cx) * c - (oz - cz) * s
  const pz = (ox - cx) * s + (oz - cz) * c
  const vx = dx * c - dz * s
  const vz = dx * s + dz * c
  let t0 = 0
  let t1 = RAY_CM
  for (const [p, v, h] of [[px, vx, hx], [pz, vz, hz]]) {
    if (Math.abs(v) < 1e-9) {
      if (Math.abs(p) > h) return false
      continue
    }
    let a = (-h - p) / v
    let b = (h - p) / v
    if (a > b) {
      const t = a
      a = b
      b = t
    }
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, b)
    if (t0 > t1) return false
  }
  return true
}
