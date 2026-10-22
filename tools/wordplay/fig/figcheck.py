#!/usr/bin/env python3
"""figcheck.py: check figure, parallelism and contrast notes the way the build does
(crates/atlas-cli/src/extra_figures.rs on the branch figures-at-deep), plus this thread's citation rules.

  python3 -I figcheck.py <file.json> [...]          file holds {"notes": [...]} or a list of notes
  python3 -I figcheck.py --quotes <file.json> [...]  also checks every quote from a local copy word for word

Prints each problem as "<note id>: <problem>" and exits 1 when there is any. A note's book is the book of its
ref (the build takes it from the file name, config/figures/<OSIS>.json).
"""
import json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
WP = os.path.dirname(HERE)
DATA = f'{WP}/stable_data'
FORMS = json.load(open(f'{HERE}/config/figure-forms.json'))
SOURCES = json.load(open(f'{HERE}/config/layer-sources.json'))

KINDS = ['parallelism', 'figure', 'contrast']
WIDELY, COMMONLY, SOME = 'widely agreed', 'commonly held', 'some interpreters'
CREDITS = ['drafted with', 'not yet reviewed by a person', 'ai drafted', 'ai assisted', 'ai generated', 'ai written',
           'ai help', 'ai helped', 'ai reviewer', 'ai session', 'ai model', 'ai tool', 'language model', 'anthropic',
           'openai']
WRITERS = ['Henry', 'Gill', 'Barnes', 'Jamieson', 'Fausset', 'Keil', 'Delitzsch', 'Ellicott', 'Benson', 'Poole',
           'Calvin', 'Clarke', 'Wesley', 'Bengel', 'Maclaren', 'Spurgeon', 'Chrysostom', 'Edersheim', 'Bullinger',
           'Beale', 'Woudstra', 'Leithart', 'Keener', 'Easton', "Strong's", 'Augustine', 'Jerome', 'Irenaeus',
           'Origen', 'Aquinas', 'Luther']
SHORT_MAX, TEXT_MAX, EVIDENCE_MAX, QUOTE_MAX, LABEL_MAX, MEANS_MAX, AT_MAX, READ_MAX = 52, 300, 400, 400, 40, 160, 120, 200
QUOTE_MIN_WORDS = 4

# This thread's rules, beyond the build's (CLAUDE.md, founder decisions 2 and 20, the voices shortlist, the Layers
# thread's notes of 2026-10-22).
BARRED_BOOKS = {
    ('ellicott', 'Psalms'): "A. S. Aglen wrote Ellicott's Psalms (founder decision 20)",
    ('ellicott', 'Song of Solomon'): "A. S. Aglen wrote Ellicott's Song of Solomon (founder decision 20)",
    ('ellicott', 'Obadiah'): "A. S. Aglen wrote Ellicott's Obadiah (founder decision 20)",
    ('ellicott', 'Jonah'): "A. S. Aglen wrote Ellicott's Jonah and calls it possibly fiction (founder decision 20)",
    ('ellicott', 'Ecclesiastes'): "Ellicott's Ecclesiastes says Solomon did not write it",
    ('keil-delitzsch', 'Ecclesiastes'): 'Delitzsch holds that Solomon did not write Ecclesiastes',
    ('pulpit', 'Ecclesiastes'): "the Pulpit's Ecclesiastes holds that a later writer took Solomon's part",
    ('pulpit', 'Jeremiah'): 'the Pulpit Commentary is never cited on Jeremiah',
    ('pulpit', 'Lamentations'): 'the Pulpit Commentary is never cited on Lamentations',
    ('barnes', 'Genesis'): "the Barnes text on Genesis is James G. Murphy's commentary; cite another writer",
}
BARRED_VERSES = {
    ('calvin', 'Matthew', 27, 9): 'Calvin calls the name Jeremiah a mistake',
    ('calvin', 'Acts', 7, 14): 'Calvin puts the number down to copyists',
    ('calvin', 'Acts', 7, 16): 'Calvin calls the name Abraham a fault',
    ('keil-delitzsch', 'Psalms', 74, 4): 'Delitzsch favours a Maccabean date against the title',
    ('keil-delitzsch', 'Psalms', 86, 1): 'Delitzsch denies David wrote the psalm his title names',
    ('keil-delitzsch', 'Psalms', 130, 1): 'Delitzsch denies the title',
    ('pulpit', '2 Corinthians', 3, 7): "Farrar calls Paul's words a traditional legend",
}
BARRED_FATHERS = ['origen', 'didymus', 'theodore of mopsuestia', 'pelagius', 'arius', 'nestorius', 'apollinaris',
                  'evagrius', 'tatian', 'novatian', 'tertullian', 'theodoret', 'hippolytus', 'victorinus',
                  'clement of alexandria', 'eusebius', 'gloss']

