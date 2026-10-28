# Product Requirements Document: Aftershock

Structure follows Atlassian's agile PRD guide (https://www.atlassian.com/agile/product-management/requirements): project specifics, goals, background and strategic fit, assumptions, user stories, user interaction and design, questions, and what we are not doing.

> **Source of truth.** `devpost/design-brief.md` (status: approved) holds the learner's decisions from the `plan-lens` interview. This PRD restates them as requirements and adds nothing new to the product. Where the two disagree, the brief wins and this file is fixed. Values marked **(default)** were not chosen by the learner; they are engineering placeholders the learner can change.

## 1. Project specifics

| Item | Value |
|---|---|
| Product | Aftershock, a SPECS Lens (Snap AR glasses) |
| Event | Learn AR with SPECS (Devpost, `learn-specs`) |
| Owner and decision maker | M. Faiq Febrian (learner) |
| Orchestrator | Hermes agent `testaja`: plans slices, reviews every result, keeps the build on scope |
| Build agent | Claude Code with the CLAD plugin (`ls-clad`) and the Lens Studio MCP, model `claude-opus-5-5`, effort `xhigh` |
| Tooling | Lens Studio 5.23.2, SPECS Base Template, Spectacles Interaction Kit (SIK), Spectacles UI Kit, LEAF tests |
| Runs in | Lens Studio Interactive Preview on a laptop. No SPECS device is available or required. |
| Submission deadline | Tue 10 Nov 2026, 05:00 WIB (Mon 9 Nov 2026, 22:00 UTC) |
| Internal target | Mon 9 Nov 2026, 20:00 WIB |
| Status | Brief approved 27 Oct 2026; build not started |

## 2. Goals and objectives

**Problem.** Indonesia records thousands of earthquakes a year (BMKG counted 7,358 in 2024, 743 of them felt), yet earthquake education and drills are still lacking. Reading about what to do is easy to forget and gets boring.

**Product goal.** Let anyone practice what to do during an earthquake in the room they are standing in: move to a safe spot, duck down, and hold on until the shaking stops, with the body, not by reading.

**Event objectives (the four equally weighted judging criteria).**

| Criterion | How Aftershock serves it |
|---|---|
| Design | The drill is placed in the user's space at real scale and uses the body; it follows the pack's four habits (information on the thing, show when needed, few big targets, keep it in view, arrow for out-of-view) |
| Technical Implementation | Built through CLAD and the Lens Studio MCP; a state machine with head-position and head-height detection; LEAF tests for every done criterion |
| Innovation / Idea | Disaster preparedness is a category no Spectacles Lens has covered; the drill scores the user's own movement instead of showing a video |
| Presentation | A sub-3-minute YouTube video of the preview showing the whole drill end to end |

**Success metrics (verifiable in the preview).**
1. All five done criteria in the brief pass in the preview, each with a LEAF scenario where LEAF can drive it.
2. A full drill (safety reminder to result screen) runs without errors in the Logger.
3. The learner completes the brief's "After the build: judge it" checklist and marks each item "logic proven" or "feel unproven".
4. The whole flow is working end to end before the Live Project Review (Fri 6 Nov 2026, 00:00 WIB).

## 3. Background and strategic fit

- Earlier Spectacles challenge winners show the patterns judges reward: drawing something invisible in the real room (Wi-Fi Speed), turning the real world into play (CurioCity, Whenabouts), real body movement (Memory Grid), and real-world coaching (BullsAI, BiteNavi). None covers disaster safety.
- Prior art exists outside Spectacles and is credited openly: AREarthQuakeDrill (Osaka University, IEEE VR 2021), the ITS thesis on AR earthquake evacuation (Putri Meyliya Rachmawati, 2026), AR furniture-fall simulations from Japan, ARB DisasterScope and Bousai VR/AR, and Tremor Kid (Peru). Aftershock's narrow claim: the first SPECS Lens for earthquake drills, one that scores the user's own movement (reach the safe zone, duck, hold).
- The ShakeOut / USGS guidance (Drop, Cover, Hold On; do not run; stay under cover until the shaking stops) is the behavior the drill teaches.

