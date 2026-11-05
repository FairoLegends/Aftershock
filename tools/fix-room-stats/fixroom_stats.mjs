// Fix-the-room counts over fixed seeds, computed with the Lens's OWN pure modules (LayoutGenerator.ts, DrillPlan.ts,
// Levels.ts), bundled unchanged by esbuild, so nothing is re-implemented. Every config number is read from
// DrillConfig.ts, FALL_SOURCES from FallingObjects.ts and FIXABLE from DrillController.ts.
//
// It counts the way DrillController does:
// - items fall only from FALL_SOURCES that are among the layout's hazards (scheduleFalls), via planFalls;
// - the TV topples once per drill when it is a hazard and not fastened (canTopple); the quake always reaches its
//   topple time (25-75 % of the shake), and the topple counts as "landed" (landTv -> onItemLanded);
// - the aftershock shake happens when plan.aftershock.happensU < aftershockChance(level).
// This is a property of the quake plan (how many objects fall), not of a player (how often someone is hit).
//
// Run from the repo root (Node 18+, esbuild via npx):
//   node tools/fix-room-stats/fixroom_stats.mjs                 -> Normal, seeds 1..30, table + totals
//   node tools/fix-room-stats/fixroom_stats.mjs hard 1 30       -> another level or seed range
//   node tools/fix-room-stats/fixroom_stats.mjs check <layoutSeed> <planSeed>   -> one drill, as JSON
// Check against a real drill: `check 208930688 1066210688` (the demo take) gives 5 landed, 1 with the shelf
// fastened, as the Lens log for that take (`landed 5 -> 1 (4 of 5 prevented)`).
import {execFileSync} from "node:child_process"
import {mkdirSync, readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath, pathToFileURL} from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "..", "Assets", "Scripts", "Aftershock")
const OUT = join(HERE, "build")
mkdirSync(OUT, {recursive: true})
const npx = process.platform === "win32" ? "npx.cmd" : "npx"
for (const m of ["LayoutGenerator", "DrillPlan", "Levels"]) {
  const args = ["--yes", "esbuild@0.24.0", join(SRC, `${m}.ts`), "--bundle", "--format=esm", "--platform=node",
    `--outfile=${join(OUT, `${m}.js`)}`, "--log-level=warning"]
  // Windows runs npx.cmd through the shell, so quote each argument (paths can hold spaces)
  if (process.platform === "win32") execFileSync([npx, ...args.map((s) => `"${s}"`)].join(" "), {stdio: "inherit", shell: true})
  else execFileSync(npx, args, {stdio: "inherit"})
}
const load = (m) => import(pathToFileURL(join(OUT, `${m}.js`)).href)
const {generateLayout} = await load("LayoutGenerator")
const {makePlan, planFalls, QUAKE_SHAKE, AFTERSHOCK_SHAKE, between} = await load("DrillPlan")
const {layoutParamsFor, aftershockChance, fallsOn} = await load("Levels")

const cfgText = readFileSync(join(SRC, "DrillConfig.ts"), "utf8")
const num = (name) => {
  const m = cfgText.match(new RegExp(`^\\s+${name}\\s*:\\s*number\\s*=\\s*(-?[0-9.]+)`, "m"))
  if (!m) throw new Error(`DrillConfig: ${name} not found`)
  return Number(m[1])
}
const KEYS = ["tableDistanceMin", "tableDistanceMax", "hazardDistanceMin", "hazardDistanceMax", "tableCountMin", "tableCountMax",
  "hazardCountMin", "hazardCountMax", "dangerMargin", "tvDangerFront", "safeZoneMargin", "startClearRadius", "easyTableMax",
  "normalAftershockChance", "fallCountMin", "fallCountMax", "fallMarginSeconds", "quakeDurationMin", "quakeDurationMax",
  "aftershockDurationMin", "aftershockDurationMax", "layoutSeed", "planSeed"]
