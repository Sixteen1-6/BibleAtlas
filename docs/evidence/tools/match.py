# match a text against archive.org OCR texts by 7-word shingles (hashed), small LRU cache
import re,os,unicodedata,collections
import sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE
IA=os.path.join(CACHE,'ia')
K=7
def norm_words(s):
    s=s.replace('-\n','').replace('- \n','').replace('­','')
    s=unicodedata.normalize('NFKD',s)
    s=''.join(c for c in s if not unicodedata.combining(c))
    s=s.lower().replace('’',"'").replace("'",'')
    return re.findall(r'[a-z]+',s)
_cache=collections.OrderedDict()
MAX=8
def load(i):
    if i in _cache:
        _cache.move_to_end(i); return _cache[i]
    w=norm_words(open(os.path.join(IA,i+'.txt'),encoding='utf-8',errors='replace').read())
    sh=set(hash(' '.join(w[k:k+K])) for k in range(len(w)-K+1))
    _cache[i]=(None,sh)
    while len(_cache)>MAX: _cache.popitem(last=False)
    return _cache[i]
def shingles(words): return [' '.join(words[k:k+K]) for k in range(len(words)-K+1)]
def score(textstr,ids):
    w=norm_words(textstr); sh=shingles(w); hs=[hash(s) for s in sh]
    res=[]
    for i in ids:
        _,S=load(i)
        hit=[h in S for h in hs]
        n=sum(hit)
        best=(0,0);cur=0;start=0
        for k,h in enumerate(hit):
            if h:
                if cur==0: start=k
                cur+=1
                if cur>best[0]: best=(cur,start)
            else: cur=0
        run=' '.join(w[best[1]:best[1]+best[0]+K-1]) if best[0] else ''
        res.append((i,n,len(sh),round(n/max(1,len(sh)),3),run))
    res.sort(key=lambda r:(-r[3],-r[1]))
    return res
