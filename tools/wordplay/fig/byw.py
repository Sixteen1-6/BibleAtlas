"""byw.py: who wrote the quoted words of a work by several hands, for a figure cite's `by` (founder decision 10).

The per-book writers come from the true-credits work (branch wip/true-credits-2026-10-21, commit a6c3af1,
docs/evidence/tools/true_authors.py), which read them from the volumes' title pages. Books it marks as not
re-read or not verified are left out, so a cite there has no `by` and is not quoted.

  by(source, book, at=None) -> the `by` text, or None when the writer is not known for certain
  quotable_here(source, book, chapter) -> None when the work's named writer wrote this part, else the reason not
"""
import re

OT = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
      '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
      'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
      'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi']
NT = ['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
      'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
      'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']
ALL = OT + NT


def run(a, z):
    return ALL[ALL.index(a):ALL.index(z) + 1]


# As the seed notes on main name them (config/figures, PR #58).
JAMIESON = 'Robert Jamieson, Church of Scotland minister'
FAUSSET = 'A. R. Fausset, Church of England clergyman'
BROWN = 'David Brown, Free Church of Scotland minister'
KEIL = 'Carl Friedrich Keil, Lutheran scholar'
DELITZSCH = 'Franz Delitzsch, Lutheran scholar'

# The Pulpit Commentary's exposition, book by book (its homilies are by other hands and are never quoted).
PULPIT = {
    'Genesis': 'Thomas Whitelaw', 'Exodus': 'George Rawlinson', 'Leviticus': 'F. Meyrick',
    'Numbers': 'R. Winterbotham', 'Deuteronomy': 'W. L. Alexander', 'Joshua': 'J. J. Lias', 'Ruth': 'James Morison',
    '1 Samuel': 'R. Payne Smith', '2 Samuel': 'R. Payne Smith', '1 Kings': 'Joseph Hammond',
    '2 Kings': 'George Rawlinson', '2 Chronicles': 'P. C. Barker', 'Ezra': 'George Rawlinson',
    'Psalms': 'George Rawlinson', 'Proverbs': 'W. J. Deane and S. T. Taylor-Taswell',
    'Song of Solomon': 'R. A. Redford', 'Isaiah': 'George Rawlinson', 'Hosea': 'J. J. Given', 'Joel': 'J. J. Given',
    'Amos': 'W. J. Deane', 'Obadiah': 'W. J. Deane', 'Jonah': 'W. J. Deane', 'Micah': 'W. J. Deane',
    'Nahum': 'W. J. Deane', 'Habakkuk': 'W. J. Deane', 'Zephaniah': 'W. J. Deane', 'Haggai': 'W. J. Deane',
    'Zechariah': 'W. J. Deane', 'Malachi': 'W. J. Deane', 'Matthew': 'A. Lukyn Williams and W. J. Deane',
    'Mark': 'E. Bickersteth', 'Luke': 'H. D. M. Spence', 'John': 'H. R. Reynolds', 'Acts': 'Lord A. C. Hervey',
    'Romans': 'J. Barmby', '1 Corinthians': 'F. W. Farrar', 'Galatians': 'E. Huxtable', 'Ephesians': 'W. G. Blaikie',
    'Philippians': 'B. C. Caffin', 'Colossians': 'G. G. Findlay', '1 Thessalonians': 'P. J. Gloag',
    '2 Thessalonians': 'P. J. Gloag', '1 Timothy': 'Lord A. C. Hervey', '2 Timothy': 'Lord A. C. Hervey',
    'Titus': 'Lord A. C. Hervey', 'Philemon': 'S. J. Eales', 'Hebrews': 'J. Barmby', 'James': 'E. C. S. Gibson',
    '1 Peter': 'B. C. Caffin', '2 Peter': 'B. C. Caffin', '1 John': 'A. Plummer', '2 John': 'A. Plummer',
    '3 John': 'A. Plummer', 'Jude': 'S. D. F. Salmond', 'Revelation': 'A. Plummer, with T. Randell and A. T. Bott',
}
# Left out: Judges, Job, Ezekiel and Daniel (not re-read or not verified), 1 Chronicles, Nehemiah and Esther (not
# read), Jeremiah and Lamentations (never cited), Ecclesiastes and 2 Corinthians (decision 20 bars W. J. Deane's
# Ecclesiastes and F. W. Farrar's 2 Corinthians 3:7; 2 Corinthians is left out whole to be safe).

