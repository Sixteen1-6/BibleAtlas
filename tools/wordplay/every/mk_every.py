#!/usr/bin/env python3
"""mk_every.py <NN> [per]: the catalogue's cited hand-off NN (work/handoff-NN.jsonl) -> every/hNN/batches.json,
candidates in Bible order, <per> to a batch (default 6). Each candidate keeps the catalogue's fields and gains
"n" (its line in the hand-off), "live" (live figure notes in its chapter whose ref meets its verses) and "layers"
(ids of live Layers passages on those verses).
  mk_every.py show NN K     prints batch K for an agent."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.dirname(HERE)
LW = os.path.join(os.path.dirname(W), 'lw')
E = '/mnt/project-files/bible-atlas/figures/every/work'
sys.path.insert(0, os.path.join(W, 'tc'))
import resolve as tcr
BOOKS = tcr.BOOKS
ALIAS = {'Psalm': 'Psalms', 'Song of Songs': 'Song of Solomon'}


def parse(ref):
    m = re.match(r'^(.+?) (\d+)(?::(\d+)(?:-(\d+))?)?', ref)
    if not m:
        return None
    b = ALIAS.get(m.group(1), m.group(1))
    if b not in BOOKS:
        return None
    c = int(m.group(2))
    v1 = int(m.group(3) or 0)
    v2 = int(m.group(4) or v1 or 999)
    return BOOKS.index(b), c, v1 or 1, v2


def meets(a, b):
    return a and b and a[0] == b[0] and a[1] == b[1] and a[2] <= b[3] and b[2] <= a[3]


def live():
    figs = []
    d = f'{LW}/config/figures'
    for f in sorted(os.listdir(d)):
        for n in json.load(open(f'{d}/{f}'))['notes']:
            figs.append((parse(n['ref']), n['id'], n['form']))
    lay = []
    for p in json.load(open(f'{LW}/config/layers.json'))['passages']:
        lay.append((parse(p['ref']), p['id'], sorted({l['kind'] for l in p['layers']})))
    return figs, lay


def make(nn, per):
    rows = [dict(json.loads(l), n=i) for i, l in enumerate(open(f'{E}/handoff-{nn}.jsonl'))]
    figs, lay = live()
    for r in rows:
        at = parse(r['ref'])
        r['live'] = [f'{i} ({fm})' for a, i, fm in figs if meets(a, at)]
        r['layers'] = [f'{i} ({", ".join(k)})' for a, i, k in lay if meets(a, at)]
    rows.sort(key=lambda r: (parse(r['ref']) or (99, 0, 0, 0), r['n']))
    out = []
    for k in range(0, len(rows), per):
        out.append({'key': f'h{nn}-{k // per:02d}', 'cands': rows[k:k + per]})
    os.makedirs(f'{HERE}/h{nn}', exist_ok=True)
    json.dump(out, open(f'{HERE}/h{nn}/batches.json', 'w'), indent=1, ensure_ascii=False)
    print(len(rows), 'candidates in', len(out), 'batches;', sum(1 for r in rows if r['live']), 'meet a live figure note')


def show(nn, k):
    b = json.load(open(f'{HERE}/h{nn}/batches.json'))[int(k)]
    print('batch', b['key'], '-', len(b['cands']), 'candidates')
    for r in b['cands']:
        print()
        print(json.dumps(r, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    if sys.argv[1] == 'show':
        show(sys.argv[2], sys.argv[3])
    else:
        make(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6)
