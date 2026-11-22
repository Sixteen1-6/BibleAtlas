#!/usr/bin/env python3
"""Print seen-in-the-words places for reading against the BSB.

Usage: python3 -I wshow.py NN i [j]      places i..j-1 (0-based) of words-NN.jsonl
       python3 -I wshow.py FILE.jsonl i [j]   places i..j-1 of another list of places
       python3 -I wshow.py verse "Psalm 1:1"   one verse, its poetry lines and its words

For each place: the form (label, what it means, Bullinger's definition where the
forms file has it), the reference, the marked words and whether each is in the
verse, the Hebrew or Greek words behind any Strong's tags, the BSB's own poetry
lines, the verse before and after, and the search's own note (which may be wrong).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get('BIBLEATLAS_REPO', os.path.abspath(os.path.join(HERE, '..', '..', '..', '..')))
# The built data (atlas build), the forms, and the catalogue's hand-off files.
D = os.environ.get('SEEN_DATA', f'{REPO}/web/public/data')
WORK = os.environ.get('SEEN_WORK', '/mnt/project-files/bible-atlas/figures/every/work')
meta = json.load(open(f'{D}/meta.json', encoding='utf-8'))
lem = json.load(open(f'{D}/lemmas.json', encoding='utf-8'))
forms = {f['id']: f for f in json.load(open(os.environ.get('SEEN_FORMS', f'{REPO}/config/figure-forms.json'), encoding='utf-8'))['forms']}
books = meta['books']
alias = {}
for b in books:
    for n in (b['name'], b['osis'], b['step']):
        alias[n.lower().replace(' ', '')] = b
alias['psalm'] = alias['psalms']
alias['songofsolomon'] = next(b for b in books if b['osis'] == 'Song')
cache = {}


def text(b):
    if b['osis'] not in cache:
        cache[b['osis']] = json.load(open(f"{D}/text/{b['osis']}.json", encoding='utf-8'))
    return cache[b['osis']]


def parse(ref):
    m = re.match(r'^\s*(.+?)\s+(\d+):(\d+)(?:-(\d+))?\s*$', ref)
    if not m:
        return None
    b = alias.get(m.group(1).lower().replace(' ', ''))
    if not b:
        return None
    c, v1 = int(m.group(2)), int(m.group(3))
    return b, c, v1, int(m.group(4) or v1)


def verse(b, c, v):
    ch = text(b)['chapters'][c - 1]
    return ch[v - 1] if 1 <= v <= len(ch) else None


def lines(b, c, v, t):
    marks = text(b).get('lines', {}).get(f'{c}.{v}')
    if not marks:
        return []
    u = t.encode('utf-16-le')
    offs = [m[0] for m in marks] + [len(u) // 2]
    return [u[offs[k] * 2:offs[k + 1] * 2].decode('utf-16-le').strip() for k in range(len(marks))]


def show_verse(b, c, v, words_too=True, tags=()):
    x = verse(b, c, v)
    if x is None:
        print(f'  {b["name"]} {c}:{v} does not exist')
        return
    t, ws = x[0], x[1]
    print(f'  BSB {b["name"]} {c}:{v}: {t}')
    ls = lines(b, c, v, t)
    if ls:
        print(f'  The BSB sets it as poetry, {len(ls)} lines:')
        for k, l in enumerate(ls):
            print(f'    line {k + 1}: {l}')
    else:
        print('  The BSB sets it as prose (no poetry lines).')
    if words_too:
        for k, w in enumerate(ws):
            key = lem['key'][w[3]]
            hit = ' <== tagged' if any(key == g or (key[:-1] == g and key[-1].isalpha()) or (g[:-1] == key[:5] and key == g) for g in tags) else ''
            print(f'    {k:>2} {w[0]:<16} {w[1]:<18} {key:<8} {lem["word"][w[3]]} "{w[2]}"{hit}')


def place(nn, i, r):
    f = forms.get(r['form'])
    print(f'===== place {i} of words-{nn}: {r["id"]}')
    if f:
        print(f'  form: {r["form"]} ({f["kind"]}): "{f["label"]}", {f["term"]}. {f["about"]}')
        if f.get('defined'):
            print(f'  Bullinger defines it: {f["defined"]["quote"][:400]}')
    else:
        print(f'  form: {r["form"]} (NOT a live form)')
    p = parse(r['ref'])
    print(f'  ref: {r["ref"]}')
    if not p:
        print('  (reference does not parse)')
        return
    b, c, v1, v2 = p
    verses = [verse(b, c, v) for v in range(v1, v2 + 1)]
    for w in r['words']:
        ok = any(x and w in x[0] for x in verses)
        print(f'  marked words: "{w}"' + ('' if ok else '   <== NOT IN THE VERSE'))
    tags = r.get('original') or []
    if tags:
        print(f'  original tags: {", ".join(tags)}' + ('  (the figure shows only in the original)' if r.get('hebrew_or_greek_only') else ''))
    for v in range(v1, v2 + 1):
        show_verse(b, c, v, words_too=bool(tags), tags=tags)
    for v, lab in ((v1 - 1, 'before'), (v2 + 1, 'after')):
        x = verse(b, c, v)
        if x:
            print(f'  verse {lab} ({c}:{v}): {x[0]}')
    m = '; '.join((x.get('match') or '')[:220] for x in r.get('matched', []))
    if m:
        print(f'  the search\'s own note (may be wrong): {m}')
    print()


def main():
    a = sys.argv[1:]
    if a and a[0] == 'verse':
        for ref in a[1:]:
            p = parse(ref)
            if not p:
                print('?', ref)
                continue
            b, c, v1, v2 = p
            for v in range(v1, v2 + 1):
                show_verse(b, c, v)
        return
    if a[0].endswith('.jsonl'):
        nn = os.path.basename(a[0])[:-6]
        rows = [json.loads(l) for l in open(a[0], encoding='utf-8')]
    else:
        nn = a[0].zfill(2)
        rows = [json.loads(l) for l in open(f'{WORK}/words-{nn}.jsonl', encoding='utf-8')]
    i = int(a[1])
    j = int(a[2]) if len(a) > 2 else i + 1
    for k in range(i, min(j, len(rows))):
        place(nn, k, rows[k])


if __name__ == '__main__':
    main()
