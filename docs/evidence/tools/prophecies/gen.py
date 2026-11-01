"""Write config/prophecies.json from the New Testament's own words (TIER1) and the checked writer statements (yes.json)."""
import json, re, sys, collections
sys.path.insert(0, '/tmp/mine/scripts')
from bible import ref, TEXT, START, IDX, is_nt
from books import book_of, BOOKS, USFM

ROOT = '/home/claude/bibleatlas'

# (Old Testament, New Testament, the verse that says so, its words)
TIER1 = [
    ('Isaiah 7:14', 'Matthew 1:23', 'Matthew 1:22', 'All this took place to fulfill what the Lord had said through the prophet'),
    ('Hosea 11:1', 'Matthew 2:15', 'Matthew 2:15', 'This fulfilled what the Lord had spoken through the prophet'),
    ('Jeremiah 31:15', 'Matthew 2:18', 'Matthew 2:17', 'Then what was spoken through the prophet Jeremiah was fulfilled'),
    ('Isaiah 40:3', 'Matthew 3:3', 'Matthew 3:3', 'This is he who was spoken of through the prophet Isaiah'),
    ('Isaiah 9:1-2', 'Matthew 4:15-16', 'Matthew 4:14', 'to fulfill what was spoken through the prophet Isaiah'),
    ('Isaiah 53:4', 'Matthew 8:17', 'Matthew 8:17', 'This was to fulfill what was spoken through the prophet Isaiah'),
    ('Malachi 3:1', 'Matthew 11:10', 'Matthew 11:10', 'This is the one about whom it is written'),
    ('Isaiah 42:1-4', 'Matthew 12:18-21', 'Matthew 12:17', 'This was to fulfill what was spoken through the prophet Isaiah'),
    ('Isaiah 6:9-10', 'Matthew 13:14-15', 'Matthew 13:14', 'In them the prophecy of Isaiah is fulfilled'),
    ('Psalm 78:2', 'Matthew 13:35', 'Matthew 13:35', 'So was fulfilled what was spoken through the prophet'),
    ('Isaiah 29:13', 'Matthew 15:8-9', 'Matthew 15:7', 'Isaiah prophesied correctly about you'),
    ('Zechariah 9:9', 'Matthew 21:5', 'Matthew 21:4', 'This took place to fulfill what was spoken through the prophet'),
    ('Zechariah 13:7', 'Matthew 26:31', 'Matthew 26:56', 'But this has all happened so that the writings of the prophets would be fulfilled'),
    ('Zechariah 11:12-13', 'Matthew 27:9-10', 'Matthew 27:9', 'Then what was spoken through Jeremiah the prophet was fulfilled'),
    ('Jeremiah 32:6-9', 'Matthew 27:9-10', 'Matthew 27:9', 'Then what was spoken through Jeremiah the prophet was fulfilled'),
    ('Isaiah 29:13', 'Mark 7:6-7', 'Mark 7:6', 'Isaiah prophesied correctly about you hypocrites'),
    ('Zechariah 13:7', 'Mark 14:27', 'Mark 14:49', 'But this has happened that the Scriptures would be fulfilled'),
    ('Isaiah 61:1-2', 'Luke 4:18-19', 'Luke 4:21', 'Today this Scripture is fulfilled in your hearing'),
    ('Malachi 3:1', 'Luke 7:27', 'Luke 7:27', 'This is the one about whom it is written'),
    ('Isaiah 53:12', 'Luke 22:37', 'Luke 22:37', 'this Scripture must be fulfilled in Me'),
    ('Zechariah 9:9', 'John 12:15', 'John 12:16', 'these very things had also been written about Him'),
    ('Isaiah 53:1', 'John 12:38', 'John 12:38', 'This was to fulfill the word of Isaiah the prophet'),
    ('Isaiah 6:10', 'John 12:40', 'John 12:41', 'Isaiah said these things because he saw Jesus’ glory and spoke about Him'),
    ('Psalm 41:9', 'John 13:18', 'John 13:18', 'But this is to fulfill the Scripture'),
    ('Psalm 35:19', 'John 15:25', 'John 15:25', 'But this is to fulfill what is written in their Law'),
    ('Psalm 69:4', 'John 15:25', 'John 15:25', 'But this is to fulfill what is written in their Law'),
    ('Psalm 22:18', 'John 19:24', 'John 19:24', 'This was to fulfill the Scripture'),
    ('Psalm 22:15', 'John 19:28', 'John 19:28', 'and to fulfill the Scripture, Jesus said'),
    ('Psalm 69:21', 'John 19:29', 'John 19:28', 'and to fulfill the Scripture, Jesus said'),
    ('Psalm 34:20', 'John 19:36', 'John 19:36', 'Now these things happened so that the Scripture would be fulfilled'),
    ('Exodus 12:46', 'John 19:36', 'John 19:36', 'Now these things happened so that the Scripture would be fulfilled'),
    ('Numbers 9:12', 'John 19:36', 'John 19:36', 'Now these things happened so that the Scripture would be fulfilled'),
    ('Zechariah 12:10', 'John 19:37', 'John 19:36', 'Now these things happened so that the Scripture would be fulfilled'),
    ('Psalm 69:25', 'Acts 1:20', 'Acts 1:16', 'the Scripture had to be fulfilled which the Holy Spirit foretold through the mouth of David concerning Judas'),
    ('Psalm 109:8', 'Acts 1:20', 'Acts 1:16', 'the Scripture had to be fulfilled which the Holy Spirit foretold through the mouth of David concerning Judas'),
    ('Joel 2:28-32', 'Acts 2:17-21', 'Acts 2:16', 'this is what was spoken by the prophet Joel'),
    ('Psalm 16:8-11', 'Acts 2:25-28', 'Acts 2:31', 'Foreseeing this, David spoke about the resurrection of the Christ'),
    ('Psalm 2:7', 'Acts 13:33', 'Acts 13:33', 'He has fulfilled for us, their children, by raising up Jesus'),
    ('Isaiah 55:3', 'Acts 13:34', 'Acts 13:33', 'He has fulfilled for us, their children, by raising up Jesus'),
    ('Psalm 16:10', 'Acts 13:35', 'Acts 13:33', 'He has fulfilled for us, their children, by raising up Jesus'),
    ('Isaiah 1:9', 'Romans 9:29', 'Romans 9:29', 'It is just as Isaiah foretold'),
    ('Genesis 12:3', 'Galatians 3:8', 'Galatians 3:8', 'foretold the gospel to Abraham'),
    ('Genesis 18:18', 'Galatians 3:8', 'Galatians 3:8', 'foretold the gospel to Abraham'),
    ('Genesis 22:18', 'Galatians 3:8', 'Galatians 3:8', 'foretold the gospel to Abraham'),
    ('Genesis 15:6', 'James 2:23', 'James 2:23', 'And the Scripture was fulfilled that says'),
]


