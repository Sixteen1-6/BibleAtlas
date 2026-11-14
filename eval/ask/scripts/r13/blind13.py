"""blind13.py verdicts.json main.json branch.json: the blind-fresh13 score over every message (prepared
answers and gathered verses alike), first 6 shown of each side, by how each side answered."""
import json, sys, collections
V = {}
for x in json.load(open(sys.argv[1]))['results']:
    for v in x['verses']:
        V[(x['q'].strip().lower(), v['ref'])] = v['verdict']
def run(f):
    out = {}
    for r in json.load(open(f)):
        ls = [V.get((r['q'].strip().lower(), v['ref'])) for v in r['shown'][:6]]
        out[r['q']] = (r['how'], ls)
    return out
M, B = run(sys.argv[2]), run(sys.argv[3])
def tot(D, keys):
    c = collections.Counter()
    for k in keys:
        how, ls = D[k]
        c['n'] += 1; c['answered'] += 'answers' in ls; c['answers'] += ls.count('answers'); c['related'] += ls.count('related'); c['off'] += ls.count('off'); c['unj'] += ls.count(None); c['shown'] += len(ls)
    c['off%'] = round(100 * c['off'] / max(1, c['shown']), 1)
    return dict(c)
keys = list(M)
print('all     main  ', tot(M, keys)); print('all     branch', tot(B, keys))
diff = [k for k in keys if M[k] != B[k]]
print('differ', len(diff)); print('  main  ', tot(M, diff)); print('  branch', tot(B, diff))
for grp in ['prepared', 'gathered']:
    pick = lambda D, k: (D[k][0] in ('routed', 'exact')) == (grp == 'prepared')
    print(grp, 'main', tot(M, [k for k in keys if pick(M, k)]), '| branch', tot(B, [k for k in keys if pick(B, k)]))
w = collections.Counter()
for k in diff:
    a1, a2 = M[k][1].count('answers'), B[k][1].count('answers'); o1, o2 = M[k][1].count('off'), B[k][1].count('off')
    w['more answers' if a2 > a1 else 'fewer answers' if a2 < a1 else 'same answers'] += 1
    w['fewer off' if o2 < o1 else 'more off' if o2 > o1 else 'same off'] += 1
    w['now answered' if ('answers' in B[k][1]) and not ('answers' in M[k][1]) else 'no longer answered' if ('answers' in M[k][1]) and not ('answers' in B[k][1]) else 'answered same'] += 1
print(dict(w))
print(collections.Counter((M[k][0], B[k][0]) for k in diff))
