#!/usr/bin/env python3
"""Check every kept place again as the build now checks it.

Usage: python3 -I srecheck.py NN EVIDENCE.json REPO LOGDIR

The build's checks grew after a review (2026-11-22): an entry is checked where
the display marks it, its first place in each verse that holds it, and must
start and end with whole words and overlap no other entry; and a tag may be
listed once (a root named twice, for two words of that root, is named once,
since the display lights every word with the root). A list marked "And, and,
and" must say "and" twice or more in its marked words (a run of "or" or "nor"
does not show that label). An entry that lies
wholly inside another ("Aha" inside "Aha, aha") marks nothing the other does
not, so it is taken out, and the place reads as it did. Any place the build
would then refuse is dropped, with the reason in the evidence record and the
drop log.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name):
    spec = importlib.util.spec_from_file_location(name, f'{HERE}/{name}.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


A = load('sapply')
P = load('sspan')


if __name__ == '__main__':
    nn, evp, repo, logdir = sys.argv[1:5]
    nn = nn.zfill(2)
    forms = {f['id']: f for f in json.load(open(f'{repo}/config/figure-forms.json', encoding='utf-8'))['forms']}
    cdir = f'{repo}/config/figures-seen'
    notes = P.notes_in(cdir)
    ev = json.load(open(evp, encoding='utf-8'))
    books = {}
    for _id, (osis, x) in notes.items():
        books.setdefault(osis, {})[_id] = x
    unnest, twice, drops = 0, 0, []
    for p in ev['places']:
        if not p['kept'] or p['kept'] not in notes:
            continue
        osis, x = notes[p['kept']]
        # a root named twice is named once: the display lights every word with it either way
        if x.get('original') and len(set(x['original'])) != len(x['original']):
            x['original'] = list(dict.fromkeys(x['original']))
            p['changed'] = sorted(set(p.get('changed', [])) | {'original'})
            twice += 1
        words = A.tidy(x['ref'], x['words'])
        if words != x['words']:
            x['words'] = words
            p['changed'] = sorted(set(p.get('changed', [])) | {'words'})
            unnest += 1
        why = A.check(x, forms)
        if why is None:
            continue
        why = A.refused(why)
        del books[osis][x['id']]
        drops.append({'i': p['i'], 'id': p['id'], 'ref': x['ref'], 'form': x['form'], 'why': why, 'reasons': []})
        p['kept'] = None
        p['why'] = why
        p.pop('changed', None)
    for osis, ns in books.items():
        P.write_book(cdir, osis, list(ns.values()))
    for k, x in (('overlapping entries joined', unnest), ('tags named twice named once', twice), ('refused on the later checks', len(drops))):
        if x:
            ev['counts'][k] = ev['counts'].get(k, 0) + x
    NOTE = ('Then, after a review of the build checks, every kept place was checked again as the build now checks it: overlapping entries '
            'were joined, so the place marks the same words ("overlapping entries joined"), and any place '
            'the build would refuse was dropped ("refused on the later checks").')
    if (unnest or drops) and NOTE not in ev['_comment']:
        ev['_comment'].append(NOTE)
    ev['counts']['kept'] = sum(1 for p in ev['places'] if p['kept'])
    ev['counts']['dropped'] = sum(1 for p in ev['places'] if not p['kept'])
    P.write_evidence(evp, ev)
    with open(f'{logdir}/words-{nn}-drops.jsonl', 'a', encoding='utf-8') as f:
        for d in drops:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print(f'{unnest} places had overlapping entries joined; {twice} had a tag named twice; {len(drops)} refused; kept now {ev["counts"]["kept"]}')
