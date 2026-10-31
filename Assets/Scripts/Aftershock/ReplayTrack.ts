// Slice 13B (ENGINEERING_PLAN 5m item 12): the ghost replay's data. Pure
// logic, no scene access: head floor points {t, x, z, inDanger} and events
// {t, x, z, kind} in the room's frame (cm, x and z as toRoomLocal gives them).
// Nothing is kept between sessions.

export type ReplayKind = "landed" | "hit" | "cover"

export interface ReplaySample {
  t: number // seconds since recording started
  x: number
  z: number
  inDanger: boolean
}

export interface ReplayEvent {
  t: number
  x: number
  z: number
  kind: ReplayKind
  source: string | null // the item that landed or hit (cabinet, shelf, lamp, tv, glass)
}

/** A run of consecutive points with the same inDanger. */
export interface ReplaySegment {
  inDanger: boolean
  points: ReplaySample[]
}

export class ReplayTrack {
  private readonly _samples: ReplaySample[] = []
  private readonly _events: ReplayEvent[] = []

  get samples(): readonly ReplaySample[] {
    return this._samples
  }

  get events(): readonly ReplayEvent[] {
    return this._events
  }

  addSample(t: number, x: number, z: number, inDanger: boolean): void {
    this._samples.push({t, x, z, inDanger})
  }

  addEvent(t: number, x: number, z: number, kind: ReplayKind, source: string | null = null): void {
    this._events.push({t, x, z, kind, source})
  }

  count(kind: ReplayKind): number {
    return this._events.filter((e) => e.kind === kind).length
  }

  clear(): void {
    this._samples.length = 0
    this._events.length = 0
  }

  /**
   * The samples without points closer than `minStepCm` (XZ) to the last kept
   * one. The first and last points stay, and so does each side of every
   * inDanger change (the last point before it and the first after it).
   */
  simplify(minStepCm: number): ReplaySample[] {
    const s = this._samples
    const out: ReplaySample[] = []
    for (let i = 0; i < s.length; i++) {
      const p = s[i]
      const last = out.length > 0 ? out[out.length - 1] : null
      const change = (i > 0 && s[i - 1].inDanger !== p.inDanger) || (i + 1 < s.length && s[i + 1].inDanger !== p.inDanger)
      if (!last || change || i === s.length - 1 || Math.hypot(p.x - last.x, p.z - last.z) >= minStepCm) {
        out.push(p)
      }
    }
    return out
  }

  /** Total XZ length of `points` (default: every sample), cm. */
  length(points: readonly ReplaySample[] = this._samples): number {
    let len = 0
    for (let i = 1; i < points.length; i++) {
      len += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
    }
    return len
  }

  /**
   * The point a share `u` (0 to 1) along `points` by arc length (not time):
   * u = 0 is the first point, u = 1 the last. inDanger is the segment's end
   * point's. Null when there are no points.
   */
  positionAt(u: number, points: readonly ReplaySample[] = this._samples): ReplaySample | null {
    if (points.length === 0) return null
    const total = this.length(points)
    if (u <= 0 || total <= 0) return points[0]
    if (u >= 1) return points[points.length - 1]
    let left = u * total
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      const d = Math.hypot(b.x - a.x, b.z - a.z)
      if (left <= d && d > 0) {
        const k = left / d
        return {t: a.t + (b.t - a.t) * k, x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, inDanger: b.inDanger}
      }
      left -= d
    }
    return points[points.length - 1]
  }

  /** Runs of equal inDanger along `points` (default: every sample); neighbours alternate. */
  segments(points: readonly ReplaySample[] = this._samples): ReplaySegment[] {
    const out: ReplaySegment[] = []
    for (const p of points) {
      const run = out.length > 0 ? out[out.length - 1] : null
      if (run && run.inDanger === p.inDanger) run.points.push(p)
      else out.push({inDanger: p.inDanger, points: [p]})
    }
    return out
  }
}
