# python3 prep.py pool|blind: dedupe new questions against every earlier test question, the
# training examples and each other; write r6/<name>.json
import json, re, sys
D = __import__('os').environ['ASK_WORK'] + '/scratchpad/r6'
name = sys.argv[1]
raw = json.load(open(f'{D}/{name}-raw.json'))
def norm(s): return ' '.join(re.findall(r'[a-z0-9]+', s.lower().replace("'", '').replace('’', '')))
def toks(s): return set(norm(s).split())
seen = {norm(s) for s in open(f'{D}/seen.txt').read().split('\n') if s}
ex = json.load(open(__import__('os').environ['ATLAS_REPO'] + '/config/ask-examples.json'))['examples']
for v in ex.values():
    for s in v: seen.add(norm(s))
cfg = json.load(open(__import__('os').environ['ATLAS_REPO'] + '/config/questions.json'))['questions']
for q in cfg:
    seen.add(norm(q['question']))
    for a in q.get('also', []): seen.add(norm(a))
others = set()
if name == 'blind':
    try: others = {norm(x['q']) for x in json.load(open(f'{D}/pool.json'))}
    except FileNotFoundError: pass
out, keep = [], set()
drop = 0
for x in raw:
    n = norm(x['q'])
    if not n or n in seen or n in keep or n in others: drop += 1; continue
    keep.add(n); out.append(x)
json.dump(out, open(f'{D}/{name}.json', 'w'), ensure_ascii=False, indent=0)
print(name, len(raw), '->', len(out), 'dropped', drop)
