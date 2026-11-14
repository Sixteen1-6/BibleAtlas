"""merge15.py cache.json out.json result.json [result.json ...]: add the verdicts of judging Workflows (their
task output files, or {"results": [...]} files) to the cache, keeping any verdict already there; prints counts."""
import json, sys, collections
cache = json.load(open(sys.argv[1]))
added = collections.Counter()
for f in sys.argv[3:]:
    d = json.load(open(f))
    r = d.get('result', d)
    if isinstance(r, str): r = json.loads(r)
    for x in r['results']:
        for v in x['verses']:
            k = x['q'].strip().lower() + '\t' + v['ref']
            if k in cache: added['kept'] += 1; continue
            cache[k] = v['verdict']; added[v['verdict']] += 1
json.dump(cache, open(sys.argv[2], 'w'))
print(dict(added), 'cache', len(cache))
