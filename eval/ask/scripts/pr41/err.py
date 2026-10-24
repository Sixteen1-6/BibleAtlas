exec(open('fit3.py').read().split("for cols in")[0])
r, S = lin(['mp', 'xBest', 'text', 'closest', 'mn', 'teach'], 2)
import random
random.seed(1)
offs = []; miss = []
by = collections.Counter()
for qi in range(len(R)):
    idx = sorted([i for i in np.where(qid == qi)[0] if judged[i]], key=lambda i: -S[i])
    top = idx[:6]
    for i in top:
        f = rows[i][1]
        if lab[i] == 0: offs.append((R[qi]['q'], f['ref'], f['mr'], round(f['mp'], 2), round(f['text'], 2), f['genre']))
        by[('top', lab[i], 'chain' if f['mr'] >= 0 else 'word')] += 1
    for i in idx[6:]:
        if lab[i] == 2: miss.append((R[qi]['q'], rows[i][1]['ref'], rows[i][1]['mr'], round(rows[i][1]['mp'], 2)))
print(by)
src = collections.Counter(('mr', o[2]) for o in offs); print(src)
for o in random.sample(offs, 25): print(o)
print(len(miss))
