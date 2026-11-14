"""batch15.py cache.json outdir n run.json [run.json ...]: blind batches of the first 6 shown per message (gathered
verses or chain parts) that the cache has not judged, each verse with its BSB words and the passage around it,
in reference order, never saying which run showed it (as r14/batch14.py). ONLY=file keeps only those messages."""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
from bible import parse, text, name
cache = json.load(open(sys.argv[1]))
out, n = sys.argv[2], int(sys.argv[3])
only = set(q.strip().lower() for q in json.load(open(os.environ['ONLY']))) if os.environ.get('ONLY') else None
def ctx(ref):
    vs = parse(ref)
    (b, c, v0), (_, _, v1) = vs[0], vs[-1]
    lines = []
    for v in range(max(1, v0 - 2), v1 + 3):
        try: t = text(b, c, v)
        except Exception: t = None
        if t: lines.append(f"{'>>' if v0 <= v <= v1 else '  '} {name(b, c, v)} {t}")
    return '\n'.join(lines)
def words(ref):
    return ' '.join(t for t in (text(b, c, v) for b, c, v in parse(ref)) if t)
Q, order = {}, []
for f in sys.argv[4:]:
    for r in json.load(open(f)):
        if r['how'] == 'care' or (only is not None and r['q'].strip().lower() not in only): continue
        for t in r.get('shown', [])[:6]:
            if (r['q'].strip().lower() + '\t' + t['ref']) in cache: continue
            if r['q'] not in Q: Q[r['q']] = {}; order.append(r['q'])
            Q[r['q']].setdefault(t['ref'], (t['v'], t.get('text') or words(t['ref'])))
items = [{'q': q, 'verses': [{'ref': ref, 'shown': s, 'context': ctx(ref)} for ref, (v, s) in sorted(Q[q].items(), key=lambda x: x[1][0])]} for q in order if Q[q]]
os.makedirs(out, exist_ok=True)
for b in range(n):
    json.dump(items[b::n], open(f'{out}/batch-{b+1}.json', 'w'), indent=1, ensure_ascii=False)
print(len(items), 'questions', sum(len(x['verses']) for x in items), 'verses in', n, 'batches')
