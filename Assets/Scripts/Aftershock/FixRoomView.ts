// Slice 14B (ENGINEERING_PLAN 5m item 15, decisions 1a 2a 3a 4a): fix the room.
// From RESULT or GAME_OVER, "Perbaiki kamar" hides the result panel and shows
// the room with a big pinch marker in front of each item that made a problem
// ("Rak: Ikat ke dinding", at least 12 cm: habit 3). A pinch fastens the item
// (its marker turns green, its label shows "Sudah diikat"); a second pinch
// undoes it. One small light panel follows the head like the replay caption:
// the instruction, Kembali (back to the result, the picks kept) and, once an
// item is picked, Ulangi gempa (the same quake with those items fastened).
// Slice 18 (ENGINEERING_PLAN 19b): while the head looks at a marker the panel
// shrinks to a pill at its spot (Ulangi gempa once an item is picked, else the
// instruction) and grows back fixPillHoldSeconds after the gaze leaves them all.
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {DrillConfig} from "./DrillConfig"
import {HeadPose} from "./HeadPose"
import {anchorInFront, faceHead, PanelFollow} from "./PanelFollow"
import {PlaneBox} from "./ResultPanel"
import {getLanguage, getString, lines, onLanguageChanged, setLineText, StringKey} from "./Strings"
import {drawOnTopWhenReady, GLASS_PANEL, PinchGuard, SOFT_GREEN_TEXT, SoftButton, SoftFrame, tinted} from "./UiBacking"

const SIZE_PER_CM = 43.886 // Text.size / 43.886 = em-square in cm, as in Hud.ts
const LINE_H_PER_EM = 1.25 // as ResultPanel
const PARKED = new vec3(0, -100000, 0)
const PARK_SECONDS = 0.5 // markers and panel hide once their buttons have started
const PAD = 3
const GAP = 2
const INSTR_TEXT_EM = 22 // instruction line box width, in its em
const BUTTON_ASPECT = 3.4 // Kembali and Ulangi gempa width / height
const BUTTON_LABEL_PER_H = 0.36 // their label em / button height
const BUTTON_GAP = 2 // between Kembali and Ulangi gempa
const CONTENT_Z = 0.6
const BUTTON_LABEL_Z = 0.08
const PANEL_FILL = new vec4(1, 1, 1, 0.25) // as the replay caption: light, never dark
const PILL_PAD = 1.5 // Slice 18 (plan 19): inside the pill, around its line or its button
const DEG_TO_RAD = Math.PI / 180

/** The items fix mode can fasten, with their marker button names (LEAF presses them). */
export const FIX_ITEMS: {item: string; button: string}[] = [
  {item: "shelf", button: "FixShelfButton"},
  {item: "cabinet", button: "FixCabinetButton"},
  {item: "tv", button: "FixTvButton"}
]

interface Marker {
  item: string
  root: SceneObject
  soft: SoftButton
  text: Text
  shown: boolean
  selected: boolean
}

export class FixRoomView {
  private readonly markers: Marker[] = []
  private readonly panel: SceneObject
  private readonly panelFrame: SoftFrame
  private readonly instr: Text
  private readonly backObject: SceneObject
  private readonly backButton: SoftButton
  private readonly repeatObject: SceneObject
  private readonly repeatButton: SoftButton
  private readonly follow = new PanelFollow()
  private readonly guard = new PinchGuard()
  private readonly update: SceneEvent
  private readonly panelW: number
  private _open = false
  private repeat = false // an item is picked: Ulangi gempa shown
  private pill = false // Slice 18 (plan 19b): the panel is a pill now
  private offSeconds = 0 // Slice 18: how long the gaze has been off every marker
  private pending = false // Slice 18: a layout waits until no pinch is held on Kembali or Ulangi gempa
  /** Set by DrillController: a marker pinched, Kembali, Ulangi gempa. */
  onToggle: (item: string) => void = () => {}
  onBack: () => void = () => {}
  onRepeat: () => void = () => {}

