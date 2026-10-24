import json, re, sys
"""score.py run.json [verdicts.json ...]: score a run against judged verdicts and target verses."""
run = json.load(open(sys.argv[1]))
V = {}
for f in (sys.argv[2:] or ['j1/verdicts.json']):
    for r in json.load(open(f)):
        V.setdefault(r['q'], {'verses': {}, 'targets': set(), 'opens': None, 'fit': {}})
        e = V[r['q']]
        for v in r.get('verses', []): e['verses'][v['ref']] = v['verdict']
        for t in r.get('targets', []): e['targets'].add(t)
        if r.get('opens'): e['opens'] = r['opens']
        if r['kind'] == 'chain': e['fit'][r.get('opened') or ''] = r.get('chain_fit')
def label(ref):
    return ref
def in_targets(ref, targets):
    # "John 3:16" against "John 3:16-18" or "John 3:16"
    m = re.match(r'(.+) (\d+):(\d+)$', ref)
    if not m: return False
    b, c, v = m.group(1), int(m.group(2)), int(m.group(3))
    for t in targets:
        t = t.replace('–', '-')
        mm = re.match(r'(.+) (\d+):(\d+)(?:-(\d+))?$', t)
        if not mm: continue
        tb = mm.group(1)
        if tb != b and not b.startswith(tb) and not tb.startswith(b[:3]): continue
        if tb[:3] != b[:3]: continue
        tc, tv1 = int(mm.group(2)), int(mm.group(3)); tv2 = int(mm.group(4) or tv1)
        if tc == c and tv1 <= v <= tv2: return True
    return False
chain = good_chain = 0
live = 0; ans = off = unk = 0; zero = 0; empty = 0
rows = []
for r in run:
    e = V.get(r['q'], {'verses': {}, 'targets': set(), 'opens': None, 'fit': {}})
    if r.get('chain'):
        chain += 1
        ok = r['chain'] == e['opens'] or (r['q'] in V and any(k for k in [1]) and r['chain'] not in e['fit'] and e['opens'] is None and False)
        rows.append(('C', r['q'], r['chain'], e['opens']))
        continue
    if r.get('care'):
        rows.append(('H', r['q'])); continue
    live += 1
    top = [t['ref'] for t in r['top'][:8]]
    if not top: empty += 1
    a = o = u = 0
    for ref in top:
        vd = e['verses'].get(ref)
        if vd == 'answers' or in_targets(ref, e['targets']): a += 1
        elif vd == 'off': o += 1
        elif vd is None: u += 1
    ans += a; off += o; unk += u
    if top and a == 0: zero += 1
    rows.append(('L', r['q'], a, o, u))
print(f'chains opened {chain}; live {live} (empty {empty}); top-8 known answers {ans}, known off {off}, unjudged {unk}; live questions with no known answer {zero}')
if '-v' in sys.argv[0:1]: pass
json.dump(rows, open(sys.argv[1] + '.rows.json', 'w'), indent=0)
