#!/usr/bin/env python3
"""lib3.py: shared helpers for post3.py and apply_held.py: the cite list, cite conversion with local quote checks, and writer keys."""
import json, os, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq, osn, cat
from fosfig import fos_heading

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

report = {'dropped_cites': [], 'dropped_layers': [], 'held': [], 'writer_dropped': [], 'unconfirmed': [], 'missing_stage': []}


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
