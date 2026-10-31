# Technical Design Document: Aftershock

> Updated 31 Oct 2026 to match the build at 5b4958e (Slices 8-12B).

Structure follows Microsoft's functional and technical design document pattern (https://learn.microsoft.com/en-us/dynamics365/guidance/patterns/create-functional-technical-design-document): agree on scope and design before development, then document components, data, integrations, configuration and testing. The functional side lives in `PRODUCT_REQUIREMENT_DOCUMENT.md` and `devpost/design-brief.md`; this file is the technical side.

> Values marked **(default)** are engineering placeholders, not learner decisions. The build agent uses them as written and never invents new ones; changes go through the orchestrator (`IMPLEMENTATION_RULES.md`).

## 1. Scope and references

| Document | Role |
|---|---|
| `devpost/design-brief.md` | Approved learner decisions. Highest authority. |
| `docs/PRODUCT_REQUIREMENT_DOCUMENT.md` | Requirements R1–R33, stretch S1–S2, questions Q1–Q6 |
| `docs/USER_FLOW_DIAGRAM.md` | States and transitions |
| `docs/DESIGN_BRIEF.md` | Look, placement, sizes, colors, type |
| `docs/ENGINEERING_PLAN.md` | Slices, gates, dates; learner decisions 5a–5m (the source for Slices 7–12B) |
| `docs/STRINGS_I18N.md`, `docs/EDUCATION_CARDS.md`, `docs/VOICE_CREDITS.md` | Strings in five languages, education cards and sources, voice clips and credits |
| `docs/IMPLEMENTATION_RULES.md` | What the build agent may and may not do |

## 2. Platform and environment

