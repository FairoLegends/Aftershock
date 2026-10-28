import {
  RoundedRectangle,
  RoundedRectBlendMode
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

// UI Kit's BackPlate only ships dark styles ("default", "dark", "simple" are all
// grey at 9–27% value), and DESIGN_BRIEF §5.1 asks for a light, semi-transparent
// surface. This puts UI Kit's own RoundedRectangle (the shape BackPlate draws
// with) on the host, as a flat light backing. Size it from the layout, as with
// BackPlate: flex.onLayoutComplete → backing.size.

const CORNER_RADIUS_CM = 1

// ENGINEERING_PLAN 5h item 3: panels and HUD render after the room (furniture,
// hazard and danger labels stay at render order 0, depth-tested). Deeper
// visuals draw later, so a button sits on its backing; text draws after all.
const UI_RENDER_ORDER = 100
const UI_TEXT_RENDER_ORDER = 150

/** Adds a light semi-transparent backing to `host`. Create it before the host's Content child. */
export function createLightBacking(host: SceneObject, color: vec4): RoundedRectangle {
  const rect = host.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  rect.blendMode = RoundedRectBlendMode.Normal // the default (Disabled) is opaque
  rect.gradient = false
  rect.backgroundColor = color
  rect.cornerRadius = CORNER_RADIUS_CM
  return rect
}

/**
 * Makes every Text and mesh visual under `root` ignore depth and draw after
 * the room (5h item 3). UI Kit clones each visual's material, so this never
 * touches the hazard labels. Call on show, not per frame.
 */
export function drawOnTop(root: SceneObject, depth: number = 0): void {
  for (const v of root.getComponents("Component.RenderMeshVisual")) {
    v.renderOrder = UI_RENDER_ORDER + depth
    for (let i = 0; i < v.getMaterialsCount(); i++) {
      v.getMaterial(i).mainPass.depthTest = false
    }
  }
  for (const t of root.getComponents("Component.Text")) {
    t.depthTest = false
    t.renderOrder = UI_TEXT_RENDER_ORDER + depth
  }
  for (let i = 0; i < root.getChildrenCount(); i++) {
    drawOnTop(root.getChild(i), depth + 1)
  }
}

/**
 * 5h item 1: a newly shown panel ignores button presses for its first
 * `seconds` (DrillConfig.pinchGuardSeconds), so the pinch that closed the
 * previous panel cannot press a button on this one.
 */
export class PinchGuard {
  seconds = 0 // set by DrillController from DrillConfig.pinchGuardSeconds
  private shownAt = 0 // getTime() of the last arm(), in seconds

  /** Call when the panel is shown. */
  arm(): void {
    this.shownAt = getTime()
  }

  /** True once the guard time has passed since the panel was shown. */
  get open(): boolean {
    return getTime() - this.shownAt >= this.seconds
  }
}
