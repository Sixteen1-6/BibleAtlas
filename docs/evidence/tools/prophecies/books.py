import re

CANON = '/home/claude/bibleatlas/crates/atlas-core/src/canon.rs'
USFM = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV']

BOOKS = []
for m in re.finditer(r'book!\("([^"]*)", "([^"]*)", "([^"]*)", (\w+), (\w+), \[([^\]]*)\]\)', open(CANON).read()):
    osis, step, name, t, g, al = m.groups()
    BOOKS.append(dict(osis=osis, step=step, name=name, nt=(t == 'New'), aliases=re.findall(r'"([^"]*)"', al)))
assert len(BOOKS) == 66

KEY = {}
for i, b in enumerate(BOOKS):
    for k in [b['osis'], b['step'], b['name'], USFM[i]] + b['aliases']:
        KEY[re.sub(r'[\s.]', '', k.lower())] = i
# Forms the modules use that the canon does not list.
EXTRA = {'ps': 18, 'psa': 18, 'psalm': 18, 'mt': 39, 'mk': 40, 'lk': 41, 'jn': 42, 'joh': 42, 'ac': 43, 're': 65, 'rev': 65,
         'isa': 22, 'is': 22, 'jer': 23, 'eze': 25, 'ezek': 25, 'da': 26, 'ho': 27, 'joe': 28, 'am': 29, 'ob': 30, 'jon': 31,
         'mic': 32, 'na': 33, 'hab': 34, 'zep': 35, 'hag': 36, 'zec': 37, 'zech': 37, 'mal': 38, 'de': 4, 'le': 2, 'nu': 3,
         'ge': 0, 'ex': 1, 'jos': 5, 'jud': 6, 'jdg': 6, 'ru': 7, '1sa': 8, '2sa': 9, '1ki': 10, '2ki': 11, '1ch': 12, '2ch': 13,
         'ezr': 14, 'ne': 15, 'es': 16, 'job': 17, 'pr': 19, 'ec': 20, 'so': 21, 'song': 21, 'la': 24, 'ro': 44, '1co': 45,
         '2co': 46, 'ga': 47, 'eph': 48, 'php': 49, 'phil': 49, 'col': 50, '1th': 51, '2th': 52, '1ti': 53, '2ti': 54, 'tit': 55,
         'phm': 56, 'heb': 57, 'jas': 58, 'jam': 58, '1pe': 59, '2pe': 60, '1jo': 61, '1jn': 61, '2jo': 62, '3jo': 63, 'jude': 64}
for k, v in EXTRA.items():
    KEY.setdefault(k, v)


def book_of(s):
    return KEY.get(re.sub(r'[\s.]', '', s.lower()))


def name(b, c, v, c2=None, v2=None):
    s = f"{BOOKS[b]['name']} {c}:{v}"
    if v2 and (c2, v2) != (c, v):
        s += f"-{v2}" if c2 == c else f"-{c2}:{v2}"
    return s


def parse_target(t):
    """Refs in a {{ref:TARGET|...}} target: list of (book, c1, v1, c2, v2). Bare numbers are skipped."""
    out = []
    t = t.replace('Bible:', '')
    # OSIS: Book.c.v(-Book.c.v), space separated
    if re.match(r'^[1-3]?[A-Za-z]+\.\d', t):
        for part in t.split():
            m = re.match(r'^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?(?:-([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?)?$', part)
            if not m:
                continue
            b = book_of(m.group(1))
            if b is None:
                continue
            c1 = int(m.group(2)); v1 = int(m.group(3)) if m.group(3) else None
            c2 = int(m.group(5)) if m.group(5) else c1
            v2 = int(m.group(6)) if m.group(6) else v1
            out.append((b, c1, v1, c2, v2))
        return out
    # "De 28:7, Jos 5:1", "Heb 7:26", "1Ki 8:22,29"
    cur = None
    for part in re.split(r'[;,]\s*', t):
        m = re.match(r'^\s*([1-3]?\s?[A-Za-z]+)\.?\s+(\d+)(?::(\d+))?(?:-(\d+))?', part)
        if m and book_of(m.group(1)) is not None:
            b = book_of(m.group(1)); c = int(m.group(2)); v = int(m.group(3)) if m.group(3) else None
            v2 = int(m.group(4)) if m.group(4) else v
            cur = (b, c)
            out.append((b, c, v, c, v2))
            continue
        m = re.match(r'^\s*(\d+)(?:-(\d+))?\s*$', part)
        if m and cur:
            out.append((cur[0], cur[1], int(m.group(1)), cur[1], int(m.group(2) or m.group(1))))
    return out
