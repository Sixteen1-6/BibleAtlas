"""fresh17.py verdicts.json main.json branch.json set.json [set.json ...]: the new answer's test sets, main against the
branch. Each set is {"here": [message, ...], "near": [{"q": message, "asks": ...}, ...]}: "here" messages ask the new
question, "near" ones ask something close that it should not take. For each set and part, and for each run, counts
the messages that open the new answer, that show any of its verses among the first 6, that show an answering verse,
and the answering, off and unjudged verses among the first 6 (care pages are Scripture chosen by hand and not
judged). With SHOW=1 it lists every message whose first 6 differ."""
import json, collections, sys, os
NEW = 'god-or-doctors-saved-a-life'
CHAIN = {'Deuteronomy 32:39', '2 Kings 20:5', '2 Kings 20:7', 'Isaiah 38:16', 'Luke 5:31', '2 Chronicles 16:12',
         'Proverbs 21:31', 'James 1:17'}
d = json.load(open(sys.argv[1]))
V = {}
for x in d.get('result', d)['results']:
    for v in x['verses']: V[x['q'].strip().lower() + '\t' + v['ref']] = v['verdict']
M = {r['q']: r for r in json.load(open(sys.argv[2]))}
Br = {r['q']: r for r in json.load(open(sys.argv[3]))}
for f in sys.argv[4:]:
    s = json.load(open(f))
    for part in ('here', 'near'):
        qs = [x if isinstance(x, str) else x['q'] for x in s[part]]
        for nm, D in (('main', M), ('branch', Br)):
            c = collections.Counter()
            for q in qs:
                r = D[q]; refs = [t['ref'] for t in r['shown'][:6]]
                c['messages'] += 1
                c['opens it'] += r.get('chain') == NEW
                c['shows its verses'] += any(t in CHAIN for t in refs)
                if r['how'] == 'care': c['care page'] += 1; continue
                ls = [V.get(q.strip().lower() + '\t' + t) for t in refs]
                c['answered'] += 'answers' in ls; c['answers'] += ls.count('answers'); c['off'] += ls.count('off')
                c['no verdict'] += ls.count(None); c['shown'] += len(ls)
            print(os.path.basename(f), part, nm, dict(c))
        if os.environ.get('SHOW'):
            for q in qs:
                a, b = M[q], Br[q]
                if [t['ref'] for t in a['shown'][:6]] == [t['ref'] for t in b['shown'][:6]]: continue
                for nm, r in (('main', a), ('branch', b)):
                    refs = [t['ref'] for t in r['shown'][:6]]
                    print(f"   {nm:6} {r['how']:6} {(r.get('chain') or ''):36.36}",
                          ' '.join((V.get(q.strip().lower() + '\t' + t) or '?')[0] for t in refs), '|', q[:70])
