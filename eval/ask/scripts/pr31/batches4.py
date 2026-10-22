import json, sys, os
"""batches4.py outdir n skip runs...: blind batches of every shown verse (chain or gathered) in the runs, questions after the first `skip`."""
out, n, skip = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
runs = sys.argv[4:]
Q, order = {}, []
for f in runs:
    for r in json.load(open(f))[skip:]:
        if r['how'] == 'care': continue
        if r['q'] not in Q: Q[r['q']] = {}; order.append(r['q'])
        for t in r['shown'][:8]:
            Q[r['q']].setdefault(t['ref'], (t['v'], t.get('context') or t['text'], t['text']))
items = [{'q': q, 'kind': 'live', 'verses': [{'ref': ref, 'shown': s, 'context': c} for ref, (v, c, s) in sorted(Q[q].items(), key=lambda x: x[1][0])]} for q in order if Q[q]]
os.makedirs(out, exist_ok=True)
for b in range(n):
    json.dump(items[b::n], open(f'{out}/batch-{b+1}.json', 'w'), indent=1)
print(len(items), 'questions', sum(len(x['verses']) for x in items), 'verses in', n, 'batches')
