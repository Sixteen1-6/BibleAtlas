"""mk_batches.py: out/reads/pages_<kind>.json -> out/reads/b/<kind>_NNN.json (a few pages each) and out/reads/lanes.json.
Bible Hub cites get verse_page (every commentary on that verse); cites from copyrighted rows are never quoted."""
import json, os, glob
R = 'out/reads'
assert not os.path.exists(f'{R}/b'), 'out/reads/b is in use by the reads runs: move it first'
os.makedirs(f'{R}/b', exist_ok=True)
for f in glob.glob(f'{R}/b/*.json'):
    os.remove(f)
cites = {c['cid']: c for c in json.load(open(f'{R}/cites.json'))}
PER = {'bh': 5, 'cb': 5, 'fos': 9, 'catena': 4}
files = []
for kind, per in PER.items():
    pages = json.load(open(f'{R}/pages_{kind}.json'))
    if kind == 'fos':   # cites, not pages
        cs = [c for p in pages for c in p['cites']]
        groups = [[{'kind': 'fos', 'cites': cs[i:i + per]}] for i in range(0, len(cs), per)]
    else:
        groups = [pages[i:i + per] for i in range(0, len(pages), per)]
    for g in groups:
        for p in g:
            for c in p['cites']:
                full = cites[c['cid']]
                if any(r.get('copyrighted') for r in full['rows']):
                    c['never_quote'] = True
                if kind == 'bh' and full['link'] and 'biblehub.com/commentaries/' in full['link'] and c.get('verse'):
                    slug = full['link'].split('/')[-2]
                    c['verse_page'] = f"https://biblehub.com/commentaries/{slug}/{full['chapter']}-{c['verse']}.htm"
                if kind in ('catena', 'fos'):
                    c['note_text'] = None
        name = f'{kind}_{len([x for x in files if x[0] == kind]):03d}.json'
        json.dump(g, open(f'{R}/b/{name}', 'w'), indent=1, ensure_ascii=False)
        files.append([kind, name])
# six lanes, kinds spread so slow StudyLight pages are not all in one lane
lanes = [[] for _ in range(6)]
order = [f for f in files if f[0] == 'cb'] + [f for f in files if f[0] == 'fos'] + [f for f in files if f[0] == 'catena'] + [f for f in files if f[0] == 'bh']
for i, f in enumerate(order):
    lanes[i % 6].append(f)
json.dump(lanes, open(f'{R}/lanes.json', 'w'), indent=1)
print(len(files), {k: sum(1 for f in files if f[0] == k) for k in PER}, [len(l) for l in lanes])
