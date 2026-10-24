import json, pickle, collections, sys
import numpy as np
from lr import tests, ids, S5, DEV, verdict
W, vocab = pickle.load(open(sys.argv[1] if len(sys.argv) > 1 else 'lr-model.pkl', 'rb'))
idx = {k: i for i, k in enumerate(ids)}
def lr_top(q):
    f = [vocab[t] for t in set(tests[q]) if t in vocab]
    if not f: return []
    z = W[f].sum(0); z = z - z.max(); p = np.exp(z); p /= p.sum(); o = np.argsort(-p)[:3]
    return [(float(p[i]), ids[i]) for i in o]
rt = {r['q']: r for f in ['rt-s5-sig.json', 'rt-dev-sig.json'] for r in json.load(open(f))}
def run(qs, rule):
    c = collections.Counter()
    for q in qs:
        r = rt[q]; m = lr_top(q)
        o = rule(r, m)
        if o: c[verdict(q, o)] += 1
    return dict(c)
rules = {
 'router': lambda r, m: r['exact'] or r['open'],
}
for t in [0.5, 0.6, 0.7, 0.8, 0.9]:
    rules[f'lr{t}'] = (lambda t: lambda r, m: r['exact'] or (m[0][1] if m and m[0][0] >= t else None))(t)
    rules[f'router|lr{t}'] = (lambda t: lambda r, m: r['exact'] or r['open'] or (m[0][1] if m and m[0][0] >= t else None))(t)
    rules[f'lr{t}|router'] = (lambda t: lambda r, m: r['exact'] or (m[0][1] if m and m[0][0] >= t else None) or r['open'])(t)
    rules[f'agree|lr{t}'] = (lambda t: lambda r, m: r['exact'] or (r['open'] if r['open'] and m and r['open'] in [x[1] for x in m] else None) or (m[0][1] if m and m[0][0] >= t else None))(t)
for k, f in rules.items():
    print(f'{k:16}', 's5', run(S5, f), 'dev', run(DEV, f))
