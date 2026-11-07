"""How well do EarlyPrint word tokens line up with the TCP text on GitHub?

Usage: python -I align_tcp_ep.py <tcp.xml> <ep.tsv>
Prints match counts and examples of words that differ.
"""
import sys, re, difflib, collections
from lxml import etree

TEI = '{http://www.tei-c.org/ns/1.0}'


def tcp_words(path):
    tree = etree.parse(path, etree.XMLParser(huge_tree=True, recover=True))
    root = tree.getroot()
    texts = root.findall('.//' + TEI + 'text')
    if not texts:
        texts = root.findall('.//text')
    out = []
    for t in texts:
        # gaps become a dot so a damaged word stays one token
        for g in t.iter(TEI + 'gap', 'gap'):
            g.tail = '●' + (g.tail or '')
        s = ''.join(t.itertext())
        s = s.replace('ſ', 's')
        s = re.sub(r'(\w)[-­]\s*\n\s*(\w)', r'\1\2', s)
        out.extend(re.findall(r"[\w●'&]+", s))
    return out


def ep_words(path):
    out = []
    with open(path, encoding='utf-8') as f:
        next(f)
        for l in f:
            p = l.rstrip('\n').split('\t')
            w = p[2] or p[1]
            out.extend(re.findall(r"[\w●'&]+", w) or [w])
    return out


def main(tcp, ep):
    sys.stdout.reconfigure(encoding='utf-8')
    a = [w.lower() for w in tcp_words(tcp)]
    b = [w.lower() for w in ep_words(ep)]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    same = 0
    diffs = collections.Counter()
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            same += i2 - i1
        else:
            diffs[(op, ' '.join(a[i1:i2])[:40], ' '.join(b[j1:j2])[:40])] += 1
    print('TCP words', len(a), 'EP words', len(b), 'identical in sequence', same,
          '(%.2f%% of EP words)' % (100.0 * same / max(1, len(b))))
    print('most common differences (op, TCP, EP):')
    for k, n in diffs.most_common(40):
        print('  ', n, k)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
