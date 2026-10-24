"""Fetch a Bible Hub commentary page and show the comment on one verse, with the Scripture-check scan.

python read_cite.py <code> "<Book c:v>" [--intro] [--chars N]
"""
import re, sys, io, html, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch

SCAN = [
    ("authorship", r"not (written|composed) by|not the (work|writing) of|was not .{0,40}(Moses|David|Solomon|Isaiah|Daniel|Paul|Peter|John|James|Jude)|not (Davidic|Mosaic|Solomonic|Pauline|Petrine)|(later|another|different|more recent) (hand|author|writer)|altogether different author|pseudonym|forg(ed|ery)|spurious|not genuine|interpolat|redactor|deutero-?(isaiah|zechariah)|second Isaiah|post-?exilic|Maccab|personat|assumes the (role|character)|Koheleth"),
    ("canon", r"no true apostol|not (an )?apostol|\bstraw\b|not canonical|apocryphal|doubt\w* .{0,30}(epistle|book|canon)"),
    ("error", r"(error|mistake|by mistake|fault|crept in|amend|corrupt|inaccura|contradict|discrepan).{0,60}(evangelist|apostle|Moses|scripture|text|writer|historian|narrative|account|passage|place|name|word|copy|copies|transcrib)"),
    ("myth", r"\b(myth|legend|fable)"),
]
SLUG = {"Song of Solomon": "songs"}


def url_for(code, on):
    m = re.match(r"^((?:[123] )?[A-Za-z ]+?) (\d+):(\d+)", on)
    book, ch = m.group(1), int(m.group(2))
    book = {"Psalm": "Psalms"}.get(book, book)
    slug = SLUG.get(book, book.lower().replace(" ", "_"))
    return f"https://biblehub.com/commentaries/{code}/{slug}/{ch}.htm"


def clean(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def segments(page):
    """[(verse ref, verse text, comment text)] in page order, and the text before the first verse."""
    parts = re.split(r'<div class="versenum">', page)
    intro = parts[0]
    out = []
    for p in parts[1:]:
        m = re.match(r'\s*<a href="[^"]*">([^<]+)</a></div>\s*<div class="verse">(.*?)</div>(.*)', p, re.S)
        if not m:
            continue
        rest = m.group(3)
        rest = re.split(r'<div id="botbox">', rest)[0]
        out.append((m.group(1).strip(), clean(m.group(2)), clean(rest)))
    i = intro.rfind('<div id="leftbox">')
    return clean(intro[intro.find("</h1>") + 5:] if "</h1>" in intro else intro), out


def comment(code, on):
    url = url_for(code, on)
    meta, body = fetch.fetch(url)
    page = body.decode("utf-8", errors="replace")
    intro, segs = segments(page)
    m = re.match(r"^((?:[123] )?[A-Za-z ]+?) (\d+):(\d+)", on)
    want = int(m.group(3))
    found = None
    for k, (ref, verse, com) in enumerate(segs):
        v = int(re.search(r":(\d+)", ref).group(1))
        if v == want:
            found = k
            break
    text = ""
    if found is not None:
        for ref, verse, com in segs[found:]:
            text += f" [{ref}] {com}"
            if len(com) > 40:
                break
    return meta, url, intro, text.strip()


def scan(text):
    hits = []
    for name, pat in SCAN:
        for m in re.finditer(pat, text, re.I):
            hits.append((name, text[max(0, m.start() - 160):m.end() + 160]))
    return hits


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    code, on = sys.argv[1], sys.argv[2]
    n = int(sys.argv[sys.argv.index("--chars") + 1]) if "--chars" in sys.argv else 3000
    meta, url, intro, text = comment(code, on)
    print(json.dumps(meta))
    if "--intro" in sys.argv:
        print("INTRO:", intro[:n])
    print("COMMENT:", text[:n])
    for h in scan(text + (" " + intro if "--intro" in sys.argv else "")):
        print("SCAN", h[0], "|", h[1])
