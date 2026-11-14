"""convert.py (tc2): the 12 held shards' mended passages (h3/out1107) under the PR #63 rules, against main ea56db8.
Writes tc/out/facts.json (per note: kept cites with their true writer, dropped cites and why, old and new strength)
and tc/out/stage1.json (passages and additions with dropped cites removed, catena work set, tyndale url set, strength recounted)."""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import resolve as R

R3 = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/h3/out1107'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
newp = json.load(open(f'{R3}/new-passages.json'))['passages']
adds = json.load(open(f'{R3}/additions.json'))
rows = json.load(open(f'{R3}/quotes.json'))
main = {p['id']: p for p in json.load(open(R.LW + '/config/layers.json'))['passages']}

BARRED_FATHERS = re.compile(r'Origen|Tertullian|Hippolytus|Victorinus|Clement of Alexandria|Didymus|Theodore of Mopsuestia|'
                            r'Pelagius|Opus Imperfectum|Gloss\b', re.I)
PLAIN = 'plain meaning'
WORK_BY_URL = [('https://www.newadvent.org/fathers/0103', 'irenaeus-against-heresies'),
               ('https://www.ccel.org/ccel/edersheim/lifetimes', 'edersheim-life'),
               ('https://www.thegospelcoalition.org/themelios/article/the-lamblike-servant', 'christensen-lamblike-servant'),
               ('https://www.thegospelcoalition.org/themelios/article/soteriology-in-the-gospel-of-john', 'reichenbach-soteriology-john')]


CL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cl', 'final.json'))) if os.environ.get('ATLAS_LW') else {}
FIX = {(f['passage'], f['note'], f['source'], f['on'], f.get('at') or None): f for f in CL.get('cite_fixes', [])}
LEFT = {(x['passage'], x.get('note'), x['source'], x['on']): x['why'] for x in CL.get('left_out', [])}


def strength(n):
    return 'widely agreed' if n >= 3 else 'commonly held' if n == 2 else 'some interpreters'


def rows_for(where, kind, note, c):
    out = []
    for r in rows:
        # the held rows carry no note index: match on the note's kind instead
        if r['where'] == where and r['kind'] == kind and r['source'] == c['source'] and r.get('on') == c.get('on') and r.get('at') == c.get('at'):
            out.append(r)
    return out


facts, stage = [], {'passages': [], 'additions': []}
FIXED = set()
why_drop = collections.Counter()
held = []


