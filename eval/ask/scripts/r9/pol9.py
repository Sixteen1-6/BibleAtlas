"""pol8.py set(dev2|dev3) run.json...: routing scores with labels that know the 360 new answers.
Rules: the matcher opens its top answer if p1 >= hi, or p1 >= lo and p1 >= r * p2; else the word router."""
import json, collections, sys, glob, os
H = os.path.dirname(os.path.abspath(__file__)) + '/../r7/relabel'
S = sys.argv[1]
old = json.load(open({'dev2': f'{H}/../../r6/dev2/picks.json', 'dev3': f'{H}/../../g7/dev3/picks.json'}[S]))
new = {}
for f in glob.glob(f'{H}/out-*.json'):
    for p in json.load(open(f)): new[p['q']] = p
picks = {}
for q, p in old.items():
    n = new.get(q, {'fits': [], 'near': []})
    picks[q] = {'fits': set(p['fits']) | set(n['fits']), 'near': (set(p['near']) | set(n['near'])) - set(n['fits'])}
OPEN = dict(said=0.75, covers=0.5, score=0.6, margin=0.08)
def router(r, unmeant=float(os.environ.get('UM', '0.15'))):
    top = r['top']
    if not top: return None
    b = top[0]; n = top[1] if len(top) > 1 else None
    if b['said'] < OPEN['said'] or b['covers'] < OPEN['covers'] or b['score'] < OPEN['score']: return None
    if n and b['score'] - n['score'] < OPEN['margin'] and n['said'] >= OPEN['said']: return None
    p = {m['id']: m['p'] for m in r['meant']}
    return b['id'] if p.get(b['id'], 0) >= unmeant else None
def route(r, hi, lo, ratio):
    if r['exact']: return r['exact']
    m = r['meant']
    if m:
        p1 = m[0]['p']; p2 = m[1]['p'] if len(m) > 1 else 0
        if p1 >= hi or (p1 >= lo and p1 >= ratio * p2): return m[0]['id']
    return router(r)
def ev(name, rt, f):
    c = collections.Counter()
    for q, p in picks.items():
        r = rt.get(q)
        if not r or r['care']: continue
        o = f(r); c['n'] += 1
        top = [m['id'] for m in r['meant'][:3]]
        c['top1'] += bool(top) and top[0] in p['fits']; c['top3'] += any(i in p['fits'] for i in top)
        c['canfit'] += bool(p['fits'])
        if not o: continue
        c['open'] += 1; c['right'] += o in p['fits']; c['near'] += o in p['near']; c['wrong'] += o not in p['fits'] and o not in p['near']
    print(f"{name:40s} open {c['open']:4d} right {c['right']:4d} ({c['right']/max(1,c['open']):.0%}) near {c['near']:3d} wrong {c['wrong']:3d} | top1 {c['top1']} top3 {c['top3']} fit-able {c['canfit']} of {c['n']}")
for nm in sys.argv[2:]:
    rt = {r['q']: r for r in json.load(open(nm))}
    ev(os.path.basename(nm) + ' as built', rt, lambda r: r['exact'] or r['open'])
    for hi in [float(x) for x in os.environ.get('HI','0.3,0.35').split(',')]:
        for lo, ratio in [tuple(map(float, x.split(':'))) for x in os.environ.get('LR','1:0,0.25:1.5,0.25:2,0.2:2,0.2:2.5,0.15:3').split(',')]:
            ev(f'  hi {hi} lo {lo} ratio {ratio}', rt, lambda r, hi=hi, lo=lo, ratio=ratio: route(r, hi, lo, ratio))
