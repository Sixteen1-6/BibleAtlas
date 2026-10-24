"""resolve.py: who wrote each cite's words under main's config/layer-sources.json (PR #63 rules),
mirroring layers.rs resolve(): parts by book and chapter, works, excluded writers, denies, not_on and the link."""
import json, os, re, sys

LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
BOOKS = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel",
 "1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes",
 "Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah",
 "Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans",
 "1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
 "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"]
ALIAS = {'Psalm': 'Psalms', 'Song of Songs': 'Song of Solomon', 'Song': 'Song of Solomon'}

S = json.load(open(os.path.join(LW, 'config/layer-sources.json')))
WRITERS = {w['id']: w for w in S['writers']}
WORKS = {w['id']: w for w in S['works']}
CITE = {c['id']: c for c in S['cite']}


def parse(ref):
    """'1 Samuel 3:4-6' -> (book, chapter, v1, v2); chapter or verses may be None."""
    m = re.match(r'^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?(?:-(\d+)(?::(\d+))?)?\s*$', ref.strip())
    if not m:
        b = ALIAS.get(ref.strip(), ref.strip())
        return (b, None, None, None) if b in BOOKS else None
    b = ALIAS.get(m.group(1), m.group(1))
    if b not in BOOKS:
        return None
    ch = int(m.group(2))
    v1 = int(m.group(3)) if m.group(3) else None
    v2 = int(m.group(4)) if m.group(4) else v1
    return (b, ch, v1, v2)


def overlaps(deny_on, ref):
    d, r = parse(deny_on), parse(ref)
    if not d or not r or d[0] != r[0]:
        return False
    if d[1] is None:
        return True
    if d[1] != r[1]:
        return False
    if d[2] is None or r[2] is None:
        return True
    return not (r[3] < d[2] or r[2] > d[3])


def chapter_page(src, book, ch):
    if src.get('biblehub'):
        slug = 'songs' if book == 'Song of Solomon' else book.lower().replace(' ', '_')
        return f"https://biblehub.com/commentaries/{src['biblehub']}/{slug}/{ch}.htm"
    if src.get('link'):
        return src['link'].replace('{book}', book.lower().replace(' ', '-')).replace('{chapter}', str(ch))
    return None


def resolve(c):
    """-> dict(ok, why, writers, names, key, link, part)"""
    out = {'ok': False}
    src = CITE.get(c['source'])
    if not src:
        out['why'] = f"source {c['source']} is not on the cite list"
        return out
    out['role'] = src['role']
    r = parse(c.get('on', '')) if c.get('on') else None
    if not r:
        out['why'] = f"cannot read on {c.get('on')!r}"
        return out
    book, ch = r[0], r[1] or 0
    out['book'] = book
    if book in src.get('not_on', []):
        out['why'] = f"{src['name']} is not cited on {book}"
        return out
    for d in S['denies']:
        if d['source'] == c['source'] and overlaps(d['on'], c['on']):
            out['why'] = f"denied: {d['why'][:90]}"
            return out
    if src.get('works'):
        wid = c.get('work')
        if not wid or wid not in src['works']:
            out['why'] = f"needs work, one of {src['works']}"
            out['works'] = src['works']
            return out
        w = WORKS[wid]
        ws = [WRITERS[i] for i in w.get('writers', []) if i in WRITERS]
        key = '+'.join(x['id'] for x in ws) if ws else f'{wid}:all'
        unnamed = w.get('unnamed')
        part = None
    else:
        if c.get('work'):
            out['why'] = 'names its writer by book; drop work'
            return out
        found = [p for p in src.get('parts', []) if (p['books'] == 'all' or (isinstance(p['books'], list) and book in p['books']))
                 and (not p.get('chapters') or p['chapters'][0] <= ch <= p['chapters'][1])]
        if len(found) != 1:
            out['why'] = f"{len(found)} parts cover {book} {ch}"
            return out
        part = found[0]
        ws = [WRITERS[i] for i in part.get('writers', []) if i in WRITERS]
        if part.get('counts_as'):
            key = part['counts_as']
        elif ws:
            key = '+'.join(x['id'] for x in ws)
        else:
            key = f"{part['work']}:{book}"
        unnamed = part.get('unnamed')
    x = [w for w in ws if w.get('excluded')]
    if x:
        out['why'] = f"excluded writer {x[0]['name']}"
        return out
    link = c.get('url') or chapter_page(src, book, ch) or src.get('url')
    out.update(ok=True, writers=[w['id'] for w in ws], names=[w['name'] for w in ws], unnamed=unnamed, key=key, link=link,
               attributed=bool(part and part.get('attributed')), work=(part['work'] if part else c.get('work')), chapter=ch)
    return out


if __name__ == '__main__':
    for a in sys.argv[1:]:
        src, on = a.split('@', 1)
        print(a, json.dumps(resolve({'source': src, 'on': on})))
