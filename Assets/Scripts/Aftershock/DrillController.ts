import {BriefingPanel} from "./BriefingPanel"
import {DANGER_LABEL_HALF_H, DangerZone} from "./DangerZone"
import {DrillConfig} from "./DrillConfig"
import {EdgeWarning} from "./EdgeWarning"
import {FALL_SOURCES, FallFrom, FallingObjects, FallSource} from "./FallingObjects"
import {FloorPath} from "./FloorPath"
import {HazardLabel} from "./HazardLabel"
import {HeadPose} from "./HeadPose"
import {Hud} from "./Hud"
import {LanguagePanel} from "./LanguagePanel"
import {ALL_ITEMS, FOOTPRINTS, generateLayout, HAZARDS, insideRect, Layout, LayoutForce, LayoutItem, Placement, TABLES} from "./LayoutGenerator"
import {LevelPanel} from "./LevelPanel"
import {
  aftershockChance,
  DEFAULT_LEVEL,
  drainMultiplier,
  fallsOn,
  guidesOn,
  labelsStayInQuake,
  layoutParamsFor,
  Level,
  levelNameKey
} from "./Levels"
import {OffscreenArrow} from "./OffscreenArrow"
import {panelYawOffset} from "./PanelAim"
import {QuakeShaker} from "./QuakeShaker"
import {ResultLine, ResultPanel} from "./ResultPanel"
import {RoomWalls} from "./RoomWalls"
import {SafetyPanel} from "./SafetyPanel"
import {SafeZone} from "./SafeZone"
import {ScanIntro, ScanItem} from "./ScanIntro"
import {computeScore, ScoreBreakdown} from "./ScoreCalculator"
import {getLanguage, getString, Lang, lines, setLanguage, setLanguageFonts, setLineText, StringKey} from "./Strings"
import {SOFT_RED} from "./UiBacking"

export type DrillState =
  | "LANGUAGE"
  | "SAFETY"
  | "LEVEL"
  | "BRIEFING"
  | "QUAKE"
  | "POST_QUAKE"
  | "AFTERSHOCK"
  | "RESULT"
  | "GAME_OVER"

// USER_FLOW_DIAGRAM §2. Any transition not listed here is refused.
const ALLOWED: Record<DrillState, DrillState[]> = {
  LANGUAGE: ["SAFETY"],
  SAFETY: ["LEVEL"],
  LEVEL: ["BRIEFING"],
  BRIEFING: ["QUAKE"],
  QUAKE: ["GAME_OVER", "POST_QUAKE"],
  POST_QUAKE: ["RESULT", "AFTERSHOCK"], // Slice 7C: the aftershock comes after leaving cover
  AFTERSHOCK: ["GAME_OVER", "POST_QUAKE"],
  RESULT: ["LEVEL"], // 5j-19a: Restart opens the level picker
  GAME_OVER: ["LEVEL"]
}

const LOG = "[Aftershock]"
const BED_REVEAL_SIZE = 120 // Slice 7C Hard reveal: the red warn.bed over the bed (about 2.7 cm em)
const BED_REVEAL_HEIGHT = 120 // cm above the floor, Room-local

/**
 * The only owner of drill state (TDD §4). LANGUAGE (picker, Slice 5L; Restart
 * keeps the language) → SAFETY → BRIEFING → QUAKE →
 * POST_QUAKE work. The room floor height (floorY) is fixed once at start;
 * every BRIEFING places the Room at the wearer's spot and heading, applies a
 * new procedural layout (Slice 5P) and captures the safe and danger zones at
 * rest. The duck baseline is always floorY + eyeHeight. Each QUAKE frame
 * checks cover (inZone, ducked) and danger, stages the instruction and drives
 * the off-screen arrow. Health drains while exposed after first cover or
 * inside a danger zone (0 → GAME_OVER); leaving the zone after the quake →
 * RESULT with the TDD §7 score; Restart → LEVEL (current level preselected,
 * 5j-19a) with a full reset.
 */
@component
export class DrillController extends BaseScriptComponent {
  @ui.label("Drill state machine (TDD §4)")
  @ui.separator
  @input
  @hint("DrillConfig component with every tunable")
  config: DrillConfig

  @input
  @hint("HeadPose component (camera position and look direction)")
  headPose: HeadPose

  @input
  @hint("SafetyPanel component (reminder + Continue)")
  safetyPanel: SafetyPanel

  @input
  @hint("LanguagePanel component (picker before SAFETY, Slice 5L; under AftershockRoot, not the Room)")
  languagePanel: LanguagePanel

  @input
  @hint("Room root. At start its floor is placed eyeHeight below the head; every BRIEFING moves it to the wearer's spot and heading.")
  room: SceneObject

  @input
  @hint("SafeZone component on the table's marker. Its table and marker are moved by the layout.")
  safeZone: SafeZone

  @input
  @hint("Hazard label on the cabinet")
  cabinetLabel: HazardLabel

  @input
  @hint("Hazard label on the shelf")
  shelfLabel: HazardLabel

  @input
  @hint("Hazard label on the glass window")
  glassLabel: HazardLabel

  @input
  @hint("DangerZone (kind Cabinet) on a child of the Cabinet")
  cabinetDanger: DangerZone

  @input
  @hint("DangerZone (kind Shelf) on a child of the Shelf")
  shelfDanger: DangerZone

  @input
  @hint("DangerZone (kind Glass) on a child of the GlassWindow")
  glassDanger: DangerZone

  @input
  @hint("SafeZone component on the second table's marker (SafeZoneMarker2); used when the layout has two tables")
  safeZone2: SafeZone

  @input
  @hint("Hazard label on the floor lamp")
  lampLabel: HazardLabel

  @input
  @hint("Hazard label on the TV stand")
  tvLabel: HazardLabel

  @input
  @hint("DangerZone (kind Lamp) on a child of the FloorLamp")
  lampDanger: DangerZone

  @input
  @hint("DangerZone (kind TV) on a child of the TvStand")
  tvDanger: DangerZone

  @input
  @hint("Bed anchor under the Room, at the floor. Always in the layout; never cover (bed trap, 5j-15).")
  bed: SceneObject

  @input
  @hint("Chair anchor under the Room, at the floor. Always in the layout.")
  chair: SceneObject

  @input
  @hint("BriefingPanel component (instr.brief)")
  briefingPanel: BriefingPanel

  @input
  @hint("QuakeShaker component on the Room")
  quakeShaker: QuakeShaker

  @input
  @hint("Hud component (under AftershockRoot, not the Room, so it never shakes)")
  hud: Hud

  @input
  @hint("OffscreenArrow component (under AftershockRoot, not the Room, so it never shakes)")
  offscreenArrow: OffscreenArrow

  @input
  @hint("AudioComponent with the looping rumble track")
  rumbleAudio: AudioComponent

  @input
  @hint("LevelPanel component (Slice 7C level picker: Easy / Normal / Hard, under AftershockRoot)")
  levelPanel: LevelPanel

  @input
  @hint("ResultPanel component (result / game-over + Restart, under AftershockRoot)")
  resultPanel: ResultPanel

  @ui.group_start("Scan, path and edge warning (Slice 7B)")
  @input
  @hint("ScanIntro component: the sweep, hazard brackets and n/N chip at the start of BRIEFING")
  scanIntro: ScanIntro

  @input
  @hint("FloorPath component: green chevrons to the target table's safe zone")
  floorPath: FloorPath

  @input
  @hint("EdgeWarning component: red view-edge pulse while health drains")
  edgeWarning: EdgeWarning
  @ui.group_end

  @input
  @hint("FallingObjects component (under the Room): items that fall off the shelf, cabinet and TV (Slice 7D)")
  fallingObjects: FallingObjects

  @input
  @hint("RoomWalls component (under the Room): the four walls and the exit door (Slice 8A)")
  roomWalls: RoomWalls

  @ui.group_start("Furniture models (Slice 7R)")
  @input
  @hint("Table model (both tables): root at bottom center, cm, front +Z")
  tablePrefab: ObjectPrefab

  @input
  cabinetPrefab: ObjectPrefab

  @input
  shelfPrefab: ObjectPrefab

  @input
  lampPrefab: ObjectPrefab

  @input
  tvPrefab: ObjectPrefab

  @input
  bedPrefab: ObjectPrefab

  @input
  chairPrefab: ObjectPrefab
  @ui.group_end

