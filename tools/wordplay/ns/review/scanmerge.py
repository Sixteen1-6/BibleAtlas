#!/usr/bin/env python3
"""scanmerge.py: writes scanq.json's results into out/quotes.json (found_in: the page text read, match: how) and
moves those cites from report.json's web_not_found to scan_matched. A cite scanq did not match stays in web_not_found."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
idx = json.load(open(f'{HERE}/scanidx.json'))
sq = {(r['entry'], r['source'], r['on']): r for r in json.load(open(f'{HERE}/scanq.json'))}
q = json.load(open(f'{HERE}/out/quotes.json'))
rep = json.load(open(f'{HERE}/out/report.json'))
for x in q:
    r = sq.get((x['entry'], x['source'], x['on']))
    if not r or not isinstance(r.get('how'), list):
        continue
    pages = [p for u in r['pages'] for p in u.split('+')] or [p for p in r['named_pages'] if p in idx[r['item']]] or ['other']
    urls = []
    for p in pages:
        fs = sorted(idx[r['item']].get(p, []))
        if fs and fs[-1][1] not in urls:
            urls.append(fs[-1][1])
    x['found_in'] = urls[0] if len(urls) == 1 else urls
    x['match'] = '+'.join(r['how']) + (' (long s and OCR letters allowed)' if 'letters' in r['how'] else '')
left, moved = [], []
for w in rep['web_not_found']:
    r = sq.get((w['entry'], w['source'], w['on']))
    (moved if r and isinstance(r.get('how'), list) else left).append(w if not r else dict(w, how=r.get('how'), pages=r.get('pages')))
rep['web_not_found'] = left
rep['scan_matched'] = [{'entry': m['entry'], 'source': m['source'], 'on': m['on'], 'how': m['how'], 'pages': m['pages']} for m in moved]
json.dump(q, open(f'{HERE}/out/quotes.json', 'w'), indent=1, ensure_ascii=False)
json.dump(rep, open(f'{HERE}/out/report.json', 'w'), indent=1, ensure_ascii=False)
print(len(moved), 'matched,', len(left), 'still not found')
