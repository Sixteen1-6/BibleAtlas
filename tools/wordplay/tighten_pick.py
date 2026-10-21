#!/usr/bin/env python3
"""tighten_pick.py <out dir> <dest.json> <per group> [skip.json ...]: groups of notes with their cited quotes, for tighten.js.
skip files: lists of {passage, layer} (or groups of them) to leave out."""
import json, sys
out, dest, per = sys.argv[1], sys.argv[2], int(sys.argv[3])
skip = set()
for f in sys.argv[4:]:
    d = json.load(open(f))
    for x in d:
        for y in (x if isinstance(x, list) else [x]):
            skip.add((y['passage'], y['layer']))
ps = json.load(open(f'{out}/new-passages.json'))['passages']
q = {}
for x in json.load(open(f'{out}/quotes.json')):
    q.setdefault((x['where'], x['kind'], x['source'], x['on']), x['quote'])
items = []
for p in ps:
    for i, l in enumerate(p['layers']):
        if i == 0 or (p['id'], i) in skip:
            continue
        cites = [{'n': j, **c, 'quote': q.get((p['ref'], l['kind'], c['source'], c['on']), '(quote not on file)')} for j, c in enumerate(l['cites'])]
        note = {k: v for k, v in l.items() if k != 'cites'}
        items.append({'passage': p['id'], 'ref': p['ref'], 'saying': p['saying'], 'layer': i, 'note': note, 'cites': cites})
groups = [items[k:k + per] for k in range(0, len(items), per)]
json.dump(groups, open(dest, 'w'), ensure_ascii=False, indent=1)
print(len(items), 'notes in', len(groups), 'groups')
