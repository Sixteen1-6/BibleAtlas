#!/usr/bin/env python3
"""scanidx.py: every archive.org page WebFetch returned in this session's workflow agents, keyed by item and page
index (BookReader page text, page=N) or item and 'other' (search inside, details pages, djvu.txt), written to
ns/review/scanidx.json as {item: {page: [[timestamp, url, text], ...]}}."""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, f'{os.path.dirname(os.path.dirname(HERE))}/w3')
import fetchlog

files = [l for l in subprocess.run(['rg', '-l', '-F', '--glob', 'agent-*.jsonl', 'archive.org', fetchlog.ROOT],
                                   capture_output=True, text=True).stdout.split('\n') if l]
idx = {}


def key(u):
    from urllib.parse import unquote
    u = unquote(u)
    m = re.search(r'/items/([^/]+)/', u) or re.search(r'item_id=([^&]+)', u) or re.search(r'/(?:details|stream|download)/([^/?]+)', u)
    if not m:
        return None, None
    item = m.group(1)
    p = re.search(r'[?&]page=(\d+)', u)
    return item, (p.group(1) if p and 'BookReaderGetTextWrapper' in u else 'other')


n = 0
for p in files:
    calls = {}
    for line in open(p, errors='replace'):
        if 'archive.org' not in line and 'tool_result' not in line:
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        c = (d.get('message') or {}).get('content')
        if not isinstance(c, list):
            continue
        for b in c:
            if b.get('type') == 'tool_use' and b.get('name') == 'WebFetch':
                u = (b.get('input') or {}).get('url', '')
                if 'archive.org' in u:
                    calls[b.get('id')] = u
            elif b.get('type') == 'tool_result' and b.get('tool_use_id') in calls and not b.get('is_error'):
                u = calls[b['tool_use_id']]
                body = b.get('content')
                text = body if isinstance(body, str) else ' '.join(x.get('text', '') for x in body or [] if isinstance(x, dict))
                item, page = key(u)
                if item:
                    idx.setdefault(item, {}).setdefault(page, []).append([d.get('timestamp'), u, text])
                    n += 1
json.dump(idx, open(f'{HERE}/scanidx.json', 'w'))
print(len(files), 'files', n, 'fetches', {k: len(v) for k, v in idx.items()})
