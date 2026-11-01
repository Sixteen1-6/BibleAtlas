"""Content for the reader mockup, with checks.

Every English word shown as Scripture comes from the app's own BSB text
(BSB.json, via data.json). Poetry lines follow the pinned BSB USFM
(usfm-bible/examples.bsb @ 48a9feb71f); each verse's lines must join back to
the app's verse text exactly. Every quoted excerpt must be found word for word
in its verse. Hebrew words come from the live text shards (STEPBible TAHOT).
Writers' words were checked against their own texts (see the rationale).
Run: python -I content.py <ba folder>   -> mock-src/content.json
"""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
BA = sys.argv[1]
SRC = os.path.join(BA, 'literary', 'mock-src')
data = json.load(open(os.path.join(SRC, 'data.json'), encoding='utf-8'))
heb = json.load(open(os.path.join(SRC, 'verses.json'), encoding='utf-8'))
HEB_KEY = {'Ps.1': 'Ps1', 'Ps.19': 'Ps19', 'Isa.6': 'Isa6', 'Gen.6': 'Gen6', '1Sam.1': '1Sam1'}

# ---------------------------------------------------------------- poetry lines
# [level, text]; level 0 = prose lead-in, 1 = \q1, 2 = \q2. 'stanza' = a \b before
# the verse; 'gapBefore' = index of a line that has a \b before it inside the verse.
LINES = {
    'Ps.1.1': [[1, 'Blessed is the man'], [2, 'who does not walk in the counsel of the wicked,'], [1, 'or set foot on the path of sinners,'], [2, 'or sit in the seat of mockers.']],
    'Ps.1.2': [[1, 'But his delight is in the Law of the LORD,'], [2, 'and on His law he meditates day and night.']],
    'Ps.1.3': [[1, 'He is like a tree planted by streams of water,'], [2, 'yielding its fruit in season,'], [1, 'whose leaf does not wither,'], [2, 'and who prospers in all he does.']],
    'Ps.1.4': [[1, 'Not so the wicked!'], [2, 'For they are like chaff driven off by the wind.']],
    'Ps.1.5': [[1, 'Therefore the wicked will not stand in the judgment,'], [2, 'nor sinners in the assembly of the righteous.']],
    'Ps.1.6': [[1, 'For the LORD guards the path of the righteous,'], [2, 'but the way of the wicked will perish.']],
    'Ps.19.1': [[1, 'The heavens declare the glory of God;'], [2, 'the skies proclaim the work of His hands.']],
    'Ps.19.2': [[1, 'Day after day they pour forth speech;'], [2, 'night after night they reveal knowledge.']],
    'Ps.19.3': [[1, 'Without speech or language,'], [2, 'without a sound to be heard,']],
    'Ps.19.4': [[1, 'their voice has gone out into all the earth,'], [2, 'their words to the ends of the world.'], [1, 'In the heavens He has pitched'], [2, 'a tent for the sun.']],
    'Isa.6.9': [[0, 'And He replied:'], [1, '“Go and tell this people,'], [2, '‘Be ever hearing, but never understanding;'], [2, 'be ever seeing, but never perceiving.’']],
    'Isa.6.10': [[1, 'Make the hearts of this people calloused;'], [2, 'deafen their ears and close their eyes.'], [1, 'Otherwise they might see with their eyes,'], [2, 'hear with their ears,'], [2, 'understand with their hearts,'], [1, 'and turn and be healed.”']],
}
STANZA = {'Ps.1.4', 'Ps.1.6'}
GAP_BEFORE = {'Ps.19.4': 2}
TITLE = {'Ps.19.1': 'For the choirmaster. A Psalm of David.'}
# Hebrew word ranges under each line (end exclusive); a range covering two lines
# is written once on the first and None on the next (word order crosses the lines).
HEB_LINES = {
    'Ps.1.1': [[0, 2], [2, 7], [7, 11], [11, 15]],
    'Ps.1.2': [[0, 5], [5, 9]],
    'Ps.1.3': [[0, 6], [6, 10], [10, 13], [13, 17]],
    'Ps.1.4': [[0, 3], [3, 9]],
    'Ps.1.5': [[0, 6], [6, 9]],
    'Ps.1.6': [[0, 5], [5, 8]],
    'Ps.19.1': [[3, 7], [7, 11]],
    'Ps.19.2': [[0, 4], [4, 8]],
    'Ps.19.3': [[0, 4], [4, 7]],
    'Ps.19.4': [[0, 4], [4, 7], [7, 11], None],
    'Isa.6.9': [[0, 1], [1, 5], [5, 9], [9, 13]],
    'Isa.6.10': [[0, 4], [4, 8], [8, 11], [11, 13], [13, 15], [15, 18]],
}
HEB_TITLE = {'Ps.19.1': [0, 3]}

