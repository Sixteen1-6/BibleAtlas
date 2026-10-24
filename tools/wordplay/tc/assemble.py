"""assemble.py: round 3 under PR #63, from stage1 + evidence rewrites + reads results.
  out/final/r3-new-passages.json, out/final/r3-additions.json, out/final/layers-reads-r3.json (docs/evidence shape),
  out/final/report.json; and with --merge, writes the merged config/layers.json and the reads file into the lw clone."""
import json, os, re, sys, glob, collections, copy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import resolve as R
OUT = os.path.join(HERE, 'out')
FIN = os.path.join(OUT, 'final')
os.makedirs(FIN, exist_ok=True)
stage = json.load(open(f'{OUT}/stage1.json'))
facts = {(x['passage'], x['note']): x for x in json.load(open(f'{OUT}/facts.json'))}
cites = json.load(open(f'{OUT}/reads/cites.json'))
direct = {d['cid']: d for d in json.load(open(f'{OUT}/reads/direct.json'))}
r3 = {p['id']: p for p in json.load(open('/mnt/project-files/bible-atlas/wordplay/round3/r3-new-passages.json'))['passages']}
report = collections.defaultdict(list)


def load_json(p, default):
    return json.load(open(p)) if os.path.exists(p) else default


ev = {(r['passage'], r['note']): r for r in load_json(f'{OUT}/ev_results.json', [])}
reads = {r['cid']: r for r in load_json(f'{OUT}/reads_results.json', [])}
ptrs = {r['cid']: r['pointer'] for r in load_json(f'{OUT}/pointers.json', [])}
ch1 = load_json(f'{OUT}/chapter1.json', [])
by_key = collections.defaultdict(list)
for c in cites:
    by_key[(c['passage'], c['note'], c['source'], c['on'], c['at'])].append(c)


def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', s.lower().replace('\u2019', "'")).strip()


def words_ok(first, last, pieces):
    """WebFetch's first and last words agree with the quotation pieces."""
    if not pieces:
        return True
    whole = norm(' '.join(pieces))
    f, l = norm(first or ''), norm(last or '')
    return (not f or f[:25] in whole) and (not l or l[-20:] in whole)


records = []
denied_pages = {c['url'] for c in ch1 if c.get('denies_authorship')}
TODAY = sys.argv[sys.argv.index('--today') + 1] if '--today' in sys.argv else '2026-10-24'


def record_for(c, final_note, cite):
    """-> (record or None, new url or None, problem or None)"""
    base = {'passage': c['passage'], 'note': final_note, 'kind': c['kind'], 'source': c['source'], 'on': c['on']}
    if c['at']:
        base['at'] = c['at']
    if c['source'] == 'tyndale-notes':
        row = next((r for r in c['rows'] if 'github.com/BibleAquifer' in r['read_in']), None)
        if not row:
            return None, None, 'tyndale row missing'
        return dict(base, url=row['read_in'], fetched=row['fetched'], status='added',
                    read_for='round 3 (Wordplay thread): the note cites this study note',
                    quote=' ... '.join(c['quotes']), read_how='the quotation re-found word for word in the pinned file at commit bbb3f86 (the copy the app ships)',
                    verdict='respects'), row['read_in'], None
    d = direct.get(c['cid'])
    if d:
        rec = dict(base, url=d['url'], fetched=d['fetched'], status='added', read_for='round 3 (Wordplay thread): the note cites this comment',
                   read_how='the page was read while the note was checked, and the quotation found on it', verdict='respects')
        if c['never_quote']:
            if c['cid'] not in ptrs:
                return None, None, 'pointer missing'
            rec['pointer'] = ptrs[c['cid']]
        else:
            rec['quote'] = ' ... '.join(c['quotes'])
        return rec, None, None
    r = reads.get(c['cid'])
    if not r:
        return None, None, 'not read again yet'
    if r['status'] != 'found':
        return None, None, f"{r['status']}: {r.get('remark', '')}"
    if r.get('verdict') == 'denies':
        return None, None, f"denies: {r.get('verdict_words', '')}"
    url = r.get('found_at') or c['link']
    if url in denied_pages:
        return None, None, 'its chapter 1 page denies the book its writer'
    if not c['never_quote'] and not words_ok(r.get('first_words'), r.get('last_words'), c['pieces']):
        report['words_differ'].append({'cid': c['cid'], 'first': r.get('first_words'), 'last': r.get('last_words'), 'pieces': c['pieces']})
    t = r.get('time') or ''
    if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', t):
        return None, None, f'bad time {t!r}'
    rec = dict(base, url=url, fetched=t[:10], time=t, status='added', read_for='round 3 (Wordplay thread): the note cites this comment',
               read_how='read again on this page; the reader confirmed each part of the quotation there', verdict=r.get('verdict', 'respects'))
    if c['never_quote']:
        rec['pointer'] = r.get('pointer') or ''
        if not rec['pointer']:
            return None, None, 'pointer missing'
    else:
        rec['quote'] = ' ... '.join(c['quotes']) if c['quotes'] else f"{r.get('first_words', '')} ... {r.get('last_words', '')}"
    if r.get('remark'):
        rec['remark'] = r['remark']
    new_url = url if (url != c['link'] or c['source'] in ('catena-aurea', 'bullinger-fos')) else None
    return rec, new_url, None


