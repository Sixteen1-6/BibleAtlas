exec(open('coef.py').read().split("print(dict(zip")[0])
S0 = X[:, J] @ c
V_ = np.array([f['v'] for _, f, _, _ in rows])
for delta in (0, 0.25, 0.5, 1, 2):
    def pick(qi, idx):
        o = sorted([i for i in idx if judged[i]], key=lambda i: -S0[i])
        out = []; left = list(o)
        while left and len(out) < 6:
            got = {V_[i] for i in out}
            best = max(left, key=lambda i: S0[i] - delta * ((V_[i] - 1 in got) + (V_[i] + 1 in got)))
            out.append(best); left.remove(best)
        return out
    print(delta, evaluate(pick))
