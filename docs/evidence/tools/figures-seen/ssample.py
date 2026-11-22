#!/usr/bin/env python3
"""Pick the sample of kept places for the last check of one words-NN file.

Usage: python3 -I ssample.py NN EVIDENCE.json CONFIGDIR OUT.jsonl [K] [ROUND]

Takes K (default 25) of the places the evidence record lists as kept, chosen with
a random generator seeded by the file number and the round (a later round draws
a fresh sample), so the same sample comes back on a re-run, and writes each as it now stands in CONFIGDIR (config/figures-seen).
"""
import glob, json, random, sys

nn, evp, cdir, out = sys.argv[1:5]
k = int(sys.argv[5]) if len(sys.argv) > 5 else 25
rnd = int(sys.argv[6]) if len(sys.argv) > 6 else 1
ev = json.load(open(evp, encoding='utf-8'))
kept = [p['kept'] for p in ev['places'] if p['kept']]
notes = {}
for f in glob.glob(f'{cdir}/*.json'):
    for n in json.load(open(f, encoding='utf-8'))['notes']:
        notes[n['id']] = n
pick = sorted(random.Random(int(nn) if rnd == 1 else int(nn) * 1000 + rnd).sample(range(len(kept)), min(k, len(kept))))
with open(out, 'w', encoding='utf-8') as f:
    for i in pick:
        f.write(json.dumps(notes[kept[i]], ensure_ascii=False) + '\n')
print(len(pick), 'of', len(kept))