PASSAGES = [
    {'id': 'ps1', 'osis': 'Ps', 'ch': 1, 'head': 'Psalm 1', 'vs': [1, 2, 3, 4, 5, 6], 'sel': 6, 'after': 'Psalm 1 ends here.'},
    {'id': 'ps19', 'osis': 'Ps', 'ch': 19, 'head': 'Psalm 19', 'vs': [1, 2, 3, 4], 'sel': 1, 'after': 'Verses 5 to 14 follow.'},
    {'id': 'isa6', 'osis': 'Isa', 'ch': 6, 'head': 'Isaiah 6', 'vs': [9, 10], 'sel': 10, 'before': 'Verses 1 to 8 come before.', 'after': 'Verses 11 to 13 follow.'},
    {'id': 'gen6', 'osis': 'Gen', 'ch': 6, 'head': 'Genesis 6', 'vs': [5, 6, 7, 8], 'sel': 6, 'before': 'Verses 1 to 4 come before.', 'after': 'Verses 9 to 22 follow.'},
    {'id': 'sam1', 'osis': '1Sam', 'ch': 1, 'head': '1 Samuel 1', 'vs': [1, 2, 3, 4, 5, 6, 7], 'sel': 2, 'after': 'Verses 8 to 28 follow.'},
]

# ---------------------------------------------------------------- parallel lines
# rows: the line split into cells; cells must join (with spaces, empties skipped)
# back to the line. 'lead' rows are not part of the pattern. 'key' marks words
# (exact substrings of a cell) that answer each other: same key = a pair.
PAR = {
    'Ps.1.6': {
        'rel': 'opposes', 'about': 'The second line turns the first around: the opposite way, the opposite end.',
        'simple': True, 'why_simple': 'a “but” between the two lines',
        'strength': 'widely agreed', 'n': 3,
        'rows': [[1, ['For the LORD guards', 'the path of the righteous,', '']], [2, ['but', 'the way of the wicked', 'will perish.']]],
        'keys': [[0, 0, 'guards', 'k1'], [0, 1, 'righteous', 'k2'], [1, 1, 'wicked', 'k2'], [1, 2, 'perish', 'k1'], [0, 1, 'path', 'k3'], [1, 1, 'way', 'k3']],
        'heb_mark': [3, 5], 'heb_note': 'Both lines say דֶּרֶךְ derekh, “way”. The BSB writes “path”, then “way”.',
        'term': 'antithetic parallelism',
        'cites': [
            ['Matthew Henry', 'Psalm 1:4–6', 'they are the reverse of the righteous, both in character and condition', 'https://biblehub.com/commentaries/mhcw/psalms/1.htm'],
            ['Keil and Delitzsch', 'Psalm 1:4–6', 'On the contrary, the way of the ungodly … perishes', 'https://biblehub.com/commentaries/kad/psalms/1.htm'],
            ['John Gill', 'Psalm 1:6', 'the Lord knows, approves of, loves, and delights in the one; he does not approve of and delight in the other', 'https://biblehub.com/commentaries/gill/psalms/1.htm'],
        ],
    },
    'Ps.1.1': {
        'rel': 'builds', 'about': 'Each line goes a step further: walk, then stand, then sit.',
        'simple': False, 'strength': 'commonly held', 'n': 2,
        'rows': [['lead', ['Blessed is the man']], [2, ['who does not walk', 'in the counsel', 'of the wicked,']], [1, ['or set foot', 'on the path', 'of sinners,']], [2, ['or sit', 'in the seat', 'of mockers.']]],
        'keys': [[1, 0, 'walk', 'k1'], [2, 0, 'set foot', 'k1'], [3, 0, 'sit', 'k1']],
        'heb_mark': [], 'heb_note': '',
        'term': 'synonymous or gradational parallelism (Bullinger); a climax (Calvin)',
        'cites': [
            ['Bullinger’s Figures of Speech', 'Psalm 1:1', None, 'https://archive.org/details/figuresofspeechu00bull', 'names this verse under Parallelism'],
            ['John Calvin', 'Psalm 1:1', 'he places at the top of the climax the seat', 'https://biblehub.com/commentaries/calvin/psalms/1.htm'],
        ],
    },
    'Ps.19.1': {
        'rel': 'restates', 'about': 'The second line says the first again in other words.',
        'simple': False, 'strength': 'commonly held', 'n': 2, 'shared': 'Ps.19.1-2',
        'rows': [[1, ['The heavens', 'declare', 'the glory of God;']], [2, ['the skies', 'proclaim', 'the work of His hands.']]],
        'keys': [], 'heb_mark': [], 'heb_note': '',
        'term': 'synonymous parallelism',
        'cites': [
            ['John Calvin', 'Psalm 19:1', 'the Psalmist repeats one thing twice, according to his usual manner', 'https://biblehub.com/commentaries/calvin/psalms/19.htm'],
            ['Keil and Delitzsch', 'Psalm 19:1–3', None, 'https://biblehub.com/commentaries/kad/psalms/19.htm', 'call the verb of the second line of verse 2 “the parallel word”'],
        ],
    },
    'Ps.19.2': {
        'rel': 'restates', 'about': 'The second line says the first again in other words.',
        'simple': False, 'strength': 'commonly held', 'n': 2, 'shared': 'Ps.19.1-2',
        'rows': [[1, ['Day after day', 'they pour forth', 'speech;']], [2, ['night after night', 'they reveal', 'knowledge.']]],
        'keys': [], 'heb_mark': [], 'heb_note': '',
        'term': 'synonymous parallelism',
        'cites': [
            ['John Calvin', 'Psalm 19:1', 'the Psalmist repeats one thing twice, according to his usual manner', 'https://biblehub.com/commentaries/calvin/psalms/19.htm'],
            ['Keil and Delitzsch', 'Psalm 19:1–3', None, 'https://biblehub.com/commentaries/kad/psalms/19.htm', 'call the verb of the second line of verse 2 “the parallel word”'],
        ],
    },
}

