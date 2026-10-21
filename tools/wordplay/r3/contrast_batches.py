#!/usr/bin/env python3
"""contrast_batches.py <out.json> <per> <key prefix> <workflow output json>... [--skip=<earlier batches.json>,...]: contrast sweep results -> write3 batches (mode fig).

Each sweep result is {anchor, other, people, what, writers:[{source, on, url, quote}]}. Contrasts with the
same anchor and other verse are merged. A verse that already has a live passage gets existing_passage, so
the writer makes an addition. Batches hold <per> anchor verses, in Bible order, keyed "con-<i>"."""
import json, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq

out, per, prefix = sys.argv[1], int(sys.argv[2]), sys.argv[3]
files = [a for a in sys.argv[4:] if not a.startswith('--skip=')]
skip = set()
for a in sys.argv[4:]:
    if a.startswith('--skip='):
        for f in a[7:].split(','):
            for b in json.load(open(f)):
                for v in b['verses']:
                    for c in v['candidates']:
                        skip.add((cq.parse(v['ref']), c['leads'][-1]['snippet'].rsplit('key verse: ', 1)[-1].rstrip('.')))
LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
live = json.load(open(f'{LW}/config/layers.json'))['passages']
by_ref = {}
for p in live:
    try:
        by_ref.setdefault(cq.parse(p['ref'].split('-')[0]), p)
    except SystemExit:
        pass

found = []
for f in files:
    d = json.load(open(f))
    rs = d['result'] if isinstance(d, dict) and 'result' in d else d
    found += [r for r in rs or [] if r and r.get('anchor')]

merged = {}
for c in found:
    try:
        key = (cq.parse(c['anchor']), c['other'])
    except SystemExit:
        print('bad anchor', c['anchor'])
        continue
    if key in skip:
        continue
    m = merged.setdefault(key, {'anchor': c['anchor'], 'other': c['other'], 'people': c['people'], 'what': c['what'], 'writers': []})
    for w in c['writers']:
        if not any(x['source'] == w['source'] and x['on'] == w['on'] and x['quote'] == w['quote'] for x in m['writers']):
            m['writers'].append(w)

verses = {}
for (bcv, other), c in sorted(merged.items(), key=lambda kv: kv[0][0]):
    v = verses.setdefault(bcv, {'ref': c['anchor'], 'candidates': []})
    leads = [{'work': w['source'], 'snippet': f"on {w['on']} (read in {w['url']}): {w['quote']}"} for w in c['writers']]
    leads.append({'work': 'sweep', 'snippet': f"{c['people']}: {c['what']} The other person's key verse: {other}."})
    v['candidates'].append({'kind': 'contrast', 'target': 'contrast', 'writers': sorted({w['source'] for w in c['writers']}), 'leads': leads})

batches, cur = [], []
for bcv in sorted(verses):
    v = verses[bcv]
    p = by_ref.get(bcv)
    cur.append({'ref': v['ref'], 'existing_passage': p['id'] if p else '', 'existing_kinds': sorted({l['kind'] for l in p['layers']}) if p else [], 'candidates': v['candidates']})
    if len(cur) == per:
        batches.append(cur)
        cur = []
if cur:
    batches.append(cur)
json.dump([{'key': f'{prefix}-{i}', 'verses': b} for i, b in enumerate(batches)], open(out, 'w'), ensure_ascii=False, indent=1)
print(f'{len(found)} found, {len(merged)} contrasts after merging, {len(verses)} anchor verses, {len(batches)} batches;',
      sum(1 for v in verses if by_ref.get(v)), 'anchors already live')
