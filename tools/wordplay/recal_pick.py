#!/usr/bin/env python3
"""Pick notes whose strength outruns their cited writers: recal_pick.py <new-passages.json> <out.json> <groups>"""
import json, sys
ps = json.load(open(sys.argv[1]))['passages']
def writer(s): return 'bullinger' if s.startswith('bullinger') else s
items = []
for p in ps:
    for i, l in enumerate(p['layers']):
        if l['kind'] == 'plain meaning':
            continue
        n = len({writer(c['source']) for c in l['cites']})
        if (l['strength'] == 'commonly held' and n < 2) or (l['strength'] == 'widely agreed' and n < 3):
            items.append({'passage': p['id'], 'ref': p['ref'], 'layer': i, 'writers_cited': n, 'note': l})
g = int(sys.argv[3])
groups = [items[k::g] for k in range(g)]
json.dump(groups, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(items), 'notes in', [len(x) for x in groups])
