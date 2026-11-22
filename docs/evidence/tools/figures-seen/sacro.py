#!/usr/bin/env python3
"""Tag each kept alphabet poem (acrostic) with the Hebrew word that carries its letter.

Usage: python3 -I sacro.py NN EVIDENCE.json REPO LOGDIR

An acrostic lies in the Hebrew: each verse (or line) begins with the next
letter of the alphabet. The BSB's English cannot show it, so a place marked
"acrostic" with no Strong's tag shows the reader nothing (the words-11 sample,
2026-11-22, failed all 11 such places for that reason). The display shows the
Hebrew line of the verse with the tagged words lit ("In the Hebrew, the marked
words show it"), so each kept acrostic is tagged with the root of its verse's
first main-text Hebrew word, the word whose first letter is the verse's letter.
The marked English words stay the whole verse, the acrostic's unit. Where that
root comes again in the verse the tag would light more than the one word, so
the place is dropped (when in doubt, a place does not go live). Any place the
build would then refuse is dropped too. The evidence record and the drop log
say what happened.
"""
import importlib.util, json, os, sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name):
    spec = importlib.util.spec_from_file_location(name, f'{HERE}/{name}.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


A = load('sapply')
P = load('sspan')
W = A.W
FIN = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'}


def first_word(ref):
    b, c, v1, v2 = W.parse(ref)
    for w in W.verse(b, c, v1)[1]:
        if len(w) > 5 and w[5] & 2:
            continue
        letters = ''.join(ch for ch in unicodedata.normalize('NFD', w[0]) if 'א' <= ch <= 'ת')
        if letters:
            return w, FIN.get(letters[0], letters[0])
    return None, None


def main():
    nn, evp, repo, logdir = sys.argv[1:5]
    nn = nn.zfill(2)
    cdir = f'{repo}/config/figures-seen'
    forms = {f['id']: f for f in json.load(open(f'{repo}/config/figure-forms.json', encoding='utf-8'))['forms']}
    notes = P.notes_in(cdir)
    ev = json.load(open(evp, encoding='utf-8'))
    rec = {p['kept']: p for p in ev['places'] if p['kept']}
    tagged, drops = 0, []
    books = {}
    for nid, (osis, n) in notes.items():
        books.setdefault(osis, []).append(n)
    for nid, (osis, n) in sorted(notes.items()):
        if nid not in rec or n['form'] != 'acrostic':
            continue
        p = rec[nid]
        w, letter = first_word(n['ref'])
        why = None
        if w is None:
            why = 'the verse has no Hebrew word to carry the letter'
        else:
            key = W.lem['key'][w[3]]
            if A.overlit(n['ref'], [key]):
                why = ('its first Hebrew word\'s root comes again in the verse, so a tag would light more than '
                       'the word that carries the letter')
            else:
                new = dict(n)
                new['original'] = [key]
                new['methods'] = sorted(set(n['methods']) | {'orig'})
                bad = A.check(new, forms)
                if bad:
                    why = A.refused(bad)
                else:
                    n.clear()
                    n.update(new)
                    p.setdefault('changed', [])
                    if 'original' not in p['changed']:
                        p['changed'].append('original')
                    p['tagged'] = f'first Hebrew word {w[0]} ({letter})'
                    tagged += 1
        if why:
            books[osis] = [x for x in books[osis] if x['id'] != nid]
            p['kept'] = None
            p['why'] = why
            drops.append({'i': p['i'], 'id': p['id'], 'ref': n['ref'], 'form': n['form'], 'why': why})
    for osis, ns in books.items():
        P.write_book(cdir, osis, ns)
    note = ('An alphabet poem (acrostic) lies in the Hebrew, so each kept acrostic carries the Strong\'s tag of its '
            'verse\'s first Hebrew word, the word that begins with the verse\'s letter, and the display shows that word '
            'lit in the Hebrew line ("tagged"); a place whose first word\'s root comes again in the verse is dropped, '
            'since its tag would light more than that word.')
    if note not in ev['_comment']:
        ev['_comment'].append(note)
    ev['counts']['acrostics tagged'] = tagged
    ev['counts']['acrostics dropped'] = len(drops)
    ev['counts']['kept'] = sum(1 for p in ev['places'] if p['kept'])
    ev['counts']['dropped'] = sum(1 for p in ev['places'] if not p['kept'])
    P.write_evidence(evp, ev)
    with open(f'{logdir}/words-{nn}-drops.jsonl', 'a', encoding='utf-8') as f:
        for d in drops:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print(f'{tagged} acrostics tagged, {len(drops)} dropped; kept now {ev["counts"]["kept"]}')
    for d in drops:
        print('  dropped', d['ref'], d['why'][:90])


if __name__ == '__main__':
    main()
