exec(open('fit12b.py').read().split("if __name__ == '__main__':")[0])
def mfeats(m):
    t = m['trace']; rows = t['rows']
    mx = max([r['text'] for r in rows] or [0])
    p0 = (t['nearP'] or [0])[0]
    weak = 1.0 if (t['usable'] == 0 or mx < 0.5) else 0.0
    return weak, p0
def feats2(r, m, mf):
    weak, p0 = mf
    b = feats(r, m)[:-1]
    return b + [weak*r['hp'], weak*r['near'], weak*r['text'], p0*r['hp'], p0, weak, r['hp']*r['hfirst'], r['near']*r['hn']/5, r['text']*r['closest']]
N2 = NAMES[:-1] + ['w_hp','w_near','w_text','p0_hp','p0','weak','hp_first','near_hn','text_closest']
def rank_fn(train, use, lam):
    X=[]; ya=[]; yo=[]
    for m in train:
        mf = mfeats(m)
        for r in m['trace']['rows']:
            l = lab(m['q'], r['ref'])
            if not l: continue
            X.append([f for f, k in zip(feats2(r, m, mf), N2) if k in use]); ya.append(l=='answers'); yo.append(l=='off')
    X = np.array(X); wa = logit(X, np.array(ya, float)); wo = logit(X, np.array(yo, float))
    def order(m):
        if m['trace']['named']:
            return sorted([r for r in m['trace']['rows'] if r['pos']>=0], key=lambda r: r['pos'])
        mf = mfeats(m); rs = m['trace']['rows']
        Xm = np.array([[f for f, k in zip(feats2(r, m, mf), N2) if k in use] for r in rs])
        u = 1/(1+np.exp(-Xm@wa)) - lam/(1+np.exp(-Xm@wo))
        return [rs[k] for k in np.argsort(-u, kind='stable')]
    return order, wa, wo
def cv(use, lam, folds=5):
    idx = {id(m): k % folds for k, m in enumerate(msgs)}
    out = {}
    for f in range(folds):
        order, _, _ = rank_fn([m for m in msgs if idx[id(m)] != f], use, lam)
        for m in msgs:
            if idx[id(m)] == f: out[m['q']] = order(m)[:6]
    return out
def tally(out, keys):
    c = collections.Counter()
    for q, top in out.items():
        if q.strip().lower() not in keys: continue
        got = False
        for r in top:
            l = lab(q, r['ref']); c[l or 'unj'] += 1; got |= l == 'answers'
        c['answered'] += got; c['n'] += 1
    return c
fmt = lambda c: f"n {c['n']} answered {c['answered']} answers {c['answers']} related {c['related']} off {c['off']} unj {c['unj']}"
