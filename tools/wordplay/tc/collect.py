"""collect.py: gather reads results from the workflow journals into out/reads_results.json (latest found wins)."""
import json, sys, collections
W = '/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows/'
runs = sys.argv[1:]
best, ch1 = {}, []
RANK = {'found': 2, 'not_found': 1, 'not_read': 0}
for w in runs:
    for l in open(W + w + '/journal.jsonl'):
        d = json.loads(l)
        if d.get('type') == 'result' and d.get('result'):
            for c in d['result'].get('cites', []):
                o = best.get(c['cid'])
                if o is None or RANK[c['status']] >= RANK[o['status']]:
                    best[c['cid']] = c
            ch1 += d['result'].get('chapter1', []) or []
json.dump(list(best.values()), open('out/reads_results.json', 'w'), indent=1, ensure_ascii=False)
ch = {c['url']: c for c in json.load(open('out/chapter1_direct.json'))}
for c in ch1:
    ch.setdefault(c['url'], c)
json.dump(list(ch.values()), open('out/chapter1.json', 'w'), indent=1, ensure_ascii=False)
cites = json.load(open('out/reads/cites.json'))
direct = {d['cid'] for d in json.load(open('out/reads/direct.json'))}
need = [c for c in cites if c['cid'] not in direct and c['source'] != 'tyndale-notes']
st = collections.Counter(best.get(c['cid'], {'status': 'missing'})['status'] for c in need)
print('results', len(best), 'of', len(need), st, 'chapter1 pages', len(ch), 'denying', sum(1 for c in ch.values() if c['denies_authorship']))
print('denies verdicts', [(c['cid'], c.get('verdict_words')) for c in best.values() if c.get('verdict') == 'denies'])
