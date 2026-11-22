#!/usr/bin/env python3
"""Find, in the Christian writers' notes the build already carries, the
sentences that speak of a verb form the verse really has.

Reads the built data (run `atlas build` first):
  web/public/data/extras/voices*      the writers' notes, verse by verse
  web/public/data/extras/grammar*     each verse's forms, from STEPBible's tags
Writes candidates as JSON lines to the path given (default: stdout). Nothing
here decides what is shown: config/grammar-notes.json is the list, and
`atlas verify` checks every entry of it against the same two sources.

Usage: python3 scripts/grammar-notes/mine.py [out.jsonl]
"""
import glob, json, os, re, sys, unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DATA = os.path.join(ROOT, 'web', 'public', 'data')

# The works read: Wesley, Calvin, Jamieson-Fausset-Brown, Keil and Delitzsch, Barnes.
WORKS = {2, 3, 6, 7, 8}

# A form's name in a writer's sentence, and the terms it may be. STRICT
# names are unmistakably grammar ("the present tense", "aorist"); LOOSE ones
# ("perfect", "future") count only when the sentence also quotes a word of
# the verse that has the form.
STRICT = [
    (r'\baorist', ['g-aorist']),
    (r'\bpluperfect', ['g-pluperfect']),
    (r'\bimperfect (?:tense|indicative)|\bthe imperfect\b(?! (?:knowledge|state|obedience|and|faith|work|being|creature|righteousness|view|idea|sense|form|manner|sacrifice|man\b|men\b))|\bimperf\.|\bGreek imperfect', ['g-imperfect', 'h-imperfect', 'a-imperfect']),
    (r'(?<!im)(?<!plu)\bperfect (?:tense|participle|passive|middle|indicative|infinitive|active)|\b(?:Greek|Hebrew) perfect\b|\bprophetic(?:al)? perfect|\bperf\.|\bpr(?:e|æ)terite|\bpr(?:e|æ)t\.', ['g-perfect', 'h-perfect', 'a-perfect']),
    (r'\bpresent (?:tense|participle|indicative|imperative|infinitive|passive|middle|active|subjunctive)|\b(?:Greek|Hebrew) present\b', ['g-present']),
    (r'\bfuture (?:tense|participle|indicative|passive|middle|active)|\bGreek future\b', ['g-future']),
    (r'\bfut\.|\bHebrew future\b', ['h-imperfect', 'a-imperfect']),
    (r'\bmiddle voice|\bGreek middle|\bin the middle\b(?! of)', ['g-middle']),
    (r'\bpassive voice|\bin the passive\b|\bGreek passive', ['g-passive']),
    (r'\bimperative mood|\bin the imperative\b|\bthe imperative\b|\bimper\.|\bimperat\.', ['g-imperative', 'h-imperative', 'a-imperative']),
    (r'\bsubjunctive', ['g-subjunctive']),
    (r'\boptative', ['g-optative', 'h-jussive', 'h-cohortative']),
    (r'\binfinitive absolute|\binf(?:in)?\. abs', ['h-infinitive-absolute']),
    (r'\binfinitive(?! absolute)|\binf(?:in)?\.(?! abs)', ['g-infinitive', 'h-infinitive', 'a-infinitive']),
    (r'\bparticiple|\bpartic\.', ['g-participle', 'h-participle', 'a-participle']),
    (r'\bjussive', ['h-jussive']),
    (r'\bcohortative', ['h-cohortative']),
    (r'\bNiphal|\bNiph\.', ['h-niphal']),
    (r'\bPiel\b|\bPihel', ['h-piel']),
    (r'\bPual\b|\bPuhal', ['h-pual']),
    (r'\bHiphil|\bHiph\.', ['h-hiphil']),
    (r'\bHophal|\bHoph\.', ['h-hophal']),
    (r'\bHithpael|\bHithp\.|\bHithpahel', ['h-hithpael']),
    (r'\bfut\. consec|\bimperf\. consec|\bconsecutive imperfect|\bimperfect consecutive|\bconversive future|\bfuture conversive', ['h-then']),
    (r'\bperf\. consec|\bconsecutive perfect|\bperfect consecutive|\bconversive pr(?:e|æ)terite|\bpr(?:e|æ)t\. consec', ['h-and-perfect']),
]
LOOSE = [
    (r'\bimperfect', ['g-imperfect', 'h-imperfect', 'a-imperfect']),
    (r'(?<!im)(?<!plu)\bperfects?\b', ['g-perfect', 'h-perfect', 'a-perfect']),
    (r'\bpresent\b', ['g-present']),
    (r'\bfuture', ['g-future', 'h-imperfect', 'a-imperfect']),
    (r'\bmiddle\b', ['g-middle']),
    (r'\bpassive', ['g-passive', 'h-niphal', 'h-pual', 'h-hophal']),
    (r'\bimperative', ['g-imperative', 'h-imperative', 'a-imperative']),
    (r'\bpart\. ', ['h-participle', 'a-participle']),
    (r'\bPi\. ', ['h-piel']),
]
STRICT = [(re.compile(p), t) for p, t in STRICT]
LOOSE = [(re.compile(p), t) for p, t in LOOSE]

