// Head (camera) world position and look direction. Positions are cm.
// The test override (TDD §8) is only called by LEAF scenarios; when unused,
// position and forward come straight from the camera transform.

@component
export class HeadPose extends BaseScriptComponent {
  @ui.label("Head pose from the camera")
  @ui.separator
  @input
  @hint("The scene camera (Perspective + DeviceTracking World)")
  cameraObject: SceneObject

  private cameraTransform: Transform | null = null
  private overridePosition: vec3 | null = null
  private overrideForward: vec3 | null = null

  onAwake(): void {
    if (!this.cameraObject) {
      console.error("[Aftershock] HeadPose: cameraObject is not assigned")
      return
    }
    this.cameraTransform = this.cameraObject.getTransform()
  }

  /** Head world position (cm). */
  get position(): vec3 {
    if (this.overridePosition) {
      return this.overridePosition
    }
    return this.cameraTransform ? this.cameraTransform.getWorldPosition() : vec3.zero()
  }

  /** Unit vector the head looks along. The camera looks down its local −Z, which is Transform.back. */
  get forward(): vec3 {
    if (this.overrideForward) {
      return this.overrideForward
    }
    return this.cameraTransform ? this.cameraTransform.back : new vec3(0, 0, -1)
  }

  get hasOverride(): boolean {
    return this.overridePosition !== null
  }

  /** Test hook: pin the head to a position (cm) and look direction. */
  setOverride(position: vec3, forward: vec3): void {
    this.overridePosition = position
    this.overrideForward = forward.normalize()
  }

  /** Test hook: go back to reading the camera. */
  clearOverride(): void {
    this.overridePosition = null
    this.overrideForward = null
  }
}
