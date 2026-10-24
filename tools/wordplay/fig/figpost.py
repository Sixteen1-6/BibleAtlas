#!/usr/bin/env python3
"""figpost.py <out dir> <journal.jsonl>...: figwrite.js journals -> config/figures/<OSIS>.json files for Layers.

Takes each batch's confirmed notes (the second reader's), and for every cite:
- a local copy (cq.py works, the Catena): the quote must be found word for word there; read is that copy's line;
- a web page: the page must be in the fetch log (a checking agent fetched it); read names the page and retrieved is
  the date of the last fetch (founder decision 10);
otherwise the cite is dropped. Strength is recounted from the cites left; a note whose evidence still names a
dropped writer, or that fails figcheck, is held with its reasons instead of written. Earlier output in <out dir> and
the seed notes are kept; a note on the same verses, kind and form as one already there is a duplicate and is skipped.
Writes <out>/config/figures/<OSIS>.json, <out>/quote-checks.json and <out>/report.json.
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
WP = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, WP)
sys.path.insert(0, f'{WP}/w3')
import figcheck as fc
import cq
import fetchlog
import cat
import byw
import bmod

READ = {
    'vault': "sacred-texts.com's transcription, in the copy at github.com/jonnyg23/mahabrain (commit b00aa50)",
    'mhcc': "Let's Church's copy, at github.com/LetsChurch/lets.church (commit 71f6f0f)",
    'fos': 'the UniqueBible.app module of the 1898 text, at github.com/darrelwright/UniqueBible_Books (commit 4017a67)',
    'cb': 'the UniqueBible.app module of the Companion Bible notes, at github.com/otseng/UniqueBible_Commentaries (commit 4b77d86)',
    'catena': "Newman's Oxford translation, in the copy at github.com/AlvaroBalbin/catena (commit efe1bd0)",
}
CATENA_SHA = 'efe1bd084d918a34ca22ffeef2ecf711c593b392'
WEB_SITE = [('biblehub.com', "Bible Hub's transcription"), ('newadvent.org', "New Advent's translation"),
            ('ccel.org', "CCEL's text"), ('studylight.org', "StudyLight's transcription")]
SURNAME = {'henry': ['Henry'], 'henry-concise': ['Henry'], 'gill': ['Gill'], 'barnes': ['Barnes'],
           'jfb': ['Jamieson'], 'keil-delitzsch': ['Keil', 'Delitzsch'], 'pulpit': ['Pulpit'],
           'ellicott': ['Ellicott'], 'benson': ['Benson'], 'poole': ['Poole'], 'calvin': ['Calvin'],
           'clarke': ['Clarke'], 'geneva': ['Geneva'], 'bengel': ['Bengel'], 'maclaren': ['Maclaren'],
           'spurgeon': ['Spurgeon'], 'chrysostom': ['Chrysostom'], 'edersheim': ['Edersheim'],
           'bullinger-cb': ['Bullinger', 'Companion Bible'], 'bullinger-fos': ['Bullinger', 'Figures of Speech'],
           'catena-aurea': ['Catena'], 'church-fathers': [], 'wesley': ['Wesley'], 'net-notes': ['NET'],
           'tyndale-notes': ['Tyndale']}
_fetch = None


def fetched(url):
    global _fetch
    if _fetch is None:
        _fetch = fetchlog.build()
    ts = _fetch.get(fetchlog.norm(url))
    return ts[-1][:10] if ts else None


def context(hay, quote):
    """About 260 characters of normalized text around the quote's first part, as the seed records have them."""
    h = fc.normalize(hay)
    p = (fc.parts(quote) or [''])[0]
    i = h.find(p)
    if i < 0:
        return ''
    a = max(0, i - 80)
    return h[a:a + 260]


def local_source(c):
    """(read, found_in, context) when the quote is in a local copy, else None."""
    src, on, quote = c['source'], c['on'], c['quote']
    r = fc.resolve(on)
    if not r:
        return None
    b, ch, v = fc.locate(r[0])
    ref = f"{fc.BOOKS[b]['name']} {ch}:{v}"
    if src == 'catena-aurea':
        for x in range(r[0], r[1] + 1):
            bb, cc, vv = fc.locate(x)
            rr = f"{fc.BOOKS[bb]['name']} {cc}:{vv}"
            for cit, father, text in cat.segs(rr):
                if fc._in_order(fc._norm(text), quote):
                    g = fc.BOOKS[bb]['name'].lower()
                    return (READ['catena'], f'https://raw.githubusercontent.com/AlvaroBalbin/catena/{CATENA_SHA}/data/catena/{g}.jsonl',
                            context(text, quote))
        return None
    if src in bmod.MOD:
        for u in bmod.units(src, b, ch):
            if fc._in_order(fc._norm(u), quote):
                return bmod.READ, bmod.url(src), context(u, quote)
        return None
    work = fc.LOCAL.get(src)
    if not work or fc.local_quote(src, on, quote) is not True:
        return None
    try:
        units = cq.units(work, ref)
    except SystemExit:
        units = []
    hay = next((u for u in units if fc._in_order(fc._norm(u), quote)), None)
    if hay is None:
        if work == 'fos':
            hay = open(f'{WP}/fos.txt', encoding='utf-8').read()
        elif work == 'cb':
            hay = ' '.join(' '.join(t) for (bb, cc, vv), t in cq._cb.items() if bb == b)
        else:
            hay = cq.clean(open(f'{cq.VAULT}/{work}/{cq.ST[b]}{ch:03d}.md', encoding='utf-8', errors='replace').read())
    read = READ['vault'] if work in cq.VAULT_WORKS else READ['mhcc'] if work in cq.LC_WORKS else READ[work]
    return read, cq.url(work, ref), context(hay, quote)


