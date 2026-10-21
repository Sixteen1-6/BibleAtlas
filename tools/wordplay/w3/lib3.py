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

import datetime
import fetchlog
TODAY = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
_FETCHES = None


def fetched_on(url):
    """Founder decision 10: the date a web page was truly read, from the checking agents' fetch log, or None."""
    global _FETCHES
    if _FETCHES is None:
        _FETCHES = fetchlog.build()
    ts = _FETCHES.get(fetchlog.norm(url))
    return ts[-1][:10] if ts else None


report = {'dropped_cites': [], 'dropped_layers': [], 'held': [], 'writer_dropped': [], 'unconfirmed': [], 'missing_stage': []}


# Founder decisions of 2026-10-20 (2, 20, 23(3)) and the approved voices shortlist (4, 5, 9): writings
# that deny Scripture are not cited, and the condemned or disputed fathers are left out for now.
BARRED_BOOKS = {
    ('ellicott', 'Psalms'): "A. S. Aglen wrote Ellicott's Psalms; his citations go (founder decision 20)",
    ('ellicott', 'Song of Solomon'): "A. S. Aglen wrote Ellicott's Song of Solomon; his citations go (founder decision 20)",
    ('ellicott', 'Obadiah'): "A. S. Aglen wrote Ellicott's Obadiah; his citations go (founder decision 20)",
    ('ellicott', 'Jonah'): "A. S. Aglen wrote Ellicott's Jonah and calls it possibly fiction (founder decision 20)",
    ('ellicott', 'Ecclesiastes'): "G. Salmon's Ecclesiastes in Ellicott says Solomon did not write it",
    ('keil-delitzsch', 'Ecclesiastes'): "Delitzsch holds that Solomon did not write Ecclesiastes (kd-ecclesiastes)",
    ('pulpit', 'Ecclesiastes'): "W. J. Deane's Pulpit Ecclesiastes holds that a later writer took Solomon's part (pulpit-ecclesiastes)",
}
BARRED_VERSES = {
    ('calvin', 'Matthew 27:9'): 'Calvin calls the name Jeremiah a mistake (calvin-matthew-27-9)',
    ('calvin', 'Acts 7:14'): 'Calvin puts the number down to copyists (calvin-acts-7-14)',
    ('calvin', 'Acts 7:16'): 'Calvin calls the name Abraham a fault (calvin-acts-7-16)',
    ('keil-delitzsch', 'Psalm 74:4'): 'Delitzsch favours a Maccabean date against the title (kd-psalm-74)',
    ('keil-delitzsch', 'Psalm 86:1'): 'Delitzsch denies David wrote the psalm his title names (kd-psalm-86)',
    ('keil-delitzsch', 'Psalm 130:1'): 'Delitzsch denies the title (kd-psalm-130)',
    ('pulpit', '2 Corinthians 3:7'): "F. W. Farrar calls Paul's words a traditional legend (true-credits denies list)",
}
BARRED_FATHERS = ['origen', 'didymus', 'theodore of mopsuestia', 'pelagius', 'arius', 'nestorius', 'apollinaris',
                  'evagrius', 'tatian', 'novatian', 'tertullian', 'theodoret', 'hippolytus', 'victorinus',
                  'clement of alexandria', 'eusebius']
NOT_A_WRITER = {'gloss', 'the council of ephesus'}
# Modern works under copyright: cited and linked, never quoted in the repository (evidence gets a pointer).
COPYRIGHTED = {'net-notes', 'reformation-sb', 'gospel-coalition', 'ligonier', 'themelios', 'jets', 'beale', 'bruce',
               'woudstra', 'bibleproject', 'leithart', 'bird', 'keener', 'capes'}


def barred(s, on, at=''):
    """Why this cite may not be used, or None."""
    try:
        b, c, v = cq.parse(on)
    except SystemExit:
        return None
    book = cq.BOOKS[b]
    if (s, book) in BARRED_BOOKS:
        return BARRED_BOOKS[(s, book)]
    for (src, ref), why in BARRED_VERSES.items():
        if src == s and cq.parse(ref) == (b, c, v):
            return why
    if s in ('church-fathers', 'catena-aurea'):
        who = (at or '').lower()
        for f in BARRED_FATHERS:
            if re.search(r'\b' + f + r'\b', who) and not (f == 'eusebius' and s == 'catena-aurea'):
                return f'{f.title()} is left out for now (approved voices shortlist, decisions 4 and 5)'
        if s == 'catena-aurea' and 'pseudo-chrysostom' in who and book == 'Matthew':
            return "the Catena's Pseudo-Chrysostom on Matthew is an unknown Arian writer (shortlist decision 5)"
    return None


def writer_key(c):
    """One key per writer. Reference works (role "reference" in layer-sources.json) are not writers (CLAUDE.md): None.
    Bullinger's two works count once, as do Henry's two; each father is his own writer; the Gloss is not a writer."""
    s = c['source']
    if CITE.get(s, {}).get('role') == 'reference':
        return None
    if s in ('bullinger-cb', 'bullinger-fos'):
        return 'bullinger'
    if s == 'chrysostom':
        return 'father:chrysostom'
    if s in ('catena-aurea', 'church-fathers'):
        w = (c.get('writer') or c.get('at') or s).lower()
        if w in NOT_A_WRITER:
            return None
        if s == 'catena-aurea' and w == 'pseudo-chrysostom':
            return 'father:victor of antioch'
        return 'father:' + w
    if s in ('henry', 'henry-concise'):
        return 'henry'
    if s == 'wesley':
        # His prefaces: the Old Testament notes abridge Henry, the New Testament notes abridge Bengel
        # (counts_as in the true-credits branch's layer-sources.json).
        try:
            return 'bengel' if cq.parse(c['on'])[0] > 38 else 'henry'
        except (SystemExit, KeyError):
            return 'wesley'
    return s


def count_writers(pairs):
    """Distinct writers among (cite, key) pairs (writer_key already merges Wesley with Henry or Bengel)."""
    return len({k for _, k in pairs if k})


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
        elif b is not None and barred(s, on, c.get('at', '')):
            why = 'left out: ' + barred(s, on, c.get('at', ''))
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
                if barred(s, on, hit[0]):
                    report['dropped_cites'].append({'where': where, 'kind': l['kind'], 'source': s, 'on': on, 'why': 'left out: ' + barred(s, on, hit[0])})
                    continue
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
        local = s in LOCAL or s in ('tyndale-notes', 'catena-aurea')
        row = {'where': where, 'kind': l['kind'], **spec, 'quote': q, 'read_in': read_in,
               'fetched': TODAY if local else fetched_on(read_in),
               'fetched_how': 'quote re-found in the pinned copy' if local else 'page fetched during the checks'}
        if s in COPYRIGHTED:
            row['copyrighted'] = True
            if c.get('pointer'):
                row['pointer'] = c['pointer']
        if c.get('points_only'):
            row['points_only'] = True
        rows.append(row)
    if not cites:
        return None, []
    n = max(count_writers(cites), 1)
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


# Founder decision 15: no AI credit anywhere; the sources are named as sources.
SRC_LINE = 'Sources: the BSB, the Hebrew and Greek texts from STEPBible (Tyndale House, Cambridge), and the writers named under each note.'
