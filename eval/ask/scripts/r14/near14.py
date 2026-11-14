"""near14.py DRAFT.json [...]: pairs of new questions from different drafts that ask nearly the same thing,
by tf-idf cosine over each one's question, phrasings and examples (prints pairs at or above 0.35)."""
import json, math, os, re, sys, collections
def toks(s): return [w for w in re.findall(r"[a-z0-9]+", s.lower().replace("'", '')) if len(w) > 2]
docs = {}
for p in sys.argv[1:]:
    d = json.load(open(p, encoding='utf-8'))
    for q in d.get('new', []):
        text = ' '.join([q['question']] + q.get('also', []) + d.get('examples', {}).get(q['id'], []))
        docs[q['id']] = (os.path.basename(p), collections.Counter(toks(text)), q['question'])
df = collections.Counter(w for _, c, _ in docs.values() for w in c)
N = len(docs)
vec = {}
for i, (f, c, _) in docs.items():
    v = {w: (1 + math.log(n)) * math.log(N / df[w]) for w, n in c.items()}
    norm = math.sqrt(sum(x * x for x in v.values())) or 1
    vec[i] = {w: x / norm for w, x in v.items()}
ids = list(docs)
out = []
for a in range(len(ids)):
    for b in range(a + 1, len(ids)):
        x, y = vec[ids[a]], vec[ids[b]]
        s = sum(v * y.get(w, 0) for w, v in x.items())
        if s >= float(os.environ.get('MIN', 0.35)): out.append((s, ids[a], ids[b]))
for s, a, b in sorted(out, reverse=True):
    print(f'{s:.2f}  {a} ({docs[a][0]}) | {b} ({docs[b][0]})\n      {docs[a][2]} | {docs[b][2]}')
print(len(out), 'pairs')
