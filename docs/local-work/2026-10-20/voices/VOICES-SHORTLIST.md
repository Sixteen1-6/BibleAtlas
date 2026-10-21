# More writers at Deep: the shortlist

For the founder, 2026-10-20. One page to decide from. The details, sources and file fingerprints are in VOICES-PLAN.md (the later commentators) and VOICES-PLAN-LUTHER-FATHERS.md (Luther, the Puritans, the church fathers) beside this file. Nothing in the app has been changed.

**Before any new writer:** one build change, shared by both plans. Today the app can show only three writers, and it downloads all three writers' notes at once. After the change each writer has its own files, downloaded only when a reader opens that writer (at most about 175 KB at a time), and readers choose which writers to show.

## First batch: the most verses for the least work and risk

All seven are public domain, come from a pinned copy on GitHub (or a free copy placed on a branch of the repo), and pass your rule plainly. "Reader" means the build code that turns one kind of source file into notes.

| # | Writer and work | Verses | Work | Watch for |
|---|---|---|---|---|
| 1 | Jamieson, Fausset and Brown, Commentary on the Whole Bible (1871) | whole Bible, 24,813 | copy CrossWire's free files to a branch; one new reader, reused by 3 and 8 | calls the papacy "the apostasy" in about 14 places |
| 2 | Calvin, New Testament commentaries (English 1843-55) | 21 NT books | nothing new: the same pinned source as Henry Concise and Wesley | "Papist" 493 times; 1 and 2 Timothy and Titus left out (only verse 1 of each chapter survives) |
| 3 | Keil and Delitzsch, Old Testament (English 1864-78) | all 39 OT books, 23,734 | same reader as no. 1 | Delitzsch says Solomon did not write Ecclesiastes (question 9); its free-to-copy trail runs through Wikisource (question 11) |
| 4 | Chrysostom, Homilies (English 1839-90) | 5,109: Matthew, John, Acts, Romans to Philemon, Hebrews, nearly every verse | one new reader for the Historical Christian Faith collection on GitHub | the collection drops sentences without a mark; we add "…" (question 6) |
| 5 | Gregory the Great, Morals on Job (English 1844-50) | Job, 1,030 of 1,070 | same reader as no. 4 | much allegory; about 28 entries that do not match the 1844 printing are dropped |
| 6 | Augustine, on John and 1 John (English 1848-73) | 802 | same reader as no. 4 | about 28 entries in another translation are dropped |
| 7 | Luther, Galatians (abridged English, 1939) and Genesis 1 to 9 (English 1904, 1910) | 384 | two small readers; both on GitHub | the pope as Antichrist; harsh lines on the Jews; Galatians shown as "abridged" |

Together about 60 MB of text (about 21 MB compressed), four times today's 14.6 MB, but a reader downloads only the writer he opens. Build order: Calvin first (needs nothing new), then JFB and Keil and Delitzsch, then the three fathers, then Luther.

## Second batch

8. **Barnes, Notes on the New Testament (1832-53):** 7,463 verses, same reader as no. 1. The edition is not named, and "savage", "barbarian" or "negro" appear about 101 times.
9. **Spurgeon, Treasury of David, his own Exposition only:** 2,435 Psalm verses. Waits on question 8.
10. **Matthew Henry, full commentary:** every chapter in depth, seven times the Concise. Waits on question 7.
11. **Cyril of Alexandria, on John (English 1874, 1885):** 703 verses, from tertullian.org's free copy placed on a branch.
12. **Luther, Church Postil and Sermon on the Mount:** about 1,300 NT verses, but the heaviest polemic of all (about 750 mentions of the pope). After you read samples.
13. **Luther, Manual of the Psalms (1837),** one summary per psalm; **Augustine on the Psalms** (shortened 1888 English), 989 verses.
14. **Poole, Annotations (1683-85):** whole Bible, free typed copy, but 1680s spelling and unreadable letters in about 7,100 notes.
15. **The Puritans:** Owen (Hebrews 6 to 10, Psalm 130), Manton (Psalm 119, Jude), Watson (the Beatitudes), Bunyan (Genesis 1 to 11), Sibbes (2 Corinthians 1). Few verses in great depth, up to 67,000 words on one verse. Shown as printed (long s made s, unreadable letters marked "[…]"), with the opening of each long sermon and "Read all" for the rest.

