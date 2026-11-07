"""addlowth.py: add mine2's two Lowth second-reader results (check2:lowth-lectures, check2:lowth-isaiah, run
wf_4309f459-2fa) to round 2: notes to r2-notes.json, additions to round2.json's additions, the raw candidates to
round2-lowth.json (with found/context, for the evidence file). Cites keep only the fields config/figures takes."""
import json, os
NS = os.path.dirname(os.path.abspath(__file__))
J = '/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows/wf_4309f459-2fa/journal.jsonl'
KEEP = ('source', 'work', 'on', 'at', 'url', 'quote', 'read', 'retrieved')
lab, res = {}, {}
for l in open(J):
    j = json.loads(l)
    if j['type'] == 'started':
        lab[j['agentId']] = j.get('label')
    elif j['type'] == 'result':
        res[lab.get(j['agentId'])] = j['result']
cands = []
for k in ('check2:lowth-lectures', 'check2:lowth-isaiah'):
    for c in res[k]['candidates']:
        c['_from'] = k.split(':')[1]
        cands.append(c)
json.dump(cands, open(f'{NS}/round2-lowth.json', 'w'), indent=1, ensure_ascii=False)
notes = json.load(open(f'{NS}/r2-notes.json'))
have = {n['id'] for n in notes['notes']}
r2 = json.load(open(f'{NS}/round2.json'))
added = {'figure': 0, 'addition': 0, 'structure': 0, 'dup': 0}
for c in cands:
    e = json.loads(json.dumps(c['entry']))
    if c['target'] == 'figure':
        if e['id'] in have:
            added['dup'] += 1
            continue
        e['cites'] = [{k: x[k] for k in KEEP if k in x} for x in e['cites']]
        notes['notes'].append(e)
        have.add(e['id'])
        added['figure'] += 1
    elif c['target'] == 'addition':
        r2['additions'].append({'note': e['note'], 'cite': {k: e['cite'][k] for k in KEEP if k in e['cite']}, '_from': c['_from'], '_cites': c.get('cites')})
        added['addition'] += 1
    else:
        added['structure'] += 1
json.dump(notes, open(f'{NS}/r2-notes.json', 'w'), indent=1, ensure_ascii=False)
json.dump(r2, open(f'{NS}/round2.json', 'w'), indent=1, ensure_ascii=False)
print(added, len(notes['notes']), 'notes', len(r2['additions']), 'additions')
