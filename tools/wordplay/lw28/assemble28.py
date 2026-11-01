"""assemble28.py [--merge]: the lw28 Layers notes (lwrite63.js output, lw28lay-out.json) as hand-off files.

Writes out/lw28-new-passages.json, out/lw28-additions.json and out/layers-reads-wordplay-lw28-2026-11-01.json
(the docs/evidence reads shape, one record per cite). Each cite keeps only the fields config/layers.json takes
(source, on, at, url, work); its quote or pointer, page and time go to the reads record. With --merge, adds them to
the scratch clone's config/layers.json (base kept in layers.base.json) in main's layout, and writes the reads file
into its docs/evidence."""
import json, os, re, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
WP = os.path.dirname(HERE)
LW = os.path.join(os.path.dirname(WP), 'lw')
sys.path.insert(0, os.path.join(WP, 'tc'))
import layersfmt

TODAY = '2026-11-01'
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
d = json.load(open(os.path.join(HERE, 'lw28lay-out.json')))
SOURCE = 'Sources: the BSB, the Hebrew and Greek texts from STEPBible (Tyndale House, Cambridge), and the writers named under each note.'
LAYER_KEYS = ['kind', 'strength', 'refs', 'words', 'evidence', 'cites', 'text']
TIME = re.compile(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ')
problems = []


def fos_at(at):
    m = re.search(r'(\w[\w\u00e9]*) \(([^)]*)\)\s*$', at or '')
    return f'under {m.group(1)} ({m.group(2)})' if m and not at.startswith('under ') else at


def layer_out(pid, idx, l, reads):
    out = {k: l[k] for k in LAYER_KEYS if k in l and k != 'cites'}
    cites = []
    for c in l['cites']:
        if c.get('counts') is False:
            problems.append(f'{pid} #{idx}: a cite marked counts false ({c["source"]}) was left out')
            continue
        x = {'source': c['source'], 'on': c['on']}
        if c.get('at'):
            x['at'] = fos_at(c['at']) if c['source'] == 'bullinger-fos' else c['at']
        if c.get('url'):
            x['url'] = c['url']
        if c.get('work'):
            x['work'] = c['work']
        cites.append(x)
        t = c.get('time') or ''
        if not TIME.fullmatch(t):
            problems.append(f'{pid} #{idx} {c["source"]}: bad time {t!r}')
        rec = {'passage': pid, 'note': idx, 'kind': l['kind'], 'source': c['source'], 'on': c['on']}
        if 'at' in x:
            rec['at'] = x['at']
        rec.update(url=c.get('page') or c.get('url'), fetched=t[:10], time=t, status='added',
                   read_for='Wordplay thread, 2026-11-01 (the doubled verbs): the note cites this comment',
                   read_how='read on this page while the note was written, and read again there by a second reader, who found each part of the quotation',
                   verdict=c.get('verdict', 'respects'))
        if c.get('pointer'):
            rec['pointer'] = c['pointer']
        else:
            rec['quote'] = c['quote']
        if c.get('remark'):
            rec['remark'] = c['remark']
        if rec['verdict'] != 'respects':
            problems.append(f'{pid} #{idx} {c["source"]}: verdict {rec["verdict"]}')
        reads.append(rec)
    out = {k: (cites if k == 'cites' else out[k]) for k in LAYER_KEYS if k == 'cites' or k in out}
    return out


reads = []
passages = []
for p in d['passages']:
    q = {'id': p['id'], 'section': p['section'], 'ref': p['ref'], 'saying': p['saying'], 'source': SOURCE, 'reviewed_by': [],
         'layers': [layer_out(p['id'], i, l, reads) for i, l in enumerate(p['layers'])]}
    passages.append(q)

base = json.load(open(os.path.join(HERE, 'layers.base.json') if os.path.exists(os.path.join(HERE, 'layers.base.json'))
                      else os.path.join(LW, 'config/layers.json')))
have = {p['id']: p for p in base['passages']}
additions = []
for a in d['additions']:
    live = have.get(a['passage_id'])
    if not live:
        problems.append(f"addition to {a['passage_id']}: no such passage")
        continue
    start = len(live['layers'])
    ls = [layer_out(a['passage_id'], start + i, l, reads) for i, l in enumerate(a['layers'])]
    additions.append({'passage_id': a['passage_id'], 'ref': a['ref'], 'layers': ls})
for p in passages:
    if p['id'] in have:
        problems.append(f"{p['id']} is already a passage")

json.dump({'passages': passages}, open(f'{OUT}/lw28-new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'additions': additions}, open(f'{OUT}/lw28-additions.json', 'w'), ensure_ascii=False, indent=1)
reads_file = {
    '_comment': [
        "Pages read for the Wordplay thread's notes on doubled verbs (2026-11-01), from the local work's list of items not built yet (docs/local-work/2026-10-20/NOT-BUILT-YET.md): one record per citation. passage and note: the passage id and the 0-based index of the note in its layers list in config/layers.json; kind: the note's kind; source, on and at: the citation as config/layers.json gives it; url: the page the citation links to.",
        "fetched and time: the day the page was read and the UTC time taken right after the read. Pages were read with a text reader that returns the page's text but no HTTP status or hash. Each note was written by one reader, checked by a skeptic and confirmed by a second reader, each of whom read the linked pages again.",
        "quote: the writer's words, for public-domain works, as found on the page; pointer: for the Pulpit Commentary, where on the page the point is made, never its words. verdict (founder's decision 20): whether the cited comment respects or denies Scripture, judged on its own words.",
    ],
    'kind': 'reads', 'batch': 'Wordplay, doubled verbs, read 2026-11-01', 'from': TODAY, 'to': TODAY, 'records': reads,
}
json.dump(reads_file, open(f'{OUT}/layers-reads-wordplay-lw28-2026-11-01.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(passages)} passages, {sum(len(p["layers"]) for p in passages)} notes; {len(additions)} additions, '
      f'{sum(len(a["layers"]) for a in additions)} notes; {len(reads)} reads records')
for x in problems:
    print('problem:', x)

if '--merge' in sys.argv:
    L = os.path.join(LW, 'config/layers.json')
    if not os.path.exists(os.path.join(HERE, 'layers.base.json')):
        shutil.copy(L, os.path.join(HERE, 'layers.base.json'))
    m = json.loads(json.dumps(base))
    hv = {p['id']: p for p in m['passages']}
    for a in additions:
        hv[a['passage_id']]['layers'].extend(a['layers'])
    m['passages'].extend(passages)
    open(L, 'w').write(layersfmt.dumps(m))
    json.dump(reads_file, open(os.path.join(LW, 'docs/evidence/layers-reads-wordplay-lw28-2026-11-01.json'), 'w'), indent=1, ensure_ascii=False)
    print('merged into', L)
