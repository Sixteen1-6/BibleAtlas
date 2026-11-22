"""score17.py cache.json before.json after.json [verdicts.json ...]: what one added prepared answer changes for seen
messages. Takes the messages whose first 6 shown (or the answer opened) differ between the two runs, leaves out the
new answer's own examples (config/ask-examples.json), and counts, for each run, messages with an answering verse,
answering verses, off verses and verses with no verdict, for all of them, for those that gather in both runs, and for
those where what opens changed. The cache is a {"message\tref": verdict} file (as r15/merge15.py writes); the
verdict files are judging results ({"results": [...]}) laid over it."""
import json, collections, sys, os
NEW = 'god-or-doctors-saved-a-life'
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..')
C = json.load(open(sys.argv[1]))
for f in sys.argv[4:]:
    d = json.load(open(f))
    for x in d.get('result', d)['results']:
        for v in x['verses']: C[x['q'].strip().lower() + '\t' + v['ref']] = v['verdict']
B = {r['q']: r for r in json.load(open(sys.argv[2]))}
A = {r['q']: r for r in json.load(open(sys.argv[3]))}
ex = {e.strip().lower() for e in json.load(open(os.path.join(root, 'config', 'ask-examples.json')))['examples'][NEW]}
key = lambda r: (r['how'], r.get('chain'), [s['ref'] for s in r['shown'][:6]])
ch = [q for q in B if q in A and q.strip().lower() not in ex and key(B[q]) != key(A[q])]
sc = lambda r: [C.get(r['q'].strip().lower() + '\t' + s['ref']) for s in r['shown'][:6]]
groups = [('all', lambda q: True),
          ('gathered both times', lambda q: B[q]['how'] == 'live' and A[q]['how'] == 'live'),
          ('what opens changed', lambda q: B[q]['how'] != A[q]['how'] or B[q].get('chain') != A[q].get('chain'))]
for grp, flt in groups:
    ks = [q for q in ch if flt(q)]
    for nm, D in [('before', B), ('after', A)]:
        c = collections.Counter()
        for q in ks:
            ls = sc(D[q]); c['messages'] += 1; c['answered'] += 'answers' in ls; c['answers'] += ls.count('answers')
            c['off'] += ls.count('off'); c['no verdict'] += ls.count(None); c['shown'] += len(ls)
        print(grp, nm, dict(c))
ll = [q for q in ch if B[q]['how'] == 'live' and A[q]['how'] == 'live']
print('gathered both times, the same 6 verses reordered:',
      sum(set(s['ref'] for s in B[q]['shown'][:6]) == set(s['ref'] for s in A[q]['shown'][:6]) for q in ll), 'of', len(ll))
print('opens the new answer after:', sum(A[q].get('chain') == NEW for q in ch))
