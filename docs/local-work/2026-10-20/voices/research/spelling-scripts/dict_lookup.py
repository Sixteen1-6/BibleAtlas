"""Can the old dictionaries be looked up by word?

Johnson 1755 (LEME plain text): an entry starts on a line like
  "To PREVE’NT. v. a. [prævenio, Lat.]" or "CONVERSA’TION. n. s. [conversatio, Latin.]"
Webster 1828 (archive.org OCR of the University of California copy): an entry starts like
  "PREVENT',  V.  t.  [It. ..." (headword in capitals, stress mark, a comma).
Webster 1913 (Project Gutenberg 29765 via GITenberg): a line holding only the headword in capitals.

Usage: python -I dict_lookup.py <spelling_dir> word [word ...]
Prints how many headwords each index holds and the first lines of each word's entries.
"""
import sys, os, re, collections

JOHNSON_HEAD = re.compile(r"^(?:To )?([A-Z][A-Z’'\- ]*[A-Z])[’']?\. (?:n\. s\.|v\. a\.|v\. n\.|adj\.|adv\.|n\.|v\.|prep\.|conj\.|interj\.|part\.|particip\.|pron\.|a\.)")
WEB28_HEAD = re.compile(r"^([A-Z][A-Z'’\- ]{1,30}[A-Z'’]),\s+(?:[a-zA-Z]{1,3}\.|V\.|n\.)")
WEB13_HEAD = re.compile(r"^([A-Z][A-Z'\- ]*[A-Z])$")


def norm(h):
    return re.sub(r"[’'\s]", '', h).lower()


def index(lines, pat):
    idx = collections.defaultdict(list)
    for i, l in enumerate(lines):
        m = pat.match(l)
        if m:
            idx[norm(m.group(1))].append(i)
    return idx


def show(name, lines, idx, w, n=6):
    hits = idx.get(w.lower(), [])
    print('  %s: %d entr%s' % (name, len(hits), 'y' if len(hits) == 1 else 'ies'))
    for i in hits[:3]:
        txt = ' '.join(x.strip() for x in lines[i:i + n])
        print('     ', re.sub(r'\s+', ' ', txt)[:300])


def main(d, words):
    sys.stdout.reconfigure(encoding='utf-8')
    j = open(os.path.join(d, 'johnson', 'leme-lexicon1345.txt'), encoding='utf-8').read().split('\n')
    w1 = open(os.path.join(d, 'webster', 'uc-vol01-djvu.txt'), encoding='utf-8', errors='replace').read().split('\n')
    w2 = open(os.path.join(d, 'webster', 'uc-vol02-djvu.txt'), encoding='utf-8', errors='replace').read().split('\n')
    w13 = open(os.path.join(d, 'webster', 'w1913-29765-8.txt'), encoding='latin-1').read().split('\n')
    w28 = w1 + w2
    ji, wi, w13i = index(j, JOHNSON_HEAD), index(w28, WEB28_HEAD), index(w13, WEB13_HEAD)
    print('headwords indexed: Johnson 1755 %d, Webster 1828 OCR %d, Webster 1913 %d' % (len(ji), len(wi), len(w13i)))
    for w in words:
        print('==', w)
        show('Johnson 1755', j, ji, w)
        show('Webster 1828 (OCR)', w28, wi, w)
        show('Webster 1913', w13, w13i, w)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
