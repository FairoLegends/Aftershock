// Every drill tunable (TDD §5). Distances are cm; other units are noted per field.
// Values are the TDD defaults; change them only through the orchestrator.

@component
export class DrillConfig extends BaseScriptComponent {
  @ui.label("Aftershock drill tunables (TDD §5)")
  @ui.separator
  @ui.group_start("Quake timing")
  @input
  @hint("Shortest quake, in seconds")
  quakeDurationMin: number = 45

  @input
  @hint("Longest quake, in seconds")
  quakeDurationMax: number = 60

  @input
  @hint("Shortest random wait before the quake, in seconds")
  quakeWaitMin: number = 8

  @input
  @hint("Longest random wait before the quake, in seconds")
  quakeWaitMax: number = 15

  @input
  @hint("How long the warning banner shows, in seconds (5m-1: 2.5 → 1.2; the HUD panel appears only after it)")
  warningShowSeconds: number = 1.2
  @ui.group_end

  @ui.group_start("Warning banner")
  @input
  @hint("Banner center this far above the center of view, in degrees, at hudDistance along the head's forward (5m-9: it follows the head's pitch; looking level it clears a 180 cm cabinet seen from the start spot)")
  warnAboveGazeDeg: number = 8

  @input
  @hint("Lowest head pitch the banner follows, in degrees (5m-9: looking further down, it stays here, off the floor)")
  warnPitchMinDeg: number = -50

  @input
  @hint("Highest head pitch the banner follows, in degrees (5m-9: looking further up, it stays here, off the ceiling)")
  warnPitchMaxDeg: number = 30

  @input
  @hint("Banner text width (cm, 5m-1: 40 → 30)")
  warnWidthCm: number = 30

  @input
  @hint("Banner main line em size (cm, 5m-1: one step smaller)")
  warnEmCm: number = 6.5

  @input
  @hint("Banner fill: alarm red #FF5A4F at 88% (mockup .banner), no border. Light colors only: the display is additive.")
  @widget(new ColorWidget())
  warnFill: vec4 = new vec4(1, 0.353, 0.31, 0.88)
  @ui.group_end

  @ui.group_start("Take cover")
  @input
  @hint("Ducked when head Y is this far below the baseline (cm). 90 puts the head under the 75 cm table top (learner, 27 Oct).")
  duckDrop: number = 90

  @input
  @hint("Standing again only above baseline - duckDrop + this (cm)")
  duckHysteresis: number = 10

  @input
  @hint("Safe zone = table footprint grown by this margin (cm)")
  safeZoneMargin: number = 15

  @input
  @hint("inZone and ducked must hold this long to count as safe, in seconds")
  safeHoldSeconds: number = 1

  @input
  @hint("Safe-zone marker blink rate during the quake, in Hz (DESIGN_BRIEF §6)")
  markerBlinkHz: number = 2
  @ui.group_end

  @ui.group_start("Health")
  @input
  @hint("Health at the start of each drill (points)")
  healthStart: number = 100

  @input
  @hint("Health lost per second while exposed (points per second)")
  healthDrainPerSecond: number = 4

  @input
  @hint("Health bar turns alarm red below this (points, DESIGN_BRIEF §5.1)")
  healthAlarmBelow: number = 30
  @ui.group_end

  @ui.group_start("Shake")
  @input
  @hint("Room position shake amplitude (cm)")
  shakeAmplitudeCm: number = 2.5

  @input
  @hint("Room tilt shake amplitude, in degrees")
  shakeTiltDeg: number = 1.2

  @input
  @hint("Lowest layered shake frequency, in Hz")
  shakeFrequencyMinHz: number = 2

  @input
  @hint("Highest layered shake frequency, in Hz")
  shakeFrequencyMaxHz: number = 6

  @input
  @hint("Shake ramps up over the first and down over the last this many seconds (DESIGN_BRIEF §6.2)")
  shakeRampSeconds: number = 3
  @ui.group_end

