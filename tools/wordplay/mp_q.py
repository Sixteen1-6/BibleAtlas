#!/usr/bin/env python3
# usage: mp_q.py "Ref" regex [works...]  -> first hit per work
import sys, re
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
from mp_verify import note
ref, rx = sys.argv[1], sys.argv[2]
works = sys.argv[3:] or ['kad', 'gill', 'jfb', 'barnes', 'clarke']
for w in works:
    t = note(w, ref, 3 if w == 'kad' else 1)
    m = re.search(rx, t, re.I)
    if m:
        print(f'  {w}: ...' + t[max(0, m.start()-200):m.end()+200].replace('\n', ' ') + '...')
    else:
        print(f'  {w}: -')
