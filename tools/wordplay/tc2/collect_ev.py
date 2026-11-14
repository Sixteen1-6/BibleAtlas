"""collect_ev.py RUN...: the checked evidence lines from held-evidence-true-writers runs -> out/ev_results.json,
then the same tests mk_ev2.py makes, on the new lines (plus: no dash, no HTML entity, every kept writer still named).
out/ev_fix.json (hand fixes: passage, note, evidence and optionally text) wins over the runs."""
import json, os, re, sys, html
HERE = os.path.dirname(os.path.abspath(__file__))
O = f'{HERE}/out'
J = '/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows/'
tasks = {(t['passage'], t['note']): t for t in json.load(open(f'{O}/ev_tasks.json'))}
got = {}
for run in sys.argv[1:]:
    labels = {}
    for l in open(J + run + '/journal.jsonl'):
        d = json.loads(l)
        if d.get('type') == 'started':
            labels[d['key']] = d.get('label', '')
        if d.get('type') == 'result' and labels.get(d.get('key'), '').startswith('check') and d.get('result'):
            for r in d['result']['results']:
                got[(r['passage'], r['note'])] = r
fix = {(r['passage'], r['note']): r for r in (json.load(open(f'{O}/ev_fix.json')) if os.path.exists(f'{O}/ev_fix.json') else [])}
got.update({k: dict(got.get(k, {}), **v) for k, v in fix.items()})
missing = [k for k in tasks if k not in got]
extra = [k for k in got if k not in tasks]
BARRED = re.compile(r'Origen|Tertullian|Hippolytus|Victorinus|Clement of Alexandria|Didymus|Theodore of Mopsuestia|Pelagius|Opus Imperfectum|Lactantius|\bGloss\b|Theodoret')
toks = lambda s: re.findall(r"[a-z']+", (s or '').lower().replace('’', "'"))
bad = []
for k, t in tasks.items():
    r = got.get(k)
    if not r:
        continue
    e = r['evidence'] = html.unescape(r['evidence'])
    p = []
    if len(e) > 400: p.append(f'{len(e)} characters')
    if re.search('[—–]', e): p.append('dash')
    if BARRED.search(e): p.append('barred ' + BARRED.search(e).group(0))
    if re.search(r'&\w+;', e): p.append('entity')
    if re.search(r'\bAI\b|Claude|checked by', e): p.append('AI words')
    et = toks(e)
    eg = {tuple(et[i:i + 5]) for i in range(len(et) - 4)}
    for c in t['kept']:
        if c['never_quote']:
            for q in c['quotes']:
                qt = toks(q)
                com = eg & {tuple(qt[i:i + 5]) for i in range(len(qt) - 4)}
                if com: p.append(f"repeats {c['call_it']}: {' '.join(sorted(com)[0])}")
        # every kept writer still credited by a surname (or the set phrase)
        ci = re.sub(r'\s*\(.*?\)', '', c['call_it']).replace(', in the Catena Aurea', '')
        name = ci.split(' and ')[0].split()[-1] if not ci.startswith('the ') else None
        alts = {'Tyndale': 'Tyndale', 'Reformation': 'Reformation', 'NET': 'NET', 'Geneva': 'Geneva', 'continuation': 'continuation of Poole'}
        if ci.startswith('the '):
            name = next((v for a, v in alts.items() if a in ci), None)
        if name and name.lower() not in e.lower() and not (name in ('Beza', 'Villiers') and 'Geneva' in e):
            p.append(f"kept writer not named: {c['call_it']}")
    for d in t['dropped']:
        pass
    if p:
        bad.append((k, p, e))
json.dump([dict(v, passage=k[0], note=k[1]) for k, v in got.items() if k in tasks], open(f'{O}/ev_results.json', 'w'), indent=1, ensure_ascii=False)
print('results', len(got), 'missing', missing, 'extra', extra, 'problems', len(bad))
for k, p, e in bad:
    print(' ', k, p, '|', e[:200])
