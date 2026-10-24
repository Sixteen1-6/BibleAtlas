"""bmod.py: the Pulpit Commentary, Ellicott and Benson in the MyBible modules of batanus/bible-resources, pinned at
commit 14a8b1a (downloaded to dl/batanus14, not changed). For the Pulpit only the exposition is read: each chapter
section's homilies, from "HOMILETICS" on, are other writers' and are never quoted.

  units(source, book_index, chapter) -> plain-text sections covering that chapter
  url(source) -> the pinned module file
"""
import html, os, re, sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # the scratchpad
SHA = '14a8b1a66198e39a28d6f385c28d5d1061fa89f8'
MOD = {'pulpit': 'TPC', 'ellicott': 'Ellicott-c', 'benson': 'Benson-c'}
NUM = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 190, 220, 230, 240, 250, 260, 290, 300,
       310, 330, 340, 350, 360, 370, 380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530,
       540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700, 710, 720, 730]
READ = "StudyLight's transcription, in the MyBible module at github.com/batanus/bible-resources (commit 14a8b1a)"
_rows = {}


def _plain(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t or ''))).strip()


def _load(src):
    if src not in _rows:
        con = sqlite3.connect(f'file:{ROOT}/dl/batanus14/x/{MOD[src]}/.SQLite3?mode=ro', uri=True)
        _rows[src] = con.execute('select book_number, chapter_number_from, chapter_number_to, text from commentaries').fetchall()
    return _rows[src]


def units(src, book_index, chapter):
    if src not in MOD:
        return []
    bn = NUM[book_index]
    out = []
    for b, c1, c2, t in _load(src):
        if b != bn or not c1:
            continue
        if c1 <= chapter <= (c2 or c1):
            p = _plain(t)
            if src == 'pulpit':
                m = re.search(r'\bHOMILETICS\b|\bHOMILIES BY\b', p)
                if m:
                    p = p[:m.start()]
            out.append(p)
    return out


def url(src):
    return f'https://raw.githubusercontent.com/batanus/bible-resources/{SHA}/modules/{MOD[src]}.commentaries.zip'