def parse(r):
    m = re.match(r'^(.*?) (\d+):(\d+)(?:-(\d+))?$', r)
    b = book_of(m.group(1))
    c = int(m.group(2)); v = int(m.group(3)); v2 = int(m.group(4) or v)
    return START[(b, c, v)], START[(b, c, v2)]


def name_of(r):
    return ref(*r)


def ov(a, b):
    return a[0] <= b[1] and b[0] <= a[1]


# Raw texts, normalised as the build normalises them.
REF = re.compile(r'\{\{ref:([^|}]*)\|([^}]*)\}\}')
def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

LC = {}
for w, path in [('mhc', '/tmp/mine/raw/mhc.json'), ('mhcc', '/tmp/mine/raw/mhcc.json'), ('wesley', '/tmp/mine/raw/wesley.json'),
                ('calvin', '/tmp/mine/raw/calvin.json'), ('geneva', '/tmp/mine/raw/geneva.json')]:
    rows = []
    for e in json.load(open(path))['entries']:
        b = USFM.index(e['book']); c = e['chapter']; v = e['verse']
        if not v or (b, c, v) not in START:
            continue
        ve = e.get('verseEnd') or v
        f = START[(b, c, v)]; t = START.get((b, c, ve), f)
        rows.append((f, t, norm(REF.sub(lambda m: m.group(2), e['body']))))
    LC[w] = rows
