# User Flow Diagram: Aftershock

> Updated 31 Oct 2026 to match the build at 5b4958e (Slices 8-12B).

Built the way Adobe's guide describes (https://business.adobe.com/blog/basics/how-to-make-a-user-flow-diagram): one user goal, a clear entry point, every step and decision on the way, and the final action, drawn from the user's point of view.

- **User:** anyone (family at home, a school student, an office worker) practicing an earthquake drill.
- **Goal:** take cover under a table, duck, and hold on until the shaking stops, then get out through the door.
- **Entry point:** the Lens opens.
- **Success:** the score screen after the evacuation (door reached, or the 30 s limit). **Failure:** the game-over screen. Restart opens the level picker (5j-19a); Change language opens the language picker, then the level picker (Slice 10B). The safety reminder shows once per session.

Legend: rounded box = what the user sees, diamond = a check the Lens makes, parallelogram = what the user does.

> States: `LANGUAGE → SAFETY → LEVEL → CALIBRATE → BRIEFING (scan) → QUAKE → POST_QUAKE → [AFTERSHOCK → POST_QUAKE] → EVACUATE → RESULT` or `GAME_OVER`; Restart → `LEVEL`; Change language → `LANGUAGE → LEVEL`. Restart keeps the language and preselects the level.

## 1. Main flow

```mermaid
flowchart TD
    A([Lens opens]) --> A1[Language picker<br/>five buttons]
    A1 --> A2[/Pinch a language/]
    A2 --> B[Safety reminder<br/>drill, not a real alert · make sure the room is safe]
    B --> C[/Pinch Continue/]
    C --> LV[Level picker<br/>easy · normal · hard]
    LV --> LV2[/Pinch a level/]
    LV2 --> CA[Duck practice<br/>try ducking now · or Skip]
    CA --> D[Room appears around the user at real size<br/>walls + exit door · 1–2 tables · 3–5 hazards · bed · chair<br/>scan sweep · hazard labels + safe-zone markers · not on Hard<br/>instruction: know the hazards, remember the safe zone]
    D --> E{{Random wait ends?}}
    E -- not yet --> D
    E -- yes --> F[Quake starts without warning<br/>room shakes · rumble · short GEMPA! / EARTHQUAKE! banner<br/>then HUD: steps · health bar · timer · marker blinks<br/>labels shrink to ⚠ on Normal]
    F --> G{{Safe zone in view?}}
    G -- no --> H[Small arrow points to the nearest table<br/>not on Hard] --> I
    G -- yes --> I{{Head inside a safe zone?}}
    I -- no --> J[Step 01: Go under the table] --> K[/Walk: WASD in preview/] --> L
    I -- yes --> M{{Ducked? head height}}
    M -- no --> N[Step 02: Duck down] --> O[/Duck: Q/E in preview/] --> L
    M -- yes --> P[Step 03: Hold on<br/>hold the table leg: pinch and hold a grip] --> L
    L{{Draining? stood up after cover · in a danger zone · not holding the grip}}
    L -- yes --> Q[Health drops little by little<br/>red edge pulse · score penalty grows]
    L -- no --> R[Health holds]
    Q --> S{{Health = 0?}}
    S -- yes --> T[Game over screen<br/>what went wrong · cards · Restart · Change language]
    S -- no --> U
    R --> U{{Shake time over?}}
    U -- no --> G
    U -- yes --> V[Shaking stops<br/>instruction: come out from under the table]
    V --> W{{User left the safe zone?}}
    W -- no --> V
    W -- yes --> AS{{Aftershock? easy never · normal 50% · hard always · once}}
    AS -- yes --> F2[Aftershock after 2–6 s<br/>GEMPA SUSULAN! / AFTERSHOCK! · steps again<br/>the window glass breaks] --> G
    AS -- no --> EV[Step 04: Get out<br/>walk to the exit door within 30 s · avoid red zones and items on the floor]
    EV --> X[Score screen<br/>cover time · health · hold · evacuation · score · best<br/>education cards · Restart · Change language]
    T --> Y[/Pinch Restart/]
    X --> Y
    Y --> LV
    T --> Z[/Pinch Change language/]
    X --> Z
    Z --> A1
```

