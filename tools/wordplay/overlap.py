#!/usr/bin/env python3
"""overlap.py <layers.json> <new-passages.json>...: new passages whose verses overlap an existing or earlier passage."""
import json, re, sys
R = re.compile(r'^(.+?) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$')
def span(ref):
    m = R.match(ref.strip())
    if not m:
        return None
    b, c, v, c2, v2 = m.groups()
    c, v = int(c), int(v)
    c2 = int(c2) if c2 else c
    v2 = int(v2) if v2 else (v if not m.group(5) else v)
    if m.group(5) and not m.group(4):
        c2, v2 = c, int(m.group(5))
    return b, (c, v), (c2, v2)
seen = []
for p in json.load(open(sys.argv[1]))['passages']:
    s = span(p['ref'])
    if s: seen.append((s, p['id'], 'main'))
bad = 0
for f in sys.argv[2:]:
    for p in json.load(open(f))['passages']:
        s = span(p['ref'])
        if not s:
            print('unparsed', p['id'], p['ref']); continue
        for (t, pid, where) in seen:
            if t[0] == s[0] and not (s[2] < t[1] or t[2] < s[1]):
                print(f'{p["id"]} ({p["ref"]}) overlaps {pid} ({where})'); bad += 1
        seen.append((s, p['id'], f))
print(bad, 'overlaps')
