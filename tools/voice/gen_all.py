"""F6 voice lines, five languages. Calm style (learner, 30 Oct: voice C, calm, "Ada gempa. Tetap tenang.").

id: Pocket TTS Indonesian (CC-BY-4.0) + CC0 Common Voice prompt 19961910, temp 0.35/0.5.
en: Piper en_US-joe-medium (CC0 data). de: Piper de_DE-thorsten-medium (CC0).
zh: Piper zh_CN-chaowen-medium (CC0). ja: Kokoro-82M (Apache-2.0), voice jm_kumo.
Every take is checked with Whisper (small); the clearest take is kept.
"""
import os, sys, re, json, difflib, subprocess, unicodedata
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "final")
os.makedirs(OUT, exist_ok=True)

# Spoken text per key. Display text stays as in Strings.ts; two warnings get calm spoken
# variants (id chosen by the learner; the other four are Hermes's translations, default).
LINES = {
  "warn.quake":      {"id": "Ada gempa. Tetap tenang.", "en": "An earthquake. Please stay calm.", "de": "Ein Erdbeben. Bleib ruhig.", "ja": "地震です。落ち着いてください。", "zh": "地震了。保持冷静。"},
  "instr.goUnder":   {"id": "Pergi ke bawah meja.", "en": "Go under the table.", "de": "Geh unter den Tisch.", "ja": "机の下に入ってください。", "zh": "躲到桌子下面。"},
  "instr.duck":      {"id": "Merunduk.", "en": "Duck down.", "de": "Duck dich nach unten.", "ja": "姿勢を低くしてください。", "zh": "请蹲下来，压低身体。"},
  "instr.grip":      {"id": "Pegang kaki meja.", "en": "Hold the leg of the table.", "de": "Halte das Tischbein fest.", "ja": "机の脚をつかんでください。", "zh": "抓住桌腿。"},
  "instr.hold":      {"id": "Tahan sampai guncangan berhenti.", "en": "Hold until the shaking stops.", "de": "Festhalten, bis das Beben aufhört.", "ja": "揺れが収まるまで動かないでください。", "zh": "保持不动，直到摇晃停止。"},
  "instr.comeOut":   {"id": "Guncangan berhenti. Keluar dari bawah meja.", "en": "The shaking stopped. Come out from under the table.", "de": "Das Beben hat aufgehört. Komm unter dem Tisch hervor.", "ja": "揺れが収まりました。机の下から出てください。", "zh": "摇晃已停止，请从桌子下面出来。"},
  "warn.aftershock": {"id": "Gempa susulan. Tetap tenang.", "en": "This is an aftershock. Please stay calm.", "de": "Ein Nachbeben. Bleib ruhig.", "ja": "余震です。落ち着いてください。", "zh": "余震。保持冷静。"},
  "instr.evac":      {"id": "Keluar lewat pintu, hindari zona merah.", "en": "Leave through the door, avoid the red zones.", "de": "Geh durch die Tür, meide die roten Zonen.", "ja": "ドアから出て、赤いゾーンを避けてください。", "zh": "从门离开，避开红色区域。"},
  "warn.trip":       {"id": "Hati-hati, ada barang di lantai.", "en": "Careful, something on the floor.", "de": "Vorsicht, etwas liegt am Boden.", "ja": "足元に物があります。", "zh": "小心地上有东西。"},
  "warn.bed":        {"id": "Kasur bukan tempat berlindung.", "en": "A bed is not a safe place.", "de": "Ein Bett ist kein sicherer Ort.", "ja": "ベッドは安全な場所ではありません。", "zh": "床不是安全的地方。"},
  "calib.title":     {"id": "Coba merunduk sekarang.", "en": "Try ducking now.", "de": "Duck dich jetzt einmal nach unten.", "ja": "今、しゃがんでみてください。", "zh": "现在试着蹲下。"},
  "calib.done":      {"id": "Bagus, begitu caranya.", "en": "Good, that's how.", "de": "Gut, so geht's.", "ja": "いいですね、その調子です。", "zh": "很好，就是这样。"},
}
LANGS = sys.argv[1].split(",") if len(sys.argv) > 1 else ["id", "en", "de", "ja", "zh"]
N = int(os.environ.get("TAKES", "4"))

from faster_whisper import WhisperModel
asr = WhisperModel("small", device="cpu", compute_type="int8")

