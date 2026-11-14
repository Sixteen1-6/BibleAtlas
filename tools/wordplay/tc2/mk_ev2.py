"""mk_ev2.py: the held notes whose evidence line must change -> out/ev/ev_NNN.json (tasks in batches) and out/ev_tasks.json.
A note needs a new line when:
  - a cite was dropped (convert's facts, or assemble's report: not read on its page);
  - the line credits a many-handed set (Barnes, Henry, Poole, Ellicott, the Pulpit, JFB, Keil and Delitzsch, the Catena)
    without naming the man who wrote that book's comment;
  - it repeats five or more words in a row of a work that is never quoted (Pulpit, NET, RSB, copyrighted modern works);
  - it names a father this project never cites (Origen, Tertullian, Lactantius and the rest);
  - it is longer than 400 characters (the build's limit)."""
import json, os, re, collections
HERE = os.path.dirname(os.path.abspath(__file__))
O = f'{HERE}/out'
LW = os.environ['ATLAS_LW']
S = json.load(open(LW + '/config/layer-sources.json'))
CITE = {c['id']: c for c in S['cite']}
facts = json.load(open(f'{O}/facts.json'))
cites = json.load(open(f'{O}/reads/cites.json'))
nq = {(c['passage'], c['note'], c['source'], c['on'], c['at']): c['never_quote'] for c in cites}
rep = json.load(open(f'{O}/final/report.json'))
late = collections.defaultdict(list)
for d in rep.get('cite_dropped', []):
    if d['why'] != 'not read again yet':   # those three are being read now
        late[(d['passage'], d['source'], d['on'])].append(d['why'])

SET = {'barnes': ("Barnes' Notes", 'Albert Barnes'), 'henry': ("Matthew Henry's Commentary", 'Matthew Henry'),
       'henry-concise': ("the Concise Commentary", None), 'poole': ("Poole's Annotations", 'Matthew Poole'),
       'ellicott': ("Ellicott's Commentary", None), 'pulpit': ('the Pulpit Commentary', None),
       'jfb': ('Jamieson-Fausset-Brown', None), 'keil-delitzsch': ('Keil and Delitzsch', None)}
MENTION = {'barnes': r'Barnes', 'henry': r'Henry', 'poole': r'Poole', 'ellicott': r'Ellicott', 'pulpit': r'Pulpit',
           'jfb': r'JFB|Jamieson|Fausset|\bBrown\b', 'keil-delitzsch': r'\bKeil\b|Delitzsch|\bKD\b'}
BARRED = re.compile(r'Origen|Tertullian|Hippolytus|Victorinus|Clement of Alexandria|Didymus|Theodore of Mopsuestia|Pelagius|Opus Imperfectum|Lactantius|\bGloss\b')


def toks(s):
    return re.findall(r"[a-z']+", (s or '').lower())


def call_it(k):
    s, w = k['cite']['source'], k['writer']
    name = ' and '.join(x for x in w if x)
    if s in SET:
        setname, head = SET[s]
        if s == 'henry-concise':
            return f"the Concise Commentary (abridging {name}'s work)" if k['key'] != 'matthew-henry' else "Henry's Concise Commentary (it counts as Matthew Henry)"
        if head and name == head:
            return head
        if s == 'poole' and name.startswith('a '):
            return "the continuation of Poole's Annotations (its writer's name is not printed)"
        if name.startswith(('a ', 'the ')):
            return f'{setname}, {name}'
        return f'{name} ({setname})'
    if s == 'catena-aurea':
        m = re.search(r'quoting (.+)$', k['cite'].get('at', '') or '')
        return f"{m.group(1) if m else name}, in the Catena Aurea"
    if k['work'] and k['role'] == 'interpreter' and name:
        return name
    return CITE[s]['name']


tasks = []
for x in facts:
    e = x['evidence'] or ''
    why = []
    et = toks(e)
    eg = {tuple(et[i:i + 5]) for i in range(len(et) - 4)}
    for k in x['kept']:
        s = k['cite']['source']
        if s in SET and s != 'henry-concise' and re.search(MENTION[s], e):
            # the line names the set: it must name the man who wrote this book's comment (an unnamed one by his description)
            surn = [n.split()[-1] for n in k['writer'] if n and not n.startswith('a ')]
            named = all(sn in e for sn in surn) if surn else 'continuation' in e
            if s == 'barnes' and k['writer'] == ['Albert Barnes'] or s == 'henry' and k['writer'] == ['Matthew Henry'] or s == 'poole' and k['writer'] == ['Matthew Poole']:
                named = True
            if not named:
                why.append(f"credit {call_it(k)} for the comment on {k['cite'].get('on')}: the evidence does not name him")
        if nq.get((x['passage'], x['note'], s, k['cite'].get('on'), k['cite'].get('at'))):
            for r in k['rows']:
                q = toks(r['quote'])
                common = sorted(' '.join(c) for c in eg & {tuple(q[i:i + 5]) for i in range(len(q) - 4)})
                if common:
                    why.append(f"the evidence repeats words of {call_it(k)}, which are never quoted ({'; '.join(common[:3])}): give its point in other words")
        for w in late.get((x['passage'], s, k['cite'].get('on')), []):
            why.append(f"cite dropped: {call_it(k)} on {k['cite'].get('on')} (its page could not be read); take out what the evidence credits to it")
    for d in x['dropped']:
        why.append(f"cite dropped: {d['cite']['source']} on {d['cite'].get('on')} ({d['why'][:160]}); take out what the evidence credits to it")
    for m in sorted(set(BARRED.findall(e))):
        why.append(f'the evidence names {m}, whom this project never cites: take him out')
    if len(e) > 400:
        why.append(f'the evidence is {len(e)} characters; keep it to 400')
    if why:
        kept = [{'source': k['cite']['source'], 'on': k['cite'].get('on'), 'at': k['cite'].get('at'), 'call_it': call_it(k),
                 'quotes': [r['quote'] for r in k['rows']],
                 'never_quote': bool(nq.get((x['passage'], x['note'], k['cite']['source'], k['cite'].get('on'), k['cite'].get('at'))))} for k in x['kept']
                if not late.get((x['passage'], k['cite']['source'], k['cite'].get('on')))]
        tasks.append({'passage': x['passage'], 'note': x['note'], 'kind': x['kind'], 'strength': x['new_strength'], 'text': x['text'],
                      'evidence': e, 'why': sorted(set(why)), 'kept': kept,
                      'dropped': [{'source': d['cite']['source'], 'on': d['cite'].get('on'), 'why': d['why'][:200]} for d in x['dropped']]})
os.makedirs(f'{O}/ev', exist_ok=True)
json.dump(tasks, open(f'{O}/ev_tasks.json', 'w'), indent=1, ensure_ascii=False)
files = []
for i in range(0, len(tasks), 6):
    fn = f'ev_{i // 6:03d}.json'
    json.dump(tasks[i:i + 6], open(f'{O}/ev/{fn}', 'w'), indent=1, ensure_ascii=False)
    files.append(fn)
print(len(tasks), 'tasks in', len(files), 'files')
print(collections.Counter(w.split(':')[0][:40] for t in tasks for w in t['why']).most_common(12))
