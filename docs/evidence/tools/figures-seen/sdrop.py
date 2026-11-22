#!/usr/bin/env python3
"""Take out the places a last-check sample failed, and record the sample.

Usage: python3 -I sdrop.py NN RESULT.json SAMPLE.jsonl EVIDENCE.json REPO LOGDIR RUN

Run it for each sample in the order they were drawn.

RESULT.json is the layers-seen-sample result for SAMPLE.jsonl. Each failed place
is dropped from config/figures-seen/ (when in doubt, a place does not go live),
and the evidence record gains the sample: its run, how many passed, the bar.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sspan', f'{HERE}/sspan.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)

nn, resp, samp, evp, repo, logdir, run = sys.argv[1:8]
nn = nn.zfill(2)
res = json.load(open(resp, encoding='utf-8'))
res = res.get('result', res)
rows = [json.loads(l) for l in open(samp, encoding='utf-8')]
assert len(res['verdict']) == len(rows) == res['n'], 'the sample has places with no verdict'
cdir = f'{repo}/config/figures-seen'
notes = P.notes_in(cdir)
ev = json.load(open(evp, encoding='utf-8'))
rec = {p['kept']: p for p in ev['places'] if p['kept']}
failed = [rows[int(i)] for i, v in res['verdict'].items() if not v['pass']]
# a failed place that has changed since the sample was drawn (an earlier round,
# before the span re-read) is judged as it now stands, by the next sample
still = [r for r in failed if r['id'] in notes and notes[r['id']][1] == r]
changed = len(failed) - len(still)
failed = still
drops = []
for r in failed:
    osis, _n = notes[r['id']]
    book = [n for _id, (o, n) in notes.items() if o == osis and _id != r['id']]
    P.write_book(cdir, osis, book)
    notes.pop(r['id'])
    p = rec[r['id']]
    v = next(v for i, v in res['verdict'].items() if rows[int(i)]['id'] == r['id'])
    p['kept'] = None
    p['why'] = v['reasons'][0] if v['reasons'] else 'failed the last check'
    p.pop('changed', None)
    p['last_check'] = 'failed'
    drops.append({'i': p['i'], 'id': p['id'], 'ref': r['ref'], 'form': r['form'], 'why': 'failed the last check', 'reasons': v['reasons']})
ev.setdefault('samples', []).append({'run': run, 'places': len(rows), 'passed': res['passed'], 'bar': 24, 'failed changed since': changed, 'failed dropped': len(failed)})
ev['counts']['kept'] = sum(1 for p in ev['places'] if p['kept'])
ev['counts']['dropped'] = sum(1 for p in ev['places'] if not p['kept'])
SAMPLE_NOTE = ('Last, a sample of 25 kept places was read by two more readers, a third settling any split; the file goes in only when 24 or more pass, and any place that fails is dropped. "samples" lists each sample and its result.')
if SAMPLE_NOTE not in ev['_comment']:
    ev['_comment'].append(SAMPLE_NOTE)
P.write_evidence(evp, ev)
with open(f'{logdir}/words-{nn}-drops.jsonl', 'a', encoding='utf-8') as f:
    for d in drops:
        f.write(json.dumps(d, ensure_ascii=False) + '\n')
print(f'{res["passed"]} of {len(rows)} passed; dropped {len(failed)}, {changed} changed since; kept now {ev["counts"]["kept"]}')