def norm(s, lang):
    s = unicodedata.normalize("NFKC", s).lower()
    if lang in ("ja", "zh"):
        return re.sub(r"[\s\W_]", "", s)
    return " ".join(re.sub(r"[^\w ]", "", s).split())

def heard(path, lang):
    return " ".join(x.text.strip() for x in asr.transcribe(path, language=lang, beam_size=5)[0])

def match(t, h, lang):
    return difflib.SequenceMatcher(None, norm(t, lang), norm(h, lang)).ratio()

POST = ("acompressor=threshold=-20dB:ratio=2:attack=15:release=200,"
        "afade=t=in:d=0.03,areverse,afade=t=in:d=0.12,areverse,loudnorm=I=-18:TP=-2:LRA=7")

def finish(a, sr, dst):
    raw = dst + ".raw.wav"
    a = np.squeeze(np.asarray(a, dtype=np.float32))
    a = a / (np.max(np.abs(a)) + 1e-9) * 0.89
    sf.write(raw, a, sr, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", POST, "-ar", "24000", "-ac", "1", dst], check=True)
    os.remove(raw)

def best_of(gen, text, lang, dst):
    best = None
    for k in range(N):
        a, sr = gen(text, k)
        if a is None or len(a) < sr * 0.3: continue
        tmp = dst + f".take{k}.wav"
        finish(a, sr, tmp)
        h = heard(tmp, lang); m = match(text, h, lang)
        if best is None or m > best[0]:
            if best: os.remove(best[2])
            best = (m, h, tmp)
        else:
            os.remove(tmp)
        if m >= 0.999: break
    os.replace(best[2], dst)
    return best[0], best[1]

report = {}
for lang in LANGS:
    os.makedirs(os.path.join(OUT, lang), exist_ok=True)
    if lang == "id":
        from huggingface_hub import hf_hub_download
        from pocket_tts import TTSModel
        REPO = "anak10thn/pocket-tts-indonesian"; REV = "17257664e384561c957b02ac92edd1a24807f0e5"
        vp = hf_hub_download(REPO, "voices/common_voice_id_19961910.mp3")
        models = [TTSModel.load_model(config=f"hf://{REPO}/indonesian_6l.yaml@{REV}", temp=t) for t in (0.35, 0.5)]
        states = [m.get_state_for_audio_prompt(vp) for m in models]
        def gen(text, k):
            m = models[k % 2]
            return m.generate_audio(states[k % 2], text).detach().cpu().numpy(), m.sample_rate
    elif lang == "ja":
        from kokoro import KPipeline
        pipe = KPipeline(lang_code="j", repo_id="hexgrad/Kokoro-82M")
        def gen(text, k):
            parts = [p.audio.numpy() for p in pipe(text, voice="jm_kumo", speed=0.92)]
            return (np.concatenate(parts) if parts else None), 24000
    else:
        from piper import PiperVoice, SynthesisConfig
        from huggingface_hub import hf_hub_download
        name = {"en": "en/en_US/joe/medium/en_US-joe-medium", "de": "de/de_DE/thorsten/medium/de_DE-thorsten-medium",
                "zh": "zh/zh_CN/chaowen/medium/zh_CN-chaowen-medium"}[lang]
        onnx = hf_hub_download("rhasspy/piper-voices", name + ".onnx")
        hf_hub_download("rhasspy/piper-voices", name + ".onnx.json")
        voice = PiperVoice.load(onnx)
        def gen(text, k):
            cfg = SynthesisConfig(length_scale=1.08, noise_scale=[0.45, 0.55, 0.6, 0.5][k % 4], noise_w_scale=0.6)
            chunks = [c.audio_float_array for c in voice.synthesize(text, syn_config=cfg)]
            return np.concatenate(chunks), voice.config.sample_rate
    only = [k for k in os.environ.get("KEYS", "").split(",") if k]
    for key, texts in LINES.items():
        if only and key not in only: continue
        text = texts[lang]
        dst = os.path.join(OUT, lang, key.replace(".", "_") + ".wav")
        m, h = best_of(gen, text, lang, dst)
        d = sf.info(dst).duration
        report[f"{lang}/{key}"] = {"text": text, "heard": h, "match": round(m, 2), "sec": round(d, 2)}
        print(f"{lang} {key}: match {m:.2f} | '{text}' -> '{h}' | {d:.2f}s", flush=True)
    json.dump(report, open(os.path.join(OUT, f"report-{'-'.join(LANGS)}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok")
