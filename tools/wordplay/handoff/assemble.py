#!/usr/bin/env python3
"""assemble.py <repo worktree> <out dir>: puts the Wordplay thread's 2026-11-07 hand-off into a clean checkout of
main and writes the plain files beside it.

Into the worktree (each file kept in the repository's own layout; the JSON files that round-trip are re-written,
the two that do not, config/layer-sources.json and config/shelf.json, get text insertions only):
  config/figure-forms.json     the 12 new forms (n12/forms12-main.json)
  config/figures/<OSIS>.json   the 12 forms' notes (reviewed: fig/out_n12r; not yet reviewed: fig/out_n12), the
                               lw28 extra deuteronomy-6-7-metaphor, the round 2 notes (ns/review/out/notes.json),
                               and two live notes with a new writer added (ns/review/out/fig-replace.json)
  config/structures.json       13 new structures, 5 live ones with a new writer added
  config/layer-sources.json    the lowth-isaiah work and the lowth cite's second work
  config/shelf.json            the lowth-isaiah card
  docs/evidence/               figures-wordplay-n12-2026-11-07.json, figures-wordplay-r2-2026-11-07.json,
                               structures-wordplay-r2-2026-11-07.json, credits-wordplay-lowth-isaiah-2026-11-01.json
Into <out dir>: report.json (counts, what came from where, any cite without a record)."""
import difflib, glob, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.dirname(HERE)
sys.path.insert(0, f'{W}/fig')
sys.path.insert(0, W)
sys.path.insert(0, f'{W}/w3')
sys.path.insert(0, f'{W}/ns/review')
import figcheck as fc
import figpost
import webquote
import scanq

repo, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
REV = f'{W}/ns/review/out'
N12_DIRS = [f'{W}/fig/out_n12r', f'{W}/fig/out_n12']   # reviewed first
N12_FORMS = {f['id'] for f in json.load(open(f'{W}/n12/forms12-main.json'))['forms']}
EXTRA = ['deuteronomy-6-7-metaphor']
SCAN = ('lowth', 'jebb', 'boys', 'forbes')
report = {'from': {}, 'no_record': [], 'counts': {}}


def jload(p):
    return json.load(open(p, encoding='utf-8'))


def jdump(p, d):
    """The repository's layout: 2-space JSON, non-ASCII kept, a final newline. Refuses a file that would not round-trip."""
    with open(p, 'w', encoding='utf-8') as o:
        o.write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')


def roundtrips(p):
    t = open(p, encoding='utf-8').read()
    return json.dumps(json.loads(t), ensure_ascii=False, indent=2) + '\n' == t


def osis(ref):
    r = fc.resolve(ref)
    return fc.BOOKS[fc.locate(r[0])[0]]['osis']


def order(n):
    m = re.search(r'(\d+):(\d+)', n['ref'])
    return (int(m.group(1)), int(m.group(2)), n['id']) if m else (0, 0, n['id'])


# ---- the notes ------------------------------------------------------------------------------------------------
def notes_in(d):
    for f in sorted(glob.glob(f'{d}/config/figures/*.json')):
        for n in jload(f)['notes']:
            yield n


n12, n12_from = {}, {}
for d in N12_DIRS:
    for n in notes_in(d):
        if (n['form'] in N12_FORMS or n['id'] in EXTRA) and n['id'] not in n12:
            n12[n['id']], n12_from[n['id']] = n, os.path.basename(d)
r2 = jload(f'{REV}/notes.json')['notes']
replace = jload(f'{REV}/fig-replace.json')['notes']
report['from'] = {k: sum(1 for v in n12_from.values() if v == k) for k in set(n12_from.values())}
report['from']['round2'] = len(r2)
report['from']['round2_replace'] = len(replace)

# main's own notes, by id, for the replacements and for duplicates
main_notes = {}
for f in sorted(glob.glob(f'{repo}/config/figures/*.json')):
    assert roundtrips(f), f
    for n in jload(f)['notes']:
        main_notes[n['id']] = (os.path.basename(f), n)
new = list(n12.values()) + r2
dup = [n['id'] for n in new if n['id'] in main_notes]
assert not dup, ('already on main', dup)
ids = [n['id'] for n in new]
assert len(ids) == len(set(ids)), 'an id twice'
for n in replace:
    assert n['id'] in main_notes, ('replacement not on main', n['id'])

by_book = {}
for n in new:
    by_book.setdefault(osis(n['ref']), []).append(n)
for n in replace:
    f, _ = main_notes[n['id']]
    p = f'{repo}/config/figures/{f}'
    d = jload(p)
    d['notes'] = [n if x['id'] == n['id'] else x for x in d['notes']]
    jdump(p, d)
