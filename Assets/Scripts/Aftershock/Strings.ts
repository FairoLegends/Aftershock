import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

// Every user-facing string in the Lens (TDD §6), in the five languages of
// docs/STRINGS_I18N.md (Slice 5L). Panels show the selected language on top
// and English below at 80%; English alone when English is selected.
// Do not put user-facing text anywhere else.

export type Lang = "id" | "en" | "de" | "ja" | "zh"

/** Picker order (DESIGN_BRIEF §6.1). */
export const LANGS: Lang[] = ["id", "en", "de", "ja", "zh"]

export type StringKey =
  | "safety.drill"
  | "safety.room"
  | "btn.continue"
  | "instr.brief"
  | "warn.quake"
  | "instr.goUnder"
  | "instr.duck"
  | "instr.hold"
  | "instr.comeOut"
  | "label.cabinet"
  | "label.shelf"
  | "label.glass"
  | "label.safe"
  | "hud.health"
  | "hud.time"
  | "result.title"
  | "result.speed"
  | "result.health"
  | "result.score"
  | "over.title"
  | "result.never"
  | "over.why.stood"
  | "btn.restart"
  | "over.why.danger"
  | "label.danger"
  | "picker.title"
  | "lang.name"

export const STRINGS: Record<StringKey, Record<Lang, string>> = {
  "safety.drill": {
    id: "Ini latihan, bukan peringatan gempa sungguhan",
    en: "This is a drill, not a real earthquake alert",
    de: "Das ist eine Übung, keine echte Erdbebenwarnung",
    ja: "これは訓練です。本物の地震警報ではありません",
    zh: "这是演练，不是真实的地震警报"
  },
  "safety.room": {
    id: "Pastikan ruanganmu aman untuk bergerak",
    en: "Make sure your room is safe to move in",
    de: "Achte darauf, dass du dich im Raum sicher bewegen kannst",
    ja: "部屋の中を安全に動けるか確認してください",
    zh: "请确认房间里可以安全走动"
  },
  "btn.continue": {id: "Lanjut", en: "Continue", de: "Weiter", ja: "次へ", zh: "继续"},
  "instr.brief": {
    id: "Kenali benda berbahaya dan ingat letak safe zone",
    en: "Know the hazards and remember the safe zone",
    de: "Erkenne die Gefahren und merke dir die Sicherheitszone",
    ja: "危険な物を確認し、安全地帯の場所を覚えましょう",
    zh: "认清危险物品，记住安全区的位置"
  },
  "warn.quake": {id: "GEMPA!", en: "EARTHQUAKE!", de: "ERDBEBEN!", ja: "地震！", zh: "地震！"},
  "instr.goUnder": {
    id: "Pergi ke bawah meja",
    en: "Go under the table",
    de: "Geh unter den Tisch",
    ja: "机の下に入って",
    zh: "躲到桌子下面"
  },
  "instr.duck": {id: "Merunduk", en: "Duck down", de: "Duck dich", ja: "姿勢を低くして", zh: "蹲低身体"},
  "instr.hold": {
    id: "Tahan sampai guncangan berhenti",
    en: "Hold until the shaking stops",
    de: "Festhalten, bis das Beben aufhört",
    ja: "揺れが収まるまで動かないで",
    zh: "保持不动，直到摇晃停止"
  },
  "instr.comeOut": {
    id: "Guncangan berhenti. Keluar dari bawah meja",
    en: "The shaking stopped. Come out from under the table",
    de: "Das Beben hat aufgehört. Komm unter dem Tisch hervor",
    ja: "揺れが収まりました。机の下から出てください",
    zh: "摇晃已停止，请从桌子下面出来"
  },
  "label.cabinet": {
    id: "Lemari bisa roboh",
    en: "Cabinet can fall",
    de: "Schrank kann umkippen",
    ja: "戸棚が倒れるおそれ",
    zh: "柜子可能倒下"
  },
  "label.shelf": {
    id: "Barang di rak bisa jatuh",
    en: "Shelf items can fall",
    de: "Dinge im Regal können herunterfallen",
    ja: "棚の物が落ちるおそれ",
    zh: "架子上的物品可能掉落"
  },
  "label.glass": {
    id: "Kaca bisa pecah",
    en: "Glass can shatter",
    de: "Glas kann zerbrechen",
    ja: "ガラスが割れるおそれ",
    zh: "玻璃可能碎裂"
  },
  "label.safe": {
    id: "Safe zone: bawah meja",
    en: "Safe zone: under the table",
    de: "Sicherheitszone: unter dem Tisch",
    ja: "安全地帯：机の下",
    zh: "安全区：桌子下面"
  },
  "hud.health": {id: "Nyawa", en: "Health", de: "Leben", ja: "体力", zh: "生命值"},
  "hud.time": {id: "Waktu", en: "Time", de: "Zeit", ja: "時間", zh: "时间"},
  "result.title": {
    id: "Latihan selesai",
    en: "Drill complete",
    de: "Übung beendet",
    ja: "訓練完了",
    zh: "演练完成"
  },
  "result.speed": {
    id: "Kecepatan berlindung: {s} s",
    en: "Time to take cover: {s} s",
    de: "Zeit bis zur Deckung: {s} s",
    ja: "身を守るまでの時間：{s} 秒",
    zh: "躲避用时：{s} 秒"
  },
  "result.health": {
    id: "Sisa nyawa: {h}",
    en: "Health left: {h}",
    de: "Verbleibendes Leben: {h}",
    ja: "残り体力：{h}",
    zh: "剩余生命值：{h}"
  },
  "result.score": {
    id: "Skor: {score}",
    en: "Score: {score}",
    de: "Punkte: {score}",
    ja: "スコア：{score}",
    zh: "得分：{score}"
  },
  "over.title": {
    id: "Nyawa habis",
    en: "Out of health",
    de: "Keine Leben mehr",
    ja: "体力がなくなりました",
    zh: "生命值耗尽"
  },
  "result.never": {
    id: "Kamu tidak berlindung di bawah meja",
    en: "You never took cover under the table",
    de: "Du hast keinen Schutz unter dem Tisch gesucht",
    ja: "机の下に避難しませんでした",
    zh: "你没有躲到桌子下面"
  },
  "over.why.stood": {
    id: "Kamu berdiri sebelum guncangan berhenti",
    en: "You stood up before the shaking stopped",
    de: "Du bist aufgestanden, bevor das Beben aufgehört hat",
    ja: "揺れが収まる前に立ち上がりました",
    zh: "你在摇晃停止前站了起来"
  },
  "btn.restart": {id: "Ulangi", en: "Restart", de: "Neu starten", ja: "もう一度", zh: "重新开始"},
  "over.why.danger": {
    id: "Kamu berdiri di dekat benda yang bisa jatuh",
    en: "You stayed next to something that can fall",
    de: "Du bist neben etwas geblieben, das umfallen kann",
    ja: "倒れてくる物のそばにいました",
    zh: "你待在可能倒下的物品旁边"
  },
  "label.danger": {id: "Zona bahaya", en: "Danger zone", de: "Gefahrenzone", ja: "危険区域", zh: "危险区"},
  // Language picker (Slice 5L): every line is shown in its own language.
  "picker.title": {
    id: "Pilih bahasa",
    en: "Choose language",
    de: "Sprache wählen",
    ja: "言語を選択",
    zh: "选择语言"
  },
  "lang.name": {
    id: "Bahasa Indonesia",
    en: "English",
    de: "Deutsch",
    ja: "日本語",
    zh: "简体中文"
  }
}