  private safeZones: SafeZone[] = [] // one per TABLES entry
  private activeTables: SafeZone[] = [] // this drill's tables
  private activeHazards: LayoutItem[] = [] // this drill's hazards
  private prefabs: Partial<Record<LayoutItem, ObjectPrefab>> = {}
  private instances: SceneObject[] = [] // this drill's furniture models
  private testForce: LayoutForce | null = null
  private _target = 0 // index into activeTables: the table the arrow points to
  private _nearestTableDistance = 0 // cm, head to the nearest safe-zone edge at QUAKE start
  private _walkAllowance = 0 // s (5j-15c fair score)
  private _guidesVisible = true
  private _nearBed = false
  private _bedWarnCount = 0
  private roomX = 0 // cm, world; the Room's rest position
  private roomZ = 0
  private postQuakeUpdate: UpdateEvent | null = null
  private briefingUpdate: UpdateEvent | null = null // 5j-19e: the floor path follows the nearest table
  private quakeStartTimer: DelayedCallbackEvent | null = null
  private quakeEndTimer: DelayedCallbackEvent | null = null
  private quakeUpdate: UpdateEvent | null = null
  private quakeStartTime = 0 // s
  private _quakeDuration = 0 // s
  private rumbleBaseVolume = 1
  private _state: DrillState | null = null
  private _health: number = 0
  private _instructionKey: StringKey | null = null
  private _arrowVisible: boolean = false
  private _lastScore: ScoreBreakdown | null = null
  // Slice 7C: level and aftershock (ENGINEERING_PLAN 5j items 7, 18).
  private _level: Level = DEFAULT_LEVEL
  private levelHidGuides = false // Hard turned the guides off; another level turns them back on
  private aftershockTimer: DelayedCallbackEvent | null = null // the quiet wait before the aftershock
  private aftershockPending = false
  private _aftershockHappened = false
  private _aftershockTimeToCover: number | null = null
  private aftershockStartTime = 0 // s
  private forcedAftershock: boolean | null = null
  private bedRevealLabel: SceneObject | null = null
  private _revealShown = false
  private _secondsStanding = 0 // s exposed after first safe in the main QUAKE (TDD §7 penalty)
  // 5j-19c: the score is the main quake's only, snapshotted when it ends.
  private scoreTSafe: number | null = null
  private scoreHealth = 0
  private scoreStanding = 0
  private baselineHeadY: number | null = null
  private _floorY = 0 // cm, world; fixed once at start
  private roomYaw = 0 // radians; the Room's heading, from the wearer's look at BRIEFING
  private zones: Record<string, DangerZone> = {}
  private labels: Record<string, HazardLabel> = {}
  private _layout: Layout | null = null
  private _inDanger = false
  private _secondsInDanger = 0 // s inside a danger zone during QUAKE and AFTERSHOCK
  private _gameOverReason: StringKey | null = null
  private _inZone = false
  private _ducked = false
  private _hasBeenSafe = false
  private _tSafe: number | null = null // s from quake start
  private safeSince = -1 // s; when inZone && ducked last began, -1 when not safe
  private _fallHits = 0 // Slice 7D: items that hit the head this drill
  private fallsDisabled = false // LEAF disableFallsForTest
  // Read-only getters for LEAF assertions (TDD §8).
  get state(): DrillState | null {
    return this._state
  }
  /** The selected language (Slice 5L); Restart keeps it. */
  get language(): Lang {
    return getLanguage()
  }
  get health(): number {
    return this._health
  }
  get instructionKey(): StringKey | null {
    return this._instructionKey
  }
  get arrowVisible(): boolean {
    return this._arrowVisible
  }
  /** Score breakdown of the last RESULT (TDD §7), or null (never scored, or GAME_OVER). */
  get lastScore(): ScoreBreakdown | null {
    return this._lastScore
  }
  /** Seconds exposed (not inZone && ducked) after first being safe, in this drill's main QUAKE. */
  get secondsStanding(): number {
    return this._secondsStanding
  }
  /** Duck baseline (cm): always floorY + eyeHeight, set when BRIEFING starts; null before that. */
  get duckBaseline(): number | null {
    return this.baselineHeadY
  }
  /** Room floor world Y (cm), fixed once at start. */
  get floorY(): number {
    return this._floorY
  }
  /** This drill's layout (Room-local cm, radians), or null before the first BRIEFING. */
  get layout(): Layout | null {
    return this._layout
  }
  /** Slice 8A (for 8B): the doorway's center on the wall line, on the floor (world, at rest); null before the first BRIEFING. */
  get doorCenter(): vec3 | null {
    return this.roomWalls ? this.roomWalls.doorCenter : null
  }
  /** Unit floor normal from the door into the room (world, at rest). */
  get doorNormal(): vec3 | null {
    return this.roomWalls ? this.roomWalls.doorNormal : null
  }
  /** True inside the 90 × 60 cm floor rect in front of the door. */
  doorContains(pos: vec3): boolean {
    return !!this.roomWalls && this.roomWalls.doorContains(pos)
  }
  /** Head XZ inside any danger zone (QUAKE). */
  get inDanger(): boolean {
    return this._inDanger
  }
  /** Seconds inside a danger zone during this drill's QUAKE and AFTERSHOCK. */
  get secondsInDanger(): number {
    return this._secondsInDanger
  }
  /** Why the last GAME_OVER happened (over.why.danger, over.why.stood or hit.fell), or null. */
  get gameOverReason(): StringKey | null {
    return this._gameOverReason
  }
  /** This drill's quake length (s), picked when QUAKE starts. */
  get quakeDuration(): number {
    return this._quakeDuration
  }
  /** Head inside the safe zone's rest footprint (QUAKE). */
  get inZone(): boolean {
    return this._inZone
  }
  /** Head at or below the duck line, with hysteresis (QUAKE). */
  get ducked(): boolean {
    return this._ducked
  }
  get isSafe(): boolean {
    return this._inZone && this._ducked
  }
  /** True once inZone and ducked have held for safeHoldSeconds this drill. */
  get hasBeenSafe(): boolean {
    return this._hasBeenSafe
  }
  /** Seconds from quake start until the user was first safe, or null. */
  get tSafe(): number | null {
    return this._tSafe
  }
  /** This drill's tables (their SafeZones); cover under any of them counts. */
  get activeSafeZones(): SafeZone[] {
    return this.activeTables.slice()
  }
  /** The table the arrow points to: the nearest to the head, with tableSwitchHysteresis. */
  get targetSafeZone(): SafeZone | null {
    return this.activeTables.length > 0 ? this.activeTables[this._target] : null
  }
  /** Head to the nearest table's safe-zone edge at QUAKE start (cm, floor plane). */
  get nearestTableDistance(): number {
    return this._nearestTableDistance
  }
  /** Seconds forgiven from tSafe for the walk to the nearest table (nearestTableDistance ÷ walkSpeed). */
  get walkAllowance(): number {
    return this._walkAllowance
  }
  /** Ducked on or next to the bed (QUAKE). */
  get nearBed(): boolean {
    return this._nearBed
  }
  /** How often warn.bed was shown this drill. */
  get bedWarnCount(): number {
    return this._bedWarnCount
  }
  get guidesVisible(): boolean {
    return this._guidesVisible
  }
  /** Slice 7C: the picked level ("easy" | "normal" | "hard"); it stays through Restart. */
  get level(): Level {
    return this._level
  }
  get aftershockHappened(): boolean {
    return this._aftershockHappened
  }
  /** Seconds from the aftershock's start until safe for safeHoldSeconds, or null. */
  get aftershockTimeToCover(): number | null {
    return this._aftershockTimeToCover
  }
  /** True during the quiet wait between leaving cover and the aftershock. */
  get aftershockWaiting(): boolean {
    return this.aftershockPending
  }
  /** Hard: the room's guides are shown behind the result / game-over panel. */
  get revealShown(): boolean {
    return this._revealShown
  }
  /** True when any hazard label of this drill shows (Easy keeps them through the quake). */
  get hazardLabelsShown(): boolean {
    for (const h of this.activeHazards) {
      if (this.labels[h].isShown) {
        return true
      }
    }
    return false
  }
  // Slice 7B test getters (5j-4, 5, 6).
  get scanActive(): boolean {
    return this.scanIntro.scanActive
  }
  get scanCount(): number {
    return this.scanIntro.scanCount
  }
  get scanTotal(): number {
    return this.scanIntro.scanTotal
  }
  get pathVisible(): boolean {
    return this.floorPath.pathVisible
  }
  get pathBright(): boolean {
    return this.floorPath.pathBright
  }
  get edgeWarningActive(): boolean {
    return this.edgeWarning.edgeWarningActive
  }
  // Slice 7D test getters (5j-8, 17e).
  get fallsScheduled(): number {
    return this.fallingObjects.fallsScheduled
  }
  get fallsLanded(): number {
    return this.fallingObjects.fallsLanded
  }
  /** Items that hit the head (within fallHitRadius, not safe) this drill. */
  get fallHits(): number {
    return this._fallHits
  }

