#!/usr/bin/env python3
"""Recompute the Figures of Speech "at" (figure name) for every bullinger-fos cite in an out dir, in place.

  python3 -I apply_fos.py <out dir>
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fosfig import fos_heading
T = 'E. W. Bullinger, Figures of Speech Used in the Bible (1898)'
out = sys.argv[1]
quotes = json.load(open(f'{out}/quotes.json'))
at = {}
for x in quotes:
    if x['source'] == 'bullinger-fos':
        h = fos_heading(x['on'], x['quote'])
        x['at'] = f'{T}, {h}' if h else T
        at[(x['where'], x['kind'], x['on'])] = x['at']
changed = 0
def fix(where, layers):
    global changed
    for l in layers:
        for c in l['cites']:
            if c['source'] == 'bullinger-fos':
                new = at.get((where, l['kind'], c['on']))
                if new and new != c.get('at'):
                    c['at'] = new
                    changed += 1
ps = json.load(open(f'{out}/new-passages.json'))
for p in ps['passages']:
    fix(p['ref'], p['layers'])
json.dump(ps, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
if os.path.exists(f'{out}/held-back.json'):
    hb = json.load(open(f'{out}/held-back.json'))
    for p in hb['passages']:
        fix(p['ref'], p['layers'])
    json.dump(hb, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
if os.path.exists(f'{out}/additions.json'):
    ad = json.load(open(f'{out}/additions.json'))
    for a in ad:
        fix(a['ref'], a['layers'])
    json.dump(ad, open(f'{out}/additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
print(f'{changed} cites changed')
