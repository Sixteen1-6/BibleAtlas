"""Measure the open-license path: MorphAdorner's spelling-pairs table (NCSA license)
applied to the TCP (CC0) text itself, filtered by the proposed display rule.

Reads the TCP XML (not EarlyPrint), joins words broken at line ends, prints long s as s,
leaves out marginal notes and gaps, looks every word up in ememergedspellingpairs.tab,
and applies the rule. Then counts what the rule does and draws a fixed random sample of
the words it WOULD show, with context, for hand judging.

Usage:
  python -I ma_rule_sample.py <spelling_dir> <out.tsv> ID:n [ID:n ...]
"""
import sys, os, re, random, collections
from lxml import etree

TEI = '{http://www.tei-c.org/ns/1.0}'
SEED = int(__import__("os").environ.get("SEED", "20261020"))
REFINED = __import__("os").environ.get("REFINED") == "1"
NEVER = {"thorow", "councel", "councels", "e're", "viol", "viols"}
ARCHAIC = {'hath', 'doth', 'saith', 'spake', 'bare', 'brake', 'sware', 'thou', 'thee', 'thy', 'thine',
           'ye', 'art', 'hast', 'dost', 'wilt', 'shalt', 'wast', 'wert', 'alway', 'stablished', 'unto'}
ROMAN = re.compile(r'^[ivxlcdm]+$', re.I)
ENDINGS = ('ings', 'ing', 'eth', 'est', 'ed', 's')


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
        if w[:1].isupper() and r[:1].islower():
            r = r[:1].upper() + r[1:]
        return r
    return ''


def tcp_tokens(path):
    """Words of the main text in reading order, notes left out, line-end hyphens joined."""
    tree = etree.parse(path, etree.XMLParser(huge_tree=True, recover=True))
    root = tree.getroot()
    out = []
    for t in root.iter(TEI + 'text'):
        for n in list(t.iter(TEI + 'note')):
            n.clear(keep_tail=True)
        for g in t.iter(TEI + 'g'):
            if g.get('ref') == 'char:EOLhyphen':
                g.text = '\u2063'
        for g in t.iter(TEI + 'gap'):
            g.text = '●'
        for pb in t.iter(TEI + 'pb'):
            pb.tail = ' ' + (pb.tail or '')
        s = ''.join(t.itertext())
        s = s.replace('ſ', 's')
        s = re.sub(r'\u2063\s*', '', s)
        out.extend(re.findall(r"[A-Za-z●][A-Za-z'●\-]*[A-Za-z]|[A-Za-z]|\d+|[.,;:?!()]", s))
    return out


def ending(w):
    w = w.lower().rstrip("'")
    for e in ENDINGS:
        if w.endswith(e) and len(w) > len(e) + 2:
            return e
    return ''


def decide(toks, k, reading, modern):
    t = toks[k]
    tl = t.lower()
    r = reading
    if not r:
        return False, 'no reading'
    if re.sub(r"[\s\-.']", '', tl) == re.sub(r"[\s\-.']", '', r.lower()):
        return False, 'case, hyphen, space or apostrophe only'
    if '●' in t:
        return False, 'damaged word'
    if tl in ARCHAIC or (tl.endswith(('eth', 'est')) and not r.lower().endswith(('eth', 'est'))):
        return False, 'archaic grammar kept as printed'
    if tl in modern:
        return False, 'printed form is already a modern word'
    nxt = toks[k + 1:k + 3]
    if ROMAN.match(t) or (nxt and (nxt[0].isdigit() or (nxt[0] == '.' and len(nxt) > 1 and nxt[1].isdigit()))):
        return False, 'number or reference'
    e1, e2 = ending(t), ending(r)
    if e1 != e2 and not (e1 == '' and e2 == 'ed' and tl.endswith('t')) and not (e1 == 's' and e2 == 's'):
        if not (e1 == 'ed' and r.lower().endswith(('ed', 'd', 't'))):
            return False, 'reading drops or adds an ending'
    if r.lower() not in modern and r.lower().replace("'", '') not in modern:
        return False, 'reading is not in the modern word list'
    if REFINED:
        if tl in NEVER:
            return False, 'never-gloss list'
        if len(t) < 4 or len(r) - len(t) > 2:
            return False, 'short word, or reading adds more than two letters'
        near = toks[max(0, k - 1):k + 2]
        if any('●' in x for x in near):
            return False, 'next to a gap'
        if k + 1 < len(toks) and toks[k + 1] == '.' and t[:1].isupper():
            return False, 'capitalised word before a full stop (abbreviation)'
    return True, 'shown'


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    d, out = sys.argv[1], sys.argv[2]
    specs = sys.argv[3:]
    pairs = load_pairs(os.path.join(d, 'ma', 'ememergedspellingpairs.tab'))
    modern = set(l.split()[0].lower() for l in open(os.path.join(d, 'wordlist', 'en_50k.txt'), encoding='utf-8') if l.strip())
    rnd = random.Random(SEED)
    total = collections.Counter()
    rows = []
    for spec in specs:
        i, n = spec.split(':')
        n = int(n)
        toks = tcp_tokens(os.path.join(d, 'tcp', i + '.xml'))
        c = collections.Counter()
        shown = []
        for k, t in enumerate(toks):
            if not re.match(r'[A-Za-z]', t):
                continue
            c['words'] += 1
            r = lookup(pairs, t)
            if r and r != t:
                c['words with a table reading'] += 1
                ok, why = decide(toks, k, r, modern)
                c[why] += 1
                if ok:
                    shown.append((k, r))
        total.update(c)
        print(i, dict(c))
        pick = sorted(rnd.sample(shown, min(n, len(shown))))
        for k, r in pick:
            ctx = ' '.join(toks[max(0, k - 14):k]) + ' [' + toks[k] + '] ' + ' '.join(toks[k + 1:k + 12])
            rows.append([i, toks[k], r, ctx])
    print('TOTAL', dict(total))
    with open(out, 'w', encoding='utf-8') as fo:
        fo.write('n\ttext\tprinted\tma_reading\tcontext\tverdict\tnote\n')
        for j, r in enumerate(rows, 1):
            fo.write('\t'.join([str(j)] + r + ['', '']) + '\n')


if __name__ == '__main__':
    main()
