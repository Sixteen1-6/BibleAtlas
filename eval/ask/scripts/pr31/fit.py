import pickle, itertools, collections, sys
F = pickle.load(open('feats.pkl', 'rb'))
def feats(r):
    t = r['top']; b = t[0]; n = t[1] if len(t) > 1 else None
    return b, n
def evaluate(rows, rule):
    c = collections.Counter()
    for r in rows:
        if r['exact']:
            continue
        if not r['top']: continue
        b, n = feats(r)
        if rule(b, n):
            c[('s5' if r['s5'] else 'dev', r['v'][0])] += 1
    return c
def fmt(c):
    return ' '.join(f"{k[0]}:{k[1]}={v}" for k, v in sorted(c.items()))
def obj(c, wno=3):
    s = 0
    for (part, v), k in c.items():
        if v == 'fits': s += k
        elif v == 'near': s += 0.3 * k
        elif v == 'no': s -= wno * k
        elif v == '?': s -= 0.5 * k
    return s
base = lambda b, n: b['said'] >= .75 and b['covers'] >= .5 and b['score'] >= .6 and not (n and b['score'] - n['score'] < .08 and n['said'] >= .75)
for unk in F:
    print(unk, 'base', fmt(evaluate(F[unk], base)))
best = []
for unk in F:
    rows = F[unk]
    for A, B, C, W, M, T in itertools.product([.6, .75, .9, .99], [0, .1, .2, .3, .4, .5], [.3, .4, .5, .6], [0, 4, 6, 8], [0, .04, .08, .12], [0]):
        rule = lambda b, n: b['said'] >= A and b['covers'] >= B and b['score'] >= C and b['weight'] >= W and not (n and b['score'] - n['score'] < M)
        c = evaluate(rows, rule)
        best.append((obj(c), unk, (A, B, C, W, M), fmt(c)))
best.sort(key=lambda x: -x[0])
for x in best[:25]: print(x)
