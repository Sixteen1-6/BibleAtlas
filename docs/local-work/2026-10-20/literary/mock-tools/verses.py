import json, sys
path = sys.argv[1]
d = json.load(open(path, encoding='utf-8'))
books = {b['name']: b for b in d['books']}
want = [
 ('Genesis', 6, range(5, 9)),
 ('I Samuel', 1, range(1, 12)),
 ('I Samuel', 15, [11, 29, 35]),
 ('I Samuel', 2, [1, 12, 18, 26]),
 ('Luke', 1, [46, 47]),
 ('Psalms', 1, range(1, 7)),
 ('Psalms', 19, range(1, 5)),
 ('Isaiah', 6, range(8, 12)),
 ('Numbers', 23, [19]),
 ('Hebrews', 11, [4]),
]
print([n for n in books][:10])
out = {}
for name, ch, vs in want:
    b = books.get(name)
    if not b:
        print('missing', name); continue
    c = b['chapters'][ch-1]
    for v in vs:
        t = c['verses'][v-1]
        assert t['verse'] == v
        key = f"{name} {ch}:{v}"
        out[key] = t['text']
        print(key, '|', t['text'])
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
