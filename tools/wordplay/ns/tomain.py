"""Map this thread's cite ids onto main's cite list (PR #70, e5405ef) and build the checking overlay.

python3 -I ns/tomain.py overlay            writes ns/main-sources.json (main's writers, works, cite, quotable,
                                           plus the lowth-isaiah proposal) for ATLAS_SOURCES_EXTRA
python3 -I ns/tomain.py map <in> <out>     rewrites cites in {"notes"|"structures": [...]} to main's ids
"""
import json, sys, os
NS = os.path.dirname(os.path.abspath(__file__))
WORK = {'boys-tactica-sacra': 'boys-tactica', 'forbes-symmetrical-structure': 'forbes-symmetrical'}
DEFAULT_WORK = {'jebb': 'jebb-sacred-literature', 'forbes': 'forbes-symmetrical'}


def overlay():
    m = json.load(open(f'{NS}/main-layer-sources.json'))
    nw = json.load(open(f'{NS}/../nw/result.json'))
    lw = {r['id']: r['checked']['entry'] for r in nw['results']}['lowth']
    isa = [w for w in lw['works'] if w['id'] == 'lowth-isaiah'][0]
    works = m['works'] + [isa]
    cite = []
    for c in m['cite']:
        c = dict(c)
        if c['id'] == 'lowth' and 'lowth-isaiah' not in c.get('works', []):
            c['works'] = c['works'] + ['lowth-isaiah']
        cite.append(c)
    q = json.load(open(f'{NS}/main-figure-forms.json'))['quotable']
    out = {'writers': m['writers'], 'works': works, 'cite': cite, 'quotable': q}
    json.dump(out, open(f'{NS}/main-sources.json', 'w'), indent=1, ensure_ascii=False)
    print(f"{len(m['writers'])} writers, {len(works)} works, {len(cite)} cites, {len(q)} quotable")


def fix(c):
    c = dict(c)
    if c.get('work') in WORK:
        c['work'] = WORK[c['work']]
    if c.get('source') in DEFAULT_WORK and not c.get('work'):
        c['work'] = DEFAULT_WORK[c['source']]
    return c


def mapfile(src, dst):
    d = json.load(open(src))
    n = 0
    for key in ('notes', 'structures'):
        for e in d.get(key, []):
            e['cites'] = [fix(c) for c in e.get('cites', [])]
            n += 1
    json.dump(d, open(dst, 'w'), indent=1, ensure_ascii=False)
    print(f'{n} entries mapped')


if __name__ == '__main__':
    if sys.argv[1] == 'overlay':
        overlay()
    else:
        mapfile(sys.argv[2], sys.argv[3])