# --- the BSB --------------------------------------------------------------------------------------------------
META = json.load(open(f'{DATA}/meta.json'))
BOOKS = META['books']
LEM = json.load(open(f'{DATA}/lemmas.json'))['key']
ALIAS = {}


def squash(s):
    return ''.join(c for c in s.lower() if c.isalnum())


for i, b in enumerate(BOOKS):
    for n in (b['name'], b['osis'], b['step']):
        ALIAS[squash(n)] = i
ALIAS['psalm'] = ALIAS['psalms']
ALIAS['songofsongs'] = ALIAS['song'] = ALIAS[squash('Song of Solomon')]
START = []
_n = 0
for b in BOOKS:
    START.append(_n)
    _n += sum(b['chapters'])
_text = {}


def chapters(bi):
    o = BOOKS[bi]['osis']
    if o not in _text:
        _text[o] = json.load(open(f'{DATA}/text/{o}.json'))['chapters']
    return _text[o]


def index(bi, c, v):
    return START[bi] + sum(BOOKS[bi]['chapters'][:c - 1]) + v - 1


def locate(ix):
    for bi in range(len(BOOKS) - 1, -1, -1):
        if ix >= START[bi]:
            r = ix - START[bi]
            for c, n in enumerate(BOOKS[bi]['chapters'], 1):
                if r < n:
                    return bi, c, r + 1
                r -= n
    return None


def verse_text(ix):
    bi, c, v = locate(ix)
    return chapters(bi)[c - 1][v - 1][0]


def verse_words(ix):
    bi, c, v = locate(ix)
    return chapters(bi)[c - 1][v - 1][1]


REF = re.compile(r'^\s*(.+?)\s+(\d+)(?:[:.](\d+))?(?:\s*[-–—]\s*(\d+)(?:[:.](\d+))?)?\s*$')


def resolve(r):
    """(first, last) verse indices, or None."""
    m = REF.match(r or '')
    if not m:
        return None
    bi = ALIAS.get(squash(m.group(1)))
    if bi is None:
        return None
    ch = BOOKS[bi]['chapters']
    c1 = int(m.group(2))
    if not 1 <= c1 <= len(ch):
        return None
    if m.group(3) is None:  # whole chapter(s): "Psalm 1", "Psalm 1-2"
        c2 = int(m.group(4)) if m.group(4) else c1
        if m.group(5) or not c1 <= c2 <= len(ch):
            return None
        return index(bi, c1, 1), index(bi, c2, ch[c2 - 1])
    v1 = int(m.group(3))
    if not 1 <= v1 <= ch[c1 - 1]:
        return None
    if m.group(4) is None:
        c2, v2 = c1, v1
    elif m.group(5) is None:
        c2, v2 = c1, int(m.group(4))
    else:
        c2, v2 = int(m.group(4)), int(m.group(5))
    if not (1 <= c2 <= len(ch) and 1 <= v2 <= ch[c2 - 1]) or (c2, v2) < (c1, v1):
        return None
    return index(bi, c1, v1), index(bi, c2, v2)


# --- text helpers, as extra_figures.rs has them -------------------------------------------------------------
def normalize(s):
    out = []
    for c in s:
        if c.isalnum():
            out.append(c.lower())
        elif (c.isspace() or c in '—–') and out and out[-1] != ' ':
            out.append(' ')
    return ''.join(out).rstrip(' ')


def parts(s):
    return [p for p in (normalize(x) for x in s.replace('...', '…').split('…')) if p]


def word_count(q):
    return sum(len(p.split(' ')) for p in parts(q))


def contains(text, quote):
    ps = parts(quote)
    if not ps:
        return False
    text = f' {text} '
    at = 0
    for p in ps:
        needle = f' {p} '
        i = text.find(needle, at)
        if i < 0:
            return False
        at = i + len(needle) - 1
    return True


