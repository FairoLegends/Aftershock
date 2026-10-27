# Implementation Rules: Aftershock

These rules bind the build agent (`aftershock-builder`, Claude Code with CLAD). Read this file at the start of every slice. If a rule and an instruction conflict, follow the rule and say so in the report.

## 1. Order of authority

1. `devpost/design-brief.md`: the learner's approved decisions.
2. `docs/PRODUCT_REQUIREMENT_DOCUMENT.md`: requirements R1–R15, stretch S1–S2, questions Q1–Q5.
3. `docs/TECHNICAL_DESIGN_DOCUMENT.md` and `docs/DESIGN_BRIEF.md`: how to build it and how it looks.
4. `docs/USER_FLOW_DIAGRAM.md`: the states and transitions.
5. `docs/ENGINEERING_PLAN.md`: which slice you are in.
6. The slice prompt from the orchestrator.

The Lens Studio–managed `AGENTS.md` and the `ls-clad` skills govern **how** to use Lens Studio. These docs govern **what** to build.

## 2. Scope

1. Build only the current slice. Do not start the next one, even if it looks easy.
2. Do not add features, screens, sounds, text, effects or options that are not in the docs. If something seems missing, list it under "Questions" in the report and stop there.
3. Values marked **(default)** are used exactly as written. Do not invent new values. If a default does not work in practice (unreadable text, a wrong height), keep the default, report the problem with numbers and a screenshot, and propose a value.
4. Stretch goals S1 and S2 are off until the orchestrator turns them on in writing.
5. Never edit `devpost/` (the learner's files) or `docs/` (except adding screenshots under `docs/review/`). Changes to the plan go through the orchestrator.

## 3. Lens Studio and CLAD

1. Use CLAD: start with `/lens-studio-router`, build with the `ls-clad` skills and the `specs-experience-builder` workflow. Load `ls-clad:editor-api` before any `ExecuteEditorCode`.
2. Talk to Lens Studio only through the Lens Studio MCP tools. Never use `curl`, `fetch`, `wget` or raw HTTP to the MCP server. If MCP is unreachable, stop and report it.
3. Lens Studio stays at **5.23.2**. Do not install, upgrade or switch versions, and do not open another project.
4. Do not reopen, rename or move the project. Its odd name (`Aftershock.esproj/Aftershock.esproj.esproj`) stays.
5. Write only inside `Assets/` (scripts in `Assets/Scripts/Aftershock/`, tests in `Assets/Scripts/Aftershock/Tests/`) and `docs/review/`. Never modify `Cache/`, `Support/`, `Packages/` contents by hand, `.esproj`, or any MCP config.
6. Packages: SIK, UI Kit and LEAF only. Ask before adding any other package.
7. Before using an unfamiliar Lens API, check `Support/StudioLib.d.ts`; the d.ts wins over memory.

## 4. Code

1. TypeScript, one component per file, every component extends `BaseScriptComponent`.
2. `DrillController` is the only owner of drill state. Other components expose methods and events; they never change each other directly.
3. All user-facing text comes from `Strings.ts`. All tunables come from `DrillConfig.ts`. No literals for either anywhere else.
4. Units are centimeters. Comment any value that is in another unit.
5. No per-frame allocation in update handlers.
6. Test hooks (`HeadPose` override, `testMode`, read-only getters) must not change behavior when unused.
7. No network access, AI remote services, voice, camera frames, recording, or anything that identifies people.

## 5. Assets

1. Generate meshes, sounds and icons through the CLAD skills (`/build-mesh`, `/build-sfx`, `/icon-selector`) or use primitives.
2. No third-party models, textures, fonts, music or sounds, and no brand names or logos in the scene.
3. List every generated asset (name, path, which skill made it) in the report.

## 6. Testing

1. Every slice ends with its LEAF scenario run in the preview. Report pass/fail with the failing assertion.
2. Never invent scene object names in tests; confirm each name in the scene first.
3. Use relative assertions for numbers (before vs after).
4. Never change a test to make it pass. If the test is wrong, say why in the report.
5. Save at least two preview screenshots per slice to `docs/review/slice-N/` (for example `CaptureRuntimeViewTool`), showing the slice's visible result.
6. The Lens Studio Logger must have no new errors after the slice. Report any warnings you introduced.

## 7. Safety and secrets

1. Never print, copy or commit `.mcp.json` tokens, `spk_debug_key.pem`, API keys or anything under `.claude/settings.local.json`.
2. Do not run `git` commands. The orchestrator commits.
3. Do not touch files outside the project root.

## 8. Stop and ask

Stop and report (do not guess) when:
- MCP is unreachable, Lens Studio is closed, or the wrong project is loaded.
- Sign-in is not authorized.
- A requirement is ambiguous or two docs disagree.
- The slice needs a decision about look, words, or behavior that the docs do not make.
- A test fails twice for the same reason.
- The work needs anything listed as out of scope.

## 9. Report format (end of every slice)

```
## Slice N report
Status: done | partly done | blocked
Built: <bullets, each mapped to a requirement R#>
Files changed: <paths>
Assets generated: <name, path, skill>
LEAF: <scenario> pass | fail (<failing assertion>)
Logger: <new errors / warnings, or "clean">
Screenshots: docs/review/slice-N/<files>
Measurements: <numbers you measured, e.g. head height>
Defaults that did not work: <value, problem, proposed value>
Not done / deviations: <what and why>
Questions for the learner: <numbered>
```
