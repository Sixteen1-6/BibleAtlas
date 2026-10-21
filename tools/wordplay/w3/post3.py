#!/usr/bin/env python3
"""post3.py <out dir> <journal.jsonl>...: write3.js journals -> Layers hand-off files.

Re-applies the skeptic's verdicts exactly as write3.js did (so the checker's note ids line up), then the
checker's and second reader's decisions, then re-checks every local quote (cq, osn, cat), converts cites to
the Layers format and splits passages into new (rule 7 met, or carried by figure/parallelism/contrast notes)
and held (one writer on every other note). Writes new-passages.json, held-back.json, additions.json,
quotes.json and report.json, ready for finalize.py."""
import json, os, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq, osn, cat
from fosfig import fos_heading

out_dir, journals = sys.argv[1], sys.argv[2:]
LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
SRC = json.load(open(f'{LW}/config/layer-sources.json'))
CITE = {c['id']: c for c in SRC['cite']}
LOCAL = {'gill': 'gill', 'clarke': 'clarke', 'barnes': 'barnes', 'jfb': 'jfb', 'keil-delitzsch': 'kad',
         'henry-concise': 'mhcc', 'wesley': 'wesley', 'bullinger-cb': 'cb', 'bullinger-fos': 'fos'}
FOS_T = 'E. W. Bullinger, Figures of Speech Used in the Bible (1898)'
STANDALONE = {'figure', 'parallelism', 'contrast'}
EXTRA = ['figure_name', 'figure_words', 'stands_for', 'lines', 'relation', 'people']
ORDER = ['plain meaning', 'quotation', 'allusion', 'wordplay', 'name meaning', 'pattern', 'irony', 'fulfillment', 'setting', 'figure', 'parallelism', 'contrast']
RANK = {'some interpreters': 1, 'commonly held': 2, 'widely agreed': 3}
NAME = {1: 'some interpreters', 2: 'commonly held', 3: 'widely agreed'}
live = json.load(open(f'{LW}/config/layers.json'))['passages']
live_ids = {p['id']: p for p in live}

res = {}
for jp in journals:
    lab = {}
    for line in open(jp):
        j = json.loads(line)
        if j.get('type') == 'started':
            lab[j['agentId']] = j.get('label', '')
        elif j.get('type') == 'result' and isinstance(j.get('result'), dict):
            l = lab.get(j.get('agentId'), '')
            if ':' in l:
                stage, key = l.split(':', 1)
                res.setdefault(key, {})[stage] = j['result']

report = {'dropped_cites': [], 'dropped_layers': [], 'held': [], 'writer_dropped': [], 'unconfirmed': [], 'missing_stage': []}


def review(draft, check):
    verdicts, fixes = {}, {}
    for v in (check or {}).get('verdicts', []):
        verdicts.setdefault(f"{v['ref']}#{v['layer']}", v)
    for f in (check or {}).get('passage_fixes', []):
        fixes.setdefault(f['ref'], []).append(f)

    def judged(ref, layers):
        out = []
        for i, l in enumerate(layers):
            v = verdicts.get(f'{ref}#{i}')
            if not v or v['verdict'] == 'drop':
                report['dropped_layers'].append({'where': ref, 'kind': l['kind'], 'why': 'skeptic: ' + (v['reason'] if v else 'no verdict')})
                continue
            if v['verdict'] == 'fix':
                if not v.get('fixed'):
                    report['dropped_layers'].append({'where': ref, 'kind': l['kind'], 'why': 'fix with no layer'})
                    continue
                out.append(v['fixed'])
            else:
                out.append(l)
        return out
    ps = []
    for p in draft.get('passages', []):
        q = dict(p)
        for f in fixes.get(p['ref'], []):
            q[f['field']] = f['value']
        q['layers'] = judged(p['ref'], p['layers'])
        ps.append(q)
    adds = []
    for a in draft.get('additions', []):
        ls = [l for l in judged(a['ref'], a['layers']) if l['kind'] != 'plain meaning']
        if ls:
            adds.append({**a, 'layers': ls})
    return ps, adds


def apply_checks(notes, check, confirm):
    """notes: id -> layer (dict, mutated). Returns ids to drop."""
    drop = set()
    if not check:
        return drop
    conf = {c['note']: c for c in (confirm or {}).get('results', [])}
    for r in check.get('results', []):
        nid = r['note']
        if nid not in notes:
            continue
        l = notes[nid]
        if r['verdict'] == 'ok' and not r.get('remove_cites'):
            if RANK.get(r['strength'], 3) < RANK[l['strength']]:
                l['strength'] = r['strength']  # an honest lowering needs no second reader
            continue
        c = conf.get(nid)
        if not c:
            report['unconfirmed'].append({'note': nid, 'proposed': r['verdict'], 'reason': r['reason']})
            continue
        if c['decision'] == 'reject':
            continue
        src = r if c['decision'] == 'accept' else c
        if c['decision'] == 'accept' and r['verdict'] == 'drop':
            drop.add(nid)
            report['dropped_layers'].append({'where': nid, 'kind': l['kind'], 'why': 'check: ' + r['reason']})
            continue
        l['strength'] = src.get('strength') or l['strength']
        for k in ['text', 'evidence'] + EXTRA[:-1]:
            if src.get(k):
                l[k] = src[k]
        rm = set(src.get('remove_cites') or [])
        if rm:
            l['cites'] = [x for n, x in enumerate(l['cites']) if n not in rm]
    return drop


