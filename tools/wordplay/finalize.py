#!/usr/bin/env python3
"""finalize.py <out dir>: last fixes before hand-off, in place, following the Layers thread's lessons from part 1.

1. Every quote row gets "note", the index of the layer it backs, so two notes citing the same
   source and verse keep a quote each.
2. A cite's "on" is the commentator's own heading for the remark that holds the quote:
   Keil and Delitzsch, Barnes and Clarke head remarks inside a section with a link-only paragraph
   ("Deu 28:62", "Gen 7:21-23"); the Companion Bible labels each note ("30:3") even when several
   verse anchors are stacked before it. When the heading is a range holding the passage verse,
   "on" is the passage verse.
3. Every local quote must sit, with all its "..." parts in order, inside one section (cq.check);
   failures are listed, not fixed.
"""
import html, json, os, re, sqlite3, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq
from fosfig import fos_heading

out = sys.argv[1]
WORK = {'gill': 'gill', 'clarke': 'clarke', 'barnes': 'barnes', 'jfb': 'jfb', 'keil-delitzsch': 'kad',
        'henry-concise': 'mhcc', 'wesley': 'wesley', 'bullinger-cb': 'cb', 'bullinger-fos': 'fos'}
FOS_T = 'E. W. Bullinger, Figures of Speech Used in the Bible (1898)'
HEAD = re.compile(r'<p>\s*<a href="[^"]*">([^<]+)</a>\s*</p>')
LABEL = re.compile(r'^([A-Za-z0-9]{3}) (\d+):(\d+)(?:-(\d+))?$')
ANCHOR = re.compile(r'<a name="an_\d+">([a-z0-9]+) (\d+):(\d+)</a>')


def parts(q):
    return [cq.norm(p) for p in re.split(r'\s*(?:\.\.\.|…)\s*', q) if p.strip()]


def inside(text, ps):
    t, at = cq.norm(text), 0
    for p in ps:
        i = t.find(p, at)
        if i < 0:
            return False
        at = i + len(p)
    return True


def vault_heading(work, ref, quote):
    """(chapter, first verse, last verse) of the link-only heading over the quote, or None."""
    b, c, v = cq.parse(ref)
    path = f'{cq.VAULT}/{work}/{cq.ST[b]}{c:03d}.md'
    try:
        s = open(path, encoding='utf-8', errors='replace').read()
    except FileNotFoundError:
        return None
    marks = [(m.start(), int(m.group(2)), int(m.group(3))) for m in ANCHOR.finditer(s)]
    pick = None
    for k, (pos, mc, mv) in enumerate(marks):
        if (mc, mv) <= (c, v):
            pick = k
    if pick is None:
        return None
    sec = s[marks[pick][0]: marks[pick + 1][0] if pick + 1 < len(marks) else len(s)]
    ps = parts(quote)
    heads = list(HEAD.finditer(sec))
    for k, h in enumerate(heads):
        seg = sec[h.end(): heads[k + 1].start() if k + 1 < len(heads) else len(sec)]
        if inside(cq.clean(seg), ps):
            m = LABEL.match(h.group(1).strip())
            if not m or m.group(1).lower() != cq.ST[b]:
                return None
            v1 = int(m.group(3))
            return int(m.group(2)), v1, int(m.group(4) or v1)
    return None


_cbl = None


def cb_label(ref, quote):
    """(chapter, verse) of the Companion Bible note that holds the quote, by the note's own label."""
    global _cbl
    if _cbl is None:
        con = sqlite3.connect(f'{cq.ROOT}/src/cb/cCBNotes.commentary')
        _cbl = {}
        for bk, ch, h in con.execute('select Book, Chapter, Scripture from Commentary'):
            bits = re.split(r'<ref onclick="bcv\((\d+),(\d+),(\d+)\)">', h)
            for i in range(1, len(bits), 4):
                _cbl.setdefault((int(bits[i]) - 1, int(bits[i + 1])), []).append((int(bits[i + 2]), cq.clean(bits[i + 3])))
    b, c, v = cq.parse(ref)
    ps = parts(quote)
    hits = [lv for lv, t in _cbl.get((b, c), []) if inside(t, ps)]
    if not hits:
        return None
    return c, min(hits, key=lambda lv: abs(lv - v))


