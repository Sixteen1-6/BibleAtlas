#!/usr/bin/env python3
"""drop_cites.py <out dir> <passage> <layer> <source>...: remove cites whose writer only reports the view."""
import json, sys
out, pid, li, srcs = sys.argv[1], sys.argv[2], int(sys.argv[3]), set(sys.argv[4:])
for f in ('new-passages.json', 'held-back.json'):
    d = json.load(open(f'{out}/{f}'))
    for p in d['passages']:
        if p['id'] == pid:
            l = p['layers'][li]
            l['cites'] = [c for c in l['cites'] if c['source'] not in srcs]
            assert l['cites']
            print(pid, li, 'now cites', [c['source'] for c in l['cites']])
    json.dump(d, open(f'{out}/{f}', 'w'), ensure_ascii=False, indent=1)
