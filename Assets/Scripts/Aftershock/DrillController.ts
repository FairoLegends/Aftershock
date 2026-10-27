import {BriefingPanel} from "./BriefingPanel"
import {DrillConfig} from "./DrillConfig"
import {HazardLabel} from "./HazardLabel"
import {HeadPose} from "./HeadPose"
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

  private hazardLabels: HazardLabel[] = []
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

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    if (!this.config || !this.headPose || !this.safetyPanel || !this.room || !this.safeZone ||
      !this.cabinetLabel || !this.shelfLabel || !this.glassLabel || !this.briefingPanel) {
      console.error(`${LOG} DrillController: every input must be assigned`)
      return
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

  // Stub triggers for later slices. They only log for now.
  onRandomWaitEnded(): void {
    console.log(`${LOG} stub: random wait ended (QUAKE comes in Slice 3)`)
  }
  onQuakeTimeOver(): void {
    console.log(`${LOG} stub: quake time over (POST_QUAKE comes in Slice 3)`)
  }
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
      case "POST_QUAKE":
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
