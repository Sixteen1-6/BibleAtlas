#!/usr/bin/env python3
"""stats.py <passages.json> [<quotes.json>]: counts for the README."""
import json, sys, collections as C
ps = json.load(open(sys.argv[1]))['passages']
kind, strength, src, sec = C.Counter(), C.Counter(), C.Counter(), C.Counter()
for p in ps:
    sec[p['section']] += 1
    for l in p['layers'][1:]:
        kind[l['kind']] += 1
        strength[l['strength']] += 1
    for l in p['layers']:
        for c in l['cites']:
            src[c['source']] += 1
print('passages', len(ps), dict(sec))
print('notes', sum(kind.values()), dict(kind))
print('strength', dict(strength))
print('cites', dict(src.most_common()))
if len(sys.argv) > 2:
    q = json.load(open(sys.argv[2]))
    print('quote rows', len(q), 'bible hub', sum(1 for x in q if x['read_in'].startswith('https://biblehub.com')))
