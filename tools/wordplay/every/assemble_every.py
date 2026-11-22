#!/usr/bin/env python3
"""assemble_every.py <NN> <repo worktree> <out dir> [--forms <proposed forms.json>]

Puts one cited hand-off of the figure catalogue (every/hNN/work/hNN-KK/) into a clean checkout of main:
- each batch's last stage that returned, from the workflow journals in hNN/runs.json (the second reader's, else the
  skeptic's, when a run used writer and skeptic only);
- every cite again: on the cite list and quotable, its writer named by the cite list on that book (figpost.cite_rule),
  its words found word for word in a pinned local copy, or on a web page a checking agent fetched (the fetch log);
  otherwise the cite is dropped; strength is recounted from the writers left; a note whose evidence still names a
  dropped writer, or that fails the build's own checks (figcheck), is held, not written;
- a note on the same kind, form, verses and sides as a live note is a duplicate and is skipped; an id already on
  main gets "-2";
- proposed forms the notes use are added to config/figure-forms.json, with the evidence for their definitions;
- the records of where each quotation was read go to docs/evidence/figures-wordplay-every-hNN-<date>.json.
Writes <out dir>/report.json and prints the counts."""
import glob, json, os, re, sys, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.dirname(HERE)
sys.path.insert(0, f'{W}/fig')
sys.path.insert(0, W)
sys.path.insert(0, f'{W}/w3')
import figcheck as fc
import figpost

argv = sys.argv[1:]
forms_path = None
if '--forms' in argv:
    i = argv.index('--forms')
    forms_path = argv[i + 1]
    del argv[i:i + 2]
NN, repo, out = argv[0], argv[1], argv[2]
fc.add_forms(f'{repo}/config/figure-forms.json')  # the forms already on the branch the notes go into
if forms_path:
    fc.add_forms(forms_path)
TODAY = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
H = f'{HERE}/h{NN}'
os.makedirs(out, exist_ok=True)
FOS_URL = 'https://raw.githubusercontent.com/darrelwright/UniqueBible_Books/4017a67481e0de6027216bbdf3fc5d42c9c289d5/Bullinger%20-%20Figures%20of%20Speach.book.zip'
LC_URL = 'https://raw.githubusercontent.com/LetsChurch/lets.church/71f6f0f/packages/lets.bible/seed/commentaries/calvin.json'


def jload(p):
    return json.load(open(p, encoding='utf-8'))


def jdump(p, d):
    with open(p, 'w', encoding='utf-8') as o:
        o.write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')


def roundtrips(p):
    t = open(p, encoding='utf-8').read()
    return json.dumps(json.loads(t), ensure_ascii=False, indent=2) + '\n' == t


def span(n):
    return (n['kind'], n['form'], fc.resolve(n['ref']), tuple(sorted(x['who'] for x in n.get('sides', []))))


report = {'batches': {}, 'dropped_cites': [], 'held': [], 'needs_writer': [], 'duplicates': [], 'renamed': [], 'unfinished': []}

# main's notes
live, live_span = {}, {}
for f in sorted(glob.glob(f'{repo}/config/figures/*.json')):
    assert roundtrips(f), f
    for n in jload(f)['notes']:
        live[n['id']] = os.path.basename(f)
        live_span[span(n)] = n['id']

batches = jload(f'{H}/batches.json')
JROOT = '/root/.claude/projects/-home-claude/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows'
RES = figpost.journal_results([f'{JROOT}/{r}/journal.jsonl' for r in jload(f'{H}/runs.json')])
new, recs_all, seen_ids = [], [], set(live)
for b in batches:
    k = b['key']
    d = f'{H}/work/{k}'
    # the last stage that returned, as the workflow journal records it (a file alone may be from a stage cut off)
    stage = next((st for st in ('confirm', 'check') if (RES.get(f'{st}:{k}') or {}).get('notes') is not None), None)
    if not stage:
        report['unfinished'].append(k)
        continue
    notes = RES[f'{stage}:{k}']['notes']
    report['batches'][k] = {'stage': stage, 'notes': len(notes)}
    for n in notes:
        n = json.loads(json.dumps(n))
        n.pop('n', None)
        n['checked'] = n['checked'] if fc.date_ok(n.get('checked')) else TODAY
        kept, recs = [], []
        for c in n.get('cites', []):
            c.pop('by', None)
            _, why = figpost.cite_rule(c)
            found_in = ctx = None
            if not why:
                loc = figpost.local_source(c)
                if loc:
                    c['read'], found_in, ctx = loc
                    c['retrieved'] = c['retrieved'] if fc.date_ok(c.get('retrieved')) else TODAY
                else:
                    web = figpost.web_source(c)
                    if web:
                        c['read'], found_in, ctx, c['retrieved'] = web
                    else:
                        why = 'quote not found in the local copy, and no logged fetch of a page it names'
            if why:
                report['dropped_cites'].append({'batch': k, 'note': n['id'], 'source': c['source'], 'on': c.get('on'), 'found': c.get('found'), 'why': why})
                continue
            recs.append({'note': n['id'], 'field': 'cites', 'source': c['source'], 'on': c['on'], 'quote': c['quote'],
                         'found_in': found_in, 'context': ctx})
            kept.append({x: c[x] for x in ('source', 'work', 'on', 'at', 'url', 'quote', 'read', 'retrieved') if x in c})
        dropped = [c['source'] for c in n.get('cites', []) if c['source'] not in {x['source'] for x in kept}]
        n['cites'] = kept
        ws = figpost.interpreters(kept)
        if not ws:
            report['needs_writer'].append({'batch': k, 'note': n['id'], 'dropped': dropped})
            continue
        n['strength'] = fc.strength_for(len(ws))
        left = {s for c in kept for s in figpost.SURNAME.get(c['source'], [])}
        stale = [s for x in dropped for s in figpost.SURNAME.get(x, []) if s not in left and fc.names_word(n.get('evidence', ''), s)]
        if stale:
            report['held'].append({'batch': k, 'note': n['id'], 'why': f'evidence still names {", ".join(stale)}, whose cite was dropped'})
            continue
        if span(n) in live_span:
            report['duplicates'].append({'batch': k, 'note': n['id'], 'same_as': live_span[span(n)]})
            continue
        base, i = n['id'], 2
        while n['id'] in seen_ids:
            n['id'] = f'{base}-{i}'
            i += 1
        if n['id'] != base:
            report['renamed'].append({'batch': k, 'from': base, 'to': n['id']})
            for r in recs:
                r['note'] = n['id']
        ck = fc.Check(local=True)
        ck.note(n, set())
        if ck.errors:
            report['held'].append({'batch': k, 'note': n['id'], 'why': '; '.join(ck.errors)})
            continue
        seen_ids.add(n['id'])
        live_span[span(n)] = n['id']
        new.append(n)
        recs_all += recs

