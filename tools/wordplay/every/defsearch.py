#!/usr/bin/env python3
"""defsearch.py "<regex>" [work ...] [--max N]: sentences in the local commentaries that match a regex (case-insensitive),
with the work and the verse the remark is under. Works: barnes clarke jfb kad (Keil and Delitzsch) mhc (Henry's complete)
calvin; default all six. Leads only: quote a sentence only after reading its whole remark with cq.py <work> "<ref>"."""
import json, os, re, sys, html
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAULT = f'{W}/src/mb/sacred_obsidian_vault/bib/cmt'
LC = f'{W}/src/lc'
BK = {'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers', 'DEU': 'Deuteronomy', 'JOS': 'Joshua', 'JDG': 'Judges', 'RUT': 'Ruth', '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Kings', '2KI': '2 Kings', '1CH': '1 Chronicles', '2CH': '2 Chronicles', 'EZR': 'Ezra', 'NEH': 'Nehemiah', 'EST': 'Esther', 'JOB': 'Job', 'PSA': 'Psalms', 'PRO': 'Proverbs', 'ECC': 'Ecclesiastes', 'SNG': 'Song of Solomon', 'ISA': 'Isaiah', 'JER': 'Jeremiah', 'LAM': 'Lamentations', 'EZK': 'Ezekiel', 'DAN': 'Daniel', 'HOS': 'Hosea', 'JOL': 'Joel', 'AMO': 'Amos', 'OBA': 'Obadiah', 'JON': 'Jonah', 'MIC': 'Micah', 'NAM': 'Nahum', 'HAB': 'Habakkuk', 'ZEP': 'Zephaniah', 'HAG': 'Haggai', 'ZEC': 'Zechariah', 'MAL': 'Malachi', 'MAT': 'Matthew', 'MRK': 'Mark', 'LUK': 'Luke', 'JHN': 'John', 'ACT': 'Acts', 'ROM': 'Romans', '1CO': '1 Corinthians', '2CO': '2 Corinthians', 'GAL': 'Galatians', 'EPH': 'Ephesians', 'PHP': 'Philippians', 'COL': 'Colossians', '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy', '2TI': '2 Timothy', 'TIT': 'Titus', 'PHM': 'Philemon', 'HEB': 'Hebrews', 'JAS': 'James', '1PE': '1 Peter', '2PE': '2 Peter', '1JN': '1 John', '2JN': '2 John', '3JN': '3 John', 'JUD': 'Jude', 'REV': 'Revelation'}
ST = ['gen', 'exo', 'lev', 'num', 'deu', 'jos', 'jdg', 'rut', 'sa1', 'sa2', 'kg1', 'kg2', 'ch1', 'ch2', 'ezr', 'neh', 'est', 'job', 'psa', 'pro', 'ecc', 'sol', 'isa', 'jer', 'lam', 'eze', 'dan', 'hos', 'joe', 'amo', 'oba', 'jon', 'mic', 'nah', 'hab', 'zep', 'hag', 'zec', 'mal', 'mat', 'mar', 'luk', 'joh', 'act', 'rom', 'co1', 'co2', 'gal', 'eph', 'phi', 'col', 'th1', 'th2', 'ti1', 'ti2', 'tit', 'phm', 'heb', 'jam', 'pe1', 'pe2', 'jo1', 'jo2', 'jo3', 'jde', 'rev']
NAMES = list(BK.values())
SENT = re.compile(r'(?<=[.!?])\s+(?=[A-Z"(\[])')


def main(a):
    mx = 40
    if '--max' in a:
        i = a.index('--max'); mx = int(a[i + 1]); del a[i:i + 2]
    rx = re.compile(a[0], re.I)
    works = a[1:] or ['barnes', 'clarke', 'jfb', 'kad', 'mhc', 'calvin']
    n = 0
    for w in works:
        if w in ('mhc', 'calvin'):
            for e in json.load(open(f'{LC}/{w}.json'))['entries']:
                body = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', e['body'])))
                for s in SENT.split(body):
                    if rx.search(s):
                        print(f"{w} | {BK.get(e['book'], e['book'])} {e['chapter']}:{e['verse']} | {s[:600]}")
                        n += 1
                        if n >= mx: return
        else:
            d = f'{VAULT}/{w}'
            for fn in sorted(os.listdir(d)):
                m = re.match(r'([a-z0-9]{3})(\d{3})\.md$', fn)
                if not m or m.group(1) not in ST: continue
                book = NAMES[ST.index(m.group(1))]
                cur = None
                for line in open(f'{d}/{fn}', encoding='utf-8', errors='replace'):
                    h = re.match(r'^[a-z0-9]{3} (\d+):(\d+)', line)
                    if h: cur = f'{book} {h.group(1)}:{h.group(2)}'
                    for s in SENT.split(line.strip()):
                        if rx.search(s):
                            print(f"{w} | {cur or book + ' ' + str(int(m.group(2)))} | {s[:600]}")
                            n += 1
                            if n >= mx: return


if __name__ == '__main__':
    main(sys.argv[1:])