CAT = []
import glob
for fn in glob.glob(f'{ROOT}/data/raw/catena@efe1bd084d/data/catena/*.jsonl'):
    for line in open(fn):
        d = json.loads(line)
        for k in d.get('commented_verse_keys', []):
            bk, c, v = k.split('/')
            b = book_of(bk)
            if b is None or (b, int(c), int(v)) not in START:
                continue
            i = START[(b, int(c), int(v))]
            for s in d['segments']:
                CAT.append((i, s.get('father', ''), norm(s['text'])))


def found(work, who, on, quote):
    q = norm(quote)
    if work == 'catena':
        return any(on[0] - 3 <= i <= on[1] and f == who and q in t for i, f, t in CAT)
    return any(ov((f, t), on) and q in body for f, t, body in LC[work])


SOURCE = {'mhc': 'henry', 'mhcc': 'henry-concise', 'wesley': 'wesley', 'calvin': 'calvin', 'geneva': 'geneva', 'catena': 'catena-aurea'}
QUOTABLE = set(json.load(open(f'{ROOT}/config/figure-forms.json'))['quotable'])
HENRY_BOOKS = set(range(0, 44)) | {45, 65}  # Genesis to Acts, 1 Corinthians, Revelation

pairs = []
for ot, nt, at, words in TIER1:
    o = parse(ot); n = parse(nt); s = parse(at)
    assert not is_nt(o[0]) and is_nt(n[0]), (ot, nt)
    assert words in TEXT[s[0]], (at, words)
    pairs.append(dict(ot=o, nt=n, says=dict(ref=name_of(s), words=words), cites=[]))

yes = json.load(open('/tmp/mine/yes.json'))
miss = 0; skipped = collections.Counter()
for it in yes:
    o = parse(it['ot']); n = parse(it['nt']); on = parse(it['on']) if re.match(r'.* \d+:\d+(-\d+)?$', it['on']) else None
    work = it['work']
    if SOURCE[work] not in QUOTABLE:
        skipped['not on the quotable list in config/figure-forms.json'] += 1; continue
    if on is None:
        skipped['on'] += 1; continue
    if work == 'mhc' and IDX[on[0]][0] not in HENRY_BOOKS:
        skipped['henry continuation not on cite list'] += 1; continue
    who = it['writer'] if work == 'catena' else None
    if not found(work, who, on, it['quote']):
        miss += 1; continue
    cite = dict(source=SOURCE[work], on=name_of(on), quote=norm(it['quote']))
    if who:
        cite = dict(source='catena-aurea', father=who, on=name_of(on), quote=norm(it['quote']))
    home = None
    for p in pairs:
        if ov(p['ot'], o) and IDX[p['nt'][0]][:2] == IDX[n[0]][:2] and abs(p['nt'][0] - n[0]) <= 3:
            home = p; break
    if home is None:
        home = dict(ot=o, nt=n, cites=[]); pairs.append(home)
    if not any(c['source'] == cite['source'] and c.get('father') == cite.get('father') for c in home['cites']):
        home['cites'].append(cite)

out = []
for p in sorted(pairs, key=lambda p: (p['ot'][0], p['nt'][0])):
    x = dict(ot=name_of(p['ot']), nt=name_of(p['nt']))
    if p.get('says'):
        x['says'] = p['says']
    if p['cites']:
        x['cites'] = p['cites']
    if p.get('says') or p['cites']:
        out.append(x)
print('pairs', len(out), 'tier1', sum(1 for x in out if 'says' in x), 'quotes not found', miss, dict(skipped))
json.dump(out, open('/tmp/mine/prophecy-pairs.json', 'w'), indent=1, ensure_ascii=False)
