import {
  GradientStop,
  RoundedRectangle,
  RoundedRectBlendMode
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"

// Slice 7A-soft (ENGINEERING_PLAN 5j item 13, mockup docs/design/Aftershock
// Soft UI.html): rounded corners, a thin light border only on panels, cards
// and secondary buttons, no offset plate, see-through fills. One action color
// (green), red for danger, white for text. Values in cm at 110 cm.
export const SOFT_PANEL_RADIUS_CM = 2.4
export const SOFT_INNER_RADIUS_CM = 1.4 // buttons, rows and labels inside or beside a panel (concentric, smaller)
export const SOFT_BORDER_CM = 0.12
export const SOFT_LINE = new vec4(1, 1, 1, 0.28)
export const SOFT_WHITE = new vec4(1, 1, 1, 1)
export const SOFT_DIM = new vec4(1, 1, 1, 0.72) // secondary text: labels, step numbers
export const SOFT_GREEN = new vec4(0.239, 0.863, 0.518, 1) // #3DDC84
export const SOFT_GREEN_TEXT = new vec4(0.024, 0.129, 0.059, 1) // #06210F, text on the green button
export const SOFT_RED = new vec4(1, 0.353, 0.31, 1) // #FF5A4F
const SOFT_GREEN_FOCUS = new vec4(0.239, 0.863, 0.518, 0.24) // hover/focus fill and glow
const SOFT_GREEN_PRESSED = new vec4(0.2, 0.769, 0.455, 1) // #33C474
const PRESS_SCALE = 0.96
const PRESS_SECONDS = 0.12 // back to full size after release
const GLOW_CM = 0.6 // the primary button's focus glow reaches this far out

// Slice 15B glass (ENGINEERING_PLAN 5m item 15b, mockup docs/design/Aftershock
// Glass UI.html). The display adds light and has no blur, so glass is made of
// light: a fill brighter at the top than at the bottom, and a rim bright at the
// top, faint in the middle and half-bright at the bottom. Every stop stays light
// (brightest channel >= 0.5, DC23/DC24). Materials only: a tier never changes a
// size, a radius or a layout. All gradients run top (percent 0) to bottom (1).

/** One gradient stop of a glass tier; percent 0 is the top edge, 1 the bottom. */
export interface GlassStop {
  readonly color: vec4
  readonly percent: number
}

/** A glass surface: fill gradient, rim gradient (null = no border) and rim width. */
export interface GlassTier {
  /** Flat stand-in written to backgroundColor (what DC23/DC24 and getters read). */
  readonly fill: vec4
  /** 2 to 7 fill stops, top to bottom. */
  readonly bg: readonly GlassStop[]
  /** 2 to 7 rim stops, top to bottom, or null for no border. */
  readonly rim: readonly GlassStop[] | null
  readonly rimCm: number
}

const GLASS_TOP = new vec2(0, 1) // gradient start: the rect's top edge
const GLASS_BOTTOM = new vec2(0, -1) // gradient end: the bottom edge
const TINT_TOP_LIFT = 0.12 // tinted(): the top stop moves this far toward white
const TINT_BOTTOM_RGB = 0.88 // tinted(): the bottom stop's color scale
const TINT_BOTTOM_ALPHA = 0.6 // tinted(): the bottom stop's alpha scale (mockup 0.30 -> 0.18)

/**
 * Tier 0 "inset": number tiles, the compare table, the HUD vitals strip. A flat
 * light fill, no border, and a thin brighter line along the bottom edge (the
 * last 12% of the fill gradient). Use with SOFT_INNER_RADIUS_CM.
 */
export const GLASS_INSET: GlassTier = {
  fill: new vec4(0.8, 0.84, 0.9, 0.26),
  bg: [
    {color: new vec4(0.8, 0.84, 0.9, 0.26), percent: 0},
    {color: new vec4(0.8, 0.84, 0.9, 0.26), percent: 0.88},
    {color: new vec4(0.95, 0.97, 1, 0.42), percent: 1}
  ],
  rim: null,
  rimCm: 0
}

/**
 * Tier 1 "panel": safety, language, level, briefing, calibrate, result, game
 * over, fix instruction, replay caption, HUD. Cool white 30% at the top to 18%
 * at the bottom; rim white 90% -> 22% (55% down) -> 45%. SOFT_PANEL_RADIUS_CM.
 */
export const GLASS_PANEL: GlassTier = {
  fill: new vec4(0.88, 0.92, 0.96, 0.3),
  bg: [
    {color: new vec4(0.88, 0.92, 0.96, 0.3), percent: 0},
    {color: new vec4(0.78, 0.83, 0.9, 0.18), percent: 1}
  ],
  rim: [
    {color: new vec4(1, 1, 1, 0.9), percent: 0},
    {color: new vec4(1, 1, 1, 0.22), percent: 0.55},
    {color: new vec4(1, 1, 1, 0.45), percent: 1}
  ],
  rimCm: SOFT_BORDER_CM
}

/**
 * Tier 2 "raised": secondary buttons, level cards, fix markers, pinch targets,
 * the HUD's active step. One step brighter than the panel: 40% -> 24% fill,
 * rim 100% -> 30% (60% down) -> 55%.
 */
export const GLASS_RAISED: GlassTier = {
  fill: new vec4(0.94, 0.96, 0.99, 0.4),
  bg: [
    {color: new vec4(0.94, 0.96, 0.99, 0.4), percent: 0},
    {color: new vec4(0.84, 0.88, 0.94, 0.24), percent: 1}
  ],
  rim: [
    {color: new vec4(1, 1, 1, 1), percent: 0},
    {color: new vec4(1, 1, 1, 0.3), percent: 0.6},
    {color: new vec4(1, 1, 1, 0.55), percent: 1}
  ],
  rimCm: SOFT_BORDER_CM
}

/** Primary (green) button: SOFT_GREEN lit from the top (#5BE79B -> #33C474), a brighter green top edge. */
export const GLASS_PRIMARY: GlassTier = {
  fill: SOFT_GREEN,
  bg: [
    {color: new vec4(0.357, 0.906, 0.608, 1), percent: 0}, // #5BE79B
    {color: SOFT_GREEN, percent: 0.5},
    {color: new vec4(0.2, 0.769, 0.455, 1), percent: 1} // #33C474
  ],
  rim: [
    {color: new vec4(0.714, 1, 0.839, 1), percent: 0}, // #B6FFD6
    {color: new vec4(0.239, 0.863, 0.518, 0.55), percent: 1}
  ],
  rimCm: SOFT_BORDER_CM
}

/** Green glass (tier 2 brightness): focus/selected, done and fastened marks, safe zone, result cards. */
export const GLASS_GREEN: GlassTier = {
  fill: new vec4(0.239, 0.863, 0.518, 0.3),
  bg: [
    {color: new vec4(0.33, 0.9, 0.6, 0.32), percent: 0},
    {color: new vec4(0.21, 0.76, 0.46, 0.16), percent: 1}
  ],
  rim: [
    {color: new vec4(0.714, 1, 0.839, 1), percent: 0}, // #B6FFD6
    {color: new vec4(0.239, 0.863, 0.518, 0.35), percent: 0.7},
    {color: new vec4(0.239, 0.863, 0.518, 0.6), percent: 1}
  ],
  rimCm: SOFT_BORDER_CM
}

/**
 * Danger glass: hazard labels, the HUD notice, danger pills. The mockup's dark
 * red fill would vanish on the additive display, so the fill is a pale red
 * tint (red text stays readable on it) and the red lives in the rim
 * (#FF8A80 -> SOFT_RED 35% -> 60%).
 */
export const GLASS_RED: GlassTier = {
  fill: new vec4(1, 0.8, 0.78, 0.6),
  bg: [
    {color: new vec4(1, 0.84, 0.82, 0.6), percent: 0},
    {color: new vec4(0.94, 0.7, 0.68, 0.36), percent: 1}
  ],
  rim: [
    {color: new vec4(1, 0.541, 0.502, 1), percent: 0}, // #FF8A80
    {color: new vec4(1, 0.353, 0.31, 0.35), percent: 0.6},
    {color: new vec4(1, 0.353, 0.31, 0.6), percent: 1}
  ],
  rimCm: SOFT_BORDER_CM
}

/** The GEMPA banner: a strong red fill (#FF6E62 86% -> #FF5246 70%), rim #FFD0CB -> SOFT_RED 60%. */
export const GLASS_BANNER: GlassTier = {
  fill: new vec4(1, 0.431, 0.384, 0.86),
  bg: [
    {color: new vec4(1, 0.431, 0.384, 0.86), percent: 0},
    {color: new vec4(1, 0.322, 0.275, 0.7), percent: 1}
  ],
  rim: [
    {color: new vec4(1, 0.816, 0.796, 1), percent: 0}, // #FFD0CB
    {color: new vec4(1, 0.353, 0.31, 0.6), percent: 1}
  ],
  rimCm: SOFT_BORDER_CM
}

/**
 * `tier` with its fill rebuilt from `color` (config-driven fills such as the
 * HUD step colors): backgroundColor is exactly `color`, the gradient runs from
 * `color` lifted toward white at the top to `color` dimmer and thinner at the
 * bottom. The rim stays the tier's.
 */
export function tinted(tier: GlassTier, color: vec4): GlassTier {
  const lift = (v: number) => v + (1 - v) * TINT_TOP_LIFT
  return {
    fill: color,
    bg: [
      {color: new vec4(lift(color.x), lift(color.y), lift(color.z), color.w), percent: 0},
      {
        color: new vec4(
          color.x * TINT_BOTTOM_RGB,
          color.y * TINT_BOTTOM_RGB,
          color.z * TINT_BOTTOM_RGB,
          color.w * TINT_BOTTOM_ALPHA
        ),
        percent: 1
      }
    ],
    rim: tier.rim,
    rimCm: tier.rimCm
  }
}

function toStop(stops: readonly GlassStop[], i: number): GradientStop {
  return i < stops.length ? {color: stops[i].color, percent: stops[i].percent, enabled: true} : {enabled: false}
}

/**
 * Puts `tier` on `rect`. Safe before the shape has initialized (UI Kit shapes
 * initialize on their OnStartEvent): the stop setters only store, configureMesh
 * applies them; once initialized the position setters push the update.
 */
export function applyGlass(rect: RoundedRectangle, tier: GlassTier): void {
  applyGlassFill(rect, tier)
  applyGlassRim(rect, tier)
}

/** Only the fill half of applyGlass (backgroundColor and the fill gradient). */
function applyGlassFill(rect: RoundedRectangle, tier: GlassTier): void {
  rect.backgroundColor = tier.fill
  for (let i = 0; i < 7; i++) {
    rect.setBackgroundGradientStop(i, toStop(tier.bg, i), false)
  }
  rect.gradientType = "Linear"
  rect.gradient = true
  rect.setBackgroundGradientPositions(GLASS_TOP, GLASS_BOTTOM)
}

/** Only the rim half of applyGlass (border on with the rim gradient, or off). */
function applyGlassRim(rect: RoundedRectangle, tier: GlassTier): void {
  if (tier.rim === null) {
    rect.border = false
    return
  }
  for (let i = 0; i < 7; i++) {
    rect.setBorderGradientStop(i, toStop(tier.rim, i), false)
  }
  rect.border = true
  rect.borderSize = tier.rimCm
  rect.borderColor = tier.rim[0].color
  rect.borderGradientType = "Linear"
  rect.borderType = "Gradient"
  rect.setBorderGradientPositions(GLASS_TOP, GLASS_BOTTOM)
}

/** Tier 0 on `rect` (inset: tiles, tables, vitals). */
export function insetGlass(rect: RoundedRectangle): void {
  applyGlass(rect, GLASS_INSET)
}

/** Tier 1 on `rect` (panel). */
export function panelGlass(rect: RoundedRectangle): void {
  applyGlass(rect, GLASS_PANEL)
}

/** Tier 2 on `rect` (raised: buttons, cards, markers, pinch targets). */
export function raisedGlass(rect: RoundedRectangle): void {
  applyGlass(rect, GLASS_RAISED)
}

/** A flat rounded rect on `host` (no gradient). The radius never exceeds half the shorter side. */
export function createRoundRect(host: SceneObject, color: vec4, w: number, h: number, radiusCm: number): RoundedRectangle {
  const rect = host.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  rect.blendMode = RoundedRectBlendMode.Normal // the default (Disabled) is opaque
  rect.gradient = false
  rect.cornerRadius = Math.min(radiusCm, w / 2, h / 2)
  rect.backgroundColor = color
  rect.size = new vec2(w, h)
  return rect
}

/**
 * Rounded backing with an optional thin border. The face (holding the
 * backing) can carry children such as a button label, so they scale with it
 * on press. Pass a GlassTier as `fill` for a glass surface; its rim then
 * replaces `border`. On a glass frame setFill keeps the glass (the fill
 * gradient is rebuilt from the color, see tinted()) and setBorder sets a
 * one-off flat border; setTier switches the whole look.
 */
export class SoftFrame {
  readonly face: SceneObject
  readonly backing: RoundedRectangle
  private readonly faceT: Transform
  private readonly radius: number
  private tier: GlassTier | null = null
  private w = 1
  private h = 1

  constructor(
    parent: SceneObject,
    fill: vec4 | GlassTier,
    radiusCm: number = SOFT_PANEL_RADIUS_CM,
    border: vec4 | null = SOFT_LINE,
    name: string = "Face"
  ) {
    this.radius = radiusCm
    this.face = global.scene.createSceneObject(name)
    this.face.setParent(parent)
    this.faceT = this.face.getTransform()
    const tier = isGlassTier(fill) ? fill : null
    this.backing = createRoundRect(this.face, tier ? tier.fill : (fill as vec4), 1, 1, radiusCm)
    this.backing.borderSoftness = 0
    if (tier) {
      this.setTier(tier)
    } else {
      this.setBorder(border)
    }
  }

  /** Face size in cm. */
  setSize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.backing.size = new vec2(w, h)
    this.backing.cornerRadius = Math.min(this.radius, w / 2, h / 2)
  }

  get width(): number {
    return this.w
  }
  get height(): number {
    return this.h
  }

  /** Glass look (fill and rim gradients), or null for a flat frame with no border. */
  setTier(tier: GlassTier | null): void {
    this.tier = tier
    if (tier) {
      applyGlass(this.backing, tier)
    } else {
      this.backing.gradient = false
      this.backing.border = false
    }
  }

  /** A flat color; on a glass frame the glass is kept and its fill rebuilt from `color` (rim untouched). */
  setFill(color: vec4): void {
    if (this.tier) {
      applyGlassFill(this.backing, tinted(this.tier, color))
      return
    }
    this.backing.backgroundColor = color
  }

  /** The glass tier's own colors at `alpha` (config-driven alpha, e.g. labelBackingAlpha). */
  setTierAlpha(alpha: number): void {
    if (this.tier) {
      const f = this.tier.fill
      this.setFill(new vec4(f.x, f.y, f.z, alpha))
    }
  }

  /** Border color, or null for none (a one-off flat border, also on a glass frame). */
  setBorder(color: vec4 | null, cm: number = SOFT_BORDER_CM): void {
    this.backing.border = color !== null
    if (color !== null) {
      this.backing.borderType = "Color"
      this.backing.borderColor = color
      this.backing.borderSize = cm
    }
  }

  /** Back to the glass tier's own rim (after a one-off setBorder). */
  resetBorder(): void {
    if (this.tier) applyGlassRim(this.backing, this.tier)
  }

  /** Whole frame opacity (done steps use 0.45). */
  setOpacity(alpha: number): void {
    this.backing.opacity = alpha
  }

  /** Face scale (press feedback); the label under the face scales with it. */
  setScale(s: number): void {
    this.faceT.setLocalScale(new vec3(s, s, 1))
  }
}

