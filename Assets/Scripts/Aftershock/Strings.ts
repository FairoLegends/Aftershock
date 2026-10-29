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
  | "step.goUnder"
  | "step.duck"
  | "step.hold"
  | "scan.title"
  | "marquee.drill"
  | "marquee.dch"
  | "warn.aftershock"
  | "hit.fell"
  | "level.title"
  | "level.easy"
  | "level.normal"
  | "level.hard"
  | "level.recommended"
  | "level.easy.1"
  | "level.easy.2"
  | "level.easy.3"
  | "level.normal.1"
  | "level.normal.2"
  | "level.normal.3"
  | "level.hard.1"
  | "level.hard.2"
  | "level.hard.3"
  | "result.aftershock"
  | "result.level"

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
  },
  // Slice 7 (ENGINEERING_PLAN 5j). marquee.* is shown in the selected language only.
  "step.goUnder": {
    id: "Ke bawah meja",
    en: "Go under the table",
    de: "Unter den Tisch",
    ja: "机の下へ",
    zh: "躲到桌下"
  },
  "step.duck": {id: "Merunduk", en: "Duck down", de: "Ducken", ja: "身を低く", zh: "蹲下"},
  "step.hold": {id: "Tahan", en: "Hold on", de: "Festhalten", ja: "そのまま待つ", zh: "坚持住"},
  "scan.title": {
    id: "Memindai ruangan",
    en: "Scanning room",
    de: "Raum wird gescannt",
    ja: "部屋をスキャン中",
    zh: "正在扫描房间"
  },
  "marquee.drill": {
    id: "AFTERSHOCK · LATIHAN GEMPA",
    en: "AFTERSHOCK · EARTHQUAKE DRILL",
    de: "AFTERSHOCK · ERDBEBENÜBUNG",
    ja: "AFTERSHOCK · 地震訓練",
    zh: "AFTERSHOCK · 地震演练"
  },
  "marquee.dch": {
    id: "DROP · COVER · HOLD ON",
    en: "DROP · COVER · HOLD ON",
    de: "DROP · COVER · HOLD ON",
    ja: "DROP · COVER · HOLD ON",
    zh: "DROP · COVER · HOLD ON"
  },
  "warn.aftershock": {id: "GEMPA SUSULAN!", en: "AFTERSHOCK!", de: "NACHBEBEN!", ja: "余震！", zh: "余震！"},
  "hit.fell": {
    id: "Kamu kejatuhan barang",
    en: "Something fell on you",
    de: "Etwas ist auf dich gefallen",
    ja: "物が落ちてきました",
    zh: "有东西砸到了你"
  },
  "level.title": {
    id: "Pilih tingkat",
    en: "Choose level",
    de: "Schwierigkeit wählen",
    ja: "レベルを選択",
    zh: "选择难度"
  },
  "level.easy": {id: "Mudah", en: "Easy", de: "Leicht", ja: "かんたん", zh: "简单"},
  "level.normal": {id: "Normal", en: "Normal", de: "Normal", ja: "ふつう", zh: "普通"},
  "level.hard": {id: "Sulit", en: "Hard", de: "Schwer", ja: "むずかしい", zh: "困难"},
  "level.recommended": {id: "DISARANKAN", en: "RECOMMENDED", de: "EMPFOHLEN", ja: "おすすめ", zh: "推荐"},
  "level.easy.1": {
    id: "Label tetap terlihat",
    en: "Labels stay visible",
    de: "Hinweise bleiben sichtbar",
    ja: "ラベルが表示されたまま",
    zh: "标签一直显示"
  },
  "level.easy.2": {
    id: "Meja dekat, maks 150 cm",
    en: "Table close, max 150 cm",
    de: "Tisch nah, max. 150 cm",
    ja: "机は近く、最大150 cm",
    zh: "桌子很近，最远150 cm"
  },
  "level.easy.3": {id: "Tanpa gempa susulan", en: "No aftershock", de: "Kein Nachbeben", ja: "余震なし", zh: "没有余震"},
  "level.normal.1": {
    id: "Meja sampai 200 cm",
    en: "Table up to 200 cm",
    de: "Tisch bis 200 cm",
    ja: "机は最大200 cm",
    zh: "桌子最远200 cm"
  },
  "level.normal.2": {
    id: "Kadang ada gempa susulan",
    en: "Sometimes an aftershock",
    de: "Manchmal ein Nachbeben",
    ja: "ときどき余震",
    zh: "有时有余震"
  },
  "level.normal.3": {
    id: "Benda bisa jatuh",
    en: "Items can fall",
    de: "Gegenstände können fallen",
    ja: "物が落ちることも",
    zh: "物品可能掉落"
  },
  "level.hard.1": {
    id: "Tanpa panah dan jalur",
    en: "No arrow, no path",
    de: "Kein Pfeil, kein Pfad",
    ja: "矢印と道しるべなし",
    zh: "没有箭头和路线"
  },
  "level.hard.2": {
    id: "Nyawa turun lebih cepat",
    en: "Health drops faster",
    de: "Leben sinkt schneller",
    ja: "体力が早く減る",
    zh: "生命值下降更快"
  },
  "level.hard.3": {
    id: "Selalu ada gempa susulan",
    en: "Always an aftershock",
    de: "Immer ein Nachbeben",
    ja: "必ず余震あり",
    zh: "一定有余震"
  },
  "result.aftershock": {
    id: "Gempa susulan: {s} s",
    en: "Aftershock cover: {s} s",
    de: "Nachbeben-Deckung: {s} s",
    ja: "余震で身を守るまで：{s} 秒",
    zh: "余震躲避用时：{s} 秒"
  },
  "result.level": {
    id: "Tingkat: {level}",
    en: "Level: {level}",
    de: "Stufe: {level}",
    ja: "レベル：{level}",
    zh: "难度：{level}"
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

/** One string in the selected language only (marquee strips: no English line). */
export function primaryLine(key: StringKey): string {
  return STRINGS[key][current]
}

// Fonts (Slice 5L, 7A): ja and zh lines use the Noto subsets; id, en and de
// use Syne for primary lines and titles ("title") and Manrope for English
// secondary lines and small text ("body"). DrillController registers them
// from DrillConfig. An unwired font falls back to the default (SpecsSans).
export type FontRole = "title" | "body"

let fontJa: Font | null = null
let fontZh: Font | null = null
let fontTitle: Font | null = null
let fontBody: Font | null = null
let defaultFont: Font | null = null

export function setLanguageFonts(ja: Font | null, zh: Font | null, title: Font | null = null, body: Font | null = null): void {
  fontJa = ja ? ja : null
  fontZh = zh ? zh : null
  fontTitle = title ? title : null
  fontBody = body ? body : null
}

/** The font a line in this language and role needs, or null for the default font. */
export function fontFor(lang: Lang, role: FontRole = "title"): Font | null {
  if (lang === "ja") {
    return fontJa
  }
  if (lang === "zh") {
    return fontZh
  }
  return role === "title" ? fontTitle : fontBody
}

/** The Latin font for a role, for text that is the same in every language (numbers, timer). */
export function latinFont(role: FontRole): Font | null {
  return role === "title" ? fontTitle : fontBody
}

/**
 * Sets a Text's string and its font for `lang` and `role`. The default font
 * is taken from the first Text that still has it.
 */
export function setLineText(t: Text, text: string, lang: Lang, role: FontRole = "title"): void {
  if (
    defaultFont === null &&
    t.font &&
    t.font !== fontJa &&
    t.font !== fontZh &&
    t.font !== fontTitle &&
    t.font !== fontBody
  ) {
    defaultFont = t.font
  }
  const want = fontFor(lang, role) || defaultFont
  if (want && t.font !== want) {
    t.font = want
  }
  t.text = text
}

/**
 * Sets a primary / secondary Text pair from lines(): primary in the selected
 * language's font (Syne, or Manrope for small text), English in Manrope.
 */
export function setLinePair(primary: Text, secondary: Text, l: Lines, primaryRole: FontRole = "title"): void {
  setLineText(primary, l.primary, current, primaryRole)
  setLineText(secondary, l.secondary, "en", "body")
}