## Not now

- **Gill:** the only typed text is a modern editor's, "All Rights Reserved"; the largest work, quoting rabbis thousands of times.
- **Clarke:** calls the eternal Sonship of Christ "anti-scriptural, and highly dangerous", against the Nicene Creed; JFB already covers the whole Bible.
- **Scofield (1917):** his Genesis 9:1 note says Ham's line will be "inferior and servile"; the typed copy carries a share-alike license.
- **Geneva Bible notes:** no free-to-copy statement upstream, and a modern editor's notes are mixed in as if Geneva's.
- **Robertson, Word Pictures:** the Greek is broken throughout and the license words conflict.
- **Ryle, Expository Thoughts:** only a modernised text exists.
- **Calvin, Old Testament:** Psalms, Zechariah and Malachi cut short, Isaiah 49 to 66 missing; the rest later, after a check against the printed books.
- **Simeon, Ellicott, the Pulpit Commentary, Bengel, Bullinger's Companion Bible:** no clean free text, only rough scans or paid databases.
- **Alford:** fails your rule (rejects word-for-word inspiration); add him to the avoid list.
- **Spurgeon's sermons:** no copy that is both free and faithful; links later.
- **McGarvey and Pendleton's Fourfold Gospel, Johnson's People's New Testament:** clean, but add little beside the others.
- **Luther on Peter and Jude, his Bible prefaces, his Psalm 82:** fail your rule as they stand (they doubt James and Jude, and say Solomon did not write Ecclesiastes).
- **Owen on Hebrews 1 to 5 and 11 to 13, Jonathan Edwards's Notes, the Westminster Annotations:** no free typed copy.
- **Tyndale's notes, Beza, Cyril on Luke, Bede on Revelation, Augustine on the Sermon on the Mount:** later, after hand placing or proofreading.
- **Jerome, Ambrose, Ephrem, Hilary:** no public-domain English of their commentaries (the Catena already quotes them).
- **C. S. Lewis:** his Christian books stay under US copyright until 2029 (The Pilgrim's Regress) to 2054 (Reflections on the Psalms) and later; a shelf card at most, and weigh his 1959 letter allowing that Jonah and Job may not be history before citing him.

## Your decisions

**Answered by you on 2026-10-20** (full words in FOUNDER-DECISIONS-2026-10-20.md):

- **Hard words (2) and Luther (3):** everything word for word. The first time anyone opens any commentary, a big, plain two-page notice says it is commentary, not God's Word (being built now as its own change). Passages that deny Scripture are left out (Luther on James and Jude, his prefaces' doubts), while the rest of those commentaries stays.
- **Historical Christian Faith (6):** credit the original source as well (series, translator, volume, page), and take the words from the original volumes if possible; research on the archive.org and Wikisource copies is running. Cite exactly what the commentary says.
- **Two works by one writer (7, and the Catena):** show both; each is labelled with its writer and work. So Henry's full commentary sits beside the Concise.
- **Puritan old spelling:** keep it as printed, and where a reader would be confused, show the modern reading from a cited source (EarlyPrint's standard spellings and Webster's 1828 dictionary are being checked).

Still open below: 1, 4, 5, 8 to 13, and in the other plan its questions 6 and 8 to 14.

