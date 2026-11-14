#!/usr/bin/env python3
"""apply_held.py <combined.json> [--dry]: apply the held review's agreed fixes to lwh's config/layers.json and the held reads file.
(apply.py from the Layers round 3 re-check, pointed at the held passages: one reads file, new reads appended to it.)

Ops come from the skeptics' verdicts (confirm or amend, never refute): round 1 (the reviewer's findings) first, then
round 2 (the critic's). Every index (note_index, cite_index, rec) is show.py's numbering, before any fix.
A record whose quote was re-read on the web moves to a new reads file dated the day it was read; a quote confirmed
only in a pinned local copy stays in its record with a remark saying so."""
import json, os, re, sys
from collections import defaultdict

SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, f'{SP}/wp/tc2')
import layersfmt  # noqa: E402

REPO = f'{SP}/lwh'
LAYERS = f'{REPO}/config/layers.json'
HELD = 'layers-reads-wordplay-held-2026-11-07.json'
FILES = {HELD: f'{REPO}/docs/evidence/{HELD}'}
DASH = re.compile('[\u2014\u2013]')
NEVER = ('pulpit', 'net-notes', 'reformation-sb', 'gospel-coalition', 'themelios', 'leithart', 'ligonier', 'keener')


def load_ops(res):
    """-> {(passage, note): [op, ...]} in order, plus a log of what was refuted."""
    ops, log = defaultdict(list), []
    for b in res['results']:
        for key in ('verdicts', 'verdicts2'):
            for v in b.get(key) or []:
                k = (v['passage'], v['note_index'])
                if v['verdict'] == 'refute':
                    log.append(('refuted', key, k, v['reason'][:160]))
                    continue
                for o in v['ops']:
                    ops[k].append(dict(o, _round=key))
    return ops, log


