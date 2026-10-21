#!/usr/bin/env python3
"""Merge post.py outputs into a layers.json copy: merge_into.py <layers.json> <out dir>..."""
import json, sys
path, dirs = sys.argv[1], sys.argv[2:]
cfg = json.load(open(path))
ids = {p['id']: p for p in cfg['passages']}
added = 0
for d in dirs:
    for p in json.load(open(f'{d}/new-passages.json'))['passages']:
        if p['id'] in ids:
            print('id exists, adding as layers:', p['id'])
            ids[p['id']]['layers'] += [l for l in p['layers'] if l['kind'] != 'plain meaning']
            continue
        cfg['passages'].append(p); ids[p['id']] = p; added += 1
    for a in json.load(open(f'{d}/additions.json')):
        if a['passage_id'] not in ids:
            print('missing passage', a['passage_id']); continue
        ids[a['passage_id']]['layers'] += a['layers']
    try:
        cadds = json.load(open(f'{d}/cite-additions.json'))
    except FileNotFoundError:
        cadds = []
    for a in cadds:
        l = [l for l in ids[a['passage_id']]['layers'] if l['kind'] == a['layer_kind']][0]
        l['cites'] += [c for c in a['add_cites'] if c not in l['cites']]
json.dump(cfg, open(path, 'w'), ensure_ascii=False, indent=2)
print('passages now', len(cfg['passages']), 'added', added)
