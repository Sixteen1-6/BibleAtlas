#!/usr/bin/env python3
"""apply_second.py <out dir> <confirmed.json>: add second-writer cites to held-back passages; those with a firm note rejoin."""
import json, sys
out, conf = sys.argv[1], json.load(open(sys.argv[2]))
reg = {c['id']: c for c in json.load(open('/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw/config/layer-sources.json'))['cite']}
held = json.load(open(f'{out}/held-back.json'))['passages']
kept = json.load(open(f'{out}/new-passages.json'))['passages']
quotes = json.load(open(f'{out}/quotes.json'))
by = {p['id']: p for p in held}
def writer(s): return 'bullinger' if s.startswith('bullinger') else ('henry' if s.startswith('henry') else s)
gained = set()  # layers that got a confirmed second writer in this pass; only these may rise
for c in conf:
    p = by.get(c['passage'])
    if not p or c['source'] not in reg:
        print('skip', c['passage'], c['source']); continue
    l = p['layers'][c['layer']]
    spec = {'source': c['source'], 'on': c['on']}
    if not reg[c['source']].get('biblehub'):
        spec['url'] = c['url']
    if any(x['source'] == spec['source'] and x['on'] == spec['on'] for x in l['cites']):
        continue
    if writer(c['source']) not in {writer(x['source']) for x in l['cites']}:
        gained.add((p['id'], c['layer']))
    l['cites'].append(spec)
    quotes.append({'where': p['ref'], 'kind': l['kind'], **spec, 'quote': c['quote'], 'read_in': c['url']})
moved = []
for p in held:
    for i, l in enumerate(p['layers']):
        if i == 0 or (p['id'], i) not in gained:
            continue
        if l['strength'] == 'some interpreters':
            l['strength'] = 'commonly held'
    if any(l['strength'] != 'some interpreters' for l in p['layers'][1:]):
        moved.append(p)
still = [p for p in held if p not in moved]
json.dump({'passages': kept + moved}, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': still}, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
print('rejoined', len(moved), [p['id'] for p in moved]); print('still held', len(still))
