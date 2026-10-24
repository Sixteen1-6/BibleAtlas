import json,collections,sys
D=__import__('os').environ['ASK_WORK'] + '/scratchpad/r6'
V={}
for t in sys.argv[1:]:
    o=json.load(open(f'{D}/../../tasks/{t}.output')); r=o.get('result',o)
    if isinstance(r,str): r=json.loads(r)
    for x in r['results']:
        for v in x['verses']: V[(x['q'],v['ref'])]=v['verdict']
def load(n):
    out={}
    for r in json.load(open(f'{D}/{n}.json')):
        sh=r['shown'][:6]; vs=[V.get((r['q'],t['ref'])) for t in sh]
        out[r['q']]=(r['how'],r.get('title') or r.get('opened') or '',vs.count('answers'),vs.count('off'),len(vs))
    return out
b,n=load('blind-base'),load('blind-new')
moved=collections.Counter()
better=worse=0
for q in b:
    hb,tb,ab,ob,_=b[q]; hn,tn,an,on,_=n[q]
    moved[(hb,hn)]+=1
    if (ab>0)!=(an>0) or abs(ob-on)>=3:
        print(f"{'+' if an>ab or on<ob else '-'} {hb}->{hn} ans {ab}->{an} off {ob}->{on} | {q[:80]} | {tb[:40]} -> {tn[:40]}")
print(moved)
