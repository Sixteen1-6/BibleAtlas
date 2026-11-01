"""have.py: figure, parallel and contrast notes this thread already holds or has written, by verse, so the 12-figure
batches do not repeat one. Reads main's seed notes, the PR #63 cumulative output, every finished work folder and
the PR #68 structures."""
import glob, json, os, re
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'


def notes():
    seen = {}
    files = glob.glob(f'{LW}/config/figures/*.json') + glob.glob(f'{W}/fig/out_p63/config/figures/*.json')
    files += sorted(glob.glob(f'{W}/fig/work/*/final.json'))
    files += [f for f in glob.glob(f'{W}/fig/work/*/pending*.json')]
    for f in files:
        try:
            d = json.load(open(f))
        except Exception:
            continue
        for n in d.get('notes', []) if isinstance(d, dict) else d:
            if isinstance(n, dict) and 'id' in n:
                seen[n['id']] = {'id': n['id'], 'kind': n.get('kind'), 'form': n.get('form'), 'ref': n.get('ref'),
                                 'short': n.get('short', ''), 'from': os.path.relpath(f, W)}
    return list(seen.values())


def chap(ref):
    m = re.match(r'^(.+?) (\d+):', ref or '')
    return (m.group(1), int(m.group(2))) if m else None


def near(ref, ns):
    c = chap(ref)
    return [n for n in ns if chap(n['ref']) == c]


if __name__ == '__main__':
    ns = notes()
    print(len(ns), 'notes held')
