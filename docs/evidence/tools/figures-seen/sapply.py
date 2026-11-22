#!/usr/bin/env python3
"""Apply the reading of one words-NN file to config/figures-seen/.

Usage: python3 -I sapply.py NN RESULT.json CHECKED REPO LOGDIR [RUN] [ROWS.jsonl]

RESULT.json is the layers-seen-read workflow's return value ({nn, results,
incomplete}). A place is kept when both readers passed it (clean), or when the
judge kept it; a judge's new form stands only when a reader proposed it. Every
kept place is checked here the way the build checks it (form live, words the
BSB's own text, parallel lines in the BSB's poetry, tags the roots of words in
the verse), and a place that fails is dropped with the reason logged. Places
not read (an incomplete batch, a missing judgement) are held, not applied.

Writes config/figures-seen/<OSIS>.json in REPO (merging with what is there) and,
in LOGDIR, words-NN-drops.jsonl and words-NN-summary.json, and the record of
how each place was settled, docs/evidence/figures-seen/words-NN.json in REPO
(RUN names the reading run). ROWS is the file the readers read when spre.py
ran first (each place carries i0, its place in the hand-off); the places it
refused, in ROWS-refused.jsonl, are recorded as dropped before reading.
"""
import collections, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('wshow', f'{HERE}/wshow.py')
W = importlib.util.module_from_spec(spec)
spec.loader.exec_module(W)
WORK = W.WORK
LINE_FORMS = {'same', 'opposite', 'building', 'climbing'}
METHODS = {'bsb', 'orig', 'list', 'bullinger'}


def id_for(ref, form):
    first = re.sub(r'(:\d+)-\d+$', r'\1', ref.strip())
    slug = re.sub(r'[^a-z0-9]+', '-', first.lower()).strip('-')
    return f'{slug}-{form}-seen'


def tag_ok(t):
    return re.fullmatch(r'[HG]\d{4}[A-Za-z]?', t) is not None


def lemma_matches(key, tag):
    return key == tag or (len(key) == len(tag) + 1 and key.startswith(tag) and key[-1].isalpha())


def utf16(s):
    return len(s.encode('utf-16-le')) // 2


def line_spans(b, c, v, t):
    """The BSB's poetry lines of a verse as (start, end) UTF-16 offsets, or []."""
    marks = W.text(b).get('lines', {}).get(f'{c}.{v}')
    if not marks:
        return []
    offs = [m[0] for m in marks] + [utf16(t)]
    return [(offs[k], offs[k + 1]) for k in range(len(marks))]


STRAY = ',.;:!?—–-”’)]'


def ref_name(b, c, v1, v2):
    """A reference as the app writes it: the book's name ("Psalm" for one psalm)."""
    name = 'Psalm' if b['osis'] == 'Ps' else b['name']
    return f'{name} {c}:{v1}' + (f'-{v2}' if v2 > v1 else '')


def whole_words(t, at, n):
    return not (at > 0 and t[at - 1].isalnum()) and not (at + n < len(t) and t[at + n].isalnum())


def comes_back(b, c, v1, v2, w):
    """A refrain's one line comes back: in two verses of the place, or in another verse of the book."""
    holds = [v for v in range(v1, v2 + 1) if w in W.verse(b, c, v)[0]]
    if len(holds) >= 2:
        return True
    for cc, n in enumerate(b['chapters'], 1):
        for vv in range(1, n + 1):
            if not (cc == c and v1 <= vv <= v2) and w in W.verse(b, cc, vv)[0]:
                return True
    return False


def all_poetry(b, c, v, t, s, e):
    """Every word of t[s:e] (UTF-16 offsets) is in a poetry line (no prose, no title)."""
    marks = W.text(b).get('lines', {}).get(f'{c}.{v}')
    if not marks:
        return False
    offs = [m[0] for m in marks] + [utf16(t)]
    return not any((m[1] & 7) in (4, 5) and offs[k] < e and s < offs[k + 1] for k, m in enumerate(marks))


