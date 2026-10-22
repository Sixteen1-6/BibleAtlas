import json, collections
"""evalr.py: score router opens against labels (pairs judged) and the oracle (set5: every fitting answer picked by meaning)."""
L = json.load(open('labels-all.json'))
O = {p['q']: p for p in json.load(open('oracle-s5.json'))}
DEV = [x if isinstance(x, str) else x['q'] for x in json.load(open('dev.json'))]
S5 = [x['q'] for x in json.load(open('set5.json'))]
def verdict(q, i):
    if q in O:
        if i in O[q]['fits']: return 'fits'
        if i in O[q]['near']: return 'near'
        v = L.get(q, {}).get(i)
        return v if v in ('fits', 'near') else 'no'
    return L.get(q, {}).get(i, '?')
def score(router, dump, P, qs):
    c = collections.Counter()
    for q in qs:
        o = router.route(dump['typed'][q], P)
        if o: c[verdict(q, o)] += 1
    return dict(c)
def both(router, dump, P):
    return 'dev', score(router, dump, P, DEV), 's5', score(router, dump, P, S5)
