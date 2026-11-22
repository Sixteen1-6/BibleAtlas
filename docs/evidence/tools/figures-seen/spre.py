#!/usr/bin/env python3
"""Run the build's checks on a hand-off before anyone reads it.

Usage: python3 -I spre.py NN OUT.jsonl

Each place of the catalogue's words-NN.jsonl loses any stray punctuation before
its marked words, has overlapping entries joined (sapply.tidy), and any Strong's tags that are a stretch of words (they light
the article G3588 or the object marker H0853, or number eight, the search's
limit, or their roots light more words of the verse than there are tags), and is then checked as the build checks it. A place the build would
refuse, or one found only in the Hebrew or Greek whose tags were a stretch, is
written to OUT-refused.jsonl with the reason and is not read; every other place
goes to OUT.jsonl with i0, its place in the hand-off, for the readers.
"""
import importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sapply', f'{HERE}/sapply.py')
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)

nn, out = sys.argv[1].zfill(2), sys.argv[2]
assert out.endswith('.jsonl')
forms = A.W.forms
rows = [json.loads(l) for l in open(f'{A.WORK}/words-{nn}.jsonl', encoding='utf-8')]
keep, refused = [], []
for i, row in enumerate(rows):
    r = dict(row, i0=i)
    r['words'] = A.tidy(row['ref'], [re.sub(r'^[\s,.;:!?—–\-”’)\]]+', '', w) for w in row['words']])
    o = row.get('original') or []
    why = None
    if o and (len(o) >= 8 or any(re.sub('[A-Za-z]$', '', t) in ('G3588', 'H0853') for t in o) or A.overlit(row['ref'], o)):
        r.pop('original', None)
        if row.get('hebrew_or_greek_only'):
            why = 'found only in the Hebrew or Greek, and its tags are a stretch of words'
    if why is None:
        x = {'id': A.id_for(r['ref'], r['form']), 'form': r['form'], 'ref': r['ref'], 'words': r['words'], 'methods': r['methods']}
        if r.get('original'):
            x['original'] = r['original']
        why = A.check(x, forms)
        if why:
            why = A.refused(why)
    if why:
        refused.append({'i0': i, 'id': row['id'], 'ref': row['ref'], 'form': row['form'], 'why': why})
    else:
        keep.append(r)
with open(out, 'w', encoding='utf-8') as f:
    for r in keep:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
with open(out[:-6] + '-refused.jsonl', 'w', encoding='utf-8') as f:
    for r in refused:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(f'{len(rows)} places: {len(keep)} to read, {len(refused)} refused before reading')
