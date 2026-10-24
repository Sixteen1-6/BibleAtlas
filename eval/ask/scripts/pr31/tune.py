import json, itertools, sys
L=json.load(open(sys.argv[2] if len(sys.argv)>2 else 'labels-q1.json'))
R=json.load(open(sys.argv[1]))
def ok(b,a1,b1,d,c,m,n):
    pas = (b['said']>=a1 and b['covers']>=b1) or (b['covers']>=0.99 and b['said']>=d) or (b['said']>=0.99 and b['covers']>=c)
    if not pas: return False
    if n and b['score']-n['score']<m and n['said']>=0.75: return False
    return True
def run(P):
    g=nr=no=unk=0
    for r in R:
        t=r['top']
        if not t: continue
        b=t[0]; n=t[1] if len(t)>1 else None
        if not ok(b,*P,n): continue
        v=L.get(r['q'],{}).get(b['id'],'?')
        if v=='fits': g+=1
        elif v=='near': nr+=1
        elif v=='no': no+=1
        else: unk+=1
    return g,nr,no,unk
res=[]
for P in itertools.product([0.75,0.8,0.85],[0.5,0.6],[0.5,0.55,0.6,0.65,0.7,1.1],[0.2,0.3,0.4,0.5,1.1],[0.04,0.08]):
    res.append((run(P),P))
for x in sorted(res,key=lambda x:-(x[0][0]-4*x[0][2]-0.5*x[0][1]))[:15]: print(x)
print('base', run((0.8,0.5,1.1,1.1,0.08)))