  @ui.group_start("View and HUD")
  @input
  @hint("Half the horizontal view angle, in degrees (Specs view about 32°)")
  fovHalfAngleHorizontal: number = 16

  @input
  @hint("Half the vertical view angle, in degrees (Specs view about 37°)")
  fovHalfAngleVertical: number = 18.5

  @input
  @hint("Distance of panels and HUD in front of the head (cm)")
  hudDistance: number = 110

  @input
  @hint("Panels and HUD sit this far below eye level (cm)")
  hudBelowEye: number = 22

  @input
  @hint("Result / game-over panel center sits this far below eye level (cm). Smaller than hudBelowEye so the taller panel, Restart included, stays in view with the head level (ENGINEERING_PLAN 5i item 4).")
  resultBelowEye: number = 10

  @input
  @hint("A newly shown panel ignores button presses for this long, in seconds (ENGINEERING_PLAN 5h item 1)")
  pinchGuardSeconds: number = 0.5

  @input
  @hint("Timer shows elapsed time since the quake started (learner, Q3)")
  @widget(new ComboBoxWidget([new ComboBoxItem("Elapsed", "elapsed")]))
  timerMode: string = "elapsed"
  @ui.group_end

  @ui.group_start("HUD contrast (Slice 13A, ENGINEERING_PLAN 5m item 11)")
  @input
  @hint("Upcoming step number text (02, 03, 04). Bright and opaque: on the additive display a see-through white vanishes on the light backing.")
  @widget(new ColorWidget())
  hudStepNumberColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Upcoming step name text (Merunduk, Tahan, Keluar)")
  @widget(new ColorWidget())
  hudStepNameColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Done step number and name text: brand green SOFT_GREEN at full alpha, with the secondary outline (5m-11a). The pale done fill and no border keep it apart from the active step.")
  @widget(new ColorWidget())
  hudStepDoneColor: vec4 = new vec4(0.239, 0.863, 0.518, 1)

  @input
  @hint("Done step cell opacity (was 0.45)")
  @widget(new SliderWidget(0, 1, 0.05))
  hudStepDoneAlpha: number = 1

  @input
  @hint("Health and time labels (Nyawa, Waktu)")
  @widget(new ColorWidget())
  hudLabelColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Outline of the step and label texts. Dark only as a thin edge, never a panel or shadow (the display is additive).")
  @widget(new ColorWidget())
  hudSecondaryOutlineColor: vec4 = new vec4(0.12, 0.14, 0.18, 1)

  @input
  @hint("Outline strength of the step and label texts, 0 (none) to 1 (very strong)")
  @widget(new SliderWidget(0, 1, 0.05))
  hudSecondaryOutlineSize: number = 0.35

  @input
  @hint("Upcoming step cell fill. Light only: each of r, g, b at least 0.5.")
  @widget(new ColorWidget())
  hudStepFill: vec4 = new vec4(0.6, 0.66, 0.74, 0.35)

  @input
  @hint("Done step cell fill: pale green. Light only: each of r, g, b at least 0.5.")
  @widget(new ColorWidget())
  hudStepDoneFill: vec4 = new vec4(0.62, 0.94, 0.76, 0.2)

  @input
  @hint("Active step cell fill (green), with the green outline")
  @widget(new ColorWidget())
  hudStepOnFill: vec4 = new vec4(0.239, 0.863, 0.518, 0.22)

  @input
  @hint("Health bar track behind the fill. Light only.")
  @widget(new ColorWidget())
  hudBarTrack: vec4 = new vec4(1, 1, 1, 0.18)
  @ui.group_end

  @ui.group_start("Room labels")
  @input
  @hint("A hazard label's bottom sits this far above its item's top (cm, 5m-3): over the wall or air, never over the wood")
  labelGapCm: number = 10

  @input
  @hint("A hazard label's center may be at most this high above the floor (cm); higher, it goes beside the item on the wall (e.g. the window). Decided once per drill at labelEmMaxCm (5m-8a).")
  labelMaxCenterCm: number = 205

