#!/usr/bin/env python3
"""pointers.py: find pointed cross-references in the local commentaries (founder decision 9, 2026-10-20:
"The see [quote] is fine": a writer's pointed cross-reference such as "See Gen. 3. 19" counts toward a note).

scan(anchor, targets) looks in each local work's remark on the anchor verse for a reference to one of the target
passages and returns candidates with a verbatim snippet around it. A reference inside a run of five or more
references is marked crowded (it does not point). Candidates still go to a checker: this only finds them."""
import re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq

NAMES = cq.BOOKS
_A = {}


def _add(i, *names):
    for n in names:
        _A[n.lower().replace(' ', '')] = i


for i, n in enumerate(NAMES):
    _add(i, n)
for i, c in enumerate(cq.LC_BOOKS):
    _add(i, c)
VAULT = 'Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Son Isa Jer Lam Eze Dan Hos Joe Amo Oba Jon Mic Nah Hab Zep Hag Zec Mal Mat Mar Luk Joh Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jo 2Jo 3Jo Jud Rev'.split()
for i, c in enumerate(VAULT):
    _add(i, c)
MORE = {
    0: 'Ge Gn', 1: 'Ex Exod', 2: 'Le Lv', 3: 'Nu Nm Numb', 4: 'Dt Deut', 5: 'Josh', 6: 'Judg Jdgs', 7: 'Ru',
    8: '1Sam 1Sm ISam', 9: '2Sam 2Sm IISam', 10: '1Kgs 1Kings IKings', 11: '2Kgs 2Kings IIKings', 12: '1Chr 1Chron', 13: '2Chr 2Chron',
    14: 'Ezra', 15: 'Ne', 16: 'Esth Es', 18: 'Ps Pss Psalm Psal', 19: 'Prov Pr Prv', 20: 'Eccl Eccles Ec Qoh',
    21: 'Song Cant SongofSongs SoS', 22: 'Is', 23: 'Je Jerem', 25: 'Ezek Ez', 26: 'Dn Da', 27: 'Ho', 28: 'Joel Jl',
    29: 'Am', 30: 'Ob Obad', 31: 'Jonah Jnh', 32: 'Mi', 33: 'Na', 34: 'Hb', 35: 'Zeph Zp', 36: 'Hg', 37: 'Zech Zc',
    38: 'Ml', 39: 'Mt Matt', 40: 'Mk Mrk Mr', 41: 'Lk Lu', 42: 'Jn Jhn John', 43: 'Ac Acts', 44: 'Ro Rm',
    45: '1Cor ICor', 46: '2Cor IICor', 47: 'Ga', 48: 'Ephes', 49: 'Phil Philip', 50: 'Col', 51: '1Thess 1Thes', 52: '2Thess 2Thes',
    53: '1Tim', 54: '2Tim', 55: 'Titus', 56: 'Philem Phlm', 57: 'He Hebr', 58: 'Jam Jms', 59: '1Pet 1Pt', 60: '2Pet 2Pt',
    61: '1John 1Jn', 62: '2John 2Jn', 63: '3John 3Jn', 64: 'Jude Jd', 65: 'Re Rv Revel Apoc',
}
for i, s in MORE.items():
    _add(i, *s.split())

REF = re.compile(r'\b((?:[123]|I{1,3})\s?[A-Z][a-z]{0,6}|[A-Z][a-z]{1,7})\.?\s+(\d{1,3})\s?[:.]\s?(\d{1,3})(?:\s?[-–]\s?(\d{1,3})(?![:.]\d))?')


def refs_in(text):
    """[(start, end, book, chapter, v1, v2)] for each Bible reference in text."""
    out = []
    for m in REF.finditer(text):
        key = m.group(1).replace(' ', '').lower()
        if key not in _A:
            continue
        v1 = int(m.group(3))
        v2 = int(m.group(4)) if m.group(4) else v1
        out.append((m.start(), m.end(), _A[key], int(m.group(2)), v1, max(v1, v2)))
    return out


def parse_target(ref):
    """'Isaiah 14:12' or 'Isaiah 14:12-15' -> (book, chapter, v1, v2)."""
    m = re.match(r'^\s*(.+?)\s+(\d+):(\d+)(?:-(\d+))?', ref)
    if not m:
        return None
    key = m.group(1).replace(' ', '').lower()
    if key not in _A:
        return None
    v1 = int(m.group(3))
    return (_A[key], int(m.group(2)), v1, int(m.group(4)) if m.group(4) else v1)


def hits(r, t):
    return r[2] == t[0] and r[3] == t[1] and not (r[5] < t[2] or r[4] > t[3])


def run_size(text, refs, k):
    """How many references sit in the same run as refs[k] (joined only by commas, semicolons, 'and', 'compare' etc.)."""
    n, i = 1, k
    while i > 0 and re.fullmatch(r'[\s,;&()\[\]]*(?:and|cf\.?|comp\.?|compare|see|also|with)?[\s,;&()\[\]]*', text[refs[i - 1][1]:refs[i][0]], re.I):
        n, i = n + 1, i - 1
    i = k
    while i + 1 < len(refs) and re.fullmatch(r'[\s,;&()\[\]]*(?:and|cf\.?|comp\.?|compare|see|also|with)?[\s,;&()\[\]]*', text[refs[i][1]:refs[i + 1][0]], re.I):
        n, i = n + 1, i + 1
    return n


def snippet(text, a, b, hi=340):
    """A verbatim piece of text around the reference [a, b): from the start of its sentence (or of the clause
    before it, at most 220 characters back) to the end of its sentence (at most 120 characters on), within hi."""
    s0 = max(0, a - 220)
    starts = [s0 + m.end() for m in re.finditer(r'(?<=[.?!])\s+(?=[A-Z"(])', text[s0:a])]
    s = starts[-1] if starts else s0
    if s == s0 and s0 > 0:
        sp = text.find(' ', s0)
        s = sp + 1 if 0 <= sp < a else s0
    if a - s < 30 and starts:
        s = starts[-2] if len(starts) > 1 else max(0, s0)
    m = re.search(r'[.?!](?=\s|$)', text[b:b + 120])
    e = b + m.end() if m else min(len(text), b + 60)
    if e - s > hi:
        s = max(s, e - hi)
        sp = text.find(' ', s)
        s = sp + 1 if 0 <= sp < a else s
    return text[s:e].strip()


WORKS = ['gill', 'clarke', 'barnes', 'jfb', 'kad', 'mhcc', 'wesley', 'cb']
CITE_ID = {'kad': 'keil-delitzsch', 'mhcc': 'henry-concise', 'cb': 'bullinger-cb'}


def scan(anchor, targets, works=WORKS):
    """Candidates: a local work's remark on anchor names one of targets."""
    ts = [t for t in (parse_target(x) for x in targets) if t]
    out = []
    for w in works:
        try:
            r = cq.get(w, anchor)
        except SystemExit:
            continue
        if not r:
            continue
        on, text = r[0], r[1]
        refs = refs_in(text)
        for k, x in enumerate(refs):
            for t, raw in zip(ts, targets):
                if hits(x, t):
                    out.append({'work': w, 'source': CITE_ID.get(w, w), 'on': on if isinstance(on, str) and ':' in on else anchor,
                                'target': raw, 'found': text[x[0]:x[1]], 'run': run_size(text, refs, k),
                                'snippet': snippet(text, x[0], x[1])})
    return out


if __name__ == '__main__':
    import json
    print(json.dumps(scan(sys.argv[1], sys.argv[2:]), ensure_ascii=False, indent=1))
