"""Every writer's note as (work, who, from, to, plain text, links), links as (from, to, start, end) in the plain text."""
import json, re, sys, glob
sys.path.insert(0, '/tmp/mine/scripts')
from books import BOOKS, USFM, parse_target, book_of
from bible import START, IDX, D, meta

RAW_LC = '/home/claude/bibleatlas/data/raw/lets.church@71f6f0fc8f/packages/lets.bible/seed/commentaries'
RAW_MINE = '/tmp/mine/raw'
REF = re.compile(r'\{\{ref:([^|}]*)\|([^}]*)\}\}')
CHAPS = [bk['chapters'] for bk in meta['books']]


def vidx(b, c, v):
    if v is None:
        v = 1
    return START.get((b, c, v))


def vend(b, c, v):
    if v is None:
        if 1 <= c <= len(CHAPS[b]):
            return START.get((b, c, CHAPS[b][c - 1]))
        return None
    return START.get((b, c, v))


def lc_notes(work):
    import os
    p = f'{RAW_LC}/{work}.json'
    if not os.path.exists(p):
        p = f'{RAW_MINE}/{work}.json'
    d = json.load(open(p))
    for e in d['entries']:
        b = USFM.index(e['book'])
        c = e['chapter']; v = e['verse']; ve = e.get('verseEnd') or v
        if not v:
            continue
        f = vidx(b, c, v); t = vidx(b, c, ve) or f
        if f is None:
            continue
        body = e['body']
        plain = []; links = []; pos = 0; last = 0
        for m in REF.finditer(body):
            plain.append(body[last:m.start()])
            pos += len(body[last:m.start()])
            shown = m.group(2)
            for (rb, c1, v1, c2, v2) in parse_target(m.group(1)):
                a = vidx(rb, c1, v1); z = vend(rb, c2, v2)
                if a is not None and z is not None and z >= a:
                    links.append((a, z, pos, pos + len(shown)))
            plain.append(shown); pos += len(shown); last = m.end()
        plain.append(body[last:])
        yield dict(work=work, who='', f=f, t=t, text=''.join(plain), links=links)


def catena_notes():
    for fn in sorted(glob.glob(f'{D}/extras/voices/*.json')):
        for work, f, t, voices in json.load(open(fn))['items']:
            if work != 0:
                continue
            for who, text in voices:
                plain = []; links = []; pos = 0
                parts = text if isinstance(text, list) else [text]
                for p in parts:
                    if isinstance(p, str):
                        plain.append(p); pos += len(p)
                    else:
                        a, z, s = p
                        links.append((a, z, pos, pos + len(s)))
                        plain.append(s); pos += len(s)
                full = ''.join(plain)
                for m in re.finditer(r'[\[(]([^\])]{0,60})[\])]', full):
                    inner = m.group(1); base = m.start(1)
                    for mm in re.finditer(r'((?:[1-3]\s?)?[A-Z][a-z]+)\.?\s(\d+):(\d+)(?:-(\d+))?', inner):
                        b = book_of(mm.group(1))
                        if b is None:
                            continue
                        a = vidx(b, int(mm.group(2)), int(mm.group(3)))
                        z = vidx(b, int(mm.group(2)), int(mm.group(4) or mm.group(3)))
                        if a is not None and z is not None:
                            links.append((a, z, base + mm.start(), base + mm.end()))
                yield dict(work='catena', who=who, f=f, t=t, text=full, links=links)


def all_notes():
    for w in ['wesley', 'mhcc', 'mhc', 'calvin', 'geneva']:
        yield from lc_notes(w)
    yield from catena_notes()
