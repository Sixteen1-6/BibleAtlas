"""mk_reads.py: what must be read for the round 3 reads records (PR #63 rule 12).
out/reads/cites.json: every kept cite with an id (cid), its link and its quote pieces.
out/reads/direct.json: cites whose quote row was read on the very page the cite links to (date known).
out/reads/pages_<kind>.json: pages to read again, grouped by page."""
import json, os, re, collections
f = json.load(open('out/facts.json'))
os.makedirs('out/reads', exist_ok=True)
NEVER = {'pulpit', 'net-notes', 'reformation-sb'}
LW = os.environ.get('ATLAS_LW') or '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lwc'
SRCS = json.load(open(LW + '/config/layer-sources.json'))
NAME = {c['id']: c['name'] for c in SRCS['cite']}
SHELF_OF = {w['id']: w.get('shelf') or w['id'] for w in SRCS['works']}
LICENSE = {c['id']: c.get('license') for c in json.load(open(LW + '/config/shelf.json'))['works']}


def never_quote(c, k):
    """Pulpit, NET and RSB by rule; any work whose shelf card is copyrighted; any cite read in a copyrighted row."""
    return (c['source'] in NEVER or LICENSE.get(SHELF_OF.get(k.get('work') or '', k.get('work') or '')) == 'copyrighted'
            or any(r.get('copyrighted') for r in k['rows']))


def pieces(q):
    return [p.strip(' .;,') for p in re.split(r'\.\.\.|…', q) if len(p.split()) >= 3]


cites, direct, pages = [], [], collections.defaultdict(lambda: {'cites': []})
# cids stay as first given (out/reads/cites-v1.json), so reads already returned keep matching; new cites get c1001 on.
KEY = lambda d: (d['passage'], d['note'], d['source'], d.get('on'), d.get('at'))
V1 = {KEY(c): c['cid'] for c in json.load(open('out/reads/cites-v1.json'))} if os.path.exists('out/reads/cites-v1.json') else {}
n = 1000
for x in f:
    for k in x['kept']:
        c = k['cite']
        cid = V1.get((x['passage'], x['note'], c['source'], c.get('on'), c.get('at')))
        if not cid:
            n += 1
            cid = f'c{n:04d}'
        m = re.search(r':(\d+)', c.get('on') or '')
        rec = {'cid': cid, 'passage': x['passage'], 'note': x['note'], 'kind': x['kind'], 'source': c['source'], 'source_name': NAME[c['source']],
               'on': c.get('on'), 'at': c.get('at'), 'work': c.get('work'), 'link': k['link'], 'writer': k['writer'], 'book': k['book'],
               'chapter': k['chapter'], 'verse': int(m.group(1)) if m else None, 'never_quote': never_quote(c, k),
               'quotes': [r['quote'] for r in k['rows']], 'pieces': [p for r in k['rows'] for p in pieces(r['quote'])],
               'rows': k['rows']}
        cites.append(rec)
        same = [r for r in k['rows'] if r['read_in'].rstrip('/') == (k['link'] or '').rstrip('/') and r.get('fetched')]
        if c['source'] == 'tyndale-notes':
            kind = 'tyndale'
        elif same:
            direct.append({'cid': cid, 'url': k['link'], 'fetched': min(r['fetched'] for r in same), 'how': same[0]['fetched_how']})
            continue
        elif c['source'] == 'catena-aurea':
            kind = 'catena'
        elif c['source'] == 'bullinger-fos':
            kind = 'fos'
        elif c['source'] == 'bullinger-cb':
            kind = 'cb'
        else:
            kind = 'bh'
        key = (kind, k['link'] if kind in ('bh', 'cb') else f"{kind}:{k['book']}")
        pg = pages[key]
        pg.update(kind=kind, url=k['link'] if kind in ('bh', 'cb') else None, source=c['source'], source_name=NAME[c['source']], book=k['book'], chapter=k['chapter'])
        pg['cites'].append({kk: rec[kk] for kk in ('cid', 'passage', 'note', 'kind', 'on', 'at', 'work', 'verse', 'writer', 'never_quote', 'pieces')})
json.dump(cites, open(os.environ.get('READS_OUT', 'out/reads') + '/cites.json', 'w'), indent=1, ensure_ascii=False)
json.dump(direct, open('out/reads/direct.json', 'w'), indent=1, ensure_ascii=False)
by = collections.defaultdict(list)
for (kind, _), pg in pages.items():
    by[kind].append(pg)
for kind, lst in by.items():
    lst.sort(key=lambda p: (p['source'], p['url'] or p['book']))
    json.dump(lst, open(f'out/reads/pages_{kind}.json', 'w'), indent=1, ensure_ascii=False)
print('cites', len(cites), 'direct', len(direct), {k: (len(v), sum(len(p['cites']) for p in v)) for k, v in by.items()})
print('no pieces:', [(c['cid'], c['passage'], c['source']) for c in cites if not c['pieces']])
