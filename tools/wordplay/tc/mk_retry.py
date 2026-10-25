# Build retry batches for cites the first reads pass did not confirm.
import json, glob, os, collections
B = os.path.dirname(os.path.abspath(__file__))
O = f'{B}/out'
res = {x['cid']: x for x in json.load(open(f'{O}/reads_results.json'))}
bad = {c for c, x in res.items() if x['status'] != 'found'}
cites = {c['cid']: c for c in json.load(open(f'{O}/reads/cites.json'))}
# old batch entries by cid
old = {}
for f in sorted(glob.glob(f'{O}/reads/b/*.json')):
    for e in json.load(open(f)):
        for c in e['cites']:
            old[c['cid']] = (e, c)
LW = os.path.join(B, '..', '..', 'lw')
nodes = {}
for bk in ['matthew', 'mark', 'luke', 'john']:
    for line in open(f'{LW}/data/raw/catena@efe1bd084d/data/catena/{bk}.jsonl'):
        n = json.loads(line); nodes[n['id']] = n
SPECIAL = {'c0473', 'c0925', 'c0999', 'c0690', 'c0695', 'c0318'}
groups = collections.OrderedDict()
catena = collections.OrderedDict()
special = []
for cid in sorted(bad):
    e, c = old[cid]
    if cid in SPECIAL:
        special.append({**c, 'source': e['source'], 'source_name': e.get('source_name'), 'link': cites[cid]['link'],
                        'book': e.get('book') or cites[cid]['book'], 'chapter': e.get('chapter') or cites[cid]['chapter'],
                        'first_try': res[cid].get('remark', '')})
        continue
    if e['kind'] == 'catena' or cites[cid]['source'] == 'catena-aurea':
        bk, rest = c['on'].rsplit(' ', 1)
        ch, v = rest.split(':')
        v = v.split('-')[0]
        # the node whose passage covers this verse
        cand = [n for n in nodes.values() if n['id'].startswith(f"catena.{bk.lower()}.{ch}.")]
        best = None
        for n in cand:
            s = int(n['id'].split('.')[-1])
            if s <= int(v) and (best is None or s > int(best['id'].split('.')[-1])):
                best = n
        url = best['source']['url']
        catena.setdefault(url, {'kind': 'ec', 'url': url, 'cites': []})['cites'].append({**c, 'passage_title': best['citation']})
        continue
    key = (e['kind'], e['url'])
    g = groups.setdefault(key, {k: v for k, v in e.items() if k != 'cites'})
    g.setdefault('cites', []).append(c)
bh = [g for (k, u), g in groups.items() if k == 'bh']
cb = [g for (k, u), g in groups.items() if k == 'cb']
print('bh pages', len(bh), 'cites', sum(len(g['cites']) for g in bh))
print('cb pages', len(cb), 'cites', sum(len(g['cites']) for g in cb))
print('catena pages', len(catena), 'cites', sum(len(g['cites']) for g in catena.values()))
print('special', len(special))
R = f'{O}/retry'
files = []
def dump(name, items):
    json.dump(items, open(f'{R}/{name}.json', 'w'), ensure_ascii=False, indent=1); files.append(name)
for i in range(0, len(bh), 6):
    dump(f'bh_{i//6:03d}', bh[i:i+6])
for i in range(0, len(cb), 6):
    dump(f'cb_{i//6:03d}', cb[i:i+6])
dump('ec_000', list(catena.values()))
dump('sp_000', special)
print(files)
