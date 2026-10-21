#!/usr/bin/env python3
"""mine3.py <out.json>: round 3 candidate plays, name meanings and allusions from every local believing work.

Each work is split into remarks (the commentator's own verse units). A remark is a lead when it holds a
wordplay marker, a name-meaning marker, or an allusion marker followed closely by a Scripture reference.
Leads are grouped by (verse, kind[, target chapter]) and kept when two or more different writers give one,
and the app does not already have a note of that kind on that verse (for an allusion: one naming that chapter)."""
import html, json, os, re, sqlite3, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq, osn

LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'

# ---- Scripture references in commentary prose ----
AB = {}
for i, b in enumerate(cq.BOOKS):
    forms = {b, b.replace(' ', ''), cq.ST[i].capitalize(), cq.FOS[i]}
    AB.update({f: i for f in forms})
EXTRA = {
    'Gen': 0, 'Ge': 0, 'Gn': 0, 'Exod': 1, 'Ex': 1, 'Exo': 1, 'Lev': 2, 'Le': 2, 'Num': 3, 'Nu': 3, 'Deut': 4, 'Deu': 4, 'Dt': 4,
    'Josh': 5, 'Jos': 5, 'Judg': 6, 'Jdg': 6, 'Jud': 6, 'Ruth': 7, 'Rut': 7,
    '1Sa': 8, '1Sam': 8, '1 Sam': 8, 'I Sam': 8, '2Sa': 9, '2Sam': 9, '2 Sam': 9, 'II Sam': 9,
    '1Ki': 10, '1Kgs': 10, '1 Kings': 10, '1 Kgs': 10, 'I Kings': 10, '2Ki': 11, '2Kgs': 11, '2 Kgs': 11, 'II Kings': 11,
    '1Ch': 12, '1Chr': 12, '1 Chron': 12, '1 Chr': 12, '2Ch': 13, '2Chr': 13, '2 Chron': 13, '2 Chr': 13,
    'Ezr': 14, 'Neh': 15, 'Esth': 16, 'Est': 16, 'Job': 17, 'Psa': 18, 'Ps': 18, 'Psalm': 18, 'Pss': 18,
    'Prov': 19, 'Pro': 19, 'Pr': 19, 'Eccl': 20, 'Eccles': 20, 'Ecc': 20, 'Song': 21, 'Cant': 21, 'Sol': 21, 'Son': 21, 'Sng': 21,
    'Isa': 22, 'Jer': 23, 'Lam': 24, 'Ezek': 25, 'Eze': 25, 'Dan': 26, 'Hos': 27, 'Joel': 28, 'Joe': 28, 'Amos': 29, 'Amo': 29,
    'Obad': 30, 'Oba': 30, 'Jonah': 31, 'Jon': 31, 'Mic': 32, 'Nah': 33, 'Hab': 34, 'Zeph': 35, 'Zep': 35, 'Hag': 36,
    'Zech': 37, 'Zec': 37, 'Zac': 37, 'Mal': 38, 'Matt': 39, 'Mat': 39, 'Mt': 39, 'Mark': 40, 'Mar': 40, 'Mk': 40,
    'Luke': 41, 'Luk': 41, 'Lk': 41, 'John': 42, 'Joh': 42, 'Jn': 42, 'Acts': 43, 'Act': 43, 'Rom': 44, 'Ro': 44,
    '1Co': 45, '1Cor': 45, '1 Cor': 45, 'I Cor': 45, '2Co': 46, '2Cor': 46, '2 Cor': 46, 'II Cor': 46, 'Gal': 47, 'Eph': 48,
    'Phil': 49, 'Php': 49, 'Phi': 49, 'Col': 50, '1Th': 51, '1Thess': 51, '1 Thess': 51, '2Th': 52, '2Thess': 52, '2 Thess': 52,
    '1Ti': 53, '1Tim': 53, '1 Tim': 53, '2Ti': 54, '2Tim': 54, '2 Tim': 54, 'Tit': 55, 'Titus': 55, 'Phm': 56, 'Philem': 56, 'Plm': 56,
    'Heb': 57, 'Jas': 58, 'Jam': 58, 'James': 58, '1Pe': 59, '1Pet': 59, '1 Pet': 59, '2Pe': 60, '2Pet': 60, '2 Pet': 60,
    '1Jo': 61, '1Jn': 61, '1 John': 61, '2Jo': 62, '2 John': 62, '3Jo': 63, '3 John': 63, 'Jude': 64, 'Jde': 64, 'Rev': 65, 'Apoc': 65,
    'Sa1': 8, 'Sa2': 9, 'Kg1': 10, 'Kg2': 11, 'Ch1': 12, 'Ch2': 13, 'Co1': 45, 'Co2': 46, 'Th1': 51, 'Th2': 52, 'Ti1': 53, 'Ti2': 54,
    'Pe1': 59, 'Pe2': 60, 'Jo1': 61, 'Jo2': 62, 'Jo3': 63,
}
AB.update(EXTRA)
names = sorted(AB, key=len, reverse=True)
REF = re.compile(r'(?<![A-Za-z])(' + '|'.join(re.escape(n) for n in names) + r')\.?\s?(\d{1,3})[:.]\s?(\d{1,3})')

