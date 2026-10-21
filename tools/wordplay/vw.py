#!/usr/bin/env python3
"""Print a verse's BSB text and its Hebrew/Greek words with Strong's keys.
Usage: python3 vw.py "Genesis 4:12" ["Micah 1:10-15" ...]"""
import json, re, sys
D = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/stable_data'
meta = json.load(open(f'{D}/meta.json'))
lem = json.load(open(f'{D}/lemmas.json'))
books = meta['books']
alias = {}
for b in books:
    for n in (b['name'], b['osis'], b['step']):
        alias[n.lower().replace(' ', '')] = b
alias.update({'psalm': alias['psalms'], 'song': alias[[k for k in alias if k.startswith('songof')][0]]})
cache = {}
def book(b):
    if b['osis'] not in cache:
        cache[b['osis']] = json.load(open(f"{D}/text/{b['osis']}.json"))
    return cache[b['osis']]
for arg in sys.argv[1:]:
    m = re.match(r'^\s*(.+?)\s+(\d+):(\d+)(?:-(\d+))?\s*$', arg)
    if not m:
        print('?', arg); continue
    key = m.group(1).lower().replace(' ', '')
    b = alias.get(key) or next((v for k, v in alias.items() if k.startswith(key)), None)
    if not b:
        print('? book', arg); continue
    c, v1 = int(m.group(2)), int(m.group(3)); v2 = int(m.group(4) or v1)
    ch = book(b)['chapters'][c - 1]
    for v in range(v1, v2 + 1):
        if v > len(ch):
            print(f"{b['name']} {c}:{v} does not exist"); continue
        text, words = ch[v - 1][0], ch[v - 1][1]
        print(f"== {b['name']} {c}:{v}  {text}")
        for k, w in enumerate(words):
            i = w[3]
            print(f"  {k:>2} {w[0]:<16} {w[1]:<18} {lem['key'][i]:<8} {lem['word'][i]} ({lem['translit'][i]}) \"{w[2]}\"")
