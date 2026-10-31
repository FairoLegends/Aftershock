# Product Requirements Document: Aftershock

> Updated 31 Oct 2026 to match the build at 5b4958e (Slices 8-12B).

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
| Status | Brief approved 27 Oct 2026; Slices 0–12B built (HEAD 5b4958e), LEAF auto-run 23/23 (DC1–DC23) |

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
4. In-Lens text is in one language the user picks from five (Bahasa Indonesia, English, Deutsch, 日本語, 简体中文); every screen shows that one language (R16).
5. One user, one room, one session; the only thing saved between sessions is the personal best score per level, on the device (R27).

## 5. Requirements (user stories)

Importance: **Must** = in a done criterion; **Should** = in the brief but outside a done criterion; **Stretch** = only if the orchestrator confirms there is time.

| # | User story | Importance | Done criterion | Notes |
|---|---|---|---|---|
| R1 | As a user, I see a safety reminder in my language right after the language picker, so I know this is a drill and check my room is safe to move in. | Must | 1 | Text: "Ini latihan, bukan peringatan gempa sungguhan / This is a drill, not a real earthquake alert" and "Pastikan ruanganmu aman untuk bergerak / Make sure your room is safe to move in" (one language per screen since 5j-13d). Shown once per session (Slice 10B). |
| R2 | As a user, I pinch a Continue button to start the drill. | Must | 1 | One big SIK button. Label (default): "Lanjut / Continue". |
| R3 | As a user, I am surrounded by a real-size virtual room close to me: 1–2 tables, 3–5 hazards drawn at random from cabinet, shelf, glass window, floor lamp and TV (no kind twice), plus a bed and a chair, inside four light walls with an exit door. | Must | 1 | Learner 29 Oct (5j-14, 5j-15); layout in R17 and R32; walls in R24. Item counts (default). |
| R4 | As a user, I see which objects are dangerous (a label on each hazard present) and where the safe zone is (a marker under each table) before the quake. | Must | 1 | Wording (default) in `STRINGS_I18N.md`. Hard shows no labels or markers until the result reveal (5j-18). Label look in R33. |
| R5 | As a user, I see the instruction "Kenali benda berbahaya dan ingat letak safe zone / Know the hazards and remember the safe zone" before the quake; it hides when the quake starts. | Must | 1 | |
| R6 | As a user, the quake starts without warning after a wait, so I practice reacting. | Must | 2 | Wait length (default): random 8–15 s. |
| R7 | As a user, when the quake starts the room and objects shake, I hear a rumble, a short "GEMPA! / EARTHQUAKE!" banner appears, the safe zone marker blinks, and once the banner is gone the HUD (numbered steps, health bar, timer) appears. | Must | 2 | UI panels do not shake, so they stay readable. Slice 12/12B: banner 1.2 s, follows the head's pitch 8° above the gaze (default); notices (bed, fall, glass, trip) show inside the HUD, never as a second panel. |
| R8 | As a user, the shaking lasts 45–60 seconds. | Must | 5 | Picked at random in that range for each drill (default). |
| R9 | As a user, if I turn so the safe zone is out of view, a small arrow points to it, and it hides when the safe zone is back in view. | Must | 3 | Replaces the earlier default rumble cue. Points to the nearest table; none on Hard. |
| R10 | As a user, I walk under the table and duck; the instructions change by themselves, following my progress: "Pergi ke bawah meja / Go under the table", then "Merunduk / Duck down", then "Tahan sampai guncangan berhenti / Hold until the shaking stops". | Must | 3 | The Lens checks both position (in the safe zone) and ducking (head height). Shown as numbered HUD steps 01–03 (5j-3); step 03 also asks to hold the table leg (R25); step 04 is the evacuation (R24). |
| R11 | As a user, if I stand up before the shaking ends after I have taken cover once, my health drops little by little and my score goes down; it stops dropping when I duck again in the safe zone. | Must | 4 | Drain starts only after the first safe moment (Q5); also drains in a danger zone (R17). Drain rate (default) in the TDD; Hard drains 1.5× (default). |
| R12 | As a user, if my health runs out, a game-over result screen explains what went wrong, and pinching Restart opens the level picker (current level preselected) so I can start again. | Must | 4 | Was "Restart goes to the room briefing" (Q1); changed in the Slice 7 audit (5j-19a). The reason follows the cause: stood up, danger zone, fall/topple/trip, broken glass, or not holding the table leg (5l-4f, 5l-7a). |
| R13 | As a user, after the shaking stops I leave the safe zone and walk out through the door; a score screen then shows my score in four parts (cover speed 450, health 300, holding the table 100, evacuation 150, minus 10 per second standing after first cover; 0–1000), with Restart and Change language buttons. | Must | 5 | Learner's rebalance (5k-10); evacuation point details (default). Never taking cover scores 0, evacuation included (learner, 5l-4b). |
| R14 | All in-Lens text is in the one language picked in R16. | Must | 1–5 | Strings live in one file (`Strings.ts`, from `STRINGS_I18N.md`). Was bilingual Indonesian / English before Slice 5L. |
| R16 | As a user, the first screen lets me pick the language (Bahasa Indonesia, English, Deutsch, 日本語, 简体中文) with five big buttons; every screen after it shows only my language. | Must | — | Learner, 27 Oct; built in Slice 5L. One language per screen since the soft UI (learner, 5j-13d); only the picker title shows all five. Strings and fonts in `STRINGS_I18N.md`. |
| R17 | As a user, every drill (and every Restart) puts the tables and the hazards in new places, a table always 120–250 cm from me (Easy 120–150 cm), and a red floor area around each hazard drains my health if I stand in it during the quake. | Must | — | Learner, 27 Oct (Slice 5P); range widened by the learner 29 Oct (5j-14d). Zones of wall-backed hazards grow only to the front and sides (5l-4h). |
| R18 | As a user, after Continue the glasses seem to scan the room: a sweep passes and each hazard present is outlined and labeled in turn. | Should | 7 | Visual effect over the virtual room, not detection (learner, 29 Oct). Counter n/N; none on Hard. |
| R19 | As a user, a glowing green path on the floor leads me to the nearest table, brighter during the quake. | Should | 7 | Hidden on the hard level. |
| R20 | As a user, the edge of my view pulses red while I am losing health. | Should | 7 | Never covers the center of view. |
| R21 | As a user, after the main quake an aftershock can come, and I have to take cover again. | Should | 7 | Chance by level: Easy never, Normal 50%, Hard always (default); the evacuation and result come after it (learner: the name of the Lens). |
| R22 | As a user, books and boxes fall from the shelf and the TV topples during the quake, and one landing near my head while I am in its danger zone and not under a table costs health. | Should | 7, 9A | Animation, not physics; 1–3 items per shake, −15 health within 40 cm (default). Shelf only since Slice 9A (learner, 5l-2); the TV topples once per drill. None on Easy. |
| R23 | As a user, I pick a level (easy, normal, hard) before the drill, and Restart opens the picker with my level preselected. | Should | 7 | Values (default) in ENGINEERING_PLAN 5j-18; Restart change 5j-19a. |
| R24 | As a user, the room has four light walls and an exit door; after the shaking (and any aftershock) stops and I leave cover, I walk out through the door within 30 s (step 04 "Keluar"), avoiding red zones and items on the floor (a trip costs 10 health). | Should | — | Slice 8A (walls, window on a wall, door), 8B (evacuation, 5k-1, 5k-8); room 420–600 cm a side since 9A (default). Arrow and path to the door on Easy and Normal, none on Hard. Values (default). |
| R25 | As a user, under the table I hold on: I pinch and hold a grip handle on the leg of the table I am under. On Normal and Hard, not holding for more than 3 s drains 1 health per second; on Easy it is a hint only. | Should | — | Slice 8B (5k-9); Hard keeps the grip rule (learner, 5l-4j). Values (default). |
| R26 | As a user, before the quake wait I practice ducking once (or pinch Skip), on every level. | Should | — | Slice 8D (5k-7, P7): the CALIBRATE step; the head must be above the duck line once before a duck counts (5l-4g). |
| R27 | As a user, the result screen shows my personal best for the level, and "New best!" when I beat it; it stays on the device. | Should | — | Slice 8D (5k-12, F5): Persistent Storage, one best per level. |
| R28 | As a user, after the drill I see up to two short education cards picked from what happened (left cover early, danger or hit, bed, fasten furniture, evacuation, aftershock check, coast). | Should | — | Slice 9B (F4); text from BMKG / BMKG-JICA guidance, approved by the learner 30 Oct (`EDUCATION_CARDS.md`); card rules updated by the learner (5l-4c). |
| R29 | As a user, a calm voice says the instructions and warnings in my language as they appear. | Should | — | Slice 10 (F6): 60 pre-made text-to-speech clips (12 lines × 5 languages, open models, `VOICE_CREDITS.md`); voice C, calm (learner). On every level; no voice on the language, safety, level and result screens; playback rules (default). |
| R30 | As a user, after a drill I can pinch "Change language", pick a language, and go straight to the level picker. | Should | — | Slice 10B (learner, 5l-6): secondary button next to Restart; the safety screen is not shown again in the same session. |
| R31 | As a user, during an aftershock the cracked window breaks: the pane falls out as shards into the glass danger zone, and standing there not under a table costs 15 health. | Should | — | Slice 11 (learner, 5l-7a): 8–14 shards (default), "Kamu terkena pecahan kaca" (hit.glass); shards count as a trip hazard in the evacuation. No break without an aftershock. |
| R32 | As a user, the room is arranged like a real room: cabinet, shelf, TV, window and bed stand against walls facing in; the bed's head end is on a wall, the lamp often beside it; the TV faces the bed or the room, not beside it; nothing blocks the window; tables and chairs are square to the walls. | Should | — | Slice 9A (learner, 5l-1) and Slice 11 (learner, 5l-7b–f). Distances (default) in ENGINEERING_PLAN 5l-7. |
| R33 | As a user, a hazard label is a red ⚠ with a bold red hazard line and "Zona bahaya" under it, above the item and sized to my distance; on Normal, once the quake starts it shrinks to the ⚠ until I look at it or come close. | Should | — | Slice 12 design pass (learner, 5m-3, 5m-4): grows back within 10° of gaze or 150 cm (default). Easy keeps full labels in the quake; Hard has none. |
| R15 | Text is light and readable from where the user stands; no dark UI (the display is additive, black is transparent). | Should | — | Checked in the learner's comfort review. |
| S1 | As a user, objects fall from the shelf or cabinet during the quake. | Stretch | — | Built as R22 (Slice 7D; shelf only and TV topple since Slice 9A). |
| S2 | As a user, I mark dangerous objects and the safe spot myself with a pinch. | Stretch | — | Only after S1, or if the learner reprioritizes. |

