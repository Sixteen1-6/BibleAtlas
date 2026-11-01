"""look.py cache book chapter v1 v2 regex [writers]  -> sentences matching regex in those verse comments"""
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
cache, b, c, v1, v2, rx = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), re.compile(sys.argv[6], re.I)
ws = set(sys.argv[7].split(',')) if len(sys.argv) > 7 else None
for line in open(cache, encoding='utf-8'):
    w, bb, cc, vv, t = json.loads(line)
    if bb != b or cc != c or not (v1 <= vv <= v2): continue
    if ws and w not in ws: continue
    for m in rx.finditer(t):
        s = max(0, m.start() - 220); e = min(len(t), m.end() + 220)
        print(f"[{w} {cc}:{vv}] ...{t[s:e]}...")
