import json, sys, pickle
from router import Router
from evalr import verdict, DEV, S5
d = json.load(open('tt-sig.json'))
out = {}
for unk in [None, 5.0, 4.0, 3.0]:
    R = Router(d, use_sig=True, sig_ways=True, sig_one_df=1, unknown=unk)
    rows = []
    for q in DEV + S5:
        info = d['typed'][q]
        if info['care']: continue
        rs = R.routes(info['terms'], 3)
        rows.append(dict(q=q, s5=q in S5, exact=info['exact'], top=rs, v=[verdict(q, r['id']) for r in rs]))
    out[unk] = rows
    print(unk, len(rows), flush=True)
pickle.dump(out, open('feats.pkl', 'wb'))
