#!/usr/bin/env python3
"""Take off Strong's tags that are a search's stretch of words, not the figure.

Usage: python3 -I stags.py NN EVIDENCE.json REPO

The words-07 sample found tags that were the first eight Greek words of a verse
(the search's limit), cut off mid-clause and lighting every article. A place
keeps its BSB words either way; its tags go when they light the article (G3588)
or the object marker (H0853), which never carry a figure, or when there are
eight of them, the search's limit, or when their roots light more words of the
verse than there are tags (a root that comes again elsewhere in the verse), or, for a question or parallel lines, whose tags run along the marked words,
when the marked words have changed since the hand-off (the tags were chosen for
the words as they stood).
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sspan', f'{HERE}/sspan.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
NOTE = ('Strong\'s tags are also taken off any kept place whose tags light the article (G3588) or the object marker (H0853), '
        'or number eight, the search\'s limit, or whose roots light more words of the verse than there are tags, or, on a question or parallel lines, that were chosen for marked words since changed: such tags are a stretch of words, or name words no longer marked.')


def overlit(x):
    """Tags name roots, so the display lights every word of the verse with that
    root: more lit words than tags means the tags light words that are not the
    figure (another "given" beside the doubled one)."""
    A, W = P.A, P.A.W
    b, c, v1, v2 = W.parse(x['ref'])
    lit = sum(1 for v in range(v1, v2 + 1) for w in W.verse(b, c, v)[1]
              if any(A.lemma_matches(W.lem['key'][w[3]], t) for t in x['original']))
    return lit > len(x['original'])


def stretch(tags):
    return len(tags) >= 8 or any(t.rstrip('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') in ('G3588', 'H0853') for t in tags)


nn, evp, repo = sys.argv[1:4]
cdir = f'{repo}/config/figures-seen'
notes = P.notes_in(cdir)
ev = json.load(open(evp, encoding='utf-8'))
books, n = {}, 0
for _id, (osis, x) in notes.items():
    books.setdefault(osis, []).append(x)
for p in ev['places']:
    if not p['kept'] or p['kept'] not in notes:
        continue
    x = notes[p['kept']][1]
    if x.get('original') and (stretch(x['original']) or overlit(x) or ('words' in p.get('changed', []) and (x['form'] == 'question' or P.A_FORMS[x['form']]['kind'] == 'parallelism'))):
        x.pop('original')
        p['changed'] = sorted(set(p.get('changed', [])) | {'original'})
        n += 1
if n:
    for osis, ns in books.items():
        P.write_book(cdir, osis, ns)
    if NOTE not in ev['_comment']:
        ev['_comment'].append(NOTE)
    ev['counts']['tags taken off as a stretch'] = ev['counts'].get('tags taken off as a stretch', 0) + n
    P.write_evidence(evp, ev)
print(n, 'places lost their tags')
