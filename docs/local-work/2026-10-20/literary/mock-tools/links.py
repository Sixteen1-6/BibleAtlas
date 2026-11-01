"""links.py atlas.bin meta.json bsb.json out.json : link counts per verse for chosen chapters, and top links for chosen verses"""
import json, struct, sys
from array import array
sys.stdout.reconfigure(encoding='utf-8')
buf = open(sys.argv[1], 'rb').read()
meta = json.load(open(sys.argv[2], encoding='utf-8'))
bsb = json.load(open(sys.argv[3], encoding='utf-8'))
assert buf[:4] == b'ATLS'
n = struct.unpack_from('<I', buf, 8)[0]
codes = ['B', 'H', 'I', 'h', 'f', 'i']
S = {}
for i in range(n):
    at = 16 + i * 32
    name = buf[at:at+16].split(b'\0')[0].decode()
    dt, cnt, off = struct.unpack_from('<III', buf, at + 16)
    a = array(codes[dt]); size = a.itemsize
    a.frombytes(buf[off:off + cnt * size])
    S[name] = a
xOff, xDst, xVotes, xSpan = S['x_off'], S['x_dst'], S['x_votes'], S['x_span']
N = len(xOff) - 1
xSrc = array('I', [0]) * len(xDst)
for v in range(N):
    for e in range(xOff[v], xOff[v+1]): xSrc[e] = v
inn = [[] for _ in range(N)]
for e in range(len(xDst)): inn[xDst[e]].append(e)
books = meta['books']
# verse index helpers
starts = []
idx = 0
for b in books:
    cs = []
    for c in b['chapters']:
        cs.append(idx); idx += c
    starts.append(cs)
osis = [b['osis'] for b in books]
def vi(o, c, v): return starts[osis.index(o)][c-1] + v - 1
def lab(v):
    for bi, cs in enumerate(starts):
        for ci, s in enumerate(cs):
            if s <= v < s + books[bi]['chapters'][ci]:
                return books[bi], ci + 1, v - s + 1
bmap = {b['name']: b for b in bsb['books']}
NAMES = {'1Sam': 'I Samuel', 'Ps': 'Psalms', 'Gen': 'Genesis', 'Isa': 'Isaiah', 'Num': 'Numbers'}
def text(v):
    b, c, vv = lab(v)
    nm = b['name'] if 'name' in b else b['osis']
    for k in (nm, NAMES.get(b['osis'], nm)):
        if k in bmap: return bmap[k]['chapters'][c-1]['verses'][vv-1]['text']
    # fallback by order
    bi = osis.index(b['osis'])
    return bsb['books'][bi]['chapters'][c-1]['verses'][vv-1]['text']
def links(v):
    by = {}
    for e in range(xOff[v], xOff[v+1]):
        by[xDst[e]] = dict(v=xDst[e], span=xSpan[e], votes=xVotes[e])
    for e in inn[v]:
        u = xSrc[e]
        if u in by: by[u]['votes'] = max(by[u]['votes'], xVotes[e])
        else: by[u] = dict(v=u, span=1, votes=xVotes[e])
    return sorted(by.values(), key=lambda l: (-l['votes'], l['v']))
def count(v):
    s = set()
    for e in range(xOff[v], xOff[v+1]):
        if xVotes[e] > 0: s.add(xDst[e])
    for e in inn[v]:
        if xVotes[e] > 0: s.add(xSrc[e])
    return len(s)
def name(v, span=1):
    b, c, vv = lab(v)
    nm = b.get('name', b['osis'])
    if span <= 1: return f"{nm} {c}:{vv}"
    b2, c2, v2 = lab(v + span - 1)
    if c2 != c: return f"{nm} {c}:{vv}\u2013{c2}:{v2}"
    return f"{nm} {c}:{vv}\u2013{v2}"
out = {'counts': {}, 'top': {}, 'index': {}, 'total': len(xDst), 'N': N}
chapters = [('Ps', 1), ('Ps', 19), ('Isa', 6), ('Gen', 6), ('1Sam', 1), ('1Sam', 2), ('1Sam', 15)]
for o, c in chapters:
    nv = books[osis.index(o)]['chapters'][c-1]
    for v in range(1, nv+1):
        out['counts'][f"{o}.{c}.{v}"] = count(vi(o, c, v))
for o, c, v in [('Ps',1,6),('Ps',1,1),('Ps',19,1),('Ps',19,2),('Isa',6,10),('Gen',6,6),('1Sam',1,2),('1Sam',15,29)]:
    i = vi(o, c, v)
    ls = [l for l in links(i) if l['votes'] > 0][:5]
    out['top'][f"{o}.{c}.{v}"] = [dict(ref=name(l['v'], l['span']), votes=l['votes'], text=text(l['v'])) for l in ls]
    out['index'][f"{o}.{c}.{v}"] = i
for o, c, v in [('1Sam',15,11),('1Sam',15,35),('Num',23,19),('1Sam',2,5),('Isa',6,9),('Gen',6,7)]:
    out['index'][f"{o}.{c}.{v}"] = vi(o, c, v)
json.dump(out, open(sys.argv[4], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('edges', len(xDst), 'verses', N)
for k, v in out['top'].items():
    print(k, out['counts'][k], [ (x['ref'], x['votes']) for x in v])
