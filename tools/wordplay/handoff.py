#!/usr/bin/env python3
"""handoff.py <out dir> <dest dir> <prefix>: sorted passages and their quotes for the Layers thread."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq
src, dest, prefix = sys.argv[1:4]
ps = json.load(open(f'{src}/new-passages.json'))['passages']
ps.sort(key=lambda p: cq.parse(p['ref']))
refs = {p['ref'] for p in ps}
quotes = [q for q in json.load(open(f'{src}/quotes.json')) if q['where'] in refs]
seen, uq = set(), []
for q in quotes:
    k = (q['where'], q['kind'], q['source'], q['on'])
    if k not in seen:
        seen.add(k); uq.append(q)
os.makedirs(dest, exist_ok=True)
json.dump({'passages': ps}, open(f'{dest}/{prefix}-new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump(uq, open(f'{dest}/{prefix}-quotes.json', 'w'), ensure_ascii=False, indent=1)
n = sum(len(p['layers']) - 1 for p in ps)
print(len(ps), 'passages,', n, 'notes beyond the plain meaning,', len(uq), 'quotes')
