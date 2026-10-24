"""Every (message, verse) verdict judged in any round, from eval/ask/verdicts."""
import json, glob, gzip, collections, sys, os
R = os.environ.get('ATLAS_REPO', '.') + '/eval/ask/verdicts'
def load(p):
    if p.endswith('.gz'):
        return json.load(gzip.open(p))
    return json.load(open(p))
votes = collections.defaultdict(collections.Counter)
files = 0
for p in sorted(glob.glob(R + '/**/*verdicts*.json*', recursive=True)):
    if 'batches' in p: continue
    d = load(p)
    r = d['results'] if isinstance(d, dict) and 'results' in d else d
    if not isinstance(r, list): continue
    files += 1
    for x in r:
        if not isinstance(x, dict) or 'verses' not in x: continue
        q = x['q'].strip().lower()
        for v in x['verses'] or []:
            if isinstance(v, dict) and v.get('verdict') in ('answers', 'related', 'off'):
                votes[(q, v['ref'])][v['verdict']] += 1
ORDER = {'off': 0, 'related': 1, 'answers': 2}
cache = {}
for k, c in votes.items():
    best = max(c.items(), key=lambda kv: (kv[1], -ORDER[kv[0]]))[0]  # ties go to the lower verdict
    cache[k[0] + '\t' + k[1]] = best
qs = {k.split('\t')[0] for k in cache}
print('files', files, 'pairs', len(cache), 'messages', len(qs), collections.Counter(cache.values()))
json.dump(cache, open('cache.json', 'w'))
