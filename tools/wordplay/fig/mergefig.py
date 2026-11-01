"""mergefig.py <repo> <our figures dir>: add our config/figures notes to a repo's config/figures, keeping its notes
first and in place, ours after them in verse order, in the repo's layout (2-space JSON, a final newline)."""
import glob, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

repo, ours = sys.argv[1], sys.argv[2]
added = 0
for f in sorted(glob.glob(f'{ours}/*.json')):
    name = os.path.basename(f)
    dst = f'{repo}/config/figures/{name}'
    have = json.load(open(dst))['notes'] if os.path.exists(dst) else []
    ids = {n['id'] for n in have}
    new = [n for n in json.load(open(f))['notes'] if n['id'] not in ids]
    def order(n):
        m = re.search(r'(\d+):(\d+)', n['ref'])
        return (int(m.group(1)), int(m.group(2)), n['id']) if m else (0, 0, n['id'])
    new.sort(key=order)
    added += len(new)
    with open(dst, 'w') as o:
        o.write(json.dumps({'notes': have + new}, ensure_ascii=False, indent=2) + '\n')
print(added, 'notes added')