function isGlassTier(v: vec4 | GlassTier): v is GlassTier {
  return (v as GlassTier).bg !== undefined
}

/**
 * Hides the UI Kit Button's own rounded visual (its RenderMeshVisual on the
 * button object). Shape re-enables that RMV on every OnEnable, so the color
 * mask is closed instead: it draws nothing whatever its enabled state.
 */
export function hideKitVisual(buttonObject: SceneObject): void {
  const rmv = buttonObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (rmv && rmv.mainMaterial) {
    rmv.mainMaterial.mainPass.colorMask = new vec4b(false, false, false, false)
  }
}

/**
 * Slice 7A-soft button on the UI Kit Button. Primary (Continue, Restart):
 * green glass (GLASS_PRIMARY), dark label, a green glow on hover/focus.
 * Secondary (language buttons): tier 2 glass (GLASS_RAISED), green glass on
 * hover/focus (Slice 15B). Pinch: the face scales to 0.96 and eases back in 0.12 s after
 * release. `action` runs on release (callers keep their pinch guard inside
 * it). Labels go under `face` so they scale with the press.
 */
export class SoftButton {
  readonly frame: SoftFrame
  private readonly glow: SoftFrame | null = null
  private readonly buttonObject: SceneObject
  private readonly primary: boolean
  private readonly anim: SceneEvent
  private releasedAt = -1 // getTime() of the last release, -1 when not easing back
  private selected = false
  private pressed = false // Slice 13C: a pinch is down on it (UI Kit trigger down, not yet up or cancelled)