  onAwake(): void {
    this.quakeStartTimer = this.createEvent("DelayedCallbackEvent")
    this.quakeStartTimer.bind(() => this.onRandomWaitEnded())
    this.quakeEndTimer = this.createEvent("DelayedCallbackEvent")
    this.quakeEndTimer.bind(() => this.onQuakeTimeOver())
    this.aftershockTimer = this.createEvent("DelayedCallbackEvent")
    this.aftershockTimer.bind(() => this.onAftershockDelayEnded())
    this.quakeUpdate = this.createEvent("UpdateEvent")
    this.quakeUpdate.bind(() => this.onQuakeUpdate())
    this.quakeUpdate.enabled = false
    this.postQuakeUpdate = this.createEvent("UpdateEvent")
    this.postQuakeUpdate.bind(() => this.onPostQuakeUpdate())
    this.postQuakeUpdate.enabled = false
    this.briefingUpdate = this.createEvent("UpdateEvent")
    this.briefingUpdate.bind(() => this.onBriefingUpdate())
    this.briefingUpdate.enabled = false
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    const inputs: [string, unknown][] = [
      ["config", this.config],
      ["headPose", this.headPose],
      ["safetyPanel", this.safetyPanel],
      ["languagePanel", this.languagePanel],
      ["room", this.room],
      ["safeZone", this.safeZone],
      ["cabinetLabel", this.cabinetLabel],
      ["shelfLabel", this.shelfLabel],
      ["glassLabel", this.glassLabel],
      ["cabinetDanger", this.cabinetDanger],
      ["shelfDanger", this.shelfDanger],
      ["glassDanger", this.glassDanger],
      ["safeZone2", this.safeZone2],
      ["lampLabel", this.lampLabel],
      ["tvLabel", this.tvLabel],
      ["lampDanger", this.lampDanger],
      ["tvDanger", this.tvDanger],
      ["bed", this.bed],
      ["chair", this.chair],
      ["briefingPanel", this.briefingPanel],
      ["quakeShaker", this.quakeShaker],
      ["hud", this.hud],
      ["offscreenArrow", this.offscreenArrow],
      ["rumbleAudio", this.rumbleAudio],
      ["resultPanel", this.resultPanel],
      ["scanIntro", this.scanIntro],
      ["floorPath", this.floorPath],
      ["edgeWarning", this.edgeWarning],
      ["levelPanel", this.levelPanel],
      ["fallingObjects", this.fallingObjects]
    ]
    const missing = inputs.filter((entry) => !entry[1]).map((entry) => entry[0])
    if (missing.length > 0) {
      console.error(`${LOG} DrillController: missing input(s): ${missing.join(", ")}`)
      return
    }
    this.zones = {cabinet: this.cabinetDanger, shelf: this.shelfDanger, glass: this.glassDanger, lamp: this.lampDanger, tv: this.tvDanger}
    this.fallingObjects.onLanded = (source, x, z) => this.onItemLanded(source, x, z)
    this.labels = {cabinet: this.cabinetLabel, shelf: this.shelfLabel, glass: this.glassLabel, lamp: this.lampLabel, tv: this.tvLabel}
    this.safeZones = [this.safeZone, this.safeZone2]
    const wrong = HAZARDS.filter((h) => this.zones[h].item !== h || !this.zones[h].hazard).map((h) => h + "Danger")
    this.safeZones.forEach((z, i) => {
      if (!z.table || !z.marker) {
        wrong.push(`safeZone${i === 0 ? "" : i + 1}.table/marker`)
      }
    })
    if (this.safeZone.table === this.safeZone2.table) {
      wrong.push("safeZone2.table is the first table")
    }
    if (wrong.length > 0) {
      console.error(`${LOG} DrillController: wrong kind or no hazard parent: ${wrong.join(", ")}`)
      return
    }
    this.prefabs = {
      table: this.tablePrefab,
      table2: this.tablePrefab,
      cabinet: this.cabinetPrefab,
      shelf: this.shelfPrefab,
      lamp: this.lampPrefab,
      tv: this.tvPrefab,
      bed: this.bedPrefab,
      chair: this.chairPrefab
    }
    // Slice 8A: the glass is the box window under its anchor (pane and frame), never a model.
    const noModel = ALL_ITEMS.filter((item) => item !== "glass" && !this.prefabs[item])
    if (noModel.length > 0) {
      console.warn(`${LOG} DrillController: no prefab for ${noModel.join(", ")}; those items have no model (re-enable their box children as a fallback)`)
    }
    // Ambient loop: latency is fine (specs-audio).
    this.rumbleAudio.playbackMode = Audio.PlaybackMode.LowPower
    this.rumbleBaseVolume = this.rumbleAudio.volume
    if (!this.rumbleAudio.audioTrack) {
      console.warn(`${LOG} DrillController: rumbleAudio has no audio track; the quake will be silent`)
    }
    this._health = this.config.healthStart

    const p = this.headPose.position
    const f = this.headPose.forward
    console.log(`${LOG} head at start: position (${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}) cm, forward (${fmt(f.x)}, ${fmt(f.y)}, ${fmt(f.z)})`)

    // Furniture positions are relative to the user's start spot on the floor.
    // The floor height is fixed here once; BRIEFING only moves the Room in XZ and heading.
    this._floorY = p.y - this.config.eyeHeight
    console.log(`${LOG} room floor at Y = ${fmt(this._floorY)} cm (eyeHeight ${fmt(this.config.eyeHeight)} cm)`)
    // Labels follow their hazard: same pose relative to it as authored (Slice 2).
    for (const h of HAZARDS) {
      this.labels[h].sceneObject.setParentPreserveWorldTransform(this.zones[h].hazard)
      // ENGINEERING_PLAN 5i item 1 (replaces 5g): the danger label sits just above the hazard label, with its facing.
      const dangerLabel = this.zones[h].label
      if (dangerLabel) {
        this.labels[h].attachAbove(dangerLabel, DANGER_LABEL_HALF_H)
      }
    }
    this.placeRoom()

    // Slice 5L: ja and zh lines need their own fonts; the default font has no CJK glyphs.
    if (!this.config.fontJa || !this.config.fontZh) {
      console.warn(`${LOG} DrillController: config.fontJa or config.fontZh is not assigned; Japanese or Chinese lines will miss glyphs`)
    }
    // Slice 7A-soft: Manrope for every Latin line; unwired falls back to the default font.
    setLanguageFonts(this.config.fontJa, this.config.fontZh, this.config.fontBody)
    this.languagePanel.onPick.add((lang) => this.onLanguagePicked(lang))
    this.safetyPanel.onContinue.add(() => this.onContinuePressed())
    this.resultPanel.onRestart.add(() => this.onRestartPressed())
    // 5h item 1: each panel ignores presses for its first pinchGuardSeconds.
    this.languagePanel.pinchGuard.seconds = this.config.pinchGuardSeconds
    this.safetyPanel.pinchGuard.seconds = this.config.pinchGuardSeconds
    this.resultPanel.pinchGuard.seconds = this.config.pinchGuardSeconds
    this.levelPanel.onPick.add((level) => this.onLevelPicked(level))
    this.levelPanel.pinchGuard.seconds = this.config.pinchGuardSeconds
    this.transitionTo("LANGUAGE")
  }

  /** A picker button: set the language (every panel refreshes), then SAFETY. */
  private onLanguagePicked(lang: Lang): void {
    if (this._state !== "LANGUAGE") {
      return
    }
    setLanguage(lang)
    console.log(`${LOG} language: ${lang}`)
    this.transitionTo("SAFETY")
  }

  private onContinuePressed(): void {
    if (this._state !== "SAFETY") {
      return
    }
    this.transitionTo("LEVEL") // Slice 7C: the level picker comes between safety and briefing
  }

  private onLevelPicked(level: Level): void {
    if (this._state !== "LEVEL") {
      return
    }
    this._level = level
    console.log(`${LOG} LEVEL: ${level}`)
    this.transitionTo("BRIEFING")
  }

  onRandomWaitEnded(): void {
    if (this._state === "BRIEFING") {
      this.transitionTo("QUAKE")
    }
  }
  onQuakeTimeOver(): void {
    if (this._state === "QUAKE" || this._state === "AFTERSHOCK") {
      this.transitionTo("POST_QUAKE")
    }
  }