# Writers a sentence may not lean on: critics the commentaries argue with.
# A sentence naming one is left out; so is one with any avoid-list name.
CRITICS = re.compile(r'\b(?:Hitz|Ewald|Ew\.|Gesen|Ges\.|Hupf|Olsh|B(?:ö|oe)ttch|Then\.|Thenius|Knobel|Kn\.|Bleek|Berth|Movers|Graf\b|De Wette|Maurer|Umbreit|Rosenm|F(?:ü|ue)rst|Dietrich|Luzz|Dathe|Eichhorn|Vatke|Kuenen|Wellh|Schrader|Dillm|N(?:ö|oe)ld|Reuss|Strauss|Baur\b|Renan|Paulus|Semler|Lachm|Tischend|Bunsen|Colenso|Kamph|Heiligst|Zöckl|Schult|Hirz|Stick|Welte|Merx|Geiger|Kimch|Rashi|Abenezra|Aben-Ezra|Saad|Targ|Talm|Midrash|J\. H\. Mich|Schlottm|Elster|Venet|Symm|Aquila|Theod)')

# A sentence ends at . ! or ? (and any closing marks) before a space and a
# capital, unless the word before the stop is one of these.
ABBR = set('''v vv ver vers ch chap chs cf comp cp i.e e.g viz etc sc al seq sqq ff lit marg vol p pp st dr mr mrs no
 gr heb lat chald syr vulg sept lxx arab ps gen ex exod lev num deut josh judg sam kgs chr neh esth prov eccl isa jer lam
 ezek dan hos obad mic nah hab zeph hag zech mal matt mt mk lk jn rom cor gal eph phil col thess tim tit philem jas pet rev
 perf imperf imper inf fut part partic pret praet consec abs constr sing plur masc fem pers pron prep adj adv subst
 niph hiph hoph hithp pi pu vid loc cit op ibid kal poel pil absol absoll infin intens fin verb'''.split())
END = re.compile(r'([.!?]["”’\')\]]*)\s+(?=["“‘(\[]?[A-Z])')


def sentences(par):
    out, start = [], 0
    for m in END.finditer(par):
        before = par[start:m.start()]
        last = re.split(r'[\s(\[]', before)[-1].lower().rstrip('.')
        if par[m.start()] == '.' and (last in ABBR or len(last) == 1 or last.isdigit() and len(before) < 6):
            continue
        out.append((start, m.end(1)))
        start = m.end()
    if start < len(par):
        out.append((start, len(par)))
    return out


def plain(text):
    if isinstance(text, str):
        return text
    return ''.join(r if isinstance(r, str) else r[2] for r in text)


HEB = re.compile(r'[\u05d0-\u05ea][\u0591-\u05c7\u05d0-\u05ea]*')
GRK = re.compile(r'[\u0370-\u03ff\u1f00-\u1fff]{3,}')
# An authority Jamieson, Fausset and Brown name in capitals in brackets.
BRACKET = re.compile(r'\[([A-Z][A-Za-z .]+)\]')
ALLOWED = {'BENGEL', 'ALFORD', 'ELLICOTT', 'CALVIN', 'LUTHER', 'CHRYSOSTOM', 'AUGUSTINE', 'TRENCH', 'WORDSWORTH',
           'FAIRBAIRN', 'HENGSTENBERG', 'WEBSTER and WILKINSON', 'BARNES', 'HENRY', 'TITTMANN', 'ESTIUS', 'HODGE',
           'CONYBEARE and HOWSON', 'BIRKS', 'PEARSON', 'LIGHTFOOT', 'JEROME', 'TREGELLES', 'AUBERLEN', 'STIER', 'THOLUCK'}


