import sys, re
sys.stdout.reconfigure(encoding='utf-8')
t = open(sys.argv[1], encoding='utf-8').read()
for r in sys.argv[2:]:
    print('#####', r)
    n = 0
    for m in re.finditer(re.escape(r) + r'(?![0-9])', t):
        # find the figure heading before: last "; or, " heading
        h = t.rfind('; or, ', 0, m.start())
        hs = t.rfind(' ', 0, max(0, h - 30))
        head = t[max(0, h - 40):h + 40].replace('\n', ' ')
        print('  [near heading:', head, ']')
        print('  ...' + t[max(0, m.start() - 250):m.end() + 450].replace('\n', ' ') + '...')
        n += 1
        if n >= 4: break