def main():
    res = json.load(open(sys.argv[1]))
    dry = '--dry' in sys.argv
    raw = open(LAYERS, encoding='utf-8').read()
    L = json.loads(raw)
    assert layersfmt.dumps(L) == raw
    P = {p['id']: p for p in L['passages']}
    files, fmt = {}, {}
    for n, f in FILES.items():
        t = open(f, encoding='utf-8').read()
        files[n] = json.loads(t)
        fmt[n] = next((ind, nl) for ind in (2, 1, 4) for nl in ('\n', '') if json.dumps(files[n], indent=ind, ensure_ascii=False) + nl == t)
    # show.py numbers the held reads file's records from 0
    recs = [dict(r, _i=i) for i, r in enumerate(files[HELD]['records'])]
    pos = {i: r for i, r in enumerate(files[HELD]['records'])}
    newrecs, report, problems = [], [], []
    drop_rec = set()
    ops, log = load_ops(res)
    drop_notes = defaultdict(set)
    drop_passages = set()

    def recs_of(pid, ni, src=None, on=None):
        return [r['_i'] for r in recs if r['passage'] == pid and r['note'] == ni and (src is None or (r['source'] == src and r['on'] == on))]

    for (pid, ni), os_ in ops.items():
        if pid not in P:
            problems.append(f'{pid}: no such passage')
            continue
        note = P[pid]['layers'][ni]
        cites0 = list(note.get('cites', []))
        drops, adds = set(), []
        for o in os_:
            t = o['type']
            if t == 'set_field':
                f, v = o['field'], o.get('value', '')
                if f in ('refs', 'words'):
                    v = json.loads(v)
                if f in ('text', 'evidence') and DASH.search(v):
                    problems.append(f'{pid}#{ni} {f}: em dash in new value')
                if f == 'text' and len(v) > 300 or f == 'evidence' and len(v) > 400:
                    problems.append(f'{pid}#{ni} {f}: {len(v)} characters')
                if f == 'kind':
                    for i in recs_of(pid, ni):
                        pos[i]['kind'] = v
                note[f] = v
                report.append(f'{pid}#{ni} set {f}')
            elif t == 'cite_counts_false':
                cites0[o['cite_index']]['counts'] = False
                report.append(f'{pid}#{ni} cite {o["cite_index"]} counts false')
            elif t == 'drop_cite':
                drops.add(o['cite_index'])
            elif t == 'add_cite':
                c = json.loads(o['cite_json'])
                r = json.loads(o['record_json'])
                adds.append((c, r))
            elif t == 'set_record_quote':
                i = o['rec']
                r = pos[i]
                if (r['passage'], r['note']) != (pid, ni):
                    problems.append(f'{pid}#{ni}: rec {i} belongs to {r["passage"]}#{r["note"]}')
                    continue
                q = o['quote'].strip()
                rt = (o.get('read_time') or '').strip()
                where = (o.get('confirmed_on') or '').strip()
                if r['source'] in NEVER:
                    r['pointer'] = q
                    r.pop('quote', None)
                else:
                    r['quote'] = q
                    r.pop('pointer', None)
                if rt:
                    nr = dict(r)
                    nr['fetched'], nr['time'] = rt[:10], rt
                    nr['status'] = 'added'
                    nr['read_for'] = 'held passages review (Wordplay thread, 2026-11-07): the quotation was changed to the words the cite rests on'
                    nr['read_how'] = 'read again on this page, where each part of the quotation was found'
                    if where and where.rstrip('/') != r['url'].rstrip('/'):
                        nr['remark'] = f'Read on Bible Hub\'s page for the verse, {where}, which prints the same commentary text as the chapter page the cite links.'
                    else:
                        nr.pop('remark', None)
                    nr.pop('decided', None) if 'decided' not in r else None
                    newrecs.append(nr)
                    drop_rec.add(i)
                else:
                    day = '2026-11-07'
                    r['remark'] = ((r.get('remark', '') + ' ') if r.get('remark') else '') + \
                        f'On {day} the quotation was changed to these words, found in the pinned copy of the same text ({where or "local copy"}); this page was not read again for them.'
                report.append(f'{pid}#{ni} rec {i} quote ({"web " + rt if rt else "local"})')
            elif t == 'drop_note':
                drop_notes[pid].add(ni)
            elif t == 'drop_passage':
                drop_passages.add(pid)
            else:
                problems.append(f'{pid}#{ni}: unknown op {t}')
        if drops:
            for ci in sorted(drops, reverse=True):
                c = cites0[ci]
                for i in recs_of(pid, ni, c['source'], c['on']):
                    drop_rec.add(i)
                report.append(f'{pid}#{ni} drop cite {ci} ({c["source"]} on {c["on"]})')
            cites0 = [c for k, c in enumerate(cites0) if k not in drops]
        for c, r in adds:
            cites0.append(c)
            nr = {'passage': pid, 'note': ni, 'kind': note['kind'], 'source': c['source'], 'on': c['on']}
            if c.get('at'):
                nr['at'] = c['at']
            nr.update(url=r['url'], fetched=r['time'][:10], time=r['time'], status='added',
                      read_for='held passages review (Wordplay thread, 2026-11-07): a second writer for the note',
                      read_how='read on this page, where each part of the quotation was found', verdict='respects')
            nr['pointer' if c['source'] in NEVER else 'quote'] = r.get('quote') or r.get('pointer')
            newrecs.append(nr)
            report.append(f'{pid}#{ni} add cite {c["source"]} on {c["on"]}')
        if 'cites' in note:
            note['cites'] = cites0
    # notes and passages
    for pid, nis in drop_notes.items():
        if pid in drop_passages:
            continue
        p = P[pid]
        for ni in sorted(nis, reverse=True):
            for r in recs:
                if r['passage'] == pid and r['note'] == ni:
                    drop_rec.add(r['_i'])
            del p['layers'][ni]
            for r in recs:
                if r['passage'] == pid and r['note'] > ni and r['_i'] not in drop_rec:
                    pos[r['_i']]['note'] -= 1
            for r in newrecs:
                if r['passage'] == pid and r['note'] > ni:
                    r['note'] -= 1
            report.append(f'{pid}#{ni} dropped')
    for pid in drop_passages:
        L['passages'] = [p for p in L['passages'] if p['id'] != pid]
        for r in recs:
            if r['passage'] == pid:
                drop_rec.add(r['_i'])
        newrecs = [r for r in newrecs if r['passage'] != pid]
        report.append(f'{pid} dropped (passage)')
    drop_obj = {id(pos[i]) for i in drop_rec}
    for n, d in files.items():
        d['records'] = [r for r in d['records'] if id(r) not in drop_obj]
    print(f'{sum(len(v) for v in ops.values())} ops on {len(ops)} notes; {len(drop_rec)} records dropped or moved; '
          f'{len(newrecs)} new records; {len(log)} findings refuted')
    for p in problems:
        print('PROBLEM', p)
    json.dump({'report': report, 'refuted': log, 'problems': problems}, open(f'{SP}/rvh/applied.json', 'w'), indent=1)
    if dry:
        return
    open(LAYERS, 'w', encoding='utf-8').write(layersfmt.dumps(L))
    d = files[HELD]
    d['records'].extend(newrecs)
    days = sorted(r['fetched'] for r in d['records'])
    d['from'], d['to'] = days[0], days[-1]
    open(FILES[HELD], 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    main()
