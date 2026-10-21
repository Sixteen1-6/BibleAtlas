#!/usr/bin/env python3
"""tighten_pick2.py <dest.json> <per group> <finalized out dir>=<keys.json> ...
Groups of chosen notes for tighten2.js, each cite with the quote row that backs that very note
(rows carry "note" after finalize.py). keys.json: a list of {passage, layer}."""
import json, sys
dest, per = sys.argv[1], int(sys.argv[2])
items = []
for arg in sys.argv[3:]:
    out, kf = arg.split('=', 1)
    keys = {(x['passage'], x['layer']) for x in json.load(open(kf))}
    ps = json.load(open(f'{out}/new-passages.json'))['passages'] + json.load(open(f'{out}/held-back.json'))['passages']
    q = {}
    for x in json.load(open(f'{out}/quotes.json')):
        q.setdefault((x['where'], x['note'], x['source'], x['on']), x['quote'])
    for p in ps:
        for i, l in enumerate(p['layers']):
            if (p['id'], i) not in keys:
                continue
            cites = [{'n': j, **c, 'quote': q.get((p['ref'], i, c['source'], c['on']), '(quote not on file)')} for j, c in enumerate(l['cites'])]
            note = {k: v for k, v in l.items() if k != 'cites'}
            items.append({'passage': p['id'], 'ref': p['ref'], 'saying': p['saying'], 'layer': i, 'note': note, 'cites': cites})
            keys.discard((p['id'], i))
    if keys:
        print('not found in', out, sorted(keys))
groups = [items[k:k + per] for k in range(0, len(items), per)]
json.dump(groups, open(dest, 'w'), ensure_ascii=False, indent=1)
missing = sum(1 for g in groups for n in g for c in n['cites'] if c['quote'] == '(quote not on file)')
print(len(items), 'notes in', len(groups), 'groups;', missing, 'cites with no quote')