ELLICOTT = {
    'Genesis': 'R. Payne Smith', 'Exodus': 'George Rawlinson', 'Leviticus': 'C. D. Ginsburg',
    'Numbers': 'C. J. Elliott', 'Deuteronomy': 'C. H. Waller', 'Joshua': 'C. H. Waller', 'Judges': 'F. W. Farrar',
    'Ruth': 'R. Sinker', '1 Samuel': 'H. D. M. Spence', '2 Samuel': 'F. Gardiner', '1 Kings': 'Alfred Barry',
    '2 Kings': 'C. J. Ball', '1 Chronicles': 'C. J. Ball', '2 Chronicles': 'C. J. Ball', 'Ezra': 'W. B. Pope',
    'Nehemiah': 'W. B. Pope', 'Esther': 'R. Sinker', 'Job': 'Stanley Leathes', 'Proverbs': 'J. W. Nutt',
    'Isaiah': 'E. H. Plumptre', 'Jeremiah': 'E. H. Plumptre', 'Lamentations': 'E. H. Plumptre',
    'Ezekiel': 'F. Gardiner', 'Daniel': 'H. Deane', 'Hosea': 'H. R. Reynolds and O. C. Whitehouse',
    'Joel': 'S. L. Warren', 'Amos': 'H. R. Reynolds and O. C. Whitehouse', 'Micah': 'S. L. Warren',
    'Nahum': 'A. C. Jennings', 'Habakkuk': 'A. C. Jennings', 'Zephaniah': 'A. C. Jennings',
    'Haggai': 'A. C. Jennings', 'Zechariah': 'W. H. Lowe', 'Malachi': 'W. H. Lowe', 'Matthew': 'E. H. Plumptre',
    'Mark': 'E. H. Plumptre', 'Luke': 'E. H. Plumptre', 'John': 'H. W. Watkins', 'Acts': 'E. H. Plumptre',
    'Romans': 'W. Sanday', '1 Corinthians': 'T. Teignmouth Shore', '2 Corinthians': 'E. H. Plumptre',
    'Galatians': 'W. Sanday', 'Ephesians': 'Alfred Barry', 'Philippians': 'Alfred Barry',
    'Colossians': 'Alfred Barry', '1 Thessalonians': 'A. J. Mason', '2 Thessalonians': 'A. J. Mason',
    '1 Timothy': 'H. D. M. Spence', '2 Timothy': 'H. D. M. Spence', 'Titus': 'H. D. M. Spence',
    'Philemon': 'Alfred Barry', 'Hebrews': 'W. F. Moulton', 'James': 'E. G. Punchard', '1 Peter': 'A. J. Mason',
    '2 Peter': 'A. Plummer', '1 John': 'W. M. Sinclair', '2 John': 'W. M. Sinclair', '3 John': 'W. M. Sinclair',
    'Jude': 'A. Plummer', 'Revelation': 'W. Boyd Carpenter',
}
# Left out: Psalms, Song of Solomon, Obadiah and Jonah (A. S. Aglen, decision 20) and Ecclesiastes (G. Salmon).

# Fathers the Catena quotes, by the name its headings give them, with who each was. Barred fathers (Origen and the
# others in figcheck.BARRED_FATHERS) and the Gloss are not here, so a cite of them has no `by` and is not quoted.
FATHERS = [
    (r'pseudo-?chrysostom', 'an unknown writer once taken for John Chrysostom'),
    (r'chrysostom', 'John Chrysostom, Archbishop of Constantinople'),
    (r'augustine|augustin|aug\.', 'Augustine, Bishop of Hippo'),
    (r'jerome', 'Jerome, priest and Bible translator'),
    (r'ambrose', 'Ambrose, Bishop of Milan'),
    (r'hilary', 'Hilary, Bishop of Poitiers'),
    (r'gregory of nyssa|greg\. nyss', 'Gregory, Bishop of Nyssa'),
    (r'gregory nazianzen|gregory of nazianzus|greg\. naz', 'Gregory of Nazianzus, Archbishop of Constantinople'),
    (r'gregory', 'Gregory the Great, Bishop of Rome'),
    (r'\bbede\b', 'Bede, English monk and scholar'),
    (r'theophylact', 'Theophylact, Archbishop of Ohrid'),
    (r'cyril', 'Cyril, Bishop of Alexandria'),
    (r'athanasius', 'Athanasius, Bishop of Alexandria'),
    (r'basil', 'Basil, Bishop of Caesarea'),
    (r'\bleo\b', 'Leo the Great, Bishop of Rome'),
    (r'rabanus|raban', 'Rabanus Maurus, Archbishop of Mainz'),
    (r'remigius', 'Remigius of Auxerre, monk and teacher'),
    (r'alcuin', 'Alcuin of York, deacon and scholar'),
    (r'titus of bostra|^titus', 'Titus, Bishop of Bostra'),
    (r'cyprian', 'Cyprian, Bishop of Carthage'),
    (r'damascene|john of damascus', 'John of Damascus, monk and theologian'),
    (r'isidore', 'Isidore, Bishop of Seville'),
    (r'eusebius', 'Eusebius, Bishop of Caesarea'),
    (r'anselm', 'Anselm, Archbishop of Canterbury'),
    (r'severianus|severian', 'Severian, Bishop of Gabala'),
    (r'maximus', 'Maximus the Confessor, monk'),
    (r'ignatius', 'Ignatius, Bishop of Antioch'),
    (r'gennadius', 'Gennadius, Patriarch of Constantinople'),
]
BARRED = ['origen', 'didymus', 'theodore of mopsuestia', 'pelagius', 'arius', 'nestorius', 'apollinaris', 'evagrius',
          'tatian', 'novatian', 'tertullian', 'theodoret', 'hippolytus', 'victorinus', 'clement of alexandria', 'gloss',
          'dionysius', 'ammonius', 'apollinarius']


