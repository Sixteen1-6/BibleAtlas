#!/usr/bin/env python3
"""strcheck.py [--quotes] [--have <structures.json>] <file>...: check structures for config/structures.json (PR #68,
crates/atlas-cli/src/extra_structure.rs at a0ca87e) the way the build does, on top of figcheck.py's helpers.

A file is {"structures": [...]} or a bare list. --quotes also finds each quote word for word in the local copy
(as figcheck --quotes does). --have names structures already in the file (PR #68's 14): an id, or a foil with the
same two people, or a structure over the same passage and kind, is reported as a duplicate.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import figcheck as fc

KINDS = ['inclusio', 'refrain', 'alternation', 'chiasm', 'foil']
SHORT_MAX = 60
FIELDS = {'id', 'kind', 'ref', 'strength', 'short', 'about', 'members', 'sides', 'evidence', 'limit', 'checked', 'cites'}


def letter(m):
    return isinstance(m, str) and len(m) in (1, 2) and m[0].isascii() and m[0].isupper() and (len(m) == 1 or m[1] == "'")


def marks_ok(kind, marks):
    if not all(letter(m) for m in marks):
        return "each mark is a capital letter, with ' after it for a partner in the second half"
    if kind == 'inclusio':
        ok = marks == ['A', "A'"]
    elif kind == 'refrain':
        ok = len(marks) >= 2 and all(m == 'R' for m in marks)
    elif kind == 'alternation':
        k = len(set(marks))
        ok = (len(marks) >= 4 and k >= 2 and all(not m.endswith("'") for m in marks)
              and all(a != b for a, b in zip(marks, marks[1:])) and all(marks[i] == marks[i % k] for i in range(len(marks))))
    elif kind == 'chiasm':
        ok = len(marks) >= 4 and fc.mirror_ok(marks)
    else:
        ok = False
    if ok:
        return None
    return {'inclusio': "bookends are two members, A and A'", 'refrain': "a refrain's members are all marked R",
            'alternation': 'turns are at least four members, A B A B (or A B C A B C), each letter in its own place'
            }.get(kind, "a mirror is at least four members nesting as A B B' A', with at most one centre")


def find_in(ck, at, r, words):
    a, z = r
    hits = [v for v in range(a, z + 1) if isinstance(words, str) and words and words in fc.verse_text(v)]
    if len(hits) == 1:
        off = ck.find_once(at, hits[0], words)
        return None if off is None else (hits[0], off)
    if not hits:
        ck.fail(at, f'{words!r} is not the BSB text of a verse in its range')
    else:
        ck.fail(at, f'{words!r} is in more than one verse of its range; quote more of it')
    return None


def cites_check(ck, at, s):
    cites = s.get('cites') or []
    writers, seen = set(), set()
    if not cites:
        ck.fail(at, 'cites nothing; every structure cites an interpreter on the cite list')
    for i, c in enumerate(cites):
        cat = f'{at}, cites[{i}]'
        for k in c:
            if k not in ('source', 'work', 'on', 'at', 'url', 'quote', 'read', 'retrieved'):
                ck.fail(cat, f'unknown field {k!r}')
        src = c.get('source')
        if src in seen:
            ck.fail(cat, f'{src!r} is cited twice; quote it once')
        seen.add(src)
        ck.quoted(cat, 'quote', c.get('quote'), fc.QUOTE_MAX)
        if isinstance(c.get('quote'), str) and len(c['quote'].strip()) < 15:
            ck.fail(cat, 'quote is too short to show the writer saying it')
        ck.text(cat, 'on', c.get('on'), fc.AT_MAX)
        if 'at' in c:
            ck.text(cat, 'at', c['at'], fc.AT_MAX)
        ck.text(cat, 'read', c.get('read'), fc.READ_MAX)
        if not fc.date_ok(c.get('retrieved')):
            ck.fail(cat, f"retrieved {c.get('retrieved')!r} must be a date, as 2026-10-21")
        on = ck.range(cat, c.get('on'))
        src_e = fc.CITE.get(src)
        if not src_e:
            ck.fail(cat, f'source {src!r} is not on the cite list')
            continue
        if src == 'net-notes':
            ck.fail(cat, "the NET translators' notes are linked from Study, never shown")
            continue
        if src not in fc.QUOTABLE:
            ck.fail(cat, f"{src_e['name']} is not quotable: only works in the public domain are quoted here")
            continue
        if not on:
            continue
        b, ch, v = fc.locate(on[0])
        book = fc.BOOKS[b]['name']
        why = fc.BARRED_BOOKS.get((src, book)) or fc.BARRED_VERSES.get((src, book, ch, v))
        if why:
            ck.fail(cat, f'{src} may not be cited here: {why}')
        key = ck.credit(cat, src, c.get('on'), c.get('work'), c.get('url'))
        if key and src_e['role'] == 'interpreter':
            writers.add(key)
        if src in ('church-fathers', 'catena-aurea') and not (c.get('at') or '').strip():
            ck.fail(cat, f'{src} needs "at" naming the Father and the work')
        if ck.local:
            q = fc.local_quote(src, c.get('on'), c.get('quote', ''))
            if q is False:
                ck.fail(cat, f'quote not found word for word in the local copy of {src}')
    if cites and not writers:
        ck.fail(at, 'cites no interpreter; a word book or the BSB alone cannot carry a structure')
    elif cites and s.get('strength') != fc.strength_for(len(writers)):
        ck.fail(at, f"strength is {s.get('strength')!r}, but it cites {len(writers)} different interpreters ({', '.join(sorted(writers))}), which is {fc.strength_for(len(writers))!r}")
    return writers


def structure(ck, s, ids):
    at = f"structures.json: structure {s.get('id')!r}"
    for k in s:
        if k not in FIELDS:
            ck.fail(at, f'unknown field {k!r}')
    sid = s.get('id') or ''
    if not sid or not all(c.islower() and c.isascii() or c.isdigit() or c == '-' for c in sid):
        ck.fail(at, 'id must be lowercase letters, digits and hyphens')
    if sid in ids:
        ck.fail(at, 'id is used by an earlier structure')
    ids.add(sid)
    kind = s.get('kind')
    if kind not in KINDS:
        ck.fail(at, f"kind {kind!r} is not one of: {', '.join(KINDS)}")
        return
    ck.own_words(at, 'short', s.get('short'), SHORT_MAX)
    ck.own_words(at, 'about', s.get('about'), fc.TEXT_MAX)
    ck.text(at, 'evidence', s.get('evidence'), fc.EVIDENCE_MAX)
    if s.get('limit') is not None:
        ck.own_words(at, 'limit', s['limit'], fc.TEXT_MAX)
    if not fc.date_ok(s.get('checked')):
        ck.fail(at, f"checked {s.get('checked')!r} must be a date, as 2026-10-21")
    named = []
    if kind == 'foil':
        if s.get('ref') is not None or s.get('members'):
            ck.fail(at, 'a foil has two sides, not a passage or members')
        sides = s.get('sides') or []
        if len(sides) != 2:
            ck.fail(at, 'a foil sets exactly two sides side by side')
        for i, side in enumerate(sides):
            sat = f'{at}, sides[{i}]'
            ck.own_words(sat, 'who', side.get('who'), fc.LABEL_MAX)
            ck.own_words(sat, 'label', side.get('label'), fc.LABEL_MAX)
            refs, words = side.get('refs') or [], side.get('words') or []
            if not refs or not words:
                ck.fail(sat, 'a side names at least one range and quotes at least one line of it')
            rs = [x for x in (ck.range(sat, r) for r in refs) if x]
            srt = sorted(rs)
            if any(b[0] <= a[1] for a, b in zip(srt, srt[1:])):
                ck.fail(sat, "a side's ranges must not overlap")
            who = side.get('who') or ''
            if not any(fc.names(fc.verse_text(v), who) for a, z in rs for v in range(a, z + 1)):
                ck.fail(sat, f"{who!r} is not named in the BSB text of the side's ranges")
            for w in words:
                hits = [r for r in rs if any(w in fc.verse_text(v) for v in range(r[0], r[1] + 1))]
                if len(hits) == 1:
                    find_in(ck, sat, hits[0], w)
                elif not hits:
                    ck.fail(sat, f"{w!r} is not the BSB text of a verse in the side's ranges")
                else:
                    ck.fail(sat, f"{w!r} is in more than one of the side's ranges; quote more of it")
            named += rs
    else:
        if s.get('sides'):
            ck.fail(at, 'only a foil has sides')
        r = s.get('ref')
        if not r:
            ck.fail(at, 'a structure names its whole passage in ref')
            return
        own = ck.range(at, r)
        if not own:
            return
        if fc.locate(own[0])[0] != fc.locate(own[1])[0]:
            ck.fail(at, f"{r!r} crosses a book; a structure's passage is in one book (a foil's sides may cross)")
        named.append(own)
        members = s.get('members') or []
        err = marks_ok(kind, [m.get('mark') for m in members])
        if err:
            ck.fail(at, err)
        last, groups = None, {}
        for i, m in enumerate(members):
            mat = f'{at}, members[{i}]'
            for k in m:
                if k not in ('mark', 'ref', 'words', 'tie'):
                    ck.fail(mat, f'unknown field {k!r}')
            mr = ck.range(mat, m.get('ref'))
            if not mr:
                continue
            if mr[0] < own[0] or mr[1] > own[1]:
                ck.fail(mat, f"{m.get('ref')!r} is outside the structure's passage {r!r}")
                continue
            hit = find_in(ck, mat, mr, m.get('words'))
            if not hit:
                continue
            v, off = hit
            if last:
                pr, pv, pend = last
                same_verse = pr == mr and mr[0] == mr[1]
                if not (pr[1] < mr[0] or same_verse) or (v, off) < (pv, pend):
                    ck.fail(mat, 'members must be in reading order and must not overlap')
            last = (mr, v, off + len(m['words']))
            g = groups.setdefault('R' if kind == 'refrain' else m['mark'].rstrip("'"), [None, []])
            if m.get('tie') is not None:
                if g[0] is None and not g[1]:
                    g[0] = m['tie']
                else:
                    ck.fail(mat, 'the tie goes on the first member of its group only')
            g[1].append(m['words'])
            named.append(mr)
        for k, (tie, ws) in groups.items():
            if len(ws) < 2:
                continue
            if tie is None:
                ck.fail(at, f'the members marked {k} need a tie: words a reader can see in each of them')
            else:
                for w in ws:
                    if not fc.whole_words(w, tie):
                        ck.fail(at, f'tie {tie!r} is not in {w!r}, as whole words')
    texts = [fc.normalize(' '.join(fc.verse_text(v) for v in range(a, z + 1))) for a, z in named]
    fields = [('short', s.get('short')), ('about', s.get('about')), ('evidence', s.get('evidence'))]
    if s.get('limit') is not None:
        fields.append(('limit', s['limit']))
    for side in s.get('sides') or []:
        fields.append(('side label', side.get('label')))
    for field, t in fields:
        try:
            qs = fc.quotes(t or '')
        except ValueError as e:
            ck.fail(at, f'{field}: {e}')
            continue
        for q in qs:
            if fc.word_count(q) >= fc.QUOTE_MIN_WORDS and not any(fc.contains(x, q) for x in texts):
                ck.fail(at, f'{field}: quotation {q!r} is not in the BSB text of the verses the structure names')
    cites_check(ck, at, s)


def load(path):
    d = json.load(open(path))
    return d['structures'] if isinstance(d, dict) else d


def key(s):
    if s.get('kind') == 'foil':
        return ('foil', tuple(sorted((x.get('who') or '').lower() for x in s.get('sides') or [])))
    return (s.get('kind'), fc.resolve(s.get('ref') or ''))


def main(argv):
    argv = list(argv)
    have = []
    if '--have' in argv:
        i = argv.index('--have')
        have = load(argv[i + 1])
        del argv[i:i + 2]
    local = '--quotes' in argv
    files = [a for a in argv if a != '--quotes']
    if not files:
        print(__doc__)
        return 2
    ck = fc.Check(local)
    ids = {s['id'] for s in have}
    hk = {key(s): s['id'] for s in have}
    n = 0
    dups = []
    for f in files:
        for s in load(f):
            n += 1
            if key(s) in hk:
                dups.append(f"{s.get('id')} duplicates {hk[key(s)]}")
            structure(ck, s, ids)
    for e in ck.errors:
        print(e)
    for d in dups:
        print('duplicate:', d)
    print(f'{n} structures, {len(ck.errors)} problems, {len(dups)} duplicates')
    return 1 if ck.errors or dups else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
