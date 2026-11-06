import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PlaneBox, SecondResult} from "../ResultPanel"
import {computeScore} from "../ScoreCalculator"
import {getLanguage, getString, Lang, lines, setLanguage, StringKey} from "../Strings"
import {getController} from "./DrillTestKit"

const LANGS: Lang[] = ["en", "id", "de"]
const MAX_W_CM = 34 // plan 17: the first result's backing
const MAX_H_CM = 46
const SECOND_MAX_W_CM = 34 // Slice 18 (plan 19a): the second result as wide as the first
const SECOND_MAX_H_CM = 63 // Slice 18 (plan 19a): en and id
const SECOND_MAX_H_DE_CM = 70 // plan 19 a2: German may reach 70 cm (68.7 before Slice 18)
const DETAIL_ROWS = 3 // speed, health, grip
const LAYOUT_MS = 300 // the flex lays out on a later frame
const SPLIT = /^(.*?)\s*[:：]\s*(.+)$/ // as the panel splits a row into label and value
const BUTTON_KEYS: StringKey[] = ["btn.replay", "btn.fixRoom", "btn.changeLang", "btn.restart"]
const CARDS: StringKey[] = ["card.falling", "card.fasten"]

// DC31 (Slice 17, ENGINEERING_PLAN 17): the first result is compact. In en,
// id and de, a first result shown straight on the panel (two cards and a best
// row passed) has a backing at most MAX_W_CM x MAX_H_CM, three detail rows,
// one card, no best row and every button label; a second result keeps its
// compare rows and checklist. Slice 18 (ENGINEERING_PLAN 19a): the second
// result, in en, id and de, is at most SECOND_MAX_W_CM x SECOND_MAX_H_CM
// (Slice 18b, 19 a2: in de at most SECOND_MAX_H_DE_CM tall).
// Runs no drill.
@component
export class DC31_CompactResult extends Scenario {
  async run(): Promise<void> {
    const c = getController()
    const p = c.resultPanel
    const prevLang = getLanguage()
    const prevFix = p.fixRoomShown
    const b = computeScore(10, 80, 0, 0, 0.5, {reached: true, seconds: 20, events: 0}) // as DC23
    const sizes: string[] = []
    try {
      p.setFixShown(true) // both button rows full
      for (const lang of LANGS) {
        setLanguage(lang)
        p.setComparison(null)
        const best = lines("result.best", {"{score}": "500"})
        p.showResult(b, [{text: best, split: true}], CARDS)
        await sleep(LAYOUT_MS)
        const box = p.backingBox
        sizes.push(`${lang} ${size(box)}`)
        expect(width(box) <= MAX_W_CM).toBe(true)
        expect(height(box) <= MAX_H_CM).toBe(true)
        expect(p.shownDetailRows).toBe(DETAIL_ROWS)
        expect(p.shownCards.length).toBe(1)
        const texts = p.texts
        const m = SPLIT.exec(best.primary)
        expect(texts.indexOf(best.primary) >= 0).toBe(false)
        if (m) expect(texts.indexOf(m[1]) >= 0).toBe(false) // a split row shows its label alone
        for (const key of BUTTON_KEYS) {
          expect(texts.indexOf(lines(key).primary) >= 0).toBe(true)
        }
      }

      // The second result, as DC23 shows it. Slice 18 (plan 19a): in each language,
      // as wide as the first, with its compare rows and checklist.
      const seconds: string[] = []
      for (const lang of LANGS) {
        setLanguage(lang)
        const second: SecondResult = {
          headline: lines("compare.prevented", {"{n}": "1", "{m}": "2"}),
          because: lines("compare.because", {"{items}": getString("item.shelf")}),
          prevented: 1,
          of: 2,
          compare: [
            {text: lines("compare.fell", {"{a}": "2", "{b}": "1"}), before: "2", after: "1", better: true},
            {text: lines("compare.hit", {"{a}": "0", "{b}": "0"}), before: "0", after: "0", better: false},
            {text: lines("compare.score", {"{a}": "500", "{b}": "600"}), before: "500", after: "600", better: true}
          ],
          title: lines("repair.title"),
          rows: [
            {text: lines("repair.shelf"), reason: lines("repair.tried"), checked: true},
            {text: lines("repair.tv"), reason: lines("repair.problem"), checked: false},
            {text: lines("repair.heavyLow"), reason: null, checked: false}
          ],
          source: lines("repair.source")
        }
        p.setComparison(second)
        p.showResult(b, [], [])
        await sleep(LAYOUT_MS)
        const box = p.backingBox
        seconds.push(`${lang} ${size(box)}`)
        expect(JSON.stringify(p.compareLines)).toBe(JSON.stringify(second.compare.map((r) => r.text.primary)))
        expect(JSON.stringify(p.repairLines)).toBe(JSON.stringify([second.title.primary].concat(second.rows.map((r) => r.text.primary), [second.source.primary])))
        expect(width(box) <= SECOND_MAX_W_CM).toBe(true) // Slice 18 (plan 19a): was width(box) > the first's
        expect(height(box) <= (lang === "de" ? SECOND_MAX_H_DE_CM : SECOND_MAX_H_CM)).toBe(true) // Slice 18b (plan 19 a2)
      }
      console.log(`[Aftershock] DC31: first result ${sizes.join(", ")} cm; second result ${seconds.join(", ")} cm`)
    } finally {
      setLanguage(prevLang)
      p.setFixShown(prevFix)
      p.setComparison(null)
      p.hide()
    }
  }
}

function width(b: PlaneBox): number {
  return b.maxX - b.minX
}

function height(b: PlaneBox): number {
  return b.maxY - b.minY
}

function size(b: PlaneBox): string {
  return `${width(b).toFixed(1)}x${height(b).toFixed(1)}`
}
