import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {atHeight, CLASSIC, doorPoint, expectState, getController, HoldInteractor, levelLook, pinDucked, press, restore, startSpot, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

const SEED = 1155577471 // DC10's fixed layout, as DC25
const QUAKE_S = 4 // DC25's short ducked drill
const GAME_OVER_S = 40 // as DC4: the quake outlasts the drain to health 0
const STANDING_HEAD_CM = 160 // as DC4: standing in the zone
const SMALL_DEG = 15 // inside the 25° dead zone
const BIG_DEG = 60 // past it
const WALK_CM = 100 // past the 50 cm dead zone
const STILL_MS = 1000
const STILL_CM = 0.5
const FOLLOW_MS = 2500
const NEAR_CM = 5
const FACE_DEG = 2
const BELOW_TOL_CM = 2
const SETTLE_MS = 4000
const REFIT_MS = 300 // the layout's re-fit lands a frame or two after the panel shows

/** XYZ distance. */
function dist(a: vec3, b: vec3): number {
  return a.sub(b).length
}

/** `f` turned `deg` about world up (level). */
function turn(f: vec3, deg: number): vec3 {
  const r = quat.angleAxis((deg * Math.PI) / 180, vec3.up()).multiplyVec3(new vec3(f.x, 0, f.z))
  return r.normalize()
}

/** Independently of PanelFollow: `distance` along the level look, `below` under eye level. */
function anchor(head: vec3, forward: vec3, distance: number, below: number): vec3 {
  const f = new vec3(forward.x, 0, forward.z).normalize()
  return head.add(f.uniformScale(distance)).add(new vec3(0, -below, 0))
}

/** Yaw (degrees) between the panel's +Z and the level direction to the head. */
function faceErrDeg(p: vec3, r: quat, head: vec3): number {
  const z = r.multiplyVec3(vec3.forward())
  const a = new vec3(z.x, 0, z.z).normalize()
  const b = new vec3(head.x - p.x, 0, head.z - p.z).normalize()
  return (Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180) / Math.PI
}

interface Follow {
  ok: boolean
  ms: number
  cm: number
  face: number
}

/** Waits up to FOLLOW_MS for the panel to be within NEAR_CM of `want` and facing `head`. */
async function follows(t: Transform, head: vec3, want: vec3): Promise<Follow> {
  const t0 = getTime()
  const near = (): boolean => dist(t.getWorldPosition(), want) < NEAR_CM && faceErrDeg(t.getWorldPosition(), t.getWorldRotation(), head) < FACE_DEG
  const ok = await waitFor(near, FOLLOW_MS)
  return {ok, ms: (getTime() - t0) * 1000, cm: dist(t.getWorldPosition(), want), face: faceErrDeg(t.getWorldPosition(), t.getWorldRotation(), head)}
}

function show(f: Follow): string {
  return `${f.ms.toFixed(0)} ms, ${f.cm.toFixed(2)} cm off, face ${f.face.toFixed(2)}°`
}

// DC26 (Slice 13C, ENGINEERING_PLAN 5m item 13): the result panel and the
// replay caption follow the head past a dead zone. At RESULT: (a) a 15° turn
// leaves it still (< 0.5 cm in 1 s) and facing the head; (b) a 60° turn and
// (c) a 100 cm sideways walk bring it within 5 cm of the new anchor in 2.5 s.
// (d) During a replay the caption sits replayCaptionBelowEye under eye level
// and follows a 60° turn the same way; on GAME_OVER the panel follows a 60°
// turn. (e) A pinch held on Change language freezes the panel through a 60°
// turn and its release opens LANGUAGE; Restart from the moved game-over panel
// reaches LEVEL.
@component
export class DC26_PanelFollow extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const cfg = c.config
    const prevTestMode = cfg.testMode
    const prevDuration = cfg.testDurationSeconds
    const prevSeed = cfg.layoutSeed
    const holder = new HoldInteractor()
    let holding = false
    const panel = c.resultPanel.getSceneObject().getTransform()
    const d = cfg.hudDistance
    try {
      c.setLevelForTest("normal")
      c.forceAftershockForTest(false)
      c.disableFallsForTest(true)
      cfg.testMode = true
      cfg.testDurationSeconds = QUAKE_S
      cfg.layoutSeed = SEED

      // RESULT after a short ducked drill (as DC25's second drill).
      await toFreshBriefing(c, CLASSIC)
      const start = startSpot(c)
      pinDucked(c)
      await expectState(c, "QUAKE", (cfg.testWaitSeconds + cfg.testScanSeconds + 2) * 1000)
      await expectState(c, "POST_QUAKE", (QUAKE_S + 2) * 1000)
      c.headPose.setOverride(start, levelLook(start, doorPoint(c)))
      await walkOut(c)
      expect(c.resultPanel.mode).toBe("result")
      const head0 = c.headPose.position
      const fwd0 = c.headPose.forward
      await sleep(REFIT_MS)
      expect(await waitFor(() => !c.resultPanel.isFollowing, SETTLE_MS)).toBe(true)
      const p0 = panel.getWorldPosition()
      const below = head0.y - p0.y // the panel's own (slice-9B fitted) below
      expect(Math.abs(below - c.resultPanel.followBelow) < 0.01).toBe(true)
      const placed = dist(p0, anchor(head0, fwd0, d, below))
      expect(placed < 0.5).toBe(true) // the first placement snapped to the anchor

      // (a) A 15° turn: inside the dead zone, the panel stays and faces the head.
      c.headPose.setOverride(head0, turn(fwd0, SMALL_DEG))
      await sleep(STILL_MS)
      const movedA = dist(panel.getWorldPosition(), p0)
      const faceA = faceErrDeg(panel.getWorldPosition(), panel.getWorldRotation(), head0)
      expect(movedA < STILL_CM).toBe(true)
      expect(faceA < FACE_DEG).toBe(true)

      // (b) A 60° turn: it follows.
      const fwdB = turn(fwd0, BIG_DEG)
      c.headPose.setOverride(head0, fwdB)
      const b = await follows(panel, head0, anchor(head0, fwdB, d, below))
      expect(b.ok).toBe(true)

      // (c) A 100 cm sideways walk (looking the same way): it follows.
      const headC = head0.add(turn(fwdB, 90).uniformScale(WALK_CM))
      c.headPose.setOverride(headC, fwdB)
      const cw = await follows(panel, headC, anchor(headC, fwdB, d, below))
      expect(cw.ok).toBe(true)
      expect(await waitFor(() => !c.resultPanel.isFollowing, SETTLE_MS)).toBe(true)

      // (d) The replay caption: replayCaptionBelowEye under eye level, then a 60° turn.
      await press("ReplayButton")
      const view = c.replay
      expect(view !== null && view.isPlaying).toBe(true)
      if (!view) return
      const capBelow = headC.y - view.captionPosition.y
      expect(Math.abs(capBelow - cfg.replayCaptionBelowEye) <= BELOW_TOL_CM).toBe(true)
      const capPlaced = dist(view.captionPosition, anchor(headC, fwdB, d, cfg.replayCaptionBelowEye))
      expect(capPlaced < NEAR_CM).toBe(true)
      const fwdR = turn(fwdB, -BIG_DEG)
      c.headPose.setOverride(headC, fwdR)
      const t0 = getTime()
      const capWant = anchor(headC, fwdR, d, cfg.replayCaptionBelowEye)
      const capOk = await waitFor(
        () => dist(view.captionPosition, capWant) < NEAR_CM && faceErrDeg(view.captionPosition, view.captionRotation, headC) < FACE_DEG,
        FOLLOW_MS
      )
      const r: Follow = {
        ok: capOk,
        ms: (getTime() - t0) * 1000,
        cm: dist(view.captionPosition, capWant),
        face: faceErrDeg(view.captionPosition, view.captionRotation, headC)
      }
      expect(r.ok).toBe(true)
      const capBelowAfter = headC.y - view.captionPosition.y
      expect(Math.abs(capBelowAfter - cfg.replayCaptionBelowEye) <= BELOW_TOL_CM).toBe(true)
      expect(view.isPlaying).toBe(true) // still inside replaySeconds + replayHoldSeconds
      await press("ReplaySkipButton")
      expect(view.isPlaying).toBe(false)
      expect(c.resultPanel.isShown).toBe(true)

      // Back on the result panel: it catches up with the turn made during the replay.
      const back = await follows(panel, headC, anchor(headC, fwdR, d, below))
      expect(back.ok).toBe(true)
      expect(await waitFor(() => !c.resultPanel.isFollowing, SETTLE_MS)).toBe(true)

      // (e) A pinch held on Change language: a 60° turn leaves the panel still; the release opens LANGUAGE.
      const pH = panel.getWorldPosition()
      await holder.hold("ChangeLangButton")
      holding = true
      expect(c.resultPanel.isPinchHeld).toBe(true)
      c.headPose.setOverride(headC, turn(fwdR, BIG_DEG))
      await sleep(STILL_MS)
      const movedH = dist(panel.getWorldPosition(), pH)
      expect(movedH < STILL_CM).toBe(true)
      expect(c.state).toBe("RESULT")
      holding = false // before the release, so the finally never lets go twice
      await holder.release()
      await expectState(c, "LANGUAGE", 2000)
      expect(c.resultPanel.isShown).toBe(false)
      await press("LangButton.id")
      expect(c.state).toBe("LEVEL")

      // (d) GAME_OVER (as DC4): standing in the zone drains health to 0, then a 60° turn.
      cfg.testDurationSeconds = GAME_OVER_S
      await toFreshBriefing(c, CLASSIC)
      pinDucked(c)
      await expectState(c, "QUAKE", (cfg.testWaitSeconds + cfg.testScanSeconds + 2) * 1000)
      expect(await waitFor(() => c.hasBeenSafe, (cfg.safeHoldSeconds + 2) * 1000)).toBe(true)
      const center = c.safeZone.center
      const headG = atHeight(c, center, STANDING_HEAD_CM)
      const fwdG = levelLook(startSpot(c), center)
      c.headPose.setOverride(headG, fwdG)
      const drainS = cfg.healthStart / cfg.healthDrainPerSecond
      await expectState(c, "GAME_OVER", (drainS + 3) * 1000)
      expect(c.resultPanel.mode).toBe("gameOver")
      await sleep(REFIT_MS)
      expect(await waitFor(() => !c.resultPanel.isFollowing, SETTLE_MS)).toBe(true)
      const g0 = panel.getWorldPosition()
      const belowG = headG.y - g0.y
      expect(dist(g0, anchor(headG, fwdG, d, belowG)) < 0.5).toBe(true)
      const fwdG2 = turn(fwdG, -BIG_DEG)
      c.headPose.setOverride(headG, fwdG2)
      const g = await follows(panel, headG, anchor(headG, fwdG2, d, belowG))
      expect(g.ok).toBe(true)

      // (e) Restart from the moved game-over panel.
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")

      console.log(
        `[Aftershock] DC26: placed ${placed.toFixed(2)} cm off, below ${below.toFixed(1)} cm | (a) 15°: moved ${movedA.toFixed(3)} cm in 1 s, face ${faceA.toFixed(2)}° | (b) 60°: ${show(b)} | (c) walk ${WALK_CM} cm: ${show(cw)} | caption below ${capBelow.toFixed(2)} cm (want ${cfg.replayCaptionBelowEye}), placed ${capPlaced.toFixed(2)} cm off, 60°: ${show(r)}, below after ${capBelowAfter.toFixed(2)} | back on panel: ${show(back)} | held 60°: moved ${movedH.toFixed(3)} cm | game over below ${belowG.toFixed(1)} cm, 60°: ${show(g)}`
      )
    } finally {
      if (holding) await holder.release()
      if (c.replay && c.replay.isPlaying) c.replay.skip() // never leave the result panel hidden
      cfg.layoutSeed = prevSeed
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }
}
