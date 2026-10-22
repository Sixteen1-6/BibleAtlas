import json,collections,sys
D=__import__('os').environ['ASK_WORK'] + '/scratchpad/r11'
V={}
for t in sys.argv[1:]:
    o=json.load(open(f'{D}/../../tasks/{t}.output')); r=o.get('result',o)
    if isinstance(r,str): r=json.loads(r)
    for x in r['results']:
        for v in x['verses']: V[(x['q'],v['ref'])]=v['verdict']
print(len(V),'verdicts')
per={}
for name in ('bf11-main','bf11-branch'):
    rows=json.load(open(f'{D}/{name}.json'))
    c=collections.Counter(); by=collections.defaultdict(collections.Counter)
    for r in rows:
        if r['how']=='care': continue
        sh=r['shown'][:6]; vs=[V.get((r['q'],t['ref'])) for t in sh]
        per.setdefault(r['q'],{})[name]=(r['how'],r.get('answer') or r.get('routed') or '',vs)
        kind='routed' if r['how'] in ('routed','exact') else 'gathered'
        for k,cc in (('all',c),(kind,by[kind])):
            cc['q']+=1; cc['shown']+=len(sh); cc['answered']+=('answers' in vs); cc['off']+=vs.count('off'); cc['related']+=vs.count('related'); cc['ans']+=vs.count('answers'); cc['missing']+=vs.count(None)
    print(name, dict(c), f"off {c['off']/max(1,c['shown']):.1%}")
    for k in ('routed','gathered'): print('   ',k, dict(by[k]), f"off {by[k]['off']/max(1,by[k]['shown']):.0%}")
# questions where the two sides differ
w=l=0
for q,s in per.items():
    if len(s)<2: continue
    a=s['bf11-main'][2]; b=s['bf11-branch'][2]
    if a==b: continue
    sa=('answers' in a, -a.count('off')); sb=('answers' in b, -b.count('off'))
    if sb>sa: w+=1
    elif sa>sb: l+=1
print('differing questions: branch better',w,'main better',l)
