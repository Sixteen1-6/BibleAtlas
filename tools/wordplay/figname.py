#!/usr/bin/env python3
"""figname.py "<ref>": every place Bullinger's Figures of Speech uses this verse as an example, with the
figure and the chain of sub-headings above it, e.g.
  Metonymy (Change of Noun) > I. Metonymy of the Cause > ii. The instrument ... > 3. The Sword is put for war or for slaughter
followed by the example's own text."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq
from fosfig import FOS_LINES as L, FIGURE, FIX
SUB = re.compile(r'^ ?((?:[IVX]+|[ivx]+|\d+|[a-z]|\([a-z]\))\.) (.{3,140})$')
REFISH = re.compile(r'\d+:\d+')


def chain(i):
    levels, fig = [], None
    seen = set()
    for j in range(i - 1, -1, -1):
        line = L[j]
        if line.startswith('########'):
            break
        m = FIGURE.match(line)
        if m:
            fig = f'{FIX.get(m.group(1), m.group(1))} ({m.group(2).strip().rstrip(".")})'
            break
        if line.strip() == 'Ellipsis':
            fig = 'Ellipsis (Omission)'
            break
        s = SUB.match(line)
        if s and not REFISH.search(line) and len(line) < 160:
            mark = s.group(1)
            kind = 'roman' if re.match(r'^[IVX]+\.$', mark) else 'lroman' if re.match(r'^[ivx]+\.$', mark) else 'num' if mark[0].isdigit() else 'alpha'
            if kind not in seen:
                seen.add(kind)
                levels.append(f'{mark} {s.group(2).strip()}')
    return fig, list(reversed(levels))


if __name__ == '__main__':
    b, c, v = cq.parse(sys.argv[1])
    pat = re.compile(rf'(?<![\w]){re.escape(cq.FOS[b])} {c}:{v}(?!\d)')
    n = 0
    for i, line in enumerate(L):
        if pat.search(line):
            fig, lev = chain(i)
            body = ' '.join(x.strip() for x in L[i:cq.fos_end(L, i)] if x.strip())
            print(' > '.join([fig or '(figure not found)'] + lev))
            print('   ', body[:900])
            print()
            n += 1
    if not n:
        print('Figures of Speech does not use this verse as an example.')
