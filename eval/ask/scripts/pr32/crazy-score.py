import json, sys, collections, glob
"""score.py: per version (new/live), answering/related/off verses and questions with an answering verse, from the blind verdicts."""
J = {}
for f in glob.glob('judged-*.json'):
    for x in json.load(open(f)):
        for r in x['results'] or []: J[r['q']] = r
kinds = {x['q']: x['kind'] for x in json.load(open('crazy.json'))}
for name in ['live', 'new']:
    run = {r['q']: r for r in json.load(open(f'{name}.json'))}
    c = collections.Counter(); qa = collections.Counter(); qn = collections.Counter(); first = collections.Counter()
    for q, r in run.items():
        if q not in J or r['how'] == 'care': continue
        v = {x['ref']: x['verdict'] for x in J[q]['verses']}
        k = kinds.get(q)
        shown = [t['ref'] for t in r['shown'][:8]]
        vs = [v.get(s, '?') for s in shown]
        c.update(vs); qn[k] += 1
        if 'answers' in vs: qa[k] += 1
        if vs and vs[0] == 'answers': first[k] += 1
    print(name, dict(c), 'questions with an answering verse', sum(qa.values()), 'of', sum(qn.values()), dict(sorted(qa.items())), 'first verse answers', sum(first.values()))
