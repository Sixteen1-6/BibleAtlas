"""batch12.py outdir n runs...: blind batches of the first 6 gathered verses per message not yet in cache.json."""
import json, sys, os
sys.path.insert(0, os.environ.get('ATLAS_REPO', '.') + '/eval/ask/scripts/tools')
from bible import parse, text, name
cache = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache.json')))
out, n = sys.argv[1], int(sys.argv[2])
K = int(os.environ.get('K', 6))
def ctx(ref):
    (b, c, v), = parse(ref)
    lines = []
    for d in range(-2, 3):
        if v + d < 1: continue
        try:
            t = text(b, c, v + d)
        except Exception:
            t = None
        if t: lines.append(f"{'>>' if d == 0 else '  '} {name(b, c, v + d)} {t}")
    return '\n'.join(lines)
Q, order = {}, []
for f in sys.argv[3:]:
    for r in json.load(open(f)):
        if r['how'] != 'live': continue
        for t in r['shown'][:K]:
            if (r['q'].strip().lower() + '\t' + t['ref']) in cache: continue
            if r['q'] not in Q: Q[r['q']] = {}; order.append(r['q'])
            Q[r['q']].setdefault(t['ref'], (t['v'], t['text']))
items = [{'q': q, 'kind': 'live', 'verses': [{'ref': ref, 'shown': s, 'context': ctx(ref)} for ref, (v, s) in sorted(Q[q].items(), key=lambda x: x[1][0])]} for q in order if Q[q]]
os.makedirs(out, exist_ok=True)
for b in range(n):
    json.dump(items[b::n], open(f'{out}/batch-{b+1}.json', 'w'), indent=1, ensure_ascii=False)
print(len(items), 'questions', sum(len(x['verses']) for x in items), 'verses in', n, 'batches')
