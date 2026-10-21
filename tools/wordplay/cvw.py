#!/usr/bin/env python3
# compact variant of vw.py: one line per word, short
import json, re, sys
D = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/mp_data'
meta = json.load(open(f'{D}/meta.json'))
lem = json.load(open(f'{D}/lemmas.json'))
books = meta['books']
alias = {}
for b in books:
    for n in (b['name'], b['osis'], b['step']):
        alias[n.lower().replace(' ', '')] = b
cache = {}
def book(b):
    if b['osis'] not in cache:
        cache[b['osis']] = json.load(open(f"{D}/text/{b['osis']}.json"))
    return cache[b['osis']]
for arg in sys.argv[1:]:
    m = re.match(r'^\s*(.+?)\s+(\d+):(\d+)(?:-(\d+))?\s*$', arg)
    key = m.group(1).lower().replace(' ', '')
    b = alias.get(key) or next((v for k, v in alias.items() if k.startswith(key)), None)
    c, v1 = int(m.group(2)), int(m.group(3)); v2 = int(m.group(4) or v1)
    ch = book(b)['chapters'][c - 1]
    for v in range(v1, v2 + 1):
        if v > len(ch):
            print(f"{b['name']} {c}:{v} does not exist"); continue
        text, words = ch[v - 1][0], ch[v - 1][1]
        print(f"== {b['name']} {c}:{v}  {text}")
        print('   ' + ' | '.join(f"{w[0]} {lem['translit'][w[3]]} {lem['key'][w[3]]} \"{w[2]}\"" for w in words if not lem['key'][w[3]].startswith('H90') and lem['key'][w[3]] not in ('H0853',)))
