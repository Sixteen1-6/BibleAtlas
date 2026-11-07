#!/usr/bin/env python3
"""scanq.py: re-checks the scan quotes post.py could not find (report.json web_not_found) against every page of the
same scan that WebFetch returned (scanidx.json), with the scans' long s folded (s, f and the OCR's l read as one
letter). The pages the cite's found names (page=N, index N, leaf N) are tried first. Writes scanq.json: one record per
cite with the page it was found on, how (exact, pieces, fuzzy ratio), and whether that page is one the found names."""
import difflib, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, f'{os.path.dirname(os.path.dirname(HERE))}/fig')
import figcheck as fc

ITEMS = {'lowth-isaiah': ['isaiahnewtransla01lowt', 'isaiahnewtransla02lowt', 'isaiahnewtransla00lowt', 'isaiahnewtransla1848lowt'],
         'lowth-lectures': ['lecturesonsacred02lowt', 'lecturesonsacred01lowt', 'bim_eighteenth-century_lectures-on-the-sacred-p_lowth-robert_1787_1'],
         'boys': ['akeytobookpsalm00boysgoog', 'tactica-sacra'], 'jebb': ['sacredliterature00jebb'],
         'forbes': ['symmetricalstruc00forbiala']}
idx = json.load(open(f'{HERE}/scanidx.json'))


def fold1(t):
    return fc.normalize(t.replace('ſ', 's')).replace('s', 'f')


def fold2(t):
    return re.sub('[sfl]', 'f', fc.normalize(t.replace('ſ', 's')))


def fold3(t):
    """fold2 without the page's line numbers (number-only words) or search highlights (FTSmatch tags)."""
    return ' '.join(w for w in fold2(re.sub(r'</?FTSmatch>|IASTFMATCH', ' ', t, flags=re.I)).split() if not w.isdigit() and 'ftfmatch' not in w)


def chars(ps, words):
    """For each part: the best word window (two words of slack each side), compared letter by letter with the
    spaces taken out, so a word the OCR split or misread a letter of still matches; the lowest part's ratio."""
    worst = 1.0
    for p in ps:
        q = p.split()
        qj = ''.join(q)
        best = 0.0
        sm = difflib.SequenceMatcher(None, q, [], autojunk=False)
        cands = []
        for i in range(0, max(1, len(words) - len(q) + 1)):
            sm.set_seq2(words[i:i + len(q)])
            if sm.real_quick_ratio() < 0.6 or sm.quick_ratio() < 0.6:
                continue
            cands.append((sm.ratio(), i))
        cands.sort(reverse=True)
        for _, i in cands[:5]:
            for a in range(0, 3):
                for z in range(-2, 3):
                    w = ''.join(words[max(0, i + a - 1):i + len(q) + z])
                    r = difflib.SequenceMatcher(None, qj, w, autojunk=False).ratio()
                    best = max(best, r)
        worst = min(worst, best)
    return worst


def pparts(q, fold):
    return [p for p in (fold(x) for x in q.replace('...', '…').split('…')) if p]


def contains(text, ps):
    text, at = f' {text} ', 0
    for p in ps:
        i = text.find(f' {p} ', at)
        if i < 0:
            return False
        at = i + len(p) + 1
    return True


def runs(text, fold):
    out = []
    for m in re.finditer(r'[“"‘\']([^”"’]{12,})[”"’]|^> ?(.+)$', text, re.M):
        w = fold(m.group(1) or m.group(2)).split()
        if len(w) >= 4:
            out.append(w)
    return out


def covered(part, rs):
    q = part.split()
    hit = [False] * len(q)
    for r in rs:
        for i in range(len(q)):
            for j in range(len(r)):
                k = 0
                while i + k < len(q) and j + k < len(r) and q[i + k] == r[j + k]:
                    k += 1
                if k >= 4 or (k == len(q) - i and k == len(r) - j and k >= 2 and i > 0):
                    hit[i:i + k] = [True] * k
    return all(hit)


def fuzzy(ps, words):
    worst = 1.0
    for p in ps:
        q = p.split()
        best = 0.0
        sm = difflib.SequenceMatcher(None, q, [], autojunk=False)
        for i in range(0, max(1, len(words) - len(q) + 1)):
            sm.set_seq2(words[i:i + len(q)])
            if sm.real_quick_ratio() <= best:
                continue
            r = sm.ratio()
            if r > best:
                best = r
                if best == 1.0:
                    break
        worst = min(worst, best)
    return worst


