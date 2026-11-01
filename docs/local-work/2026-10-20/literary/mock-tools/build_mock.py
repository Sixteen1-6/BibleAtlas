"""Check the device content word for word, resolve Hebrew rows and word chips, and write mock-card.html.

python -I build_mock.py <literary dir>

Checks (the build stops on any failure):
- every BSB string ("t" with a "ref") is in the pinned BSB.json verse, after only curly-quote folding;
- every mark is inside its string;
- every writer quotation is in that writer's own text (the research copies used for the catalogue,
  the pinned Let's Church Wesley and Henry's Concise, and Benson's Bible Hub page fetched today).
"""
import json, os, re, sys, html as H
sys.stdout.reconfigure(encoding='utf-8')
L = sys.argv[1]
T = os.path.join(L, 'mock-tools')
RAW = os.path.join(L, '..', 'wt', 'build', 'data', 'raw-lf')
dev = json.load(open(os.path.join(T, 'devices.src.json'), encoding='utf-8'))
data = json.load(open(os.path.join(T, 'mock-data.json'), encoding='utf-8'))
bsb = json.load(open(os.path.join(RAW, 'bible_databases@e1b254cef8', 'formats', 'json', 'BSB.json'), encoding='utf-8'))
lem = json.load(open(os.path.join(L, 'mock-dl', 'lemmas.json'), encoding='utf-8'))
osis = [b['osis'] for b in data['books']]
fails = []

def fold(s):
    return s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('ʼ', "'")

def verse(ref):
    o, c, v = ref.split('.')
    t = bsb['books'][osis.index(o)]['chapters'][int(c) - 1]['verses'][int(v) - 1]
    assert t['verse'] == int(v)
    return t['text']

n_bsb = 0
def check_t(obj, where):
    global n_bsb
    if not isinstance(obj, dict):
        return
    if 't' in obj and 'ref' in obj:
        if fold(obj['t']) not in fold(verse(obj['ref'])):
            fails.append(f'BSB: {where}: "{obj["t"]}" not in {obj["ref"]}')
        n_bsb += 1
        for m in obj.get('marks', []) or []:
            if m[0] not in obj['t']:
                fails.append(f'mark: {where}: "{m[0]}" not in "{obj["t"]}"')

def walk(o, where):
    if isinstance(o, dict):
        check_t(o, where)
        for k, v in o.items():
            walk(v, f'{where}.{k}')
    elif isinstance(o, list):
        for i, v in enumerate(o):
            walk(v, f'{where}[{i}]')

walk(dev, 'dev')

# ---------- writers' own texts
def norm(s):
    s = fold(s)
    s = re.sub(r'[^A-Za-z0-9]+', ' ', s).lower()
    return ' ' + re.sub(r'\s+', ' ', s).strip() + ' '

cache = {}
for line in open(os.path.join(L, 'tools', 'comm-cache.jsonl'), encoding='utf-8'):
    w, b, c, v, t = json.loads(line)
    cache.setdefault((w, b, c), {})[v] = cache.get((w, b, c), {}).get(v, '') + ' ' + t
fos = norm(open(os.path.join(L, 'cat2', 'fos-plain.txt'), encoding='utf-8').read())
LETS = os.path.join(RAW, 'lets.church@71f6f0fc8f', 'packages', 'lets.bible', 'seed', 'commentaries')
def lets_text(f):
    d = json.load(open(os.path.join(LETS, f), encoding='utf-8'))
    rows = d if isinstance(d, list) else next(v for v in d.values() if isinstance(v, list))
    return norm(' '.join(r.get('body', '') for r in rows if isinstance(r, dict)))
lets = {f: lets_text(f) for f in ('wesley.json', 'mhcc.json')}
def page(f):
    t = open(os.path.join(L, 'mock-dl', f), encoding='utf-8', errors='replace').read()
    return norm(H.unescape(re.sub(r'<[^>]+>', ' ', t)))
files = {}

n_q = 0
def check_quote(q, v, where):
    global n_q
    parts = [p for p in (x.strip() for x in q.split('...')) if len(p.split()) >= 2]
    if v[0] == 'cache':
        _, w, b, c, a, z = v
        hay = norm(' '.join(t for vv, t in cache.get((w, b, c), {}).items() if a <= vv <= z))
    elif v[0] == 'fos':
        hay = fos
    elif v[0] == 'lets':
        hay = lets[v[1]]
    elif v[0] == 'file':
        hay = files.setdefault(v[1], page(v[1]))
    else:
        raise SystemExit(f'unknown check {v}')
    for p in parts:
        if norm(p) not in hay:
            fails.append(f'quote: {where}: "{p}" not found in {v}')
    n_q += 1

