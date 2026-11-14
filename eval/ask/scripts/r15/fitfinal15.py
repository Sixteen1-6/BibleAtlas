"""fitfinal15.py <dir> <mode> <out.json>: FIT's weights fitted on every judged verse of every gathered message
traced in dir (as fit15.py, without cross-validation), for gather.ts: the inputs' weights for answers and off,
and, with "+v", the word-meaning model's direction for the verse (256 values each, for its unit vector)."""
import json, sys, os
out = sys.argv[3]
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fit15.py')).read().split('pairs = []')[0]
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2], '10']
exec(src)
wa, wo = fitw(msgs)
r = lambda xs, d=4: [round(float(x), d) for x in xs]
res = {'mode': mode, 'messages': len(msgs), 'judged': sum(1 for m in msgs for x in m['rows'] if lab(m['q'], x['ref'])),
       'answers': r(wa[:k]), 'off': r(wo[:k])}
if useV:
    # fit15.py weighs 16 times the unit vector, so the weights for the unit vector are 16 times as large.
    res['dirA'] = r(16 * wa[k:], 3); res['dirO'] = r(16 * wo[k:], 3)
json.dump(res, open(out, 'w'))
print(mode, 'messages', res['messages'], 'judged rows', res['judged'])
print('answers', res['answers']); print('off', res['off'])