WP = re.compile(r'paronomasia|play(?:s|ing)? (?:up)?on|\bpuns?\b|punning|alliterat|assonan|similarity of sound|sound(?:s|ing)? (?:like|alike)|same sound|antanaclasis|paregmenon|parechesis|polyptoton|syllepsis|word-?play|play of words|double (?:sense|meaning)|equivoc|allusion to (?:the |his |her |their )?(?:name|meaning|signification)|allud\w* to (?:the |his |her |their )?(?:name|meaning|signification)', re.I)
NM = re.compile(r"\bname\w*\b[^.;:]{0,80}?\b(?:signif\w*|means\b|meaning\b|denot\w*|interpret\w*)|\b(?:which|this|that|the word|the name) (?:signif\w*|means\b|denotes\b)|\bsignifies\b[^.;]{0,30}\b(?:Lord|God|son|father|house|rest|praise|help)\b", re.I)
AL = re.compile(r'allud\w*|allusion|in reference to|has reference to|referr?(?:s|ing|ed) to|has respect to|with respect to|borrowed from|taken from|quoted from|cited from|a quotation|quoting|echo(?:es|ed|ing)?\b|recall(?:s|ing)\b|reminiscen\w*|in imitation of|evidently from|the words of|the language of|plainly from|manifestly from|the same words|the very words', re.I)
CUSTOM = re.compile(r'custom|manner of|practice of|the Jews used|games|soldiers|races|Romans|Greeks|heathen|ancient', re.I)


def units():
    """(work, verse (b,c,v), text) for every remark in every local work."""
    head = re.compile(r'<p>\s*<a href="[^"]*">([^<]+)</a>\s*</p>')
    lab = re.compile(r'^([A-Za-z0-9]{3}) (\d+):(\d+)')
    anc = re.compile(r'<a name="an_\d+">([a-z0-9]+) (\d+):(\d+)</a>')
    for w in cq.VAULT_WORKS:
        for b in range(66):
            if w == 'kad' and b > 38:
                continue
            for c in range(1, 151):
                p = f'{cq.VAULT}/{w}/{cq.ST[b]}{c:03d}.md'
                if not os.path.exists(p):
                    if c > 1:
                        break
                    continue
                s = open(p, encoding='utf-8', errors='replace').read()
                ms = list(anc.finditer(s))
                for k, m in enumerate(ms):
                    sec = s[m.start(): ms[k + 1].start() if k + 1 < len(ms) else len(s)]
                    base = (b, int(m.group(2)), int(m.group(3)))
                    hs = list(head.finditer(sec))
                    if w in ('kad', 'barnes', 'clarke') and hs:
                        pre = sec[:hs[0].start()]
                        if cq.clean(pre).strip():
                            yield w, base, cq.clean(pre)
                        for j, h in enumerate(hs):
                            seg = sec[h.end(): hs[j + 1].start() if j + 1 < len(hs) else len(sec)]
                            lm = lab.match(h.group(1).strip())
                            v = (b, int(lm.group(2)), int(lm.group(3))) if lm and lm.group(1).lower() == cq.ST[b] else base
                            yield w, v, cq.clean(seg)
                    else:
                        yield w, base, cq.clean(sec)
    for w in cq.LC_WORKS:
        d = json.load(open(f'{cq.LC_DIR}/{w}.json', encoding='utf-8'))['entries']
        for e in d:
            b = cq.LC_BOOKS.index(e['book'])
            yield w, (b, e['chapter'], e['verse']), re.sub(r'\s+', ' ', e['body'])
    con = sqlite3.connect(f'{cq.ROOT}/src/cb/cCBNotes.commentary')
    for bk, ch, h in con.execute('select Book, Chapter, Scripture from Commentary'):
        bits = re.split(r'<ref onclick="bcv\((\d+),(\d+),(\d+)\)">', h)
        for i in range(1, len(bits), 4):
            yield 'cb', (int(bits[i]) - 1, int(bits[i + 1]), int(bits[i + 2])), cq.clean(bits[i + 3])
    lines = open(f'{cq.ROOT}/fos.txt', encoding='utf-8').read().replace('\r', '').split('\n')
    heading = ''
    ex = re.compile(r'^ ?((?:[1-3])?[A-Z][a-z]{1,2}) (\d+):(\d+)')
    for i, l in enumerate(lines):
        if l.startswith('########'):
            heading = l.strip('# ').strip()
            continue
        m = ex.match(l)
        if m and m.group(1) in cq.FOS:
            body = ' '.join(x.strip() for x in lines[i:cq.fos_end(lines, i)] if x.strip())
            yield 'fos', (cq.FOS.index(m.group(1)), int(m.group(2)), int(m.group(3))), f'[{heading}] {body}'
    for b in range(66):
        for x in json.load(open(f'{osn.D}/{b + 1:02d}.content.json')):
            r = x['index_reference'].split('-')
            s0, e0 = int(r[0]), int(r[-1])
            if s0 != e0 and (e0 - s0) > 30:  # section overviews: skip
                continue
            txt = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', x['content']))).strip()
            yield 'osn', (b, (s0 // 1000) % 1000, s0 % 1000), txt


WRITER = {'cb': 'bullinger', 'fos': 'bullinger'}


