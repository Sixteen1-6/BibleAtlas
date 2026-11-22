#!/usr/bin/env python3
"""Find, in the Christian writers' notes the build already carries, the
sentences that speak of something the verse's own words really show:

  form   a verb form ("the perfect", "the participle") the verse's tags have
  made   a construction: an emphatic pronoun, a doubled negative, a verb
         said twice ("dying you shall die")
  link   a linking word ("therefore", "for", "lest") the verse has
  rare   a word the writer says is found nowhere else, on a verse whose
         word the build counts once or twice
  word   a word of the verse the writer prints, in its own letters or in
         ours, and says is emphatic, chosen, strong or significant

Reads the built data (run `atlas build` first):
  web/public/data/extras/voices*      the writers' notes, verse by verse
  web/public/data/extras/grammar*     each verse's points, from STEPBible's tags
  web/public/data/text/*              each verse's words
Writes candidates as JSON lines to the path given (default: stdout). Nothing
here decides what is shown: config/grammar-notes.json is the list, and
`atlas verify` checks every entry of it against the same sources. Sentences
already in that list are left out.

Usage: python3 scripts/grammar-notes/mine.py [out.jsonl]
"""
import glob, json, os, re, sys, unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DATA = os.path.join(ROOT, 'web', 'public', 'data')

# The works read, by their number in extras/voices.json: Henry's concise
# commentary, Wesley, Calvin, Henry's full commentary and its finishers,
# Jamieson-Fausset-Brown, Keil and Delitzsch, Barnes, Luther on Galatians
# and on Genesis. (0, the Fathers' catena, is not read.)
WORKS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
# A voice whose heading begins so was brought in from another passage.
ELSEWHERE = ("Henry's notes on", "Calvin's notes on")

