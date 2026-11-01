"""Render the arc field the way web/src/gl/arcs.ts does (spectrum colours, votes >= 8,
additive light, hue-preserving tone map over the night-sky gradient) into one image.
Arc heights scale with the image, so stretching it to any band size keeps the shape."""
import struct, sys, os, math
import numpy as np
from PIL import Image
BA = sys.argv[1]
W, H = int(sys.argv[2]), int(sys.argv[3])
EXPO = float(sys.argv[4]) if len(sys.argv) > 4 else 1.15
INT = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
b = open(os.path.join(BA, 'scratch', 'live', 'atlas.bin'), 'rb').read()
n = struct.unpack_from('<I', b, 8)[0]
DT = {0: 'B', 1: 'H', 2: 'I', 3: 'h', 4: 'f', 5: 'i'}
NP = {0: np.uint8, 1: np.uint16, 2: np.uint32, 3: np.int16, 4: np.float32, 5: np.int32}
S = {}
for i in range(n):
    o = 16 + 32 * i
    name = b[o:o + 16].rstrip(b'\0').decode()
    dt, cnt, off, _ = struct.unpack_from('<IIII', b, o + 16)
    S[name] = np.frombuffer(b, dtype=NP[dt], count=cnt, offset=off)
N = len(S['v_book'])
xoff = S['x_off'].astype(np.int64)
src = np.repeat(np.arange(N), np.diff(xoff))
dst = S['x_dst'].astype(np.int64)
votes = S['x_votes'].astype(np.float64)
keep = votes >= 8
src, dst, votes = src[keep], dst[keep], votes[keep]
total = N + 40 * 65
xs = (np.arange(N) + 0.5 + 40 * S['v_book'].astype(np.float64)) / total
SPEC = ['#ff5f6d', '#ff9a4a', '#ffd34e', '#8be36f', '#2fd6c5', '#4b9bff', '#8c6dff', '#e86bff']
spec = np.array([[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] for h in SPEC])
def spectrum(x):
    f = np.clip(x, 0, 1) * (len(SPEC) - 1)
    i = np.minimum(np.floor(f), len(SPEC) - 2).astype(int)
    t = (f - i)[:, None]
    return spec[i] * (1 - t) + spec[i + 1] * t
x0 = xs[src] * W; x1 = xs[dst] * W
col = spectrum(np.minimum(xs[src], xs[dst]))
w = np.clip(np.log(np.maximum(votes, 1)) / math.log(150), 0, 1)
a = (0.25 + 0.75 * w) * 0.03 * math.sqrt(8 / 4) * INT
base = H * 0.8
hmax = base * 0.95
r = np.abs(x1 - x0) / 2
h = hmax * np.power(np.minimum(1, r / (W / 2)), 0.6)
L = np.abs(x1 - x0) + 2 * h
ns = np.clip((L * 1.4).astype(int), 6, None)
acc = np.zeros((3, H * W), np.float64)
order = np.arange(len(src))
CH = 1500
for s in range(0, len(order), CH):
    idx = order[s:s + CH]
    cnt = ns[idx]
    rep = np.repeat(np.arange(len(idx)), cnt)
    starts = np.cumsum(cnt) - cnt
    t = (np.arange(cnt.sum()) - np.repeat(starts, cnt) + 0.5) / np.repeat(cnt, cnt)
    e = idx[rep]
    px = x0[e] + (x1[e] - x0[e]) * t
    py = base - h[e] * np.sin(np.pi * t)
    # deposit per sample = alpha * (arc length per sample)
    dep = a[e] * (L[e] / ns[e])
    fx = np.floor(px - 0.5); fy = np.floor(py - 0.5)
    tx = px - 0.5 - fx; ty = py - 0.5 - fy
    for dx, dy, wt in ((0, 0, (1 - tx) * (1 - ty)), (1, 0, tx * (1 - ty)), (0, 1, (1 - tx) * ty), (1, 1, tx * ty)):
        X = (fx + dx).astype(np.int64); Y = (fy + dy).astype(np.int64)
        ok = (X >= 0) & (X < W) & (Y >= 0) & (Y < H)
        flat = Y[ok] * W + X[ok]
        ww = (dep * wt)[ok]
        for c in range(3):
            acc[c] += np.bincount(flat, weights=ww * col[e[ok], c], minlength=H * W)
A = acc.reshape(3, H, W).transpose(1, 2, 0) * EXPO
peak = A.max(axis=2, keepdims=True)
with np.errstate(invalid='ignore', divide='ignore'):
    C = np.where(peak > 0, A / np.maximum(peak, 1e-9) * (1 - np.exp(-peak)), 0)
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
C = C + (1 - C) * (smooth(2.5, 9.0, peak) * 0.35)
def hx(s): return np.array([int(s[i:i + 2], 16) / 255 for i in (1, 3, 5)])
top, hor, glow = hx('#04060e'), hx('#0e1430'), hx('#2a2350')
yy = (np.arange(H)[::-1] + 0.5) / H  # uv.y, 0 at bottom
uBase = 0.2
above = np.clip((yy - uBase) / (1 - uBase), 0, 1)
sky = hor[None, :] * (1 - (above ** 0.7))[:, None] + top[None, :] * (above ** 0.7)[:, None]
sky = sky + glow[None, :] * (np.exp(-np.abs(yy - uBase) * 18) * 0.35)[:, None]
sky = np.repeat(sky[:, None, :], W, axis=1)
rng = np.random.default_rng(7)
# a few fixed stars toward the zenith, as the tone shader draws them
cell = 9 * 2
for cy in range(0, H, cell):
    for cx in range(0, W, cell):
        uvy = 1 - (cy + cell / 2) / H
        ab = np.clip((uvy - uBase) / (1 - uBase), 0, 1)
        if rng.random() < 0.2 * smooth(0.06, 0.9, ab):
            sx = int(cx + (0.2 + 0.6 * rng.random()) * cell); sy = int(cy + (0.2 + 0.6 * rng.random()) * cell)
            if 0 <= sx < W and 0 <= sy < H:
                sky[sy, sx] += np.array([0.86, 0.9, 1.0]) * 0.03 * (0.65 + 0.35 * rng.random() ** 3) * 3
DIM = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
out = sky + C * DIM * (1 - sky)
uvx = (np.arange(W) + 0.5) / W
qx = (uvx - 0.5)[None, :]; qy = ((yy - 0.56) * 0.9)[:, None]
out *= (1 - 0.3 * smooth(0.38, 0.9, np.sqrt(qx ** 2 + qy ** 2)))[:, :, None]
img = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))
p = os.path.join(BA, 'literary', 'mock-src', 'map.webp')
img.save(p, 'WEBP', quality=82, method=6)
img.save(os.path.join(BA, 'literary', 'mock-src', 'map-preview.png'))
print('arcs', len(src), 'samples', int(ns.sum()), 'bytes', os.path.getsize(p))
