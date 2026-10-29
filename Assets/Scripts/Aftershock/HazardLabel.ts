import {lines, onLanguageChanged, setLinePair, StringKey} from "./Strings"
import {createRoundRect, SOFT_INNER_RADIUS_CM, SOFT_LINE, SOFT_RED, SOFT_WHITE, SoftFrame} from "./UiBacking"

// DESIGN_BRIEF §5–6: labels use 2.5 cm type. size / 43.886 = em-square in cm.
const SIZE_PER_CM = 43.886
const LABEL_EM_CM = 2.5
const LINE_H_PER_EM = 1.25 // as ResultPanel

// Label layout (cm). Not drill tunables: they only shape the label.
// Slice 7A-soft (mockup .lbl): a see-through rounded panel, a dot, bold text.
const INNER_W = 34 // widest text; longer lines wrap
const PAD_X = 1.6
const PAD_Y = 1.0
const DOT_CM = 1.1
const DOT_GAP = 1.0 // dot to text
const SLACK = 0.3 // keeps a measured line from wrapping in its final rect
const ABOVE_GAP = 1.0 // gap between the label's backing and an attached line above it (danger label)
const CONTENT_Z = 0.6 // keeps content off the backing (z-fighting)

/**
 * A world-space label on a hazard or on the safe zone (R3, R4), in the
 * selected language only (5j-13d). Its scene rotation makes it face the start
 * spot; DrillController shows it in BRIEFING and hides it in SAFETY.
 * attachAbove() sets another label (the danger label) on top of it.
 */
@component
export class HazardLabel extends BaseScriptComponent {
  @ui.label("World label on a hazard or the safe zone (R3, R4)")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Strings.ts key this label shows")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Cabinet", "label.cabinet"),
      new ComboBoxItem("Shelf", "label.shelf"),
      new ComboBoxItem("Glass", "label.glass"),
      new ComboBoxItem("Safe zone", "label.safe")
    ])
  )
  key: string = "label.cabinet"

  @input
  @hint("Safe zone text and dot color: green #3DDC84. Hazards always use white text and a red #FF5A4F dot (Slice 7A-soft).")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(0.851, 0.282, 0.059, 1)

  @input
  @hint("Backing color: light and semi-transparent (DESIGN_BRIEF §5.1). Never dark: the display is additive.")
  @widget(new ColorWidget())
  backingColor: vec4 = new vec4(1, 1, 1, 0.25)
  @ui.group_end

  private readonly shownTexts: Text[] = []
  private backing: SoftFrame
  private dot: SceneObject
  private primary: Text
  private secondary: Text
  private height = PAD_Y * 2 + LABEL_EM_CM * LINE_H_PER_EM // cm, backing height
  private above: SceneObject | null = null
  private aboveHalfH = 0 // cm

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.backing = new SoftFrame(this.sceneObject, this.backingColor, SOFT_INNER_RADIUS_CM, SOFT_LINE)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    this.dot = global.scene.createSceneObject("Dot")
    this.dot.setParent(content)
    createRoundRect(this.dot, this.isHazard ? SOFT_RED : this.textColor, DOT_CM, DOT_CM, DOT_CM / 2)

    const key = this.key as StringKey
    this.primary = this.addLine(content, key + ".id")
    this.secondary = this.addLine(content, key + ".en")
    this.refresh()
    onLanguageChanged.add(() => this.refresh())
  }

  show(): void {
    this.sceneObject.enabled = true
    this.refresh() // fonts are registered by now, so measure in the real font
  }

  private get isHazard(): boolean {
    return this.key !== "label.safe"
  }

  hide(): void {
    this.sceneObject.enabled = false
  }

  get isShown(): boolean {
    return this.sceneObject.isEnabledInHierarchy
  }

  /** Read-only: the label's text lines, selected language first. */
  get texts(): string[] {
    return this.shownTexts.map((t) => t.text)
  }

  /**
   * Parents `so` to this label, centered just above its backing with the same
   * facing (ENGINEERING_PLAN 5i item 1, replaces 5g's below), so the briefing
   * panel and the HUD never cover it. `halfHeight` is half of `so`'s height
   * (cm). It follows the backing when the label's height changes.
   */
  attachAbove(so: SceneObject, halfHeight: number): void {
    so.setParent(this.sceneObject)
    so.getTransform().setLocalRotation(quat.quatIdentity())
    this.above = so
    this.aboveHalfH = halfHeight
    this.placeAbove()
  }

  private placeAbove(): void {
    if (this.above) {
      const y = this.height / 2 + ABOVE_GAP + this.aboveHalfH
      this.above.getTransform().setLocalPosition(new vec3(0, y, CONTENT_Z))
    }
  }

  /**
   * Re-renders the key in the selected language and shrinks the backing to
   * the dot and the measured text; a long line wraps inside INNER_W.
   * getBoundingBox: one call per refresh (limit 5 per Text per frame).
   */
  private refresh(): void {
    setLinePair(this.primary, this.secondary, lines(this.key as StringKey))
    const t = this.primary
    const lineH = LABEL_EM_CM * LINE_H_PER_EM
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -lineH / 2, lineH / 2)
    let textW = Math.min(INNER_W, t.text.length * LABEL_EM_CM * 0.55) // estimate until the text can be measured
    let lineCount = Math.max(1, Math.ceil((t.text.length * LABEL_EM_CM * 0.55) / INNER_W))
    if (t.text.length > 0 && this.sceneObject.isEnabledInHierarchy) {
      const box = t.getBoundingBox()
      if (box.right > box.left) {
        textW = Math.min(INNER_W, box.right - box.left)
        lineCount = Math.max(1, Math.round((box.top - box.bottom) / lineH))
      }
    }
    const textH = lineCount * lineH
    const contentW = DOT_CM + DOT_GAP + textW
    const left = -contentW / 2
    this.dot.getTransform().setLocalPosition(new vec3(left + DOT_CM / 2, (textH - lineH) / 2, 0))
    const w = lineCount > 1 ? INNER_W : textW + SLACK
    t.getSceneObject().getTransform().setLocalPosition(new vec3(left + DOT_CM + DOT_GAP + w / 2, 0, 0))
    t.layoutRect = Rect.create(-w / 2, w / 2, -textH / 2, textH / 2)
    this.height = textH + PAD_Y * 2
    this.backing.setSize(contentW + PAD_X * 2, this.height)
    this.placeAbove()
  }

  private addLine(parent: SceneObject, name: string): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    t.size = LABEL_EM_CM * SIZE_PER_CM
    ;(t as Text & {weight?: number}).weight = 700
    t.depthTest = true
    t.textFill.color = this.isHazard ? SOFT_WHITE : this.textColor
    t.horizontalAlignment = HorizontalAlignment.Left
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Overflow
    this.shownTexts.push(t)
    return t
  }
}
