#!/usr/bin/env python3
"""post3.py <out dir> <journal.jsonl>...: write3.js journals -> Layers hand-off files.

Re-applies the skeptic's verdicts exactly as write3.js did (so the checker's note ids line up), then the
checker's and second reader's decisions, then re-checks every local quote (cq, osn, cat), converts cites to
the Layers format and splits passages into new (rule 7 met, or carried by figure/parallelism/contrast notes)
and held (one writer on every other note). Writes new-passages.json, held-back.json, additions.json,
quotes.json and report.json, ready for finalize.py."""
import json, os, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq, osn, cat
from fosfig import fos_heading

out_dir, journals = sys.argv[1], sys.argv[2:]
import lib3
from lib3 import CITE, LOCAL, STANDALONE, EXTRA, ORDER, RANK, NAME, live_ids, report, writer_key, convert, SRC_LINE

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
                res.setdefault(key, {})[stage] = j['result']

def review(draft, check):
    verdicts, fixes = {}, {}
    for v in (check or {}).get('verdicts', []):
        verdicts.setdefault(f"{v['ref']}#{v['layer']}", v)
    for f in (check or {}).get('passage_fixes', []):
        fixes.setdefault(f['ref'], []).append(f)

    def judged(ref, layers):
        out = []
        for i, l in enumerate(layers):
            v = verdicts.get(f'{ref}#{i}')
            if not v or v['verdict'] == 'drop':
                report['dropped_layers'].append({'where': ref, 'kind': l['kind'], 'why': 'skeptic: ' + (v['reason'] if v else 'no verdict')})
                continue
            if v['verdict'] == 'fix':
                if not v.get('fixed'):
                    report['dropped_layers'].append({'where': ref, 'kind': l['kind'], 'why': 'fix with no layer'})
                    continue
                out.append(v['fixed'])
            else:
                out.append(l)
        return out
    ps = []
    for p in draft.get('passages', []):
        q = dict(p)
        for f in fixes.get(p['ref'], []):
            q[f['field']] = f['value']
        q['layers'] = judged(p['ref'], p['layers'])
        ps.append(q)
    adds = []
    for a in draft.get('additions', []):
        ls = [l for l in judged(a['ref'], a['layers']) if l['kind'] != 'plain meaning']
        if ls:
            adds.append({**a, 'layers': ls})
    return ps, adds


def apply_checks(notes, check, confirm):
    """notes: id -> layer (dict, mutated). Returns ids to drop."""
    drop = set()
    if not check:
        return drop
    conf = {c['note']: c for c in (confirm or {}).get('results', [])}
    for r in check.get('results', []):
        nid = r['note']
        if nid not in notes:
            continue
        l = notes[nid]
        if r['verdict'] == 'ok' and not r.get('remove_cites'):
            if RANK.get(r['strength'], 3) < RANK[l['strength']]:
                l['strength'] = r['strength']  # an honest lowering needs no second reader
            continue
        c = conf.get(nid)
        if not c:
            report['unconfirmed'].append({'note': nid, 'proposed': r['verdict'], 'reason': r['reason']})
            continue
        if c['decision'] == 'reject':
            continue
        src = r if c['decision'] == 'accept' else c
        if c['decision'] == 'accept' and r['verdict'] == 'drop':
            drop.add(nid)
            report['dropped_layers'].append({'where': nid, 'kind': l['kind'], 'why': 'check: ' + r['reason']})
            continue
        l['strength'] = src.get('strength') or l['strength']
        for k in ['text', 'evidence'] + EXTRA[:-1]:
            if src.get(k):
                l[k] = src[k]
        rm = set(src.get('remove_cites') or [])
        if rm:
            l['cites'] = [x for n, x in enumerate(l['cites']) if n not in rm]
    return drop