| Item | Value |
|---|---|
| Engine | Lens Studio 5.23.2 (do not upgrade: 5.24.1 breaks CLAD sign-in) |
| Target | SPECS, from the SPECS Base Template (`targetPlatform` Specs, preview shows `SPECS 27`) |
| Project root | `E:\Project\Aftershock\Aftershock.esproj\` (the `.esproj` file is `Aftershock.esproj.esproj`; leave the odd name) |
| Packages | SpectaclesInteractionKit, SpectaclesUIKit (installed); LEAF (`Leaf.lspkg`, installed in Slice 1 by `specs-leaf-install-packages`) |
| Language | TypeScript, components extend `BaseScriptComponent` |
| Units | World units are centimeters. Right-handed, +Y up, −Z forward. Runtime rotations in radians. |
| Build agent | Claude Code + `ls-clad` plugin + Lens Studio MCP (`lens-studio`, HTTP, per Lens Studio window) |
| Preview | Interactive Preview: WASD walk, Q/E down/up, right-drag look, click = pinch |

## 3. Architecture

One controller owns the drill state. Every other component is a small, single-purpose script the controller drives. Nothing reads another component's internals; components talk through the controller.

```
Scene
├── Camera (Perspective + DeviceTracking World)          ← from SPECS template, verified by specs-project-init
├── SpectaclesInteractionKit                             ← SIK prefab
├── AftershockRoot
│   ├── DrillController        (DrillController.ts)      ← state machine, the only owner of state; best score in Persistent Storage
│   ├── Room                   (QuakeShaker.ts)          ← everything that shakes; layout from LayoutGenerator.ts
│   │   ├── Table, Table2      + SafeZoneMarker (SafeZone.ts) + GripHandles (GripHandles.ts)
│   │   ├── Cabinet, Shelf, GlassWindow, Lamp, TV        + HazardLabel + DangerZone (3–5 present per drill)
│   │   ├── Bed, Chair                                   ← always present; the bed is a trap, not cover
│   │   ├── RoomWalls          (RoomWalls.ts)            ← four light walls + exit door
│   │   └── ShakeFx / FallingObjects                     ← wobble, lamp flicker, glass cracks and break; shelf books/boxes, dust
│   ├── Hud                    (Hud.ts)                  ← lazy-follow panel; does NOT shake
│   │   ├── WarningBanner (follows head pitch), Steps 01–04 / Notice, HealthBar, TimerText
│   ├── LanguagePanel, SafetyPanel, LevelPanel, CalibratePanel, BriefingPanel, ResultPanel (+ education cards)
│   ├── ScanIntro, FloorPath, EdgeWarning, OffscreenArrow
│   ├── VoiceGuide             (VoiceGuide.ts)           ← 60 pre-made voice clips
│   └── Audio                  rumble, chime, thud, glass crack, glass break, heartbeat
└── LeafIndex                  (LeafIndex.ts)            ← test scenarios DC1–DC23
```

Scripts live in `Assets/Scripts/Aftershock/`. Tests live in `Assets/Scripts/Aftershock/Tests/`.

### 3.1 Components

| Script | Responsibility | Inputs it reads | Outputs |
|---|---|---|---|
| `DrillConfig.ts` | All tunables as `@input` fields, defaults from §5 | — | Read by every component |
| `Strings.ts` | Every user-facing string in five languages (§6) | — | Read by panels |
| `HeadPose.ts` | Returns head world position and forward vector from the camera transform. Supports a **test override** (§8). | Camera transform | `position: vec3`, `forward: vec3` |
| `DrillController.ts` | State machine (§4), timers, health, score, wiring | HeadPose, SafeZone, DrillConfig | Calls show/hide on panels, starts/stops shake and audio |
| `SafeZone.ts` | `contains(position)`: head XZ inside the table footprint grown by a margin. Drives the marker look (steady / blinking). | Table transform, config | boolean |
| `DuckDetector` (inside `DrillController.ts` or its own file) | Ducked when head Y ≤ baseline − duckDrop; standing again when head Y > baseline − duckDrop + hysteresis | HeadPose, baseline captured at Continue | boolean |
| `QuakeShaker.ts` | Moves and tilts the `Room` node with layered sine noise while active; returns it exactly to rest when stopped | Config amplitude/frequency | Room transform |
| `Hud.ts` | Warning banner (follows the head's pitch, 5m-9), numbered steps 01–04, notices in the step row's place (5m-2), health bar, timer; lazy-follows the head at the HUD distance; the panel appears only after the banner (5m-1) | Controller calls | — |
| `SafetyPanel.ts` | Two reminder lines and one Continue button (UI Kit `Button`) | Strings | `onContinue` event |
| `ResultPanel.ts` | Title, score breakdown, personal best, education cards, Restart and Change language buttons | Controller calls | `onRestart`, `onChangeLanguage` events |
| `OffscreenArrow.ts` | Shows a small arrow near the view edge pointing toward the safe zone when the zone is outside the view cone; hides when inside | HeadPose, SafeZone position, config FOV | — |
| `ScoreCalculator.ts` | Pure function, no scene access (§7) | Times, health, hold share, evacuation, penalties | Score breakdown |
| `LayoutGenerator.ts` | Pure, seedable layout: room rectangle first, wall-backed items, tables, bed, lamp, chair, door; danger and safe zones (Slice 5P, 9A, 11) | Config, seed | Layout (items, room, door, glass wall) |
| `Levels.ts` | Pure level rules: table range, aftershock chance, drain factor, guides, falls, grip drain | Level, config | — |
| `EducationCards.ts` | Pure card picker (Slice 9B): at most 2 cards from the drill's facts | Card facts | Card keys |
| `LanguagePanel.ts`, `LevelPanel.ts`, `CalibratePanel.ts`, `BriefingPanel.ts` | Language picker, level picker, duck practice (Skip), briefing instruction | Strings | Pick / skip events |
| `RoomWalls.ts` | Four light walls (#E8EEF2 at 25%) on the layout's room rectangle, and the exit door with its label (Slice 8A) | Layout | — |
| `GripHandles.ts` | Two grip handles at each table's front legs; holding = pinch held on a handle of the table you are under (Slice 8B) | SIK | holding |
| `HazardLabel.ts`, `DangerZone.ts` | Labels with ⚠ and distance-scaled size, risotto collapse (5m-3, 5m-4); red floor areas | HeadPose, config | — |
| `ShakeFx.ts`, `FallingObjects.ts` | Wobble, lamp flicker, glass cracks (stages 1–4) and the glass break; books/boxes from the shelf with dust (Slice 8C, 9A, 11) | Controller calls | Landing points |
| `ScanIntro.ts`, `FloorPath.ts`, `EdgeWarning.ts`, `PanelAim.ts`, `UiBacking.ts` | Scan sweep, floor chevrons, red edge pulse, panel turn (0/±8°), soft-UI backings | — | — |
| `VoiceGuide.ts` | Plays the clip for an instruction or warning in the chosen language; no repeat within 4 s; rumble ducked to 60% (Slice 10) | Controller calls | — |

Buttons use UI Kit `Button` and subscribe via the element-level `onTriggerUp`, as the `specs-build-ui` skill prescribes, so LEAF and the mouse can press them.

## 4. State machine

| State | Enter | While in state | Exit to |
|---|---|---|---|
| `LANGUAGE` | Show the language picker (current language marked when reopened) | Wait for a pick | `SAFETY` on the first pick of the session; `LEVEL` once the safety panel was seen (Slice 10B) |
| `SAFETY` | Show SafetyPanel; hide room labels, HUD, arrow, result | Wait for Continue | `LEVEL` on Continue |
| `LEVEL` | Show the level picker (current level preselected) | Wait for a pick | `CALIBRATE` |
| `CALIBRATE` | Duck practice (Slice 8D): `calib.title` with Skip; room hidden | Head above the duck line once, then ducked for `calibHoldSeconds` → `calib.done` for `calibDoneSeconds` | `BRIEFING` (or at once on Skip) |
| `BRIEFING` | New layout, room, walls and door placed from the current spot; scan intro (`scanSeconds`), labels, safe-zone markers (steady), floor path, instruction R5; schedule quake after a random wait | — | `QUAKE` when the wait ends |
| `QUAKE` | Chime, start shake, loop rumble, show warning banner (1.2 s (default)), then the HUD (health 100, timer, steps); blink markers; labels collapse (Normal) or hide (Hard); pick duration 45–60 s | Each frame: `inZone`, `ducked`, grip, step (§4.1), health drain (§5), falls, TV topple, glass cracks, arrow, path | `GAME_OVER` if health ≤ 0; `POST_QUAKE` when duration ends |
| `POST_QUAKE` | Stop shake and rumble (Room back to rest), marker steady, show "shaking stopped, come out" (Q2) | Each frame: check `inZone` | When the head leaves the zone: `AFTERSHOCK` after 2–6 s if one is rolled (once per drill), else `EVACUATE` |
| `AFTERSHOCK` | Shake at 60% (default), `warn.aftershock` banner, steps run again; crack stage 4 breaks the glass (Slice 11) | As `QUAKE`; not being safe drains after `aftershockGraceSeconds` | `GAME_OVER` if health ≤ 0; `POST_QUAKE` when it ends |
| `EVACUATE` | Step 04 `step.evac`, `instr.evac`; arrow and path to the door (Easy, Normal) | Danger zones drain; a trip within 25 cm of a fallen item or shard group costs 10 health once | `RESULT` through the door or after 30 s (`result.evacFail`); `GAME_OVER` if health ≤ 0 |
| `RESULT` | Show score breakdown, best, cards, Restart and Change language | Wait for a button | `LEVEL` on Restart; `LANGUAGE` on Change language |
| `GAME_OVER` | Stop shake and rumble, show what went wrong, cards, Restart and Change language | Wait for a button | `LEVEL` on Restart; `LANGUAGE` on Change language |

Restart and Change language reset everything (health, timers, `tSafe`, `hasBeenSafe`, score, penalties, aftershock, falls, shaker phase, voice, panels, arrow); the stored bests stay. Restart opens the level picker (5j-19a, replacing Q1's "straight to the room"); `BRIEFING` builds a new layout from the wearer's current spot. The duck baseline is always the room floor + `eyeHeight` (5f-1). The safety reminder shows once per session (Slice 10B).

### 4.1 Instruction stages during `QUAKE`

| Condition | Instruction (string key) |
|---|---|
| not `inZone` | `instr.goUnder` |
| `inZone` and not `ducked` | `instr.duck` |
| `inZone` and `ducked` | `instr.hold`, or `instr.grip` once safe without holding the table leg for more than `gripGraceSeconds` (Slice 8B) |

Stages follow the user's current state, so standing up again shows `instr.duck` again. The HUD shows them as steps 01 Go under the table, 02 Duck, 03 Hold on, plus 04 Get out in `EVACUATE`. On Hard the step leaves 01 only once the user is safe (5j-19d).

## 5. Tunables (`DrillConfig.ts`)

| Field | Value | Source |
|---|---|---|
| `quakeDurationMin` / `Max` | 45 / 60 s | Brief |
| `quakeWaitMin` / `Max` | 8 / 15 s | (default) |
| `warningShowSeconds` | 1.2 s (was 2.5); the HUD panel appears after it | Learner (5m-1, banner B); value (default) |
| `warnAboveGazeDeg`, `warnPitchMinDeg` / `MaxDeg` | 8° above the gaze; pitch clamped −50° / +30° | Learner (5m-9); values (default) |
| `warnWidthCm`, `warnEmCm` | 30 cm, 6.5 cm | (default), 5m-1 |
| `duckDrop` | 90 cm below baseline, so the head is under the 75 cm table top (baseline 160 → ducked at ≤ 70 cm) | Learner (27 Oct; was 40) |
| `duckHysteresis` | 10 cm | (default) |
| `safeZoneMargin` | 15 cm around the table footprint | (default) |
| `safeHoldSeconds` | 1 s | (default) |
| `healthStart` | 100 | (default) |
| `healthDrainPerSecond` | 4 per second while exposed | (default) |
| `shakeAmplitudeCm` / `shakeTiltDeg` | 2.5 cm position, 1.2° tilt | (default) |
| `shakeFrequencyMinHz` / `MaxHz` | 2–6 Hz, layered | (default) |
| `fovHalfAngleHorizontal` / `Vertical` | 16° / 18.5° (SPECS view about 32° × 37°) | Pack rules |
| `hudDistance` | 110 cm | Pack rules + UI Kit default |
| `hudBelowEye` | 22 cm below eye level, for every panel and the HUD, so the table stays in view while reading | Learner (27 Oct: 20–25 cm) |
| `resultBelowEye` | 10 cm | 5i-4 |
| `pinchGuardSeconds` | 0.5 s | 5h-1 |
| `eyeHeight` | 160 cm: the floor sits this far below the head's start height. The preview gives no floor height (Slice 2). | Learner (27 Oct) |
| `tableDistanceMin` / `Max` | 120 / 250 cm from the start spot to the table center (Easy: max `easyTableMax` 150) | Learner (5j-14d) |
| `hazardDistanceMin` / `Max` | 140 / 300 cm from the start spot | Learner (5j-14d) |
| `tableCountMin` / `Max`, `hazardCountMin` / `Max` | 1–2 tables, 3–5 hazards | Learner (5j-15); counts (default) |
| `dangerMargin` | 60 cm: the danger zone is the hazard footprint grown by this much (front and sides only for a wall-backed hazard) | (default), 5l-4h |
| `tvDangerFront` | 140 cm in front of the TV (where its top lands when it topples) | (default), 5l-4e |
| `startClearRadius` | 50 cm: no danger zone or furniture inside this radius of the start spot | (default) |
| `layoutSeed` | 0 = new random layout every start and Restart; any other number = the same layout every time (for filming) | (default) |
| `walkSpeed` | 100 cm/s: nearest-table distance ÷ this is forgiven from `tSafe` | (default), 5j-15c |
| `bedWarnMargin` / `bedWarnSeconds` | 30 cm / 2.5 s | (default) |
| `scanSeconds` | 3 s | (default) |
| `normalAftershockChance` / `hardDrainMultiplier` | 0.5 / 1.5× | (default) |
| `aftershockDelayMin` / `Max`, `aftershockDurationMin` / `Max`, `aftershockStrength`, `aftershockGraceSeconds` | 2–6 s, 10–20 s, 0.6, 5 s | (default) |
| `fallCountMin` / `Max`, `fallHitRadius`, `fallHitDamage` | 1–3 items per shake (shelf only), 40 cm, 15 health | (default) |
| `evacSeconds`, `tripRadius`, `tripDamage` | 30 s, 25 cm, 10 health | (default), 5k-8 |
| `gripGraceSeconds`, `gripDrainPerSecond` | 3 s, 1 per second (Normal and Hard) | (default), 5k-9 |
| `calibHoldSeconds`, `calibDoneSeconds` | 0.4 s, 1.2 s | (default) |
| `labelGapCm`, `labelMaxCenterCm`, `labelBesideCenterCm` | 10, 205, 150 cm | (default), 5m-3, 5m-8 |
| `labelEmMinCm` / `labelEmPerMeterCm` / `labelEmMaxCm` | 2.4 / 2.2 per m / 6.0 cm | (default), 5m-3 |
| `labelBackingAlpha` | 0.6 (white) | (default), 5m-3 |
| `labelFocusDeg` / `labelNearCm` | 10° / 150 cm (risotto, Normal) | (default), 5m-4 |
| `timerMode` | Elapsed time since the quake started | Learner (Q3) |
| `testMode` | false; when true: wait 1 s, duration 8 s (and short scan, aftershock, evacuation and grip grace) | Test hook (§8) |

"Exposed" = during `QUAKE`, `hasBeenSafe` is true, and not (`inZone` and `ducked`). `hasBeenSafe` turns true the first time `inZone` and `ducked` hold for 1 s, the same moment that sets `tSafe`. Learner decision Q5: walking to the table the first time never drains health; only standing up or leaving after taking cover does. Other drains (one at a time, never doubled; 5f-4): a danger zone during `QUAKE`, `AFTERSHOCK` and `EVACUATE`; not holding the grip (Normal, Hard); not safe in the aftershock after its grace. One-off hits: a falling item or the toppled TV (−15), the breaking glass (−15), a trip (−10).

## 6. Strings (`Strings.ts`)

> From Slice 5L the strings come in five languages (id, en, de, ja, zh) from `docs/STRINGS_I18N.md` (now the source; this table is the original Slice 1–5P set and keeps its old "id / en" format), and a `LANGUAGE` state with a five-button picker comes before `SAFETY`. Every screen shows ONE language (5j-13d), except the picker title. Restart keeps the chosen language and opens `LEVEL`; Change language opens `LANGUAGE`. Fonts: Manrope (SemiBold, and ExtraBold for the hazard line, 5m-3) for id/en/de; subset Noto Sans JP / SC (OFL) for ja/zh. Keys added since Slice 5P include `label.lamp`, `label.tv`, `label.door`, `warn.bed`, `step.*` (incl. `step.evac`), `instr.evac`, `instr.grip`, `warn.trip`, `warn.aftershock`, `hit.fell`, `hit.glass`, `over.why.grip`, `result.grip`, `result.evac`, `result.evacFail`, `result.best`, `result.newBest`, `result.reveal`, `calib.title`, `calib.done`, `btn.skip`, `btn.changeLang`, `level.*`, `card.*`.

Format: `"Indonesian / English"`, Indonesian first, as in the brief. Strings quoted from the brief are fixed; others are (default) until the learner rewords them (PRD Q4).

| Key | Text | Source |
|---|---|---|
| `safety.drill` | Ini latihan, bukan peringatan gempa sungguhan / This is a drill, not a real earthquake alert | Brief |
| `safety.room` | Pastikan ruanganmu aman untuk bergerak / Make sure your room is safe to move in | Brief |
| `btn.continue` | Lanjut / Continue | (default) |
| `instr.brief` | Kenali benda berbahaya dan ingat letak safe zone / Know the hazards and remember the safe zone | Brief |
| `warn.quake` | GEMPA! / EARTHQUAKE! | Brief |
| `instr.goUnder` | Pergi ke bawah meja / Go under the table | Brief |
| `instr.duck` | Merunduk / Duck down | Brief |
| `instr.hold` | Tahan sampai guncangan berhenti / Hold until the shaking stops | Brief |
| `instr.comeOut` | Guncangan berhenti. Keluar dari bawah meja / The shaking stopped. Come out from under the table | Learner (Q2); wording (default) |
| `label.cabinet` | Lemari bisa roboh / Cabinet can fall | (default) |
| `label.shelf` | Barang di rak bisa jatuh / Shelf items can fall | (default) |
| `label.glass` | Kaca bisa pecah / Glass can shatter | (default) |
| `label.safe` | Safe zone: bawah meja / Safe zone: under the table | (default) |
| `hud.health` | Nyawa / Health | (default) |
| `hud.time` | Waktu / Time | (default) |
| `result.title` | Latihan selesai / Drill complete | (default) |
| `result.speed` | Kecepatan berlindung / Time to take cover: {s} s | (default) |
| `result.health` | Sisa nyawa / Health left: {h} | (default) |
| `result.score` | Skor / Score: {score} | (default) |
| `over.title` | Nyawa habis / Out of health | (default) |
| `result.never` | Kamu tidak berlindung di bawah meja / You never took cover under the table | (default), Q6 |
| `over.why.stood` | Kamu berdiri sebelum guncangan berhenti / You stood up before the shaking stopped | (default) |
| `btn.restart` | Ulangi / Restart | (default) |
| `over.why.danger` | Kamu berdiri di dekat benda yang bisa jatuh / You stayed next to something that can fall | (default), Slice 5P |
| `label.danger` | Zona bahaya / Danger zone | (default), Slice 5P |

## 7. Score (`ScoreCalculator.ts`)

Brief: score combines speed of reaching the safe zone and ducking with the health left at the end. Rebalanced in Slice 8B (learner, 5k-10; evacuation details (default)):

```
tSafe       = seconds from quake start until inZone && ducked first held for 1 s (null if never)
speedTime   = max(0, tSafe - nearestTableDistance / walkSpeed)                    // fair score, 5j-15c
speedPoints = tSafe == null ? 0 : round(450 * clamp((30 - speedTime) / 25, 0, 1))  // ≤5 s → 450, ≥30 s → 0
healthPts   = tSafe == null ? 0 : round(3 * healthLeft)                            // 0–300
holdPts     = tSafe == null ? 0 : round(100 * holdShare)                           // share of safe time holding the grip
evacPts     = tSafe != null && reached ? max(0, round(150 - 75 * clamp((evacSeconds - 10) / 20, 0, 1)) - 25 * events) : 0
                                                                                   // events = danger-zone entries + trips in EVACUATE
