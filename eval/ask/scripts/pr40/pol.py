import json,collections,sys
picks=json.load(open('picks.json'))
OPEN=dict(said=0.75,covers=0.5,score=0.6,margin=0.08)
def router(r, unmeant):
    top=r['top']
    if not top: return None
    b=top[0]; n=top[1] if len(top)>1 else None
    if b['said']<OPEN['said'] or b['covers']<OPEN['covers'] or b['score']<OPEN['score']: return None
    if n and b['score']-n['score']<OPEN['margin'] and n['said']>=OPEN['said']: return None
    p={m['id']:m['p'] for m in r['meant']}
    return b['id'] if p.get(b['id'],0)>=unmeant else None
def route(r,meant,unmeant):
    if r['exact']: return r['exact']
    if r['meant'] and r['meant'][0]['p']>=meant: return r['meant'][0]['id']
    return router(r,unmeant)
def ev(name,rt,f):
    c=collections.Counter()
    for q,p in picks.items():
        r=rt.get(q)
        if not r or r['care']: continue
        o=f(r); c['n']+=1
        top3=[m['id'] for m in r['meant'][:3]]
        c['top3fit']+=any(i in p['fits'] for i in top3)
        c['top1fit']+=bool(top3) and top3[0] in p['fits']
        if not o: continue
        c['open']+=1; c['right']+=o in p['fits']; c['near']+=o in p['near']; c['wrong']+=o not in p['fits'] and o not in p['near']
    print(f"{name:34s} open {c['open']:4d} right {c['right']:4d} ({c['right']/max(1,c['open']):.0%}) near {c['near']:3d} wrong {c['wrong']:3d} | top1 fit {c['top1fit']} top3 fit {c['top3fit']} of {c['n']}")
for nm in sys.argv[1:]:
    rt={r['q']:r for r in json.load(open(nm))}
    ev(nm+' as built',rt,lambda r:r['exact'] or r['open'])
    for t in (0.25,0.3,0.35,0.4,0.45,0.5):
        for u in (0.15,):
            ev(f'  meant>={t} unmeant {u}',rt,lambda r,t=t,u=u:route(r,t,u))
