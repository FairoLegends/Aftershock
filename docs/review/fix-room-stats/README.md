# Fix the room: what fastening changes, over 30 seeded rooms

Measured 5 Nov 2026 on HEAD `3ac68c1`. Level **Normal**, seeds **1..30** (each seed used as both `layoutSeed` and `planSeed`).

## What this measures

This is a property of the **quake plan**: how many objects fall or topple in a room, and how many of those fastening removes. It does **not** measure people: it says nothing about how often a player is hit, because a hit also depends on where the player stands (a falling item only hurts a head that is inside its danger zone and not under cover). So these are "falls prevented", not "injuries prevented".

## How it was counted

The counts come from the Lens's own pure modules (`LayoutGenerator.ts`, `DrillPlan.ts`, `Levels.ts`), bundled unchanged and run outside Lens Studio, with every number read from `DrillConfig.ts`. The counting follows `DrillController`:

- Items fall only from `FALL_SOURCES` (`FallingObjects.ts:21`: the **shelf**) when the shelf is in the room's hazards (`scheduleFalls`), 1–3 per shake (`fallCountMin`/`fallCountMax`), through `planFalls`.
- The **TV** topples once per drill when it is a hazard and not fastened (`canTopple`); it lands within the quake (25–75 % of the shake plus 0.5 s) and counts as "landed" (`landTv` → `onItemLanded`).
- The aftershock shake happens when the plan's draw is below `normalAftershockChance` (0.5).
- `FIXABLE` is shelf, cabinet and TV (`DrillController.ts:75`). The **cabinet drops nothing** (it is not a fall source), so fastening it changes no count.

Check against a real drill: the demo take (layout seed 208930688, plan seed 1066210688) gives **5 landed, 1 after fastening the shelf** here, the same as the Lens's own log for that take (`landed 5 -> 1 (4 of 5 prevented)`).

## Totals

| | Falls | Prevented |
|---|---|---|
| No fix | **82** (54 from the shelf, 28 TV topples) | |
| Shelf fastened | 28 still land (all TV topples) | **54 of 82** (66 %) |
| Shelf and TV fastened (every fixable item in the room) | 0 | **82 of 82** (100 %) |

- Rooms with a shelf: 22 of 30. Rooms with a TV: 28 of 30. Rooms with an aftershock: 15 of 30. Layouts that fell back to the fixed room: 0.
- Every room had at least one fall without a fix. After fastening every fixable item, 30 of 30 rooms had none.
- Median per room: 2.5 falls without a fix; 2 prevented by the shelf alone.
- In the 8 rooms without a shelf, fastening the shelf is not possible; their only fall is the TV.

For comparison, on **Hard** (aftershock every time) over the same seeds: 109 falls (81 shelf, 28 TV); the shelf alone prevents 81 of 109, shelf and TV all 109.

## Per seed (Normal)

| Seed | Shelf | TV | Aftershock | No fix | Shelf fastened | All fixable fastened |
|---|---|---|---|---|---|---|
| 1 | yes | yes | no | 2 | 1 | 0 |
| 2 | no | yes | yes | 1 | 1 | 0 |
| 3 | yes | yes | yes | 5 | 1 | 0 |
| 4 | no | yes | yes | 1 | 1 | 0 |
| 5 | yes | yes | yes | 5 | 1 | 0 |
| 6 | yes | yes | no | 2 | 1 | 0 |
| 7 | yes | no | no | 2 | 0 | 0 |
| 8 | no | yes | yes | 1 | 1 | 0 |
| 9 | yes | yes | yes | 6 | 1 | 0 |
| 10 | yes | yes | no | 3 | 1 | 0 |
| 11 | yes | yes | no | 3 | 1 | 0 |
| 12 | yes | yes | no | 2 | 1 | 0 |
| 13 | yes | yes | yes | 3 | 1 | 0 |
| 14 | yes | yes | no | 3 | 1 | 0 |
| 15 | yes | yes | yes | 5 | 1 | 0 |
| 16 | no | yes | no | 1 | 1 | 0 |
| 17 | yes | yes | no | 4 | 1 | 0 |
| 18 | yes | yes | no | 3 | 1 | 0 |
| 19 | yes | yes | yes | 4 | 1 | 0 |
| 20 | yes | yes | no | 2 | 1 | 0 |
| 21 | no | yes | yes | 1 | 1 | 0 |
| 22 | no | yes | yes | 1 | 1 | 0 |
| 23 | no | yes | no | 1 | 1 | 0 |
| 24 | yes | yes | yes | 4 | 1 | 0 |
| 25 | yes | yes | no | 2 | 1 | 0 |
| 26 | yes | yes | no | 3 | 1 | 0 |
| 27 | yes | no | yes | 3 | 0 | 0 |
| 28 | yes | yes | no | 2 | 1 | 0 |
| 29 | no | yes | yes | 1 | 1 | 0 |
| 30 | yes | yes | yes | 6 | 1 | 0 |
| **Total** | **22** | **28** | **15** | **82** | **28** | **0** |

## Status

The numbers above are computed by the orchestrator from the Lens's own modules. The LEAF scenario that reproduces and checks them inside Lens Studio (`DC30_FixRoomStats`) is still to be written through a CLAD session.

## Reproduce

From the repo root, with Node 18 or newer (esbuild is fetched by `npx`):

```
node tools/fix-room-stats/fixroom_stats.mjs                              # Normal, seeds 1..30: this table and the totals
node tools/fix-room-stats/fixroom_stats.mjs hard 1 30                    # another level or seed range
node tools/fix-room-stats/fixroom_stats.mjs check 208930688 1066210688   # one drill (the demo take): 5 landed, 1 with the shelf fastened
```

The script bundles `LayoutGenerator.ts`, `DrillPlan.ts` and `Levels.ts` unchanged and reads every number from `DrillConfig.ts`, `FALL_SOURCES` from `FallingObjects.ts` and `FIXABLE` from `DrillController.ts`, so a change to any of them changes the counts.
