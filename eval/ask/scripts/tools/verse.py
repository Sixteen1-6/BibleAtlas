#!/usr/bin/env python3
"""Print the BSB text of one or more references: verse.py "John 11:25-26" "Eccl 12:7" """
import sys; sys.path.insert(0, __import__('os').path.dirname(__file__))
from bible import parse, text, name
for r in sys.argv[1:]:
    try:
        vs = parse(r)
    except ValueError as e:
        print('ERROR', e); continue
    print(f'== {r} ({len(vs)} verse{"s" if len(vs) != 1 else ""})')
    for b, c, v in vs[:60]: print(f'{name(b, c, v)}  {text(b, c, v)}')
    if len(vs) > 60: print(f'... {len(vs) - 60} more')
