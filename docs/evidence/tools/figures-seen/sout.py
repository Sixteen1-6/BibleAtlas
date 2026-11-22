#!/usr/bin/env python3
"""Take out kept places that a finding about other places shows to be the same case.

Usage: python3 -I sout.py NN EVIDENCE.json REPO LOGDIR WHY ID [ID ...]

A sample's verdict on one place sometimes holds for others it did not draw (Psalm 8:4
"what is man", marked as belittling, failed as a question, and Psalm 144:3 marks the
same words the same way). Each ID, a place the evidence record kept, is dropped from
config/figures-seen/ (when in doubt, a place does not go live), with WHY in the record
and the drop log.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sspan', f'{HERE}/sspan.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)

nn, evp, repo, logdir, why = sys.argv[1:6]
ids = sys.argv[6:]
nn = nn.zfill(2)
cdir = f'{repo}/config/figures-seen'
notes = P.notes_in(cdir)
ev = json.load(open(evp, encoding='utf-8'))
rec = {p['kept']: p for p in ev['places'] if p['kept']}
drops = []
for _id in ids:
    assert _id in rec and _id in notes, f'{_id}: not a kept place of words-{nn}'
    osis, n = notes.pop(_id)
    P.write_book(cdir, osis, [m for o, m in notes.values() if o == osis])
    p = rec[_id]
    p['kept'] = None
    p['why'] = why
    p.pop('changed', None)
    drops.append({'i': p['i'], 'id': p['id'], 'ref': n['ref'], 'form': n['form'], 'why': why, 'reasons': []})
ev['counts']['dropped as a sample\'s finding'] = ev['counts'].get('dropped as a sample\'s finding', 0) + len(drops)
ev['counts']['kept'] = sum(1 for p in ev['places'] if p['kept'])
ev['counts']['dropped'] = sum(1 for p in ev['places'] if not p['kept'])
NOTE = ('Where a sample\'s verdict on one place held as well for kept places it did not draw, those were dropped too '
        '("dropped as a sample\'s finding").')
if NOTE not in ev['_comment']:
    ev['_comment'].append(NOTE)
P.write_evidence(evp, ev)
with open(f'{logdir}/words-{nn}-drops.jsonl', 'a', encoding='utf-8') as f:
    for d in drops:
        f.write(json.dumps(d, ensure_ascii=False) + '\n')
print(f'dropped {len(drops)}; kept now {ev["counts"]["kept"]}')