CHAPTER = {
    'ps1': {
        'line': 'Two ways side by side: the righteous and the wicked',
        'strength': 'widely agreed', 'n': 4,
        'groups': [{'from': 1, 'to': 3, 'label': 'Blessed is the man', 'tone': 'a'}, {'from': 4, 'to': 6, 'label': 'Not so the wicked!', 'tone': 'b'}],
        'last_lines': ['a', 'b'],
        'term': 'two ways set side by side (a contrast of characters)',
        'cites': [
            ['Matthew Henry', 'Psalm 1', 'The different character and condition of godly people and wicked people', 'https://biblehub.com/commentaries/mhcw/psalms/1.htm'],
            ['Adam Clarke', 'Psalm 1', 'The opposite state of the ungodly pointed out, under the metaphor of chaff driven away by the wind', 'https://biblehub.com/commentaries/clarke/psalms/1.htm'],
            ['Keil and Delitzsch', 'Psalm 1:4–6', 'the opposite of a tree planted by the water-courses', 'https://biblehub.com/commentaries/kad/psalms/1.htm'],
            ['Spurgeon', 'Psalm 1', 'In the second part (from verse 4 to the end) he contrasts the state and character of the ungodly', 'https://biblehub.com/commentaries/tod/psalms/1.htm'],
        ],
        'split_note': 'The two parts, verses 1 to 3 and 4 to 6, are as Spurgeon divides the psalm.',
    },
}

MIRROR = {
    'Isa.6.10': {
        'strength': 'widely agreed', 'n': 3,
        'members': [['A', 0, 'Make the hearts of this people calloused;', 'hearts'], ['B', 1, 'deafen their ears', 'ears'], ['C', 2, 'close their eyes.', 'eyes'],
                    ['C′', 2, 'see with their eyes,', 'eyes'], ['B′', 1, 'hear with their ears,', 'ears'], ['A′', 0, 'understand with their hearts,', 'hearts']],
        'tail': 'and turn and be healed.”',
        # word in the text (line index, word) -> pair letter
        'marks': [[0, 'hearts', 'A'], [1, 'ears', 'B'], [1, 'eyes', 'C'], [2, 'eyes', 'C′'], [3, 'ears', 'B′'], [4, 'hearts', 'A′']],
        'heb_marks': {'1': 'A', '4': 'B', '6': 'C', '10': 'C′', '11': 'B′', '13': 'A′'},
        'simple_line': 'heart, ears, eyes, then eyes, ears, heart',
        'checked': 'Ears and eyes are the same Hebrew words both times; heart is לֵב lev, then לְבָב levav, two forms of the word.',
        'term': 'chiasm (Bullinger: introverted parallelism, lettered a b c c b a)',
        'cites': [
            ['Bullinger’s Figures of Speech', 'Isaiah 6:10', None, 'https://archive.org/details/figuresofspeechu00bull', 'letters the six clauses a b c c b a under introverted parallelism'],
            ['Jamieson, Fausset and Brown', 'Isaiah 6:10', 'in the latter, the reverse order, the eyes, ears, heart', 'https://biblehub.com/commentaries/jfb/isaiah/6.htm'],
            ['Keil and Delitzsch', 'Isaiah 6:9–10', 'point back to these three imperatives in inverse order', 'https://biblehub.com/commentaries/kad/isaiah/6.htm'],
        ],
    },
}