def named_pages(found):
    out = []
    for m in re.finditer(r'page=(\d+)|index (\d+)|leaf (\d+)', found or ''):
        n = int(m.group(1) or m.group(2) or int(m.group(3)) - 1)
        if str(n) not in out:
            out.append(str(n))
    return out


def ocr_only(qj, w):
    """True when w differs from qj only as a scan's OCR does: a few letters misread (at most 3 in a row), a stray
    letter or two, and extra text at either end of the window. A missing word fails."""
    sm = difflib.SequenceMatcher(None, qj, w, autojunk=False)
    ops = [o for o in sm.get_opcodes() if o[0] != 'equal']
    if ops and ops[0][0] == 'insert' and ops[0][1] == 0:
        ops = ops[1:]
    if ops and ops[-1][0] == 'insert' and ops[-1][1] == len(qj):
        ops = ops[:-1]
    for tag, i1, i2, j1, j2 in ops:
        if tag == 'replace' and max(i2 - i1, j2 - j1) > 3:
            return False
        if tag in ('delete', 'insert') and max(i2 - i1, j2 - j1) > 2:
            return False
    return len(ops) <= max(2, len(qj) // 25)


def part_found(p, texts):
    """How one part of a quote is found in a list of (page, words) texts: exact, letters (OCR only, in one text or
    across one page and the next), or runs (every word inside a run of four or more that some text holds)."""
    for page, w in texts:
        if f' {p} ' in f' {" ".join(w)} ':
            return ('exact', page)
    q = p.split()
    qj = ''.join(q)
    joined = list(texts) + [(f'{a}+{b}', wa + wb) for a, wa in texts for b, wb in texts
                            if a.isdigit() and b.isdigit() and int(b) == int(a) + 1]
    for page, w in joined:
        sm = difflib.SequenceMatcher(None, q, [], autojunk=False)
        cands = []
        for i in range(0, max(1, len(w) - len(q) + 1)):
            sm.set_seq2(w[i:i + len(q)])
            if sm.real_quick_ratio() < 0.5 or sm.quick_ratio() < 0.5:
                continue
            cands.append((sm.ratio(), i))
        for _, i in sorted(cands, reverse=True)[:6]:
            for a in range(-2, 3):
                for z in range(-2, 4):
                    if ocr_only(qj, ''.join(w[max(0, i + a):i + len(q) + z])):
                        return ('letters', page)
    grams = set()
    for _, w in texts:
        for i in range(len(w) - 3):
            grams.add(tuple(w[i:i + 4]))
    if len(q) >= 4:
        hit = [False] * len(q)
        for i in range(len(q) - 3):
            if tuple(q[i:i + 4]) in grams:
                hit[i:i + 4] = [True] * 4
        if all(hit):
            return ('runs', None)
    return None


def check(source, work, quote, found):
    items = ITEMS.get(work) or ITEMS.get(source) or []
    named = named_pages(found)
    ps = pparts(quote, fold3)
    for item in items:
        pages = idx.get(item, {})
        if not pages:
            continue
        texts = [(page, fold3(t).split()) for page, fs in pages.items() for _, _, t in fs]
        first = [x for x in texts if x[0] in named] or texts
        got = []
        for p in ps:
            r = part_found(p, first) or part_found(p, texts)
            if not r:
                break
            got.append(r)
        if ps and len(got) == len(ps):
            used = sorted({g[1] for g in got if g[1]})
            return {'item': item, 'how': sorted({g[0] for g in got}), 'pages': used,
                    'named': all(any(n in u.split('+') for n in named) or u == 'other' for u in used) if named else None}
        bad = ps[len(got)] if len(got) < len(ps) else None
        best = {'item': item, 'how': 'missing', 'failed_part': bad}
    return best if items and any(idx.get(i) for i in items) else {'how': 'no page fetched', 'items': items}


if __name__ == '__main__':
    q = json.load(open(f'{HERE}/out/quotes.json'))
    rep = json.load(open(f'{HERE}/out/report.json'))
    bad = {(x['entry'], x['source'], x['on']) for x in rep['web_not_found']}
    out = []
    for x in q:
        if (x['entry'], x['source'], x['on']) not in bad:
            continue
        r = check(x['source'], x.get('work'), x['quote'], x['found'])
        r.update({'entry': x['entry'], 'source': x['source'], 'on': x['on'], 'named_pages': named_pages(x['found'])})
        out.append(r)
        print(r['entry'], r['source'], r['how'], r.get('item'), r.get('pages'), r.get('named'), r['named_pages'][:4], (r.get('failed_part') or '')[:160], flush=True)
    json.dump(out, open(f'{HERE}/scanq.json', 'w'), indent=1)
