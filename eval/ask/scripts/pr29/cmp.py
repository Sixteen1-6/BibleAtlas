import json, sys
"""cmp.py a.json b.json verdicts...: per-question answers/off in top 8, worst changes first"""
A = json.load(open(sys.argv[1])); B = json.load(open(sys.argv[2]))
V = {}
for f in sys.argv[3:]:
    for r in json.load(open(f)):
        e = V.setdefault(r['q'], {})
        for v in r.get('verses', []): e[v['ref']] = v['verdict']
def sc(r):
    if r.get('chain') or r.get('care'): return None
    e = V.get(r['q'], {})
    top = [t['ref'] for t in r.get('top', [])[:8]]
    return sum(e.get(t) == 'answers' for t in top), sum(e.get(t) == 'off' for t in top), [ (t, e.get(t,'?')) for t in top]
Bq = {r['q']: r for r in B}
rows = []
for r in A:
    b = Bq.get(r['q'])
    if not b: continue
    x, y = sc(r), sc(b)
    if x is None or y is None: continue
    rows.append(((y[0]-x[0]) - (y[1]-x[1]), r['q'], x[:2], y[:2], y[2]))
rows.sort()
for d, q, x, y, top in rows[:int(sys.argv[0] and 25)]:
    if d >= 0: break
    print(d, q, x, '->', y)
    print('     ', ' | '.join(f'{t}:{v[0]}' for t, v in top))
