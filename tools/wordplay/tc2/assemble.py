"""assemble.py: the held passages (h3/out1107) under the PR #63 rules, from stage1 + evidence rewrites + reads.
  out/final/held-new-passages.json   the passages, ready for config/layers.json
  out/final/held-out.json             passages that fail the rules after the reads (with why)
  out/final/layers-reads-wordplay-held-2026-11-07.json   the reads evidence (docs/evidence shape)
  out/final/report.json
With --merge <worktree>: appends the passages to its config/layers.json (main's layout) and writes the reads file there.
Cites whose cite-list entries are proposed in cl/ resolve only with ATLAS_SOURCES_EXTRA=cl/extra.json."""
import json, os, re, sys, collections, copy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import resolve as R
import layersfmt
OUT = os.path.join(HERE, 'out')
FIN = os.path.join(OUT, 'final')
os.makedirs(FIN, exist_ok=True)
SRC = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/h3/out1107/new-passages.json'
READS_NAME = 'layers-reads-wordplay-held-2026-11-07.json'
READ_FOR = 'held passages (Wordplay thread, 2026-11-07): the note cites this comment'


def load(p, default):
    p = p if os.path.isabs(p) else f'{OUT}/{p}'
    return json.load(open(p)) if os.path.exists(p) else default


stage = load('stage1.json', None)
src = {p['id']: p for p in json.load(open(SRC))['passages']}
cites = load('reads/cites.json', [])
direct = {d['cid']: d for d in load('reads/direct.json', [])}
ev = {(r['passage'], r['note']): r for r in load('ev_results.json', [])}
reads = {r['cid']: r for r in load('reads_results.json', [])}
ptrs = {r['cid']: r['pointer'] for r in load('pointers.json', [])}
ch1 = load('chapter1.json', [])
cbfix = {r['cid']: r for r in load('cbfix_results.json', [])}
fos = load('fos_pages.json', {})   # Figures of Speech: printed page, scan page link, remark (and a corrected at) per cite
cl = load(os.path.join(HERE, 'cl', 'final.json'), {})          # the cite-list additions' own reads, by cite key
cl_reads = {(r['passage'], r['note'], r['source'], r['on'], r.get('at') or ''): r for r in cl.get('reads', [])}
report = collections.defaultdict(list)
by_key = collections.defaultdict(list)
for c in cites:
    by_key[(c['passage'], c['note'], c['source'], c['on'], c['at'])].append(c)
TIME = re.compile(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$')


def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower().replace('\u2019', "'")).strip()


def toks(s):
    """Words without Bible references (book abbreviations and numbers print differently from copy to copy)."""
    out = []
    for w in re.findall(r"[a-z0-9']+", (s or '').lower().replace('\u2019', "'")):
        if w.isdigit() or re.fullmatch(r'[a-z]{1,4}\d+|\d+[a-z]{1,4}|[ivxlc]+', w):
            continue
        out.append(w)
    return out


def run_in(a, b, k=4):
    if not a:
        return True
    k = min(k, len(a))
    sb = ' ' + ' '.join(b) + ' '
    return any(' ' + ' '.join(a[i:i + k]) + ' ' in sb for i in range(len(a) - k + 1))


def words_ok(first, last, pieces):
    if not pieces:
        return True
    whole = toks(' '.join(pieces))
    return run_in(toks(first), whole) and run_in(toks(last), whole)


records = []
denied_pages = {c['url'] for c in ch1 if c.get('denies_authorship')}


