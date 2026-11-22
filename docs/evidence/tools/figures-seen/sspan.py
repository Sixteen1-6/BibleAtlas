#!/usr/bin/env python3
"""The span re-read of kept parallel-lines places that mark three or more lines.

Usage: python3 -I sspan.py make NN EVIDENCE.json CONFIGDIR OUT.jsonl [lines|figure|form|refrain|beginnings]
       python3 -I sspan.py apply NN RESULT.json SPAN.jsonl EVIDENCE.json REPO LOGDIR [lines|figure|form|refrain|beginnings]

make lists the places of words-NN that the evidence record kept, as they now
stand in CONFIGDIR: in "lines" mode (the default) those whose form is same,
opposite, building or climbing and which mark three or more lines, in "figure"
mode every place of a figure or contrast form (the words that carry it), in
"form" mode every place marked "same" (said twice), whose label is checked
against its lines, in "refrain" mode every refrain, whose words are looked up
where they come back in the book, in "beginnings" mode every place of lines that
begin alike, whose entries must each begin with the same words. apply takes the layers-seen-span result: "all" keeps a
place, "trim" keeps only the lines given (checked as the build checks them,
and without the place's Strong's tags, which were chosen for the lines as they stood),
"form" moves it to the form given (its id follows the form; checked as the build
checks it, and dropped if the build would refuse it or the verse already has that
form), "drop" takes it out of config/figures-seen/; the evidence record and the drop
log say what happened. A place with no answer stops the run.
"""
import glob, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sapply', f'{HERE}/sapply.py')
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)
LINES = ('same', 'opposite', 'building', 'climbing')


def notes_in(cdir):
    out = {}
    for f in sorted(glob.glob(f'{cdir}/*.json')):
        for n in json.load(open(f, encoding='utf-8'))['notes']:
            out[n['id']] = (os.path.basename(f)[:-5], n)
    return out


def write_book(cdir, osis, notes):
    path = f'{cdir}/{osis}.json'
    if not notes:
        os.remove(path)
        return
    notes.sort(key=A.order_key)
    body = ',\n'.join('    ' + json.dumps(n, ensure_ascii=False) for n in notes)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('{\n  "notes": [\n' + body + '\n  ]\n}\n')


def write_evidence(path, doc):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in doc.items() if k != 'places'))
        f.write(',\n  "places": [\n' + ',\n'.join('    ' + json.dumps(p, ensure_ascii=False) for p in doc['places']) + '\n  ]\n}\n')


def make(nn, evp, cdir, out, mode='lines'):
    ev = json.load(open(evp, encoding='utf-8'))
    notes = notes_in(cdir)
    n = 0
    with open(out, 'w', encoding='utf-8') as f:
        for p in ev['places']:
            if not p['kept']:
                continue
            x = notes[p['kept']][1]
            kind = A_FORMS[x['form']]['kind']
            if (mode == 'lines' and x['form'] in LINES and len(x['words']) >= 3) or (mode == 'figure' and kind in ('figure', 'contrast')) \
                    or (mode == 'form' and x['form'] == 'same') or (mode == 'refrain' and x['form'] == 'refrain') \
                    or (mode == 'beginnings' and x['form'] == 'beginnings'):
                f.write(json.dumps(x, ensure_ascii=False) + '\n')
                n += 1
    print(n, 'places to re-read')


A_FORMS = A.W.forms


