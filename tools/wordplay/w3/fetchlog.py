#!/usr/bin/env python3
"""fetchlog.py: when each web page was read. Scans every workflow agent transcript of this session for WebFetch
calls that returned a page, and keeps {url: [UTC timestamps]} in tmp/fetchlog.json (rebuilt for changed files only).
Founder decision 10 (2026-10-20): every citation gives the date its words were truly retrieved, so a web cite's
read date is the last time a checking agent fetched that page, never a guess."""
import glob, json, os, re, sys

ROOT = '/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows'
CACHE = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/tmp/fetchlog.json'
FAIL = re.compile(r'^(Request failed|Error|Failed to fetch|Unable to fetch|.*status code (4|5)\d\d)', re.I)


def norm(u):
    u = (u or '').strip()
    u = re.sub(r'^http://', 'https://', u)
    u = re.sub(r'^https://www\.', 'https://', u)
    u = u.split('#')[0].rstrip('/')
    return u.lower()


def scan(path):
    """[(url, timestamp)] for the successful WebFetch calls in one agent transcript."""
    calls, out = {}, []
    for line in open(path, errors='replace'):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        c = (d.get('message') or {}).get('content')
        if not isinstance(c, list):
            continue
        for b in c:
            if b.get('type') == 'tool_use' and b.get('name') == 'WebFetch':
                calls[b.get('id')] = (b.get('input') or {}).get('url', '')
            elif b.get('type') == 'tool_result' and b.get('tool_use_id') in calls:
                body = b.get('content')
                text = body if isinstance(body, str) else ' '.join(x.get('text', '') for x in body or [] if isinstance(x, dict))
                if b.get('is_error') or FAIL.match(text.strip()[:200]):
                    continue
                out.append((calls[b['tool_use_id']], d.get('timestamp')))
    return out


def build():
    try:
        cache = json.load(open(CACHE))
    except (OSError, ValueError):
        cache = {'files': {}}
    files = cache['files']
    for p in glob.glob(f'{ROOT}/*/agent-*.jsonl'):
        m = os.path.getmtime(p)
        if p in files and files[p]['m'] == m:
            continue
        files[p] = {'m': m, 'hits': scan(p)}
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(cache, open(CACHE, 'w'))
    idx = {}
    for f in files.values():
        for u, t in f['hits']:
            if t:
                idx.setdefault(norm(u), []).append(t)
    return {k: sorted(v) for k, v in idx.items()}


if __name__ == '__main__':
    idx = build()
    print(len(idx), 'pages;', sum(len(v) for v in idx.values()), 'fetches')
    for a in sys.argv[1:]:
        print(a, idx.get(norm(a)))