def record_for(c, final_note, cite):
    """-> (record or None, new url or None, problem or None)"""
    base = {'passage': c['passage'], 'note': final_note, 'kind': c['kind'], 'source': c['source'], 'on': c['on']}
    if c.get('at'):
        base['at'] = c['at']
    fp = fos.get(c['cid']) if c['source'] == 'bullinger-fos' else None
    if fp and fp.get('at'):
        base['at'] = fp['at']
    clr = cl_reads.get((c['passage'], c['note'], c['source'], c['on'], c.get('at') or ''))
    if clr:   # read by the cite-list research, checked by its second reader
        if clr['status'] != 'found':
            return None, None, f"cite-list reader: {clr['status']}: {clr.get('remark', '')}"
        if clr.get('verdict') == 'denies':
            return None, None, f"denies: {clr.get('verdict_words', '')}"
        t = clr.get('time') or ''
        if not TIME.match(t):
            return None, None, f'bad time {t!r}'
        rec = dict(base, url=clr['url'], fetched=t[:10], time=t, status='added', read_for=READ_FOR,
                   read_how=clr.get('read_how') or 'read on this page, where each part was found', verdict='respects')
        if c['never_quote']:
            if not clr.get('pointer'):
                return None, None, 'pointer missing'
            rec['pointer'] = clr['pointer']
        else:
            if not clr.get('quote'):
                return None, None, 'words missing'
            rec['quote'] = clr['quote']   # the cited words as that page prints them (mk_final.py joins the reader's parts)
        if clr.get('remark'):
            rec['remark'] = clr['remark']
        return rec, (clr['url'] if clr['url'] != c['link'] else None), None
    if c['source'] == 'tyndale-notes':
        row = next((r for r in c['rows'] if 'github.com/BibleAquifer' in (r['read_in'] or '')), None)
        if not row or not row.get('fetched'):
            return None, None, 'tyndale row missing'
        return dict(base, url=row['read_in'], fetched=row['fetched'], status='added', read_for=READ_FOR.replace('comment', 'study note'),
                    quote=' ... '.join(c['quotes']), read_how='the quotation found word for word in the pinned file at commit bbb3f86 (the copy the app ships)',
                    verdict='respects'), (row['read_in'] if row['read_in'] != cite.get('url') else None), None
    d = direct.get(c['cid'])
    if d:
        rec = dict(base, url=d['url'], fetched=d['fetched'], status='added', read_for=READ_FOR,
                   read_how='the page was read while the note was checked, and the quotation found on it', verdict='respects')
        if c['never_quote']:
            if c['cid'] not in ptrs:
                return None, None, 'pointer missing'
            rec['pointer'] = ptrs[c['cid']]
        else:
            rec['quote'] = ' ... '.join(c['quotes'])
        return rec, None, None
    fx = cbfix.get(c['cid']) if c['source'] == 'bullinger-cb' else None
    if fx and fx.get('status') == 'found' and fx.get('quote') and TIME.match(fx.get('time') or ''):
        # copied word for word on the page itself: that copy is the read
        url = fx.get('found_at') or c['link']
        if url.replace('://www.', '://') == (c['link'] or '').replace('://www.', '://'):
            url = c['link']
        rv = reads.get(c['cid']) or {}
        if rv.get('verdict') == 'denies':
            return None, None, f"denies: {rv.get('verdict_words', '')}"
        rec = dict(base, url=url, fetched=fx['time'][:10], time=fx['time'], status='added', read_for=READ_FOR,
                   read_how='read again on this page; the reader copied the note there word for word', verdict='respects', quote=fx['quote'])
        return rec, (url if url != c['link'] else None), None
    r = reads.get(c['cid'])
    if not r:
        return None, None, 'not read again yet'
    if r['status'] != 'found':
        return None, None, f"{r['status']}: {r.get('remark', '')}"
    if r.get('verdict') == 'denies':
        return None, None, f"denies: {r.get('verdict_words', '')}"
    url = r.get('found_at') or c['link']
    if url.replace('://www.', '://') == (c['link'] or '').replace('://www.', '://'):
        url = c['link']   # the same page, read without www where the www address refused the reader
    if fp:
        url = fp['url']   # the printed page's scan page, from the scan's own list of page numbers
    if url in denied_pages:
        return None, None, 'its chapter 1 page denies the book its writer'
    if not c['never_quote'] and c['source'] != 'bullinger-cb' and not words_ok(r.get('first_words'), r.get('last_words'), c['pieces']):
        report['words_differ'].append({'cid': c['cid'], 'first': r.get('first_words'), 'last': r.get('last_words'), 'pieces': c['pieces']})
    t = r.get('time') or ''
    if not TIME.match(t):
        return None, None, f'bad time {t!r}'
    rec = dict(base, url=url, fetched=t[:10], time=t, status='added', read_for=READ_FOR,
               read_how='read again on this page; the reader confirmed each part of the quotation there', verdict=r.get('verdict', 'respects'))
    if c['never_quote']:
        rec['pointer'] = r.get('pointer') or ''
        if not rec['pointer']:
            return None, None, 'pointer missing'
    elif c['source'] == 'bullinger-cb':
        fx = cbfix.get(c['cid'])
        if not fx or fx.get('status') != 'found' or not fx.get('quote'):
            return None, None, 'Companion Bible wording not yet copied from the page'
        rec['quote'] = fx['quote']
        rec['read_how'] = 'read again on this page; the reader copied the note there word for word'
        if fx.get('time') and TIME.match(fx['time']):
            rec['time'], rec['fetched'] = fx['time'], fx['time'][:10]
    else:
        rec['quote'] = ' ... '.join(c['quotes'])
    if r.get('remark'):
        rec['remark'] = r['remark']
    if fp:
        rec['remark'] = fp['remark']
    new_url = url if (url != c['link'] or c['source'] in ('catena-aurea', 'bullinger-fos')) else None
    return rec, new_url, None


