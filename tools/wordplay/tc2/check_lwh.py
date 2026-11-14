"""check_lwh.py: after the review's fixes, mk_ev2.py's tests on the held notes as they now stand in lwh's config/layers.json,
plus the same never-quoted 5-word test on each note's text, dashes, HTML entities, AI words, barred names and lengths. Writes nothing."""
import json, os, re, html
HERE = os.path.dirname(os.path.abspath(__file__))
LW = os.environ['ATLAS_LW']
src = open(f'{HERE}/mk_ev2.py').read().split("os.makedirs(f'{O}/ev'")[0]
held = {p['id'] for p in json.load(open(f'{HERE}/out/final/held-new-passages.json'))['passages']}
now = {p['id']: p for p in json.load(open(f'{LW}/config/layers.json'))['passages'] if p['id'] in held}
assert len(now) == len(held), (len(now), len(held))
facts = json.load(open(f'{HERE}/out/facts.json'))
for x in facts:
    l = now[x['passage']]['layers'][x['note']]
    if l['kind'] != x['kind']:
        print('kind changed:', x['passage'], x['note'], x['kind'], '->', l['kind'])
    x['evidence'] = l['evidence']
    x['dropped'] = []
src = src.replace("facts = json.load(open(f'{O}/facts.json'))", "facts = FACTS")
src = src.replace("if d['why'] != 'not read again yet':", "if False:")
g = {'FACTS': facts, '__file__': f'{HERE}/mk_ev2.py'}
exec(compile(src, 'mk_ev2', 'exec'), g)
print(len(g['tasks']), 'notes flagged by the evidence tests')
for t in g['tasks']:
    print(' ', t['passage'], t['note'], t['why'])
BARRED = re.compile(r'Origen|Tertullian|Hippolytus|Victorinus|Clement of Alexandria|Didymus|Theodore of Mopsuestia|Pelagius|Opus Imperfectum|Lactantius|\bGloss\b|Theodoret')
toks = lambda s: re.findall(r"[a-z']+", (s or '').lower().replace('’', "'"))
nq = g['nq']
bad = 0
for x in facts:
    l = now[x['passage']]['layers'][x['note']]
    for f, lim in (('text', 300), ('evidence', 400)):
        v = l.get(f) or ''
        p = []
        if len(v) > lim: p.append(f'{len(v)} characters')
        if re.search('[—–]', v): p.append('dash')
        if BARRED.search(v): p.append('barred ' + BARRED.search(v).group(0))
        if re.search(r'&\w+;', v) or html.unescape(v) != v: p.append('entity')
        if re.search(r'\bAI\b|Claude|checked by|reviewed', v): p.append('AI words')
        vt = toks(v)
        vg = {tuple(vt[i:i + 5]) for i in range(len(vt) - 4)}
        for k in x['kept']:
            if nq.get((x['passage'], x['note'], k['cite']['source'], k['cite'].get('on'), k['cite'].get('at'))):
                for r in k['rows']:
                    q = toks(r['quote'])
                    com = vg & {tuple(q[i:i + 5]) for i in range(len(q) - 4)}
                    if com: p.append(f"repeats {k['cite']['source']}: {' '.join(sorted(com)[0])}")
        if p:
            bad += 1
            print('PROBLEM', x['passage'], x['note'], f, p, '|', v[:160])
print(bad, 'field problems')
