import json, os, shutil, hashlib, gzip, glob, re
R = os.path.dirname(os.path.abspath(__file__)); E = '/home/claude/bibleatlas/eval/ask'
os.chdir(R)
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
entries = []
def put(src, dst, gz=False):
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    s = src if os.path.isabs(src) else os.path.join(R, src)
    if os.path.abspath(s) != os.path.abspath(d):
        if gz:
            with open(s, 'rb') as f, open(d, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as g: g.write(f.read())
        else:
            shutil.copyfile(s, d)
    old = 'scratchpad/r12/' + os.path.relpath(s, R) if s.startswith(R) else 'tasks (workflow result)'
    e = {'path': dst, 'old': [old], 'source_sha256': sha(s), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
    if gz: e['change'] = 'gzipped'
    entries.append(e)
def script(src, dst, subs=()):
    s = open(os.path.join(R, src)).read()
    for a, b in subs:
        assert a in s, (src, a); s = s.replace(a, b)
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True); open(d, 'w').write(s)
    e = {'path': dst, 'old': ['scratchpad/r12/' + src], 'source_sha256': sha(os.path.join(R, src)), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
    if subs: e['change'] = 'container paths taken from the environment'
    entries.append(e)
pw = ("require('/opt/node22/lib/node_modules/playwright')", "require(process.env.PLAYWRIGHT || 'playwright')")
script('run12.cjs', 'scripts/r12/run12.cjs', [pw])
script('trace12.cjs', 'scripts/r12/trace12.cjs', [pw])
script('runvars.sh', 'scripts/r12/runvars.sh')
script('cache.py', 'scripts/r12/cache.py', [("R = '/home/claude/bibleatlas/eval/ask/verdicts'", "R = os.environ.get('ATLAS_REPO', '.') + '/eval/ask/verdicts'"), ("import json, glob, gzip, collections, sys", "import json, glob, gzip, collections, sys, os")])
script('score12.py', 'scripts/r12/score12.py')
script('batch12.py', 'scripts/r12/batch12.py', [("sys.path.insert(0, '/home/claude/bibleatlas/eval/ask/scripts/tools')", "sys.path.insert(0, os.environ.get('ATLAS_REPO', '.') + '/eval/ask/scripts/tools')")])
script('judge12.js', 'scripts/r12/judge12.js')
script('fresh12.js', 'scripts/r12/fresh12.js')
for f in ['fit12.py', 'fit12b.py', 'fit12c.py', 'fitfinal.py', 'blind12.py', 'fitrows12.py', 'copy12.py']: script(f, 'scripts/r12/' + f)
put('dev-all.json', 'sets/dev12-2844.json'); put('dev-live.json', 'sets/dev12-live-1172.json'); put('dev400.json', 'sets/dev12-400.json'); put('named.json', 'sets/dev12-named-237.json')
put('fresh12.json', 'sets/blind-fresh12-769.json')
num = lambda p: int(re.findall(r'\d+', os.path.basename(p))[0])
for i in (1, 2, 3, 4):
    put(f'{E}/verdicts/r12/dev{i}-verdicts.json', f'verdicts/r12/dev{i}-verdicts.json')
    for b in sorted(glob.glob(f'jd{i}/batch-*.json'), key=num): put(b, f'verdicts/r12/dev{i}-batches/' + os.path.basename(b))
put('blind12-verdicts.json', 'verdicts/r12/blind-fresh12-529-verdicts.json')
for b in sorted(glob.glob('jdb/batch-*.json'), key=num): put(b, 'verdicts/r12/blind-fresh12-529-batches/' + os.path.basename(b))
put('bl-main.json', 'verdicts/r12/blind-fresh12-529-base.json'); put('bl-branch.json', 'verdicts/r12/blind-fresh12-529-new.json')
put('m-fresh12.json', 'verdicts/r12/blind-fresh12-769-main-all.json'); put('b-fresh12.json', 'verdicts/r12/blind-fresh12-769-branch-all.json')
for v in ['base', 'vshow3', 'verse2s3', 'links2', 'wider3', 'words', 'combo']: put(f'd-{v}.json', f'verdicts/r12/dev12-400-{v}.json')
put('n-main.json', 'verdicts/r12/dev12-named-237-main.json'); put('n-new.json', 'verdicts/r12/dev12-named-237-cite.json'); put('n-new2.json', 'verdicts/r12/dev12-named-237-final.json')
put('b-live.json', 'verdicts/r12/dev12-live-1172-final.json.gz', gz=True)
put('fit-rows-31904.json.gz', 'verdicts/r12/fit-rows-31904.json.gz'); put('fit-weights.json', 'verdicts/r12/fit-weights.json')
put('seen13.txt', 'sets/seen13-6145.txt')
m = json.load(open(E + '/manifest.json'))
m['files'] = [f for f in m['files'] if not (f['path'].startswith('scripts/r12/') or f['path'].startswith('verdicts/r12/') or f['path'].startswith('sets/dev12') or f['path'].startswith('sets/blind-fresh12') or f['path'].startswith('sets/seen13'))] + entries
json.dump(m, open(E + '/manifest.json', 'w'), indent=1, ensure_ascii=False)
print(len(entries), 'files')