FIGURE = {
    'Gen.6.6': {
        'kind': 'Human words for God',
        'strength': 'widely agreed', 'n': 7,
        'marks': ['regretted', 'He was grieved in His heart'],
        'note': 'Scripture speaks of God in human terms so that we can understand Him.',
        'anchor_text': 'He is not a man, that He should change His mind', 'anchor_ref': '1 Samuel 15:29', 'anchor_key': '1Sam.15.29',
        'heb_mark': [0, 7, 9],
        'heb_note': 'The verb for “regretted”, נָחַם nacham, comes again in 1 Samuel 15:11, “I regret that I have made Saul king”, and in 15:29, “He is not a man, that He should change His mind”.',
        'term': 'anthropopathism: human feelings spoken of God (Bullinger: Anthropopatheia, “Condescension”)',
        'agree': ['E. W. Bullinger', 'Matthew Henry', 'John Wesley', 'Keil and Delitzsch', 'John Calvin', 'John Gill', 'Joseph Benson'],
        'views': [
            ['As a way of speaking', [['John Calvin', 'The repentance which is here ascribed to God does not properly belong to him, but has reference to our understanding of him'], ['John Wesley', 'These are expressions after the manner of men, and must be understood so as not to reflect upon God’s immutability or felicity']]],
            ['As something real in God, told in human words', [['Keil and Delitzsch', 'The repentance of God is an anthropomorphic expression for the pain of the divine love at the sin of man']]],
        ],
        'often': 'Does God change His mind?', 'often_ref': '1 Samuel 15:29',
    },
}

PAIR = {
    'Sam.1.2': None,
}
PAIR = {
    '1Sam.1.2': {
        'line': 'Set side by side: Hannah and Peninnah',
        'strength': 'widely agreed', 'n': 3,
        'cross': [['Hannah', 'A', 0], ['Peninnah', 'B', 0], ['Peninnah', 'B′', 1], ['Hannah', 'A′', 1]],
        'heb_marks': {'5': 'A', '8': 'B', '10': 'B′', '12': 'A′'},
        'sides': ['Hannah', 'Peninnah'],
        'rows': [
            ['1Sam.1.2', 'but Hannah had none', '1Sam.1.2', 'Peninnah had children'],
            ['1Sam.1.5', 'to Hannah he would give a double portion, for he loved her', '1Sam.1.4', 'he would give portions to his wife Peninnah and to all her sons and daughters'],
            ['1Sam.1.7', 'until she wept and would not eat', '1Sam.1.6', 'her rival would provoke her and taunt her viciously'],
        ],
        'term': 'character foils; in verse 2 the names cross, Hannah, Peninnah, Peninnah, Hannah (Bullinger: introverted parallelism; Companion Bible: antimetabole)',
        'cites': [
            ['Bullinger’s Figures of Speech and the Companion Bible', '1 Samuel 1:2', 'Note the Fig. Antimetabole', 'https://archive.org/details/figuresofspeechu00bull', None, 'the quoted words are the Companion Bible note; Figures of Speech lists the verse under introverted parallelism'],
            ['Keil and Delitzsch', '1 Samuel 1:2–3', 'the latter of whom was blessed with children, whereas the first was childless', 'https://biblehub.com/commentaries/kad/1_samuel/1.htm'],
            ['Matthew Henry', '1 Samuel 1:1–8', 'They had different blessings', 'https://biblehub.com/commentaries/mhcw/1_samuel/1.htm', None, '“But they were of different tempers”'],
        ],
    },
}

QUOTES = {
    'Isa.6.9': ['Quoted in ', {'ref': 'Matthew 13:14–15'}, ', ', {'ref': 'Mark 4:12'}, ' and 2 more'],
    'Isa.6.10': ['Quoted in ', {'ref': 'Matthew 13:14–15'}, ', ', {'ref': 'Mark 4:12'}, ' and 2 more'],
    'Ps.19.4': ['Quoted in ', {'ref': 'Romans 10:18'}],
}
# 1 Samuel 15:29 and 15:11 in the app's BSB (checked below against the live text shard)
EXTRA_VERSES = {
    '1Sam.15.11': '“I regret that I have made Saul king, for he has turned away from following Me and has not carried out My instructions.” And Samuel was distressed and cried out to the LORD all that night.',
    '1Sam.15.29': 'Moreover, the Glory of Israel does not lie or change His mind, for He is not a man, that He should change His mind.”',
}