# into the worktree, book by book, in verse order after the notes already there
by_book = {}
for n in new:
    by_book.setdefault(figpost.osis_of(n), []).append(n)
for bk, ns in sorted(by_book.items()):
    p = f'{repo}/config/figures/{bk}.json'
    # main's notes stay where they are (so the diff only adds); each new note goes after the last note at or before it
    allns = list(jload(p)['notes'] if os.path.exists(p) else [])
    K = lambda n: (fc.resolve(n['ref'])[0], fc.resolve(n['ref'])[1], n['id'])
    for n in sorted(ns, key=K):
        k = K(n)
        allns.insert(max((i + 1 for i, x in enumerate(allns) if K(x) <= k), default=0), n)
    jdump(p, {'notes': allns})

# forms the new notes use that main lacks
used = {n['form'] for n in new}
p = f'{repo}/config/figure-forms.json'
assert roundtrips(p)
ff = jload(p)
have_forms = {f['id'] for f in ff['forms']}
added_forms, def_recs = [], []
# the verse heading a quotable commentator's definition sits under in the pinned copy (hNN/forms-on.json), for its record
DEF_ON = jload(f'{H}/forms-on.json') if os.path.exists(f'{H}/forms-on.json') else {}
if forms_path:
    for f in jload(forms_path)['forms']:
        if f['id'] in used and f['id'] not in have_forms:
            ff['forms'].append(f)
            added_forms.append(f['id'])
            dfn = f.get('defined')
            if dfn:
                if dfn['source'] == 'bullinger-fos':
                    hay = open(f'{W}/fos.txt', encoding='utf-8').read()
                    def_recs.append({'form': f['id'], 'field': 'defined', 'source': dfn['source'], 'quote': dfn['quote'],
                                     'found_in': FOS_URL, 'context': figpost.context(hay, dfn['quote'])})
                else:
                    on = DEF_ON.get(f['id'])
                    loc = figpost.local_source({'source': dfn['source'], 'on': on, 'quote': dfn['quote']}) if on else None
                    def_recs.append({'form': f['id'], 'field': 'defined', 'source': dfn['source'], 'quote': dfn['quote'],
                                     'found_in': loc[1] if loc else dfn['url'], 'also_in': dfn['url'] if loc else None,
                                     'context': loc[2] if loc else ''})
    jdump(p, ff)

ev = f'{repo}/docs/evidence/figures-wordplay-every-h{NN}-{TODAY}.json'
jdump(ev, {'kind': 'figure-quotes', '_comment': [
    f"Where each quotation in the Wordplay thread's notes from hand-off {NN} of the figure catalogue's every-instance plan was found (and each new form's definition). Records as in figures-2026-10-21.json.",
    "found_in is the public-domain copy the words were read in, pinned to a commit, or the web page a checking reader fetched that day; context is the copy's text around the quotation, lowercased with punctuation dropped, as the comparison was made."],
    'checked': def_recs + recs_all})

# the final pass, as the build reads every file together
ck = fc.Check(local=True)
seen = set()
for f in sorted(glob.glob(f'{repo}/config/figures/*.json')):
    for n in jload(f)['notes']:
        ck.note(n, seen)
kinds, forms = {}, {}
for n in new:
    kinds[n['kind']] = kinds.get(n['kind'], 0) + 1
    forms[n['form']] = forms.get(n['form'], 0) + 1
report['counts'] = {'notes': len(new), 'books': len(by_book), 'kinds': kinds, 'forms': forms, 'added_forms': added_forms,
                    'evidence_records': len(def_recs) + len(recs_all), 'final_check_problems': len(ck.errors)}
report['final_check'] = ck.errors[:50]
jdump(f'{out}/report.json', report)
print(json.dumps(report['counts']))
print(len(report['unfinished']), 'batches unfinished;', len(report['dropped_cites']), 'cites dropped;', len(report['held']), 'held;',
      len(report['needs_writer']), 'left with no writer;', len(report['duplicates']), 'duplicates;', len(report['renamed']), 'renamed')
for e in ck.errors[:20]:
    print(' ', e)
