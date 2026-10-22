import json, collections, sys
S, T = sys.argv[1], sys.argv[2]
V = {}
for f in ['wlar9hr36', 'wf94mdke9', 'wq431efei']:
    for r in json.load(open(f'{T}/{f}.output'))['result']['results']:
        for v in r['verses']: V[(r['q'], v['ref'])] = v['verdict']
L = {}
for f in ['crazy9/new9.json', 'crazy9/new9w.json', 'crazy9/live9.json', 'eval2/new7.json', 'eval2/new7w.json', 'eval2/live7.json', 'eval2/unk-run.json']:
    for r in json.load(open(f'{S}/{f}')):
        if not r.get('chain'): continue
        vs = [V.get((r['q'], t['ref'])) for t in r['shown'][:8]]
        if None in vs: continue
        c = collections.Counter(vs)
        L[(r['q'], r['chain'])] = 'good' if c['answers'] >= 1 and c['answers'] >= c['off'] else ('bad' if c['answers'] == 0 else 'mixed')
for name in sys.argv[3:]:
    rt = json.load(open(f'{S}/eval2/{name}'))
    print(name)
    for t in [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:
        c = collections.Counter()
        for r in rt:
            if r['exact'] or not r['meant']: continue
            m = r['meant'][0]
            if m['p'] >= t: c[L.get((r['q'], m['id']), '?')] += 1
        print(f'  p>={t}: opens {sum(c.values())}  good {c["good"]} mixed {c["mixed"]} bad {c["bad"]} unknown {c["?"]}')
if len(sys.argv) > 3 and sys.argv[-1].startswith('--list'):
    pass
