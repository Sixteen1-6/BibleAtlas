import json, re, sys
D = '/home/claude/bibleatlas/web/public/data'
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
def clean(s): return re.sub("[\u0591-\u05AF\u05BD\u05C0\u05C3\u05BE]", "", s)
for arg in sys.argv[1:]:
    m = re.match(r'^\s*(.+?)\s+(\d+):(\d+)(?:-(\d+))?\s*$', arg)
    key = m.group(1).lower().replace(' ', '')
    b = alias.get(key) or next((v for k, v in alias.items() if k.startswith(key)), None)
    c, v1 = int(m.group(2)), int(m.group(3)); v2 = int(m.group(4) or v1)
    ch = book(b)['chapters'][c - 1]
    for v in range(v1, v2 + 1):
        text, words = ch[v - 1][0], ch[v - 1][1]
        print(f"== {b['name']} {c}:{v}  {text[:140]}")
        print('   ' + ' | '.join(f"{clean(w[0]).split()[0] if clean(w[0]).split() else w[0]} {lem['key'][w[3]]} {lem['translit'][w[3]]} \"{w[2]}\"" for w in words))
