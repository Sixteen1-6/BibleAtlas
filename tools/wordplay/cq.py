#!/usr/bin/env python3
"""Print what Bible-believing commentaries say on a verse, from local copies.

  python3 cq.py <work> "<ref>"            the comment on that verse
  python3 cq.py all "<ref>"               every work, each cut to 2500 characters
  python3 cq.py check <work> "<ref>" "<quote>"   is the quote verbatim there? (exit 0/1)

Works: gill, clarke, barnes, jfb, kad (Keil and Delitzsch, Old Testament only),
mhcc (Matthew Henry's Concise), mhc (Matthew Henry's complete commentary), calvin (Calvin's
commentaries), geneva (the Geneva Bible notes), wesley (Wesley's Notes), cb (Bullinger's
Companion Bible notes), fos (Bullinger's Figures of Speech). SOURCE maps each
to its id on the Layers cite list (config/layer-sources.json).
gill, clarke, barnes, jfb and kad come from sacred-texts.com's copies as kept in
github.com/jonnyg23/mahabrain (MIT) at the commit below; cb and fos from the
UniqueBible repositories below. url(work, ref) gives the address to cite as
where the quote was read.
"""
import html, json, re, sqlite3, sys, unicodedata

ROOT = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
VAULT = f'{ROOT}/src/mb/sacred_obsidian_vault/bib/cmt'
MB_SHA = 'b00aa504cf9a7fb368a040b97ebe9cafca950489'
CB_URL = 'https://raw.githubusercontent.com/otseng/UniqueBible_Commentaries/4b77d8610928e2451101331ed46465088678a655/cCBNotes%20-%20The%20Companion%20Bible%20Notes.commentary.zip'
FOS_URL = 'https://raw.githubusercontent.com/darrelwright/UniqueBible_Books/4017a67481e0de6027216bbdf3fc5d42c9c289d5/Bullinger%20-%20Figures%20of%20Speach.book.zip'

BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
         '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
         'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
         'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
         'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
         'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
         'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']
ST = ['gen', 'exo', 'lev', 'num', 'deu', 'jos', 'jdg', 'rut', 'sa1', 'sa2', 'kg1', 'kg2', 'ch1', 'ch2', 'ezr', 'neh', 'est',
      'job', 'psa', 'pro', 'ecc', 'sol', 'isa', 'jer', 'lam', 'eze', 'dan', 'hos', 'joe', 'amo', 'oba', 'jon', 'mic', 'nah',
      'hab', 'zep', 'hag', 'zac', 'mal', 'mat', 'mar', 'luk', 'joh', 'act', 'rom', 'co1', 'co2', 'gal', 'eph', 'phi', 'col',
      'th1', 'th2', 'ti1', 'ti2', 'tit', 'plm', 'heb', 'jam', 'pe1', 'pe2', 'jo1', 'jo2', 'jo3', 'jde', 'rev']
FOS = ['Gen', 'Exo', 'Lev', 'Num', 'Deu', 'Jos', 'Jdg', 'Rut', '1Sa', '2Sa', '1Ki', '2Ki', '1Ch', '2Ch', 'Ezr', 'Neh', 'Est',
       'Job', 'Psa', 'Pro', 'Ecc', 'Son', 'Isa', 'Jer', 'Lam', 'Eze', 'Dan', 'Hos', 'Joe', 'Amo', 'Oba', 'Jon', 'Mic', 'Nah',
       'Hab', 'Zep', 'Hag', 'Zec', 'Mal', 'Mat', 'Mar', 'Luk', 'Joh', 'Act', 'Rom', '1Co', '2Co', 'Gal', 'Eph', 'Phi', 'Col',
       '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jas', '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jud', 'Rev']
