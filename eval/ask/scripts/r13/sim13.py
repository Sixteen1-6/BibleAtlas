"""sim13.py trace.json [t ...]: what opens at each MEANT.model threshold t, scored by cache.json on the
answer's first 6 parts (answered = any part judged answers). Unjudged pairs are counted."""
import json, sys, collections
cache = json.load(open('cache.json'))
T = json.load(open(sys.argv[1])); out, chains = T['out'], T['chains']
def opens(r, t):
    th = t if r['model'] else 0.35
    if r['sense'] and r['p'] >= th: return r['sense'] if r['fits'] else None
    return r['words']
def score(r, qid):
    a = o = u = 0
    for ref in chains[qid]:
        x = cache.get(r['q'].strip().lower() + '\t' + ref)
        if x is None: u += 1
        elif x == 'answers': a += 1
        elif x == 'off': o += 1
    return a, o, u
for t in [float(x) for x in sys.argv[2:]] or [0.25]:
    c = collections.Counter()
    for r in out:
        q = opens(r, t)
        if not q: continue
        a, o, u = score(r, q)
        c['open'] += 1; c['good'] += a > 0; c['bad'] += (a == 0 and u == 0); c['unj'] += (a == 0 and u > 0); c['offparts'] += o
    print(f"t={t:.2f} open {c['open']} answered {c['good']} not {c['bad']} unjudged {c['unj']} offparts {c['offparts']}  prec {c['good']/max(1,c['good']+c['bad']):.3f}")
