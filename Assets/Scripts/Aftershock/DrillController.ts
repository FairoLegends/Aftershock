import {BriefingPanel} from "./BriefingPanel"
import {DANGER_LABEL_HALF_H, DangerZone} from "./DangerZone"
import {DrillConfig} from "./DrillConfig"
import {HazardLabel} from "./HazardLabel"
import {HeadPose} from "./HeadPose"
import {Hud} from "./Hud"
import {LanguagePanel} from "./LanguagePanel"
import {generateLayout, HAZARDS, Layout, LayoutItem, Placement} from "./LayoutGenerator"
import {OffscreenArrow} from "./OffscreenArrow"
import {QuakeShaker} from "./QuakeShaker"
import {ResultPanel} from "./ResultPanel"
import {SafetyPanel} from "./SafetyPanel"
import {SafeZone} from "./SafeZone"
import {computeScore, ScoreBreakdown} from "./ScoreCalculator"
import {getLanguage, Lang, setLanguage, setLanguageFonts, StringKey} from "./Strings"

export type DrillState = "LANGUAGE" | "SAFETY" | "BRIEFING" | "QUAKE" | "POST_QUAKE" | "RESULT" | "GAME_OVER"

// USER_FLOW_DIAGRAM §2. Any transition not listed here is refused.
const ALLOWED: Record<DrillState, DrillState[]> = {
  LANGUAGE: ["SAFETY"],
  SAFETY: ["BRIEFING"],
  BRIEFING: ["QUAKE"],
  QUAKE: ["GAME_OVER", "POST_QUAKE"],
  POST_QUAKE: ["RESULT"],
  RESULT: ["BRIEFING"],
  GAME_OVER: ["BRIEFING"]
}

