import {StringKey} from "./Strings"

// Slice 9B education cards (F4, docs/EDUCATION_CARDS.md, ENGINEERING_PLAN 5k
// item 11, 5l item 3). Pure: no scene access. DrillController builds the facts
// at RESULT and GAME_OVER; ResultPanel shows the picked keys.

/** A score at or over this, with none of the problems below, is a perfect drill (card.coast). */
export const PERFECT_SCORE = 900

/** Layout hazards that card.fasten is about: furniture that can be fixed to the wall. */
export const FURNITURE_HAZARDS: readonly string[] = ["cabinet", "shelf", "tv"]

/** At most this many cards per result. */
export const MAX_CARDS = 2

/** What happened in one drill. */
export interface CardFacts {
  /** Stood up or left the zone after first cover while shaking, main quake or aftershock. */
  leftCoverEarly: boolean
  /** secondsInDanger > 0. */
  wasInDanger: boolean
  /** fallHits > 0 (the TV topple included). */
  wasHit: boolean
  /** bedWarnCount > 0. */
  duckedOnBed: boolean
  /** A cabinet, shelf or TV hazard was in this drill's layout. */
  hadFurnitureHazard: boolean
  evacReached: boolean
  evacFailed: boolean
  aftershockHappened: boolean
  /** Score ≥ PERFECT_SCORE and none of leftCoverEarly, wasInDanger, wasHit, duckedOnBed, evacFailed. */
  perfect: boolean
}

/** True when `score` (null: GAME_OVER, no score) makes a perfect drill with these facts. */
export function isPerfect(score: number | null, f: Omit<CardFacts, "perfect">): boolean {
  return score !== null && score >= PERFECT_SCORE && !f.leftCoverEarly && !f.wasInDanger && !f.wasHit && !f.duckedOnBed && !f.evacFailed
}

/** The facts with `perfect` filled in from `score`. */
export function buildCardFacts(score: number | null, f: Omit<CardFacts, "perfect">): CardFacts {
  return {
    leftCoverEarly: f.leftCoverEarly,
    wasInDanger: f.wasInDanger,
    wasHit: f.wasHit,
    duckedOnBed: f.duckedOnBed,
    hadFurnitureHazard: f.hadFurnitureHazard,
    evacReached: f.evacReached,
    evacFailed: f.evacFailed,
    aftershockHappened: f.aftershockHappened,
    perfect: isPerfect(score, f)
  }
}

/**
 * Table order (EDUCATION_CARDS.md). card.fasten is the general tip whenever
 * furniture was in the room; on a perfect drill it and card.evac step aside,
 * so card.coast (nothing else to say) can show.
 */
const CARD_RULES: {key: StringKey; when: (f: CardFacts) => boolean}[] = [
  {key: "card.stayUnder", when: (f) => f.leftCoverEarly},
  {key: "card.falling", when: (f) => f.wasInDanger || f.wasHit},
  {key: "card.bed", when: (f) => f.duckedOnBed},
  {key: "card.fasten", when: (f) => f.hadFurnitureHazard && !f.perfect},
  {key: "card.evac", when: (f) => (f.evacReached || f.evacFailed) && !f.perfect},
  {key: "card.check", when: (f) => f.aftershockHappened}
]

/** Cards that may follow the first one. */
const SECOND_CARDS: StringKey[] = ["card.fasten", "card.check"]

/**
 * The first matching card in table order, then the first later match that is
 * card.fasten or card.check; card.coast only when nothing else applies.
 * Never more than MAX_CARDS.
 */
export function pickCards(f: CardFacts): StringKey[] {
  const matches = CARD_RULES.filter((r) => r.when(f)).map((r) => r.key)
  if (matches.length === 0) {
    return ["card.coast"]
  }
  const cards: StringKey[] = [matches[0]]
  for (let i = 1; i < matches.length && cards.length < MAX_CARDS; i++) {
    if (SECOND_CARDS.indexOf(matches[i]) >= 0) {
      cards.push(matches[i])
    }
  }
  return cards
}
