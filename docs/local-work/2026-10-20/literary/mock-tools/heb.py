import json, sys
sys.stdout.reconfigure(encoding='utf-8')
d = json.load(open(sys.argv[1], encoding='utf-8'))
for ref in sys.argv[2:]:
    c, v = map(int, ref.split(':'))
    row = d['chapters'][c-1][v-1]
    print('##', ref, row[0])
    for i, w in enumerate(row[1]):
        print('  ', i, w[0], '|', w[1], '|', w[2], '|', w[3])
    if len(row) > 2: print('   align', json.dumps(row[2], ensure_ascii=False))
