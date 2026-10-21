import sys, json, re
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/tools')
import bible as B

EXCL = """Genesis 2:7; Genesis 3:15; Genesis 4:10; Genesis 5:29; Genesis 11:9; Genesis 12:3; Genesis 21:6; Genesis 22:8; Genesis 28:12; Genesis 29:35; Genesis 49:10; Genesis 50:20; Exodus 2:10; Exodus 3:14; Exodus 4:22; Exodus 12:13; Exodus 25:40; Leviticus 16:22; Leviticus 23:10; Leviticus 25:10; Numbers 13:16; Deuteronomy 18:15; Deuteronomy 21:23; Joshua 2:18; Ruth 3:9; 1 Samuel 2:10; 2 Samuel 7:13; 1 Kings 17:23; Job 19:25; Psalms 2:7; Psalms 8:4; Psalms 16:10; Psalms 22:1; Psalms 41:9; Psalms 69:9; Proverbs 8:30; Song of Solomon 8:6; Isaiah 5:7; Isaiah 7:9; Isaiah 7:14; Isaiah 53:5; Jeremiah 1:12; Jeremiah 23:6; Daniel 7:13; Hosea 2:23; Jonah 3:4; Malachi 3:1; Matthew 16:18; Mark 6:50; Mark 12:10; Mark 14:24; Luke 10:33; John 2:19; John 3:3; John 3:14; John 4:10; John 6:35; John 9:7; John 11:43; Acts 2:24; 1 Corinthians 10:4; 1 Corinthians 15:54; 1 Corinthians 16:22; 2 Corinthians 3:18; Philippians 2:10; Hebrews 7:2; Hebrews 9:16; Revelation 1:5; Revelation 21:16; Revelation 22:2"""
EXCL = [x.strip() for x in EXCL.split(';')]
NAMES = [b['name'] for b in B.BOOKS] + ['Psalm']
KINDS = ["plain meaning", "quotation", "allusion", "wordplay", "name meaning", "pattern", "irony", "fulfillment", "setting"]
STR = ["widely agreed", "commonly held", "some interpreters"]
SECT = {"law-history": (0, 16), "prophets-poetry": (17, 38), "jesus": (39, 42), "letters-revelation": (43, 65)}
SOURCE = "Drafted with AI help (Claude) from the BSB, STEPBible TAHOT, TAGNT, TBESH and TBESG, and OpenBible.info cross-references."
existing = json.load(open('/home/claude/bibleatlas/config/layers.json'))['passages']
ex_ids = {p['id'] for p in existing}
ex_refs = {p['ref'] for p in existing}

def rng(r, errs, at):
    m = re.match(r'^(.+?) (\d+):(\d+)(?:-(\d+)(?::(\d+))?)?$', r)
    if not m or m.group(1) not in NAMES:
        errs.append(f'{at}: bad ref format {r!r}')
    try:
        return B.rng(r)
    except SystemExit as e:
        errs.append(f'{at}: {r}: {e}')
        return None

def bsb(rg):
    return B.normalize(' '.join(B.BSB[rg[0]:rg[1] + 1]))

def quotes(t):
    out = []; op = None
    for i, c in enumerate(t):
        if c in '"“' and op is None: op = i + 1
        elif c in '"”' and op is not None: out.append(t[op:i]); op = None
        elif c == '“': raise ValueError('nested')
        elif c == '”': raise ValueError('stray close')
    if op is not None: raise ValueError('unclosed')
    return out

def wc(q): return sum(len(p.split(' ')) for p in B.parts(q))

def book_idx(i):
    for k, b in reversed(list(enumerate(B.BOOKS))):
        if b['start'] <= i: return k

def roots_in(rg):
    keys = []
    for v in range(rg[0], rg[1] + 1):
        for w in B.verse_words(v)[1]:
            r = w[3]
            if isinstance(r, int) and r >= 0:
                keys.append((B.LEM['key'][r], w[5] if len(w) > 5 else None))
    return keys

