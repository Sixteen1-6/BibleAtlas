exec(open('fit12.py').read())
import sys
d400 = set(q.strip().lower() for q in json.load(open('dev400.json')))
def feats(r, m):
    return [1.0, r['inPool'], r['text'], r['inTopic'], r['cited'], r['rank'], r['dense'], r['genre'], r['reason'], r['closest'],
            r['leaning'], r['links']/6, r['hp'], min(r['hn'],5)/5, r['hfirst'], r['near'], r['wider'], min(r['pointed'],5)/5,
            r['score']/5, r['show']/5, 1.0 if r['found']>=0 and r['found']<10 else 0.0, 1.0 if 0<=r['pos']<6 else 0.0]
NAMES = ['bias','inPool','text','inTopic','cited','rank','dense','genre','reason','closest','leaning','links','hp','hn','hfirst','near','wider','pointed','score','show','found10','base6']
def logit(X, y, l2=1.0, it=30):
    w = np.zeros(X.shape[1])
    for _ in range(it):
        p = 1/(1+np.exp(-X@w)); g = X.T@(p-y) + l2*w; H = (X*(p*(1-p))[:,None]).T@X + l2*np.eye(len(w))
        w -= np.linalg.solve(H, g)
    return w
def data(ms, use):
    X=[]; ya=[]; yo=[]
    for m in ms:
        for r in m['trace']['rows']:
            l = lab(m['q'], r['ref'])
            if not l: continue
            X.append([f for f, k in zip(feats(r, m), NAMES) if k in use]); ya.append(l=='answers'); yo.append(l=='off')
    return np.array(X), np.array(ya, float), np.array(yo, float)
def run(use, lam, folds=5, show_w=False):
    # grouped CV by message index
    idx = {id(m): k % folds for k, m in enumerate(msgs)}
    res = collections.Counter(); res_all = collections.Counter()
    for f in range(folds):
        tr = [m for m in msgs if idx[id(m)] != f]; te = [m for m in msgs if idx[id(m)] == f]
        X, ya, yo = data(tr, use)
        wa = logit(X, ya); wo = logit(X, yo)
        if show_w and f == 0:
            print(' '.join(f'{k}:{a:+.2f}/{o:+.2f}' for k, a, o in zip([k for k in NAMES if k in use], wa, wo)))
        for m in te:
            if m['trace']['named']:
                order = sorted([r for r in m['trace']['rows'] if r['pos']>=0], key=lambda r: r['pos'])
            else:
                rs = m['trace']['rows']
                Xm = np.array([[f for f, k in zip(feats(r, m), NAMES) if k in use] for r in rs])
                u = 1/(1+np.exp(-Xm@wa)) - lam/(1+np.exp(-Xm@wo))
                order = [rs[k] for k in np.argsort(-u, kind='stable')]
            got = False; c = collections.Counter()
            for r in order[:6]:
                l = lab(m['q'], r['ref']); c[l or 'unj'] += 1
                got |= l == 'answers'
            c['answered'] += got; c['n'] += 1
            key = m['q'].strip().lower()
            if key in d400: res.update(c)
            if key in live: res_all.update(c)
    return res, res_all
if __name__ == '__main__':
    base = collections.Counter(); basel = collections.Counter()
    for m in msgs:
        key = m['q'].strip().lower()
        order = sorted([r for r in m['trace']['rows'] if r['pos']>=0], key=lambda r: r['pos'])
        c = collections.Counter(); got=False
        for r in order[:6]:
            l = lab(m['q'], r['ref']); c[l or 'unj'] += 1; got |= l=='answers'
        c['answered'] += got; c['n'] += 1
        if key in d400: base.update(c)
        if key in live: basel.update(c)
    fmt = lambda c: f"n {c['n']} answered {c['answered']} answers {c['answers']} related {c['related']} off {c['off']} unj {c['unj']}"
    print('base d400', fmt(base)); print('base live', fmt(basel))
    ALL = [k for k in NAMES if k not in ('base6',)]
    for name, use, lam in [('all-0.5', ALL, 0.5), ('all-1', ALL, 1.0), ('noscore', [k for k in ALL if k not in ('score','show','found10')], 0.5), ('all+base6', NAMES, 0.5)]:
        r, rl = run(use, lam, show_w=(name=='all-0.5'))
        print(name, 'd400', fmt(r)); print(name, 'live', fmt(rl))
