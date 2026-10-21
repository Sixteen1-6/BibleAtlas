#!/usr/bin/env python3
"""cat.py "<ref>": what the Church Fathers say on a Gospel verse in Aquinas' Catena Aurea (public domain,
Newman's Oxford translation, from github.com/AlvaroBalbin/catena), each segment under its Father's name.
cat.py check "<ref>" "<quote>": is the quote verbatim in one segment? exit 0/1 (prints the Father)."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq
D = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw/data/raw/catena@efe1bd084d/data/catena'


def segs(ref):
    b, c, v = cq.parse(ref)
    g = cq.BOOKS[b].lower()
    if g not in ('matthew', 'mark', 'luke', 'john'):
        return []
    out = []
    for line in open(f'{D}/{g}.jsonl'):
        r = json.loads(line)
        if f'{g}/{c}/{v}' in r.get('commented_verse_keys', []):
            for s in r.get('segments', []):
                out.append((r['citation'], s.get('father') or s.get('role'), s['text']))
    return out


if __name__ == '__main__':
    if sys.argv[1] == 'check':
        ps = [cq.norm(p) for p in re.split(r'\s*(?:\.\.\.|…)\s*', sys.argv[3]) if p.strip()]
        for cit, f, t in segs(sys.argv[2]):
            n, at, ok = cq.norm(t), 0, True
            for p in ps:
                i = n.find(p, at)
                if i < 0:
                    ok = False
                    break
                at = i + len(p)
            if ok:
                print('found:', cit, '| Father:', f)
                sys.exit(0)
        print('not found')
        sys.exit(1)
    for cit, f, t in segs(sys.argv[1]):
        print(f'== {cit} | {f} ==\n{t}\n')