def consonants(w):
    return ''.join(c for c in w if '\u05d0' <= c <= '\u05ea')


def greek(w):
    w = unicodedata.normalize('NFD', w.lower())
    return ''.join(c for c in w if '\u03b1' <= c <= '\u03c9').replace('ς', 'σ')


def main():
    idx = json.load(open(os.path.join(DATA, 'extras', 'grammar.json')))
    term_ids = [t['id'] for t in idx['terms']]
    meta = json.load(open(os.path.join(DATA, 'meta.json')))
    avoid = [m for a in json.load(open(os.path.join(ROOT, 'config', 'layer-sources.json')))['avoid'] for m in a['match']]
    # Each verse's words, and the forms of each word, by the verse's number.
    words, names, n = {}, {}, 0
    for b in meta['books']:
        text = json.load(open(os.path.join(DATA, 'text', b['osis'] + '.json')))
        for c, chapter in enumerate(text['chapters']):
            for v, row in enumerate(chapter):
                words[n] = [w[0] for w in row[1]]
                names[n] = f"{b['osis']}.{c + 1}.{v + 1}"
                n += 1
    forms = {}  # verse -> {word: [term ids]}
    for path in glob.glob(os.path.join(DATA, 'extras', 'grammar', '*.json')):
        if os.path.basename(path).startswith('codes-'):
            continue
        for v, points in json.load(open(path))['v'].items():
            d = forms.setdefault(int(v), {})
            for p in points:
                if p[0] == 'v':
                    d.setdefault(p[1], []).extend(term_ids[t] for t in p[2])
    out = open(sys.argv[1], 'w') if len(sys.argv) > 1 else sys.stdout
    count = 0
    files = sorted(glob.glob(os.path.join(DATA, 'extras', 'voices', '**', '*.json'), recursive=True))
    for path in files:
        for item in json.load(open(path))['items']:
            work, frm, to, voices = item[0], item[1], item[2], item[3]
            if work not in WORKS:
                continue
            for who, text in voices:
                if who:
                    continue  # notes brought in from another passage
                for par in plain(text).split('\n\n'):
                    for a, b in sentences(par):
                        s = par[a:b].strip()
                        if not 40 <= len(s) <= 420 or '[passage left out]' in s:
                            continue
                        if any(m in s for m in avoid) or CRITICS.search(s):
                            continue
                        if any(m.strip() not in ALLOWED for m in BRACKET.findall(s)):
                            continue
                        strict, loose = set(), set()
                        for rx, terms in STRICT:
                            if rx.search(s):
                                strict.update(terms)
                        for rx, terms in LOOSE:
                            if rx.search(s):
                                loose.update(terms)
                        if not strict and not loose:
                            continue
                        heb = {consonants(w) for w in HEB.findall(s)}
                        heb = {w for w in heb if len(w) >= 3}
                        grk = [greek(w) for w in GRK.findall(s)]
                        grk = [w for w in grk if len(w) >= 4]
                        hits = []
                        for v in range(frm, to + 1):
                            for i, terms in forms.get(v, {}).items():
                                named = sorted((strict | loose) & set(terms))
                                if not named:
                                    continue
                                w = words[v][i]
                                hw, gw = consonants(w), greek(w)
                                if (len(hw) >= 3 and hw in heb) or (len(gw) >= 4 and any(gw in g for g in grk)):
                                    hits.append((v, i, named, 'word'))
                        if not hits and frm == to and strict and not heb and not grk:
                            # No word quoted: the note is on one verse, and the form is named outright.
                            at = [(i, sorted(strict & set(t))) for i, t in forms.get(frm, {}).items() if strict & set(t)]
                            terms = sorted({t for _, ts in at for t in ts})
                            if at:
                                hits.append((frm, at[0][0] if len(at) == 1 else -1, terms, 'verse'))
                        seen = set()
                        for v, i, named, how in hits:
                            if (v, i) in seen:
                                continue
                            seen.add((v, i))
                            out.write(json.dumps({'at': names[v], 'v': v, 'word': i, 'work': work, 'terms': named, 'by': how,
                                                  'quote': s}, ensure_ascii=False) + '\n')
                            count += 1
    sys.stderr.write(f'{count} candidates\n')


if __name__ == '__main__':
    main()
