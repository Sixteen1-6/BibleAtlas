# Batches for copying the Companion Bible notes word for word from StudyLight.
import json, os, collections
B = os.path.dirname(os.path.abspath(__file__))
O = f'{B}/out'
cs = json.load(open(f'{O}/reads/cites.json'))
res = {x['cid']: x for x in json.load(open(f'{O}/reads_results.json'))}
pages = collections.OrderedDict()
for c in cs:
    if c['source'] != 'bullinger-cb':
        continue
    r = res.get(c['cid'], {})
    url = r.get('found_at') if r.get('status') == 'found' else c['link']
    url = url or c['link']
    pages.setdefault(url, {'url': url, 'cites': []})['cites'].append(
        {'cid': c['cid'], 'on': c['on'], 'verse': c.get('verse'), 'pieces': c['quotes'] or c['pieces']})
items = list(pages.values())
os.makedirs(f'{O}/cbfix', exist_ok=True)
for f in os.listdir(f'{O}/cbfix'):
    os.remove(f'{O}/cbfix/{f}')
n = 0
for i in range(0, len(items), 6):
    json.dump(items[i:i+6], open(f'{O}/cbfix/cb_{i//6:02d}.json', 'w'), ensure_ascii=False, indent=1); n += 1
print('pages', len(items), 'cites', sum(len(p['cites']) for p in items), 'files', n)
