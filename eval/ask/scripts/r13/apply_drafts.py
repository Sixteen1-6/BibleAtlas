#!/usr/bin/env python3
"""apply_drafts.py DRAFT.json [...]: write drafted answers into config/questions.json and
config/ask-examples.json in their own layout. A draft may hold "new" (questions, added at the end),
"examples" and "add_examples" ({id: [messages]}), and "remove_also" / "remove_examples"
({existing id: [texts]}) for phrasings or examples that move to a new question.
  apply_drafts.py --check   only rewrite both files unchanged, to show the layout round-trips."""
import json, os, sys
REPO = os.environ.get('ATLAS_REPO', '.')
QF, EF = os.path.join(REPO, 'config/questions.json'), os.path.join(REPO, 'config/ask-examples.json')
d = lambda x: json.dumps(x, ensure_ascii=False)

def block(q):
    lines = ['    {', f'      "id": {d(q["id"])},', f'      "group": {d(q["group"])},', f'      "question": {d(q["question"])},',
             f'      "also": {d(q["also"])},']
    if 'signals' in q: lines.append(f'      "signals": {d(q["signals"])},')
    lines.append('      "topics": [')
    lines.append(',\n'.join('        ' + d(t) for t in q['topics']))
    lines.append('      ],')
    lines.append('      "chain": [')
    lines.append(',\n'.join('        ' + d(p) for p in q['chain']))
    lines.append('      ]')
    lines.append('    }')
    return '\n'.join(lines)

def write_q(data):
    head = '{\n  "_comment": ' + d(data['_comment']) + ',\n  "questions": [\n'
    return head + ',\n'.join(block(q) for q in data['questions']) + '\n  ]\n}\n'

raw = open(QF, encoding='utf-8').read()
qd = json.loads(raw)
ed = json.load(open(EF, encoding='utf-8'))
if sys.argv[1:] == ['--check']:
    print('questions.json round-trips:', write_q(qd) == raw)
    print('ask-examples.json round-trips:', json.dumps(ed, indent=2, ensure_ascii=False) + '\n' == open(EF, encoding='utf-8').read())
    sys.exit()
byid = {q['id']: q for q in qd['questions']}
for p in sys.argv[1:]:
    dr = json.load(open(p, encoding='utf-8'))
    for i, texts in dr.get('remove_also', {}).items():
        before = len(byid[i]['also'])
        byid[i]['also'] = [a for a in byid[i]['also'] if a not in texts]
        if before - len(byid[i]['also']) != len(set(texts)): print('WARN', p, i, 'not every also to remove was there')
    for i, texts in dr.get('remove_examples', {}).items():
        before = len(ed['examples'][i])
        ed['examples'][i] = [e for e in ed['examples'][i] if e not in texts]
        if before - len(ed['examples'][i]) != len(set(texts)): print('WARN', p, i, 'not every example to remove was there')
    for q in dr.get('new', []):
        if q['id'] in byid: print('SKIP', p, q['id'], 'exists'); continue
        q = {k: q[k] for k in ['id', 'group', 'question', 'also', 'signals', 'topics', 'chain'] if k in q}
        qd['questions'].append(q); byid[q['id']] = q
    for k in ['examples', 'add_examples']:
        for i, ex in dr.get(k, {}).items():
            have = ed['examples'].setdefault(i, [])
            have.extend(e for e in ex if e not in have)
open(QF, 'w', encoding='utf-8').write(write_q(qd))
open(EF, 'w', encoding='utf-8').write(json.dumps(ed, indent=2, ensure_ascii=False) + '\n')
print(len(qd['questions']), 'questions,', sum(len(v) for v in ed['examples'].values()), 'examples')
