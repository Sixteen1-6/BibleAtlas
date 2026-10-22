import json, math, collections, sys
import numpy as np
from evalr import verdict
"""lr.py: softmax regression over router terms (sparse, numpy only), trained on titles, phrasings, signals, examples."""
meta = json.load(open('cls-meta.json')); T = json.load(open('cls-terms.json')); strings = json.load(open('cls-strings.json'))
ids = meta['ids']; C = len(ids)
rows, tests = [], {}
for (kind, c), terms, s in zip(meta['rows'], T, strings):
    if kind == 'test': tests[s] = terms
    elif terms: rows.append((kind, c, sorted(set(terms))))
S5 = [x['q'] for x in json.load(open('set5.json'))]
DEV = [x if isinstance(x, str) else x['q'] for x in json.load(open('dev.json'))]

def feats(terms, bi):
    f = list(set(terms))
    if bi: f += [a + '_' + b for a, b in zip(terms, terms[1:])]
    return f

def train(kw, l2=1e-4, epochs=8, lr=0.1, bi=False, seed=0, drop=0.0):
    vocab = {}
    data = []
    for kind, c, terms in rows:
        w = kw.get(kind, 1)
        if not w: continue
        f = [vocab.setdefault(t, len(vocab)) for t in feats(terms, bi)]
        data.append((f, c, w))
    V = len(vocab)
    W = np.zeros((V, C), np.float32); b = np.zeros(C, np.float32); H = np.zeros((V, C), np.float32)
    rng = np.random.default_rng(seed)
    B = 256
    for ep in range(epochs):
        order = rng.permutation(len(data))
        step = lr / (1 + ep * 0.3)
        for s in range(0, len(order), B):
            batch = [data[i] for i in order[s:s + B]]
            idx = []; rid = []
            for r, (f, c, w) in enumerate(batch):
                ff = f if not drop else [x for x in f if rng.random() > drop] or f
                idx += ff; rid += [r] * len(ff)
            idx = np.array(idx); rid = np.array(rid)
            Z = np.zeros((len(batch), C), np.float32); np.add.at(Z, rid, W[idx]); Z += b
            Z -= Z.max(1, keepdims=True); P = np.exp(Z); P /= P.sum(1, keepdims=True)
            ys = np.array([c for _, c, _ in batch]); ws = np.array([w for _, _, w in batch], np.float32)
            P[np.arange(len(batch)), ys] -= 1; P *= ws[:, None]
            G = np.zeros_like(W[:0]); 
            u, inv = np.unique(idx, return_inverse=True)
            Gu = np.zeros((len(u), C), np.float32); np.add.at(Gu, inv, P[rid])
            g = Gu + l2 * W[u]
            H[u] += g * g
            W[u] -= lr * g / (np.sqrt(H[u]) + 1e-6)
    def score(terms):
        f = [vocab[t] for t in feats(terms, bi) if t in vocab]
        if not f: return []
        z = W[f].sum(0) + b; z -= z.max(); p = np.exp(z); p /= p.sum()
        o = np.argsort(-p)[:3]
        return [(float(p[i]), int(i)) for i in o]
    score.W, score.b, score.vocab = W, b, vocab
    return score

def evaluate(score, qs):
    top = collections.Counter()
    for q in qs:
        r = score(tests[q])
        if not r: top['none'] += 1; continue
        top[verdict(q, ids[r[0][1]])] += 1
    return dict(top)

def top3(score, qs):
    n = 0
    for q in qs:
        r = score(tests[q])
        if any(verdict(q, ids[c]) == 'fits' for _, c in r): n += 1
    return n

def curve(score, qs, step=15):
    rs = []
    for q in qs:
        r = score(tests[q])
        if r: rs.append((r[0][0], verdict(q, ids[r[0][1]])))
    rs.sort(reverse=True); c = collections.Counter(); out = []
    for k, (p, v) in enumerate(rs, 1):
        c[v] += 1
        if k % step == 0: out.append((round(p, 3), c['fits'], c['near'], c['no'] + c['?']))
    return out

if __name__ == '__main__':
    kw = {'title': 2, 'also': 2, 'sig': 1, 'ex': 1}
    for args in [dict(lr=0.1, l2=1e-3), dict(lr=0.3, l2=1e-3), dict(lr=0.1, l2=1e-2), dict(lr=0.1, l2=1e-3, bi=True)]:
        sc = train(kw, **args)
        print(args, 's5', evaluate(sc, S5), 'top3', top3(sc, S5), 'dev', evaluate(sc, DEV), flush=True)
