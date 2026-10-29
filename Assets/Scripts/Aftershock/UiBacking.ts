import {
  RoundedRectangle,
  RoundedRectBlendMode
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"

// Slice 7A "Brutal AR" (ENGINEERING_PLAN 5j, mockup docs/design): square
// corners, a light 0.4 cm border and a hard offset plate 1 cm right and 1 cm
// down at 90%. The display is additive, so border and plate are white (yellow
// for focus). Only the L-shaped part of the plate outside the face is drawn:
// a full plate behind a translucent backing would show through it.
export const BRUTAL_BORDER_CM = 0.4
export const BRUTAL_PLATE_CM = 1
export const BRUTAL_PLATE_ALPHA = 0.9
export const BRUTAL_WHITE = new vec4(1, 1, 1, 1)
export const BRUTAL_YELLOW = new vec4(1, 1, 0, 1)
export const BRUTAL_RED = new vec4(1, 0, 0, 1)
const PLATE_Z = -0.05

/** A square, flat rect on `host` (no gradient, no rounding): bar cells, rules, strike lines. */
export function createSquareRect(host: SceneObject, color: vec4, w: number, h: number): RoundedRectangle {
  const rect = host.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  rect.blendMode = RoundedRectBlendMode.Normal
  rect.gradient = false
  rect.cornerRadius = 0
  rect.backgroundColor = color
  rect.size = new vec2(w, h)
  return rect
}

/**
 * Backing + border + hard plate. The face ("Face", holding the backing) can
 * carry children such as a button label, so they move with it on press.
 */
export class BrutalFrame {
  readonly face: SceneObject
  readonly backing: RoundedRectangle
  private readonly plateRight: RoundedRectangle
  private readonly plateBottom: RoundedRectangle
  private readonly plateRightT: Transform
  private readonly plateBottomT: Transform
  private readonly faceT: Transform
  private readonly offset: number
  private w = 1
  private h = 1
  private pressed = false

  constructor(
    parent: SceneObject,
    fill: vec4,
    accent: vec4 = BRUTAL_WHITE,
    borderCm: number = BRUTAL_BORDER_CM,
    offsetCm: number = BRUTAL_PLATE_CM
  ) {
    this.offset = offsetCm
    const pr = global.scene.createSceneObject("PlateR")
    pr.setParent(parent)
    const pb = global.scene.createSceneObject("PlateB")
    pb.setParent(parent)
    this.plateRight = createSquareRect(pr, BRUTAL_WHITE, 1, 1)
    this.plateBottom = createSquareRect(pb, BRUTAL_WHITE, 1, 1)
    this.plateRightT = pr.getTransform()
    this.plateBottomT = pb.getTransform()

    this.face = global.scene.createSceneObject("Face")
    this.face.setParent(parent)
    this.faceT = this.face.getTransform()
    this.backing = createSquareRect(this.face, fill, 1, 1)
    this.backing.border = borderCm > 0
    this.backing.borderSize = borderCm
    this.backing.borderSoftness = 0
    this.setAccent(accent)
  }

  /** Face size in cm; the plate follows. */
  setSize(w: number, h: number): void {
    this.w = w
    this.h = h
    const o = this.offset
    this.backing.size = new vec2(w, h)
    this.plateRight.size = new vec2(o, h)
    this.plateBottom.size = new vec2(Math.max(0.01, w - o), o)
    this.plateRightT.setLocalPosition(new vec3(w / 2 + o / 2, -o / 2, PLATE_Z))
    this.plateBottomT.setLocalPosition(new vec3(o / 2, -h / 2 - o / 2, PLATE_Z))
  }

  get width(): number {
    return this.w
  }
  get height(): number {
    return this.h
  }

  /** Border and plate color (white by default, yellow for focus). */
  setAccent(color: vec4): void {
    this.backing.borderColor = color
    const plate = new vec4(color.x, color.y, color.z, color.w * BRUTAL_PLATE_ALPHA)
    this.plateRight.backgroundColor = plate
    this.plateBottom.backgroundColor = plate
  }

  setFill(color: vec4): void {
    this.backing.backgroundColor = color
  }

  /** Pressed: the face moves into the plate (offset right and down) and the plate collapses. */
  setPressed(pressed: boolean): void {
    if (pressed === this.pressed) {
      return
    }
    this.pressed = pressed
    const o = pressed ? this.offset : 0
    this.faceT.setLocalPosition(new vec3(o, -o, 0))
    this.plateRight.sceneObject.enabled = !pressed
    this.plateBottom.sceneObject.enabled = !pressed
  }

  /** Whole frame opacity (done steps use 0.4). */
  setOpacity(alpha: number): void {
    this.backing.opacity = alpha
    this.plateRight.opacity = alpha
    this.plateBottom.opacity = alpha
  }

  /** Border width in cm (upcoming steps use a thin one). */
  setBorderSize(cm: number): void {
    this.backing.border = cm > 0
    this.backing.borderSize = cm
  }

  /** Shows or hides the hard plate (not while pressed). */
  setPlateVisible(visible: boolean): void {
    this.plateRight.sceneObject.enabled = visible && !this.pressed
    this.plateBottom.sceneObject.enabled = visible && !this.pressed
  }
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
 * Slice 7A button: a BrutalFrame on the UI Kit Button. Hover/focus turns
 * border and plate yellow; while pinched the face sits in the plate. `action`
 * runs on release (callers keep their pinch guard inside it). The label goes
 * under `frame.face` so it moves with the press.
 */
export function makeBrutalButton(btn: Button, w: number, h: number, fill: vec4, action: () => void): BrutalFrame {
  const so = btn.getSceneObject()
  const frame = new BrutalFrame(so, fill)
  frame.setSize(w, h)
  btn.onInitialized.add(() => hideKitVisual(so))
  btn.onHoverEnter.add(() => frame.setAccent(BRUTAL_YELLOW))
  btn.onHoverExit.add(() => {
    frame.setAccent(BRUTAL_WHITE)
    frame.setPressed(false)
  })
  btn.onTriggerDown.add(() => frame.setPressed(true))
  btn.onTriggerUp.add(() => {
    frame.setPressed(false)
    action()
  })
  return frame
}

/** Back to rest (white, not pressed) and the kit visual hidden; panels call it on show(). */
export function resetBrutalButton(btn: Button, frame: BrutalFrame): void {
  frame.setAccent(BRUTAL_WHITE)
  frame.setPressed(false)
  hideKitVisual(btn.getSceneObject())
}

/** Text styled for Slice 7A: white, thin dark outline, centered, never clipped. */
export function styleBrutalText(t: Text, emCm: number, outline: vec4, outlineSize: number): void {
  t.size = emCm * 43.886
  ;(t as Text & {weight?: number}).weight = 700
  t.depthTest = true
  t.textFill.color = BRUTAL_WHITE
  t.outlineSettings.enabled = outlineSize > 0
  t.outlineSettings.size = outlineSize
  t.outlineSettings.fill.color = outline
  t.horizontalAlignment = HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
}

// Marquee words: no ink beyond the strip ends (Text has no clip mask, so a
// word is hidden as soon as any part of it would cross an end; 5j-12 defect 5).
const MARQUEE_INSET_CM = 0.4 // words stay this far inside each strip end
const MARQUEE_LETTER_SPACING = 0.2
const MARQUEE_EST_EM_PER_CHAR = 0.75 // width guess when a word cannot be measured yet

/**
 * Marquee strip: text scrolling left between a top and a bottom border line
 * (5j-1). Each word is its own Text, repeated `gapCm` apart, so the strip
 * stays full even when one copy is wider than the strip.
 */
export class Marquee {
  readonly root: SceneObject
  private readonly texts: Text[] = []
  private readonly transforms: Transform[] = []
  private readonly centers: number[] = [] // word center within one copy (cm, from its left)
  private readonly halves: number[] = [] // word half-width (cm)
  private readonly tmp = new vec3(0, 0, 0)
  private readonly speed: number
  private readonly gap: number
  private readonly width: number
  private readonly height: number
  private readonly emCm: number
  private readonly color: vec4
  private readonly name: string
  private words: string[] = []
  private period = 1 // one copy plus the gap (cm)
  private copies = 0
  private measured = false
  private x = 0

  constructor(
    parent: SceneObject,
    name: string,
    width: number,
    height: number,
    emCm: number,
    color: vec4,
    speedCmPerS: number,
    gapCm: number
  ) {
    this.name = name
    this.width = width
    this.height = height
    this.emCm = emCm
    this.color = color
    this.speed = speedCmPerS
    this.gap = gapCm
    this.root = global.scene.createSceneObject(name)
    this.root.setParent(parent)
    const line = 0.3
    for (const y of [height / 2 - line / 2, -height / 2 + line / 2]) {
      const b = global.scene.createSceneObject(name + ".border")
      b.setParent(this.root)
      b.getTransform().setLocalPosition(new vec3(0, y, 0))
      createSquareRect(b, color, width, line)
    }
  }

  /**
   * Sets the strip text and its font. `wideFont` is used for words with
   * CJK characters (the Latin font has no such glyphs).
   */
  setText(text: string, font: Font | null, wideFont: Font | null = null): void {
    this.words = text.split(" ").filter((w) => w.length > 0)
    // Enough copies to cover the strip plus one period of scroll; one word at least emCm wide.
    const guess = Math.max(this.emCm, this.estimate(text)) + this.gap
    this.copies = Math.ceil(this.width / guess) + 2
    const need = this.words.length * this.copies
    while (this.texts.length < need) {
      this.addText()
    }
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i]
      if (i >= need) {
        t.enabled = false
        t.text = ""
        continue
      }
      const word = this.words[i % this.words.length]
      const f = /[　-鿿＀-￯]/.test(word) && wideFont ? wideFont : font
      if (f && t.font !== f) {
        t.font = f
      }
      t.text = word
    }
    this.measured = false
    this.measure()
    this.place()
  }

  get textComponents(): Text[] {
    return this.texts
  }

  /** Advances the scroll; call from an UpdateEvent while shown. No allocation once measured. */
  tick(dt: number): void {
    if (!this.measured) {
      this.measure()
    }
    this.x -= this.speed * dt
    if (this.x <= -this.period) {
      this.x += this.period
    }
    this.place()
  }

  private addText(): void {
    const so = global.scene.createSceneObject(this.name + ".text")
    so.setParent(this.root)
    const t = so.createComponent("Component.Text") as Text
    styleBrutalText(t, this.emCm, new vec4(0, 0, 0, 0), 0)
    t.textFill.color = this.color
    t.letterSpacing = MARQUEE_LETTER_SPACING
    t.layoutRect = Rect.create(-1, 1, -this.height / 2, this.height / 2)
    this.texts.push(t)
    this.transforms.push(so.getTransform())
  }

  /** Word widths from the first copy's Texts; estimated until the text can be measured. */
  private measure(): void {
    const space = this.emCm * 0.3
    let ok = true
    let cursor = 0
    this.centers.length = 0
    this.halves.length = 0
    for (let j = 0; j < this.words.length; j++) {
      let w = 0
      const box = this.texts[j].getBoundingBox()
      if (box && box.right - box.left > 0.01) {
        w = box.right - box.left
      } else {
        w = this.estimate(this.words[j])
        ok = false
      }
      this.centers.push(cursor + w / 2)
      this.halves.push(w / 2)
      cursor += w + space
    }
    this.period = Math.max(1, cursor - space + this.gap)
    this.measured = ok
  }

  private estimate(text: string): number {
    return text.length * this.emCm * MARQUEE_EST_EM_PER_CHAR
  }

  private place(): void {
    const n = this.words.length
    if (n === 0) {
      return
    }
    const left = -this.width / 2 - this.period
    const limit = this.width / 2 - MARQUEE_INSET_CM
    for (let c = 0; c < this.copies; c++) {
      for (let j = 0; j < n; j++) {
        const i = c * n + j
        this.tmp.x = left + this.x + c * this.period + this.centers[j]
        this.tmp.y = 0
        this.tmp.z = 0.05
        this.transforms[i].setLocalPosition(this.tmp)
        const visible = Math.abs(this.tmp.x) + this.halves[j] <= limit
        if (this.texts[i].enabled !== visible) {
          this.texts[i].enabled = visible
        }
      }
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
