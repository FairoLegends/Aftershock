import {DrillConfig} from "./DrillConfig"
import {HazardLabel} from "./HazardLabel"

/**
 * The safe zone under the table (TDD §3.1): containment test and the marker
 * look, steady before the quake and blinking (markerBlinkHz) during it.
 * Blinking toggles the marker's children except its label, which stays
 * steady and readable (color is never the only signal, DESIGN_BRIEF §5.1).
 */
@component
export class SafeZone extends BaseScriptComponent {
  @ui.label("Safe zone under the table (R4)")
  @ui.separator
  @input
  @hint("DrillConfig component (safeZoneMargin)")
  config: DrillConfig

  @input
  @hint("Table whose footprint is the safe zone. Keep it unrotated around Y.")
  table: SceneObject

  @ui.group_start("Settings")
  @input
  @hint("Table footprint along X (cm)")
  footprintWidth: number = 120

  @input
  @hint("Table footprint along Z (cm)")
  footprintDepth: number = 70
  @ui.group_end

  @input
  @hint("Floor ring and its label. Shown in BRIEFING, hidden in SAFETY.")
  marker: SceneObject

  private readonly blinkParts: SceneObject[] = []
  private blinkEvent: UpdateEvent | null = null
  private blinkStart = 0 // s
  private blinkOn = true
  private _blinking = false
  private restCenter: vec3 | null = null
  private restAim: vec3 | null = null

  onAwake(): void {
    this.blinkEvent = this.createEvent("UpdateEvent")
    this.blinkEvent.bind(() => this.onBlinkUpdate())
    this.blinkEvent.enabled = false
  }

  /**
   * Stores the table's rest position. DrillController calls this on entering
   * BRIEFING, when the Room is at rest. The table and marker shake with the
   * Room; the zone does not, so shaking never flips contains().
   */
  captureRest(): void {
    this.restCenter = this.table.getTransform().getWorldPosition()
    const label = this.findLabel()
    this.restAim = label ? label.getTransform().getWorldPosition() : null
  }

  /** True when the position's XZ is inside the table's rest footprint grown by safeZoneMargin. */
  contains(position: vec3): boolean {
    const c = this.center
    const m = this.config.safeZoneMargin
    return (
      Math.abs(position.x - c.x) <= this.footprintWidth / 2 + m &&
      Math.abs(position.z - c.z) <= this.footprintDepth / 2 + m
    )
  }

  /**
   * Table center at floor level (cm), at rest once captureRest() has run
   * (the live position before that). Shared object: do not modify it.
   */
  get center(): vec3 {
    return this.restCenter ? this.restCenter : this.table.getTransform().getWorldPosition()
  }

  /**
   * Where the off-screen arrow aims (ENGINEERING_PLAN 5a item 6): the marker
   * label's rest position, captured with the rest center; the center if
   * there is no label. Shared object: do not modify it.
   */
  get aimPoint(): vec3 {
    return this.restAim ? this.restAim : this.center
  }

  showMarker(): void {
    this.marker.enabled = true
  }

  hideMarker(): void {
    this.marker.enabled = false
  }

  get markerVisible(): boolean {
    return this.marker.isEnabledInHierarchy
  }

  get isBlinking(): boolean {
    return this._blinking
  }

  /** Blinks the marker outline at markerBlinkHz (QUAKE). */
  startBlink(): void {
    if (this.blinkParts.length === 0) {
      this.collectBlinkParts()
    }
    this.blinkStart = getTime()
    this.setBlinkOn(true)
    this._blinking = true
    this.blinkEvent.enabled = true
  }

  /** Back to a steady marker (POST_QUAKE). */
  stopBlink(): void {
    this.blinkEvent.enabled = false
    this._blinking = false
    this.setBlinkOn(true)
  }

  private onBlinkUpdate(): void {
    // One on/off cycle per 1 / markerBlinkHz seconds: two half-cycles.
    const halfCycle = Math.floor((getTime() - this.blinkStart) * 2 * this.config.markerBlinkHz)
    this.setBlinkOn(halfCycle % 2 === 0)
  }

  private setBlinkOn(on: boolean): void {
    if (on === this.blinkOn) {
      return
    }
    this.blinkOn = on
    for (const part of this.blinkParts) {
      part.enabled = on
    }
  }

  /** The marker child with a HazardLabel (the "safe zone" label), or null. */
  private findLabel(): SceneObject | null {
    const count = this.marker.getChildrenCount()
    for (let i = 0; i < count; i++) {
      const child = this.marker.getChild(i)
      if (child.getComponent(HazardLabel.getTypeName())) {
        return child
      }
    }
    return null
  }

  private collectBlinkParts(): void {
    const count = this.marker.getChildrenCount()
    for (let i = 0; i < count; i++) {
      const child = this.marker.getChild(i)
      if (!child.getComponent(HazardLabel.getTypeName())) {
        this.blinkParts.push(child)
      }
    }
  }
}
