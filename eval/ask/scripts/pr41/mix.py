exec(open('coef.py').read().split("print(dict(zip")[0])
old = np.array([f['score'] if f['score'] is not None else np.nan for _, f, _, _ in rows])
old = np.where(np.isnan(old), np.nanmin(old), old)
S0 = X[:, J] @ c
for beta in (0, 0.05, 0.1, 0.2, 0.4):
    S = S0 + beta * old
    print(beta, evaluate(lambda qi, idx: sorted([i for i in idx if judged[i]], key=lambda i: -S[i])))
# by question kind: with personal statements vs questions
