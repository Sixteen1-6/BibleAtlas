"""copy15.py: round 15's sets, runs, verdicts and fitting traces into eval/ask, with manifest entries.
R15 names the round's working folder (default: this session's scratchpad/r15); TASKS the folder of
workflow outputs, from which the tuning judges' results are kept (those whose verdicts are all new)."""
import json, os, shutil, hashlib, gzip, glob, re
E = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R = os.environ.get('R15', '/tmp/claude-0/-home-claude-bibleatlas/555273da-0cd0-52f0-aa0e-444d260cada5/scratchpad/r15')
TASKS = os.environ.get('TASKS', '/tmp/claude-0/-home-claude/555273da-0cd0-52f0-aa0e-444d260cada5/tasks')
os.chdir(R)
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
entries = []
def gz_write(data, d):
    with open(d, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as g: g.write(data)
def put(src, dst, gz=False, old=None):
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    if gz: gz_write(open(src, 'rb').read(), d)
    else: shutil.copyfile(src, d)
    e = {'path': dst, 'old': [old or 'scratchpad/r15/' + src], 'source_sha256': sha(src), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
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
    """A script already written in eval/ask/scripts/r15 (its manifest entry only)."""
    d = os.path.join(E, dst)
    entries.append({'path': dst, 'old': [old], 'source_sha256': sha(d), 'bytes': os.path.getsize(d), 'sha256': sha(d)})
# Scripts written in the working folder
for f in ['score15.py', 'qs.py']: put(f, 'scripts/r15/' + f)
put('trace15m.cjs', 'scripts/r15/meanings15.cjs')
for f in ['why15.js', 'fresh15.js', 'trace15.cjs', 'named15.cjs', 'fit15.py', 'fitfinal15.py', 'batch15.py', 'judge15.js', 'merge15.py', 'prep15.py', 'blind15.py', 'copy15.py']:
    kept('scripts/r15/' + f, 'written in eval/ask/scripts/r15')
# Sets
put('fresh15/blind-fresh15.json', 'sets/blind-fresh15-467.json')
put('fresh15/glimpsed-53.json', 'sets/glimpsed15-53.json')
seen = [l.rstrip('\n') for l in open('fresh15/seen16.txt', encoding='utf-8') if l.strip()]
have = set(seen)
for m in json.load(open('fresh15/fresh15-raw.json'))['questions']:
    if m['q'] not in have: seen.append(m['q']); have.add(m['q'])
made(('\n'.join(seen) + '\n').encode(), f'sets/seen17-{len(seen)}.txt', 'made here: seen16-7448.txt and fresh15-raw.json')
put('miss14.json', 'sets/miss14-212.json')
put('dev15-sample.json', 'sets/dev15-479.json'); put('dev15-sample2.json', 'sets/dev15b-478.json')
put('named/named-665.json', 'sets/named15-665.json')
put('fit/all-msgs.json', 'sets/fit15-4420.json')
# Tuning: the new verdicts, the batches judged, the judges' results, the runs and the fits
base, now = json.load(open('fit/cache15.json')), json.load(open('cache15e.json'))
new = {k: v for k, v in now.items() if k not in base}
made(json.dumps(new, ensure_ascii=False, indent=0).encode(), 'verdicts/r15/tuning-verdicts.json', 'made here: cache15e.json less fit/cache15.json')
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
made(data, 'verdicts/r15/tuning-judge-results.json.gz', 'tasks (judge15.js results on seen messages)', gz=True)
bundle(glob.glob('jb/*.json'), 'verdicts/r15/tuning-batches-1.json.gz', 'scratchpad/r15/jb/')
bundle(glob.glob('jb2/*.json'), 'verdicts/r15/tuning-batches-2.json.gz', 'scratchpad/r15/jb2/')
bundle(glob.glob('why/*.json') + glob.glob('why-*.json') + ['why14.json'], 'verdicts/r15/miss14-causes.json.gz', 'scratchpad/r15/why/, why-*.json, why14.json')
bundle(glob.glob('cv*.json'), 'verdicts/r15/fit-cv-runs.json.gz', 'scratchpad/r15/cv*.json')
txt = {f: open(f).read() for f in sorted(glob.glob('cv*.txt') + ['fit/cv-all.txt', 'fit/cv-judged.txt'])}
made(json.dumps(txt, indent=1).encode(), 'verdicts/r15/fit-cv-scores.json', 'scratchpad/r15/cv*.txt, fit/cv-*.txt')
bundle(glob.glob('named/N*.json'), 'verdicts/r15/named-runs.json.gz', 'scratchpad/r15/named/N0.json to N6.json')
for f in ['w-fitd-31.json', 'w-fitd-31v.json', 'w-fitw-31.json', 'knobs-31v.json']: put(f, 'verdicts/r15/' + f)
for d in ['fitw']:
    for i in range(4): put(f'{d}/tr-{i}.json', f'verdicts/r15/traces-{d}/tr-{i}.json.gz', gz=True)
# Blind
put('blind/f15-verdicts.json', 'verdicts/r15/blind-fresh15-467-verdicts.json')
num = lambda p: int(re.findall(r'\d+', os.path.basename(p))[0])
for b in sorted(glob.glob('blind/bb/batch-*.json'), key=num): put(b, 'verdicts/r15/blind-fresh15-467-batches/' + os.path.basename(b))
put('blind/bf15-main.json', 'verdicts/r15/blind-fresh15-467-main.json'); put('blind/bf15-branch.json', 'verdicts/r15/blind-fresh15-467-branch.json')
m = json.load(open(E + '/manifest.json'))
mine = lambda p: p.startswith('scripts/r15/') or p.startswith('verdicts/r15/') or any(p.startswith('sets/' + x) for x in ['blind-fresh15', 'glimpsed15', 'seen17', 'miss14', 'dev15', 'named15', 'fit15'])
m['files'] = [f for f in m['files'] if not mine(f['path'])] + entries
json.dump(m, open(E + '/manifest.json', 'w'), indent=1, ensure_ascii=False)
print(len(entries), 'files;', len(outs), 'judge results;', len(new), 'new tuning verdicts;', len(seen), 'seen')
