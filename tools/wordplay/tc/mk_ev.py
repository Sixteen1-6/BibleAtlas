"""mk_ev.py: the notes whose evidence must change under the PR #63 rules -> out/ev_tasks.json"""
import json, re
f = json.load(open('out/facts.json'))
S = json.load(open('/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw/config/layer-sources.json'))
CITE = {c['id']: c for c in S['cite']}
WN = {x['id']: x['name'] for x in S['writers']}


NEVER_QUOTED = ('pulpit', 'net-notes', 'reformation-sb')


def toks(s):
    return re.findall(r"[a-z']+", s.lower())


def naming(k):
    s, w, key = k['cite']['source'], k['writer'], k['key']
    if s == 'barnes' and w != ['Albert Barnes']:
        return f"{' and '.join(w)} (Barnes' Notes)"
    if s == 'henry' and w != ['Matthew Henry']:
        return f"{w[0]} (Matthew Henry's Commentary)"
    if s == 'poole' and w != ['Matthew Poole']:
        return "the continuation of Poole's Annotations" if (w[0] or '').startswith('a continuator') else f"{w[0]} (Poole's Annotations)"
    if s == 'henry-concise':
        if key == 'matthew-henry':
            return "Henry's Concise Commentary (it counts as Matthew Henry)"
        return f"the Concise Commentary (abridging {WN.get(key, key)}'s continuation of Matthew Henry)"
    if s == 'catena-aurea':
        m = re.search(r'quoting (.+)$', k['cite'].get('at', ''))
        return f"{m.group(1) if m else '?'}, in the Catena Aurea" if k['work'] == 'catena-aurea' else 'Rabanus Maurus, in the Catena Aurea'
    return CITE[s]['name']


tasks = []
for x in f:
    e = x['evidence'] or ''
    reasons = []
    for k in x['kept']:
        s, w = k['cite']['source'], k['writer']
        if s == 'barnes' and w != ['Albert Barnes'] and 'Barnes' in e:
            reasons.append(f"the evidence says Barnes, but Barnes' Notes on {k['book']} are by {' and '.join(w)}")
        if s == 'henry' and w != ['Matthew Henry'] and 'Henry' in e:
            reasons.append(f"the evidence says Henry, but Matthew Henry's Commentary on {k['book']} is by {w[0]}")
        if s == 'henry-concise' and k['key'] != 'matthew-henry' and ('Concise' in e or 'Henry' in e):
            reasons.append(f"the Concise Commentary on {k['book']} abridges {WN.get(k['key'], k['key'])}'s continuation, not Matthew Henry")
        if s == 'poole' and w != ['Matthew Poole'] and 'Poole' in e:
            reasons.append(f"Poole's Annotations on {k['book']} {k['chapter']} are by {w[0]}")
    et = toks(e)
    eg = {tuple(et[i:i + 5]) for i in range(len(et) - 4)}
    for k in x['kept']:
        if k['cite']['source'] in NEVER_QUOTED:
            for r in k['rows']:
                q = toks(r['quote'])
                common = sorted(' '.join(c) for c in eg & {tuple(q[i:i + 5]) for i in range(len(q) - 4)})
                if common:
                    reasons.append(f"the evidence repeats words of {CITE[k['cite']['source']]['name']}, which are never quoted ({'; '.join(common[:4])}): give its point in other words")
    for d in x['dropped']:
        reasons.append(f"cite dropped: {d['cite']['source']} on {d['cite'].get('on')} ({d['why']}); take out what the evidence credits to it")
    if reasons or x['passage'] == 'galatians-3-6':
        tasks.append({'passage': x['passage'], 'note': x['note'], 'kind': x['kind'], 'strength': x['new_strength'], 'text': x['text'],
                      'evidence': e, 'why': sorted(set(reasons)),
                      'kept': [{'source': k['cite']['source'], 'on': k['cite'].get('on'), 'at': k['cite'].get('at'), 'call_it': naming(k),
                                'quotes': [r['quote'] for r in k['rows']]} for k in x['kept']],
                      'dropped': [{'source': d['cite']['source'], 'on': d['cite'].get('on'), 'why': d['why']} for d in x['dropped']]})
json.dump(tasks, open('out/ev_tasks.json', 'w'), indent=1, ensure_ascii=False)
print(len(tasks))
