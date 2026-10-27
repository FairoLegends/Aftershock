import {DrillConfig} from "./DrillConfig"

/**
 * The safe zone under the table (TDD §3.1). Slice 2: containment test and a
 * steady marker only; the controller does not use it for gameplay yet.
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

  /** True when the position's XZ is inside the table footprint grown by safeZoneMargin. */
  contains(position: vec3): boolean {
    const c = this.table.getTransform().getWorldPosition()
    const m = this.config.safeZoneMargin
    return (
      Math.abs(position.x - c.x) <= this.footprintWidth / 2 + m &&
      Math.abs(position.z - c.z) <= this.footprintDepth / 2 + m
    )
  }

  /** World position of the table center (floor level of the table object). */
  get center(): vec3 {
    return this.table.getTransform().getWorldPosition()
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
}