VAULT_WORKS = ['gill', 'clarke', 'barnes', 'jfb', 'kad']
LC_WORKS = ['mhcc', 'wesley', 'mhc', 'calvin', 'geneva']
WORKS = VAULT_WORKS + LC_WORKS + ['cb', 'fos']
SOURCE = {'gill': 'gill', 'clarke': 'clarke', 'barnes': 'barnes', 'jfb': 'jfb', 'kad': 'keil-delitzsch',
          'mhcc': 'henry-concise', 'wesley': 'wesley', 'cb': 'companion-bible', 'fos': 'bullinger-fos',
          'mhc': 'henry', 'calvin': 'calvin', 'geneva': 'geneva'}
LC_BOOKS = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV']
LC_SHA = '71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239'
LC_DIR = '/home/claude/bibleatlas/data/raw/lets.church@71f6f0fc8f/packages/lets.bible/seed/commentaries'
# Henry's complete commentary, Calvin's commentaries and the Geneva notes: the same Let's Church folder at the same
# commit (byte-identical to the files there, checked 2026-10-22), kept beside these tools.
LC_EXTRA = {'mhc', 'calvin', 'geneva'}
LC_EXTRA_DIR = f'{ROOT}/src/lc'


def parse(ref):
    m = re.match(r'^\s*(.+?)\s+(\d+):(\d+)', ref)
    if not m:
        raise SystemExit(f'cannot read reference {ref!r}')
    name = m.group(1).strip().lower().replace('psalm ', 'psalms ')
    if name == 'psalm':
        name = 'psalms'
    if name in ('song of songs', 'song'):
        name = 'song of solomon'
    for i, b in enumerate(BOOKS):
        if b.lower() == name:
            return i, int(m.group(2)), int(m.group(3))
    raise SystemExit(f'unknown book in {ref!r}')


def clean(h):
    h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'\s+', ' ', html.unescape(h)).strip()


def vault(work, b, c, v):
    if work == 'kad' and b > 38:
        return None
    path = f'{VAULT}/{work}/{ST[b]}{c:03d}.md'
    try:
        s = open(path, encoding='utf-8', errors='replace').read()
    except FileNotFoundError:
        return None
    marks = [(m.start(), int(m.group(2)), int(m.group(3))) for m in
             re.finditer(r'<a name="an_\d+">([a-z0-9]+) (\d+):(\d+)</a>', s)]
    if not marks:
        return None
    # The section that holds v: the last mark at or before it (K&D comment on runs of verses).
    pick = None
    for k, (pos, mc, mv) in enumerate(marks):
        if (mc, mv) <= (c, v):
            pick = k
    if pick is None:
        return None
    start = marks[pick][0]
    end = marks[pick + 1][0] if pick + 1 < len(marks) else len(s)
    span = f'{ST[b]} {marks[pick][1]}:{marks[pick][2]}'
    return span, clean(s[start:end])


_cb = None


def cb(b, c, v):
    global _cb
    if _cb is None:
        con = sqlite3.connect(f'{ROOT}/src/cb/cCBNotes.commentary')
        _cb = {}
        for bk, ch, h in con.execute('select Book, Chapter, Scripture from Commentary'):
            # key each note by its own label (bcv), not by the verse anchors stacked before it
            parts = re.split(r'<ref onclick="bcv\((\d+),(\d+),(\d+)\)">', h)
            for i in range(1, len(parts), 4):
                key = (int(parts[i]) - 1, int(parts[i + 1]), int(parts[i + 2]))
                _cb.setdefault(key, []).append(clean(parts[i + 3]))
    t = _cb.get((b, c, v))
    return (f'{BOOKS[b]} {c}:{v}', ' '.join(t)) if t else None


FOS_EX = re.compile(r'^ ?(?:[1-3]?[A-Z][a-z]{1,2}) \d+:\d+')


def fos_end(lines, i):
    """End of the remark that starts at line i: the next example, heading or division, at most 15 lines on."""
    for j in range(i + 1, min(len(lines), i + 15)):
        if FOS_EX.match(lines[j]) or lines[j].startswith('########') or re.match(r'^ ?[A-Z][^ ]*[;:] or, ', lines[j]):
            return j
    return min(len(lines), i + 15)


