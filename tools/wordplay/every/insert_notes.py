#!/usr/bin/env python3
"""insert_notes.py <notes.json> <repo>: puts one cited hand-off of the figure catalogue into a checkout, on any
branch, without a patch. For use when a hand-off's patch no longer applies because notes beside it were changed.

notes.json is {"files": {"<OSIS>": [note, ...]}, "forms": [form, ...], "evidence": "<file name>"}, with the evidence
file beside it. Each note goes into config/figures/<OSIS>.json after the last note at or before its verse (notes
already there stay where they are); a note whose id is already in that file is skipped and named. Each form whose id
is not yet in config/figure-forms.json is added at the end. The evidence file is copied into docs/evidence/.
Files are written as the repository keeps them: 2-space indent, non-ASCII kept, a final newline. Then run atlas build
and atlas verify as for any change."""
import json, os, re, shutil, sys


def key(n):
    """(first chapter, first verse, last chapter, last verse, id), as the build orders a book's notes."""
    m = re.search(r'(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?\s*$', n['ref'])
    if not m:
        return (0, 0, 0, 0, n['id'])
    c, v = int(m.group(1)), int(m.group(2) or 0)
    if m.group(3) is None:
        c2, v2 = c, v
    elif m.group(4) is None:
        c2, v2 = (c, int(m.group(3))) if m.group(2) else (int(m.group(3)), 0)
    else:
        c2, v2 = int(m.group(3)), int(m.group(4))
    return (c, v, c2, v2, n['id'])


def dump(p, d):
    with open(p, 'w', encoding='utf-8') as o:
        o.write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')


def main(src, repo):
    pack = json.load(open(src, encoding='utf-8'))
    added = skipped = 0
    for osis, ns in sorted(pack['files'].items()):
        p = f'{repo}/config/figures/{osis}.json'
        have = json.load(open(p, encoding='utf-8'))['notes'] if os.path.exists(p) else []
        ids = {n['id'] for n in have}
        for n in sorted(ns, key=key):
            if n['id'] in ids:
                print('skipped, id already there:', osis, n['id'])
                skipped += 1
                continue
            k = key(n)
            have.insert(max((i + 1 for i, x in enumerate(have) if key(x) <= k), default=0), n)
            ids.add(n['id'])
            added += 1
        dump(p, {'notes': have})
    fp = f'{repo}/config/figure-forms.json'
    ff = json.load(open(fp, encoding='utf-8'))
    have_forms = {f['id'] for f in ff['forms']}
    new_forms = [f for f in pack.get('forms', []) if f['id'] not in have_forms]
    if new_forms:
        ff['forms'] += new_forms
        dump(fp, ff)
    ev = pack.get('evidence')
    if ev:
        shutil.copyfile(os.path.join(os.path.dirname(os.path.abspath(src)), ev), f'{repo}/docs/evidence/{ev}')
    print(f'{added} notes added, {skipped} skipped, {len(new_forms)} forms added, evidence {ev or "none"}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
