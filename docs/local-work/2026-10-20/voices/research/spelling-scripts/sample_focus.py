"""Two extra samples from the EarlyPrint TSVs.

mode 'pair': random sample of tokens where text==A (case-insensitive) and reg==B, with context.
mode 'miss': tokens left WITHOUT a standard spelling whose lowercased form is not in
MorphAdorner's standardspellings.txt (English, not proper nouns, not damaged), sampled.

Usage:
  python -I sample_focus.py pair <derived_dir> <ids comma> <A> <B> <n> <out.tsv>
  python -I sample_focus.py miss <derived_dir> <ids comma> <standardspellings.txt> <n> <out.tsv>
"""
import sys, os, random, re, collections

SEED = 20261020
DEFECT = re.compile('[●◊〈〉]')


def load(d, i):
    with open(os.path.join(d, i + '.ep.tsv'), encoding='utf-8') as f:
        next(f)
        return [l.rstrip('\n').split('\t') for l in f]


def ctx(toks, k, b=12, a=10):
    return ' '.join(t[1] for t in toks[max(0, k - b):k]) + ' [' + toks[k][1] + '] ' + ' '.join(t[1] for t in toks[k + 1:k + 1 + a])


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    mode = sys.argv[1]
    d, ids = sys.argv[2], sys.argv[3].split(',')
    rnd = random.Random(SEED)
    cand = []
    stats = collections.Counter()
    types = collections.Counter()
    if mode == 'pair':
        A, B, n, out = sys.argv[4].lower(), sys.argv[5].lower(), int(sys.argv[6]), sys.argv[7]
        for i in ids:
            toks = load(d, i)
            for k, p in enumerate(toks):
                if p[1].lower() == A:
                    stats[(i, p[3].lower() or '(none)')] += 1
                    if p[3].lower() == B:
                        cand.append((i, k, toks))
    else:
        std = set(l.split()[0].lower() for l in open(sys.argv[4], encoding='utf-8-sig') if l.strip())
        n, out = int(sys.argv[5]), sys.argv[6]
        for i in ids:
            toks = load(d, i)
            for k, p in enumerate(toks):
                t = p[1]
                if p[3] or DEFECT.search(t) or (p[6] and not p[6].startswith('en')):
                    continue
                if p[5].startswith(('nn', 'crd', 'ord', 'sy', 'zz', 'fw', 'ab', 'f')) or not re.search('[a-z]', t.lower()):
                    continue
                if p[5].startswith('v') and re.search(r'(eth|est|st)$', t.lower()):
                    continue  # -eth / -est verb forms are kept on purpose
                stats['english tokens without reg (not names, numbers, abbreviations)'] += 1
                if t.lower() not in std and t.lower().replace("'", '') not in std:
                    stats['  not in the word list'] += 1
                    types[t.lower()] += 1
                    cand.append((i, k, toks))
    for k, v in sorted(stats.items(), key=lambda x: str(x[0])):
        print(k, v)
    if mode == 'miss':
        print('distinct types', len(types))
        print('top types', types.most_common(60))
    pick = rnd.sample(cand, min(n, len(cand)))
    pick.sort(key=lambda x: (x[0], x[1]))
    with open(out, 'w', encoding='utf-8') as fo:
        fo.write('n\ttext\tid\tprinted\treg\tlemma\tpos\tcontext\tverdict\tnote\n')
        for j, (i, k, toks) in enumerate(pick, 1):
            p = toks[k]
            fo.write('\t'.join([str(j), i, p[0], p[1], p[3], p[4], p[5], ctx(toks, k), '', '']) + '\n')
            print(j, i, p[1], '->', p[3] or '(none)', p[4], p[5], '|', ctx(toks, k))


if __name__ == '__main__':
    main()
