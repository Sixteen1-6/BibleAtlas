import json, sys, os
"""batches.py outdir n --runs a.json b.json ... --known v1.json ...: blind batches of every top-8 live verse not yet judged."""
out, n = sys.argv[1], int(sys.argv[2])
i = sys.argv.index('--runs'); j = sys.argv.index('--known') if '--known' in sys.argv else len(sys.argv)
runs, known = sys.argv[i+1:j], sys.argv[j+1:]
K = {}
for f in known:
    for r in json.load(open(f)):
        e = K.setdefault(r['q'], set())
        for v in r.get('verses', []): e.add(v['ref'])
Q = {}
order = []
for f in runs:
    for r in json.load(open(f)):
        if r.get('chain') or r.get('care'): continue
        if r['q'] not in Q: Q[r['q']] = {}; order.append(r['q'])
        for t in r['top'][:8]:
            if t['ref'] in K.get(r['q'], set()): continue
            Q[r['q']].setdefault(t['ref'], (t['v'], t.get('context') or t['text']))
items = [{'q': q, 'kind': 'live', 'verses': [{'ref': ref, 'context': c} for ref, (v, c) in sorted(Q[q].items(), key=lambda x: x[1][0])]} for q in order if Q[q]]
os.makedirs(out, exist_ok=True)
for b in range(n):
    json.dump(items[b::n], open(f'{out}/batch-{b+1}.json', 'w'), indent=1)
print(len(items), 'questions', sum(len(x['verses']) for x in items), 'verses in', n, 'batches')
