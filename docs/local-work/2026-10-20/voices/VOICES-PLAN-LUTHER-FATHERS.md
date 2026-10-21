# More writers at Deep: Luther, the Reformers and Puritans, and the church fathers

Plan written 2026-10-20. Research only: nothing in the Bible Atlas clone (C:\Users\shubh\Projects\BibleAtlas, read at main 5296d48; the voices files are the same at 75f6edc) was changed. It builds on the research notes group-luther.md, group-reformers.md and group-fathers.md in this folder, and on a separate check pass that re-fetched every recommended source, its pinned commit, its license words and samples of its text.

This is the second of two plans. The first track (VOICES-PLAN.md, beside this file) covers Gill, Barnes, Clarke, JFB, Poole, the full Henry, Keil and Delitzsch, Spurgeon, Simeon, Ellicott, the Pulpit Commentary, Ryle, Bengel, Alford, Robertson, Calvin, Bullinger, the Geneva notes, Scofield and the Treasury of Scripture Knowledge. VOICES-PLAN.md had not been written when this plan was finished, so section 6 is written against the first track's research notes (group-1.md to group-4.md) and names the parts both plans share, which should be decided once.

The founder's rule (PR #37): cite only "bible believing people who fully believe the bible and theologians that love God, not people who are liberalizing the bible". Catholic and Orthodox writers who uphold Scripture are kept; Jewish scholars and rabbinic commentary are not cited; the Historical Christian Faith site was dropped as a link because it "mixes in writers the early church condemned". Public domain here means published in English in 1930 or earlier, or never renewed, and the transcription itself must be free to copy.

## 0. In short

- **Fourteen works are worth adding** (section 2). Four of them give the app what it lacks most: church fathers outside the Gospels. Chrysostom's homilies cover Acts, Romans to Philemon and Hebrews almost verse by verse. Gregory the Great covers Job. Augustine covers John and 1 John, and Cyril covers John. Luther adds Galatians and Genesis 1 to 9, and later the Church Postil. The Puritans (Owen, Watson, Manton, Bunyan, Sibbes) add a few books in great depth.
- **Almost all of it is already on github.com under a clean license.** The fathers come from HistoricalChristianFaith/Commentaries-Database (a public-domain dedication), filtered hard: only the 19th-century translations, and only fathers on an approved list. Luther's Galatians and Genesis come from GITenberg (Project Gutenberg, "Public domain in the USA"). The Puritans come from the Text Creation Partnership (CC0). Only three need a mirror branch: the CrossWire SWORD module Luther (for the Church Postil and the Sermon on the Mount), tertullian.org's Cyril on John, and Project Gutenberg's Luther on the Psalms.
- **Everything in the first round is public domain, CC0 or under a public-domain dedication.** NOTICE.md can keep saying the built voices files are public domain. Wikisource (CC BY-SA) and the Lutheran Library (CC BY 4.0) are left for later.
- **The build has to change before any of this fits** (section 6): the index allows only three works, the panel loads every work's notes for a book at once, and some notes here are book-length (Sibbes on 2 Corinthians 1:12 runs to 67,452 words). The first track needs the same changes, so they should be made once, for both plans.
- **The founder has to decide about Luther's polemic before Luther ships.** He calls the pope the Antichrist and writes harshly about the Jews, far more often than Henry or Wesley do in the app today. The founder also has to decide about the fathers already in the shipped Catena who fail his rule (Origen, quoted 638 times). See section 7.

## 1. What the build does today

