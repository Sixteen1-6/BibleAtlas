# Group: other Reformers and Puritans

Checked 2026-10-20. Everything this group fetched is under `ba/voices/reformers/` (`dl/tcp/` the TCP XML files, `dl/bunyan/` the Gutenberg Bunyan, `dl/ia/` archive.org OCR used only as check copies, `raw/ccel/` CCEL text used only as check copies, `txt/` plain text made from the XML, `scripts/` the helpers, `raw/sha256.txt` hashes, `raw/tcp_pins.txt` commits). Nothing over 50 MB was downloaded (largest: the Gutenberg Bunyan at 12.3 MB). The BibleAtlas clone was only read.

Matthew Poole and the Geneva notes belong to the first track and are not repeated here. Beza's New Testament notes reached English through Laurence Tomson's 1576 New Testament, and those are the Geneva New Testament notes, so they are already in the first track's Geneva entry.

## The one source that makes this group possible: EEBO-TCP on GitHub

Almost everything here that can be used comes from the Text Creation Partnership's hand keying of Early English Books Online, which is on GitHub as one repository per book: `github.com/textcreationpartnership/<TCP id>`, each holding `<id>.xml` (TEI P5) and `README.md`. That meets the app's rule (a pinned commit on github.com) with no mirror. All 61,315 TCP texts are now free: the catalog column "Restricted" is out of date, and the Phase II repositories (pushed February to March 2022) carry the CC0 waiver too.

