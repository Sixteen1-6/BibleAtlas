"""plan.py: the 12 next figures from the figure catalogue (List every figure thread), each under its real name.
Writes forms12.json (the proposed forms) and entries.json (the verses to write, with Bullinger's entry line in fos.txt
when he lists the verse under the heading). Verses Bullinger lists that are left out, and why, go to left_out."""
import json, sys
sys.path.insert(0, '.')
from fossec import entries

FORMS = [
 # id, label (the figure's real name), Bullinger's term, plain about (catalogue), heading line in fos.txt
 ('acrostic', 'Acrostic', 'Acrostichion', 'Lines or verses begin with the letters of the Hebrew alphabet in order.', 4847),
 ('type', 'Type', 'Type', 'A person, thing or event points ahead to a later one, often Christ.', 23519),
 ('allegory', 'Allegory', 'Allegory', 'A picture is carried on through a whole passage.', 23041),
 ('parable', 'Parable', 'Parabola', 'A likeness is drawn out into a short story.', 23106),
 ('antithesis', 'Antithesis', 'Antithesis', 'Two phrases are set side by side to show their difference.', 22160),
 ('antimetabole', 'Antimetabole', 'Antimetabole', 'Words are repeated in reverse order to set two things against each other.', 9053),
 ('aposiopesis', 'Aposiopesis', 'Aposiopesis', 'The speaker breaks off mid-sentence, as if feeling is too strong to finish.', 3989),
 ('meiosis', 'Meiosis', 'Meiosis', 'One thing is belittled so that another is seen as greater.', 4087),
 ('exclamation', 'Exclamation', 'Ecphonesis', 'Feeling shown by crying out.', 28076),
 ('riddle', 'Riddle', 'Ænigma', 'A truth is told in hidden words to be worked out.', 23589),
 ('hypocatastasis', 'Hypocatastasis', 'Hypocatastasis', 'Only the picture is given and the thing meant is left implied.', 22971),
 ('proverb', 'Proverb', 'Parœmia', 'A short common saying is used to make a point.', 23188),
]

# verses Bullinger lists that are left out, with the reason
SKIP = {
 'acrostic': {'Psalm 24:1-10': 'a misprint in the module for Psalm 34 (added below)', 'Psalm 96:11': 'a hidden name in the Hebrew letters, resting on a scribal note', 'Psalm 96:1-13': 'part of the Psalm 96:11 entry', 'Esther 7:5': 'a hidden name in the Hebrew letters, resting on a scribal note', 'John 3:16': 'an English letter pattern, not in the Greek'},
 'antithesis': {'Romans 15:12': "Bullinger's point there is a reading of the Greek, not a contrast"},
 'parable': {'1 Samuel 10:12': 'Bullinger names it under Parabola only to show the Hebrew word; written under Proverb'},
 'aposiopesis': {'Acts 23:9': 'rests on a reading of some manuscripts'},
 'meiosis': {'Matthew 15:26': 'written under Hypocatastasis instead'},
 'allegory': {'Matthew 3:10': 'written under Hypocatastasis instead', 'Matthew 7:3-5': 'written under Hypocatastasis instead', 'Matthew 5:13': 'a metaphor note on it is being written'},
 'hypocatastasis': {'Psalm 22:16': 'written already (pending its page)', 'Matthew 16:6': 'written already (pending its page)', 'Acts 20:29': 'written already (pending its page)'},
}
PROVERB_KEEP = {'Genesis 10:9', 'Numbers 21:27', '1 Samuel 10:12', '1 Samuel 24:13', '2 Samuel 20:18', 'Jeremiah 31:29',
                'Ezekiel 16:44', 'Luke 4:23', 'John 1:46', 'John 4:37', '2 Peter 2:22', 'Genesis 22:14', '1 Kings 20:11',
                'Jeremiah 13:23', 'Jeremiah 23:28', 'Habakkuk 2:6', 'Malachi 2:10', 'Matthew 5:14', 'Matthew 6:21',
                'Matthew 6:24', 'Matthew 9:12', 'Matthew 10:10', 'Matthew 12:34', 'Matthew 13:57', 'Matthew 15:14',
                'Matthew 24:28', 'Acts 9:5', 'Acts 20:35', '1 Corinthians 5:6', 'Ecclesiastes 9:4', 'Ecclesiastes 10:1'}
