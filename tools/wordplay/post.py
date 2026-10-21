#!/usr/bin/env python3
"""Turn the write-and-verify workflow journals into files for the Layers thread.

  python3 -I post.py <out dir> <journal.jsonl> [<journal.jsonl> ...]

Reads each writer's draft and its checker's verdicts (matched by the batch key
in the agent labels), applies keep / fix / drop and the passage fixes, re-checks
every quote against the local commentary copies, converts cites to the Layers
format (config/layer-sources.json ids) and writes:

  new-passages.json   {"passages": [...]} in config/layers.json's shape
  additions.json      [{"passage_id", "ref", "layers": [...]}] for passages already there
  quotes.json         one row per cite: where, source, on/at, the verbatim quote, the file it was read in
  report.json         what was dropped and why
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq

out_dir, journals = sys.argv[1], sys.argv[2:]
FOS_TITLE = 'E. W. Bullinger, Figures of Speech Used in the Bible (1898)'
SOURCE = {'gill': 'gill', 'clarke': 'clarke', 'barnes': 'barnes', 'jfb': 'jfb', 'kad': 'keil-delitzsch',
          'mhcc': 'henry-concise', 'wesley': 'wesley', 'cb': 'bullinger-cb', 'fos': 'bullinger-fos'}
OT_ONLY = {'kad'}
ORDER = ['plain meaning', 'quotation', 'allusion', 'wordplay', 'name meaning', 'pattern', 'irony', 'fulfillment', 'setting']

drafts, checks = {}, {}
for jp in journals:
    label = {}
    for line in open(jp):
        j = json.loads(line)
        if j.get('type') == 'started':
            label[j['agentId']] = j.get('label', '')
        elif j.get('type') == 'result' and isinstance(j.get('result'), dict):
            lab = label.get(j.get('agentId'), '')
            if lab.startswith('write:'):
                drafts[lab[6:]] = j['result']
            elif lab.startswith('verify:'):
                checks[lab[7:]] = j['result']

report = {'dropped': [], 'unverified': [], 'writer_dropped': [], 'fixes': []}


from fosfig import fos_heading


def convert(where, layer):
    """Layers-format layer, or None if no cite survives."""
    cites, quotes = [], []
    for c in layer.get('cites', []):
        w, on, q = c.get('work'), c.get('on', ''), c.get('quote', '')
        try:
            ok = w in SOURCE and cq.check(w, on, q)
        except SystemExit:
            ok = False
        if not ok:
            report['dropped'].append({'where': where, 'kind': layer['kind'], 'why': f'quote not found in {w} on {on}'})
            continue
        b = cq.parse(on)[0]
        if w in OT_ONLY and b > 38:
            continue
        found = cq.get(w, on)[0]  # the verse the comment is filed under
        if w in ('mhcc', 'wesley'):
            on = found
        spec = {'source': SOURCE[w], 'on': on}
        if w == 'fos':
            h = fos_heading(on, q)
            spec['at'] = f'{FOS_TITLE}, {h}' if h else FOS_TITLE
        if any(x['source'] == spec['source'] and x['on'] == spec['on'] for x in cites):
            continue
        cites.append(spec)
        quotes.append({'where': where, 'kind': layer['kind'], **spec, 'quote': q, 'read_in': cq.url(w, on)})
    if not cites:
        return None, []
    out = {'kind': layer['kind'], 'strength': layer['strength'], 'refs': layer['refs']}
    if layer.get('words'):
        out['words'] = layer['words']
    if layer.get('evidence'):
        out['evidence'] = layer['evidence']
    out['cites'] = cites
    out['text'] = layer['text']
    return out, quotes


passages, additions, quotes = [], [], []
for key in sorted(drafts):
    d, ch = drafts[key], checks.get(key)
    report['writer_dropped'] += [{**x, 'batch': key} for x in d.get('dropped', [])]
    verdicts = {}
    for v in (ch or {}).get('verdicts', []):
        verdicts.setdefault((v['ref'], v['layer']), v)
    pfix = {}
    for f in (ch or {}).get('passage_fixes', []):
        pfix.setdefault(f['ref'], []).append(f)

    def judged(ref, layers):
        kept = []
        for i, l in enumerate(layers):
            v = verdicts.get((ref, i))
            if v is None:
                report['unverified'].append({'where': ref, 'kind': l['kind'], 'batch': key})
                continue
            if v['verdict'] == 'drop':
                report['dropped'].append({'where': ref, 'kind': l['kind'], 'why': v['reason']})
                continue
            if v['verdict'] == 'fix':
                if not v.get('fixed'):
                    report['dropped'].append({'where': ref, 'kind': l['kind'], 'why': 'fix with no fixed layer: ' + v['reason']})
                    continue
                report['fixes'].append({'where': ref, 'kind': l['kind'], 'why': v['reason']})
                l = v['fixed']
            kept.append(l)
        return kept

    for p in d.get('passages', []):
        p = dict(p)
        for f in pfix.get(p['ref'], []):
            p[f['field']] = f['value']
        layers = []
        for l in judged(p['ref'], p['layers']):
            c, q = convert(p['ref'], l)
            if c:
                layers.append(c)
                quotes += q
        plain = [l for l in layers if l['kind'] == 'plain meaning']
        rest = [l for l in layers if l['kind'] != 'plain meaning']
        if not plain or not any(l['strength'] != 'some interpreters' for l in rest):
            report['dropped'].append({'where': p['ref'], 'kind': 'passage', 'why': 'no plain meaning or no firm note left'})
            continue
        layers = plain[:1] + sorted(rest, key=lambda l: ORDER.index(l['kind']) if l['kind'] in ORDER else 99)
        passages.append({'id': p['id'], 'section': p['section'], 'ref': p['ref'], 'saying': p['saying'],
                         'source': 'Drafted with AI help (Claude) from the BSB, STEPBible TAHOT and TAGNT, and the commentaries named under each note.',
                         'reviewed_by': [], 'layers': layers})
    for a in d.get('additions', []):
        layers = []
        for l in judged(a['ref'], a['layers']):
            if l['kind'] == 'plain meaning':
                continue
            c, q = convert(a['ref'], l)
            if c:
                layers.append(c)
                quotes += q
        if layers:
            additions.append({'passage_id': a['passage_id'], 'ref': a['ref'], 'layers': layers})

missing = sorted(set(drafts) - set(checks))
os.makedirs(out_dir, exist_ok=True)
json.dump({'passages': passages}, open(f'{out_dir}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
json.dump(additions, open(f'{out_dir}/additions.json', 'w'), ensure_ascii=False, indent=1)
json.dump(quotes, open(f'{out_dir}/quotes.json', 'w'), ensure_ascii=False, indent=1)
json.dump(report, open(f'{out_dir}/report.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(drafts)} batches written, {len(checks)} checked, {len(missing)} unchecked: {missing[:5]}')
print(f'{len(passages)} new passages ({sum(len(p["layers"]) for p in passages)} layers), '
      f'{len(additions)} additions ({sum(len(a["layers"]) for a in additions)} layers), {len(quotes)} quotes')
print({k: len(v) for k, v in report.items()})