def apply(nn, resp, spanp, evp, repo, logdir, mode='lines'):
    tag = {'lines': 'span', 'figure': 'words', 'form': 'label', 'refrain': 'refrain', 'beginnings': 'beginnings'}[mode]
    cdir = f'{repo}/config/figures-seen'
    forms = {f['id']: f for f in json.load(open(f'{repo}/config/figure-forms.json', encoding='utf-8'))['forms']}
    res = json.load(open(resp, encoding='utf-8'))
    res = res.get('result', res)
    rows = [json.loads(l) for l in open(spanp, encoding='utf-8')]
    verdict = {}
    for b in res['results']:
        for i, v in b['verdict'].items():
            verdict[int(i)] = v
    missing = [i for i in range(len(rows)) if i not in verdict]
    if missing:
        sys.exit(f'no answer for span places {missing}')
    notes = notes_in(cdir)
    ev = json.load(open(evp, encoding='utf-8'))
    rec = {p['kept']: p for p in ev['places'] if p['kept']}
    books = {}
    for _id, (osis, n) in notes.items():
        books.setdefault(osis, {})[_id] = n
    counts = {'all': 0, 'trim': 0, 'form': 0, 'drop': 0, 'trim refused': 0, 'form refused': 0}
    drops = []
    for i, r in enumerate(rows):
        v = verdict[i]
        osis, n = notes[r['id']]
        p = rec[r['id']]
        p[tag] = v['verdict']
        if v['verdict'] == 'all':
            counts['all'] += 1
            if v.get('strip_original') and n.get('original'):
                n.pop('original')
                p['changed'] = sorted(set(p.get('changed', [])) | {'original'})
                counts['tags dropped'] = counts.get('tags dropped', 0) + 1
            continue
        why = None
        if v['verdict'] == 'trim':
            words = v.get('words') or []
            t = dict(n, words=words)
            least = 2 if mode in ('lines', 'beginnings') else 1
            why = A.check(t, forms) if len(words) >= least and words != n['words'] else 'trim gave nothing new to mark'
            if why is None:
                n['words'] = words
                # the tags were chosen for the lines as they stood; they go with the cut
                ch = {'words'}
                if n.pop('original', None):
                    ch.add('original')
                p['changed'] = sorted(set(p.get('changed', [])) | ch)
                p[f'{tag}_why'] = v.get('reason', '')
                counts['trim'] += 1
                continue
            counts['trim refused'] += 1
            why = f'{tag} trim refused: {why}'
        elif v['verdict'] == 'form':
            f = v.get('form') or ''
            new_id = A.id_for(n['ref'], f)
            t = dict(n, form=f, id=new_id)
            why = A.check(t, forms) if f in LINES + ('turns', 'mirror') else f'form {f} is not a parallel form'
            if why is None and new_id in notes and new_id != r['id']:
                why = f'the verse already has {new_id}'
            if why is None:
                del books[osis][r['id']]
                books[osis][new_id] = t
                notes[new_id] = (osis, t)
                p['kept'] = new_id
                p['changed'] = sorted(set(p.get('changed', [])) | {'form'})
                p[f'{tag}_why'] = v.get('reason', '')
                rec[new_id] = p
                counts['form'] += 1
                continue
            counts['form refused'] += 1
            why = f'{tag} form change refused: {why}'
        else:
            counts['drop'] += 1
            why = f'dropped on the {tag} re-read'
        del books[osis][r['id']]
        p['kept'] = None
        p['why'] = v.get('reason', '') or why
        p.pop('changed', None)
        drops.append({'i': p['i'], 'id': p['id'], 'ref': r['ref'], 'form': r['form'], 'why': why, 'reasons': [v.get('reason', '')]})
    for osis, ns in books.items():
        write_book(cdir, osis, list(ns.values()))
    # a second re-read of the same kind (a few places, after a later fix) adds to the first
    ev['counts'][f'{tag} re-read'] = ev['counts'].get(f'{tag} re-read', 0) + len(rows)
    for k, x in counts.items():
        ev['counts'][f'{tag} {k}'] = ev['counts'].get(f'{tag} {k}', 0) + x
    ev['counts']['kept'] = sum(1 for p in ev['places'] if p['kept'])
    ev['counts']['dropped'] = sum(1 for p in ev['places'] if not p['kept'])
    note = {'lines': 'Then every kept place that marks three or more poetry lines as said twice, opposite, building or climbing was read again by two readers, a third settling any difference: each kept all its lines, kept only the lines that stand in the relation, or was dropped ("span").',
            'figure': 'Then kept figures of speech were read again by two readers, a third settling any difference ("words re-read" counts them: those a sample showed at risk, such as wide spans, or those found only in the Hebrew or Greek that carry no tags): each kept as it was, cut to the words that carry the figure, or dropped ("words").',
            'form': 'Then every kept place marked as said twice was read again by two readers, a third settling any difference: each kept, moved to the form its lines plainly show (a judge\'s form only where a reader proposed it), or dropped ("label").',
            'beginnings': 'Then every kept place marked as lines that begin alike was read again by two readers, a third settling any difference: each kept, cut to the entries that begin with the same words (two or more, in its own verses), or dropped where only one of its lines begins with them or the shared beginning is only a joining word ("beginnings").',
            'refrain': 'Then every kept refrain was read again by two readers, a third settling any difference, each looking up the other verses of the book where its words come back: each kept, cut to the words of the verse that come back, or dropped ("refrain").'}[mode]
    if note not in ev['_comment']:
        # in the order the re-reads were done, before the last check's sample
        last = next((k for k, c in enumerate(ev['_comment']) if c.startswith('Last, a sample')), len(ev['_comment']))
        ev['_comment'].insert(last, note)
    write_evidence(evp, ev)
    with open(f'{logdir}/words-{nn}-drops.jsonl', 'a', encoding='utf-8') as f:
        for d in drops:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print(json.dumps(counts), 'kept now', ev['counts']['kept'])


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'make':
        make(a[1].zfill(2), *a[2:6])
    elif a[0] == 'apply':
        apply(a[1].zfill(2), *a[2:8])
