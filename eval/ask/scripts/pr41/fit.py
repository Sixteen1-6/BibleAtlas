"""fit.py verdict-task-ids...: learn which gathered verses to show first, from judged dev verses."""
import json, sys, glob, collections, math
import numpy as np
D = __import__('os').environ['ASK_WORK'] + '/scratchpad'
V = {}
for t in sys.argv[1:]:
    o = json.load(open(f'{D}/../tasks/{t}.output')) if not t.endswith('.json') else json.load(open(t))
    r = o.get('result', o)
    if isinstance(r, str): r = json.loads(r)
    for x in r['results']:
        for v in x['verses']: V[(x['q'], v['ref'])] = v['verdict']
R = [r for r in json.load(open(f'{D}/g7/fx-dev.json')) if r['how'] == 'live']
GEN = ['pauline', 'wisdom', 'gospels', 'general', 'law', 'major-prophets', 'history', 'acts', 'apocalyptic', 'minor-prophets']
TEACH = {'wisdom': 0.3, 'pauline': 0.3, 'general': 0.3, 'gospels': 0.25, 'major-prophets': 0.1, 'minor-prophets': 0.1, 'apocalyptic': 0.1}
def feats(f, r):
    p0 = r['meanings'][0]['p'] if r['meanings'] else 0
    rel = f['mp'] / p0 if p0 and f['mr'] >= 0 else 0
    x = {
        'lean': f['leaning'], 'routerLean': f['routerLean'], 'text': f['text'], 'inTopic': f['inTopic'], 'cited': f['cited'],
        'rank': f['rank'], 'dense': f['dense'], 'reason': f['reason'], 'closest': f['closest'], 'book': f['book'] / 2,
        'm0': +(f['mr'] == 0), 'm1': +(f['mr'] == 1), 'm2': +(f['mr'] == 2), 'm34': +(f['mr'] in (3, 4)), 'm59': +(f['mr'] >= 5),
        'mp': f['mp'], 'rel': rel, 'mpos': (f['mpos'] if f['mpos'] >= 0 else 8) / 8, 'mn': min(f['mn'], 5) / 5,
        'xChain': min(f['xChain'], 6) / 6, 'xBest': min(f['xBest'], 6) / 6, 'hits0': +(f['hits'] == 0),
        'p0': p0, 'nUsable': min(r['nUsable'], 6) / 6, 'teach': TEACH.get(f['genre'], 0),
        'm0p0': (f['mr'] == 0) * p0, 'gap0': (f['mr'] == 0) * (p0 - (r['meanings'][1]['p'] if len(r['meanings']) > 1 else 0)),
        'mpXtext': f['mp'] * f['text'], 'leanXtext': f['leaning'] * f['text'],
        'textXnochain': f['text'] * (f['mr'] < 0), 'denseXnochain': f['dense'] * (f['mr'] < 0),
    }
    for g in GEN: x['g_' + g] = +(f['genre'] == g)
    return x
rows = []
for qi, r in enumerate(R):
    for f in r['feats']:
        rows.append((qi, f, feats(f, r), V.get((r['q'], f['ref']))))
NAMES = list(rows[0][2].keys())
X = np.array([[x[k] for k in NAMES] for _, _, x, _ in rows], float)
lab = np.array([{'answers': 2, 'related': 1, 'off': 0}.get(v, -1) for *_, v in rows])
qid = np.array([q for q, *_ in rows])
judged = lab >= 0
print(len(rows), 'candidates,', judged.sum(), 'judged;', collections.Counter(lab[judged].tolist()))
def logit(X, y, l2=1e-2, it=3000, lr=0.5):
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = (X - mu) / sd; w = np.zeros(Z.shape[1]); b = 0.0
    for _ in range(it):
        p = 1 / (1 + np.exp(-(Z @ w + b)))
        g = Z.T @ (p - y) / len(y) + l2 * w; gb = (p - y).mean()
        w -= lr * g; b -= lr * gb
    return lambda X2: 1 / (1 + np.exp(-(((X2 - mu) / sd) @ w + b))), w, b, mu, sd
def evaluate(order_fn, qs=None, k=6, show=None):
    """order_fn(qi, idx) -> idx sorted best first. Count over questions in qs."""
    qs = range(len(R)) if qs is None else qs
    c = collections.Counter()
    for qi in qs:
        idx = np.where(qid == qi)[0]
        top = order_fn(qi, idx)[:k]
        ls = lab[top]
        c['q'] += 1; c['shown'] += len(top); c['answered'] += int((ls == 2).any()); c['off'] += int((ls == 0).sum()); c['ans'] += int((ls == 2).sum()); c['unjudged'] += int((ls < 0).sum())
    return dict(c)
cur = np.array([f['cur'] for _, f, _, _ in rows])
base = lambda qi, idx: sorted([i for i in idx if cur[i] >= 0], key=lambda i: cur[i])
print('current', evaluate(base))
if __name__ == '__main__' and judged.sum():
    folds = 5
    Pa = np.zeros(len(rows)); Po = np.zeros(len(rows))
    for k in range(folds):
        tr = judged & (qid % folds != k)
        fa, *_ = logit(X[tr], (lab[tr] == 2).astype(float)); fo, *_ = logit(X[tr], (lab[tr] == 0).astype(float))
        te = qid % folds == k
        Pa[te] = fa(X[te]); Po[te] = fo(X[te])
    for lam in (0, 0.5, 1, 2, 4):
        s = Pa - lam * Po
        print(f'model lam={lam}', evaluate(lambda qi, idx: sorted(idx, key=lambda i: -s[i])))
    fa, wa, *_ = logit(X[judged], (lab[judged] == 2).astype(float)); fo, wo, *_ = logit(X[judged], (lab[judged] == 0).astype(float))
    for n, a, o in sorted(zip(NAMES, wa, wo), key=lambda t: -abs(t[1])): print(f'{n:14s} ans {a:+.2f}  off {o:+.2f}')

# Ranking only the judged pool (current top 10, and the first 3 parts of the top 5 meanings' chains).
if __name__ == '__main__' and judged.sum():
    print('--- judged pool only')
    for lam in (0, 1, 2, 4):
        s = Pa - lam * Po
        print(f'model lam={lam}', evaluate(lambda qi, idx: sorted([i for i in idx if judged[i]], key=lambda i: -s[i])))
    for tau in (0.3, 0.4, 0.5, 0.6):
        for mn in (3, 4):
            s = Pa - Po
            def pick(qi, idx):
                o = sorted([i for i in idx if judged[i]], key=lambda i: -s[i])
                keep = [i for i in o if Po[i] < tau]
                return (keep if len(keep) >= mn else o[:mn])
            print(f'cut tau={tau} min={mn}', evaluate(pick))
