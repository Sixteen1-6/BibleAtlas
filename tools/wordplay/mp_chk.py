import json, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
from mp_verify import note, AB, WORK, refs_in
cands = json.load(open('/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/mp_out.json'))['candidates']
for c in cands:
    if c['kind'] != 'allusion': continue
    tgt = refs_in(c['what'] + ' ' + c['target'] + ')')
    tb = re.match(r'^(.+?) (\d+):', c['target'])
    tset = {(AB[tb.group(1)], int(tb.group(2)))}
    miss = []
    for s in c['sources']:
        w = WORK.get(s['source'])
        if not w: continue
        t = note(w, s['on'], 3 if w == 'kad' else 1)
        allt = {(a, ch) for a, ch, v in tgt} | tset
        if not any(re.search(rf'\b{a} {ch}:', t) for a, ch in allt):
            miss.append(s['source'])
    if miss:
        print(c['ref'], c['target'], 'MISS:', miss, 'of', [s['source'] for s in c['sources']])
