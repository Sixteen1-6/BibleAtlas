#!/usr/bin/env python3
"""join_second.py <second.js journal>... <confirmed.json>: keep the found cites the verifier confirmed
(or confirmed with a corrected quote)."""
import json, sys
label, found, verd = {}, {}, {}
for line in (l for jp in sys.argv[1:-1] for l in open(jp)):
    j = json.loads(line)
    if j.get('type') == 'started':
        label[j['agentId']] = j.get('label', '')
    elif j.get('type') == 'result' and isinstance(j.get('result'), dict):
        lab = label.get(j['agentId'], '')
        if lab.startswith('find:'):
            for c in j['result'].get('cites', []):
                found[(c['passage'], c['layer'], c['source'], c['on'])] = c
        elif lab.startswith('verify:'):
            for r in j['result'].get('results', []):
                verd[(r['passage'], r['layer'], r['source'], r['on'])] = r
out, tally = [], {'confirmed': 0, 'quote-fixed': 0, 'rejected': 0, 'unverified': 0}
for k, c in found.items():
    r = verd.get(k)
    if r is None:
        tally['unverified'] += 1
        continue
    tally[r['verdict']] += 1
    if r['verdict'] == 'rejected':
        continue
    c = dict(c)
    if r['verdict'] == 'quote-fixed' and r.get('quote'):
        c['quote'] = r['quote']
    out.append(c)
json.dump(out, open(sys.argv[-1], 'w'), ensure_ascii=False, indent=1)
print(len(out), 'cites kept', tally, len({(c['passage'], c['layer']) for c in out}), 'notes')
