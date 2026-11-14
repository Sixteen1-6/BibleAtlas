"""cbfix_collect.py RUN...: the Companion Bible notes as copied from StudyLight -> out/cbfix_results.json.
Each piece's parts are joined ("..." parts mark the piece's own omissions) and checked against the pinned
copy's piece, which printed periods for "=" and "a" and abbreviates Bible books."""
import json, sys, re, difflib, os
B = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, B)
O = f'{B}/out'
W = '/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows/'
cs = {c['cid']: c for c in json.load(open(f'{O}/reads/cites.json'))}
BOOKS = set(open(f'{B}/books.txt').read().split())


def toks(s):
    s = re.sub(r'(?i)song of solomon', 'Song', s)
    out = []
    for w in re.findall(r"[a-z0-9']+", s.lower().replace('’', "'")):
        if w.isdigit() or w in BOOKS or w == 'a' or re.fullmatch(r'[a-z]{1,3}\d|\d[a-z]{1,4}', w):
            continue
        out.append(w)
    return out


def find(seg, page, start):
    """index after the best window of page (from start) matching seg, or None"""
    n = len(seg)
    best, at = 0, None
    for i in range(start, max(start, len(page) - n) + 1):
        r = difflib.SequenceMatcher(None, page[i:i + n], seg).ratio()
        if r > best:
            best, at = r, i
    return (at, at + n) if best >= 0.85 else None


out, bad = {}, []
for run in sys.argv[1:]:
    for l in open(W + run + '/journal.jsonl'):
        d = json.loads(l)
        if d.get('type') != 'result' or not d.get('result'):
            continue
        for r in d['result'].get('cites', []):
            c = cs[r['cid']]
            if c['source'] != 'bullinger-cb' or r['status'] != 'found' or not r.get('parts'):
                continue
            pieces = c['quotes'] or c['pieces']
            if len(pieces) == 1 and len(r['parts']) == len(c['pieces']) > 1:
                # the reader gave one group per piece of a quotation whose "..." splits it: join them with that "..."
                r = dict(r, parts=[[x for i, g in enumerate(r['parts']) for x in ((['...'] if i else []) + g)]])
            if len(r['parts']) != len(pieces):
                bad.append((r['cid'], 'piece count', len(r['parts']), len(pieces))); continue
            texts, ok = [], True
            for parts, piece in zip(r['parts'], pieces):
                bits = []
                for p in parts:
                    p = p.strip()
                    if len(p) > 130:
                        ok = False
                    bits.append('...' if p in ('...', '…') else p)
                t = re.sub(r'\s+', ' ', ' '.join(bits)).strip()
                page = toks(t)
                segs = [toks(x) for x in piece.split('...') if toks(x)]
                pos, spans = 0, []
                for sg in segs:
                    f = find(sg, page, pos)
                    if not f:
                        ok = False; break
                    spans.append(f); pos = f[1]
                if not ok or not spans:
                    bad.append((r['cid'], 'not matched', t[:150], piece[:150])); ok = False; break
                # the copied text starts with the first segment and ends with the last
                if spans[0][0] > 2 or len(page) - spans[-1][1] > 2:
                    bad.append((r['cid'], 'extra text', t[:150], piece[:150])); ok = False; break
                texts.append(t)
            if ok:
                out[r['cid']] = {'cid': r['cid'], 'status': 'found', 'quote': ' ... '.join(texts), 'time': r.get('time'), 'found_at': r.get('found_at') or c['link']}
json.dump(list(out.values()), open(f'{O}/cbfix_results.json', 'w'), indent=1, ensure_ascii=False)
need = [c for c in cs.values() if c['source'] == 'bullinger-cb']
print('copied', len(out), 'of', len(need), 'bad', len(bad))
for b in bad:
    print(' ', b)