  constructor(owner: BaseScriptComponent, btn: Button, w: number, h: number, primary: boolean, action: () => void) {
    this.buttonObject = btn.getSceneObject()
    this.primary = primary
    if (primary) {
      this.glow = new SoftFrame(this.buttonObject, SOFT_GREEN_FOCUS, SOFT_INNER_RADIUS_CM + GLOW_CM, null, "Glow")
      this.glow.setSize(w + GLOW_CM * 2, h + GLOW_CM * 2)
      this.glow.face.enabled = false
    }
    this.frame = new SoftFrame(this.buttonObject, this.restTier, SOFT_INNER_RADIUS_CM, null)
    this.frame.setSize(w, h)
    btn.onInitialized.add(() => {
      hideKitVisual(this.buttonObject)
      if (btn.interactable) btn.interactable.onTriggerCanceled.add(() => (this.pressed = false))
    })
    btn.onHoverEnter.add(() => this.setFocus(true))
    btn.onHoverExit.add(() => this.setFocus(false))
    btn.onTriggerDown.add(() => {
      this.pressed = true
      this.press()
    })
    btn.onTriggerUp.add(() => {
      this.pressed = false
      this.release()
      action()
    })
    this.anim = owner.createEvent("UpdateEvent")
    this.anim.bind(() => this.tick())
    this.anim.enabled = false
  }

