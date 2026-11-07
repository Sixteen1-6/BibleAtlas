"""extract.py <out dir> <dest dir>: copy only the n12 notes (not seeds, not lw28) from a figpost out dir, one file per book."""
import json, glob, os, sys
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORMS = {f['id'] for f in json.load(open(f'{W}/n12/proposed-forms12.json'))['forms']}
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in glob.glob(f'{dst}/*.json'):
    os.remove(f)
n = 0
for f in sorted(glob.glob(f'{src}/config/figures/*.json')):
    notes = [x for x in json.load(open(f))['notes'] if x['form'] in FORMS]
    if notes:
        json.dump({'notes': notes}, open(f'{dst}/{os.path.basename(f)}', 'w'), indent=2, ensure_ascii=False)
        n += len(notes)
print(n, 'notes')