def walk_q(o, where):
    if isinstance(o, dict):
        if 'quote' in o and 'v' in o:
            check_quote(o['quote'], o['v'], where)
        if 'text' in o and 'v' in o and 'w' in o:
            check_quote(o['text'], o['v'], where)
        if 'limitV' in o:
            v = o['limitV']
            check_quote(v[6], v[:6], where + '.limit')
            if v[6] not in o['limit']:
                fails.append(f'limit text {where} does not carry the checked quote')
        for k, x in o.items():
            walk_q(x, f'{where}.{k}')
    elif isinstance(o, list):
        for i, x in enumerate(o):
            walk_q(x, f'{where}[{i}]')

walk_q(dev, 'dev')

# ---------- credits: each device defined in the words of the book that defines it, with its page
# (founder, 2026-10-20: credit the original sources, never AI). Every quotation is checked twice:
# word for word in the Figures of Speech e-text, and on its printed page of the 1898 Princeton scan
# (archive.org figuresofspeechu00bull: hOCR search text, page index and page-number map, fetched today).
import gzip
cred = json.load(open(os.path.join(T, 'credits.src.json'), encoding='utf-8'))
IA = os.path.join(L, 'mock-dl', 'ia')
pidx = json.load(gzip.open(os.path.join(IA, 'pageindex.json.gz')))
stxt = gzip.open(os.path.join(IA, 'searchtext.txt.gz')).read().decode('utf-8')
leafpage = {x['leafNum']: x['pageNumber'] for x in json.load(open(os.path.join(IA, 'pn.json')))['pages']}
scan = {}
for i, (a, b, *_) in enumerate(pidx):
    if leafpage.get(i):
        scan[int(leafpage[i])] = norm(stxt[a:b])
def on_page(q, p):
    """Share of the quotation's three-word runs found on printed page p (the scan's OCR has noise)."""
    w = norm(q).split()
    runs = [' ' + ' '.join(w[k:k + 3]) + ' ' for k in range(max(1, len(w) - 2))]
    return sum(r in scan.get(p, '') for r in runs) / len(runs)
n_def = 0
for e in dev['entries']:
    d = cred['defs'].get(e['id'])
    if d is None:
        fails.append(f'credits: {e["id"]} has no definition line')
        continue
    if 'q' in d:
        if norm(d['q']) not in fos:
            fails.append(f'definition: {e["id"]}: not word for word in the e-text: "{d["q"]}"')
        r = on_page(d['q'], d['p'])
        if r < 0.6:
            fails.append(f'definition: {e["id"]}: only {r:.0%} found on scan p. {d["p"]}')
        print(f'definition {e["id"]}: scan p. {d["p"]}, {r:.0%} of runs on the page')
        n_def += 1
    e['def'] = d
    pg = cred['pages'].get(e['id'])
    bul = [s for s in e['sources'] if s['w'] == 'bullinger-fos']
    if bul and not pg:
        fails.append(f'credits: {e["id"]} cites Bullinger without a page')
    if pg:
        r = on_page(pg['check'], pg['p'])
        if r < 0.6:
            fails.append(f'page: {e["id"]}: only {r:.0%} of "{pg["check"]}" on scan p. {pg["p"]}')
        print(f'page {e["id"]}: scan p. {pg["p"]}, {r:.0%} of runs on the page')
        for s in bul:
            s['page'] = pg['p']
            if pg.get('note'):
                s['pnote'] = pg['note']
dev['book'] = cred['book']
print(f'definitions checked: {n_def}')

# ---------- strength = count of distinct writers
SW = {'widely agreed': 3, 'commonly held': 2, 'some interpreters': 1}
for e in dev['entries']:
    n = len({s['w'] for s in e['sources']})
    want = 3 if n >= 3 else n
    if SW[e['strength']] != want:
        fails.append(f'strength: {e["id"]} says {e["strength"]} with {n} writers')
    e['writers'] = n

# ---------- Hebrew rows and word chips from the live text shards
shards = {}
def shard(o):
    if o not in shards:
        shards[o] = json.load(open(os.path.join(L, 'mock-dl', f'{o}.json'), encoding='utf-8'))
    return shards[o]
def heb(spec):
    ref, a, z, ties = spec
    o, c, v = ref.split('.')
    row = shard(o)['chapters'][int(c) - 1][int(v) - 1]
    return [[row[1][i][0], ties.get(str(i), -1), row[1][i][1], row[1][i][2]] for i in range(a, z + 1)]
