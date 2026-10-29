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
  @hint("How long the warning banner shows, in seconds")
  warningShowSeconds: number = 2.5
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
  @hint("Danger zone = hazard footprint grown by this margin (cm)")
  dangerMargin: number = 60

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
}
