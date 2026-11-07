"""diff.py <groups.json> <out dir>: what the review changed, note by note (fields, quotes, strength), and the web
quotes that changed (written to <out dir>/changed-web.json for webquote.py --file)."""
import json, glob, sys, os
g = json.load(open(sys.argv[1]))
before = {n['id']: n for x in g for n in x['notes']}
after = {}
for f in glob.glob(f'{sys.argv[2]}/config/figures/*.json'):
    for n in json.load(open(f))['notes']:
        if n['id'] in before:
            after[n['id']] = n
qc = {}
for r in json.load(open(f'{sys.argv[2]}/quote-checks.json')):
    qc[(r['note'], r['source'], r['on'])] = r
missing = [i for i in before if i not in after]
fields = {}
web = []
strength = []
for i, b in before.items():
    a = after.get(i)
    if not a:
        continue
    if a['strength'] != b['strength']:
        strength.append((i, b['strength'], a['strength']))
    for k in set(a) | set(b):
        if k in ('checked', 'cites'):
            continue
        if a.get(k) != b.get(k):
            fields[k] = fields.get(k, 0) + 1
    bc = {(c['source'], c.get('work')): c for c in b['cites']}
    for c in a['cites']:
        o = bc.get((c['source'], c.get('work')))
        if o is None or o['quote'] != c['quote']:
            fields['cite quote' if o else 'cite added'] = fields.get('cite quote' if o else 'cite added', 0) + 1
            r = qc.get((i, c['source'], c['on']))
            u = r and r['found_in']
            if u and u.startswith('http') and 'raw.githubusercontent.com' not in u:
                web.append({'id': i, 'cites': [{'source': c['source'], 'quote': c['quote'], 'found': u}]})
        elif o['on'] != c['on'] or o.get('at') != c.get('at'):
            fields['cite on/at'] = fields.get('cite on/at', 0) + 1
    gone = [s for s in bc if s not in {(c['source'], c.get('work')) for c in a['cites']}]
    if gone:
        fields['cite removed'] = fields.get('cite removed', 0) + len(gone)
json.dump({'notes': web}, open(f'{sys.argv[2]}/changed-web.json', 'w'), indent=1, ensure_ascii=False)
print(len(before), 'before;', len(after), 'after; missing', missing)
print('fields changed:', dict(sorted(fields.items(), key=lambda x: -x[1])))
print('strength changes:', strength)
print(len(web), 'changed web quotes')
