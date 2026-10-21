#!/usr/bin/env python3
"""apply_held.py <out dir> <task output or result json>...: held-second-writer results -> hand-off files.

For each of the 83 held passages (h3/held.json), applies the composed changes (kept cites + new
cites), then the fresh checker's verdicts and the second reader's decisions (same rules as post3:
an "ok" may only lower a strength; a fix or drop needs the second reader; accept takes the checker's
change, amend takes the second reader's, reject keeps the note), re-checks every new quote against
the local copies (lib3.convert), caps each strength by its distinct writers, and splits the passages
into new-passages.json (a note beyond the plain meaning that two or more writers state) and
held-back.json (still one writer). Writes quotes.json and report.json too; run finalize.py after."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3
from lib3 import RANK, NAME, ORDER, STANDALONE, convert, writer_key, report, barred, count_writers

out_dir, files = sys.argv[1], sys.argv[2:]
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
ALL_HELD = json.load(open(f'{W}/h3/held.json'))
# Passages that went live on main since (PR #50 brought back four) are no longer held.
NOW_LIVE = [h['passage']['id'] for h in ALL_HELD if h['passage']['id'] in lib3.live_ids]
HELD = {h['passage']['id']: h for h in ALL_HELD if h['passage']['id'] not in lib3.live_ids}

results = {}
for f in files:
    d = json.load(open(f))
    rs = d['result'] if isinstance(d, dict) and 'result' in d else d
    for r in rs or []:
        if r and r.get('pid'):
            results[r['pid']] = r

report.update({'stays_held': [], 'mended': [], 'not_run': [], 'too_long': [], 'now_live_on_main': NOW_LIVE})


def decide(view_notes, checked, confirmed):
    """Apply check + confirm to the view's notes (dict layer -> note dict with 'cites'). Returns dropped layers."""
    drop = set()
    conf = {c['layer']: c for c in (confirmed or {}).get('results', [])}
    for r in (checked or {}).get('results', []):
        L = r['layer']
        if L not in view_notes:
            continue
        n = view_notes[L]
        if r['verdict'] == 'ok' and not r.get('remove_cites'):
            if RANK.get(r['strength'], 3) < RANK[n['strength']]:
                n['strength'] = r['strength']
            continue
        c = conf.get(L)
        if not c:
            report['unconfirmed'].append({'layer': L, 'proposed': r['verdict'], 'reason': r['reason']})
            continue
        if c['decision'] == 'reject':
            continue
        if c['decision'] == 'accept' and r['verdict'] == 'drop':
            drop.add(L)
            continue
        src = r if c['decision'] == 'accept' else c
        n['strength'] = src.get('strength') or n['strength']
        for k in ('text', 'evidence'):
            if src.get(k):
                n[k] = src[k]
        rm = set(src.get('remove_cites') or [])
        if rm:
            n['cites'] = [x for x in n['cites'] if x['n'] not in rm]
    return drop