  onHealthDepleted(): void {
    if (this._state === "QUAKE" || this._state === "AFTERSHOCK") {
      this.transitionTo("GAME_OVER")
    }
  }
  /**
   * POST_QUAKE, out of cover: after the main quake, roll the level's
   * aftershock chance (5j-7); on a hit a quiet wait, then AFTERSHOCK. Else RESULT.
   */
  onHeadLeftSafeZone(): void {
    if (this._state !== "POST_QUAKE" || this.aftershockPending) {
      return
    }
    if (!this._aftershockHappened && this.rollAftershock()) {
      this.postQuakeUpdate.enabled = false
      this.aftershockPending = true
      const delay = this.config.testMode
        ? this.config.testAftershockDelaySeconds
        : randomBetween(this.config.aftershockDelayMin, this.config.aftershockDelayMax)
      console.log(`${LOG} POST_QUAKE: aftershock in ${fmt(delay)} s`)
      this.aftershockTimer.reset(delay)
      return
    }
    this.transitionTo("RESULT")
  }

  private rollAftershock(): boolean {
    if (this.forcedAftershock !== null) {
      return this.forcedAftershock
    }
    return Math.random() < aftershockChance(this._level, this.config)
  }

  private onAftershockDelayEnded(): void {
    if (this._state === "POST_QUAKE" && this.aftershockPending) {
      this.aftershockPending = false
      this.transitionTo("AFTERSHOCK")
    }
  }

  /** Cancels a pending aftershock and clears the last drill's aftershock record. */
  private resetAftershock(): void {
    this.aftershockTimer.cancel()
    this.aftershockPending = false
    this._aftershockHappened = false
    this._aftershockTimeToCover = null
  }

  /**
   * Restart → LEVEL with the current level preselected (5j-19a: one pinch
   * keeps it, or pick another), after a full reset (enterBriefing resets
   * health, cover, standing time, arrow); the language stays.
   */
  onRestartPressed(): void {
    if (this._state !== "RESULT" && this._state !== "GAME_OVER") {
      return
    }
    this.stopQuakeEffects()
    this.postQuakeUpdate.enabled = false
    this.quakeStartTimer.cancel()
    this.resetAftershock()
    this._lastScore = null
    this._quakeDuration = 0
    this.resultPanel.hide()
    this.transitionTo("LEVEL")
  }

  /** LEAF test hook only (TDD §8): sets the level the next BRIEFING uses (Slice 7C). */
  setLevelForTest(level: Level): void {
    this._level = level
    console.log(`${LOG} setLevelForTest: ${level}`)
  }

  /** LEAF test hook only (TDD §8): true / false forces the aftershock roll; null rolls the level's chance again. */
  forceAftershockForTest(on: boolean | null): void {
    this.forcedAftershock = on
    console.log(`${LOG} forceAftershockForTest: ${on === null ? "off" : on}`)
  }

  /** The forceAftershockForTest value (null: the level's chance), so the LEAF kit can keep it across resetForTest. */
  get aftershockForcedForTest(): boolean | null {
    return this.forcedAftershock
  }

  /** The disableFallsForTest value, so the LEAF kit can keep it across resetForTest. */
  get fallsDisabledForTest(): boolean {
    return this.fallsDisabled
  }

  /** LEAF test hook only (TDD §8): true stops scheduled falls (forceFallForTest still drops one); false lets them fall again. */
  disableFallsForTest(off: boolean): void {
    this.fallsDisabled = off
    if (off) {
      this.fallingObjects.cancelPending()
    }
    console.log(`${LOG} disableFallsForTest: ${off}`)
  }

  /**
   * LEAF test hook only (TDD §8): drops one item now from that hazard (it
   * must be in this drill). With landAt it lands at that world XZ, ignoring
   * the zone rule; otherwise in front of the hazard as in the drill.
   */
  forceFallForTest(item: FallSource, landAt: vec3 | null): boolean {
    const at = this._layout ? this._layout.items[item] : undefined
    if (!at || this.activeHazards.indexOf(item) < 0) {
      console.warn(`${LOG} forceFallForTest: no ${item} in this drill`)
      return false
    }
    console.log(`${LOG} forceFallForTest: ${item}${landAt ? ` at (${fmt(landAt.x)}, ${fmt(landAt.z)})` : ""}`)
    return this.fallingObjects.drop({source: item, at}, landAt ? this.toRoomLocal(landAt) : null)
  }

  /**
   * LEAF test hook only (TDD §8); the drill never calls it. Every following
   * BRIEFING uses these tables and hazards (positions stay procedural) until
   * it is called with null.
   */
  forceLayoutForTest(force: LayoutForce | null): void {
    this.testForce = force
    console.log(`${LOG} forceLayoutForTest: ${force ? JSON.stringify(force) : "off"}`)
  }

  /**
   * The one switch for every guide (5j-17): danger-zone floors, safe-zone
   * markers, hazard labels and the arrow. Off hides them at once; on shows
   * them again where the current state shows them.
   */
  setGuidesVisible(visible: boolean): void {
    this._guidesVisible = visible
    console.log(`${LOG} guides ${visible ? "shown" : "hidden"}`)
    if (!visible) {
      this.hideArrow()
      this.scanIntro.stop() // no scan with guides off (5j-17d)
      this.scanIntro.hideBrackets()
      this.floorPath.setMode("off")
      this.setRoomLabelsShown(false)
      this.setDangerZonesShown(false)
    } else if (this._state === "BRIEFING") {
      this.setRoomLabelsShown(true) // everything at once, no second scan
      this.setDangerZonesShown(true)
      this.floorPath.setMode("faint")
    } else if (this._state === "QUAKE" || this._state === "POST_QUAKE" || this._state === "AFTERSHOCK") {
      this.setMarkersShown(true)
      this.setDangerZonesShown(true)
    }
  }

  /**
   * LEAF test hook only (TDD §8); the drill never calls it. Stops every timer
   * and quake effect from any state and clears every test hook (5j-19f:
   * forced layout, forced aftershock, falls off), then a fresh BRIEFING
   * (health healthStart) or, with toLanguage, the opening picker (nothing
   * else leads to LANGUAGE).
   */
  resetForTest(toLanguage: boolean = false): void {
    console.log(`${LOG} resetForTest from ${this._state}`)
    this.forceLayoutForTest(null)
    this.forceAftershockForTest(null)
    this.disableFallsForTest(false)
    this.stopQuakeEffects()
    this.postQuakeUpdate.enabled = false
    this.briefingUpdate.enabled = false
    this.quakeStartTimer.cancel()
    this.resetAftershock()
    this._lastScore = null
    this._quakeDuration = 0
    this._health = this.config.healthStart
    this.resultPanel.hide()
    this._state = null // a reset, not a drill transition
    this.transitionTo(toLanguage ? "LANGUAGE" : "BRIEFING")
  }

  private transitionTo(next: DrillState): void {
    const prev = this._state
    if (prev !== null && ALLOWED[prev].indexOf(next) < 0) {
      console.warn(`${LOG} refused transition ${prev} -> ${next}`)
      return
    }
    this._state = next
    console.log(`${LOG} state ${prev === null ? "[start]" : prev} -> ${next}`)
    switch (next) {
      case "LANGUAGE":
        this.enterLanguage()
        break
      case "SAFETY":
        this.enterSafety()
        break
      case "LEVEL":
        this.enterLevel()
        break
      case "BRIEFING":
        this.enterBriefing()
        break
      case "QUAKE":
        this.enterQuake()
        break
      case "POST_QUAKE":
        this.enterPostQuake()
        break
      case "AFTERSHOCK":
        this.enterAftershock()
        break
      case "RESULT":
        this.enterResult()
        break
      case "GAME_OVER":
        this.enterGameOver()
        break
    }
  }

  /** Picker placed once at eye level, hudDistance ahead (5h item 2: no hudBelowEye); nothing else shows. */
  private enterLanguage(): void {
    this._instructionKey = null
    this.hideArrow()
    this.hideScanPathEdge()
    this.setRoomLabelsShown(false)
    this.setDangerZonesShown(false)
    this.briefingPanel.hide()
    this.hud.hide()
    this.resultPanel.hide()
    this.safetyPanel.hide()
    this.levelPanel.hide()
    this.showReveal(false)
    this.languagePanel.placeInFront(this.headPose.position, this.headPose.forward, this.config.hudDistance, 0)
    this.languagePanel.show()
  }

