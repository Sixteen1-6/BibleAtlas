import json, sys, collections, math
import numpy as np
from lr import tests, ids, S5, DEV, verdict
"""mev.py weights.json [rt]: top-1 verdicts of pruned weights, and opens by threshold (with the router)."""
m = json.load(open(sys.argv[1])); w = m['w']; sc = m['scale']; C = len(ids)
def top(q):
    z = np.zeros(C); hit = False
    for t in set(tests[q]):
        e = w.get(t)
        if e: hit = True; z[e[0::2]] += np.array(e[1::2]) / sc
    if not hit: return []
    z -= z.max(); p = np.exp(z); p /= p.sum(); o = np.argsort(-p)[:3]
    return [(float(p[i]), ids[i]) for i in o]
rt = {r['q']: r for f in ['rt-s5-sig.json', 'rt-dev-sig.json'] for r in json.load(open(f))}
def ev(qs):
    c = collections.Counter(); t3 = 0
    for q in qs:
        r = top(q)
        if r: c[verdict(q, r[0][1])] += 1
        if any(verdict(q, i) == 'fits' for _, i in r): t3 += 1
    return dict(c), t3
print('top1 s5', *ev(S5), 'dev', ev(DEV)[0])
for t in [0.6, 0.7, 0.8, 0.9]:
    for name, qs in [('s5', S5), ('dev', DEV)]:
        c = collections.Counter()
        for q in qs:
            r = rt[q]; m_ = top(q)
            o = r['exact'] or (m_[0][1] if m_ and m_[0][0] >= t else None) or r['open']
            if o: c[verdict(q, o)] += 1
        print(f'  open lr{t}|router {name}', dict(c), end='')
    print()
