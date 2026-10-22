import json, glob
"""cls_prep.py: gather training strings (titles, phrasings, signals, examples) and test strings into one list for tok.cjs."""
S = __import__('os').environ['ASK_WORK'] + '/scratchpad'
ix = json.load(open(__import__('os').environ['ATLAS_REPO'] + '/web/public/data/ask/index.json'))
also = json.load(open(__import__('os').environ['ATLAS_REPO'] + '/web/public/data/ask/also.json'))
sig = json.load(open(__import__('os').environ['ATLAS_REPO'] + '/web/public/data/ask/signals.json'))
ex = {}
for f in sorted(glob.glob(f'{S}/ask/sig/e*-out.json')):
    for it in json.load(open(f))['examples']: ex[it['id']] = it['says']
ids = [q['id'] for q in ix['questions']]
rows = []  # (kind, class index or -1, text)
for i, q in enumerate(ix['questions']):
    rows.append(('title', i, q['q']))
    for a in also[i]: rows.append(('also', i, a))
    for s in sig[i]: rows.append(('sig', i, s))
    for e in ex.get(q['id'], []): rows.append(('ex', i, e))
tests = []
for f in ['dev.json', 'set5.json', 'set4.json']:
    for x in json.load(open(f)):
        tests.append(x if isinstance(x, str) else x['q'])
tests = list(dict.fromkeys(tests))
for t in tests: rows.append(('test', -1, t))
json.dump([r[2] for r in rows], open('cls-strings.json', 'w'))
json.dump({'ids': ids, 'rows': [[r[0], r[1]] for r in rows]}, open('cls-meta.json', 'w'))
print(len(rows), 'strings;', sum(1 for r in rows if r[0] == 'ex'), 'examples for', len(ex), 'questions')
