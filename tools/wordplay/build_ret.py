#!/usr/bin/env python3
"""build_ret.py <out dir>: the 3 passages the Layers thread returned from part 2, mended, with their quote rows.

Each change rests on a cite found, verified and not refuted by returned.js (runs.txt has the run ids)."""
import copy, json, os, sys
out = sys.argv[1]
RET = '/mnt/project-files/bible-atlas/wordplay/round2/from-layers/part2-returned.json'
Q = json.load(open('/mnt/project-files/bible-atlas/wordplay/round2/part2-quotes.json'))
R = {x['passage']['id']: copy.deepcopy(x['passage']) for x in json.load(open(RET))['passages']}
VAULT = 'https://raw.githubusercontent.com/jonnyg23/mahabrain/b00aa504cf9a7fb368a040b97ebe9cafca950489/sacred_obsidian_vault/bib/cmt'
WES = 'https://raw.githubusercontent.com/LetsChurch/lets.church/71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239/packages/lets.bible/seed/commentaries/wesley.json'
rows = []


def keep_rows(p):
    """quote rows for the cites the passage still carries, renumbered to their layer"""
    for i, l in enumerate(p['layers']):
        for c in l['cites']:
            if c.get('_new'):
                continue
            hit = [q for q in Q if q['where'] == p['ref'] and q['source'] == c['source'] and q['on'] == c['on'] and q['kind'] == l['kind']]
            assert hit, (p['id'], i, c)
            r = dict(hit[0])
            r['note'] = i
            rows.append(r)


def new_cite(p, i, source, on, quote, read_in, at=None, url=None):
    c = {'source': source, 'on': on, '_new': True}
    if at:
        c['at'] = at
    if url:
        c['url'] = url
    p['layers'][i]['cites'].append(c)
    r = {'where': p['ref'], 'kind': p['layers'][i]['kind'], 'source': source, 'on': on}
    if at:
        r['at'] = at
    if url:
        r['url'] = url
    r.update({'quote': quote, 'read_in': read_in, 'note': i})
    rows.append(r)


# Ephesians 4:30: the Reformation Study Bible calls Paul's words a quotation of Isaiah 63:10 (a second writer
# with Clarke). It backs the allusion but not the "caution" half, so the text keeps to the allusion.
# JFB and Barnes only cross-reference the verses, so their cites go.
p = R['ephesians-4-30']
l = p['layers'][1]
l['cites'] = [c for c in l['cites'] if c['source'] == 'clarke']
l['strength'] = 'commonly held'
l['text'] = ('Paul\'s warning echoes Isaiah\'s memory of Israel after the exodus: "But they rebelled and grieved His Holy Spirit." '
             'Grieving God\'s Spirit is not a new idea. His people did it long before, and believers can still do it today.')
l['evidence'] = ('Clarke says it is very likely the apostle had Isaiah 63:10 in view, and the Reformation Study Bible calls Paul\'s words '
                 'a quotation of Isaiah 63:10, showing the idea is not new to the New Testament. Jamieson-Fausset-Brown and Barnes only '
                 'compare the two verses, so they are not cited.')
keep_rows(p)
new_cite(p, 1, 'reformation-sb', 'Ephesians 4:30',
         'That the Holy Spirit can be saddened is an indication of His being a Person and not an impersonal force. The idea is not new to the New Testament, as is clear from Paul’s quotation of the prophet Isaiah (Is. 63:10).',
         'https://www.biblegateway.com/resources/reformation-study-bible/Eph.4.30',
         at='Reformation Study Bible (2015), note on Ephesians 4:30',
         url='https://www.biblegateway.com/resources/reformation-study-bible/Eph.4.30')

# Jeremiah 48:47: no second writer for the sound play (already live at Jeremiah 29:14 with two writers), so it stays
# as "some interpreters"; a new fulfillment note, stated by many writers in their own voice, carries the passage.
p = R['jeremiah-48-47']
keep_rows(p)
ful = {
    'kind': 'fulfillment',
    'strength': 'widely agreed',
    'refs': ['Jeremiah 48:47'],
    'words': [{'ref': 'Jeremiah 48:47', 'strong': 'H0319'}, {'ref': 'Jeremiah 48:47', 'strong': 'H3117G'}],
    'evidence': ('Clarke says Moab\'s conversion to the Christian faith must be the main end of this prophecy. Jamieson-Fausset-Brown says '
                 'gospel blessings to the Gentiles in the last days are intended. Gill sees it fulfilled when Moabites turned to the Gospel; '
                 'Poole and Wesley read it of calling them into the Messiah\'s kingdom; Matthew Henry says it looks further, to gospel times.'),
    'cites': [],
    'text': ('Many see the promise to restore Moab "in the latter days" reaching past any return from exile to the age of the Messiah, '
             'when the gospel goes out to the nations and Moab\'s people, too, are brought into God\'s kingdom.'),
}
p['layers'].insert(1, ful)
for r in rows:
    if r['where'] == p['ref'] and r['note'] >= 1:
        r['note'] += 1
new_cite(p, 1, 'clarke', 'Jeremiah 48:47',
         'Perhaps the restoration spoken of here which was to take place in the latter days, may mean the conversion of these people, in their existing remnants, to the faith of the Gospel. ... Their conversion to the Christian faith must be the main end designed by this prophecy.',
         f'{VAULT}/clarke/jer048.md')
new_cite(p, 1, 'jfb', 'Jeremiah 48:47',
         'Gospel blessings, temporal and spiritual, to the Gentiles in the last days, are intended.', f'{VAULT}/jfb/jer048.md')
new_cite(p, 1, 'gill', 'Jeremiah 48:47',
         'and it had a spiritual one in the times of the Messiah, in the conversion of some of these people, as very probably in the first times of the Gospel; so it will have in the latter day',
         f'{VAULT}/gill/jer048.md')
new_cite(p, 1, 'poole', 'Jeremiah 48:47',
         'a spiritual reduction of them, by calling some of them under the kingdom of the Messiah',
         'https://biblehub.com/commentaries/poole/jeremiah/48.htm')
new_cite(p, 1, 'wesley', 'Jeremiah 48:47',
         'Bring again - It seems this is to be understood of a spiritual reduction of them, by calling them into the kingdom of the Messiah.', WES)
new_cite(p, 1, 'henry', 'Jeremiah 48:47', 'Yet it looks further, to gospel times',
         'https://biblehub.com/commentaries/mhcw/jeremiah/48.htm')

done = [R['ephesians-4-30'], R['jeremiah-48-47']]
if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_ret_mt.py')):
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_ret_mt.py')).read())
for p in done:
    for l in p['layers']:
        for c in l['cites']:
            c.pop('_new', None)
os.makedirs(out, exist_ok=True)
json.dump({'passages': done}, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': []}, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump([], open(f'{out}/additions.json', 'w'))
json.dump(rows, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
for p in done:
    for l in p['layers']:
        assert len(l['text']) <= 300, (p['id'], l['kind'], len(l['text']))
        assert len(l.get('evidence', '')) <= 400, (p['id'], l['kind'], len(l['evidence']))
print(len(done), 'passages,', len(rows), 'quote rows')