def tidy(ref, words):
    """The words with overlapping entries joined. The display marks each entry where
    it first occurs in each verse and runs overlapping marks together, so an entry
    lying wholly inside another ("Aha" inside "Aha, aha") is taken out, and two that
    overlap in the one verse that holds them become the words they cover together.
    The place marks the same words either way."""
    b, c, v1, v2 = W.parse(ref)
    texts = {v: W.verse(b, c, v)[0] for v in range(v1, v2 + 1)}
    words = list(words)
    def spots(w):
        return {v: (t.find(w), t.find(w) + len(w)) for v, t in texts.items() if w and w in t}
    while True:
        done = True
        for k, w in enumerate(words):
            for j, o in enumerate(words):
                if j == k:
                    continue
                sw, so = spots(w), spots(o)
                if not any(v in so and sw[v][0] < so[v][1] and so[v][0] < sw[v][1] for v in sw):
                    continue
                if all(v in so and so[v][0] <= sw[v][0] and sw[v][1] <= so[v][1] for v in sw):
                    del words[k]
                elif len(sw) == 1 and list(sw) == list(so):
                    v = next(iter(sw))
                    a, z = min(sw[v][0], so[v][0]), max(sw[v][1], so[v][1])
                    words[j] = texts[v][a:z]
                    del words[k]
                else:
                    continue
                done = False
                break
            if not done:
                break
        if done:
            return words


def refused(why):
    """The reason a place is dropped on a check: the build's own, or the label rule the
    build does not hold (a "And, and, and" place must say "and" twice)."""
    return why if why.startswith('the label') else f'build would refuse: {why}'


def check(r, forms):
    """Why the build would refuse this place (or its label does not fit), or None."""
    f = forms.get(r['form'])
    if not f:
        return f'form {r["form"]} is not live'
    p = W.parse(r['ref'])
    if not p:
        return 'reference does not parse'
    b, c, v1, v2 = p
    verses = {v: W.verse(b, c, v) for v in range(v1, v2 + 1)}
    if any(x is None for x in verses.values()):
        return 'a verse of the reference does not exist'
    if r['ref'] != ref_name(b, c, v1, v2):
        return f'ref must be written {ref_name(b, c, v1, v2)}'
    if not r['words'] or len(set(r['words'])) != len(r['words']):
        return 'words empty or repeated'
    if not r['methods'] or not set(r['methods']) <= METHODS:
        return 'methods'
    where = []
    spans = {}
    for k, w in enumerate(r['words']):
        if w[:1].isspace() or w[:1] in STRAY:
            return f'"{w}" starts with a space or stray punctuation'
        hits = [v for v in verses if w.strip() and w in verses[v][0]]
        if not hits:
            return f'"{w}" is not in the verse'
        for v in hits:
            t = verses[v][0]
            at = t.index(w)
            if not whole_words(t, at, len(w)):
                return f'"{w}" starts or ends inside a word'
            spans.setdefault(v, []).append((at, at + len(w), k))
            where.append((v, w))
    for v, sp in spans.items():
        sp.sort()
        for x, y in zip(sp, sp[1:]):
            if y[0] < x[1]:
                return f'words[{x[2]}] and words[{y[2]}] overlap'
    if v1 not in spans or v2 not in spans:
        return 'the words must begin in the first verse and end in the last'
    if f['kind'] == 'parallelism':
        least = 4 if r['form'] in ('mirror', 'turns') else 2
        if r['form'] == 'refrain' and len(r['words']) == 1 and comes_back(b, c, v1, v2, r['words'][0]):
            least = 1
        if r['form'] == 'frame' and len(r['words']) == 1 and v2 > v1 and v1 in spans and v2 in spans:
            least = 1
        if len(r['words']) < least:
            return f'{r["form"]} needs {least} or more lines'
        used = []
        for v, w in where:
            t = verses[v][0]
            spans_ = line_spans(b, c, v, t)
            if not spans_:
                if r['form'] in LINE_FORMS:
                    return f'{r["ref"]} is not set as poetry'
                continue
            s = utf16(t[:t.index(w)])
            e = s + utf16(w)
            # leading and trailing spaces do not count
            lead = len(w) - len(w.lstrip())
            trail = len(w) - len(w.rstrip())
            s += lead
            e -= trail
            if r['form'] in LINE_FORMS and not all_poetry(b, c, v, t, s, e):
                return f'"{w}" is not all in the BSB\'s poetry lines'
            first = next(k for k, (a, z) in enumerate(spans_) if z > s)
            last = max(k for k, (a, z) in enumerate(spans_) if a < e)
            if first != last:
                whole = abs(spans_[first][0] - s) <= 1 and abs(spans_[last][1] - e) <= 2
                if not whole:
                    return f'"{w}" runs across the BSB\'s own lines'
            used.append((v, first, last))
        if r['form'] in LINE_FORMS:
            for i in range(len(used)):
                for j in range(i + 1, len(used)):
                    a, bb = used[i], used[j]
                    if a[0] == bb[0] and a[1] <= bb[2] and bb[1] <= a[2]:
                        return 'two marked lines are in one line of the BSB'
    if r['form'] == 'many-ands' and sum(len(re.findall(r'\band\b', w, re.I)) for w in r['words']) < 2:
        return 'the label "And, and, and" does not fit: its words do not say "and" twice or more'
    if len(set(r.get('original') or [])) != len(r.get('original') or []):
        return 'a tag is listed twice'
    for t in r.get('original') or []:
        if not tag_ok(t):
            return f'tag {t} is not a Strong\'s tag'
        keys = [W.lem['key'][w[3]] for v in verses for w in verses[v][1] if not (len(w) > 5 and w[5] & 2)]
        if not any(lemma_matches(k, t) for k in keys):
            return f'tag {t} is not the root of a word in the verse'
    return None


