#!/usr/bin/env python3
"""show_tighten.py <journal>...: print each proposed change with the second reader's decision."""
import json, sys, collections
ch, cf, lab = {}, {}, {}
for jp in sys.argv[1:]:
    for line in open(jp):
        j = json.loads(line)
        if j.get('type') == 'started':
            lab[j['agentId']] = j['label']
        if j.get('type') == 'result' and isinstance(j.get('result'), dict):
            l = lab[j['agentId']]
            for r in j['result']['results']:
                (ch if l.startswith('check') else cf)[(r['passage'], r['layer'])] = r
print(collections.Counter(r['verdict'] for r in ch.values()), len(cf), 'confirms')
for k, r in ch.items():
    if r['verdict'] != 'ok' or r.get('remove_cites'):
        c = cf.get(k)
        print('==', k, r['verdict'], r['strength'], r.get('remove_cites'), '|', r['reason'][:400])
        if r.get('text'):
            print('   T:', r['text'])
        if c:
            print('   C:', c['decision'], c['strength'], c.get('remove_cites'), '|', c['reason'][:400])
            if c.get('text'):
                print('   CT:', c['text'])
        else:
            print('   C: (none)')
