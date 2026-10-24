import json, math, collections
import numpy as np
from lr import rows, tests, ids, C, S5, DEV, evaluate, top3
"""knn.py: nearest examples (idf-weighted cosine over router terms), votes summed per answer."""
def knn(kw, k=10, p=2.0):
    df = collections.Counter(t for _, _, ts in rows for t in ts)
    N = len(rows); idf = {t: math.log(N / n) for t, n in df.items()}
    inv = collections.defaultdict(list); norms = []
    for r, (kind, c, ts) in enumerate(rows):
        nrm = math.sqrt(sum(idf[t] ** 2 for t in ts)) or 1; norms.append(nrm)
        for t in ts: inv[t].append(r)
    def score(terms):
        terms = [t for t in set(terms) if t in idf]
        if not terms: return []
        qn = math.sqrt(sum(idf[t] ** 2 for t in terms))
        acc = collections.Counter()
        for t in terms:
            for r in inv[t]: acc[r] += idf[t] ** 2
        sims = sorted(((v / qn / norms[r], r) for r, v in acc.items()), reverse=True)[:k]
        vote = collections.Counter()
        for s, r in sims: vote[rows[r][1]] += (s ** p) * kw.get(rows[r][0], 1)
        tot = sum(vote.values()) or 1
        return [(v / tot, c) for c, v in vote.most_common(3)]
    return score
if __name__ == '__main__':
    for kw in [{'title': 1, 'also': 1, 'sig': 1, 'ex': 1}]:
        for k, p in [(5, 1), (10, 2), (20, 2), (30, 3)]:
            sc = knn(kw, k, p)
            print(k, p, 's5', evaluate(sc, S5), 'top3', top3(sc, S5), 'dev', evaluate(sc, DEV), flush=True)