## 6. User interaction and design

- Flow: `USER_FLOW_DIAGRAM.md`.
- Look, placement, colors, type and comfort numbers: `DESIGN_BRIEF.md`.
- Inputs: pinch (mouse click in the preview) for the language, level, Continue, Skip, Restart and Change language buttons, and a held pinch on a table-leg grip handle (R25). Walking (WASD) and ducking (Q/E) are body movement, not buttons. Voice is output only (pre-made clips, R29); no voice commands.

## 7. Questions

Answered by the learner on 27 Oct 2026 unless marked open.

| # | Question | Answer |
|---|---|---|
| Q1 | Does Restart go back to the safety reminder, or straight to the room? | **Learner:** straight to the room (the briefing step). The safety reminder shows only when the Lens opens. Changed in the Slice 7 audit (5j-19a): Restart opens the level picker with the current level preselected, then duck practice and the room. |
| Q2 | After the quake ends, should the Lens tell the user to come out from under the table? | **Learner:** yes. Wording (default): "Guncangan berhenti. Keluar dari bawah meja / The shaking stopped. Come out from under the table". |
| Q3 | Should the timer show elapsed time or remaining time? | **Learner:** elapsed time. |
| Q4 | Wording of the hazard labels, button labels and result explanations. | **Open, learner will decide later.** Draft strings in the TDD §6, marked (default), are used until then. |
| Q5 | Does health drain while the user is still walking to the table, or only after standing up again once safe? | **Learner:** only after the user has been safe once (in the safe zone and ducked). Walking to the table the first time never drains health. |
| Q6 | Follows from Q5: a user who never takes cover loses no health and never hits game over. What should their result be? | **Learner (30 Oct, 5l-4b):** score 0, evacuation points too; the result screen says "you never took cover" and the first card is `card.stayUnder`. (A danger zone, a fall or broken glass can still drain health.) |

## 8. Not doing (out of scope)

From the brief: recognizing real objects through the camera; more than one room or quake scenario; two users in one Lens; saving progress between sessions (only the personal best per level is kept, R27). Also out: recording, identifying or following people; any network service or AI remote service; voice commands. Pinch marking (S2) is a stretch goal, not core; falling objects (S1) were built as R22.
