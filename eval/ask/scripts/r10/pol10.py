"""pol10.py set(dev2|dev3|dev4) run.json...: routing scores on labelled dev messages.
The matcher opens its top answer if p1 >= the threshold for this text (HM when the
model voted on it, HW when not); else the word router (UM: its meaning floor)."""
import json, collections, sys, glob, os
S = os.path.dirname(os.path.abspath(__file__)) + '/..'
name = sys.argv[1]
picks = {}
if name == 'dev4':
    for q, p in json.load(open(f'{S}/r9/lab/picks.json')).items():
        picks[q] = {'fits': set(p['fits']), 'near': set(p['near']) - set(p['fits'])}
else:
    old = json.load(open({'dev2': f'{S}/r6/dev2/picks.json', 'dev3': f'{S}/g7/dev3/picks.json'}[name]))
    new = {}
    for f in glob.glob(f'{S}/r7/relabel/out-*.json'):
        for p in json.load(open(f)): new[p['q']] = p
    for q, p in old.items():
        n = new.get(q, {'fits': [], 'near': []})
        picks[q] = {'fits': set(p['fits']) | set(n['fits']), 'near': (set(p['near']) | set(n['near'])) - set(n['fits'])}
OPEN = dict(said=0.75, covers=0.5, score=0.6, margin=0.08)
def router(r, unmeant):
    top = r['top']
    if not top: return None
    b = top[0]; n = top[1] if len(top) > 1 else None
    if b['said'] < OPEN['said'] or b['covers'] < OPEN['covers'] or b['score'] < OPEN['score']: return None
    if n and b['score'] - n['score'] < OPEN['margin'] and n['said'] >= OPEN['said']: return None
    p = {m['id']: m['p'] for m in r['meant']}
    return b['id'] if (p.get(b['id'], 0) if r['meant'] else 1) >= unmeant else None
def route(r, hm, hw, um):
    if r['exact']: return r['exact']
    m = r['meant']
    if m and m[0]['p'] >= (hm if r.get('used') else hw): return m[0]['id']
    return router(r, um)
def ev(label, rt, f):
    c = collections.Counter()
    for q, p in picks.items():
        r = rt.get(q)
        if not r or r['care']: continue
        o = f(r); c['n'] += 1
        top = [m['id'] for m in r['meant'][:3]]
        c['top1'] += bool(top) and top[0] in p['fits']; c['top3'] += any(i in p['fits'] for i in top)
        c['canfit'] += bool(p['fits']); c['used'] += bool(r.get('used'))
        if not o: continue
        c['open'] += 1; c['right'] += o in p['fits']; c['near'] += o in p['near']; c['wrong'] += o not in p['fits'] and o not in p['near']
    print(f"{label:34s} open {c['open']:4d} right {c['right']:4d} ({c['right']/max(1,c['open']):.0%}) near {c['near']:3d} wrong {c['wrong']:3d} | top1 {c['top1']} top3 {c['top3']} fit-able {c['canfit']} of {c['n']} model {c['used']}")
for nm in sys.argv[2:]:
    rt = {r['q']: r for r in json.load(open(nm))}
    ev(os.path.basename(nm) + ' as built', rt, lambda r: r['exact'] or r['open'])
    for hm in [float(x) for x in os.environ.get('HM', '0.2,0.25,0.3,0.35').split(',')]:
        for hw in [float(x) for x in os.environ.get('HW', '0.35').split(',')]:
            for um in [float(x) for x in os.environ.get('UM', '0.15').split(',')]:
                ev(f'  model {hm} words {hw} floor {um}', rt, lambda r, hm=hm, hw=hw, um=um: route(r, hm, hw, um))
