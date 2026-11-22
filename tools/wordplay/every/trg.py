#!/usr/bin/env python3
"""trg.py: the triage before writing (triage.js): which candidates' figures the BSB has translated away.

  trg.py items <NN> [from] [--offset K]   prints the candidates of hNN/batches.json from batch <from> on, as
                                          triage.js items {n, ref, form, bsb, lead, words} (n + K when an offset
                                          is given, to run two hand-offs in one triage)
  trg.py apply <NN> <verdicts.json> <from> <new>   writes every/h<new>/batches.json: the candidates of hNN from
                                          batch <from> on, less those marked "lost", in batches of 8 keyed h<new>-KK;
                                          the ones left out go to hNN/skipped-bsb.json with the reader's reason
  trg.py score <NN> <verdicts.json> [--offset K]   compares the verdicts with what the writers did on batches
                                          already written: a "lost" whose candidate became a note is a wrong "lost"
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.dirname(HERE)
sys.path[:0] = [f'{W}/fig', W, f'{W}/w3']
import figcheck as fc

R = '/root/.claude/projects/-home-claude/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows'


def bsb(ref):
    try:
        a, b = fc.resolve(ref)
    except Exception:
        return ''
    return ' '.join(fc.verse_text(i) for i in range(a, min(b, a + 3) + 1))


def items(nn, frm=0, off=0):
    out = []
    for b in json.load(open(f'{HERE}/h{nn}/batches.json'))[frm:]:
        for c in b['cands']:
            bl = c.get('bullinger') or []
            out.append({'n': c['n'] + off, 'ref': c['ref'], 'form': c['form'], 'bsb': bsb(c['ref']),
                        'lead': ' | '.join(x.get('lead', '') for x in bl)[:300],
                        'words': ' | '.join(x.get('words', '') for x in bl)[:600],
                        'others': [q.get('quote', '')[:200] for q in c.get('quotes', [])][:2]})
    return out


def verdicts(p, off=0):
    d = json.load(open(p))
    d = d.get('result', d)
    return {v['n'] - off: v for v in d['verdicts'] if v['n'] >= off}


if __name__ == '__main__':
    a = sys.argv[1:]
    off = 0
    if '--offset' in a:
        i = a.index('--offset')
        off = int(a[i + 1])
        del a[i:i + 2]
    if a[0] == 'items':
        its = items(a[1], int(a[2]) if len(a) > 2 else 0, off)
        print(json.dumps(its, ensure_ascii=False))
    elif a[0] == 'apply':
        nn, vp, frm, new = a[1], a[2], int(a[3]), a[4]
        v = verdicts(vp, off)
        keep, skip = [], []
        for b in json.load(open(f'{HERE}/h{nn}/batches.json'))[frm:]:
            for c in b['cands']:
                x = v.get(c['n'])
                if x and x['verdict'] == 'lost':
                    skip.append({'n': c['n'], 'ref': c['ref'], 'form': c['form'], 'bsb_words': x['bsb_words'], 'reason': x['reason']})
                else:
                    keep.append(c)
        os.makedirs(f'{HERE}/h{new}', exist_ok=True)
        bs = [{'key': f'h{new}-{i // 8:02d}', 'cands': keep[i:i + 8]} for i in range(0, len(keep), 8)]
        json.dump(bs, open(f'{HERE}/h{new}/batches.json', 'w'), ensure_ascii=False, indent=1)
        sp = f'{HERE}/h{nn}/skipped-bsb.json'
        old = json.load(open(sp)) if os.path.exists(sp) else []
        json.dump(old + skip, open(sp, 'w'), ensure_ascii=False, indent=1)
        print(f'{len(keep)} kept in {len(bs)} batches (h{new}); {len(skip)} set aside as lost in the BSB')
    elif a[0] == 'score':
        import figpost
        nn, vp = a[1], a[2]
        v = verdicts(vp, off)
        res = figpost.journal_results([f'{R}/{r}/journal.jsonl' for r in json.load(open(f'{HERE}/h{nn}/runs.json'))])
        tally = {}
        wrong = []
        for b in json.load(open(f'{HERE}/h{nn}/batches.json')):
            w = res.get(f'write:{b["key"]}')
            if not w:
                continue
            made = {x.get('n') for x in w.get('notes', [])}
            dropped = {x.get('n'): x.get('reason', '') for x in w.get('dropped', [])}
            for c in b['cands']:
                x = v.get(c['n'])
                if not x:
                    continue
                outcome = 'note' if c['n'] in made else ('dropped' if c['n'] in dropped else 'none')
                tally[(x['verdict'], outcome)] = tally.get((x['verdict'], outcome), 0) + 1
                if x['verdict'] == 'lost' and outcome == 'note':
                    wrong.append({'n': c['n'], 'ref': c['ref'], 'triage': x['reason']})
        for k in sorted(tally):
            print(k, tally[k])
        print(json.dumps(wrong, ensure_ascii=False, indent=1))
