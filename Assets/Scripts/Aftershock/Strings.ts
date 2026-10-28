// Every user-facing string in the Lens (TDD §6). Format: "Indonesian / English".
// Strings quoted from the brief are fixed; the others are (default) until the
// learner rewords them (PRD Q4). Do not put user-facing text anywhere else.

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

export const STRINGS: Record<StringKey, string> = {
  "safety.drill": "Ini latihan, bukan peringatan gempa sungguhan / This is a drill, not a real earthquake alert",
  "safety.room": "Pastikan ruanganmu aman untuk bergerak / Make sure your room is safe to move in",
  "btn.continue": "Lanjut / Continue",
  "instr.brief": "Kenali benda berbahaya dan ingat letak safe zone / Know the hazards and remember the safe zone",
  "warn.quake": "GEMPA! / EARTHQUAKE!",
  "instr.goUnder": "Pergi ke bawah meja / Go under the table",
  "instr.duck": "Merunduk / Duck down",
  "instr.hold": "Tahan sampai guncangan berhenti / Hold until the shaking stops",
  "instr.comeOut": "Guncangan berhenti. Keluar dari bawah meja / The shaking stopped. Come out from under the table",
  "label.cabinet": "Lemari bisa roboh / Cabinet can fall",
  "label.shelf": "Barang di rak bisa jatuh / Shelf items can fall",
  "label.glass": "Kaca bisa pecah / Glass can shatter",
  "label.safe": "Safe zone: bawah meja / Safe zone: under the table",
  "hud.health": "Nyawa / Health",
  "hud.time": "Waktu / Time",
  "result.title": "Latihan selesai / Drill complete",
  "result.speed": "Kecepatan berlindung / Time to take cover: {s} s",
  "result.health": "Sisa nyawa / Health left: {h}",
  "result.score": "Skor / Score: {score}",
  "over.title": "Nyawa habis / Out of health",
  "result.never": "Kamu tidak berlindung di bawah meja / You never took cover under the table",
  "over.why.stood": "Kamu berdiri sebelum guncangan berhenti / You stood up before the shaking stopped",
  "btn.restart": "Ulangi / Restart",
  "over.why.danger": "Kamu berdiri di dekat benda yang bisa jatuh / You stayed next to something that can fall",
  "label.danger": "Zona bahaya / Danger zone"
}

const SEPARATOR = " / "

export function getString(key: StringKey): string {
  return STRINGS[key]
}

/**
 * Splits a bilingual string at the first " / " into its Indonesian and English
 * halves, so panels can show Indonesian first and English below (DESIGN_BRIEF §5).
 */
export function splitBilingual(text: string): {id: string; en: string} {
  const i = text.indexOf(SEPARATOR)
  if (i < 0) {
    return {id: text, en: ""}
  }
  return {id: text.substring(0, i), en: text.substring(i + SEPARATOR.length)}
}
