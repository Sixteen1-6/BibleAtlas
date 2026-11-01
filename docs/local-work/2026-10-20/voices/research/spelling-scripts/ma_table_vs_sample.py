"""Apply MorphAdorner's own spelling-pairs table (context free) to the same 200 sampled
words that EarlyPrint standardized, and compare with EarlyPrint's reading.

Usage: python -I ma_table_vs_sample.py <spelling_dir>
Writes <spelling_dir>/sample-200-ma-table.tsv with columns:
n, text, printed, ep_reg, ep_verdict, ma_reading, relation
relation: same as EP / no reading / different
"""
import sys, os


def load_pairs(path):
    pairs = {}
    with open(path, encoding='utf-8-sig') as f:
        for line in f:
            p = line.rstrip('\n').split('\t')
            if len(p) >= 2 and p[0]:
                pairs.setdefault(p[0], p[1])
    return pairs


def lookup(pairs, w):
    if w in pairs:
        return pairs[w]
    lw = w.lower()
    if lw in pairs:
        r = pairs[lw]
        if w[:1].isupper():
            r = r[:1].upper() + r[1:]
        return r
    return ''


def main(d):
    sys.stdout.reconfigure(encoding='utf-8')
    pairs = load_pairs(os.path.join(d, 'ma', 'ememergedspellingpairs.tab'))
    rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(d, 'sample-200-judged.tsv'), encoding='utf-8')][1:]
    out = []
    counts = {}
    for r in rows:
        n, text, printed, reg, verdict = r[0], r[1], r[3], r[4], r[8]
        ma = lookup(pairs, printed)
        if not ma:
            rel = 'no reading'
        elif ma.lower() == reg.lower():
            rel = 'same as EP'
        else:
            rel = 'different'
        counts[(rel, verdict if rel == 'same as EP' else '')] = counts.get((rel, verdict if rel == 'same as EP' else ''), 0) + 1
        out.append([n, text, printed, reg, verdict, ma, rel])
        if rel != 'same as EP':
            print(n, text, printed, '| EP:', reg, verdict, '| MA:', ma or '(none)', '|', r[7])
    with open(os.path.join(d, 'sample-200-ma-table.tsv'), 'w', encoding='utf-8') as fo:
        fo.write('n\ttext\tprinted\tep_reg\tep_verdict\tma_reading\trelation\n')
        for o in out:
            fo.write('\t'.join(o) + '\n')
    print('pairs in table', len(pairs))
    for k, v in sorted(counts.items()):
        print(k, v)


if __name__ == '__main__':
    main(sys.argv[1])
