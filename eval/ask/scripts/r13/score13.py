"""score13.py a.json b.json [only.json]: first 6 shown per message (chain parts or gathered verses), scored by
cache.json, over every message but the help page; also the messages where the two differ."""
import json, sys, collections
cache = json.load(open('cache.json'))
K = 6
A, B = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
def refs(r): return [v['ref'] for v in r.get('shown', [])[:K]]
def sc(r):
    a = o = u = 0
    for ref in refs(r):
        x = cache.get(r['q'].strip().lower() + '\t' + ref)
        if x is None: u += 1
        elif x == 'answers': a += 1
        elif x == 'off': o += 1
    return a, o, u
def tot(rs):
    c = collections.Counter()
    for r in rs:
        a, o, u = sc(r); c['n'] += 1; c['answered'] += a > 0; c['answers'] += a; c['off'] += o; c['unjudged'] += u; c['shown'] += len(refs(r))
    return dict(c)
pairs = [(x, y) for x, y in zip(A, B) if x['how'] != 'care' and y['how'] != 'care']
diff = [(x, y) for x, y in pairs if refs(x) != refs(y)]
print('all   main', tot([x for x, _ in pairs])); print('all   brch', tot([y for _, y in pairs]))
print('diff', len(diff), 'main', tot([x for x, _ in diff])); print('diff', len(diff), 'brch', tot([y for _, y in diff]))
w = collections.Counter()
for x, y in diff:
    (a1, o1, _), (a2, o2, _) = sc(x), sc(y)
    w['more answers' if a2 > a1 else 'fewer answers' if a2 < a1 else 'same answers'] += 1
    w['fewer off' if o2 < o1 else 'more off' if o2 > o1 else 'same off'] += 1
print(dict(w))
moves = collections.Counter((x['how'], y['how']) for x, y in diff)
print(dict(moves))
