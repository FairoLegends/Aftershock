import {BriefingPanel} from "./BriefingPanel"
import {DrillConfig} from "./DrillConfig"
import {HazardLabel} from "./HazardLabel"
import {HeadPose} from "./HeadPose"
import {Hud} from "./Hud"
import {QuakeShaker} from "./QuakeShaker"
import {SafetyPanel} from "./SafetyPanel"
import {SafeZone} from "./SafeZone"
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
 * The only owner of drill state (TDD §4). Slice 1: SAFETY → BRIEFING works;
 * BRIEFING captures the duck baseline and logs; the other states are stubs.
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
  @hint("AudioComponent with the looping rumble track")
  rumbleAudio: AudioComponent

  private hazardLabels: HazardLabel[] = []
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
  private _lastScore: number | null = null
  private baselineHeadY: number | null = null

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
  get lastScore(): number | null {
    return this._lastScore
  }
  /** Head height captured when BRIEFING starts (cm), or null before that. */
  get duckBaseline(): number | null {
    return this.baselineHeadY
  }
  /** This drill's quake length (s), picked when QUAKE starts. */
  get quakeDuration(): number {
    return this._quakeDuration
  }

  onAwake(): void {
    this.quakeStartTimer = this.createEvent("DelayedCallbackEvent")
    this.quakeStartTimer.bind(() => this.onRandomWaitEnded())
    this.quakeEndTimer = this.createEvent("DelayedCallbackEvent")
    this.quakeEndTimer.bind(() => this.onQuakeTimeOver())
    this.quakeUpdate = this.createEvent("UpdateEvent")
    this.quakeUpdate.bind(() => this.onQuakeUpdate())
    this.quakeUpdate.enabled = false
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
      ["rumbleAudio", this.rumbleAudio]
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

  // Stub triggers for later slices. They only log for now.
  onHealthDepleted(): void {
    console.log(`${LOG} stub: health reached 0 (GAME_OVER comes in Slice 5)`)
  }
  onHeadLeftSafeZone(): void {
    console.log(`${LOG} stub: head left the safe zone (RESULT comes in Slice 5)`)
  }
  onRestartPressed(): void {
    console.log(`${LOG} stub: Restart pressed (comes in Slice 5)`)
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
      case "GAME_OVER":
        console.log(`${LOG} stub: enter ${next}`)
        break
    }
  }

  private enterSafety(): void {
    this._instructionKey = null
    this._arrowVisible = false
    this.setRoomLabelsShown(false)
    this.briefingPanel.hide()
    this.hud.hide()
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
    this._health = this.config.healthStart
    this._arrowVisible = false
    this._instructionKey = "instr.brief"
    this.baselineHeadY = this.headPose.position.y
    console.log(`${LOG} BRIEFING: duck baseline head Y = ${fmt(this.baselineHeadY)} cm (ducked at <= ${fmt(this.baselineHeadY - this.config.duckDrop)} cm)`)
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

    this._instructionKey = "instr.goUnder"
    this.hud.show()
    this.hud.setHealth(this._health)
    this.hud.setElapsed(0)
    this.hud.setInstruction(this._instructionKey)
    this.hud.showWarning()
    this.safeZone.startBlink()

    this.quakeStartTime = getTime()
    this.quakeEndTimer.reset(this._quakeDuration)
    this.quakeUpdate.enabled = true
  }

  private onQuakeUpdate(): void {
    this.hud.setElapsed(getTime() - this.quakeStartTime)
    this.rumbleAudio.volume = this.rumbleBaseVolume * this.quakeShaker.envelope
  }

  private enterPostQuake(): void {
    this.quakeUpdate.enabled = false
    this.quakeShaker.stopShake()
    if (this.rumbleAudio.isPlaying()) {
      this.rumbleAudio.stop(false)
    }
    this.rumbleAudio.volume = this.rumbleBaseVolume
    this.safeZone.stopBlink()
    this._instructionKey = "instr.comeOut"
    this.hud.setInstruction(this._instructionKey)
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