Falls happen inside the quake and aftershock loop (not on Easy): books and boxes from the shelf, and the TV topples once per drill; a hit costs health only inside the hazard's danger zone and not under a table. After Change language, the language pick goes straight to the level picker (no safety reminder). Health 0 in the aftershock or the evacuation also leads to the game-over screen.

## 2. States (for the build)

```mermaid
stateDiagram-v2
    [*] --> LANGUAGE
    LANGUAGE --> SAFETY: first pick this session
    LANGUAGE --> LEVEL: pick after Change language
    SAFETY --> LEVEL: Continue pinched
    LEVEL --> CALIBRATE: level pinched
    CALIBRATE --> BRIEFING: ducked once or Skip
    BRIEFING --> QUAKE: scan, then random wait ends
    QUAKE --> GAME_OVER: health reaches 0
    QUAKE --> POST_QUAKE: quake time over
    POST_QUAKE --> AFTERSHOCK: head leaves safe zone, aftershock rolled
    AFTERSHOCK --> POST_QUAKE: aftershock time over
    AFTERSHOCK --> GAME_OVER: health reaches 0
    POST_QUAKE --> EVACUATE: head leaves safe zone, no aftershock left
    EVACUATE --> RESULT: door reached or 30 s
    EVACUATE --> GAME_OVER: health reaches 0
    RESULT --> LEVEL: Restart pinched
    GAME_OVER --> LEVEL: Restart pinched
    RESULT --> LANGUAGE: Change language pinched
    GAME_OVER --> LANGUAGE: Change language pinched
```

## 3. What is visible in each step

| Step | Visible | Hidden |
|---|---|---|
| Language picker | Five language buttons, title in all five languages | Room, HUD, results |
| Safety reminder | Reminder panel, Continue | Room labels, HUD, arrow, results |
| Level picker | Three level cards (current preselected) | Room labels, HUD, results |
| Duck practice | "Try ducking now", Skip, then "Good, that's how" | Room, HUD, results |
| Briefing | Room with walls and door, scan sweep, hazard labels, safe-zone markers (steady), faint floor path, briefing instruction (Hard: room only) | HUD, arrow, results |
| Quake / aftershock | Shaking room, warning banner (first 1.2 s), then HUD (steps, health bar, timer; notices in the step row), blinking markers, labels as ⚠ (Normal) or full (Easy), floor path and arrow (only when the zone is out of view), red edge pulse while draining, falling items, cracks | Reminder, results; on Hard every guide |
| After the quake | Room at rest, steady markers, "come out" instruction | Banner, arrow |
| Evacuation | Step 04, exit door label, arrow and floor path to the door (not on Hard), fallen items and shards on the floor | Banner |
| Score / game over | Result panel (score parts, best, cards), Restart, Change language; on Hard the reveal of safe and dangerous items | HUD, arrow |

## 4. Friction points to watch in testing

1. **The safe zone behind the user.** The arrow is the only cue. Check that it appears and reads in under a second.
2. **Knowing what to do after the shaking.** The "come out" instruction (PRD Q2), then step 04 and the path to the door.
3. **Standing up by accident.** Hysteresis on the duck check (TDD §5) stops flicker between "duck" and "hold".
4. **Restart target.** The level picker with the current level preselected, one pinch to keep it (5j-19a; was straight to the room, PRD Q1).
5. **Doing nothing.** Because the stand-up drain starts only after taking cover once (PRD Q5), a user who never takes cover loses no health from it (danger zones, falls and glass still can). The result screen says so and the score is 0, evacuation included (PRD Q6, learner 5l-4b).
