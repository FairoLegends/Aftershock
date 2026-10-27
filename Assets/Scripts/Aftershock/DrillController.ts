import {BriefingPanel} from "./BriefingPanel"
import {DrillConfig} from "./DrillConfig"
import {HazardLabel} from "./HazardLabel"
import {HeadPose} from "./HeadPose"
import {Hud} from "./Hud"
import {OffscreenArrow} from "./OffscreenArrow"
import {QuakeShaker} from "./QuakeShaker"
import {ResultPanel} from "./ResultPanel"
import {SafetyPanel} from "./SafetyPanel"
import {SafeZone} from "./SafeZone"
import {computeScore, ScoreBreakdown} from "./ScoreCalculator"
import {StringKey} from "./Strings"

export type DrillState = "SAFETY" | "BRIEFING" | "QUAKE" | "POST_QUAKE" | "RESULT" | "GAME_OVER"

// USER_FLOW_DIAGRAM §2. Any transition not listed here is refused.
const ALLOWED: Record<DrillState, DrillState[]> = {
  SAFETY: ["BRIEFING"],
  BRIEFING: ["QUAKE"],
  QUAKE: ["GAME_OVER", "POST_QUAKE"],
  POST_QUAKE: ["RESULT"],
  RESULT: ["BRIEFING"],
  GAME_OVER: ["BRIEFING"]
}

const LOG = "[Aftershock]"

/**
 * The only owner of drill state (TDD §4). SAFETY → BRIEFING → QUAKE →
 * POST_QUAKE work. BRIEFING captures the duck baseline and the safe zone's
 * rest footprint. Each QUAKE frame checks cover (inZone, ducked), stages the
 * instruction and drives the off-screen arrow (Slice 4). Once safe, exposure
 * drains health (0 → GAME_OVER); leaving the zone after the quake → RESULT
 * with the TDD §7 score; Restart → BRIEFING with a full reset (Slice 5).
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
  @hint("Room root. At start its floor is placed eyeHeight below the head.")
  room: SceneObject

  @input
  @hint("SafeZone component on the table's marker")
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
  private _inZone = false
  private _ducked = false
  private _hasBeenSafe = false
  private _tSafe: number | null = null // s from quake start
  private safeSince = -1 // s; when inZone && ducked last began, -1 when not safe

  // Read-only getters for LEAF assertions (TDD §8).
  get state(): DrillState | null {
    return this._state
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
  /** Head height captured when BRIEFING starts (cm), or null before that. */
  get duckBaseline(): number | null {
    return this.baselineHeadY
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
      ["room", this.room],
      ["safeZone", this.safeZone],
      ["cabinetLabel", this.cabinetLabel],
      ["shelfLabel", this.shelfLabel],
      ["glassLabel", this.glassLabel],
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
    const floorY = p.y - this.config.eyeHeight
    this.room.getTransform().setWorldPosition(new vec3(p.x, floorY, p.z))
    console.log(`${LOG} room floor at Y = ${fmt(floorY)} cm (eyeHeight ${fmt(this.config.eyeHeight)} cm)`)

    this.safetyPanel.onContinue.add(() => this.onContinuePressed())
    this.resultPanel.onRestart.add(() => this.onRestartPressed())
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

  private transitionTo(next: DrillState): void {
    const prev = this._state
    if (prev !== null && ALLOWED[prev].indexOf(next) < 0) {
      console.warn(`${LOG} refused transition ${prev} -> ${next}`)
      return
    }
    this._state = next
    console.log(`${LOG} state ${prev === null ? "[start]" : prev} -> ${next}`)
    switch (next) {
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

  private enterSafety(): void {
    this._instructionKey = null
    this.hideArrow()
    this.setRoomLabelsShown(false)
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
    this.resetCover()
    this._instructionKey = "instr.brief"
    this.baselineHeadY = this.headPose.position.y
    console.log(`${LOG} BRIEFING: duck baseline head Y = ${fmt(this.baselineHeadY)} cm (ducked at <= ${fmt(this.baselineHeadY - this.config.duckDrop)} cm)`)
    this.safeZone.captureRest() // Room is at rest here, so the zone never shakes
    this.setRoomLabelsShown(true)
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

    // Exposed once safe: hasBeenSafe && !(inZone && ducked) (TDD §4.1, §7).
    if (this._state === "QUAKE" && this._hasBeenSafe && !this.isSafe) {
      const dt = getDeltaTime()
      this._secondsStanding += dt
      this._health = Math.max(0, this._health - this.config.healthDrainPerSecond * dt)
      this.hud.setHealth(this._health)
      if (this._health <= 0) {
        console.log(`${LOG} QUAKE: health reached 0 after ${fmt(this._secondsStanding)} s exposed`)
        this.onHealthDepleted()
      }
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
    this.showResultPanel()
    this.resultPanel.showGameOver()
  }

  /** Hides the HUD and arrow, then places the result panel in front of the head. */
  private showResultPanel(): void {
    this.hud.hide()
    this.hideArrow()
    this._instructionKey = null
    this.resultPanel.placeInFront(
      this.headPose.position,
      this.headPose.forward,
      this.config.hudDistance,
      this.config.hudBelowEye
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
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min)
}
