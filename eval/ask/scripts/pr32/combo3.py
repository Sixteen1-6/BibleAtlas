import json, collections, sys
S, T = sys.argv[1], sys.argv[2]
V = {}
for f in ['wlar9hr36', 'wf94mdke9', 'wq431efei', 'wai1qr5hd', 'wmm2tlp1g']:
    for r in json.load(open(f'{T}/{f}.output'))['result']['results']:
        for v in r['verses']: V[(r['q'], v['ref'])] = v['verdict']
shown = {}  # (q, chain) -> shown list
for f in ['crazy9/new9.json', 'crazy9/new9w.json', 'crazy9/new9x.json', 'crazy9/live9.json', 'eval2/new7.json', 'eval2/new7w.json', 'eval2/new7x.json', 'eval2/live7.json', 'eval2/unk-run.json']:
    for r in json.load(open(f'{S}/{f}')):
        if r.get('chain'): shown[(r['q'], r['chain'])] = r['shown']
G = {k: {r['q']: r['shown'] for r in json.load(open(f'{S}/eval2/g-{k}.json'))} for k in 'ABCEFG'}
care = {r['q'] for f in ['crazy9/new9x.json', 'eval2/new7x.json'] for r in json.load(open(f'{S}/{f}')) if r['how'] == 'care'}
def run(rtfile, t, g, n):
    rt = json.load(open(f'{S}/eval2/{rtfile}'))
    st = collections.Counter(); miss = 0
    for r in rt:
        q = r['q']
        if q in care: continue
        m = r['meant'][0] if r['meant'] else None
        if r['exact']: pick = r['exact']
        elif m and m['p'] >= t: pick = m['id']
        elif r['open'] and not (m and m['p'] >= 0.8 and m['id'] == r['open']): pick = r['open']
        else: pick = None
        if pick:
            sh = shown.get((q, pick)); st['routed'] += 1
            if sh is None: miss += 1; continue
        else: sh = G[g][q]
        vs = [V.get((q, x['ref'])) for x in sh[:n]]
        c = collections.Counter(vs)
        st['q'] += 1; st['qa'] += c['answers'] > 0; st['ans'] += c['answers']; st['off'] += c['off']; st['rel'] += c['related']; st['unj'] += c[None]
        if pick: st['r_qa'] += c['answers'] > 0
        else: st['g_q'] += 1; st['g_qa'] += c['answers'] > 0; st['g_off'] += c['off']; st['g_n'] += len(vs)
    tot = st['ans'] + st['off'] + st['rel']
    print(f"{rtfile[:9]} t={t} gather {g} first {n}: routed {st['routed']} (missing {miss}); with an answer {st['qa']}/{st['q']}; answering {st['ans']}, off {st['off']} ({100*st['off']/tot:.0f}%), unjudged {st['unj']}; gathered: {st['g_qa']}/{st['g_q']} answered, off {100*st['g_off']/max(1,st['g_n']):.0f}%")
for n in (6, 8):
    for g in 'ABCEFG':
        run('rt-97w-out.json', 0.8, g, n)
        for t in (0.7,): run('rt-97x-out.json', t, g, n)
    print()
