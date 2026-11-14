#!/usr/bin/env python3
"""reconcile14.py DRAFTS_DIR: after merging, keep each move (remove_examples / remove_also) only
where the moved text still lands in some draft, so nothing is lost from an existing question, and
list each move once across all drafts, in the draft that holds the moved text (so each draft
still passes check_draft.py alone)."""
import json, glob, os, sys
files = sorted(glob.glob(os.path.join(sys.argv[1], '*.json')))
ds = {f: json.load(open(f)) for f in files}
landed_ex, landed_also = set(), set()
for d in ds.values():
    for k in ['examples', 'add_examples']:
        for v in d.get(k, {}).values(): landed_ex.update(v)
    for q in d.get('new', []): landed_also.update(q['also'])
def holds(d, key, t):
    if key == 'remove_examples': return any(t in v for k in ['examples', 'add_examples'] for v in d.get(k, {}).values())
    return any(t in q['also'] for q in d.get('new', []))
owner = {}
for f, d in ds.items():
    for key in ['remove_examples', 'remove_also']:
        for i, texts in d.get(key, {}).items():
            for t in texts:
                if holds(d, key, t) or (key, i, t) not in owner: owner.setdefault((key, i, t), f) if not holds(d, key, t) else owner.__setitem__((key, i, t), f)
seen = set()
for f, d in ds.items():
    for key, landed in [('remove_examples', landed_ex), ('remove_also', landed_also)]:
        out = {}
        for i, texts in d.get(key, {}).items():
            keep = []
            for t in texts:
                if t not in landed: print('KEPT IN PLACE', os.path.basename(f), key, i, repr(t[:70])); continue
                if owner[(key, i, t)] != f or (key, i, t) in seen: print('ONCE', os.path.basename(f), key, i, repr(t[:70])); continue
                seen.add((key, i, t)); keep.append(t)
            if keep: out[i] = keep
        if key in d: d[key] = out
    json.dump(d, open(f, 'w'), ensure_ascii=False, indent=2)
