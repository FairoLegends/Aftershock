// Slice 13C (ENGINEERING_PLAN 5m item 13): panel follow with a dead zone.
// A panel placed once in front of the head is left behind when the user walks
// or turns. This eases it back to its anchor, but only past a dead zone, so a
// small glance never drags it. Pure math: no scene access, so it is cheap to
// reuse (ResultPanel at RESULT and GAME_OVER, the replay caption) and testable.

/** The dead zone and the ease, from DrillConfig (panelFollowDeg/Cm/Speed). */
export interface FollowSettings {
  deg: number // yaw between the level look and the head->panel direction
  cm: number // head movement since the panel last settled
  speed: number // ease rate, k = 1 - exp(-speed*dt)
}

const SETTLE_CM = 2 // within this of the anchor it settles
const SETTLE_DEG = 2 // ...and within this yaw of center

/** The level (y = 0) unit forward of `f`, or null when looking straight up or down. */
function level(f: vec3): vec3 | null {
  const flat = new vec3(f.x, 0, f.z)
  return flat.length > 1e-4 ? flat.normalize() : null
}

/**
 * Yaw angle (degrees) between the head's level forward and the level direction
 * from the head to `p`; 0 when either is degenerate (nothing to correct).
 */
export function yawOffDeg(head: vec3, forward: vec3, p: vec3): number {
  const f = level(forward)
  const to = level(new vec3(p.x - head.x, 0, p.z - head.z))
  if (!f || !to) return 0
  const dot = Math.max(-1, Math.min(1, f.x * to.x + f.z * to.z))
  return (Math.acos(dot) * 180) / Math.PI
}

/**
 * Where a panel belongs: `distance` cm in front of the head along its level
 * forward, `below` cm under eye level. Null when the head looks straight up or
 * down (no level forward to anchor to: the panel stays where it is).
 */
export function anchorInFront(head: vec3, forward: vec3, distance: number, below: number): vec3 | null {
  const f = level(forward)
  if (!f) return null
  return head.add(f.uniformScale(distance)).add(new vec3(0, -below, 0))
}

/** Yaw-only rotation putting local +Z toward the head (as Hud.followPanel). */
export function faceHead(p: vec3, head: vec3): quat {
  return quat.angleAxis(Math.atan2(head.x - p.x, head.z - p.z), vec3.up())
}

/** XZ distance. */
function flatDist(a: vec3, b: vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * One panel's follow state. `step` returns where the panel should be this
 * frame: unchanged inside the dead zone, eased toward the anchor outside it.
 * The first placement snaps; the dead zone re-arms wherever the head stood
 * when the panel last settled.
 */
export class PanelFollow {
  private pos = vec3.zero()
  private restX = 0 // the head's spot when the panel last settled
  private restZ = 0
  private moving = false
  private _placed = false

  /** First placement (or a re-place): the panel is there now, dead zone armed. */
  snap(anchor: vec3, head: vec3): vec3 {
    this.pos = anchor
    this.restX = head.x
    this.restZ = head.z
    this.moving = false
    this._placed = true
    return this.pos
  }

  /** A re-fit moved the panel up or down by itself; keep the follow in step. */
  shiftY(dy: number): vec3 {
    this.pos = new vec3(this.pos.x, this.pos.y + dy, this.pos.z)
    return this.pos
  }

  /** Forget the placement, so the next step snaps (a new panel showing). */
  reset(): void {
    this._placed = false
    this.moving = false
  }

  /**
   * This frame's panel position. `held` (a pinch down on one of its buttons)
   * freezes it: the button must not slide out from under the finger.
   */
  step(head: vec3, forward: vec3, anchor: vec3, dt: number, s: FollowSettings, held: boolean): vec3 {
    if (!this._placed) return this.snap(anchor, head)
    if (held) return this.pos
    const off = yawOffDeg(head, forward, this.pos)
    if (!this.moving) {
      const walked = Math.hypot(head.x - this.restX, head.z - this.restZ)
      if (off < s.deg && walked < s.cm) return this.pos
      this.moving = true
    }
    const k = Math.max(0, Math.min(1, 1 - Math.exp(-Math.max(0, s.speed) * Math.max(0, dt))))
    this.pos = vec3.lerp(this.pos, anchor, k)
    if (flatDist(this.pos, anchor) <= SETTLE_CM && Math.abs(this.pos.y - anchor.y) <= SETTLE_CM && yawOffDeg(head, forward, this.pos) <= SETTLE_DEG) {
      this.pos = anchor
      this.restX = head.x
      this.restZ = head.z
      this.moving = false
    }
    return this.pos
  }

  get position(): vec3 {
    return this.pos
  }
  get isMoving(): boolean {
    return this.moving
  }
  get isPlaced(): boolean {
    return this._placed
  }
}