# verses added beside Bullinger's entries (the batch lead says where each comes from)
ADD = {
 'acrostic': ['Psalm 34:1-22'],
 'type': ['Romans 5:14', 'Hebrews 9:24', '1 Peter 3:21', 'Hebrews 8:5', 'Hebrews 10:1', 'Colossians 2:17', 'Hebrews 9:9',
          'John 3:14', 'Matthew 12:40', '1 Corinthians 5:7', 'John 6:32', 'Hebrews 11:19'],
 'parable': ['2 Samuel 12:1-4', '2 Samuel 14:5-7', '1 Kings 20:39-40', 'Ezekiel 24:3', 'Matthew 13:3',
             'Matthew 13:24', 'Matthew 13:47', 'Luke 15:4', 'Luke 15:8', 'Luke 18:1', 'Luke 12:16', 'Matthew 21:33',
             'Luke 7:41', 'Matthew 18:23'],
 'allegory': ['Psalm 80:8-16', 'John 10:1-16', 'John 15:1-6', 'Galatians 4:24', 'Ephesians 6:11-17', 'Ecclesiastes 12:1-7'],
 'exclamation': ['Romans 11:33'],
 'meiosis': ['1 Timothy 1:15', 'Genesis 32:10'],
 'riddle': ['1 Corinthians 13:12', 'Revelation 13:18', 'Numbers 12:8', 'Psalm 49:4', 'Psalm 78:2'],
}
WHERE = {
 'type': 'a verse where the New Testament itself names the type (Bullinger, under Type, keeps the name to these)',
 'parable': 'Bullinger gives no list of parables; these are parables the Bible itself explains or applies',
 'allegory': 'a passage commentators call an allegory or a picture carried through',
 'riddle': 'a verse where the Bible itself speaks of a dark saying, a riddle or a puzzling statement',
 'acrostic': 'Bullinger names Psalm 34 with Psalm 25',
 'exclamation': 'the catalogue names it ("O, the depth of the riches")',
 'meiosis': 'Bullinger names it under Ephesians 3:8 ("the chief of sinners") / a like case',
}
LEFT_TYPE = ['1 Corinthians 10:4', '1 Corinthians 10:6', '1 Corinthians 10:11', 'Hebrews 7:3']

forms, out, left = [], [], []
for fid, label, term, about, line in FORMS:
    forms.append({'id': fid, 'kind': 'figure', 'label': label, 'term': term, 'about': about, 'line': line})
    _, es = entries(line)
    seen = set()
    vs = []
    for e in es:
        r = e['ref']
        if r in seen:
            continue
        seen.add(r)
        if r in SKIP.get(fid, {}):
            left.append({'form': fid, 'ref': r, 'why': SKIP[fid][r]}); continue
        if fid == 'proverb' and r not in PROVERB_KEEP:
            left.append({'form': fid, 'ref': r, 'why': 'not framed as a common saying in the text, or a verse of Proverbs itself'}); continue
        if fid == 'acrostic' and r == 'Psalm 9:1-20':
            continue  # one note for Psalms 9 and 10 sits on Psalm 9 (below)
        vs.append({'ref': 'Psalm 9:1-20' if (fid == 'acrostic' and r == 'Psalm 10:1-18') else r, 'fos_line': e['line'], 'fos': e['text'][:1400]})
    for r in ADD.get(fid, []):
        if r not in seen:
            vs.append({'ref': r, 'fos_line': None, 'fos': '', 'why': WHERE.get(fid, '')})
    out.append({'form': fid, 'verses': vs})
for r in LEFT_TYPE:
    left.append({'form': 'type', 'ref': r, 'why': 'a live Layers pattern note in the same chapter already shows this type'})
json.dump({'forms': forms}, open('forms12.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'entries': out, 'left_out': left}, open('entries.json', 'w'), ensure_ascii=False, indent=1)
for o in out:
    print(o['form'], len(o['verses']), [v['ref'] for v in o['verses']])
print(len(left), 'left out;', sum(len(o['verses']) for o in out), 'verses')