def father(at):
    """The `by` for a Catena cite whose `at` names the Father quoted, or None."""
    a = (at or '').lower()
    if not a or any(re.search(r'\b' + b + r'\b', a) for b in BARRED):
        return None
    head = a.split(',')[0]
    for pat, who in FATHERS:
        if re.search(pat, head):
            return who
    return None


def by(source, book, at=None):
    if source == 'jfb':
        if book in run('Genesis', 'Esther'):
            return JAMIESON
        if book in run('Job', 'Malachi') or book in run('1 Corinthians', 'Revelation'):
            return FAUSSET
        return BROWN
    if source == 'keil-delitzsch':
        if book in NT:
            return None
        return DELITZSCH if book in ('Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah') else KEIL
    if source == 'pulpit':
        w = PULPIT.get(book)
        return f'{w}, who wrote its {book} exposition' if w else None
    if source == 'ellicott':
        w = ELLICOTT.get(book)
        return f'{w}, who wrote its {book} notes' if w else None
    if source == 'catena-aurea':
        return father(at)
    return None


MULTI = {'jfb', 'keil-delitzsch', 'pulpit', 'ellicott', 'catena-aurea'}


def quotable_here(source, book, chapter):
    """Beyond the build's only_on list: the parts of single-name works their named writer did not write."""
    if source == 'poole' and not (book in run('Genesis', 'Isaiah') and not (book == 'Isaiah' and chapter > 58)):
        return 'Matthew Poole wrote Genesis to Isaiah 58; the rest is his continuators\''
    if source in MULTI and by(source, book) is None and source != 'catena-aurea':
        return f'the writer of its {book} volume is not known for certain'
    return None


if __name__ == '__main__':
    # python3 -I byw.py <source> "<ref>" ["<at>"]: the by to give a cite of that work there, or why it is not quoted
    import sys
    sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
    import figcheck as fc
    src, ref = sys.argv[1], sys.argv[2]
    at = sys.argv[3] if len(sys.argv) > 3 else None
    r = fc.resolve(ref)
    if not r:
        sys.exit(f'{ref!r} is not a reference')
    b, ch, v = fc.locate(r[0])
    book = fc.BOOKS[b]['name']
    s = fc.CITE.get(src)
    why = None
    if not s:
        why = 'not on the cite list'
    elif src not in fc.QUOTABLE or src in ('wesley', 'net-notes'):
        why = f"{s['name']} is not quotable in figure notes"
    elif src in fc.ONLY_ON and not any(f <= b <= l for f, l in fc.ONLY_ON[src]):
        why = f"{s['name']} is quoted only on the books its named writer wrote, not {book}"
    else:
        why = fc.BARRED_BOOKS.get((src, book)) or fc.BARRED_VERSES.get((src, book, ch, v)) or quotable_here(src, book, ch)
    if not why and src in MULTI:
        w = by(src, book, at)
        if not w:
            why = 'the writer of that part is not known for certain' + (' (or the Father is left out)' if src == 'catena-aurea' else '')
        else:
            print(f'by: {w}')
            sys.exit(0)
    if why:
        print(f'NOT QUOTED HERE: {why}')
        sys.exit(1)
    print('no by needed (one writer)')
