import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DrillController} from "../DrillController"
import {ReplaySample, ReplayTrack} from "../ReplayTrack"
import {atHeight, CLASSIC, doorPoint, expectState, getController, itemWorld, levelLook, pinDucked, press, restore, startSpot, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

const SEED = 1155577471 // DC10's fixed layout
const QUAKE_S = 10 // room for the walk, the cover and the forced fall
const QUAKE2_S = 4
const STEP_CM = 10 // the driven head moves this far per step
const STEP_MS = 50
const DWELL_MS = 1000 // in the cabinet's danger zone
const NEAR_CM = 2
const PATH_TOL_CM = 5
const LANDED_TOL_CM = 1
const TIME_TOL_S = 0.3
const POOL_MARK = 12 // ReplayView's marker pool
const SIMPLIFY_CM = 8

// DC25 (Slice 13B, ENGINEERING_PLAN 5m item 12): the ghost replay.
// (a) ReplayTrack alone: simplify keeps every inDanger change and drops close
// points, positionAt(0)/(1) are the ends (by arc length), segments alternate.
// (b) A driven drill: start, the cabinet's danger zone, under the table, out
// of the door. Every recorded point lies on the driven path, the zone's samples
// are inDanger, the forced fall gives one landed event at its onLanded x,z,
// and the cover gives a cover event. (c) RESULT: Lihat ulang hides the panel
// and draws the trail (danger run red) with the right caption; it ends by
// itself after replaySeconds + replayHoldSeconds; Lewati ends it at once;
// Restart reaches LEVEL with the track cleared; a second drill's Change
// language reaches LANGUAGE with the track cleared.
@component
export class DC25_GhostReplay extends Scenario {
  async run(): Promise<void> {
    checkTrack()
    const c = getController()
    const cfg = c.config
    const prevTestMode = cfg.testMode
    const prevDuration = cfg.testDurationSeconds
    const prevSeed = cfg.layoutSeed
    const falls = c.fallingObjects
    const prevLanded = falls.onLanded
    const seen: {at: vec2 | null} = {at: null}
    try {
      c.setLevelForTest("normal")
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true) // the one fall below is forced
      cfg.testMode = true
      cfg.testDurationSeconds = QUAKE_S
      cfg.layoutSeed = SEED
      await toFreshBriefing(c, CLASSIC)
      falls.onLanded = (source, x, z) => {
        seen.at = new vec2(x, z)
        if (prevLanded) prevLanded(source, x, z)
      }

      // (b) The driven drill.
      const start = startSpot(c)
      const cabinet = atHeight(c, c.cabinetDanger.sceneObject.getTransform().getWorldPosition(), cfg.eyeHeight)
      expect(c.cabinetDanger.contains(cabinet)).toBe(true)
      const table = atHeight(c, c.safeZone.center, cfg.eyeHeight)
      const door = doorPoint(c)
      const mid = new vec3((start.x + door.x) / 2, start.y, (start.z + door.z) / 2)
      const path = [start, cabinet, table, start, door]
      c.headPose.setOverride(start, levelLook(start, cabinet))
      await expectState(c, "QUAKE", (cfg.testWaitSeconds + cfg.testScanSeconds + 2) * 1000)
      expect(c.isRecordingReplay).toBe(true)
      await walk(c, start, cabinet)
      await sleep(DWELL_MS)
      expect(c.inDanger).toBe(true)
      await walk(c, cabinet, table)
      pinDucked(c)
      expect(await waitFor(() => c.hasBeenSafe, (cfg.safeHoldSeconds + 2) * 1000)).toBe(true)
      expect(c.forceFallForTest("shelf", mid)).toBe(true)
      expect(await waitFor(() => seen.at !== null, 4000)).toBe(true)
      await expectState(c, "POST_QUAKE", (QUAKE_S + 2) * 1000)
      await walk(c, table, start)
      await expectState(c, "EVACUATE", 2000)
      await walk(c, start, door)
      await expectState(c, "RESULT", 2000)
      expect(c.isRecordingReplay).toBe(false)

      const t = c.replayTrack
      const samples = t.samples
      expect(samples.length).toBeGreaterThan(20)
      expect(samples[0].inDanger).toBe(false)
      const off = worstOffPath(c, samples, path)
      const near = samples.filter((s) => flat(itemWorld(c, s.x, s.z, 0), cabinet) <= NEAR_CM)
      expect(near.length).toBeGreaterThan(4)
      expect(near.slice(1).every((s) => s.inDanger)).toBe(true) // the first may predate the zone's update
      const runs = t.segments()
      for (let i = 1; i < runs.length; i++) expect(runs[i].inDanger !== runs[i - 1].inDanger).toBe(true)
      const landedEvents = t.events.filter((e) => e.kind === "landed")
      expect(landedEvents.length).toBe(1)
      const at = seen.at as vec2
      expect(Math.hypot(landedEvents[0].x - at.x, landedEvents[0].z - at.y) <= LANDED_TOL_CM).toBe(true)
      expect(t.count("cover")).toBeGreaterThan(0)
      expect(t.events.filter((e) => e.kind === "hit" && e.source !== "glass").length).toBe(0)
      console.log(
        `[Aftershock] DC25: ${samples.length} samples, worst ${off.toFixed(2)} cm off the driven path, ${near.length} in the cabinet zone, ${runs.length} runs, events ${t.events.map((e) => e.kind).join(", ")}`
      )
      expect(off <= PATH_TOL_CM).toBe(true)

      // (c) Lihat ulang: the replay draws and ends by itself.
      const view = c.replay
      expect(view !== null).toBe(true)
      if (!view) return
      expect(c.resultPanel.isShown).toBe(true)
      expect(findSceneObjectByName("ReplayButton").isEnabledInHierarchy).toBe(true)
      await press("ReplayButton")
      expect(view.isPlaying).toBe(true)
      const started = view.startTime
      expect(c.resultPanel.isShown).toBe(false)
      expect(view.captionShown).toBe(true)
      expect(view.captionKey).toBe("replay.danger")
      expect(c.lastReplayCaption).toBe("replay.danger")
      expect(view.captionLine.length).toBeGreaterThan(0)
      await waitFor(() => getTime() - started > cfg.replaySeconds + 0.2, (cfg.replaySeconds + 1) * 1000)
      expect(view.isPlaying).toBe(true) // the hold
      expect(view.segmentsShown).toBeGreaterThan(0)
      expect(view.dangerSegmentsShown).toBeGreaterThan(0)
      expect(view.redSegmentsShown).toBe(view.dangerSegmentsShown)
      expect(view.segmentsShown).toBeGreaterThan(view.redSegmentsShown)
      expect(view.dotsShown).toBeGreaterThan(0)
      expect(view.headDotShown).toBe(true)
      expect(view.markersShown).toBe(Math.min(t.events.length, POOL_MARK))
      expect(worstOffPath(c, view.drawnPoints, path) <= PATH_TOL_CM).toBe(true)
      const li = t.events.indexOf(landedEvents[0])
      if (li < POOL_MARK) {
        const mark = view.markerPosition(li)
        const want = itemWorld(c, at.x, at.y, 0)
        expect(mark !== null && flat(mark, want) <= LANDED_TOL_CM).toBe(true)
      }
      expect(await waitFor(() => !view.isPlaying, (cfg.replayHoldSeconds + 1) * 1000)).toBe(true)
      const took = getTime() - started
      console.log(`[Aftershock] DC25: the replay ended after ${took.toFixed(2)} s (want ${cfg.replaySeconds + cfg.replayHoldSeconds})`)
      expect(Math.abs(took - (cfg.replaySeconds + cfg.replayHoldSeconds)) <= TIME_TOL_S).toBe(true)
      expect(c.resultPanel.isShown).toBe(true)
      expect(view.captionShown).toBe(false)
      expect(view.segmentsShown + view.dotsShown + view.markersShown).toBe(0)

      // Again, then Lewati: the panel is back at once.
      await press("ReplayButton")
      expect(view.isPlaying).toBe(true)
      await press("ReplaySkipButton")
      expect(view.isPlaying).toBe(false)
      expect(c.resultPanel.isShown).toBe(true)
      expect(c.state).toBe("RESULT")

      // Restart: LEVEL, the trail cleared.
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      expectCleared(c)

      // A short second drill (ducked throughout), then Change language from RESULT.
      cfg.testDurationSeconds = QUAKE2_S
      await toFreshBriefing(c, CLASSIC)
      const start2 = startSpot(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (cfg.testWaitSeconds + cfg.testScanSeconds + 2) * 1000)
      await expectState(c, "POST_QUAKE", (QUAKE2_S + 2) * 1000)
      c.headPose.setOverride(start2, levelLook(start2, doorPoint(c)))
      await walkOut(c)
      const t2 = c.replayTrack
      expect(t2.samples.length).toBeGreaterThan(0)
      await press("ReplayButton")
      const want2 = t2.events.some((e) => e.kind === "hit" && e.source !== "glass") ? "replay.hit" : t2.samples.some((s) => s.inDanger) ? "replay.danger" : "replay.safe"
      expect(view.captionKey).toBe(want2)
      await press("ReplaySkipButton")
      expect(c.resultPanel.isShown).toBe(true)
      await press("ChangeLangButton")
      expect(c.state).toBe("LANGUAGE")
      expectCleared(c)
    } finally {
      if (c.replay && c.replay.isPlaying) c.replay.skip() // never leave the result panel hidden
      falls.onLanded = prevLanded
      cfg.layoutSeed = prevSeed
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}

/** Moves the head override from `from` to `to` in STEP_CM steps. */
async function walk(c: DrillController, from: vec3, to: vec3): Promise<void> {
  const look = levelLook(from, to)
  const n = Math.max(1, Math.ceil(flat(from, to) / STEP_CM))
  for (let i = 1; i <= n; i++) {
    c.headPose.setOverride(vec3.lerp(from, to, i / n), look)
    await sleep(STEP_MS)
  }
}

function expectCleared(c: DrillController): void {
  const v = c.replay
  expect(c.replayTrack.samples.length + c.replayTrack.events.length).toBe(0)
  expect(c.lastReplayCaption).toBe(null)
  expect(v !== null && !v.isPlaying && v.segmentsShown + v.markersShown + v.dotsShown === 0 && !v.headDotShown).toBe(true)
}

/** XZ distance. */
function flat(a: vec3, b: vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** The largest XZ distance from a room-local point to the world polyline `path`. */
function worstOffPath(c: DrillController, points: readonly ReplaySample[], path: vec3[]): number {
  let worst = 0
  for (const s of points) {
    const p = itemWorld(c, s.x, s.z, 0)
    let best = Infinity
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]
      const dx = path[i].x - a.x
      const dz = path[i].z - a.z
      const l2 = dx * dx + dz * dz
      const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0
      best = Math.min(best, Math.hypot(p.x - a.x - k * dx, p.z - a.z - k * dz))
    }
    worst = Math.max(worst, best)
  }
  return worst
}

/** (a) ReplayTrack alone: a 100 cm line, 2 cm apart, in danger from 40 to 60 cm. */
function checkTrack(): void {
  const t = new ReplayTrack()
  for (let x = 0; x <= 100; x += 2) t.addSample(x / 20, x, 0, x >= 40 && x <= 60)
  t.addEvent(1, 50, 0, "landed", "shelf")
  expect(t.count("landed")).toBe(1)
  const s = t.samples
  const pts = t.simplify(SIMPLIFY_CM)
  expect(pts.length).toBeLessThan(s.length)
  expect(pts[0]).toBe(s[0])
  expect(pts[pts.length - 1]).toBe(s[s.length - 1])
  const changeSide = (i: number): boolean => (i > 0 && s[i - 1].inDanger !== s[i].inDanger) || (i + 1 < s.length && s[i + 1].inDanger !== s[i].inDanger)
  for (let i = 0; i < s.length; i++) {
    if (changeSide(i)) expect(pts.indexOf(s[i]) >= 0).toBe(true)
  }
  for (let i = 1; i < pts.length; i++) {
    const j = s.indexOf(pts[i])
    if (!changeSide(j) && j !== s.length - 1) expect(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) >= SIMPLIFY_CM).toBe(true)
  }
  const a = t.positionAt(0, pts)
  const b = t.positionAt(1, pts)
  const m = t.positionAt(0.5, pts)
  expect(a !== null && a.x === pts[0].x && a.z === pts[0].z).toBe(true)
  expect(b !== null && b.x === 100 && b.z === 0).toBe(true)
  expect(m !== null && Math.abs(m.x - 50) < 1e-3).toBe(true) // by arc length
  const runs = t.segments(pts)
  expect(runs.length).toBe(3)
  for (let i = 1; i < runs.length; i++) expect(runs[i].inDanger !== runs[i - 1].inDanger).toBe(true)
  expect(runs[1].inDanger).toBe(true)
  t.clear()
  expect(t.samples.length + t.events.length).toBe(0)
  expect(t.positionAt(0.5)).toBe(null)
}