# ---------------------------------------------------------------- checks
errors = []
def need(ok, msg):
    if not ok: errors.append(msg)
V = data['verses']
for k, lines in LINES.items():
    en = V[k]['en']
    joined = ' '.join(t for _, t in lines)
    if k in TITLE: joined = TITLE[k] + ' ' + joined
    need(joined == en, f'{k}: lines do not join to the BSB text\n  {joined}\n  {en}')
for k, p in PAR.items():
    lines = LINES[k]
    for (lvl, cells), (_, line) in zip(p['rows'], lines):
        need(' '.join(c for c in cells if c) == line, f'{k}: row does not join to line: {cells} / {line}')
    for r, c, w, _ in p['keys']:
        need(w in p['rows'][r][1][c], f'{k}: key {w} not in cell')
for k, m in MIRROR.items():
    en = V[k]['en']
    for _, _, t, w in m['members']:
        need(t in en, f'{k}: member not in verse: {t}')
        need(w in t, f'{k}: key word not in member: {w}')
    need(m['tail'] in en, f'{k}: tail')
    for li, w, _ in m['marks']:
        need(w in LINES[k][li][1], f'{k}: mark {w} not in line {li}')
for k, f in FIGURE.items():
    for w in f['marks']:
        need(w in V[k]['en'], f'{k}: mark {w}')
for k, p in PAIR.items():
    for a, ta, b, tb in p['rows']:
        need(ta in V[a]['en'], f'{k}: {ta} not in {a}')
        need(tb in V[b]['en'], f'{k}: {tb} not in {b}')
# 1 Samuel 15 against the live shard
sam = json.load(open(os.path.join(BA, 'literary', 'dl', 'live2', '1Sam.json'), encoding='utf-8'))
for k, t in EXTRA_VERSES.items():
    _, c, v = k.split('.')
    need(sam['chapters'][int(c) - 1][int(v) - 1][0] == t, f'{k}: not the app text')
need(FIGURE['Gen.6.6']['anchor_text'] in EXTRA_VERSES['1Sam.15.29'], 'anchor text')
need('I regret that I have made Saul king' in EXTRA_VERSES['1Sam.15.11'], '15:11 quote')
# live text shard English = BSB.json English for every shown verse
for p in PASSAGES:
    hk = HEB_KEY[f"{p['osis']}.{p['ch']}"]
    for v in p['vs']:
        k = f"{p['osis']}.{p['ch']}.{v}"
        need(heb[hk][str(v)]['en'] == V[k]['en'], f'{k}: live shard English differs from BSB.json')
# Hebrew line ranges cover every word once, in order
for k, rs in HEB_LINES.items():
    o, c, v = k.split('.')
    words = heb[HEB_KEY[f'{o}.{c}']][v]['w']
    start = HEB_TITLE.get(k, [0, 0])[1]
    cur = start
    for r in rs:
        if r is None: continue
        need(r[0] == cur, f'{k}: Hebrew ranges not contiguous at {r}')
        cur = r[1]
    need(cur == len(words), f'{k}: Hebrew ranges stop at {cur} of {len(words)}')
if errors:
    print('\n'.join(errors)); sys.exit(1)

# ---------------------------------------------------------------- write
out = {'passages': PASSAGES, 'lines': LINES, 'stanza': sorted(STANZA), 'gapBefore': GAP_BEFORE, 'title': TITLE,
       'hebLines': HEB_LINES, 'hebTitle': HEB_TITLE, 'par': PAR, 'chapter': CHAPTER, 'mirror': MIRROR, 'figure': FIGURE,
       'pair': PAIR, 'quotes': QUOTES, 'extra': EXTRA_VERSES, 'heb': {}}
for p in PASSAGES:
    hk = HEB_KEY[f"{p['osis']}.{p['ch']}"]
    for v in p['vs']:
        out['heb'][f"{p['osis']}.{p['ch']}.{v}"] = [[w[0], w[1], w[2]] for w in heb[hk][str(v)]['w']]
json.dump(out, open(os.path.join(SRC, 'content.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('content ok:', sum(len(p['vs']) for p in PASSAGES), 'verses;', len(LINES), 'poetry verses')
