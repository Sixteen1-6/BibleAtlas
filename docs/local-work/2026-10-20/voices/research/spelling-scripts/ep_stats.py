"""Summarise EarlyPrint token TSVs: how many words carry a standard spelling, and of what kind.

Usage: python -I ep_stats.py <derived_dir> ID [ID ...]
"""
import sys, csv, re, collections, os

DEFECT = re.compile('[●◊〈〉〈〉…]')


def kind(text, reg):
    t, r = text, reg
    if t.lower() == r.lower():
        return 'case only'
    if re.sub(r'[.\s]', '', t) == re.sub(r'[.\s]', '', r) or t.rstrip('.') == r:
        return 'dot or space'
    if r.replace("'", '').lower() == t.replace("'", '').lower():
        return 'apostrophe only'
    if r.replace(' ', '').replace('-', '').lower() == t.replace(' ', '').replace('-', '').lower():
        return 'joining or hyphen only'
    if t.lower().endswith(('eth', 'est')) and not r.lower().endswith(('eth', 'est')):
        return 'archaic ending changed'
    return 'spelling'


def main(d, ids):
    sys.stdout.reconfigure(encoding='utf-8')
    tot = collections.Counter()
    for i in ids:
        c = collections.Counter()
        kinds = collections.Counter()
        with open(os.path.join(d, i + '.ep.tsv'), encoding='utf-8') as f:
            rd = csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE)
            for row in rd:
                c['tokens'] += 1
                t = row['text']
                lang = row['lang']
                if lang and not lang.startswith('en'):
                    c['foreign'] += 1
                if DEFECT.search(t):
                    c['defective'] += 1
                    if row['reg']:
                        c['defective with reg'] += 1
                if row['pos'] == 'zz':
                    c['pos zz'] += 1
                if row['orig']:
                    c['orig attr'] += 1
                if row['reg']:
                    c['with reg'] += 1
                    kinds[kind(t, row['reg'])] += 1
                if re.search(r'(eth|est)$', t.lower()) and row['pos'].startswith('v'):
                    c['-eth/-est verbs'] += 1
                    if row['reg'] and not re.search(r'(eth|est)$', row['reg'].lower()):
                        c['-eth/-est verbs modernised'] += 1
        tot.update(c)
        print(i, dict(c))
        print('   kinds:', dict(kinds))
    print('TOTAL', dict(tot))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
