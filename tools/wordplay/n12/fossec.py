"""fossec.py: Bullinger's example entries under one heading of fos.txt (the 1898 text, UniqueBible module)."""
import re, sys
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
L = open(f'{W}/fos.txt', encoding='utf-8').read().split('\n')
sys.path.insert(0, W)
from cq import FOS, BOOKS
HEAD = re.compile(r'^(\d?[A-Z][a-z]{1,2}) (\d+):(\d+)(?:-(\d+))?(?![\d:])')


def section(start):
    """lines from the heading to the next ' --------' separator"""
    end = start
    while end < len(L) and not (end > start + 2 and L[end].strip() == '--------'):
        end += 1
    return start, end


def entries(start):
    a, z = section(start - 1)
    out = []
    cur = None
    for i in range(a, z):
        m = HEAD.match(L[i])
        if m and m.group(1) in FOS:
            b = BOOKS[FOS.index(m.group(1))]
            ref = f"{'Psalm' if b == 'Psalms' else b} {m.group(2)}:{m.group(3)}" + (f"-{m.group(4)}" if m.group(4) else '')
            cur = {'ref': ref, 'line': i + 1, 'text': L[i].strip()}
            out.append(cur)
        elif cur and L[i].strip() and len(cur['text']) < 1400:
            cur['text'] += '\n' + L[i].strip()
    return z - a, out


if __name__ == '__main__':
    n, es = entries(int(sys.argv[1]))
    print(n, 'lines', len(es), 'entries')
    for e in es:
        print(e['line'], e['ref'], '|', e['text'][:150].replace('\n', ' '))
