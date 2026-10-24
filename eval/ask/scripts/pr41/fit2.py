import sys; sys.argv=['fit.py','wiff4kl0s']
exec(open('fit.py').read().split("if __name__ == '__main__' and judged.sum():")[0])
# Oracle within the judged pool
def oracle(qi, idx):
    return sorted([i for i in idx if judged[i]], key=lambda i: -(lab[i]))
print('oracle', evaluate(oracle))
def cv(cols, lam=2, l2=1e-2, folds=5):
    J = [NAMES.index(c) for c in cols]
    Pa = np.zeros(len(rows)); Po = np.zeros(len(rows))
    for k in range(folds):
        tr = judged & (qid % folds != k); te = qid % folds == k
        fa, *_ = logit(X[tr][:, J], (lab[tr] == 2).astype(float), l2); fo, *_ = logit(X[tr][:, J], (lab[tr] == 0).astype(float), l2)
        Pa[te] = fa(X[te][:, J]); Po[te] = fo(X[te][:, J])
    s = Pa - lam * Po
    return evaluate(lambda qi, idx: sorted([i for i in idx if judged[i]], key=lambda i: -s[i])), Pa, Po
ALL = NAMES
SETS = {
 'all': ALL,
 'core8': ['mp', 'xBest', 'text', 'closest', 'mn', 'inTopic', 'teach', 'mpos'],
 'core6': ['mp', 'xBest', 'text', 'closest', 'mn', 'teach'],
 'core10': ['mp', 'rel', 'xBest', 'text', 'closest', 'mn', 'inTopic', 'teach', 'mpos', 'lean'],
 'core12g': ['mp', 'rel', 'xBest', 'text', 'closest', 'mn', 'inTopic', 'mpos', 'dense', 'routerLean'] + ['g_' + g for g in GEN],
}
for n, cols in SETS.items():
    for lam in (1, 2, 4):
        print(n, lam, cv(cols, lam)[0])