- `crates/atlas-cli/src/extra_voices.rs` reads three works: `catena-aurea` (AlvaroBalbin/catena, one JSONL per Gospel), `henry-concise` and `wesley-notes` (Let's Church `mhcc.json` and `wesley.json`, from CrossWire SWORD modules). Each reader checks the source's own license marker and stops the build if it changes (`license != "public-domain"` for the Catena; `work.license != "Public Domain"` for Let's Church).
- Notes are placed by KJV verse numbers. An item is `[work, from, to, voices]`, never crossing a chapter. `voices` is a list of `[who, text]`, and only the Catena's voices carry a name.
- Output: `extras/voices.json` holds `has`, one character per verse, '0' plus a bit for each work (1, 2, 4), plus the list of part files. `extras/voices/<Book>.<k>.json` holds all works' notes for a run of chapters, split at about 500,000 bytes. The panel loads one part file, with every work in it, when the reader opens it at Deep after choosing "Show what they wrote".
- `verify` insists on exactly three works: `has` characters '0' to '7', `w < 3`, a name only on the Fathers' notes, the index under 200,000 bytes, every part file under 1,500,000 bytes, plus known cases (Chrysostom on John 1:1, Henry on Genesis 1:1, Wesley on John 9:38).
- The web side hard-codes the three works (`web/src/ui/extras/voices/model.ts` WORKS, the Panel's "How these are chosen" rows and its source line).
- Sources are pinned 40-character commits on github.com (`sources.json`). `atlas fetch` does a sparse, blobless checkout of only the listed files and records each file's SHA-256 in `manifest.lock.json`. A non-GitHub file is mirrored to its own branch by a workflow that checks hashes, as `.github/workflows/mirror-meaning-model.yml` does on branch `claude/ask-the-bible-u6macl`.
- Today's voices data: 81 part files, about 15 MB; Catena on 3,774 verses, Henry on 31,055, Wesley on 16,704.
- The shipped text already has some of the same edges as the new writers. Counted in the live files: Wesley names the pope, papal or "Papists" 31 times and the Antichrist 21 times. Henry says 2 Thessalonians 2 "exactly agrees with the system of popery". So anti-papal language is not new to the app; what is new is how much of it Luther has.

## 2. Ranked shortlist

Ranked by what each adds where the app has nothing but Henry and Wesley, how clearly it passes the founder's rule, how clean and checked the source is, and how much work it takes. "Words" and "MB" are of the source text as found.

| # | Writer and work | English translation | Source | New coverage | Size | Main concern |
|---|---|---|---|---|---|---|
| 1 | John Chrysostom, Homilies on Matthew, John, Acts, Paul and Hebrews | Oxford Library of the Fathers 1839-77, revised for NPNF I 10-14, 1888-90 | HCF, filtered | 5,109 verses; near complete on 17 NT books | 6.67 MB | HCF's excerpts skip text without marking it |
| 2 | Augustine, Tractates on John; Ten Homilies on 1 John | Gibb and Innes 1873; Browne 1848-49 rev. Myers; NPNF I 7, 1888 | HCF, filtered and checked entry by entry | John 712, 1 John 90 verses | 1.66 MB | About 28 entries are another translation |
| 3 | Martin Luther, Galatians (1535 lectures), abridged | Theodore Graebner, 1939 | GITenberg #1549 | Galatians, 149 verses | 0.5 MB | Abridged and modernized; "The Pope is the Antichrist" |
| 4 | Martin Luther, Genesis 1-9 | J. N. Lenker after Henry Cole, 1904 and 1910 | GITenberg #48193, #27978 | Genesis 1:1 to 9:29 | 1.76 MB | Names Rashi and Lyra; harsh lines on the Jews |
| 5 | Gregory the Great, Morals on the Book of Job | Library of the Fathers, 1844-50 | HCF, filtered and checked entry by entry | Job 1,030 of 1,070 verses | 4.03 MB | Allegory; about 28 misfit entries |
| 6 | Cyril of Alexandria, Commentary on John | P. E. Pusey 1874, Thomas Randell 1885 | tertullian.org (mirror) | John 703 verses | 2.7 MB | Books 7-8 only fragments |
| 7 | Martin Luther, Church Postil (Gospel and Epistle sermons) and Sermon on the Mount | Lenker and others 1904-09; Charles A. Hay 1892 | CrossWire SWORD module Luther 1.1 (mirror) | about 1,300 NT verses | 3.0 MB zipped | Heaviest polemic of all |
| 8 | John Owen, Hebrews 6-10; Psalm 130 | written in English, 1680 and 1669 | TCP A53678, A53721 | 127 + 8 verses | 4.37 + 1.17 MB XML | Very long; Greek not keyed |
| 9 | Thomas Watson, The Beatitudes | written in English, 1660 | TCP A96093 | Matthew 5:1-12 | 1.66 MB XML | Verse only in chapter headings |
| 10 | John Bunyan, Genesis 1-11; The Holy City | written in English, 1692 and 1669 | GITenberg #6049; TCP A30152 | Genesis 1-11; Revelation 21:10-22:4 | 85,000 + 67,000 words | Gutenberg rewrote some references wrongly |
| 11 | Thomas Manton, Psalm 119; Jude | written in English, 1681 and 1657 | TCP A51842, A89503 | 163 + 25 verses | 7.22 + 1.9 MB XML | 5,000 to 8,000 words a verse |
| 12 | Richard Sibbes, 2 Corinthians 1 | written in English, 1655 | TCP A60194 | 24 verses | 2.36 MB XML | One verse runs 67,452 words |
| 13 | Martin Luther, Manual of the Book of Psalms | Henry Cole, 1837 | Project Gutenberg #75892 (mirror) | all 150 Psalms, one summary each | 0.62 MB | Psalm-level, not verse-level |
| 14 | Augustine, Expositions on the Psalms (the verbatim part) | Oxford LF 1847-57, condensed by A. C. Coxe for NPNF I 8, 1888 | HCF, filtered | 989 Psalm verses | about 1 MB | Condensed; New Advent copies must go |

Why this order: 1, 2 and 5 put the fathers on books where the app has none (the Catena stops at the Gospels) and come from one reader of one GitHub source. 3 and 4 are Luther's central exegesis, pass the rule plainly (Genesis reads six literal days and a worldwide flood), and are on GitHub. 6 is almost all new (the Catena has one Cyril quote on John) but needs a mirror. 7 is Luther's own favourite book and covers the most verses, but it carries the most polemic, so it waits on the founder's answer. 8 to 12 are much-loved Puritans who cover few verses in great depth, and they need the long-note display. 13 and 14 are useful but light or condensed.

### 1. John Chrysostom, Homilies (NPNF series I, vols 10 to 14)

- Translation: Oxford Library of the Fathers (Matthew by Sir George Prevost; Acts by J. Walker, J. Sheppard and H. Browne; Romans by J. B. Morris and W. H. Simcox; others), 1839 to 1877, revised for NPNF in 1888 to 1890 by M. B. Riddle, Philip Schaff, George B. Stevens, Talbot W. Chambers, Gross Alexander and Frederic Gardiner.
- Source: github.com/HistoricalChristianFaith/Commentaries-Database at `6a4c2e86187a3e11e79ecf2063ae56b61c6295c2` (2026-10-18), folder `John Chrysostom`, one TOML file per verse (`Matthew 24_4.toml`), each `[[commentary]]` with `quote`, `source_title`, `source_url`. Keep an entry only when its `source_url` is a `historicalchristian.faith/by_father.php` link into `John Chrysostom/Homilies/...`, its `source_title` is in mixed case ("Homily on the Gospel of Matthew 75") and `append_to_author_name` is empty. That drops the capital-letter ACCS excerpts (copyrighted), the newadvent.org copies (modernized, copyright claimed), the copies of the Catena and entries with no link.
- License, LICENSE at that commit (read again for this plan): "is released into the public domain. You may copy, modify, distribute, and use this material for any purpose, without restriction or attribution." Its second section: "The public-domain dedication in the first section does not extend to the fair-use excerpts covered by this notice." The filter keeps only the public-domain kind.
- Coverage after the filter: 5,447 entries on 5,109 verses in 42 books. Near complete on Matthew (1,005 of 1,071), John (735 of 879), Acts (961 of 1,007), Romans (431 of 433), 1 Corinthians (419 of 437), 2 Corinthians (257 of 257), Galatians (148 of 149), Ephesians (155 of 155), Philippians (103 of 104), Colossians (95 of 95), 1 and 2 Thessalonians (89 of 89, 46 of 47), 1 and 2 Timothy (113 of 113, 78 of 83), Titus (44 of 46), Philemon (25 of 25) and Hebrews (301 of 303). Drop the 9 Sirach verses (Apocrypha).
- Size: 6.67 MB of text.
- Accuracy: six passages compared letter by letter with the NPNF I vols 10 and 11 scans (Matthew Homilies 48, 69, 75; Romans 5, 26; Acts 44) were verbatim. All 853 Matthew entries scored at least 0.6 on a five-word overlap with the scan OCR, so no modern text was found slipped in.
- Concerns:
  - HCF leaves sentences out without an ellipsis (about 300 words between paragraphs in the Homily 75 entry keyed to Matthew 24:4). Either mark each skip with "…" from a one-time comparison with the NPNF text (kept as a table in config, like `HENRY_ENDS`), or say plainly that these are passages HCF chose.
  - HCF keys some quotes to a verse the homily only cites (a Matthew homily under 1 Timothy 2:9). Keep entries keyed in the book the homily is on; show others as "cited", or leave them out.
  - It overlaps the Catena's 2,120 Chrysostom quotes on Matthew and John, which are another English (through Aquinas' Latin).
  - HCF's own upstream was a CCEL-type keying. CCEL asks to be asked before republishing, but the text is public domain and HCF dedicates its copy. Record this in NOTICE.md.
  - The founder dropped HCF as a link. Taking its repository as a source, and crediting it, needs his OK (question 3).
  - Already on the cite list as `chrysostom`.

### 2. Augustine, Tractates on John and Ten Homilies on 1 John (NPNF I vol 7)

- Translation: John Gibb (Tractates 1 to 37) and James Innes (38 to 124), Edinburgh 1873; the 1 John homilies by H. Browne (Library of the Fathers, 1848 to 1849), revised by J. H. Myers; NPNF 1888.
- Source: HCF at the same commit, folder `Augustine of Hippo`, only entries linked to the by_father folders `TRACTATES ON JOHN` and `Ten Homilies on the First Epistle of John`, with mixed-case titles.
- License: as for Chrysostom.
- Coverage: John 712 of 879 verses (973 entries); 1 John 90 of 105 verses (197 entries).
- Size: 1.46 MB and 0.2 MB.
- Accuracy: samples from Tractates 7, 16, 26, 38, 44, 83 and 114 and Homilies 3 to 6, 9 and 10 match the NPNF I vol 7 scan (one HCF slip, "thou shall" for "thou shalt"). But about 28 of 1,170 entries fail: the Tractate 24 entries on John 6:1-14 are another translation ("The miracles which our Lord Jesus Christ wrought ... admonish the human mind", where NPNF has "The miracles performed by our Lord ... incite the human mind").
- Concerns: check every entry against the NPNF text once and commit the list of those dropped; silent skips inside excerpts, as for Chrysostom; overlaps the Catena's 968 Augustine quotes on John. Augustine is named in the cite list's `church-fathers` entry.

### 3. Martin Luther, Commentary on Galatians (abridged)

- Translation: Theodore Graebner, from a draft by Gerhardt Mahler, Zondervan 1939 (the SWORD module cites a 1949 printing). No renewal was found in the 1965 to 1968 or 1976 to 1977 renewal records.
- Source: github.com/GITenberg/Commentary-on-the-Epistle-to-the-Galatians_1549 at `e362c0a3444c3f9c9668eb4157a76c3bcd59a223`, `1549.txt` (500,649 bytes).
- License: `metadata.yaml` "rights: Public domain in the USA." (read again for this plan); the text ends "is in the public domain. You may freely distribute, copy or print this text." CCEL's copy is not usable (personal, educational or non-profit use only).
- Coverage: Galatians 1:1 to 6:18. 147 headings for 149 verses (1:22-24 share one). In this snapshot the heading for 5:5 reads "VERSE 6": fix it by a small table, as `HENRY_ENDS` does.
- Size: 0.5 MB.
- Accuracy: matched the CCEL and Lutheran Library copies 150 of 150 words at three places (all from the same Project Wittenberg keying). The SWORD copy of Galatians 3:13 matched 119 to 120 of 120.
- Concerns: Graebner says he set out to "make Luther talk American" and to "streamline" him, so show it as "abridged" in its book line. Ten mentions of the Antichrist ("The Pope is the Antichrist") and 67 lines naming the pope or papists; attacks on monks, the sophists and the Anabaptists. Remove the Project Gutenberg header and footer (its license asks that all references to Project Gutenberg be removed when the text is reused).

### 4. Martin Luther, Lectures on Genesis 1 to 9

- Translation: J. N. Lenker's revision of Henry Cole's 1858 translation: "Luther on the Creation" (1904) and "Luther on Sin and the Flood" (1910).
- Source: GITenberg `Commentary-on-Genesis-Vol-I-Luther-on-the-Creation_48193` at `8d4140fd0b6e85bb7bfb00bf6525caf1ac63a7c9` (`48193-8.txt`) and `Commentary-on-Genesis-Vol.-IILuther-on-Sin-and-the-Flood_27978` at `8319ed17c0af0dde6505838d501034ec7df245fb` (`27978.txt`, 763,457 bytes).
- License: both `metadata.yaml` files: "rights: Public domain in the USA."
- Coverage: Genesis 1:1 to 4:15 and 4:8 to 9:29, as a running commentary under headings such as "V. 6." and "V. 8b.". Headings are sparse (59 in vol. 1 for about 94 verses, 70 in vol. 2 for about 158), so place each section on the verses from its heading to the next.
- The two volumes overlap. I checked Genesis 4:14 in both: vol. 1 reads "From these words it still more plainly appears that the sentence and curse on Cain were pronounced by Jehovah through the mouth of Adam"; vol. 2 reads "205. From these words it appears that the sentence on Cain was pronounced through the mouth of Adam." Keep one for 4:8-15 (vol. 2, Lenker's own) so the verse does not show Luther twice. Drop Lenker's paragraph numbers ("205.").
- Size: 1.76 MB.
- Accuracy: vol. 1 against the 1904 scan 150, 147 and 146 of 150 words; vol. 2 against the 1910 scan 138, 148 and 148 of 150; every difference was a scan OCR error.
- Concerns: Luther quotes and argues with Rabbi Solomon (Rashi) and Lyra about 33 times in each volume, and with the rabbis 17 times; "the idle fables of the Jews"; "the miserable state of the Jews at the present day"; the pope 59 and 121 times, the Antichrist 11 times in vol. 2. Rashi is on the avoid list (see section 6.6).

### 5. Gregory the Great, Morals on the Book of Job

- Translation: Library of the Fathers (Oxford), 1844 to 1850, preface signed C. M. (Charles Marriott); archive.org credits James Bliss for vol. 3 part 2.
- Source: HCF at the same commit, folder `Gregory the Dialogist`, only entries linked to `Morals on the Book of Job` (HCF took them from Lectionary Central's transcription, which states no license; the 1844 text is public domain and a scan carries the Public Domain Mark).
- License: as for Chrysostom.
- Coverage: Job 1,030 of 1,070 verses (1,151 entries). Job has no father in the app today.
- Size: 4.03 MB.
- Accuracy: samples from Books 4, 5, 6, 15, 16, 20, 24, 27 and 28 match the Library of the Fathers scans, except that HCF adds labels ("Moral interpretation", "Mystical interpretation") and leaves sentences out. About 28 entries (2%) score under 0.6 against the scans, some of them modern wording under a Morals label (at Isaiah 60:8: "for death indeed climbs in through the windows"): check every entry and drop the misfits.
- Concerns: Gregory reads each verse in a historical, an allegorical and a moral sense, so many notes are allegory (question 9). Replace HCF's labels with the app's own plain label. Leave out HCF's Gregory Gospel homilies, Ezekiel homilies and 1 Kings commentary: they are new unsigned translations. Gregory was pope from 590 to 604; the Catholic allowance covers him.

### 6. Cyril of Alexandria, Commentary on John

- Translation: P. E. Pusey (Library of the Fathers vol. 43, 1874) and Thomas Randell (vol. 48, 1885).
- Source: tertullian.org/fathers/cyril_on_john_*.htm (a preface and twelve books, transcribed by Roger Pearse, 2005), mirrored unchanged to a branch. Not HCF: about 79 of its 922 Cyril entries are modern wording under old titles (a second John 20:21 entry reads "that they might fully comprehend their mission", where Randell has "that they might know thereby that they were bound"), and HCF changed "shew" to "show" 746 times.
- License: every page footer: "This text was transcribed by Roger Pearse, 2005. All material on this page is in the public domain - copy freely."
- Coverage: John 703 of 879 verses. Books 7 and 8 (about John 10:18 to 12:48) survive only as fragments of doubtful authenticity: label them or leave them out. The pages print each verse before Cyril's comment, with its number ("29 The next day he seeth Jesus coming to him."; "43 The day following Jesus would go forth into Galilee"; checked in Book 2), so the build can place each section by these lines, as it does the Catena's Gospel lines, with chapters followed in order. HCF's keys can serve as a cross-check.
- Size: 2.7 MB of text (about 3.1 MB of HTML in 13 pages).
- Accuracy: Books 2, 3 and 4 (John 4:14, 6:16, 6:59) verbatim against the 1874 scan.
- Concerns: Pusey's English is stiff; Pearse's footnotes are left out of the pages. The Catena has one Cyril quote on John, so this is almost all new.

### 7. Martin Luther, Church Postil and Sermon on the Mount

- Translation: J. N. Lenker and others: Gospel sermons, Lenker vols. 10 to 14 (1904 to 1907); Epistle sermons, vols. 7 to 9 (1908 to 1909). Sermon on the Mount: Charles A. Hay (Lutheran Publication Society, 1892).
- Source: the CrossWire SWORD module Luther, version 1.1 (`https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Luther.zip`, 3,041,937 bytes, Last-Modified 2015-07-21), mirrored to a branch. It already places each sermon on its passage in KJV numbering. GITenberg has Epistle vols. 2 and 3 (commits `06efbfcbfcbe0a89774b0f41d1c3be849fc9735a` and `17ecb2b978bca921be6c5ab64cd01e2e31434ff5`) for checking.
- License: `luther.conf` "DistributionLicense=Public Domain". The conf's About line also names "Works of Martin Luther, A.J. Holman Company ... Vol 1 (1915) through Vol 6 (1933)". Holman vol. 5 (1931) was renewed (R238530, 26 June 1959) and stays in copyright until 2027. No vol. 5 work was found in the module, and this plan takes only the Lenker Postil sermons and Hay's Sermon on the Mount, chosen by title, so no Holman text is used at all.
- Coverage: Gospel sermons, 110 on 66 passages (Matthew about 20, Mark 4, Luke about 22, John about 17; about 650 verses). Epistle sermons, 72 on 67 passages (Romans, 1 and 2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 1 and 2 Thessalonians, Hebrews 9, James 1, 1 Peter, 2 Peter 3, 1 John, and Acts 1, 2, 10 and 13; about 560 verses). Sermon on the Mount: Matthew 5:1 to 7:29 verse by verse.
- Size: 3.0 MB zipped (the conf's InstallSize is 3,510,625 bytes).
- Accuracy: Luke 2:1 against the Lenker vol. 10 scan differs only in "to-day" made "today" and "says:" made "says,"; Romans 12:1 118 to 119 of 120; Romans 13:11 word for word except "Spirit" capitalised; Matthew 5:3 word for word against the 1892 scan. The module is lightly normalised, the same standard as the SWORD modules Henry and Wesley come from.
- Concerns: the most polemic of anything here: about 750 mentions of the pope or papists and 47 of the Antichrist ("the pope, the Antichrist") in the Gospel sermons; "heathen and Jews, the Devil's own"; "He called the Jews a generation of vipers, children of the devil, hypocrites, blind dolts, liars"; the Turks 117 times. Drop the Ecclesiasticus 15 sermon (Apocrypha). Strip Lenker's notes. The module repeats a sermon on every verse of its passage: store it once per passage.
- Ship only after the founder answers question 1.

### 8. John Owen, Hebrews 6 to 10 and Psalm 130

- Written in English: the 1680 continuation volume of his Hebrews, and A Practical Exposition on the 130th Psalm (1669).
- Source: github.com/textcreationpartnership/A53678 at `e5d5779408ec6294b29a69cf555b3b0659ad107b` (A53678.xml, SHA-256 0436c101f08640cf6de5f3b6a1cad6bc81b9056b4f19a89ab0e62996faed2b87) and A53721 at `278db1cbbd6b04711579748e4ab09a5fb47b49a8` (SHA-256 7edca74db3a441ec58c786c4d382cb59d9da97e66c586bd83512ce43b17cd847).
- License (README "Availability" and the TEI header, read again for this plan): "This Phase I text is available for reuse, according to the terms of Creative Commons 0 1.0 Universal. The text can be copied, modified, distributed and performed, even for commercial purposes, all without asking permission."
- Coverage: Hebrews 6:1 to 10:39, 127 of 128 verses in their own divisions (10:1 has none); Psalm 130:1-8 (divisions 1-2, 3, 4, 5, 6, 7-8). 611,398 and 170,632 words.
- Accuracy: against Goold's edition (archive.org OCR), Hebrews 10:14 0.96, 8:6 0.91 and 9:14 the same words, all differences spelling or Goold's changes; Psalm 130:4 97 of 100 words. Only 12 to 16 illegible gaps, a very clean keying.
- Concerns: only chapters 6 to 10 are free (1 to 5 and 11 to 13 exist only as scans); very long (Hebrews 6:4-6 is 12,500 words); 3,192 Greek and Hebrew words are not keyed, and Owen argues from the Greek constantly; TCP line breaks split words ("belie ving") that must be joined; names Kimchi once.

### 9. Thomas Watson, The Beatitudes

- Written in English, 1660.
- Source: TCP A96093 at `04d9625de7cbc2b951fe9c3cb51b8847b2b3e9af` (SHA-256 starting 318bb76e, as the check pass confirmed).
- License (Phase II wording): "To the extent possible under law, the Text Creation Partnership has waived all copyright and related or neighboring rights to this keyboarded and encoded edition of the work described above, according to the terms of the CC0 1.0 Public Domain Dedication".
- Coverage: Matthew 5:1-12, one or more chapters on each beatitude (23 chapters), plus sermons added at the end; 216,887 words.
- Accuracy: the chapters on 5:8 and 5:5 agree with the 1660 page images except for OCR noise; 187 illegible gaps and 418 Greek gaps.
- Concerns: verses are named only in chapter headings; the added sermons are on other texts (place them by their text or leave them out).

### 10. John Bunyan, Genesis 1 to 11 and The Holy City

- Written in English: An Exposition on the First Ten Chapters of Genesis and Part of the Eleventh (first printed 1692), and The Holy City (1669).
- Source: GITenberg `Works-of-John-Bunyan-Complete_6049` at `764a2c9984043905c414fbf3257d87b459cd6ce6`, `6049.txt` (12,261,368 bytes; the exposition starts about line 124,260 with "Ver. n." headings), and TCP A30152 at `bf1dab5b2af02ecc73a0c1c2158c8227136110a8` (The Holy City).
- License: Project Gutenberg's LICENSE 1.C: "If an individual work is in the public domain in the United States and you are located in the United States, we do not claim a right to prevent you from copying, distributing, performing, displaying or creating derivative works based on the work as long as all references to Project Gutenberg are removed." TCP: CC0, Phase I wording.
- Coverage: Genesis 1:1 to 11 verse by verse (84,981 words); Revelation 21:10 to 22:4 (22 verse divisions, 67,130 words).
- Accuracy: Genesis 3:15 and 1:26 the same words as Offor's 1855 edition; The Holy City 0.975 against Offor; 135 illegible gaps.
- Concerns: Gutenberg rewrote Scripture references into modern form and some are wrong (in Solomon's Temple, "Chap. 22.1" became "21:12"); check the Genesis references against the Offor scans. A stray "CHAPTER II. Of God." heading, and some headings run into the text. Gutenberg says the text came from johnbunyan.org via Charles Aldarondo.

### 11. Thomas Manton, Psalm 119 and Jude

- Written in English: One Hundred and Ninety Sermons on the Hundred and Nineteenth Psalm (1681) and A Practical Commentary on the Epistle of Jude (1657).
- Source: TCP A51842 at `999d73dd5d6dc43fef76f9606c50e851239a5b33` (SHA-256 starting 5b0e734a) and A89503 at `4e5021c1685e6a949d874b309d336c6e9a4b6e79` (SHA-256 starting 59106e5f), both confirmed by the check pass.
- License: CC0, Phase I wording.
- Coverage: Psalm 119, 190 sermons on 163 of 176 verses (none on 69, 70, 84, 86-88, 95, 157-160, 169, 170). The verse is named only in the sermon head ("PSAL. CXIX. VER. 105."), sometimes in Roman numerals or with a gap ("VER. III." for 111, "VER. 1 [gap] 2" for 162). Jude 1 to 25 in 24 divisions (22 and 23 share one). 1,132,355 and 241,309 words.
- Accuracy: the openings on Psalm 119:105 and 119:1 match Nisbet's 1871 edition at 0.98 (spelling only); Jude 3 the same words. Gaps: 475 illegible and 408 Greek or Hebrew in Psalm 119; about 1,120 illegible single letters and 283 Greek in Jude.
- Concerns: very long (5,000 to 8,000 words a sermon; Jude 1 alone 28,732 words); 1681 and 1657 spelling, with the long s in Jude; names Aben Ezra and Kimchi about 20 times.

### 12. Richard Sibbes, Commentary on 2 Corinthians 1

- Written in English, 1655.
- Source: TCP A60194 at `59c1e9e1f5ff478c7f76b3759f241654d034b6f1` (SHA-256 starting 3b4b7b28, confirmed by the check pass).
- License: CC0, Phase I wording.
- Coverage: 2 Corinthians 1:1-24 in 21 divisions (verses 3-4 sit inside the verse 2 division; 8 and 9 share one); 371,333 words.
- Accuracy: the openings on 1:12, 1:20 and 1:22 are the same words as Grosart's 1862 edition; one slip ("under rhem"); 139 illegible gaps.
- Concerns: 1:12 alone is 67,452 words. This one cannot ship without the long-note design in section 6.2.

### 13. Martin Luther, A Manual of the Book of Psalms

- Translation: Henry Cole, London 1837.
- Source: Project Gutenberg #75892 (released 17 April 2025; no GitHub copy), mirrored to a branch. The Lutheran Library PDF (CC BY 4.0) is an alternative but needs attribution and is a PDF.
- License: "This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever."
- Coverage: all 150 Psalms, one summary each, with Luther's preface; about 106,700 words. Each summary covers its whole psalm, as Henry's whole-chapter notes do.
- Accuracy: 150, 143 and 146 of 150 words against the 1837 scan; the differences were OCR errors.
- Concerns: mild polemic (Antichrist 4 times, Jews 33). Psalm-level only.

### 14. Augustine, Expositions on the Psalms (the part HCF hosts verbatim)

- Translation: the Oxford translation (J. E. Tweed, T. Scratton, H. M. Wilkins and others, 1847 to 1857), condensed for NPNF I vol. 8 by A. Cleveland Coxe, 1888.
- Source: HCF, only entries linked to `Augustine of Hippo/ON THE PSALMS`. Drop all 1,437 entries linked to newadvent.org: they are modernized ("hath" to "has", "meaneth thy word" to "means your word") and the site claims copyright.
- License: as for Chrysostom.
- Coverage: 937 entries on 989 Psalm verses.
- Accuracy: 897 of the 937 score at least 0.9 against the NPNF I vol. 8 scan; the rest 0.6 to 0.9, which is OCR noise.
- Concerns: NPNF vol. 8 is Coxe's condensation, not the whole work; Augustine reads the Psalms as the voice of Christ and the Church. The rest would have to come from Wikisource (CC BY-SA, imported by a bot from CCEL in 2008, marked 50%, not proofread).

## 3. Later: good, but more work first

| Work | Why later |
|---|---|
| Tyndale, prologues and marginal notes (1534 NT, 1530 Pentateuch, Jonah, 1526 Romans prologue): TCP A68940, A13203, A16000, A14132, CC0 | 1,993 NT notes and 137 Pentateuch notes have no verse numbers, so each must be placed by hand; 1530s spelling and abbreviations; cropped Pentateuch notes; anti-papal glosses for review. The book prologues (about 39,000 words) need a "note on the whole book" that the build does not have. |
| Tyndale, Exposition of Matthew 5-7 (A14133) and of 1 John (A68831, inside the 1573 Whole Works) | Verse divisions carry no numbers; the 1 John part must be cut out of a 6.2 MB file that also holds Frith, Barnes and the disputed "Supper of the Lord". |
| Beza, The Psalms of David Truly Opened by Paraphrasis (Gilby 1581), TCP A10086, CC0 | Psalm-level paraphrase in 1580s spelling, little read; no second copy to check against. |
| Watson, A Body of Practical Divinity (1692): Ten Commandments and Lord's Prayer, TCP A65285, CC0 | Mostly catechism doctrine; few sections tied to verses; keeps 1692 misprinted references. |
| Manton's other sermons (1679 to 1693): TCP A51846, A51845, A51838, A51839, A51837, A51840, CC0 | 18 MB; sermon heads not all parsed; the 2 Thessalonians 2 sermons argue Rome is the apostasy. |
| Sibbes, Bowels Opened, Philippians 3, The Returning Backslider, The Bruised Reed: TCP A12167, A12184, A12190, A12171, CC0 | Not keyed to verses in the markup; Bowels Opened has 73 illegible letters per 10,000 words. |
| Bunyan's treatises on one text (Solomon's Temple, The Barren Fig Tree, Come and Welcome, The Water of Life), TCP, CC0 | Treatises, not running comment. |
| Cyril of Alexandria, Commentary on Luke (R. Payne Smith, 1859) | Only sermons 1 to 65 on tertullian.org keep the 1859 wording; Pearse modernized 66 to 156 in 2008 ("I decided to modernise the text in the remainder of the sermons"). Those must be keyed from the archive.org scans, or labelled as his modernization. Overlaps the Catena's 380 Cyril quotes on Luke. |
| Bede, The Explanation of the Apocalypse (Edward Marshall, 1878) | The only father on Revelation, and public domain (archive.org, NOT_IN_COPYRIGHT). But there is no clean transcription: raw OCR with footnotes run in, and a Wikisource start with 111 of 140 pages not proofread. Needs an OCR clean-up and proofreading project. |
| Augustine, Our Lord's Sermon on the Mount and The Harmony of the Gospels (NPNF I vol. 6) | Only on Wikisource (CC BY-SA, bot import from CCEL, marked 50%); proofread first. Matched the scan 148 of 150 words in one check. |
| The rest of Augustine on the Psalms | Wikisource only, as above. |

## 4. Not now, and why

### Luther

| Work | Why not now |
|---|---|
| The Epistles of St. Peter and St. Jude (Gillett 1859; GITenberg #29678) | Fails the rule as it stands: at 1 Peter 1:3-9 Luther says "the Epistle of James is no true Apostolic Epistle", and at Jude 1-2 that the letter "cannot be looked upon as being that of one who was truly an Apostle". Gillett's notes cite the critic De Wette. Possible only if the founder accepts these passages or has them left out (question 2). |
| Prefaces to the books of the Bible (Jacobs, Holman vol. 6, 1932) | Fails in part: James "is not the writing of any apostle"; Ecclesiastes "certainly not written or set down by King Solomon with his own hand"; the 1522 preface doubts Revelation. Public domain rests only on no renewal being found. |
| Psalm 82 (Jacobs, Holman vol. 4, 1931) | Says those who deny Christ is God "should not be tolerated, but punished as blasphemers"; public domain rests only on no renewal being found. |
| House Postil (Loy edition, 1869 to 1884) | Only a 907-page PDF on a non-GitHub host, CC BY 4.0 with attribution "to LutheranLibrary.org"; repeats the Church Postil's passages; the Passion sermons stress the Jews' guilt. |
| Galatians, the full 1575 English (TCP A06492, CC0) | 1575 spelling, 259 gaps, 386 mentions of the pope; the 1807 Middleton revision exists only as OCR, and Watson's 1953 revision is in copyright. |
| Psalms 1 to 22 (Cole 1826; Lenker 1903) | Scan OCR only, never transcribed. |
| Psalms of Degrees, 120 to 134 (Bull, 1577, TCP A06500) | 1577 spelling, 151 gaps, the pope 118 times. |
| Ecclesiastes (1573, TCP A06504) | 1573 spelling; no second copy to check; his separate preface says Solomon did not write it with his own hand. |
| The Magnificat (Steinhaeuser 1930; Coverdale 1538) | The 1930 text is only OCR and needs a proofread; Coverdale's 1538 print adds a confutation of the Salve Regina that is not Luther's. |
| Shorter early English pieces (TCP: Psalm 23, Psalms 124/125/129, Jeremiah 23, 1 Corinthians 7, John 20, Matthew 18, sermons) | Scattered single passages, old spelling, up to 569 gaps. |
| Holman vols. 1 and 2 (1915-16, GITenberg) and Parting Words (1903) | Treatises, not commentary; Parting Words is selections, OCR only. |
| Later translations (Luther's Works American Edition 1955-86, Watson's Galatians 1953, Mueller's Romans 1954, Klug's House Postil 1996, Holman vol. 5) and the DeepL machine translations on archive.org | In copyright, or machine-made. CCEL's Luther editions are out too: its terms forbid republishing. |

### Other Reformers and Puritans

| Work | Why not now |
|---|---|
| Owen, Hebrews 1-5 and 11-13 | No free transcription; archive.org scans are for "scholarship and research purposes only"; Monergism's PDFs may not be reposted. |
| Jonathan Edwards, Notes on the Bible | No free transcription: CCEL's text is for personal or non-profit use; the 1830 Dwight OCR is rough; Yale's 1998 edition is in copyright. |
| The Westminster Annotations (1645-57) | Never transcribed; page scans only (one copy covered in Samuel Sewall's handwriting). |
| Heinrich Bullinger, A Hundred Sermons upon the Apocalypse (1561, TCP B11837) | Reads the beast and the whore as Rome and the papacy throughout; 45 illegible gaps per 10,000 words; easy to confuse with E. W. Bullinger, who is already cited. |
| John Knox, A Fort for the Afflicted (Psalm 6) | One psalm, 73 gaps per 10,000 words. |
| Melanchthon | Only George Joye's 1545 Daniel, a compilation from four writers, not Melanchthon's own words. |
| Zwingli | No verse-by-verse work in English before 1931. |
| Beza, Song of Songs sermons (1587) and Meditations on eight Psalms (1582) | Framed as controversy with Rome; his New Testament notes in English are the Geneva notes, which the first track covers. |

### Orthodox fathers, but not now

| Writer and work | Why not now |
|---|---|
| Irenaeus, Against Heresies (ANF 1) | An argument against heresies, not a commentary; Book V teaches a thousand-year reign; some excerpts report heretics' views (HCF flags 24). |
| Justin Martyr, Dialogue with Trypho | Small (145 verses) and scattered; 62 HCF Justin entries are new translations. |
| Basil, Hexaemeron (NPNF II 8) | Only 45 verified HCF entries; the full text is on Wikisource (CC BY-SA). |
| Gregory of Nyssa, On the Making of Man | Not a commentary; his commentaries are in English only since 1978. |
| Cyprian, On the Lord's Prayer; Gregory Thaumaturgus, Metaphrase of Ecclesiastes; Athanasius, Against the Arians; Hilary, three Psalm homilies | Small, a paraphrase or not commentary; Wikisource only. |
| Jerome, Ambrose, Ephrem, most of Bede, Hilary on Matthew | No public-domain English of their commentaries. HCF's entries for them are ACCS excerpts or new translations made with an AI-assisted process ("An LLM-assisted workflow for producing fresh, public-domain English translations"); the Catena already quotes Jerome 870 times, Ambrose 585, Bede 1,263 and Hilary 430. |

## 5. Church fathers left out under the founder's rule

The rule keeps Catholic and Orthodox writers who uphold Scripture. A father condemned by the early church, or one who taught what it condemned, is out. HCF's own `condemned_by_council` flag is set for only eight writers and misses Origen, Theodore, Didymus and Evagrius, so the app must keep its own list of approved fathers and take nothing else from HCF.

**Left out: condemned, or taught what the councils condemned**

| Writer | Why |
|---|---|
| Origen | The Second Council of Constantinople (553), anathema 11, names him with Arius and Nestorius; fifteen anathemas condemn Origenist teaching (souls existing before bodies, the restoration of all including the devil, an ethereal spherical resurrection body, Christ's kingdom ending); Justinian's edict of 543. |
| Theodore of Mopsuestia | Constantinople II, anathema 12, condemns him and his writings ("the Word of God is one person, but that another person is Christ"). No public-domain English anyway. |
| Pelagius | Carthage (418), Pope Zosimus (418), Ephesus (431): denied original sin and the need of grace. |
| Arius; Nestorius; Apollinaris | Nicaea (325); Ephesus (431); Constantinople (381, canon 1). |
| Didymus the Blind and Evagrius | Condemned with Origen; the councils of 680-81 and 787 repeat the anathema on "Origen, Didymus and Evagrius". |
| Tatian; Novatian | Tatian founded the Encratites, condemned marriage and denied Adam's salvation (Irenaeus 1.28); Novatian led a schism at Rome (251), and Nicaea canon 8 sets terms for his followers. |

**Left out for now: disputed (founder may decide otherwise)**

| Writer | Why |
|---|---|
| Tertullian | Joined Montanism about 207 (new revelation claimed from the Paraclete); the Gelasian Decree lists his works among books not received. Against Marcion, his verse-by-verse work on Luke and Paul, is from his Montanist years. |
| Eusebius of Caesarea | Backed Arius before Nicaea; at Nicaea II (787) his letters were read as "speaking blasphemy". |
| Theodoret of Cyrus | Restored at Chalcedon, but Constantinople II, anathema 13, condemned his writings against Cyril. His commentaries are not in public-domain English anyway. |
| Hippolytus; Victorinus of Pettau; Clement of Alexandria | Hippolytus was a rival bishop of Rome (reconciled, a martyr) whose teaching on the Word is called subordinationist; Victorinus was a chiliast whose works the Gelasian Decree does not receive (Bede is the safer Revelation); Clement's works are also listed as not received. |
| Author of the Opus Imperfectum in Matthaeum ("Pseudo-Chrysostom") | A 5th-century work once credited to Chrysostom; its author is now held to be an Arian. |
| Church of the East and non-Chalcedonian writers (Isho'dad of Merv, Philoxenus of Mabbug, Severus of Antioch) | Outside the communion of Ephesus or Chalcedon. |

**Already in the shipped Catena.** The Catena data quotes Origen 638 times, the Arian author of the Opus Imperfectum 439 times (as "Pseudo-Chrysostom", in Matthew; the 109 "Pseudo-Chrysostom" quotes in Mark are Victor of Antioch, who was orthodox), Eusebius 82 times and Didymus 9 times. The panel names Pseudo-Chrysostom "a writer once thought to be Chrysostom" and says nothing about Origen. The founder should decide whether to hide these, or to show a line saying who they were (question 6).

## 6. How these fit the build, and the first track's plan

### 6.1 The same pattern as today

Every new work follows what henry-concise, wesley-notes and catena-aurea do: a pinned commit on github.com in `sources.json`; a reader in the voices build that checks the source's own license words and stops if they change; notes placed by KJV verse numbers and never across a chapter; a report line of what was placed and dropped; known-case checks in `verify`; a paragraph in NOTICE.md naming every change made to the text; a card in `config/shelf.json` (group "writers"); and a line in the panel's "How these are chosen".

License checks for the new readers:

| Source | The build stops unless |
|---|---|
| HCF | LICENSE starts "PUBLIC DOMAIN DEDICATION", and every kept entry passes the filter (approved father, approved by_father folder, mixed-case title, no `append_to_author_name`, not on the committed drop list) |
| TCP | the TEI header's availability says "Creative Commons 0 1.0 Universal" (Phase I) or "CC0 1.0 Public Domain Dedication" (Phase II) |
| GITenberg | `metadata.yaml` says "rights: Public domain in the USA." |
| SWORD (mirror) | the module's .conf says "DistributionLicense=Public Domain", and the mirror's SOURCE.md hash matches |
| tertullian.org (mirror) | each page's footer says "All material on this page is in the public domain - copy freely." |
| Project Gutenberg (mirror) | the file carries the "for the use of anyone anywhere in the United States" wording |

### 6.2 Changes both plans need (make them once)

The first track's writers (full Henry, Calvin, Keil and Delitzsch, Spurgeon, JFB, Clarke, Barnes, Robertson, Scofield, Geneva and others) hit the same limits, so these should be one change, used by both plans:

1. **A table of works instead of three fixed ones.** Today the works are constants in `extra_voices.rs`, `WORKS` in `model.ts`, and hard-coded rows in the Panel. Make one table (id, heading, book line, shelf card, date for ordering, and whether voices carry names, as the Catena's do), write it into `extras/voices.json`, and have the web read it from there. Keep "oldest first": Chrysostom (about 390), Augustine (400s), Cyril (about 425), Gregory (590s), the Catena (1260s), Tyndale, Luther, Calvin, the Geneva notes, Beza, Sibbes, Manton, Owen, Watson, Bunyan, Poole, Henry, Wesley, then the first track's 19th and 20th century writers.
2. **An index that holds more than three works.** One character with three bits cannot. Proposal: one bitset per work, base64-encoded (31,102 verses is 3,888 bytes, 5,184 characters), so 20 works come to about 104 KB, under the 200 KB limit `verify` sets. `verify` then checks each work's bits against its notes instead of '0' to '7'.
3. **Files per work.** Today one part file holds every work's notes for a run of chapters, and the panel fetches it whole. Round 1 of this plan alone would add about 15 MB (Chrysostom 6.7, Gregory 4.0, Luther 2.3, Augustine 1.7), and the Puritans about 17 MB more, roughly tripling today's 15 MB. Write `extras/voices/<work>/<Book>.<k>.json` and fetch only the works on the verse that the reader shows. Keep the 500,000-byte split and the 1,500,000-byte limit per work.
4. **Long notes in their own files.** Manton's 190 sermons on one chapter (Psalm 119) are about 6.5 MB, and Sibbes on one verse is about 400 KB, which no part file can hold. Proposal: a note longer than about 20,000 characters keeps its opening in the part file and its whole text in `extras/voices/<work>/long/<n>.json`, fetched on "Read all". The founder decides how much of a long sermon to show (question 8).
5. **Where in the work.** Add an optional fifth field to an item, naming its place in the work ("Homily 75 on Matthew", "Sermon for Christmas Day", "Sermon 121 on Psalm 119", "Lectures on Galatians, 1535"), shown under the heading. A writer with several works then needs only one heading. Generalise the `verify` rule "only the Fathers' notes have a name" to "only works whose voices carry names".
6. **Readers choose writers.** With both plans, John 3:16 could show ten or more writers. The panel should let readers pick which writers to show, remembered like the existing choice (question 12).
7. **One SWORD reader, one TEI reader, one mirror workflow.** The first track already needs a SWORD zCom reader (Keil and Delitzsch, JFB, Clarke, Barnes, Robertson, Scofield; group-2.md says about 40 lines of Python, and the Rust build needs the same). This plan uses it for Luther. The first track's Poole is TCP, so the TEI reader is shared too (Owen, Manton, Watson, Sibbes, Bunyan, and later Beza and Tyndale). Mirrors: one workflow modelled on `mirror-meaning-model.yml` with a list of URLs, one branch each (`mirror/sword-Luther` beside the first track's `mirror/sword-KD` and others; `mirror/tertullian-cyril-john`; `mirror/pg-75892`). CrossWire repacks some zips daily (group-1.md), so record the hash of the mirrored copy and of each unpacked file, and refuse a changed file.
8. **The avoid list stays off writers' notes.** The `avoid` match words in `config/layer-sources.json` are checked in Layers notes. Luther names Rashi about 33 times per Genesis volume, Manton names Aben Ezra and Kimchi about 20 times, and Owen names Kimchi; the first track found Gill naming Kimchi 3,088 times and Keil and Delitzsch thousands of times. These are old writers quoting others as witnesses or to answer them, not the app citing rabbis. Both plans assume the check is never run over writers' notes (question 10).
9. **Shelf cards first.** The handoff notes that `shelf.rs` reads citations only from `aramaic.json` and `hard-verses.json`, so 28 cited works have no card, and says to fix that before adding writers. A card can list several datasets, so one "Martin Luther" card can cover the Galatians, Genesis, SWORD and Psalms sources.

### 6.3 What this plan adds of its own

- **An HCF reader, and fetching folders.** `sources.json` lists files one by one, and `fetch.rs` hashes each listed file. HCF keeps one TOML file per writer and verse (5,447 kept for Chrysostom alone). Let `files` name a folder (the sparse checkout already accepts one) and lock the folder's git tree id at the pinned commit in place of a file hash. Only four folders are needed: `John Chrysostom`, `Augustine of Hippo`, `Gregory the Dialogist`, `Cyril of Alexandria` (the last only as a cross-check). The approved list of fathers and folders, and the list of entries dropped after the one-time check against the NPNF and Library of the Fathers texts, live in `config/` with a reason for each, like `HENRY_ENDS`.
- **Plain-text readers for GITenberg.** Galatians ("VERSE n." under "CHAPTER n."), Genesis ("V. n", "V. 8b" under CHAPTER and PART), Bunyan ("Ver. n."). Each needs a small table of fixes (Galatians 5:5; the Genesis 4:8-15 overlap; Bunyan's stray heading and wrong references) and must drop the Gutenberg header and footer.
- **An HTML reader for tertullian.org**, placing Cyril's sections by the numbered verse lines he comments on.
- **Text rules for TCP.** Join words split by line breaks; print the long s as s; keep the original spelling otherwise (question 7); show an illegible gap as "[…]" and an untyped Greek or Hebrew word as "[Greek]" or "[Hebrew]"; drop the TCP page markers. Marginal notes (`<note>`) go after their paragraph or are left out.
- **What to strip**: Lenker's and Gillett's translator notes, Lenker's paragraph numbers, HCF's added sense labels on Gregory (replaced by the app's own plain label), Pearse's footnotes (already absent), the Apocrypha (Ecclesiasticus 15 sermon, Sirach keys).
- **Overlap with the Catena.** Chrysostom and Augustine's own homilies on Matthew and John will sit beside the Catena's quotes from the same fathers, in a different English. Keep both by default; the founder decides (question 5).

### 6.4 NOTICE.md, the cite list and verify

- NOTICE.md's "Christian writers of the past" row and paragraph grow by one entry per source, each naming its changes (as the paragraph does today for the Catena, Henry and Wesley). Everything in sections 2.1 to 2.14 is public domain, CC0 or under a public-domain dedication, so the sentence "The files built from these ... are public domain" stays true. If Wikisource (CC BY-SA) or the Lutheran Library (CC BY 4.0, credit "LutheranLibrary.org") are used later, those works' files must carry that license, which per-work files (6.2, item 3) make possible.
- `config/layer-sources.json` `cite`: `chrysostom`, `church-fathers` and `catena-aurea` are there; `church-fathers` names Augustine. Add `luther`, `owen`, `manton`, `sibbes`, `watson`, `bunyan`, and `gregory-the-great` and `cyril-of-alexandria` if the founder wants them named on their own (question 11).
- New `verify` cases, for example: Chrysostom's words on Acts 1:1 are under Acts 1:1; no note comes from a father outside the approved list; no HCF note has a capital-letter title, a newadvent.org link or an "(as quoted by Aquinas" tag; no note sits on Sirach or Ecclesiasticus; Luther's note on Galatians 2:20 is under 2:20 and Galatians 5:5 has its own; Genesis 4:14 has one Luther note, not two; Cyril's "29 The next day he seeth Jesus coming to him." places on John 1:29; Gregory has a note on Job 19:25.
- Fetch time: each TCP text and each GITenberg book is its own repository, so this plan adds 15 checkouts to the 17 today (HCF, 4 GITenberg books, 7 TCP texts and 3 mirror branches). If that is too slow, one mirror branch could copy the chosen TCP files unchanged, with each source commit and SHA-256 in its SOURCE.md.

### 6.5 Order of work

1. **Shared build changes** (6.2), with the first track: work table, index, per-work files, long notes, the "where" field, writer choice, shelf cards.
2. **From GitHub, no mirror:** the HCF reader with its approved list and drop list (Chrysostom, Augustine on John and 1 John, Gregory; Augustine on the Psalms if approved), and the GITenberg readers (Luther on Galatians and Genesis).
3. **The TEI reader**, shared with the first track's Poole: Owen, Watson, Bunyan (with the GITenberg Genesis), Manton, Sibbes.
4. **Mirrors**, in the one workflow the first track also needs: the SWORD module Luther (Church Postil, Sermon on the Mount), tertullian.org's Cyril on John, Project Gutenberg's Luther on the Psalms.

## 7. Questions the founder must answer

1. **Luther's harsh words.** Luther calls the pope the Antichrist (the Church Postil names the pope or papists about 750 times) and writes harshly about the Jews ("heathen and Jews, the Devil's own"). The app keeps Catholic writers, and Wesley and Henry already say "Papists" and "popery" a few dozen times. Show Luther word for word with a short line saying he wrote in the fights of his day; leave out such passages with a visible mark that something was left out; show only his least polemic works (Galatians, Genesis, the Psalms); or leave Luther out?
2. **Luther on 1 and 2 Peter and Jude.** He says James is "no true Apostolic Epistle" and that Jude was not written by "one who was truly an Apostle". Leave the work out, show it without those two passages, or show it whole?
3. **Historical Christian Faith.** You dropped its site as a link. May the build take the fathers' 19th-century translations from its GitHub repository, filtered to approved fathers, and credit the repository in sources.json and NOTICE.md (the site itself would still not be linked)?
4. **Excerpts that skip words.** HCF's passages sometimes leave sentences out with no mark. Show them as "passages chosen by Historical Christian Faith", with "…" wherever a one-time check finds a skip, or wait until whole homilies can be used (the only free full text is Wikisource, CC BY-SA, not yet proofread)?
5. **Two voices for one father.** Chrysostom's and Augustine's own homilies would sit beside the Catena's quotes of them on the same Gospel verses. Show both, or hide the Catena's quote where the father's own homily covers the verse?
6. **Fathers.** Approve this list: Chrysostom, Augustine, Gregory the Great and Cyril of Alexandria now, and later Bede, Irenaeus, Justin, Basil, Gregory of Nyssa, Cyprian, Gregory Thaumaturgus, Athanasius and Hilary. Confirm that Origen, Theodore of Mopsuestia, Pelagius, Arius, Nestorius, Didymus, Evagrius, Tatian, Novatian and Apollinaris stay out, and decide on Tertullian, Eusebius, Theodoret, Hippolytus, Victorinus and Clement of Alexandria. And for the Catena already shipped: hide its 638 Origen quotes, the Arian author's 439 Matthew quotes, Eusebius' 82 and Didymus' 9, add a line saying who they were, or leave them?
7. **Old spelling.** The Puritan texts are in 17th-century spelling ("tearm", "urgencie"), with some illegible letters and the Greek and Hebrew not typed. Show them as printed (long s made s, gaps marked "[…]" and "[Greek]"), or leave them out until modern-spelling editions are free (none are now)?
8. **Very long notes.** Manton preaches 5,000 to 8,000 words on one verse, Owen 12,500 on Hebrews 6:4-6, Sibbes 67,452 on 2 Corinthians 1:12. Show the opening with "Read all" loading the whole, or only an opening and say where the rest can be read?
9. **Allegory.** Gregory on Job (and Augustine on the Psalms) read many verses as pictures of Christ, the Church and the soul. Show these, labelled as their spiritual reading, or show only their plain-sense comments?
10. **Rabbis named inside old writers.** Luther argues with Rashi and Lyra, Manton and Owen with Kimchi and Aben Ezra (as Gill and Keil and Delitzsch do in the first track). Confirm the avoid list applies to what the app itself cites, not to old writers' own words.
11. **Cite list.** Add Luther, Owen, Manton, Sibbes, Watson and Bunyan (and later Tyndale and Beza), and Gregory and Cyril on their own, to the cite list, so it names every writer the app shows?
12. **Too many writers.** With both plans, a verse such as John 3:16 could show ten or more writers. Show them all, or let readers choose which to show, and if so which are on before they choose?
13. **Mirror branches.** May the build add mirror branches for the CrossWire module Luther, tertullian.org's Cyril on John and Project Gutenberg's Luther on the Psalms, made the way the meaning model's mirror is?
14. **Graebner's Galatians.** It is an abridged, modernized rendering. Use it, labelled "abridged", or wait for a full free text (none is clean now)?