## 4. Assumptions

1. The Lens is judged from the video, the description and the repo. Judges are not required to run it.
2. Lens Studio's preview has no real room and cannot recognize objects, so a pre-placed virtual room at real scale stands in for the user's room (the brief's stand-in).
3. Walking is WASD and ducking is Q/E in the preview; the Lens reads the camera (head) position and height.
4. In-Lens text is bilingual Indonesian / English, so Indonesian users and English-speaking judges can both read it.
5. One user, one room, one session; nothing is saved between sessions.

## 5. Requirements (user stories)

Importance: **Must** = in a done criterion; **Should** = in the brief but outside a done criterion; **Stretch** = only if the orchestrator confirms there is time.

| # | User story | Importance | Done criterion | Notes |
|---|---|---|---|---|
| R1 | As a user, I see a bilingual safety reminder before anything else, so I know this is a drill and check my room is safe to move in. | Must | 1 | Text: "Ini latihan, bukan peringatan gempa sungguhan / This is a drill, not a real earthquake alert" and "Pastikan ruanganmu aman untuk bergerak / Make sure your room is safe to move in". |
| R2 | As a user, I pinch a Continue button to start the drill. | Must | 1 | One big SIK button. Label (default): "Lanjut / Continue". |
| R3 | As a user, I am surrounded by a real-size virtual table, cabinet, shelf and glass window, close to me, like standing in the middle of a real room. | Must | 1 | Layout in the TDD (default). |
| R4 | As a user, I see which objects are dangerous (labels on the cabinet, shelf and glass) and where the safe zone is (a marker under the table) before the quake. | Must | 1 | Label wording (default) in the TDD string table. |
| R5 | As a user, I see the instruction "Kenali benda berbahaya dan ingat letak safe zone / Know the hazards and remember the safe zone" before the quake; it hides when the quake starts. | Must | 1 | |
| R6 | As a user, the quake starts without warning after a wait, so I practice reacting. | Must | 2 | Wait length (default): random 8–15 s. |
| R7 | As a user, when the quake starts the room and objects shake, I hear a rumble, a big "GEMPA! / EARTHQUAKE!" warning appears, the safe zone marker blinks, and a health bar and timer appear. | Must | 2 | UI panels do not shake, so they stay readable. |
| R8 | As a user, the shaking lasts 45–60 seconds. | Must | 5 | Picked at random in that range for each drill (default). |
| R9 | As a user, if I turn so the safe zone is out of view, a small arrow points to it, and it hides when the safe zone is back in view. | Must | 3 | Replaces the earlier default rumble cue. |
| R10 | As a user, I walk under the table and duck; the instructions change by themselves, following my progress: "Pergi ke bawah meja / Go under the table", then "Merunduk / Duck down", then "Tahan sampai guncangan berhenti / Hold until the shaking stops". | Must | 3 | The Lens checks both position (in the safe zone) and ducking (head height). |
| R11 | As a user, if I stand up before the shaking ends after I have taken cover once, my health drops little by little and my score goes down; it stops dropping when I duck again in the safe zone. | Must | 4 | Drain starts only after the first safe moment (Q5). Drain rate (default) in the TDD. |
| R12 | As a user, if my health runs out, a game-over result screen explains what went wrong, and pinching Restart starts the drill again from the room. | Must | 4 | Restart goes to the room briefing (Q1). |
| R13 | As a user, after the shaking stops and I leave the safe zone, a score screen shows my score from speed and remaining health, with a Restart button. | Must | 5 | Formula (default) in the TDD; never taking cover scores 0 (Q6 default). |
| R14 | All in-Lens text is bilingual Indonesian / English until R16 is built; then the selected language plus English. | Must | 1–5 | Strings live in one file (TDD §6, `STRINGS_I18N.md`). |
| R16 | As a user, the first screen lets me pick the language (Bahasa Indonesia, English, Deutsch, 日本語, 简体中文) with five big buttons; the rest of the Lens then shows my language on top and English smaller below (English only when I pick English). | Must | — | Learner, 27 Oct. Strings and fonts in `STRINGS_I18N.md`. Built in Slice 5L. Replaces the fixed Indonesian / English pair of R14 once built. |
| R17 | As a user, every drill (and every Restart) puts the table and the hazards in new places, the table always within 200 cm of me, and a red floor area around each hazard drains my health if I stand in it during the quake. | Must | — | Learner, 27 Oct. Built in Slice 5P. Changes R3's fixed layout. |
| R18 | As a user, after Continue the glasses seem to scan the room: a sweep passes and each hazard is outlined and labeled in turn. | Should | 7 | Visual effect over the virtual room, not detection (learner, 29 Oct). |
| R19 | As a user, a glowing path on the floor leads me to the table, brighter during the quake. | Should | 7 | Hidden on the hard level. |
| R20 | As a user, the edge of my view pulses red while I am losing health. | Should | 7 | Never covers the center of view. |
| R21 | As a user, after the main quake an aftershock can come, and I have to take cover again. | Should | 7 | Chance by level; the result shows after it (learner: the name of the Lens). |
| R22 | As a user, items fall from the shelf and cabinet during the quake, and one landing near my head costs health. | Should | 7 | Animation, not physics; random items each drill. |
| R23 | As a user, I pick a level (easy, normal, hard) before the drill, and Restart keeps it. | Should | 7 | Values (default) in ENGINEERING_PLAN 5j. |
| R15 | Text is light and readable from where the user stands; no dark UI (the display is additive, black is transparent). | Should | — | Checked in the learner's comfort review. |
| S1 | As a user, objects fall from the shelf or cabinet during the quake. | Stretch | — | Only after R1–R15 pass. |
| S2 | As a user, I mark dangerous objects and the safe spot myself with a pinch. | Stretch | — | Only after S1, or if the learner reprioritizes. |

## 6. User interaction and design

- Flow: `USER_FLOW_DIAGRAM.md`.
- Look, placement, colors, type and comfort numbers: `DESIGN_BRIEF.md`.
- Inputs: pinch (mouse click in the preview) for the Continue and Restart buttons only. Walking (WASD) and ducking (Q/E) are body movement, not buttons. No voice.

## 7. Questions

Answered by the learner on 27 Oct 2026 unless marked open.

| # | Question | Answer |
|---|---|---|
| Q1 | Does Restart go back to the safety reminder, or straight to the room? | **Learner:** straight to the room (the briefing step). The safety reminder shows only when the Lens opens. |
| Q2 | After the quake ends, should the Lens tell the user to come out from under the table? | **Learner:** yes. Wording (default): "Guncangan berhenti. Keluar dari bawah meja / The shaking stopped. Come out from under the table". |
| Q3 | Should the timer show elapsed time or remaining time? | **Learner:** elapsed time. |
| Q4 | Wording of the hazard labels, button labels and result explanations. | **Open, learner will decide later.** Draft strings in the TDD §6, marked (default), are used until then. |
| Q5 | Does health drain while the user is still walking to the table, or only after standing up again once safe? | **Learner:** only after the user has been safe once (in the safe zone and ducked). Walking to the table the first time never drains health. |
| Q6 | Follows from Q5: a user who never takes cover loses no health and never hits game over. What should their result be? | **Open.** Default: no health points without taking cover, so the score is 0 and the result screen says "you never took cover". |

## 8. Not doing (out of scope)

From the brief: recognizing real objects through the camera; more than one room or quake scenario; two users in one Lens; saving progress or scores between sessions. Also out: recording, identifying or following people; any network service or AI remote service; voice commands. Pinch marking (S2) and falling objects (S1) are stretch goals, not core.
