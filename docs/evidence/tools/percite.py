# usage: percite.py ROOT SOURCEID BHCODE OUTJSON CANDJSON
# For every cite of SOURCEID, take Bible Hub's comment on the cited verse and match it against candidate OCR texts.
import sys,json,re,os,collections,html
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import bh,match
root,sid,code,out,candf=sys.argv[1:6]
cand=json.load(open(candf,encoding='utf-8'))
d=json.load(open(root+'/config/layers.json',encoding='utf-8'))
cites=[]
for p in d['passages']:
    for li,l in enumerate(p['layers']):
        for c in l.get('cites',[]):
            if c['source']!=sid or not c.get('on'): continue
            m=re.match(r'^((?:[123] )?[A-Za-z ]+?) (\d+)(?::(\d+))?',c['on'])
            b=m.group(1); b='Psalms' if b=='Psalm' else b
            cites.append({'passage':p['id'],'note':li,'on':c['on'],'at':c.get('at'),'book':b,'ch':int(m.group(2)),'v':int(m.group(3) or 1)})
def segments(h):
    # returns list of (verse, text) in page order
    parts=re.split(r'<div class="versenum">',h)
    segs=[]
    for part in parts[1:]:
        m=re.search(r'/(\d+)-(\d+)\.htm',part[:300])
        v=int(m.group(2)) if m else None
        body=part
        k=body.find('</div>',body.find('<div class="verse">')) if '<div class="verse">' in body[:400] else body.find('</div>')
        body=body[k+6:] if k>=0 else body
        body=re.sub(r'<script.*?</script>',' ',body,flags=re.S)
        body=re.sub(r'<(p|br|div)[^>]*>','\n',body); body=re.sub(r'<[^>]+>',' ',body)
        segs.append((v,html.unescape(body)))
    return segs
results=[]
cites.sort(key=lambda c:(c['book'],c['ch'],c['v']))
for c in cites:
    ids=cand.get(c['book'],cand.get('*',[]))
    h=bh.fetch(code,c['book'],c['ch'])
    segs=segments(h)
    seg=None
    for v,t in segs:
        if v is not None and v<=c['v']: seg=(v,t)
    if seg is None and segs: seg=segs[0]
    txt=seg[1] if seg else ''
    words=len(match.norm_words(txt))
    sc=match.score(txt,ids) if ids else []
    chap=None
    if words<60 and ids:
        chap=match.score(bh.text(h),ids)[0]
    r=dict(c); r.update({'url':bh.url(code,c['book'],c['ch']),'segment_verse':seg[0] if seg else None,'segment_words':words,
        'best':sc[0][0] if sc else None,'score':sc[0][3] if sc else None,'hits':sc[0][1] if sc else 0,'shingles':sc[0][2] if sc else 0,
        'second':(sc[1][0],sc[1][3]) if len(sc)>1 else None,'run':sc[0][4][:400] if sc else '','chapter_best':(chap[0],chap[3]) if chap else None})
    results.append(r)
    print(f"{c['on']:<22} seg v{r['segment_verse']} w{words:<5} {r['best']} {r['score']} 2nd {r['second']} chap {r['chapter_best']}",flush=True)
json.dump(results,open(out,'w',encoding='utf-8'),indent=1,ensure_ascii=False)