const LOG = "[Aftershock]"

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
 * RESULT with the TDD §7 score; Restart → BRIEFING with a full reset.
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
  @hint("ResultPanel component (result / game-over + Restart, under AftershockRoot)")
  resultPanel: ResultPanel

  private hazardLabels: HazardLabel[] = []
  private postQuakeUpdate: UpdateEvent | null = null
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
  private _secondsStanding = 0 // s exposed after first safe (TDD §7 penalty)
  private baselineHeadY: number | null = null
  private _floorY = 0 // cm, world; fixed once at start
  private roomYaw = 0 // radians; the Room's heading, from the wearer's look at BRIEFING
  private zones: Record<string, DangerZone> = {}
  private labels: Record<string, HazardLabel> = {}
  private _layout: Layout | null = null
  private _inDanger = false
  private _secondsInDanger = 0 // s inside a danger zone during QUAKE
  private _gameOverReason: StringKey | null = null
  private _inZone = false
  private _ducked = false
  private _hasBeenSafe = false
  private _tSafe: number | null = null // s from quake start
  private safeSince = -1 // s; when inZone && ducked last began, -1 when not safe

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
  /** Seconds exposed (not inZone && ducked) after first being safe, this drill. */
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
  /** Head XZ inside any danger zone (QUAKE). */
  get inDanger(): boolean {
    return this._inDanger
  }
  /** Seconds inside a danger zone during this drill's QUAKE. */
  get secondsInDanger(): number {
    return this._secondsInDanger
  }
  /** Why the last GAME_OVER happened (over.why.danger or over.why.stood), or null. */
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

  onAwake(): void {
    this.quakeStartTimer = this.createEvent("DelayedCallbackEvent")
    this.quakeStartTimer.bind(() => this.onRandomWaitEnded())
    this.quakeEndTimer = this.createEvent("DelayedCallbackEvent")
    this.quakeEndTimer.bind(() => this.onQuakeTimeOver())
    this.quakeUpdate = this.createEvent("UpdateEvent")
    this.quakeUpdate.bind(() => this.onQuakeUpdate())
    this.quakeUpdate.enabled = false
    this.postQuakeUpdate = this.createEvent("UpdateEvent")
    this.postQuakeUpdate.bind(() => this.onPostQuakeUpdate())
    this.postQuakeUpdate.enabled = false
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
      ["briefingPanel", this.briefingPanel],
      ["quakeShaker", this.quakeShaker],
      ["hud", this.hud],
      ["offscreenArrow", this.offscreenArrow],
      ["rumbleAudio", this.rumbleAudio],
      ["resultPanel", this.resultPanel]
    ]
    const missing = inputs.filter((entry) => !entry[1]).map((entry) => entry[0])
    if (missing.length > 0) {
      console.error(`${LOG} DrillController: missing input(s): ${missing.join(", ")}`)
      return
    }
    this.zones = {cabinet: this.cabinetDanger, shelf: this.shelfDanger, glass: this.glassDanger}
    this.labels = {cabinet: this.cabinetLabel, shelf: this.shelfLabel, glass: this.glassLabel}
    const wrong = HAZARDS.filter((h) => this.zones[h].item !== h || !this.zones[h].hazard).map((h) => h + "Danger")
    if (!this.safeZone.table || !this.safeZone.marker) {
      wrong.push("safeZone.table/marker")
    }
    if (wrong.length > 0) {
      console.error(`${LOG} DrillController: wrong kind or no hazard parent: ${wrong.join(", ")}`)
      return
    }
    // Ambient loop: latency is fine (specs-audio).
    this.rumbleAudio.playbackMode = Audio.PlaybackMode.LowPower
    this.rumbleBaseVolume = this.rumbleAudio.volume
    if (!this.rumbleAudio.audioTrack) {
      console.warn(`${LOG} DrillController: rumbleAudio has no audio track; the quake will be silent`)
    }
    this._health = this.config.healthStart
    this.hazardLabels = [this.cabinetLabel, this.shelfLabel, this.glassLabel]

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
    this.transitionTo("BRIEFING")
  }

  onRandomWaitEnded(): void {
    if (this._state === "BRIEFING") {
      this.transitionTo("QUAKE")
    }
  }
  onQuakeTimeOver(): void {
    if (this._state === "QUAKE") {
      this.transitionTo("POST_QUAKE")
    }
  }

  onHealthDepleted(): void {
    if (this._state === "QUAKE") {
      this.transitionTo("GAME_OVER")
    }
  }
  onHeadLeftSafeZone(): void {
    if (this._state === "POST_QUAKE") {
      this.transitionTo("RESULT")
    }
  }
  /** Restart → BRIEFING with a full reset (enterBriefing resets health, cover, standing time, arrow). */
  onRestartPressed(): void {
    if (this._state !== "RESULT" && this._state !== "GAME_OVER") {
      return
    }
    this.stopQuakeEffects()
    this.postQuakeUpdate.enabled = false
    this.quakeStartTimer.cancel()
    this._lastScore = null
    this._quakeDuration = 0
    this.resultPanel.hide()
    this.transitionTo("BRIEFING")
  }

  /**
   * LEAF test hook only (TDD §8); the drill never calls it. Stops every timer
   * and quake effect from any state, then a fresh BRIEFING (health healthStart)
   * or, with toLanguage, the opening picker (nothing else leads to LANGUAGE).
   */
  resetForTest(toLanguage: boolean = false): void {
    console.log(`${LOG} resetForTest from ${this._state}`)
    this.stopQuakeEffects()
    this.postQuakeUpdate.enabled = false
    this.quakeStartTimer.cancel()
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
      case "BRIEFING":
        this.enterBriefing()
        break
      case "QUAKE":
        this.enterQuake()
        break
      case "POST_QUAKE":
        this.enterPostQuake()
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
    this.setRoomLabelsShown(false)
    this.setDangerZonesShown(false)
    this.briefingPanel.hide()
    this.hud.hide()
    this.resultPanel.hide()
    this.safetyPanel.hide()
    this.languagePanel.placeInFront(this.headPose.position, this.headPose.forward, this.config.hudDistance, 0)
    this.languagePanel.show()
  }

  private enterSafety(): void {
    this.languagePanel.hide()
    this._instructionKey = null
    this.hideArrow()
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

  private enterBriefing(): void {
    this.safetyPanel.hide()
    this.resultPanel.hide()
    this._health = this.config.healthStart
    this._secondsStanding = 0
    this._secondsInDanger = 0
    this._inDanger = false
    this._gameOverReason = null
    this.resetCover()
    this._instructionKey = "instr.brief"
    // ENGINEERING_PLAN 5f item 1: never the current head height (restarting while ducked broke ducking).
    this.baselineHeadY = this._floorY + this.config.eyeHeight
    console.log(`${LOG} BRIEFING: duck baseline = floorY ${fmt(this._floorY)} + eyeHeight ${fmt(this.config.eyeHeight)} = ${fmt(this.baselineHeadY)} cm (ducked at <= ${fmt(this.baselineHeadY - this.config.duckDrop)} cm)`)
    this.placeRoom() // 5f item 2: wearer's current spot and heading, floor height unchanged
    this.applyLayout()
    // Room is at rest here, so the zones never shake; the arrow aims at the new safeZone.aimPoint.
    this.safeZone.captureRest()
    for (const h of HAZARDS) {
      this.zones[h].captureRest()
    }
    this.setRoomLabelsShown(true)
    this.setDangerZonesShown(true)
    this.briefingPanel.placeInFront(
      this.headPose.position,
      this.headPose.forward,
      this.config.hudDistance,
      this.config.hudBelowEye
    )
    this.briefingPanel.show()
    this.hud.hide()

    const wait = this.config.testMode
      ? this.config.testWaitSeconds
      : randomBetween(this.config.quakeWaitMin, this.config.quakeWaitMax)
    console.log(`${LOG} BRIEFING: quake in ${fmt(wait)} s`)
    this.quakeStartTimer.reset(wait)
  }

  private enterQuake(): void {
    this.briefingPanel.hide()
    this._quakeDuration = this.config.testMode
      ? this.config.testDurationSeconds
      : randomBetween(this.config.quakeDurationMin, this.config.quakeDurationMax)
    console.log(`${LOG} QUAKE: lasts ${fmt(this._quakeDuration)} s`)

    this.quakeShaker.startShake(this._quakeDuration)
    if (this.rumbleAudio.audioTrack) {
      this.rumbleAudio.volume = 0 // ramps with the shake (DESIGN_BRIEF §6.2)
      this.rumbleAudio.play(-1)
    }

    this.hud.show()
    this.hud.setHealth(this._health)
    this.hud.setElapsed(0)
    this.hud.showWarning()
    this.hideHazardLabels()
    this.safeZone.startBlink()

    this.quakeStartTime = getTime()
    this.updateCover(this.quakeStartTime) // first instruction (goUnder unless already under cover)
    this.quakeEndTimer.reset(this._quakeDuration)
    this.quakeUpdate.enabled = true
  }

  private onQuakeUpdate(): void {
    const now = getTime()
    this.hud.setElapsed(now - this.quakeStartTime)
    this.rumbleAudio.volume = this.rumbleBaseVolume * this.quakeShaker.envelope
    this.updateCover(now)
    this.updateDanger()

    // ENGINEERING_PLAN 5f item 4: drain while exposed once safe (hasBeenSafe && !(inZone && ducked),
    // TDD §4.1, §7) OR inside a danger zone; one drain, never doubled.
    const exposed = this._hasBeenSafe && !this.isSafe
    if (this._state === "QUAKE" && (exposed || this._inDanger)) {
      const dt = getDeltaTime()
      if (exposed) {
        this._secondsStanding += dt
      }
      if (this._inDanger) {
        this._secondsInDanger += dt
      }
      this._health = Math.max(0, this._health - this.config.healthDrainPerSecond * dt)
      this.hud.setHealth(this._health)
      if (this._health <= 0) {
        this._gameOverReason = this._inDanger ? "over.why.danger" : "over.why.stood"
        console.log(`${LOG} QUAKE: health reached 0 after ${fmt(this._secondsStanding)} s exposed, ${fmt(this._secondsInDanger)} s in danger (${this._gameOverReason})`)
        this.onHealthDepleted()
      }
    }
  }

  /** Head XZ inside any danger zone's rest area (QUAKE). */
  private updateDanger(): void {
    const head = this.headPose.position
    let inDanger = false
    for (const h of HAZARDS) {
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

  /** POST_QUAKE: wait for the head to leave the safe zone (USER_FLOW_DIAGRAM §2). */
  private onPostQuakeUpdate(): void {
    if (!this.safeZone.contains(this.headPose.position)) {
      this.onHeadLeftSafeZone()
    }
  }

  /** One QUAKE frame of take-cover logic (TDD §3.1, §4.1): zone, duck, safe hold, instruction, arrow. */
  private updateCover(now: number): void {
    const head = this.headPose.position
    const inZone = this.safeZone.contains(head)
    if (inZone !== this._inZone) {
      this._inZone = inZone
      console.log(`${LOG} QUAKE: ${inZone ? "entered" : "left"} the safe zone`)
    }
    this.updateDucked(head.y)
    this.updateSafeHold(now)
    this.showInstruction(!this._inZone ? "instr.goUnder" : this._ducked ? "instr.hold" : "instr.duck")
    if (this._inZone) {
      this.hideArrow() // inside the zone the user is on their own spot (ENGINEERING_PLAN 5a item 8)
    } else {
      this._arrowVisible = this.offscreenArrow.track(this.safeZone.aimPoint)
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
    if (this.rumbleAudio.isPlaying()) {
      this.rumbleAudio.stop(false)
    }
    this.rumbleAudio.volume = this.rumbleBaseVolume
    this.safeZone.stopBlink()
    this.hideArrow()
  }

  private enterPostQuake(): void {
    this.stopQuakeEffects()
    this._instructionKey = "instr.comeOut"
    this.hud.setInstruction(this._instructionKey)
    if (!this.safeZone.contains(this.headPose.position)) {
      this.onHeadLeftSafeZone() // already outside: straight to RESULT
      return
    }
    this.postQuakeUpdate.enabled = true
  }

  private enterResult(): void {
    this.postQuakeUpdate.enabled = false
    this._lastScore = computeScore(this._tSafe, this._health, this._secondsStanding)
    const b = this._lastScore
    console.log(
      `${LOG} RESULT: tSafe ${b.tSafe === null ? "never" : fmt(b.tSafe) + " s"}, speed ${b.speedPoints}, health ${fmt(b.healthLeft)} (${b.healthPoints}), standing ${fmt(b.secondsStanding)} s (-${b.penalty}), score ${b.score}`
    )
    this.showResultPanel()
    this.resultPanel.showResult(b)
  }

  private enterGameOver(): void {
    this.stopQuakeEffects()
    this._lastScore = null
    const reason = this._gameOverReason ? this._gameOverReason : "over.why.stood"
    this.showResultPanel()
    this.resultPanel.showGameOver(reason)
  }

  /**
   * Hides the HUD, arrow, labels and danger zones, then places the result panel
   * in front of the head. The room stays visible behind it (5f item 3).
   */
  private showResultPanel(): void {
    this.hud.hide()
    this.hideArrow()
    this.setRoomLabelsShown(false)
    this.setDangerZonesShown(false)
    this.room.enabled = true
    this._instructionKey = null
    this.resultPanel.placeInFront(
      this.headPose.position,
      this.headPose.forward,
      this.config.hudDistance,
      this.config.resultBelowEye
    )
  }

  /** Hazard labels and the steady safe-zone marker (R3, R4). Furniture stays visible. */
  private setRoomLabelsShown(shown: boolean): void {
    for (const label of this.hazardLabels) {
      if (shown) {
        label.show()
      } else {
        label.hide()
      }
    }
    if (shown) {
      this.safeZone.showMarker()
    } else {
      this.safeZone.hideMarker()
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
    for (const h of HAZARDS) {
      if (shown) {
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
    console.log(`${LOG} room placed at (${fmt(p.x)}, ${fmt(this._floorY)}, ${fmt(p.z)}) cm, heading ${fmt(this.roomYaw * RAD_TO_DEG)} deg`)
  }

  /**
   * New layout (LayoutGenerator) in Room-local space: the table and its marker,
   * then each hazard; its label keeps its authored offset and turns to the start spot.
   */
  private applyLayout(): void {
    const layout = generateLayout(this.config)
    this._layout = layout
    if (layout.fallback) {
      console.warn(`${LOG} BRIEFING: no valid layout in ${layout.tries} tries (seed ${layout.seed}); using the Slice 2 fixed layout`)
    } else {
      console.log(`${LOG} BRIEFING: layout seed ${layout.seed}${this.config.layoutSeed === 0 ? " (new)" : " (fixed)"}, ${layout.tries} tries`)
    }
    const items = layout.items
    placeItem(this.safeZone.table, items.table)
    placeItem(this.safeZone.marker, items.table)
    this.logItem("table", items.table)
    for (const h of HAZARDS) {
      const at = items[h]
      placeItem(this.zones[h].hazard, at)
      this.aimLabel(this.labels[h], at)
      this.logItem(h, at)
    }
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
