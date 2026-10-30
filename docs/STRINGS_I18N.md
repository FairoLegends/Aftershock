# Strings in five languages: Aftershock

Learner decision, 27 Oct 2026: the user picks the language on a first screen with five big buttons. In-Lens text shows the selected language on top and English smaller below, so judges can always read it. Chinese uses Simplified characters. The German, Japanese and Chinese drafts were written by the orchestrator and approved by the learner for direct use.

Slice 9 keys (30 Oct, education cards F4, learner approved; sources in docs/EDUCATION_CARDS.md; DE/JA/ZH default): `card.*`. Slice 8 keys (29 Oct, ENGINEERING_PLAN 5k; DE/JA/ZH default): `label.door`, `step.evac`, `instr.evac`, `instr.grip`, `warn.trip`, `result.grip`, `result.evac`, `result.evacFail`, `calib.*`, `btn.skip`, `result.best`, `result.newBest`. Slice 7 keys (learner, 29 Oct; ENGINEERING_PLAN 5j): `step.*`, `scan.*`, `marquee.*`, `warn.aftershock`, `hit.fell`, `level.*`, `result.aftershock`, `result.level`. id and en follow the approved mockup; de, ja and zh are translations (default). `marquee.*` stays in the chosen language only, no English second line; `marquee.dch` is the same in every language (the drill's name). `{level}` takes the `level.easy/normal/hard` string of the same language.

Learner, 29 Oct (ENGINEERING_PLAN 5j-13): every screen now shows ONE language, the one picked; the English second line is dropped for id, de, ja and zh. Only the picker title keeps all five. The display rule below is superseded.

Display rule (superseded 29 Oct):
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
| `over.why.danger` | Kamu berdiri di dekat benda yang bisa jatuh | You stayed next to something that can fall | Du bist neben etwas geblieben, das umfallen kann | 倒れてくる物のそばにいました | 你待在可能倒下的物品旁边 |
| `label.danger` | Zona bahaya | Danger zone | Gefahrenzone | 危険区域 | 危险区 |
| `result.never` | Kamu tidak berlindung di bawah meja | You never took cover under the table | Du hast keinen Schutz unter dem Tisch gesucht | 机の下に避難しませんでした | 你没有躲到桌子下面 |
| `btn.changeLang` | Ganti bahasa | Change language | Sprache ändern | 言語を変更 | 更改语言 |
| `btn.restart` | Ulangi | Restart | Neu starten | もう一度 | 重新开始 |
| `step.goUnder` | Ke bawah meja | Go under the table | Unter den Tisch | 机の下へ | 躲到桌下 |
| `step.duck` | Merunduk | Duck down | Ducken | 身を低く | 蹲下 |
| `step.hold` | Tahan | Hold on | Festhalten | そのまま待つ | 坚持住 |
| `scan.title` | Memindai ruangan | Scanning room | Raum wird gescannt | 部屋をスキャン中 | 正在扫描房间 |
| `marquee.drill` | AFTERSHOCK · LATIHAN GEMPA | AFTERSHOCK · EARTHQUAKE DRILL | AFTERSHOCK · ERDBEBENÜBUNG | AFTERSHOCK · 地震訓練 | AFTERSHOCK · 地震演练 |
| `marquee.dch` | DROP · COVER · HOLD ON | DROP · COVER · HOLD ON | DROP · COVER · HOLD ON | DROP · COVER · HOLD ON | DROP · COVER · HOLD ON |
| `warn.aftershock` | GEMPA SUSULAN! | AFTERSHOCK! | NACHBEBEN! | 余震！ | 余震！ |
| `hit.glass` | Kamu terkena pecahan kaca | You were hit by broken glass | Dich haben Glasscherben getroffen | ガラスの破片が当たりました | 你被碎玻璃划到了 |
| `hit.fell` | Kamu kejatuhan barang | Something fell on you | Etwas ist auf dich gefallen | 物が落ちてきました | 有东西砸到了你 |
| `level.title` | Pilih tingkat | Choose level | Schwierigkeit wählen | レベルを選択 | 选择难度 |
| `level.easy` | Mudah | Easy | Leicht | かんたん | 简单 |
| `level.normal` | Normal | Normal | Normal | ふつう | 普通 |
| `level.hard` | Sulit | Hard | Schwer | むずかしい | 困难 |
| `level.recommended` | DISARANKAN | RECOMMENDED | EMPFOHLEN | おすすめ | 推荐 |
| `level.easy.1` | Label tetap terlihat | Labels stay visible | Hinweise bleiben sichtbar | ラベルが表示されたまま | 标签一直显示 |
| `level.easy.2` | Meja dekat, maks 150 cm | Table close, max 150 cm | Tisch nah, max. 150 cm | 机は近く、最大150 cm | 桌子很近，最远150 cm |
| `level.easy.3` | Tanpa gempa susulan | No aftershock | Kein Nachbeben | 余震なし | 没有余震 |
| `level.normal.1` | Meja sampai 250 cm | Table up to 250 cm | Tisch bis 250 cm | 机は最大250 cm | 桌子最远250 cm |
| `level.normal.2` | Kadang ada gempa susulan | Sometimes an aftershock | Manchmal ein Nachbeben | ときどき余震 | 有时有余震 |
| `level.normal.3` | Benda bisa jatuh | Items can fall | Gegenstände können fallen | 物が落ちることも | 物品可能掉落 |
| `level.hard.1` | Cari sendiri: tanpa label, zona, panah | Find it yourself: no labels, zones, arrow | Selbst finden: keine Hinweise, Zonen, Pfeile | 自分で探す：ラベル・ゾーン・矢印なし | 自己找：没有标签、区域和箭头 |
| `level.hard.2` | Nyawa turun lebih cepat | Health drops faster | Leben sinkt schneller | 体力が早く減る | 生命值下降更快 |
| `level.hard.3` | Selalu ada gempa susulan | Always an aftershock | Immer ein Nachbeben | 必ず余震あり | 一定有余震 |
| `result.aftershock` | Gempa susulan: {s} s | Aftershock cover: {s} s | Nachbeben-Deckung: {s} s | 余震で身を守るまで：{s} 秒 | 余震躲避用时：{s} 秒 |
| `result.reveal` | Lihat ruangan: merah berbahaya, hijau aman | Look around: red is dangerous, green is safe | Sieh dich um: Rot ist gefährlich, Grün ist sicher | 見回そう：赤は危険、緑は安全 | 看看四周：红色危险，绿色安全 |
| `label.door` | Pintu keluar | Exit door | Ausgang | 出口 | 出口 |
| `step.evac` | Keluar | Get out | Raus | 外へ | 撤离 |
| `instr.evac` | Keluar lewat pintu, hindari zona merah | Leave through the door, avoid the red zones | Geh durch die Tür, meide die roten Zonen | ドアから出て、赤いゾーンを避けて | 从门离开，避开红色区域 |
| `instr.grip` | Pegang kaki meja | Hold the table leg | Halte das Tischbein fest | 机の脚をつかんで | 抓住桌腿 |
| `warn.trip` | Hati-hati, ada barang di lantai | Careful, something on the floor | Vorsicht, etwas liegt am Boden | 足元に物があります | 小心地上有东西 |
| `result.grip` | Memegang meja: {p}% | Held the table: {p}% | Tisch festgehalten: {p} % | 机をつかんだ時間：{p}% | 抓住桌子：{p}% |
| `result.evac` | Keluar dalam {s} s | Got out in {s} s | Draußen nach {s} s | {s} 秒で外へ | {s} 秒内撤离 |
| `result.evacFail` | Belum sampai pintu | Did not reach the door | Tür nicht erreicht | ドアに着けませんでした | 没有到达门口 |
| `calib.title` | Coba merunduk sekarang | Try ducking now | Duck dich jetzt einmal | 今、しゃがんでみて | 现在试着蹲下 |
| `calib.done` | Bagus, begitu caranya | Good, that's how | Gut, so geht's | いいですね、その調子 | 很好，就是这样 |
| `btn.skip` | Lewati | Skip | Überspringen | スキップ | 跳过 |
| `result.best` | Rekor: {score} | Best: {score} | Bestwert: {score} | ベスト：{score} | 最佳：{score} |
| `result.newBest` | Rekor baru! | New best! | Neuer Bestwert! | 自己ベスト更新！ | 新纪录！ |
| `card.stayUnder` | Tetap lindungi kepala dan badan di bawah meja sampai guncangan benar-benar berhenti. | Keep your head and body under the table until the shaking has fully stopped. | Schütze Kopf und Körper unter dem Tisch, bis das Beben ganz aufgehört hat. | 揺れが完全に収まるまで、机の下で頭と体を守りましょう。 | 摇晃完全停止前，待在桌子下保护头和身体。 |
| `card.falling` | Penyebab celaka terbanyak saat gempa adalah kejatuhan benda. Jauhi lemari, rak, lampu, dan kaca. | Most earthquake injuries come from falling objects. Stay away from cabinets, shelves, lamps and glass. | Die meisten Verletzungen entstehen durch fallende Gegenstände. Halte Abstand zu Schränken, Regalen, Lampen und Glas. | 地震のけがの多くは落下物によるものです。棚・ラック・ランプ・ガラスから離れましょう。 | 地震中多数受伤来自坠落物。远离柜子、架子、灯和玻璃。 |
| `card.bed` | Kasur tidak melindungi kepala dari benda yang jatuh. Cari meja yang kokoh. | A bed does not shield your head from falling objects. Find a sturdy table. | Ein Bett schützt den Kopf nicht vor fallenden Gegenständen. Suche einen stabilen Tisch. | ベッドは落下物から頭を守れません。丈夫な机を探しましょう。 | 床不能保护头部免受坠落物。请找结实的桌子。 |
| `card.fasten` | Ikat atau paku lemari dan rak ke dinding, dan simpan benda berat di bagian bawah. | Fasten cabinets and shelves to the wall, and keep heavy things low. | Befestige Schränke und Regale an der Wand und lagere Schweres unten. | 棚や家具は壁に固定し、重い物は下に置きましょう。 | 把柜子和架子固定在墙上，重物放在下层。 |
| `card.evac` | Setelah guncangan berhenti, keluar dengan tertib. Jangan pakai lift, gunakan tangga biasa. | After the shaking stops, leave calmly. Do not use the lift; take the stairs. | Wenn das Beben aufhört, geh ruhig hinaus. Nimm nicht den Aufzug, sondern die Treppe. | 揺れが収まったら落ち着いて外へ。エレベーターではなく階段を使いましょう。 | 摇晃停止后有序离开。不要坐电梯，走楼梯。 |
| `card.check` | Setelah keluar, periksa yang terluka, kebocoran gas, dan kebakaran. Waspadai gempa susulan. | Once outside, check for injuries, gas leaks and fire. Expect aftershocks. | Draußen: auf Verletzte, Gaslecks und Feuer achten. Rechne mit Nachbeben. | 外に出たら、けが・ガス漏れ・火災を確認。余震に注意しましょう。 | 到户外后检查伤情、燃气泄漏和火灾。注意余震。 |
| `card.coast` | Di dekat pantai: jika gempa sangat kuat atau terasa sekitar 1 menit atau lebih, segera menjauh ke tempat tinggi. | Near the coast: if the shaking is very strong or lasts about a minute or more, move to high ground at once. | An der Küste: Bei sehr starkem Beben oder etwa einer Minute Dauer sofort auf eine Anhöhe gehen. | 海岸の近くでは、強い揺れや約1分以上続く揺れを感じたらすぐ高台へ。 | 在海边：如果摇晃很强或持续约一分钟以上，立刻前往高处。 |
| `over.why.grip` | Kamu tidak memegang kaki meja | You did not hold the table leg | Du hast das Tischbein nicht festgehalten | 机の脚をつかんでいませんでした | 你没有抓住桌腿 |
| `result.level` | Tingkat: {level} | Level: {level} | Stufe: {level} | レベル：{level} | 难度：{level} |
| `label.lamp` | Lampu bisa roboh | Lamp can fall over | Die Lampe kann umfallen | ランプが倒れるかも | 落地灯可能倒下 |
| `label.tv` | TV bisa jatuh | TV can fall | Der Fernseher kann herunterfallen | テレビが落ちるかも | 电视可能掉落 |
| `warn.bed` | Kasur bukan tempat berlindung | A bed is not a safe place | Ein Bett ist kein sicherer Ort | ベッドは安全な場所ではありません | 床不是安全的地方 |

## Fonts

The Lens Studio 5.23.2 bundled fonts (SpecsSans, AvenirNext) cover German (ä ö ü ß) but have no Japanese or Chinese glyphs (checked on the installed font files, 27 Oct 2026). Plan:
- Japanese: Noto Sans JP; Chinese: Noto Sans SC. Both SIL Open Font License 1.1, which allows bundling.
- Subset each font to only the characters in this file (for example with `pyftsubset`) so the Lens stays small, and keep the full license text next to the font files.
- Credit both fonts in the README and `THIRD_PARTY_NOTICES.md`.
