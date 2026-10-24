#!/usr/bin/env python3
"""Nave's Topical Bible (1896; data CC BY 4.0, BradyStephenson/bible-data).
  naves.py SUBJECT            print one subject's entry: each label with its references
  naves.py --find WORD        subjects whose name contains WORD, and subentry labels containing WORD
  naves.py --verses SUBJECT   also print the BSB text of every single-verse reference (long!)
  naves.py --cites REF        every subject and label whose references include REF
"""
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from bible import naves_rows, split_line, nave_refs, parse, text, name
rows = naves_rows()
args = sys.argv[1:]
if not args: print(__doc__); sys.exit()
if args[0] == '--find':
    w = ' '.join(args[1:]).lower()
    subs = [r['subject'] for r in rows if w in r['subject'].lower()]
    print('SUBJECTS:', '; '.join(subs[:80]), f'({len(subs)})')
    print('LABELS:')
    n = 0
    for r in rows:
        for line in r['entry'].split('\n'):
            d, label, refs = split_line(line)
            if w in label.lower():
                print(f'  {r["subject"]} > {label}'); n += 1
                if n > 80: sys.exit()
    sys.exit()
if args[0] == '--cites':
    want = set(parse(' '.join(args[1:])))
    for r in rows:
        top = ''
        for line in r['entry'].split('\n'):
            if not line.strip(): continue
            d, label, refs = split_line(line)
            if not d: top = label
            for x in nave_refs(refs):
                try: vs = parse(x)
                except ValueError: continue
                if len(vs) <= 40 and want & set(vs):
                    print(f"  {r['subject']} > {(top + ' > ' if d else '') + label}  [{x}]"); break
    sys.exit()
show = args[0] == '--verses'
subj = ' '.join(args[1:] if show else args).upper()
hit = [r for r in rows if r['subject'].upper() == subj]
if not hit: print('no such subject; try --find'); sys.exit(1)
for r in hit:
    for line in r['entry'].split('\n'):
        if not line.strip(): continue
        d, label, refs = split_line(line)
        rs = nave_refs(refs)
        print(('    ' if d else '') + f'- {label}  [{"; ".join(rs)}]')
        if show:
            for x in rs:
                try: vs = parse(x)
                except ValueError: continue
                if len(vs) <= 3:
                    for b, c, v in vs: print(('    ' if d else '') + f'      {name(b, c, v)}  {text(b, c, v)}')
