#!/usr/bin/env python3
"""prep.py <NN> [K ...]: gathers each batch's reading ahead of the writer, into every/hNN/work/hNN-KK/pack.md:
for every candidate, its line in the hand-off, the BSB words of its first verse with their Hebrew or Greek words
(vw.py), the BSB's poetry lines (poetrycheck.py --lines), every place Bullinger uses the verse (figname.py), the
local commentaries on it (cq.py all), and the full remark of each local work the candidate quotes (cq.py <work>).
The same tools, run the same way, so the writer starts reading at once instead of running them one by one."""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.dirname(HERE)
PY = [sys.executable, '-I']
WORK = {'keil-delitzsch': 'kad', 'henry': 'mhc', 'barnes': 'barnes', 'jfb': 'jfb', 'clarke': 'clarke', 'calvin': 'calvin',
        'bullinger-fos': 'fos'}


def run(args, limit=60000):
    try:
        out = subprocess.run(PY + args, capture_output=True, text=True, timeout=120, cwd=W).stdout
    except subprocess.TimeoutExpired:
        out = '(timed out)'
    return out[:limit].rstrip()


QUOTABLE_LOCAL = ('clarke', 'barnes', 'jfb', 'kad', 'mhc', 'calvin', 'fos')


def quotable_only(text):
    """cq.py all's sections for the quotable local works only (gill, mhcc, wesley, geneva and cb are never quoted)."""
    out, keep = [], False
    for line in text.split('\n'):
        if line.startswith('== '):
            keep = line[3:].split(' ', 1)[0].rstrip(':') in QUOTABLE_LOCAL
        if keep:
            out.append(line)
    return '\n'.join(out)


def first_verse(ref):
    m = re.match(r'^(.+? \d+)(?::(\d+))?', ref)
    return f'{m.group(1)}:{m.group(2) or 1}' if m else ref


def pack(nn, k):
    b = json.load(open(f'{HERE}/h{nn}/batches.json'))[k]
    d = f'{HERE}/h{nn}/work/{b["key"]}'
    os.makedirs(d, exist_ok=True)
    parts = [f'# {b["key"]}: {len(b["cands"])} candidates, read ahead by prep.py with the tools named in each heading\n']
    for c in b['cands']:
        v = first_verse(c['ref'])
        parts.append(f'\n\n## n {c["n"]}: {c["ref"]} ({c["form"]})\n\n### the candidate\n```\n{json.dumps(c, ensure_ascii=False, indent=1)}\n```')
        parts.append(f'\n### vw.py "{c["ref"]}"\n```\n{run(["vw.py", c["ref"]], 20000)}\n```')
        parts.append(f'\n### poetrycheck.py --lines "{v}"\n```\n{run(["fig/poetrycheck.py", "--lines", v])}\n```')
        parts.append(f'\n### figname.py "{v}"\n```\n{run(["figname.py", v], 20000)}\n```')
        parts.append(f'\n### cq.py all "{v}" (quotable works only)\n```\n{quotable_only(run(["cq.py", "all", v]))}\n```')
        seen = set()
        for q in c.get('quotes', []):
            w = WORK.get(q['source'])
            at = q.get('at') or v
            if w and (w, at) not in seen and w != 'fos':
                seen.add((w, at))
                parts.append(f'\n### cq.py {w} "{at}" (the remark the candidate quotes, in full)\n```\n{run(["cq.py", w, at])}\n```')
    open(f'{d}/pack.md', 'w').write('\n'.join(parts) + '\n')
    return f'{d}/pack.md', sum(len(p) for p in parts)


if __name__ == '__main__':
    nn = sys.argv[1]
    ks = [int(x) for x in sys.argv[2:]] or range(len(json.load(open(f'{HERE}/h{nn}/batches.json'))))
    for k in ks:
        p, n = pack(nn, k)
        print(p, n)
