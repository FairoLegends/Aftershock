"""Tiny software rasterizer: render a GLB (or several, combined) from a 3/4 view, flat-shaded, to PNG.
usage: glbrender.py out.png a.glb[:r,g,b] [b.glb[:r,g,b] ...]"""
import json, struct, sys, numpy as np
from PIL import Image

W = H = 700


def load(path):
    d = open(path, "rb").read()
    ln = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + ln])
    off = 20 + ln
    bl = struct.unpack("<I", d[off:off + 4])[0]
    bin_ = d[off + 8: off + 8 + bl]

    def acc(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        comp = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a["componentType"]]
        n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
        isz = np.dtype(comp).itemsize
        stride = bv.get("byteStride") or isz * n
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        raw = np.frombuffer(bin_, dtype=np.uint8, count=a["count"] * stride, offset=start).reshape(a["count"], stride)
        return raw[:, : isz * n].copy().view(comp).reshape(a["count"], n)

    pr = j["meshes"][0]["primitives"][0]
    pos = acc(pr["attributes"]["POSITION"]).astype(np.float64)
    tris = acc(pr["indices"]).reshape(-1, 3).astype(np.int64)
    t = j["nodes"][0].get("translation") or [0, 0, 0]
    return pos + np.array(t), tris


parts = []
for spec in sys.argv[2:]:
    path, _, col = spec.partition("@")
    rgb = tuple(float(x) for x in col.split(",")) if col else (0.8, 0.8, 0.85)
    parts.append((load(path), rgb))

allpos = np.vstack([p[0][0] for p in parts])
c = (allpos.min(0) + allpos.max(0)) / 2
scale = 0.9 * min(W, H) / (allpos.max(0) - allpos.min(0)).max()
yaw, pitch = np.radians(35), np.radians(18)
Ry = np.array([[np.cos(yaw), 0, np.sin(yaw)], [0, 1, 0], [-np.sin(yaw), 0, np.cos(yaw)]])
Rx = np.array([[1, 0, 0], [0, np.cos(pitch), -np.sin(pitch)], [0, np.sin(pitch), np.cos(pitch)]])
R = Rx @ Ry
img = np.full((H, W, 3), 0.09)
zbuf = np.full((H, W), -1e9)
light = np.array([0.4, 0.8, 0.5])
light = light / np.linalg.norm(light)
for (pos, tris), rgb in parts:
    v = (pos - c) @ R.T
    sx = (v[:, 0] * scale + W / 2)
    sy = (-v[:, 1] * scale + H / 2)
    sz = v[:, 2]
    for t in tris:
        x = sx[t]; y = sy[t]; z = sz[t]
        p0, p1, p2 = pos[t[0]], pos[t[1]], pos[t[2]]
        n = np.cross(p1 - p0, p2 - p0)
        ln_ = np.linalg.norm(n)
        if ln_ == 0:
            continue
        n = n / ln_
        sh = 0.28 + 0.72 * max(0.0, abs(float(n @ light)))
        col = np.array(rgb) * sh
        x0, x1 = int(max(0, np.floor(x.min()))), int(min(W - 1, np.ceil(x.max())))
        y0, y1 = int(max(0, np.floor(y.min()))), int(min(H - 1, np.ceil(y.max())))
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
        if abs(d) < 1e-12:
            continue
        w0 = ((y[1] - y[2]) * (xs - x[2]) + (x[2] - x[1]) * (ys - y[2])) / d
        w1 = ((y[2] - y[0]) * (xs - x[2]) + (x[0] - x[2]) * (ys - y[2])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not m.any():
            continue
        zz = w0 * z[0] + w1 * z[1] + w2 * z[2]
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        upd = m & (zz > sub)
        sub[upd] = zz[upd]
        img[y0:y1 + 1, x0:x1 + 1][upd] = col
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(sys.argv[1])
print("wrote", sys.argv[1])
