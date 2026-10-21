#!/usr/bin/env python3
"""osn.py "<ref>": the Aquifer Open Study Notes (adapted from the Tyndale Open Study Notes, CC BY-SA 4.0)
whose range covers that verse, as plain text.  osn.py check "<ref>" "<quote>": is the quote verbatim
(parts joined by "..." in order) in one of those notes? exit 0/1."""
import html, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq
D = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw/data/raw/AquiferOpenStudyNotes@bbb3f86016/eng/json'


def notes(ref):
    b, c, v = cq.parse(ref)
    key = (b + 1) * 1000000 + c * 1000 + v
    out = []
    for x in json.load(open(f'{D}/{b + 1:02d}.content.json')):
        r = x['index_reference'].split('-')
        start, end = int(r[0]), int(r[-1])
        t = x['title']
        if start <= key <= end:
            txt = re.sub(r'<[^>]+>', ' ', x['content'])
            txt = html.unescape(re.sub(r'\s+', ' ', txt)).strip()
            out.append((t, txt))
    return out


if __name__ == '__main__':
    if sys.argv[1] == 'check':
        ps = [cq.norm(p) for p in re.split(r'\s*(?:\.\.\.|…)\s*', sys.argv[3]) if p.strip()]
        for t, txt in notes(sys.argv[2]):
            n, at, ok = cq.norm(txt), 0, True
            for p in ps:
                i = n.find(p, at)
                if i < 0:
                    ok = False
                    break
                at = i + len(p)
            if ok:
                print('found in note', t)
                sys.exit(0)
        print('not found')
        sys.exit(1)
    for t, txt in notes(sys.argv[1]):
        print(f'== Aquifer Open Study Notes, {t} ==\n{txt}\n')
