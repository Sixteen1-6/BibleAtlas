import json, math, collections, sys
import numpy as np
from evalr import verdict, O, L
"""cls.py: meaning matchers trained on titles, phrasings, signals and examples; scored on judged questions."""
meta = json.load(open('cls-meta.json')); T = json.load(open('cls-terms.json'))
ids = meta['ids']; C = len(ids)
train = collections.defaultdict(list); tests = {}
strings = json.load(open('cls-strings.json'))
for (kind, c), terms, s in zip(meta['rows'], T, strings):
    if kind == 'test': tests[s] = terms
    elif terms: train[c].append((kind, terms))
S5 = [x['q'] for x in json.load(open('set5.json'))]
DEV = [x if isinstance(x, str) else x['q'] for x in json.load(open('dev.json'))]
care = set(json.load(open('care-set.json'))) if len(sys.argv) > 9 else set()

def weights(kinds_w):
    # per class term counts, documents weighted by kind
    cnt = [collections.Counter() for _ in range(C)]
    for c, docs in train.items():
        for kind, terms in docs:
            for t in set(terms): cnt[c][t] += kinds_w.get(kind, 1)
    return cnt

def nb(cnt, alpha=0.1):
    vocab = set(t for c in cnt for t in c)
    tot = [sum(c.values()) for c in cnt]
    V = len(vocab)
    def score(terms):
        terms = [t for t in set(terms) if t in vocab]
        if not terms: return []
        s = np.array([sum(math.log((cnt[c].get(t, 0) + alpha) / (tot[c] + alpha * V)) for t in terms) for c in range(C)])
        p = np.exp(s - s.max()); p /= p.sum()
        o = np.argsort(-p)[:3]
        return [(float(p[i]), int(i)) for i in o]
    return score

def tfidf(cnt, sub=1.0):
    df = collections.Counter(t for c in cnt for t in c)
    idf = {t: math.log(C / n) for t, n in df.items()}
    vec = []
    for c in cnt:
        v = {t: (1 + math.log(k)) * idf[t] for t, k in c.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1
        vec.append({t: x / norm for t, x in v.items()})
    inv = collections.defaultdict(list)
    for c, v in enumerate(vec):
        for t, x in v.items(): inv[t].append((c, x))
    def score(terms):
        terms = [t for t in set(terms) if t in idf]
        if not terms: return []
        q = {t: idf[t] for t in terms}; qn = math.sqrt(sum(x * x for x in q.values()))
        acc = collections.Counter()
        for t, w in q.items():
            for c, x in inv[t]: acc[c] += w * x / qn
        best = acc.most_common(3)
        return [(s, c) for c, s in best]
    return score

def evaluate(score, qs, thr=None):
    c = collections.Counter(); top = collections.Counter()
    for q in qs:
        r = score(tests[q])
        if not r: c['none'] += 1; continue
        v = verdict(q, ids[r[0][1]])
        top[v] += 1
    return dict(top)

def curve(score, qs, margin=False):
    rows = []
    for q in qs:
        r = score(tests[q])
        if not r: continue
        conf = r[0][0] - (r[1][0] if margin and len(r) > 1 else 0)
        rows.append((conf, verdict(q, ids[r[0][1]])))
    rows.sort(reverse=True)
    out = []; c = collections.Counter()
    for k, (conf, v) in enumerate(rows, 1):
        c[v] += 1
        if k % 15 == 0: out.append((round(conf, 3), dict(c)))
    return out

if __name__ == '__main__':
    for kw in [{'title': 2, 'also': 1, 'sig': 1, 'ex': 1}, {'title': 2, 'also': 2, 'sig': 1, 'ex': 1}, {'title': 1, 'also': 1, 'sig': 0.5, 'ex': 1}]:
        cnt = weights(kw)
        for name, sc in [('nb.1', nb(cnt, .1)), ('nb.5', nb(cnt, .5)), ('tfidf', tfidf(cnt))]:
            print(kw, name, 's5', evaluate(sc, S5), 'dev', evaluate(sc, DEV))
