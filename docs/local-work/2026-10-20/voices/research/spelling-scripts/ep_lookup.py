"""Show how EarlyPrint tagged given words (text -> reg|lemma|pos counts).

Usage: python -I ep_lookup.py <derived_dir> <ids comma> word [word ...]
"""
import sys, os, collections


def main(d, ids, words):
    sys.stdout.reconfigure(encoding='utf-8')
    want = {w.lower() for w in words}
    res = {w: collections.Counter() for w in want}
    for i in ids.split(','):
        with open(os.path.join(d, i + '.ep.tsv'), encoding='utf-8') as f:
            next(f)
            for line in f:
                p = line.rstrip('\n').split('\t')
                t = p[1].lower()
                if t in want:
                    res[t][(i, p[3], p[4], p[5])] += 1
    for w in words:
        print('==', w)
        for k, n in res[w.lower()].most_common(8):
            print('   ', n, k)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