new, held, quotes = [], [], []
for pid, h in HELD.items():
    P = json.loads(json.dumps(h['passage']))
    rows_by_layer = {}
    for q in h['quotes']:
        rows_by_layer.setdefault(q['note'], []).append(q)
    r = results.get(pid)
    if not r:
        report['not_run'].append(pid)
    elif r.get('stop') or not r.get('view'):
        report['stays_held'].append({'id': pid, 'why': r.get('stop') or 'no view'})
        r = None
    layers = {i: l for i, l in enumerate(P['layers'])}
    lrows = {i: rows_by_layer.get(i, []) for i in layers}
    if r:
        vn = {}
        for v in r['view']['notes']:
            vn[v['layer']] = {**v['note'], 'cites': v['cites']}
        dropped = decide(vn, r.get('checked'), r.get('confirmed'))
        for L, n in vn.items():
            where = f'{pid}#{L}'
            if L in dropped:
                report['dropped_layers'].append({'where': where, 'kind': n['kind'], 'why': 'check drop accepted'})
                if L < 100:
                    pass  # the old note stays as it was (still one writer)
                continue
            specs, rows, keys = [], [], []
            old = layers.get(L) if L < 100 else None
            for c in n['cites']:
                if 'current_cite' in c:
                    j = c['current_cite']
                    try:
                        spec = old['cites'][j]
                    except (TypeError, IndexError, KeyError):
                        report['dropped_cites'].append({'where': where, 'why': f'no current cite {j}'})
                        continue
                    why = barred(spec['source'], spec['on'], spec.get('at', ''))
                    if why:
                        report['dropped_cites'].append({'where': where, 'source': spec['source'], 'on': spec['on'], 'why': 'left out: ' + why})
                        continue
                    row = next((x for x in lrows.get(L, []) if x['source'] == spec['source'] and x['on'] == spec['on'] and x.get('at') == spec.get('at')), None)
                    if not row:
                        report['dropped_cites'].append({'where': where, 'why': f'no quote row for {spec}'})
                        continue
                    specs.append(spec)
                    rows.append({k: v for k, v in row.items() if k != 'note'} | {'kind': n['kind']})
                    keys.append(writer_key(spec))
                else:
                    one = {'kind': n['kind'], 'strength': n['strength'], 'refs': n['refs'], 'text': n['text'],
                           'cites': [{'source': c['source'], 'on': c['on'], 'quote': c['quote'], 'url': c.get('read_in', ''),
                                      **({'link': c['url']} if c.get('url') else {}), **({'at': c['at']} if c.get('at') else {}),
                                      **({'writer': c['writer']} if c.get('writer') else {})}]}
                    conv, rws = convert(P['ref'], one)
                    if not conv:
                        continue
                    spec = conv['cites'][0]
                    if any(s['source'] == spec['source'] and s['on'] == spec['on'] and s.get('at') == spec.get('at') for s in specs):
                        continue
                    specs.append(spec)
                    rows += rws
                    keys.append(writer_key({**c, **spec}))
            if not specs:
                report['dropped_layers'].append({'where': where, 'kind': n['kind'], 'why': 'no cite left'})
                continue
            nw = max(count_writers(list(zip(specs, keys))), 1)
            strength = n['strength']
            if RANK[strength] > min(nw, 3):
                report['dropped_layers'].append({'where': where, 'kind': n['kind'], 'why': f'strength lowered from {strength} to {NAME[min(nw, 3)]}', 'lowered': True})
                strength = NAME[min(nw, 3)]
            layer = {'kind': n['kind'], 'strength': strength, 'refs': n['refs']}
            if n.get('words'):
                layer['words'] = n['words']
            if n.get('evidence'):
                layer['evidence'] = n['evidence']
            layer['cites'] = specs
            layer['text'] = n['text']
            if len(layer['text']) > 300 or len(layer.get('evidence', '')) > 400:
                report['too_long'].append({'where': where, 'text': len(layer['text']), 'evidence': len(layer.get('evidence', ''))})
            layers[L] = layer
            lrows[L] = rows
    plain = [i for i in sorted(layers) if layers[i]['kind'] == 'plain meaning'][:1]
    rest = sorted([i for i in layers if layers[i]['kind'] != 'plain meaning'], key=lambda i: (ORDER.index(layers[i]['kind']), i))
    P['layers'] = [layers[i] for i in plain + rest]
    prow = []
    for i in plain + rest:
        for x in lrows.get(i, []):
            prow.append({k: v for k, v in x.items() if k != 'note'} | {'where': P['ref']})
    firm = any(layers[i]['strength'] != 'some interpreters' or layers[i]['kind'] in STANDALONE for i in rest)
    if r and firm:
        report['mended'].append(pid)
        new.append(P)
    else:
        held.append(P)
    quotes += prow

os.makedirs(out_dir, exist_ok=True)
json.dump({'passages': new}, open(f'{out_dir}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'passages': held}, open(f'{out_dir}/held-back.json', 'w'), ensure_ascii=False, indent=1)
json.dump([], open(f'{out_dir}/additions.json', 'w'))
json.dump(quotes, open(f'{out_dir}/quotes.json', 'w'), ensure_ascii=False, indent=1)
json.dump(report, open(f'{out_dir}/report.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(results)} results; {len(new)} mended (new), {len(held)} still held, {len(quotes)} quote rows')
print({k: len(v) for k, v in report.items()})