  @input
  @hint("Beside a tall item (5m-8b): the label's center sits this high above the floor (cm, about eye level), never above the item's top")
  labelBesideCenterCm: number = 150

  @input
  @hint("Smallest label em size (cm), for a head close by")
  labelEmMinCm: number = 2.4

  @input
  @hint("Label em size per metre from the head to the label (cm per m): about 1.3° of view at any distance")
  labelEmPerMeterCm: number = 2.2

  @input
  @hint("Largest label em size (cm), for a head far away")
  labelEmMaxCm: number = 6

  @input
  @hint("The 'Zona bahaya' line's em, as a share of the hazard line's em")
  labelDangerEmRatio: number = 0.62

  @input
  @hint("Height of the ⚠ icon (hazards), as a multiple of the label em; the safe-zone and door dot is half of it")
  labelIconPerEm: number = 1.5

  @input
  @hint("Label backing: white at this opacity (5m-3). Never dark: the display is additive.")
  labelBackingAlpha: number = 0.6

  @input
  @hint("Normal, quake to evacuation (5m-4 risotto): a label collapsed to its ⚠ grows back while the head looks within this angle of it, in degrees")
  labelFocusDeg: number = 10

  @input
  @hint("…or while the head is closer to it than this (cm)")
  labelNearCm: number = 150
  @ui.group_end

  @ui.group_start("Room")
  @input
  @hint("Floor sits this far below the head's start height (cm). The preview starts the head at Y = 0.")
  eyeHeight: number = 160
  @ui.group_end

  @ui.group_start("Fonts")
  @input
  @hint("Japanese font for every ja line (Fonts/NotoSansJP-Aftershock.ttf). The default font has no CJK glyphs.")
  fontJa: Font

  @input
  @hint("Simplified Chinese font for every zh line (Fonts/NotoSansSC-Aftershock.ttf)")
  fontZh: Font
  @input
  @hint("Latin font for every id/en/de line, title and number (Fonts/Manrope-Aftershock.ttf, 600; Slice 7A-soft: one family)")
  fontBody: Font

  @input
  @hint("Extra-bold Latin font for the red hazard line in id/en/de (Fonts/Manrope-Aftershock-ExtraBold.ttf, 800; 5m-3). ja/zh keep fontJa/fontZh.")
  fontHazard: Font
  @ui.group_end

  @ui.group_start("Layout and danger zones")
  @input
  @hint("Closest a table center may be to the start spot (cm)")
  tableDistanceMin: number = 120

  @input
  @hint("Farthest a table center may be from the start spot (cm). ShakeOut: do not run far.")
  tableDistanceMax: number = 250

  @input
  @hint("Closest any other item center (hazards, bed, chair) may be to the start spot (cm)")
  hazardDistanceMin: number = 140

  @input
  @hint("Farthest any other item center (hazards, bed, chair) may be from the start spot (cm)")
  hazardDistanceMax: number = 300

  @input
  @hint("Fewest tables per drill (1 or 2)")
  tableCountMin: number = 1

  @input
  @hint("Most tables per drill (1 or 2)")
  tableCountMax: number = 2

  @input
  @hint("Fewest hazards per drill, drawn from cabinet, shelf, glass, lamp, TV")
  hazardCountMin: number = 3

  @input
  @hint("Most hazards per drill (no kind twice, so at most 5)")
  hazardCountMax: number = 5

  @input
  @hint("Danger zone = hazard footprint grown by this margin (cm): to the front and sides only for a wall-backed hazard, never past the walls")
  dangerMargin: number = 60

  @input
  @hint("TV danger zone reach in front of the TV (cm): it topples forward and its top lands about 110 · sin 85° ≈ 110 cm past its front edge")
  tvDangerFront: number = 140

  @input
  @hint("No furniture or danger zone within this radius of the start spot (cm)")
  startClearRadius: number = 50

  @input
  @hint("0 = new random layout every start and Restart; any other number = the same layout every time (for filming)")
  layoutSeed: number = 0

