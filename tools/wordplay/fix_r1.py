#!/usr/bin/env python3
"""fix_r1.py <out dir>: hand fixes to the returned part-1 passages after their second writers were added."""
import json, sys
out = sys.argv[1]
d = json.load(open(f'{out}/new-passages.json'))
by = {p['id']: p for p in d['passages']}
def L(pid): return by[pid]['layers'][1]

l = L('numbers-22-2')
l['cites'] = [c for c in l['cites'] if c['source'] != 'jfb']  # Balak 'empty' rests on JFB alone and the Pulpit reads 'to make waste'
l['strength'] = 'commonly held'
l['text'] = "Balak's father's name, Zippor, is the Hebrew word for bird. It recalls the names of the Midianite princes Oreb (raven) and Zeeb (wolf), who were also named after creatures."
l['evidence'] = "Barnes gives Zippor as 'Bird' and says it recalls the names of other Midianites, Oreb ('Crow') and Zeeb ('Wolf'). The Pulpit Commentary also says Zippor is a small bird."

l = L('numbers-6-7')
l['cites'] = [c for c in l['cites'] if c['source'] != 'gill']  # Gill only relays the Targum and Aben Ezra here
l['strength'] = 'commonly held'
l['evidence'] = ("Keil and Delitzsch derive Nazir from nazar, to separate, and say the uncut hair is called in this verse the diadem of his God, "
                 "like the golden diadem on the high priest's turban in Exodus 29:6. The Pulpit Commentary makes the same comparison and says "
                 "the diadem is called nezer, from the same root as nazir.")

l = L('psalm-10-18')
l['evidence'] += " The Pulpit Commentary says there is a play upon the two words in the original."

l = L('genesis-31-20')
l['evidence'] += " The Pulpit Commentary calls the two thefts a play upon sound and sense."

l = L('psalm-127-2')
l['strength'] = 'widely agreed'
l['evidence'] += " Poole says 'his beloved' seems to allude to the name Jedidiah, and Ellicott says the words suggested that name."

l = L('proverbs-8-27')
l['evidence'] = ("Both verses say al pnei tehom, on the face of the deep. Poole explains this deep by Genesis 1:2, and Wesley and Benson repeat "
                 "his words. Gill places the verse on the first and second days of creation.")

for p in d['passages']:
    for x in p['layers']:
        assert len(x['text']) <= 300 and len(x.get('evidence', '')) <= 400, (p['id'], len(x['text']), len(x.get('evidence', '')))
json.dump(d, open(f'{out}/new-passages.json', 'w'), ensure_ascii=False, indent=1)
print('fixed', len(d['passages']))
