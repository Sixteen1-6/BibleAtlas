#!/usr/bin/env python3
"""webquote.py <url> <quote>  |  webquote.py --file <notes.json>: is a web quote in what WebFetch returned for that page?
Scans every workflow agent transcript of this session for WebFetch calls on the page (fetchlog.norm match) and checks
the quote's parts, in order, against each returned text (figcheck.normalize). With --file, checks every cite that
carries a found URL. Prints ok or missing for each, and the last time the page was fetched."""
import glob, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, f'{os.path.dirname(HERE)}/w3')
import figcheck as fc
import fetchlog

_pages = {}


def files_with(url):
    """Agent transcripts whose text holds the page's path (ripgrep, fixed string), so only they are parsed."""
    import subprocess
    u = fetchlog.norm(url)
    key = u.split('://', 1)[-1]
    key = key.split('/', 1)[1] if '/' in key else key
    key = key.split('?')[0][-80:] or u
    out = subprocess.run(['rg', '-l', '-i', '-F', '--glob', 'agent-*.jsonl', key, fetchlog.ROOT], capture_output=True, text=True).stdout
    return [l for l in out.split('\n') if l]


def pages_for(url):
    n = fetchlog.norm(url)
    if n in _pages:
        return _pages[n]
    got = []
    for p in files_with(url):
        calls = {}
        for line in open(p, errors='replace'):
            if 'WebFetch' not in line and 'tool_result' not in line:
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
                    calls[b.get('id')] = (b.get('input') or {}).get('url', '')
                elif b.get('type') == 'tool_result' and b.get('tool_use_id') in calls:
                    if fetchlog.norm(calls[b['tool_use_id']]) != n or b.get('is_error'):
                        continue
                    body = b.get('content')
                    text = body if isinstance(body, str) else ' '.join(x.get('text', '') for x in body or [] if isinstance(x, dict))
                    got.append((d.get('timestamp'), text))
    _pages[n] = got
    return got


def check(url, quote):
    got = pages_for(url)
    texts = [(t, fc.normalize(text)) for t, text in got]
    hit = [t for t, text in texts if fc.contains(text, quote)]
    if hit:
        return (True, hit[-1], len(got))
    # WebFetch gives a long remark in pieces: every word of each part of the quote covered by quoted runs of four
    # or more words that some fetch of the page returned
    import re
    runs = []
    for _, text in got:
        for m in re.finditer(r'[“"]([^”"]{12,})[”"]|^> ?(.+)$', text, re.M):
            w = fc.normalize(m.group(1) or m.group(2)).split()
            if len(w) >= 4:
                runs.append(w)
    def covered(part):
        q = part.split()
        hit = [False] * len(q)
        for r in runs:
            for i in range(len(q)):
                for j in range(len(r)):
                    k = 0
                    while i + k < len(q) and j + k < len(r) and q[i + k] == r[j + k]:
                        k += 1
                    if k >= 4 or (k == len(q) - i and k == len(r) - j and k >= 2 and i > 0):
                        hit[i:i + k] = [True] * k
        return all(hit)
    ok = bool(fc.parts(quote)) and all(any(fc.contains(text, p) for _, text in texts) or covered(p) for p in fc.parts(quote))
    return (ok, ([t for t, _ in got] or [None])[-1], len(got))


if __name__ == '__main__':
    if sys.argv[1] == '--file':
        bad = 0
        for n in json.load(open(sys.argv[2]))['notes']:
            for c in n.get('cites', []):
                u = c.get('found') or ''
                if not u.startswith('http') or 'raw.githubusercontent.com' in u:
                    continue
                ok, t, k = check(u, c['quote'])
                bad += not ok
                print('ok' if ok else 'MISSING', n['id'], c['source'], u, t, f'{k} fetches')
        print(bad, 'web quotes not found in a fetched page')
    else:
        print(check(sys.argv[1], sys.argv[2]))