  @input
  @hint("The arrow switches to another table only when it is this much nearer (cm)")
  tableSwitchHysteresis: number = 30
  @ui.group_end

  @ui.group_start("Bed and fair score")
  @input
  @hint("Ducking within the bed footprint grown by this shows the bed warning (cm)")
  bedWarnMargin: number = 30

  @input
  @hint("How long the bed warning stays up, in seconds")
  bedWarnSeconds: number = 2.5

  @input
  @hint("Walking speed for the fair score: nearest table distance ÷ this is forgiven from tSafe (cm/s)")
  walkSpeed: number = 100
  @ui.group_end

  @ui.group_start("Scan, path and edge warning (Slice 7B)")
  @input
  @hint("Scan intro length at the start of BRIEFING, in seconds. The quake wait starts after it.")
  scanSeconds: number = 3

  @input
  @hint("Floor path chevron spacing (cm)")
  pathSpacing: number = 25

  @input
  @hint("Floor path height above the floor (cm)")
  pathLift: number = 2

  @input
  @hint("Chevrons march toward the table at this speed during the quake (cm/s)")
  pathMarchSpeed: number = 60

  @input
  @hint("Floor path opacity during BRIEFING (0 to 1); full during the quake")
  pathFaintOpacity: number = 0.35

  @input
  @hint("Red edge warning pulse while health drains, in Hz")
  edgePulseHz: number = 1.5

  @input
  @hint("Share of the view, per axis, the edge warning leaves clear in the middle (0 to 1)")
  edgeClearFraction: number = 0.7
  @ui.group_end

  @ui.group_start("Levels (Slice 7C, ENGINEERING_PLAN 5j item 18)")
  @input
  @hint("Easy: farthest a table center may be from the start spot (cm)")
  easyTableMax: number = 150

  @input
  @hint("Normal: chance of an aftershock after the main quake (0 to 1). Easy never, Hard always.")
  normalAftershockChance: number = 0.5

  @input
  @hint("Hard: health drains this many times faster")
  hardDrainMultiplier: number = 1.5
  @ui.group_end

  @ui.group_start("Aftershock (Slice 7C, ENGINEERING_PLAN 5j item 7)")
  @input
  @hint("Shortest quiet wait after leaving the zone before the aftershock, in seconds")
  aftershockDelayMin: number = 2

  @input
  @hint("Longest quiet wait after leaving the zone before the aftershock, in seconds")
  aftershockDelayMax: number = 6

  @input
  @hint("Shortest aftershock, in seconds")
  aftershockDurationMin: number = 10

  @input
  @hint("Longest aftershock, in seconds")
  aftershockDurationMax: number = 20

  @input
  @hint("Aftershock shake as a share of the main quake's amplitude and tilt (0 to 1)")
  aftershockStrength: number = 0.6
  @input
  @hint("Aftershock: seconds after it starts before not being safe drains health (it drains sooner once under cover again), 5j-19c")
  aftershockGraceSeconds: number = 5
  @ui.group_end

  @ui.group_start("Falling objects (Slice 7D, ENGINEERING_PLAN 5j items 8, 17e)")
  @input
  @hint("Fewest items that fall during each quake and aftershock (Normal and Hard; Easy has none)")
  fallCountMin: number = 1

  @input
  @hint("Most items that fall during each quake and aftershock")
  fallCountMax: number = 3

  @input
  @hint("Items fall no sooner than this after the shake starts and no later than this before it ends, in seconds")
  fallMarginSeconds: number = 3

  @input
  @hint("An item landing within this distance (XZ) of the head hits it, unless the head is safe under a table (cm)")
  fallHitRadius: number = 40

  @input
  @hint("Health lost when an item hits the head (points)")
  fallHitDamage: number = 15

  @input
  @hint("How long the hit.fell notice stays up, in seconds")
  fallNoticeSeconds: number = 2
  @ui.group_end

