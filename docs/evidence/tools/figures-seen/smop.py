#!/usr/bin/env python3
"""Apply the judgements of places a reading run held for want of a judge.

Usage: python3 -I smop.py NN MOP.json READ.json EVIDENCE.json REPO LOGDIR CHECKED

MOP.json is the layers-seen-mop result ({nn, judged}); READ.json the reading
run's result, whose two readings of each place say which new forms a reader
proposed. Each judged place is settled the way sapply.py settles a judged place
(a new form stands only if a reader proposed it, the place is checked as the
build checks it); kept places go into config/figures-seen/, and the evidence
record and the drop log say what happened.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name):
    spec = importlib.util.spec_from_file_location(name, f'{HERE}/{name}.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


A = load('sapply')
P = load('sspan')

nn, mopp, readp, evp, repo, logdir, checked = sys.argv[1:8]
nn = nn.zfill(2)
mop = json.load(open(mopp, encoding='utf-8'))
mop = mop.get('result', mop)
assert mop['nn'] == nn
read = json.load(open(readp, encoding='utf-8'))
read = read.get('result', read)
disputed = {d['i']: d for b in read['results'] for d in b['disputed']}
rows = [json.loads(l) for l in open(f'{A.WORK}/words-{nn}.jsonl', encoding='utf-8')]
forms = {f['id']: f for f in json.load(open(f'{repo}/config/figure-forms.json', encoding='utf-8'))['forms']}
cdir = f'{repo}/config/figures-seen'
notes = P.notes_in(cdir)
ev = json.load(open(evp, encoding='utf-8'))
settled = set()
drops = []
for j in mop['judged']:
    i = j['i']
    row = rows[i]
    assert row['id'] == j['id'], (row['id'], j['id'])
    form, words, original = row['form'], list(row['words']), list(row.get('original') or [])
    why = None
    if j['final'] != 'keep':
        why = 'dropped on reading'
    else:
        if j['form'] != row['form']:
            d = disputed.get(i, {})
            proposed = {x.get('better_form') for x in (d.get('a'), d.get('b')) if isinstance(x, dict)}
            if j['form'] in proposed:
                form = j['form']
            else:
                why = f'judge moved it to {j["form"]}, which no reader proposed'
        if j.get('words'):
            words = j['words']
        if j.get('strip_original') and original:
            original = []
    r = {'id': A.id_for(row['ref'], form), 'form': form, 'ref': row['ref'], 'words': words}
    if original:
        r['original'] = original
    r['methods'] = row['methods']
    r['checked'] = checked
    if why is None:
        why = A.check(r, forms)
        if why:
            why = f'build would refuse: {why}'
    if why is None and r['id'] in notes:
        why = f'same form already on this verse ({r["id"]})'
    rec = {'i': i, 'id': row['id'], 'kept': None, 'how': 'read a third time'}
    if why:
        rec['why'] = j.get('reason') or why
        drops.append({'i': i, 'id': row['id'], 'ref': row['ref'], 'form': row['form'], 'why': why, 'reasons': [j.get('reason', '')]})
    else:
        osis = A.W.parse(r['ref'])[0]['osis']
        book = [n for _id, (o, n) in notes.items() if o == osis] + [r]
        P.write_book(cdir, osis, book)
        notes[r['id']] = (osis, r)
        rec['kept'] = r['id']
        rec['why'] = j.get('reason', '')
        changed = [k for k, a, b in (('form', row['form'], r['form']), ('words', row['words'], r['words']),
                                     ('original', row.get('original') or [], r.get('original') or [])) if a != b]
        if changed:
            rec['changed'] = changed
        ev['counts']['judge kept'] = ev['counts'].get('judge kept', 0) + 1
    ev['places'].append(rec)
    settled.add(i)
ev['places'].sort(key=lambda p: p['i'])
ev['counts']['held'] = ev['counts'].get('held', 0) - len(settled)
if not ev['counts']['held']:
    ev['counts'].pop('held')
ev['counts']['kept'] = sum(1 for p in ev['places'] if p['kept'])
ev['counts']['dropped'] = sum(1 for p in ev['places'] if not p['kept'])
P.write_evidence(evp, ev)
logp = f'{logdir}/words-{nn}-drops.jsonl'
old = [json.loads(l) for l in open(logp, encoding='utf-8')]
old = [d for d in old if not (d['i'] in settled and d['why'].startswith('held'))]
with open(logp, 'w', encoding='utf-8') as f:
    for d in old + drops:
        f.write(json.dumps(d, ensure_ascii=False) + '\n')
print(f'{len(settled)} settled: {len(settled) - len(drops)} kept, {len(drops)} dropped; kept now {ev["counts"]["kept"]}')