def finish_note(pid, idx_r3, final_note, l):
    l = copy.deepcopy(l)
    e = ev.get((pid, idx_r3))
    if e:
        l['evidence'] = e['evidence']
        if e.get('cites'):
            l['cites'] = [{'source': x['source'], 'on': x['on']} for x in e['cites']]
    keep = []
    for cite in l['cites']:
        k = (pid, idx_r3, cite['source'], cite.get('on'), cite.get('at'))
        cs = by_key.get(k)
        if not cs:
            # a cite chosen by the evidence pass: take the matching cite of another note of the passage
            cs = [c for kk, v in by_key.items() if kk[0] == pid and kk[2:] == k[2:] for c in v][:1]
            if not cs:
                report['unmatched'].append({'passage': pid, 'note': idx_r3, 'cite': cite})
                continue
            c = dict(cs[0], note=idx_r3, kind=l['kind'])
        else:
            c = dict(cs[0], kind=l['kind'])
        rec, new_url, problem = record_for(c, final_note, cite)
        if problem:
            report['cite_dropped'].append({'passage': pid, 'note': final_note, 'source': cite['source'], 'on': cite.get('on'), 'why': problem})
            continue
        cite = dict(cite)
        if new_url:
            cite['url'] = new_url
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
for p in list(stage['passages']) + ([r3['galatians-3-6']] if 'galatians-3-6' in r3 and ('galatians-3-6', 0) in ev else []):
    src = r3[p['id']]
    layers = []
    for i, l0 in enumerate(src['layers']):
        stl = next((x for x in p['layers'] if x['text'] == l0['text']), None) if p is not src else None
        if p is src:  # galatians-3-6: rebuilt from facts (dropped cites gone)
            fx = facts[(p['id'], i)]
            stl = dict(l0, cites=[k['cite'] for k in fx['kept']], strength=fx['new_strength'])
        if stl is None:
            continue
        nl = finish_note(p['id'], i, len(layers), stl)
        if not nl['cites']:
            report['note_dropped'].append({'passage': p['id'], 'note': i, 'kind': l0['kind']})
            continue
        layers.append(recount(p['id'], nl))
    ok = layers and layers[0]['kind'] == 'plain meaning' and any(l['kind'] != 'plain meaning' and l['strength'] != 'some interpreters' for l in layers)
    q = dict(p, layers=layers)
    (passages if ok else held).append(q)
additions = []
for a in stage['additions']:
    layers = []
    n0 = a['first_note_index_on_main']
    for j, l in enumerate(a['layers']):
        nl = finish_note(a['passage_id'], n0 + j, n0 + len(layers), l)
        if nl['cites']:
            layers.append(recount(a['passage_id'], nl))
    if layers:
        additions.append({'passage_id': a['passage_id'], 'ref': a['ref'], 'layers': layers})

# records for notes renumbered: drop records whose note was removed (already skipped above)
reads_file = {
    '_comment': [
        "Pages read for the Wordplay thread's round 3 of Layers passages and notes (new passages and notes added to passages already live): one record per citation. passage and note: the passage id and the 0-based index of the note in its layers list in config/layers.json; kind: the note's kind; source, on and at: the citation as config/layers.json gives it; url: the page the citation links to.",
        "fetched and time: the day the page was read, and for pages read again on 2026-10-24 and 25 the UTC time taken right after the read. Pages were read with a text reader that returns the page's text but no HTTP status or hash. read_how says how: read again on the linked page (the reader confirmed each part of the quotation there), read on that page while the note was checked on 2026-10-21 or 22, or, for the Tyndale study notes, re-found word for word in the pinned file the app ships.",
        "quote: the writer's words, for public-domain and openly licensed works, as found in the copy checked; pointer: for the Pulpit Commentary, the NET notes and the Reformation Study Bible, where on the page the point is made, never their words. verdict (founder's decision 20): whether the cited comment respects or denies Scripture, judged on its own words. decided: for a chapter 1 page, what its introduction says on who wrote the book (decision 23(3)).",
    ],
    'kind': 'reads',
    'batch': 'Wordplay round 3, 2026-10-24',
    'from': '2026-10-21',
    'to': TODAY,
    'records': records,
}
dec = {c['url']: c for c in ch1}
for r in records:
    if r['url'] in dec:
        r['decided'] = dec[r['url']]['decided']
json.dump({'passages': passages}, open(f'{FIN}/r3-new-passages.json', 'w'), indent=1, ensure_ascii=False)
json.dump(additions, open(f'{FIN}/r3-additions.json', 'w'), indent=1, ensure_ascii=False)
json.dump(held, open(f'{FIN}/r3-held.json', 'w'), indent=1, ensure_ascii=False)
json.dump(reads_file, open(f'{FIN}/layers-reads-r3-2026-10-24.json', 'w'), indent=1, ensure_ascii=False)
json.dump(report, open(f'{FIN}/report.json', 'w'), indent=1, ensure_ascii=False)
print('passages', len(passages), 'held', len(held), 'additions', len(additions), 'notes',
      sum(len(p['layers']) for p in passages) + sum(len(a['layers']) for a in additions), 'records', len(records))
print({k: len(v) for k, v in report.items()})
print(collections.Counter(x['why'][:40] for x in report['cite_dropped']).most_common(8))
if '--merge' in sys.argv:
    L = os.path.join(R.LW, 'config/layers.json')
    os.system(f'cd {R.LW} && git checkout -q -- config/layers.json')
    d = json.load(open(L))
    have = {p['id']: p for p in d['passages']}
    for a in additions:
        have[a['passage_id']]['layers'].extend(a['layers'])
    d['passages'].extend(passages)
    open(L, 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    json.dump(reads_file, open(os.path.join(R.LW, 'docs/evidence/layers-reads-r3-2026-10-24.json'), 'w'), indent=1, ensure_ascii=False)
    print('merged into', L)
