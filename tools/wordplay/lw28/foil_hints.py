"""foil_hints.py: adds the local-work check of 2026-11-01 (docs/local-work/2026-10-20/NOT-BUILT-YET.md, PR #67,
reader 2) to the contrast leads of the catalogue's foil rows, so the writer knows which quotable writers that check
found and what each row still needs. Hints only: every quote is still read and checked."""
import json, os, re, sys
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
THIRD = ('A third quotable writer the cite list names for that book is needed for "widely agreed": Benson, Ellicott, '
         'Maclaren, Edersheim, Calvin, Clarke or (New Testament) Bengel; Poole has a named writer only on Genesis to Song '
         'of Solomon, Isaiah 1 to 58 and Romans; Henry only on Genesis to Acts. Otherwise it ships as "commonly held".')
SECOND = 'A second quotable writer is needed to rise above "some interpreters" (record the page and the exact words).'
H = {
 1: 'Strong pair (3+). Scripture: Hebrews 11:4, 1 John 3:12 (put in refs). Quotable writers found: Henry on 4:3, Clarke on 4:5, Calvin on 4:4.',
 4: 'Strong pair (3+). Galatians 4:22-31. Quotable writers found: Fausset in JFB on Gal 4:27, Barnes on 4:21, Calvin on 4:22. Galatians 4 never names Sarah, so that side\'s who must be words the BSB of its verses uses, such as "the free woman"; check with vw.py.',
 25: 'Strong pair (3+): Psalm 1 as a whole-psalm contrast, 1:1-3 against 1:4-6. Quotable writers found: Henry on 1:1, Clarke on 1:1, Delitzsch (Keil and Delitzsch) on 1:4. The split rests on the psalm\'s own "Not so the wicked!" (1:4); never credit it to Spurgeon, who is not quotable and is cited only on Psalms 104 to 118. Psalm 1:6 already has a live opposite-lines note; do not repeat it.',
 29: 'Strong pair (3+). Quotable writers found: Brown in JFB on Luke 10:39 and 10:42, Calvin on 10:38, Bengel on 10:39. Be fair to Martha: Jesus does not condemn her service.',
 33: 'Strong pair (3+). Quotable writers found: Henry on Luke 18:9, Brown in JFB on 18:11, Barnes on 18:13, Calvin on 18:14, Bengel on 18:10-11.',
 37: 'Strong pair (3+). Quotable writers found: Brown in JFB on Luke 23:43, Barnes on 23:42, Calvin on 23:41.',
 40: 'Strong pair (3+): Adam and Christ, Romans 5:12-21. Quotable writers found: Bullinger, Figures of Speech, under Antithesis on 5:19 (confirm the book itself lists it, not only the Companion Bible, and give its printed page), Brown in JFB on 5:15, Barnes on 5:12, Calvin on 5:12, Clarke on 5:12.',
 2: 'Two quotable writers found: Henry on Gen 4:25, Calvin on 4:25. ' + THIRD,
 5: 'Two quotable writers found: Fausset in JFB on Gal 4:29, Barnes on Gal 4:29. ' + THIRD,
 6: 'Two quotable writers found: Calvin on Gen 25:27, Henry on 25:29. Romans 9:13 and Hebrews 12:16 draw it too (refs). ' + THIRD,
 7: 'Two quotable writers found: Henry on Gen 29:31, Calvin on 29:18. ' + THIRD,
 12: 'Two quotable writers found: Henry on 1 Sam 2:11, Keil on 2:17-18. The Repeated Alternation layout of 1 Samuel 1:1 to 4:1 is the Companion Bible\'s and cannot be quoted. ' + THIRD,
 13: 'Two quotable writers found: Bullinger on 2 Sam 3:1 (confirm the entry and printed page in Figures of Speech itself, not only the Companion Bible), Henry on 1 Sam 16:14. ' + THIRD,
 15: 'Two quotable writers found: Henry on 1 Sam 25:2, Keil on 25:3. ' + THIRD,
 16: 'Two quotable writers found: Henry and Clarke on 2 Sam 11:11. ' + THIRD,
 17: 'Two quotable writers found: Keil on 2 Kgs 5:27, Clarke on 5:27. ' + THIRD,
 20: 'Two quotable writers found: Henry on Esther 6:1, Jamieson in JFB on 7:10 and 8:2. ' + THIRD,
 23: 'Two quotable writers found: Fausset in JFB on Jonah 1:5, Henry on 1:4. Ellicott on Jonah (Aglen) is left out. ' + THIRD,
 26: 'Two quotable writers found: Brown in JFB on Luke 1:34, Calvin on 1:18. ' + THIRD,
 28: 'Two quotable writers found: Barnes on Luke 7:45, Calvin on 7:44. ' + THIRD,
 30: 'Two quotable writers found: Barnes on Luke 10:30, Calvin on 10:30. ' + THIRD,
 35: 'Two quotable writers found: Henry and Clarke on John 12:1. ' + THIRD,
 36: 'Two quotable writers found: Henry on Matt 27:3, Fausset in JFB on 2 Cor 7:10. ' + THIRD,
 38: 'Two quotable writers found: Barnes on Acts 5:1, Henry on 5:1. ' + THIRD,
 39: 'Two quotable writers found: Fausset in JFB on 3 John 12, Barnes on 3 John 11. Henry is not credited on 3 John. ' + THIRD,
 3: 'One quotable writer found: Clarke on Gen 13:18. Be fair to Lot (2 Peter 2:7-8 calls him righteous). ' + SECOND,
 8: 'One quotable writer found: Jamieson in JFB on Num 14:24 (Gill is not quotable). ' + SECOND,
 9: 'One quotable writer found: Henry on Ruth 1:6. Be fair to Orpah: she did what Naomi urged. ' + SECOND,
 11: 'One quotable writer found: Henry on 1 Sam 1:9. ' + SECOND,
 14: 'One quotable writer found: Henry on 1 Sam 14:1. ' + SECOND,
 18: 'One quotable writer found: Keil on 2 Chr 29:3. ' + SECOND,
 19: 'One quotable writer found: Henry on Esther 2:1. ' + SECOND,
 21: 'One quotable writer found: Calvin on Jer 28:1 (Poole has no named writer on Jeremiah; never the Pulpit on Jeremiah). ' + SECOND,
 22: 'One quotable writer found: Calvin on Dan 5:17. ' + SECOND,
 24: 'One quotable writer found: Delitzsch on Prov 9:13. Wisdom in Proverbs is read two ways by believing writers (a personification, or Christ the Wisdom of God); keep to the contrast of the two women and do not decide that question. ' + SECOND,
 27: 'One quotable writer found: Henry on Matt 2:1. ' + SECOND,
 31: 'One quotable writer found: Clarke on Luke 15:25 (Gill is not quotable). ' + SECOND,
 32: 'One quotable writer found: Henry on Luke 16:19 (the Concise version is the same writer and is not quotable). ' + SECOND,
 34: 'No quotable writer found (only Gill on Luke 19:2, who is not quotable). Write it only if a quotable writer states the contrast.',
}
TAG = 'Local-work check (2026-11-01):'
for f in sys.argv[1:]:
    d = json.load(open(f))
    n = 0
    for b in d:
        for v in b['verses']:
            for c in v['candidates']:
                if c['kind'] != 'contrast':
                    continue
                rows = []
                for l in c['leads']:
                    m = re.search(r'pair (\d+),', l['snippet'])
                    if l['work'] == 'local study' and m and not l['snippet'].startswith(TAG):
                        rows.append(int(m.group(1)))
                have = {l['snippet'] for l in c['leads']}
                for r in sorted(set(rows)):
                    if r in H:
                        s = f'{TAG} pair {r}: {H[r]}'
                        if s not in have:
                            c['leads'].insert(0, {'work': 'local study', 'snippet': s})
                            n += 1
    tmp = f + '.tmp'
    json.dump(d, open(tmp, 'w'), ensure_ascii=False, indent=1)
    os.replace(tmp, f)
    print(f, n, 'hints added')
