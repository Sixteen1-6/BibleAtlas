#!/usr/bin/env python3
"""settle_apply14.py W14_DIR RESULT.json [...]: put the settle workflow's merged answers in place of
the pairs they replace. For each pair, both sides' questions (and their example lists) leave their
drafts, and the merged file is copied in as drafts/settle-<key>.json."""
import json, os, sys, shutil
W = sys.argv[1]
for rp in sys.argv[2:]:
    for r in json.load(open(rp))['results']:
        if not r or not r.get('reviewed'): print('SKIP pair with no review', r and r.get('key')); continue
        src = os.path.join(W, 'settle', r['key'] + '.json')
        merged = json.load(open(src))
        keep = merged['new'][0]['id']
        assert len(merged['new']) == 1 and list(merged['examples']) == [keep], src
        for s in r['sides']:
            p = os.path.join(W, 'drafts', s['file'])
            d = json.load(open(p))
            n = len(d['new'])
            d['new'] = [q for q in d['new'] if q['id'] != s['id']]
            d['examples'].pop(s['id'], None)
            assert len(d['new']) == n - 1, (p, s['id'])
            json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
        shutil.copy(src, os.path.join(W, 'drafts', 'settle-' + r['key'] + '.json'))
        print(r['key'], '->', keep, len(merged['examples'][keep]), 'examples')
