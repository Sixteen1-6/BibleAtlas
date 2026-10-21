#!/usr/bin/env python3
"""fix_quotes_p2.py <out dir>: trim Figures of Speech quotes that joined two separate sections to one section each."""
import json, sys
out = sys.argv[1]
NEW = {
    'John 10:1': '“He that entereth not by the door into the sheepfold” would be מִן תַּרְעָא לְטִירָא ,  min tara letīra .',
    'Romans 12:15': 'In this verse we have two examples of the repetition of the infinitive and participle.',
    '1 Corinthians 9:17': 'For if I do this thing willingly ( ἑκών ,  hekōn ), I have ( ἔχω ,  echō ) a reward.',
}
q = json.load(open(f'{out}/quotes.json'))
n = 0
for x in q:
    if x['source'] == 'bullinger-fos' and x['where'] in NEW and x['quote'] != NEW[x['where']]:
        x['quote'] = NEW[x['where']]; n += 1
json.dump(q, open(f'{out}/quotes.json', 'w'), ensure_ascii=False, indent=1)
print(n, 'quotes trimmed')