  private enterSafety(): void {
    this.languagePanel.hide()
    this.levelPanel.hide()
    this._instructionKey = null
    this.hideArrow()
    this.hideScanPathEdge()
    this.setRoomLabelsShown(false)
    this.setDangerZonesShown(false)
    this.briefingPanel.hide()
    this.hud.hide()
    this.resultPanel.hide()
    this.safetyPanel.placeInFront(
      this.headPose.position,
      this.headPose.forward,
      this.config.hudDistance,
      this.config.hudBelowEye
    )
    this.safetyPanel.show()
  }

  /**
   * Slice 7C level picker, placed like the language picker (eye level,
   * hudDistance ahead); the current level is marked (5j-19a: Restart comes
   * here too, so the Hard reveal's bed label hides).
   */
  private enterLevel(): void {
    this.safetyPanel.hide()
    this._instructionKey = null
    this.hideArrow()
    this.hideScanPathEdge()
    this.setRoomLabelsShown(false)
    this.setDangerZonesShown(false)
    this.showReveal(false)
    this.briefingPanel.hide()
    this.hud.hide()
    this.resultPanel.hide()
    this.levelPanel.placeInFront(this.headPose.position, this.headPose.forward, this.config.hudDistance, 0)
    this.levelPanel.show(this._level)
  }

  private enterBriefing(): void {
    this.safetyPanel.hide()
    this.levelPanel.hide()
    this.resultPanel.hide()
    this.resetAftershock()
    this.showReveal(false)
    this._health = this.config.healthStart
    this._secondsStanding = 0
    this.scoreTSafe = null
    this.scoreHealth = this.config.healthStart
    this.scoreStanding = 0
    this._secondsInDanger = 0
    this._inDanger = false
    this._gameOverReason = null
    this._nearBed = false
    this._bedWarnCount = 0
    this._walkAllowance = 0
    this._nearestTableDistance = 0
    this._fallHits = 0
    this.fallingObjects.clear()
    this.resetCover()
    this._instructionKey = "instr.brief"
    // ENGINEERING_PLAN 5f item 1: never the current head height (restarting while ducked broke ducking).
    this.baselineHeadY = this._floorY + this.config.eyeHeight
    console.log(`${LOG} BRIEFING: duck baseline = floorY ${fmt(this._floorY)} + eyeHeight ${fmt(this.config.eyeHeight)} = ${fmt(this.baselineHeadY)} cm (ducked at <= ${fmt(this.baselineHeadY - this.config.duckDrop)} cm)`)
    this.placeRoom() // 5f item 2: wearer's current spot and heading, floor height unchanged
    this.applyLayout()
    // Room is at rest here, so the zones never shake; the arrow aims at the target table's aimPoint.
    for (const z of this.activeTables) {
      z.captureRest()
    }
    for (const h of this.activeHazards) {
      this.zones[h].captureRest()
    }
    if (this.roomWalls) this.roomWalls.captureRest() // Slice 8A: door getters at rest
    this.updateTarget(true)
    // 5j-4/17d: labels and markers appear as the scan sweep reaches them; with guides off, no scan.
    this.applyLevelGuides()
    this.setRoomLabelsShown(false)
    this.setDangerZonesShown(true)
    const scanSeconds = this.startScan()
    this.floorPath.setFloorY(this._floorY)
    this.floorPath.setTarget(this.targetSafeZone)
    this.floorPath.setMode(this._guidesVisible ? "faint" : "off")
    this.briefingUpdate.enabled = true // 5j-19e: the path follows the nearest table as the user walks
    this.briefingPanel.placeInFront(
      this.headPose.position,
      this.panelForward("briefing"),
      this.config.hudDistance,
      this.config.hudBelowEye
    )
    this.briefingPanel.show()
    this.hud.hide()

    const wait = this.config.testMode
      ? this.config.testWaitSeconds
      : randomBetween(this.config.quakeWaitMin, this.config.quakeWaitMax)
    console.log(`${LOG} BRIEFING: scan ${fmt(scanSeconds)} s, then quake in ${fmt(wait)} s`)
    this.quakeStartTimer.reset(scanSeconds + wait) // the quake wait starts after the scan
  }

  /**
   * Starts the scan intro over the active hazards and tables (5j-4/17d) and
   * returns its length in seconds; 0 with guides off (no scan at all).
   */
  private startScan(): number {
    this.scanIntro.stop()
    this.scanIntro.hideBrackets()
    if (!this._guidesVisible) {
      return 0
    }
    const items: ScanItem[] = []
    for (const h of this.activeHazards) {
      const zone = this.zones[h]
      items.push({
        pos: zone.hazard.getTransform().getWorldPosition(),
        hazard: true,
        reveal: () => this.labels[h].show(),
        bracketParent: zone.getSceneObject(),
        halfX: FOOTPRINTS[h].halfX,
        halfZ: FOOTPRINTS[h].halfZ
      })
    }
    for (const z of this.activeTables) {
      items.push({pos: z.center, hazard: false, reveal: () => z.showMarker()})
    }
    const seconds = this.config.testMode ? this.config.testScanSeconds : this.config.scanSeconds
    const p = this.room.getTransform().getWorldPosition()
    this.scanIntro.start(new vec3(p.x, this._floorY, p.z), items, seconds)
    return seconds
  }

  private enterQuake(): void {
    this.briefingUpdate.enabled = false
    this.briefingPanel.hide()
    this._quakeDuration = this.config.testMode
      ? this.config.testDurationSeconds
      : randomBetween(this.config.quakeDurationMin, this.config.quakeDurationMax)
    console.log(`${LOG} QUAKE: lasts ${fmt(this._quakeDuration)} s`)

    this.quakeShaker.startShake(this._quakeDuration)
    this.scheduleFalls(this._quakeDuration)
    if (this.rumbleAudio.audioTrack) {
      this.rumbleAudio.volume = 0 // ramps with the shake (DESIGN_BRIEF §6.2)
      this.rumbleAudio.play(-1)
    }

    this.hud.show()
    this.hud.setHealth(this._health)
    this.hud.setElapsed(0)
    this.hud.showWarning()
    this.scanIntro.stop()
    this.scanIntro.hideBrackets()
    if (!labelsStayInQuake(this._level)) this.hideHazardLabels() // Slice 7C: Easy keeps them
    for (const z of this.activeTables) {
      z.startBlink() // a hidden marker (guides off) stays hidden: its parts are under it
    }

    this.quakeStartTime = getTime()
    // 5j-15c fair score: the walk to the nearest table is forgiven from tSafe.
    this.updateTarget(true)
    const target = this.targetSafeZone
    this._nearestTableDistance = target ? target.distanceTo(this.headPose.position) : 0
    this._walkAllowance = this._nearestTableDistance / Math.max(1, this.config.walkSpeed)
    console.log(`${LOG} QUAKE: ${this.activeTables.length} table(s), nearest ${fmt(this._nearestTableDistance)} cm away; walk allowance ${fmt(this._walkAllowance)} s at ${fmt(this.config.walkSpeed)} cm/s`)
    this.updateCover(this.quakeStartTime) // first instruction (goUnder unless already under cover)
    this.quakeEndTimer.reset(this._quakeDuration)
    this.quakeUpdate.enabled = true
  }

  private onQuakeUpdate(): void {
    const now = getTime()
    const aftershock = this._state === "AFTERSHOCK"
    this.hud.setElapsed(now - (aftershock ? this.aftershockStartTime : this.quakeStartTime))
    this.rumbleAudio.volume = this.rumbleBaseVolume * this.quakeShaker.envelope
    this.updateCover(now)
    this.updateDanger()
    this.updateBedTrap()

    // ENGINEERING_PLAN 5f item 4: drain while exposed once safe (hasBeenSafe && !(inZone && ducked),
    // TDD §4.1, §7) OR inside a danger zone; one drain, never doubled. 5j-19c: in the aftershock,
    // not being safe drains once under cover again there OR after aftershockGraceSeconds, so
    // ignoring it is never better than taking cover; its standing time is not scored.
    const shaking = this._state === "QUAKE" || aftershock
    const grace = this.config.testMode ? this.config.testAftershockGraceSeconds : this.config.aftershockGraceSeconds
    const covered = aftershock
      ? this._aftershockTimeToCover !== null || now - this.aftershockStartTime > grace
      : this._hasBeenSafe
    const exposed = covered && !this.isSafe
    this.edgeWarning.setActive(shaking && (exposed || this._inDanger)) // 5j-6
    if (shaking && (exposed || this._inDanger)) {
      const dt = getDeltaTime()
      if (exposed && !aftershock) {
        this._secondsStanding += dt
      }
      if (this._inDanger) {
        this._secondsInDanger += dt
      }
      this._health = Math.max(0, this._health - this.config.healthDrainPerSecond * drainMultiplier(this._level, this.config) * dt)
      this.hud.setHealth(this._health)
      if (this._health <= 0) {
        this._gameOverReason = this._inDanger ? "over.why.danger" : "over.why.stood"
        console.log(`${LOG} ${this._state}: health reached 0 after ${fmt(this._secondsStanding)} s exposed, ${fmt(this._secondsInDanger)} s in danger (${this._gameOverReason})`)
        this.onHealthDepleted()
      }
    }
  }

