import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DrillController, GLASS_HIT_DAMAGE} from "../DrillController"
import {CLASSIC, expectState, getController, itemWorld, levelLook, pinDucked, press, restore, startSpot, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

// DC22 (Slice 11, ENGINEERING_PLAN §5l item 7a): on Normal with the aftershock
// forced and a layout with glass, the pane stays whole through the main quake
// and breaks at the aftershock's crack stage 4: 8–14 shards, the pane hidden,
// the shards on the floor in the glass danger zone. A head standing in that
// zone (not under a table) at the break loses GLASS_HIT_DAMAGE on top of the
// zone drain, with the hit.glass notice; a head under the table loses nothing.
// Restart puts the pane back and clears the shards.
@component
export class DC22_GlassBreak extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.forceAftershockForTest(true)
      c.disableFallsForTest(true) // no falls: only the glass takes health beyond the drain
      c.config.testMode = true

      // (a) Standing in the glass danger zone at the break: −15 and hit.glass.
      await toFreshBriefing(c, CLASSIC)
      expect(c.level).toBe("normal")
      expect(c.layout.items.glass !== undefined).toBe(true)
      expectWhole(c)
      await throughMainQuake(c)
      expectWhole(c) // 5l-7a: never without an aftershock

      const inGlass = glassZonePoint(c)
      expect(c.glassDanger.contains(inGlass)).toBe(true)
      c.headPose.setOverride(inGlass, levelLook(startSpot(c), inGlass))
      await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 1) * 1000)
      expect(c.glassBroken).toBe(false)
      const h0 = c.health
      const d0 = c.secondsInDanger
      const hits0 = c.glassHits
      await waitFor(() => c.glassBroken, c.config.testAftershockDurationSeconds * 1000)
      const h1 = c.health
      const d1 = c.secondsInDanger
      expect(c.glassBroken).toBe(true)
      expect(c.shardCount).toBeGreaterThan(7)
      expect(c.shardCount).toBeLessThan(15)
      expect(c.glassPaneShown).toBe(false)
      expect(c.inDanger).toBe(true)
      expect(c.isSafe).toBe(false)
      expect(c.glassHits).toBe(hits0 + 1)
      // Exact, as DC13: lost = the hit + the zone drain for the seconds spent in danger (Normal: multiplier 1).
      const drained = (d1 - d0) * c.config.healthDrainPerSecond
      const lost = h0 - h1
      console.log(`[Aftershock] DC22: lost ${lost.toFixed(2)} = hit ${GLASS_HIT_DAMAGE} + drain ${drained.toFixed(2)}?`)
      expect(Math.abs(lost - (GLASS_HIT_DAMAGE + drained))).toBeLessThan(0.5)
      expect(c.hud.isNoticeShown).toBe(true)
      expect(c.hud.noticeKey).toBe("hit.glass")

      // The shards land in the glass danger zone and stay there.
      await waitFor(() => c.shakeFx.shardPoints().length === c.shardCount, 2000)
      const points = c.shakeFx.shardPoints()
      expect(points.length).toBe(c.shardCount)
      for (const p of points) {
        expect(c.glassDanger.contains(itemWorld(c, p.x, p.z, c.config.eyeHeight))).toBe(true)
      }
      await finishDrill(c)
      expect(c.glassBroken).toBe(true) // still on the floor at RESULT
      expect(c.shardCount).toBe(points.length)

      // Restart: the pane back, no shards.
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      expectWhole(c)

      // (b) Under the table at the break: no hit.
      await toFreshBriefing(c, CLASSIC)
      expect(c.layout.items.glass !== undefined).toBe(true)
      expectWhole(c)
      await throughMainQuake(c)
      c.headPose.setOverride(startSpot(c), levelLook(startSpot(c), c.safeZone.center)) // leave cover: the quiet wait
      await waitFor(() => c.aftershockWaiting, 2000)
      expect(c.aftershockWaiting).toBe(true)
      pinDucked(c) // back under the table before the aftershock starts
      await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 1) * 1000)
      const h2 = c.health
      const hits2 = c.glassHits
      await waitFor(() => c.glassBroken, c.config.testAftershockDurationSeconds * 1000)
      expect(c.glassBroken).toBe(true)
      expect(c.isSafe).toBe(true)
      expect(c.glassHits).toBe(hits2)
      expect(Math.abs(c.health - h2) <= 0.5).toBe(true)
      await finishDrill(c)
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      expectWhole(c)
    } finally {
      restore(c, prevTestMode, prevDuration)
    }
  }
}

/** The pane shown, not broken, no shards. */
function expectWhole(c: DrillController): void {
  expect(c.glassBroken).toBe(false)
  expect(c.shardCount).toBe(0)
  expect(c.glassPaneShown).toBe(true)
}

/** From BRIEFING: ducked under the table through the main quake, to POST_QUAKE. */
async function throughMainQuake(c: DrillController): Promise<void> {
  pinDucked(c)
  await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
  await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)
  expect(c.hasBeenSafe).toBe(true)
  await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
  expect(c.aftershockHappened).toBe(false)
}

/** A standing head point in the glass danger zone: half the zone's margin into the room from the pane (glass-local −Z is the room side). */
function glassZonePoint(c: DrillController): vec3 {
  const g = c.layout.items.glass
  const d = c.config.dangerMargin / 2
  return itemWorld(c, g.x - Math.sin(g.yaw) * d, g.z - Math.cos(g.yaw) * d, c.config.eyeHeight)
}

/** Under the table until the aftershock ends, then out the door to RESULT. */
async function finishDrill(c: DrillController): Promise<void> {
  pinDucked(c)
  await expectState(c, "POST_QUAKE", (c.config.testAftershockDurationSeconds + 2) * 1000)
  c.headPose.setOverride(startSpot(c), levelLook(startSpot(c), c.safeZone.center))
  await walkOut(c)
}
