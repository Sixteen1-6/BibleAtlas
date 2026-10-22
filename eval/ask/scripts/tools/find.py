#!/usr/bin/env python3
"""Find BSB verses by word: find.py WORD [WORD ...]  (verses holding every word, whole words, any case)
  find.py --count WORD ...   only the number of verses
Shows up to 25 verses with their text."""
import re, sys, os; sys.path.insert(0, os.path.dirname(__file__))
from bible import BOOKS, chapters, name
args = sys.argv[1:]
count = args and args[0] == '--count'
if count: args = args[1:]
if not args: print(__doc__); sys.exit()
pats = [re.compile(r'\b' + re.escape(w.lower()) + r'\b') for w in args]
hits = []
for b in range(66):
    for c, vs in enumerate(chapters(b), 1):
        for v, t in enumerate(vs, 1):
            lt = t.lower().replace('’', "'")
            if all(p.search(lt) for p in pats): hits.append((b, c, v, t))
print(f'{len(hits)} verses hold: {" + ".join(args)}')
if not count:
    for b, c, v, t in hits[:25]: print(f'{name(b, c, v)}  {t}')
