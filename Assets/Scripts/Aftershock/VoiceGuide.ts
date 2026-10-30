import {Lang, LANGS, StringKey} from "./Strings"

/**
 * The 12 spoken keys (ENGINEERING_PLAN 5l item 5), in the order every
 * per-language track input uses. Clip file: Assets/Aftershock/Audio/Voice/<lang>/<key with "." → "_">.wav
 */
export const VOICE_KEYS: StringKey[] = [
  "warn.quake",
  "instr.goUnder",
  "instr.duck",
  "instr.grip",
  "instr.hold",
  "instr.comeOut",
  "warn.aftershock",
  "instr.evac",
  "warn.trip",
  "warn.bed",
  "calib.title",
  "calib.done"
]

/** One clip that started playing. */
export interface VoiceLine {
  key: StringKey
  lang: Lang
  time: number // s, getTime() when it started
}

const LOG = "[Aftershock]"
const END_TAIL_SECONDS = 0.1 // the clip counts as speaking a little past its length (LowPower start latency)
const NO_LENGTH_MIN_SECONDS = 0.2 // a track without a length: speaking until isPlaying() is false, at least this long
const HISTORY_SIZE = 20

function isWarning(key: StringKey): boolean {
  return key.indexOf("warn.") === 0
}

/**
 * F6 voice instructions (ENGINEERING_PLAN 5l item 5): pre-made TTS clips, one
 * AudioComponent. say() plays a key's clip in a language; a new clip stops the
 * one playing, except that an instruction said while a warning (warn.*) plays
 * waits for the warning to end (only the latest one waits), so warn.quake is
 * heard before instr.goUnder. The same key is not said again within
 * repeatSeconds. A missing clip is logged once and skipped. stopAll() also
 * forgets the repeat times, so a new drill can say its first lines at once.
 */
@component
export class VoiceGuide extends BaseScriptComponent {
  @ui.label("F6 voice instructions (ENGINEERING_PLAN 5l item 5)")
  @ui.separator
  @input
  @hint("AudioComponent that plays the voice clips (volume 1.0)")
  voiceAudio: AudioComponent

  @input
  @hint("Bahasa Indonesia clips (Voice/id), 12 in VOICE_KEYS order: warn.quake, instr.goUnder, instr.duck, instr.grip, instr.hold, instr.comeOut, warn.aftershock, instr.evac, warn.trip, warn.bed, calib.title, calib.done")
  tracksId: AudioTrackAsset[]

  @input
  @hint("English clips (Voice/en), 12 in VOICE_KEYS order (as tracksId)")
  tracksEn: AudioTrackAsset[]

  @input
  @hint("German clips (Voice/de), 12 in VOICE_KEYS order (as tracksId)")
  tracksDe: AudioTrackAsset[]

  @input
  @hint("Japanese clips (Voice/ja), 12 in VOICE_KEYS order (as tracksId)")
  tracksJa: AudioTrackAsset[]

  @input
  @hint("Chinese clips (Voice/zh), 12 in VOICE_KEYS order (as tracksId)")
  tracksZh: AudioTrackAsset[]

  @input
  @hint("The same key is not said again within this many seconds")
  repeatSeconds: number = 4

  @input
  @hint("While a clip plays, the rumble loop is at this share of its volume (DrillController applies it)")
  rumbleDuck: number = 0.6

  private tracks: Record<Lang, AudioTrackAsset[]> = {id: [], en: [], de: [], ja: [], zh: []}
  private lastAt: {[key: string]: number} = {} // s, getTime() of each key's last play (repeat rule)
  private pending: {key: StringKey; lang: Lang} | null = null // an instruction waiting for a warning to end
  private current: VoiceLine | null = null
  private history: VoiceLine[] = []
  private reported: {[keyLang: string]: boolean} = {}
  private speaking = false
  private endsAt = -1 // s; -1: the track had no length, poll isPlaying()
  private _playCount = 0
  private updateEvent: UpdateEvent | null = null

