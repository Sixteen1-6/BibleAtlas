"""apply_cl.py WORKTREE: put the verified cite-list additions (cl/final.json) into a main worktree, as text edits in main's layout.
  config/layer-sources.json: new sites, writers and works at the end of their lists; new parts in Bible order inside
    their cite's parts; changed parts (books widened); new work ids at the end of a cite's "works".
  docs/evidence/credits-wordplay-held-2026-11-07.json: the new attribution records (kind "attribution").
  record_changes: existing attribution records widened to new books (same words, already read).
Prints what it did; refuses anything it cannot place exactly."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from resolve import BOOKS

wt = sys.argv[1]
F = json.load(open(os.path.join(HERE, 'cl', 'final.json')))
SRC = os.path.join(wt, 'config', 'layer-sources.json')
lines = open(SRC).read().split('\n')
dump = lambda o: json.dumps(o, ensure_ascii=False)


def block(name):
    """(first entry line, closing line) of a top-level list such as "writers"."""
    start = lines.index(f'  "{name}": [')
    end = next(i for i in range(start + 1, len(lines)) if lines[i] in ('  ],', '  ]'))
    return start + 1, end


def append(name, entries):
    have = set()
    a, b = block(name)
    for l in lines[a:b]:
        m = re.match(r'\s*\{"(id|host)": "([^"]+)"', l)
        if m:
            have.add(m.group(2))
    new = [e for e in entries if (e.get('id') or e.get('host')) not in have]
    for e in entries:
        if e not in new:
            print(f'  {name}: {e.get("id") or e.get("host")} is already there; left as it is')
    if not new:
        return
    if not lines[b - 1].endswith(','):
        lines[b - 1] += ','
    add = [f'    {dump(e)},' for e in new]
    add[-1] = add[-1][:-1]
    lines[b:b] = add
    print(f'  {name}: added', ', '.join(e.get('id') or e.get('host') for e in new))


def cite_line(cid):
    a, b = block('cite')
    for i in range(a, b):
        if lines[i].startswith(f'    {{"id": "{cid}",'):
            return i
    raise SystemExit(f'cite {cid} not found')


def first_book(part):
    bs = part['books']
    return -1 if bs == 'all' else BOOKS.index(bs[0])


def add_part(src, part):
    i = cite_line(src)
    if not lines[i].endswith('"parts": ['):
        raise SystemExit(f'cite {src} has no multi-line parts list')
    j = i + 1
    rows = []
    while lines[j] != '    ] },':
        rows.append(j)
        j += 1
    for r in rows:
        p = json.loads(lines[r].strip().rstrip(','))
        if p['books'] != 'all' and set(p['books']) & set(part['books']):
            raise SystemExit(f'{src}: a part already covers {sorted(set(p["books"]) & set(part["books"]))}')
    # Bible order of the first book, after the last part that starts earlier
    at = rows[-1] + 1
    for r in rows:
        p = json.loads(lines[r].strip().rstrip(','))
        if first_book(p) > first_book(part):
            at = r
            break
    text = f'        {dump(part)}'
    if at == rows[-1] + 1:
        lines[rows[-1]] += ','
        lines.insert(at, text)
    else:
        lines.insert(at, text + ',')
    print(f'  {src}: part for {", ".join(part["books"])} added')


def change_part(src, old, new):
    i = cite_line(src)
    j = i + 1
    while lines[j] != '    ] },':
        s = lines[j].strip()
        comma = s.endswith(',')
        p = json.loads(s.rstrip(','))
        if p['books'] == old:
            p['books'] = new
            lines[j] = f'        {dump(p)}' + (',' if comma else '')
            print(f'  {src}: part for {", ".join(old)} now covers {", ".join(new)}')
            return
        j += 1
    raise SystemExit(f'{src}: no part for {old}')


def add_work(src, work):
    i = cite_line(src)
    c = json.loads(lines[i].rstrip(','))
    if 'works' not in c:
        raise SystemExit(f'cite {src} lists no works')
    if work in c['works']:
        print(f'  {src}: lists {work} already'); return
    c['works'].append(work)
    lines[i] = f'    {dump(c)}' + (',' if lines[i].endswith(',') else '')
    print(f'  {src}: work {work} added')


print('layer-sources.json')
append('sites', F.get('sites', []))
append('writers', F.get('writers', []))
append('works', F.get('works', []))
for x in F.get('cite_works', []):
    add_work(x['source'], x['work'])
for x in F.get('part_changes', []):
    change_part(x['source'], x['books_old'], x['books_new'])
for x in F.get('parts', []):
    add_part(x['source'], x['part'])
open(SRC, 'w').write('\n'.join(lines))
json.load(open(SRC))   # still JSON

if F.get('records'):
    ev = {
        '_comment': F['records_comment'],
        'kind': 'attribution',
        'from': min(r['_read'] for r in F['records']),
        'to': max(r['_read'] for r in F['records']),
        'records': [{k: v for k, v in r.items() if not k.startswith('_')} for r in F['records']],
        'cites': [],
    }
    out = os.path.join(wt, 'docs', 'evidence', 'credits-wordplay-held-2026-11-07.json')
    with open(out, 'w') as f:
        f.write('{\n')
        f.write('  "_comment": [\n' + ',\n'.join('    ' + dump(c) for c in ev['_comment']) + '\n  ],\n')
        for k in ('kind', 'from', 'to'):
            f.write(f'  {dump(k)}: {dump(ev[k])},\n')
        f.write('  "records": [\n' + ',\n'.join('    ' + dump(r) for r in ev['records']) + '\n  ],\n')
        f.write('  "cites": []\n}\n')
    print('evidence:', os.path.relpath(out, wt), len(ev['records']), 'records')

if F.get('shelf_changes'):
    SH = os.path.join(wt, 'config', 'shelf.json')
    t = open(SH).read().split('\n')
    for x in F['shelf_changes']:
        a = next(i for i, l in enumerate(t) if l == f'      "id": "{x["card"]}",')
        b = next(i for i in range(a, len(t)) if t[i].startswith('    }'))
        for field, val in list(x.get('set', {}).items()) + ([('layer', None)] if x.get('layer_add') else []):
            k = next((i for i in range(a, b) if t[i].startswith(f'      "{field}": ')), None)
            if k is None:
                raise SystemExit(f'shelf card {x["card"]} has no {field}')
            comma = t[k].endswith(',')
            if field == 'layer':
                cur = json.loads(t[k].split(': ', 1)[1].rstrip(','))
                val = cur + [w for w in x['layer_add'] if w not in cur]
            t[k] = f'      "{field}": {dump(val)}' + (',' if comma else '')
        print(f'  shelf card {x["card"]}:', ', '.join(list(x.get('set', {})) + (['layer +' + str(len(x.get("layer_add", [])))] if x.get('layer_add') else [])))
    open(SH, 'w').write('\n'.join(t))
    json.load(open(SH))

for x in F.get('record_changes', []):
    p = os.path.join(wt, x['file'])
    t = open(p).read().split('\n')
    k = next(i for i, l in enumerate(t) if l.strip().startswith(f'{{"id": "{x["id"]}",'))
    s = t[k].strip()
    comma = s.endswith(',')
    r = json.loads(s.rstrip(','))
    for b in x.get('add_books', []):
        if b not in r['books']:
            r['books'].append(b)
    r['books'].sort(key=BOOKS.index)
    for e in r.get('parts', []):
        if e['books'] == x.get('parts_books_old'):
            e['books'] = x['parts_books_new']
    ind = t[k][:len(t[k]) - len(t[k].lstrip())]
    t[k] = ind + dump(r) + (',' if comma else '')
    open(p, 'w').write('\n'.join(t))
    json.load(open(p))
    print(f'  record {x["id"]} in {x["file"]}: books now include {x.get("add_books")}')
