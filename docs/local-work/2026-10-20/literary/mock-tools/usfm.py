import sys
B = chr(92)
f, ch, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
lines = open(f, encoding='utf-8').read().split('\n')
inch = False; v = 0; buf = []
for ln in lines:
    if ln.startswith(B + 'c '):
        inch = ln.split()[1] == ch
        continue
    if not inch: continue
    if (B + 'v ') in ln:
        v = int(ln.split(B + 'v ')[1].split()[0])
    buf.append((v, ln))
# print lines belonging to verses a..b, plus the marker line just before each verse
for i, (vv, ln) in enumerate(buf):
    nxt = buf[i+1][0] if i+1 < len(buf) else vv
    if a <= vv <= b or (a <= nxt <= b and vv < a):
        print(ln)
