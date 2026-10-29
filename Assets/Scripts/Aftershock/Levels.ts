import {DrillConfig} from "./DrillConfig"
import {LayoutParams} from "./LayoutGenerator"
import {StringKey} from "./Strings"

// Level rules (Slice 7C, ENGINEERING_PLAN 5j item 18). Pure: DrillController
// asks these what the picked level changes; the numbers live in DrillConfig.
//   easy   tables tableDistanceMin..easyTableMax, labels stay through the quake, no aftershock, nothing falls
//   normal today's rules, aftershock with normalAftershockChance, falling items (Slice 7D)
//   hard   no guides at all (find it yourself), drain × hardDrainMultiplier, aftershock always, falling items

export type Level = "easy" | "normal" | "hard"

/** Picker order, left to right. */
export const LEVELS: Level[] = ["easy", "normal", "hard"]

/** The level a new Lens starts with, and the one the picker marks recommended. */
export const DEFAULT_LEVEL: Level = "normal"

export function levelNameKey(level: Level): StringKey {
  return ("level." + level) as StringKey
}

/** The three description lines of a level card. */
export function levelLineKeys(level: Level): StringKey[] {
  return [1, 2, 3].map((n) => ("level." + level + "." + n) as StringKey)
}

/** Layout params for this level: Easy narrows the table range; hazards keep theirs. */
export function layoutParamsFor(level: Level, c: DrillConfig): LayoutParams {
  const tableMax = level === "easy" ? Math.max(c.tableDistanceMin, Math.min(c.tableDistanceMax, c.easyTableMax)) : c.tableDistanceMax
  return {
    tableDistanceMin: c.tableDistanceMin,
    tableDistanceMax: tableMax,
    hazardDistanceMin: c.hazardDistanceMin,
    hazardDistanceMax: c.hazardDistanceMax,
    tableCountMin: c.tableCountMin,
    tableCountMax: c.tableCountMax,
    hazardCountMin: c.hazardCountMin,
    hazardCountMax: c.hazardCountMax,
    dangerMargin: c.dangerMargin,
    safeZoneMargin: c.safeZoneMargin,
    startClearRadius: c.startClearRadius,
    layoutSeed: c.layoutSeed
  }
}

/** Chance (0..1) of an aftershock after the main quake. */
export function aftershockChance(level: Level, c: DrillConfig): number {
  return level === "easy" ? 0 : level === "hard" ? 1 : Math.max(0, Math.min(1, c.normalAftershockChance))
}

/** Health drain factor. */
export function drainMultiplier(level: Level, c: DrillConfig): number {
  return level === "hard" ? c.hardDrainMultiplier : 1
}

/** False on Hard: no scan, labels, zones, markers, arrow or path until the reveal. */
export function guidesOn(level: Level): boolean {
  return level !== "hard"
}

/** True on Easy: the hazard labels are not hidden when the quake starts. */
export function labelsStayInQuake(level: Level): boolean {
  return level === "easy"
}

/** False on Easy: Easy keeps the quake calm, nothing falls (Slice 7D). */
export function fallsOn(level: Level): boolean {
  return level !== "easy"
}
