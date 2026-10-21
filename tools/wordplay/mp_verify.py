#!/usr/bin/env python3
"""Check minor-prophet candidates against the local sacred-texts commentaries (kad, gill, jfb, clarke, barnes).
Usage: python3 -I mp_verify.py [filter-substring]"""
import json, re, sys, os, html, collections
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
V = W + '/src/mb/sacred_obsidian_vault/bib/cmt'
WORK = {'keil-delitzsch': 'kad', 'gill': 'gill', 'jfb': 'jfb', 'clarke': 'clarke', 'barnes': 'barnes'}
NAMES = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalm','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation']
ABBR = 'Gen Exo Lev Num Deu Jos Jdg Rut Sa1 Sa2 Kg1 Kg2 Ch1 Ch2 Ezr Neh Est Job Psa Pro Ecc Sol Isa Jer Lam Eze Dan Hos Joe Amo Oba Jon Mic Nah Hab Zep Hag Zac Mal Mat Mar Luk Joh Act Rom Co1 Co2 Gal Eph Phi Col Th1 Th2 Ti1 Ti2 Tit Plm Heb Jam Pe1 Pe2 Jo1 Jo2 Jo3 Jde Rev'.split()
AB = dict(zip(NAMES, ABBR)); AB['Psalms'] = 'Psa'
FILE = {'Hosea': 'hos', 'Joel': 'joe', 'Amos': 'amo', 'Obadiah': 'oba', 'Jonah': 'jon', 'Micah': 'mic', 'Nahum': 'nah', 'Habakkuk': 'hab', 'Zephaniah': 'zep', 'Haggai': 'hag', 'Zechariah': 'zac', 'Malachi': 'mal'}

def text(h):
    h = re.sub(r'<(?:p|br|div)[^>]*>', '\n', h)
    h = re.sub(r'<[^>]+>', '', h)
    return re.sub(r'[ \t]+', ' ', html.unescape(h)).strip()

_cache = {}
def notes(work, book, ch):
    key = (work, book, ch)
    if key in _cache: return _cache[key]
    p = f'{V}/{work}/{FILE[book]}{ch:03d}.md'
    out = collections.defaultdict(str)
    if os.path.exists(p):
        raw = open(p, encoding='utf-8', errors='replace').read()
        parts = re.split(r'<a name="an_(\d+)">', raw)
        intro = parts[0]
        out[0] = text(intro)
        for i in range(1, len(parts), 2):
            out[int(parts[i])] += '\n' + text(parts[i + 1])
    _cache[key] = out
    return out

def note(work, ref, span=0):
    m = re.match(r'^(.+?) (\d+):(\d+)$', ref)
    b, c, v = m.group(1), int(m.group(2)), int(m.group(3))
    n = notes(work, b, c)
    return '\n'.join(n.get(x, '') for x in range(v - span, v + span + 1))

def refs_in(s):
    out = []
    for m in re.finditer(r'((?:[123] )?[A-Z][a-z]+(?: of Solomon)?) (\d+):(\d+)', s):
        if m.group(1) in AB: out.append((AB[m.group(1)], int(m.group(2)), int(m.group(3))))
    for m in re.finditer(r'((?:[123] )?[A-Z][a-z]+) (\d+)-(\d+)\)', s):
        if m.group(1) in AB: out.append((AB[m.group(1)], int(m.group(2)), 0))
    return out

if __name__ == '__main__':
    flt = sys.argv[1] if len(sys.argv) > 1 else ''
    cands = json.load(open(f'{W}/mp_out.json'))['candidates']
    for c in cands:
        if flt and flt not in c['ref']: continue
        tgt = refs_in(c['what'] + ' ' + c.get('target', ''))
        print(f"\n## {c['ref']} [{c['kind']}/{c['sure']}] -> {c.get('target','')}")
        for s in c['sources']:
            w = WORK.get(s['source'])
            if not w:
                print(f"   {s['source']}: (not local)"); continue
            t = note(w, s['on'], 3 if w == 'kad' else 1)
            found = sorted({f'{a} {ch}' for a, ch, v in tgt if re.search(rf'\b{a} {ch}:', t)})
            kw = sorted({m.group(0).lower() for m in re.finditer(r'paronomas\w*|play\w* (?:up)?on|allu\w+|similarity of sound|assonance|signif\w+|alliterat\w+|borrowed|taken from|reminds|recall\w*|as in the days', t, re.I)})
            print(f"   {s['source']} on {s['on']}: refs={found} kw={kw} len={len(t)}")