for b, ns in sorted(by_book.items()):
    p = f'{repo}/config/figures/{b}.json'
    have = jload(p)['notes'] if os.path.exists(p) else []
    jdump(p, {'notes': have + sorted(ns, key=order)})

# ---- the forms ------------------------------------------------------------------------------------------------
p = f'{repo}/config/figure-forms.json'
assert roundtrips(p)
ff = jload(p)
forms12 = jload(f'{W}/n12/forms12-main.json')['forms']
assert not {f['id'] for f in ff['forms']} & N12_FORMS
ff['forms'] += forms12
jdump(p, ff)

# ---- the structures -------------------------------------------------------------------------------------------
p = f'{repo}/config/structures.json'
assert roundtrips(p)
st = jload(p)
news = jload(f'{REV}/structures.json')['structures']
reps = jload(f'{REV}/str-replace.json')['structures']
have = {s['id'] for s in st['structures']}
assert not have & {s['id'] for s in news}
assert {s['id'] for s in reps} <= have
rmap = {s['id']: s for s in reps}
main_structs = {s['id']: s for s in st['structures']}
st['structures'] = [rmap.get(s['id'], s) for s in st['structures']] + news
jdump(p, st)

# ---- the cite list and the shelf (text insertions) ------------------------------------------------------------
add = jload(f'{W}/ns/cite-additions.json')['items'][0]
work = dict(add['works'][0])
work = {k: work[k] for k in ['id', 'title', 'short', 'written', 'written_from', 'first_edition', 'scan', 'writers',
                              'edition', 'evidence', 'shelf'] if k in work}
work = dict(list(work.items())[:5] + [('year', '1795')] + list(work.items())[5:])
p = f'{repo}/config/layer-sources.json'
t = open(p, encoding='utf-8').read()
lines = t.split('\n')
i = next(k for k, l in enumerate(lines) if l.startswith('    {"id": "lowth-lectures", "title"'))
lines.insert(i + 1, '    ' + json.dumps(work, ensure_ascii=False) + ',')
k = next(k for k, l in enumerate(lines) if l.startswith('    {"id": "lowth", "role"'))
assert lines[k].count('"works": ["lowth-lectures"]') == 1
lines[k] = lines[k].replace('"works": ["lowth-lectures"]', '"works": ["lowth-lectures", "lowth-isaiah"]')
# two works now: the source is the man (as for Boys and Forbes), and the rule on others' notes names the lectures
for a, b in [('"name": "Lowth\'s Lectures on the Sacred Poetry of the Hebrews"', '"name": "Robert Lowth"'),
             ('Cite his lectures only, never the notes Michaelis, Gregory and others added."',
              'Cite his own words only, in his lectures and in his Isaiah\'s dissertation and notes, never the notes Michaelis, Gregory and others added to the lectures. Each cite names its book."')]:
    assert lines[k].count(a) == 1, a
    lines[k] = lines[k].replace(a, b)
t2 = '\n'.join(lines)
assert json.loads(t2)
open(p, 'w', encoding='utf-8').write(t2)

card = dict(add['shelf'][0])
card = {k: card[k] for k in ['id', 'group', 'plain', 'title', 'by', 'when', 'what', 'license'] if k in card} | \
       {'licenseNote': 'Printed in 1795; Lowth died in 1787.'} | \
       {k: card[k] for k in ['datasets', 'read', 'citation', 'layer'] if k in card}
p = f'{repo}/config/shelf.json'
t = open(p, encoding='utf-8').read()
lines = t.split('\n')
i = next(k for k, l in enumerate(lines) if l == '      "id": "lowth-lectures",')
j = next(k for k in range(i, len(lines)) if lines[k] == '    },')
block = ['    {'] + [f'      {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' + (',' if n < len(card) - 1 else '')
                    for n, (k, v) in enumerate(card.items())] + ['    },']
lines[j + 1:j + 1] = block
t2 = '\n'.join(lines)
assert json.loads(t2)
open(p, 'w', encoding='utf-8').write(t2)

# ---- evidence -------------------------------------------------------------------------------------------------
ev = f'{repo}/docs/evidence'
cr = add['credits'][0]
rec = {k: cr[k] for k in ['id', 'source', 'work', 'books', 'writers']}
rec['named_by'] = {k: cr['named_by'][k] for k in ['scan', 'leaf', 'words']}
rec['level'], rec['note'] = cr['level'], cr['note']
jdump(f'{ev}/credits-wordplay-lowth-isaiah-2026-11-01.json', {
    '_comment': ["Who wrote the words of Lowth's Isaiah (1795, third edition), the second work of the lowth source, as read on archive.org on 2026-11-01."],
    'kind': 'attribution', 'from': '2026-11-01', 'to': '2026-11-01', 'records': [rec], 'cites': []})