def web_source(c):
    u = (c.get('found') or '').strip()
    if not u.startswith('http'):
        return None
    day = fetched(u)
    if not day:
        return None
    site = next((name for host, name in WEB_SITE if host in u), None)
    if not site:
        return None
    return f'{site}, at {u}', u, (c.get('context') or '').strip(), day


def cite_rule(c):
    """(by, None) when the cite may stand in a figure note, else (None, why). by is None for single-writer works."""
    src = c.get('source')
    s = fc.CITE.get(src)
    if not s:
        return None, 'not on the cite list'
    if src not in fc.QUOTABLE or src in ('wesley', 'net-notes'):
        return None, f"{s['name']} is not quotable in figure notes (figure-forms.json quotable)"
    r = fc.resolve(c.get('on'))
    if not r:
        return None, 'on is not a reference'
    b, ch, v = fc.locate(r[0])
    book = fc.BOOKS[b]['name']
    if src in fc.ONLY_ON and not any(f <= b <= l for f, l in fc.ONLY_ON[src]):
        return None, f"{s['name']} is quoted only on the books its named writer wrote, not {book}"
    if book in s.get('not_on', []):
        return None, f"{s['name']} is not cited on {book}"
    why = fc.BARRED_BOOKS.get((src, book)) or fc.BARRED_VERSES.get((src, book, ch, v)) or byw.quotable_here(src, book, ch)
    if why:
        return None, why
    if src in ('catena-aurea', 'church-fathers'):
        who = (c.get('at') or '').lower()
        if any(fc.re.search(r'\b' + fa + r'\b', who) for fa in fc.BARRED_FATHERS if not (fa == 'eusebius' and src == 'catena-aurea')):
            return None, 'a Father left out by the voices shortlist'
        if src == 'catena-aurea' and 'pseudo-chrysostom' in who and book == 'Matthew':
            return None, "the Catena's Pseudo-Chrysostom on Matthew"
    by = None
    if src in byw.MULTI:
        by = byw.by(src, book, c.get('at'))
        if not by:
            return None, f"the writer of the quoted part of {s['name']} is not known for certain"
    return by, None


def interpreters(cites):
    ws = set()
    for c in cites:
        s = fc.CITE.get(c['source'])
        if s and s['role'] == 'interpreter':
            ws.add(fc.WRITER.get(c['source'], c['source']))
    return ws


def osis_of(n):
    r = fc.resolve(n['ref'])
    return fc.BOOKS[fc.locate(r[0])[0]]['osis'] if r else None


def journal_results(paths):
    """{label: result} for each journal, the last result for a label winning."""
    out = {}
    for p in paths:
        lab = {}
        for line in open(p):
            try:
                j = json.loads(line)
            except ValueError:
                continue
            if j.get('type') == 'started':
                lab[j['agentId']] = j.get('label', '')
            elif j.get('type') == 'result' and j.get('agentId') in lab:
                out[lab[j['agentId']]] = j.get('result')
    return out