  get face(): SceneObject {
    return this.frame.face
  }

  /** Slice 13C: a pinch is held on this button (a following panel must not move under it). */
  get isPressed(): boolean {
    return this.pressed
  }

  /** Back to rest (no focus, full size) and the kit visual hidden; panels call it on show(). */
  reset(): void {
    this.pressed = false
    this.setFocus(false)
    this.releasedAt = -1
    this.anim.enabled = false
    this.frame.setScale(1)
    hideKitVisual(this.buttonObject)
  }

  /** Keeps the hover/focus look on while `on` (Slice 7C: the level picker's current level). */
  setSelected(on: boolean): void {
    this.selected = on
    this.setFocus(false)
  }

  /** Slice 15B: primary = green glass (GLASS_PRIMARY), secondary = tier 2 (GLASS_RAISED). */
  private get restTier(): GlassTier {
    return this.primary ? GLASS_PRIMARY : GLASS_RAISED
  }

  private setFocus(hover: boolean): void {
    const on = hover || this.selected
    if (this.glow) {
      this.glow.face.enabled = on
    } else {
      this.frame.setTier(on ? GLASS_GREEN : this.restTier)
    }
  }

  private press(): void {
    this.releasedAt = -1
    this.anim.enabled = false
    this.frame.setScale(PRESS_SCALE)
    if (this.primary) this.frame.setFill(SOFT_GREEN_PRESSED)
  }