  /** Head XZ inside any danger zone's rest area (QUAKE). */
  private updateDanger(): void {
    const head = this.headPose.position
    let inDanger = false
    for (const h of this.activeHazards) {
      if (this.zones[h].contains(head)) {
        inDanger = true
        break
      }
    }
    if (inDanger !== this._inDanger) {
      this._inDanger = inDanger
      console.log(`${LOG} QUAKE: ${inDanger ? "entered" : "left"} a danger zone`)
    }
  }

  /**
   * Bed trap (5j-15): ducked within the bed footprint + bedWarnMargin shows
   * warn.bed for bedWarnSeconds, once per entry. Never cover, no extra drain.
   */
  private updateBedTrap(): void {
    const at = this._layout ? this._layout.items.bed : undefined
    if (!at) {
      return
    }
    const local = this.toRoomLocal(this.headPose.position)
    const f = FOOTPRINTS.bed
    const m = this.config.bedWarnMargin
    const near = this._ducked && insideRect(local.x, local.y, at.x, at.z, at.yaw, f.halfX + m, f.halfZ + m)
    if (near && !this._nearBed) {
      this._bedWarnCount++
      this.hud.showNotice(this.config.bedWarnSeconds)
      console.log(`${LOG} QUAKE: ducked on the bed: warn.bed (${this._bedWarnCount}x); a bed is not cover`)
    }
    this._nearBed = near
  }

  /** Slice 7D (5j-8): fallCountMin..Max falls this shake from the shelf, cabinet and TV present; none on Easy. */
  private scheduleFalls(durationSeconds: number): void {
    if (!fallsOn(this._level) || this.fallsDisabled || !this._layout) {
      console.log(`${LOG} falls: off (${this.fallsDisabled ? "disabled for test" : "level " + this._level})`)
      return
    }
    const sources: FallFrom[] = []
    for (const s of FALL_SOURCES) {
      const at = this._layout.items[s]
      if (at && this.activeHazards.indexOf(s) >= 0) {
        sources.push({source: s, at})
      }
    }
    this.fallingObjects.scheduleShake(durationSeconds, sources)
  }

  /**
   * Slice 7D hit rule (5j-8, 17e, 19b): an item landing within fallHitRadius
   * (XZ) of the head while the head is inside a danger zone and not safe
   * (inZone && ducked) costs fallHitDamage and shows hit.fell; never outside
   * the red area. Only while shaking; at 0 health, game over (hit.fell).
   */
  private onItemLanded(source: FallSource, x: number, z: number): void {
    if (this._state !== "QUAKE" && this._state !== "AFTERSHOCK") {
      return
    }
    this.updateDanger() // this frame's head, not the last quake update's
    const head = this.toRoomLocal(this.headPose.position)
    const dist = Math.sqrt((head.x - x) * (head.x - x) + (head.y - z) * (head.y - z))
    if (dist > this.config.fallHitRadius || this.isSafe || !this._inDanger) {
      const why = this.isSafe ? " (safe under cover)" : !this._inDanger ? " (head outside every danger zone)" : ""
      console.log(`${LOG} ${this._state}: ${source} item landed ${fmt(dist)} cm from the head${why}; no hit`)
      return
    }
    this._fallHits++
    this._health = Math.max(0, this._health - this.config.fallHitDamage)
    this.hud.setHealth(this._health)
    this.hud.showNotice(this.config.fallNoticeSeconds, "hit.fell")
    console.log(`${LOG} ${this._state}: ${source} item hit the head (${fmt(dist)} cm, ${this._fallHits}x); health ${fmt(this._health)}`)
    if (this._health <= 0) {
      this._gameOverReason = "hit.fell"
      this.onHealthDepleted()
    }
  }

  /** True when the head is in any of this drill's safe zones. */
  private inAnySafeZone(head: vec3): boolean {
    for (const z of this.activeTables) {
      if (z.contains(head)) {
        return true
      }
    }
    return false
  }

  /**
   * The arrow's table (5j-14): the nearest to the head. Another table takes
   * over only when it is tableSwitchHysteresis nearer; `fresh` picks the nearest outright.
   */
  private updateTarget(fresh: boolean): void {
    const n = this.activeTables.length
    if (n === 0) {
      this._target = 0
      return
    }
    const head = this.headPose.position
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < n; i++) {
      const d = this.activeTables[i].distanceTo(head)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (fresh || this._target >= n) {
      this._target = best
    } else if (best !== this._target && bestD + this.config.tableSwitchHysteresis < this.activeTables[this._target].distanceTo(head)) {
      this._target = best
      console.log(`${LOG} ${this._state}: target now table ${best + 1}`)
    }
  }

  /** World position → Room-local XZ at rest (cm) as (x, y = z): the layout's frame. */
  private toRoomLocal(p: vec3): vec2 {
    const dx = p.x - this.roomX
    const dz = p.z - this.roomZ
    const c = Math.cos(this.roomYaw)
    const s = Math.sin(this.roomYaw)
    return new vec2(dx * c - dz * s, dx * s + dz * c)
  }

  /** 5j-19e: in BRIEFING the floor path follows the nearest table as the user walks. */
  private onBriefingUpdate(): void {
    if (this._state !== "BRIEFING") {
      this.briefingUpdate.enabled = false
      return
    }
    this.updateTarget(false)
    this.floorPath.setTarget(this.targetSafeZone)
  }

  /** POST_QUAKE: wait for the head to leave every safe zone (USER_FLOW_DIAGRAM §2). */
  private onPostQuakeUpdate(): void {
    if (!this.inAnySafeZone(this.headPose.position)) {
      this.onHeadLeftSafeZone()
    }
  }

  /** One QUAKE frame of take-cover logic (TDD §3.1, §4.1): zone, duck, safe hold, instruction, arrow. */
  private updateCover(now: number): void {
    const head = this.headPose.position
    const inZone = this.inAnySafeZone(head) // 5j-14: cover under any table counts
    if (inZone !== this._inZone) {
      this._inZone = inZone
      console.log(`${LOG} QUAKE: ${inZone ? "entered" : "left"} the safe zone`)
    }
    this.updateDucked(head.y)
    this.updateSafeHold(now)
    // 5j-19d: on Hard the step leaves 01 only once safe, so it does not reveal the zone.
    this.showInstruction(
      !guidesOn(this._level)
        ? this.isSafe ? "instr.hold" : "instr.goUnder"
        : !this._inZone ? "instr.goUnder" : this._ducked ? "instr.hold" : "instr.duck"
    )
    this.updateTarget(false)
    const target = this.targetSafeZone
    if (this._inZone || !this._guidesVisible || !target) {
      this.hideArrow() // inside the zone the user is on their own spot (ENGINEERING_PLAN 5a item 8)
      this.floorPath.setMode("off")
    } else {
      this._arrowVisible = this.offscreenArrow.track(target.aimPoint)
      this.floorPath.setTarget(target) // 5j-5: bright and marching until the user is in the zone
      this.floorPath.setMode("bright")
    }
  }

  /** Ducked at or below baseline − duckDrop; standing again only above that line + duckHysteresis. */
  private updateDucked(headY: number): void {
    if (this.baselineHeadY === null) {
      return
    }
    const duckY = this.baselineHeadY - this.config.duckDrop
    const ducked = this._ducked ? headY <= duckY + this.config.duckHysteresis : headY <= duckY
    if (ducked !== this._ducked) {
      this._ducked = ducked
      console.log(`${LOG} QUAKE: ${ducked ? "ducked" : "stood up"} (head Y ${fmt(headY)} cm)`)
    }
  }