FOS_URL = 'https://raw.githubusercontent.com/darrelwright/UniqueBible_Books/4017a67481e0de6027216bbdf3fc5d42c9c289d5/Bullinger%20-%20Figures%20of%20Speach.book.zip'
fos = open(f'{W}/fos.txt', encoding='utf-8').read()

# n12: the records figpost wrote for each note's dir, for the quote as it now stands
qc = {d: jload(f'{d}/quote-checks.json') for d in N12_DIRS}
n12_recs = []
for f in forms12:
    q = f['defined']['quote']
    n12_recs.append({'form': f['id'], 'field': 'defined', 'source': f['defined']['source'], 'quote': q,
                     'found_in': FOS_URL, 'context': figpost.context(fos, q)})
    if not n12_recs[-1]['context']:
        report['no_record'].append({'form': f['id'], 'field': 'defined'})
for nid, n in sorted(n12.items(), key=lambda x: (osis(x[1]['ref']), order(x[1]))):
    recs = [r for r in qc[f'{W}/fig/{n12_from[nid]}'] if r['note'] == nid]
    for c in n['cites']:
        r = next((r for r in recs if r['source'] == c['source'] and r['on'] == c['on'] and r['quote'] == c['quote']), None)
        if r:
            n12_recs.append(r)
        else:
            report['no_record'].append({'note': nid, 'source': c['source'], 'on': c['on']})

# round 2: scan quotes from quotes.json and the pages read; local quotes from the copies; web quotes from the fetch
quotes = jload(f'{REV}/quotes.json')
qrec = {(x['entry'], x['source'], x['on'], x['quote']): x for x in quotes}


def scan_context(x):
    urls = x['found_in'] if isinstance(x['found_in'], list) else [x['found_in']]
    p0 = (scanq.pparts(x['quote'], scanq.fold3) or [''])[0].split()
    best = (0, '')
    for u in urls:
        for it, pages in scanq.idx.items():
            for pg, fs in pages.items():
                for _, uu, t in fs:
                    if uu != u:
                        continue
                    words = fc.normalize(t.replace('ſ', 's')).split()
                    words = [w for w in words if not w.isdigit()]
                    folded = [re.sub('[sfl]', 'f', w) for w in words]
                    for i in range(0, max(1, len(folded) - len(p0) + 1)):
                        r = difflib.SequenceMatcher(None, p0, folded[i:i + len(p0)], autojunk=False).ratio()
                        if r > best[0]:
                            best = (r, ' '.join(words[max(0, i - 12):i + 40])[:260])
    return best[1]


def r2_record(owner, key, field, c):
    x = qrec.get((owner, c['source'], c['on'], c['quote']))
    if c['source'] in SCAN:
        if not x or not x.get('found_in'):
            return None
        fi = x['found_in']
        r = {key: owner, 'field': field, 'source': c['source'], 'on': c['on'], 'quote': c['quote'],
             'found_in': fi[0] if isinstance(fi, list) else fi}
        if isinstance(fi, list) and len(fi) > 1:
            r['also_in'] = fi[1:]
        r['context'] = scan_context(x)
        r['match'] = x.get('match', 'exact')
        return r
    loc = figpost.local_source(c)
    if loc:
        return {key: owner, 'field': field, 'source': c['source'], 'on': c['on'], 'quote': c['quote'],
                'found_in': loc[1], 'context': loc[2]}
    u = ((x or {}).get('found') or '').strip().split()[0] if x and (x.get('found') or '').startswith('http') else ''
    if u:
        ok, t, k = webquote.check(u, c['quote'])
        if ok:
            text = ' '.join(tx for _, tx in webquote.pages_for(u))
            return {key: owner, 'field': field, 'source': c['source'], 'on': c['on'], 'quote': c['quote'],
                    'found_in': u, 'context': figpost.context(text, c['quote'])}
    return None


r2_recs = []
for n in r2 + replace:
    old = {(c['source'], c['on'], c['quote']) for c in main_notes.get(n['id'], (None, {'cites': []}))[1]['cites']}
    for c in n['cites']:
        if (c['source'], c['on'], c['quote']) in old:
            continue
        r = r2_record(n['id'], 'note', 'cites', c)
        if r:
            r2_recs.append(r)
        else:
            report['no_record'].append({'note': n['id'], 'source': c['source'], 'on': c['on']})

