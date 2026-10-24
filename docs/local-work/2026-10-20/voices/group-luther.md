# Martin Luther: public-domain English commentaries and sermons on Bible books

Research notes for Bible Atlas (Deep level, word-for-word voices). Checked 2026-10-20. Every claim below comes from a file I fetched and read; scratch copies are under `scratchpad/ba/voices/luther/` (raw downloads in `raw/`, my scripts in `tools/`).

## The short answer

1. **The best single source is the CrossWire SWORD module "Luther"** ("Luther's Commentary on Selected Bible Passages", version 1.1, 2010). It is already split by verse, its `luther.conf` says `DistributionLicense=Public Domain`, and six spot-checks against scans matched word for word. It holds:
   - Galatians (Graebner)
   - Genesis 4:8 to 9:29 (Lenker)
   - Psalm 82 (Jacobs)
   - Matthew 5 to 7 (Hay)
   - 158 Church Postil sermons (Lenker)
   - 42 of Luther's prefaces to the books of the Bible (Jacobs)

   It is not on GitHub, so it has to be mirrored to a branch, the way `mirror-meaning-model.yml` does it. The file is `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Luther.zip` (3.04 MB).
2. **GITenberg (GitHub mirrors of Project Gutenberg) fills the gaps with pinned commits:**
   - Genesis vol. 1 (Gen 1:1 to 4:15), which the module lacks
   - 1 and 2 Peter and Jude (Gillett)
   - Galatians (Graebner)
   - Epistle Sermons vols. 2 and 3
3. **All 150 Psalms** (Luther's "Summaries", Cole's 1837 translation) are on Project Gutenberg #75892. There is no GitHub mirror, so mirror it or use the Lutheran Library CC BY 4.0 PDF.
4. **Text Creation Partnership (TCP) texts are CC0 on GitHub** and are the only clean copies of several 16th-century English translations: Galatians 1575, Ecclesiastes 1573, the Psalms of Degrees 1577, Peter and Jude 1581, and the Magnificat 1538. Their old spelling (long s, "vpon", abbreviation marks) needs a decision before use.
5. **Fit with the founder's rule:** Luther holds Scripture to be God's word and preaches Christ from every page. He passes the rule in substance, but his works carry three kinds of trouble, set out under "Concerns" below:
   - he calls the Pope the Antichrist many times, which sits awkwardly beside Aquinas and the fathers
   - he says harsh, contemptuous things about the Jews, often about the Jews of his own day
   - he doubts that James, Jude, Hebrews and Revelation are apostolic, and that Solomon wrote Ecclesiastes. This is the most direct clash with "fully believe the Bible".

## Public domain basis (US, as of 2026)

Anything published in 1930 or earlier is public domain. For 1931 to 1963 works I searched the NYPL transcriptions of the Copyright Office renewal records (github.com/NYPL/cce-renewals, CC0) for 1957 to 1961, 1965 to 1968 and 1976 to 1977.

- **Works of Martin Luther (Philadelphia / Holman edition) vol. 5 (1931): renewed and still in copyright.** Renewal R238530, 26 June 1959, by the Board of Publication of the United Lutheran Church in America ("© on compilation & translation; 3Jul31; A40377"). It is public domain only from 1 January 2027. Do not use it.
- **Vol. 4 (1931, "Copyright, 1931, by A. J. Holman Company") and vol. 6 (1932): no renewal found** in the 1958 to 1960 records. These are probably public domain, but the renewal transcriptions come from OCR, so this is "no renewal found", not proof.
- **Vol. 3 (1930)** has been public domain since 1 January 2026.
- **Graebner's Galatians** was first published by Zondervan in 1939 (CCEL's catalog: "Print Basis: Grand Rapids: Zondervan [1939]"; Project Wittenberg cites a 1949 printing). I found no renewal in 1966 or 1967 (nor in 1976 or 1977 for 1949). Project Gutenberg and GITenberg list it as "Public domain in the USA". The text itself says: "This text was converted to ASCII format for Project Wittenberg by Laura J. Hoelter and is in the public domain. You may freely distribute, copy or print this text."
- **Not usable** (published after 1930 and still in copyright):
  - the American Edition, Luther's Works (1955 to 1986)
  - P. S. Watson's 1953 revision of the Middleton Galatians (UK, James Clarke)
  - J. T. Mueller's Romans (1954)
  - the Klug House Postils (Baker, 1996)
  - the 1956 and 1957 reprints

