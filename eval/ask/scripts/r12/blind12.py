"""blind12.py verdicts.json base.json new.json: the blind-fresh12 score, first 6 shown of each side, and how many messages each side won."""
import json, sys, collections
V = {}
for x in json.load(open(sys.argv[1]))['results']:
    for v in x['verses']:
        V[(x['q'].strip().lower(), v['ref'])] = v['verdict']
def score(f):
    c = collections.Counter(); per = {}
    for r in json.load(open(f)):
        got = False; a = o = 0
        for v in r['shown'][:6]:
            l = V.get((r['q'].strip().lower(), v['ref'])); c[l or 'unj'] += 1
            got |= l == 'answers'; a += l == 'answers'; o += l == 'off'
        c['answered'] += got; c['n'] += 1; c['shown'] += len(r['shown'][:6]); per[r['q']] = (a, o)
    return c, per
(cm, pm), (cb, pb) = score(sys.argv[2]), score(sys.argv[3])
for name, c in [('main', cm), ('branch', cb)]:
    print(f"{name:7s} messages {c['n']} answered {c['answered']} answers {c['answers']} related {c['related']} off {c['off']} unjudged {c['unj']} shown {c['shown']} off% {100*c['off']/c['shown']:.1f}")
w = collections.Counter()
for q in pm:
    (a1, o1), (a2, o2) = pm[q], pb[q]
    w['more answers' if a2 > a1 else 'fewer answers' if a2 < a1 else 'same answers'] += 1
    w['fewer off' if o2 < o1 else 'more off' if o2 > o1 else 'same off'] += 1
print(dict(w))
