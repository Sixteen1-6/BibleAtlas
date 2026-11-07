"""Sentences where a writer ties an Old Testament passage to a New Testament one with a prophecy word."""
import json, re, sys, collections
sys.path.insert(0, '/tmp/mine/scripts')
from bible import is_nt, ref
from notes import all_notes

WORD = re.compile(r'\b(fulfil\w*|prophec\w*|prophesi\w*|prophesy\w*|prophetical\w*|foretold|foretel\w*|predict\w*|foreshew\w*|foreshow\w*)', re.I)
ABBR = re.compile(r'(\b(?:v|vv|ver|ch|chap|cp|viz|i\.e|e\.g|St|Mr|Dr|cf|comp|ibid|Is|Isa|Ps|Gen|Exod|Deut|Matt|Rom|Heb|Jer|Ezek|Dan|Zech|Mal|Mic|Hos|Lev|Num|Josh|Judg|Sam|Kings|Chron|Neh|Prov|Eccl|Cant|Lam|Obad|Hab|Zeph|Hag|Cor|Gal|Eph|Phil|Col|Thess|Tim|Tit|Pet|Rev|Jo|Lu|Mar|Ac|a\.d|b\.c|[ivxlc]+|\d+)\.)$', re.I)


def sentences(text):
    out = []; start = 0
    for m in re.finditer(r'[.?!](?=["”’)]*\s)', text):
        i = m.end()
        if ABBR.search(text[max(0, i - 12):i]):
            continue
        out.append((start, i)); start = i
    out.append((start, len(text)))
    # paragraph breaks split too
    res = []
    for a, b in out:
        s = a
        for m in re.finditer(r'\n\s*\n', text[a:b]):
            res.append((s, a + m.start())); s = a + m.end()
        res.append((s, b))
    return [(a, b) for a, b in res if text[a:b].strip()]


def run():
    ev = []
    for n in all_notes():
        here_nt = is_nt(n['f'])
        sents = sentences(n['text'])
        for (a, z, s, e) in n['links']:
            if is_nt(a) == here_nt:
                continue
            if z - a > 40:
                continue
            for (p, q) in sents:
                if p <= s < q:
                    sent = n['text'][p:q].strip()
                    if WORD.search(sent):
                        ot = (a, z) if here_nt else (n['f'], n['t'])
                        nt = (n['f'], n['t']) if here_nt else (a, z)
                        ev.append(dict(work=n['work'], who=n['who'], ot=ot, nt=nt, on=(n['f'], n['t']), side='nt' if here_nt else 'ot',
                                       quote=re.sub(r'\s+', ' ', sent)))
                    break
    return ev


if __name__ == '__main__':
    ev = run()
    json.dump(ev, open('/tmp/mine/evidence.json', 'w'))
    print(len(ev), collections.Counter(e['work'] for e in ev))
