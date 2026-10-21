#!/usr/bin/env python3
"""prep_pointers.py <out dir> <items.json>: the items for pointer.js (founder decision 9).

Every link note (quotation, allusion, fulfillment, pattern, contrast) in a finalized hand-off folder that is not yet
"widely agreed", in new passages, held-back passages and additions, with its cites and quotes and the pointed
references pointers.py finds in the local commentaries' remarks on its verse (works already cited and works
rule 6 forbids are skipped; a reference in a run of five or more is not a candidate)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3, pointers

LINK = {'quotation', 'allusion', 'fulfillment', 'pattern', 'contrast'}
out, dest = sys.argv[1], sys.argv[2]
load = lambda n, d: json.load(open(f'{out}/{n}')) if os.path.exists(f'{out}/{n}') else d
new = load('new-passages.json', {'passages': []})['passages']
held = load('held-back.json', {'passages': []})['passages']
adds = load('additions.json', [])
rows = load('quotes.json', [])


def quotes_for(ref, i, kind):
    return [{k: r[k] for k in ('source', 'on', 'at', 'quote', 'pointer') if r.get(k)} for r in rows
            if r.get('where') == ref and r.get('note') == i and r.get('kind') == kind]


items = []


def take(key, ref, saying, i, l, status):
    if l['kind'] not in LINK or l['strength'] == 'widely agreed' or len(l.get('refs', [])) < 2:
        return
    cited = {c['source'] for c in l['cites']}
    if cited & {'bullinger-cb', 'bullinger-fos'}:
        cited |= {'bullinger-cb', 'bullinger-fos'}
    if cited & {'henry', 'henry-concise'}:
        cited |= {'henry', 'henry-concise'}
    cands = []
    for c in pointers.scan(ref, l['refs'][1:]):
        if c['source'] in cited or c['run'] >= 5 or lib3.barred(c['source'], ref):
            continue
        if any(x['source'] == c['source'] and x['target'] == c['target'] for x in cands):
            continue
        cands.append({k: c[k] for k in ('source', 'target', 'found', 'run', 'snippet')})
    items.append({'key': key, 'status': status, 'anchor': ref, 'saying': saying, 'kind': l['kind'], 'strength': l['strength'],
                  'refs': l['refs'], 'text': l['text'], 'evidence': l.get('evidence', ''),
                  'cites': quotes_for(ref, i, l['kind']) or l['cites'], 'candidates': cands})


for p in new:
    for i, l in enumerate(p['layers']):
        take(f"{p['id']}#{i}", p['ref'], p['saying'], i, l, 'new passage')
for p in held:
    for i, l in enumerate(p['layers']):
        take(f"{p['id']}#{i}", p['ref'], p['saying'], i, l, 'held passage')
for a in adds:
    for i, l in enumerate(a['layers']):
        take(f"add:{a['passage_id']}#{i}", a['ref'], '', i, l, 'addition')

json.dump(items, open(dest, 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(items), 'link notes;', Counter(x['status'] for x in items), Counter(x['strength'] for x in items),
      sum(len(x['candidates']) for x in items), 'candidates')