  private release(): void {
    if (this.primary) this.frame.setTier(GLASS_PRIMARY)
    this.releasedAt = getTime()
    this.anim.enabled = true
  }

  /** Eases the face back from PRESS_SCALE to 1; runs only while easing. */
  private tick(): void {
    const t = this.releasedAt < 0 ? 1 : (getTime() - this.releasedAt) / PRESS_SECONDS
    if (t >= 1) {
      this.frame.setScale(1)
      this.anim.enabled = false
      return
    }
    const eased = 1 - (1 - t) * (1 - t)
    this.frame.setScale(PRESS_SCALE + (1 - PRESS_SCALE) * eased)
  }
}

// 5j-13b tabular numbers: the Text API has no font-feature (tnum) setting and
// the Manrope subset's digits are proportional ("1" 0.42 em, "0" 0.64 em), so
// each character gets its own Text centered in a fixed slot.
const DIGIT_SLOT_EM = 0.66 // widest Manrope digit ("0", 0.642 em) plus a little
const NARROW_SLOT_EM = 0.36 // ":" and "." (0.328 em)

/**
 * Fixed-width digits for the timer and the score. `source` keeps the whole
 * string (getters, LEAF) but draws nothing; the cells, children of its object,
 * copy its size, weight, color and outline. `pattern` gives one slot per
 * character ("00:00", "000"); `anchor` -1 / 0 / 1 puts the slots' left edge,
 * center or right edge at the source object's origin. A right-anchored value
 * shorter than the pattern fills the rightmost slots.
 */
