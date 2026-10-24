"""fit12.py: load traces, join verdicts, explore."""
import json, collections, numpy as np
cache = json.load(open('cache.json'))
live = set(q.strip().lower() for q in json.load(open('dev-live.json')))
msgs = []
for i in range(3):
    for r in json.load(open(f'tr-out{i}.json')):
        if r['how'] != 'live' or 'trace' not in r: continue
        msgs.append(r)
F = ['inPool','text','inTopic','cited','rank','dense','genre','reason','closest','leaning','links','hp','hn','hfirst','near','wider','pointed','score','show']
def lab(q, ref):
    return cache.get(q.strip().lower() + '\t' + ref)
