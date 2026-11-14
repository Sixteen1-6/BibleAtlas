"""cross14.py DRAFT.json [...]: what drafts written apart collide on once put together: a new id twice, a
question or phrasing used by two new questions, one example given to two questions, an existing question
pushed past 60 examples, and a phrasing or example moved away by one draft and added to another by a second."""
import json, os, re, sys, collections
REPO = os.environ.get('ATLAS_REPO', '/home/claude/bibleatlas')
qs = json.load(open(os.path.join(REPO, 'config/questions.json'), encoding='utf-8'))['questions']
ex = json.load(open(os.path.join(REPO, 'config/ask-examples.json'), encoding='utf-8'))['examples']
def norm(s):
    s = re.sub(r"['’‘ʼ]", '', s.lower())
    return ' '.join(re.findall(r'[^\W_]+', s))
ids = collections.defaultdict(list); said = collections.defaultdict(set); exs = collections.defaultdict(set)
count = collections.Counter({k: len(v) for k, v in ex.items()})
removed = collections.Counter()
for p in sys.argv[1:]:
    d = json.load(open(p, encoding='utf-8')); f = os.path.basename(p)
    for q in d.get('new', []):
        ids[q['id']].append(f)
        for t in [q['question']] + q.get('also', []): said[norm(t)].add(q['id'])
    for k in ['examples', 'add_examples']:
        for i, es in d.get(k, {}).items():
            for e in es: exs[norm(e)].add(i)
            count[i] += len(es)
    for i, es in d.get('remove_examples', {}).items(): count[i] -= len(es); removed[i] += len(es)
problems = 0
for i, fs in ids.items():
    if len(fs) > 1: print('ID TWICE', i, fs); problems += 1
for t, s in said.items():
    if len(s) > 1: print('PHRASING TWICE', repr(t), sorted(s)); problems += 1
for t, s in exs.items():
    if len(s) > 1: print('EXAMPLE TWICE', repr(t), sorted(s)); problems += 1
for i, n in count.items():
    if n > 60: print('OVER 60', i, n); problems += 1
print(problems, 'problems;', sum(len(v) for v in ids.values()), 'new questions')
