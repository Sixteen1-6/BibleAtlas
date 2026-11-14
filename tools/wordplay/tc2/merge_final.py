"""merge_final.py WORKTREE: append out/final/held-new-passages.json to its config/layers.json (main's layout) and copy the
held reads file, as assemble.py --merge does, without re-running assemble (its source file is gone with the old container)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import layersfmt
wt = sys.argv[1]
F = os.path.join(HERE, 'out', 'final')
L = os.path.join(wt, 'config/layers.json')
d = json.load(open(L))
new = json.load(open(f'{F}/held-new-passages.json'))['passages']
assert not ({p['id'] for p in d['passages']} & {p['id'] for p in new}), 'a passage id is already in the worktree'
d['passages'].extend(new)
open(L, 'w').write(layersfmt.dumps(d))
name = 'layers-reads-wordplay-held-2026-11-07.json'
open(os.path.join(wt, 'docs/evidence', name), 'w').write(open(f'{F}/{name}').read())
print('merged', len(new), 'passages into', L)