  /** hasBeenSafe and tSafe are set the first time inZone && ducked hold for safeHoldSeconds. */
  private updateSafeHold(now: number): void {
    if (!this.isSafe) {
      this.safeSince = -1
      return
    }
    if (this.safeSince < 0) {
      this.safeSince = now
    }
    if (this._state === "AFTERSHOCK") {
      // Slice 7C: its own time to cover; the main quake's tSafe (and the score) stay as they were.
      if (this._aftershockTimeToCover === null && now - this.safeSince >= this.config.safeHoldSeconds) {
        this._aftershockTimeToCover = now - this.aftershockStartTime
        console.log(`${LOG} AFTERSHOCK: safe after ${fmt(this._aftershockTimeToCover)} s`)
      }
      return
    }
    if (!this._hasBeenSafe && now - this.safeSince >= this.config.safeHoldSeconds) {
      this._hasBeenSafe = true
      this._tSafe = now - this.quakeStartTime
      console.log(`${LOG} QUAKE: safe after ${fmt(this._tSafe)} s`)
    }
  }

  /** Sets the HUD instruction only when the key changes. */
  private showInstruction(key: StringKey): void {
    if (key === this._instructionKey) {
      return
    }
    this._instructionKey = key
    this.hud.setInstruction(key)
  }

  /** Back to "not under cover" for a new drill (BRIEFING). */
  private resetCover(): void {
    this._inZone = false
    this._ducked = false
    this._hasBeenSafe = false
    this._tSafe = null
    this.safeSince = -1
    this.hideArrow()
  }

  private hideArrow(): void {
    this.offscreenArrow.hide()
    this._arrowVisible = false
  }

  /** Stops the quake: update, end timer, shake, rumble, blink, arrow. Safe to call twice. */
  private stopQuakeEffects(): void {
    this.quakeUpdate.enabled = false
    this.quakeEndTimer.cancel()
    this.quakeShaker.stopShake()
    this.fallingObjects.cancelPending() // items already in the air still land, but hit only while shaking
    if (this.rumbleAudio.isPlaying()) {
      this.rumbleAudio.stop(false)
    }
    this.rumbleAudio.volume = this.rumbleBaseVolume
    for (const z of this.safeZones) {
      z.stopBlink()
    }
    this.hideArrow()
    this.hideScanPathEdge()
  }

  /** Ends the scan and hides its brackets, the floor path and the edge warning (Slice 7B). */
  private hideScanPathEdge(): void {
    this.scanIntro.stop()
    this.scanIntro.hideBrackets()
    this.floorPath.setMode("off")
    this.edgeWarning.setActive(false)
  }

  private enterPostQuake(): void {
    this.stopQuakeEffects()
    if (!this._aftershockHappened) {
      // 5j-19c: the score is the main quake's; the aftershock can still drain health and end the drill.
      this.scoreTSafe = this._tSafe
      this.scoreHealth = this._health
      this.scoreStanding = this._secondsStanding
    }
    this._instructionKey = "instr.comeOut"
    this.hud.setInstruction(this._instructionKey)
    if (!this.inAnySafeZone(this.headPose.position)) {
      this.onHeadLeftSafeZone() // already outside: straight to RESULT
      return
    }
    this.postQuakeUpdate.enabled = true
  }

  private enterResult(): void {
    this.postQuakeUpdate.enabled = false
    this._lastScore = computeScore(this.scoreTSafe, this.scoreHealth, this.scoreStanding, this._walkAllowance) // 5j-19c
    const b = this._lastScore
    console.log(
      `${LOG} RESULT: tSafe ${b.tSafe === null ? "never" : fmt(b.tSafe) + " s"}, walk allowance ${fmt(b.walkAllowance)} s, speedTime ${b.speedTime === null ? "never" : fmt(b.speedTime) + " s"}, speed ${b.speedPoints}, health ${fmt(b.healthLeft)} (${b.healthPoints}), standing ${fmt(b.secondsStanding)} s (-${b.penalty}), score ${b.score}`
    )
    this.showResultPanel()
    this.showReveal(true)
    this.resultPanel.showResult(b, this.resultExtras())
  }

  private enterGameOver(): void {
    this.stopQuakeEffects()
    this.aftershockTimer.cancel()
    this.aftershockPending = false
    this._lastScore = null
    const reason = this._gameOverReason ? this._gameOverReason : "over.why.stood"
    this.showResultPanel()
    this.showReveal(true)
    this.resultPanel.showGameOver(reason, this.resultExtras())
  }

  /** Slice 7C AFTERSHOCK: a second, weaker shake with the same staged instructions, cover and drain rules. Health carries over. */
  private enterAftershock(): void {
    this.postQuakeUpdate.enabled = false
    this._aftershockHappened = true
    this._aftershockTimeToCover = null
    this.aftershockStartTime = getTime()
    this.safeSince = -1
    this._instructionKey = null
    this._nearBed = false
    const c = this.config
    const d = c.testMode ? c.testAftershockDurationSeconds : randomBetween(c.aftershockDurationMin, c.aftershockDurationMax)
    this.quakeShaker.startShake(d, c.aftershockStrength)
    this.scheduleFalls(d)
    this.rumbleAudio.volume = 0
    if (this.rumbleAudio.audioTrack) {
      this.rumbleAudio.play(-1)
    }
    this.hud.show()
    this.hud.setHealth(this._health)
    this.hud.setElapsed(0)
    this.hud.showWarning("warn.aftershock")
    for (const z of this.activeTables) {
      z.startBlink()
    }
    this.updateTarget(true)
    this.updateCover(this.aftershockStartTime)
    this.quakeEndTimer.reset(d)
    this.quakeUpdate.enabled = true
    console.log(`${LOG} AFTERSHOCK: ${fmt(d)} s at strength ${fmt(c.aftershockStrength)}, health ${fmt(this._health)}`)
  }

  /** The result rows Slice 7C adds: the aftershock's time to cover (if one happened), the level, and on Hard the reveal note. */
  private resultExtras(): ResultLine[] {
    const extra: ResultLine[] = []
    if (this._aftershockHappened) {
      const t = this._aftershockTimeToCover
      extra.push({text: lines("result.aftershock", {"{s}": t === null ? "–" : t.toFixed(1)}), split: true})
    }
    extra.push({text: lines("result.level", {"{level}": getString(levelNameKey(this._level))}), split: true})
    if (!guidesOn(this._level)) {
      extra.push({text: lines("result.reveal"), split: false})
    }
    return extra
  }

  /**
   * Hard has no guides during the drill (5j-18); everything else keeps whatever
   * guides were set (DC10 turns them off by hand on Normal).
   */
  private applyLevelGuides(): void {
    if (!guidesOn(this._level)) {
      if (this._guidesVisible) this.setGuidesVisible(false)
      this.levelHidGuides = true
    } else if (this.levelHidGuides) {
      this.levelHidGuides = false
      this.setGuidesVisible(true)
    }
  }

  /**
   * Hard reveal (Slice 7C), on RESULT and GAME_OVER: guides back on, hazard
   * labels, danger zones and table markers shown, and a red warn.bed over the
   * bed. `on` false hides the bed label (Restart, language change).
   */
  private showReveal(on: boolean): void {
    if (!on) {
      if (this.bedRevealLabel) this.bedRevealLabel.enabled = false
      this._revealShown = false
      return
    }
    if (guidesOn(this._level)) {
      return
    }
    this.setGuidesVisible(true)
    this.setRoomLabelsShown(true)
    this.setDangerZonesShown(true)
    this.showBedRevealLabel()
    this._revealShown = true
  }

  private showBedRevealLabel(): void {
    const at = this._layout ? this._layout.items.bed : null
    if (!at) {
      return
    }
    if (!this.bedRevealLabel) {
      const so = global.scene.createSceneObject("BedRevealLabel")
      so.setParent(this.room)
      const t = so.createComponent("Component.Text") as Text
      t.size = BED_REVEAL_SIZE
      ;(t as Text & {weight?: number}).weight = 700
      t.depthTest = true
      t.textFill.color = SOFT_RED
      t.outlineSettings.enabled = true
      t.outlineSettings.size = 0.2
      t.outlineSettings.fill.color = new vec4(0.2, 0.2, 0.2, 1)
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.verticalOverflow = VerticalOverflow.Overflow
      this.bedRevealLabel = so
    }
    const so = this.bedRevealLabel
    const t = so.getComponent("Component.Text") as Text
    setLineText(t, getString("warn.bed"), getLanguage())
    const tr = so.getTransform()
    tr.setLocalPosition(new vec3(at.x, BED_REVEAL_HEIGHT, at.z))
    let dir = this.headPose.position.sub(tr.getWorldPosition())
    dir = new vec3(dir.x, 0, dir.z)
    dir = dir.length > 0.0001 ? dir.normalize() : new vec3(0, 0, 1)
    tr.setWorldRotation(quat.lookAt(dir, vec3.up()))
    so.enabled = true
  }

