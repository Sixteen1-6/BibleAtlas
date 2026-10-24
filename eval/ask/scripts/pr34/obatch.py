# python3 obatch.py rt-pool.json 50: oracle batches o-<i>.json, each item with the matcher's candidates
import json, sys
D = __import__('os').environ['ASK_WORK'] + '/scratchpad/r6'
rt = json.load(open(f'{D}/{sys.argv[1]}')); n = int(sys.argv[2])
T = dict(l.split('\t', 1) for l in open(f'{D}/titles.txt').read().strip().split('\n'))
items = []
for r in rt:
    if r['care']: continue
    c = []
    for m in r['meant']:
        if m['id'] not in c: c.append(m['id'])
    for t in r['top']:
        if t['id'] not in c: c.append(t['id'])
    items.append({'q': r['q'], 'cands': [f"{i}: {T[i]}" for i in c[:10]]})
k = 0
for i in range(0, len(items), n):
    k += 1; json.dump(items[i:i + n], open(f'{D}/o-{k}.json', 'w'), ensure_ascii=False, indent=0)
print(len(items), 'items in', k, 'batches')
