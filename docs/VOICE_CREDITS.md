# Voice credits (F6)

The 60 spoken lines in `Assets/Aftershock/Audio/Voice/<lang>/<key>.wav` (12 keys x 5 languages, 24 kHz mono) were synthesized for this project on 30-31 Oct 2026 with open text-to-speech models. Nothing was recorded from a person for this project. The script is `tools/voice/gen_all.py`. Every line was checked with Whisper (small) and the clearest take was kept (`tools/voice/verify_all.py`).

| Language | Model | Model license | Voice / training data |
|---|---|---|---|
| Indonesian | Pocket TTS Indonesian 6L (anak10thn/pocket-tts-indonesian, revision 17257664), base model kyutai/pocket-tts | CC-BY-4.0 | Trained on the LEMAS dataset (CC-BY-4.0); voice prompt `common_voice_id_19961910` from Mozilla Common Voice 22.0 (CC0) |
| English | Piper, en_US-joe-medium | Piper voices (rhasspy/piper-voices) | Dataset: OHF-Voice voice-datasets, CC0 |
| German | Piper, de_DE-thorsten-medium | Piper voices | Thorsten-Voice dataset, CC0 |
| Japanese | Kokoro-82M (hexgrad), voice jm_kumo | Apache-2.0 | Per the Kokoro VOICES.md; jm_kumo trained on a koniwa reading of "Kumo no Ito" (CC BY) |
| Chinese | Piper, zh_CN-chaowen-medium | Piper voices | Dataset: OHF-Voice voice-datasets, CC0 |

Attribution (CC-BY-4.0 / CC BY): Indonesian voice lines made with "Pocket TTS Indonesian" by anak10thn, built on Kyutai's Pocket TTS, trained on the LEMAS dataset. Japanese voice jm_kumo from Kokoro-82M by hexgrad, trained in part on the koniwa project's recording. Indonesian voice prompt from Mozilla Common Voice (CC0).

Calm style (learner, 30 Oct): voice C, lower sampling temperature, sentences end in a full stop, soft compression and fades. Spoken text differs from the on-screen text for: warn.quake and warn.aftershock (all languages: "... Stay calm." added, learner chose the Indonesian "Ada gempa. Tetap tenang."), en instr.grip ("Hold the leg of the table."), de instr.duck and calib.title ("... nach unten"), zh instr.duck ("请蹲下来，压低身体。"); all non-Indonesian spoken variants are Hermes's (default) because the plainer text was not heard clearly.

## Whisper check (final files)

| Language | Exact | Lines with small differences |
|---|---|---|
| id | 10/12 | instr.comeOut: heard "Uncangan berhenti keluar dari bawah meja."; warn.aftershock: heard "Gempah susulan tetap tenang." |
| en | 12/12 | none |
| de | 8/12 | instr.duck: heard "Druck dich nach unten."; warn.aftershock: heard "Ein Nachbäben. Bleib ruhig."; warn.bed: heard "Ein Bett ist kein sichere Ort."; calib.title: heard "Druck dich jetzt einmal nach unten." |
| ja | 7/12 | warn.quake: heard "自信です。落ち着いてください。"; instr.grip: heard "机の足をつかんでください"; instr.comeOut: heard "ゆれが収まりました。つくえの下から出てください。"; warn.aftershock: heard "予診です。落ち着いてください。"; warn.trip: heard "足元にものがあります" |
| zh | 10/12 | warn.quake: heard "地震呢,保持冷静"; instr.comeOut: heard "咬晃已停止,请从桌子下面出来。" |

Japanese differences are the same sounds in another spelling (脚/足, 揺れ/ゆれ); German "Druck dich" is one letter off "Duck dich".

## Spoken text

| Key | id | en | de | ja | zh |
|---|---|---|---|---|---|
| `warn.quake` | Ada gempa. Tetap tenang. | An earthquake. Please stay calm. | Ein Erdbeben. Bleib ruhig. | 地震です。落ち着いてください。 | 地震了。保持冷静。 |
| `instr.goUnder` | Pergi ke bawah meja. | Go under the table. | Geh unter den Tisch. | 机の下に入ってください。 | 躲到桌子下面。 |
| `instr.duck` | Merunduk. | Duck down. | Duck dich nach unten. | 姿勢を低くしてください。 | 请蹲下来，压低身体。 |
| `instr.grip` | Pegang kaki meja. | Hold the leg of the table. | Halte das Tischbein fest. | 机の脚をつかんでください。 | 抓住桌腿。 |
| `instr.hold` | Tahan sampai guncangan berhenti. | Hold until the shaking stops. | Festhalten, bis das Beben aufhört. | 揺れが収まるまで動かないでください。 | 保持不动，直到摇晃停止。 |
| `instr.comeOut` | Guncangan berhenti. Keluar dari bawah meja. | The shaking stopped. Come out from under the table. | Das Beben hat aufgehört. Komm unter dem Tisch hervor. | 揺れが収まりました。机の下から出てください。 | 摇晃已停止，请从桌子下面出来。 |
| `warn.aftershock` | Gempa susulan. Tetap tenang. | This is an aftershock. Please stay calm. | Ein Nachbeben. Bleib ruhig. | 余震です。落ち着いてください。 | 余震。保持冷静。 |
| `instr.evac` | Keluar lewat pintu, hindari zona merah. | Leave through the door, avoid the red zones. | Geh durch die Tür, meide die roten Zonen. | ドアから出て、赤いゾーンを避けてください。 | 从门离开，避开红色区域。 |
| `warn.trip` | Hati-hati, ada barang di lantai. | Careful, something on the floor. | Vorsicht, etwas liegt am Boden. | 足元に物があります。 | 小心地上有东西。 |
| `warn.bed` | Kasur bukan tempat berlindung. | A bed is not a safe place. | Ein Bett ist kein sicherer Ort. | ベッドは安全な場所ではありません。 | 床不是安全的地方。 |
| `calib.title` | Coba merunduk sekarang. | Try ducking now. | Duck dich jetzt einmal nach unten. | 今、しゃがんでみてください。 | 现在试着蹲下。 |
| `calib.done` | Bagus, begitu caranya. | Good, that's how. | Gut, so geht's. | いいですね、その調子です。 | 很好，就是这样。 |
