import json,sys
d=sys.argv[1]
P=json.load(open(d+'/new-passages.json'))['passages']; A=json.load(open(d+'/additions.json'))
if isinstance(A,dict): A=A.get('additions',[])
for p in P+A:
    print('==',p.get('id') or p.get('passage_id'), p.get('ref'), '|', p.get('saying',''))
    for l in p['layers']:
        if l['kind']=='plain meaning': continue
        ex={k:l[k] for k in ('figure_name','figure_words','stands_for','relation','lines','people') if k in l}
        print(' -',l['kind'],'/',l['strength'],ex)
        print('   T:',l['text'])
        print('   E:',l.get('evidence'))
        print('   C:',[(c['source'],c['on'],(c.get('at') or '')[:50]) for c in l['cites']])
