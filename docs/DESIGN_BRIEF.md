# Design Brief: Aftershock (look, placement and feel)

> Updated 31 Oct 2026 to match the build at 5b4958e (Slices 8-12B).

Structure follows Wavespace's design brief guide (https://www.wavespace.agency/blog/design-brief-example): project overview, goals, target audience, deliverables, design guidelines (color, type, tone), technical specifications, user flows, timeline.

> **Two briefs, two jobs.** `devpost/design-brief.md` is the **learner's approved brief** from the `plan-lens` interview and is part of the submission. This file is the **visual and spatial design guide** for the build agent. It only turns the learner's decisions into sizes, colors and positions. Where they disagree, `devpost/design-brief.md` wins. Values marked **(default)** were not chosen by the learner and can be changed by them.

## 1. Project overview

Aftershock is a SPECS Lens that turns the room you are standing in into an earthquake drill, with a virtual room at real scale as the stand-in. Labels show what can fall on you and a marker shows where to take cover. Then, without warning, the room shakes. You walk under the table, duck, and hold the table leg until the shaking stops, ride out a possible aftershock, walk out through the door, and the Lens scores how you did and shows a short safety tip.

## 2. Goals

1. The drill is felt with the body: walk, duck, hold. It does not depend on reading a lot of text.
2. Every element sits where it belongs: labels on the dangerous object, the marker under the table, status in the line of sight.
3. During the quake the user knows what to do next within one glance: numbered steps with the active one highlighted, a calm voice saying the same, and an arrow when the safe zone is out of view.
4. The video reads clearly at YouTube size: big text, strong color coding, the whole drill under three minutes.

## 3. Target audience