new, held, adds, quotes = [], [], [], []
seen_ids = set(live_ids)
for key in sorted(res, key=lambda k: (k.rsplit('-', 1)[0], int(k.rsplit('-', 1)[1]) if k.rsplit('-', 1)[1].isdigit() else 0)):
    r = res[key]
    d = r.get('write')
    if not d:
        continue
    report['writer_dropped'] += [{**x, 'batch': key} for x in d.get('dropped', [])]
    if (d.get('passages') or d.get('additions')) and 'verify' not in r:
        report['missing_stage'].append({'batch': key, 'stage': 'verify'})
        continue
    ps, ads = review(d, r.get('verify'))
    notes = {}
    for p in ps:
        for i, l in enumerate(p['layers']):
            if l['kind'] != 'plain meaning':
                notes[f"{p['ref']}#p{i}"] = l
    for a in ads:
        for i, l in enumerate(a['layers']):
            notes[f"{a['ref']}#a{i}"] = l
    if notes and 'check' not in r:
        report['missing_stage'].append({'batch': key, 'stage': 'check'})
        continue
    drop = apply_checks(notes, r.get('check'), r.get('confirm'))
    for p in ps:
        layers, rows = [], []
        for i, l in enumerate(p['layers']):
            if f"{p['ref']}#p{i}" in drop:
                continue
            c, q = convert(p['ref'], l)
            if c:
                layers.append(c)
                rows += q
        plain = [l for l in layers if l['kind'] == 'plain meaning'][:1]
        rest = sorted([l for l in layers if l['kind'] != 'plain meaning'], key=lambda l: ORDER.index(l['kind']))
        pid = p['id']
        if pid in live_ids:
            adds.append({'passage_id': pid, 'ref': live_ids[pid]['ref'], 'layers': [l for l in rest if l['kind'] != 'plain meaning']})
            quotes += [x for x in rows if x['kind'] != 'plain meaning']
            continue
        if pid in seen_ids:
            report['held'].append({'id': pid, 'why': 'id used twice'})
            continue
        seen_ids.add(pid)
        out = {'id': pid, 'section': p['section'], 'ref': p['ref'], 'saying': p['saying'], 'source': SRC_LINE, 'reviewed_by': [], 'layers': plain + rest}
        firm = any(l['strength'] != 'some interpreters' or l['kind'] in STANDALONE for l in rest)
        if not plain or not rest or not firm:
            report['held'].append({'id': pid, 'why': 'no plain meaning' if not plain else 'no note left' if not rest else 'only one-writer notes'})
            if plain and rest:
                held.append(out)
                quotes += rows
            continue
        new.append(out)
        quotes += rows
    for a in ads:
        layers, rows = [], []
        for i, l in enumerate(a['layers']):
            if f"{a['ref']}#a{i}" in drop:
                continue
            c, q = convert(a['ref'], l)
            if c:
                layers.append(c)
                rows += q
        if not layers:
            continue
        if a['passage_id'] not in live_ids:
            report['held'].append({'id': a['passage_id'], 'why': 'addition for a passage that is not live'})
            continue
        adds.append({'passage_id': a['passage_id'], 'ref': a['ref'], 'layers': layers})
        quotes += rows

os.makedirs(out_dir, exist_ok=True)
json.dump({'passages': new}, open(f'{out_dir}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': held}, open(f'{out_dir}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump(adds, open(f'{out_dir}/additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out_dir}/quotes.json', 'w'), ensure_ascii=False, indent=1)
json.dump(report, open(f'{out_dir}/report.json', 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(f'{len(res)} batches; {len(new)} new passages, {len(held)} held, {len(adds)} additions, {len(quotes)} quote rows')
print('kinds', Counter(l['kind'] for p in new for l in p['layers']) + Counter(l['kind'] for a in adds for l in a['layers']))
print('strength', Counter(l['strength'] for p in new for l in p['layers'] if l['kind'] != 'plain meaning') + Counter(l['strength'] for a in adds for l in a['layers']))
print({k: len(v) for k, v in report.items()})
