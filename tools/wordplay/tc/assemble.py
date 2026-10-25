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


BOOKS = set("""genesis gen ge exodus exo ex leviticus lev le numbers num nu deuteronomy deu deut de joshua jos josh judges jdg judg ruth rut ru
samuel sa sam kings ki kgs chronicles ch chr chron ezra ezr nehemiah neh ne esther est esth job psalms psalm psa ps proverbs pro prov pr
ecclesiastes ecc eccl song sol songs isaiah isa is jeremiah jer lamentations lam ezekiel eze ezek daniel dan da hosea hos joel joe amos amo
obadiah oba obad jonah jon micah mic nahum nah habakkuk hab zephaniah zep zeph haggai hag zechariah zec zech zac malachi mal matthew mat matt
mt mark mar mk mr luke luk lu lk john joh jn acts act ac romans rom ro corinthians co cor galatians gal ga ephesians eph philippians phi phil
colossians col thessalonians th thess timothy ti tim titus tit philemon phm hebrews heb jas james peter pe pet jude jud revelation rev re""".split())


def toks(s):
    """Words of s without Bible references (book names, numbers, roman numerals), which copies print differently."""
    out = []
    for w in re.findall(r"[a-z0-9']+", s.lower().replace('\u2019', "'")):
        if w.isdigit() or w in BOOKS or re.fullmatch(r'[a-z]{1,3}\d|\d[a-z]{1,4}|[ivxlc]+', w) or w in ('see', 'compare', 'cf'):
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
    """WebFetch's first and last words agree with the quotation pieces, apart from how references are printed."""
    if not pieces:
        return True
    whole = toks(' '.join(pieces))
    return run_in(toks(first or ''), whole) and run_in(toks(last or ''), whole)


# Textual judgements kept under decision 23(4): they agree with the BSB's own reading.
D23_4 = ("Kept under the founder's decision 23(4): this textual judgement agrees with the BSB's own reading, "
         "which has \"Elhanan son of Jair\" with the footnote \"See 1 Chronicles 20:5; Hebrew Jaare-oregim\".")
OVERRIDE = {'c0160': {'verdict': 'respects', 'decided': D23_4}, 'c0161': {'decided': D23_4}}
# Companion Bible notes copied exactly from the StudyLight page (the pinned copy printed periods for "=" and "a").
cbfix = {r['cid']: r for r in (json.load(open(f'{OUT}/cbfix_results.json')) if os.path.exists(f'{OUT}/cbfix_results.json') else [])}


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
    ov = OVERRIDE.get(c['cid'], {})
    if r.get('verdict') == 'denies' and ov.get('verdict') != 'respects':
        return None, None, f"denies: {r.get('verdict_words', '')}"
    url = r.get('found_at') or c['link']
    if url.replace('://www.', '://') == c['link'].replace('://www.', '://'):
        url = c['link']  # the same page, read without www where the www address refused the reader
    if url in denied_pages:
        return None, None, 'its chapter 1 page denies the book its writer'
    if not c['never_quote'] and not words_ok(r.get('first_words'), r.get('last_words'), c['pieces']):
        report['words_differ'].append({'cid': c['cid'], 'first': r.get('first_words'), 'last': r.get('last_words'), 'pieces': c['pieces']})
    t = r.get('time') or ''
    if not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', t):
        return None, None, f'bad time {t!r}'
    rec = dict(base, url=url, fetched=t[:10], time=t, status='added', read_for='round 3 (Wordplay thread): the note cites this comment',
               read_how='read again on this page; the reader confirmed each part of the quotation there', verdict=ov.get('verdict', r.get('verdict', 'respects')))
    if c['never_quote']:
        rec['pointer'] = r.get('pointer') or ''
        if not rec['pointer']:
            return None, None, 'pointer missing'
    elif c['source'] == 'bullinger-cb':
        fx = cbfix.get(c['cid'])
        if not fx:
            return None, None, 'Companion Bible wording not yet copied from the page'
        rec['quote'] = fx['quote']
        rec['read_how'] = fx.get('read_how') or 'read again on this page; the reader copied the note there word for word'
        if fx.get('found_at', '').startswith('https://archive.org/'):
            rec['url'] = url = fx['found_at']
            rec['fetched'], rec['time'] = fx['time'][:10], fx['time']
        if fx.get('mended'):
            rec['mended'] = fx['mended']
        if fx.get('time'):
            rec['time'], rec['fetched'] = fx['time'], fx['time'][:10]
    else:
        rec['quote'] = ' ... '.join(c['quotes']) if c['quotes'] else f"{r.get('first_words', '')} ... {r.get('last_words', '')}"
    if r.get('remark'):
        rec['remark'] = r['remark']
    if ov.get('decided'):
        rec['decided'] = ov['decided']
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
    for c in keep:
        if (c['source'], c.get('on')) in NOT_COUNTED.get((pid, idx_r3), []):
            c['counts'] = False
            report['counts_false'].append({'passage': pid, 'note': final_note, 'source': c['source'], 'on': c.get('on')})
    l['cites'] = keep
    return l


