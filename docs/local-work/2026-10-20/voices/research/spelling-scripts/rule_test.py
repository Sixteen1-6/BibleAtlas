"""Test the proposed 'show a modern reading only when' rule on the judged sample and the corpus.

Usage: python -I rule_test.py <research_dir>
"""
import sys, os, re, collections

ENDINGS = [('ings', 'ings'), ('ing', 'ing'), ('ed', 'ed'), ('eth', 'eth'), ('est', 'est'), ('s', 's')]
ARCHAIC_GRAMMAR = {'hath', 'doth', 'saith', 'spake', 'bare', 'brake', 'sware', 'thou', 'thee', 'thy',
                   'thine', 'ye', 'art', 'hast', 'dost', 'wilt', 'shalt', 'wast', 'wert', 'alway', 'stablished'}


def load_wl(path):
    return set(l.split()[0].lower() for l in open(path, encoding='utf-8') if l.strip())


def modern_ok(reg, wl):
    r = reg.lower().replace("’", "'")
    if r in wl:
        return True
    if r.endswith("'s") and r[:-2] in wl:
        return True
    if r.endswith("s'") and r[:-1] in wl:
        return True
    m = re.match(r'^(.*?)(eth|est)$', r)
    if m and (m.group(1) in wl or m.group(1) + 'e' in wl or m.group(1) + 's' in wl):
        return True
    return False


def ending_kept(t, r):
    t, r = t.lower().rstrip('.'), r.lower().replace("'", '')
    for a, b in ENDINGS:
        if t.endswith(a):
            # printed has an ending: the reading must keep a matching ending
            if a == 's':
                return r.endswith('s')
            return r.endswith(b) or (a == 'ed' and r.endswith(('d', 't')))
    return True


def decide(t, r, pos, wl):
    """Return (show, reason)."""
    tl = t.lower()
    if not r:
        return False, 'no reading'
    if tl == r.lower():
        return False, 'case only'
    if re.sub(r'[\s\-.]', '', tl) == re.sub(r'[\s\-.]', '', r.lower()):
        return False, 'space, hyphen or dot only'
    if tl in ARCHAIC_GRAMMAR or re.search(r'(eth|est)$', tl) and r.lower().endswith(('eth', 'est')) and tl.replace('eth', '') in wl:
        return False, 'archaic grammar kept'
    if tl in wl:
        return False, 'printed form is already a modern word'
    if pos.startswith(('nn', 'crd', 'ord', 'ab', 'f', 'zz', 'sy')) or re.fullmatch(r'[ivxlcdm]+', tl):
        return False, 'name, number, abbreviation or foreign'
    if not ending_kept(t, r):
        return False, 'reading drops an ending'
    if not modern_ok(r, wl):
        return False, 'reading is not a modern word'
    return True, 'shown'


def main(d):
    sys.stdout.reconfigure(encoding='utf-8')
    wl = load_wl(os.path.join(d, 'wordlist', 'en_50k.txt'))
    rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(d, 'sample-200-judged.tsv'), encoding='utf-8')][1:]
    shown = collections.Counter()
    reasons = collections.Counter()
    hidden_right = []
    for r in rows:
        ok, why = decide(r[3], r[4], r[6], wl)
        reasons[why] += 1
        if ok:
            shown[r[8]] += 1
            if r[8] != 'right':
                print('  SHOWN BUT', r[8], r[0], r[3], '->', r[4], '|', r[9])
        else:
            if r[8] == 'right' and why not in ('printed form is already a modern word',):
                hidden_right.append((r[0], r[3], r[4], why))
    print('sample: shown by verdict', dict(shown), 'reasons', dict(reasons))
    print('right readings hidden by the rule (other than already-modern):')
    for h in hidden_right:
        print('   ', h)
    # whole corpus
    tot = collections.Counter()
    for i in 'A30152 A53721 A96093 A89503 A60194 A53678 A51842'.split():
        with open(os.path.join(d, 'derived', i + '.ep.tsv'), encoding='utf-8') as f:
            next(f)
            for l in f:
                p = l.rstrip('\n').split('\t')
                if not p[3]:
                    continue
                tot['tokens with a reading'] += 1
                ok, why = decide(p[1], p[3], p[5], wl)
                tot[why] += 1
    print('corpus:', dict(tot))


if __name__ == '__main__':
    main(sys.argv[1])
