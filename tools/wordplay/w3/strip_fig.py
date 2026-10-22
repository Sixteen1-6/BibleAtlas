#!/usr/bin/env python3
"""strip_fig.py <out dir>: from 2026-10-22 figure, parallelism and contrast notes go in config/figures (the Layers
thread's format), not config/layers.json. Moves any such layer in a hand-off folder's new passages and additions to
moved-to-figures.json, drops its quote rows and renumbers the passage's later rows. A passage left without a note
beyond the plain meaning that is not "some interpreters" moves to held-back.json."""
import json, os, sys
out = sys.argv[1]
FIG = {'figure', 'parallelism', 'contrast'}
load = lambda n, d: json.load(open(f'{out}/{n}')) if os.path.exists(f'{out}/{n}') else d
new = load('new-passages.json', {'passages': []})
held = load('held-back.json', {'passages': []})
adds = load('additions.json', [])
quotes = load('quotes.json', [])
moved = load('moved-to-figures.json', [])
keep_new = []
for group, items, where_key in ((new, new['passages'], 'ref'), (held, held['passages'], 'ref')):
    for p in items:
        idx = [i for i, l in enumerate(p['layers']) if l['kind'] in FIG]
        for i in reversed(idx):
            moved.append({'passage': p['id'], 'ref': p['ref'], 'layer': p['layers'][i]})
            quotes = [q for q in quotes if not (q['where'] == p['ref'] and q.get('note') == i)]
            for q in quotes:
                if q['where'] == p['ref'] and isinstance(q.get('note'), int) and q['note'] > i:
                    q['note'] -= 1
            del p['layers'][i]
kept, demoted = [], []
for p in new['passages']:
    if any(l['kind'] != 'plain meaning' and l['strength'] != 'some interpreters' for l in p['layers']):
        kept.append(p)
    else:
        demoted.append(p)
new['passages'] = kept
held['passages'] += demoted
for a in adds:
    a['layers'] = [l for l in a['layers'] if not (l['kind'] in FIG and moved.append({'passage': a.get('passage_id'), 'ref': a['ref'], 'layer': l}) is None)]
adds = [a for a in adds if a['layers']]
json.dump(new, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump(held, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(adds, open(f'{out}/additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
json.dump(moved, open(f'{out}/moved-to-figures.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(moved)} layers moved to moved-to-figures.json; {len(demoted)} passages moved to held; {len(kept)} new passages, {len(quotes)} quote rows')
