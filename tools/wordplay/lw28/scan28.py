"""scan28.py: commentary scan for the figure families the round 3 scan (r3/figscan.py) did not search:
mirror order named as chiasmus, introversion, epanodos or antimetabole; merism; God spoken of in human terms;
personification. Leads only: every note is still written and checked against the writers' own words."""
import json, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq
import mine3h as M
cq.LC_DIR = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/lw28/lcall'
M.WRITER = {}
from collections import defaultdict, Counter
FAM = {
 'mirror': re.compile(r'chias|chiasm|introver|epanodos|antimetabol|inverted order|order (?:is )?inverted|reverse(?:d)? order|order (?:is )?reversed', re.I),
 'merism': re.compile(r'merism|merismus', re.I),
 'anthropopatheia': re.compile(r'anthropopath|anthropomorph|after the manner of men|manner of men\b|condescension to (?:our|human)', re.I),
 'prosopopoeia': re.compile(r'prosopop|personif', re.I),
}
hits = defaultdict(lambda: defaultdict(list))
for w, v, t in M.units():
    for fam, rx in FAM.items():
        m = rx.search(t)
        if m:
            hits[(fam, v)][M.WRITER.get(w, w)].append(t[max(0, m.start()-300): m.end()+300])
out = []
for (fam, v), ws in hits.items():
    out.append({'fam': fam, 'b': v[0], 'c': v[1], 'v': v[2], 'ref': f'{cq.BOOKS[v[0]]} {v[1]}:{v[2]}', 'writers': sorted(ws), 'leads': {k: x[:2] for k, x in ws.items()}})
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False)
c = Counter((x['fam'], min(len(x['writers']), 3)) for x in out)
for k in sorted(c): print(k, c[k])
