import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

// Every user-facing string in the Lens (TDD §6), in the five languages of
// docs/STRINGS_I18N.md (Slice 5L). Panels show the selected language only
// (Slice 7A-soft, 5j-13d); the language picker title shows all five.
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
  | "label.lamp"
  | "label.tv"
  | "label.door"
  | "warn.bed"
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
  | "over.why.grip"
  | "label.danger"
  | "picker.title"
  | "lang.name"
  | "step.goUnder"
  | "step.duck"
  | "step.hold"
  | "step.evac"
  | "instr.evac"
  | "instr.grip"
  | "warn.trip"
  | "result.grip"
  | "result.evac"
  | "result.evacFail"
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
  | "result.reveal"
  | "calib.title"
  | "calib.done"
  | "btn.skip"
  | "result.best"
  | "result.newBest"
  // Slice 9B (STRINGS_I18N.md, EDUCATION_CARDS.md): education cards F4.
  | "card.stayUnder"
  | "card.falling"
  | "card.bed"
  | "card.fasten"
  | "card.evac"
  | "card.check"
  | "card.coast"

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
  "label.lamp": {
    id: "Lampu bisa roboh",
    en: "Lamp can fall over",
    de: "Die Lampe kann umfallen",
    ja: "ランプが倒れるかも",
    zh: "落地灯可能倒下"
  },
  "label.tv": {
    id: "TV bisa jatuh",
    en: "TV can fall",
    de: "Der Fernseher kann herunterfallen",
    ja: "テレビが落ちるかも",
    zh: "电视可能掉落"
  },
  "label.door": {id: "Pintu keluar", en: "Exit door", de: "Ausgang", ja: "出口", zh: "出口"}, // Slice 8A
  "warn.bed": {
    id: "Kasur bukan tempat berlindung",
    en: "A bed is not a safe place",
    de: "Ein Bett ist kein sicherer Ort",
    ja: "ベッドは安全な場所ではありません",
    zh: "床不是安全的地方"
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
  "over.why.grip": {
    id: "Kamu tidak memegang kaki meja",
    en: "You did not hold the table leg",
    de: "Du hast das Tischbein nicht festgehalten",
    ja: "机の脚をつかんでいませんでした",
    zh: "你没有抓住桌腿"
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
  // Slice 8B (STRINGS_I18N.md): evacuation and hold on.
  "step.evac": {id: "Keluar", en: "Get out", de: "Raus", ja: "外へ", zh: "撤离"},
  "instr.evac": {
    id: "Keluar lewat pintu, hindari zona merah",
    en: "Leave through the door, avoid the red zones",
    de: "Geh durch die Tür, meide die roten Zonen",
    ja: "ドアから出て、赤いゾーンを避けて",
    zh: "从门离开，避开红色区域"
  },
  "instr.grip": {id: "Pegang kaki meja", en: "Hold the table leg", de: "Halte das Tischbein fest", ja: "机の脚をつかんで", zh: "抓住桌腿"},
  "warn.trip": {
    id: "Hati-hati, ada barang di lantai",
    en: "Careful, something on the floor",
    de: "Vorsicht, etwas liegt am Boden",
    ja: "足元に物があります",
    zh: "小心地上有东西"
  },
  "result.grip": {id: "Memegang meja: {p}%", en: "Held the table: {p}%", de: "Tisch festgehalten: {p} %", ja: "机をつかんだ時間：{p}%", zh: "抓住桌子：{p}%"},
  "result.evac": {id: "Keluar dalam {s} s", en: "Got out in {s} s", de: "Draußen nach {s} s", ja: "{s} 秒で外へ", zh: "{s} 秒内撤离"},
  "result.evacFail": {id: "Belum sampai pintu", en: "Did not reach the door", de: "Tür nicht erreicht", ja: "ドアに着けませんでした", zh: "没有到达门口"},
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
    id: "Meja sampai 250 cm",
    en: "Table up to 250 cm",
    de: "Tisch bis 250 cm",
    ja: "机は最大250 cm",
    zh: "桌子最远250 cm"
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
    id: "Cari sendiri: tanpa label, zona, panah",
    en: "Find it yourself: no labels, zones, arrow",
    de: "Selbst finden: keine Hinweise, Zonen, Pfeile",
    ja: "自分で探す：ラベル・ゾーン・矢印なし",
    zh: "自己找：没有标签、区域和箭头"
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
  },
  "result.reveal": {
    id: "Lihat ruangan: merah berbahaya, hijau aman",
    en: "Look around: red is dangerous, green is safe",
    de: "Sieh dich um: Rot ist gefährlich, Grün ist sicher",
    ja: "見回そう：赤は危険、緑は安全",
    zh: "看看四周：红色危险，绿色安全"
  },
  // Slice 8D (STRINGS_I18N.md): duck practice and personal best.
  "calib.title": {
    id: "Coba merunduk sekarang",
    en: "Try ducking now",
    de: "Duck dich jetzt einmal",
    ja: "今、しゃがんでみて",
    zh: "现在试着蹲下"
  },
  "calib.done": {
    id: "Bagus, begitu caranya",
    en: "Good, that's how",
    de: "Gut, so geht's",
    ja: "いいですね、その調子",
    zh: "很好，就是这样"
  },
  "btn.skip": {id: "Lewati", en: "Skip", de: "Überspringen", ja: "スキップ", zh: "跳过"},
  "result.best": {id: "Rekor: {score}", en: "Best: {score}", de: "Bestwert: {score}", ja: "ベスト：{score}", zh: "最佳：{score}"},
  "result.newBest": {id: "Rekor baru!", en: "New best!", de: "Neuer Bestwert!", ja: "自己ベスト更新！", zh: "新纪录！"},
  // Slice 9B (STRINGS_I18N.md, EDUCATION_CARDS.md): education cards F4.
  "card.stayUnder": {
    id: "Tetap lindungi kepala dan badan di bawah meja sampai guncangan benar-benar berhenti.",
    en: "Keep your head and body under the table until the shaking has fully stopped.",
    de: "Schütze Kopf und Körper unter dem Tisch, bis das Beben ganz aufgehört hat.",
    ja: "揺れが完全に収まるまで、机の下で頭と体を守りましょう。",
    zh: "摇晃完全停止前，待在桌子下保护头和身体。"
  },
  "card.falling": {
    id: "Penyebab celaka terbanyak saat gempa adalah kejatuhan benda. Jauhi lemari, rak, lampu, dan kaca.",
    en: "Most earthquake injuries come from falling objects. Stay away from cabinets, shelves, lamps and glass.",
    de: "Die meisten Verletzungen entstehen durch fallende Gegenstände. Halte Abstand zu Schränken, Regalen, Lampen und Glas.",
    ja: "地震のけがの多くは落下物によるものです。棚・ラック・ランプ・ガラスから離れましょう。",
    zh: "地震中多数受伤来自坠落物。远离柜子、架子、灯和玻璃。"
  },
  "card.bed": {
    id: "Kasur tidak melindungi kepala dari benda yang jatuh. Cari meja yang kokoh.",
    en: "A bed does not shield your head from falling objects. Find a sturdy table.",
    de: "Ein Bett schützt den Kopf nicht vor fallenden Gegenständen. Suche einen stabilen Tisch.",
    ja: "ベッドは落下物から頭を守れません。丈夫な机を探しましょう。",
    zh: "床不能保护头部免受坠落物。请找结实的桌子。"
  },
  "card.fasten": {
    id: "Ikat atau paku lemari dan rak ke dinding, dan simpan benda berat di bagian bawah.",
    en: "Fasten cabinets and shelves to the wall, and keep heavy things low.",
    de: "Befestige Schränke und Regale an der Wand und lagere Schweres unten.",
    ja: "棚や家具は壁に固定し、重い物は下に置きましょう。",
    zh: "把柜子和架子固定在墙上，重物放在下层。"
  },
  "card.evac": {
    id: "Setelah guncangan berhenti, keluar dengan tertib. Jangan pakai lift, gunakan tangga biasa.",
    en: "After the shaking stops, leave calmly. Do not use the lift; take the stairs.",
    de: "Wenn das Beben aufhört, geh ruhig hinaus. Nimm nicht den Aufzug, sondern die Treppe.",
    ja: "揺れが収まったら落ち着いて外へ。エレベーターではなく階段を使いましょう。",
    zh: "摇晃停止后有序离开。不要坐电梯，走楼梯。"
  },
  "card.check": {
    id: "Setelah keluar, periksa yang terluka, kebocoran gas, dan kebakaran. Waspadai gempa susulan.",
    en: "Once outside, check for injuries, gas leaks and fire. Expect aftershocks.",
    de: "Draußen: auf Verletzte, Gaslecks und Feuer achten. Rechne mit Nachbeben.",
    ja: "外に出たら、けが・ガス漏れ・火災を確認。余震に注意しましょう。",
    zh: "到户外后检查伤情、燃气泄漏和火灾。注意余震。"
  },
  "card.coast": {
    id: "Di dekat pantai: jika gempa sangat kuat atau terasa sekitar 1 menit atau lebih, segera menjauh ke tempat tinggi.",
    en: "Near the coast: if the shaking is very strong or lasts about a minute or more, move to high ground at once.",
    de: "An der Küste: Bei sehr starkem Beben oder etwa einer Minute Dauer sofort auf eine Anhöhe gehen.",
    ja: "海岸の近くでは、強い揺れや約1分以上続く揺れを感じたらすぐ高台へ。",
    zh: "在海边：如果摇晃很强或持续约一分钟以上，立刻前往高处。"
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

/**
 * One string as shown. Slice 7A-soft (ENGINEERING_PLAN 5j item 13d): one
 * language per screen, so secondary is always "" and panels hide their
 * English line. Only the language picker title keeps its five languages.
 */
export interface Lines {
  primary: string
  secondary: string
}

export function lines(key: StringKey, fills?: Fills): Lines {
  return {
    primary: fill(STRINGS[key][current], fills),
    secondary: ""
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

// Fonts (Slice 5L, 7A-soft 5j-13b): one family. ja and zh lines use the Noto
// subsets; every Latin line (id, en, de, titles, numbers) uses Manrope.
// DrillController registers them from DrillConfig. An unwired font falls
// back to the default (SpecsSans).
let fontJa: Font | null = null
let fontZh: Font | null = null
let fontLatin: Font | null = null
let defaultFont: Font | null = null

export function setLanguageFonts(ja: Font | null, zh: Font | null, latin: Font | null = null): void {
  fontJa = ja ? ja : null
  fontZh = zh ? zh : null
  fontLatin = latin ? latin : null
}

/** The font a line in this language needs, or null for the default font. */
export function fontFor(lang: Lang): Font | null {
  if (lang === "ja") {
    return fontJa
  }
  if (lang === "zh") {
    return fontZh
  }
  return fontLatin
}

/** The Latin font (Manrope), for text that is the same in every language (numbers, timer). */
export function latinFont(): Font | null {
  return fontLatin
}

/**
 * Sets a Text's string and its font for `lang`. The default font is taken
 * from the first Text that still has it.
 */
export function setLineText(t: Text, text: string, lang: Lang): void {
  if (defaultFont === null && t.font && t.font !== fontJa && t.font !== fontZh && t.font !== fontLatin) {
    defaultFont = t.font
  }
  const want = fontFor(lang) || defaultFont
  if (want && t.font !== want) {
    t.font = want
  }
  t.text = text
}

/**
 * Sets a primary / secondary Text pair from lines(): primary in the selected
 * language's font. The secondary (English) Text is disabled while its text is
 * empty, which is always since 5j-13d; callers collapse its layout slot.
 */
export function setLinePair(primary: Text, secondary: Text, l: Lines): void {
  setLineText(primary, l.primary, current)
  setLineText(secondary, l.secondary, "en")
  secondary.enabled = l.secondary.length > 0
}
