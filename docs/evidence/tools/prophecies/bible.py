import json, sys
sys.path.insert(0, '/tmp/mine/scripts')
from books import BOOKS, name

D = '/home/claude/bibleatlas/web/public/data'
meta = json.load(open(f'{D}/meta.json'))
TEXT = open(f'{D}/bsb.txt', encoding='utf-8').read().split('\n')
# verse index -> (book, chapter, verse)
IDX = []
START = {}
for b, bk in enumerate(meta['books']):
    for c, n in enumerate(bk['chapters'], 1):
        for v in range(1, n + 1):
            START[(b, c, v)] = len(IDX)
            IDX.append((b, c, v))
assert len(IDX) == len(TEXT) or len(IDX) + 1 == len(TEXT), (len(IDX), len(TEXT))


def ref(i, j=None):
    b, c, v = IDX[i]
    if j is None or j == i:
        return name(b, c, v)
    b2, c2, v2 = IDX[j]
    return name(b, c, v, c2, v2)


def is_nt(i):
    return BOOKS[IDX[i][0]]['nt']