1. **Start?** Make the shared build change, then the first batch in the order above? *Recommended: yes, and add each new writer to the cite list as it ships (Luther, Gregory, Cyril and the others not there yet).*
2. **Hard words of their day.** Nearly every writer here calls Catholics "Papists" or "Romish", several speak harshly of "the Jews", and Henry's full commentary and Barnes use "savage" and "negro". Show them word for word with a short note, or leave such passages out with a mark? *Recommended: word for word, with one short line in the panel: "These writers wrote in the language and quarrels of their time; their words are shown as printed." The app promises their own words, and Henry Concise and Wesley already ship this way. Where the problem is a teaching and not a tone (Scofield on Ham, Clarke on the Sonship), leave the writer out instead.*
3. **Luther's polemic.** *Recommended: in the first batch, Galatians (labelled "abridged") and Genesis 1 to 9, under the same short line. The Church Postil only after you have read ten sample pages. Never his Peter and Jude or his Bible prefaces.*
4. **Which fathers.** *Recommended: approve Chrysostom, Augustine, Gregory the Great and Cyril of Alexandria now (Bede, Irenaeus, Justin, Basil, Athanasius later, if a clean text appears). Keep out the condemned: Origen, Theodore of Mopsuestia, Pelagius, Arius, Nestorius, Apollinaris, Didymus, Evagrius, Tatian, Novatian. Leave out the disputed for now: Tertullian, Eusebius, Theodoret, Hippolytus, Victorinus, Clement of Alexandria; none of them offers a usable commentary here anyway. Show Gregory's allegory, labelled "spiritual reading".*
5. **Fathers already shipped in the Catena.** It quotes Origen 638 times, an unknown Arian writer shown as "Pseudo-Chrysostom" 439 times in Matthew, Eusebius 82 and Didymus 9. *Recommended: hide Origen, Didymus and the Arian writer, with a visible line that a quotation was left out; keep Eusebius with a one-line note on who he was. The Mark quotes under "Pseudo-Chrysostom" are by Victor of Antioch, who was orthodox, and stay.*
6. **Historical Christian Faith on GitHub.** You dropped its site as a link. May the build take the fathers from its GitHub collection? *Recommended: yes, only the 1800s translations of approved fathers (the collection gives them away as public domain), credited in the sources list and NOTICE; the site stays unlinked. Mark each skipped sentence with "…" after a one-time check against the printed volumes.*
7. **Henry: full commentary beside or instead of the Concise?** *Recommended: instead of, at Deep. One Henry heading, the full commentary, with Romans to Revelation labelled "completed by other ministers". The Concise stays cited in the Layers notes.*
8. **Spurgeon's text.** The only verse-keyed copy on GitHub is labelled free by a third party, but was taken from a site that says "All rights reserved". *Recommended: wait for Project Gutenberg's proofread volumes (two of seven are out) and add each as it appears. This keeps "free to copy" true and holds the same line you took on Gill.*
9. **Ecclesiastes.** *Recommended: leave Keil and Delitzsch's Ecclesiastes out, and mark the cited Pulpit Commentary "not on Ecclesiastes" too; both say Solomon did not write it.*
10. **Gill.** His only typed text is a modern editor's, all rights reserved. Ask permission, pay for a new transcription, or leave him? *Recommended: leave him cited only. A new transcription of 8.8 million words is not worth it now. If you want him later, ask Online Bible for permission first; it costs one email.*
11. **Copies on branches.** *Recommended: yes. Copy CrossWire's files (JFB, Keil and Delitzsch, later Barnes and Luther's sermons), tertullian.org's Cyril and Gutenberg's Luther on the Psalms to branches of the repo, each file's fingerprint checked, and add one small library to read CrossWire's compressed files. Keil and Delitzsch came through Wikisource: treat it as public domain, but credit Wikisource and mark its built files CC BY-SA, as the dictionaries already are.*
12. **Rabbis and critics named inside old writers.** Keil and Delitzsch name Kimchi, Rashi and Ewald hundreds of times, mostly to answer them; Luther argues with Rashi; JFB names Meyer. *Recommended: the avoid list governs whom the app itself cites, not the names inside an old writer's own words.*
13. **Many writers on one verse.** John 3:16 could have a dozen. *Recommended: list the writers by name; each one opens and downloads only when the reader picks it, and the app remembers the picks.*
