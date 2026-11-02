# Devpost draft: Aftershock (learn-specs)

Status: **draft by the orchestrator agent**, for the learner to review. Revised 2 Nov rule: the agent may draft the description, tagline and technology answer; the learner answers the survey and the legal boxes.

Nothing here is saved on Devpost yet.

---

## Project name (max 60)

Aftershock

## Tagline (max 200)

An earthquake drill you walk through on Snap Spectacles: a labelled room, a quake without warning, and a score for how you took cover. Then fix the room and replay the same quake.

## Built with

`lens-studio`, `snap-spectacles`, `typescript`, `clad`, `lens-studio-mcp`, `leaf`, `spectacles-interaction-kit`, `claude-code`, `python`, `numpy`, `piper-tts`, `kokoro`

## Links

- Repo: https://github.com/FairoLegends/Aftershock
- Video: (YouTube link once uploaded and Public)

---

## About the project (Markdown)

## Inspiration

I live in Indonesia. BMKG recorded 7,358 earthquakes here in 2024, and 743 of them were strong enough to feel. Everyone gets the leaflet: drop, cover, hold on. Hardly anyone has practised it. When the shaking starts, you do whatever you already have in your body, and a leaflet doesn't put anything there.

Glasses can. They can build a room around you, put real-sized furniture where it would be, and make you move.

## What it does

Aftershock is a drill you do with your body, not with buttons.

1. **A room is built around you.** Every drill makes a new bedroom: 1 to 2 tables, 3 to 5 hazards (wardrobe, shelf, window, floor lamp, TV) against the walls, a bed, a chair and a door. A scan labels each hazard and marks the safe spot under each table.
2. **The quake comes without warning,** 8 to 15 seconds after the briefing, and lasts 45 to 60 seconds. The room shakes, things fall, the window shatters, the TV topples off its stand.
3. **You have to act.** Walk under a table, duck, hold the table leg, and stay down until it stops. Standing up, staying in a red danger zone, letting go of the leg, or getting hit costs health. Then walk out through the door, and don't trip over what fell.
4. **You get a score out of 1000** in four parts (how fast you took cover, health kept, how long you held on, the evacuation), plus up to two short cards about what went wrong in *your* drill, each sourced from BMKG.
5. **You watch yourself again.** The replay draws your own path on the floor: red where you stood in danger, green where you took cover.
6. **Then you fix the room.** Pinch the shelf, the wardrobe or the TV to fasten it to the wall, and replay *the same quake*: same seed, same falls, same timing. The result shows the difference ("5 of 6 falling items prevented") and turns it into a checklist for your real room tonight.

Three levels: Easy keeps the labels on through the quake, Normal adds aftershocks, Hard takes away the labels, the zones and the arrow, so you find the danger yourself. It runs in five languages (Bahasa Indonesia, English, German, Japanese, Chinese), with a voice that reads each step.

## Who it's for

People who live where the ground moves, and the families and schools that run drills for them. The real target is the reflex: getting under the table in the first seconds, and staying there.

## How we built it

The Lens was planned with the Devpost Learn skill pack and built by an AI coding agent (Claude Code) through the **CLAD plugin** in **Lens Studio 5.23.2**, over the **Lens Studio MCP**.

- **Plan first.** The `plan-lens` interview produced the approved design brief (`devpost/design-brief.md`). From it came a PRD, a technical design, a user flow, a visual design brief and an engineering plan, all in the repo. Every design decision was mine; anything I didn't decide is marked *(default)* in the plan.
- **16 slices.** Each slice was one narrow task in a fresh, budget-capped CLAD session. An orchestrator agent (Hermes) wrote the prompt for each slice and then checked the result itself over the same MCP: it ran the LEAF suite, drove the preview, took screenshots and read them, before I approved a commit.
- **Tested with LEAF.** 29 scenarios drive the real drill through a head-pose override and SIK hand interactors. They check the exact score, the room generator's rules over fixed seeds, that a repeated quake is identical, text contrast on an additive display, and that the TV's stand stays put when the TV falls. All 29 pass.
- **Assets made for this project.** 3D models from CLAD's `build-mesh`; sound effects synthesised from code; 60 voice clips from open TTS models (licences in `docs/VOICE_CREDITS.md`); OFL fonts subset to the strings in use.

**Disclosure.** The orchestrator agent also made a few small direct fixes in the first days (up to 30 Oct), mostly in test files, when a build session had run out of budget; since then every code change went through CLAD. The orchestrator agent also made the font subsets, the sounds, the voice clips, the split of the TV mesh and the logo (mark generated with xai/grok-imagine-image, wordmark set in Manrope). This description was drafted by the orchestrator agent and reviewed by me.

## Challenges we ran into

- **No real room in the preview.** I wanted the Lens to find my real furniture. A spike showed World Query hit testing in the preview only returns surfaces near the centre of view, never the floor or low furniture. So the room is virtual and labelled, and recognising real objects moved to "what's next".
- **Ducking is just camera height in the preview.** "Ducked" means your head is below a line we calibrate from your own height at the start, not a body pose.
- **An additive display.** Spectacles add light; they can't draw black. Dark panels are invisible, so the glass UI is built from light gradients and edges, and a test checks that no text drops below 90% opacity.
- **Timing tests on a slow preview.** A few LEAF tests failed only in the full 35-minute run, when the preview ran slower. Each was traced to the test's own timing, not the game, and fixed without loosening what the test checks.
- **The TV fell with its table.** The generated TV-on-stand was one mesh, so the whole stand tipped. The mesh was split into stand and TV so only the TV topples.

## Accomplishments that we're proud of

- The fix-and-replay loop: you change one thing in the room and see the same quake hurt you less. It turns a score into a reason to fasten your real shelf tonight.
- A deterministic quake: one seed decides every fall, so a replay is truly the same quake.
- 29 LEAF scenarios passing, built and run through the MCP.

## What we learned

[Learner to check: these are drawn from the decisions on record, not his own words yet]

- Planning before building changed the result more than the build did. The interview made me pick one moment (taking cover in the first seconds) and cut the rest.
- Designing for glasses is about where things are, not how they look: labels at fixed height on the object, panels that follow your head lazily, a floor path instead of a minimap.
- An AI agent builds what you describe, so the work moves to deciding clearly and checking what came back.

## What's next for Aftershock

- **Your real room:** World Query and Spatial Anchors to find your real furniture and remember a real safe spot, once they work beyond the preview.
- Marking dangerous objects yourself by pinching at them.
- Running it on real Spectacles, and having people other than me try it.

---

## Additional info: "Explain how your project meets the main technology requirement"

I planned it with the Devpost Learn skill pack (plan-lens interview, approved brief in devpost/design-brief.md) and built it with Claude Code through the CLAD plugin in Lens Studio 5.23.2 over the Lens Studio MCP, in 16 CLAD sessions. LEAF runs 29 test scenarios. CLAD's build-mesh made the 3D models. An orchestrator agent wrote each session's prompt and checked the result over the same MCP.

## Fields the learner fills in himself

- Submitter type, country of residence, the three legal checkboxes
- "Had you used Lens Studio before?", "Did CLAD build what your brief described?", "Which step took the most time?", "Did the cost of AI affect what you did?", "Where did you get stuck?", "One thing Snap should fix", the three rating questions
