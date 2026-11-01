"""Group the evidence into pairs: the BSB footnote links first, then pairs only writers make."""
import json, re, sys, collections
sys.path.insert(0, '/tmp/mine/scripts')
from bible import ref, TEXT, D, is_nt, IDX

FATHERS_OUT = {'Origen', 'Didymus', 'Clement of Alexandria', 'Pseudo-Chrysostom', 'Pseudo-Jerome', 'Pseudo-Augustine',
               'Pseudo-Athanasius', 'Gloss', 'Greek Expositor', 'Josephus', 'Eusebius', 'The Council of Ephesus',
               'Second Council of Constantinople', 'Petrus Alfonsus', ''}


def writer(e):
    if e['work'] in ('mhc', 'mhcc'):
        return 'Matthew Henry'
    if e['work'] == 'catena':
        return None if e['who'] in FATHERS_OUT else e['who']
    return {'wesley': 'John Wesley', 'calvin': 'John Calvin', 'geneva': 'Geneva notes'}[e['work']]


def overlap(a, b):
    return a[0] <= b[1] and b[0] <= a[1]


q = json.load(open(f'{D}/extras/quotes.json'))['links']
qn = json.load(open(f'{D}/extras/quotes/notes.json'))['notes']
anchors = []
for (a, b, c, d, k), x in zip(q, qn):
    anchors.append(dict(nt=(a, b), ot=(c, d), echo=bool(k), formula=x.get('f', ''), ev=[]))

ev = json.load(open('/tmp/mine/evidence.json'))
loose = []
for e in ev:
    e['writer'] = writer(e)
    if not e['writer']:
        continue
    hit = False
    for an in anchors:
        if overlap(an['nt'], e['nt']) and overlap(an['ot'], e['ot']):
            an['ev'].append(e); hit = True
    if not hit:
        loose.append(e)

# Cross-references, to place a section note on its verse.
from books import book_of
from bible import START
XR = collections.defaultdict(dict)
def pv(t):
    m = re.match(r'^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$', t)
    if not m: return None
    b = book_of(m.group(1))
    return None if b is None else START.get((b, int(m.group(2)), int(m.group(3))))
for line in open('/home/claude/bibleatlas/data/raw/bible_databases@e1b254cef8/sources/extras/cross_references.txt'):
    f = line.rstrip('\n').split('\t')
    if len(f) < 3 or not f[2].lstrip('-').isdigit(): continue
    a = pv(f[0]); parts = f[1].split('-'); b0 = pv(parts[0]); b1 = pv(parts[-1]) if len(parts) > 1 else b0
    if a is None or b0 is None or b1 is None: continue
    for b in range(b0, min(b1, b0 + 10) + 1):
        XR[a][b] = max(XR[a].get(b, -999), int(f[2])); XR[b][a] = max(XR[b].get(a, -999), int(f[2]))
def place(section, precise):
    best = None
    for v in range(section[0], section[1] + 1):
        for u in range(precise[0], precise[1] + 1):
            w = XR[v].get(u)
            if w is not None and w > 0 and (best is None or w > best[0]):
                best = (w, v)
    return None if best is None else (best[1], best[1])
placed = 0
# Pairs only writers make: the note's own side must be precise.
groups = {}
dropped = 0
for e in loose:
    side = e['nt'] if e['side'] == 'nt' else e['ot']
    if side[1] - side[0] > 2:
        other = e['ot'] if e['side'] == 'nt' else e['nt']
        v = place(side, other)
        if v is None:
            dropped += 1
            continue
        placed += 1
        if e['side'] == 'nt': e['nt'] = v
        else: e['ot'] = v
    key = None
    for k in groups:
        if overlap(k[0], e['ot']) and overlap(k[1], e['nt']):
            key = k; break
    if key is None:
        key = (tuple(e['ot']), tuple(e['nt'])); groups[key] = []
    groups[key].append(e)

out = []
for an in anchors:
    ws = sorted({e['writer'] for e in an['ev']})
    out.append(dict(ot=an['ot'], nt=an['nt'], anchor=True, echo=an['echo'], formula=an['formula'], writers=ws,
                    ev=an['ev']))
for (o, n), es in groups.items():
    ws = sorted({e['writer'] for e in es})
    out.append(dict(ot=o, nt=n, anchor=False, echo=None, formula='', writers=ws, ev=es))
json.dump(out, open('/tmp/mine/pairs.json', 'w'))
print('anchors', len(anchors), 'with writers', sum(1 for p in out if p['anchor'] and p['writers']))
print('writer-only pairs', len(groups), 'dropped imprecise', dropped, 'placed by xref', placed)
print(collections.Counter(len(p['writers']) for p in out if not p['anchor']))
print(collections.Counter(len(p['writers']) for p in out if p['anchor']))
