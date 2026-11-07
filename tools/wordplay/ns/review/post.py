#!/usr/bin/env python3
"""post.py <journal.jsonl>...: the round 2 review's final items (confirm:r2rv-*, the last result per label) as
hand-off files in ns/review/out/:
  notes.json        new notes for config/figures (types note and revive)
  fig-replace.json  live config/figures notes with a new writer added (type addition, file config/figures)
  structures.json   new entries for config/structures.json
  str-replace.json  live structures with a new writer added
  quotes.json       where each quotation was read (one record per cite), for the evidence files
  report.json       dropped items and anything a check refused
Each cite keeps only the fields the app takes; found and context go to quotes.json. Every archive.org quote is
looked for in what WebFetch returned for its page (webquote.py), every local quote in its pinned copy (figcheck
--quotes / strcheck --quotes, run after)."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
NS = os.path.dirname(HERE)
WP = os.path.dirname(NS)
sys.path.insert(0, f'{WP}/fig')
import figcheck as fc
import webquote

KEEP = ('source', 'work', 'on', 'at', 'url', 'quote', 'read', 'retrieved')
OUT = f'{HERE}/out'
os.makedirs(OUT, exist_ok=True)
lab, res = {}, {}
for p in sys.argv[1:]:
    for line in open(p):
        j = json.loads(line)
        if j['type'] == 'started':
            lab[j['agentId']] = j.get('label', '')
        elif j['type'] == 'result' and lab.get(j['agentId'], '').startswith('confirm:'):
            res[lab[j['agentId']]] = j['result']
groups = json.load(open(f'{HERE}/groups.json'))
want = {f'confirm:r2rv-{k}' for k in range(len(groups))}
missing = sorted(want - set(res), key=lambda s: int(s.rsplit('-', 1)[1]))
out = {'notes': [], 'fig-replace': [], 'structures': [], 'str-replace': []}
quotes, report = [], {'missing_groups': missing, 'dropped': [], 'web_not_found': [], 'no_found': []}
URL = re.compile(r'https?://[^\s\'")>\]]+')
for label in sorted(res, key=lambda s: int(s.rsplit('-', 1)[1])):
    for it in res[label]['items']:
        if it['verdict'] == 'drop':
            report['dropped'].append({'group': label, 'id': it['id'], 'type': it['type'], 'reason': it['reason']})
            continue
        e = json.loads(json.dumps(it['entry']))
        e.pop('_from', None)
        kept = []
        for c in e.get('cites', []):
            f = c.get('found') or ''
            rec = {'entry': e['id'], 'file': it['file'], 'source': c['source'], 'work': c.get('work'), 'on': c['on'],
                   'quote': c['quote'], 'found': f, 'read': c.get('read'), 'retrieved': c.get('retrieved')}
            if c['source'] in ('lowth', 'jebb', 'boys', 'forbes'):
                urls = [u.rstrip('.,;') for u in URL.findall(f) if 'archive.org' in u and '/details/' not in u]
                ok = False
                for u in urls:
                    hit, t, n = webquote.check(u, c['quote'])
                    if hit:
                        ok, rec['found_in'], rec['fetched'] = True, u, t
                        break
                if not ok:
                    best = max([(webquote.fuzzy(u, c['quote']), u) for u in urls] or [(0, None)])
                    if best[0] >= 0.9:
                        ok, rec['found_in'], rec['ocr_match'] = True, best[1], round(best[0], 3)
                        report.setdefault('ocr_corrected', []).append({'entry': e['id'], 'source': c['source'], 'ratio': round(best[0], 3)})
                if not ok:
                    report['web_not_found'].append({'entry': e['id'], 'source': c['source'], 'on': c['on'], 'urls': urls[:3], 'quote': c['quote'][:160]})
            elif not f:
                report['no_found'].append({'entry': e['id'], 'source': c['source'], 'on': c['on']})
            quotes.append(rec)
            kept.append({k: c[k] for k in KEEP if k in c})
        e['cites'] = kept
        if it['type'] in ('note', 'revive'):
            out['notes'].append(e)
        elif it['type'] == 'structure':
            out['structures'].append(e)
        elif it['file'] == 'config/figures':
            out['fig-replace'].append(e)
        else:
            out['str-replace'].append(e)
for k, v in out.items():
    key = 'structures' if k in ('structures', 'str-replace') else 'notes'
    json.dump({key: v}, open(f'{OUT}/{k}.json', 'w'), indent=1, ensure_ascii=False)
json.dump(quotes, open(f'{OUT}/quotes.json', 'w'), indent=1, ensure_ascii=False)
json.dump(report, open(f'{OUT}/report.json', 'w'), indent=1, ensure_ascii=False)
print({k: len(v) for k, v in out.items()}, len(quotes), 'quotes;', {k: len(v) for k, v in report.items()})
