"""quotes.py pool.json: messages that quote a run of verse words (BSB, KJV or ASV), as a quote finder would."""
import json, re, sys, collections
D='/home/claude/bibleatlas/web/public/data/'
def toks(s): return re.findall(r"[a-z0-9]+", s.lower().replace("’","").replace("'",""))
texts={'BSB':open(D+'bsb.txt').read().split('\n'),'KJV':open(D+'search/kjv.txt').read().split('\n'),'ASV':open(D+'search/asv.txt').read().split('\n')}
STOP=set('the a an and of to in that is it i you he she we they my me your his her for on with as at be was were are but not or so this what if do does did have has had will would shall can could should from by all no there their them then than who whom which when where how why unto thee thou thy thine ye him us our its am been being into out up said say says lord god'.split())
N=int(sys.argv[2]) if len(sys.argv)>2 else 5
# n-gram index
idx=collections.defaultdict(set)
for name,ls in texts.items():
    for v,l in enumerate(ls):
        t=toks(l)
        for i in range(len(t)-N+1): idx[' '.join(t[i:i+N])].add(v)
out=[]
for m in json.load(open(sys.argv[1])):
    q=m['q'] if isinstance(m,dict) else m
    t=toks(q); hits=collections.Counter()
    for i in range(len(t)-N+1):
        g=t[i:i+N]
        if sum(1 for w in g if w not in STOP)<2: continue
        vs=idx.get(' '.join(g))
        if vs and len(vs)<=3:
            for v in vs: hits[v]+=1
    if hits: out.append({'q':q,'verses':sorted(hits, key=lambda v:-hits[v])[:3], 'runs':max(hits.values())})
json.dump(out,open(sys.argv[1].replace('.json','')+f'-quotes{N}.json','w'),ensure_ascii=False)
print(len(out),'of messages quote')
