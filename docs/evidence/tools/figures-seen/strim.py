#!/usr/bin/env python3
"""Trim stray punctuation from the front of marked words.

Usage: python3 -I strim.py NN EVIDENCE.json REPO

A search sometimes cut a span just after a comma or a question mark (", should
you now possess it?"); the words that carry the figure are the same without it.
Each marked words entry of a place the evidence record kept loses any leading
spaces and , . ; : ! ? and the place is checked again as the build checks it.
"""
import importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name):
    spec = importlib.util.spec_from_file_location(name, f'{HERE}/{name}.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


A = load('sapply')
P = load('sspan')
LEAD = re.compile(r'^[\s,.;:!?]+')
nn, evp, repo = sys.argv[1:4]
forms = {f['id']: f for f in json.load(open(f'{repo}/config/figure-forms.json', encoding='utf-8'))['forms']}
cdir = f'{repo}/config/figures-seen'
notes = P.notes_in(cdir)
ev = json.load(open(evp, encoding='utf-8'))
books, n = {}, 0
for _id, (osis, x) in notes.items():
    books.setdefault(osis, []).append(x)
for p in ev['places']:
    if not p['kept'] or p['kept'] not in notes:
        continue
    osis, x = notes[p['kept']]
    words = [LEAD.sub('', w) for w in x['words']]
    if words == x['words']:
        continue
    t = dict(x, words=words)
    why = A.check(t, forms)
    if why:
        print('left as it was:', x['ref'], why)
        continue
    x['words'] = words
    p['changed'] = sorted(set(p.get('changed', [])) | {'words'})
    n += 1
for osis, ns in books.items():
    P.write_book(cdir, osis, ns)
P.write_evidence(evp, ev)
print(n, 'places trimmed')
