#!/usr/bin/env python3
"""lcheck.py: check new Layers passages and additions the way the build does (crates/atlas-cli/src/layers.rs at
6df7a2f, PR #63) as far as a script can before the real build, plus this thread's rules.

  python3 -I lcheck.py <file.json>    file holds {"passages": [...], "additions": [...]}

Each cite carries, beside the build's fields (source, on, at, url, work), the read record this thread hands over:
quote (public-domain words, word for word as on the page) or pointer (copyrighted works: where on the page, in our
words), page (the page read, which must be the page the cite links), time (UTC, right after the read), verdict.
Prints "<where>: <problem>" lines and a last line "<n> notes, <m> problems"."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
WP = os.path.dirname(HERE)
sys.path.insert(0, f'{WP}/fig')
sys.path.insert(0, f'{WP}/tc')
import figcheck as fc
import resolve as tcr
LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
LIVE = {p['id']: p for p in json.load(open(f'{LW}/config/layers.json'))['passages']}
KINDS = ["plain meaning", "quotation", "allusion", "wordplay", "name meaning", "pattern", "irony", "fulfillment", "setting"]
NEEDS = ["wordplay", "allusion", "pattern", "irony", "fulfillment"]
STR = [fc.WIDELY, fc.COMMONLY, fc.SOME]
POINTER_ONLY = {'pulpit', 'net-notes', 'reformation-sb'}
SECTION = [('law-history', 0, 16), ('prophets-poetry', 17, 38), ('jesus', 39, 42), ('letters-revelation', 43, 65)]
CITE_KEYS = {'source', 'on', 'at', 'url', 'work', 'quote', 'pointer', 'page', 'time', 'verdict', 'remark', 'counts'}
errors = []
notes = 0


def fail(at, msg):
    errors.append(f'{at}: {msg}')


def slug(book):
    return {'Psalms': 'psalm', 'Song of Solomon': 'song-of-solomon'}.get(book, book.lower().replace(' ', '-'))


def bsb_of(r):
    x = fc.resolve(r)
    return fc.normalize(' '.join(fc.verse_text(i) for i in range(x[0], x[1] + 1))) if x else None


def roots(r):
    x = fc.resolve(r)
    out = set()
    for i in range(x[0], x[1] + 1):
        for w in fc.verse_words(i):
            if isinstance(w[3], int) and 0 <= w[3] < len(fc.LEM):
                out.add(fc.LEM[w[3]])
    return out


def layer(at, ref, l, is_new, k):
    global notes
    notes += 1
    for f in ('kind', 'strength', 'refs', 'evidence', 'cites', 'text'):
        if f not in l:
            fail(at, f'{f} is missing')
    if l.get('kind') not in KINDS:
        fail(at, f"kind {l.get('kind')!r} is not a Layers kind")
    if l.get('strength') not in STR:
        fail(at, f"strength {l.get('strength')!r}")
    ck = fc.Check()
    ck.text(at, 'text', l.get('text'), 300)
    ck.dash(at, 'text', l.get('text'))
    n = fc.writer_named(l.get('text') or '', fc.WRITER_NAMES)
    if n:
        fail(at, f'text names {n!r}; writers go in evidence')
    ck.text(at, 'evidence', l.get('evidence'), 400)
    ck.dash(at, 'evidence', l.get('evidence'))
    errors.extend(ck.errors)
    refs = l.get('refs') or []
    texts = [bsb_of(ref)]
    for r in refs:
        t = bsb_of(r)
        if t is None:
            fail(at, f'ref {r!r} does not resolve')
        else:
            texts.append(t)
    if refs and fc.resolve(refs[0]) and fc.resolve(ref) and fc.resolve(refs[0])[0] != fc.resolve(ref)[0]:
        fail(at, f'refs should start with the passage verse {ref!r}')
    for q in fc.quotes(l.get('text') or ''):
        if fc.word_count(q) >= 4 and not any(t and fc.contains(t, q) for t in texts):
            fail(at, f'quotation {q!r} is not in the BSB text of {ref} or the refs')
    for w in l.get('words') or []:
        r = fc.resolve(w.get('ref', ''))
        if not r:
            fail(at, f"words ref {w.get('ref')!r} does not resolve")
            continue
        have = roots(w['ref'])
        if not any(fc.lemma_matches(h, w.get('strong', '')) for h in have):
            fail(at, f"{w.get('strong')} is not a root in {w['ref']} (roots there: {', '.join(sorted(have))})")
    keys, interp = set(), False
    for j, c in enumerate(l.get('cites') or []):
        cat = f'{at}, cites[{j}] ({c.get("source")} on {c.get("on")})'
        for f in c:
            if f not in CITE_KEYS:
                fail(cat, f'unknown field {f!r}')
        src = fc.CITE.get(c.get('source'))
        if not src:
            fail(cat, 'source is not on the cite list')
            continue
        probe = {x: c[x] for x in ('source', 'on', 'url', 'work', 'at') if c.get(x)}
        r = tcr.resolve(probe)
        if not r['ok']:
            fail(cat, r['why'])
            continue
        if r.get('unnamed'):
            fail(cat, f"words by {r['unnamed']}, unnamed: cite another writer")
        link = c.get('url') or r.get('link')
        if not link:
            fail(cat, 'no page to link: give url')
        elif fc.home_page(c['source'], link):
            fail(cat, f'{link} is a home page; link the page the words are on')
        if c['source'] in POINTER_ONLY:
            if c.get('quote'):
                fail(cat, 'quote given for a copyrighted work: give pointer only')
            if not c.get('pointer'):
                fail(cat, 'pointer is missing')
        elif c['source'] != 'tyndale-notes':
            q = c.get('quote') or ''
            if not 20 <= len(q) <= 400:
                fail(cat, f'quote is {len(q)} characters; give 20 to 400')
            lq = fc.local_quote(c['source'], c['on'], q) if q else None
            if lq is False:
                fail(cat, 'quote not found word for word in the local copy (fix it, or confirm it on the web page and set remark to say so)') if 'web' not in (c.get('remark') or '').lower() else None
        page = c.get('page')
        if not page:
            fail(cat, 'page is missing (the page read)')
        elif link and fc.page_key(page) != fc.page_key(link):
            fail(cat, f'page {page} is not the page the cite links ({link})')
        if not re.fullmatch(r'2026-\d\d-\d\dT\d\d:\d\d:\d\dZ', c.get('time') or ''):
            fail(cat, 'time must be the UTC time of the read, as 2026-11-01T02:10:00Z')
        if c.get('verdict') not in ('respects',):
            fail(cat, 'verdict must be "respects" (decision 20); leave out words that deny Scripture')
        if c.get('counts') is False:
            continue
        if r.get('role') == 'interpreter':
            interp = True
            keys.add(r['key'])
    kind = l.get('kind')
    if kind in NEEDS and not interp:
        fail(at, f'a {kind} note needs an interpreter among its cites')
    if kind == 'plain meaning':
        if l.get('strength') != fc.WIDELY:
            fail(at, 'plain meaning is "widely agreed"')
        if k != 0:
            fail(at, 'plain meaning must be the first layer')
    else:
        want = fc.strength_for(len(keys))
        if STR.index(l.get('strength', fc.SOME)) < STR.index(want):
            fail(at, f'strength {l.get("strength")!r} is above the {len(keys)} distinct writers cited ({", ".join(sorted(keys))}): at most {want!r}')
    return kind


def main(path):
    d = json.load(open(path))
    seen = set()
    for p in d.get('passages', []):
        at = f"passage {p.get('id')!r}"
        x = fc.resolve(p.get('ref', ''))
        if not x:
            fail(at, f"ref {p.get('ref')!r} does not resolve")
            continue
        b, c, v = fc.locate(x[0])
        book = fc.BOOKS[b]['name']
        want = f'{slug(book)}-{c}-{v}'
        if p.get('id') != want and not (p.get('id') or '').startswith(want + '-'):
            fail(at, f'id should be {want!r}')
        if p.get('id') in LIVE or p.get('id') in seen:
            fail(at, 'id is already used (live or earlier in this file): make it an addition instead')
        seen.add(p.get('id'))
        sec = next(s for s, lo, hi in SECTION if lo <= b <= hi)
        if p.get('section') != sec:
            fail(at, f'section should be {sec!r}')
        sy = p.get('saying') or ''
        if not (3 <= len(sy.split()) <= 15) or not fc.contains(bsb_of(p['ref']), sy):
            fail(at, f'saying {sy!r} must be 3 to 15 words of the BSB text of {p["ref"]}')
        kinds = [layer(f'{at}, layers[{k}]', p['ref'], l, True, k) for k, l in enumerate(p.get('layers') or [])]
        if not kinds or kinds[0] != 'plain meaning':
            fail(at, 'the first layer must be the plain meaning')
        firm = [l for l in p.get('layers', [])[1:] if l.get('strength') != fc.SOME]
        if not firm:
            fail(at, 'a new passage needs a note beyond the plain meaning that is not "some interpreters"')
    for a in d.get('additions', []):
        at = f"addition to {a.get('passage_id')!r}"
        live = LIVE.get(a.get('passage_id'))
        if not live:
            fail(at, 'no live passage has this id')
            continue
        if a.get('ref') != live['ref']:
            fail(at, f"ref should be the passage's ref {live['ref']!r}")
        for k, l in enumerate(a.get('layers') or []):
            if l.get('kind') == 'plain meaning':
                fail(at, 'an addition has no plain meaning layer')
            layer(f'{at}, layers[{k}]', live['ref'], l, False, k + 1)
    for e in errors:
        print(e)
    print(f'{notes} notes, {len(errors)} problems')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