penalty     = round(10 * secondsStandingAfterFirstSafe)                            // "skor berkurang"
score       = clamp(speedPoints + healthPts + holdPts + evacPts - penalty, 0, 1000)
```

tSafe, health, hold share and standing time are the main quake's (snapshotted when it ends, 5j-19c); the aftershock still drains health and can end the drill. The result panel shows each part (`result.speed`, `result.health`, `result.grip`, `result.evac` or `result.evacFail`, `result.aftershock`, `result.level`, `result.best`/`result.newBest`), so the user sees why. Game over shows no score, only what went wrong (`over.why.stood`, `over.why.danger`, `over.why.grip`, `hit.fell`, `hit.glass`). A user who never takes cover scores 0, evacuation points included, with `result.never` (learner, 5l-4b). The best score per level is kept in Persistent Storage (Slice 8D).

### 7.1 Education cards (`EducationCards.ts`, Slice 9B)

At RESULT and GAME_OVER, at most 2 cards: the first matching card in table order (`card.stayUnder`, `card.falling`, `card.bed`, `card.fasten`, `card.evac`, `card.check`) that may lead (`card.fasten` leads only after a hit: a fall, the TV topple, broken glass or a trip), then a second only if it is `card.fasten` or `card.check`; `card.coast` when nothing else applies (a perfect drill: score ≥ 900 with no problems). Texts and sources: `EDUCATION_CARDS.md`.

## 8. Test hooks

LEAF drives SIK hands and buttons. It cannot press WASD or Q/E. So:

1. `HeadPose.setOverride(position, forward)` / `clearOverride()` lets a scenario place the head (inside the zone, ducked, turned away). Production code never calls it.
2. `DrillConfig.testMode` shortens the wait and the quake so a scenario finishes in seconds. Scenarios set it and restore it.
3. `DrillController` exposes read-only getters (`state`, `health`, `instructionKey`, `arrowVisible`, `lastScore`, and later `lastCards`, `glassHits`, the TV topple state and more) for assertions, and test-only setters (`setLevelForTest`, `forceAftershockForTest`, `forceFallForTest`, `forceTvToppleForTest`, `forceLayoutForTest`, `disableFallsForTest`, `setBestForTest`, grip `setHoldingForTest`); `resetForTest` clears them. The LEAF kit saves and restores the stored bests (5l-4i).

Hooks must not change behavior when unused. The learner's manual preview run (WASD/Q/E) is the real proof of criteria 3–4; LEAF proves the logic.

## 9. Test plan (LEAF)

One scenario per done criterion, named `DC1_…` to `DC5_…`, plus DC6–DC23 for the later slices, registered in `LeafIndex.ts`. Last auto-run at 5b4958e: 23/23 passed (commit message).

| Scenario | Drives | Asserts |
|---|---|---|
| `DC1_SafetyThenRoom` | Read state; pinch Continue | State `SAFETY` with both reminder strings; after Continue: `BRIEFING`, four furniture objects enabled, three hazard labels and the safe marker visible, instruction `instr.brief` |
| `DC2_QuakeStarts` | testMode; Continue; wait | State `QUAKE`; Room transform differs from rest; rumble playing; banner text `warn.quake`; marker blinking; health 100 and timer visible |
| `DC3_ArrowAndTakeCover` | Override head facing away, then into zone standing, then ducked | Arrow visible when facing away, hidden when facing the zone; instruction goes `goUnder` → `duck` → `hold`; controller reports safe |
| `DC4_StandUpDrainsAndGameOver` | Safe, then override standing; wait | Health decreases relative to the value before standing; penalty grows; at health 0 state `GAME_OVER` with `over.why.stood`; pinch Restart → `BRIEFING` |
| `DC5_QuakeEndsScore` | Safe until the quake ends; then override outside the zone | `POST_QUAKE` with `instr.comeOut`; after leaving: `RESULT` with a score equal to `ScoreCalculator` for the recorded inputs; Restart visible |

| `DC6_DangerZoneDrains` | testMode; head pinned in the cabinet danger zone, no cover | Health falls relative to before; at 0 `GAME_OVER` with `over.why.danger` |
| `DC7_LanguagesAndRestart` | Pick ja; run a drill; Restart twice | Safety screen in ja; Restart opens `LEVEL` in ja (5j-19a); each Restart gives a different layout |
| `DC8_BedTrap` | Duck on the bed in the quake | `warn.bed`; never counts as cover |
| `DC9_TwoTables` | Two tables | Arrow to the nearer; cover under either counts; walk allowance in the score |
| `DC10_ScanPathEdge` | Briefing, quake, stand up after cover | Scan n/N, faint then bright floor path, red edge warning |
| `DC11_Aftershock` | Normal, aftershock forced | Quiet wait, `AFTERSHOCK` with `warn.aftershock`, its cover time on the result |
| `DC12_Levels` | Easy, Hard | Hard: no guides, drain ×1.5, reveal; Restart preselects the level; Easy table range |
| `DC13_FallingObjects` | Forced falls | Hit only inside the danger zone and not safe; `hit.fell` |
| `DC14_WallsAndDoor` | Layouts | Four walls, glass on a wall, door clear of zones, wall-backed items on a wall, room rules (Slice 11) |
| `DC15_Evacuation` | Leave cover after the last shake | `EVACUATE` to the door, one trip −10, `RESULT` with evac time; timeout → `result.evacFail`, 0 evac points |
| `DC16_HoldOn` | Safe without holding, then holding | `instr.grip`, about 1/s drain, release ends the hold; parts add up; Easy no drain |
| `DC17_CalibrateAndBest` | `LEVEL` → `CALIBRATE` | Duck or Skip → `BRIEFING`; best kept, `result.newBest` |
| `DC18_TvTopple` | Head where the TV top lands | Hit once (`hit.fell`), topples once per drill |
| `DC19_EducationCards` | Card facts | Card rules (§7.1), live `lastCards` |
| `DC20_VoiceGuide` | Normal drill in id | Clips follow the screen; rumble at 60% while speaking; silent on RESULT |
| `DC21_ChangeLanguage` | Change language on RESULT and GAME_OVER | Picker with current marked → `LEVEL` (never `SAFETY`) in the new language |
| `DC22_GlassBreak` | Normal, aftershock forced, glass present | Whole through the quake, breaks at aftershock stage 4: 8–14 shards in the zone; `hit.glass` −15 |
| `DC23_DesignPass` | Quake and aftershock start, labels | Banner then HUD, notice inside the HUD, label em follows distance, light backings, risotto on Normal, banner pitch (12B) |

Run: enable `LeafAutoRun` (AftershockScenarioClient), refresh the preview, read `PASSED`/`FAILED` and `[SUCCESS]` from the Lens Studio log, disable it again. The LeafPlugin panel is not installed, so this auto-run is the runner. `DrillController.resetForTest()` is the only extra test hook.

Use relative assertions for numbers (value before vs after), as the LEAF skill requires. Every scene-object name used in a test must exist in the scene (checked by the agent before writing the test).

## 10. Performance and comfort budget

- No per-frame allocation in `UpdateEvent` handlers; reuse vectors.
- Shake moves one parent node; no physics anywhere: falling items, the TV topple and glass shards are scripted animation.
- One looping rumble clip (LowPower mode is fine for ambient sound), a heartbeat loop below 30 health, one-shot chime, thud, glass crack and glass break; voice clips on their own AudioComponent at volume 1.0 with the rumble ducked to 60%.
- Text and UI are light-colored (the display is additive; black is transparent).

## 11. Assets

- Furniture: real-scale 3D models generated through CLAD (`/build-mesh`, Slice 7R-1: table, cabinet, shelf, bed, chair, floor lamp, TV on stand; book and storage box for falls), boxes as fallback; the window is a light-oak frame with a light-blue pane (Slice 8A). No third-party models, logos or brands.
- Rumble: generated through CLAD (`/build-sfx`). Chime, thud, glass crack, heartbeat and glass break are original sounds synthesized by code (Slice 8C, 11). No third-party audio.
- Voice: 60 clips (12 keys × 5 languages) made with open text-to-speech models; credits in `VOICE_CREDITS.md` (Slice 10).
- Fonts: Manrope SemiBold and ExtraBold, Noto Sans JP / SC subsets (all SIL OFL 1.1).
- Icons (arrow, warning): through `/icon-selector` (Material icons) or a simple mesh.
- Every generated asset is listed in the slice report.

## 12. Risks

| Risk | Mitigation |
|---|---|
| The preview's starting head height is unknown, so the floor and the duck baseline could be wrong | Slice 1 measures the head position in the preview first and places the floor from it; the duck baseline is captured at Continue, not hard-coded |
| LEAF cannot move the head | Test override (§8) plus the learner's manual run |
| Lens Studio MCP disconnects (it lives per window) | Keep Lens Studio open; the agent stops and reports instead of working around it with raw HTTP |
| Shake makes text unreadable | HUD and panels are outside `Room` and never shake |
| Real-glasses feel (ducking, walking with a headset) | Labeled "feel unproven" in the video and the write-up |
