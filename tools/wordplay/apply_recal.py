#!/usr/bin/env python3
"""Apply recalibration results and audit fixes to a post.py output dir, in place.

  python3 -I apply_recal.py <out dir> <recal journal.jsonl> [<fixes.json>]

fixes.json: [{"passage", "layer", "text"?, "strength"?, "refs"?}] applied after the recalibration.
Passages left with no firm note (only "some interpreters" beside the plain meaning)
move to held-back.json, since the app shows a passage only with a firm note.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq

out, journal = sys.argv[1], sys.argv[2]
fixes = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else []
SOURCE = {'gill': 'gill', 'clarke': 'clarke', 'barnes': 'barnes', 'jfb': 'jfb', 'kad': 'keil-delitzsch',
          'mhcc': 'henry-concise', 'wesley': 'wesley', 'cb': 'bullinger-cb', 'fos': 'bullinger-fos'}
FOS_TITLE = 'E. W. Bullinger, Figures of Speech Used in the Bible (1898)'

from fosfig import fos_heading

ps = json.load(open(f'{out}/new-passages.json'))['passages']
quotes = json.load(open(f'{out}/quotes.json'))
by = {p['id']: p for p in ps}
results = []
for line in open(journal):
    j = json.loads(line)
    if j.get('type') == 'result' and isinstance(j.get('result'), dict):
        results += j['result'].get('results', [])

log = {'strength': 0, 'cites_added': 0, 'cite_failed': 0, 'text': 0, 'held_back': []}
for r in results:
    p = by.get(r['passage'])
    if not p or r['layer'] >= len(p['layers']):
        continue
    l = p['layers'][r['layer']]
    for c in r.get('add_cites', []):
        w, on, q = c['work'], c['on'], c['quote']
        try:
            ok = w in SOURCE and cq.check(w, on, q)
        except SystemExit:
            ok = False
        if not ok:
            log['cite_failed'] += 1
            continue
        if w in ('mhcc', 'wesley'):
            on = cq.get(w, on)[0]
        spec = {'source': SOURCE[w], 'on': on}
        if w == 'fos':
            h = fos_heading(on, q)
            spec['at'] = f'{FOS_TITLE}, {h}' if h else FOS_TITLE
        if any(x['source'] == spec['source'] and x['on'] == spec['on'] for x in l['cites']):
            continue
        l['cites'].append(spec)
        quotes.append({'where': p['ref'], 'kind': l['kind'], **spec, 'quote': q, 'read_in': cq.url(w, on)})
        log['cites_added'] += 1
    if r['strength'] != l['strength']:
        l['strength'] = r['strength']
        log['strength'] += 1
    if r.get('text') and r['text'] != l['text']:
        l['text'] = r['text']
        log['text'] += 1

for f in fixes:
    l = by[f['passage']]['layers'][f['layer']]
    for k in ('text', 'strength', 'refs'):
        if k in f:
            l[k] = f[k]

kept, held = [], []
for p in ps:
    firm = [l for l in p['layers'][1:] if l['strength'] != 'some interpreters']
    (kept if firm else held).append(p)
log['held_back'] = [p['id'] for p in held]
json.dump({'passages': kept}, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': held}, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
print({k: (len(v) if isinstance(v, list) else v) for k, v in log.items()})
