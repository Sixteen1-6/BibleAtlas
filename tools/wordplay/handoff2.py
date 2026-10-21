#!/usr/bin/env python3
"""handoff2.py <dest dir> <prefix> <out dir>...: passages, additions and their quotes for the Layers thread.

Writes <prefix>-new-passages.json (sorted canonically), <prefix>-quotes.json (one row per note and cite,
each with "note": the index of the layer it backs, or "added N" / "added cite on <kind>"),
and, when present, <prefix>-additions.json and <prefix>-cite-additions.json.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq
dest, prefix, srcs = sys.argv[1], sys.argv[2], sys.argv[3:]


def load(d, name, default):
    try:
        return json.load(open(f'{d}/{name}'))
    except FileNotFoundError:
        return default


ps, adds, cadds, quotes = [], [], [], []
for d in srcs:
    ps += load(d, 'new-passages.json', {'passages': []})['passages']
    adds += load(d, 'additions.json', [])
    cadds += load(d, 'cite-additions.json', [])
    quotes += load(d, 'quotes.json', [])
ps.sort(key=lambda p: cq.parse(p['ref']))
ids = [p['id'] for p in ps]
assert len(ids) == len(set(ids)), 'repeated id'
live = set()
for p in ps:
    for li, l in enumerate(p['layers']):
        for c in l['cites']:
            live.add((p['ref'], li, c['source'], c['on']))
for a in adds:
    for li, l in enumerate(a['layers']):
        for c in l['cites']:
            live.add((a['ref'], f'added {li}', c['source'], c['on']))
for a in cadds:
    for c in a['add_cites']:
        live.add((a['ref'], f'added cite on {a["layer_kind"]}', c['source'], c['on']))
seen, uq = set(), []
for q in quotes:
    k = (q['where'], q['note'], q['source'], q['on'])
    if k in live and k not in seen:
        seen.add(k)
        uq.append(q)
missing = live - seen
uq.sort(key=lambda q: (cq.parse(q['where']), str(q['note'])))
os.makedirs(dest, exist_ok=True)
json.dump({'passages': ps}, open(f'{dest}/{prefix}-new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump(uq, open(f'{dest}/{prefix}-quotes.json', 'w'), ensure_ascii=False, indent=1)
if adds:
    json.dump(adds, open(f'{dest}/{prefix}-additions.json', 'w'), ensure_ascii=False, indent=1)
if cadds:
    json.dump(cadds, open(f'{dest}/{prefix}-cite-additions.json', 'w'), ensure_ascii=False, indent=1)
n = sum(len(p['layers']) - 1 for p in ps)
print(len(ps), 'passages,', n, 'notes beyond the plain meaning,', len(uq), 'quote rows,', len(adds), 'additions,',
      len(cadds), 'cite additions;', len(missing), 'cites with no quote row')