def do_note(pid, where, idx, l, row_note=None):
    keptc, dropped, info = [], [], []
    for c in l['cites']:
        c = dict(c)
        rr = rows_for(where, l['kind'], idx if row_note is None else row_note, c)
        if (pid, idx, c['source'], c.get('on')) in LEFT:
            dropped.append((c, 'left out by the cite-list check: ' + LEFT[(pid, idx, c['source'], c.get('on'))]))
            continue
        fx = FIX.get((pid, idx, c['source'], c.get('on'), c.get('at') or None))
        if fx:   # the cite-list check's fix: the work, the exact page, the place in the work
            if fx.get('work'):
                c['work'] = fx['work']
            if fx.get('url'):
                c['url'] = fx['url']
            if 'at_new' in fx:
                if fx['at_new']:
                    c['at'] = fx['at_new']
                else:
                    c.pop('at', None)
            FIXED.add(id(fx))
        if c['source'] == 'catena-aurea':
            at = c.get('at', '')
            if BARRED_FATHERS.search(at) or (re.search(r'Pseudo-Chrys', at) and c['on'].startswith('Matthew')):
                dropped.append((c, f'barred or unnamed writer in the Catena: {at}'))
                continue
            c['work'] = 'catena-aurea-rabanus' if re.search(r'Rabanus|Raban', at) else 'catena-aurea'
        # A source that lists works needs `work`: set it where the cite's page is one of main's works.
        if not c.get('work'):
            for pre, wid in WORK_BY_URL:
                if c.get('url', '').startswith(pre) and R.CITE.get(c['source'], {}).get('works') and wid in R.CITE[c['source']]['works']:
                    c['work'] = wid
        if c['source'] == 'tyndale-notes' and not (c.get('url') or '').startswith('https://github.com/BibleAquifer/'):
            pages = sorted({r['read_in'] for r in rr if 'github.com/BibleAquifer' in r['read_in']})
            if pages:
                c['url'] = pages[0]
        res = R.resolve(c)
        if not res['ok']:
            dropped.append((c, res['why']))
            continue
        keptc.append(c)
        info.append({'cite': c, 'writer': res['names'] or [res['unnamed']], 'key': res['key'], 'role': res['role'],
                     'book': res['book'], 'chapter': res['chapter'], 'link': res['link'], 'work': res['work'],
                     'rows': [{k: r.get(k) for k in ('quote', 'read_in', 'fetched', 'fetched_how', 'copyrighted')} for r in rr]})
    keys = sorted({i['key'] for i in info if i['role'] == 'interpreter' and i['cite'].get('counts') is not False})
    old = l['strength']
    ORDER = ['widely agreed', 'commonly held', 'some interpreters']
    counted = strength(len(keys))
    # Never above the count of people, and never above what the round 3 reviewers judged.
    new = old if l['kind'] == PLAIN else ORDER[max(ORDER.index(old), ORDER.index(counted))]
    if l['kind'] != PLAIN and old != new and ['widely agreed', 'commonly held', 'some interpreters'].index(new) > ['widely agreed', 'commonly held', 'some interpreters'].index(old):
        pass  # lowered
    for c, w in dropped:
        why_drop[w[:60]] += 1
    nl = dict(l)
    nl['cites'] = keptc
    nl['strength'] = new
    facts.append({'passage': pid, 'note': idx, 'kind': l['kind'], 'old_strength': old, 'new_strength': new, 'counted': counted, 'keys': keys,
                  'evidence': l.get('evidence'), 'text': l['text'], 'kept': info,
                  'dropped': [{'cite': c, 'why': w} for c, w in dropped]})
    return nl if keptc else None


for p in newp:
    np_ = dict(p)
    layers = []
    for i, l in enumerate(p['layers']):
        nl = do_note(p['id'], p['ref'], i, l)
        if nl is None:
            why_drop['note lost every cite'] += 1
            continue
        layers.append(nl)
    np_['layers'] = layers
    ok = layers and layers[0]['kind'] == PLAIN and any(l['kind'] != PLAIN and l['strength'] != 'some interpreters' for l in layers)
    if not ok:
        held.append({'passage': p['id'], 'why': 'no note beyond the plain meaning above "some interpreters" after the new rules' if layers else 'no cites left'})
    else:
        stage['passages'].append(np_)

for a in adds:
    base = main.get(a['passage_id'])
    if not base:
        held.append({'addition': a['passage_id'], 'why': 'passage no longer on main'})
        continue
    n0 = len(base['layers'])
    layers = []
    for j, l in enumerate(a['layers']):
        nl = do_note(a['passage_id'], a['ref'], n0 + j, l, row_note=f'added {j}')  # quote rows say 'added j'
        if nl is not None:
            layers.append(nl)
    if layers:
        stage['additions'].append({'passage_id': a['passage_id'], 'ref': a['ref'], 'first_note_index_on_main': n0, 'layers': layers})

json.dump(facts, open(f'{OUT}/facts.json', 'w'), indent=1, ensure_ascii=False)
json.dump(stage, open(f'{OUT}/stage1.json', 'w'), indent=1, ensure_ascii=False)
json.dump(held, open(f'{OUT}/held1.json', 'w'), indent=1, ensure_ascii=False)
ch = collections.Counter((f['kind'] == PLAIN, f['old_strength'], f['new_strength']) for f in facts if f['old_strength'] != f['new_strength'])
print('notes', len(facts), 'passages kept', len(stage['passages']), 'additions', len(stage['additions']), 'held', len(held))
print('dropped cites:', sum(why_drop.values())); [print('  ', v, k) for k, v in why_drop.most_common()]
print('strength changes:', ch)
print('cites kept', sum(len(f['kept']) for f in facts), 'with no quote row', sum(1 for f in facts for k in f['kept'] if not k['rows']))
for h in held: print('HELD', h)
print('cite-list fixes used', len(FIXED), 'of', len(FIX), [k for k, f in FIX.items() if id(f) not in FIXED])
