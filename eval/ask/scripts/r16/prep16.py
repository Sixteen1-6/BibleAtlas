"""prep16.py: the blind set for round 16. Gather the fresh16 writers' own files (raw/w-<kind>-<voice>-<angle>.json,
which never passed through the tuning session), drop any message already seen (seen17.txt), now a question,
phrasing or example in the branch's config (norm match), or repeated, and print counts only."""
import json, re, collections, os, glob
def norm(s):
    s = re.sub(r"['’‘ʼ]", '', s.lower())
    return ' '.join(re.findall(r'[^\W_]+', s))
R = os.environ.get('ATLAS_REPO', '.') + '/config/'
qs = json.load(open(R + 'questions.json'))['questions']
ex = json.load(open(R + 'ask-examples.json'))['examples']
known = set()
for q in qs:
    for p in [q['question']] + q['also']: known.add(norm(p))
for v in ex.values():
    for e in v: known.add(norm(e))
seen = {norm(l) for l in open('seen17.txt', encoding='utf-8') if l.strip()}
fresh = []
for f in sorted(glob.glob('raw/w-*.json')):
    k, v, a = map(int, re.findall(r'\d+', os.path.basename(f)))
    fresh += [{'q': q, 'kind': k, 'voice': v, 'angle': a} for q in json.load(open(f)) if isinstance(q, str) and q.strip()]
json.dump({'questions': fresh}, open('fresh16-raw.json', 'w'), indent=1, ensure_ascii=False)
keep, why, dup = [], collections.Counter(), set()
for m in fresh:
    k = norm(m['q'])
    if k in seen: why['seen'] += 1; continue
    if k in known: why['in config'] += 1; continue
    if k in dup: why['repeat'] += 1; continue
    dup.add(k); keep.append(m)
json.dump(keep, open('blind-fresh16.json', 'w'), indent=1, ensure_ascii=False)
print(len(fresh), 'written;', dict(why), ';', len(keep), 'kept', dict(collections.Counter(m['kind'] for m in keep)))
