#!/usr/bin/env python3
"""src.py: read a Layers source on a verse from the local pinned copies.

  python3 -I src.py <source-id> "<ref>"                  the comment(s) on that verse
  python3 -I src.py check <source-id> "<ref>" "<quote>"   is the quote there? prints VERBATIM, CLOSE (score) or NOT FOUND
  python3 -I src.py grep <source-id> "<ref>" "<words>"    every sentence in that comment holding the words
  python3 -I src.py --full pulpit "<ref>"                 pulpit, ellicott, benson: the whole chapter, not just the verse

Source ids are the cite list's (config/layer-sources.json). Local: gill clarke barnes jfb keil-delitzsch henry
henry-concise wesley calvin geneva bullinger-cb bullinger-fos pulpit ellicott benson tyndale-notes catena-aurea.
Any other source (poole, bengel, reformation-sb, net-notes, ...) has no local copy: read the record's url on the web.
For pulpit, ellicott and benson the local copy is StudyLight's transcription (MyBible modules, batanus/bible-resources
14a8b1a), not Bible Hub's page the cite links, so small differences in punctuation or spelling are expected there;
the Pulpit's homilies (from HOMILETICS on) are other men's words and are left out."""
import difflib, os, re, sys
SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, f'{SP}/wp')
sys.path.insert(0, f'{SP}/wp/fig')
import cq, osn, cat, bmod  # noqa: E402

CQ = {'gill': 'gill', 'clarke': 'clarke', 'barnes': 'barnes', 'jfb': 'jfb', 'keil-delitzsch': 'kad', 'henry': 'mhc',
      'henry-concise': 'mhcc', 'wesley': 'wesley', 'calvin': 'calvin', 'geneva': 'geneva', 'bullinger-cb': 'cb',
      'bullinger-fos': 'fos'}
BM = {'pulpit', 'ellicott', 'benson'}
FULL = False


def units(src, ref):
    """-> list of (label, text)"""
    if src in CQ:
        w = CQ[src]
        try:
            us = cq.units(w, ref)
            r = cq.get(w, ref)
        except SystemExit as e:
            return [('error', str(e))]
        lab = r[0] if r else ref
        return [(f'{src} {lab}', u) for u in us]
    if src in BM:
        b, c, v = cq.parse(ref)
        whole = [(f'{src} {cq.BOOKS[b]} {c} (whole chapter)', u) for u in bmod.units(src, b, c)]
        if FULL:
            return whole
        out = []
        if src == 'pulpit':
            book = cq.BOOKS[b].replace('Psalms', 'Psalm')
            found = []
            for _, u in whole:
                pat = r'\b(?:' + re.escape(cq.BOOKS[b]) + '|' + re.escape(book) + ') ' + str(c) + r':(\d+)(?:-(\d+))?\s+(?=[A-Z"“‘' + "'" + '])'
                ms = list(re.finditer(pat, u))
                for k, m in enumerate(ms):
                    lo, hi = int(m.group(1)), int(m.group(2) or m.group(1))
                    if lo <= v <= hi:
                        end = ms[k + 1].start() if k + 1 < len(ms) else len(u)
                        found.append((hi - lo, f'pulpit {cq.BOOKS[b]} {c}:{lo}' + (f'-{hi}' if hi != lo else ''), u[m.start():end]))
            if found:
                least = min(f[0] for f in found)
                out = [(lab, t) for n, lab, t in found if n == least]
        else:
            cur = None
            for lab, u in whole:
                m = re.match(r'^\W*(?:[IVXLC]+\.\s*)?(?:\((\d+)(?:\s*[-–,]\s*(\d+))?\)|Verses?\s+(\d+)(?:\s*[-–,]\s*(\d+))?)', u)
                if m:
                    lo = int(m.group(1) or m.group(3))
                    cur = (lo, int(m.group(2) or m.group(4) or lo))
                if cur and cur[0] <= v <= cur[1]:
                    out.append((f'{src} {cq.BOOKS[b]} {c}:{cur[0]}' + (f'-{cur[1]}' if cur[1] != cur[0] else ''), u))
        return out or whole
    if src == 'tyndale-notes':
        return [(f'tyndale-notes {t}', x) for t, x in osn.notes(ref)]
    if src == 'catena-aurea':
        return [(f'catena {cit} | {f}', t) for cit, f, t in cat.segs(ref)]
    return []


def check(src, ref, quote):
    us = units(src, ref)
    if not us:
        return 'NO LOCAL COPY', None
    parts = [cq.norm(p) for p in re.split(r'\s*(?:\.\.\.|…)\s*', quote) if p.strip()]
    best = (0.0, None)
    for lab, u in us:
        n, at, ok = cq.norm(u), 0, True
        for p in parts:
            i = n.find(p, at)
            if i < 0:
                ok = False
                break
            at = i + len(p)
        if ok:
            return 'VERBATIM', lab
        # closeness: best window match for each part
        sc = []
        for p in parts:
            sm = difflib.SequenceMatcher(None, n, p, autojunk=False)
            m = sm.find_longest_match(0, len(n), 0, len(p))
            lo = max(0, m.a - m.b - 20)
            win = n[lo: lo + len(p) + 40]
            sc.append(difflib.SequenceMatcher(None, win, p, autojunk=False).ratio())
        s = min(sc) if sc else 0
        if s > best[0]:
            best = (s, lab)
    return (f'CLOSE {best[0]:.2f}' if best[0] >= 0.85 else f'NOT FOUND (best {best[0]:.2f})'), best[1]


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--full':
        FULL = True
        a = a[1:]
    if not a:
        raise SystemExit(__doc__)
    if a[0] == 'check':
        r, lab = check(a[1], a[2], a[3])
        print(r, '|', lab or '')
    elif a[0] == 'grep':
        words = cq.norm(a[3])
        for lab, u in units(a[1], a[2]):
            for s in re.split(r'(?<=[.;:?!])\s+', u):
                if words in cq.norm(s):
                    print(f'[{lab}] {s}')
    else:
        us = units(a[0], a[1])
        if not us:
            print(f'no local copy of {a[0]} on {a[1]}; read the record url on the web')
        for lab, u in us:
            print(f'== {lab}\n{u}\n')
