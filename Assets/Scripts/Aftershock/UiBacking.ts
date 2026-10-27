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

/** Adds a light semi-transparent backing to `host`. Create it before the host's Content child. */
export function createLightBacking(host: SceneObject, color: vec4): RoundedRectangle {
  const rect = host.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  rect.blendMode = RoundedRectBlendMode.Normal // the default (Disabled) is opaque
  rect.gradient = false
  rect.backgroundColor = color
  rect.cornerRadius = CORNER_RADIUS_CM
  return rect
}
