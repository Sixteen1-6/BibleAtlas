import sqlite3, re, json, sys, html
db = sys.argv[1]; out = sys.argv[2]
con = sqlite3.connect(db)
rows = con.execute('select Book, Chapter, Scripture from Commentary').fetchall()
notes = {}
for b, c, h in rows:
    parts = re.split(r'<vid id="v(\d+)\.(\d+)\.(\d+)"></vid>', h)
    for i in range(1, len(parts), 4):
        key = (int(parts[i]), int(parts[i+1]), int(parts[i+2]))
        text = re.sub(r'<[^>]+>', ' ', parts[i+3])
        text = html.unescape(re.sub(r'\s+', ' ', text)).strip()
        notes.setdefault(key, []).append(text)
hits = []
for k, ts in sorted(notes.items()):
    t = ' '.join(ts)
    if re.search(r'Paronomasia|play on|play upon|pun\b|Antanaclasis|Syllepsis|Paregmenon|Parechesis|Homoeoteleuton|Homoeopropheron|assonance', t, re.I):
        hits.append({'book': k[0], 'chapter': k[1], 'verse': k[2], 'text': t})
json.dump(hits, open(out, 'w'), ensure_ascii=False, indent=0)
print(len(notes), 'notes;', len(hits), 'hits')
import collections
print(collections.Counter(m for h in hits for m in set(re.findall(r'Paronomasia|Antanaclasis|Syllepsis|Paregmenon|Parechesis|Homoeoteleuton|Homoeopropheron|play on|play upon|assonance', h['text'], re.I))))