ORDER = ['widely agreed', 'commonly held', 'some interpreters']
# Cites whose evidence line says they are not counted (round 3 counted only writers who state the point): counts false.
NOT_COUNTED = {
    ('genesis-5-21', 1): [('barnes', 'Genesis 5:1')], ('genesis-14-18', 1): [('bullinger-cb', 'Genesis 14:18')],
    ('exodus-31-2', 1): [('jfb', 'Exodus 31:2')], ('deuteronomy-3-9', 2): [('pulpit', 'Deuteronomy 3:8')],
    ('joshua-10-1', 2): [('barnes', 'Joshua 10:1'), ('keil-delitzsch', 'Joshua 10:1')], ('judges-4-4', 1): [('barnes', 'Judges 4:4')],
    ('2-kings-14-21', 1): [('clarke', '2 Kings 14:21')], ('psalm-46-7', 1): [('gill', 'Psalms 46:7')],
    ('isaiah-50-3', 1): [('barnes', 'Isaiah 50:3')], ('daniel-12-1', 3): [('jfb', 'Daniel 12:1')],
    ('luke-6-14', 1): [('catena-aurea', 'Luke 6:12-16')], ('luke-13-35', 1): [('gill', 'Luke 13:35')],
    ('james-2-23', 2): [('barnes', 'James 2:23')], ('psalm-55-9', 3): [('gill', 'Psalms 55:9')],
    ('isaiah-12-2', 2): [('tyndale-notes', 'Isaiah 12:2')], ('john-18-1', 2): [('clarke', 'John 18:1'), ('wesley', 'John 18:1')],
}


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

# Evidence wording fixed by hand on 2026-10-25: true writers for uncited mentions, and no condemned Father named.
EV_FIX = {
    'genesis-2-4': [("Keil and Delitzsch and Barnes take", "Keil and Delitzsch, and James G. Murphy in Barnes' Notes, take")],
    '1-chronicles-6-10': [("Barnes, Ellicott and the Pulpit Commentary instead", "George Rawlinson (Barnes' Notes), Ellicott and the Pulpit Commentary instead")],
    'john-1-21': [(", and Origen (Catena) ties the article in that Prophet to Moses' words", "")],
    'hebrews-2-6': [("the rule God gave man, not yet seen in full, and complete only", "the rule God gave man, complete only"), ("Jamieson-Fausset-Brown says the dignity", "JFB says the dignity"), ("Henry's Concise and the Tyndale Open Study Notes say Hebrews shows Christ is the man the psalm speaks of.", "The Concise Commentary (abridging William Tong's continuation of Matthew Henry) and the Tyndale notes see Christ as the man the psalm means.")],
    'hebrews-2-12': [("Barnes says it describes His sufferings and the point is that", "Barnes says the point is that"), ("Gill says it tells Christ's sufferings and these are His words to the Father. The Tyndale notes say the sufferer, Jesus, joins God's people in praise. Henry's Concise applies", "Gill says these are Christ's words to the Father. The Tyndale notes say Jesus, the sufferer, joins God's people in praise. The Concise Commentary (abridging William Tong's continuation of Matthew Henry) applies")],
}
for p in passages:
    for old_s, new_s in EV_FIX.get(p['id'], []):
        hits = [l for l in p['layers'] if old_s in l.get('evidence', '')]
        assert len(hits) == 1, (p['id'], old_s)
        hits[0]['evidence'] = hits[0]['evidence'].replace(old_s, new_s)
        report['evidence_fixed'].append({'passage': p['id'], 'old': old_s, 'new': new_s})
# records for held passages go with them, not into the reads file
live_ids = {p['id'] for p in passages}
add_ids = {a['passage_id'] for a in additions}
held_ids = {p['id'] for p in held}
held_records = [r for r in records if r['passage'] in held_ids]
records = [r for r in records if r['passage'] in live_ids or r['passage'] in add_ids]
reads_file = {
    '_comment': [
        "Pages read for the Wordplay thread's round 3 of Layers passages and notes (new passages and notes added to passages already live): one record per citation. passage and note: the passage id and the 0-based index of the note in its layers list in config/layers.json; kind: the note's kind; source, on and at: the citation as config/layers.json gives it; url: the page the citation links to.",
        "fetched and time: the day the page was read, and for pages read again on 2026-10-24 and 25 the UTC time taken right after the read. Pages were read with a text reader that returns the page's text but no HTTP status or hash. read_how says how: read again on the linked page (the reader confirmed each part of the quotation there), read on that page while the note was checked on 2026-10-21 or 22, or, for the Tyndale study notes, re-found word for word in the pinned file the app ships.",
        "quote: the writer's words, for public-domain and openly licensed works, as found in the copy checked; pointer: for the Pulpit Commentary, the NET notes and the Reformation Study Bible, where on the page the point is made, never their words. Bible references inside a quotation are printed as in the copy the words were first checked in (for example 'Gen 14:18' where Bible Hub prints 'Genesis 14:18', or 'Isa 29:13' where Bullinger's printed page has 'Isa. xxix. 13'); the Companion Bible notes are copied from the StudyLight page itself. verdict (founder's decision 20): whether the cited comment respects or denies Scripture, judged on its own words. decided: for a chapter 1 page, what its introduction says on who wrote the book (decision 23(3)), or why a comment that judges the received text was kept (decision 23(4)).",
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
json.dump(held_records, open(f'{FIN}/r3-held-reads.json', 'w'), indent=1, ensure_ascii=False)
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
