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
  @hint("Ducked when head Y is this far below the baseline (cm)")
  duckDrop: number = 40

  @input
  @hint("Standing again only above baseline - duckDrop + this (cm)")
  duckHysteresis: number = 10

  @input
  @hint("Safe zone = table footprint grown by this margin (cm)")
  safeZoneMargin: number = 15

  @input
  @hint("inZone and ducked must hold this long to count as safe, in seconds")
  safeHoldSeconds: number = 1
  @ui.group_end

  @ui.group_start("Health")
  @input
  @hint("Health at the start of each drill (points)")
  healthStart: number = 100

  @input
  @hint("Health lost per second while exposed (points per second)")
  healthDrainPerSecond: number = 4
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
  hudBelowEye: number = 10

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
