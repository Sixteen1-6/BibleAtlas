import json, sys, collections
"""score9.py verdicts-output.json run.json...: blind verdicts per run (first 8 shown verses per question)."""
res = json.load(open(sys.argv[1]))
res = res.get('result', res); res = res.get('results', res) if isinstance(res, dict) else res
V = {}
for r in res:
    for v in r.get('verses', []): V.setdefault(r['q'], {})[v['ref']] = v['verdict']
for f in sys.argv[2:]:
    run = json.load(open(f))
    c = collections.Counter(); hows = collections.Counter(); qa = 0; n = 0; unj = 0
    byhow = collections.defaultdict(lambda: [0, 0, 0, 0])
    for r in run:
        if r['how'] == 'care': c['care'] += 1; continue
        n += 1; hows[r['how']] += 1
        vs = [V.get(r['q'], {}).get(t['ref']) for t in r['shown'][:8]]
        unj += vs.count(None)
        k = collections.Counter(vs); c.update(k)
        a = k['answers'] > 0; qa += a
        b = byhow[r['how']]; b[0] += 1; b[1] += a; b[2] += k['answers']; b[3] += k['off']
    print(f"{f.split('/')[-1]}: {n} questions, with an answering verse {qa}; answering {c['answers']}, related {c['related']}, off {c['off']}, unjudged {unj}, care {c['care']}")
    for h, b in sorted(byhow.items()): print(f"   {h}: {b[0]} questions, {b[1]} with an answer, {b[2]} answering, {b[3]} off")
