"""Draw a fixed random sample of words EarlyPrint gave a standard spelling (@reg),
with context, for hand judging.

Usage: python -I sample_reg.py <derived_dir> <out.tsv> ID:n [ID:n ...]
Leaves out changes that touch only a dot, a space or letter case (e.g. "9." -> "9"),
which a reader would never be shown.
"""
import sys, os, random, re

SEED = 20261020
DEFECT = re.compile('[●◊〈〉]')


def trivial(t, r):
    if t.lower() == r.lower():
        return True
    if re.sub(r'[.\s]', '', t) == re.sub(r'[.\s]', '', r):
        return True
    return False


def main(d, out, specs):
    sys.stdout.reconfigure(encoding='utf-8')
    rnd = random.Random(SEED)
    rows_out = []
    for spec in specs:
        i, n = spec.split(':')
        n = int(n)
        toks = []
        with open(os.path.join(d, i + '.ep.tsv'), encoding='utf-8') as f:
            next(f)
            for line in f:
                p = line.rstrip('\n').split('\t')
                toks.append(p)
        cand = [k for k, p in enumerate(toks)
                if p[3] and not trivial(p[1], p[3]) and not DEFECT.search(p[1])
                and not (p[6] and not p[6].startswith('en'))]
        pick = sorted(rnd.sample(cand, n))
        for k in pick:
            p = toks[k]
            before = ' '.join(t[1] for t in toks[max(0, k - 8):k])
            after = ' '.join(t[1] for t in toks[k + 1:k + 9])
            rows_out.append([i, p[0], p[1], p[3], p[4], p[5], before + ' [' + p[1] + '] ' + after])
        print(i, 'candidates', len(cand), 'picked', n)
    with open(out, 'w', encoding='utf-8') as fo:
        fo.write('n\ttext\tid\tprinted\treg\tlemma\tpos\tcontext\tverdict\tnote\n')
        for j, r in enumerate(rows_out, 1):
            fo.write('\t'.join([str(j)] + r + ['', '']) + '\n')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
