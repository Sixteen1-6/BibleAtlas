import json, collections, sys
picks=json.load(open('picks.json'))
rt={r['q']:r for r in json.load(open(sys.argv[1] if len(sys.argv)>1 else 'rt-pool-nn.json'))}
def ev(name, f):
    c=collections.Counter()
    for q,p in picks.items():
        if q not in rt: continue
        o=f(rt[q])
        if not o: continue
        c['open']+=1; c['right']+=o in p['fits']; c['near']+=o in p['near']; c['wrong']+= o not in p['fits'] and o not in p['near']
    print(f"{name:45s} open {c['open']:4d} right {c['right']:4d} ({c['right']/max(1,c['open']):.0%}) near {c['near']:3d} wrong {c['wrong']:3d}")
ev('implemented route (MEANT .7)', lambda r: r['exact'] or r['open'])
def m(r,t): return r['meant'][0]['id'] if r['meant'] and r['meant'][0]['p']>=t else None
for t in (0.3,0.35,0.4,0.45,0.5):
    ev(f'exact, meant>={t}', lambda r,t=t: r['exact'] or m(r,t))
    ev(f'exact, meant>={t}, router if its p>=.15', lambda r,t=t: r['exact'] or m(r,t) or (r['open'] if r['open'] and any(x['id']==r['open'] and x['p']>=0.15 for x in r['meant']) else None))