def finish_note(pid, idx, final_note, l):
    l = copy.deepcopy(l)
    e = ev.get((pid, idx))
    if e:
        l['evidence'] = e['evidence']
        if e.get('text'):   # a hand fix: the note says only what its kept cites support
            l['text'] = e['text']
    keep = []
    for cite in l['cites']:
        k = (pid, idx, cite['source'], cite.get('on'), cite.get('at'))
        cs = by_key.get(k)
        if not cs:
            report['unmatched'].append({'passage': pid, 'note': idx, 'cite': cite})
            continue
        c = dict(cs[0], kind=l['kind'])
        rec, new_url, problem = record_for(c, final_note, cite)
        if problem:
            report['cite_dropped'].append({'passage': pid, 'note': final_note, 'source': cite['source'], 'on': cite.get('on'), 'why': problem})
            continue
        cite = dict(cite)
        if new_url:
            cite['url'] = new_url
        if rec.get('at') and rec['at'] != cite.get('at'):
            cite['at'] = rec['at']
        keep.append(cite)
        records.append(rec)
    l['cites'] = keep
    return l


ORDER = ['widely agreed', 'commonly held', 'some interpreters']


def recount(pid, l):
    if l['kind'] == 'plain meaning':
        return l
    keys = set()
    for c in l['cites']:
        r = R.resolve(c)
        if r['ok'] and r['role'] == 'interpreter' and c.get('counts') is not False:
            keys.add(r['key'])
    n = len(keys)
    counted = 'widely agreed' if n >= 3 else 'commonly held' if n == 2 else 'some interpreters'
    s = ORDER[max(ORDER.index(l['strength']), ORDER.index(counted))]
    if s != l['strength']:
        report['strength_lowered'].append({'passage': pid, 'kind': l['kind'], 'from': l['strength'], 'to': s, 'writers': sorted(keys)})
        l['strength'] = s
    return l


