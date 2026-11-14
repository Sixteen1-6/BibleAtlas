"""check_final.py: mk_ev2.py's tests run on the assembled lines (out/final/held-new-passages.json) for all notes; writes nothing."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(f'{HERE}/mk_ev2.py').read()
src = src.split("os.makedirs(f'{O}/ev'")[0]
fin = {p['id']: p for p in json.load(open(f'{HERE}/out/final/held-new-passages.json'))['passages']}
facts = json.load(open(f'{HERE}/out/facts.json'))
for x in facts:
    l = fin[x['passage']]['layers'][x['note']]
    assert l['kind'] == x['kind']
    x['evidence'] = l['evidence']
    x['dropped'] = []
src = src.replace("facts = json.load(open(f'{O}/facts.json'))", "facts = FACTS")
src = src.replace("if d['why'] != 'not read again yet':", "if False:")
g = {'FACTS': facts, '__file__': f'{HERE}/mk_ev2.py'}
exec(compile(src, 'mk_ev2', 'exec'), g)
print(len(g['tasks']), 'notes still flagged')
for t in g['tasks']:
    print(' ', t['passage'], t['note'], t['why'])
