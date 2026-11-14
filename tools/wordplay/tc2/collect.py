"""collect.py: gather the held passages' read results from workflow journals.
  python3 -I collect.py reads RUN...     -> out/reads_results.json (best status per cid wins) and out/chapter1.json
  python3 -I collect.py pointers RUN...  -> out/pointers.json (cid -> pointer, the checker's version)
  python3 -I collect.py cb RUN...        -> out/cbfix_results.json (Companion Bible notes copied from the page)
A journal line of type "result" holds one agent's return value; later runs overwrite earlier ones only with an equal or better status."""
import json, os, sys, collections
J = '/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
RANK = {'found': 2, 'not_found': 1, 'not_read': 0}


def results(run):
    labels = {}
    for l in open(J + run + '/journal.jsonl'):
        d = json.loads(l)
        if d.get('type') == 'started':
            labels[d.get('key')] = d.get('label', '')
        if d.get('type') == 'result' and d.get('result'):
            yield labels.get(d.get('key'), ''), d['result']


mode, runs = sys.argv[1], sys.argv[2:]
if mode in ('reads', 'cb'):
    path = f'{OUT}/reads_results.json' if mode == 'reads' else f'{OUT}/cbfix_results.json'
    best = {c['cid']: c for c in (json.load(open(path)) if os.path.exists(path) else [])}
    ch1 = {c['url']: c for c in (json.load(open(f'{OUT}/chapter1.json')) if os.path.exists(f'{OUT}/chapter1.json') else [])}
    for w in runs:
        for label, r in results(w):
            if not isinstance(r, dict):
                continue
            for c in r.get('cites', []) or []:
                o = best.get(c['cid'])
                if o is None or RANK[c['status']] >= RANK[o['status']]:
                    best[c['cid']] = c
            for c in r.get('chapter1', []) or []:
                ch1.setdefault(c['url'], c)
    json.dump(list(best.values()), open(path, 'w'), indent=1, ensure_ascii=False)
    if mode == 'reads':
        json.dump(list(ch1.values()), open(f'{OUT}/chapter1.json', 'w'), indent=1, ensure_ascii=False)
    cites = json.load(open(f'{OUT}/reads/cites.json'))
    direct = {d['cid'] for d in json.load(open(f'{OUT}/reads/direct.json'))}
    need = [c for c in cites if c['cid'] not in direct and c['source'] != 'tyndale-notes' and (mode == 'reads' or c['source'] == 'bullinger-cb')]
    st = collections.Counter(best.get(c['cid'], {'status': 'missing'})['status'] for c in need)
    print(mode, 'results', len(best), 'of', len(need), dict(st))
    if mode == 'reads':
        print('chapter1 pages', len(ch1), 'denying', [u for u, c in ch1.items() if c.get('denies_authorship')])
        print('denies verdicts', [(c['cid'], c.get('verdict_words')) for c in best.values() if c.get('verdict') == 'denies'])
elif mode == 'pointers':
    ptr = {}
    for w in runs:
        for label, r in results(w):
            if label.startswith('check'):
                for it in (r.get('items') if isinstance(r, dict) else r) or []:
                    ptr[it['cid']] = it['pointer']
        if not ptr:   # a run whose journal labels nothing: take the return value of the whole run
            for label, r in results(w):
                if isinstance(r, list):
                    for it in r:
                        ptr[it['cid']] = it['pointer']
    json.dump([{'cid': k, 'pointer': v} for k, v in ptr.items()], open(f'{OUT}/pointers.json', 'w'), indent=1, ensure_ascii=False)
    print('pointers', len(ptr))