passages, held = [], []
for p in stage['passages']:
    s0 = src[p['id']]
    layers = []
    for i, l0 in enumerate(s0['layers']):
        stl = next((x for x in p['layers'] if x['text'] == l0['text'] and x['kind'] == l0['kind']), None)
        if stl is None:
            continue
        nl = finish_note(p['id'], i, len(layers), stl)
        if not nl['cites']:
            report['note_dropped'].append({'passage': p['id'], 'note': i, 'kind': l0['kind']})
            continue
        layers.append(recount(p['id'], nl))
    ok = layers and layers[0]['kind'] == 'plain meaning' and any(l['kind'] != 'plain meaning' and l['strength'] != 'some interpreters' for l in layers)
    q = dict(p, layers=layers)
    if ok:
        passages.append(q)
    else:
        held.append(dict(q, why='after the reads, no note beyond the plain meaning is above "some interpreters"' if layers else 'no note kept'))
# the passage's source line in main's words (layers.rs check 8: "Sources: ...", no dataset code, no AI credit)
SOURCE = 'Sources: the BSB, the Hebrew and Greek texts from STEPBible (Tyndale House, Cambridge), and the writers named under each note'
WITNESS = {'john-10-1': 'with a later Syriac translation named as a witness'}
for p in passages:
    p['source'] = SOURCE + (', ' + WITNESS[p['id']] if p['id'] in WITNESS else '') + '.'
live = {p['id'] for p in passages}
held_records = [r for r in records if r['passage'] not in live]
records = [r for r in records if r['passage'] in live]
days = sorted({r['fetched'] for r in records})
reads_file = {
    '_comment': [
        "Pages read for the Wordplay thread's held Layers passages (2026-11-07): one record per citation. passage and note: the passage id and the 0-based index of the note in its layers list in config/layers.json; kind: the note's kind; source, on and at: the citation as config/layers.json gives it; url: the page the citation links to.",
        "fetched and time: the day the page was read, and for pages read again the UTC time taken right after the read. Pages were read with a text reader that returns the page's text but no HTTP status or hash. read_how says how: read again on the linked page (the reader confirmed each part there), read on that page while the note was checked, or, for the Tyndale study notes, found word for word in the pinned file the app ships.",
        "quote: the writer's words, for public-domain and openly licensed works, as found in the copy checked; pointer: for the Pulpit Commentary, the NET notes, the Reformation Study Bible and copyrighted modern works, where on the page the point is made, never their words. verdict (founder's decision 20): whether the cited comment respects or denies Scripture, judged on its own words.",
    ],
    'kind': 'reads',
    'batch': 'Wordplay held passages, 2026-11-07',
    'from': days[0] if days else '2026-11-07',
    'to': days[-1] if days else '2026-11-07',
    'records': records,
}
dec = {c['url']: c for c in ch1}
for r in records:
    if r['url'] in dec:
        r['decided'] = dec[r['url']]['decided']
json.dump({'passages': passages}, open(f'{FIN}/held-new-passages.json', 'w'), indent=1, ensure_ascii=False)
json.dump({'passages': held, 'reads': held_records}, open(f'{FIN}/held-out.json', 'w'), indent=1, ensure_ascii=False)
json.dump(reads_file, open(f'{FIN}/{READS_NAME}', 'w'), indent=1, ensure_ascii=False)
json.dump(report, open(f'{FIN}/report.json', 'w'), indent=1, ensure_ascii=False)
print('passages', len(passages), 'held', len(held), 'notes', sum(len(p['layers']) for p in passages), 'records', len(records), 'days', days)
print({k: len(v) for k, v in report.items()})
print(collections.Counter(x['why'][:50] for x in report['cite_dropped']).most_common(10))
if '--merge' in sys.argv:
    wt = sys.argv[sys.argv.index('--merge') + 1]
    L = os.path.join(wt, 'config/layers.json')
    d = json.load(open(L))
    assert not ({p['id'] for p in d['passages']} & live), 'a passage id is already in the worktree'
    d['passages'].extend(passages)
    open(L, 'w').write(layersfmt.dumps(d))
    json.dump(reads_file, open(os.path.join(wt, 'docs/evidence', READS_NAME), 'w'), indent=1, ensure_ascii=False)
    print('merged into', L)
