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
| Wed 4 Nov | Slice 6: full LEAF run, comfort pass, learner's "judge it" review ✋ | All DC pass |
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

### Slice 6: Prove and polish ✋
- Run all five scenarios together, report pass/fail per criterion. Fix only failures and the comfort checklist in `DESIGN_BRIEF.md` §7.
- Learner does the brief's "After the build: judge it" steps and marks each item "logic proven" or "feel unproven".
- Gate: every DC passes or has an explained manual check; the Logger is clean on a full drill.

### Stretch S1: Falling objects (only after the 5 Nov gate passes)
- Items on the shelf and the cabinet tip or fall during the quake, as animation, not physics, unless the learner asks otherwise.
- Must not break any DC scenario. Re-run all five after.

## 5. Definition of done (whole project)

- The five done criteria in `devpost/design-brief.md` pass in the preview.
- LEAF scenarios DC1–DC5 exist, are registered, and their results are reported.
- A full drill runs with no errors in the Logger.
- The repo is public with the Lens Studio project, `devpost/` and `docs/`, and no secrets.
- The demo video is public on YouTube and under 3 minutes.
- Every submission text is written by the learner.

## 5a. Decisions taken by the orchestrator (open to the learner's veto)

Slice 1 questions the learner had not answered when Slice 2 started (27 Oct). The orchestrator kept the documented design:
1. Safety panel text sizes and light backing: kept as built.
2. Panels with buttons stay at 110 cm (DESIGN_BRIEF §6.1); buttons are pinched by ray. Moving them to 50–60 cm is a design change for the learner to request.
3. Two-line "Lanjut / Continue" button label: kept (Indonesian over English, as every string).
4. LEAF moves the head with `HeadPose.setOverride` (TDD §8); the learner's manual WASD/Q-E run remains the proof.
5. Tool-added packages AiPreviewAgentInspect / AiPreviewAgentInteract: kept until the build is done, removed before submission.
Also: Q6 (never took cover) uses its default, score 0. Without the LEAF runner plugin, scenarios are checked by hand and reported as such. Without Lens Studio sign-in, furniture uses primitives.

## 6. Status

| Slice | Status | Commit | LEAF | Learner checkpoint |
|---|---|---|---|---|
| 0 | done | 716d6e7 + Q1–Q5 update | — | Q1–Q5 answered 27 Oct (Q4 later) |
| 1 | built, awaiting learner check | d9f1b04 | DC1a registered; LEAF runner tools missing, checked by hand | pending |
| 2 | built, awaiting learner check | see log | DC1 checked by hand (pass) | pending |
| 3 | not started | — | — | — |
| 4 | not started | — | — | — |
| 5 | not started | — | — | — |
| 6 | not started | — | — | — |
