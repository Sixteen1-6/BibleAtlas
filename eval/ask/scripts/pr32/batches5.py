import json, sys, os
"""batches5.py outdir n verdicts.json[,verdicts.json...] runs...: blind batches of the shown verses not yet judged."""
out, n, vfiles = sys.argv[1], int(sys.argv[2]), sys.argv[3].split(',')
runs = sys.argv[4:]
seen = set()
for f in vfiles:
    o = json.load(open(f))
    if isinstance(o, dict): o = o.get('result', o)
    if isinstance(o, dict): o = o.get('results', o)
    for r in o:
        for v in r.get('verses', []): seen.add((r['q'], v['ref']))
Q, order = {}, []
for f in runs:
    for r in json.load(open(f)):
        if r['how'] == 'care': continue
        for t in r['shown'][:8]:
            if (r['q'], t['ref']) in seen: continue
            if r['q'] not in Q: Q[r['q']] = {}; order.append(r['q'])
            Q[r['q']].setdefault(t['ref'], (t['v'], t.get('context') or t['text'], t['text']))
items = [{'q': q, 'kind': 'live', 'verses': [{'ref': ref, 'shown': s, 'context': c} for ref, (v, c, s) in sorted(Q[q].items(), key=lambda x: x[1][0])]} for q in order if Q[q]]
os.makedirs(out, exist_ok=True)
for b in range(n):
    json.dump(items[b::n], open(f'{out}/batch-{b+1}.json', 'w'), indent=1)
print(len(items), 'questions', sum(len(x['verses']) for x in items), 'verses in', n, 'batches')
