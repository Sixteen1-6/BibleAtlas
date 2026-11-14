"""mk_final.py: cl/final.json from the verified Stage A groups (cl/groups/<g>.json, the skeptic's "corrected"),
with this thread's decisions:
  pulpit: both cites quote T. Croskery's homilies, not Hervey's Exposition: no part, both cites out.
  fathers: Lactantius left out (the Gelasian Decree lists his works with Tertullian's, Victorinus's and Clement of
    Alexandria's, all barred here); Cyprian read on CCEL (New Advent failed).
  henry: one part per book (as main's henry-continuators); henry-concise's 2 Timothy part widened to 1 Timothy,
    its record too (the preface words already name both books).
  other: at gives only the place in the work, as main's work cites do.
  shelf: new works on their cards, with the card text widened to say what they now hold."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
G = {g: json.load(open(f'{HERE}/cl/groups/{g}.json'))['verify']['corrected'] for g in ('henry', 'ellicott', 'pulpit', 'fathers', 'tgc', 'other')}
F = {'sites': [{'host': 'firstthings.com', 'name': 'First Things'}], 'writers': [], 'works': [], 'cite_works': [], 'parts': [],
     'part_changes': [], 'records': [], 'record_changes': [], 'cite_fixes': [], 'reads': [], 'left_out': [], 'shelf_changes': []}
LACT = 'lactantius'

# henry
h = G['henry']
F['parts'] += [{'source': 'henry', 'part': {'books': [b], 'work': 'henry-complete', 'writers': ['benjamin-andrews-atkinson'], 'evidence': 'henry-atkinson-timothy'}}
               for b in ('1 Timothy', '2 Timothy')]
F['part_changes'].append({'source': 'henry-concise', 'books_old': ['2 Timothy'], 'books_new': ['1 Timothy', '2 Timothy']})
F['record_changes'].append({'file': 'docs/evidence/credits-2026-10-21.json', 'id': 'henry-concise', 'add_books': ['1 Timothy'],
                            'parts_books_old': ['2 Timothy'], 'parts_books_new': ['1 Timothy', '2 Timothy']})
F['records'] += h['records']
F['reads'] += h['reads']
# ellicott
e = G['ellicott']
F['parts'] += e['parts']
F['records'] += e['records']
F['reads'] += e['reads']
# pulpit: nothing but the left-outs
F['left_out'] += G['pulpit']['left_out']
# fathers
f = G['fathers']
F['works'] += [w for w in f['works'] if LACT not in w['id']]
F['writers'] += [w for w in f['writers'] if w['id'] != LACT]
F['records'] += [r for r in f['records'] if LACT not in r['id']]
F['reads'] += [r for r in f['reads'] if 'lactantius' not in r['url']]
F['cite_fixes'] += [c for c in f['cite_fixes'] if 'Lactantius' not in (c.get('at') or '')]
F['left_out'].append({'passage': 'matthew-27-45', 'note': 2, 'source': 'church-fathers', 'on': 'Matthew 27:45',
                      'why': "Lactantius is left out: the Gelasian Decree lists his works as not to be read, with those of Tertullian, Victorinus and Clement of Alexandria, whom the cite list already bars. His cited words respect Scripture; the founder may rule on him."})
F['cite_works'] += [{'source': 'church-fathers', 'work': w} for w in ('cyprian-testimonies', 'cyril-catechetical-lectures', 'chrysostom-father-if-it-be-possible', 'chrysostom-2-timothy')]
F['cite_works'].append({'source': 'chrysostom', 'work': 'chrysostom-romans'})
# tgc
t = G['tgc']
for k in ('works', 'writers', 'records', 'reads', 'cite_fixes'):
    F[k] += t[k]
F['cite_works'] += [{'source': 'gospel-coalition', 'work': w} for w in ('bolt-luke', 'tabb-revelation', 'gladd-twice-healed', 'carson-equipped-man')]
F['cite_works'].append({'source': 'keener', 'work': 'keener-spiritual-warfare'})
# other
o = G['other']
for k in ('works', 'writers', 'records', 'reads'):
    F[k] += o[k]
AT = {'isaiah-13-4': None, 'isaiah-24-1': None, 'mark-8-18': 'under An Object Lesson',
      '1-timothy-1-18': 'in the opening section, before section 1', 'hebrews-1-1': 'under heading 4, Biblical preaching is an oral event'}
for c in o['cite_fixes']:
    c = dict(c)
    c['at_new'] = AT[c['passage']] or ''
    F['cite_fixes'].append(c)
F['cite_works'] += [{'source': 'leithart', 'work': w} for w in ('leithart-roe-host-glory', 'leithart-structure-and-poetry-isaiah-24')]
F['cite_works'].append({'source': 'ligonier', 'work': 'sproul-blind-man-peters-confession'})
F['cite_works'] += [{'source': 'themelios', 'work': w} for w in ('beale-fighting-the-good-fight', 'selvaggio-preaching-advice-hebrews')]

# the quotation each public-domain read records: the cited words as the page prints them, "..." where the note skips words
Q = {
    ('matthew-27-45', 'Amos 8:9', 'ccel.org/ccel/cyprian'): lambda w: ' '.join(w[:4]) + ' ... ' + ' '.join(w[4:]),
    ('romans-12-13', 'Romans 12:13', 'chrysostom'): lambda w: ' '.join(w[:2]) + ' ... ' + w[2],
    ('2-timothy-3-2', '2 Timothy 3:2', 'newadvent.org/fathers/230707'): lambda w: ' '.join(w[:3]) + ' ... ' + ' '.join(w[3:]),
    ('1-timothy-1-18', '1 Timothy 1:18', 'ellicott'): lambda w: ' ... '.join(w),
}
fix_at = {(c['passage'], c['note'], c['source'], c['on'], c.get('url')): c for c in F['cite_fixes']}
for r in F['reads']:
    if r.get('pointer') or not r.get('words'):
        continue
    fn = next((fn for (p, on, u), fn in Q.items() if r['passage'] == p and r['on'] == on and u in r['url']), None)
    r['quote'] = fn(r['words']) if fn else ' '.join(r['words'])
# each read carries its cite's at after the fix, so the build pairs them
for r in F['reads']:
    cands = [c for c in F['cite_fixes'] if (c['passage'], c['note'], c['source'], c['on']) == (r['passage'], r['note'], r['source'], r['on'])]
    if len(cands) > 1:   # two cites of one source on one verse: the fix that moved the cite to this page, else the one that moved none
        same = [c for c in cands if c.get('url') == r['url']]
        cands = same or [c for c in cands if not c.get('url')]
    if len(cands) > 1:
        raise SystemExit(f'two fixes for one read: {r["passage"]} {r["on"]}')
    if cands:
        c = cands[0]
        r['at'] = c['at_new'] if 'at_new' in c else (c.get('at') or '')
for rec in F['records']:
    rec['_read'] = '2026-11-07'
F['records_comment'] = [
    "Who wrote the words of the works and book parts added to the Layers cite list for the Wordplay thread's held passages (2026-11-07). Each record gives the words that name the writer, as printed or as the page shows them, and where they were read; all were read on 2026-11-07 by a first reader and checked again by a second.",
    "The Gospel Coalition, Themelios, Ligonier, Theopolis, First Things and IVP pages are copyrighted: the records hold the byline only, and nothing of them is quoted anywhere.",
]

# shelf cards
S = F['shelf_changes']
S.append({'card': 'church-fathers', 'set': {
    'title': 'The church fathers, as New Advent and the Christian Classics Ethereal Library give them',
    'by': 'Justin Martyr, Irenaeus, Clement of Rome, Cyprian, Cyril of Jerusalem, Gregory of Nazianzus, Jerome, Athanasius, Augustine, John Chrysostom, and the unknown writer of the Epistle of Barnabas',
    'citation': 'The Ante-Nicene Fathers (1885 to 1896) and the Nicene and Post-Nicene Fathers (1888 to 1894), read on New Advent (newadvent.org/fathers), revised and edited there by Kevin Knight, and on the Christian Classics Ethereal Library (ccel.org).'},
    'layer_add': ['cyprian-testimonies', 'cyril-catechetical-lectures', 'chrysostom-father-if-it-be-possible', 'chrysostom-2-timothy', 'chrysostom-romans']})
S.append({'card': 'themelios', 'set': {
    'by': "The Gospel Coalition's journal; articles by Torleif Elgvin, Jey J. Kanagaraj, David L. Baker, Walter Riggans, R. T. France, Matt Champlin, Bruce Reichenbach, David V. Christensen, G. K. Beale and Anthony T. Selvaggio"},
    'layer_add': ['beale-fighting-the-good-fight', 'selvaggio-preaching-advice-hebrews']})
S.append({'card': 'gospel-coalition', 'set': {}, 'layer_add': ['bolt-luke', 'tabb-revelation', 'gladd-twice-healed', 'carson-equipped-man']})
S.append({'card': 'ligonier', 'set': {}, 'layer_add': ['sproul-blind-man-peters-confession']})
S.append({'card': 'leithart', 'set': {
    'title': 'Essays by Peter J. Leithart',
    'what': "Short essays by a Reformed theologian on reading the Bible: Firstborn (2011), Roe, Host, Glory (2011) and What's in a Name? (2014) at the Theopolis Institute, and Structure and Poetry in Isaiah 24 (2011) in First Things.",
    'citation': "Peter J. Leithart, \"Firstborn\" (2011), \"Roe, Host, Glory\" (2011) and \"What's in a Name?\" (2014), Theopolis Institute, theopolisinstitute.com; \"Structure and Poetry in Isaiah 24\" (2011), First Things, firstthings.com."},
    'layer_add': ['leithart-roe-host-glory', 'leithart-structure-and-poetry-isaiah-24']})
S.append({'card': 'keener', 'set': {
    'plain': 'Bible background articles and a book chapter',
    'title': 'Writings by Craig S. Keener',
    'when': '2012 and 2016',
    'what': "Short articles on the setting of passages in Genesis (Bible Backgrounds, 2016), and his chapter Paul and Spiritual Warfare in Paul's Missionary Methods (2012), read in an excerpt posted with the publisher's permission.",
    'citation': "Craig S. Keener, \"Jacob gets Esau's blessing\" and \"Sleeping with a prostitute part 2\" (2016), Bible Backgrounds, craigkeener.com; \"Paul and Spiritual Warfare,\" in Robert L. Plummer and John Mark Terry, eds., Paul's Missionary Methods: In His Time and Ours (IVP Academic, 2012), excerpted at thegospelcoalition.org."},
    'layer_add': ['keener-spiritual-warfare']})

json.dump(F, open(f'{HERE}/cl/final.json', 'w'), indent=1, ensure_ascii=False)
print({k: len(v) for k, v in F.items() if isinstance(v, list)})
for r in F['reads']:
    print(r['passage'], r['note'], r['source'], r['on'], '| at:', r.get('at'), '|', (r.get('quote') or ('POINTER ' + r.get('pointer', '')))[:110])