def writer_key(c):
    """One key per writer. Reference works (role "reference" in layer-sources.json) are not writers (CLAUDE.md): None."""
    s = c['source']
    if CITE.get(s, {}).get('role') == 'reference':
        return None
    if s in ('bullinger-cb', 'bullinger-fos'):
        return 'bullinger'
    if s in ('catena-aurea', 'church-fathers', 'chrysostom'):
        return 'father:' + (c.get('writer') or c.get('at') or s).lower()
    if s in ('henry', 'henry-concise'):
        return 'henry'
    return s


def convert(where, l):
    cites, rows = [], []
    for c in l.get('cites', []):
        s, on, q = c.get('source', ''), c.get('on', ''), c.get('quote', '')
        info = CITE.get(s)
        why = None
        try:
            b = cq.parse(on)[0]
        except SystemExit:
            why = f'bad on {on!r}'
            b = None
        if not info:
            why = f'{s} not on the cite list'
        elif b is not None and any(cq.BOOKS[b] == x for x in info.get('not_on', [])):
            why = f'{s} barred on {cq.BOOKS[b]}'
        spec, read_in = {'source': s, 'on': on}, c.get('url', '')
        if not why and s in LOCAL:
            w = LOCAL[s]
            if w == 'kad' and b > 38:
                why = 'kad has no New Testament'
            else:
                try:
                    ok = cq.check(w, on, q)
                except SystemExit:
                    ok = False
                if not ok:
                    why = f'quote not found in {w} on {on}'
                else:
                    if w in ('mhcc', 'wesley'):
                        spec['on'] = cq.get(w, on)[0]
                    if w == 'fos':
                        h = fos_heading(on, q)
                        spec['at'] = f'{FOS_T}, {h}' if h else FOS_T
                    read_in = cq.url(w, spec['on'])
        elif not why and s == 'tyndale-notes':
            if not any(cq.norm(q) in cq.norm(t) or all(cq.norm(p) in cq.norm(t) for p in re.split(r'\s*(?:\.\.\.|…)\s*', q) if p.strip()) for _, t in osn.notes(on)):
                why = 'quote not found in the study notes'
            else:
                spec['at'] = c.get('at') or f'Aquifer Open Study Notes (adapted from the Tyndale Open Study Notes), note on {on}'
                spec['url'] = c.get('link') or 'https://tyndaleopenresources.com/'
                read_in = f'https://github.com/BibleAquifer/AquiferOpenStudyNotes/blob/bbb3f86016cd20913f410a95af63d9f7ff9a71d6/eng/json/{b + 1:02d}.content.json'
        elif not why and s == 'catena-aurea':
            hit = [f for cit, f, t in cat.segs(on) if all(cq.norm(p) in cq.norm(t) for p in re.split(r'\s*(?:\.\.\.|…)\s*', q) if p.strip())]
            if not hit:
                why = 'quote not found in the Catena'
            else:
                c['writer'] = hit[0]
                spec['at'] = c.get('at') or f'Thomas Aquinas, Catena Aurea on {on}, quoting {hit[0]}'
                spec['url'] = c.get('link') or 'https://github.com/AlvaroBalbin/catena'
                read_in = 'https://github.com/AlvaroBalbin/catena/tree/efe1bd084d918a34ca22ffeef2ecf711c593b392/data/catena'
        elif not why and not info.get('biblehub'):
            link = c.get('link') or (read_in if read_in.startswith('http') else '')
            if not link:
                why = f'{s} needs a page link'
            elif s == 'church-fathers' and not re.match(r'https?://(www\.)?(newadvent\.org|ccel\.org)/', link):
                why = 'church-fathers only from New Advent or CCEL public-domain translations'
            else:
                spec['url'] = link
                if c.get('at'):
                    spec['at'] = c['at']
        if why:
            report['dropped_cites'].append({'where': where, 'kind': l['kind'], 'source': s, 'on': on, 'why': why})
            continue
        if any(x['source'] == spec['source'] and x['on'] == spec['on'] and x.get('at') == spec.get('at') for x, _ in cites):
            continue
        cites.append((spec, writer_key({**c, **spec})))
        rows.append({'where': where, 'kind': l['kind'], **spec, 'quote': q, 'read_in': read_in})
    if not cites:
        return None, []
    n = max(len({k for _, k in cites if k}), 1)
    strength = l['strength']
    if l['kind'] != 'plain meaning' and RANK[strength] > min(n, 3):
        report['dropped_layers'].append({'where': where, 'kind': l['kind'], 'why': f'strength lowered from {strength} to {NAME[min(n, 3)]} ({n} writers left)', 'lowered': True})
        strength = NAME[min(n, 3)]
    out = {'kind': l['kind'], 'strength': strength, 'refs': l['refs']}
    if l.get('words'):
        out['words'] = l['words']
    if l.get('evidence'):
        out['evidence'] = l['evidence']
    for k in EXTRA:
        if l.get(k):
            out[k] = l[k]
    out['cites'] = [x for x, _ in cites]
    out['text'] = l['text']
    return out, rows


