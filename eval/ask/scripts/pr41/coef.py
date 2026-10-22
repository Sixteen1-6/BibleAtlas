exec(open('fit3.py').read().split("for cols in")[0])
C6 = ['mp', 'xBest', 'text', 'closest', 'mn', 'teach']
J = [NAMES.index(c) for c in C6]
for half in (None, 0, 1):
    m = judged if half is None else judged & (qid % 2 == half)
    _, wa, ba, mu, sd = logit(X[m][:, J], (lab[m] == 2).astype(float))
    _, wo, bo, _, _ = logit(X[m][:, J], (lab[m] == 0).astype(float))
    c = wa / sd - 2 * wo / sd
    print(half, {k: round(float(v / c[C6.index('text')]), 3) for k, v in zip(C6, c)}, 'scale', round(float(c[C6.index('text')]), 3))
# evaluate raw-coefficient score from full fit, rounded
_, wa, ba, mu, sd = logit(X[judged][:, J], (lab[judged] == 2).astype(float))
_, wo, bo, _, _ = logit(X[judged][:, J], (lab[judged] == 0).astype(float))
c = wa / sd - 2 * wo / sd
c = c / c[C6.index('text')]
cr = np.round(c, 1)
for name, cc in (('full', c), ('rounded', cr)):
    S = X[:, J] @ cc
    print(name, evaluate(lambda qi, idx: sorted([i for i in idx if judged[i]], key=lambda i: -S[i])))
print(dict(zip(C6, cr.tolist())))
# features scale
for k in C6: print(k, float(X[judged][:, NAMES.index(k)].mean().round(3)), float(X[judged][:, NAMES.index(k)].max()))
