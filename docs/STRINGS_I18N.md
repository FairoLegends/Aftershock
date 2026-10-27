# Strings in five languages: Aftershock

Learner decision, 27 Oct 2026: the user picks the language on a first screen with five big buttons. In-Lens text shows the selected language on top and English smaller below, so judges can always read it. Chinese uses Simplified characters. The German, Japanese and Chinese drafts were written by the orchestrator and approved by the learner for direct use.

Display rule:
- Indonesian, German, Japanese or Chinese selected: that line on top, English below at 80% size (DESIGN_BRIEF §5.2).
- English selected: English only, one line (default).
- `{s}`, `{h}`, `{score}` are filled in at runtime.
- The `id` and `en` columns are the same text as TDD §6 (`"id / en"`), except that `result.speed`, `result.health` and `result.score` carry their `{placeholder}` in every language line (TDD §6 writes it once at the end). If any other text differs, TDD §6 wins and this file is fixed.

## Language picker

| Button | Code |
|---|---|
| Bahasa Indonesia | `id` |
| English | `en` |
| Deutsch | `de` |
| 日本語 | `ja` |
| 简体中文 | `zh` |

Picker title, all five on one panel (default): Pilih bahasa · Choose language · Sprache wählen · 言語を選択 · 选择语言

## Strings

| Key | id | en | de | ja | zh |
|---|---|---|---|---|---|
| `safety.drill` | Ini latihan, bukan peringatan gempa sungguhan | This is a drill, not a real earthquake alert | Das ist eine Übung, keine echte Erdbebenwarnung | これは訓練です。本物の地震警報ではありません | 这是演练，不是真实的地震警报 |
| `safety.room` | Pastikan ruanganmu aman untuk bergerak | Make sure your room is safe to move in | Achte darauf, dass du dich im Raum sicher bewegen kannst | 部屋の中を安全に動けるか確認してください | 请确认房间里可以安全走动 |
| `btn.continue` | Lanjut | Continue | Weiter | 次へ | 继续 |
| `instr.brief` | Kenali benda berbahaya dan ingat letak safe zone | Know the hazards and remember the safe zone | Erkenne die Gefahren und merke dir die Sicherheitszone | 危険な物を確認し、安全地帯の場所を覚えましょう | 认清危险物品，记住安全区的位置 |
| `warn.quake` | GEMPA! | EARTHQUAKE! | ERDBEBEN! | 地震！ | 地震！ |
| `instr.goUnder` | Pergi ke bawah meja | Go under the table | Geh unter den Tisch | 机の下に入って | 躲到桌子下面 |
| `instr.duck` | Merunduk | Duck down | Duck dich | 姿勢を低くして | 蹲低身体 |
| `instr.hold` | Tahan sampai guncangan berhenti | Hold until the shaking stops | Festhalten, bis das Beben aufhört | 揺れが収まるまで動かないで | 保持不动，直到摇晃停止 |
| `instr.comeOut` | Guncangan berhenti. Keluar dari bawah meja | The shaking stopped. Come out from under the table | Das Beben hat aufgehört. Komm unter dem Tisch hervor | 揺れが収まりました。机の下から出てください | 摇晃已停止，请从桌子下面出来 |
| `label.cabinet` | Lemari bisa roboh | Cabinet can fall | Schrank kann umkippen | 戸棚が倒れるおそれ | 柜子可能倒下 |
| `label.shelf` | Barang di rak bisa jatuh | Shelf items can fall | Dinge im Regal können herunterfallen | 棚の物が落ちるおそれ | 架子上的物品可能掉落 |
| `label.glass` | Kaca bisa pecah | Glass can shatter | Glas kann zerbrechen | ガラスが割れるおそれ | 玻璃可能碎裂 |
| `label.safe` | Safe zone: bawah meja | Safe zone: under the table | Sicherheitszone: unter dem Tisch | 安全地帯：机の下 | 安全区：桌子下面 |
| `hud.health` | Nyawa | Health | Leben | 体力 | 生命值 |
| `hud.time` | Waktu | Time | Zeit | 時間 | 时间 |
| `result.title` | Latihan selesai | Drill complete | Übung beendet | 訓練完了 | 演练完成 |
| `result.speed` | Kecepatan berlindung: {s} s | Time to take cover: {s} s | Zeit bis zur Deckung: {s} s | 身を守るまでの時間：{s} 秒 | 躲避用时：{s} 秒 |
| `result.health` | Sisa nyawa: {h} | Health left: {h} | Verbleibendes Leben: {h} | 残り体力：{h} | 剩余生命值：{h} |
| `result.score` | Skor: {score} | Score: {score} | Punkte: {score} | スコア：{score} | 得分：{score} |
| `over.title` | Nyawa habis | Out of health | Keine Leben mehr | 体力がなくなりました | 生命值耗尽 |
| `over.why.stood` | Kamu berdiri sebelum guncangan berhenti | You stood up before the shaking stopped | Du bist aufgestanden, bevor das Beben aufgehört hat | 揺れが収まる前に立ち上がりました | 你在摇晃停止前站了起来 |
| `result.never` | Kamu tidak berlindung di bawah meja | You never took cover under the table | Du hast keinen Schutz unter dem Tisch gesucht | 机の下に避難しませんでした | 你没有躲到桌子下面 |
| `btn.restart` | Ulangi | Restart | Neu starten | もう一度 | 重新开始 |

## Fonts

The Lens Studio 5.23.2 bundled fonts (SpecsSans, AvenirNext) cover German (ä ö ü ß) but have no Japanese or Chinese glyphs (checked on the installed font files, 27 Oct 2026). Plan:
- Japanese: Noto Sans JP; Chinese: Noto Sans SC. Both SIL Open Font License 1.1, which allows bundling.
- Subset each font to only the characters in this file (for example with `pyftsubset`) so the Lens stays small, and keep the full license text next to the font files.
- Credit both fonts in the README and `THIRD_PARTY_NOTICES.md`.