  @ui.group_start("Evacuation (Slice 8B, ENGINEERING_PLAN 5k item 8)")
  @input
  @hint("Time to reach the door after the last shake before the evacuation fails, in seconds")
  evacSeconds: number = 30

  @input
  @hint("The floor path and arrow aim at a point this far in front of the door (cm)")
  evacDoorOffset: number = 40

  @input
  @hint("Stepping within this distance (XZ) of a fallen item is a trip (cm)")
  tripRadius: number = 25

  @input
  @hint("Health lost per trip, once per item (points)")
  tripDamage: number = 10

  @input
  @hint("How long the warn.trip notice stays up, in seconds")
  tripNoticeSeconds: number = 2
  @ui.group_end

  @ui.group_start("Hold on (Slice 8B, ENGINEERING_PLAN 5k item 9)")
  @input
  @hint("Normal and Hard: safe but not holding the table leg longer than this starts the grip drain, in seconds")
  gripGraceSeconds: number = 3

  @input
  @hint("Health lost per second while safe and not holding (points per second). Never stacks: the bigger drain wins.")
  gripDrainPerSecond: number = 1

  @input
  @hint("Grip handle marker size (cm)")
  gripHandleSize: number = 8

  @input
  @hint("Grip handle height above the floor (cm)")
  gripHandleHeight: number = 40
  @ui.group_end

  @ui.group_start("Duck practice (Slice 8D, ENGINEERING_PLAN 5k item 7)")
  @input
  @hint("The head must stay at or below the duck line this long to count as one duck, in seconds")
  calibHoldSeconds: number = 0.4

  @input
  @hint("How long calib.done shows before BRIEFING, in seconds")
  calibDoneSeconds: number = 1.2
  @ui.group_end

  @ui.group_start("Ghost replay (Slice 13B, ENGINEERING_PLAN 5m item 12)")
  @input
  @hint("The head's floor point is sampled this often from QUAKE until the drill ends, in seconds")
  replaySampleSeconds: number = 0.1

  @input
  @hint("Replay draws the whole trail in this many seconds, whatever the drill length")
  replaySeconds: number = 8

  @input
  @hint("The full trail stays this long after it is drawn, then the result panel comes back, in seconds")
  replayHoldSeconds: number = 2

  @input
  @hint("Trail points closer than this to the last kept one are dropped (cm); a change in or out of danger is always kept")
  replaySimplifyCm: number = 8

  @input
  @hint("Trail ribbon width (cm)")
  replayLineWidthCm: number = 4

  @input
  @hint("Trail and markers sit this far above the floor (cm), clear of z-fighting")
  replayLiftCm: number = 0.5

  @input
  @hint("A small dot on the trail every this many cm")
  replayDotSpacingCm: number = 30

  @input
  @hint("Landed, hit and cover marker size (cm)")
  replayMarkerCm: number = 18
  @ui.group_end

  @ui.group_start("Test hooks")
  @input
  @hint("Short wait and short quake for LEAF scenarios. Off in the real drill.")
  testMode: boolean = false

  @input
  @hint("Wait before the quake when testMode is on, in seconds")
  testWaitSeconds: number = 1

  @input
  @hint("Quake duration when testMode is on, in seconds")
  testDurationSeconds: number = 8

  @input
  @hint("Scan intro length when testMode is on, in seconds")
  testScanSeconds: number = 0.5

  @input
  @hint("Quiet wait before the aftershock when testMode is on, in seconds")
  testAftershockDelaySeconds: number = 0.5

  @input
  @hint("Aftershock duration when testMode is on, in seconds")
  testAftershockDurationSeconds: number = 4
  @input
  @hint("Aftershock grace (aftershockGraceSeconds) when testMode is on, in seconds")
  testAftershockGraceSeconds: number = 1

  @input
  @hint("Evacuation time (evacSeconds) when testMode is on, in seconds")
  testEvacSeconds: number = 6

  @input
  @hint("Grip grace (gripGraceSeconds) when testMode is on, in seconds")
  testGripGraceSeconds: number = 0.5
}
