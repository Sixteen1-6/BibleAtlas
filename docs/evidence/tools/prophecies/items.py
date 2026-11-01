"""One review item per (pair, writer): the shortest exact words that hold both the prophecy word and the reference."""
import json, re, sys
sys.path.insert(0, '/tmp/mine/scripts')
from bible import ref, TEXT
from evidence import WORD

MAX = 360


def trim(q):
    if len(q) <= MAX:
        return q
    w = [m.span() for m in WORD.finditer(q)]
    r = [m.span() for m in re.finditer(r'\(?[1-3]?\s?[A-Z][a-z]+\.?\s[\dxvilc]+[.:,]\s?[\dxvilc]+', q)]
    best = None
    for a in w:
        for b in r or [a]:
            lo, hi = min(a[0], b[0]), max(a[1], b[1])
            if hi - lo > MAX:
                continue
            # widen to clause edges
            s = max([m.end() for m in re.finditer(r'[,;:]\s', q[:lo])] + [0])
            if lo - s > 120:
                s = lo - 120
                s = q.rfind(' ', 0, s) + 1
            e = min([lo + m.start() + 1 for m in re.finditer(r'[,;:.)]\s', q[hi:])] + [len(q)]) if False else None
            m = re.search(r'[,;:.]\s', q[hi:])
            e = hi + m.start() + 1 if m else len(q)
            if e - s > MAX:
                e = q.rfind(' ', 0, s + MAX)
            cand = q[s:e].strip()
            if lo >= s and hi <= e and (best is None or len(cand) < len(best)):
                best = cand
    return best or q[:MAX].rsplit(' ', 1)[0]


def text(r):
    a, b = r
    t = ' '.join(TEXT[i] for i in range(a, min(b, a + 3) + 1))
    return t[:300]


P = json.load(open('/tmp/mine/pairs.json'))
items = []
for pi, p in enumerate(P):
    if not p['ev']:
        continue
    by = {}
    for e in p['ev']:
        q = trim(e['quote'])
        if e['writer'] not in by or len(q) < len(by[e['writer']]['quote']):
            by[e['writer']] = dict(e, quote=q)
    for wname, e in by.items():
        items.append(dict(id=len(items), pair=pi, ot=ref(*p['ot']), nt=ref(*p['nt']), ot_text=text(p['ot']), nt_text=text(p['nt']),
                          writer=wname, work=e['work'], on=ref(*e['on']), quote=e['quote']))
json.dump(items, open('/tmp/mine/items.json', 'w'), indent=1)
print(len(items))
