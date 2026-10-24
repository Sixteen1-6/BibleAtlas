import sys; sys.argv=['fit.py','wiff4kl0s']
exec(open('fit.py').read().split("if __name__ == '__main__' and judged.sum():")[0])
def lin(cols, lam=1.0, l2=1e-2, folds=5, ret=False):
    J = [NAMES.index(c) for c in cols]
    S = np.zeros(len(rows))
    for k in range(folds):
        tr = judged & (qid % folds != k); te = qid % folds == k
        _, wa, ba, mu, sd = logit(X[tr][:, J], (lab[tr] == 2).astype(float), l2)
        _, wo, bo, mu2, sd2 = logit(X[tr][:, J], (lab[tr] == 0).astype(float), l2)
        S[te] = ((X[te][:, J] - mu) / sd) @ wa - lam * (((X[te][:, J] - mu2) / sd2) @ wo)
    r = evaluate(lambda qi, idx: sorted([i for i in idx if judged[i]], key=lambda i: -S[i]))
    return r, S
for cols in (['mp', 'xBest', 'text', 'closest', 'mn', 'teach'], ['mp', 'xBest', 'text', 'closest', 'mn', 'inTopic', 'teach', 'mpos'], ['mp', 'rel', 'xBest', 'text', 'closest', 'mn', 'inTopic', 'teach', 'mpos', 'lean'], NAMES):
    for lam in (0.5, 1, 2):
        print(len(cols), lam, lin(cols, lam)[0])
