# Design Brief: Aftershock (look, placement and feel)

Structure follows Wavespace's design brief guide (https://www.wavespace.agency/blog/design-brief-example): project overview, goals, target audience, deliverables, design guidelines (color, type, tone), technical specifications, user flows, timeline.

> **Two briefs, two jobs.** `devpost/design-brief.md` is the **learner's approved brief** from the `plan-lens` interview and is part of the submission. This file is the **visual and spatial design guide** for the build agent. It only turns the learner's decisions into sizes, colors and positions. Where they disagree, `devpost/design-brief.md` wins. Values marked **(default)** were not chosen by the learner and can be changed by them.

## 1. Project overview

Aftershock is a SPECS Lens that turns the room you are standing in into an earthquake drill. Labels show what can fall on you and a marker shows where to take cover. Then, without warning, the room shakes. You walk under the table, duck, and hold on until the shaking stops, and the Lens scores how you did.

## 2. Goals

1. The drill is felt with the body: walk, duck, hold. It does not depend on reading a lot of text.
2. Every element sits where it belongs: labels on the dangerous object, the marker under the table, status in the line of sight.
3. During the quake the user knows what to do next within one glance: one short instruction at a time, and an arrow when the safe zone is out of view.
4. The video reads clearly at YouTube size: big text, strong color coding, the whole drill under three minutes.

## 3. Target audience

Anyone in Indonesia: families at home, school students, office workers (learner's choice). Implications:

- No prior AR experience assumed. One button per screen, labeled.
- Mixed reading speed and ages: instructions of three to six words per language.
- Indonesian first, English second on every string, for local users and English-speaking judges.

## 4. Deliverables

| Deliverable | Where |
|---|---|
| The Lens (scene, scripts, assets) | `Assets/` in this Lens Studio project |
| LEAF test scenarios DC1–DC5 | `Assets/Scripts/Aftershock/Tests/` |
| Preview screenshots for review | `docs/review/` (by slice) |
| Demo video under 3 minutes | YouTube, public |
| Planning docs | `devpost/` (pack) and `docs/` (this set) |

## 5. Design guidelines

### 5.1 Color (additive display: black is transparent, dark colors fade)

| Role | Color (default) | Used on |
|---|---|---|
| Hazard | Amber `#FFB020` | Hazard labels and their outline glow on the cabinet, shelf, glass |
| Safe | Green `#3DDC84` | Safe-zone floor ring, its label, the arrow, the "hold" instruction |
| Alarm | Red `#FF5A4F` | "GEMPA! / EARTHQUAKE!" banner, health bar when below 30 |
| Text | White `#FFFFFF` at full opacity | All text |
| Panel | UI Kit Frame/BackPlate with a light, semi-transparent surface | Panels; never a solid black backing |

Color is never the only signal: hazard labels say what the danger is, and the safe zone has its own label.

### 5.2 Type

- UI Kit text styles. Sizes at the HUD distance of 110 cm (default): warning 7 cm tall, instruction 3.5 cm, labels 2.5 cm, small HUD text 2 cm. Snap's usable view at 110 cm is about 53 × 77 cm, so the warning banner fits.
- Indonesian line first, English line below it in the same color at 80% size.
- No paragraphs. Result explanations are at most three short lines.

### 5.3 Tone of voice

Calm, short and direct, like a drill coach. Instructions use the imperative ("Go under the table"). No jokes, no blame on the game-over screen; it says what happened and how to do better.

## 6. Spatial specification

Coordinates in cm, relative to the user's start position on the floor, +Y up, −Z forward. All (default) except "surrounds the user, close, real size" (learner).

| Element | Size (W × D × H) | Position (center at floor) | Notes |
|---|---|---|---|
| Table (safe zone) | 120 × 70 × 75 | (0, 0, −150) | In front, so the safe zone starts in view; space under it for a ducked head |
| Cabinet | 90 × 45 × 190 | (−150, 0, −40) | Left; label at 140 cm height on its front |
| Shelf with items | 80 × 30 × 180 | (150, 0, −60) | Right; small boxes and books on it (fall candidates for stretch S1) |
| Glass window | 120 wide × 120 tall, bottom edge 90 cm | (0, 0, +170) | Behind, on a virtual wall section |
| Safe-zone marker | Floor ring 130 × 80, plus label | Under the table | Steady before the quake, blinks 2 Hz during it |
| Hazard labels | Fit text, 2.5 cm type | On each hazard, facing the room center | Visible from the start position |

Floor and wall sections are faint outlines only (not solid), so the room reads as an overlay.

### 6.1 Panels and HUD (never shake)

| Element | Placement |
|---|---|
| Safety panel | 110 cm in front of the head, 10 cm below eye level, placed once at start |
| HUD (instruction, health, timer) | Lazy-follows the head at 110 cm, 10 cm below eye level. Health and timer in one row under the instruction. |
| Warning banner | Center of view for 2.5 s at quake start, then shrinks into the HUD row |
| Arrow | At the edge of the view nearest the safe zone, 4 cm, green, pointing toward it |
| Result panel | 110 cm in front of the head when shown |
| Buttons | UI Kit Button, at least 12 × 5 cm, within easy reach below eye level |

### 6.2 Motion and sound

- Shake: the room node moves with layered noise, 2.5 cm and 1.2° at peak (default), ramping up over the first 3 s and down over the last 3 s.
- Rumble: one low looping sound, ramping with the shake. It is ambience, not a direction cue (the learner replaced the direction cue with the arrow).
- Feedback: health bar pulses red while draining. Instruction text changes with a short fade, no bouncing.

## 7. Comfort checklist (from the pack's AR design rules)

- [ ] Main content between 60 and 160 cm, a little below eye level.
- [ ] Everything needed during the task is in view; the arrow covers the safe zone when it is not.
- [ ] Text light and readable from the user's position.
- [ ] Things show when needed and hide after (banner, arrow, briefing instruction).
- [ ] A few big targets only: Continue and Restart.
- [ ] No UI behind the shoulder; nothing stuck to the face.

## 8. Timeline

See `ENGINEERING_PLAN.md`. Design reviews happen at each slice checkpoint, on preview screenshots.
