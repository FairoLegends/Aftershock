"""Split TvStand.glb into TvStand_Base.glb (the stand) and TvStand_Tv.glb (the TV: panel, neck, foot).
A component (vertices joined by triangles) goes to the TV when its lowest point is above SPLIT_Y (model space, m).
Both outputs keep the node translation, the materials and the textures, so placed at the same origin they
rebuild the original exactly. Prints the components near the cut so the rule can be checked."""
import json, struct, sys, numpy as np

SRC = r"E:/Project/Aftershock/Aftershock.esproj/Assets/GeneratedMeshes/TvStand.glb"
OUT = r"C:/Users/faiqf/AppData/Local/Temp/aftershock/tvsplit/"
SPLIT_Y = float(sys.argv[1]) if len(sys.argv) > 1 else -0.16
import os
os.makedirs(OUT, exist_ok=True)

d = open(SRC, "rb").read()
ln = struct.unpack("<I", d[12:16])[0]
j = json.loads(d[20:20 + ln])
off = 20 + ln
bl = struct.unpack("<I", d[off:off + 4])[0]
bin_ = d[off + 8: off + 8 + bl]


def acc(i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    comp = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a["componentType"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    isz = np.dtype(comp).itemsize
    stride = bv.get("byteStride") or isz * n
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    raw = np.frombuffer(bin_, dtype=np.uint8, count=a["count"] * stride, offset=start).reshape(a["count"], stride)
    return raw[:, : isz * n].copy().view(comp).reshape(a["count"], n)


pr = j["meshes"][0]["primitives"][0]
attrs = {k: acc(v) for k, v in pr["attributes"].items()}
pos = attrs["POSITION"]
tris = acc(pr["indices"]).reshape(-1, 3).astype(np.int64)

parent = np.arange(len(pos))


def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x


for t in tris:
    a0 = find(t[0])
    for v in t[1:]:
        b = find(v)
        if a0 != b:
            parent[b] = a0
roots = np.array([find(i) for i in range(len(pos))])
comp_min = {}
comp_max = {}
for r in np.unique(roots):
    m = roots == r
    comp_min[r] = pos[m, 1].min()
    comp_max[r] = pos[m, 1].max()
TOP_Y = float(sys.argv[2]) if len(sys.argv) > 2 else -0.15  # a part rising above the stand's top (y -0.167) belongs to the TV (its feet)
tv_comp = {r: (comp_min[r] > SPLIT_Y) or (comp_max[r] > TOP_Y and comp_min[r] > -0.19) for r in comp_min}
is_tv_vert = np.array([tv_comp[r] for r in roots])
near = sorted((comp_min[r], comp_max[r], int((roots == r).sum())) for r in comp_min if -0.25 < comp_min[r] < -0.08)
print("components with lowest point in -0.25..-0.08 (min, max, verts):")
for a, b, n in near:
    print(f"  {a:+.3f} .. {b:+.3f}  {n:4d}  -> {'TV' if (a > SPLIT_Y or (b > TOP_Y and a > -0.19)) else 'stand'}")
tri_tv = is_tv_vert[tris[:, 0]]
assert (is_tv_vert[tris[:, 1]] == tri_tv).all() and (is_tv_vert[tris[:, 2]] == tri_tv).all()


def write(name, keep_tri):
    sel = tris[keep_tri]
    used = np.unique(sel)
    remap = -np.ones(len(pos), dtype=np.int64)
    remap[used] = np.arange(len(used))
    new_idx = remap[sel].astype(np.uint32).reshape(-1)
    blobs = []
    views = []
    accs = []
    cur = 0

    def add(arr, target, kind, comp, count, mn=None, mx=None):
        nonlocal cur
        b = arr.tobytes()
        pad = (-len(b)) % 4
        views.append({"buffer": 0, "byteOffset": cur, "byteLength": len(b), **({"target": target} if target else {})})
        blobs.append(b + b"\0" * pad)
        cur += len(b) + pad
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": count, "type": kind}
        if mn is not None:
            a["min"], a["max"] = mn, mx
        accs.append(a)
        return len(accs) - 1

    new_attrs = {}
    for k, v in attrs.items():
        sub = np.ascontiguousarray(v[used].astype(np.float32))
        kind = {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4"}[sub.shape[1]]
        mn = sub.min(0).tolist() if k == "POSITION" else None
        mx = sub.max(0).tolist() if k == "POSITION" else None
        new_attrs[k] = add(sub, 34962, kind, 5126, len(sub), mn, mx)
    ia = add(np.ascontiguousarray(new_idx), 34963, "SCALAR", 5125, len(new_idx))
    # images: copy their bufferViews
    new_images = []
    for im in j.get("images", []):
        im2 = dict(im)
        if "bufferView" in im:
            bv = j["bufferViews"][im["bufferView"]]
            data = bin_[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
            pad = (-len(data)) % 4
            views.append({"buffer": 0, "byteOffset": cur, "byteLength": len(data)})
            blobs.append(data + b"\0" * pad)
            cur += len(data) + pad
            im2["bufferView"] = len(views) - 1
        new_images.append(im2)
    g = {k: v for k, v in j.items() if k not in ("accessors", "bufferViews", "buffers", "meshes", "images")}
    prim = {k: v for k, v in pr.items() if k not in ("attributes", "indices")}
    prim["attributes"] = new_attrs
    prim["indices"] = ia
    g["meshes"] = [{"name": name, "primitives": [prim]}]
    g["nodes"] = [dict(j["nodes"][0], name=name)]
    g["accessors"] = accs
    g["bufferViews"] = views
    g["images"] = new_images
    binb = b"".join(blobs)
    g["buffers"] = [{"byteLength": len(binb)}]
    js = json.dumps(g, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    out = b"glTF" + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(binb))
    out += struct.pack("<I", len(js)) + b"JSON" + js + struct.pack("<I", len(binb)) + b"BIN\0" + binb
    open(OUT + name + ".glb", "wb").write(out)
    p = attrs["POSITION"][used]
    print(f"{name}.glb: {len(used)} verts, {len(sel)} tris, y {p[:,1].min():+.3f}..{p[:,1].max():+.3f} x {p[:,0].min():+.2f}..{p[:,0].max():+.2f} z {p[:,2].min():+.2f}..{p[:,2].max():+.2f}, {len(out)//1024} KB")


write("TvStand_Base", ~tri_tv)
write("TvStand_Tv", tri_tv)
