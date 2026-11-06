import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DrillController} from "../DrillController"
import {FixRoomView, markerText} from "../FixRoomView"
import {FOOTPRINTS, LayoutForce} from "../LayoutGenerator"
import {getString, joinList, lines, StringKey} from "../Strings"
import {expectState, getController, itemWorld, levelLook, lookAwayFromMarkers, press, restore, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

/** Slice 14B: the three fixable items and one table. */
const FIX_SET: LayoutForce = {tables: 1, hazards: ["shelf", "cabinet", "tv"]}
/** Nothing fixable in the room: no item can make a problem. */
const CALM_SET: LayoutForce = {tables: 1, hazards: ["glass"]}
const PLAN_SEED = 14001 // as DC27: the TV topples in the quake
const HEAD_OUT_CM = 30 // the head stands this far in front of the shelf's front face, as DC27
const MARKER_MIN_CM = 12 // habit 3
const TAG_WAIT_MS = 2000 // labels are all shown once the scan has ended (QUAKE)
const REPLAY_WAIT_MS = 60000
const LAYOUT_WAIT_MS = 500 // Slice 15A: the panel's flex layout and fit settle in a few frames
const FIT_TOL_CM = 0.2 // Slice 15A: how far a box may poke past the panel backing
const FILL_TOL = 0.01 // Slice 15A: the bar's fill against n/m

/** One finished drill, as DC28 compares them. */
interface DrillRun {
  tag: string // the shelf's "Sudah diikat" during the quake ("" when none)
  tv: {shake: number; t: number}[]
  tvToppled: boolean
  shelfDrops: number
  landed: number
  hit: number
}

// DC28 (Slice 14B, ENGINEERING_PLAN 5m item 15, decisions 1a 2a 3a 4a): fix the
// room, then the same quake. (a) A drill with no fixable item never offers
// Perbaiki kamar; drill 1 with the head in the shelf's zone does, its problem
// items the shelf (and the TV once it toppled). (b) Perbaiki kamar hides the
// panel and shows one marker per problem item; pinching the shelf's marker
// fastens it (tag, Ulangi gempa), again undoes it, a third fastens it again;
// Kembali keeps it. (c) Ulangi gempa: the same layout and plan, the shelf drops
// nothing, the TV as in drill 1, the tag shown in the quake. (d) The second
// result: compare rows from the baseline and this drill, the repair list, no
// cards; Lihat ulang still plays. Slice 15A (S1 R1): the headline "n of m
// prevented" (or "no fewer") with its bar and the line naming the fastened
// items, the table's green "after" values, the checklist rows and boxes, no
// detail rows, every box inside the backing and the checklist rows apart.
// (e) Restart: new seeds, no fixes, no tag. Slice 18 (plan 19b): the head turns
// away from the markers (the fix panel full, not the pill) before the full
// panel's checks and before Kembali, as a wearer does.
@component
export class DC28_FixRoom extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    const prevPlanSeed = c.config.planSeed
    const prevHitDamage = c.config.fallHitDamage
    try {
      c.forceAftershockForTest(true)
      c.disableFallsForTest(false)
      c.config.testMode = true
      c.config.testDurationSeconds = 12 // as DC27
      c.config.planSeed = PLAN_SEED
      c.config.fallHitDamage = 1 // every hit counted, but the drill lives to the aftershock
      c.setLevelForTest("normal")
      const p0 = c.headPose.position
      const f0 = c.headPose.forward
      const f0Level = new vec3(f0.x, 0, f0.z).length > 0.01 ? new vec3(f0.x, 0, f0.z) : new vec3(0, 0, -1)
      c.headPose.setOverride(p0, f0Level)
      const fixLabel = getString("btn.fixRoom")

      // (a) No fixable item: no problem, no Perbaiki kamar.
      await toFreshBriefing(c, CALM_SET)
      expect(c.problemItems.length).toBe(0)
      await this.runCalm(c)
      expect(c.state === "RESULT" || c.state === "GAME_OVER").toBe(true)
      expect(c.problemItems.length).toBe(0)
      expect(c.resultPanel.fixRoomShown).toBe(false)
      expect(c.resultPanel.texts.indexOf(fixLabel) >= 0).toBe(false)
      expect(c.resultPanel.compareLines.length).toBe(0)
      expect(c.resultPanel.repairLines.length).toBe(0)
      const calmState = c.state

      // (a) Drill 1: the head in the shelf's zone.
      c.headPose.setOverride(p0, f0Level)
      await toFreshBriefing(c, FIX_SET)
      expect(c.isRepeat).toBe(false)
      expect(c.planSeed).toBe(PLAN_SEED)
      expect(c.problemItems.length).toBe(0) // cleared at BRIEFING
      expect(c.fixTagged.length).toBe(0)
      const layoutSeed = c.layout.seed
      const head = this.headSpot(c)
      const d1 = await this.runDrill(c, head)
      expect(c.state).toBe("RESULT")
      expect(d1.tag).toBe("")
      const score1 = c.lastScore ? c.lastScore.score : null
      const problems = c.problemItems
      expect(problems.indexOf("shelf") >= 0).toBe(true)
      if (d1.tvToppled) {
        expect(problems.indexOf("tv") >= 0).toBe(true)
      }
      expect(c.resultPanel.fixRoomShown).toBe(true)
      expect(c.resultPanel.texts.indexOf(fixLabel) >= 0).toBe(true)
      expect(c.resultPanel.compareLines.length).toBe(0) // a first drill: no compare rows
      expect(c.resultPanel.shownCards.length).toBe(1) // Slice 17 (plan 17): the compact first result shows one card
      expect(c.resultPanel.shownDetailRows).toBe(3) // Slice 17 (plan 17): speed (or never), health, grip
      expect(c.resultPanel.headline).toBe("")
      expect(c.resultPanel.repairChecked.length).toBe(0)
      const firstDetailRows = c.resultPanel.shownDetailRows

      // (b) Perbaiki kamar.
      await press("FixRoomButton")
      const v = c.fixRoomView as FixRoomView
      expect(v !== null).toBe(true)
      expect(c.fixMode).toBe(true)
      expect(c.state).toBe("RESULT")
      expect(c.resultPanel.isShown).toBe(false)
      expect(v.isOpen).toBe(true)
      expect(v.panelShown).toBe(true)
      expect(v.markersShown.join(",")).toBe(problems.join(","))
      expect(await lookAwayFromMarkers(c, v)).toBe(true) // Slice 18 (plan 19b): the full panel, not the pill
      expect(v.repeatShown).toBe(false)
      expect(v.backShown).toBe(true)
      expect(v.instrText).toBe(getString("fix.instr"))
      expect(c.activeHazardLabels.every((l) => l.isShown)).toBe(true)
      const markerLog: string[] = []
      for (const item of v.markersShown) {
        expect(v.markerText(item)).toBe(markerText(item))
        expect(v.markerHeightCm(item)).toBeGreaterThan(MARKER_MIN_CM - 0.01)
        expect(v.markerSelected(item)).toBe(false)
        const p = v.markerPosition(item)
        expect(p !== null).toBe(true)
        if (p) {
          markerLog.push(`${item} ${v.markerHeightCm(item).toFixed(1)} cm, ${p.sub(c.headPose.position).length.toFixed(0)} cm from the head, ${(p.y - c.floorY).toFixed(0)} cm up`)
        }
      }
      await press("FixShelfButton")
      expect(c.fixSelection.join(",")).toBe("shelf")
      expect(v.markerSelected("shelf")).toBe(true)
      expect(c.fixTagText("shelf")).toBe(getString("fix.done"))
      expect(v.repeatShown).toBe(true)
      await press("FixShelfButton")
      expect(c.fixSelection.length).toBe(0)
      expect(v.markerSelected("shelf")).toBe(false)
      expect(c.fixTagText("shelf")).toBe("")
      expect(v.repeatShown).toBe(false)
      await press("FixShelfButton")
      expect(c.fixSelection.join(",")).toBe("shelf")
      expect(v.repeatShown).toBe(true)
      expect(await lookAwayFromMarkers(c, v)).toBe(true) // Slice 18 (plan 19b): turn to the panel, Kembali shown again
      await press("FixBackButton")
      expect(c.fixMode).toBe(false)
      expect(v.isOpen).toBe(false)
      expect(c.resultPanel.isShown).toBe(true)
      expect(c.fixSelection.join(",")).toBe("shelf")
      await press("FixRoomButton")
      expect(c.fixMode).toBe(true)
      expect(v.markerSelected("shelf")).toBe(true)
      expect(c.fixTagText("shelf")).toBe(getString("fix.done"))
      expect(v.repeatShown).toBe(true)

      // (c) Ulangi gempa: the same room and quake, the shelf fastened.
      c.headPose.setOverride(p0, f0Level)
      await press("RepeatQuakeButton")
      expect(c.state).toBe("BRIEFING")
      expect(c.isRepeat).toBe(true)
      expect(c.fixMode).toBe(false)
      expect(v.isOpen).toBe(false)
      expect(c.layout.seed).toBe(layoutSeed)
      expect(c.planSeed).toBe(PLAN_SEED)
      expect(c.fastened.join(",")).toBe("shelf")
      expect(c.fixTagged.join(",")).toBe("shelf")
      const base = c.baseline
      expect(base !== null).toBe(true)
      expect(base ? base.landed : -1).toBe(d1.landed)
      expect(base ? base.hit : -1).toBe(d1.hit)
      expect(base ? base.score : -1).toBe(score1)
      const d2 = await this.runDrill(c, head)
      expect(d2.shelfDrops).toBe(0)
      expect(sameTv(d2.tv, d1.tv)).toBe(true)
      expect(d2.tvToppled).toBe(d1.tvToppled)
      expect(d2.tag).toBe(getString("fix.done"))

      // (d) The second result.
      expect(c.state).toBe("RESULT")
      const score2 = c.lastScore ? c.lastScore.score : null
      const want = [
        lines("compare.fell", {"{a}": str(d1.landed), "{b}": str(d2.landed)}).primary,
        lines("compare.hit", {"{a}": str(d1.hit), "{b}": str(d2.hit)}).primary,
        lines("compare.score", {"{a}": str(score1), "{b}": str(score2)}).primary
      ]
      expect(c.resultPanel.compareLines.join(" | ")).toBe(want.join(" | "))
      // Slice 15A (b): the checklist: the fastened shelf checked, then each other
      // problem item not fastened (either drill, FIXABLE order) open, then "heavy low".
      const open = ["cabinet", "tv"].filter((h) => problems.indexOf(h) >= 0 || c.problemItems.indexOf(h) >= 0)
      const repair = [lines("repair.title").primary, lines("repair.shelf").primary]
        .concat(open.map((h) => lines(("repair." + h) as StringKey).primary))
        .concat([lines("repair.heavyLow").primary, lines("repair.source").primary])
      expect(c.resultPanel.repairLines.join(" | ")).toBe(repair.join(" | "))
      expect(c.resultPanel.repairChecked.join(",")).toBe([true].concat(open.map(() => false), [false]).join(","))
      const reasons = [getString("repair.tried")].concat(
        open.map(() => getString("repair.problem")),
        [""]
      )
      expect(c.resultPanel.repairReasons.join(" | ")).toBe(reasons.join(" | "))
      expect(c.resultPanel.shownCards.length).toBe(0) // the cards make room
      expect(c.resultPanel.fixRoomShown).toBe(c.problemItems.length > 0)
      // Slice 15A (a): the headline, the line under it and the bar.
      const n = Math.max(0, d1.landed - d2.landed)
      const m = d1.landed
      if (n > 0 && m > 0) {
        expect(c.resultPanel.headline).toBe(lines("compare.prevented", {"{n}": str(n), "{m}": str(m)}).primary)
        expect(c.resultPanel.becauseLine).toBe(lines("compare.because", {"{items}": joinList([getString("item.shelf")])}).primary)
        expect(c.resultPanel.barShown).toBe(true)
        expect(Math.abs(c.resultPanel.preventedFill - n / m)).toBeLessThan(FILL_TOL)
        expect(c.resultPanel.barText).toBe(n + "/" + m)
      } else {
        expect(c.resultPanel.headline).toBe(getString("compare.notPrevented"))
        expect(c.resultPanel.becauseLine).toBe("")
        expect(c.resultPanel.barShown).toBe(false)
      }
      // The table: the after values, green when better.
      expect(c.resultPanel.compareAfter.join(",")).toBe([str(d2.landed), str(d2.hit), str(score2)].join(","))
      const green = [d2.landed < d1.landed, d2.hit < d1.hit, score1 !== null && score2 !== null && score2 > score1]
      expect(c.resultPanel.compareGreen.join(",")).toBe(green.join(","))
      const shownGreen = c.resultPanel.compareGreen.join(",")
      // (e) The table's score is the ScoreBreakdown's total.
      const sb = c.lastScore
      expect(sb !== null).toBe(true)
      if (sb) {
        const total = Math.max(0, Math.min(1000, sb.speedPoints + sb.healthPoints + sb.holdPoints + sb.evacPoints - sb.penalty))
        expect(sb.score).toBe(total)
        expect(c.resultPanel.compareAfter[2]).toBe(str(total))
      }
      // (c) No detail rows, no cards.
      expect(c.resultPanel.shownDetailRows).toBe(0)
      // (d) Everything inside the panel backing; no two checklist rows overlap.
      await waitFor(() => false, LAYOUT_WAIT_MS)
      const panel = c.resultPanel.backingBox
      const outside = c.resultPanel.secondBoxes.filter(
        (b) => b.minX < panel.minX - FIT_TOL_CM || b.maxX > panel.maxX + FIT_TOL_CM || b.minY < panel.minY - FIT_TOL_CM || b.maxY > panel.maxY + FIT_TOL_CM
      )
      expect(outside.map((b) => b.name).join(",")).toBe("")
      expect(c.resultPanel.secondBoxes.length).toBeGreaterThan(5)
      const rowBoxes = c.resultPanel.listRowBoxes
      expect(rowBoxes.length).toBe(repair.length - 2)
      const overlaps: string[] = []
      for (let i = 0; i < rowBoxes.length; i++) {
        for (let j = i + 1; j < rowBoxes.length; j++) {
          const a = rowBoxes[i]
          const b = rowBoxes[j]
          if (a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY) overlaps.push(a.name + "/" + b.name)
        }
      }
      expect(overlaps.join(",")).toBe("")
      const gaps = rowBoxes.slice(1).map((b, i) => (rowBoxes[i].minY - b.maxY).toFixed(2))
      const fit = `backing ${(panel.maxX - panel.minX).toFixed(1)} x ${(panel.maxY - panel.minY).toFixed(1)} cm, ${c.resultPanel.secondBoxes.length} boxes inside, row gaps [${gaps.join(", ")}] cm`
      const shownHead = `"${c.resultPanel.headline}" / "${c.resultPanel.becauseLine}", bar ${c.resultPanel.barShown ? c.resultPanel.preventedFill.toFixed(3) + " (" + c.resultPanel.barText + ")" : "hidden"}`
      const shownCompare = c.resultPanel.compareLines.join(" | ")
      const shownRepair = c.resultPanel.repairLines.join(" | ")
      await press("ReplayButton")
      expect(c.resultPanel.isShown).toBe(false)
      expect(await waitFor(() => c.resultPanel.isShown, REPLAY_WAIT_MS)).toBe(true)
      expect(c.resultPanel.compareLines.join(" | ")).toBe(shownCompare) // the same panel after the replay

      // (e) Restart drops the plan, the fixes and the baseline.
      c.config.planSeed = 0
      await press("RestartButton")
      expect(c.state).toBe("LEVEL")
      expect(c.fixSelection.length).toBe(0)
      expect(c.fastened.length).toBe(0)
      expect(c.baseline).toBe(null)
      expect(c.fixTagged.length).toBe(0)
      c.headPose.setOverride(p0, f0Level)
      await toFreshBriefing(c, FIX_SET)
      expect(c.isRepeat).toBe(false)
      expect(c.planSeed !== 0).toBe(true)
      expect(c.planSeed !== PLAN_SEED).toBe(true)
      if (c.config.layoutSeed === 0) {
        expect(c.layout.seed !== layoutSeed).toBe(true)
      }
      expect(c.fixTagged.length).toBe(0)
      expect(c.problemItems.length).toBe(0)

      print(
        `DC28: calm drill ${calmState}, no Perbaiki kamar | drill 1 (plan ${PLAN_SEED}, layout ${layoutSeed}): problems [${problems.join(", ")}], landed ${d1.landed} hit ${d1.hit} shelf drops ${d1.shelfDrops}, TV ${d1.tvToppled ? "toppled" : "upright"}, score ${str(score1)}` +
          ` | markers: ${markerLog.join("; ")}` +
          ` | repeat [shelf]: shelf drops ${d2.shelfDrops}, TV ${d2.tvToppled ? "toppled" : "upright"}, tag "${d2.tag}", landed ${d2.landed} hit ${d2.hit}, score ${str(score2)}` +
          ` | headline ${shownHead} | compare: ${shownCompare} (green ${shownGreen}) | repair: ${shownRepair} | first result ${firstDetailRows} detail rows | fit: ${fit} | Restart: plan ${c.planSeed}, layout ${c.layout.seed}`
      )
    } finally {
      c.config.planSeed = prevPlanSeed
      c.config.fallHitDamage = prevHitDamage
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }

  /** Room-local XZ (x, y = z) of the head spot: HEAD_OUT_CM in front of the shelf's front face, as DC27. */
  private headSpot(c: DrillController): vec2 {
    const at = c.layout.items.shelf
    const f = FOOTPRINTS.shelf
    const theta = at.yaw + f.front
    const depth = Math.abs(Math.sin(f.front)) > 0.5 ? f.halfX : f.halfZ
    const out = depth + HEAD_OUT_CM
    return new vec2(at.x + Math.sin(theta) * out, at.z + Math.cos(theta) * out)
  }

  /** From BRIEFING: the head still at the start spot (nothing fixable near) to RESULT or GAME_OVER. */
  private async runCalm(c: DrillController): Promise<void> {
    const cfg = c.config
    await expectState(c, "QUAKE", (cfg.testWaitSeconds + cfg.testScanSeconds + 2) * 1000)
    const ms = (cfg.testDurationSeconds + cfg.testAftershockDelaySeconds + cfg.testAftershockDurationSeconds + 8) * 1000
    await waitFor(() => c.state === "EVACUATE" || c.state === "RESULT" || c.state === "GAME_OVER", ms)
    if (c.state === "EVACUATE") {
      await walkOut(c)
    }
  }

  /** From BRIEFING, as DC27: the head still in the shelf's zone through both shakes, then out to RESULT. */
  private async runDrill(c: DrillController, head: vec2): Promise<DrillRun> {
    expect(c.state).toBe("BRIEFING")
    const eye = itemWorld(c, head.x, head.y, c.config.eyeHeight)
    const shelf = c.layout.items.shelf
    c.headPose.setOverride(eye, levelLook(eye, itemWorld(c, shelf.x, shelf.z, 0)))
    expect(c.shelfDanger.contains(eye)).toBe(true)
    await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
    await waitFor(() => c.fixTagText("shelf").length > 0, TAG_WAIT_MS)
    const tag = c.fixTagText("shelf")
    await waitFor(() => c.state === "POST_QUAKE" || c.state === "AFTERSHOCK", (c.config.testDurationSeconds + 2) * 1000)
    await expectState(c, "AFTERSHOCK", (c.config.testAftershockDelaySeconds + 2) * 1000)
    await waitFor(() => c.state === "POST_QUAKE" || c.state === "EVACUATE", (c.config.testAftershockDurationSeconds + 2) * 1000)
    expect(c.state === "POST_QUAKE" || c.state === "EVACUATE").toBe(true)
    const run: DrillRun = {
      tag,
      tv: c.tvPlan.map((t) => ({shake: t.shake, t: t.t})),
      tvToppled: c.tvToppled,
      shelfDrops: c.fallingObjects.drops.filter((d) => d.source === "shelf").length,
      landed: c.replayTrack.count("landed"),
      hit: c.replayTrack.count("hit")
    }
    await walkOut(c)
    return run
  }
}

function sameTv(a: DrillRun["tv"], b: DrillRun["tv"]): boolean {
  return a.length === b.length && a.every((t, i) => t.shake === b[i].shake && Math.abs(t.t - b[i].t) < 1e-6)
}

function str(n: number | null): string {
  return n === null ? "-" : "" + n
}