export class TabularText {
  readonly source: Text
  private readonly cells: Text[] = []
  private readonly anchor: number

  constructor(source: Text, pattern: string, emCm: number, anchor: -1 | 0 | 1) {
    this.source = source
    this.anchor = anchor
    const widths = pattern.split("").map((c) => (/[0-9]/.test(c) ? DIGIT_SLOT_EM : NARROW_SLOT_EM) * emCm)
    const total = widths.reduce((a, b) => a + b, 0)
    let x = anchor < 0 ? 0 : anchor > 0 ? -total : -total / 2
    const parent = source.getSceneObject()
    for (let i = 0; i < widths.length; i++) {
      const so = global.scene.createSceneObject(parent.name + "." + i)
      so.setParent(parent)
      so.getTransform().setLocalPosition(new vec3(x + widths[i] / 2, 0, 0))
      const t = so.createComponent("Component.Text") as Text
      t.size = source.size
      ;(t as Text & {weight?: number}).weight = (source as Text & {weight?: number}).weight
      t.depthTest = source.depthTest
      t.textFill.color = source.textFill.color
      t.outlineSettings.enabled = source.outlineSettings.enabled
      t.outlineSettings.size = source.outlineSettings.size
      t.outlineSettings.fill.color = source.outlineSettings.fill.color
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-widths[i] / 2, widths[i] / 2, -emCm * 0.7, emCm * 0.7)
      t.text = ""
      this.cells.push(t)
      x += widths[i]
    }
    source.enabled = false // its string stays readable; only the cells draw
    this.set(source.text)
  }

  set(value: string): void {
    this.source.text = value
    const n = this.cells.length
    const offset = this.anchor > 0 ? n - value.length : 0
    for (let i = 0; i < n; i++) {
      const k = i - offset
      this.cells[i].text = k >= 0 && k < value.length ? value.charAt(k) : ""
    }
  }

  setFont(font: Font | null): void {
    if (!font) {
      return
    }
    for (const t of this.cells) {
      if (t.font !== font) t.font = font
    }
  }
}

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
function ignoreDepth(v: RenderMeshVisual, order: number): void {
  v.renderOrder = order
  for (let i = 0; i < v.getMaterialsCount(); i++) {
    v.getMaterial(i).mainPass.depthTest = false
  }
}

export function drawOnTop(root: SceneObject, depth: number = 0): void {
  const order = UI_RENDER_ORDER + depth
  // A UI Kit shape (RoundedRectangle) makes its RenderMeshVisual on its own
  // OnStartEvent, a frame after its object is first enabled, at the shape's
  // renderOrder (0) with depth test on, so a walk at show() finds no visual.
  // The shape keeps the order it is given; its visual is tagged once made.
  for (const s of root.getComponents(RoundedRectangle.getTypeName()) as unknown as RoundedRectangle[]) {
    s.renderOrder = order
    if (!s.initialized) {
      s.onInitialized.add(() => ignoreDepth(s.renderMeshVisual, order))
    }
  }
  for (const v of root.getComponents("Component.RenderMeshVisual")) {
    ignoreDepth(v, order)
  }
  for (const t of root.getComponents("Component.Text")) {
    t.depthTest = false
    t.renderOrder = UI_TEXT_RENDER_ORDER + depth
  }
  for (let i = 0; i < root.getChildrenCount(); i++) {
    drawOnTop(root.getChild(i), depth + 1)
  }
}

// A shape whose object was still disabled at show() can initialize later than
// the onInitialized hook above covers (the UI Kit re-runs parts of its setup on
// enable), so the walk is repeated once shortly after. One reusable delayed
// event per root, so repeated shows (the HUD warning banner) add no events.
const RETAG_SECONDS = 0.1
const retagEvents = new Map<SceneObject, DelayedCallbackEvent>()

/** drawOnTop now, and once more after RETAG_SECONDS so late visuals are caught (5h item 3). */
export function drawOnTopWhenReady(owner: BaseScriptComponent, root: SceneObject): void {
  drawOnTop(root)
  let later = retagEvents.get(root)
  if (!later) {
    later = owner.createEvent("DelayedCallbackEvent")
    later.bind(() => drawOnTop(root))
    retagEvents.set(root, later)
  }
  later.reset(RETAG_SECONDS)
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
