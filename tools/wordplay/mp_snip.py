#!/usr/bin/env python3
# usage: python3 -I mp_snip.py work "Book C:V" regex [span]
import sys, re
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
from mp_verify import note
w, ref, rx = sys.argv[1], sys.argv[2], sys.argv[3]
span = int(sys.argv[4]) if len(sys.argv) > 4 else 0
t = note(w, ref, span)
hits = list(re.finditer(rx, t, re.I))
print(f'--- {w} {ref} ({len(hits)} hits, {len(t)} chars)')
for m in hits[:4]:
    print('   ...' + t[max(0, m.start()-220):m.end()+220].replace('\n', ' ') + '...')
