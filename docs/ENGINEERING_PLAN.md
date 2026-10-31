# Engineering Plan: Aftershock

Dates are in WIB (UTC+7). The build agent works in vertical slices: each slice ends with something visible in the preview, its own LEAF scenario, and a gate before the next slice starts.

## 1. Roles

| Role | Who | Owns |
|---|---|---|
| Learner / product owner | M. Faiq Febrian | Every product and look decision, slice checkpoint feedback, the demo video, all submission text |
| Orchestrator | Hermes agent `testaja` | Slice prompts, scope control, verifying every report against the files and the preview, git commits, this plan |
| Build agent | Claude Code session `aftershock-builder`: `claude-opus-5-5`, effort `xhigh`, CLAD plugin `ls-clad`, Lens Studio MCP | Scene, scripts, assets and LEAF tests inside `Assets/`, one slice at a time |

The build agent is a Claude Code session, not a Hermes bot, because the event requires the Lens to be built through the CLAD plugin and the Lens Studio MCP, and CLAD runs in Claude Code.

## 2. How a slice runs

1. **Orchestrator** sends the slice prompt (section 4) to the build agent from the project root:
   `claude -p --model claude-opus-5-5 --effort xhigh --name aftershock-builder ...` (later slices resume the same session).
2. **Build agent** reads `docs/IMPLEMENTATION_RULES.md` and the docs named in the slice, builds, runs its LEAF scenario, saves preview screenshots to `docs/review/slice-N/`, and ends with the report format from the rules.
3. **Orchestrator** verifies: files changed only where allowed, TypeScript compiles, the Lens Studio log has no new errors, LEAF result, screenshots match `DESIGN_BRIEF.md`, nothing outside the slice was added.
4. **Learner checkpoint** at the slices marked ✋: the learner opens Interactive Preview, tries the listed steps, and gives feedback. Feedback goes back to the build agent as design notes ("move the label 20 cm higher"), not code.
5. **Orchestrator** commits the slice (`slice N: ...`) and updates the status table (section 6).

A slice that fails its gate twice goes back to the learner with options, rather than being retried a third time.

## 3. Timeline

| Date (WIB) | Work | Gate |
|---|---|---|
| Tue 27 Oct | Slice 0: planning docs, local git repo, `.gitignore` | Docs agreed by the learner |
| Tue 27 – Wed 28 Oct | Slice 1: project check, LEAF, skeleton, safety panel ✋ | DC1 (first half) |
| Wed 28 Oct | Slice 2: room, hazard labels, safe-zone marker, briefing ✋ | DC1 |
| Thu 29 Oct, 23:00 | **Live Build Session** (Snap). Bring questions from Slices 1–2. | — |
| Thu 29 – Fri 30 Oct | Slice 3: quake (shake, rumble, banner, HUD, blink) ✋ | DC2 |
| Sat 31 Oct – Sun 1 Nov | Slice 4: safe zone + duck detection, staged instructions, arrow ✋ | DC3 |
| Mon 2 – Tue 3 Nov | Slice 5: health drain, game over, end of quake, score, Restart ✋ | DC4, DC5 |
| Tue 3 Nov | Slice 5P: procedural layout and danger zones ✋ | New layout on every start; danger zones drain health |
| Wed 4 Nov | Slice 5L: language picker and five languages ✋ | Picker works; all five languages render |
| Thu 5 Nov (morning) | Slice 6: full LEAF run, comfort pass, learner's "judge it" review ✋ | All DC pass |
| Thu 29 Oct – Wed 4 Nov | Slice 7A–7D: Brutal AR style, scan, floor path, edge warning, aftershock, levels, falling objects ✋ | DC1–DC10 pass |
| **Thu 5 Nov** | **Feature freeze: whole drill works end to end** | Full run, no errors |
| Fri 6 Nov, 00:00 | **Live Project Review** (Snap) | — |
| Fri 6 – Sat 7 Nov | Review fixes; stretch S1 (falling objects) only if every DC passes | No regressions |
| Sat 7 – Sun 8 Nov | Learner records the demo video (preview screen recording, under 3 min); repo made public after an audit | Video uploaded Public |
| Mon 9 Nov, 20:00 | **Internal target: submit** | Submitted |
| Tue 10 Nov, 05:00 | Deadline (Mon 9 Nov 22:00 UTC) | — |

## 4. Slices

Each slice lists its scope, the requirements it closes (PRD), and its gate. Nothing outside the scope is built in that slice.

