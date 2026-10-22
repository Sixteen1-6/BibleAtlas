import json, math, collections, pickle
from evalr import O, verdict, S5, DEV
d = json.load(open('tt-sig.json'))
Q = d['questions']
def docs(k_title=2, k_way=1, k_sig=1):
    D = []
    for q in Q:
        c = collections.Counter()
        for t in q['title']: c[t] += k_title
        for w in q['ways']:
            for t in w: c[t] += k_way
        for s, ts in q['sig']:
            for t in ts: c[t] += k_sig
        D.append(c)
    return D
def bm25(D, k1=1.2, b=0.5):
    N = len(D); df = collections.Counter(t for c in D for t in c)
    idf = {t: math.log(1 + (N - n + 0.5) / (n + 0.5)) for t, n in df.items()}
    L = [sum(c.values()) for c in D]; avg = sum(L) / N
    def score(terms):
        out = []
        for i, c in enumerate(D):
            s = 0
            for t in terms:
                f = c.get(t)
                if f: s += idf[t] * f * (k1 + 1) / (f + k1 * (1 - b + b * L[i] / avg))
            if s: out.append((s, i))
        out.sort(reverse=True)
        return out
    return score, idf
def top1(score, qs):
    c = collections.Counter()
    for q in qs:
        info = d['typed'][q]
        if info['care']: continue
        r = score(info['terms'])
        if not r: c['none'] += 1; continue
        c[verdict(q, Q[r[0][1]]['id'])] += 1
    return dict(c)
if __name__ == '__main__':
    F = pickle.load(open('feats.pkl', 'rb'))[None]
    c = collections.Counter()
    for r in F:
        if not r['s5']: continue
        c[r['v'][0] if r['top'] else 'none'] += 1
    print('router top1 s5', dict(c))
    for kt, kw, ks in [(2,1,1),(1,1,1),(3,1,2),(2,1,3),(0,1,1)]:
        for k1, b in [(1.2,.5),(1.2,.75),(0.8,.3),(2,.5)]:
            sc, _ = bm25(docs(kt,kw,ks), k1, b)
            print((kt,kw,ks,k1,b), 's5', top1(sc, S5))