  constructor(
    private readonly owner: BaseScriptComponent,
    private readonly config: DrillConfig,
    private readonly headPose: HeadPose,
    private readonly spot: (item: string, markerH: number) => vec3 | null
  ) {
    const mh = config.fixMarkerCm
    const mw = mh * config.fixMarkerAspect
    for (const f of FIX_ITEMS) {
      const root = global.scene.createSceneObject("FixMarker." + f.item)
      root.createComponent("Component.Canvas")
      root.getTransform().setWorldPosition(PARKED)
      const so = global.scene.createSceneObject(f.button)
      so.setParent(root)
      const btn = so.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(mw, mh, 1)
      const item = f.item
      const soft = new SoftButton(owner, btn, mw, mh, false, () => {
        if (this._open && this.guard.open) this.onToggle(item)
      })
      const label = global.scene.createSceneObject("FixMarkerLabel")
      label.setParent(soft.face)
      label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
      const text = addText(label, "fix.action", config.fixMarkerEmCm, mw - 2)
      this.markers.push({item, root, soft, text, shown: false, selected: false})
    }

    this.panel = global.scene.createSceneObject("FixPanel")
    this.panel.createComponent("Component.Canvas")
    this.panel.getTransform().setWorldPosition(PARKED)
    this.panelFrame = new SoftFrame(this.panel, tinted(GLASS_PANEL, PANEL_FILL)) // glass tier 1 (15B)
    const content = global.scene.createSceneObject("Content")
    content.setParent(this.panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const bh = config.fixPanelButtonCm
    const bw = bh * BUTTON_ASPECT
    this.panelW = PAD * 2 + Math.max(config.fixInstrEmCm * INSTR_TEXT_EM, bw * 2 + BUTTON_GAP)
    this.instr = addText(content, "FixInstrText", config.fixInstrEmCm, this.panelW - PAD * 2)
    const back = this.addButton(content, "FixBackButton", "btn.back", bw, bh, false, () => this.onBack())
    this.backObject = back.so
    this.backButton = back.soft
    const repeat = this.addButton(content, "RepeatQuakeButton", "btn.repeatQuake", bw, bh, true, () => this.onRepeat())
    this.repeatObject = repeat.so
    this.repeatButton = repeat.soft
    const refresh = (): void => {
      setLineText(this.instr, getString("fix.instr"), getLanguage())
      setLineText(back.text, getString("btn.back"), getLanguage())
      setLineText(repeat.text, getString("btn.repeatQuake"), getLanguage())
      for (const m of this.markers) setLineText(m.text, markerText(m.item), getLanguage())
      if (this._open) this.layoutPanel(this.repeat) // Slice 18: a pill fits its new line
    }
    refresh()
    onLanguageChanged.add(refresh)
    this.layoutPanel(true)

    this.update = owner.createEvent("UpdateEvent")
    this.update.bind(() => this.onUpdate())
    this.update.enabled = false
    const park = owner.createEvent("DelayedCallbackEvent")
    park.bind(() => {
      if (!this._open) this.hideAll()
    })
    park.reset(PARK_SECONDS)
  }

  // Read-only getters for LEAF assertions (TDD §8).
  get isOpen(): boolean {
    return this._open
  }
  /** The items whose marker is shown, in FIX_ITEMS order. */
  get markersShown(): string[] {
    return this.markers.filter((m) => m.shown && m.root.isEnabledInHierarchy).map((m) => m.item)
  }
  /** The marker is green: its item is picked to fasten. */
  markerSelected(item: string): boolean {
    const m = this.find(item)
    return m !== null && m.selected
  }
  /** The marker's text, e.g. "Rak: Ikat ke dinding" ("" when hidden). */
  markerText(item: string): string {
    const m = this.find(item)
    return m && m.shown ? m.text.text : ""
  }
  /** The marker's world center (null when hidden). */
  markerPosition(item: string): vec3 | null {
    const m = this.find(item)
    return m && m.shown ? m.root.getTransform().getWorldPosition() : null
  }
  /** The marker's height in view right now (cm): fixMarkerCm, grown past fixMarkerRefCm. */
  markerHeightCm(item: string): number {
    const m = this.find(item)
    return m && m.shown ? this.config.fixMarkerCm * m.root.getTransform().getLocalScale().y : 0
  }
  get panelShown(): boolean {
    return this.panel.isEnabledInHierarchy
  }
  get repeatShown(): boolean {
    return this.repeatObject.isEnabledInHierarchy
  }
  get backShown(): boolean {
    return this.backObject.isEnabledInHierarchy
  }
  get instrText(): string {
    return this.instr.getSceneObject().isEnabledInHierarchy ? this.instr.text : "" // Slice 18: "" in the Ulangi gempa pill
  }
  get panelPosition(): vec3 {
    return this.panel.getTransform().getWorldPosition()
  }
  /** Slice 18 (plan 19b): the panel is a pill (the head looks at a marker, or did within fixPillHoldSeconds). */
  get pillShown(): boolean {
    return this.pill && this.panelShown
  }
  /** Slice 18: the panel's backing in the head's view plane (see viewBox). */
  get panelBox(): PlaneBox {
    const w = this.panelFrame.width / 2
    const h = this.panelFrame.height / 2
    return this.viewBox("FixPanel", this.panelFrame.face, -w, w, -h, h)
  }
  /** Slice 18: each shown marker's button in the head's view plane (named by its item). */
  get markerBoxes(): PlaneBox[] {
    const h = this.config.fixMarkerCm / 2
    const w = h * this.config.fixMarkerAspect
    return this.markers.filter((m) => m.shown && m.root.isEnabledInHierarchy).map((m) => this.viewBox(m.item, m.soft.face, -w, w, -h, h))
  }

  /** Shows a marker per item in `items` (green when in `selected`) and the instruction panel in front of the head. */
  open(items: string[], selected: string[]): void {
    this._open = true
    for (const m of this.markers) {
      m.shown = items.indexOf(m.item) >= 0
      m.root.enabled = m.shown
      m.soft.reset()
      m.selected = selected.indexOf(m.item) >= 0
      m.soft.setSelected(m.selected)
      if (m.shown) drawOnTopWhenReady(this.owner, m.root)
    }
    this.backButton.reset()
    this.repeatButton.reset()
    this.pill = false // Slice 18: opens full; the first update looks at the gaze
    this.offSeconds = 0
    this.layoutPanel(selected.length > 0)
    this.follow.reset()
    this.placePanel()
    this.panel.enabled = true
    drawOnTopWhenReady(this.owner, this.panel)
    this.guard.seconds = this.config.pinchGuardSeconds
    this.guard.arm()
    this.update.enabled = true
    this.onUpdate()
  }

  /** A pick changed: the marker's look, and Ulangi gempa shown once anything is picked. */
  setSelection(selected: string[]): void {
    for (const m of this.markers) {
      const on = selected.indexOf(m.item) >= 0
      if (on !== m.selected) {
        m.selected = on
        m.soft.setSelected(on)
      }
    }
    this.layoutPanel(selected.length > 0)
  }

  close(): void {
    if (!this._open) return
    this._open = false
    this.update.enabled = false
    this.hideAll()
  }

  private find(item: string): Marker | null {
    for (const m of this.markers) if (m.item === item) return m
    return null
  }

  private hideAll(): void {
    for (const m of this.markers) {
      m.shown = false
      m.root.enabled = false
    }
    this.panel.enabled = false
  }

  private onUpdate(): void {
    if (!this._open) return
    const head = this.headPose.position
    const forward = this.headPose.forward
    const c = this.config
    let focused = false
    for (const m of this.markers) {
      if (!m.shown) continue
      const t = m.root.getTransform()
      const d0 = this.spot(m.item, c.fixMarkerCm)
      if (!d0) continue
      const dist = d0.sub(head).length
      const s = Math.max(1, dist / Math.max(1, c.fixMarkerRefCm))
      const p = s > 1 ? this.spot(m.item, c.fixMarkerCm * s) || d0 : d0
      t.setLocalScale(new vec3(s, s, s))
      t.setWorldPosition(p)
      t.setWorldRotation(faceHead(p, head))
      if (!focused && p.sub(head).angleTo(forward) <= c.fixPillFocusDeg * DEG_TO_RAD) focused = true
    }
    this.pillStep(focused)
    this.followPanel()
  }

  /**
   * Slice 18 (plan 19b): a pill at once while the gaze is on a marker, the
   * full panel once it has been off every marker for fixPillHoldSeconds.
   * Neither switch happens while a pinch is held on Kembali or Ulangi gempa
   * (it waits for the release), so no button moves or hides under a pinch.
   */
  private pillStep(focused: boolean): void {
    this.offSeconds = focused ? 0 : this.offSeconds + getDeltaTime()
    const want = focused || (this.pill && this.offSeconds < this.config.fixPillHoldSeconds)
    if (want !== this.pill && !this.held) {
      this.pill = want
      this.pending = true
    }
    if (this.pending) this.applyLayout()
  }

  /** Slice 13C: a pinch is down on Kembali or Ulangi gempa. */
  private get held(): boolean {
    return this.backButton.isPressed || this.repeatButton.isPressed
  }

  private placePanel(): void {
    const head = this.headPose.position
    const anchor = anchorInFront(head, this.headPose.forward, this.config.hudDistance, this.config.replayCaptionBelowEye)
    if (!anchor) return
    const t = this.panel.getTransform()
    t.setWorldPosition(this.follow.snap(anchor, head))
    t.setWorldRotation(faceHead(anchor, head))
  }

  /** As the replay caption (Slice 13C): follows past the dead zone; never under a pinch held on its buttons. */
  private followPanel(): void {
    const head = this.headPose.position
    const forward = this.headPose.forward
    const anchor = anchorInFront(head, forward, this.config.hudDistance, this.config.replayCaptionBelowEye)
    if (!anchor) return
    const c = this.config
    const held = this.backButton.isPressed || this.repeatButton.isPressed
    const at = this.follow.step(head, forward, anchor, getDeltaTime(), {deg: c.panelFollowDeg, cm: c.panelFollowCm, speed: c.panelFollowSpeed}, held)
    const t = this.panel.getTransform()
    t.setWorldPosition(at)
    t.setWorldRotation(faceHead(at, head))
  }

  /** Ulangi gempa shown or not (an item picked); the layout follows unless a pinch is held on a panel button. */
  private layoutPanel(repeat: boolean): void {
    this.repeat = repeat
    this.pending = true
    this.applyLayout()
  }

  /** Slice 18: the pill or the full panel, now, or on the first frame no pinch is held on Kembali or Ulangi gempa. */
  private applyLayout(): void {
    if (this.held) return
    this.pending = false
    if (this.pill) {
      this.layoutPill()
    } else {
      this.layoutFull()
    }
  }

  /** The instruction on top, then Kembali alone (centered) or Kembali | Ulangi gempa. */
  private layoutFull(): void {
    const c = this.config
    const lineH = c.fixInstrEmCm * LINE_H_PER_EM
    const bh = c.fixPanelButtonCm
    const bw = bh * BUTTON_ASPECT
    const h = PAD + lineH + GAP + bh + PAD
    this.panelFrame.setSize(this.panelW, h)
    const top = h / 2 - PAD
    this.styleInstr(c.fixInstrEmCm, HorizontalOverflow.Shrink, this.panelW - PAD * 2, lineH) // as addText built it
    this.instr.getSceneObject().getTransform().setLocalPosition(new vec3(0, top - lineH / 2, 0))
    this.instr.getSceneObject().enabled = true
    const y = -h / 2 + PAD + bh / 2
    const x = this.repeat ? bw / 2 + BUTTON_GAP / 2 : 0
    this.backObject.getTransform().setLocalPosition(new vec3(-x, y, 0))
    this.backObject.enabled = true
    this.repeatObject.getTransform().setLocalPosition(new vec3(x, y, 0))
    this.repeatObject.enabled = this.repeat
  }

  /**
   * Slice 18 (plan 19b): the pill, centered where the full panel is. Ulangi
   * gempa (the same button, the same size) when an item is picked, else the
   * instruction at fixPillEmCm wrapped to at most fixPillWidthCm; no Kembali.
   */
  private layoutPill(): void {
    const c = this.config
    let w: number
    let h: number
    if (this.repeat) {
      const bh = c.fixPanelButtonCm
      w = bh * BUTTON_ASPECT + PILL_PAD * 2
      h = bh + PILL_PAD * 2
      this.instr.getSceneObject().enabled = false
      this.repeatObject.getTransform().setLocalPosition(vec3.zero())
      this.repeatObject.enabled = true
    } else {
      const lineH = c.fixPillEmCm * LINE_H_PER_EM
      const textW = Math.max(1, c.fixPillWidthCm - PILL_PAD * 2)
      const so = this.instr.getSceneObject()
      so.enabled = true
      so.getTransform().setLocalPosition(vec3.zero())
      this.styleInstr(c.fixPillEmCm, HorizontalOverflow.Wrap, textW, lineH)
      let n = 1
      let lineW = textW
      if (so.isEnabledInHierarchy && this.instr.text.length > 0) {
        const box = this.instr.getBoundingBox() // one call, as ResultPanel.wrapLines
        n = Math.max(1, Math.round((box.top - box.bottom) / lineH))
        lineW = Math.min(textW, box.right - box.left)
      }
      this.instr.layoutRect = Rect.create(-textW / 2, textW / 2, (-n * lineH) / 2, (n * lineH) / 2)
      w = Math.min(c.fixPillWidthCm, lineW + PILL_PAD * 2)
      h = n * lineH + PILL_PAD * 2
      this.repeatObject.enabled = false
    }
    this.backObject.enabled = false
    this.panelFrame.setSize(w, h)
  }

  private styleInstr(emCm: number, overflow: HorizontalOverflow, w: number, h: number): void {
    this.instr.size = emCm * SIZE_PER_CM
    this.instr.horizontalOverflow = overflow
    this.instr.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
  }

  /**
   * Slice 18 (DC32): a local rect of `so` seen from the head, as
   * ResultPanel.planeBox: each corner projected from the head onto the plane
   * through the panel's center square to headPose.forward, in world cm from
   * that center along the view's right and up. Two boxes that overlap here
   * overlap in view.
   */
  private viewBox(name: string, so: SceneObject, l: number, r: number, b: number, t: number): PlaneBox {
    const head = this.headPose.position
    const f = this.headPose.forward.normalize()
    const side = f.cross(vec3.up())
    const ax = side.length > 1e-4 ? side.normalize() : vec3.right()
    const ay = ax.cross(f).normalize()
    const o = this.panel.getTransform().getWorldPosition()
    const depth = Math.max(1, o.sub(head).dot(f))
    const m = so.getTransform().getWorldTransform()
    const box: PlaneBox = {name, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity}
    for (const [x, y] of [
      [l, b],
      [r, b],
      [l, t],
      [r, t]
    ]) {
      const d = m.multiplyPoint(new vec3(x, y, 0)).sub(head)
      const p = head.add(d.uniformScale(depth / Math.max(1, d.dot(f)))).sub(o)
      box.minX = Math.min(box.minX, p.dot(ax))
      box.maxX = Math.max(box.maxX, p.dot(ax))
      box.minY = Math.min(box.minY, p.dot(ay))
      box.maxY = Math.max(box.maxY, p.dot(ay))
    }
    return box
  }

  private addButton(
    parent: SceneObject,
    name: string,
    key: StringKey,
    w: number,
    h: number,
    primary: boolean,
    action: () => void
  ): {so: SceneObject; soft: SoftButton; text: Text} {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(w, h, 1)
    const soft = new SoftButton(this.owner, btn, w, h, primary, () => {
      if (this._open && this.guard.open) action()
    })
    const label = global.scene.createSceneObject(name + "Label")
    label.setParent(soft.face)
    label.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const text = addText(label, key, h * BUTTON_LABEL_PER_H, w - 1)
    if (primary) {
      text.textFill.color = SOFT_GREEN_TEXT // dark text on solid green
    }
    return {so, soft, text}
  }
}

/** "Rak: Ikat ke dinding": fix.action with the item's name, its first letter upper case. */
export function markerText(item: string): string {
  const name = getString(("item." + item) as StringKey)
  const cap = name.length > 0 ? name.charAt(0).toUpperCase() + name.slice(1) : name
  return lines("fix.action", {"{item}": cap}).primary
}

function addText(parent: SceneObject, name: string, emCm: number, w: number): Text {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const t = so.createComponent("Component.Text") as Text
  t.text = ""
  t.size = emCm * SIZE_PER_CM
  t.depthTest = true
  t.textFill.color = new vec4(1, 1, 1, 1)
  t.horizontalAlignment = HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Shrink
  t.verticalOverflow = VerticalOverflow.Overflow
  const h = emCm * LINE_H_PER_EM
  t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
  return t
}