  /** The last clip that started, or null before the first. */
  get lastSaid(): VoiceLine | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null
  }
  /** A voice clip is playing. */
  get isSpeaking(): boolean {
    return this.speaking
  }
  /** Clips started since the Lens began. */
  get playCount(): number {
    return this._playCount
  }
  /** The last HISTORY_SIZE clips that started, oldest first. */
  get said(): VoiceLine[] {
    return this.history.slice()
  }
  /** Multiplier for the rumble loop's volume: rumbleDuck while speaking, else 1. */
  get rumbleFactor(): number {
    return this.speaking ? this.rumbleDuck : 1
  }
  /** Tracks assigned across the five languages (60 when fully wired). */
  get clipCount(): number {
    let n = 0
    for (const lang of LANGS) {
      for (const t of this.tracks[lang]) {
        if (t) n++
      }
    }
    return n
  }

  onAwake(): void {
    this.tracks = {
      id: this.tracksId || [],
      en: this.tracksEn || [],
      de: this.tracksDe || [],
      ja: this.tracksJa || [],
      zh: this.tracksZh || []
    }
    this.updateEvent = this.createEvent("UpdateEvent")
    this.updateEvent.bind(() => this.onUpdate())
    this.updateEvent.enabled = false
    if (!this.voiceAudio) {
      console.error(`${LOG} VoiceGuide: voiceAudio is not assigned; no voice`)
      return
    }
    this.voiceAudio.playbackMode = Audio.PlaybackMode.LowPower // spoken lines: latency is fine (specs-audio)
    const missing: string[] = []
    for (const lang of LANGS) {
      VOICE_KEYS.forEach((key, i) => {
        if (!this.tracks[lang][i]) missing.push(`${lang}/${key}`)
      })
    }
    const all = LANGS.length * VOICE_KEYS.length
    if (missing.length > 0) {
      console.warn(`${LOG} VoiceGuide: ${all - missing.length}/${all} clips; missing ${missing.join(", ")}`)
    } else {
      console.log(`${LOG} VoiceGuide: ${all}/${all} clips`)
    }
  }

  /**
   * Plays `key` in `lang` unless it was said within repeatSeconds. It stops
   * the clip playing, except that an instruction waits for a playing warning.
   */
  say(key: StringKey, lang: Lang): void {
    const track = this.trackFor(key, lang)
    if (!track) {
      return
    }
    if (this.speaking && this.current && isWarning(this.current.key) && !isWarning(key)) {
      this.pending = {key, lang}
      return
    }
    this.play(key, lang, track)
  }

  /** Stops the clip playing, drops a waiting one and forgets the repeat times. */
  stopAll(): void {
    this.pending = null
    this.lastAt = {}
    if (this.voiceAudio && (this.speaking || this.voiceAudio.isPlaying())) {
      this.voiceAudio.stop(false)
    }
    this.speaking = false
    this.current = null
    if (this.updateEvent) this.updateEvent.enabled = false
  }

  private play(key: StringKey, lang: Lang, track: AudioTrackAsset): void {
    const now = getTime()
    const last = this.lastAt[key]
    if (last !== undefined && now - last < this.repeatSeconds) {
      return
    }
    if (!isWarning(key)) {
      this.pending = null
    }
    const a = this.voiceAudio
    if (this.speaking || a.isPlaying()) {
      a.stop(false)
    }
    a.audioTrack = track
    a.play(1)
    const line: VoiceLine = {key, lang, time: now}
    this.lastAt[key] = now
    this.current = line
    this.history.push(line)
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift()
    }
    this._playCount++
    this.speaking = true
    const length = a.duration
    this.endsAt = length > 0 ? now + length + END_TAIL_SECONDS : -1
    this.updateEvent.enabled = true
    console.log(`${LOG} voice: ${key} (${lang}, ${length > 0 ? length.toFixed(2) : "?"} s)`)
  }

  /** The clip for key and lang; a missing one is logged once (per key and language). */
  private trackFor(key: StringKey, lang: Lang): AudioTrackAsset | null {
    const i = VOICE_KEYS.indexOf(key)
    const list = this.tracks[lang]
    const track = i >= 0 && list ? list[i] : null
    if (track && this.voiceAudio) {
      return track
    }
    const id = key + "/" + lang
    if (!this.reported[id]) {
      this.reported[id] = true
      console.warn(`${LOG} VoiceGuide: no clip for ${key} (${lang})${this.voiceAudio ? "" : ", no voiceAudio"}; not spoken`)
    }
    return null
  }

  /** Ends the clip at its length, then plays a waiting instruction. */
  private onUpdate(): void {
    if (!this.speaking) {
      this.updateEvent.enabled = false
      return
    }
    const now = getTime()
    const started = this.current ? this.current.time : now
    const done = this.endsAt > 0 ? now >= this.endsAt : now - started >= NO_LENGTH_MIN_SECONDS && !this.voiceAudio.isPlaying()
    if (!done) {
      return
    }
    this.speaking = false
    this.current = null
    const next = this.pending
    this.pending = null
    if (next) {
      this.say(next.key, next.lang)
    }
    if (!this.speaking) {
      this.updateEvent.enabled = false
    }
  }
}