const config = Object.fromEntries(KEYS.map((k) => [k, num(k)]))
const fallSources = JSON.parse(readFileSync(join(SRC, "FallingObjects.ts"), "utf8").match(/FALL_SOURCES: FallSource\[\] = (\[[^\]]*\])/)[1])
const FIXABLE = JSON.parse(readFileSync(join(SRC, "DrillController.ts"), "utf8").match(/export const FIXABLE = (\[[^\]]*\])/)[1])
const constOf = (file, name) => {
  const t = readFileSync(join(SRC, file), "utf8")
  const m = t.match(new RegExp(`const ${name} = ([0-9]+)`))
  if (!m) throw new Error(`${file}: ${name} not found`)
  return Number(m[1])
}
const SHAKE_PHASES = constOf("QuakeShaker.ts", "AXES") * constOf("QuakeShaker.ts", "LAYERS")
const SHARDS_MAX = constOf("ShakeFx.ts", "SHARDS_MAX")
const ranges = {fallsMax: Math.max(0, Math.round(Math.max(config.fallCountMin, config.fallCountMax))), phases: SHAKE_PHASES, shardsMax: SHARDS_MAX}

function measure(level, layoutSeed, planSeed) {
  const layout = generateLayout({...layoutParamsFor(level, config), layoutSeed})
  const plan = makePlan(planSeed, ranges)
  const hazards = layout.hazards
  const sources = fallSources.filter((s) => layout.items[s] && hazards.indexOf(s) >= 0).map((s) => ({source: s}))
  const aftershock = plan.aftershock.happensU < aftershockChance(level, config)
  const quakeDur = between(plan.quakeDurationU, config.quakeDurationMin, config.quakeDurationMax)
  const afterDur = between(plan.aftershock.durationU, config.aftershockDurationMin, config.aftershockDurationMax)
  const count = (fastened) => {
    if (!fallsOn(level)) return {shelf: 0, tv: 0, total: 0}
    let shelf = planFalls(plan.shakes[QUAKE_SHAKE], quakeDur, sources, fastened, config).falls.length
    if (aftershock) shelf += planFalls(plan.shakes[AFTERSHOCK_SHAKE], afterDur, sources, fastened, config).falls.length
    const tv = layout.items.tv && hazards.indexOf("tv") >= 0 && fastened.indexOf("tv") < 0 ? 1 : 0
    return {shelf, tv, total: shelf + tv}
  }
  const fixableHere = FIXABLE.filter((h) => hazards.indexOf(h) >= 0)
  return {layoutSeed, planSeed, hazards, fallback: layout.fallback, aftershock, base: count([]), shelfOnly: count(["shelf"]), allFix: count(fixableHere)}
}

const [a, b, c] = process.argv.slice(2)
if (a === "check") {
  console.log(JSON.stringify(measure("normal", Number(b), Number(c))))
} else {
  const level = a || "normal"
  const from = Number(b || 1), to = Number(c || 30)
  const rows = []
  for (let s = from; s <= to; s++) rows.push(measure(level, s, s))
  const yn = (v) => (v ? "yes" : "no")
  console.log(`Level ${level}, seeds ${from}..${to} (each seed as layoutSeed and planSeed)\n`)
  console.log("| Seed | Shelf | TV | Aftershock | No fix | Shelf fastened | All fixable fastened |")
  console.log("|---|---|---|---|---|---|---|")
  for (const r of rows) {
    console.log(`| ${r.layoutSeed} | ${yn(r.hazards.includes("shelf"))} | ${yn(r.hazards.includes("tv"))} | ${yn(r.aftershock)} | ${r.base.total} | ${r.shelfOnly.total} | ${r.allFix.total} |`)
  }
  const sum = (f) => rows.reduce((n, r) => n + f(r), 0)
  const base = sum((r) => r.base.total)
  console.log(`\nfalls without a fix: ${base} (shelf ${sum((r) => r.base.shelf)}, TV ${sum((r) => r.base.tv)})`)
  console.log(`shelf fastened: ${base - sum((r) => r.shelfOnly.total)} of ${base} prevented`)
  console.log(`every fixable item fastened: ${base - sum((r) => r.allFix.total)} of ${base} prevented`)
  console.log(`rooms with a shelf ${sum((r) => (r.hazards.includes("shelf") ? 1 : 0))}, with a TV ${sum((r) => (r.hazards.includes("tv") ? 1 : 0))}, with an aftershock ${sum((r) => (r.aftershock ? 1 : 0))}, fallback layouts ${sum((r) => (r.fallback ? 1 : 0))}`)
}
