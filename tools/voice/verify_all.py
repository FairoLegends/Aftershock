import os, re, json, difflib, unicodedata, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
src = open("gen_all.py", encoding="utf-8").read()
LINES = eval(src.split("LINES = ",1)[1].split("\nLANGS",1)[0])
asr = WhisperModel("small", device="cpu", compute_type="int8")
def norm(s, l):
    s = unicodedata.normalize("NFKC", s).lower()
    return re.sub(r"[\s\W_]", "", s) if l in ("ja","zh") else " ".join(re.sub(r"[^\w ]","",s).split())
rows, miss = [], 0
for lang in ("id","en","de","ja","zh"):
    parts = []; ok = 0
    for key, texts in LINES.items():
        f = f"final/{lang}/{key.replace('.','_')}.wav"
        if not os.path.exists(f):
            print("MISSING", f, flush=True); miss += 1; continue
        a, sr = sf.read(f); info = sf.info(f)
        h = " ".join(x.text.strip() for x in asr.transcribe(f, language=lang, beam_size=5)[0])
        m = difflib.SequenceMatcher(None, norm(texts[lang], lang), norm(h, lang)).ratio()
        ok += m >= 0.999
        rows.append((lang, key, round(m,2), round(info.duration,2), info.samplerate, h))
        parts += [a, np.zeros(int(sr*0.8))]
    sf.write(f"final/DENGAR-{lang}.wav", np.concatenate(parts).astype(np.float32), sr, subtype="PCM_16")
    print(lang, "exact", ok, "/ 12", flush=True)
for r in rows:
    if r[2] < 0.999: print("  ", r, flush=True)
tot = sum(os.path.getsize(f"final/{l}/{f}") for l in ("id","en","de","ja","zh") for f in os.listdir(f"final/{l}") if f.endswith(".wav"))
print("files", len(rows), "missing", miss, "total MB %.2f" % (tot/1e6), "sr", {r[4] for r in rows}, "max sec", max(r[3] for r in rows))
json.dump(rows, open("final/check.json","w",encoding="utf-8"), ensure_ascii=False, indent=0)
