import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DrillController} from "../DrillController"
import {buildCardFacts, CardFacts, isPerfect, MAX_CARDS, pickCards} from "../EducationCards"
import {lines} from "../Strings"
import {CLASSIC, expectState, getController, levelLook, pinDucked, restore, startSpot, toFreshBriefing, waitFor, walkOut} from "./DrillTestKit"

/** Facts with every problem off, then `on` switched on; `score` fills in perfect. */
function facts(score: number | null, on: Partial<Omit<CardFacts, "perfect">>): CardFacts {
  return buildCardFacts(score, {
    leftCoverEarly: on.leftCoverEarly === true,
    wasInDanger: on.wasInDanger === true,
    wasHit: on.wasHit === true,
    duckedOnBed: on.duckedOnBed === true,
    hadFurnitureHazard: on.hadFurnitureHazard === true,
    evacReached: on.evacReached === true,
    evacFailed: on.evacFailed === true,
    aftershockHappened: on.aftershockHappened === true
  })
}

const cards = (f: CardFacts): string => JSON.stringify(pickCards(f))

// DC19 (Slice 9B, F4, docs/EDUCATION_CARDS.md): pickCards gives the first
// matching card in table order, a second only if card.fasten or card.check,
// card.coast only when nothing else applies, never more than two. Live: at
// RESULT, lastCards is pickCards of the drill's facts and the panel shows
// each card's text in the selected language.
@component
export class DC19_EducationCards extends Scenario {
  async run(): Promise<void> {
    // Pure selector.
    expect(cards(facts(700, {leftCoverEarly: true, hadFurnitureHazard: true}))).toBe(JSON.stringify(["card.stayUnder", "card.fasten"]))
    expect(pickCards(facts(800, {wasHit: true, hadFurnitureHazard: true}))[0]).toBe("card.falling")
    expect(pickCards(facts(800, {wasInDanger: true}))[0]).toBe("card.falling")
    expect(cards(facts(600, {duckedOnBed: true}))).toBe(JSON.stringify(["card.bed"]))
    const perfect = facts(950, {hadFurnitureHazard: true, evacReached: true})
    expect(perfect.perfect).toBe(true)
    expect(cards(perfect)).toBe(JSON.stringify(["card.coast"]))
    expect(cards(facts(850, {evacReached: true, aftershockHappened: true}))).toBe(JSON.stringify(["card.evac", "card.check"]))
    const everything = facts(null, {
      leftCoverEarly: true,
      wasInDanger: true,
      wasHit: true,
      duckedOnBed: true,
      hadFurnitureHazard: true,
      evacReached: true,
      evacFailed: true,
      aftershockHappened: true
    })
    expect(pickCards(everything).length <= MAX_CARDS).toBe(true)
    expect(cards(everything)).toBe(JSON.stringify(["card.stayUnder", "card.fasten"]))

    // Live: a Normal CLASSIC drill, fast cover, held, walked out.
    const c = getController()
    const prevTestMode = c.config.testMode
    const prevDuration = c.config.testDurationSeconds
    try {
      c.setLevelForTest("normal")
      await this.drill(c)
      const f = c.lastCardFacts as CardFacts
      expect(f !== null).toBe(true)
      expect(JSON.stringify(c.lastCards)).toBe(JSON.stringify(pickCards(f)))
      expect(c.lastCards.length > 0 && c.lastCards.length <= MAX_CARDS).toBe(true)
      expect(f.leftCoverEarly).toBe(c.leftCoverEarly)
      expect(f.wasInDanger).toBe(c.secondsInDanger > 0)
      expect(f.wasHit).toBe(c.fallHits > 0)
      expect(f.duckedOnBed).toBe(c.bedWarnCount > 0)
      expect(f.hadFurnitureHazard).toBe(true) // CLASSIC: cabinet and shelf
      expect(f.evacReached).toBe(c.evacTime !== null)
      expect(f.evacFailed).toBe(c.evacFailed)
      expect(f.aftershockHappened).toBe(false)
      expect(f.perfect).toBe(isPerfect(c.lastScore.score, f))
      expect(JSON.stringify(c.resultPanel.shownCards)).toBe(JSON.stringify(c.lastCards))
      const texts = c.resultPanel.texts
      for (const key of c.lastCards) {
        expect(texts.indexOf(lines(key).primary) >= 0).toBe(true)
      }
    } finally {
      c.setLevelForTest("normal")
      restore(c, prevTestMode, prevDuration)
    }
  }

  /** As DC17: CLASSIC, no aftershock, no falls; cover at once, held, then walked out to RESULT. */
  private async drill(c: DrillController): Promise<void> {
    c.headPose.clearOverride()
    c.forceAftershockForTest(false)
    c.disableFallsForTest(true)
    c.config.testMode = true
    c.config.testDurationSeconds = 10
    await toFreshBriefing(c, CLASSIC)
    c.gripHandles.setHoldingForTest(true) // hooks after toFreshBriefing (5j-19f)
    const start = startSpot(c)
    pinDucked(c)
    await expectState(c, "QUAKE", (c.config.testWaitSeconds + c.config.testScanSeconds + 2) * 1000)
    expect(await waitFor(() => c.hasBeenSafe, (c.config.safeHoldSeconds + 2) * 1000)).toBe(true)
    await expectState(c, "POST_QUAKE", (c.config.testDurationSeconds + 2) * 1000)
    c.headPose.setOverride(start, levelLook(start, c.safeZone.center))
    await walkOut(c)
    expect(c.lastScore !== null).toBe(true)
    expect(c.resultPanel.mode).toBe("result")
  }
}
