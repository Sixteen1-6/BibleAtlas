#!/usr/bin/env python3
"""package.py <repo worktree> <dest dir>: the hand-off folder from a worktree assemble.py filled.

  figures.patch     config/figure-forms.json, config/figures/, config/layer-sources.json, config/shelf.json and the
                    figure and credit evidence (for the Layers thread)
  structures.patch  config/structures.json and its evidence (for the Arcs and card thread)
  files/            the same data as plain files: forms, notes by group, structures, evidence, cite-list additions
Each patch is git diff against the worktree's HEAD, with new files included."""
import json, os, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.dirname(HERE)
repo, dest = sys.argv[1], sys.argv[2]
os.makedirs(f'{dest}/files', exist_ok=True)
FIG = ['config/figure-forms.json', 'config/figures', 'config/layer-sources.json', 'config/shelf.json',
       'docs/evidence/figures-wordplay-n12-2026-11-07.json', 'docs/evidence/figures-wordplay-r2-2026-11-07.json',
       'docs/evidence/credits-wordplay-lowth-isaiah-2026-11-01.json']
STR = ['config/structures.json', 'docs/evidence/structures-wordplay-r2-2026-11-07.json']


def git(*a):
    return subprocess.run(['git', '-C', repo, *a], capture_output=True, text=True, check=True).stdout


git('add', '-N', '--', *FIG, *STR)          # new files show in the diff; nothing is committed
for name, paths in [('figures.patch', FIG), ('structures.patch', STR)]:
    open(f'{dest}/{name}', 'w').write(git('diff', '--', *paths))
git('reset', '-q', '--', *FIG, *STR)
head = git('rev-parse', 'HEAD').strip()

REV = f'{W}/ns/review/out'
for src, name in [(f'{W}/n12/forms12-main.json', 'forms-12.json'),
                  (f'{REV}/notes.json', 'notes-round2.json'),
                  (f'{REV}/fig-replace.json', 'notes-replaced.json'),
                  (f'{REV}/structures.json', 'structures-new.json'),
                  (f'{REV}/str-replace.json', 'structures-replaced.json'),
                  (f'{HERE}/out/report.json', 'assemble-report.json')]:
    shutil.copy(src, f'{dest}/files/{name}')
for p in FIG[4:] + STR[1:]:
    shutil.copy(f'{repo}/{p}', f'{dest}/files/{os.path.basename(p)}')
# the twelve forms' notes as they went in, one list
import glob
F = {f['id'] for f in json.load(open(f'{W}/n12/forms12-main.json'))['forms']}
seen, n12 = set(), []
for d in [f'{W}/fig/out_n12r', f'{W}/fig/out_n12']:
    for f in sorted(glob.glob(f'{d}/config/figures/*.json')):
        for n in json.load(open(f))['notes']:
            if (n['form'] in F or n['id'] == 'deuteronomy-6-7-metaphor') and n['id'] not in seen:
                seen.add(n['id'])
                n12.append(n)
json.dump({'notes': n12}, open(f'{dest}/files/notes-12-forms.json', 'w'), indent=2, ensure_ascii=False)
shutil.copy(f'{W}/ns/cite-additions.json', f'{dest}/files/cite-additions.json')
print('base', head, {n: os.path.getsize(f'{dest}/{n}') for n in ['figures.patch', 'structures.patch']}, len(n12), 'n12 notes')
