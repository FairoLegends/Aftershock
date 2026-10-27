# User Flow Diagram: Aftershock

Built the way Adobe's guide describes (https://business.adobe.com/blog/basics/how-to-make-a-user-flow-diagram): one user goal, a clear entry point, every step and decision on the way, and the final action, drawn from the user's point of view.

- **User:** anyone (family at home, a school student, an office worker) practicing an earthquake drill.
- **Goal:** take cover under the table, duck, and hold on until the shaking stops.
- **Entry point:** the Lens opens.
- **Success:** the score screen after leaving the safe zone. **Failure:** the game-over screen. Both lead back to the room through Restart (Q1). The safety reminder shows only when the Lens opens.

Legend: rounded box = what the user sees, diamond = a check the Lens makes, parallelogram = what the user does.

## 1. Main flow

```mermaid
flowchart TD
    A([Lens opens]) --> B[Safety reminder<br/>drill, not a real alert · make sure the room is safe]
    B --> C[/Pinch Continue/]
    C --> D[Room appears around the user at real size<br/>table, cabinet, shelf, glass window<br/>hazard labels + safe-zone marker under the table<br/>instruction: know the hazards, remember the safe zone]
    D --> E{{Random wait ends?}}
    E -- not yet --> D
    E -- yes --> F[Quake starts without warning<br/>room shakes · rumble · GEMPA! / EARTHQUAKE!<br/>marker blinks · health bar + timer]
    F --> G{{Safe zone in view?}}
    G -- no --> H[Small arrow points to the safe zone] --> I
    G -- yes --> I{{Head inside the safe zone?}}
    I -- no --> J[Instruction: Go under the table] --> K[/Walk: WASD in preview/] --> L
    I -- yes --> M{{Ducked? head height}}
    M -- no --> N[Instruction: Duck down] --> O[/Duck: Q/E in preview/] --> L
    M -- yes --> P[Instruction: Hold until the shaking stops] --> L
    L{{Exposed? took cover once, now not in zone and ducked}}
    L -- yes --> Q[Health drops little by little<br/>score penalty grows]
    L -- no --> R[Health holds]
    Q --> S{{Health = 0?}}
    S -- yes --> T[Game over screen<br/>what went wrong + Restart]
    S -- no --> U
    R --> U{{Quake time over? 45–60 s}}
    U -- no --> G
    U -- yes --> V[Shaking stops<br/>instruction: come out from under the table]
    V --> W{{User left the safe zone?}}
    W -- no --> V
    W -- yes --> X[Score screen<br/>time to cover · health left · score + Restart]
    T --> Y[/Pinch Restart/]
    X --> Y
    Y --> D
```

## 2. States (for the build)

```mermaid
stateDiagram-v2
    [*] --> SAFETY
    SAFETY --> BRIEFING: Continue pinched
    BRIEFING --> QUAKE: random wait ends
    QUAKE --> GAME_OVER: health reaches 0
    QUAKE --> POST_QUAKE: quake time over
    POST_QUAKE --> RESULT: head leaves safe zone
    RESULT --> BRIEFING: Restart pinched
    GAME_OVER --> BRIEFING: Restart pinched
```

## 3. What is visible in each step

| Step | Visible | Hidden |
|---|---|---|
| Safety reminder | Reminder panel, Continue | Room labels, HUD, arrow, results |
| Briefing | Room, hazard labels, safe-zone marker (steady), briefing instruction | HUD, arrow, results |
| Quake | Shaking room, labels, blinking marker, warning banner (first seconds), instruction, health bar, timer, arrow (only when the zone is out of view) | Reminder, results |
| After the quake | Room at rest, steady marker, "come out" instruction | Banner, arrow |
| Score / game over | Result panel with Restart | HUD, arrow |

## 4. Friction points to watch in testing

1. **The safe zone behind the user.** The arrow is the only cue. Check that it appears and reads in under a second.
2. **Knowing that leaving the zone shows the score.** The "come out" instruction covers it (PRD Q2).
3. **Standing up by accident.** Hysteresis on the duck check (TDD §5) stops flicker between "duck" and "hold".
4. **Restart target.** Straight back to the room (PRD Q1, learner).
5. **Doing nothing.** Because health drains only after taking cover once (PRD Q5), a user who never takes cover loses no health. The result screen says so and the score is 0 (PRD Q6, default).