// Selected language: "id" until the picker sets it; Restart keeps it.
let current: Lang = "id"
const languageChanged = new Event<Lang>()

/** Raised after setLanguage changes the language; panels re-render their text. */
export const onLanguageChanged: PublicApi<Lang> = languageChanged.publicApi()

export function getLanguage(): Lang {
  return current
}

export function setLanguage(lang: Lang): void {
  if (lang === current) {
    return
  }
  current = lang
  languageChanged.invoke(lang)
}

export function getString(key: StringKey, lang: Lang = current): string {
  return STRINGS[key][lang]
}

/** Placeholder fills, e.g. {"{s}": "4.2"}; used in every language. */
export type Fills = Record<string, string>

/** One string as shown: selected language on top, English below ("" when English is selected). */
export interface Lines {
  primary: string
  secondary: string
}

export function lines(key: StringKey, fills?: Fills): Lines {
  return {
    primary: fill(STRINGS[key][current], fills),
    secondary: current === "en" ? "" : fill(STRINGS[key].en, fills)
  }
}

function fill(text: string, fills?: Fills): string {
  if (!fills) {
    return text
  }
  for (const placeholder in fills) {
    text = text.replace(placeholder, fills[placeholder])
  }
  return text
}

// Fonts (Slice 5L): SpecsSans (the default) covers id, en and de; ja and zh
// need the Noto subsets. DrillController registers them from DrillConfig.
let fontJa: Font | null = null
let fontZh: Font | null = null
let defaultFont: Font | null = null

export function setLanguageFonts(ja: Font | null, zh: Font | null): void {
  fontJa = ja ? ja : null
  fontZh = zh ? zh : null
}

/** The font a line in this language needs, or null for the default font. */
export function fontFor(lang: Lang): Font | null {
  return lang === "ja" ? fontJa : lang === "zh" ? fontZh : null
}

/**
 * Sets a Text's string and its font for `lang`: fontJa for ja, fontZh for zh,
 * the default font otherwise. The default is taken from the first Text that
 * still has it. An unwired CJK font leaves the default (missing glyphs).
 */
export function setLineText(t: Text, text: string, lang: Lang): void {
  if (defaultFont === null && t.font && t.font !== fontJa && t.font !== fontZh) {
    defaultFont = t.font
  }
  const want = fontFor(lang) || defaultFont
  if (want && t.font !== want) {
    t.font = want
  }
  t.text = text
}

/** Sets a primary / secondary Text pair from lines(): primary in the selected language's font, English in the default. */
export function setLinePair(primary: Text, secondary: Text, l: Lines): void {
  setLineText(primary, l.primary, current)
  setLineText(secondary, l.secondary, "en")
}
