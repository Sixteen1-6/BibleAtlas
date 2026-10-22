"""workdir.py [folder]: rebuild the working folder the scripts in eval/ask/scripts were written in.

The scripts read their inputs by the names they had while the rounds were run (for example
scratchpad/g7/bf-base.json, or tasks/wcvrmrcle.output for a set of verdicts). This copies every
file listed in eval/ask/manifest.json to each of its old names under the folder (default
eval/ask/work), unpacks the .gz files, and wraps each verdict file the way the scripts expect
({"result": ...}). It checks each file's sha256 first and changes nothing in eval/ask itself.

Then, before running a script:
    export ASK_WORK=<the folder>          # holds scratchpad/ and tasks/
    export ATLAS_REPO=<a clone of BibleAtlas, with make data run>
    export PLAYWRIGHT=<path to the playwright package>   # only for the browser runners
and run the script from its folder under $ASK_WORK/scratchpad, as the README says.
"""
import gzip, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
dest = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'work'))
files = json.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8'))['files']
written = skipped = 0
for f in files:
    data = open(os.path.join(ROOT, f['path']), 'rb').read()
    if hashlib.sha256(data).hexdigest() != f['sha256']:
        sys.exit(f"{f['path']}: sha256 does not match manifest.json; stopping")
    if not f['old']:
        skipped += 1
        continue
    if f.get('gzip'): data = gzip.decompress(data)
    if f.get('from_task_output'): data = json.dumps({'result': json.loads(data)}, ensure_ascii=False).encode()
    for old in f['old']:
        if old.startswith('/') or '..' in old.split('/'): sys.exit(f'bad old name {old}')
        out = os.path.join(dest, old)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, 'wb') as fh: fh.write(data)
        written += 1
print(f'{written} files written under {dest} ({skipped} files have no old name and were left out)')
print(f'export ASK_WORK={dest}')
