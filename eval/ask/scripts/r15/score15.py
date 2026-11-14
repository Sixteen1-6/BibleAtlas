"""score15.py cache.json run.json [run.json ...]: first 6 shown per message scored by the cache: answered,
answers, related, off, unjudged; ONLY=file restricts to the messages listed there."""
import json, sys, os, collections
cache = json.load(open(sys.argv[1]))
only = set(q.strip().lower() for q in json.load(open(os.environ['ONLY']))) if os.environ.get('ONLY') else None
for f in sys.argv[2:]:
    c = collections.Counter()
    for r in json.load(open(f)):
        if only is not None and r['q'].strip().lower() not in only: continue
        if r['how'] == 'care': continue
        ls = [cache.get(r['q'].strip().lower() + '\t' + v['ref']) for v in r['shown'][:6]]
        c['n'] += 1; c['answered'] += 'answers' in ls; c['answers'] += ls.count('answers'); c['related'] += ls.count('related'); c['off'] += ls.count('off'); c['unj'] += ls.count(None)
    print(os.path.basename(f), dict(c))
