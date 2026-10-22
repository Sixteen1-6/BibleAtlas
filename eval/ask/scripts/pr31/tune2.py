import json, itertools, sys
"""tune2.py routes.json labels.json: opens under the current rule plus a strong-way rule (a whole way said, weighing W or more)."""
R=json.load(open(sys.argv[1])); L=json.load(open(sys.argv[2]))
def opens(r, A=0.75, B=0.5, C=0.6, M=0.08, W=99, D=0.0, M2=0.08):
    t=r['top']
    if r.get('care'): return None
    if r.get('exact'): return r['exact']
    if not t: return None
    b=t[0]; n=t[1] if len(t)>1 else None
    ok=b['said']>=A and b['covers']>=B and b['score']>=C
    if ok and n and b['score']-n['score']<M and n['said']>=A: ok=False
    if not ok and b['said']>=0.99 and b['weight']>=W and b['covers']>=D:
        ok=True
        # another whole way said, nearly as heavy
        if n and n['said']>=0.99 and n['weight']>=b['weight']-M2*10 and n['score']>b['score']-M2: ok=False
    return b['id'] if ok else None
def run(**P):
    c={'fits':0,'near':0,'no':0,'?':0}
    for r in R:
        o=opens(r,**P)
        if o: c[L.get(r['q'],{}).get(o,'?')]+=1
    return c
print('base', run())
for W in [5,6,7,8,9,10,12]:
    for D in [0,0.15,0.25,0.35]:
        print(W, D, run(W=W,D=D))
