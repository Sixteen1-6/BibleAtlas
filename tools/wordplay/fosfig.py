"""Which figure of Bullinger's Figures of Speech holds a quote."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq

FOS_LINES = open(f'{cq.ROOT}/fos.txt', encoding='utf-8').read().replace('\r', '').split('\n')
FIGURE = re.compile(r'^ ?(?:\d+\. )?([A-ZÆŒ][^\W\d_]*(?:-[^\W\d_]+)?(?: \([^\W\d_]+\)| [^\W\d_]+)?)[;:] or, (.+)$')
FIX = {'Parechesls': 'Parechesis', 'Epiphoza': 'Epiphora', 'PathopœIa': 'Pathopœia'}


def fos_heading(on, quote):
    """The figure (e.g. "Paronomasia; or, Rhyming-Words") whose section holds the quote."""
    first = cq.norm(re.split(r'\s*(?:\.\.\.|…)\s*', quote)[0])[:60]
    b, c, v = cq.parse(on)
    pat = re.compile(rf'(?<![\w]){re.escape(cq.FOS[b])} {c}:{v}(?!\d)')
    for i, line in enumerate(FOS_LINES):
        if not pat.search(line):
            continue
        window = cq.norm(' '.join(x.strip() for x in FOS_LINES[i:cq.fos_end(FOS_LINES, i)] if x.strip()))
        if first not in window:
            continue
        for j in range(i, -1, -1):
            m = FIGURE.match(FOS_LINES[j])
            if m:
                name = FIX.get(m.group(1), m.group(1))
                return f'{name} ({m.group(2).strip().rstrip(".")})'
            if FOS_LINES[j].strip() == 'Ellipsis':
                return 'Ellipsis (Omission)'
            if FOS_LINES[j].startswith('########'):
                break
    return None
