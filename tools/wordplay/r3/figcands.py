import json, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq
from fosfig import FOS_LINES as L
from collections import defaultdict
idx = json.load(open('r3/fos_index.json'))
leads = json.load(open('r3/figleads.json'))
FAMS = {'Metonymy': 'metonymy', 'Synecdoché': 'synecdoche', 'Parallelism': 'parallelism'}
c = defaultdict(lambda: defaultdict(list))
for fig, fam in FAMS.items():
    for bk, ch, v, line in idx[fig]:
        b = cq.FOS.index(bk)
        body = ' '.join(x.strip() for x in L[line:cq.fos_end(L, line)] if x.strip())
        c[(b, ch, v, fam)]['fos'].append(f'[{fig}] {body}'[:700])
for x in leads:
    if x['fam'] in ('metonymy', 'synecdoche', 'parallelism'):
        for w, sn in x['leads'].items():
            if w == 'bullinger' and c[(x['b'], x['c'], x['v'], x['fam'])].get('fos'):
                c[(x['b'], x['c'], x['v'], x['fam'])]['cb'] += sn[:1]
            else:
                c[(x['b'], x['c'], x['v'], x['fam'])][w] += sn[:1]
out = []
for (b, ch, v, fam), ws in sorted(c.items()):
    out.append({'ref': f'{cq.BOOKS[b]} {ch}:{v}', 'b': b, 'c': ch, 'v': v,
                'kind': 'figure' if fam != 'parallelism' else 'parallelism', 'target': fam,
                'writers': sorted(ws), 'leads': [{'work': w, 'snippet': s} for w, ss in ws.items() for s in ss[:2]]})
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(out), Counter(x['target'] for x in out), Counter(len(x['writers']) for x in out))
print(len({(x['b'], x['c'], x['v']) for x in out}), 'verses')
