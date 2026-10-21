#!/usr/bin/env python3
"""Merge the sweep's candidates with the mined commentary hits into batches of verses.

  python3 merge_cands.py <journal.jsonl> <layers.json> <first book> <last book> <out.json> [batch size]

Books are 0-based (Genesis 0 ... Revelation 65). A verse already in layers.json
with the same kind is skipped. Leads from the mined hits are added for verses
the sweep did not name.
"""
import json, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq

W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
journal, layers_path, first, last, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
size = int(sys.argv[6]) if len(sys.argv) > 6 else 8

def key(ref):
    b, c, v = cq.parse(ref)
    return b, c, v

def name(b, c, v):
    return f'{cq.BOOKS[b]} {c}:{v}'

cands = []
for l in open(journal):
    j = json.loads(l)
    r = j.get('result')
    if j['type'] == 'result' and isinstance(r, dict):
        cands += r.get('candidates', [])

covered = {}
for p in json.load(open(layers_path))['passages']:
    try:
        k = key(p['ref'])
    except SystemExit:
        continue
    covered.setdefault(k, set()).update(l['kind'] for l in p['layers'])
    covered[k].add('_id:' + p['id'])

by = {}
def add(k, item):
    by.setdefault(k, []).append(item)

for c in cands:
    try:
        k = key(c['ref'])
    except SystemExit:
        continue
    if not (first <= k[0] <= last):
        continue
    if c['kind'] in covered.get(k, set()):
        continue
    add(k, {'kind': c['kind'], 'what': c['what'], 'target': c.get('target', ''), 'words': c.get('words', []),
            'named': [s['source'] for s in c['sources']], 'sure': c['sure'], 'ref': c['ref']})

FOSB = {a: i for i, a in enumerate(cq.FOS)}
FOSB['Jas'] = 58
for e in json.load(open(f'{W}/fos_entries.json')):
    b = FOSB.get(e['book'])
    if b is None or not (first <= b <= last):
        continue
    k = (b, e['c'], e['v'])
    if k in by or 'wordplay' in covered.get(k, set()):
        continue
    add(k, {'kind': 'wordplay', 'what': f"lead: Bullinger lists this under {e['section']}", 'target': '', 'words': [],
            'named': ['fos'], 'sure': 'medium', 'ref': name(*k)})

for e in json.load(open(f'{W}/cb_hits.json')):
    b = e['book'] - 1
    if not (first <= b <= last) or 'Paronomasia' not in e['text']:
        continue
    k = (b, e['chapter'], e['verse'])
    if k in by or 'wordplay' in covered.get(k, set()):
        continue
    add(k, {'kind': 'wordplay', 'what': 'lead: the Companion Bible notes a Paronomasia here', 'target': '', 'words': [],
            'named': ['cb'], 'sure': 'medium', 'ref': name(*k)})

for e in json.load(open(f'{W}/st_hits.json')):
    try:
        k = key(e['ref'])
    except SystemExit:
        continue
    if not (first <= k[0] <= last) or k in by:
        continue
    kind = 'name meaning' if re.search(r'name|signification|meaning', e['term'], re.I) else 'wordplay'
    if kind in covered.get(k, set()):
        continue
    add(k, {'kind': kind, 'what': f"lead: {e['work']} says '{e['term']}' here", 'target': '', 'words': [],
            'named': [e['work']], 'sure': 'medium', 'ref': name(*k)})

verses = []
for k in sorted(by):
    ex = [x[4:] for x in covered.get(k, set()) if x.startswith('_id:')]
    verses.append({'ref': name(*k), 'existing_passage': ex[0] if ex else '', 'existing_kinds': sorted(x for x in covered.get(k, set()) if not x.startswith('_id:')), 'candidates': by[k]})

batches = []
for i in range(0, len(verses), size):
    chunk = verses[i:i + size]
    batches.append({'key': f"{chunk[0]['ref']} to {chunk[-1]['ref']}", 'verses': chunk})
json.dump(batches, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(cands), 'sweep candidates;', len(verses), 'verses;', sum(len(v['candidates']) for v in verses), 'items;', len(batches), 'batches')