### Slice 0: Foundation (orchestrator)
- Write `docs/` (this set). Initialize a local git repository with the GitHub noreply email. `.gitignore` excludes `Cache/`, `Workspaces/`, `PluginsUserPreferences/`, `*.lock`, the Lens Studio–managed MCP configs (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`, `.claude/settings.local.json`), and `spk_debug_key.pem`.
- Gate: the learner agrees with the docs; `git status` shows no secrets staged.

### Slice 1: Skeleton and safety reminder ✋
- Run `/lens-studio-router` in preflight mode, then `specs-project-init`: SPECS target, Perspective camera with DeviceTracking World, SIK prefab, Interactive Preview.
- **Measure first:** log the head (camera) world position and forward in the preview at start, and after pressing Q a few times. Record the numbers in the report; they set the floor and the duck baseline.
- Install LEAF (`specs-leaf-install-packages`), create `LeafIndex`.
- Create `DrillConfig.ts`, `Strings.ts`, `HeadPose.ts`, `DrillController.ts` (all six states, transitions stubbed), `SafetyPanel.ts` with the two reminder lines and the Continue button.
- Requirements: R1, R2, R14 (for these strings).
- LEAF: `DC1_SafetyThenRoom`, first half (reminder visible, Continue moves to `BRIEFING`).
- Learner checkpoint: the reminder reads well; Continue works with a click.

### Slice 2: The room ✋
- Furniture at the positions in `DESIGN_BRIEF.md` §6 (generated meshes or primitives), hazard labels, safe-zone marker, faint floor and wall outlines, briefing instruction.
- `SafeZone.ts` (containment test only; no gameplay yet).
- Requirements: R3, R4, R5.
- LEAF: `DC1_SafetyThenRoom`, complete.
- Learner checkpoint: walk around; does it feel like standing in the middle of a room? Are the labels readable and on the right objects?

### Slice 3: The quake ✋
- Random wait, `QuakeShaker.ts`, looping rumble (generated through `/build-sfx`), warning banner, HUD with health bar and timer (elapsed time, Q3), marker blink, quake duration 45–60 s, end of quake back to rest.
- Requirements: R6, R7, R8.
- LEAF: `DC2_QuakeStarts` (with `testMode`).
- Learner checkpoint: does the quake feel sudden? Is the shake strong enough without making text unreadable?

### Slice 4: Take cover ✋
- Duck detection (baseline at Continue, hysteresis), safe-zone containment wired to the controller, staged instructions, `OffscreenArrow.ts`, test override in `HeadPose.ts`.
- Requirements: R9, R10.
- LEAF: `DC3_ArrowAndTakeCover`.
- Learner checkpoint: walk under the table with WASD, duck with Q; turn away and find the arrow.

### Slice 5: Health, result, restart ✋
- Health drain once the user stands up after taking cover (Q5), penalty, game over with the reason, post-quake "come out" instruction, `ScoreCalculator.ts`, result panel with the breakdown, Restart back to the room (briefing) with a full reset (Q1); never taking cover scores 0 (Q6 default).
- Requirements: R11, R12, R13.
- LEAF: `DC4_StandUpDrainsAndGameOver`, `DC5_QuakeEndsScore`.
- Learner checkpoint: one successful drill and one game over; is the result screen clear?

### Slice 5P: Procedural layout and danger zones ✋ (learner request, 27 Oct)
- `LayoutGenerator.ts`: on every BRIEFING entry (first start and each Restart) place the table and the three hazards at new positions inside the virtual room: the table center 100–200 cm from the start position, nothing overlapping, nothing on the user's start spot, every hazard facing the room center with its label readable from the start position.
- Danger zones: a red `#FF5A4F` floor area around each hazard (default: the object's footprint grown by 60 cm toward the room, faint fill plus outline). `inDanger` = head XZ inside any of them.
- Health: while `QUAKE` and `inDanger`, health drains at `healthDrainPerSecond` (default) even before the user first took cover; this adds to the Slice 5 drain after first cover. Game over reason `over.why.danger` (new string, default "You stayed next to something that can fall").
- SafeZone, arrow, labels and LEAF scenarios read positions from the generated layout, never from hard-coded numbers.
- Requirements: R17.
- Check: three starts in a row give three different layouts; the table is always within 200 cm; standing next to the cabinet during the quake drains health.

### Slice 5L: Language selection ✋ (learner request, 27 Oct)
- A `LANGUAGE` state before `SAFETY` with a picker panel: five big UI Kit buttons (Bahasa Indonesia, English, Deutsch, 日本語, 简体中文).
- `Strings.ts` becomes five languages from `docs/STRINGS_I18N.md`; every panel shows the selected language on top and English below at 80% (English only when English is picked). Restart keeps the language.
- Fonts: subset Noto Sans JP and Noto Sans SC (OFL 1.1) to the characters in use; license files next to them; credit in README and `THIRD_PARTY_NOTICES.md`.
- Requirements: R16.
- Check: pick each language once and screenshot the safety panel and the HUD; no missing-glyph boxes; German lines fit their panels.
- Learner checkpoint: the picker is clear; the five languages read well.

### Slice 6: Prove and polish ✋
- Run all five scenarios together, report pass/fail per criterion. Fix only failures and the comfort checklist in `DESIGN_BRIEF.md` §7.
- Learner does the brief's "After the build: judge it" steps and marks each item "logic proven" or "feel unproven".
- Gate: every DC passes or has an explained manual check; the Logger is clean on a full drill.

### Slice 7: Immersion and variety ✋ (learner request, 29 Oct; ENGINEERING_PLAN 5j)
- 7A Brutal AR style, Syne/Manrope, numbered steps. 7B scan intro, floor path, edge warning. 7C aftershock, levels. 7D falling objects.
- Gate: DC1–DC10 pass in the LEAF auto-run; screenshots of each new element checked; Logger clean.

### Stretch S1: Falling objects (moved into Slice 7D, 29 Oct)
- Items on the shelf and the cabinet tip or fall during the quake, as animation, not physics, unless the learner asks otherwise.
- Must not break any DC scenario. Re-run all five after.

## 5. Definition of done (whole project)

- The five done criteria in `devpost/design-brief.md` pass in the preview.
- LEAF scenarios DC1–DC5 exist, are registered, and their results are reported.
- A full drill runs with no errors in the Logger.
- The repo is public with the Lens Studio project, `devpost/` and `docs/`, and no secrets.
- The demo video is public on YouTube and under 3 minutes.
- Every submission text is written by the learner.

## 5b. Learner decisions after Slice 2 (27 Oct)

1. Panels and the HUD sit 22 cm below eye level (`hudBelowEye`; the learner chose 20–25 cm) so the table stays in view while reading.
2. Label backings become light and semi-transparent, as DESIGN_BRIEF §5.1 asks (Slice 2 built them dark grey).
3. `eyeHeight` stays 160 cm; the safe-zone marker stays a rectangle.
4. Label offsets from Slice 2 (cabinet x −121, shelf x 127) accepted.

## 5c. Learner decisions after Slice 3 (27 Oct)

1. Hazard label text becomes dark orange `#D9480F` and bold, for contrast on the light backing.
2. The warning banner moves up 2 cm so it no longer overlaps the HUD panel.
3. Shake strength stays as built (learner: enough for now).
4. The rumble is audible (learner checked).
5. The banner hides after 2.5 s; it does not shrink into the HUD.

## 5d. Learner decisions after Slice 4 (27 Oct)

1. `duckDrop` 90 cm: the head must be under the table top to count as ducked.
2. The off-screen arrow ignores height: it shows only when the safe zone is outside the horizontal half-angle (to the side or behind).
3. The HUD backing becomes more opaque so room labels behind it no longer show through the text.
4. Hazard label color stays as built (reads salmon in the preview, readable).

## 5e. Learner request: procedural layout and danger zones (27 Oct)

- Every drill start and every Restart builds a new layout: the table (safe zone) and the cabinet, shelf and glass window get new positions.
- The table is always a few steps from the start position, at most 200 cm away (ShakeOut: do not run far).
- Each hazard gets a red floor area around it (danger zone). Standing in a danger zone during the quake drains health.
- Built as Slice 5P, after Slice 5 and before the language slice 5L.

## 5f. Fixes found by the learner after Slice 5 (28 Oct)

1. Bug: Restart captured the duck baseline from the current head height, so restarting while ducked made ducking impossible ("never took cover", no health drain). Fix: the baseline is always the room floor + `eyeHeight`, never the current head.
2. Restart places the room again from the wearer's current spot and heading (floor height unchanged), together with the new procedural layout.
3. The room stays visible behind the result and game-over panels (learner: 1a).
4. Health drain rule after 5P: drain while exposed after first cover (Q5) OR while inside a danger zone during the quake (from the quake start). One drain at a time, never doubled. Game-over reason: `over.why.danger` if the user was in a danger zone when health hit 0, else `over.why.stood`.

## 5j. Learner request: Slice 7, immersion and variety (29 Oct)

Chosen: 2A room scan, 2B floor path, 2C edge warning, 3A aftershock, 3B falling objects, 3D levels; style from uupm.cc/demo/creative-agency, relevant parts only. Values marked (default) are open to the learner's veto.
1. Style "Brutal AR" (mockup `docs/design/Aftershock Brutal AR.html`): thick light borders (0.4 cm at 110 cm), square corners, a hard offset plate (white, 1 cm down-right) behind panels, buttons and labels; yellow `#FFFF00` for the focused button, the active step and the floor path; red `#FF0000` for hazard labels, danger zones, banners and the edge pulse; green `#3DDC84` stays for the safe zone; no blue. Black from the reference becomes white (the display is additive). Panel backings keep the readability decisions already taken (HUD 60%, result 50% (5i-3), others 25%); the mockup's lighter panels are only a sketch.
2. Type: Syne ExtraBold uppercase for titles, banners, buttons and step names; Manrope SemiBold for English lines; Noto Sans JP/SC stay for ja/zh (Syne has no CJK). Both are SIL OFL 1.1, subset to the Lens strings, licence files beside them.
3. Instructions become three numbered steps 01 Go under the table, 02 Duck, 03 Hold on, all visible in the HUD; the active one is yellow, done ones are struck through (replaces the single-line instruction).
4. Scan intro (2A): after Continue, a light sweep crosses the room for about 3 s (default); each hazard gets corner brackets and its label appears in turn; a "Memindai ruangan 3/3 / Scanning room" chip counts them. It is a visual effect on the virtual room, not detection; the Devpost copy must say so.
5. Floor path (2B): yellow chevrons on the floor from the user to the table: faint in BRIEFING, bright and marching during QUAKE until the user is in the zone. Hidden on the hard level.
6. Edge warning (2C): a red vignette at the view edge pulses while health drains (standing after cover, or in a danger zone). Never covers the center.
7. Aftershock (3A): after POST_QUAKE, once the user has left the zone, an aftershock starts with chance by level (easy 0, normal 50%, hard 100%) (default), 2–6 s after leaving (default), lasting 10–20 s (default), at 60% of the main shake (default); banner "Gempa susulan! / Aftershock!"; the staged instructions run again; RESULT shows only after it. The score adds "time to cover in the aftershock" (scoring in TDD §7, to be written).
8. Falling objects (3B): during each quake, 1–3 random items (default) fall from the shelf and the cabinet top as animation (not physics), landing inside that hazard's danger zone. An item that lands within 40 cm (default) of the head costs 15 health (default) and shows "−15 Kamu kejatuhan barang / Something fell on you".
9. Levels (3D): a picker after the safety panel (three cards). Easy: labels stay through the quake, table within 150 cm, no aftershock. Normal: today's rules, aftershock 50%. Hard: no arrow or floor path, health drains 1.5× faster, aftershock always (default). Restart keeps the level.
10. New strings in five languages go into `docs/STRINGS_I18N.md` before Slice 7A.
12. Learner, 29 Oct after 7A (Syne is much wider than the old font): (a) the numbered steps stay in three columns, the step names in Manrope at 2 cm, the numbers in Syne above them; (b) long sentences (briefing, safety lines, result details, hazard and danger label body) use Manrope; Syne only for titles, buttons, numbers, the timer, banners and marquees; (c) the unused Hud inputs `alarmColor` and `trackColor` are removed.
13. Learner, 29 Oct after reviewing 7A in the preview ("looks strange"): the Brutal AR look is replaced by a soft UI following the relevant TypeUI UI Foundations (type scale by role, tabular numbers, action priority, palette roles, fewer borders, concentric radius, press/focus feedback, target size, status signals). Mockup: `docs/design/Aftershock Soft UI.html` (approved by the learner, 29 Oct; it replaces the Brutal AR mockup and items 1–3 above). Decisions: (a) rounded corners, no hard offset plates, thin light borders only where needed, see-through panels; (b) one font family, Manrope, with tabular numbers for timer and score; Syne is removed; Noto JP/SC stay for ja/zh; (c) one action color: green `#3DDC84` (primary button, hover/focus glow, active step, floor path); red stays for danger, white for text; (d) every screen shows ONE language, no English second line, except the language picker title; (e) kept from 7A: the numbered steps 01/02/03 in the HUD; dropped: the oversized score, the marquee strips, the solid red hazard-label backing (now a red dot + white text on the see-through panel, with a red "Zona bahaya" pill above).
14. Learner, 29 Oct: a fuller, slightly larger room. (a) Four new items: bed, chair, floor lamp, TV on a TV stand. (b) Bed = trap: it looks soft but is NOT a safe place; ducking on or beside it during the quake shows "Kasur bukan tempat berlindung" and does not count as cover (health keeps draining after cover, as today) (default: message only, no extra penalty). Chair = plain furniture, no rule. (c) Floor lamp and TV are hazards: label, red danger zone, drain rules like the cabinet (labels "Lampu bisa roboh", "TV bisa jatuh"). (d) Larger area: table 120–250 cm from the start spot (was 100–200), hazards and the other items 140–300 cm (was 120–240); the layout generator keeps no-overlap and the start-spot clearance. (e) Look: real 3D models generated through CLAD `/build-mesh` after the learner logs in to Lens Studio, for all items so the room looks consistent (default), real-scale, simple neutral style; the current boxes stay as fallback.
15. Learner, 29 Oct (procedural zones): (a) 1–2 sturdy tables per drill at random; taking cover under ANY table counts; the arrow and the floor path point to the nearest one. (b) 3–5 hazards per drill drawn at random from the five kinds (cabinet, shelf, glass, lamp, TV), no kind twice, each with its label and danger zone; the bed and the chair are always present (default). (c) Fair score: the speed points use the walking time to the NEAREST table from the start spot: time counted = tSafe − nearest distance ÷ 100 cm/s (default walking pace), floored at 0, then the TDD §7 speed curve as today. (d) A "find it yourself" mode with no red or green zone colors: no danger-zone floors, no safe-zone marker, no hazard labels, no arrow, no floor path; the user must recognize what is safe and dangerous; the result screen then reveals each item as safe or dangerous. Default: this is the Hard level (replaces Hard's old list), with an on/off preview of the reveal on the result screen.
16. Slice 7R (room), before 7B: 7R-1 3D models (CLAD /build-mesh, learner logged in 29 Oct) for table, cabinet, shelf, glass window, bed, chair, floor lamp, TV on stand, as prefabs at real scale; 7R-2 code: item sets, 1–2 tables, 3–5 hazards, bed trap, larger area, nearest-table guidance, score allowance; LEAF DC1–DC7 keep passing, new DC8 bed trap and DC9 two tables.
17. Reconciliation (Hermes, 29 Oct, after items 13–16; vetoable): (a) Order: 7A-soft (done), 7R-1 models (done), 7R-2 room code, 7B, 7C, 7D, then a full audit. (b) Colors in items 4–6 follow the soft UI: the floor path and focus use the action green, not yellow; the edge warning stays red. (c) The Hard level IS the "find it yourself" mode of item 15d (no zone colors, labels, arrow or path; result reveals each item), plus 1.5× drain and aftershock always. Easy and Normal keep item 9. (d) The scan intro (item 4) brackets and labels every hazard present (3–5), counter "n/N". (e) Falling objects (item 8) fall from the shelf, the cabinet and the TV when present; with none of them present, nothing falls. (f) The TV screen uses a light grey material, not black, so it stays visible on the additive display. (g) LEAF numbering: DC8 bed trap, DC9 two tables, DC10 aftershock, DC11 levels incl. Hard reveal, DC12 falling-item hit.
18. Slice 7C detail (Hermes, 29 Oct; vetoable): Easy = tables 120–150 cm, labels stay through the quake, no aftershock. Normal = today's rules (tables 120–250 cm), aftershock 50%. Hard = find it yourself (§5j-15d/17c): no danger floors, safe markers, hazard labels, scan, arrow or path; drain 1.5×; aftershock always. Reveal on Hard: on RESULT and GAME_OVER the room's guides come back (red zones and labels on hazards, green markers on tables, warn.bed over the bed) behind the panel, and the panel adds the line `result.reveal`. Strings updated in STRINGS_I18N (level.normal.1, level.hard.1, result.reveal; DE/JA/ZH default). LEAF: DC11 aftershock, DC12 levels incl. Hard reveal.
19. Audit fixes (Hermes, 29 Oct, after a code review of Slice 7; vetoable): (a) Restart opens the level picker with the current level preselected (one pinch to keep it), so the level can be changed; language stays. (b) A falling item hits only when the head is inside a danger zone (never outside the red area), and a fall that empties health gives the reason text `hit.fell`. (c) The score is the main quake's only (tSafe, health and standing time are snapshotted when the main quake ends); during the aftershock health still drains and can end the drill: after a 5 s grace (aftershockGraceSeconds, default) not being safe drains, so ignoring the aftershock is never better than taking cover. (d) Hard: the HUD step leaves 01 only once the user is safe (inZone && ducked), so the step does not reveal the zone. (e) In BRIEFING the floor path follows the nearest table as the user walks. (f) resetForTest clears every test hook; HUD and result panel use drawOnTopWhenReady.
11. Order inside Slice 7: 7A style + type + numbered steps; 7B scan + floor path + edge warning; 7C aftershock + levels; 7D falling objects. LEAF: DC1–DC7 must keep passing; add DC8 aftershock, DC9 levels, DC10 falling item hit.

## 5i. Learner decisions after Slice 6B (28 Oct)

1. The "Zona bahaya / Danger zone" label sits just ABOVE its hazard label (was below, 5g), so the briefing panel and the HUD, which draw on top, no longer cover it.
2. Hazard labels (with their danger labels) hide when the quake starts and stay hidden through POST_QUAKE; they show again on the next BRIEFING. The red floor areas and the blinking safe-zone marker stay. The labels are for learning before the quake; during it the instructions lead.
4. Result / game-over text grows to the HUD scale: the title ("Latihan selesai" / "Nyawa habis") and the score line 3.5 cm, the explanation lines 2 cm, each English line at 80%. Long lines wrap; the panel may rise (smaller below-eye offset) so the whole panel, Restart included, stays inside the view with the head level. The 50% backing and the outline stay.
3. The result / game-over panel backing goes from 25% to 50% white, so its text reads over light furniture; the room still shows faintly behind it (5f-3).

## 5h. Learner decisions after Slice 5L (28 Oct)

1. Input guard: every newly shown panel (language picker, safety, briefing Continue, result/game-over Restart) ignores pinches for its first 0.5 s, so the pinch that closed the previous panel cannot press a button on the next one. Tunable `pinchGuardSeconds` = 0.5.
2. Language picker sits at eye level (not hudBelowEye) and its buttons are packed tighter (4 cm tall, smaller gaps), so all five buttons fit in view with the head level.
3. Panels and HUD always draw on top of the room: their text and backings ignore depth and render after the furniture, so a hazard placed in front of the user cannot cover them.

## 5g. Learner decision after Slice 5P (28 Oct)

1. The "Zona bahaya / Danger zone" label moves up next to its hazard label (just below it, same facing), so both read together from the start spot. The red floor area stays on the floor.

## 5a. Decisions taken by the orchestrator (open to the learner's veto)

Slice 1 questions the learner had not answered when Slice 2 started (27 Oct). The orchestrator kept the documented design:
1. Safety panel text sizes and light backing: kept as built.
2. Panels with buttons stay at 110 cm (DESIGN_BRIEF §6.1); buttons are pinched by ray. Moving them to 50–60 cm is a design change for the learner to request.
3. Two-line "Lanjut / Continue" button label: kept (Indonesian over English, as every string).
4. LEAF moves the head with `HeadPose.setOverride` (TDD §8); the learner's manual WASD/Q-E run remains the proof.
5. Tool-added packages AiPreviewAgentInspect / AiPreviewAgentInteract: kept until the build is done, removed before submission.
6. (Slice 4) The arrow aims at the safe-zone label point above the table top, not the floor center, so looking level at the table counts as "in view".
7. (Slice 4) The arrow stays out of the HUD panel: it is clamped to the view edge above or beside the HUD, never over the health and timer row.
8. (Slice 4) The arrow hides while the user is inside the safe zone (the brief: it shows only when the safe zone is out of view; under the table it is the user's own spot).
9. (Slice 5P) Danger zones grow by `dangerMargin` on all four sides (the virtual room has no walls, so every side faces the room).
10. (Slice 5P) The fixed floor outline is hidden, since the layout now reaches beyond it; the wall-edge bars move with the glass window.
11. (Slice 5P) The table may land at any bearing, including behind the user; the briefing instruction and the arrow guide them to it.
12. (Slice 5P) Lens Studio writes a `.gitattributes` that sends `Assets/**` and `Packages/**` to Git LFS. This repo keeps assets as plain git objects, so the file is excluded locally (`.git/info/exclude`) and neutralised in `.git/info/attributes`.
Also: Q6 (never took cover) uses its default, score 0. Without the LEAF runner plugin, scenarios are checked by hand and reported as such. Without Lens Studio sign-in, furniture uses primitives.

### 5k. Slice 8 decisions (learner, 29 Oct, after trying Slice 7: "the glass on its wall looks strange")

Chosen: G-A (window on a real virtual wall), polish P1 P2 P3 P4 P5 P7, features F1 F2 F3 F4 F5 F6 (F6 last, only if time is left). Values marked (default) are Hermes's and open to veto.

1. G-A + F1 walls: four virtual walls around the layout (axis-aligned in Room space: every footprint + 40 cm and the start spot inside; 400–700 cm per side (default)), 250 cm tall, light and semi-transparent (#E8EEF2 at about 25%, brighter top/bottom edge lines) (default). The window is a light-oak frame with a light-blue glass pane (the old box visuals, not the AI model with its wavy wall piece), 120 × 120 cm glass, bottom at 90 cm, mounted flush on a wall facing in. The leftover wall-edge bars go. One exit door (90 × 210 cm frame, label.door) on a wall with 120 cm clear in front, at least 100 cm from the glass and outside every danger zone (default).
2. P1: panel backings go from 50% to 75% (default), and the briefing and result panels turn up to ±8° (Hermes, 30 Oct: ±40° pushed panels off the ±16° Specs view) toward the direction with the least furniture behind them; the 75% backing does the rest.
3. P2: the TV screen gets a light grey face (#9AA3AD) so it shows on the additive display.
4. P3: during shaking, cabinet, shelf, lamp and TV wobble about their base (lamp most), the lamp shade flickers, and cracks spread over the window glass (default).
5. P4: falling items use CLAD models (a hardcover book, a small storage box) at real scale; a small dust puff on landing (default).
6. P5: original sounds synthesized by code: an opening chime (original, not the NHK or BMKG tone), item thud, glass crack, heartbeat below 30 health (default).
7. P7: duck practice: before the quake wait, "calib.title" until the user ducks once (then calib.done) or pinches btn.skip; every level.
8. F2 evacuation: after shaking (and any aftershock) stops and the user has left cover, state EVACUATE: walk to the door within 30 s, HUD step 04 "step.evac", instruction instr.evac; danger zones still drain; fallen items stay on the floor and stepping within 25 cm of one shows warn.trip and costs 10 health (default). Arrow and floor path to the door on Easy/Normal, none on Hard. Through the door → RESULT; 30 s → RESULT with result.evacFail.
9. F3 hold on: each table has grip handles at its front legs; holding = pinch held on a grip of the table you are under (mouse hold in the preview). Normal and Hard: after being safe, not holding for more than 3 s (default) keeps step 03 open (instr.grip) and drains 1 health/s (default). Easy: hint only, no drain.
10. Score stays 0–1000, rebalanced (learner): cover speed 450 (full at ≤5 s, 0 at ≥30 s, after the walk allowance) + health 300 (health × 3, main quake) + hold 100 (share of safe time spent holding, main quake) + evacuation 150 (reached: full at ≤10 s, 75 at 30 s; −25 per danger-zone entry or trip during the evacuation, floor 0) (default) − 10/s standing after first cover (main quake); clamped 0–1000. The result screen adds result.grip and result.evac or result.evacFail.
11. F4 education cards after the drill, chosen by what happened; content from BMKG/BNPB guidance with sources; the learner reviews the draft before it is built.
12. F5 personal best per level, kept on the device (Persistent Storage); result.best and result.newBest on the result screen.
13. F6 voice instructions: built as pre-made TTS clips, see §5l item 5.
14. Order: 8A walls + window + door + P1 + P2; 8B evacuation + hold on + score; 8C P3 + P4 + P5; 8D P7 + F5 + F4; then audit. LEAF: DC1–DC13 keep passing; new DC14 walls/door, DC15 evacuation, DC16 hold on + score, DC17 duck practice + best.

### 5l. Slice 9 decisions (learner, 30 Oct, from a preview screenshot: "why does the cabinet turn its back on the TV, and why do the cabinet and the TV drop books and boxes?")

1. Wall-backed furniture (fixes the first report). Cause: `placeAll` drew every hazard at a random bearing from the start spot and turned it to face the start spot (`yawFacingStart`), knowing nothing about the walls or about the other items' fronts, so two items could end up back to back in open floor. Fix: pick the room rectangle FIRST (each side 420–600 cm at random (default), the start spot inside with at least startClearRadius + 60 cm to every wall), then place `cabinet`, `shelf`, `tv`, `glass` and `bed` with their backs flat against a wall, facing into the room, at a random spot along a wall that keeps their distance range from the start spot; `lamp` and `chair` may stand free (a lamp beside a wall or a corner is preferred (default)); `table` and `table2` stay free so the user can reach under them from any side. Walls are then exactly that rectangle. Fallback stays the fixed layout.
2. Falling items (fixes the second report). Cause: §5j-8 (written from the feature list) named the shelf, the cabinet top and the TV as fall sources, so a closed wardrobe and a TV "dropped" books. Fix: only the shelf drops books and boxes (it visibly holds them). The cabinet drops nothing. The TV instead TOPPLES: once per shake (default), the TV model tips forward about its base over about 0.5 s and lies on the floor inside its danger zone; it counts as a hit by the same rule as a falling item (within fallHitRadius and not safe → −fallHitDamage, hit.fell) and stays down until the next BRIEFING. A toppled TV no longer topples again in the same drill.
3. Order: 9A layout + fall sources + TV topple, 9B education cards (F4, learner approved 30 Oct), then the Slice 8+9 audit. LEAF: DC1–DC17 keep passing; DC14 also checks that every wall-backed item is against a wall; new DC18 TV topple.
4. Slice 8–9 audit fixes (learner, 30 Oct, after a code review; built through CLAD only, the learner's rule from 30 Oct): (a) a grip release outside the collider still ends holding (SIK onTriggerEndOutside). (b) Never took cover → score 0, evacuation points too (Q6). (c) Cards: never took cover → card.stayUnder; card.fasten only when the user was hit, or as a second card; card.evac can be the first card. (d) The EVACUATE danger drain counts as having been in danger (cards). (e) The toppled TV's top lands inside its danger zone: the TV zone reaches 140 cm in front (default) and the hit point is where the top lands. (f) Game-over reasons follow the cause: hit.fell for a fall, a topple or a trip; over.why.grip for the grip drain (new string). (g) Duck practice needs the head above the duck line once before it counts. (h) Danger zones of wall-backed items grow only to the front and sides, never through the wall. (i) The LEAF kit saves and restores the stored bests instead of zeroing them. (j) Hard keeps the grip rule (learner: the user must find the table leg).
5. F6 voice instructions (learner, 30-31 Oct: "cara B", pre-made text-to-speech; voice C, calm; "Ada gempa. Tetap tenang."): 60 clips in Assets/Aftershock/Audio/Voice/<lang>/<key>.wav (keys: warn.quake, instr.goUnder, instr.duck, instr.grip, instr.hold, instr.comeOut, warn.aftershock, instr.evac, warn.trip, warn.bed, calib.title, calib.done; file name = key with "." → "_"). Credits and spoken text in docs/VOICE_CREDITS.md. Playback (default): a clip plays in the chosen language when that instruction or warning appears; a new clip stops the one playing; the same key is not repeated within 4 s; the rumble stays under the voice (voice volume 1.0, rumble ducked to 60% while a voice clip plays); voice on by default on every level, including Hard (it only says what the screen says); no clip on the language, safety, level and result screens. LEAF DC20.
6. Change language after a drill (learner, 31 Oct): the result and game-over panels get a second button "Ganti bahasa" next to Restart. Restart stays the green primary action; Ganti bahasa is a secondary button (no fill, soft outline, same size and radius). Ganti bahasa → the language picker → straight to the level picker (the safety screen is not shown again, since the user already read it this session); the language picker opened this way keeps the current language highlighted. No voice on these screens.
7. Glass breaks and a real-room layout (learner, 31 Oct, from preview screenshots: "can the glass really break?", "why is the bed next to the table", "the bed's rotation does not match the walls"):
   a. Glass breaks in the AFTERSHOCK: at the aftershock's first crack stage (stage 4) the pane disappears, shards (small light-blue flat pieces, 8–14, default) fall from the frame into the glass danger zone and stay on the floor until the next BRIEFING; a glass-break sound (synthesized by the orchestrator, `Assets/Aftershock/Audio/glass_break.wav`; until it exists reuse glass crack louder); if the head is inside the glass danger zone and not under a table at that moment: health −15 and "Kamu terkena pecahan kaca" (hit.glass, new string, all five languages). The frame stays. Shards count as floor items for the evacuation trip check (−10 once per shard group). No break without an aftershock.
   b. The bed's head end always stands against a wall (WALL_GAP); in a corner its long side may also touch the other wall. The other long side, if free, keeps a walkway of at least 60 cm (no footprint, no danger zone over it); every table stays at least 100 cm from the bed footprint. The bed's orientation must match its wall: verify against the model (the head end is the end with the headboard) and fix the yaw convention if the model's head is not where FOOTPRINTS says.
   c. The floor lamp is placed next to the bed's head end (beside it, within 30 cm of the head wall) in about 60% of layouts that have both (default), otherwise near a wall as today.
   d. The TV stands on a wall that faces the bed or the room center, never on the same wall as the bed and never beside it (at least 150 cm between the TV and bed footprints, default).
   e. The cabinet and shelf never stand in front of the window: no footprint within 80 cm (default) in front of the glass, and they are not placed on the glass wall closer than 30 cm to the window frame's sides.
   f. Tables and chairs are square to the walls (learner, 31 Oct, after the Slice 11 top views): yaw a multiple of 90° in Room space (each table picks the one of the four whose long side faces the start spot best); the chair also square, facing its table when near one. The arrow and floor path still lead to the nearest table. The free-standing lamp keeps a free yaw (it is round).

### 5m. Slice 12 design pass (learner, 31 Oct, from the lead-project design feedback DESIGN_FEEDBACK_2026-10-31.md; Design is a judged criterion). Every value below lives in DrillConfig.ts, every text in Strings.ts for all five languages. Verified "before" shots: docs/review/slice-12-design/before/.

1. Banner, option B (learner): the warning banner (warn.quake, warn.aftershock) stays in the center of view but is shorter, smaller and higher. warningShowSeconds 2.5 → 1.2; the banner narrower and its text one step smaller (WARN_W 40 → 30 cm, main line 9 → 6.5 cm em, default); it rises so it clears a 180 cm cabinet seen from the start spot (center warnRaiseCm, default 18 cm above eye level at hudDistance 110; its top edge stays inside ±16° of the view; checked against an after shot). The whole HUD panel (steps, health, timer) only appears AFTER the banner has gone (learner: "panel langkah baru muncul setelah banner hilang"); before, both showed at once. WARN_RAISE, WARN_FILL, WARN_W and the banner em sizes move from Hud.ts literals into DrillConfig.ts.
2. Notices during the quake (warn.bed, hit.fell, hit.glass, warn.trip) show INSIDE the HUD panel, replacing the step row for noticeSeconds (±2 s, default), with the health bar still visible; never as a second floating panel (learner). One panel at a time, as rule 5m-4.
3. Hazard labels (learner): one label with two lines — a ⚠ icon plus the hazard line in saturated red, extra bold ("Lemari bisa roboh"), and "Zona bahaya" smaller underneath, same facing (the separate danger pill is folded in). No font has U+26A0, so the ⚠ is drawn as geometry (a red rounded triangle with a white "!"). The hazard line uses Manrope at weight 800 (Assets/Aftershock/Fonts/Manrope-Aftershock-ExtraBold.ttf, made by the orchestrator, OFL) in id/en/de; ja/zh keep Noto. The label sits ABOVE the item (bottom labelGapCm, default 10, above its top; never over the wood; center at most labelMaxCenterCm, default 205, above the floor, else beside the item on the wall, e.g. the window); it stays upright while furniture wobbles or the TV topples. Its backing stays light, never dark (the SPECS display is additive): white at labelBackingAlpha (default 0.6). Its size follows distance: em = clamp(labelEmMinCm, labelEmPerMeterCm × head-to-label metres, labelEmMaxCm) (defaults 2.4 / 2.2 / 6.0 cm; about 1.3° of view), also for the safe-zone and door labels; LABEL_EM_CM and the dot size move into DrillConfig.ts.
4. Risotto during the quake (learner, replaces 5h-2's "labels hide in the quake" for Normal): when the quake starts, each hazard label shrinks to a small ⚠ icon; it grows back to the full two-line label while the head looks at it (within labelFocusDeg, default 10°) or stands closer than labelNearCm (default 150). Easy keeps the full labels through the quake; Hard still shows no labels at all. The red floor areas and the blinking safe-zone marker are unchanged.
5. Only one panel at a time: banner, notice (now inside the HUD), briefing, result and the education cards never overlap.
6. LEAF: new checks that the banner is gone before the HUD step panel appears, that a label's em grows with distance between its min and max, that no label backing is dark (alpha and colour), and that a notice does not add a second panel.
7. Feedback problem 3 ("prototype look") is mostly already done: every item has been a CLAD text-to-3D model since Slice 7R-1/7R-2 (the feedback looked at Slice 6 shots of primitive boxes). Remaining: one panel at a time (items 1, 2, 5) and the soft style on the new labels.
8. Label placement fix (Hermes, 31 Oct, after the first after-shots; vetoable): (a) the above/beside choice is made ONCE per drill (at the label's first measured frame, using labelEmMaxCm, the largest size), so a label never jumps between above and beside as the head walks and its em changes; (b) beside a tall item (cabinet, window) the label's center sits at labelBesideCenterCm (default 150, about eye level; never above the item's top) instead of the item's mid-height (about 97 cm for the cabinet), so it reads against the wall at eye level and stays clear of the HUD panel, which sits about 11° below eye level.
9. Banner follows the head's pitch (learner, 31 Oct, after the after-shots: looking down at the table at the quake start, the banner sat above the view): the warning banner is placed along the head's real forward (pitch included), warnAboveGazeDeg (default 8°) above the center of view at hudDistance, facing the head, and follows it while it shows; its pitch is clamped to warnPitchMinDeg..warnPitchMaxDeg (defaults −50° / +30°) so it never ends up on the floor or the ceiling. Looking level it still clears a 180 cm cabinet seen from the start spot (as 5m-1); the HUD panel (steps, health, timer) keeps its level lazy-follow and still appears only after the banner. warnRaiseCm is replaced by warnAboveGazeDeg.
10. Audit 10-12B fixes (learner 31 Oct: fix M1-M4; M4 option (a)). (M1) The window's hazard label gets the new design too: it is placed beside the window frame like other wall items (labelBesideCenterCm), turns to the head and collapses with risotto; the window frame/pane box is its model. (M2) A bedside lamp's danger zone must not cover the bed walkway (5l-7b): its zone is clipped on the bed side so it ends at the walkway strip's edge (default; footprint rule unchanged). (M3) The TV is never on any wall the bed touches: the head wall and, for a corner bed, the long-side wall (5l-7d). (M4) An instruction waiting for a warning clip no longer waits past the banner: when the banner hides (warningShowSeconds) the warning clip is cut and the waiting instruction plays at once. The Low audit items stay open (not asked).
11. Slice 13A HUD contrast (FEATURE_REQUEST_2026-10-31_ghost-hud Task A). Upcoming step numbers/names and the Nyawa/Waktu labels must read on the 60% white backing in front of a white cabinet and over a dark floor; contrast from text brightness/colour and a denser light step fill, never a dark backing or dark shadow (additive display). Hierarchy: active (green) > done > upcoming, all readable at hudDistance. STEP_DONE_ALPHA, STEP_FILL, STEP_ON_FILL, BAR_TRACK and the new HUD text colours move to DrillConfig (values picked from screenshots, default).
11a. Learner 31 Oct after the 13A shots: done steps must read more clearly (pale green on a thin green cell was weak in front of light wood). Done step text uses the brand green at full alpha with the existing outline; still light (no dark text, additive display), still below the active step (no border, lighter cell).
12. Slice 13B ghost replay (learner 31 Oct: 1b, 2a, 3 = 8 s). After a drill, a "Lihat ulang" button on the result panel (learner, 1b) replays the user's own path in the room: a floor trail with dots (learner, 2a), the inDanger stretches marked red, markers where items landed (onLanded), where the user was hit and where they took cover, and one explanatory line from Strings.ts in 5 languages. The replay plays in replaySeconds = 8 s whatever the drill length (learner, 3), can be skipped with a pinch, then returns to the result panel (Restart and Change language keep working). Data: HeadPose samples at a fixed DrillConfig interval during QUAKE..EVACUATE, the existing onLanded and inDanger; no second data source; nothing saved between sessions; no dark backing; one panel at a time. Restart clears the old trail. Sample interval, line width and marker sizes are DrillConfig tunables (default).

## 6. Status

| Slice | Status | Commit | LEAF | Learner checkpoint |
|---|---|---|---|---|
| 0 | done | 716d6e7 + Q1–Q5 update | — | Q1–Q5 answered 27 Oct (Q4 later) |
| 1 | built, awaiting learner check | d9f1b04 | DC1a registered; LEAF runner tools missing, checked by hand | pending |
| 2 | built, awaiting learner check | see log | DC1 checked by hand (pass) | pending |
| 3 | built, awaiting learner check | see log | DC2 checked by hand (pass; rumble audibility unconfirmed) | pending |
| 4 | built, 2 checks open | see log | DC3 checked by hand (arrow, duck, hold) | pending |
| 5 | built, awaiting learner check | see log | DC4, DC5 checked by hand (pass) | pending |
| 5P | built, checked by learner | see log | layouts, baseline fix, danger drain checked by hand | pending |
| 5L | built + fix, checked by learner 28 Oct | see log | DC7 (language kept, layouts differ) | done |
| 6 | 6A done (LEAF), 6B open | see log | DC1–DC7 auto-run: 7/7 passed (log 28 Oct) | 6B comfort + judge it |
