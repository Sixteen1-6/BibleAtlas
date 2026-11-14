"""copy14.py: round 14's sets, runs, verdicts, drafts and scripts into eval/ask, with manifest entries."""
import json, os, shutil, hashlib, gzip, glob, re, io
R = os.path.dirname(os.path.abspath(__file__)); E = '/home/claude/bibleatlas/eval/ask'
os.chdir(R)
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
entries = []
def gz_write(data, d):
    with open(d, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as g: g.write(data)
def put(src, dst, gz=False, old=None):
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    s = src if os.path.isabs(src) else os.path.join(R, src)
    if gz: gz_write(open(s, 'rb').read(), d)
    else: shutil.copyfile(s, d)
    e = {'path': dst, 'old': [old or 'scratchpad/r14/' + os.path.relpath(s, R)], 'source_sha256': sha(s), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
    if gz: e['change'] = 'gzipped'
    entries.append(e)
def bundle(srcs, dst, old):
    """Several JSON files into one gzipped JSON object {file name: content}."""
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    data = json.dumps({os.path.basename(s): json.load(open(s)) for s in sorted(srcs)}, ensure_ascii=False, indent=1).encode()
    gz_write(data, d)
    entries.append({'path': dst, 'old': [old], 'source_sha256': hashlib.sha256(data).hexdigest(), 'bytes': os.path.getsize(d), 'sha256': sha(d), 'change': 'bundled and gzipped'})
def script(src, dst, subs=(), old=None):
    s = open(os.path.join(R, src)).read()
    for a, b in subs:
        assert a in s, (src, a); s = s.replace(a, b)
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True); open(d, 'w').write(s)
    e = {'path': dst, 'old': [old or 'scratchpad/r14/' + src], 'source_sha256': sha(os.path.join(R, src)), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
    if subs: e['change'] = 'container paths taken from the environment'
    entries.append(e)
def kept(dst, old):
    """A script already written in eval/ask/scripts/r14 (its manifest entry only)."""
    d = os.path.join(E, dst)
    entries.append({'path': dst, 'old': [old], 'source_sha256': sha(d), 'bytes': os.path.getsize(d), 'sha256': sha(d)})
# Scripts
for f in ['run14.cjs', 'live14.py', 'variants.sh', 'around.sh', 'copy14.py']: script(f, 'scripts/r14/' + f)
script('batch14.py', 'scripts/r14/batch14.py')
for f, old in [('answers14.js', 'workflow ask-r14-answers (six runs split by area)'), ('fresh14.js', 'workflow ask-fresh-questions-14'),
               ('judge14.js', 'workflow ask judge, run in parts with from and to'), ('settle14.js', 'workflow ask-r14-settle (three runs)'),
               ('cross14.py', ''), ('near14.py', ''), ('fixups14.py', ''), ('reconcile14.py', ''), ('settle_apply14.py', ''), ('prep14.py', '')]:
    kept('scripts/r14/' + f, old or 'written in eval/ask/scripts/r14')
# Sets
put('fresh14/blind-fresh14.json', 'sets/blind-fresh14-519.json')
put('cite-seen.json', 'sets/cite-seen14-178.json')
put('bf13-live.json', 'sets/bf13-live-297.json'); put('d12live.json', 'sets/dev12-live-1172.json')
put('miss13.json', 'sets/miss13-180.json')
put('fresh14/seen16.txt', 'sets/seen16-7448.txt', old='made here: seen15-6928.txt and fresh14-raw.json')
# Tuning runs and verdicts
put('extra.json', 'verdicts/r14/tuning-verdicts.json')
bundle(glob.glob('jv-*.json') + glob.glob('jv2-*.json'), 'verdicts/r14/tuning-judge-results.json.gz', 'scratchpad/r14/jv-*.json, jv2-*.json')
bundle(glob.glob('jb1/*.json'), 'verdicts/r14/tuning-batches-1.json.gz', 'scratchpad/r14/jb1/'); bundle(glob.glob('jb2/*.json'), 'verdicts/r14/tuning-batches-2.json.gz', 'scratchpad/r14/jb2/')
bundle(glob.glob('a-*.json'), 'verdicts/r14/around-cite-seen-runs.json.gz', 'scratchpad/r14/a-0.json to a-3.json, a-2s.json')
bundle(glob.glob('v-*.json') + glob.glob('base-*.json'), 'verdicts/r14/pick-variant-runs.json.gz', 'scratchpad/r14/v-*.json, base-*.json')
# Blind
put('fresh14/f14-verdicts.json', 'verdicts/r14/blind-fresh14-519-verdicts.json')
num = lambda p: int(re.findall(r'\d+', os.path.basename(p))[0])
for b in sorted(glob.glob('fresh14/jb/batch-*.json'), key=num): put(b, 'verdicts/r14/blind-fresh14-519-batches/' + os.path.basename(b))
put('fresh14/f14-main.json', 'verdicts/r14/blind-fresh14-519-main.json'); put('fresh14/f14-branch.json', 'verdicts/r14/blind-fresh14-519-branch.json')
# Drafts and workflow results
bundle(glob.glob('w14/drafts/*.json'), 'verdicts/r14/drafts-applied.json.gz', 'scratchpad/r14/w14/drafts/ (as applied)')
bundle(glob.glob('w14/drafts-before-settle/*.json'), 'verdicts/r14/drafts-before-merge.json.gz', 'scratchpad/r14/w14/drafts-before-settle/')
bundle(glob.glob('wfout/*.json'), 'verdicts/r14/workflow-results.json.gz', 'tasks (workflow results)')
m = json.load(open(E + '/manifest.json'))
mine = lambda p: p.startswith('scripts/r14/') or p.startswith('verdicts/r14/') or any(p.startswith('sets/' + x) for x in ['blind-fresh14', 'cite-seen14', 'bf13-live', 'dev12-live', 'miss13', 'seen16'])
m['files'] = [f for f in m['files'] if not mine(f['path'])] + entries
json.dump(m, open(E + '/manifest.json', 'w'), indent=1, ensure_ascii=False)
print(len(entries), 'files')
