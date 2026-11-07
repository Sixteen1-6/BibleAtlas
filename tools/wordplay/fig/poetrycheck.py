#!/usr/bin/env python3
"""poetrycheck.py <file or dir>...: the build's poetry line rule (PR #75, poetry.rs and extra_figures.rs
poetry_lines) in Python, so every failing line shows at once. Where the BSB's USFM sets a verse as poetry, each of a
parallel note's lines is one of its lines, part of one, or whole lines together; for same, opposite, building and
climbing, no two of a note's lines share one BSB line. Prints one line per failure and a count."""
import glob, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import figcheck as fc

RAW = '/home/claude/bibleatlas/data/raw/examples.bsb@48a9feb71f'
SRC = json.load(open('/home/claude/bibleatlas/sources.json'))
FILES = next(s for s in SRC['sources'] if s['id'] == 'bsb-usfm')['files']
POETRY = ('q1', 'q2', 'qr')
PROSE = ('p', 'm', 'pmo', 'pi1', 'pc', 'li1', 'li2', 'nb')
LINE_FORMS = ('same', 'opposite', 'building', 'climbing')


def clean(t):
    out, rest = [], t
    while '\\' in rest:
        i = rest.index('\\')
        out.append(rest[:i])
        after = rest[i + 1:]
        m = re.match(r'[A-Za-z0-9+*]*', after)
        marker = m.group(0)
        rest = after[len(marker):]
        if marker in ('f', 'x'):
            close = f'\\{marker}*'
            j = rest.find(close)
            rest = '' if j < 0 else rest[j + len(close):]
        elif not marker.endswith('*') and rest.startswith(' '):
            rest = rest[1:]
    out.append(rest)
    return ''.join(out)


def parse(usfm):
    out = []
    ch = vv = sid = 0
    poetry = False
    title = None

    def push(key, seg):
        if out and out[-1][0] == key:
            out[-1][1].append(seg)
        else:
            out.append((key, [seg]))
    for raw in usfm.split('\n'):
        if raw.startswith('\\'):
            r = raw[1:]
            marker, _, rest = r.partition(' ')
        else:
            marker, rest = '', raw
        if marker == 'c':
            try:
                ch = int(rest.split()[0])
            except (ValueError, IndexError):
                ch = 0
            vv = 0
            continue
        if marker == 'd':
            sid += 1
            if vv > 0:
                push((ch, vv), (sid, False, clean(rest)))
            else:
                title = (sid, clean(rest))
            continue
        if marker == 'v':
            rest = '\\v ' + rest
        elif marker == '':
            pass
        elif marker in POETRY or marker in PROSE:
            sid += 1
            poetry = marker in POETRY
        else:
            sid += 1
            poetry = False
            continue
        parts = rest.split('\\v ')
        pieces = [(None, parts[0])]
        for p in parts[1:]:
            n, _, t = p.partition(' ')
            try:
                pieces.append((int(n), t))
            except ValueError:
                pieces.append((None, t))
        for n, t in pieces:
            if n is not None:
                vv = n
                if n == 1 and title:
                    push((ch, 1), (title[0], False, title[1]))
                    title = None
            if vv == 0:
                continue
            t = clean(t)
            if t.strip():
                push((ch, vv), (sid, poetry, t))
    return out


def word(c):
    return c.isalnum() or c in "’'ʼ"


def tokens(t):
    out, start = [], None
    for i, c in enumerate(t):
        if word(c) and start is None:
            start = i
        elif not word(c) and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(t)))
    return [(s, e) for s, e in out if any(ch.isalnum() for ch in t[s:e])]


def fold(w):
    return ''.join(('’' if c in "'ʼ" else c) for c in w).lower()


LINES = {}


def load():
    for bi, b in enumerate(fc.BOOKS):
        usfm = open(f"{RAW}/{FILES[b['osis']]}", encoding='utf-8').read()
        for (ch, vv), segs in parse(usfm):
            if not any(s[1] for s in segs):
                continue
            try:
                v = fc.index(bi, ch, vv)
            except Exception:
                continue
            if fc.locate(v) != (bi, ch, vv):
                continue
            text = fc.verse_text(v)
            words, line = [], []
            for sid, po, t in segs:
                ws = [fold(t[s:e]) for s, e in tokens(t)]
                line += [((bi << 16) | sid, po)] * len(ws)
                words += ws
            if [fold(text[s:e]) for s, e in tokens(text)] == words:
                LINES[v] = line


def place(v, text, frm, to):
    line = LINES.get(v)
    if not line:
        return None
    toks = tokens(text)
    if len(toks) != len(line):
        return None
    first = next((i for i, (_, e) in enumerate(toks) if e > frm), None)
    last = next((i for i in range(len(toks) - 1, -1, -1) if toks[i][0] < to), None)
    if first is None or last is None or last < first or all(not w[1] for w in line[first:last + 1]):
        return None
    a, z = line[first][0], line[last][0]
    if first == 0:
        prev = LINES.get(v - 1)
        before = prev[-1][0] if prev else None
    else:
        before = line[first - 1][0]
    if last + 1 < len(line):
        after = line[last + 1][0]
    else:
        nxt = LINES.get(v + 1)
        after = nxt[0][0] if nxt else None
    return (a, z, before != a and after != z)


def check(n):
    fails = []
    placed = []
    for i, l in enumerate(n.get('lines') or []):
        r = fc.resolve(l['ref'])
        if not r:
            continue
        v = r[0]
        text = fc.verse_text(v)
        t = l['words']
        off = text.find(t)
        if off < 0:
            continue
        p = place(v, text, off, off + len(t))
        if not p:
            continue
        if p[0] != p[1] and not p[2]:
            fails.append(f'lines[{i}] {t!r} runs across the BSB\'s own lines')
        placed.append((i, p))
    if n.get('form') in LINE_FORMS:
        for k, (i, p) in enumerate(placed):
            for j, q in placed[k + 1:]:
                if p[0] <= q[1] and q[0] <= p[1]:
                    fails.append(f'lines[{i}] and lines[{j}] are in one line of the BSB')
    return fails


def bsb_lines(ref):
    """The BSB's poetry lines of a verse, as text, for writing a fix."""
    r = fc.resolve(ref)
    v = r[0]
    text = fc.verse_text(v)
    line = LINES.get(v)
    if not line:
        return None
    toks = tokens(text)
    out, cur, start = [], None, 0
    for k, ((s, e), w) in enumerate(zip(toks, line)):
        if w[0] != cur:
            if cur is not None:
                out.append(text[start:toks[k - 1][1]])
            cur, start = w[0], s
    out.append(text[start:toks[-1][1]])
    return out


if __name__ == '__main__':
    load()
    if sys.argv[1] == '--lines':
        for ref in sys.argv[2:]:
            print(ref, json.dumps(bsb_lines(ref), ensure_ascii=False))
        sys.exit()
    files = []
    for a in sys.argv[1:]:
        files += sorted(glob.glob(f'{a}/*.json')) if os.path.isdir(a) else [a]
    bad = 0
    total = 0
    for f in files:
        for n in json.load(open(f))['notes']:
            total += 1
            fs = check(n)
            if fs:
                bad += 1
                for x in fs:
                    print(f"{os.path.basename(f)} {n['id']}: {x}")
    print(f'{total} notes, {bad} with poetry line problems, {len(LINES)} poetry verses placed')
