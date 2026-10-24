"""fitfinal.py: fit FIT's two weightings on every judged verse of the traced dev messages; print them for gather.ts."""
exec(open('fit12c.py').read())
X=[]; ya=[]; yo=[]
for m in msgs:
    mf = mfeats(m)
    for r in m['trace']['rows']:
        l = lab(m['q'], r['ref'])
        if not l: continue
        X.append(feats2(r, m, mf)); ya.append(l=='answers'); yo.append(l=='off')
X = np.array(X); wa = logit(X, np.array(ya, float)); wo = logit(X, np.array(yo, float))
print('rows', len(X), 'answers', int(sum(ya)), 'off', int(sum(yo)))
json.dump({'names': N2, 'answers': [round(float(w), 4) for w in wa], 'off': [round(float(w), 4) for w in wo]}, open('fit-weights.json', 'w'))
print('answers:', ', '.join(f'{w:.4f}' for w in wa))
print('off:', ', '.join(f'{w:.4f}' for w in wo))
