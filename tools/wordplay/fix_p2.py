#!/usr/bin/env python3
"""Structural fixes to part 2 found by the build check (in place on an out dir).

- Malachi 1:1 cites read in a book introduction ("Malachi 0:0") -> on Malachi 1:1, at "Introduction to Malachi".
- acts-8-30 exists on main with the same play: drop the new passage, add its Bullinger cites to main's wordplay note.
- Additions that repeat a play main already has (genesis-2-23, jonah-3-4) are dropped.
"""
import json, sys
out = sys.argv[1]
ps = json.load(open(f'{out}/new-passages.json'))
quotes = json.load(open(f'{out}/quotes.json'))
ad = json.load(open(f'{out}/additions.json'))
intro = 0
for p in ps['passages']:
    for l in p['layers']:
        for c in l['cites']:
            if c['on'].endswith(' 0:0'):
                c['on'] = c['on'].replace(' 0:0', ' 1:1')
                c['at'] = 'Introduction to ' + c['on'].rsplit(' ', 1)[0]
                intro += 1
for x in quotes:
    if x['on'].endswith(' 0:0'):
        x['on'] = x['on'].replace(' 0:0', ' 1:1')
        x['at'] = 'Introduction to ' + x['on'].rsplit(' ', 1)[0]
acts = [p for p in ps['passages'] if p['id'] == 'acts-8-30']
ps['passages'] = [p for p in ps['passages'] if p['id'] != 'acts-8-30']
cite_adds = []
for p in acts:
    for l in p['layers'][1:]:
        if l['kind'] == 'wordplay':
            cite_adds.append({'passage_id': 'acts-8-30', 'ref': 'Acts 8:30', 'layer_kind': 'wordplay',
                              'note': 'the pun ginoskeis ha anaginoskeis, already on main citing Ellicott',
                              'add_cites': l['cites']})
ad = [a for a in ad if a['passage_id'] not in ('genesis-2-23', 'jonah-3-4')]
# Strong's words the BSB's Greek lacks: Matthew 24:7 has no "pestilences" (Luke 21:11 does); Revelation 1:17 has "right" without "hand".
WORDS = {('matthew-24-7', 'wordplay'): [{'ref': 'Matthew 24:7', 'strong': 'G3042'}, {'ref': 'Luke 21:11', 'strong': 'G3042'}, {'ref': 'Luke 21:11', 'strong': 'G3061'}],
         ('revelation-1-17', 'allusion'): [{'ref': 'Revelation 1:17', 'strong': 'G3498'}]}
for p in ps['passages']:
    for l in p['layers']:
        if (p['id'], l['kind']) in WORDS:
            l['words'] = WORDS[(p['id'], l['kind'])]
json.dump(ps, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
json.dump(ad, open(f'{out}/additions.json', 'w'), ensure_ascii=False, indent=1)
if acts:
    json.dump(cite_adds, open(f'{out}/cite-additions.json', 'w'), ensure_ascii=False, indent=1)
print(intro, 'intro cites moved;', len(ps['passages']), 'passages;', len(ad), 'additions;', len(cite_adds), 'cite additions')