def overlit(ref, tags):
    """Tags name roots, and the display lights every word of the verse with that
    root: more lit words than tags means they light words that are not the figure."""
    b, c, v1, v2 = W.parse(ref)
    lit = sum(1 for v in range(v1, v2 + 1) for w in W.verse(b, c, v)[1]
              if any(lemma_matches(W.lem['key'][w[3]], t) for t in tags))
    return lit > len(tags)


def order_key(r):
    b, c, v1, _ = W.parse(r['ref'])
    return (W.books.index(b), c, v1, r['id'])


def main():
    nn, result, checked, repo, logdir = sys.argv[1:6]
    run = sys.argv[6] if len(sys.argv) > 6 else ''
    record = []
    nn = nn.zfill(2)
    rows_path = sys.argv[7] if len(sys.argv) > 7 else f'{WORK}/words-{nn}.jsonl'
    rows = [json.loads(l) for l in open(rows_path, encoding='utf-8')]
    handed = len(rows)
    hand = [json.loads(l) for l in open(f'{WORK}/words-{nn}.jsonl', encoding='utf-8')]
    res = json.load(open(result, encoding='utf-8'))
    res = res.get('result', res)
    assert res['nn'] == nn, (res['nn'], nn)
    forms = {f['id']: f for f in json.load(open(f'{repo}/config/figure-forms.json', encoding='utf-8'))['forms']}
    clean, judged, disputed = set(), {}, {}
    for b in res['results']:
        clean.update(b['clean'])
        for d in b['disputed']:
            disputed[d['i']] = d
        for j in b.get('judged') or []:
            judged[j['i']] = j
    seen_dir = f'{repo}/config/figures-seen'
    os.makedirs(seen_dir, exist_ok=True)
    existing = {}
    for name in sorted(os.listdir(seen_dir)):
        for n in json.load(open(f'{seen_dir}/{name}', encoding='utf-8'))['notes']:
            existing[n['id']] = (name[:-5], n)
    already = set(existing)
    counts = collections.Counter()
    drops = []
    kept = []
    for i, row in enumerate(rows):
        why = None
        form, words, original = row['form'], list(row['words']), list(row.get('original') or [])
        reasons = []
        how = None
        if i in clean:
            counts['clean'] += 1
            how = 'both readers passed it' 
        elif i in judged:
            j = judged[i]
            reasons.append(j.get('reason', ''))
            how = 'read a third time' 
            if j['final'] != 'keep':
                why = 'dropped on reading'
            else:
                if j['form'] != row['form']:
                    d = disputed.get(i, {})
                    proposed = {x.get('better_form') for x in (d.get('a'), d.get('b')) if isinstance(x, dict)}
                    if j['form'] not in proposed:
                        why = f'judge moved it to {j["form"]}, which no reader proposed'
                    else:
                        form = j['form']
                        counts['form changed'] += 1
                if j.get('words'):
                    words = j['words']
                    counts['words changed'] += 1
                if j.get('strip_original') and original:
                    original = []
                    counts['tags dropped'] += 1
                counts['judge kept'] += 1
        elif i in disputed:
            why = 'held: no judgement'
        else:
            why = 'held: not read'
        # tags that light the article or the object marker, or that stop at the
        # search's limit of eight, are a stretch of words, not the figure (stags.py)
        if original and (len(original) >= 8 or any(re.sub('[A-Za-z]$', '', t) in ('G3588', 'H0853') for t in original)):
            original = []
        if original and overlit(row['ref'], original):
            original = []
        # a root named twice (two words of the same root) is named once: the display lights both
        original = list(dict.fromkeys(original))
        # a search sometimes cut a span just after a comma or a question mark
        words = [re.sub(r'^[\s,.;:!?—–\-”’)\]]+', '', w) for w in words]
        words = tidy(row['ref'], words)
        r = {'id': id_for(row['ref'], form), 'form': form, 'ref': row['ref'], 'words': words}
        if original:
            r['original'] = original
        r['methods'] = row['methods']
        r['checked'] = checked
        if why is None:
            why = check(r, forms)
            if why:
                why = refused(why)
        if why is None and r['id'] in already:
            why = f'same form already on this verse ({r["id"]})'
        if why:
            key = 'held' if why.startswith('held') else 'dropped'
            counts[key] += 1
            drops.append({'i': row.get('i0', i), 'id': row['id'], 'ref': row['ref'], 'form': row['form'], 'why': why, 'reasons': reasons})
            if key == 'dropped':
                record.append({'i': row.get('i0', i), 'id': row['id'], 'kept': None, 'how': how, 'why': why if not reasons else reasons[0]})
            continue
        already.add(r['id'])
        kept.append(r)
        x = {'i': row.get('i0', i), 'id': row['id'], 'kept': r['id'], 'how': how}
        if reasons:
            x['why'] = reasons[0]
        h = hand[row.get('i0', i)]
        assert h['id'] == row['id']
        changed = [k for k, a, b in (('form', h['form'], r['form']), ('words', h['words'], r['words']),
                                     ('original', h.get('original') or [], r.get('original') or [])) if a != b]
        if changed:
            x['changed'] = changed
        record.append(x)
    if len(sys.argv) > 7:
        for x in (json.loads(l) for l in open(rows_path[:-6] + '-refused.jsonl', encoding='utf-8')):
            counts['refused before reading'] += 1
            drops.append({'i': x['i0'], 'id': x['id'], 'ref': x['ref'], 'form': x['form'], 'why': x['why'], 'reasons': []})
            record.append({'i': x['i0'], 'id': x['id'], 'kept': None, 'how': 'refused before reading', 'why': x['why']})
            handed += 1
        record.sort(key=lambda p: p['i'])
        drops.sort(key=lambda d: d['i'])
    counts['kept'] = len(kept)
    by_book = collections.defaultdict(list)
    for _id, (osis, n) in existing.items():
        by_book[osis].append(n)
    for r in kept:
        by_book[W.parse(r['ref'])[0]['osis']].append(r)
    for osis, notes in by_book.items():
        notes.sort(key=order_key)
        body = ',\n'.join('    ' + json.dumps(n, ensure_ascii=False) for n in notes)
        with open(f'{seen_dir}/{osis}.json', 'w', encoding='utf-8') as f:
            f.write('{\n  "notes": [\n' + body + '\n  ]\n}\n')
    os.makedirs(logdir, exist_ok=True)
    with open(f'{logdir}/words-{nn}-drops.jsonl', 'w', encoding='utf-8') as f:
        for d in drops:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    summary = {'nn': nn, 'places': handed, **counts,
               'by_form_kept': collections.Counter(r['form'] for r in kept),
               'by_form_read': collections.Counter(r['form'] for r in rows)}
    json.dump(summary, open(f'{logdir}/words-{nn}-summary.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False))
    ev = f'{repo}/docs/evidence/figures-seen'
    os.makedirs(ev, exist_ok=True)
    doc = {'_comment': [f'How each place of the catalogue\'s words-{nn}.jsonl was settled before it went in config/figures-seen/: '
                        'two readers read every place against its BSB verse, one asking whether the figure is plainly there '
                        'and one whether the marked words, form and tags are right; a place both passed is kept as handed over, '
                        'and any place either questioned was read a third time and kept, changed or dropped. '
                        'A new form stands only where a reader proposed it. Places not read are held, not listed. '
                        'Stray punctuation before marked words is trimmed, and Strong\'s tags that light the article (G3588) '
                        'or the object marker (H0853), or number eight, the search\'s limit, are taken off as a stretch of words.'],
           'file': f'words-{nn}.jsonl', 'read': checked, 'run': run,
           'counts': {k: v for k, v in counts.items()}, 'places': record}
    with open(f'{ev}/words-{nn}.json', 'w', encoding='utf-8') as f:
        f.write('{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in doc.items() if k != 'places'))
        f.write(',\n  "places": [\n' + ',\n'.join('    ' + json.dumps(p, ensure_ascii=False) for p in record) + '\n  ]\n}\n')


if __name__ == '__main__':
    main()