def main(out, paths):
    import datetime
    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    res = journal_results(paths)
    report = {'dropped_cites': [], 'held': [], 'missing_stage': [], 'duplicates': [], 'dropped_notes': [], 'needs_writer': []}
    keys = sorted({l.split(':', 1)[1] for l in res if ':' in l})
    os.makedirs(f'{out}/config/figures', exist_ok=True)
    # what is already there: the seeds, then earlier output
    have = {}
    for d in (f'{HERE}/config/figures', f'{out}/config/figures'):
        for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            for n in json.load(open(f'{d}/{f}'))['notes']:
                have[n['id']] = (n, d == f'{HERE}/config/figures')
    try:
        checks = json.load(open(f'{out}/quote-checks.json'))
    except (OSError, ValueError):
        checks = []
    new = []
    for key in keys:
        fin = res.get(f'confirm:{key}')
        if fin is None:
            if res.get(f'check:{key}') and (res[f'check:{key}'].get('notes')):
                report['missing_stage'].append(key)
            continue
        for n in fin.get('notes') or []:
            n = json.loads(json.dumps(n))
            n['checked'] = n.get('checked') if fc.date_ok(n.get('checked')) else today
            kept, recs = [], []
            for c in n.get('cites', []):
                by, why = cite_rule(c)
                if why:
                    report['dropped_cites'].append({'key': key, 'note': n['id'], 'source': c['source'], 'on': c.get('on'), 'found': c.get('found'), 'why': why})
                    continue
                if by:
                    c['by'] = by
                else:
                    c.pop('by', None)
                loc = local_source(c)
                if loc:
                    c['read'], found_in, ctx = loc
                    c['retrieved'] = c['retrieved'] if fc.date_ok(c.get('retrieved')) else today
                elif c['source'] == 'pulpit':
                    why = "quote not found in the Pulpit Commentary's exposition (its homilies are other writers')"
                else:
                    web = web_source(c)
                    if web:
                        c['read'], found_in, ctx, c['retrieved'] = web
                    else:
                        why = 'quote not found in the local copy, and no logged fetch of a page it names'
                if why:
                    report['dropped_cites'].append({'key': key, 'note': n['id'], 'source': c['source'], 'on': c.get('on'), 'found': c.get('found'), 'why': why})
                    continue
                recs.append({'note': n['id'], 'field': 'cites', 'source': c['source'], 'on': c['on'], 'quote': c['quote'],
                             'found_in': found_in, 'context': ctx})
                kept.append({k: c[k] for k in ('source', 'by', 'on', 'at', 'quote', 'read', 'retrieved') if k in c})
            dropped = [c['source'] for c in n.get('cites', []) if c['source'] not in {k['source'] for k in kept}]
            n['cites'] = kept
            ws = interpreters(kept)
            if not ws:
                report['needs_writer'].append({'key': key, 'note': n, 'dropped': dropped, 'why': 'no quotable interpreter left'})
                continue
            n['strength'] = fc.strength_for(len(ws))
            left = {s for c in kept for s in SURNAME.get(c['source'], [])}
            stale = [s for d in dropped for s in SURNAME.get(d, []) if s not in left and fc.names_word(n.get('evidence', ''), s)]
            if stale:
                report['held'].append({'key': key, 'note': n, 'dropped': dropped, 'why': f'evidence still names {", ".join(stale)}, whose cite was dropped'})
                continue
            new.append((key, n, recs))
    # duplicates and ids
    out_notes = {i: n for i, (n, seed) in have.items() if not seed}
    def span(n):
        return (n['kind'], n['form'], fc.resolve(n['ref']), tuple(sorted(x['who'] for x in n.get('sides', []))))
    spans = {span(n): i for i, (n, seed) in have.items()}
    for key, n, recs in new:
        if span(n) in spans:
            report['duplicates'].append({'key': key, 'note': n['id'], 'same_as': spans[span(n)]})
            continue
        base, i = n['id'], 2
        while n['id'] in have or n['id'] in out_notes:
            n['id'] = f'{base}-{i}'
            i += 1
        for r in recs:
            r['note'] = n['id']
        ck = fc.Check(local=True)
        ck.note(n, set())
        if ck.errors:
            report['held'].append({'key': key, 'note': n, 'why': '; '.join(ck.errors)})
            continue
        out_notes[n['id']] = n
        spans[span(n)] = n['id']
        checks = [c for c in checks if c['note'] != n['id']] + recs
    by_book = {}
    for n in out_notes.values():
        by_book.setdefault(osis_of(n), []).append(n)
    for f in os.listdir(f'{out}/config/figures'):
        os.remove(f'{out}/config/figures/{f}')
    for b, ns in by_book.items():
        ns.sort(key=lambda n: (fc.resolve(n['ref'])[0], n['id']))
        json.dump({'notes': ns}, open(f'{out}/config/figures/{b}.json', 'w'), ensure_ascii=False, indent=1)
        open(f'{out}/config/figures/{b}.json', 'a').write('\n')
    json.dump(checks, open(f'{out}/quote-checks.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(report, open(f'{out}/report.json', 'w'), ensure_ascii=False, indent=1)
    # a final pass over every file, as the build reads them together (ids unique across books)
    ck = fc.Check(local=True)
    seen = set()
    for b in by_book:
        for n in json.load(open(f'{out}/config/figures/{b}.json'))['notes']:
            ck.note(n, seen)
    kinds = {}
    for n in out_notes.values():
        kinds[n['kind']] = kinds.get(n['kind'], 0) + 1
    print(f'{len(out_notes)} notes in {len(by_book)} books {kinds}; this run: {len(new)} confirmed, '
          f"{len(report['held'])} held, {len(report['needs_writer'])} need a quotable writer, {len(report['duplicates'])} duplicates, {len(report['dropped_notes'])} notes and "
          f"{len(report['dropped_cites'])} cites dropped, {len(report['missing_stage'])} batches unfinished; "
          f'final check: {len(ck.errors)} problems')
    for e in ck.errors[:20]:
        print(' ', e)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2:])
