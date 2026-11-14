"""copy13.py: round 13's sets, runs, verdicts and scripts into eval/ask, with manifest entries."""
import json, os, shutil, hashlib, gzip, glob, re
R = os.path.dirname(os.path.abspath(__file__)); E = '/home/claude/bibleatlas/eval/ask'
os.chdir(R)
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
entries = []
def put(src, dst, gz=False, old=None):
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True)
    s = src if os.path.isabs(src) else os.path.join(R, src)
    if gz:
        with open(s, 'rb') as f, open(d, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as g: g.write(f.read())
    else:
        shutil.copyfile(s, d)
    e = {'path': dst, 'old': [old or 'scratchpad/r13/' + os.path.relpath(s, R)], 'source_sha256': sha(s), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
    if gz: e['change'] = 'gzipped'
    entries.append(e)
def script(src, dst, subs=(), old=None):
    s = open(os.path.join(R, src)).read()
    for a, b in subs:
        assert a in s, (src, a); s = s.replace(a, b)
    d = os.path.join(E, dst); os.makedirs(os.path.dirname(d), exist_ok=True); open(d, 'w').write(s)
    e = {'path': dst, 'old': [old or 'scratchpad/r13/' + src], 'source_sha256': sha(os.path.join(R, src)), 'bytes': os.path.getsize(d), 'sha256': sha(d)}
    if subs: e['change'] = 'container paths taken from the environment'
    entries.append(e)
home = [("'/home/claude/bibleatlas/eval/ask/scripts/tools'", "'./eval/ask/scripts/tools'"), ("'/home/claude/bibleatlas'", "'.'")]
for f in ['run13.cjs', 'trace13.cjs', 'sim13.py', 'score13.py', 'blind13.py', 'copy13.py']: script(f, 'scripts/r13/' + f)
script('batch13.py', 'scripts/r13/batch13.py', [("os.environ.get('ATLAS_REPO', '/home/claude/bibleatlas')", "os.environ.get('ATLAS_REPO', '.')")])
script('prep13.py', 'scripts/r13/prep13.py', [("R = '/home/claude/bibleatlas/config/'", "R = os.environ.get('ATLAS_REPO', '.') + '/config/'"), ('import json, re, collections', 'import json, re, collections, os')])
script('tools/qs.py', 'scripts/r13/qs.py', home)
script('tools/check_draft.py', 'scripts/r13/check_draft.py', home)
script('tools/apply_drafts.py', 'scripts/r13/apply_drafts.py', [("'/home/claude/bibleatlas'", "'.'")])
script('fresh13.js', 'scripts/r13/fresh13.js', old='workflow ask-fresh-questions-13 (wf_8b38d1df-384)')
script('facts13.js', 'scripts/r13/facts13.js', old='workflow ask-fact-answers (wf_1ee65019-b36)')
put('blind-fresh13.json', 'sets/blind-fresh13-520.json')
put('facts.json', 'sets/facts13-239.json')
put('seen15.txt', 'sets/seen15-6928.txt')
put('blind13-verdicts.json', 'verdicts/r13/blind-fresh13-520-verdicts.json')
num = lambda p: int(re.findall(r'\d+', os.path.basename(p))[0])
for b in sorted(glob.glob('blind13-batches/batch-*.json'), key=num): put(b, 'verdicts/r13/blind-fresh13-520-batches/' + os.path.basename(b))
put('blind13-main.json', 'verdicts/r13/blind-fresh13-520-main.json'); put('blind13-branch.json', 'verdicts/r13/blind-fresh13-520-branch.json')
put('verdicts-facts.json', 'verdicts/r13/facts13-verdicts.json')
put('f-main.json', 'verdicts/r13/facts13-main-before.json'); put('f-main2.json', 'verdicts/r13/facts13-main.json'); put('f-branch.json', 'verdicts/r13/facts13-branch.json')
put('d-main.json', 'verdicts/r13/dev12-2844-main.json.gz', gz=True); put('d-branch.json', 'verdicts/r13/dev12-2844-branch.json.gz', gz=True)
put('t-main.json', 'verdicts/r13/dev12-2844-trace-main.json.gz', gz=True); put('t-branch.json', 'verdicts/r13/dev12-2844-trace-branch.json.gz', gz=True)
put('facts13-workflow-result.json', 'verdicts/r13/facts13-workflow-result.json.gz', gz=True, old='tasks (workflow result)')
m = json.load(open(E + '/manifest.json'))
m['files'] = [f for f in m['files'] if not (f['path'].startswith('scripts/r13/') or f['path'].startswith('verdicts/r13/') or f['path'].startswith('sets/blind-fresh13') or f['path'].startswith('sets/facts13') or f['path'].startswith('sets/seen15'))] + entries
json.dump(m, open(E + '/manifest.json', 'w'), indent=1, ensure_ascii=False)
print(len(entries), 'files')
