import json,collections,sys,glob
D=__import__('os').environ['ASK_WORK'] + '/scratchpad/r9'
V={}
for t in sys.argv[1:]:
    o=json.load(open(f'{D}/../../tasks/{t}.output')); r=o.get('result',o)
    if isinstance(r,str): r=json.loads(r)
    for x in r['results']:
        for v in x['verses']: V[(x['q'],v['ref'])]=v['verdict']
print(len(V),'verdicts')
for name in ('bf10-base','bf10-new'):
    rows=json.load(open(f'{D}/{name}.json'))
    c=collections.Counter(); by=collections.defaultdict(collections.Counter)
    for r in rows:
        if r['how']=='care': continue
        sh=r['shown'][:6]; vs=[V.get((r['q'],t['ref'])) for t in sh]
        kind='routed' if r['how'] in ('routed','exact') else 'gathered'
        for k,cc in (('all',c),(kind,by[kind])):
            cc['q']+=1; cc['shown']+=len(sh); cc['answered']+=('answers' in vs); cc['off']+=vs.count('off'); cc['related']+=vs.count('related'); cc['ans']+=vs.count('answers'); cc['missing']+=vs.count(None)
    print(name, dict(c))
    for k in ('routed','gathered'): print('   ',k, dict(by[k]), f"off {by[k]['off']/max(1,by[k]['shown']):.0%}")
