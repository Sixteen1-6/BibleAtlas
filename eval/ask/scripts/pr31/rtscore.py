import json, sys
V={}
for r in json.load(open('j1/verdicts.json')):
    if r.get('opens'): V[r['q']]=r['opens']
R=json.load(open(sys.argv[1]))
runs={r['q']:r for r in json.load(open('r5-all.json'))}
ok=bad=miss=extra=0
for r in R:
    want=V.get(r['q']) or (runs.get(r['q'],{}).get('chain'))
    if r['open'] and want and r['open']==want: ok+=1
    elif r['open'] and want and r['open']!=want: bad+=1; print('WRONG', r['q'], r['open'], 'want', want, r['top'][:2])
    elif r['open'] and not want: extra+=1; print('EXTRA', r['q'], r['open'], r['top'][0])
    elif want and not r['open']: miss+=1; print('MISS', r['q'], 'want', want, r['top'][:1])
print('ok',ok,'wrong',bad,'extra',extra,'missed',miss)