def match(k, s): return k == s or (len(k) == len(s) + 1 and k.startswith(s) and k[-1].isalpha())

def check(p):
    errs = []; warn = []
    at = p.get('id')
    if p['ref'] in EXCL or p['ref'] in ex_refs: errs.append(f'{at}: passage already exists')
    if p['id'] in ex_ids: errs.append(f'{at}: id exists')
    slug = re.sub(r'[^a-z0-9]+', '-', p['ref'].lower()).strip('-')
    if p['id'] != slug: warn.append(f'{at}: id {p["id"]} vs slug {slug}')
    if p['source'] != SOURCE: warn.append(f'{at}: nonstandard source')
    pr = rng(p['ref'], errs, at)
    if pr:
        bi = book_idx(pr[0])
        lo, hi = SECT[p['section']]
        if not lo <= bi <= hi: errs.append(f'{at}: wrong section')
        if not B.contains(bsb(pr), p['saying']): errs.append(f'{at}: saying not in BSB')
    L = p['layers']
    if not 2 <= len(L) <= 4: errs.append(f'{at}: {len(L)} layers')
    if L[0]['kind'] != 'plain meaning': errs.append(f'{at}: first not plain')
    if not any(l['kind'] != 'plain meaning' and l['strength'] != 'some interpreters' for l in L): errs.append(f'{at}: needs strong layer')
    for i, l in enumerate(L):
        la = f'{at}[{i}]'
        if l['kind'] not in KINDS: errs.append(f'{la}: kind')
        if l['strength'] not in STR: errs.append(f'{la}: strength')
        n = len(l['text'])
        if n > 260: errs.append(f'{la}: text {n} chars')
        if l.get('evidence') and len(l['evidence']) > 400: errs.append(f'{la}: evidence {len(l["evidence"])} chars')
        for f in ('text', 'evidence'):
            if re.search(r'(?i)\besv\b', l.get(f, '') or ''): errs.append(f'{la}: ESV')
        rgs = [rng(r, errs, la) for r in l['refs']]
        try:
            qs = quotes(l['text'])
        except ValueError as e:
            errs.append(f'{la}: quotes {e}'); qs = []
        texts = [bsb(r) for r in ([pr] + rgs) if r]
        for q in qs:
            if wc(q) >= 4 and not any(B.contains(t, q) for t in texts):
                errs.append(f'{la}: quote not found: {q!r}')
        for w in l.get('words', []):
            r = rng(w['ref'], errs, la)
            if not r: continue
            ks = roots_in(r)
            hit = [f for k, f in ks if match(k, w['strong'])]
            if not hit: errs.append(f'{la}: {w["strong"]} not in {w["ref"]}')
            elif all(f not in (0, None) for f in hit): warn.append(f'{la}: {w["strong"]} in {w["ref"]} only with flag {hit}')
            if w['ref'] not in l['refs'] and not any(r and pr and False for _ in [0]):
                # word ref should be covered by a layer ref range
                if not any(rr and rr[0] <= r[0] and r[1] <= rr[1] for rr in rgs): warn.append(f'{la}: word ref {w["ref"]} not within layer refs')
        if l['strength'] == 'widely agreed' and l['kind'] != 'plain meaning':
            outside = any(r and pr and not (r[0] >= pr[0] and r[1] <= pr[1]) for r in rgs)
            if not l.get('words') and not outside and not l.get('evidence'): errs.append(f'{la}: widely agreed lacks support')
    return errs, warn

if __name__ == '__main__':
    data = json.load(open(sys.argv[1]))
    ps = data['passages'] if isinstance(data, dict) else data
    ids = set()
    tot = 0
    for p in ps:
        if p['id'] in ids: print('DUP', p['id'])
        ids.add(p['id'])
        e, w = check(p)
        tot += len(e)
        for x in e: print('ERR', x)
        for x in w: print('warn', x)
    print(f'{len(ps)} passages, {tot} errors')
