# Technical Design Document: Aftershock

Structure follows Microsoft's functional and technical design document pattern (https://learn.microsoft.com/en-us/dynamics365/guidance/patterns/create-functional-technical-design-document): agree on scope and design before development, then document components, data, integrations, configuration and testing. The functional side lives in `PRODUCT_REQUIREMENT_DOCUMENT.md` and `devpost/design-brief.md`; this file is the technical side.

> Values marked **(default)** are engineering placeholders, not learner decisions. The build agent uses them as written and never invents new ones; changes go through the orchestrator (`IMPLEMENTATION_RULES.md`).

## 1. Scope and references

| Document | Role |
|---|---|
| `devpost/design-brief.md` | Approved learner decisions. Highest authority. |
| `docs/PRODUCT_REQUIREMENT_DOCUMENT.md` | Requirements R1–R15, stretch S1–S2, questions Q1–Q6 |
| `docs/USER_FLOW_DIAGRAM.md` | States and transitions |
| `docs/DESIGN_BRIEF.md` | Look, placement, sizes, colors, type |
| `docs/ENGINEERING_PLAN.md` | Slices, gates, dates |
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
│   ├── DrillController        (DrillController.ts)      ← state machine, the only owner of state
│   ├── Room                   (QuakeShaker.ts)          ← everything that shakes
│   │   ├── Table              + SafeZoneMarker (SafeZone.ts)
│   │   ├── Cabinet            + HazardLabel
│   │   ├── Shelf              + HazardLabel
│   │   └── GlassWindow        + HazardLabel
│   ├── Hud                    (Hud.ts)                  ← lazy-follow panel; does NOT shake
│   │   ├── WarningBanner, InstructionText, HealthBar, TimerText
│   ├── SafetyPanel            (SafetyPanel.ts)          ← reminder + Continue button
│   ├── ResultPanel            (ResultPanel.ts)          ← score / game-over + Restart button
│   ├── OffscreenArrow         (OffscreenArrow.ts)
│   └── RumbleAudio            (AudioComponent)
└── LeafIndex                  (LeafIndex.ts)            ← test scenarios, attached in Slice 1
```

Scripts live in `Assets/Scripts/Aftershock/`. Tests live in `Assets/Scripts/Aftershock/Tests/`.

### 3.1 Components

| Script | Responsibility | Inputs it reads | Outputs |
|---|---|---|---|
| `DrillConfig.ts` | All tunables as `@input` fields, defaults from §5 | — | Read by every component |
| `Strings.ts` | Every user-facing string, bilingual (§6) | — | Read by panels |
| `HeadPose.ts` | Returns head world position and forward vector from the camera transform. Supports a **test override** (§8). | Camera transform | `position: vec3`, `forward: vec3` |
| `DrillController.ts` | State machine (§4), timers, health, score, wiring | HeadPose, SafeZone, DrillConfig | Calls show/hide on panels, starts/stops shake and audio |
| `SafeZone.ts` | `contains(position)`: head XZ inside the table footprint grown by a margin. Drives the marker look (steady / blinking). | Table transform, config | boolean |
| `DuckDetector` (inside `DrillController.ts` or its own file) | Ducked when head Y ≤ baseline − duckDrop; standing again when head Y > baseline − duckDrop + hysteresis | HeadPose, baseline captured at Continue | boolean |
| `QuakeShaker.ts` | Moves and tilts the `Room` node with layered sine noise while active; returns it exactly to rest when stopped | Config amplitude/frequency | Room transform |
| `Hud.ts` | Warning banner, instruction line, health bar, timer; lazy-follows the head at the HUD distance | Controller calls | — |
| `SafetyPanel.ts` | Two reminder lines and one Continue button (UI Kit `Button`) | Strings | `onContinue` event |
| `ResultPanel.ts` | Title, explanation lines, score, Restart button | Controller calls | `onRestart` event |
| `OffscreenArrow.ts` | Shows a small arrow near the view edge pointing toward the safe zone when the zone is outside the view cone; hides when inside | HeadPose, SafeZone position, config FOV | — |
| `ScoreCalculator.ts` | Pure function, no scene access (§7) | Times, health, penalties | Score breakdown |

Buttons use UI Kit `Button` and subscribe via the element-level `onTriggerUp`, as the `specs-build-ui` skill prescribes, so LEAF and the mouse can press them.

## 4. State machine

| State | Enter | While in state | Exit to |
|---|---|---|---|
| `SAFETY` | Show SafetyPanel; hide room labels, HUD, arrow, result | Wait for Continue | `BRIEFING` on Continue |
| `BRIEFING` | Capture head **baseline** height; show Room labels, safe-zone marker (steady), instruction R5; schedule quake after a random wait | — | `QUAKE` when the wait ends |
| `QUAKE` | Start shake, loop rumble, show warning banner (2.5 s (default)), blink marker, show health bar + timer (health 100), instruction "Go under the table"; pick duration 45–60 s | Each frame: update `inZone`, `ducked`, instruction stage (§4.1), health drain (§5), arrow | `GAME_OVER` if health ≤ 0; `POST_QUAKE` when duration ends |
| `POST_QUAKE` | Stop shake and rumble (Room back to rest), marker steady, show "shaking stopped, come out" (Q2) | Each frame: check `inZone` | `RESULT` when the head leaves the zone (immediately if already outside) |
| `RESULT` | Show score breakdown and Restart | Wait for Restart | `BRIEFING` on Restart (Q1) |
| `GAME_OVER` | Stop shake and rumble, show what went wrong and Restart | Wait for Restart | `BRIEFING` on Restart (Q1) |

Restart resets everything (health, timers, `tSafe`, `hasBeenSafe`, score, penalties, shaker phase, panels, arrow) and enters `BRIEFING`, which captures a fresh duck baseline. The safety reminder shows only when the Lens opens (Q1).

### 4.1 Instruction stages during `QUAKE`

| Condition | Instruction (string key) |
|---|---|
| not `inZone` | `instr.goUnder` |
| `inZone` and not `ducked` | `instr.duck` |
| `inZone` and `ducked` | `instr.hold` |

Stages follow the user's current state, so standing up again shows `instr.duck` again.

## 5. Tunables (`DrillConfig.ts`)

| Field | Value | Source |
|---|---|---|
| `quakeDurationMin` / `Max` | 45 / 60 s | Brief |
| `quakeWaitMin` / `Max` | 8 / 15 s | (default) |
| `warningShowSeconds` | 2.5 s | (default) |
| `duckDrop` | 40 cm below baseline | (default) |
| `duckHysteresis` | 10 cm | (default) |
| `safeZoneMargin` | 15 cm around the table footprint | (default) |
| `healthStart` | 100 | (default) |
| `healthDrainPerSecond` | 4 per second while exposed | (default) |
| `shakeAmplitudeCm` | 2.5 cm position, 1.2° tilt | (default) |
| `shakeFrequencyHz` | 2–6 Hz, layered | (default) |
| `fovHalfAngleHorizontal` / `Vertical` | 16° / 18.5° (SPECS view about 32° × 37°) | Pack rules |
| `hudDistance` | 110 cm, 10 cm below eye level | Pack rules + UI Kit default |
| `timerMode` | Elapsed time since the quake started | Learner (Q3) |
| `testMode` | false; when true: wait 1 s, duration 8 s | Test hook (§8) |

"Exposed" = during `QUAKE`, `hasBeenSafe` is true, and not (`inZone` and `ducked`). `hasBeenSafe` turns true the first time `inZone` and `ducked` hold for 1 s, the same moment that sets `tSafe`. Learner decision Q5: walking to the table the first time never drains health; only standing up or leaving after taking cover does.

## 6. Strings (`Strings.ts`)

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

## 7. Score (`ScoreCalculator.ts`)

Brief: score combines speed of reaching the safe zone and ducking with the health left at the end. Formula (default):

```
tSafe       = seconds from quake start until inZone && ducked first held for 1 s (null if never)
speedPoints = tSafe == null ? 0 : round(600 * clamp((30 - tSafe) / 25, 0, 1))   // ≤5 s → 600, ≥30 s → 0
healthPts   = tSafe == null ? 0 : round(4 * healthLeft)                          // 0–400; none without taking cover (Q6 default)
penalty     = round(10 * secondsStandingAfterFirstSafe)                          // "skor berkurang"
score       = clamp(speedPoints + healthPts - penalty, 0, 1000)
```

The result panel shows each part, so the user sees why. Game over shows no score, only what went wrong (`over.why.stood`). Because of Q5, game over can only happen after the user took cover once. A user who never takes cover reaches the result screen with score 0 and `result.never` (Q6 default).

## 8. Test hooks

LEAF drives SIK hands and buttons. It cannot press WASD or Q/E. So:

1. `HeadPose.setOverride(position, forward)` / `clearOverride()` lets a scenario place the head (inside the zone, ducked, turned away). Production code never calls it.
2. `DrillConfig.testMode` shortens the wait and the quake so a scenario finishes in seconds. Scenarios set it and restore it.
3. `DrillController` exposes read-only getters (`state`, `health`, `instructionKey`, `arrowVisible`, `lastScore`) for assertions.

Hooks must not change behavior when unused. The learner's manual preview run (WASD/Q/E) is the real proof of criteria 3–4; LEAF proves the logic.

## 9. Test plan (LEAF)

One scenario per done criterion, named `DC1_…` to `DC5_…`, registered in `LeafIndex.ts`.

| Scenario | Drives | Asserts |
|---|---|---|
| `DC1_SafetyThenRoom` | Read state; pinch Continue | State `SAFETY` with both reminder strings; after Continue: `BRIEFING`, four furniture objects enabled, three hazard labels and the safe marker visible, instruction `instr.brief` |
| `DC2_QuakeStarts` | testMode; Continue; wait | State `QUAKE`; Room transform differs from rest; rumble playing; banner text `warn.quake`; marker blinking; health 100 and timer visible |
| `DC3_ArrowAndTakeCover` | Override head facing away, then into zone standing, then ducked | Arrow visible when facing away, hidden when facing the zone; instruction goes `goUnder` → `duck` → `hold`; controller reports safe |
| `DC4_StandUpDrainsAndGameOver` | Safe, then override standing; wait | Health decreases relative to the value before standing; penalty grows; at health 0 state `GAME_OVER` with `over.why.stood`; pinch Restart → `BRIEFING` |
| `DC5_QuakeEndsScore` | Safe until the quake ends; then override outside the zone | `POST_QUAKE` with `instr.comeOut`; after leaving: `RESULT` with a score equal to `ScoreCalculator` for the recorded inputs; Restart visible |

Use relative assertions for numbers (value before vs after), as the LEAF skill requires. Every scene-object name used in a test must exist in the scene (checked by the agent before writing the test).

## 10. Performance and comfort budget

- No per-frame allocation in `UpdateEvent` handlers; reuse vectors.
- Shake moves one parent node; no physics in the core drill (physics only for stretch S1).
- One looping rumble clip (LowPower mode is fine for ambient sound); Continue/Restart clicks LowLatency if a click sound is added.
- Text and UI are light-colored (the display is additive; black is transparent).

## 11. Assets

- Furniture: simple real-scale meshes generated through CLAD (`/build-mesh`) or primitives. No third-party models, logos or brands.
- Rumble: generated through CLAD (`/build-sfx`). No third-party audio.
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