def quotes(t):
    spans, start = [], None
    for i, c in enumerate(t):
        if c in '"“' and start is None:
            start = i + 1
        elif c in '"”' and start is not None:
            spans.append(t[start:i])
            start = None
        elif c == '“':
            raise ValueError('an opening quotation mark inside a quotation')
        elif c == '”':
            raise ValueError('a closing quotation mark with no opening one')
    if start is not None:
        raise ValueError('a quotation is never closed')
    return spans


def find_all(t, w):
    out, i = [], t.find(w)
    while w and i >= 0:
        out.append(i)
        i = t.find(w, i + len(w))
    return out


def whole_words(t, w):
    return [i for i in find_all(t, w)
            if not (i > 0 and t[i - 1].isalnum()) and not (i + len(w) < len(t) and t[i + len(w)].isalnum())]


def names(text, part):
    return any(not (i > 0 and text[i - 1].isalnum()) for i in find_all(text, part))


def names_word(text, part):
    return bool(whole_words(text, part))


def pair_line(lines, w):
    if not w.strip():
        return None
    hits = [k for k, t in enumerate(lines) for _ in whole_words(t, w)]
    return hits[0] if len(hits) == 1 else None


def mark_ok(m):
    return bool(re.fullmatch(r"[A-Z]'?", m or ''))