def fos(b, c, v):
    lines = open(f'{ROOT}/fos.txt', encoding='utf-8').read().replace('\r', '').split('\n')
    pat = re.compile(rf'(?<![\w]){re.escape(FOS[b])} {c}:{v}(?!\d)')
    out, heading = [], ''
    for i, l in enumerate(lines):
        if l.startswith('########'):
            heading = l.strip('# ').strip()
        if pat.search(l):
            body = ' '.join(x.strip() for x in lines[i:fos_end(lines, i)] if x.strip())
            out.append(f'[{heading}] {body}')
    return (f'{FOS[b]} {c}:{v}', '\n'.join(out)) if out else None


_lc = {}


def lc(work, b, c, v):
    if work not in _lc:
        d = json.load(open(f'{LC_EXTRA_DIR if work in LC_EXTRA else LC_DIR}/{work}.json', encoding='utf-8'))['entries']
        _lc[work] = (LC_BOOKS, d)
    order, d = _lc[work]
    if len(order) != 66:
        raise SystemExit(f'{work}: expected 66 books, found {len(order)}')
    code = order[b]
    rows = [e for e in d if e['book'] == code and (e['chapter'], e['verse']) <= (c, v)]
    if not rows:
        return None
    e = max(rows, key=lambda e: (e['chapter'], e['verse']))
    return f"{BOOKS[b]} {e['chapter']}:{e['verse']}", re.sub(r'\s+', ' ', e['body']).strip()


def get(work, ref):
    b, c, v = parse(ref)
    if work in VAULT_WORKS:
        return vault(work, b, c, v)
    if work in LC_WORKS:
        return lc(work, b, c, v)
    if work == 'cb':
        return cb(b, c, v)
    if work == 'fos':
        return fos(b, c, v)
    raise SystemExit(f'unknown work {work!r}')


def url(work, ref):
    b, c, v = parse(ref)
    if work in VAULT_WORKS:
        return f'https://raw.githubusercontent.com/jonnyg23/mahabrain/{MB_SHA}/sacred_obsidian_vault/bib/cmt/{work}/{ST[b]}{c:03d}.md'
    if work in LC_WORKS:
        name = work
        return f'https://raw.githubusercontent.com/LetsChurch/lets.church/{LC_SHA}/packages/lets.bible/seed/commentaries/{name}.json'
    return CB_URL if work == 'cb' else FOS_URL


def norm(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    s = s.replace('—', '-').replace('–', '-')
    return re.sub(r'\s+', ' ', s).strip().lower()


def units(work, ref):
    """The separate sections a quote may come from: one per Figures of Speech mention, one per Companion Bible note."""
    r = get(work, ref)
    if not r:
        return []
    if work == 'fos':
        return r[1].split('\n')
    if work == 'cb':
        b, c, v = parse(ref)
        return _cb.get((b, c, v), [])
    return [r[1]]


def check(work, ref, quote):
    """True if the quote's parts (joined by ...) occur in order within ONE section."""
    parts = [p for p in re.split(r'\s*(?:\.\.\.|…)\s*', quote) if p.strip()]
    for u in units(work, ref):
        text, at, ok = norm(u), 0, True
        for p in parts:
            i = text.find(norm(p), at)
            if i < 0:
                ok = False
                break
            at = i + len(norm(p))
        if ok:
            return True
    return False


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'check':
        ok = check(a[1], a[2], a[3])
        print('verbatim' if ok else 'NOT FOUND')
        sys.exit(0 if ok else 1)
    if len(a) != 2:
        raise SystemExit(__doc__)
    works = WORKS if a[0] == 'all' else [a[0]]
    for w in works:
        r = get(w, a[1])
        if not r:
            print(f'== {w}: nothing on {a[1]}')
            continue
        t = r[1] if a[0] != 'all' else r[1][:2500] + (' [...]' if len(r[1]) > 2500 else '')
        print(f'== {w} (section {r[0]}; {url(w, a[1])})\n{t}\n')
