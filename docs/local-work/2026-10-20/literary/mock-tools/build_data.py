"""Build mock-data.json for the literary devices card mockup.
python -I build_data.py <mock-dl dir> <BSB.json> <out.json>
Reads only: the live site's atlas.bin, meta.json, lemmas.json, text shards (build 7bd9f13db417)
and the pinned BSB.json (scrollmapper/bible_databases @ e1b254cef8)."""
import json, struct, sys, base64, os, math
from array import array
sys.stdout.reconfigure(encoding='utf-8')
D, BSBP, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
buf = open(os.path.join(D, 'atlas.bin'), 'rb').read()
meta = json.load(open(os.path.join(D, 'meta.json'), encoding='utf-8'))
bsb = json.load(open(BSBP, encoding='utf-8'))
assert buf[:4] == b'ATLS'
codes = ['B', 'H', 'I', 'h', 'f', 'i']
S = {}
for i in range(struct.unpack_from('<I', buf, 8)[0]):
    at = 16 + i * 32
    name = buf[at:at+16].split(b'\0')[0].decode()
    dt, cnt, off = struct.unpack_from('<III', buf, at + 16)
    a = array(codes[dt]); a.frombytes(buf[off:off + cnt * a.itemsize]); S[name] = a
xOff, xDst, xVotes, xSpan, rank = S['x_off'], S['x_dst'], S['x_votes'], S['x_span'], S['v_rank']
N = len(xOff) - 1
xSrc = array('I', bytes(4 * len(xDst)))
for v in range(N):
    for e in range(xOff[v], xOff[v+1]): xSrc[e] = v
inn = [[] for _ in range(N)]
for e in range(len(xDst)): inn[xDst[e]].append(e)
books = meta['books']
osis = [b['osis'] for b in books]
starts = []
idx = 0
for b in books:
    cs = []
    for c in b['chapters']:
        cs.append(idx); idx += c
    starts.append(cs)
assert idx == N
def vi(o, c, v): return starts[osis.index(o)][c-1] + v - 1
def loc(v):
    for bi, cs in enumerate(starts):
        if bi + 1 < len(starts) and starts[bi+1][0] <= v: continue
        for ci in range(len(cs) - 1, -1, -1):
            if cs[ci] <= v: return bi, ci + 1, v - cs[ci] + 1
def cname(bi): return 'Psalm' if osis[bi] == 'Ps' else books[bi]['name']
def name(v, span=1):
    bi, c, vv = loc(v)
    if span <= 1: return f"{cname(bi)} {c}:{vv}"
    b2, c2, v2 = loc(v + span - 1)
    if c2 != c: return f"{cname(bi)} {c}:{vv}\u2013{c2}:{v2}"
    return f"{cname(bi)} {c}:{vv}\u2013{v2}"
assert len(bsb['books']) == 66
def text(v):
    bi, c, vv = loc(v)
    t = bsb['books'][bi]['chapters'][c-1]['verses'][vv-1]
    assert t['verse'] == vv
    return t['text']
def links(v):
    by = {}
    for e in range(xOff[v], xOff[v+1]):
        by[xDst[e]] = [xDst[e], xSpan[e], xVotes[e]]
    for e in inn[v]:
        u = xSrc[e]
        if u in by: by[u][2] = max(by[u][2], xVotes[e])
        else: by[u] = [u, 1, xVotes[e]]
    return sorted(by.values(), key=lambda l: (-l[2], l[0]))
def count(v):
    s = set()
    for e in range(xOff[v], xOff[v+1]):
        if xVotes[e] > 0: s.add(xDst[e])
    for e in inn[v]:
        if xVotes[e] > 0: s.add(xSrc[e])
    return len(s)
# text shards for Hebrew
shards = {}
def shard(o):
    if o not in shards:
        shards[o] = json.load(open(os.path.join(D, f'{o}.json'), encoding='utf-8'))
    return shards[o]
out = {'build': meta['buildId'], 'N': N, 'counts': meta['counts'],
       'books': [{'osis': b['osis'], 'name': b['name'], 'chapters': b['chapters'], 'start': starts[i][0], 'testament': b['testament'], 'genre': b['genre']} for i, b in enumerate(books)],
       'chapters': {}, 'verses': {}}
CH = [('Ps', 1), ('Ps', 19), ('Isa', 6), ('Gen', 6), ('1Sam', 1), ('1Sam', 15)]
# rank position
order = sorted(range(N), key=lambda v: -rank[v])
pos = [0] * N
higher = 0
# hubRank = number of verses with strictly higher rank + 1
sr = sorted(rank, reverse=True)
import bisect
neg = sorted(-r for r in rank)
def hub(v): return bisect.bisect_left(neg, -rank[v]) + 1
for o, c in CH:
    nv = books[osis.index(o)]['chapters'][c-1]
    rows = shard(o)['chapters'][c-1]
    assert len(rows) == nv, (o, c, len(rows), nv)
    vs = []
    for k in range(1, nv + 1):
        v = vi(o, c, k)
        row = rows[k-1]
        assert row[0] == text(v), (o, c, k)
        ls = [l for l in links(v) if l[2] > 0]
        vs.append(v)
        out['verses'][str(v)] = {
            'key': f'{o}.{c}.{k}', 'n': k, 'text': row[0],
            'he': ' '.join(w[0] for w in row[1] if not (w[5] & 2)),
            'count': count(v), 'hub': hub(v),
            'top': [[l[0], l[1], l[2], name(l[0], l[1]), text(l[0])[:180]] for l in ls[:5]],
            'arcs': [[l[0], l[2]] for l in ls],
        }
    out['chapters'][f'{o}.{c}'] = {'title': f"{cname(osis.index(o))} {c}", 'first': vi(o, c, 1), 'verses': vs}
# extra verses for structure views (text only)
EXTRA = [('Gen', 6, 7), ('Num', 23, 19), ('1Sam', 2, 5), ('1Sam', 2, 1), ('Isa', 6, 9)]
out['extra'] = {}
for o, c, k in EXTRA:
    v = vi(o, c, k)
    out['extra'][f'{o}.{c}.{k}'] = {'v': v, 'text': text(v), 'label': name(v)}
out['index'] = {}
for o, c in CH:
    pass
# map field: strongest edges, votes >= 8
pos_edges = [(xVotes[e], xSrc[e], xDst[e]) for e in range(len(xDst)) if xVotes[e] > 0]
at8 = sum(1 for e in pos_edges if e[0] >= 8)
pos_edges.sort(key=lambda t: -t[0])
K = 16000
pick = pos_edges[:K]
packed = bytearray()
for vt, s, d in pick:
    packed += struct.pack('<HHB', s, d, min(vt, 255))
out['field'] = {'k': len(pick), 'minVotes': pick[-1][0], 'b64': base64.b64encode(bytes(packed)).decode()}
out['visibleAt8'] = at8
out['drawable'] = meta['counts'].get('crossReferencesPositive')
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('edges', len(xDst), 'positive', len(pos_edges), 'at8', at8, 'field', len(pick), 'min votes in field', pick[-1][0])
print('bytes', os.path.getsize(OUT))
for k in ('Ps.1.6', 'Ps.19.1', 'Isa.6.10', 'Gen.6.6', '1Sam.1.2', '1Sam.15.29'):
    o, c, vv = k.split('.')
    v = vi(o, int(c), int(vv))
    r = out['verses'][str(v)]
    print(k, v, r['count'], 'hub', r['hub'], [(t[3], t[2]) for t in r['top'][:3]])
