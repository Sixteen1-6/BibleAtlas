"""Shared helpers: BSB text by reference, and Nave's Topical Bible entries.

BSB text comes from the app's own build (web/public/data/text/<Book>.json).
Nave's comes from BradyStephenson/bible-data (CC BY 4.0), pinned copy.
"""
import csv, json, os, re, sys, glob

REPO = os.environ.get('ATLAS_REPO', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))
TEXT = os.environ.get('BSB_TEXT', os.path.join(REPO, 'web/public/data/text'))
NAVES = glob.glob(os.path.join(REPO, 'data/raw/bible-data@*/NavesTopicalDictionary.csv')) or \
    glob.glob(os.path.join(os.environ.get('ASK_WORK', '.'), 'scratchpad/dl/BradyStephenson_bible-data/NavesTopicalDictionary.csv'))

# osis, step code, full name, extra aliases
BOOKS = [l.split('|') for l in '''Gen|Gen|Genesis|gn ge
Exod|Exo|Exodus|ex exod
Lev|Lev|Leviticus|lv le
Num|Num|Numbers|nm nu
Deut|Deu|Deuteronomy|dt
Josh|Jos|Joshua|jsh
Judg|Jdg|Judges|jg
Ruth|Rut|Ruth|ru
1Sam|1Sa|1 Samuel|1sm
2Sam|2Sa|2 Samuel|2sm
1Kgs|1Ki|1 Kings|1kg
2Kgs|2Ki|2 Kings|2kg
1Chr|1Ch|1 Chronicles|1chron
2Chr|2Ch|2 Chronicles|2chron
Ezra|Ezr|Ezra|
Neh|Neh|Nehemiah|ne
Esth|Est|Esther|es
Job|Job|Job|jb
Ps|Psa|Psalms|psalm pss
Prov|Pro|Proverbs|pr prv
Eccl|Ecc|Ecclesiastes|ec qoh
Song|Sng|Song of Solomon|sos songofsongs
Isa|Isa|Isaiah|is
Jer|Jer|Jeremiah|je
Lam|Lam|Lamentations|la
Ezek|Ezk|Ezekiel|eze
Dan|Dan|Daniel|dn
Hos|Hos|Hosea|ho
Joel|Jol|Joel|jl
Amos|Amo|Amos|am
Obad|Oba|Obadiah|ob
Jonah|Jon|Jonah|jnh
Mic|Mic|Micah|mc
Nah|Nam|Nahum|na
Hab|Hab|Habakkuk|hb
Zeph|Zep|Zephaniah|zp
Hag|Hag|Haggai|hg
Zech|Zec|Zechariah|zc
Mal|Mal|Malachi|ml
Matt|Mat|Matthew|mt
Mark|Mrk|Mark|mk mr
Luke|Luk|Luke|lk
John|Jhn|John|jn joh
Acts|Act|Acts|ac
Rom|Rom|Romans|ro rm
1Cor|1Co|1 Corinthians|
2Cor|2Co|2 Corinthians|
Gal|Gal|Galatians|ga
Eph|Eph|Ephesians|
Phil|Php|Philippians|pp
Col|Col|Colossians|
1Thess|1Th|1 Thessalonians|1thes
2Thess|2Th|2 Thessalonians|2thes
1Tim|1Ti|1 Timothy|1tm
2Tim|2Ti|2 Timothy|2tm
Titus|Tit|Titus|
Phlm|Phm|Philemon|philem
Heb|Heb|Hebrews|
Jas|Jas|James|jm jam
1Pet|1Pe|1 Peter|1pt
2Pet|2Pe|2 Peter|2pt
1John|1Jn|1 John|1jo
2John|2Jn|2 John|2jo
3John|3Jn|3 John|3jo
Jude|Jud|Jude|
Rev|Rev|Revelation|re rv'''.split('\n')]

def _key(s): return re.sub(r'[^a-z0-9]', '', s.lower())
ALIAS = {}
for i, (o, st, name, extra) in enumerate(BOOKS):
    for a in [o, st, name] + extra.split():
        ALIAS[_key(a)] = i
for code, i in {'jud': 64, 'jude': 64, 'sng': 21, 'eze': 25, 'ezk': 25}.items(): ALIAS[code] = i

_text = {}
def chapters(b):
    if b not in _text:
        with open(os.path.join(TEXT, BOOKS[b][0] + '.json'), encoding='utf-8') as f:
            _text[b] = [[v[0] for v in ch] for ch in json.load(f)['chapters']]
    return _text[b]

def book_of(s):
    k = _key(s)
    if k in ALIAS: return ALIAS[k]
    # prefix of a full name ("Phili" is ambiguous; prefer exact list order)
    for i, (o, st, name, _) in enumerate(BOOKS):
        if _key(name).startswith(k) and len(k) >= 3: return i
    return None

