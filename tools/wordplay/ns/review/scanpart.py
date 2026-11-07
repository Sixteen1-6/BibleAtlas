import difflib, json, sys
sys.path.insert(0, sys.argv[1])
import scanq as s
q = json.load(open(f'{sys.argv[1]}/out/quotes.json'))
want = set(sys.argv[2].split(','))
for x in q:
    if x['entry'] not in want or x['source'] not in ('lowth', 'jebb', 'boys', 'forbes'):
        continue
    items = s.ITEMS.get(x.get('work')) or s.ITEMS.get(x['source'])
    named = s.named_pages(x['found'])
    print('==', x['entry'], x['source'], 'named', named)
    for p in s.pparts(x['quote'], s.fold3):
        qw = p.split()
        best = (0, None, None)
        for item in items:
            for page, fs in s.idx.get(item, {}).items():
                for _, u, t in fs:
                    w = s.fold3(t).split()
                    for i in range(0, max(1, len(w) - len(qw) + 1)):
                        r = difflib.SequenceMatcher(None, qw, w[i:i + len(qw)], autojunk=False).ratio()
                        if r > best[0]:
                            best = (r, page, ' '.join(w[i:i + len(qw)]))
        if best[0] < 0.97:
            print(f'  part {best[0]:.2f} p{best[1]}: Q: {p[:220]}')
            print(f'             T: {(best[2] or "")[:220]}')