def mirror_ok(marks):
    n = len(marks)
    half = marks[:n // 2]
    return (n >= 2 and len(set(half)) == len(half) and all(not m.endswith("'") for m in half)
            and all(marks[n - 1 - k] == marks[k] + "'" for k in range(n // 2))
            and (n % 2 == 0 or (not marks[n // 2].endswith("'") and marks[n // 2] not in half)))


def turns_ok(marks):
    n = len(marks)
    half = marks[:n // 2]
    return (n >= 4 and n % 2 == 0 and len(set(half)) == len(half) and all(not m.endswith("'") for m in half)
            and all(marks[n // 2 + k] == marks[k] + "'" for k in range(n // 2)))


def strong_ok(s):
    return bool(re.fullmatch(r'[HG]\d{4}', s or ''))


def lemma_matches(key, strong):
    return key == strong or (len(key) == len(strong) + 1 and key.startswith(strong) and key[-1].isalpha())


def credit(s):
    words = [w for w in re.split(r'[^\w]|_', s) if w]
    if 'AI' in words:
        return 'AI'
    lower = [w.lower() for w in words]
    if any(w.startswith('claude') for w in lower):
        return 'Claude'
    run = f" {' '.join(lower)} "
    return next((p for p in CREDITS if f' {p} ' in run), None)


def mentions_esv(s):
    return any(w.lower() == 'esv' for w in re.split(r'[^\w]|_', s))


def date_ok(s):
    m = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})', s or '')
    return bool(m) and 1 <= int(m.group(2)) <= 12 and 1 <= int(m.group(3)) <= 31


def strength_for(n):
    return SOME if n <= 1 else COMMONLY if n == 2 else WIDELY


# --- the checker ------------------------------------------------------------------------------------------------
CITE = {s['id']: s for s in SOURCES['cite']}
WRITER = {}
for group in FORMS['same_writer']:
    for i in group:
        WRITER[i] = group[0]
QUOTABLE = set(FORMS['quotable'])
FORM = {f['id']: f for f in FORMS['forms']}
WRITER_NAMES = [(s['name'][4:] if s['name'].startswith('the ') else s['name']) for s in SOURCES['cite'] if s['id'] != 'bsb']
WRITER_NAMES += WRITERS


class Check:
    def __init__(self, local=False):
        self.errors = []
        self.local = local

    def fail(self, at, msg):
        self.errors.append(f'{at}: {msg}')

    def clean(self, at, field, s):
        if mentions_esv(s):
            self.fail(at, f'{field} mentions the ESV')
        p = credit(s)
        if p:
            self.fail(at, f'{field} says {p!r}: no field credits a drafting tool')
        for a in SOURCES['avoid']:
            n = next((n for n in a['match'] if names(s, n)), None)
            if n:
                self.fail(at, f"{field} names {n!r} ({a['name']}), which may not be cited")

    def text(self, at, field, s, mx):
        if not isinstance(s, str) or not s.strip():
            self.fail(at, f'{field} is empty')
            return
        if len(s) > mx:
            self.fail(at, f'{field} is {len(s)} characters; keep it to {mx}')
        if '—' in s:
            self.fail(at, f'{field} has an em dash (house style)')
        self.clean(at, field, s)

    def dash(self, at, field, s):
        try:
            outside = re.sub(r'["\u201c][^"\u201d]*["\u201d]', '', s or '')
        except re.error:
            outside = s or ''
        if '\u2014' in outside:
            self.fail(at, f'{field} has an em dash outside a quotation (house style)')

    def own_words(self, at, field, s, mx):
        self.text(at, field, s, mx)
        self.dash(at, field, s)
        n = next((n for n in WRITER_NAMES if isinstance(s, str) and names_word(s, n)), None)
        if n:
            self.fail(at, f"{field} names {n!r}; a note's own words name no writer, so say it in evidence")

    def range(self, at, r):
        x = resolve(r)
        if x is None:
            self.fail(at, f'reference {r!r} does not name verses in the BSB')
        return x

    def verse(self, at, r, within):
        x = self.range(at, r)
        if not x:
            return None
        if x[0] != x[1]:
            self.fail(at, f'{r!r} must name one verse')
            return None
        if within and not within[0] <= x[0] <= within[1]:
            self.fail(at, f"{r!r} is outside the note's own verses")
            return None
        return x[0]

    def find_once(self, at, v, words):
        t = verse_text(v)
        hits = find_all(t, words) if isinstance(words, str) and words.strip() else []
        if len(hits) == 1:
            return hits[0]
        if len(hits) > 1:
            self.fail(at, f'{words!r} occurs more than once in the verse; quote more of it')
        else:
            self.fail(at, f'{words!r} is not the BSB text of the verse ({verse_text(v)!r})')
        return None

    def note(self, n, seen_ids):
        nid = n.get('id', '?')
        at = f'note {nid!r}'
        for k in ('id', 'kind', 'form', 'ref', 'strength', 'short', 'about', 'evidence', 'checked', 'cites'):
            if k not in n:
                self.fail(at, f'{k} is missing')
        allowed = {'id', 'kind', 'form', 'ref', 'strength', 'short', 'about', 'refs', 'lines', 'pairs', 'figure',
                   'sides', 'defined', 'original', 'evidence', 'limit', 'checked', 'cites'}
        for k in n:
            if k not in allowed:
                self.fail(at, f'unknown field {k!r}')
        if not re.fullmatch(r'[a-z0-9-]+', nid or ''):
            self.fail(at, 'id must be lowercase letters, digits and hyphens')
        if nid in seen_ids:
            self.fail(at, 'id is used by an earlier note')
        seen_ids.add(nid)
        kind = n.get('kind')
        if kind not in KINDS:
            self.fail(at, f'kind {kind!r} is not one of: {", ".join(KINDS)}')
            return
        f = FORM.get(n.get('form'))
        if not f:
            self.fail(at, f"form {n.get('form')!r} is not in figure-forms.json")
        elif f['kind'] != kind:
            self.fail(at, f"form {n['form']!r} is a {f['kind']} form, not a {kind} one")
        self.own_words(at, 'short', n.get('short'), SHORT_MAX)
        self.own_words(at, 'about', n.get('about'), TEXT_MAX)
        self.text(at, 'evidence', n.get('evidence'), EVIDENCE_MAX)
        self.dash(at, 'evidence', n.get('evidence'))
        if 'limit' in n:
            self.own_words(at, 'limit', n['limit'], TEXT_MAX)
        if not date_ok(n.get('checked')):
            self.fail(at, f"checked {n.get('checked')!r} must be a date, as 2026-10-21")
        own = self.range(at, n.get('ref'))
        if own:
            b, c, _ = locate(own[0])
            if locate(own[1])[1] != c or locate(own[1])[0] != b:
                self.fail(at, f"{n['ref']!r} crosses a chapter; a note sits in one chapter")
        refs = [self.range(at, r) for r in n.get('refs', [])]

        lines, last = n.get('lines', []), None
        for i, l in enumerate(lines):
            lat = f'{at}, lines[{i}]'
            v = self.verse(lat, l.get('ref'), own) if own else None
            if v is None:
                continue
            off = self.find_once(lat, v, l.get('words'))
            if off is None:
                continue
            if last and (v, off) < last:
                self.fail(lat, 'lines must be in reading order and must not overlap')
            last = (v, off + len(l['words']))
            if 'key' in l and pair_line([l['words']], l['key']) is None:
                self.fail(lat, f"key {l['key']!r} must occur once, as whole words, in the line")
            if 'mark' in l and not mark_ok(l['mark']):
                self.fail(lat, f"mark {l['mark']!r} must be a capital letter, with ' after it in the second half")
        marks = [l['mark'] for l in lines if 'mark' in l]
        if kind == 'parallelism' and len(lines) < 2:
            self.fail(at, 'parallel lines need at least two lines')
        if kind != 'parallelism' and lines:
            pass  # the build allows lines on any kind
        if n.get('form') == 'mirror' and (len(marks) != len(lines) or not mirror_ok(marks)):
            self.fail(at, "a mirror's lines must all be marked, nesting as A B B' A' (one unmarked-prime centre allowed)")
        if n.get('form') == 'turns' and (len(marks) != len(lines) or not turns_ok(marks)):
            self.fail(at, "lines that take turns must all be marked, as A B A' B'")
        if n.get('pairs') and kind != 'parallelism':
            self.fail(at, 'only parallel lines have pairs')
        lw = [l.get('words', '') for l in lines]
        for i, p in enumerate(n.get('pairs', [])):
            pat = f'{at}, pairs[{i}]'
            if not isinstance(p, list) or len(p) != 2:
                self.fail(pat, 'a pair is two words, each in a different line')
                continue
            found = [pair_line(lw, w) for w in p]
            for w, x in zip(p, found):
                if x is None:
                    self.fail(pat, f'{w!r} must occur once, as whole words, in the lines')
            if None not in found and found[0] >= found[1]:
                self.fail(pat, 'a pair is two words, each in a different line, the first in an earlier line than its answer')

        fig = n.get('figure')
        if kind == 'figure' and not fig:
            self.fail(at, 'a figure note needs its figure')
        elif fig and kind != 'figure':
            self.fail(at, 'only a figure note has a figure')
        elif fig:
            fat = f'{at}, figure'
            for k in fig:
                if k not in ('name', 'part', 'ref', 'words', 'means'):
                    self.fail(fat, f'unknown field {k!r}')
            self.own_words(fat, 'name', fig.get('name'), LABEL_MAX)
            if 'part' in fig:
                self.own_words(fat, 'part', fig['part'], 60)
            self.own_words(fat, 'means', fig.get('means'), MEANS_MAX)
            v = self.verse(fat, fig.get('ref'), own) if own else None
            if v is not None:
                self.find_once(fat, v, fig.get('words'))

        sides, side_ranges = n.get('sides', []), []
        if kind == 'contrast' and len(sides) != 2:
            self.fail(at, 'a contrast sets exactly two sides side by side')
        elif kind != 'contrast' and sides:
            self.fail(at, 'only a contrast has sides')
        for i, s in enumerate(sides):
            sat = f'{at}, sides[{i}]'
            self.own_words(sat, 'who', s.get('who'), LABEL_MAX)
            self.own_words(sat, 'label', s.get('label'), LABEL_MAX)
            r = self.range(sat, s.get('ref'))
            if not r:
                continue
            side_ranges.append(r)
            verses = [verse_text(x) for x in range(r[0], r[1] + 1)]
            if not any(names(t, s.get('who', '')) for t in verses):
                self.fail(sat, f"{s.get('who')!r} is not named in {s.get('ref')!r}")
            w = s.get('words', '')
            if not w.strip() or not any(w in t for t in verses):
                self.fail(sat, f"{w!r} is not the BSB text of a verse in {s.get('ref')!r}")

        named = ([own] if own else []) + [r for r in refs if r] + side_ranges
        if own and all(refs):
            texts = [normalize(' '.join(verse_text(x) for x in range(a, z + 1))) for a, z in named]
            fields = [('short', n.get('short', '')), ('about', n.get('about', '')), ('evidence', n.get('evidence', ''))]
            if 'limit' in n:
                fields.append(('limit', n['limit']))
            if 'original' in n:
                fields.append(('original note', n['original'].get('note', '')))
            for field, s in fields:
                try:
                    qs = quotes(s or '')
                except ValueError as e:
                    self.fail(at, f'{field}: {e}')
                    continue
                for q in qs:
                    if word_count(q) >= QUOTE_MIN_WORDS and not any(contains(t, q) for t in texts):
                        self.fail(at, f"{field}: quotation {q!r} is not in the BSB text of the verses the note names; writers' words go in a citation's quote")
        if 'original' in n:
            o = n['original']
            self.own_words(at, 'original note', o.get('note'), TEXT_MAX)
            if not o.get('strong'):
                self.fail(at, 'original needs at least one root')
            for s in o.get('strong', []):
                if not strong_ok(s):
                    self.fail(at, f'root {s!r} must be H or G and four digits, as H1870')
                    continue
                hit = any(lemma_matches(LEM[w[3]], s) for a, z in named for x in range(a, z + 1) for w in verse_words(x))
                if not hit:
                    self.fail(at, f'root {s} is not in the verses the note names')
        if 'defined' in n:
            d, dat = n['defined'], f'{at}, defined'
            self.text(dat, 'defined quote', d.get('quote'), QUOTE_MAX)
            self.text(dat, 'defined at', d.get('at'), AT_MAX)
            self.text(dat, 'read', d.get('read'), READ_MAX)
            if not date_ok(d.get('retrieved')):
                self.fail(dat, 'retrieved must be a date')
            if d.get('source') not in QUOTABLE or not CITE.get(d.get('source'), {}).get('url'):
                self.fail(dat, f"{d.get('source')!r} must be quotable and have a link of its own")

        cites = n.get('cites', [])
        writers, seen = set(), set()
        if not cites:
            self.fail(at, 'cites nothing; every note cites a work on the cite list')
        for i, c in enumerate(cites):
            cat = f'{at}, cites[{i}]'
            for k in c:
                if k not in ('source', 'on', 'at', 'quote', 'read', 'retrieved', 'found', 'context'):  # found, context: working fields, moved to the quote checks
                    self.fail(cat, f'unknown field {k!r}')
            src = c.get('source')
            if src in seen:
                self.fail(cat, f'{src!r} is cited twice; quote it once')
            seen.add(src)
            self.text(cat, 'quote', c.get('quote'), QUOTE_MAX)
            if isinstance(c.get('quote'), str) and len(c['quote'].strip()) < 15:
                self.fail(cat, 'quote is too short to show the writer saying it')
            self.text(cat, 'on', c.get('on'), AT_MAX)
            if 'at' in c:
                self.text(cat, 'at', c['at'], AT_MAX)
            self.text(cat, 'read', c.get('read'), READ_MAX)
            if not date_ok(c.get('retrieved')):
                self.fail(cat, f"retrieved {c.get('retrieved')!r} must be a date, as 2026-10-21")
            on = self.range(cat, c.get('on'))
            s = CITE.get(src)
            if not s:
                self.fail(cat, f'source {src!r} is not on the cite list')
                continue
            if src == 'net-notes':
                self.fail(cat, "the NET translators' notes are linked from Study, never shown")
                continue
            if src not in QUOTABLE:
                self.fail(cat, f"{s['name']} is not quotable: only works in the public domain are quoted here")
                continue
            if src == 'wesley':
                self.fail(cat, "Wesley's notes abridge Henry (Old Testament) and Bengel (New Testament): cite Henry or Bengel in his own words instead")
            if s['role'] == 'interpreter':
                writers.add(WRITER.get(src, src))
            if on:
                b, ch, v = locate(on[0])
                book = BOOKS[b]['name']
                if book in s.get('not_on', []):
                    self.fail(cat, f"{s['name']} is not cited on {book}")
                why = BARRED_BOOKS.get((src, book)) or BARRED_VERSES.get((src, book, ch, v))
                if why:
                    self.fail(cat, f'{src} may not be cited here: {why}')
            if src in ('church-fathers', 'catena-aurea'):
                who = (c.get('at') or '').lower()
                if not who:
                    self.fail(cat, f'{src} needs "at" naming the Father and the work')
                for fa in BARRED_FATHERS:
                    if re.search(r'\b' + fa + r'\b', who) and not (fa == 'eusebius' and src == 'catena-aurea'):
                        self.fail(cat, f'{fa.title()} is left out (voices shortlist)')
                if src == 'catena-aurea' and 'pseudo-chrysostom' in who and on and BOOKS[locate(on[0])[0]]['name'] == 'Matthew':
                    self.fail(cat, "the Catena's Pseudo-Chrysostom on Matthew is an unknown Arian writer")
            if not s.get('biblehub') and not s.get('url'):
                self.fail(cat, f"{s['name']} has no link")
            if self.local and on:
                q = local_quote(src, c.get('on'), c.get('quote', ''))
                if q is False:
                    self.fail(cat, f"quote not found word for word in the local copy of {src} (cq.py); fix it or read it from the web and say so in read")
        if cites and not writers:
            self.fail(at, 'cites no interpreter; a word book or the BSB alone cannot carry a note')
        elif cites and n.get('strength') != strength_for(len(writers)):
            self.fail(at, f"strength is {n.get('strength')!r}, but it cites {len(writers)} different interpreters, which is {strength_for(len(writers))!r}")


# --- local quote checks -----------------------------------------------------------------------------------------
LOCAL = {'gill': 'gill', 'clarke': 'clarke', 'barnes': 'barnes', 'jfb': 'jfb', 'keil-delitzsch': 'kad',
         'henry-concise': 'mhcc', 'henry': 'mhc', 'calvin': 'calvin', 'geneva': 'geneva', 'bullinger-cb': 'cb',
         'bullinger-fos': 'fos'}
_cq = None
_whole = {}


def _norm(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"')
    s = s.replace('\u2014', '-').replace('\u2013', '-').replace('--', '-')
    s = re.sub(r'\s+', ' ', s).strip().lower()
    s = re.sub(r' ([,.;:!?)\]])', r'\1', s)
    return re.sub(r'([(\[]) ', r'\1', s)


def _in_order(hay, quote):
    ps = [_norm(p) for p in re.split(r'\s*(?:\.\.\.|…)\s*', quote) if p.strip()]
    at = 0
    for p in ps:
        i = hay.find(p, at)
        if i < 0:
            return False
        at = i + len(p)
    return bool(ps)


def local_quote(src, on, quote):
    """True when found word for word in the local copy, False when the work is local and the quote is not there,
    None when the work has no local copy."""
    global _cq
    work = LOCAL.get(src)
    if not work:
        return None
    if _cq is None:
        sys.path.insert(0, WP)
        import cq as _m
        _cq = _m
    r = resolve(on)
    if not r:
        return False
    b, c, v = locate(r[0])
    ref = f"{BOOKS[b]['name']} {c}:{v}"
    try:
        if any(_in_order(_norm(u), quote) for u in _cq.units(work, ref)):
            return True
    except SystemExit:
        pass
    # A Figures of Speech definition or a Companion Bible appendix note may sit elsewhere in the work; a
    # verse-by-verse commentary's remark may sit in the next section of the same chapter file.
    if work == 'fos':
        if 'fos' not in _whole:
            _whole['fos'] = _norm(open(f'{WP}/fos.txt', encoding='utf-8').read())
        return _in_order(_whole['fos'], quote)
    if work == 'cb':
        _cq.get('cb', ref)
        key = ('cb', b)
        if key not in _whole:
            _whole[key] = _norm(' '.join(' '.join(t) for (bb, cc, vv), t in _cq._cb.items() if bb == b))
        return _in_order(_whole[key], quote)
    if work in _cq.VAULT_WORKS:
        path = f'{_cq.VAULT}/{work}/{_cq.ST[b]}{c:03d}.md'
        try:
            return _in_order(_norm(_cq.clean(open(path, encoding='utf-8', errors='replace').read())), quote)
        except FileNotFoundError:
            return False
    return False


def load(path):
    d = json.load(open(path))
    return d['notes'] if isinstance(d, dict) else d


def main(argv):
    local = '--quotes' in argv
    files = [a for a in argv if a != '--quotes']
    if not files:
        print(__doc__)
        return 2
    ck = Check(local)
    seen = set()
    count = 0
    for f in files:
        for n in load(f):
            count += 1
            ck.note(n, seen)
    for e in ck.errors:
        print(e)
    print(f'{count} notes, {len(ck.errors)} problems')
    return 1 if ck.errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