main_srecs = [r for f in sorted(glob.glob(f'{ev}/structures-*.json')) if 'wordplay-r2' not in f for r in jload(f).get('quotes', [])]
s_recs = []
for s in news + reps:
    old = {(c['source'], c['on'], c['quote']) for c in main_structs.get(s['id'], {'cites': []})['cites']}
    for c in s['cites']:
        if (c['source'], c['on'], c['quote']) in old:
            continue
        r = r2_record(s['id'], 'structure', 'cites', c)
        if not r:
            # the same words main already records, with only on moved to the verse the remark is on
            m0 = next((x for x in main_srecs if x['structure'] == s['id'] and x['source'] == c['source'] and x['quote'] == c['quote']), None)
            if m0:
                s_recs.append(dict(m0, on=c['on'], on_was=m0['on']))
                continue
            report['no_record'].append({'structure': s['id'], 'source': c['source'], 'on': c['on']})
            continue
        m = re.search(r'p\. ([0-9ivxlcdmIVXLCDM]+)', c.get('at') or '')
        rr = {'structure': s['id'], 'source': c['source'], 'on': c['on'], 'quote': c['quote'], 'found_in': r['found_in']}
        if 'also_in' in r:
            rr['also_in'] = r['also_in']
        rr |= {'page': m.group(1) if m else None, 'read': c.get('read'), 'retrieved': c.get('retrieved')}
        if 'match' in r:
            rr['match'] = r['match']
        s_recs.append(rr)

SCAN_NOTE = ("For the scans (Lowth, Jebb, Boys, Forbes) found_in is archive.org's page text of the leaf the words are "
             "on (BookReaderGetTextWrapper, page = leaf index), as a checking reader fetched it on the day in retrieved; "
             "also_in is the next leaf when a quotation runs over the page. Each part of a quotation was matched against "
             "that text: exact, or letters (the OCR's long s and a few misread letters, never a missing word), or runs "
             "(every word inside a run of four or more that a fetch of that scan returned). context is the page text "
             "around the first part, lowercased with punctuation dropped, OCR spelling kept.")
jdump(f'{ev}/figures-wordplay-n12-2026-11-07.json', {'kind': 'figure-quotes', '_comment': [
    "Where each quotation in the Wordplay thread's notes for the twelve new figure forms (acrostic, type, allegory, parable, antithesis, antimetabole, aposiopesis, meiosis, exclamation, riddle, hypocatastasis, proverb) was found, with each form's definition and the note on Deuteronomy 6:7. Records as in figures-2026-10-21.json; written 2026-11-01, reviewed note by note on 2026-11-07.",
    "found_in is the public-domain copy the words were read in, pinned to a commit, or the web page a checking reader fetched that day (Bible Hub's chapter pages); context is the copy's text around the quotation, lowercased with punctuation dropped, as the comparison was made."],
    'checked': n12_recs})
jdump(f'{ev}/figures-wordplay-r2-2026-11-07.json', {'kind': 'figure-quotes', '_comment': [
    "Where each quotation in the Wordplay thread's parallelism and figure notes from Lowth, Jebb, Boys and Forbes (round 2, mined 2026-11-01 and 2026-11-07, reviewed 2026-11-07) was found, and the new cites on two live notes. Records as in figures-2026-10-21.json.",
    "found_in is the public-domain copy the words were read in, pinned to a commit, or the web page a checking reader fetched that day.", SCAN_NOTE],
    'checked': r2_recs})
jdump(f'{ev}/structures-wordplay-r2-2026-11-07.json', {'_comment':
    "Where each quotation of the Wordplay thread's round 2 structures (Boys, Jebb, Forbes, with Bullinger) and of the new cites on five live structures was read, word for word. " + SCAN_NOTE +
    " Bullinger's Figures of Speech (1898) was read in the UniqueBible.app module at github.com/darrelwright/UniqueBible_Books, commit 4017a67481e0de6027216bbdf3fc5d42c9c289d5.",
    'quotes': s_recs})

report['counts'] = {'n12_notes': len(n12), 'round2_notes': len(r2), 'replaced_notes': len(replace),
                    'forms': len(forms12), 'new_structures': len(news), 'replaced_structures': len(reps),
                    'books_touched': len(by_book), 'evidence': {'n12': len(n12_recs), 'r2': len(r2_recs), 'structures': len(s_recs)}}
jdump(f'{out}/report.json', report)
print(json.dumps(report['counts']), len(report['no_record']), 'cites without a record', report['from'])
