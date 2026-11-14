#!/usr/bin/env python3
"""combine_held.py <out.json> <run output>...: join the held review's runs into {results: [...]} for apply_held.py.
A batch whose review or verdicts were passed in from rvh/items2.json gets them back from there."""
import json, os, sys
SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
items = {i['batch'][0]: i for i in json.load(open(f'{SP}/rvh/items2.json'))}
res, seen = [], set()
for f in sys.argv[2:]:
    d = json.load(open(f))
    for b in d['result']['results']:
        first = b['batch'][0]
        assert first not in seen, first
        seen.add(first)
        it = items[first]
        assert it['batch'] == b['batch'], first
        for k in ('review', 'verdicts'):
            if isinstance(b.get(k), str):
                assert 'items2' in b[k], (first, k, b[k])
                b[k] = it[k]
        for k in ('verdicts', 'verdicts2'):
            assert isinstance(b.get(k) or [], list), (first, k)
        res.append(b)
missing = [k for k in items if k not in seen]
print(len(res), 'batches; missing:', missing or 'none')
for b in res:
    v1, v2 = b.get('verdicts') or [], b.get('verdicts2') or []
    print(f"{b['batch'][0]:24} review {len((b.get('review') or {}).get('findings', []))} findings; "
          f"verdicts {len(v1)} ({sum(v['verdict']=='refute' for v in v1)} refuted); "
          f"critic {len((b.get('critic') or {}).get('findings', []))}; verdicts2 {len(v2)} ({sum(v['verdict']=='refute' for v in v2)} refuted)")
json.dump({'results': res}, open(sys.argv[1], 'w'), indent=1, ensure_ascii=False)
