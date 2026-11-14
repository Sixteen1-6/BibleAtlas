"""live14.py run.json [run.json ...]: first 6 gathered verses per message scored by cache.json (+ extra.json
if present): answered, answers, related, off, unjudged."""
import json, sys, collections, os
cache = json.load(open('cache.json'))
if os.path.exists('extra.json'): cache.update(json.load(open('extra.json')))
for f in sys.argv[1:]:
    c = collections.Counter()
    for r in json.load(open(f)):
        ls = [cache.get(r['q'].strip().lower() + '\t' + v['ref']) for v in r['shown'][:6]]
        c['n'] += 1; c['answered'] += 'answers' in ls; c['answers'] += ls.count('answers'); c['related'] += ls.count('related'); c['off'] += ls.count('off'); c['unj'] += ls.count(None)
    print(f, dict(c))
