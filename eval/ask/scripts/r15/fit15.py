"""fit15.py <dir> <mode> [l2e] [out.json]: FIT's two weightings refitted on every judged verse of the gathered
messages traced by trace15.cjs (dir/tr-*.json, dir/verses.bin, dir/cache15.json), by 5-fold cross-validation
over messages, each message's verses ordered by its fold's weights and the first 6 scored by the cache.
mode: "now" (the order the trace shows), "30" (FIT's 30 inputs refitted), "31" (with the chains of more
prepared questions, DEEP), and either with "+v" (the word-meaning model's direction for the verse, 16 times
its 256 values, weighed with l2e). JUDGED=1 orders only judged verses. Writes each message's first 6."""
import json, sys, os, glob, base64, collections, numpy as np
D, mode = sys.argv[1], sys.argv[2]
l2e = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
outp = sys.argv[4] if len(sys.argv) > 4 else None
JUDGED = os.environ.get('JUDGED') == '1'
cache = json.load(open(f'{D}/cache15.json'))
V = np.fromfile(f'{D}/verses.bin', dtype=np.float32).reshape(31102, -1).astype(np.float64) * 16
lab = lambda q, ref: cache.get(q.strip().lower() + '\t' + ref)
msgs = []
for f in sorted(glob.glob(f'{D}/tr-*.json')):
    for r in json.load(open(f)):
        if r['how'] != 'live' or r['trace']['named']: continue
        rs = r['trace']['rows']
        if JUDGED: rs = [x for x in rs if lab(r['q'], x['ref'])]
        r['rows'] = rs
        if rs: msgs.append(r)
msgs.sort(key=lambda m: m['q'])
base, useV = mode.split('+')[0], '+v' in mode
k = 31 if base == '31' else 30
def X_of(m):
    rs = m['rows']
    X = np.array([r['x'][:k] for r in rs], float)
    if useV: X = np.hstack([X, V[[r['v'] for r in rs]]])
    return X
def logit(X, y, reg, it=20):
    w = np.zeros(X.shape[1])
    for _ in range(it):
        p = 1/(1+np.exp(-np.clip(X@w, -30, 30))); g = X.T@(p-y) + reg*w; H = (X*(p*(1-p))[:,None]).T@X + np.diag(reg)
        w -= np.linalg.solve(H, g)
    return w
def fitw(ms):
    Xs=[]; ya=[]; yo=[]
    for m in ms:
        X = X_of(m)
        for j, r in enumerate(m['rows']):
            l = lab(m['q'], r['ref'])
            if l: Xs.append(X[j]); ya.append(l=='answers'); yo.append(l=='off')
    X = np.array(Xs); reg = np.array([1.0]*k + ([l2e]*V.shape[1] if useV else []))
    return logit(X, np.array(ya, float), reg), logit(X, np.array(yo, float), reg)
def top6(m, w):
    rs = m['rows']
    if w is None: return sorted([r for r in rs if r['pos'] >= 0], key=lambda r: r['pos'])[:6]
    X = X_of(m); u = 1/(1+np.exp(-X@w[0])) - 0.5/(1+np.exp(-X@w[1]))
    return [rs[j] for j in np.argsort(-u, kind='stable')[:6]]
def tally(pairs):
    c = collections.Counter()
    for m, top in pairs:
        got = False
        for r in top:
            l = lab(m['q'], r['ref']); c[l or 'unj'] += 1; got |= l == 'answers'
        c['answered'] += got; c['n'] += 1
    return c
fmt = lambda c: f"n {c['n']} answered {c['answered']} answers {c['answers']} related {c['related']} off {c['off']} unj {c['unj']} off% {100*c['off']/max(1,6*c['n']):.1f}"
pairs = []
if base == 'now':
    pairs = [(m, top6(m, None)) for m in msgs]
else:
    for f in range(5):
        w = fitw([m for j, m in enumerate(msgs) if j % 5 != f])
        pairs += [(m, top6(m, w)) for j, m in enumerate(msgs) if j % 5 == f]
print(D.rstrip('/').split('/')[-1], mode, l2e, 'judged-only' if JUDGED else 'all rows', fmt(tally(pairs)), flush=True)
if outp: json.dump([{'q': m['q'], 'how': 'live', 'shown': [{'ref': r['ref'], 'v': r['v']} for r in top]} for m, top in pairs], open(outp, 'w'))