REF = re.compile(r'^\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+))?(?:\s*[-–]\s*(\d+)(?:\s*[:.]\s*(\d+))?)?\s*$')

def parse(ref):
    """'John 11:25-26' -> [(book, ch, v), ...] inclusive verse list, or raises ValueError."""
    m = REF.match(ref)
    if not m: raise ValueError(f'cannot parse {ref!r}')
    b = book_of(m.group(1))
    if b is None: raise ValueError(f'unknown book in {ref!r}')
    chs = chapters(b)
    c1 = int(m.group(2)); v1 = m.group(3)
    a, z = m.group(4), m.group(5)
    if v1 is None:  # whole chapter(s)
        c2 = int(a) if a else c1
        start, end = (c1, 1), (c2, None)
    else:
        v1 = int(v1)
        if z is not None: start, end = (c1, v1), (int(a), int(z))
        elif a is not None: start, end = (c1, v1), (c1, int(a))
        else: start, end = (c1, v1), (c1, v1)
    out = []
    for c in range(start[0], end[0] + 1):
        if c < 1 or c > len(chs): raise ValueError(f'{ref!r}: {BOOKS[b][2]} has no chapter {c}')
        n = len(chs[c - 1])
        lo = start[1] if c == start[0] else 1
        hi = (end[1] if end[1] is not None else n) if c == end[0] else n
        if lo < 1 or hi > n or lo > hi: raise ValueError(f'{ref!r}: {BOOKS[b][2]} {c} has verses 1-{n}')
        out += [(b, c, v) for v in range(lo, hi + 1)]
    return out

def text(b, c, v): return chapters(b)[c - 1][v - 1]
def name(b, c, v): return f'{BOOKS[b][2]} {c}:{v}'

# ---------------------------------------------------------------- Nave's
def naves_rows():
    with open(NAVES[0], encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))

NAVE_REF = re.compile(r'\b([1-3]?[A-Z][A-Za-z]{1,3}) (\d)')

def split_line(line):
    """'-Called SLEEP DEU 31:16; JOB 7:21' -> (depth, label, refs-text)."""
    depth = 1 if line.startswith((' ', '\t')) else 0
    s = line.strip().lstrip('-').strip()
    m = None
    for mm in NAVE_REF.finditer(s):
        if book_of(mm.group(1)) is not None:
            m = mm; break
    if not m: return depth, s, ''
    return depth, s[:m.start()].strip().rstrip(','), s[m.start():]

def nave_refs(refs):
    """'EXO 6:16-20; JOS 21:4,10; 24' -> list of 'Exodus 6:16-20' style strings (unparseable pieces skipped)."""
    out, book = [], None
    for piece in re.split(r';|\bwith\b', refs):
        piece = piece.strip().rstrip('.')
        if not piece: continue
        m = re.match(r'^([1-3]?[A-Za-z]{2,4})\s+(.*)$', piece)
        if m and book_of(m.group(1)) is not None:
            book = book_of(m.group(1)); piece = m.group(2)
        if book is None: continue
        bn = BOOKS[book][2]
        chap = None
        for part in piece.split(','):
            part = part.strip()
            mm = re.match(r'^(\d+):(\d+)(?:-(\d+)(?::(\d+))?)?$', part)
            if mm:
                chap = int(mm.group(1))
                if mm.group(4): out.append(f'{bn} {chap}:{mm.group(2)}-{mm.group(3)}:{mm.group(4)}')
                elif mm.group(3): out.append(f'{bn} {chap}:{mm.group(2)}-{mm.group(3)}')
                else: out.append(f'{bn} {chap}:{mm.group(2)}')
                continue
            mm = re.match(r'^(\d+)(?:-(\d+))?$', part)
            if not mm: continue
            tail = f'-{mm.group(2)}' if mm.group(2) else ''
            if chap is not None: out.append(f'{bn} {chap}:{mm.group(1)}{tail}')
            else: out.append(f'{bn} {mm.group(1)}{tail}')
    return out

# ---------------------------------------------------------------- verse numbers
_starts = []
def index(b, c, v):
    """The app's verse number (line of bsb.txt) for a BSB verse."""
    if not _starts:
        n = 0
        for bb in range(66):
            row = []
            for ch in chapters(bb):
                row.append(n); n += len(ch)
            _starts.append(row)
    return _starts[b][c - 1] + v - 1

def where(i):
    """The (book, chapter, verse) of an app verse number."""
    index(0, 1, 1)
    for b in range(65, -1, -1):
        if _starts[b][0] <= i:
            for c in range(len(_starts[b]) - 1, -1, -1):
                if _starts[b][c] <= i: return b, c + 1, i - _starts[b][c] + 1