## Where the clean transcriptions are (license words quoted exactly)

| Source | Where | License words | Use |
|---|---|---|---|
| CrossWire SWORD module "Luther" v1.1 | crosswire.org rawzip `Luther.zip`; `mods.d/luther.conf` | `DistributionLicense=Public Domain` | Yes, after mirroring to a branch |
| GITenberg repos (PG #1549, 48193, 27978, 29678, 28464, 30619, 31604, 34904) | github.com/GITenberg/... | `metadata.yaml`: "rights: Public domain in the USA." README: "This book is in the Public Domain". The LICENSE file is the PG license, whose trademark terms apply only while the PG name is kept (section 1.C) | Yes; strip the PG header and footer |
| Project Gutenberg #75892 (Manual of the Psalms) | gutenberg.org | "This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever." | Yes, after mirroring |
| Text Creation Partnership (EEBO-TCP) | github.com/textcreationpartnership/Axxxxx | Phase I: "This Phase I text is available for reuse, according to the terms of Creative Commons 0 1.0 Universal." Phase II: "the Text Creation Partnership has waived all copyright ... according to the terms of the CC0 1.0 Public Domain Dedication" | Yes (old spelling) |
| Lutheran Library (lutheranlibrary.org) | PDFs at ll26a.b-cdn.net | Inside each PDF: "This LutheranLibrary.org book is released under the Creative Commons Attribution 4.0 International (CC BY 4.0) license, which means you may freely use, share, copy, or translate it as long as you provide attribution to LutheranLibrary.org, and place on it no further restrictions." The book pages also say "Copyright : CC BY 4.0", but the site footer says "This work is licensed under CC BY NC ND 4.0". The two statements conflict; the item-level CC BY should govern, but ask them if it matters | PDF only; mirror |
| CCEL | ccel.org | "These books may be used for personal, educational, or non-profit purposes. Contact us for permission to republish CCEL works or to use them commercially." | **No** |
| Project Wittenberg, Preface to Romans (Thornton) | projectwittenberg.org german.bible/rom-eng.txt | "(c)1983 by Saint Anselm Abbey. This translation may be used freely with proper attribution." | Permissive, but not one of the listed licenses; ask before use |
| HistoricalChristianFaith/Commentaries-Database | GitHub | Public domain dedication for public-domain excerpts, plus a fair-use notice for the rest | Its "Martin Luther" folder has only 5 files (Matt 1:18, 1:25, 13:55, Mark 6:3, 2 Macc 12:39-45) on Mary and purgatory. Not useful |
| Monergism, AGES/Sabda PDFs | | No open license found (Monergism also blocked the fetch with 403) | No |
| Internet Archive "DeepL" items (st-l-03, 04, 05, 10, 11, 12, 13a, 13b) | archive.org | Machine translations of the St. Louis edition, made in the 2020s | No (machine translation) |

HathiTrust could not be checked; it showed a bot challenge, which I did not try to get past.

## The works, one by one

### 1. Galatians (1535 lectures), Graebner abridged translation (Zondervan, 1939)
- **Coverage:** Galatians 1:1 to 6:18. All 149 verses have headings (one heading covers verses 22 to 24 of chapter 1). About 86,000 words.
- **Abridged:** Graebner cut the work to roughly half and "streamlined" the English. The unabridged 1575 version names the pope or papists 386 times; Graebner's has 88.
- **Best source:** GITenberg `Commentary-on-the-Epistle-to-the-Galatians_1549`, commit `e362c0a3444c3f9c9668eb4157a76c3bcd59a223`, file `1549.txt` (0.50 MB). The same text is split by verse in the SWORD module (GAL, 149 verses, 141 distinct notes).
- **Spot checks:**
  - PG #1549 matched the CCEL text and the Lutheran Library PDF 150/150 at three positions. These copies are not independent; all go back to the Project Wittenberg keying. The 1939 scans on the Internet Archive are lending-only, so no scan check was possible.
  - SWORD GAL 3:13 matched PG 119/120, 120/120 and 120/120. The one difference is "Isa" written out as "Isaiah".
  - The GITenberg 2018 snapshot differs from current PG in one heading only: PG later corrected Gal 5:5 from "VERSE 6" to "VERSE 5".
- **Concerns:**
  - "The Pope is the Antichrist" and "When we call the Pope the Antichrist and his minions an evil brood, we do not slander them"
  - attacks on the "sophists", monks and "fanatics" (Anabaptists and other radicals)
  - "Jews" here mostly means the first-century Judaizers.

### 2. Galatians, the full 1575 English translation (and the Middleton revision)
- **The 1575 translation:** "A commentarie of M. Doctor Martin Luther vpon the Epistle of S. Paul to the Galathians" (London, 1575; translated by "certain godly men", with a preface by Edwin Sandys).
  - **Best source:** TCP A06492, CC0, commit `e9cd1edb45d02acd5da3184ccb80bd642caaddb5`, `A06492.xml` (2.1 MB, about 290,000 words, 231 verse-extract divisions, 259 gaps for illegible text).
  - **Spot check:** compared with the 1644 printing's OCR (archive.org `acommentarie00luthuoft`), 60 to 67 of 100 words matched once spelling was normalized. Every mismatch was a misread in the 1644 OCR (long s read as f), not a difference of wording.
- **Erasmus Middleton's 1807 revision** (reprinted 1810 to 1891) exists only as archive.org scans with OCR, for example `commentaryonstpa00luthuoft` (1810) and `cu31924029294141` (1891). I found no clean transcription. The Lutheran Library's "Complete and Unabridged" is a 122 MB facsimile of Watson's 1953 revision; it is too big to download, probably still in copyright in the US, and should not be used.
- **Concerns:**
  - The unabridged text is far more polemical than Graebner's: 386 mentions of the pope or papists, 18 of Antichrist, 205 of Jews, 30 of Anabaptists.
  - The 1575 spelling would need normalizing.

### 3. Genesis 1 to 9, Lenker's revision of Henry Cole's translation
Two volumes: "Luther on the Creation" (1904) and "Luther on Sin and the Flood" (1910).
- **Coverage:** Gen 1:1 to 4:15 (vol. 1) and Gen 4:8 to 9:29 (vol. 2), as a running commentary with verse headings ("V. 26b."). Luther's lectures run through Genesis 50, but no later volume was ever published in public-domain English. Cole's own 1858 "The Creation" (Gen 1 to 5) exists only as archive.org OCR; Lenker's vol. 1 is built on it.
- **Best source:** GITenberg
  - `Commentary-on-Genesis-Vol-I-Luther-on-the-Creation_48193` @ `8d4140fd0b6e85bb7bfb00bf6525caf1ac63a7c9` (`48193-8.txt`, 1.00 MB, Latin-1 encoded)
  - `Commentary-on-Genesis-Vol.-IILuther-on-Sin-and-the-Flood_27978` @ `8319ed17c0af0dde6505838d501034ec7df245fb` (`27978.txt`, 0.76 MB)

  The SWORD module has vol. 2 only, split by verse (148 verses). The GITenberg body text is identical to current PG.
- **Spot checks:**
  - vol. 1 against the 1904 scan OCR: 150/150, 147/150, 146/150
  - vol. 2 against the 1910 scan OCR: 138/150 (an outline section), 148/150, 148/150
  - SWORD GEN 6:3 against PG: 120/120 three times

  All the differences were scan OCR errors.
- **Concerns:**
  - Luther quotes and argues with "Rabbi Solomon" (Rashi; 2 and 3 times), Burgensis, the Talmud, and Lyra (31 times in each volume), usually to refute them. He mocks "the idle fables of the Jews", and vol. 2 speaks of "the miserable state of the Jews at the present day".
  - 59 and 121 mentions of the pope; Antichrist 11 times in vol. 2.
  - It holds to six literal days of creation, which fits the app's other sources.

### 4. 1 and 2 Peter and Jude (1523 to 1524), E. H. Gillett's translation (New York, 1859)
- **Coverage:** 1 Peter 1 to 5, 2 Peter 1 to 3, Jude. Verse by verse: 165 of 166 verses have headings. About 88,000 words.
- **Best source:** GITenberg `The-Epistles-of-St.-Peter-and-St.-Jude-Preached-and-Explained_29678` @ `00fcb84e2c7e07bcc321bbc745b0e127843665ec` (`29678.txt`, 0.50 MB).
- **Alternatives:**
  - Lenker's 1904 edition ("Peter and Jude Explained by Luther"), which adds the 1539 version of 1 Peter and Walch's outlines: Lutheran Library PDF, CC BY 4.0, 2.6 MB, about 141,000 words
  - Thomas Newton's 1581 translation: TCP A06502, CC0, commit `a6ec0251659c0c51826f6807ab66bd692c5acc4e`, 0.91 MB
- **Spot checks** against the 1859 scan OCR: 148/150, 149/150, 150/150.
- **Concerns:**
  - In 1 Peter 1 he writes "the Epistle of James is no true Apostolic Epistle".
  - On Jude he writes "this Epistle cannot be looked upon as being that of one who was truly an Apostle", adding that it borrows nearly all its words from 2 Peter.
  - He argues that "the Pope, along with his bishops, is Antichrist" (75 mentions of the pope).
  - Gillett's footnotes quote De Wette, a critical scholar. Leave the translator's footnotes out.

### 5. Church Postil, Epistle sermons (Lenker, "Luther's Epistle Sermons", 3 volumes)
- **Volumes:** vol. 1 Advent and Christmas (1908, Lenker vol. 7), vol. 2 Epiphany to Pentecost (1909, vol. 8), vol. 3 Trinity to Advent (1909, vol. 9).
- **Coverage:** one sermon per lectionary passage, preached through the passage verse by verse.
  - PG vol. 2: 30 passages (Romans 12 and 13, Colossians 3, 1 Cor 5, 9 to 10, 13 and 15, 2 Cor 6 and 11 to 12, Ephesians 5, Galatians 4, Hebrews 9, Philippians 2, Acts 1, 2, 10 and 13, 1 John 5, 1 Peter 2 and 4, James 1).
  - PG vol. 3: 28 passages (Romans 6, 8 and 11, 1 John 3 and 4, 1 Peter 3 and 5, 1 Cor 1, 10, 12 and 15, 2 Cor 3, Galatians 3, 5 and 6, Ephesians 3 to 6, Philippians 1 and 3, Colossians 1, 1 and 2 Thessalonians, 2 Peter 3).
  - All three volumes together: 72 sermons on 67 passages, about 560 verses. They include Isaiah 60:1-6 and Ecclesiasticus 15:1-8 (Apocrypha, which would need dropping).
- **Best source:** GITenberg
  - `Epistle-Sermons-Vol.-IIEpiphany-Easter-and-Pentecost_28464` @ `06efbfcbfcbe0a89774b0f41d1c3be849fc9735a` (0.70 MB)
  - `Epistle-Sermons-Vol.-IIITrinity-Sunday-to-Advent_30619` @ `17ecb2b978bca921be6c5ab64cd01e2e31434ff5` (0.80 MB)

  Vol. 1 is in the SWORD module and the Lutheran Library complete edition; the scan is archive.org `bub_gb_0BcUAAAAYAAJ` (public domain mark).
- **Spot checks:**
  - vol. 2 against the Lenker vol. 8 scan: 150/150, 149/150, 130/150 (verse layout)
  - vol. 3 against the vol. 9 scan: 149/150, 147/150, 146/150
  - SWORD ROM 12:1 against the scan: 118/120, 118/120, 119/120
- **Concerns:**
  - "He called the Jews a generation of vipers, children of the devil, hypocrites, blind dolts, liars"
  - frequent attacks on the papacy; the Turks are named 32 times in vol. 3.

### 6. Church Postil, Gospel sermons (Lenker vols. 10 to 14, 1904 to 1907)
- **Coverage:** in the Lutheran Library complete edition, 110 sermons on 66 Gospel passages: Matthew (about 20), Mark (4), Luke (about 22), John (about 17); about 650 verses. Several passages have two or three sermons.
- **Best source:** the SWORD module (158 Church Postil sermons with Gospels and Epistles combined, about 789,000 words). It places each sermon on its passage and links parallels, for example Mt 8:1-13 also on Mk 1:40-45, Lk 5:12-16 and Lk 7:1-10. It leaves out the Matthew 5 to 7 postil sermons because Hay's fuller commentary covers those chapters.
- **Alternative:** the Lutheran Library "Church Postil: The Complete Lenker Edition in One Volume" (PDF, 16.4 MB, 2,624 pages, about 1.15 million words, CC BY 4.0). Its text descends from Greg Jackson's corrected edition. **Caution:** it replaced Lenker's Bible passage text (American Standard style) with the KJV. Acts 1:9 reads "while they beheld" where Lenker has "as they were looking". It also writes out references in full and adds paragraph numbers in brackets, so it is not word for word in the headings and Scripture passages.
- **Spot checks:**
  - SWORD LUK 2:1 against the Lenker scans: 120/120, 120/120, 119/120
  - the Lutheran Library edition against the scans: 147/150, 145/150 and 150/150 in the sermon bodies; the passage text differs because of the KJV swap
- **Concerns** (the strongest anti-Jewish lines are here and in the House Postil):
  - "the calamity which rests upon the Jews to this day"
  - "the Jews still in our day cannot reconcile themselves, hence they cannot cease their throwing stones and their blasphemy"
  - "heathen and Jews, the Devil's own"
  - the pope "the Antichrist", "the murderer of their souls" (about 750 mentions of the pope or papists, 47 of Antichrist); Turks 117
- **Other early translation:** Ambrose Henkel's 1869 Church Postil, epistle sermons only (New Market, VA), exists only as archive.org OCR and is superseded by Lenker.

### 7. House Postil (1544), Columbus, Ohio, 3 volumes (1869, 1871, 1884)
- **Translators:** E. Schmid; D. M. Martens (the first six sermons); J. T. Isensee (the Passion sermons). Edited by M. Loy.
- **Coverage:** about 80 sermons, nearly all on the Sunday Gospel passages. There are also 13 Passion sermons through Matthew 26 to 27, Luke 23 and John 19, plus Acts 1:1-11, Acts 2:1-4 and 1 Cor 11:23-34.
- **Best source:** Lutheran Library "Martin Luther's Complete House Postil translated by Matthias Loy" (PDF, 6.5 MB; text 2.1 MB, about 383,000 words; CC BY 4.0, "© 1884 / 2022"). The table of contents has typos ("Luke 18:81-43", "Matt. 29:69-75", "Man. 22:34-46").
- **Spot checks** against the 1884 scans: 150/150, 149/150, 136/150 (scan OCR errors), 148/150.
- **Concerns:**
  - about 400 mentions of Jews; the Passion sermons stress the guilt of "the Jews"
  - "they are scattered to this day ... their reward"
  - "Boast then pope, miserable Antichrist, with all thy devilish teachings"
- It largely overlaps the Church Postil passages. Second tier.
- The 1871 "Sermons on the Passion of Christ" (Rock Island) is the same translation as the Passion sermons here.

### 8. The Sermon on the Mount (1530 to 1532 sermons), Charles A. Hay (Philadelphia, 1892)
- **Coverage:** Matthew 5:1 to 7:29, verse by verse. The OCR runs about 137,000 words.
- **Best source:** the SWORD module (MAT 5 to 7, with Luther's preface at MAT 5:0). The scan is archive.org `commentaryonserm00luth` (Princeton; "possible-copyright-status: NOT_IN_COPYRIGHT"). It is not on PG or Wikisource; Monergism's copy has no license.
- **Spot checks:** SWORD MAT 5:3 against the 1892 scan OCR: 117/120, 120/120, 118/120 (all scan errors).
- **Concerns:** polemic against monks, the pope and the "sophists". The divorce and oath passages carry Luther's views of his own day.

### 9. Manual of the Book of Psalms ("Summaries", 1531 to 1533), Henry Cole (London, 1837)
- **Coverage:** all 150 Psalms, one summary each (by Psalm, not by verse), plus Luther's preface. About 104,000 words.
- **Best source:** Project Gutenberg #75892 (released April 2025), 0.62 MB. It has no GitHub mirror, so mirror it. The Lutheran Library PDF (CC BY 4.0, 3.1 MB) is the alternative.
- **Spot checks** against the 1837 scan OCR: 150/150, 143/150, 146/150.
- **Concerns:** mild: pope or papists 17, Antichrist 4, Jews 30.

### 10. Psalms 1 to 22 ("Operationes in Psalmos", 1519 to 1521)
- **Translations:** Henry Cole, 2 volumes (London, 1826; Psalms 1 to 22), and Lenker's revision, vol. 1 (Sunbury, 1903; Psalms 1 to 8 only, "No more published?").
- **Source:** archive.org OCR only (`completecommenta01luth`, `02luth`, `lutherscommentar01luth`; "NOT_IN_COPYRIGHT"). There is no clean transcription. Not recommended now.

### 11. Psalms of Degrees, Psalms 120 to 134 (1532 to 1533 lectures), Henry Bull (London, 1577)
- **Best source:** TCP A06500, CC0 (Phase I), commit `1cfe22d2a894af338f662edde39a79c3e190b7e0` (0.96 MB, about 142,000 words, 151 gaps). Each of the 15 Psalms has its own section.
- **Spot checks** against the 1577 scan OCR (black-letter): 66/100, 75/100, 81/100. All the differences were OCR misreads.
- **Concerns:** old spelling; pope 118, Antichrist 14, Jews 62.

### 12. Ecclesiastes (1532 lectures), anonymous translation (London, 1573)
- **Best source:** TCP A06504, CC0, commit `9eea6b7cca22331912545d8b989d40ba40670795` (0.61 MB, about 79,000 words, 47 gaps).
- **Coverage:** all 12 chapters, lemma by lemma (318 parts).
- This is the only public-domain English version. There was no independent copy to check it against; TCP records its own proofreading.
- **Concerns:** old spelling. Luther's 1524 preface to Ecclesiastes (in the SWORD module) says the book "was certainly not written or set down by King Solomon with his own hand".

### 13. The Magnificat (1521), Luke 1:46-55
- **Steinhaeuser translation** (Holman vol. 3, 1930): public domain since 2026. The OCR at archive.org `worksofmartinlut03luth` (Princeton) is clean, about 31,500 words.
- **The SWORD module** lists the Magnificat, but its LUK 1:46-55 entries are only the "No Commentary on these verses is yet included" placeholder.
- **Coverdale's 1538 translation** ("Ihon Hollybush", pseudonym): TCP A68425, CC0, commit `b31d8cab2f0156bd7895c4340c1556cbeff9ba0c` (0.32 MB). Coverdale appended "A confutacion of the songe called Salue Regina ... that it is rather Idolatry", which is not Luther's, plus short notes on the Benedictus and Nunc dimittis. Leave the appendix out.
- **Concerns:** the 1930 text calls Mary "the Mother of God" and praises her highly. That is fine under the Catholic and Orthodox allowance, but a proofread is needed before use.

### 14. Psalm 82 (1530), C. M. Jacobs (Holman vol. 4, 1931; no renewal found)
- **Coverage:** Psalm 82, verse by verse. About 15,500 words with the introduction.
- **Best source:** the SWORD module (PSA 82). The scan OCR is archive.org `in.ernet.dli.2015.75685`.
- **Spot checks:** SWORD against the scan OCR: 119/120, 120/120, 120/120.
- **Concerns:** Luther says teachers who deny that Christ is God, "as the Turks and the Anabaptists hold, ... should not be tolerated, but punished as blasphemers" by the rulers. Baptist readers would find that hard.

### 15. Prefaces to the books of the Bible (1522 to 1546), C. M. Jacobs (Holman vol. 6, 1932; no renewal found)
- **Coverage:** 42 prefaces, about 41,000 words, in the SWORD module:
  - Old Testament: the OT as a whole, Job, Psalms, Proverbs and Solomon, Ecclesiastes, the Prophets and each prophet, a Daniel excerpt
  - New Testament: the NT as a whole, Acts, every epistle, Revelation (both the 1522 and 1530 forms)

  The module repeats each preface on every verse of its book. Archive.org's copy of vol. 6 is lending-only, so I could not check it against a scan.
- **Other Romans translations:**
  - "A methodicall preface" (1594, "W. W."): TCP A06512, CC0, commit `9f7ae1bf2b157b6f1ab48394d99037b6635dcbc5`
  - Tyndale's 1526 prologue to Romans, which is mostly Luther's preface: TCP A14132, CC0. It is Tyndale's adaptation, so it does not count as Luther.
  - Thornton (1983), on Project Wittenberg and CCEL: "may be used freely with proper attribution"
- **Concerns:**
  - On James: "I consider that it is not the writing of any apostle". The 1522 preface to the New Testament also has the "epistle of straw" line.
  - Doubts about Hebrews and Jude; the 1522 Revelation preface doubts the book outright.
  - Ecclesiastes is "certainly not written ... by King Solomon".

  This clashes with "fully believe the Bible". Keep only chosen prefaces (Romans, Psalter, Galatians and so on), or leave all of them out.

### 16. Shorter early English translations (TCP, all CC0 on GitHub)
- Psalm 23 (Coverdale 1538, A06532)
- Psalms 124, 125 and 129 (1685, A88660)
- Jeremiah 23:5-8 (1548, A06508)
- 1 Corinthians 7 (William Roye 1529, A00378; 569 gaps)
- John 20, on absolution (1548, A06520)
- Matthew 18, on the angels (1548, A06510)
- a sermon on the last day (1570, A06525)
- "Special and chosen sermons" (William Gace 1578, A06521, about 219,000 words; these became the "Thirty-four sermons" of 1649 to 1830)

All are old spelling and scattered. Not recommended for a first pass.

### 17. Works of Martin Luther (Holman) vols. 1 and 2 (1915, 1916; PG #31604, #34904; GITenberg)
These are treatises: Good Works, Christian Liberty, the Babylonian Captivity, "The Papacy at Rome". They are not Bible commentaries and are not recommended. The "Brief Explanation of the Ten Commandments, the Creed and the Lord's Prayer" touches Exodus 20 and Matthew 6.

### 18. Parting Words (1903), Charlotte Ada Rainy
About 12,000 words of selections from the sermons on John 14 to 17. Archive.org OCR only (`partingwordsbein0000luth`). Not recommended.

## Concerns that apply to everything (storing word for word means showing these)
1. **The papacy.** Luther repeatedly names the Pope as the Antichrist and calls papal teaching devilish. Mentions of "pope, papist, papacy" per work: Church Postil about 750, House Postil 340, Genesis 59 and 121, Peter and Jude 75, Graebner's Galatians 88, the 1575 Galatians 386. The founder keeps Catholic writers who uphold Scripture, so these lines will sit next to Aquinas and the Catena.
2. **The Jews.** The commentaries are milder than the 1543 treatises (which are not commentaries and must never be included), but they still show contempt and supersessionism about the Jews of Luther's own day:
   - "throwing stones and their blasphemy"
   - "the calamity which rests upon the Jews to this day"
   - "the miserable state of the Jews at the present day"
   - "the Devil's own"

   Mentions of "Jew": Church Postil 814, House Postil 404, Genesis vol. 2 113. One option is a short editor's note at the start of the Luther voice.
3. **The canon.** James, Jude, Hebrews and Revelation are doubted; Ecclesiastes is not Solomon's. These appear in the prefaces and in the Peter and Jude commentary (see 4 and 15). They are the clearest clash with "fully believe the Bible".
4. **Other Christians.** Anabaptists, "fanatics", Zwinglians and monks are attacked. Psalm 82 asks rulers to punish blasphemers.
5. **Turks** appear in war and judgment language (Church Postil 117).
6. **Apocrypha.** One Church Postil epistle sermon is on Ecclesiasticus 15, and Coverdale's Magnificat has an appended attack on the Salve Regina (not Luther's).
7. **Translators' notes.** Gillett cites De Wette, and Lenker's and Jacobs' notes are mixed into the SWORD text as `<note>`. Strip editors' notes and keep only Luther's words.

## Spot-check method
`tools/spot.py` (and `spot_em.py` for old spelling) picks a passage at 10 to 20 percent, 50 percent and 80 to 90 percent of a transcription, finds the same 8-word anchor in an independent scan OCR, and counts word-level matches over 100 to 150 words. Every mismatch I listed was a scan OCR error unless I say otherwise. The exceptions are the Lutheran Library Church Postil's KJV substitution and the one Galatians heading fix in PG since 2018.

## Files
- SWORD module, unpacked: `luther/raw/sword/mod/` (read with `tools/zcomread.py`, which uses KJV versification from `voices/dl/kjv/KJV.json`). The JSON dump is `luther/raw/sword/luther.json`.
- PG texts: `luther/raw/pg/`
- GITenberg copies: `luther/raw/gitenberg/`
- TCP XML: `luther/raw/tcp/`
- Lutheran Library PDFs and text: `luther/raw/ll/`
- Scan OCR: `luther/raw/ocr/`, `luther/raw/ia/`
- Renewal records: `luther/raw/cce/`
