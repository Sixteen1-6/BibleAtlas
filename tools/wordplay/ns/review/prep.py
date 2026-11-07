"""prep.py: round 2 review groups (ns/review/groups.json): the 91 notes, 13 structures and the additions, each
cite carrying the found record its second reader wrote (from the mine2 journal, wf_4309f459-2fa)."""
import json, os, subprocess, sys
NS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.dirname(os.path.dirname(NS))
J = '/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows/wf_4309f459-2fa/journal.jsonl'
lab, res = {}, {}
for l in open(J):
    j = json.loads(l)
    if j['type'] == 'started':
        lab[j['agentId']] = j.get('label')
    elif j['type'] == 'result':
        res[lab.get(j['agentId'])] = j['result']
found = {}
for k, r in res.items():
    if not k.startswith('check2:'):
        continue
    for c in r['candidates']:
        e = c['entry']
        eid = e.get('id') or e.get('note')
        for x in (c.get('cites') or []) + (e.get('cites') or []) + ([e['cite']] if 'cite' in e else []):
            if x.get('found'):
                found[(eid, x['source'], x['on'])] = x['found']
def withfound(eid, cites):
    out = []
    for c in cites:
        c = dict(c)
        f = found.get((eid, c['source'], c['on']))
        if f:
            c['found'] = f
        out.append(c)
    return out
notes = json.load(open(f'{NS}/r2-notes-main.json'))['notes']
strs = json.load(open(f'{NS}/r2-structures-main.json'))['structures']
r2 = json.load(open(f'{NS}/round2.json'))
LWF = f'{S}/lwf'
main_fig = {}
for f in subprocess.check_output(['git', '-C', LWF, 'ls-tree', '--name-only', 'HEAD', 'config/figures/']).decode().split():
    for n in json.loads(subprocess.check_output(['git', '-C', LWF, 'show', 'HEAD:' + f]))['notes']:
        main_fig[n['id']] = n
main_str = {s['id']: s for s in json.loads(subprocess.check_output(['git', '-C', LWF, 'show', 'HEAD:config/structures.json']))['structures']}
held = {x['note']['id']: x['note'] for x in json.load(open(f'{NS}/../fig/out_p2/report.json'))['held']}
items = []
for n in notes:
    items.append({'type': 'note', 'entry': dict(n, cites=withfound(n['id'], n['cites']))})
for s in strs:
    items.append({'type': 'structure', 'entry': dict(s, cites=withfound(s['id'], s['cites']))})
seen = set()
skipped = []
for a in r2['additions']:
    t = a['note']
    key = (t, a['cite']['source'], a['cite'].get('work'), a['cite']['on'])
    if key in seen:
        skipped.append((t, 'same addition twice'))
        continue
    seen.add(key)
    cite = dict(a['cite'])
    f = found.get((t, cite['source'], cite['on']))
    if not f:
        for x in a.get('_cites') or []:
            if x.get('found') and x['source'] == cite['source']:
                f = x['found']
    if f:
        cite['found'] = f
    if t in main_fig:
        items.append({'type': 'addition', 'file': 'config/figures', 'target': main_fig[t], 'cite': cite})
    elif t in main_str:
        items.append({'type': 'addition', 'file': 'config/structures.json', 'target': main_str[t], 'cite': cite})
    elif t in held:
        items.append({'type': 'revive', 'file': 'config/figures', 'target': held[t], 'cite': cite,
                      'held_because': 'evidence still named Gill, whose cite was dropped (Gill is never quoted in figure notes)'})
    else:
        skipped.append((t, 'target is one of our own notes or not found: ' + ('in round 2 already' if any(s['id'] == t for s in strs) else 'not on main')))
groups = []
for typ, size in (('note', 6), ('structure', 4), ('addition', 4), ('revive', 4)):
    xs = [i for i in items if i['type'] == typ]
    for k in range(0, len(xs), size):
        groups.append({'key': f'{typ}-{k // size}', 'items': xs[k:k + size]})
json.dump(groups, open(f'{NS}/review/groups.json', 'w'), indent=1, ensure_ascii=False)
nofound = sum(1 for i in items for c in (i['entry']['cites'] if 'entry' in i else [i['cite']]) if not c.get('found'))
print(len(items), 'items in', len(groups), 'groups;', {t: sum(1 for i in items if i['type'] == t) for t in ('note', 'structure', 'addition', 'revive')}, 'cites without found:', nofound)
print('skipped', skipped)
