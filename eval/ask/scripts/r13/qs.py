#!/usr/bin/env python3
"""qs.py WORD [WORD ...]: prepared Ask questions whose id, question, other ways of asking or examples
hold every WORD (any case), each with its first three chain parts in BSB words.
  qs.py --id ID      one question in full: phrasings, topics, the whole chain and its examples."""
import json, os, re, sys
sys.path.insert(0, os.environ.get('ASK_TOOLS', './eval/ask/scripts/tools'))
from bible import parse, text
REPO = os.environ.get('ATLAS_REPO', '.')
qs = json.load(open(os.path.join(REPO, 'config/questions.json'), encoding='utf-8'))['questions']
ex = json.load(open(os.path.join(REPO, 'config/ask-examples.json'), encoding='utf-8'))['examples']
def show(p):
    if 'words' in p: return p['words']
    try: return ' '.join(text(*v) for v in parse(p['ref']))
    except Exception as e: return f'?? {e}'
a = sys.argv[1:]
if not a: print(__doc__); sys.exit()
if a[0] == '--id':
    q = next((q for q in qs if q['id'] == a[1]), None)
    if not q: print('no such id'); sys.exit()
    print(q['id'], '|', q['group'], '|', q['question']); print('also:', '; '.join(q['also']))
    print('signals:', ', '.join(q.get('signals', []))); print('topics:', json.dumps(q['topics']))
    for i, p in enumerate(q['chain']): print(f'  [{i}] {p["ref"]}: {show(p)}')
    print('examples:', ' | '.join(ex.get(q['id'], [])))
    sys.exit()
pats = [re.compile(re.escape(w.lower())) for w in a]
n = 0
for q in qs:
    hay = ' '.join([q['id'], q['question']] + q['also']).lower()
    hay_ex = ' '.join(ex.get(q['id'], [])).lower()
    if all(p.search(hay) for p in pats) or all(p.search(hay_ex) for p in pats):
        n += 1
        print(f'{q["id"]} | {q["question"]}')
        for i, p in enumerate(q['chain'][:3]): print(f'    [{i}] {p["ref"]}: {show(p)[:220]}')
        if n >= 25: print('... more; narrow the words'); break
print(f'{n} questions')
