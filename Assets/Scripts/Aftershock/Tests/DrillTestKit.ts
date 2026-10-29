import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {DrillController} from "../DrillController"
import {Layout, LayoutForce} from "../LayoutGenerator"

/** DC1–DC7 item set (Slice 2–6 rules): one table, cabinet, shelf, glass; bed and chair are always there. */
export const CLASSIC: LayoutForce = {tables: 1, hazards: ["cabinet", "shelf", "glass"]}

// Shared helpers for DC2–DC7. Scenarios share one running Lens, so each one
// brings the drill from wherever the last one left it (TDD §8).

const PINCH_GUARD_WAIT_MS = 800 // every panel ignores presses for 0.5 s after it shows (5h item 1)
const POLL_MS = 100

/** Head height (cm above floorY) for a ducked head: under the duck line at floorY + 70. */
export const DUCKED_HEAD_CM = 60

export function getController(): DrillController {
  return findSceneObjectByName("DrillController").getComponent(DrillController.getTypeName()) as DrillController
}

/** Waits out the panel's pinch guard, then pinches the named interactable. */
export async function press(name: string): Promise<void> {
  await sleep(PINCH_GUARD_WAIT_MS)
  await new DefaultLeafInteractor().trigger(findInteractableByName(name))
  await sleep(POLL_MS * 2)
}

/** Polls until `test` holds or `timeoutMs` passes; returns whether it held. */
export async function waitFor(test: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = getTime() + timeoutMs / 1000
  while (!test()) {
    if (getTime() >= end) {
      return false
    }
    await sleep(POLL_MS)
  }
  return true
}

/** Fails unless the drill reaches `state` within `timeoutMs`. */
export async function expectState(c: DrillController, state: string, timeoutMs: number): Promise<void> {
  await waitFor(() => c.state === state, timeoutMs)
  expect(c.state).toBe(state)
}

/**
 * A fresh BRIEFING with this scenario's config. RESULT and GAME_OVER use the
 * Restart button, LANGUAGE and SAFETY the normal buttons. BRIEFING, QUAKE and
 * POST_QUAKE have timers from an earlier config, so they use resetForTest().
 */
export async function toFreshBriefing(c: DrillController, force: LayoutForce | null = CLASSIC): Promise<void> {
  c.forceLayoutForTest(force)
  if (c.state === "LANGUAGE") {
    await press("LangButton.id")
  }
  if (c.state === "SAFETY") {
    await press("ContinueButton")
  } else if (c.state === "RESULT" || c.state === "GAME_OVER") {
    await press("RestartButton")
  } else if (c.state !== "LEVEL") {
    c.resetForTest()
  }
  if (c.state === "LEVEL") {
    await press("LevelButton.normal") // Slice 7C: the level picker sits between SAFETY and BRIEFING
  }
  expect(c.state).toBe("BRIEFING")
  expect(c.health).toBe(c.config.healthStart)
}

/** The start spot at eye height: the Room is placed under the head at every BRIEFING. */
export function startSpot(c: DrillController): vec3 {
  const p = c.room.getTransform().getWorldPosition()
  return new vec3(p.x, c.floorY + c.config.eyeHeight, p.z)
}

/** `at`'s XZ at `aboveFloor` cm over the room floor. */
export function atHeight(c: DrillController, at: vec3, aboveFloor: number): vec3 {
  return new vec3(at.x, c.floorY + aboveFloor, at.z)
}

/** Level look direction from `from` toward `to` (or away with `away`). */
export function levelLook(from: vec3, to: vec3, away: boolean = false): vec3 {
  let d = new vec3(to.x - from.x, 0, to.z - from.z).normalize()
  if (away) {
    d = d.uniformScale(-1)
  }
  return d
}

/** Pins the head in the safe zone, ducked, facing the table center. */
export function pinDucked(c: DrillController): void {
  const center = c.safeZone.center
  c.headPose.setOverride(atHeight(c, center, DUCKED_HEAD_CM), levelLook(startSpot(c), center))
}

export function sameLayout(a: Layout, b: Layout): boolean {
  const keys = Object.keys(a.items).concat(Object.keys(b.items))
  for (const key of keys) {
    const p = a.items[key as keyof Layout["items"]]
    const q = b.items[key as keyof Layout["items"]]
    if (!p || !q || p.x !== q.x || p.z !== q.z || p.yaw !== q.yaw) {
      return false
    }
  }
  return a.seed === b.seed
}

/** Room-local item placement (cm) to world, at `aboveFloor` cm over the floor. */
export function itemWorld(c: DrillController, x: number, z: number, aboveFloor: number): vec3 {
  const t = c.room.getTransform()
  const w = t.getWorldTransform().multiplyPoint(new vec3(x, 0, z))
  return new vec3(w.x, c.floorY + aboveFloor, w.z)
}

/** Copies a layout so later layouts cannot change it. */
export function copyLayout(l: Layout): Layout {
  return JSON.parse(JSON.stringify(l)) as Layout
}

/** Puts back the config fields a scenario changed and lets go of the head. */
export function restore(c: DrillController, testMode: boolean, testDurationSeconds: number): void {
  c.config.testMode = testMode
  c.config.testDurationSeconds = testDurationSeconds
  c.headPose.clearOverride()
  c.forceLayoutForTest(null)
  c.forceAftershockForTest(null) // Slice 7C: back to the level's chance
}