License words, exactly as they stand in each repository (README.md, section "Availability", and the XML's `teiHeader/fileDesc/publicationStmt/availability`):

- Phase I texts (for example A53678, Owen): "This keyboarded and encoded edition of the work described above is co-owned by the institutions providing financial support to the Early English Books Online Text Creation Partnership. This Phase I text is available for reuse, according to the terms of Creative Commons 0 1.0 Universal. The text can be copied, modified, distributed and performed, even for commercial purposes, all without asking permission."
- Phase II texts (for example B11837 Bullinger, A96093 Watson, A10086 Beza): "To the extent possible under law, the Text Creation Partnership has waived all copyright and related or neighboring rights to this keyboarded and encoded edition of the work described above, according to the terms of the CC0 1.0 Public Domain Dedication (http://creativecommons.org/publicdomain/zero/1.0/). This waiver does not extend to any page images or other supplementary files associated with this work, which may be protected by copyright or other license restrictions."

What every TCP text shares, and what the app would have to handle:

- Spelling as printed: long s (ſ), u for v, i for j, "ye", "yt", "y•" for the and that, tildes for a dropped m or n ("cōmaundement"). Changing ſ to s is typographic; anything more is modernizing. Freely Given Books has a CC0 pipeline that modernizes TCP texts and records every change (`github.com/freely-given-books/colophon`), which could be reused or copied.
- Greek and Hebrew were not keyed. Each such word is `<gap reason="foreign">` with the placeholder "〈 in non-Latin alphabet 〉". Owen's Hebrews has 3,192 of them, Manton's Psalm 119 has 408. The app would show a marker such as [Greek] or drop the clause.
- Illegible letters are `<gap reason="illegible">`, usually one letter. Rates below are per 10,000 words.
- Marginal notes are `<note>` elements inside the text.
- Verse keys: some books mark verses in `div/@n` (Owen, Manton's Jude, Sibbes on 2 Corinthians 1); the rest put the reference only in the heading ("PSAL. CXIX. VER. 105."), so a small parser per book is needed.

Commits pinned for this report (repo, commit, file size in bytes, SHA-256 of the XML) are in `reformers/raw/tcp_pins.txt` and `reformers/raw/sha256.txt`. The main ones are repeated under each writer.

Where else I looked:

- CCEL. Its copyright page says: "These books may be used for personal, educational, or non-profit purposes. Contact us for permission to republish CCEL works or to use them commercially." (https://ccel.org/about/copyright.html). That is not a free license, so CCEL is used here only as a check copy. CCEL has Manton (Nisbet volumes I to VIII and XX), Edwards (Hickman, keyed from the 1974 Banner of Truth reprint), Knox, Bunyan. It does not have Owen on Hebrews.
- CrossWire SWORD. No commentary module for any writer in this group. Its `Tyndale` module (Public Domain, from Wikisource) is the Bible text only; Wikisource's "Bible (Tyndale)" is the same, with no prologues or notes. The Owen and Edwards GenBook modules are treatises, not commentary.
- Project Gutenberg. Bunyan's whole Works (Offor) is there and mirrored on GitHub by GITenberg. Tyndale's Jonah prologue is #24890. Nothing for Owen, Manton, Sibbes, Watson, Edwards' notes, Knox, Beza, Bullinger, Zwingli. Gutenberg's license words (LICENSE file, paragraph 1.C): "If an individual work is in the public domain in the United States and you are located in the United States, we do not claim a right to prevent you from copying, distributing, performing, displaying or creating derivative works based on the work as long as all references to Project Gutenberg are removed."
- archive.org. Page scans of the 19th-century collected editions (Goold's Owen, Nisbet's Manton, Grosart's Sibbes, Dwight's Edwards, Offor's Bunyan, the Parker Society) and of EEBO microfilms, with machine OCR. The OCR is rough (Greek garbled, footnotes and running heads mixed into the text). archive.org's terms (2010 wording, as quoted in a court exhibit; I could not load the live page) say access "is granted for scholarship and research purposes only". Good for checking, not a source.
- GitHub. `krzysztof-radzimski/wje` (MIT code) is a scrape of Yale's WJE Online, whose Notes on Scripture (volume 15, 1998) is under copyright; not usable. `eddyekofo94/works_of_owen_epub_conversion` and `z3r0Colt/sojourner` hold CCEL or other copies with no license of their own for the text. Nothing else.
- EarlyPrint (Northwestern and Washington University) keeps corrected TCP texts on Bitbucket; I did not check its license.

## Ranking

By how much of the Bible a usable text covers, then by how widely the writer is read today.

| Rank | Writer and work | Bible covered | Read today | Open text | Recommend |
|---|---|---|---|---|---|
| 1 | Thomas Manton, sermons and commentaries (TCP, 1657 to 1693) | Psalm 119 (162 of 176 verses), Jude (all 25), John 17, Romans 6 and 8, 2 Corinthians 5, Matthew 4, 6:9-13, 17 and 25, 2 Thessalonians 2, Colossians 1:17-21 | high among Reformed readers | yes, CC0 | yes |
| 2 | John Owen, Hebrews (TCP 1680 volume) and Psalm 130 (1669) | Hebrews 6 to 10 (127 of 128 verses keyed), Psalm 130 (all 8) | very high | yes, CC0, but only chapters 6 to 10 | yes, partial |
| 3 | William Tyndale, prologues and marginal notes (1530 Pentateuch, 1534 New Testament), Jonah, Matthew 5 to 7, 1 John | prologues to 27 books (21 epistles, the Pentateuch, Jonah), about 2,130 notes across the New Testament and Pentateuch, Matthew 5 to 7 and 1 John verse by verse | widely known, little read | yes, CC0 | yes, with care |
| 4 | Richard Sibbes, five expositions (TCP 1630 to 1655) | 2 Corinthians 1 (all 24), Song of Songs 4 to 6, Philippians 3, Hosea 14, Matthew 12:20 | moderate (Bruised Reed is popular) | yes, CC0 | yes |
| 5 | John Bunyan, expositions (Offor's Works via Gutenberg, and TCP first editions) | Genesis 1 to 11 verse by verse, Revelation 21:10 to 22:4, temple chapters of 1 Kings, many single texts | very high as an author, low for these works | yes, Gutenberg statement (Genesis), CC0 (others) | yes, second tier |
| 6 | Thomas Watson, The Beatitudes (1660) and Body of Divinity (1692) | Matthew 5:1-12, Matthew 6:9-13, Exodus 20:1-17 | high (Banner reprints) | yes, CC0 | yes, small |
| 7 | Theodore Beza, Psalms paraphrase (Gilby 1581), Song 1 to 3 sermons (Harmar 1587), eight Psalms meditations (Stubbes 1582) | all 150 Psalms (argument and paraphrase per psalm), Song 1 to 3 | low | yes, CC0 | yes, second tier |
| 8 | Jonathan Edwards, Notes on the Bible (Dwight 1830, Hickman 1834) | about 420 notes on some 55 books | very high as an author | no free transcription | not now |
| 9 | Westminster Annotations (1645, 1651, 1657) | whole Bible | low, rarely reprinted | none at all | no |
| 10 | Heinrich Bullinger, 100 sermons on Revelation (Daus 1561), Decades (1577), 2 Thessalonians (1538) | Revelation 1 to 22 | low | yes, CC0 | no (founder may decide) |
| 11 | John Knox, A Fort for the Afflicted (1580, Psalm 6) | Psalm 6 | low | yes, CC0 | no |
| 12 | Philip Melanchthon, only through George Joye's Daniel (1545) | Daniel 1 to 12, mixed authors | very low | yes, CC0 | no |
| 13 | Ulrich Zwingli | nothing verse by verse in English before 1931 | low | none | no |

## 1. Thomas Manton (1620 to 1677)

- Written in English. First printings in the 1650s to 1693 (TCP copies dated 1657 to 1693); Nisbet's Works (1870s, volume V dated 1871 on CCEL) reprints them. Public domain.
- Founder rule: fits. Presbyterian Puritan, a Westminster Assembly scribe, who preaches every text as God's word. Flags: the 1679 sermons on 2 Thessalonians 2 are titled as "arguments to establish Christians against the apostacy of the Church of Rome" (Antichrist read as the papacy); the Psalm 119 sermons quote Aben Ezra 3 times and Kimchi 4 times in passing.
- Best source: TCP, CC0 (words above). Pins:
  - A51842, 190 sermons on Psalm 119 (1681): commit `999d73dd5d6dc43fef76f9606c50e851239a5b33`, 7,222,761 bytes, SHA-256 `5b0e734ab59b2c9da1c742981e496cc048e31b84c3561eb7647305e7e62b3123`. 1,132,355 words. Sermon heads ("PSAL. CXIX. VER. 105.") give 162 of the 176 verses; 69, 70, 84, 86, 87, 88, 95, 111, 157 to 160, 169 and 170 have no sermon (two heads cover two verses, 78-79 and 116-117, and one head has its number lost to a gap, "VER. 1[gap]", which falls where 162 belongs). Gaps: 475 illegible (4.2 per 10,000 words), 408 Greek or Hebrew.
  - A89503, Jude (1657): commit `4e5021c1685e6a949d874b309d336c6e9a4b6e79`, 1,895,889 bytes, SHA-256 `59106e5f3f487d5277b379a4e610a2c3626fb466dc20d332d4719ad3f7e6dfeb`. 241,309 words, `div type="verse" n=` for all 25 verses. Gaps: 1,131 illegible (47 per 10,000, nearly all single letters), 283 Greek.
  - A51846, second volume (1684): Matthew 25 (27 sermons), John 17 (45), Romans 6 (24), Romans 8 (45), 2 Corinthians 5 (40). Commit `e94222a1cf132926f90e2c74c176a24697a93a24`, 8,488,117 bytes, 1,236,680 words.
  - A51845 Lord's Prayer (1684, 157,640 words), A51838 Christ's temptation and transfiguration (1685, Matthew 4 and 17, 95,021 words), A51839 2 Thessalonians 2 (1679, 113,181 words), A51837 Colossians 1:17-21 (1685, 54,813 words), A51840 fourth volume, 150 sermons on single texts (1693, 1,000,743 words). Commits in `raw/tcp_pins.txt`.
  - Not in TCP: the commentary on James (Nisbet volume IV) and the third volume of sermons (1689; archive.org holds EEBO page images of it). James exists only as CCEL text (not free) and archive.org scans.
- Size: about 27 MB of XML, about 4 million words in all.
- Accuracy, TCP against Nisbet 1871 as keyed by CCEL: (1) Jude 3, opening of the exposition: same words; differences are spelling ("tearm" / "term", "urgencie" / "urgency") and the Greek word TCP leaves as a gap. (2) Psalm 119:105, sermon CXII opening, 140 words: similarity 0.98; only "'tis" / "it is" and "acknowledgeth" (1681) / "acknowledged" (Nisbet). (3) Psalm 119:1, sermon I opening, 140 words: 0.98; "Twenty two" / "twenty-two", "an" / "a", and Nisbet adds "only". No keying errors found.
- Concerns: the length (a single Psalm 119 sermon runs 5,000 to 8,000 words; on Jude, verse 1 is 28,732 words and verse 3 is 18,059), so the app needs an excerpt or "read on" design; Greek and Hebrew gaps; 2 Thessalonians 2 polemic.
- Recommend: yes. Start with Psalm 119 and Jude, then John 17 and Romans 8.

## 2. John Owen (1616 to 1683), Hebrews and Psalm 130

- Written in English. Hebrews: four folio volumes, 1668, 1674, 1680 and 1684; Goold's edition 1854 to 1855 (Works volumes 18 to 24). Public domain.
- Founder rule: fits; the most respected Puritan exegete. Flag: the 1668 Exercitations (A53696, the introduction) cite rabbis to argue with them (Kimchi 60 times, Aben Ezra 54, Maimonides 33, Rashi 20, Talmud 54). The exposition volume quotes Kimchi once.
- Best source: TCP, CC0. A53678, "A continuation of the exposition ... on the sixth, seventh, eight, ninth, and tenth chapters" (1680): commit `e5d5779408ec6294b29a69cf555b3b0659ad107b`, 4,367,649 bytes, SHA-256 `0436c101f08640cf6de5f3b6a1cad6bc81b9056b4f19a89ab0e62996faed2b87`. Divisions `exegesis_of_verse` and `exegesis_of_verses` with `n="4, 5, 6"` and so on: Hebrews 6:1-20, 7:1-28, 8:1-13, 9:1-28, 10:2-39 (10:1 has no key of its own). 611,398 words. Gaps: 16 illegible (0.3 per 10,000, very clean), 3,192 Greek or Hebrew.
  - A53721, Psalm 130 (1669): commit `278db1cbbd6b04711579748e4ab09a5fb47b49a8`, 1,167,959 bytes, verses 1 to 8 keyed, 170,632 words.
  - A53696, the 1668 Exercitations (prolegomena, not verse comment): commit `9d50bd00a05ed39e29d7faa14c3e1b6782a799cd`.
  - Not in TCP: 1674 (Hebrews 1 and 2), 1680 (Hebrews 3 to 5), 1684 (Hebrews 11 to 13). Only scans exist (EEBO images on archive.org; Goold volumes as OCR, for example `worksofjohnowend0023owen`, 1855). No CCEL copy. Monergism's PDFs forbid reposting.
- Accuracy, TCP 1680 against Goold 1855 volume XXIII (archive.org OCR): (1) Hebrews 10:14, 120 words: 0.96; Goold modernized "sate down" to "set down", added "and", and put the quotation in the Authorized Version's order ("perfected for ever"); the Greek word is a gap in TCP. (2) Hebrews 9:14, 110 words: same words, Goold's OCR noise only. (3) Hebrews 8:6, 110 words: 0.91, all spelling and hyphenation ("Preheminence" / "pre-eminence", "depend" / "depended"). No TCP keying errors found.
- Concerns: only 5 of 13 chapters; enormous length (Hebrews 6:4-6 alone is 12,500 words); Greek gaps on almost every page (Owen argues from the Greek constantly).
- Recommend: yes for Hebrews 6 to 10 and Psalm 130, marked as partial. The rest of Hebrews would need keying from the Goold scans.

## 3. William Tyndale (about 1494 to 1536)

- Written in English, 1525 to 1536. Public domain.
- Founder rule: fits; martyr for the English Bible. Flags: his notes and prologues are sharp against the papacy (a Genesis note, in TCP's chapter 8 division, says rulers "ought not to suffre the popes Caimes thus to shede bloud"; a Deuteronomy 27 note: "Here of take the popes an occasiō to curse .iiij. tymes in the yere"; the Matthew 5 to 7 exposition calls itself "the restorynge agayne of Chrystes lawe corrupte by the Papystes"). His prologue to Hebrews leaves the author open and his prologue to James and Jude reports old doubts, but both argue the epistles should be received ("me thynketh it ought ..."), so he upholds them.
- Best source: TCP, CC0.
  - A68940, 1534 New Testament (Antwerp): commit `543a39e4641198b13d0dabbcf8838365fbfe77de`, 2,151,058 bytes, SHA-256 `77323f5d2bc7c1246263237488061e4fba0860e36422a1e813b9dd9bc0d796fa`. 18 prologues (Romans 13,831 words, Hebrews 1,728, James and Jude 692, the rest 130 to 500) and 1,993 marginal notes (14,103 words, about 580 of them eight words or longer, the rest cross references), in every book but 3 John. Notes per book run from Matthew 372 to Philemon 1.
  - A13203, 1530 Pentateuch: commit `569215d74013781c721a41ded762141f4bd6c5af`, 1,504,114 bytes. Five prologues (about 17,000 words) and 137 notes (2,796 words). The copy filmed was cropped, so many notes have holes ("〈…〉").
  - A16000, Jonah with prologue (1531), A14132, Romans prologue (1526 printing), A14133, exposition of Matthew 5 to 7 (1536, 53 `verse` divisions without n), A68831, Whole Works (1573) with the exposition of 1 John (1531). Commits in `raw/tcp_pins.txt`.
- Accuracy, TCP against the Parker Society edition (1848 to 1849, archive.org OCR), with spelling folded: (1) Romans prologue opening, 120 words: every difference is Parker's modern spelling ("moche" / "much") or a TCP gap. (2) Matthew 5:5, 100 words: spelling only. (3) Jonah prologue opening: TCP has "weſſes of Abraham" where Parker has "wells", a keying error for "welles"; the rest is spelling.
- Size: about 3.7 MB of XML for the NT, Pentateuch and Jonah; the notes and prologues themselves are about 55,000 words.
- Concerns: 1530s spelling is hard for modern readers; illegible rate 21 per 10,000 words (NT), 48 (Pentateuch, cropped notes); polemic; the notes are tied to verses only by position in the text, not by reference numbers.
- Recommend: yes, with care: prologues at book level, notes at verse level, polemical notes reviewed by the founder.

## 4. Richard Sibbes (1577 to 1635)

- Written in English, printed 1630 to 1655; Grosart's Works 1862 to 1864. Public domain.
- Founder rule: fits; much loved Puritan preacher.
- Best source: TCP, CC0.
  - A60194, 2 Corinthians 1 (1655): commit `59c1e9e1f5ff478c7f76b3759f241654d034b6f1`, 2,356,037 bytes, SHA-256 `3b4b7b28e0bcfd5aad8de9b676e4c505f2615ab8a77b5bd8974548489c1ed159`. 21 `commentary_on_verse` divisions keyed to 22 verses (3 and 4 sit inside verse 2), 371,333 words, 139 illegible (3.7 per 10,000).
  - A12167 Bowels Opened, sermons on Song of Songs 4 to 6 (1639), A12184 Philippians 3 (1639), A12190 Hosea 14 (1639), A12171 The Bruised Reed, Matthew 12:20 (1630). Commits in `raw/tcp_pins.txt`. Together about 760,000 words.
- Accuracy, TCP against Grosart volume III (1862, archive.org OCR): 2 Corinthians 1:12, 1:20 and 1:22 openings: same words; one TCP slip "under rhem" for "them" (it may be the 1655 misprint); the rest is OCR noise.
- Concerns: length; Bowels Opened has 1,055 illegible letters (73 per 10,000).
- Recommend: yes, 2 Corinthians 1 first.

## 5. John Bunyan (1628 to 1688)

- Written in English. First editions 1656 to 1688; the Genesis exposition was first printed after his death in the 1692 folio. Offor's Works (Blackie, 1853 to 1862). Public domain.
- Founder rule: fits; Baptist pastor whose whole teaching is from Scripture.
- Best sources:
  - Genesis 1 to 11 (and all of Offor): Project Gutenberg #6049 as kept by GITenberg: `github.com/GITenberg/Works-of-John-Bunyan-Complete_6049`, commit `764a2c9984043905c414fbf3257d87b459cd6ce6`, file `6049.txt`, 12,261,368 bytes, SHA-256 `bd581373968b523cc21090c6a2beb74db1500f0c87dfd2962535b589e74008fb`. License words above (Gutenberg 1.C: free if all references to Project Gutenberg are removed). Produced "by Charles Aldarondo based on a source from www.johnbunyan.org". Plain ASCII with some Latin-1 bytes.
  - First editions in TCP, CC0: A30152 The Holy City (1669, Revelation 21:10 to 22:4, 22 `verse` divisions), A30206 Solomon's Temple Spiritualized (1688), A30122 The Barren Fig Tree (Luke 13:6-9), A30130 Come and Welcome (John 6:37), A30213 Water of Life (Revelation 22:1), A30203 Sighs from Hell (Luke 16).
- Coverage: the Genesis exposition is the only verse by verse work ("Ver. 26." headings, Genesis 1:1 to 11; 84,981 words). The others are treatises on one passage.
- Accuracy: (1) Gutenberg Genesis 3:15 and 1:26 against Offor 1855 volume II (archive.org OCR): same words. (2) Gutenberg Holy City against TCP 1669 (Revelation 21:10): 0.975; 1669 "Much of the Spirit, deserveth much of Gods matters", Offor "discerneth" (an editor's correction or a keying slip, unresolved). (3) Gutenberg Solomon's Temple against TCP 1688: Gutenberg rewrote the references and turned "Chap. 22.1" into "21:12", a real error; "(said he)" became "saith he".
- Concerns: Gutenberg's references were reformatted and are sometimes wrong; its Genesis text starts with a stray "CHAPTER II. Of God." where the book has no chapter heading; headings for Genesis 4 and 7 run into the text. Prefer the TCP first editions where they exist.
- Recommend: yes, second tier (Genesis 1 to 11 from Gutenberg, the rest from TCP).

## 6. Thomas Watson (died 1686)

- Written in English. The Beatitudes (1660); A Body of Practical Divinity (1692, sermons on the Shorter Catechism, with the Ten Commandments and the Lord's Prayer). Public domain.
- Founder rule: fits.
- Best source: TCP, CC0. A96093 The Beatitudes (Phase II): commit `04d9625de7cbc2b951fe9c3cb51b8847b2b3e9af`, 1,660,848 bytes, SHA-256 `318bb76eeb1b22cf95aed9ff677ddb3df1398de7360e609bbfae1044c5e0335b`, 216,887 words, one chapter per beatitude (Matthew 5:1-12) plus other sermons. A65285 Body of Divinity: commit `6dce70a31fcd1867f75c2868d8c7237f4654601e`, 3,419,084 bytes, 521,015 words; only the Ten Commandments (Exodus 20) and Lord's Prayer (Matthew 6:9-13) sections are tied to verses.
- Accuracy: Body of Divinity against the 1855 Carter Select Works (archive.org OCR): fifth petition opening, first commandment opening, and the Scripture section: same words. One reference: TCP (and so the 1692 printing) has "Cant. 3.31" where the 1855 editor has "Lam. iii. 31", which is right; old misprints come through. Beatitudes against the 1660 page images (archive.org OCR): Matthew 5:8 and 5:5 openings agree apart from OCR errors.
- Concerns: Greek gaps (418 and 519); misprinted references kept as printed.
- Recommend: yes, small (Beatitudes first).

## 7. Theodore Beza (1519 to 1605)

- Translations: Psalms paraphrase by Anthony Gilby (1580, second edition 1581); Song of Songs 1 to 3 sermons by John Harmar (1587); Meditations on eight Psalms by John Stubbes (1582). All far before 1931. The Latin Job (1589) has no English in TCP.
- Founder rule: fits; Calvin's successor at Geneva. Flag: the Song of Songs sermons are framed as controversy "betweene vs and the aduersarie" (Rome).
- Best source: TCP, CC0. A10086 Psalms (Phase II): commit `695cbc9b72bf0fcdb5f26b4c35d743557cc5cd1c`, 876,921 bytes, SHA-256 `3d22f54ca1e770bb63a9e61eb6b55e02a4decc540fbdb36eda4cc969f22b98c0`; `div type="Psalm" n=1` to `150`, each with "The Argument" and "The Paraphrase"; 115,929 words; 154 illegible (13 per 10,000). A09998 Song 1 to 3 (31 sermons, 180,011 words, 2.4 per 10,000). A09772 Meditations.
- Accuracy: Meditations, Psalm 6 passage, against the 1582 page images (archive.org OCR): same words, OCR noise only. The Psalms paraphrase has only this one edition in TCP and no reprint, so it was not checked against a second copy.
- Concerns: the paraphrase is per psalm, not per verse; 1580s spelling; little read today.
- Recommend: yes, second tier, at the chapter level for Psalms.

## 8. Jonathan Edwards (1703 to 1758), Notes on the Bible

- Written in English. First printed by Sereno Dwight in Works volume IX (New York: S. Converse, 1830), "Notes on the Bible"; reprinted in Hickman's Works volume II (London, 1834). Public domain. The Yale edition (Notes on Scripture, volume 15, 1998) is under copyright.
- Founder rule: fits.
- Coverage: in the Hickman text, about 420 numbered notes ("[342] Gen. i. 2.") plus essays (The Pentateuch written by Moses), about 227,000 words. Most notes: Genesis 67, Exodus 35, Matthew 29, Isaiah 22, Song of Songs 18, Jeremiah 14, Mark 14, Hebrews 14, Psalms 13, John 13; some 55 books in all.
- Best source: none free. CCEL's Hickman text (`ccel.org/ccel/e/edwards/works2/cache/works2.txt`, 9,879,561 bytes) is under CCEL's terms above and puts the words "Greek or Hebrew" where the book prints a Hebrew or Greek word (65 times in the volume). archive.org has Dwight 1830 volume IX (`worksofpresidented09edwa`, OCR 1,851,967 bytes) with no license stated and rough OCR.
- Accuracy (CCEL against Dwight 1830): note [342] on Genesis 1:2, note [339] on Hebrews 3:6 to 4:11 and note [332] on Matthew 3:2 have the same words; Hickman shortened references ("9 to 15" to "9-15").
- Recommend: not now. A clean text would mean correcting the Dwight OCR by hand (about 227,000 words) or asking CCEL for permission.

## 9. The Westminster Annotations (1645, 1651, 1657)

- "Annotations upon all the books of the Old and New Testament", by members of the Westminster Assembly (Wing lists it under John Downame). Third edition 1657 in two folio volumes. Written in English, public domain.
- Founder rule: fits.
- Best source: none. Not keyed by TCP (I searched the catalog of 61,315 texts by its title words and by Downame, Gataker and Ley; no copy). archive.org has scans only: 1645 (`annotationsupona00down`, a Boston Public Library copy interleaved with Samuel Sewall's handwritten notes, so its OCR is mostly handwriting noise), and EEBO images of 1645, 1651 and 1657. Reformed Books Online says the 1657 text is on the commercial Puritan Hard Drive.
- Side note: TCP has Edward Reynolds' "Annotations on the book of Ecclesiastes" (1669, A57129, CC0, 95,613 words). A forum post says Reynolds wrote the Ecclesiastes part of the Annotations; I could not confirm the 1669 book is the same text.
- Recommend: no. It would need keying from page images (two folios).

## 10. Heinrich Bullinger (1504 to 1575)

- Translations: A Hundred Sermons upon the Apocalypse by John Daus (1561); Fifty Godly and Learned Sermons (the Decades) by H. I. (1577); A Commentary upon the Second Epistle to the Thessalonians by R. H. (1538); The Sum of the Four Evangelists by John Tomkys (1582). Parker Society Decades 1849 to 1852. Public domain.
- Founder rule: fits as a believer. Flags: the Revelation sermons read the beast and the whore as Rome and the papacy throughout (sermon heads: "the destruction of Rome", "Saracenes and turkishe matters"); the 1538 Thessalonians title promises "the fall and vtter confusion of the kyngdome of Antichriste". The app already cites E. W. Bullinger (`bullinger-cb`, `bullinger-fos`), so a new id would have to make the difference plain (for example `heinrich-bullinger`).
- Best source: TCP, CC0. B11837 Revelation: commit `e6602a1f3cc7d529ad204e5ac22f8d1439691aa9`, 2,498,029 bytes, SHA-256 `5903dc4f4ec6f98baf3e2b85f449997e4de1b2c365e3ea34684238d68cf2720b`; 101 sermons, each quoting its Revelation passage; 318,679 words; 1,443 illegible (45 per 10,000). A17183 Decades (doctrine, not verse comment), A17182, A17221.
- Accuracy: Decades, first sermon opening, against Parker Society 1849 (OCR): same words. Revelation sermon 50 against the 1561 page images (black letter, rough OCR): agrees as far as the OCR can be read.
- Recommend: no, unless the founder wants a Reformation voice on Revelation and accepts the polemic.

## 11. John Knox (about 1514 to 1572)

- Written in Scots English. "A Fort for the Afflicted" (London, 1580) is his exposition of Psalm 6; Laing's Works volume III (1854) prints it from manuscript in Scots spelling. The 1583 "Notable and comfortable exposition upon the fourth of Matthew" that Laing gives to Knox is catalogued by TCP (A08599) under Thomas Bentham, so its authorship is disputed.
- Best source: TCP A04930, CC0, commit `c16d2aa9ea87036b35dcb7172a39d5b5dcee0bf5`, 159,081 bytes, 19,827 words, not keyed by verse, 145 illegible (73 per 10,000).
- Accuracy: two passages against Laing (OCR) agree word for word apart from Scots against English spelling ("wecht" / "waight"); Laing's footnotes broke the third.
- Recommend: no (one psalm, and the Psalms are well covered).

## 12. Philip Melanchthon (1497 to 1560)

- No English translation before 1931 of his commentaries (Romans, Colossians, Daniel) was found. The nearest is George Joye, "The exposicion of Daniel the prophete gathered oute of Philip Melanchton, Iohan Ecolampadius, Chonrade Pellicane & out of Iohan Draconite" (Antwerp, 1545): TCP A04696, CC0, 118,613 words, 12 chapter divisions, 668 illegible (56 per 10,000). Not checked against another copy.
- Recommend: no. It is Joye's compilation from four writers, not Melanchthon's own words, and 1540s spelling.

## 13. Ulrich Zwingli (1484 to 1531)

- No verse by verse work in English before 1931. TCP has seven Zwingli items: confessions (1548, 1555), a pastoral tract (1550), precepts for youth (1548), a Passion and Easter harmony from the four Gospels (1561, A15874), and the 1572 Palfreyman volume (A08849), whose paraphrase of Romans is anonymous (Palfreyman: "by whome, or by what meanes I knowe not") with two short Zwingli pieces added. The Latin Works in English (Jackson, 1912 to 1929) are treatises.
- Recommend: no.

## Tools and checks

- `reformers/scripts/tcpstats.py` (words, gaps, notes, division types per TCP file; output `raw/tcp_stats.txt`), `tcpdivs.py` (list divisions), `vcover.py` (verse keys per chapter), `tcptext.py` (XML to text), `cmpw.py` (word alignment of two copies, `--skel` folds old spelling), `ias.py` (archive.org search), `edw_notes.py` (Edwards note count).
- Check copies used: `dl/ia/owen_goold23.txt`, `dl/ia/edwards_dwight09.txt`, `dl/ia/bunyan_offor02.txt`, `dl/ia/sibbes_grosart03.txt`, `dl/ia/watson_select1855.txt`, `dl/ia/watson_beat1660_ocr.txt`, `dl/ia/doctrinaltreatis00tynduoft.txt`, `dl/ia/expositionsnotes00tynduoft.txt`, `dl/ia/worksofjohnknox03knoxuoft.txt`, `dl/ia/bullinger_dec12.txt`, `dl/ia/bullinger_apoc1561_ocr.txt`, `dl/ia/beza_medit1582_ocr.txt`, `raw/ccel/manton05.txt`, `manton06.txt`, `manton08.txt`, `edwards_works2.txt`.
