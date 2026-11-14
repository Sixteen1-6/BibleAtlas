"""copy16.py: round 16's sets, runs, verdicts and diagnosis into eval/ask, with manifest entries.
R16 names the round's working folder (default: this session's scratchpad/r16); TASKS the folder of
workflow outputs, from which the tuning judges' results are kept (those whose verdicts are all new)."""
import json, os, shutil, hashlib, gzip, glob, re
E = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R = os.environ.get('R16', '/tmp/claude-0/-home-claude-bibleatlas/555273da-0cd0-52f0-aa0e-444d260cada5/scratchpad/r16')
TASKS = os.environ.get('TASKS', '/tmp/claude-0/-home-claude/555273da-0cd0-52f0-aa0e-444d260cada5/tasks')
os.chdir(R)
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
entries = []
def gz_write(data, d):
    with open(d, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as g: g.write(data)
def put(src, dst, gz=False):
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    if gz: gz_write(open(src, 'rb').read(), d)
    else: shutil.copyfile(src, d)
    e = {'path': dst, 'old': ['scratchpad/r16/' + src], 'source_sha256': sha(src), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
    if gz: e['change'] = 'gzipped'
    entries.append(e)
def made(data, dst, old, gz=False):
    """A file made here from round files (named in old)."""
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    if gz: gz_write(data, d)
    else: open(d, 'wb').write(data)
    entries.append({'path': dst, 'old': [old], 'source_sha256': hashlib.sha256(data).hexdigest(), 'bytes': os.path.getsize(d), 'sha256': sha(d), 'change': 'made here' + (', gzipped' if gz else '')})
def bundle(srcs, dst, old):
    """Several JSON files into one gzipped JSON object {file name: content}."""
    data = json.dumps({s: json.load(open(s)) for s in sorted(srcs)}, ensure_ascii=False, indent=1).encode()
    made(data, dst, old, gz=True)
def kept(dst, old):
    """A script already written in eval/ask/scripts/r16 (its manifest entry only)."""
    d = os.path.join(E, dst)
    entries.append({'path': dst, 'old': [old], 'source_sha256': sha(d), 'bytes': os.path.getsize(d), 'sha256': sha(d)})
# Scripts
put('quotes.py', 'scripts/r16/quotes16.py')
for f in ['why16.js', 'quotes16.cjs', 'run16.cjs', 'fresh16.js', 'prep16.py', 'copy16.py']:
    kept('scripts/r16/' + f, 'written in eval/ask/scripts/r16')
# Sets
put('miss15.json', 'sets/miss15-249.json')
put('pool16.json', 'sets/pool16-4887.json')
put('fresh16/blind-fresh16.json', 'sets/blind-fresh16-520.json')
seen = [l.rstrip('\n') for l in open('fresh16/seen17.txt', encoding='utf-8') if l.strip()]
have = set(seen)
for m in json.load(open('fresh16/fresh16-raw.json'))['questions']:
    if m['q'] not in have: seen.append(m['q']); have.add(m['q'])
made(('\n'.join(seen) + '\n').encode(), f'sets/seen18-{len(seen)}.txt', 'made here: seen17-7968.txt and fresh16-raw.json')
# Why round 15's blind misses were missed
bundle(['why16.json', 'why-q.json', 'why-trace.json'] + glob.glob('why/*.json'), 'verdicts/r16/miss15-causes.json.gz', 'scratchpad/r16/why16.json, why-q.json, why-trace.json, why/')
# Tuning: the new verdicts, the judges' results, the batches judged, the runs (first 6 only) and the quotes found
base, now = json.load(open('cache16.json')), json.load(open('cache16c.json'))
new = {k: v for k, v in now.items() if k not in base}
made(json.dumps(new, ensure_ascii=False, indent=0).encode(), 'verdicts/r16/tuning-verdicts.json', 'made here: cache16c.json less cache16.json')
outs = []
for f in sorted(glob.glob(TASKS + '/*.output')):
    try: r = json.load(open(f))
    except Exception: continue
    if isinstance(r, dict) and isinstance(r.get('result'), dict): r = r['result']
    res = r.get('results') if isinstance(r, dict) else None
    if not res or not isinstance(res, list) or not isinstance(res[0], dict) or 'verses' not in res[0]: continue
    ks = [x['q'].strip().lower() + '\t' + v['ref'] for x in res for v in x['verses']]
    if ks and sum(k in new for k in ks) >= 0.9 * len(ks): outs.append(f)
data = json.dumps({os.path.basename(f): json.load(open(f)).get('result') for f in outs}, ensure_ascii=False, indent=1).encode()
made(data, 'verdicts/r16/tuning-judge-results.json.gz', 'tasks (judge15.js results on seen messages)', gz=True)
bundle(glob.glob('jm/*.json') + glob.glob('jb16/*.json') + glob.glob('jb16c/*.json'), 'verdicts/r16/tuning-batches.json.gz', 'scratchpad/r16/jm/, jb16/, jb16c/')
runs = {}
for f in sorted(glob.glob('p-*.json')):
    runs[f] = {r['q']: [r['how'], r.get('chain'), [s['ref'] for s in r['shown'][:6]]] for r in json.load(open(f))}
made(json.dumps(runs, ensure_ascii=False).encode(), 'verdicts/r16/pool-runs-first6.json.gz', 'scratchpad/r16/p-*.json (how, chain and first 6 references only)', gz=True)
q = {f: [{'q': r['q'], 'refs': [v['ref'] for v in r['verses']]} for r in json.load(open(f)) if r['verses']] for f in ['q16.json', 'q16-r5.json']}
made(json.dumps(q, ensure_ascii=False, indent=1).encode(), 'verdicts/r16/pool-quotes.json', 'scratchpad/r16/q16.json, q16-r5.json (messages that quote, with the verses found)')
# Blind
put('blind/f16-verdicts.json', 'verdicts/r16/blind-fresh16-520-verdicts.json')
num = lambda p: int(re.findall(r'\d+', os.path.basename(p))[0])
for b in sorted(glob.glob('blind/bb/batch-*.json'), key=num): put(b, 'verdicts/r16/blind-fresh16-520-batches/' + os.path.basename(b))
put('blind/bf16-main.json', 'verdicts/r16/blind-fresh16-520-main.json'); put('blind/bf16-branch.json', 'verdicts/r16/blind-fresh16-520-branch.json')
m = json.load(open(E + '/manifest.json'))
mine = lambda p: p.startswith('scripts/r16/') or p.startswith('verdicts/r16/') or any(p.startswith('sets/' + x) for x in ['blind-fresh16', 'seen18', 'miss15', 'pool16'])
m['files'] = [f for f in m['files'] if not mine(f['path'])] + entries
json.dump(m, open(E + '/manifest.json', 'w'), indent=1, ensure_ascii=False)
print(len(entries), 'files;', len(outs), 'judge results;', len(new), 'new tuning verdicts;', len(seen), 'seen')
