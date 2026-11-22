#!/usr/bin/env python3
"""Bring one settled words-NN file into the repository's config/figures-seen/.

Usage: python3 -I smerge.py NN TRYDIR REPO

TRYDIR holds the file's own reading (config/figures-seen/, docs/evidence/
figures-seen/words-NN.json, log/words-NN-drops.jsonl), read and sampled apart
from the other files. Its kept places are added to REPO's config/figures-seen/;
a place whose id (its verse and form) an earlier file already holds is left out,
since the earlier file's place stands, and the evidence record and the drop log
say so. The record, the drop log and the hand-off as read are copied to REPO's
docs/evidence/figures-seen/.
"""
import glob, importlib.util, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sspan', f'{HERE}/sspan.py')
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)
WORK = S.A.WORK
NOTE = ('A place whose verse already has the same form from an earlier file is left out here, '
        'since the earlier file\'s place stands ("same form already on this verse").')


def main(nn, trydir, repo):
    nn = nn.zfill(2)
    cdir = f'{repo}/config/figures-seen'
    have = S.notes_in(cdir)
    new = S.notes_in(f'{trydir}/config/figures-seen')
    ev = json.load(open(f'{trydir}/docs/evidence/figures-seen/words-{nn}.json', encoding='utf-8'))
    drops = [json.loads(l) for l in open(f'{trydir}/log/words-{nn}-drops.jsonl', encoding='utf-8')]
    kept = {p['kept'] for p in ev['places'] if p['kept']}
    assert kept == set(new), (len(kept), len(new), sorted(kept ^ set(new))[:5])
    books = {}
    for _id, (osis, n) in have.items():
        books.setdefault(osis, []).append(n)
    left = 0
    for p in ev['places']:
        if not p['kept'] or p['kept'] not in have:
            continue
        _id = p['kept']
        osis, n = new[_id]
        why = f'same form already on this verse ({_id})'
        p['kept'] = None
        p['why'] = why
        p.pop('changed', None)
        drops.append({'i': p['i'], 'id': p['id'], 'ref': n['ref'], 'form': n['form'], 'why': why, 'reasons': []})
        del new[_id]
        left += 1
    for _id, (osis, n) in new.items():
        books.setdefault(osis, []).append(n)
    changed = sorted({osis for osis, _ in new.values()})
    for osis in changed:
        S.write_book(cdir, osis, books[osis])
    if left:
        ev['counts']['same form already on this verse'] = left
        if NOTE not in ev['_comment']:
            ev['_comment'].append(NOTE)
    ev['counts']['kept'] = sum(1 for p in ev['places'] if p['kept'])
    ev['counts']['dropped'] = sum(1 for p in ev['places'] if not p['kept'])
    drops.sort(key=lambda d: d['i'])
    edir = f'{repo}/docs/evidence/figures-seen'
    os.makedirs(f'{edir}/handoff', exist_ok=True)
    S.write_evidence(f'{edir}/words-{nn}.json', ev)
    with open(f'{edir}/words-{nn}-drops.jsonl', 'w', encoding='utf-8') as f:
        for d in drops:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    shutil.copyfile(f'{WORK}/words-{nn}.jsonl', f'{edir}/handoff/words-{nn}.jsonl')
    print(json.dumps({'nn': nn, 'added': len(new), 'left out': left, 'kept': ev['counts']['kept'],
                      'places': len(ev['places']), 'books': changed}))


if __name__ == '__main__':
    main(*sys.argv[1:4])