SRC_LINE = 'Drafted with AI help (Claude) from the BSB, STEPBible TAHOT and TAGNT, and the commentaries named under each note.'
new, held, adds, quotes = [], [], [], []
seen_ids = set(live_ids)
for key in sorted(res, key=lambda k: (k.rsplit('-', 1)[0], int(k.rsplit('-', 1)[1]) if k.rsplit('-', 1)[1].isdigit() else 0)):
    r = res[key]
    d = r.get('write')
    if not d:
        continue
    report['writer_dropped'] += [{**x, 'batch': key} for x in d.get('dropped', [])]
    if (d.get('passages') or d.get('additions')) and 'verify' not in r:
        report['missing_stage'].append({'batch': key, 'stage': 'verify'})
        continue
    ps, ads = review(d, r.get('verify'))
    notes = {}
    for p in ps:
        for i, l in enumerate(p['layers']):
            if l['kind'] != 'plain meaning':
                notes[f"{p['ref']}#p{i}"] = l
    for a in ads:
        for i, l in enumerate(a['layers']):
            notes[f"{a['ref']}#a{i}"] = l
    if notes and 'check' not in r:
        report['missing_stage'].append({'batch': key, 'stage': 'check'})
        continue
    drop = apply_checks(notes, r.get('check'), r.get('confirm'))
    for p in ps:
        layers, rows = [], []
        for i, l in enumerate(p['layers']):
            if f"{p['ref']}#p{i}" in drop:
                continue
            c, q = convert(p['ref'], l)
            if c:
                layers.append(c)
                rows += q
        plain = [l for l in layers if l['kind'] == 'plain meaning'][:1]
        rest = sorted([l for l in layers if l['kind'] != 'plain meaning'], key=lambda l: ORDER.index(l['kind']))
        pid = p['id']
        if pid in live_ids:
            adds.append({'passage_id': pid, 'ref': live_ids[pid]['ref'], 'layers': [l for l in rest if l['kind'] != 'plain meaning']})
            quotes += [x for x in rows if x['kind'] != 'plain meaning']
            continue
        if pid in seen_ids:
            report['held'].append({'id': pid, 'why': 'id used twice'})
            continue
        seen_ids.add(pid)
        out = {'id': pid, 'section': p['section'], 'ref': p['ref'], 'saying': p['saying'], 'source': SRC_LINE, 'reviewed_by': [], 'layers': plain + rest}
        firm = any(l['strength'] != 'some interpreters' or l['kind'] in STANDALONE for l in rest)
        if not plain or not rest or not firm:
            report['held'].append({'id': pid, 'why': 'no plain meaning' if not plain else 'no note left' if not rest else 'only one-writer notes'})
            if plain and rest:
                held.append(out)
                quotes += rows
            continue
        new.append(out)
        quotes += rows
    for a in ads:
        layers, rows = [], []
        for i, l in enumerate(a['layers']):
            if f"{a['ref']}#a{i}" in drop:
                continue
            c, q = convert(a['ref'], l)
            if c:
                layers.append(c)
                rows += q
        if not layers:
            continue
        if a['passage_id'] not in live_ids:
            report['held'].append({'id': a['passage_id'], 'why': 'addition for a passage that is not live'})
            continue
        adds.append({'passage_id': a['passage_id'], 'ref': a['ref'], 'layers': layers})
        quotes += rows

os.makedirs(out_dir, exist_ok=True)
json.dump({'passages': new}, open(f'{out_dir}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': held}, open(f'{out_dir}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(adds, open(f'{out_dir}/additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out_dir}/quotes.json', 'w'), ensure_ascii=False, indent=1)
json.dump(report, open(f'{out_dir}/report.json', 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(f'{len(res)} batches; {len(new)} new passages, {len(held)} held, {len(adds)} additions, {len(quotes)} quote rows')
print('kinds', Counter(l['kind'] for p in new for l in p['layers']) + Counter(l['kind'] for a in adds for l in a['layers']))
print('strength', Counter(l['strength'] for p in new for l in p['layers'] if l['kind'] != 'plain meaning') + Counter(l['strength'] for a in adds for l in a['layers']))
print({k: len(v) for k, v in report.items()})