def resolve(o):
    if isinstance(o, dict):
        if 'heb' in o and isinstance(o['heb'], list):
            o['he'] = heb(o['heb'])
            del o['heb']
        if 'roots' in o:
            o['chips'] = [[lem['word'][r], lem['translit'][r] or lem['gloss'][r], lem['gloss'][r], r] for r in o['roots']]
        for x in o.values():
            resolve(x)
    elif isinstance(o, list):
        for x in o:
            resolve(x)
resolve(dev)

# Hebrew checks that the notes rely on
def word_roots(ref):
    o, c, v = ref.split('.')
    return [w[3] for w in shard(o)['chapters'][int(c) - 1][int(v) - 1][1]]
r = word_roots('Ps.1.6')
if r.count(7988) != 2: fails.append('Psalm 1:6: derekh not in both lines')
r = word_roots('Isa.6.10')
if r.count(13350) != 2 or r.count(5852) != 2 or 10666 not in r or 10672 not in r: fails.append('Isaiah 6:10 mirror roots')
r = word_roots('1Sam.1.2')
if [i for i, x in enumerate(r) if x in (8932, 14117)] != [5, 8, 10, 12] or [r[i] for i in (5, 8, 10, 12)] != [8932, 14117, 14117, 8932]: fails.append('1 Samuel 1:2 crossing')
for ref, k in (('Gen.6.6', 1), ('Gen.6.7', 1), ('Num.23.19', 1), ('1Sam.15.11', 1), ('1Sam.15.29', 2), ('1Sam.15.35', 1)):
    if word_roots(ref).count(12319) != k: fails.append(f'nacham count {ref}')
r4, r11 = word_roots('Ps.19.4'), word_roots('Ps.19.11')
if r4[-1] != 16971 or r11[3] != 16971: fails.append('bahem in Psalm 19:4 and 19:11')
r = word_roots('Ps.19.2')
if r[0] != r[1] or r[4] != r[5]: fails.append('Psalm 19:2 doubled words')
pen = [(ci + 1, v['verse']) for ci, ch in enumerate(bsb['books'][8]['chapters']) for v in ch['verses'] if 'Peninnah' in v['text']]
riv = [(ci + 1, v['verse']) for ci, ch in enumerate(bsb['books'][8]['chapters']) for v in ch['verses'] if re.search(r'\brival\b', v['text'])]
if pen != [(1, 2), (1, 4)] or riv != [(1, 6), (1, 7)]: fails.append(f'Peninnah mentions {pen} {riv}')

# ---------- the live Layers passages inside the mockup's chapters, word for word
inch = set()
for ch in data['chapters'].values():
    inch.update(ch['verses'])
live = json.load(open(os.path.join(L, 'mock-dl', 'layers-live.json'), encoding='utf-8'))
dev['layers'] = [p for p in live if p['v'] in inch]
# Founder, 2026-10-20: credit the original sources, never AI. The live source line opens
# "Drafted with AI help (Claude) from"; the mockup shows the proposed wording, sources only.
for p in dev['layers']:
    src = re.sub(r'^Drafted with AI help \(Claude\) from ', 'Drawn from ', p['source'])
    if src == p['source']:
        fails.append(f'layers source line not rewritten: {p["id"]}: {p["source"]}')
    p['source'] = src
roots = {w[2] for p in dev['layers'] for l in p['layers'] for w in l.get('words', [])}
dev['lem'] = {str(r): [lem['word'][r], lem['translit'][r], lem['gloss'][r], lem['lang'][r]] for r in sorted(roots)}
print('layers passages:', [p['id'] for p in dev['layers']])

print(f'BSB strings checked: {n_bsb}; writer quotations checked: {n_q}')
if fails:
    print('FAILED:')
    for f in fails:
        print('  ' + f)
    raise SystemExit(1)

blob = json.dumps({'data': data, 'dev': dev}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
tpl = open(os.path.join(T, 'mock-card.template.html'), encoding='utf-8').read()
assert tpl.count('/*__BLOB__*/') == 1
out = tpl.replace('/*__BLOB__*/', blob)
for bad in ('AI help', 'Claude', 'reviewed by a person'):
    if bad in out:
        raise SystemExit(f'FAILED: the page still contains {bad!r} at {out.index(bad)}')
# No em dashes in the mockup's own words (Scripture and quoted writers keep their punctuation).
own = json.dumps({k: v for k, v in cred.items()}, ensure_ascii=False) + tpl
if '—' in own:
    raise SystemExit(f'FAILED: an em dash in the mockup\'s own words at {own.index(chr(0x2014))}')
dst = os.path.join(L, 'mock-card.html')
open(dst, 'w', encoding='utf-8', newline='\n').write(out)
print('wrote', dst, os.path.getsize(dst), 'bytes')
