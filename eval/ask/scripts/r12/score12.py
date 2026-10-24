"""score12.py run.json [run2.json ...]: first 6 gathered verses per message, scored by cached verdicts."""
import json, sys
cache = json.load(open('cache.json'))
K = 6
def score(p, only=None):
    runs = json.load(open(p))
    n = ans_msgs = ans = off = rel = unk = 0
    for r in runs:
        if r['how'] != 'live': continue
        if only is not None and r['q'] not in only: continue
        n += 1
        got = False
        for v in r['shown'][:K]:
            x = cache.get(r['q'].strip().lower() + '\t' + v['ref'])
            if x is None: unk += 1
            elif x == 'answers': ans += 1; got = True
            elif x == 'off': off += 1
            else: rel += 1
        ans_msgs += got
    return n, ans_msgs, ans, rel, off, unk
for p in sys.argv[1:]:
    n, am, a, r, o, u = score(p)
    j = a + r + o
    print(f'{p:28s} msgs {n:5d} answered {am:5d}  answers {a:5d} related {r:5d} off {o:5d} unjudged {u:5d}  off% {100*o/max(j,1):.1f}  ans% {100*a/max(j,1):.1f}')