def load(name, default):
    try:
        return json.load(open(f'{out}/{name}'))
    except FileNotFoundError:
        return default


new = load('new-passages.json', {'passages': []})
held = load('held-back.json', {'passages': []})
adds = load('additions.json', [])
cadds = load('cite-additions.json', [])
quotes = json.load(open(f'{out}/quotes.json'))

# 1. which note each quote row backs
pool = {}
for x in quotes:
    pool.setdefault((x['where'], x['kind'], x['source'], x['on']), []).append(x)
rows, missing = [], []


def claim(ref, li, l, c):
    k = (ref, l['kind'], c['source'], c['on'])
    if pool.get(k):
        x = dict(pool[k].pop(0))
        x['note'] = li
        rows.append((x, c))
    else:
        missing.append(k)


for p in new['passages'] + held['passages']:
    for li, l in enumerate(p['layers']):
        for c in l['cites']:
            claim(p['ref'], li, l, c)
for a in adds:
    for li, l in enumerate(a['layers']):
        for c in l['cites']:
            claim(a['ref'], f'added {li}', l, c)
for a in cadds:
    for c in a['add_cites']:
        claim(a['ref'], f'added cite on {a["layer_kind"]}', {'kind': a['layer_kind']}, c)

# 2. the commentator's own heading
moved = []
for x, c in rows:
    w = WORK.get(x['source'])
    pb, pc, pv = cq.parse(x['where'])
    b = cq.parse(x['on'])[0]  # the cite may be on another book's verse (an allusion's other verse)
    if b != pb:
        pc = pv = -1
    head = None
    if w in ('kad', 'barnes', 'clarke') and not x.get('read_in', '').endswith('000.md'):
        h = vault_heading(w, x['on'], x['quote'])
        if h:
            ch, v1, v2 = h
            if ch == pc and v1 <= pv <= v2:
                head = (ch, pv)
            else:
                oc, ov = cq.parse(x['on'])[1:]
                head = (ch, ov) if ch == oc and v1 <= ov <= v2 else (ch, v1)
    elif w == 'cb':
        head = cb_label(x['on'], x['quote'])
    if head:
        on = f'{cq.BOOKS[b]} {head[0]}:{head[1]}'
        if on != x['on']:
            moved.append((x['where'], x['source'], x['on'], on))
            x['on'] = on
            c['on'] = on

# de-duplicate cites within a layer after moves
for p in new['passages'] + held['passages']:
    for l in p['layers']:
        seen, keep = set(), []
        for c in l['cites']:
            k = (c['source'], c['on'], c.get('at'))
            if k not in seen:
                seen.add(k)
                keep.append(c)
        l['cites'] = keep

# 3. strict quote check and figure names
fails = []
final, seen = [], set()
for x, c in rows:
    k = (x['where'], x['note'], x['source'], x['on'])
    if k in seen:
        continue
    seen.add(k)
    w = WORK.get(x['source'])
    if w and not x.get('read_in', '').startswith('https://biblehub.com') and not x.get('read_in', '').endswith('000.md'):
        try:
            ok = cq.check(w, x['on'], x['quote'])
        except SystemExit:
            ok = False
        if not ok:
            fails.append((x['where'], x['note'], x['source'], x['on'], x['quote'][:90]))
    if x['source'] == 'bullinger-fos':
        h = fos_heading(x['on'], x['quote'])
        x['at'] = c['at'] = f'{FOS_T}, {h}' if h else FOS_T
    final.append(x)

json.dump(new, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump(held, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(adds, open(f'{out}/additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(cadds, open(f'{out}/cite-additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(final, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'moved': moved, 'fails': fails, 'missing': missing}, open(f'{out}/finalize-report.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(final)} quote rows; {len(moved)} cites moved to the heading verse; {len(fails)} quotes fail the one-section check; {len(missing)} cites with no quote row')
