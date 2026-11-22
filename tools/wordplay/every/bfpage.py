#!/usr/bin/env python3
"""bfpage.py: a shared list of the scan pages of Bullinger's Figures of Speech (archive.org figuresofspeechu00bull)
already found, so no agent searches the scan twice for the same words.

  bfpage.py find "<words from his text>"    prints each page already found for words that overlap these (the
                                            words searched, the printed page, who found it), or "none"
  bfpage.py add "<words searched>" <search page>   records a search: the page number the archive.org search
                                            returned (the printed page is that minus 54)

Seeded from the bullinger-fos cites of the live figure notes (their quote and the page in their url). A page
found here is as good as a search only when the words you need are the same passage: "find" matches when five
or more words in a row of your words are in the recorded words, or the other way round."""
import fcntl, glob, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.path.dirname(os.path.dirname(HERE))
DB = f'{HERE}/bfpages.jsonl'
LIVE = f'{SP}/lw/config/figures'


def words(t):
    return re.findall(r"[a-z0-9]+", (t or '').lower().replace('’', "'"))


def grams(ws, n=5):
    return {' '.join(ws[i:i + n]) for i in range(max(0, len(ws) - n + 1))}


def seed():
    out = []
    for f in sorted(glob.glob(f'{LIVE}/*.json')):
        for n in json.load(open(f))['notes']:
            for c in n.get('cites', []):
                if c.get('source') != 'bullinger-fos':
                    continue
                m = re.search(r'/page/(\d+)/', c.get('url') or '')
                if m:
                    out.append({'words': c['quote'], 'printed': int(m.group(1)), 'by': f"live note {n['id']}"})
    return out


def rows():
    out = seed()
    if os.path.exists(DB):
        for line in open(DB):
            try:
                out.append(json.loads(line))
            except ValueError:
                pass
    return out


def find(q):
    g = grams(words(q))
    hits = []
    for r in rows():
        rg = grams(words(r['words']))
        if g & rg:
            hits.append(r)
    if not hits:
        print('none')
    for r in hits:
        print(json.dumps(r, ensure_ascii=False))


def add(q, search_page):
    r = {'words': q, 'search_page': int(search_page), 'printed': int(search_page) - 54, 'by': os.environ.get('BF_BY', 'an agent')}
    with open(DB, 'a') as o:
        fcntl.flock(o, fcntl.LOCK_EX)
        o.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('recorded', json.dumps(r, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'find':
        find(' '.join(sys.argv[2:]))
    elif len(sys.argv) == 4 and sys.argv[1] == 'add':
        add(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(2)
