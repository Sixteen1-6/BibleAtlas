# Group 1: whole-Bible commentaries for Deep (research notes, 2026-10-20)

Writers: John Gill, Albert Barnes, Adam Clarke, Jamieson-Fausset-Brown, Matthew Poole, Matthew Henry (Complete).

All six are already on the "cite" list in config/layer-sources.json (ids gill, barnes, clarke, jfb, poole, henry) and none is on the avoid list. All were first published long before 1930, so the texts are public domain in the US. The open question for each is the transcription: who typed it, what they say about copying, and whether it can be pinned on github.com.

Samples and working files are under `scratchpad/ba/voices/g1/` (sword/, poole-tcp/, batanus/, helloao/, scans/, passages/, web/). Scripts are under `scratchpad/ba/g1scripts/`. Nothing in the Bible Atlas clone was touched.

## Summary

| Writer and work | Best openly licensed transcription | On GitHub? | Recommend |
|---|---|---|---|
| Matthew Henry, Complete Commentary | Let's Church `packages/lets.bible/seed/commentaries/mhc.json` (from the SWORD module MHC) | Yes, same pinned commit as henry-concise and wesley-notes | Yes |
| Jamieson, Fausset and Brown | CrossWire SWORD module JFB 3.0 (from CCEL's jfb.txt) | No, needs a mirror branch | Yes |
| Adam Clarke | CrossWire SWORD module Clarke 2.0 (from Wikisource) | No, needs a mirror branch | Yes, with the notes below |
| Albert Barnes | CrossWire SWORD module Barnes (New Testament only) | No, needs a mirror branch | Yes, New Testament only |
| Matthew Poole | EEBO-TCP texts A55363 (1683) and A55368 (1685), CC0 | Yes (github.com/textcreationpartnership) | Yes, but only after a repair pass, or as original-spelling text with gaps marked |
| John Gill | None cleanly licensed. Every electronic Gill found is Larry Pierce's "modernised" Online Bible text, marked "All Rights Reserved" | (HelloAO copy is not on GitHub) | No, not until permission or a fresh transcription |

Mirroring: crosswire.org is not github.com, so Barnes, Clarke and JFB need the same treatment as the meaning model: a workflow that downloads `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/{Barnes,Clarke,JFB}.zip`, records the SHA-256 and commits the zips to a mirror branch that sources.json pins. CrossWire repacks some zips (the JFB zip's files are dated 2026-10-20 06:08 although the module is version 3.0 of 2021-02-15), so the SHA-256 changes from day to day and must be taken from the mirrored copy. SHA-256 of today's downloads: Barnes.zip 9e8edc0333875c214124371b3862df118ad3a76ade7753cb2faeed3484615baf (5,812,827 bytes); Clarke.zip 56bb33d3bf0f50c1609f4dd10ac81e7450bb0e8aae93bf340074ccb5e207a44f (8,627,265 bytes); JFB.zip 257f743e1c9265618827c236e9b4ccb40ae7a6af348dfe814b555494c4b687fe (5,687,740 bytes); MHC.zip 6bcb936873ca144e317805e5c1677940fd86e2403f7c14517752e44f25c8882b (15,195,123 bytes, only for comparison).

How the spot checks were done: each passage of the electronic text was matched word by word against the OCR text of a public-domain scan on archive.org (script g1scripts/spot.py). The percentage is the share of the passage's words found in order in the scan; most misses are OCR noise in the scan (for example "tlie" for "the", "f" for the long s), and the real differences are listed.

---

## 1. Matthew Henry, An Exposition of the Old and New Testament (the Complete Commentary)

- Dates: 1706 to 1721 as the project dates it (the lets.church file and the cite list give the same span). Henry died in 1714 having finished Acts; Romans to Revelation were completed after his death by other Nonconformist ministers. Public domain in the US.
- Founder rule: fits. Henry is already cited ("henry"). The continuators were Dissenting ministers; the file names some of them in the book introductions: "Completed by John Evans" (Romans), "Completed by Jeremiah Smith" (Titus, Philemon), "Completed by John Reynolds, of Shrewsbury" (2 and 3 John), "Completed by John Billingsley" (Jude). Nothing to leave out, but the app could say "completed by ..." on Romans to Revelation.
- Best source: github.com/LetsChurch/lets.church at commit 71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239 (already pinned in sources.json), file `packages/lets.bible/seed/commentaries/mhc.json`, git blob 4a9d8be1b6206b4c86a7c65a6dda39382e845d8a, 40,809,275 bytes, SHA-256 45344dafe2f9254a20498379288e772b095fb337b33896541362198f7aec340b. No mirror needed.
- License words: GitHub reports the repository license as "Creative Commons Zero v1.0 Universal" (CC0-1.0; LICENSE file, already cited in sources.json). The file's own work record says `"license": "Public Domain"`, `"sourceUrl": "https://www.ccel.org/ccel/henry/mhc.html"`, `"sourceModule": "MHC"`. The SWORD module's conf (mods.d/mhc.conf) says "Public Domain--Copy Freely." and "DistributionLicense=Public Domain", "This text was prepared from the Christian Classics Ethereal Library ... Thanks also to Logos Research, Inc. for providing CCEL with their text".
- Coverage: all 66 books and all 1,189 chapters; 5,360 entries (3,667 with a verseEnd); about 7.29 million words.
- Format: JSON `{work, entries:[{book, chapter, verse, verseEnd?, body}]}`, book codes like GEN, ROM. Each entry is one of Henry's sections. The body prints the KJV text of the section first ("3 And God said, Let there be light: ..."), then Henry's exposition; the build should drop the printed verses as it drops other furniture. Book prefaces sit inside the first entry (GEN 1:1 holds the preface to Genesis to Deuteronomy). 5,092 entries carry `{{ref:Ezek.37.9|Ezek. xxxvii. 9}}` markers, the same form wesley.json uses.
- Accuracy, checked against the 1828 Philadelphia edition (archive.org expositionofoldn01henr, 03henr, 05henr):
  - Genesis 1:2 note ("The foundation of all religion..."): 147 of 155 words (94.8%); one real difference, "enquiry" in the e-text, "inquiry" in 1828.
  - Psalm 23 introduction: 151 of 160 (94.4%); the e-text lacks "therefore" in "We are saved by hope, and therefore that hope will not make us ashamed".
  - John 3:16 section: 155 of 169 (91.7%); differences are OCR noise.
  - Also seen: a slip in the e-text at Matthew 27:25, "His blood be on us, and one our children".
- Concerns:
  - Size: about 7 times the Concise Commentary. The panel's split files (PART_BYTES 500 KB) will matter.
  - Harsh language that would appear word for word: 122 phrases such as "blind/obstinate/wicked/unbelieving Jews", 77 "papist/popery/popish", 15 "Romish", 37 "savage(s)/barbarian(s)/negro".
  - Henry Complete and Henry Concise would both show on the same verses; the founder may want only one of the two shown at a time.
- Recommend: yes.

## 2. John Gill, An Exposition of the Old and New Testaments

- Dates: New Testament 1746 to 1748; the Prophets 1757 to 1758; the rest of the Old Testament about 1763 to 1766 (archive.org copies dated 1746, 1758, 1762, 1764, 1765). Public domain in the US.
- Founder rule: Gill fits (Particular Baptist, held Scripture inspired; already cited as "gill"). The problem is the transcription, not the writer.
- Transcription found: every electronic Gill seen (HelloAO, StudyLight, Bible Hub, sacred-texts and a MyBible copy; compared on John 3, Genesis 1 and others) is the same text: "The New John Gill's Exposition of the Entire Bible, Modernised and adapted for the computer. Editor: Larry Pierce. All Rightes Reserved, Larry Pierce, Winterbourne, Ontario. A printed copy of this work can be ordered from: The Baptist Standard Bearer, 1 Iron Oaks Dr, Paris, AR, 72855" (gill.conf in github.com/mjdenham/sword-modules, SwordModuleCreation/module/mods.d/gill.conf; the same notice is the "Copyright Statement" on StudyLight's Gill pages, seen in the Wayback copy of studylight.org/commentaries/eng/geb/genesis-1.html). CrossWire's main, beta and attic repositories have no Gill module.
- HelloAO (bible.helloao.org) serves this same text with `"licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"` (in /api/available_commentaries.json) and its README says "no copyright restrictions whatsoever". It names no source, and the text is word for word the Pierce text (same "...." after the quoted words, same modernised spellings). So the only "public domain" statement is a third party relabelling an edition whose editor reserves rights.
- Is the modernisation real? Yes, lightly. Against the first editions: "intreat" became "entreat", "chuse" became "choose", "don't" became "do not", "any thing" became "anything", Roman-numeral references became "Psalm 77", "Genesis 49". The words are otherwise Gill's.
- Accuracy (HelloAO text against scans):
  - Hebrews 11:1 against the 1811 edition (expositionofnewt0003john): 200 of 203 words (98.5%); only "anything"/"any thing" and OCR noise.
  - Galatians 2:16 against the same: 190 of 191 (99.5%).
  - Ruth 1:16 against the 1764 first edition (expositionofoldt0002gill): 164 of 212 (77.4%), all misses long-s OCR noise or the modernisations above.
  - Psalm 23:1 against the 1765 first edition: 144 of 203 (70.9%), same kind of misses; Gill's Latin footnotes are not inline in the e-text.
  - Matthew 5:3 against the 1746 first edition: OCR of that scan is too poor to judge (42%).
- Coverage (HelloAO): 66 books, 1,189 chapters, 29,707 verses. About 8.8 million words (counted in a MyBible copy of the same text, 53 MB as SQLite).
- Concerns:
  - The rights claim above. Under US law a light modernisation may not carry a new copyright, but the founder's rule asks for a plain statement that the transcription is free, and the editor says the opposite.
  - Rabbinic sources everywhere: 11,468 mentions of Kimchi, Jarchi, Aben Ezra, Maimonides and the like, and 9,255 of the Talmud, Targums or Zohar, in this count. Gill quotes them as witnesses, as a Christian; but "Kimchi", "Aben Ezra", "Maimonides" and others are match words on the avoid list (for Layers notes), and they would appear word for word thousands of times.
  - Harsh language: 369 "papist/popery/popish", 159 "Romish", 127 places tying antichrist to the pope or Rome, 189 "Mahomet/Mohammedan/Turk", 123 "blind/obstinate/wicked Jews".
  - Large (the biggest of the six).
- Ways forward: (a) ask Online Bible (Larry Pierce) for written permission to store and show the text, then mirror HelloAO's JSON or another copy to a branch; (b) make a new transcription from the public-domain scans (the 1809 to 1811 London edition reads well: Hebrews and Galatians matched 98.5 to 99.5% even through OCR), a large job; (c) leave Gill as a cite-only writer with links to Bible Hub, as now.
- Recommend: no, not until (a) or (b).

## 3. Albert Barnes, Notes on the Bible (Notes, Explanatory and Practical)

- Dates: New Testament notes 1832 to 1853; his Old Testament notes cover only Job, Psalms, Isaiah and Daniel (1840 to 1870). Public domain in the US.
- Founder rule: fits (already cited as "barnes"). Barnes held the whole Bible as God's word. Note for the founder: he was tried for heresy in 1835 over his Notes on Romans (on original sin and imputation); his synod suspended him and the General Assembly of 1836 restored him. The dispute was over Calvinist doctrine, not over Scripture.
- Leave out: the "whole Bible" Barnes sold today (StudyLight's "Barnes' Notes on the Whole Bible", e-Sword, the MyBible module) fills the other Old Testament books with other men's work. Checked: its Genesis 1:1 note ("Section I - The Creation - The Absolute Creation ... the 'head-part, beginning' of a thing") is James G. Murphy's Commentary on Genesis (found in archive.org criticalexeg00murp, 1866); its Numbers 1:1 note ("A month had passed away since the setting up of the tabernacle") cannot be Barnes's either, since he wrote no notes on Numbers (its author was not identified here). Only Job, Psalms, Isaiah and Daniel in those editions are Barnes's own (they are by far the largest Old Testament books in the MyBible copy: 389k, 737k, 662k and 341k words). Store the New Testament only, or Barnes's own four Old Testament books if a licensed copy turns up (none found: the MyBible copy states no license).
- Best source: CrossWire SWORD module Barnes, `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Barnes.zip` (5,812,827 bytes, files dated 2013-07-16, SHA-256 above). Needs a mirror branch.
- License words: mods.d/barnes.conf: "Description=Barnes' New Testament Notes", "DistributionLicense=Public Domain" (Version 1.1, "Made numerous (mostly formatting) corrections and replaced some omitted cross-references"). StudyLight's Barnes pages also say "These files are public domain."
- Coverage: all 27 New Testament books, all 260 chapters, 7,431 verse notes (7,463 verses counting linked ones), about 2.7 million words. No Old Testament.
- Format: zCom, ThML markup (`<i>`, `<br />`, `<scripRef passage="Jn 6:33, 17:21">`), BlockType CHAPTER, KJV versification, one entry per verse beginning "Verse 16."; the lemma words are in `<i>`.
- Accuracy:
  - John 3:16 against the 1858 Gospels printing (notesexplanatory02barn): 193 of 230 words (83.9%). The e-text follows a different (probably later) edition: it has "He hates the sin, but loves the sinner" and "but that he had benevolent feelings toward them, or was earnestly desirous", where 1858 has "but had benevolent feelings towards them; was so earnestly desirous" and no "He hates the sin" sentence.
  - Acts 2:38 against the 1857 Acts (notesexplanator03unkngoog): 216 of 224 (96.4%), OCR noise only.
  - Ephesians 2:8 against the 1858 Ephesians (epistlespaulephe00barn): 183 of 212 (86.3%); OCR noise, plus "connexion" (e-text) for "connection" and "Rom 4:17" where the print reads "iv. 16".
- Concerns: the edition behind the module is not named; papacy as the "man of sin" reported at 2 Thessalonians 2:3 ("Most Protestant commentators have referred it to the great apostasy under the Papacy"); 91 "Mahomet/Mohammedan/Turk" (Revelation read as history); 101 "savage(s)/barbarian(s)/negro"; 37 "papist/popery".
- Recommend: yes, New Testament only, from a mirror of the CrossWire module.

## 4. Adam Clarke, The Holy Bible ... with a Commentary and Critical Notes

- Dates: 1810 to 1826. Public domain in the US.
- Founder rule: fits the rule as worded (already cited as "clarke"; Methodist, held Scripture as God's word). The founder should know two well-known positions that would appear word for word:
  - At Luke 1:35 Clarke writes that "the doctrine of the eternal Sonship of Christ is, in my opinion, anti-scriptural, and highly dangerous". He affirms Christ's full deity; he rejects calling the divine nature "Son" from eternity.
  - At Genesis 3:1 he argues the tempter was a creature "of the simia or ape genus", not a snake.
- Best source: CrossWire SWORD module Clarke version 2.0 (2021-10-19), `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Clarke.zip` (8,627,265 bytes, files dated 2021-10-29, SHA-256 above). Needs a mirror branch. Its text came from Wikisource, "Commentary and critical notes on the Bible" (en.wikisource.org), which could also be mirrored but is split over 66 pages.
- License words: mods.d/clarke.conf: "DistributionLicense=Public Domain", "TextSource=https://en.wikisource.org/wiki/Commentary_and_critical_notes_on_the_Bible"; its History_2.0 explains the earlier source was lost and the new text was compared with sacred-texts and Wikisource. The Wikisource page carries the {{PD-old}} template (and {{No source}}). sacred-texts, where the text first appeared, does not list it among the texts it produced itself (stbib.htm), so its own commercial-use limits do not apply to it; StudyLight's Clarke pages say "These files are public domain."
- Coverage: all 66 books, all 1,189 chapters, 21,051 verse notes and 1,255 book or chapter introductions, about 3.6 million words. (HelloAO's "adam-clarke" is incomplete: 57 books, 13,318 verses.)
- Format: zCom, OSIS markup (`<reference osisRef=...>`, `<hi type="bold">Verse 16</hi>`, milestone `<div sID/eID>` paragraphs), KJV versification, one entry per verse; chapter summaries in each chapter's first entry. Hebrew and Greek are in the original scripts.
- Accuracy against the 1843 New York edition (archive.org holybiblecontai01clar, 03clar, 04clar):
  - Genesis 3:1 note: 207 of 214 words (96.7%), OCR noise only.
  - Psalm 23:1 note: 180 of 210 (85.7%), scan layout and OCR noise; the e-text has a typo, "Bablylonish" for "Babylonish", in the Psalm's introduction.
  - Isaiah 53:5 note: 44 of 50 (88%); "favor" in the e-text for "favour".
- Concerns: 286 mentions of rabbis by name and 604 of the Talmud or Targums (avoid-list match words would appear); 98 "papist/popery", 68 "Romish"; 34 "blind/obstinate/wicked Jews"; 139 "Mahomet/Mohammedan/Turk"; 78 "savage(s)/barbarian(s)/negro". Clarke is Arminian and argues against Calvinist readings in places.
- Recommend: yes, from a mirror of the CrossWire module, if the founder accepts the two positions above.

## 5. Jamieson, Fausset and Brown, A Commentary, Critical and Explanatory, on the Whole Bible

- Dates: the one-volume edition of 1871 (the larger six-volume "Critical, Experimental and Practical" edition is 1864 to 1870). Public domain in the US.
- Founder rule: fits (already cited as "jfb"). Robert Jamieson (Church of Scotland) wrote Genesis to Esther, David Brown (Free Church) Matthew to Romans, A. R. Fausset (Church of England) the poetical and prophetical books and 1 Corinthians to Revelation (the module's introductions say "by Robert Jamieson", "by A. R. Faussett", "Commentary by David Brown"). No critics among them.
- Best source: CrossWire SWORD module JFB version 3.0 (2021-02-15, "New source from https://ccel.org/"), `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/JFB.zip` (5,687,740 bytes; repacked 2026-10-20, so pin the mirrored copy). Needs a mirror branch.
- License words: mods.d/jfb.conf: "DistributionLicense=Public Domain", "TextSource=https://ccel.org/ccel/j/jamieson/jfb/cache/jfb.txt". The statement that travels with this text (StudyLight's JFB pages): "These files are a derivative of an electronic edition prepared from text scanned by Woodside Bible Fellowship. This expanded edition of the Jameison-Faussett-Brown Commentary is in the public domain and may be freely used and distributed." CCEL's own site policy asks permission to "republish CCEL works", so take it from CrossWire, as Henry's Concise was.
- Coverage: all 66 books, all 1,189 chapters; 16,882 notes covering 24,813 verses (many notes span several verses and are linked), about 1.84 million words.
- Format: zCom4, OSIS markup, KJV versification. All four general introductions (Pentateuch, poetical books, prophets, prophets of the restoration) are packed into the Genesis 1:1 entry and need splitting off. Notes over verse ranges begin "14-16." and are stored once with links on the other verses.
- Accuracy against the 1873 one-volume printing (archive.org commentarycritic00jami):
  - Genesis 1:1: 191 of 202 words (94.6%). The e-text abbreviates references ("Pr 8:22", "Joh", "Ro" for "Proverbs", "John", "Romans") and writes "namely" for "viz.".
  - Psalm 23:1: 45 of 55 (81.8%), only the reference abbreviations and OCR noise.
  - John 3:14-16: 183 of 213 (85.9%), OCR noise; "further" for "farther".
- Concerns: the reference abbreviations are the module's, not the book's; the papacy is read as the "apostasy" behind the man of sin (2 Thessalonians 2:3: "the apostasy of Romanism"), 14 such places, 30 "Romish"; 13 "blind/obstinate Jews"; JFB names Meyer (on the avoid list) 52 times as a source it weighs; "Faussett" misspelled in the module.
- Recommend: yes, from a mirror of the CrossWire module.

## 6. Matthew Poole, Annotations upon the Holy Bible

- Dates: Vol. I 1683 (Genesis to Isaiah), Vol. II 1685 (Jeremiah to Revelation). Public domain in the US.
- Founder rule: fits (already cited as "poole"; Puritan). Poole wrote the notes himself only "to the fifty eighth of Isaiah" (the 1683 preface says so); the rest were finished after his death in 1679 by other Nonconformist ministers. Nothing to leave out.
- Best source: the EEBO Text Creation Partnership keyed texts, on GitHub: github.com/textcreationpartnership/A55363 (Vol. I, commit 41a5d66565a933814dd6a5486595f6a2ae45e29f, A55363.xml 16,464,179 bytes, SHA-256 fc494999def0b470be3e1d826d1bb310fe2e627da7d9946067485ddc92fbe6b5) and github.com/textcreationpartnership/A55368 (Vol. II, commit eadd8a9fdb03365d0d54aa36287b7defb034cc8c, A55368.xml 17,124,322 bytes, SHA-256 88e15a73286b932440edfa76936b374ba63360ffea2d62d0d3ba514c5cf9a6e6). No mirror needed.
- License words (in each XML's `<availability>` and README.md): "This keyboarded and encoded edition of the work described above is co-owned by the institutions providing financial support to the Early English Books Online Text Creation Partnership. This Phase I text is available for reuse, according to the terms of Creative Commons 0 1.0 Universal. The text can be copied, modified, distributed and performed, even for commercial purposes, all without asking permission." The header also says Phase 1 texts "have been released into the public domain as of 1 January 2015" and asks that "due credit and attribution is given to their original source".
- The modern-spelling Poole that StudyLight, Bible Hub, e-Sword and MyBible carry is not usable: StudyLight says "Text Courtesy of BibleSupport.com. Used by Permission.", and the MyBible copy (github.com/batanus/bible-resources, Pool-c) states no license.
- Coverage: all 66 books. Vol. I: 23 book divisions, 594 chapters plus 150 Psalms. Vol. II: 43 book divisions. About 29,766 and 28,806 notes (about 1.36 and 1.77 million words of notes). Missing: Vol. I has "2+ pages missing" in Leviticus, from 10:12 to 11:24, and 20 duplicate pages.
- Format: TEI P5 XML. The KJV text of each verse is a `<p n="16">`, and Poole's notes are `<note place="bottom" n="i">` set at the words they explain; `<note place="margin">` holds cross-references. Original 1680s spelling and capitals ("onely", "Iews", "dye", "justifie").
- Accuracy: TCP keyed the text from page images; its header says 5% of each text was proofread and illegible characters were marked as gaps. Gaps: 9.7% of Vol. I notes and 14.7% of Vol. II notes contain at least one illegible mark, mostly one letter ("H•ppiness", "Po•se•sions" in Matthew 5:3) and some whole words; of the 202 illegible paragraphs in Vol. II, 201 are margin cross-references and 1 is a note. Spot checks against the modern Poole text (independent of TCP, from a later edition): Matthew 5:3, John 3:16 and Genesis 3:15 agree word for word apart from spelling and the gaps; Psalm 23:1 differs in one phrase ("strengthens this Faith by his Consideration" in 1683, "strengthens his faith by this consideration" in the modern text). The modern text has its own errors (at John 3:16 it cites "1Jo 2:21" where 1685 has "1 Ioh. 2.2.").
- Concerns: the illegible marks need either a repair pass against page images (EEBO's images are not free; the 1683 and 1685 scans on archive.org, bim_early-english-books-1641-1700_annotations-upon-the-hol_poole-matthew_1683 and _1685, may serve) or showing as gaps; original spelling may read oddly to most readers; 210 "papist/popery/popish" in Vol. II and 19 places tying antichrist to Rome; the Leviticus pages are missing.
- Recommend: yes as the only cleanly licensed Poole, but only after a repair pass (or with gaps shown honestly) and with Leviticus 10:12 to 11:24 marked missing.

---

## Avoid-list names inside these texts

The avoid list in config/layer-sources.json is for Layers notes, but its match words also occur inside these old commentaries. Counts of the list's own match words (start of word, case as written; script g1scripts/avoidcount.py):

| Text | Hits | Most common |
|---|---|---|
| Gill (Pierce text) | 6,273 | Kimchi 3,088, Aben Ezra 2,630, Maimonides 517, Nachmanides 17, Ramban 12, Meyer 7 (Gill calls Rashi "Jarchi", which the list does not match) |
| Clarke | 198 | Kimchi 143, Maimonides 27, Aben Ezra 15, Abarbanel 6 |
| JFB | 74 | Meyer 52 (JFB quotes Meyer's commentary on the New Testament), Kimchi 15 |
| Henry Complete | 12 | Maimonides 10, Kimchi 2 |
| Barnes NT | 11 | Maimonides 5, Kimchi 3, Abarbanel 2 |
| Poole (TCP) | 4 | Kimchi 4 |

These are the old writers quoting others as witnesses, not the app citing them. If the voices build ever runs the avoid check over writers' notes, it would have to exempt them, or the founder may decide that JFB's 52 citations of Meyer are acceptable inside JFB's own words.
