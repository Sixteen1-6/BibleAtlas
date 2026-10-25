# Find the places in Companion Bible quotations where the UniqueBible copy put a period
# for "=", "a" or "A", and build multiple-choice questions to settle each on StudyLight.
import json, re, os, collections
B = os.path.dirname(os.path.abspath(__file__))
O = f'{B}/out'
cs = json.load(open(f'{O}/reads/cites.json'))
res = {x['cid']: x for x in json.load(open(f'{O}/reads_results.json'))}
KEEP = {'Hebrew', 'Greek', 'Aramaic', 'Chaldee', 'Syriac', 'Latin', 'App', 'Compare', 'i.e', 'e.g', 'etc', 'occ', 'ref', 'Ref', 'cp', 'Cp', 'Sept', 'Septuagint', 'Vulg', 'ver', 'vv', 'Figure', 'speech'}
spots_by_page = collections.OrderedDict()
n = 0
for c in cs:
    if c['source'] != 'bullinger-cb':
        continue
    for qi, q in enumerate(c['quotes']):
        for m in re.finditer(r'(\S+)( \. |\.\. |\. )(\S+)', q):
            before, mid, after = m.group(1), m.group(2), m.group(3)
            if mid == '. ':
                w = before.rstrip(',;:')
                if before.endswith('.') or w in KEEP or not after[:1].islower() and not after[:1] in '"(':
                    continue
                if re.fullmatch(r'[A-Z][a-z]{1,3}', w) or w.isdigit() or re.search(r'\d', w):
                    continue
                opts = [f'{before}. {after}', f'{before} a {after}', f'{before} = {after}']
            elif mid == ' . ':
                opts = [f'{before} = {after}', f'{before} . {after}', f'{before} a {after}']
            else:  # '.. '
                opts = [f'{before}. A {after}', f'{before}.. {after}', f'{before}. a {after}']
            n += 1
            url = (res.get(c['cid']) or {}).get('found_at') or c['link']
            spots_by_page.setdefault(url, []).append({'sid': f"{c['cid']}-{qi}-{m.start()}", 'cid': c['cid'], 'quote_index': qi, 'start': m.start(), 'end': m.end(), 'as_copied': m.group(0), 'options': opts, 'verse': c.get('verse'), 'on': c['on']})
print('spots', n, 'pages', len(spots_by_page))
items = [{'url': u, 'spots': s} for u, s in spots_by_page.items()]
os.makedirs(f'{O}/cbfix', exist_ok=True)
for i in range(0, len(items), 8):
    json.dump(items[i:i+8], open(f'{O}/cbfix/cb_{i//8:02d}.json', 'w'), ensure_ascii=False, indent=1)
print(sorted(os.listdir(f'{O}/cbfix')))
for it in items[:6]:
    for s in it['spots']:
        print(s['sid'], s['options'])
