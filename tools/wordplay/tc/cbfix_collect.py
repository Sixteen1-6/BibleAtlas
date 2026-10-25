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
                out[r['cid']] = {'cid': r['cid'], 'quote': ' ... '.join(texts), 'time': r.get('time'), 'found_at': r.get('found_at') or c['link']}
TRIM = {
    'c0471': [('Messiah = anointed.', 'were anointed'), ('Messiah is a noun,', 'a priest-king.')],
    'c0765': [('Declare or foretell', 'could do no more.'), ('(2) By Christ,', '"put Him to death"')],
}
for cid, spans in TRIM.items():
    if cid in out:
        q, bits = out[cid]['quote'], []
        for a, b in spans:
            i = q.index(a); j = q.index(b, i) + len(b)
            bits.append(q[i:j])
        out[cid]['quote'] = ' ... '.join(bits)
# Four notes whose StudyLight pages refuse the reader, read in the Internet Archive scan (run wf_0d6124f7-942).
# The scan's own wording, with its OCR slips mended as each remark says.
SCAN = 'read in the Internet Archive scan of the Companion Bible (its StudyLight page refused the reader); the words are the scan\'s, with its OCR slips mended'
MANUAL = {
    'c1233': ('Gr. parthenos, which settles the meaning of the word in Isa. 7. 14.', '2026-10-25T03:55:03Z', 'https://archive.org/details/CompanionBibleOT/Companion%20Bible%20NT/page/n6/mode/1up', 'The OCR has a stray space before the comma.'),
    'c0486': ('shall be, &c. See Ap. 117. II. Quoted from Dan. 12. 1.', '2026-10-25T03:59:50Z', 'https://archive.org/details/CompanionBibleOT/Companion%20Bible%20NT/page/n62/mode/1up', 'The OCR reads "&e." for "&c." and splits "Dan." across two lines.'),
    'c0996': ('Quoted from Ps. 2. 7, which, with Acts 13. 33, tells us that this day was the day of His resurrection.', '2026-10-25T04:00:37Z', 'https://archive.org/details/CompanionBibleOT/Companion%20Bible%20NT/page/n521/mode/1up', None),
    'c1003': ('Quoted from Deut. 32. 43, which in the Sept. reads, \u201cRejoice, ye heavens, together with Him, and let all the angels of God worship Him.', '2026-10-25T04:01:08Z', 'https://archive.org/details/CompanionBibleOT/Companion%20Bible%20NT/page/n521/mode/1up', 'The OCR reads "Sept," for "Sept."; the quotation goes on past "worship Him." on the page.'),
}
for cid, (q, t, u, why) in MANUAL.items():
    out[cid] = {'cid': cid, 'quote': q, 'time': t, 'found_at': u, 'read_how': SCAN, 'mended': why}
json.dump(list(out.values()), open(f'{O}/cbfix_results.json', 'w'), indent=1, ensure_ascii=False)
need = [c for c in cs.values() if c['source'] == 'bullinger-cb']
print('copied', len(out), 'of', len(need), 'bad', len(bad))
for b in bad:
    print(' ', b)
