import json,collections,sys,urllib.parse,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE
os.chdir(CACHE)
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
rows=json.load(open('res/true_authors_percite.json',encoding='utf-8'))
best={}
cnt=collections.Counter(); matched=collections.Counter()
for r in rows:
    if r['source'] not in ('barnes','ellicott','pulpit'): continue
    k=(r['source'],r['true_author']); cnt[k]+=1
    if r.get('matched_scan'): matched[k]+=1
    sc=r.get('segment_score') or 0
    run=r.get('matched_run') or ''
    if r.get('matched_scan') and len(run.split())>=14 and (k not in best or sc>best[k]['segment_score']):
        best[k]=r
out=[]
for k in sorted(cnt):
    r=best.get(k)
    if not r:
        out.append({'source':k[0],'true_author':k[1],'cites':cnt[k],'matched':matched[k]}); continue
    words=r['matched_run'].split()
    phrase=' '.join(words[3:13])
    out.append({'source':k[0],'true_author':k[1],'cites':cnt[k],'matched':matched[k],'example_on':r['on'],'bible_hub_url':r['bible_hub_url'],'scan':r['matched_scan'],'score':r['segment_score'],'phrase':phrase,
      'check_url':'https://archive.org/details/'+r['matched_scan']+'?q='+urllib.parse.quote('"'+phrase+'"')})
json.dump(out,open('res/true_authors_examples.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
for o in out: print(o['source'],'|',o['true_author'],'|',o['cites'],'matched',o['matched'],'|',o.get('example_on'),o.get('scan'),o.get('score'),'|',o.get('phrase'))
