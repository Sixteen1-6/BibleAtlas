"""fitrows12.py fit-rows-31904.json.gz: FIT's two weightings from the stored rows alone (as fitfinal.py, without the traces)."""
import json, gzip, sys, numpy as np
d = json.load(gzip.open(sys.argv[1], 'rt'))
X = np.array([r['x'] for r in d['rows']])
def logit(X, y, l2=1.0, it=30):
    w = np.zeros(X.shape[1])
    for _ in range(it):
        p = 1/(1+np.exp(-X@w)); g = X.T@(p-y) + l2*w; H = (X*(p*(1-p))[:,None]).T@X + l2*np.eye(len(w))
        w -= np.linalg.solve(H, g)
    return w
for k in ('answers', 'off'):
    w = logit(X, np.array([r['verdict'] == k for r in d['rows']], float))
    print(k + ':', ', '.join(f'{x:.4f}' for x in w))
