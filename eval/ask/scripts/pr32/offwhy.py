import json, collections, re, sys
T, S = sys.argv[1], sys.argv[2]
res = json.load(open(T + '/wf94mdke9.output'))['result']['results'] + json.load(open(T + '/wlar9hr36.output'))['result']['results']
W = {}
for r in res:
    for v in r['verses']: W[(r['q'], v['ref'])] = (v['verdict'], v.get('why', ''))
c = collections.Counter(); ex = collections.defaultdict(list); n = 0; tot = 0
for f in [S + '/eval2/new7.json', S + '/crazy9/new9.json']:
    for r in json.load(open(f)):
        if r['how'] != 'live': continue
        for t in r['shown'][:8]:
            v = W.get((r['q'], t['ref']))
            tot += 1
            if v and v[0] == 'off':
                n += 1
                for w in re.findall(r"'([^']+)'", v[1]): c[w.lower()] += 1; ex[w.lower()].append(r['q'][:40])
print(n, 'off of', tot)
for w, k in c.most_common(70): print(k, w, '|', ex[w][:2])