# A form's name in a writer's sentence, and the terms it may be. STRICT
# names are unmistakably grammar ("the present tense", "aorist"); LOOSE ones
# ("perfect", "future") count only when the sentence also quotes a word of
# the verse that has the form.
STRICT = [
    (r'\baorist', ['g-aorist']),
    (r'\bpluperfect', ['g-pluperfect']),
    (r'\bimperfect (?:tense|indicative)|\bthe imperfect\b(?! (?:knowledge|state|obedience|and|faith|work|being|creature|righteousness|view|idea|sense|form|manner|sacrifice|man\b|men\b))|\bimperf\.|\bGreek imperfect', ['g-imperfect', 'h-imperfect', 'a-imperfect']),
    (r'(?<!im)(?<!plu)\bperfect (?:tense|participle|passive|middle|indicative|infinitive|active)|\b(?:Greek|Hebrew) perfect\b|\bprophetic(?:al)? perfect|\bperf\.|\bpr(?:e|æ)terite|\bpr(?:e|æ)t\.|\bpreter(?:-| )?perfect', ['g-perfect', 'h-perfect', 'a-perfect']),
    (r'\bpresent (?:tense|participle|indicative|imperative|infinitive|passive|middle|active|subjunctive)|\b(?:Greek|Hebrew) present\b', ['g-present']),
    (r'\bfuture (?:tense|participle|indicative|passive|middle|active)|\bGreek future\b', ['g-future']),
    (r'\bfut\.|\bHebrew future\b', ['h-imperfect', 'a-imperfect']),
    (r'\bpast tense', ['g-aorist', 'g-imperfect', 'g-perfect', 'h-perfect', 'a-perfect']),
    (r'\bmiddle voice|\bGreek middle|\bin the middle\b(?! of)', ['g-middle']),
    (r'\bpassive voice|\bin the passive\b|\bGreek passive|\bpassive (?:signification|sense|form|verb)|\bpassively\b', ['g-passive', 'h-niphal', 'h-pual', 'h-hophal']),
    (r'\bimperative mood|\bin the imperative\b|\bthe imperative\b|\bimper\.|\bimperat\.|\bimperatively', ['g-imperative', 'h-imperative', 'a-imperative']),
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

# Constructions: what a writer's sentence must say, for a verse that has one.
MADE = [
    (r'\bpronoun\b[^.]{0,80}\bemphati|\bemphati\w+[^.]{0,60}\bpronoun|\b(?:The|the|An|an) emphati\w+ [“"‘\']?(?:I|We|Ye|You|Thou|He|They|She|Me|My)\b|[“"‘\'](?:I|We|Ye|You|Thou|He|They|Me|My|Him|Us|Our|Your|Thy|His)[”"’\',]*[^.]{0,60}\bemphati|\bemphati\w+[^.]{0,60}[“"‘\'](?:I|We|Ye|You|Thou|He|They|Me|My|Him|Us)[”"’\',]|\b(?:I|WE|We|YE|Ye|HE|He|THEY|They|THOU|Thou|YOU|You) \((?:the )?emphati|\bemphasis\b[^.]{0,60}[“"‘\'](?:I|We|Ye|You|Thou|He|They|Me|My|Him|Us)[”"’\',]|[“"‘\'](?:I|We|Ye|You|Thou|He|They|Me|My|Him|Us)[”"’\',]*[^.]{0,60}\bemphasis', 'g-pronoun'),
    (r'\bdouble negati|\btwo negatives|\bstrong(?:est|er)? (?:form of )?negati|\bemphatic(?:al)? negati|\bnegati\w+ (?:is|are) (?:very |most |doubly )?(?:strong|emphatic|doubled|repeated)|\bintensive negati', 'g-never'),
    (r'\bdying,? (?:thou|you|ye|he|they) sh\w+ die|\bin (\w+)ing,? I w\w+ \1|\b(\w{3,})ing,? (?:I|thou|you|ye|he|they|we) (?:shall|shalt|will|wilt|have|hast|hath|did|didst) (?:\w+ )?\2|\brepetition of the verb|\bverb is (?:repeated|doubled)|\bdoubling of the (?:word|verb)|\bHebrew idiom\b[^.]{0,80}\b(?:certain|surely|intens|emphati|earnest)', 'h-twice'),
]
MADE = [(re.compile(p), t) for p, t in MADE]

# Linking words, as a writer names them, and the link each is.
LINKS = {'therefore': 'therefore', 'wherefore': 'therefore', 'for': 'for', 'but': 'but', 'that': 'so-that',
         'so that': 'so-that', 'in order that': 'so-that', 'lest': 'lest', 'because': 'because', 'if': 'if',
         'as': 'just-as', 'even as': 'just-as', 'just as': 'just-as', 'according as': 'just-as',
         'behold': 'behold', 'lo': 'behold'}
ANY_LINK = '|'.join(sorted(LINKS, key=len, reverse=True))
# A note that opens on the word itself: Wesley's "Therefore - ", Barnes'
# "Therefore. ", Jamieson-Fausset-Brown's "Therefore--".
LEMMA = {
    2: re.compile(r'^(%s) - ' % ANY_LINK, re.I),
    8: re.compile(r'^(%s)(?:,? etc)?\. ' % ANY_LINK, re.I),
    6: re.compile(r'^(%s)(?:, &c\.)?--' % ANY_LINK, re.I),
}
JFB_LEMMA = re.compile(r'(?<=[.!?\])] )(%s)(?:, &c\.)?--' % ANY_LINK)
JFB_NEXT = re.compile(r'[.!?] [a-z][^.!?]{0,60}?--')
# Or one that names the word and says how it joins.
NAMED = re.compile(r'[“"‘\'](%s)[,.]?[”"’\']|\b(?:word|particle|conjunction|illative|term|expression|adverb) [“"‘\']?(%s)\b|\b(?:This|this|The|the|His|his) [“"‘\']?(therefore|wherefore|because|lest|behold)\b[”"’\']? (?:is|was|refers|relates|points|looks|shows|shews|marks|implies|introduces|connects|denotes|indicates|expresses|draws|has|must|may|does)'
                   % (ANY_LINK, ANY_LINK), re.I)
JOINS = re.compile(r'\b(?:inference|infers?\b|inferred|conclusion|concludes?\b|consequence|reason|ground|cause\b|causal|illative|adversative|connexion|connection|connects?\b|connected|refers|referring|reference to|relates to|looks back|points back|introduces|assigns|explains|purpose|design\b|result\b|condition|conditional|contrast|opposition|antithesis|comparison|attention|emphatic|emphasis|force of|denotes|indicates|implies|marks\b|shows|shews|depends|follows from|resum)', re.I)

# A writer's remark that a word is found only here, or only twice.
ONCE = re.compile(r'\bno ?where else\b|\bnot elsewhere\b|\bnot (?:found|used|occurring|met with)[^.]{0,40}(?:elsewhere|anywhere else|in any other)|\bdoes not (?:elsewhere )?occur\b|\bnot elsewhere (?:found|used)|\b(?:occurs?|occurring|found|used|met with)(?: in the (?:New|Old) Testament| in Scripture| in the Bible)? (?:only|but) (?:here|once|in this|twice)|\bonly (?:here|in this place|in this passage|in this verse)\b[^.]{0,60}\b(?:occur|found|used|word|met)|\b(?:word|term|verb|noun|expression|form)\b[^.]{0,80}\bonly (?:here|in this place|in this passage|once|twice)\b|\b(?:ἅ|ἁ|α)π(?:αξ|\.) ?(?:λεγ|γεγρ)|\bhapax\b|\bap\. leg|\bonly other (?:place|passage|instance)|\bonly instance|\bnowhere but\b|\bno other place\b|\bnot (?:again|once) (?:found|used|occur)', re.I)
TWICE = re.compile(r'\bexcept\b|\bsave (?:in|here)\b|\bonly other\b|\bonce more\b|\bonly twice\b|\bbut twice\b|\bonly (?:here|in this place),? and\b|\bhere and in\b|\bbesides\b|\bonly elsewhere\b|\belsewhere only\b|\bone other\b|\bonly again\b|\bonly in [A-Z1-3][^.]{2,30} and\b', re.I)
MORE = re.compile(r'(?:It|The word|This word|Its|Here it|The meaning|The idea|The (?:Greek|Hebrew) word) ')
ABOUT_WORD = re.compile(r'\b(?:word|term|verb|noun|adjective|expression|form|Greek|Hebrew|original|rendered|translated|occurs?|used|ἅπ|ἁπ|hapax)\b', re.I)

# A writer's remark on why a word was used: its emphasis, force or choice.
FORCE = re.compile(r'\bemphati|\bemphasis|\bforce of|\bforcib|\bexpressive|\bstrong(?:er|est)? (?:word|term|expression)|\bstronger than|\bmuch stronger|\bvery strong\b|\bmore than (?:merely|simply)|\bnot (?:merely|simply)\b|\bchosen\b|\bchooses\b|\bdesignedly|\bpurposely|\bintentionally|\bnot without (?:reason|cause|design|meaning)|\bit is not said|\bdoes not say|\bsays not\b|\bsaith not\b|\bremarkable\b|\bsignificant|\bpeculiar force|\bfull meaning|\bintensive|\bgraphic|\bvivid|\b(?:observe|mark|note) the word|\bword implies', re.I)
# Keil and Delitzsch print a word in nearly every sentence: only the plainest remarks.
FORCE_KD = re.compile(r'\bemphati|\bemphasis|\bforcib|\bexpressive|\bstrong(?:er|est)? (?:word|term|expression)|\bstronger than|\bchosen\b|\bdesignedly|\bpurposely|\bintentionally|\bnot without (?:reason|cause|design|meaning)|\bsignificant', re.I)

# Writers a sentence may not lean on: critics the commentaries argue with.
# A sentence naming one is left out; so is one with any avoid-list name.
CRITICS = re.compile(r'\b(?:Hitz|Ewald|Ew\.|Gesen|Ges\.|Hupf|Olsh|B(?:ö|oe)ttch|Then\.|Thenius|Knobel|Kn\.|Bleek|Berth|Movers|Graf\b|De Wette|Maurer|Umbreit|Rosenm|F(?:ü|ue)rst|Dietrich|Luzz|Dathe|Eichhorn|Vatke|Kuenen|Wellh|Schrader|Dillm|N(?:ö|oe)ld|Reuss|Strauss|Baur\b|Renan|Paulus|Semler|Lachm|Tischend|Bunsen|Colenso|Kamph|Heiligst|Zöckl|Schult|Hirz|Stick|Welte|Merx|Geiger|Kimch|Rashi|Abenezra|Aben-Ezra|Saad|Targ|Talm|Midrash|J\. H\. Mich|Schlottm|Elster|Venet|Symm|Aquila|Theod|Rabbi|Jarchi|Grotius|Le Clerc|Socin|Unitarian|Priestley|Koppe|Kuin|Schleus|Wetst|Michaelis|Doederl|Bretsch|Stuart|Bloomf|Robinson)')

# A sentence ends at . ! or ? (and any closing marks) before a space and a
# capital, unless the word before the stop is one of these.
ABBR = set('''v vv ver vers ch chap chs cf comp cp i.e e.g viz etc sc al seq sqq ff lit marg vol p pp st dr mr mrs no
 gr heb lat chald syr vulg sept lxx arab ps gen ex exod lev num deut josh judg sam kgs chr neh esth prov eccl isa jer lam
 ezek dan hos obad mic nah hab zeph hag zech mal matt mt mk lk jn rom cor gal eph phil col thess tim tit philem jas pet rev
 perf imperf imper inf fut part partic pret praet consec abs constr sing plur masc fem pers pron prep adj adv subst
 niph hiph hoph hithp pi pu vid loc cit op ibid kal poel pil absol absoll infin intens fin verb &c'''.split())
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


HEB = re.compile(r'[א-ת][֑-ׇא-ת]*')
GRK = re.compile(r'[Ͱ-Ͽἀ-῿]{2,}')
LATIN = re.compile(r"[A-Za-zāēīōūâêîôûēōëï]{5,}")
# An authority Jamieson, Fausset and Brown name in capitals in brackets.
BRACKET = re.compile(r'\[([A-Z][A-Za-z .]+)\]')
ALLOWED = {'BENGEL', 'ALFORD', 'ELLICOTT', 'CALVIN', 'LUTHER', 'CHRYSOSTOM', 'AUGUSTINE', 'TRENCH', 'WORDSWORTH',
           'FAIRBAIRN', 'HENGSTENBERG', 'WEBSTER and WILKINSON', 'BARNES', 'HENRY', 'TITTMANN', 'ESTIUS', 'HODGE',
           'CONYBEARE and HOWSON', 'BIRKS', 'PEARSON', 'LIGHTFOOT', 'JEROME', 'TREGELLES', 'AUBERLEN', 'STIER', 'THOLUCK'}


def consonants(w):
    return ''.join(c for c in w if 'א' <= c <= 'ת')


def greek(w):
    w = unicodedata.normalize('NFD', w.lower())
    return ''.join(c for c in w if 'α' <= c <= 'ω').replace('ς', 'σ')


def latin(w):
    """A transliteration with its marks taken off: "Parakalō" and "parakalo" are one."""
    w = unicodedata.normalize('NFD', w.lower())
    return ''.join(c for c in w if 'a' <= c <= 'z')


def same_word(a, b):
    """Two Greek spellings of one word: the writer may print the dictionary form."""
    if not a or not b:
        return False
    n = min(len(a), len(b))
    if n < 4:
        return a == b
    k = max(4, n - 3)
    return a[:k] == b[:k]


def main():
    idx = json.load(open(os.path.join(DATA, 'extras', 'grammar.json')))
    term_ids = [t['id'] for t in idx['terms']]
    link_ids = [l['id'] for l in idx['links']]
    meta = json.load(open(os.path.join(DATA, 'meta.json')))
    avoid = [m for a in json.load(open(os.path.join(ROOT, 'config', 'layer-sources.json')))['avoid'] for m in a['match']]
    have = {(n['at'], n['quote']) for n in json.load(open(os.path.join(ROOT, 'config', 'grammar-notes.json')))['notes']}
    # Each verse's words and BSB text, by the verse's number.
    words, names, bsb, english, n = {}, {}, {}, set(), 0
    for b in meta['books']:
        text = json.load(open(os.path.join(DATA, 'text', b['osis'] + '.json')))
        for c, chapter in enumerate(text['chapters']):
            for v, row in enumerate(chapter):
                words[n] = [(w[0], w[1], w[2]) for w in row[1]]
                names[n] = f"{b['osis']}.{c + 1}.{v + 1}"
                bsb[n] = row[0]
                english.update(latin(x) for x in re.findall(r"[A-Za-z]+", row[0]))
                n += 1
    forms, made, links, rare = {}, {}, {}, {}
    for path in glob.glob(os.path.join(DATA, 'extras', 'grammar', '*.json')):
        if os.path.basename(path).startswith('codes-'):
            continue
        for v, points in json.load(open(path))['v'].items():
            v = int(v)
            for p in points:
                if p[0] == 'v':
                    forms.setdefault(v, {}).setdefault(p[1], []).extend(term_ids[t] for t in p[2])
                elif p[0] == 'x':
                    made.setdefault(v, []).append((term_ids[p[1]], p[2]))
                elif p[0] == 'j':
                    links.setdefault(v, []).append((p[1], link_ids[p[2]]))
                elif p[0] == 'r':
                    rare.setdefault(v, []).append((p[1], p[2], p[3] if len(p) > 3 else None))
    out = open(sys.argv[1], 'w') if len(sys.argv) > 1 else sys.stdout
    counts, found = {}, set()

    def emit(v, word, work, kind, terms, link, how, quote, extra=None):
        if (names[v], quote) in have:
            return
        row = {'at': names[v], 'v': v, 'word': word, 'work': work, 'kind': kind, 'terms': terms, 'by': how, 'quote': quote,
               'bsb': bsb[v]}
        if link:
            row['link'] = link
        if word >= 0:
            row['w'] = list(words[v][word])
        if extra:
            row.update(extra)
        out.write(json.dumps(row, ensure_ascii=False) + '\n')
        counts[(kind, work)] = counts.get((kind, work), 0) + 1
        found.add(quote)

    def usable(s):
        if not 40 <= len(s) <= 420 or '[passage left out]' in s:
            return False
        if any(m in s for m in avoid) or CRITICS.search(s):
            return False
        return all(m.strip() in ALLOWED for m in BRACKET.findall(s))

    files = sorted(glob.glob(os.path.join(DATA, 'extras', 'voices', '**', '*.json'), recursive=True))
    for path in files:
        for item in json.load(open(path))['items']:
            work, frm, to, voices = item[0], item[1], item[2], item[3]
            if work not in WORKS:
                continue
            for who, text in voices:
                if who and str(who).startswith(ELSEWHERE):
                    continue
                for par in plain(text).split('\n\n'):
                    spans = sentences(par)
                    # A note opening on a linking word: the word and the sentence on it.
                    lemma = LEMMA.get(work)
                    if lemma and frm == to and spans:
                        for k, (a, b) in enumerate(spans):
                            m = lemma.match(par[a:])
                            if not m:
                                continue
                            end = b
                            if b - a <= len(m.group(0)) + 1 and k + 1 < len(spans):
                                end = spans[k + 1][1]  # Barnes: "Therefore." then the sentence
                            s = par[a:end].strip()
                            link = LINKS[m.group(1).lower()]
                            at = [i for i, l in links.get(frm, []) if l == link]
                            if at and usable(s):
                                emit(frm, at[0], work, 'link', [], link, 'lemma', s)
                    if work == 6 and frm == to:
                        for m in JFB_LEMMA.finditer(par):
                            a = m.start(1)
                            if a == 0 or any(x == a for x, _ in spans):
                                continue  # at a sentence's start: found above
                            end = next(y for x, y in spans if x <= a < y)
                            nxt = JFB_NEXT.search(par, m.end())
                            if nxt and nxt.start() + 1 < end:
                                end = nxt.start() + 1
                            s = par[a:end].strip()
                            link = LINKS[m.group(1).lower()]
                            at = [i for i, l in links.get(frm, []) if l == link]
                            if at and usable(s):
                                emit(frm, at[0], work, 'link', [], link, 'lemma', s)
                    for k, (a, b) in enumerate(spans):
                        s = par[a:b].strip()
                        if not usable(s):
                            continue
                        heb = {consonants(w) for w in HEB.findall(s)}
                        grk = [greek(w) for w in GRK.findall(s)]
                        lat = {latin(w) for w in LATIN.findall(s)} - english
                        heb3 = {w for w in heb if len(w) >= 3}
                        grk4 = [w for w in grk if len(w) >= 4]

                        def quoted(v, i, short=False):
                            w, t, _ = words[v][i]
                            hw, gw, tw = consonants(w), greek(w), latin(t)
                            if hw:
                                if short:  # a linking word: the word itself, with or without its "and"
                                    return hw in heb or (hw[0] == 'ו' and hw[1:] in heb)
                                return len(hw) >= 3 and hw in heb3
                            if gw and short:
                                return gw in grk
                            if len(gw) >= 4 and any(gw in g for g in grk4):
                                return True
                            return len(tw) >= 5 and tw in lat

                        # --- a verb's form
                        strict, loose = set(), set()
                        for rx, terms in STRICT:
                            if rx.search(s):
                                strict.update(terms)
                        for rx, terms in LOOSE:
                            if rx.search(s):
                                loose.update(terms)
                        if strict or loose:
                            hits = []
                            for v in range(frm, to + 1):
                                for i, terms in forms.get(v, {}).items():
                                    named = sorted((strict | loose) & set(terms))
                                    if named and quoted(v, i):
                                        hits.append((v, i, named, 'word'))
                            if not hits and frm == to and strict and not heb3 and not grk4:
                                # No word quoted: the note is on one verse, and the form is named outright.
                                at = [(i, sorted(strict & set(t))) for i, t in forms.get(frm, {}).items() if strict & set(t)]
                                terms = sorted({t for _, ts in at for t in ts})
                                if at:
                                    hits.append((frm, at[0][0] if len(at) == 1 else -1, terms, 'verse'))
                            seen = set()
                            for v, i, named, how in hits:
                                if (v, i) not in seen:
                                    seen.add((v, i))
                                    emit(v, i, work, 'form', named, None, how, s)

                        # --- a construction
                        for rx, term in MADE:
                            if not rx.search(s):
                                continue
                            at = [(v, ws) for v in range(frm, to + 1) for t, ws in made.get(v, []) if t == term]
                            if len(at) == 1:
                                emit(at[0][0], at[0][1][0], work, 'made', [term], None, 'verse' if frm == to else 'range', s)

                        # --- a linking word, named in the sentence
                        if JOINS.search(s):
                            done = set()
                            for m in NAMED.finditer(s):
                                name = next(g for g in m.groups() if g).lower()
                                link = LINKS.get(name)
                                at = [(v, i) for v in range(frm, to + 1) for i, l in links.get(v, []) if l == link]
                                if len(at) == 1 and at[0] not in done:
                                    done.add(at[0])
                                    emit(at[0][0], at[0][1], work, 'link', [], link, 'named', s)
                            for v in range(frm, to + 1):
                                for i, l in links.get(v, []):
                                    if (v, i) not in done and quoted(v, i, short=True):
                                        done.add((v, i))
                                        emit(v, i, work, 'link', [], l, 'word', s)

                        # --- a word found nowhere else
                        if ONCE.search(s) and ABOUT_WORD.search(s):
                            cands = [(v, i, n, o) for v in range(frm, to + 1) for i, n, o in rare.get(v, [])]
                            hit = [c for c in cands if quoted(c[0], c[1]) or any(same_word(greek(words[c[0]][c[1]][0]), g) for g in grk4)]
                            how = 'word'
                            if not hit and frm == to and len(cands) == 1 and not heb3 and not grk4:
                                hit, how = cands, 'verse'
                            if not hit and frm == to and len(cands) > 1:
                                # The English the writer gives: match it to a rare word's own English.
                                low = s.lower()
                                g = [c for c in cands if any(len(x) >= 4 and x in low for x in re.findall(r'[a-z]+', words[c[0]][c[1]][2].lower()))]
                                if len(g) == 1:
                                    hit, how = g, 'gloss'
                            hit = [c for c in hit[:1] if (c[2] == 2) == bool(TWICE.search(s))]
                            for v, i, n, o in hit:
                                # The writer's count and the build's must agree: "nowhere else" is one use,
                                # "nowhere else except in ..." is two.
                                q = s
                                if k + 1 < len(spans):
                                    more = par[spans[k + 1][0]:spans[k + 1][1]].strip()
                                    if MORE.match(more) and usable(more) and len(par[a:spans[k + 1][1]].strip()) <= 420:
                                        q = par[a:spans[k + 1][1]].strip()  # and what he says the word means
                                emit(v, i, work, 'rare', ['rare'], None, how, q, {'uses': n, 'other': names[o] if o is not None else None})

                        # --- a word's force: only where nothing above was found
                        if s not in found and (FORCE_KD if work == 7 else FORCE).search(s) and (heb3 or grk4 or lat):
                            hit = [(v, i) for v in range(frm, to + 1) for i in range(len(words[v])) if quoted(v, i)]
                            if 1 <= len(hit) <= 3:
                                emit(hit[0][0], hit[0][1], work, 'word', [], None, 'word', s)
    for k in sorted(counts):
        sys.stderr.write(f'{k[0]} work {k[1]}: {counts[k]}\n')
    sys.stderr.write(f'{sum(counts.values())} candidates\n')


if __name__ == '__main__':
    main()
