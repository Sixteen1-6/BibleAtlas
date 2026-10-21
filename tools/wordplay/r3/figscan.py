import json, re, sys, os
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq
import mine3h as M
from collections import defaultdict, Counter
FAM = {
 'metonymy': re.compile(r'metonym', re.I),
 'synecdoche': re.compile(r'synecdoch', re.I),
 'parallelism': re.compile(r'parallelism|parallel (?:lines|clauses|members|member|line|clause|hemistich)|the parallel\b|synonymous parallel|antithetic', re.I),
 'contrast': re.compile(r'\bcontrast(?:s|ed|ing)?\b|set over against|juxtapos|placed side by side|set side by side|antithesis', re.I),
}
hits = defaultdict(lambda: defaultdict(list))
for w, v, t in M.units():
    for fam, rx in FAM.items():
        m = rx.search(t)
        if m:
            hits[(fam, v)][M.WRITER.get(w, w)].append(t[max(0, m.start()-250): m.end()+250])
out = []
for (fam, v), ws in hits.items():
    out.append({'fam': fam, 'b': v[0], 'c': v[1], 'v': v[2], 'ref': f'{cq.BOOKS[v[0]]} {v[1]}:{v[2]}', 'writers': sorted(ws), 'leads': {k: x[:2] for k, x in ws.items()}})
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False)
c = Counter((x['fam'], min(len(x['writers']), 3)) for x in out)
for k in sorted(c): print(k, c[k])
