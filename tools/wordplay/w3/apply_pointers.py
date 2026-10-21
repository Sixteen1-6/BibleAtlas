#!/usr/bin/env python3
"""apply_pointers.py <in dir> <items.json> <out dir> <pointer.js journal>...: adds the cites pointer.js kept.

A cite is added only when the skeptic kept it; every local quote is re-checked (lib3.convert, which also drops
what rule 6 forbids and stamps the read date). The strength is recounted by distinct writers (lib3.count_writers;
pointed cross-references count, as these are all link notes), never above what the skeptic allows and never
lowered here (a lower verdict is reported instead). Held passages whose notes now meet rule 7 move to
new-passages.json. Run finalize.py on the out dir afterwards."""
import copy, json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3
from lib3 import RANK, NAME, STANDALONE, CITE, convert, writer_key, count_writers, report

src, items_path, out, journals = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
items = json.load(open(items_path))
per = 4
groups = [items[i:i + per] for i in range(0, len(items), per)]

res = {}
for jp in journals:
    lab = {}
    for line in open(jp):
        j = json.loads(line)
        if j.get('type') == 'started':
            lab[j['agentId']] = j.get('label', '')
        elif j.get('type') == 'result' and isinstance(j.get('result'), dict):
            l = lab.get(j.get('agentId'), '')
            if ':' in l:
                stage, key = l.split(':', 1)
                k = int(key.rsplit('-', 1)[1])
                res.setdefault(k, {})[stage] = j['result']

load = lambda n, d: json.load(open(f'{src}/{n}')) if os.path.exists(f'{src}/{n}') else d
new = load('new-passages.json', {'passages': []})['passages']
held = load('held-back.json', {'passages': []})['passages']
adds = load('additions.json', [])
rows = load('quotes.json', [])

where = {}
for p in new + held:
    for i, l in enumerate(p['layers']):
        where[f"{p['id']}#{i}"] = (p['ref'], l)
for a in adds:
    for i, l in enumerate(a['layers']):
        where[f"add:{a['passage_id']}#{i}"] = (a['ref'], l)

log = {'added': [], 'dropped_by_skeptic': [], 'not_checked': [], 'lower_verdict': [], 'evidence_too_long': [], 'promoted': [], 'unchanged': []}
for k, g in enumerate(groups):
    r = res.get(k, {})
    found = {n['key']: n for n in (r.get('find') or {}).get('notes', [])}
    ref_c = {}
    for c in (r.get('refute') or {}).get('cites', []):
        ref_c[(c['key'], c['n'])] = c
    ref_n = {n['key']: n for n in (r.get('refute') or {}).get('notes', [])}
    for it in g:
        key = it['key']
        f = found.get(key)
        if not f or not f.get('add'):
            log['unchanged'].append(key)
            continue
        if not r.get('refute'):
            log['not_checked'].append(key)
            continue
        ref, layer = where[key]
        kept, dropped = [], []
        for n, c in enumerate(f['add']):
            v = ref_c.get((key, n))
            if not v or v['verdict'] != 'keep':
                dropped.append({'source': c['source'], 'why': v['reason'] if v else 'no verdict'})
                continue
            c = dict(c)
            if v.get('quote'):
                c['quote'] = v['quote']
            one = {'kind': layer['kind'], 'strength': layer['strength'], 'refs': layer['refs'], 'text': layer['text'],
                   'cites': [{'source': c['source'], 'on': c['on'], 'quote': c['quote'], 'url': c.get('url', ''),
                              **({'link': c['link']} if c.get('link') else {}), **({'at': c['at']} if c.get('at') else {}),
                              **({'writer': c['writer']} if c.get('writer') else {}),
                              **({'pointer': c['pointer']} if c.get('pointer') else {}), 'points_only': bool(c.get('points_only'))}]}
            conv, rws = convert(ref, one)
            if not conv:
                dropped.append({'source': c['source'], 'why': 'quote or source failed the local check'})
                continue
            spec = conv['cites'][0]
            if any(x['source'] == spec['source'] and x['on'] == spec['on'] and x.get('at') == spec.get('at') for x in layer['cites']):
                continue
            kept.append((spec, rws, c))
        if dropped:
            log['dropped_by_skeptic'].append({'key': key, 'dropped': dropped})
        if not kept:
            continue
        before = layer['strength']
        layer['cites'] = layer['cites'] + [s for s, _, _ in kept]
        pairs = [(c, writer_key(c)) for c in layer['cites']]
        n = count_writers(pairs)
        cap = RANK.get((ref_n.get(key) or {}).get('strength') or f['strength'], 1)
        new_rank = min(n, 3, cap)
        if new_rank < RANK[before]:
            log['lower_verdict'].append({'key': key, 'before': before, 'skeptic': NAME[cap], 'writers': n})
            new_rank = RANK[before]
        layer['strength'] = NAME[new_rank]
        t = (ref_n.get(key) or {}).get('text') or f.get('text')
        if t:
            layer['text'] = t
        all_kept = len(kept) == len(f['add'])
        ev = (ref_n.get(key) or {}).get('evidence') or (f['evidence'] if all_kept else None)
        if not ev:
            extra = ' '.join(f"{CITE[s['source']]['name']} {'points to' if c.get('points_only') else 'states the link to'} {c.get('target') or layer['refs'][1]}." for s, _, c in kept)
            ev = (layer.get('evidence', '') + ' ' + extra).strip()
        if len(ev) > 400:
            log['evidence_too_long'].append({'key': key, 'evidence': ev})
            ev = ev[:400].rsplit('. ', 1)[0] + '.'
        layer['evidence'] = ev
        for _, rws, _ in kept:
            rows += rws
        log['added'].append({'key': key, 'from': before, 'to': layer['strength'], 'writers': n, 'added': [s['source'] for s, _, _ in kept]})

still = []
for p in held:
    rest = [l for l in p['layers'] if l['kind'] != 'plain meaning']
    if any(l['strength'] != 'some interpreters' or l['kind'] in STANDALONE for l in rest):
        new.append(p)
        log['promoted'].append(p['id'])
    else:
        still.append(p)

os.makedirs(out, exist_ok=True)
json.dump({'passages': new}, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': still}, open(f'{out}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(adds, open(f'{out}/additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(rows, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
rep = load('report.json', {})
rep['pointers'] = log
rep['pointer_dropped_cites'] = report['dropped_cites']
json.dump(rep, open(f'{out}/report.json', 'w'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in log.items()}, len(new), 'new,', len(still), 'held')
