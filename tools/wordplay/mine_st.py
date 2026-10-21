"""Split sacred-texts commentary HTML into verse notes and find wordplay remarks.
Usage: python3 -I mine_st.py <cmt dir> <out.json> [allusions]"""
import re, sys, os, json, html, collections
CODES = 'gen exo lev num deu jos jdg rut sa1 sa2 kg1 kg2 ch1 ch2 ezr neh est job psa pro ecc sol isa jer lam eze dan hos joe amo oba jon mic nah hab zep hag zac mal mat mar luk joh act rom co1 co2 gal eph phi col th1 th2 ti1 ti2 tit plm heb jam pe1 pe2 jo1 jo2 jo3 jde rev'.split()
NAMES = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation']
BOOK = dict(zip(CODES, NAMES))
SPLIT = re.compile(r'<a name="an_\d+">([a-z0-9]{3}) (\d+):(\d+)</a>|<p align="center"><a href="[^"]*/kjv/([a-z0-9]{3})(\d{3})\.htm#(\d{3})">[^<]*</a></p>')
WORDPLAY = re.compile(r'paronomasia|play(?:s|ing)? (?:up)?on (?:the |his |her |their )?(?:word|name|sound|letter)|plays? upon|\bpun(?:s|ning)?\b|assonance|similarity of sound|alliteration|allusion to (?:the |his |her |their )?(?:name|meaning|signification)|allud\w+ to (?:the |his |her |their )?(?:name|meaning|signification)', re.I)
def text(h):
    h = re.sub(r'<(?:p|br|div)[^>]*>', '\n', h)
    h = re.sub(r'<[^>]+>', '', h)
    return re.sub(r'[ \t]+', ' ', html.unescape(h)).strip()
def notes(path):
    raw = open(path, encoding='utf-8', errors='replace').read()
    out = []
    pos = 0; key = None
    for m in SPLIT.finditer(raw):
        if key: out.append((key, raw[pos:m.start()]))
        if m.group(1):
            key = (m.group(1), int(m.group(2)), int(m.group(3)))
        else:
            key = (m.group(4), int(m.group(5)), int(m.group(6)))
        pos = m.end()
    if key: out.append((key, raw[pos:]))
    return out
def sentences_around(t, m, n=1):
    # the sentence containing the match, plus n sentences each side
    starts = [0] + [x.end() for x in re.finditer(r'(?<=[.;?!])\s+(?=[A-Z"“(])', t)]
    i = max(k for k, s in enumerate(starts) if s <= m.start())
    a = starts[max(0, i - n)]; b = starts[i + n + 1] if i + n + 1 < len(starts) else len(t)
    return t[a:b].strip()
root, out = sys.argv[1], sys.argv[2]
hits = []
for work in sorted(os.listdir(root)):
    d = os.path.join(root, work)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        m = re.match(r'([a-z0-9]{3})(\d{3})\.md$', f)
        if not m or m.group(1) not in BOOK: continue
        merged = collections.OrderedDict()
        for (code, c, v), h in notes(os.path.join(d, f)):
            if code not in BOOK: continue
            merged.setdefault((code, c, v), []).append(text(h))
        for (code, c, v), ts in merged.items():
            t = '\n'.join(x for x in ts if x)
            for mm in WORDPLAY.finditer(t):
                hits.append({'work': work, 'ref': f'{BOOK[code]} {c}:{v}', 'term': mm.group(0), 'excerpt': sentences_around(t, mm, 1)[:1200], 'file': f'{work}/{f}'})
seen = set(); uniq = []
for h in hits:
    k = (h['work'], h['ref'], h['excerpt'])
    if k not in seen: seen.add(k); uniq.append(h)
json.dump(uniq, open(out, 'w'), ensure_ascii=False, indent=0)
print(len(uniq), collections.Counter(h['work'] for h in uniq))