Anyone in Indonesia: families at home, school students, office workers (learner's choice). Implications:

- No prior AR experience assumed. Few big labeled buttons per screen (one primary action; the result screen adds a secondary Change language button).
- Mixed reading speed and ages: instructions of three to six words per language.
- One language per screen, picked from five (Bahasa Indonesia, English, Deutsch, 日本語, 简体中文) on the first screen (learner, 5j-13d); only the picker title shows all five.

## 4. Deliverables

| Deliverable | Where |
|---|---|
| The Lens (scene, scripts, assets) | `Assets/` in this Lens Studio project |
| LEAF test scenarios DC1–DC23 | `Assets/Scripts/Aftershock/Tests/` |
| Preview screenshots for review | `docs/review/` (by slice) |
| Demo video under 3 minutes | YouTube, public |
| Planning docs | `devpost/` (pack) and `docs/` (this set) |

## 5. Design guidelines

### 5.1 Color (additive display: black is transparent, dark colors fade)

| Role | Color (default) | Used on |
|---|---|---|
| Hazard | Red `#FF5A4F`, extra bold, with a red ⚠ (Slice 12, learner 5m-3; was dark orange `#D9480F` from 27 Oct) | Hazard labels and danger zones on the cabinet, shelf, glass, lamp, TV |
| Safe / action | Green `#3DDC84` (the one action color, soft UI 5j-13c) | Safe-zone markers, their label, the arrow, the floor path, the primary button, the active step, grip handles, the door label |
| Alarm | Red `#FF5A4F` | "GEMPA! / EARTHQUAKE!" and aftershock banner (88% fill), notices, the edge pulse, health bar when below 30 |
| Text | White `#FFFFFF` at full opacity | All text except the hazard line |
| Panel | Soft UI: rounded corners, see-through white backings (HUD 60%, briefing and result 75%, safety 25%), thin light borders only where needed; hazard labels white at 60% | Panels; never a solid black backing |
| Walls | `#E8EEF2` at 25% | The four virtual walls (Slice 8A) |

Color is never the only signal: hazard labels say what the danger is, and the safe zone has its own label.

### 5.2 Type

- One family, Manrope (SemiBold; ExtraBold for the red hazard line, 5m-3), tabular numbers for timer and score; Noto Sans JP / SC for ja/zh (all OFL). Sizes at the HUD distance of 110 cm (default): warning banner 6.5 cm em on a 30 cm wide banner (5m-1), instruction 3.5 cm, small HUD text 2 cm. Snap's usable view at 110 cm is about 53 × 77 cm, so the warning banner fits.
- Room labels scale with distance: em = clamp(2.4, 2.2 × metres, 6.0) cm (default), about 1.3° of view (5m-3).
- One language per screen (5j-13d), no English second line.
- No paragraphs. Result explanations are at most three short lines; education cards two lines at 2 cm.

### 5.3 Tone of voice

Calm, short and direct, like a drill coach. Instructions use the imperative ("Go under the table"). No jokes, no blame on the game-over screen; it says what happened and how to do better. The voice guide (Slice 10) is calm (learner: voice C) and says what the screen says; the quake warning is spoken as "Ada gempa. Tetap tenang." (learner).

## 6. Spatial specification

Coordinates in cm, relative to the user's start position on the floor, +Y up, −Z forward. All (default) except "surrounds the user, close, real size" and the learner decisions marked.

The layout is procedural (Slice 5P, 9A, 11): each drill draws a room rectangle first (each side 420–600 cm, the start spot inside), then places the items; the fixed table below is the fallback layout only. Sizes are the model footprints in `LayoutGenerator.ts`.

| Element | Size (W × D × H) | Position | Notes |
|---|---|---|---|
| Tables (safe zone), 1–2 | 120 × 70 × 75 | Free-standing, 120–250 cm from the start spot (Easy 120–150), square to the walls, long side toward the start spot | Cover under any table counts; arrow and path to the nearest (learner, 5j-15a, 5l-7f) |
| Hazards, 3–5 of cabinet (90 × 45), shelf (80 × 30), glass window, lamp (40 × 40), TV (120 × 40) | real scale (CLAD models) | 140–300 cm from the start spot; cabinet, shelf, TV and glass back flush on a wall, facing in; the lamp free or beside a wall, often beside the bed's head end | No kind twice (learner, 5j-15b, 5l-1) |
| Glass window | 120 × 120 pane in a light-oak frame, bottom edge 90 cm | On a wall, facing in; cabinet and shelf never in front of it | Cracks in the quake, breaks in the aftershock (Slice 8C, 11) |
| Bed (trap) | 90 × 200 | Head end against a wall (in a corner its long side may touch the other), 60 cm walkway on a free long side, tables at least 100 cm away | Ducking on it shows "Kasur bukan tempat berlindung"; not cover (learner, 5j-14b, 5l-7b) |
| Chair | 45 × 50 | Free, square to the walls, facing its table when near one | Plain furniture |
| TV | 120 × 40 | On a wall facing the bed or the room center, at least 150 cm from the bed | Topples once per drill (Slice 9A) |
| Walls and exit door | 250 cm tall walls; door 90 × 210 | Door on a wall with 120 cm clear in front, at least 100 cm from the glass, outside every danger zone | Slice 8A (5k-1) |
| Safe-zone marker | Rectangular floor outline (learner kept the rectangle), plus label | Under each table | Steady before the quake, blinks 2 Hz during it |
| Danger zones | Hazard footprint + 60 cm (front and sides only for wall-backed items; TV 140 cm in front) | Red floor area | From BRIEFING to the end of the evacuation |
| Hazard labels | One label: red ⚠ + red extra-bold hazard line, "Zona bahaya" smaller under it, on a white backing at 60% (5m-3) | 10 cm above the item, center at most 205 cm high, else beside it at 150 cm (eye level); upright, facing the head | Normal: shrinks to the ⚠ in the quake, grows back within 10° of gaze or 150 cm (5m-4); Easy full; Hard none |

Walls are light and semi-transparent (not solid), so the room reads as an overlay.

### 6.1 Panels and HUD (never shake)

| Element | Placement |
|---|---|
| Language picker (Slice 5L) | First screen, before the safety panel: 110 cm in front at eye level (5h-2), five big buttons labeled in their own language, placed once. Reopened by Change language with the current language marked. |
| Safety panel | 110 cm in front of the head, 22 cm below eye level, placed once at start; once per session |
| Level picker, duck practice | 110 cm in front, three level cards (current preselected); duck practice with a Skip button |
| HUD (steps, health, timer) | Lazy-follows the head at 110 cm, 22 cm below eye level (learner: 20–25 cm, so the table stays in view). Numbered steps 01–04 in one row, health and timer under them. Appears only after the banner has gone (5m-1). Notices (bed, fall, glass, trip) replace the step row for 2–2.5 s (`fallNoticeSeconds`, `tripNoticeSeconds`, `bedWarnSeconds`), never a second panel (5m-2). |
| Warning banner | Center of view for 1.2 s at quake and aftershock start, then hides (learner, banner B, 5m-1). Placed along the head's forward 8° above the gaze and follows it, pitch clamped −50° to +30° (5m-9). |
| Arrow | At the edge of the view nearest the safe zone (or the door in the evacuation), 4 cm, green, pointing toward it; not on Hard |
| Result panel | 110 cm in front of the head when shown, 10 cm below eye level; score parts, best, up to two education cards, Restart (green, primary) and Change language (secondary, outline) |
| Briefing and result panels | May turn 0 or ±8° toward the side with less furniture behind them (5k-2) |
| Buttons | UI Kit Button, at least 12 × 5 cm, within easy reach below eye level |

Only one panel at a time: banner, HUD notice, briefing, result and cards never overlap (5m-5).

### 6.2 Motion and sound

- Shake: the room node moves with layered noise, 2.5 cm and 1.2° at peak (default), ramping up over the first 3 s and down over the last 3 s; the aftershock at 60% (default). Cabinet, shelf, lamp and TV wobble about their base, the lamp glow flickers, the window glass cracks in stages and breaks in the aftershock (Slice 8C, 11).
- Falls: books and boxes slide off the shelf with a dust puff on landing; the TV topples forward once per drill (Slice 9A). Animation, not physics.
- Sound: one low looping rumble, ramping with the shake; it is ambience, not a direction cue (the learner replaced the direction cue with the arrow). Original synthesized chime at the quake start, thud, glass crack, glass break, and a heartbeat below 30 health (5k-6).
- Voice: a calm clip in the chosen language for each instruction and warning as it appears; the rumble ducks to 60% under it (Slice 10).
- Feedback: health bar pulses red while draining, and a red edge pulse at the view edge. Instruction text changes with a short fade, no bouncing.

## 7. Comfort checklist (from the pack's AR design rules)

- [ ] Main content between 60 and 160 cm, a little below eye level.
- [ ] Everything needed during the task is in view; the arrow covers the safe zone when it is not.
- [ ] Text light and readable from the user's position.
- [ ] Things show when needed and hide after (banner, arrow, briefing instruction, notices); one panel at a time.
- [ ] A few big targets only: language, level, Continue, Skip, Restart, Change language, and the grip handles.
- [ ] No UI behind the shoulder; nothing stuck to the face.

## 8. Timeline

See `ENGINEERING_PLAN.md`. Design reviews happen at each slice checkpoint, on preview screenshots.
