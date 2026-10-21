"""Which figure of Bullinger's Figures of Speech holds a quote."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cq

FOS_LINES = open(f'{cq.ROOT}/fos.txt', encoding='utf-8').read().replace('\r', '').split('\n')
FIGURE = re.compile(r'^ ?([A-Z][A-Za-z-]+(?: [A-Za-z-]+)?); or, (.+)$')


def fos_heading(on, quote):
    """The figure (e.g. "Paronomasia; or, Rhyming-Words") whose section holds the quote."""
    first = cq.norm(re.split(r'\s*(?:\.\.\.|…)\s*', quote)[0])[:60]
    b, c, v = cq.parse(on)
    pat = re.compile(rf'(?<![\w]){re.escape(cq.FOS[b])} {c}:{v}(?!\d)')
    for i, line in enumerate(FOS_LINES):
        if not pat.search(line):
            continue
        window = cq.norm(' '.join(x.strip() for x in FOS_LINES[i:i + 4] if x.strip()))
        if first not in window:
            continue
        for j in range(i, -1, -1):
            m = FIGURE.match(FOS_LINES[j])
            if m:
                return f'{m.group(1)} ({m.group(2).strip()})'
            if FOS_LINES[j].startswith('########'):
                break
    return None
