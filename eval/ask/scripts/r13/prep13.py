"""prep13.py: the blind set for round 13. Drop any fresh13 message already seen (seen14.txt) or now a
question, phrasing or example in the branch's config (norm match), and print counts only."""
import json, re, collections, os
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
seen = {norm(l) for l in open('seen14.txt', encoding='utf-8') if l.strip()}
fresh = json.load(open('fresh13-raw.json'))
keep, why = [], collections.Counter()
dup = set()
for m in fresh:
    k = norm(m['q'])
    if k in seen: why['seen'] += 1; continue
    if k in known: why['in config'] += 1; continue
    if k in dup: why['repeat'] += 1; continue
    dup.add(k); keep.append(m)
json.dump(keep, open('blind-fresh13.json', 'w'), indent=1, ensure_ascii=False)
print(len(fresh), 'written;', dict(why), ';', len(keep), 'kept', collections.Counter(m['kind'] for m in keep))