  /**
   * Hides the HUD, arrow, labels and danger zones, then places the result panel
   * in front of the head. The room stays visible behind it (5f item 3).
   */
  private showResultPanel(): void {
    this.hud.hide()
    this.hideArrow()
    this.hideScanPathEdge()
    this.setRoomLabelsShown(false)
    this.setDangerZonesShown(false)
    this.room.enabled = true
    this._instructionKey = null
    this.resultPanel.placeInFront(
      this.headPose.position,
      this.panelForward("result"),
      this.config.hudDistance,
      this.config.resultBelowEye
    )
  }

  /**
   * Slice 8A P1: the head's look turned by the PanelAim offset (0, ±20°, ±40°)
   * whose ray from the eye crosses the fewest footprints, so furniture does
   * not stand between the eye and the panel.
   */
  private panelForward(panel: string): vec3 {
    const f = this.headPose.forward
    const eye = this.toRoomLocal(this.headPose.position)
    const c = Math.cos(this.roomYaw)
    const s = Math.sin(this.roomYaw)
    const aim = panelYawOffset(this._layout, eye.x, eye.y, f.x * c - f.z * s, f.x * s + f.z * c)
    console.log(`${LOG} ${this._state}: ${panel} panel yaw offset ${aim.offsetDeg}° (${aim.hits} footprint(s) on the line)`)
    return quat.angleAxis((aim.offsetDeg * Math.PI) / 180, vec3.up()).multiplyVec3(f)
  }

  /** Hazard labels and the steady safe-zone marker (R3, R4). Furniture stays visible. */
  private setRoomLabelsShown(shown: boolean): void {
    const on = shown && this._guidesVisible
    for (const h of HAZARDS) {
      if (on && this.activeHazards.indexOf(h) >= 0) {
        this.labels[h].show()
      } else {
        this.labels[h].hide()
      }
    }
    this.setMarkersShown(shown)
  }

  /** The safe-zone marker of every table in this drill (guides on only). */
  private setMarkersShown(shown: boolean): void {
    const on = shown && this._guidesVisible
    for (const z of this.safeZones) {
      if (on && this.activeTables.indexOf(z) >= 0) {
        z.showMarker()
      } else {
        z.hideMarker()
      }
    }
  }

  /**
   * ENGINEERING_PLAN 5i item 2: the three hazard labels hide when the quake
   * starts and stay hidden through POST_QUAKE; the next BRIEFING shows them
   * again (setRoomLabelsShown(true)). Their danger labels are children and hide
   * with them. The safe-zone marker and the danger-zone floor stay.
   */
  private hideHazardLabels(): void {
    for (const h of HAZARDS) {
      this.labels[h].hide()
      const dangerLabel = this.zones[h].label
      if (dangerLabel && dangerLabel.isEnabledInHierarchy) {
        dangerLabel.enabled = false // no longer under its hazard label: hide it on its own (the zone shows it again)
      }
    }
  }

  /** Danger zones show from BRIEFING through POST_QUAKE (Slice 5P). */
  private setDangerZonesShown(shown: boolean): void {
    const on = shown && this._guidesVisible
    for (const h of HAZARDS) {
      if (on && this.activeHazards.indexOf(h) >= 0) {
        this.zones[h].show()
      } else {
        this.zones[h].hide()
      }
    }
  }

  /**
   * Puts the Room's origin under the head at floorY and turns it (yaw only,
   * level) so its −Z is the head's level look direction. Looking straight up
   * or down keeps the last heading.
   */
  private placeRoom(): void {
    const p = this.headPose.position
    const f = this.headPose.forward
    if (Math.sqrt(f.x * f.x + f.z * f.z) > 1e-4) {
      this.roomYaw = Math.atan2(-f.x, -f.z) // local −Z = (−sin, −cos) → level forward
    }
    const t = this.room.getTransform()
    t.setWorldPosition(new vec3(p.x, this._floorY, p.z))
    t.setWorldRotation(quat.angleAxis(this.roomYaw, vec3.up()))
    this.roomX = p.x
    this.roomZ = p.z
    console.log(`${LOG} room placed at (${fmt(p.x)}, ${fmt(this._floorY)}, ${fmt(p.z)}) cm, heading ${fmt(this.roomYaw * RAD_TO_DEG)} deg`)
  }

  /**
   * New layout (LayoutGenerator) in Room-local space: the table and its marker,
   * then each hazard; its label keeps its authored offset and turns to the start spot.
   */
  private applyLayout(): void {
    const layout = generateLayout(layoutParamsFor(this._level, this.config), this.testForce)
    this._layout = layout
    if (layout.fallback) {
      console.warn(`${LOG} BRIEFING: no valid layout in ${layout.tries} tries (seed ${layout.seed}); using the Slice 2 fixed layout`)
    } else {
      console.log(`${LOG} BRIEFING: layout seed ${layout.seed}${this.config.layoutSeed === 0 ? " (new)" : " (fixed)"}, ${layout.tries} tries`)
    }
    const items = layout.items
    // Last drill's models go (5j-14); absent items are disabled, so their zone and label go with them.
    for (const so of this.instances) {
      so.destroy()
    }
    this.instances = []
    this.activeTables = []
    for (let i = 0; i < TABLES.length; i++) {
      const zone = this.safeZones[i]
      const at = items[TABLES[i]]
      zone.table.enabled = !!at
      zone.marker.enabled = !!at
      if (at) {
        placeItem(zone.table, at)
        placeItem(zone.marker, at)
        this.activeTables.push(zone)
        this.addModel(TABLES[i], zone.table)
        this.logItem(TABLES[i], at)
      }
    }
    this.activeHazards = layout.hazards.slice()
    for (const h of HAZARDS) {
      const anchor = this.zones[h].hazard
      const at = items[h]
      anchor.enabled = !!at
      if (at) {
        placeItem(anchor, at)
        this.aimLabel(this.labels[h], at)
        this.addModel(h, anchor)
        this.logItem(h, at)
      }
    }
    const furniture: [LayoutItem, SceneObject][] = [["bed", this.bed], ["chair", this.chair]]
    for (const [item, anchor] of furniture) {
      const at = items[item]
      anchor.enabled = !!at
      if (at) {
        placeItem(anchor, at)
        this.addModel(item, anchor)
        this.logItem(item, at)
      }
    }
    if (this.roomWalls) {
      this.roomWalls.apply(layout.room, layout.door) // Slice 8A
    } else {
      console.warn(`${LOG} DrillController: roomWalls is not assigned; no walls or door`)
    }
  }

  /**
   * The item's real model (Slice 7R) as a child of its anchor: root at the
   * anchor (bottom center), its authored scale kept, its +Z front turned to
   * the item's front.
   */
  private addModel(item: LayoutItem, anchor: SceneObject): void {
    const prefab = this.prefabs[item]
    if (!prefab) {
      return
    }
    const so = prefab.instantiate(anchor)
    const t = so.getTransform()
    t.setLocalPosition(vec3.zero())
    t.setLocalRotation(quat.angleAxis(FOOTPRINTS[item].front, vec3.up()).multiply(t.getLocalRotation()))
    this.instances.push(so)
  }

  /** Turns a label (a child of its hazard at `at`) so its +Z faces the start spot. */
  private aimLabel(label: HazardLabel, at: Placement): void {
    const t = label.sceneObject.getTransform()
    const lp = t.getLocalPosition()
    const c = Math.cos(at.yaw)
    const s = Math.sin(at.yaw)
    // Label position in Room-local space: local X → (cos, −sin), local Z → (sin, cos).
    const x = at.x + lp.x * c + lp.z * s
    const z = at.z - lp.x * s + lp.z * c
    t.setLocalRotation(quat.angleAxis(Math.atan2(-x, -z) - at.yaw, vec3.up()))
  }

  private logItem(item: LayoutItem, at: Placement): void {
    console.log(`${LOG}   ${item} at (${fmt(at.x)}, ${fmt(at.z)}) cm, yaw ${fmt(at.yaw * RAD_TO_DEG)} deg, ${fmt(Math.sqrt(at.x * at.x + at.z * at.z))} cm from start`)
  }
}

const RAD_TO_DEG = 180 / Math.PI // layout yaw is radians; logs show degrees

/** Moves a Room child to a layout placement (Room-local cm, yaw radians), keeping its height. */
function placeItem(so: SceneObject, at: Placement): void {
  const t = so.getTransform()
  t.setLocalPosition(new vec3(at.x, t.getLocalPosition().y, at.z))
  t.setLocalRotation(quat.angleAxis(at.yaw, vec3.up()))
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min)
}
