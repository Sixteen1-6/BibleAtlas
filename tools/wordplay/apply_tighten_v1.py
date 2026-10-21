#!/usr/bin/env python3
"""Apply tighten.js results to an out dir, in place.

  python3 -I apply_tighten.py <out dir> <tighten journal.jsonl> [...]

A proposed change takes effect only as the second reader settled it (accept, amend, reject).
A strength the checker lowered without proposing a change is applied (lowering is always safe).
Dropped layers and cites are removed; passages left with no firm note move to held-back.json;
quotes.json keeps only rows that still back a cite.
"""
import json, sys

out, journals = sys.argv[1], [a for a in sys.argv[2:] if not a.startswith('--')]
# --protect=<confirmed.json>: notes that gained a confirmed second writer after the check ran;
# their strength is not lowered (the checker did not see the new cite)
protect = set()
for a in sys.argv[2:]:
    if a.startswith('--protect='):
        protect |= {(c['passage'], c['layer']) for c in json.load(open(a.split('=', 1)[1]))}
RANK = {'some interpreters': 0, 'commonly held': 1, 'widely agreed': 2}
checks, confirms = {}, {}
for jp in journals:
    label = {}
    for line in open(jp):
        j = json.loads(line)
        if j.get('type') == 'started':
            label[j['agentId']] = j.get('label', '')
        elif j.get('type') == 'result' and isinstance(j.get('result'), dict):
            lab = label.get(j.get('agentId'), '')
            for r in j['result'].get('results', []):
                key = (r['passage'], r['layer'])
                if lab.startswith('check:'):
                    checks[key] = r
                elif lab.startswith('confirm:'):
                    confirms[key] = r

# --override=<file>: settle some proposed changes by hand (e.g. where the checker saw another note's quote)
for a in sys.argv[2:]:
    if a.startswith('--override='):
        for o in json.load(open(a.split('=', 1)[1])):
            confirms[(o['passage'], o['layer'])] = o

new = json.load(open(f'{out}/new-passages.json'))['passages']
try:
    held = json.load(open(f'{out}/held-back.json'))['passages']
except FileNotFoundError:
    held = []
by = {p['id']: p for p in new + held}
log = {'checked': len(checks), 'ok': 0, 'text': 0, 'strength_down': 0, 'strength_up': 0, 'cites_removed': 0,
       'dropped': 0, 'rejected': 0, 'unconfirmed': 0}
drop = set()


def apply(p, i, strength, text, remove):
    l = p['layers'][i]
    if (p['id'], i) in protect and strength and RANK[strength] < RANK[l['strength']]:
        strength = None
    if strength and strength != l['strength']:
        log['strength_down' if RANK[strength] < RANK[l['strength']] else 'strength_up'] += 1
        l['strength'] = strength
    if text and text != l['text']:
        l['text'] = text
        log['text'] += 1
    if remove:
        keep = [c for j, c in enumerate(l['cites']) if j not in set(remove)]
        log['cites_removed'] += len(l['cites']) - len(keep)
        if keep:
            l['cites'] = keep
        else:
            drop.add((p['id'], i))


for key, r in checks.items():
    p = by.get(key[0])
    if not p or key[1] >= len(p['layers']):
        continue
    l = p['layers'][key[1]]
    changed = r['verdict'] != 'ok' or r.get('remove_cites')
    if not changed:
        log['ok'] += 1
        if RANK[r['strength']] < RANK[l['strength']]:
            apply(p, key[1], r['strength'], None, None)
        continue
    c = confirms.get(key)
    if c is None:
        log['unconfirmed'] += 1
        continue
    if c['decision'] == 'reject':
        log['rejected'] += 1
        continue
    if c['decision'] == 'accept':
        if r['verdict'] == 'drop' and key not in protect:
            drop.add(key)
            continue
        apply(p, key[1], r['strength'], r.get('text'), r.get('remove_cites'))
    else:
        apply(p, key[1], c['strength'], c.get('text'), c.get('remove_cites', r.get('remove_cites')))

for pid, i in drop:
    by[pid]['layers'][i] = None
    log['dropped'] += 1
for p in by.values():
    p['layers'] = [l for l in p['layers'] if l is not None]

kept, back = [], []
for p in new + held:
    firm = [l for l in p['layers'][1:] if l['strength'] != 'some interpreters']
    (kept if firm else back).append(p)
live = {(p['ref'], l['kind'], c['source'], c['on']) for p in kept + back for l in p['layers'] for c in l['cites']}
try:  # rows that back additions to passages already on main
    live |= {(a['ref'], l['kind'], c['source'], c['on']) for a in json.load(open(f'{out}/additions.json')) for l in a['layers'] for c in l['cites']}
    live |= {(a['ref'], a['layer_kind'], c['source'], c['on']) for a in json.load(open(f'{out}/cite-additions.json')) for c in a['add_cites']}
except FileNotFoundError:
    pass
quotes = [q for q in json.load(open(f'{out}/quotes.json')) if (q['where'], q['kind'], q['source'], q['on']) in live]
json.dump({'passages': kept}, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': back}, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
log['passages'] = len(kept)
log['held_back'] = len(back)
print(log)
