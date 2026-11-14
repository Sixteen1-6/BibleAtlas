#!/usr/bin/env python3
"""show.py <passage-id> [...]: one held Wordplay passage (2026-11-07) as the reviewers need it.

Prints the passage, every note (the notes this round adds are marked NEW; the others are live and only context),
each cite with the writer the cite list names for that book (resolve.py mirrors the build), and every reads record
for the passage with its index (rec N), so a fix can name the record it changes."""
import json, os, sys
SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('ATLAS_LW', f'{SP}/lwh')
sys.path.insert(0, f'{SP}/wp/tc2')
import resolve  # noqa: E402
REPO = f'{SP}/lwh'   # main 5d27a47 with the held passages and their cite-list additions
L = {p['id']: p for p in json.load(open(f'{REPO}/config/layers.json', encoding='utf-8'))['passages']}
HELD = {p['id'] for p in json.load(open(f'{SP}/wp/tc2/out/final/held-new-passages.json'))['passages']}
ITEMS = {pid: {'new_passage': True, 'note_indexes': range(99)} for pid in HELD}
RECS = json.load(open(f'{REPO}/docs/evidence/layers-reads-wordplay-held-2026-11-07.json', encoding='utf-8'))['records']
for _i, _r in enumerate(RECS):
    _r['_i'] = _i
for pid in sys.argv[1:]:
    p, it = L[pid], ITEMS.get(pid)
    print(f"=== {pid}  ({p['ref']})  saying: {p['saying']!r}  section: {p['section']}  "
          f"{'NEW PASSAGE' if it and it['new_passage'] else 'LIVE PASSAGE (only the NEW notes are this round)'}")
    for i, n in enumerate(p['layers']):
        new = bool(it and i in it['note_indexes'])
        print(f"\n--- note {i} {'NEW' if new else '(live, context only)'}: {n['kind']} | {n['strength']} | refs {n.get('refs')}")
        if n.get('words'):
            print('    words:', json.dumps(n['words']))
        print(f"    text ({len(n['text'])} chars): {n['text']}")
        print(f"    evidence ({len(n.get('evidence', ''))} chars): {n.get('evidence', '')}")
        for c in n.get('cites', []):
            r = resolve.resolve(c)
            who = ', '.join(r.get('names') or []) or (r.get('unnamed') or '')
            extra = {k: c[k] for k in c if k not in ('source', 'on')}
            print(f"    cite: {c['source']} on {c['on']} {json.dumps(extra, ensure_ascii=False) if extra else ''}"
                  f" -> role {r.get('role')}, writer {who or '?'} (key {r.get('key')}), link {r.get('link')}"
                  f"{'' if r.get('ok') else '  PROBLEM: ' + r.get('why', '')}")
    rs = [r for r in RECS if r['passage'] == pid]
    if rs:
        print('\nreads records:')
    for r in rs:
        print(f"  rec {r['_i']}: note {r['note']} {r['source']} on {r['on']} | {r.get('url')} | "
              f"{r.get('time') or r.get('fetched')} | {r.get('read_how', '')}")
        if r.get('quote'):
            print(f"      quote: {r['quote']}")
        if r.get('pointer'):
            print(f"      pointer (no quote kept; what the page says): {r['pointer']}")
        if r.get('at'):
            print(f"      at: {r['at']}")
        for k in ('remark', 'decided', 'verdict'):
            if r.get(k):
                print(f"      {k}: {r[k]}")
    print()
