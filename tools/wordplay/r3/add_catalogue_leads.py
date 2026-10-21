#!/usr/bin/env python3
"""add_catalogue_leads.py: adds the local literary catalogue's contrast rows (docs/local-work/2026-10-20/literary/
catalogue.md section 7, on branch claude/project-thread-f8krzu) as leads to the contrast batches, so the writer
starts from the writers that study already found. A lead is only a hint: every quote is still read and checked."""
import json, re, sys
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
lines = open(f'{W}/r3/cat/catalogue.md').read().split('\n')
a = next(i for i, l in enumerate(lines) if l.startswith('## 7.'))
b = next(i for i, l in enumerate(lines) if i > a and l.startswith('## 8.'))
rows = []
for l in lines[a:b]:
    c = [x.strip() for x in l.split('|')]
    if len(c) >= 7 and c[1].isdigit():
        rows.append({'n': int(c[1]), 'pair': c[2], 'passages': c[3], 'scripture': c[4], 'writers': c[5]})


def P(r):
    m = re.match(r'^(.+?) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?', r.strip())
    if not m:
        return None
    c, v = int(m.group(2)), int(m.group(3))
    c2 = int(m.group(4)) if m.group(4) else c
    v2 = int(m.group(5)) if m.group(5) else (v if not m.group(4) else 999)
    return m.group(1), (c, v), (c2, v2)


BOOKRX = r'(?:[123] )?[A-Z][a-z]+(?: of [A-Z][a-z]+)?'


def refs_of(text):
    """Spans ((book, (c, v), (c2, v2))) for every reference in a catalogue cell, carrying the book forward."""
    out, book = [], None
    for tok in re.split(r';|,| and |\(|\)', text):
        tok = tok.strip().strip('"')
        m = re.match(r'^(' + BOOKRX + r') (\d+)(?::(\d+))?(?:-(?:(\d+):)?(\d+))?$', tok) or re.match(r'^()(\d+)(?::(\d+))?(?:-(?:(\d+):)?(\d+))?$', tok)
        if not m:
            m2 = re.search(r'(' + BOOKRX + r') (\d+):(\d+)(?:-(\d+))?', tok)
            if m2:
                book = m2.group(1)
                v = int(m2.group(3))
                out.append((book, (int(m2.group(2)), v), (int(m2.group(2)), int(m2.group(4) or v))))
            continue
        if m.group(1):
            book = m.group(1)
        if not book:
            continue
        c = int(m.group(2))
        if m.group(3) is None:
            out.append((book, (c, 1), (int(m.group(5)) if m.group(5) and not m.group(4) else c, 999)))
            continue
        v = int(m.group(3))
        c2 = int(m.group(4)) if m.group(4) else c
        v2 = int(m.group(5)) if m.group(5) else v
        out.append((book, (c, v), (c2, v2)))
    return out


spans = []
for r in rows:
    if r['n'] > 40:
        continue
    for sp in refs_of(r['passages']) + refs_of(r['scripture']):
        spans.append((sp, r))
used = set()
for f in sys.argv[1:]:
    d = json.load(open(f))
    n = 0
    for bt in d:
        for v in bt['verses']:
            q = P(v['ref'])
            for (bk, s, e), r in spans:
                if q and q[0] == bk and s <= q[1] <= e:
                    lead = {'work': 'local study', 'snippet': f"The founder's local literary catalogue (2026-10-20), pair {r['n']}, {r['pair']} ({r['passages']}). Scripture itself: {r['scripture']}. Writers it found stating the contrast: {r['writers']}"}
                    for c in v['candidates']:
                        if c['kind'] == 'contrast' and lead not in c['leads']:
                            c['leads'].insert(0, lead)
                            n += 1
                    used.add(r['n'])
    out = f.replace('.json', 'c.json')
    json.dump(d, open(out, 'w'), ensure_ascii=False, indent=1)
    print(out, n, 'leads added')
print('catalogue rows used:', sorted(used), 'of', [r['n'] for r in rows if r['n'] <= 40])
