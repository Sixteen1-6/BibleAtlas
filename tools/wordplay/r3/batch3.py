#!/usr/bin/env python3
"""batch3.py <cands.json> <out batches.json> <name> [per]: group candidate leads by chapter into writer batches,
with the live passage (if any) that covers each verse."""
import json, re, sys
from collections import OrderedDict
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq
LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
cands = json.load(open(sys.argv[1]))
name = sys.argv[3]
per = int(sys.argv[4]) if len(sys.argv) > 4 else 8
live = json.load(open(f'{LW}/config/layers.json'))['passages']


def verses_of(ref):
    m = re.match(r'^(.+?) (\d+):(\d+)(?:-(\d+))?', ref)
    b = cq.parse(f'{m.group(1)} {m.group(2)}:{m.group(3)}')[0]
    return [(b, int(m.group(2)), v) for v in range(int(m.group(3)), int(m.group(4) or m.group(3)) + 1)]


cover = {}
for p in live:
    for v in verses_of(p['ref']):
        cover.setdefault(v, p)
verses = OrderedDict()
for c in cands:
    k = (c['b'], c['c'], c['v'])
    if k not in verses:
        p = cover.get(k)
        verses[k] = {'ref': c['ref'], 'existing_passage': p['id'] if p else '', 'existing_kinds': sorted({l['kind'] for l in p['layers']}) if p else [], 'candidates': []}
    verses[k]['candidates'].append({x: c[x] for x in c if x not in ('b', 'c', 'v', 'ref')})
batches, cur, chap = [], [], None
for k, v in verses.items():
    if cur and (len(cur) >= per or (k[:2] != chap and len(cur) >= per // 2)):
        batches.append(cur)
        cur = []
    cur.append(v)
    chap = k[:2]
if cur:
    batches.append(cur)
out = [{'key': f'{name}-{i}', 'verses': b} for i, b in enumerate(batches)]
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(verses), 'verses in', len(out), 'batches;', sum(1 for v in verses.values() if v['existing_passage']), 'already have a passage')
