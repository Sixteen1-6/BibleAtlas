# findvol.py SOURCEID BHCODE ROOT id1 id2 ... : for each cited book, sample shingles from one Bible Hub chapter and count hits per volume via normalized text search
import sys,os,json,re,random,collections
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import bh,match
from _paths import CACHE
N=os.path.join(CACHE,'norm')
sid,code,root=sys.argv[1:4]; ids=sys.argv[4:]
norm={}
for i in ids:
    p=os.path.join(N,i+'.txt')
    if not os.path.exists(p):
        w=match.norm_words(open(os.path.join(match.IA,i+'.txt'),encoding='utf-8',errors='replace').read())
        open(p,'w').write(' '.join(w))
    norm[i]=open(p).read()
d=json.load(open(root+'/config/layers.json',encoding='utf-8'))
chs=collections.defaultdict(collections.Counter)
for p in d['passages']:
    for l in p['layers']:
        for c in l.get('cites',[]):
            if c['source']!=sid or not c.get('on'): continue
            m=re.match(r'^((?:[123] )?[A-Za-z ]+?) (\d+)',c['on']); b=m.group(1); b='Psalms' if b=='Psalm' else b
            chs[b][int(m.group(2))]+=1
random.seed(1)
out={}
for b in chs:
    ch=chs[b].most_common(1)[0][0]
    w=match.norm_words(bh.text(bh.fetch(code,b,ch)))
    sh=[' '.join(w[k:k+match.K]) for k in range(0,max(1,len(w)-match.K),max(1,len(w)//60))][:60]
    cnt={i:sum(1 for s in sh if s in norm[i]) for i in ids}
    top=sorted(cnt.items(),key=lambda x:-x[1])[:3]
    out[b]=top
    print(b,ch,len(sh),top,flush=True)
json.dump(out,open(os.path.join(CACHE,'res',sid+'_vols.json'),'w'),indent=1)
