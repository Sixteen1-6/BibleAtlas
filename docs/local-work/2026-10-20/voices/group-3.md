# Group 3: New Testament and Gospels writers for Deep

Checked 2026-10-20. Bible Atlas clone read only (sources.json, config/layer-sources.json, NOTICE.md, crates/atlas-cli/src/extra_voices.rs, the mirror workflow on origin/claude/ask-the-bible-u6macl). Nothing in the repo was changed.

Working files are under `C:\Users\shubh\AppData\Local\Temp\claude\C--Users-shubh-Projects--claude\d3907c69-e0f0-457b-bec9-6a76569849b3\scratchpad\ba\voices\g3\` and the check scripts under `...\voices\g3-scripts\` (cmp3.py does the word-by-word comparison against scan OCR).

## Short answer

| Writer and work | Public domain in US | Founder rule | Open transcription on GitHub | Store now? |
|---|---|---|---|---|
| Calvin, Commentaries (Calvin Translation Society) | Yes | Fits (on cite list) | Yes: Let's Church `calvin.json` (CC0), same commit already pinned; Pastorals from pillar-commentary-data (MIT) | Yes |
| Ryle, Expository Thoughts on the Gospels | Yes | Fits well (not on cite list yet) | Only a modernised copy (Grace Gems text in an Apache-2.0 vault) | Yes, but rebuild Ryle's own words against the 1857-73 scans first |
| Robertson, Word Pictures, vols 1-3 (1930) | Yes (vol 4 of 1931 also unrenewed; vols 5-6 renewed) | Fits, but quotes avoid-list writers | No; SWORD module RWP on crosswire.org, needs a mirror | Yes for Matthew, Mark, Luke, Acts, after repairing the Greek |
| Bengel, Gnomon (T. & T. Clark, Fausset edition) | Yes | Fits (on cite list) | None; only scan OCR | Not now |
| Ellicott, New Testament for English Readers | Yes | On cite list, but several contributors are a problem | None; only scan OCR | Not now |
| Alford, Greek Testament | Yes | Does not fit: he denies verbal inspiration and grants errors | None clean; CC BY scan OCR on archive.org | No |

## How the existing three are sourced (for comparison)

Every source in sources.json is a pinned git commit on github.com; `atlas fetch` checks out only the listed files and records their SHA-256 in data/raw/manifest.lock.json, and `atlas build` refuses to run if a file changes. Henry and Wesley come from LetsChurch/lets.church at 71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239 (CC0 1.0), extracted from the CrossWire SWORD modules. The Catena comes from AlvaroBalbin/catena (MIT code, data marked public domain). A non-GitHub file must be mirrored to its own branch by a workflow that checks hashes, as `.github/workflows/mirror-meaning-model.yml` does for the meaning model.

## 1. John Calvin, Commentaries (Calvin Translation Society, Edinburgh, 1843-55)

- Dates: Calvin wrote 1540-64; the CTS English edition 1843-55. Acts in the CTS edition is Christopher Fetherstone's 1585 translation revised by Henry Beveridge, so it reads older ("gathereth", "maketh").
- Founder rule: on the cite list (`calvin`). Fits.
- Best source: https://github.com/LetsChurch/lets.church at 71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239, `packages/lets.bible/seed/commentaries/calvin.json`. Already the pinned commit for Henry and Wesley. Git blob df5a72fe665dd4f6734218b213dcf978ece5f481; 35,706,368 bytes; SHA-256 7d03ab006c4b0afec450181fb1b5a3ce5de115c4259b72d83d775eaa8f2a7736.
- License words: repo LICENSE "CC0 1.0 Universal"; the file's own header says `"license":"Public Domain"`, `"sourceModule":"CalvinCommentaries"`. The SWORD module's conf (crosswire.org, CalvinCommentaries 1.1, 2022-08-01) says `DistributionLicense=Public Domain` and `TextSource=http://www.ccel.org/`.
- Coverage (NT): 24 of 27 books. Calvin wrote nothing on 2 John, 3 John or Revelation. 4,859 NT entries, about 2.1 million words, 11.9 MB of the file (the rest is Old Testament).
  - Gap in the Let's Church file: 1 Timothy, 2 Timothy and Titus keep only one short entry per chapter (about 9,500 of 197,000 words). The SWORD module itself has them in full (113, 83 and 46 verse entries).
  - Fix: take those three books from https://github.com/thefrenchpressed/pillar-commentary-data at ba1587984c5325c0974577f43cba7e7ed10f3274, `c/calvin/1TI|2TI|TIT/<chapter>.json` (MIT; README: "The underlying commentary text is public domain"). That repo has no Acts and leaves out 1 Tim 1:1 and 2 Tim 1:1 on purpose, so use it only for the Pastorals. Or mirror CalvinCommentaries.zip (20,897,508 bytes, SHA-256 df66fc8c03537499ad006d069481d2c95b600887cdbd6ce75ec5d264b573192a, from https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/CalvinCommentaries.zip) and read it directly.
  - Calvin's Harmony of the Gospels files most comments under Matthew, so Mark has only 78 entries and Luke 370. Parallels would need placing if Mark readers are to see much.
- Format: JSON `{work, entries:[{book, chapter, verse, body}]}`, keyed by USFM book code, chapter and verse, with `{{ref:...}}` reference marks like Henry and Wesley.
- Accuracy (against the CTS scans on archive.org, commentaryongosp01calvuoft and commentariesonth00calvuoft):
  - John 3:16: 159 of 160 words match; only "Savior" for "Saviour".
  - John 1:1: 118 of 120; only the reference form ("1 Timothy 3" for "1 Tim. iii").
  - Romans 3:28: 120 of 150; the differences are OCR line breaks, "labor" for "labour", and the translator's footnote (left out of the transcription).
  - Romans 5:1: 144 of 150; same kinds of differences.
  - The text is the CTS translation word for word. CCEL changed British spellings to American.
- Clean-up the build needs: section headers carry the next passage's verse text in English and Latin at the end of the entry before (Romans 3:28's entry ends with Romans 3:29-30 in English and Latin). The last entry of Romans, Ephesians, Philemon, Hebrews and Jude carries the translators' "new translation" and appendices (Hebrews 13:24 compares Doddridge, Macknight and Moses Stuart). Strip both.
- Concerns: strong polemic, word for word. In the NT: "Papist/Papists" about 980 times, "Pope" 202, "Antichrist" 58 (often of the Pope), "Sophists" (the schoolmen) 31, "Anabaptists" 23, "Servetus" 12, and remarks on the Jews' "malice" and "obstinacy" (Matthew 1:22: "perverted by the Jews with their accustomed malice"). The founder allows Catholic writers, so readers will see Calvin attack them by name.
- Recommend: yes.

## 2. J. C. Ryle, Expository Thoughts on the Gospels (1856-73)

- Dates: Matthew 1856, Mark 1857, Luke 1858-59 (two volumes), John 1865-73 (three volumes). Ryle died 1900. Public domain.
- Founder rule: fits well. Evangelical Anglican, Bishop of Liverpool, a firm defender of the inspiration of every word of Scripture (his John 1 note: the four evangelists "were all four equally and entirely guided by the Holy Ghost"). Not on the cite list or the avoid list; worth adding to the cite list.
- Best openly licensed transcription: https://github.com/BenjaminPoole/Ecumenical-Christian-Library-Obsidian-Vault at b8fbecc46a1528ff64bcf85b3502288d6784e005, folder `07 Evangelical Writers (1700–present)/JC Ryle/Expository Thoughts on the Gospels/` (`Matthew/ET Matthew 01.md` ... `John/ET John 21.md`). On GitHub, no mirror needed.
- License words: `license.txt`: "This repository is licensed under the Apache 2.0 license. I believe all the resources scraped to build this site are either public domain or freely available." `readme.md`: "All text is public domain and scraped agentically using Claude code." Each file's front matter names its source as Grace Gems (gracegems.org), "modernised text". Grace Gems' pages carry no license or copyright statement at all.
- Coverage: all 89 chapters, 420 sections (Matthew 96, Mark 76, Luke 144, John 104), about 516,000 words of Ryle plus about 67,000 words of Bible text. 98 files, 3.2 MB. Ryle's own Notes (the long verse notes in the Luke and John volumes, which quote Calvin, Bengel, Alford, Stier, Olshausen and others) are not included.
- Format: Markdown, one file per chapter; each section starts `## MATTHEW 5:1-12`, then the passage as a `>` quote, then Ryle's text. Verse ranges come from the headings.
- Accuracy (against the 1857 Robert Carter scans on archive.org, expositorythough01ryle, 02ryle, 05ryle; status NOT_IN_COPYRIGHT):
  - Matthew 5:1-12: 193 of 200 words; "spake" became "spoke".
  - Mark 16:1-8: 146 of 150; "no small courage" became "great courage", "St. Mark" became "Mark", "sepulchre" became "sepulcher", and a typo "it the conduct" for "in the conduct".
  - John 1:1-5: 156 of 160; "Holy Ghost" became "Holy Spirit" (0 "Holy Ghost" left in the whole vault text, 260 "Holy Spirit"), "St." dropped.
  - CCEL's Matthew (Carter 1860, `DC.Rights: Public Domain`) matches the scan just as well but has only Matthew, and CCEL's policy reserves republishing.
- Concerns:
  - The vault text is not Ryle word for word: Grace Gems modernised it. It also seems to soften terms: the vault has "Roman Catholic" 11 times where the 1857 volumes I checked have none.
  - Each section's Bible passage is a modern copyrighted version (NKJV for Matthew 5, ESV for Mark 16, NET for John 1). The build must drop these blocks; the Apache license cannot cover them.
  - Harsh language that would appear: firm anti-Roman Catholic remarks (Mass, the papacy, Mary; the originals say "Romish", "Romanists", "Popery"), "the Jews" as the nation that rejected Christ (312 times), "heathen" 72, "infidel" 48.
  - Suggested build: mirror the archive.org OCR of the seven 1857 Carter volumes (about 8 MB, NOT_IN_COPYRIGHT) to a branch, and align the vault text against it word by word, taking the scan's word wherever they differ (the alignment already matches 97 to 99 percent). That gives Ryle's own words with clean layout.
- Recommend: yes, built that way. Not the vault text as it stands.

## 3. A. T. Robertson, Word Pictures in the New Testament (vols 1-3, 1930)

- Dates and status: vol 1 Matthew and Mark, vol 2 Luke, vol 3 Acts, all 1930 (Richard R. Smith, New York): public domain in the US since 2026-01-01. Vol 4 (Paul's Epistles, 1931): no renewal found in the NYPL renewal records for 1956-61 (github.com/NYPL/cce-renewals), so it also looks public domain, though the founder's rule names only 1930. Vol 5 (John and Hebrews, 1932) was renewed 18 Jan 1960, R250625, and vol 6 (General Epistles and Revelation, 1933) on 2 Feb 1960, R251316: under copyright to the end of 2027 and 2028.
- Founder rule: Southern Baptist seminary professor who held Scripture to be inspired. Not on either list. But see concerns.
- Best source: the CrossWire SWORD module RWP (v2.0, 2013), https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/RWP.zip (3,210,969 bytes, SHA-256 f036fbb0155840da5d18444130acea493538ca375d1ff1d163627d5010691cb5). Not on GitHub in a clean form (copies sit inside unlicensed app repos RNK-Enterprise/the-gift and geiroffenberg/new_testament_commentaries), so it needs a mirror branch like mirror-meaning-model.yml.
- License words (rwp.conf): `DistributionLicense=Copyrighted; Free non-commercial distribution` for the module as a whole (because of vols 5-6), and in About: "Vol 1,2,3,4  Public Domain" (the 2002 version: "Vol 1,2,3,4  Public Domain -- Copy Freely"). Take only Matthew, Mark, Luke and Acts. CCEL's copy (word.xml) is under CCEL's terms ("Contact us for permission to republish"). OpenChristianData has a parser but its repo is CC BY-NC 4.0.
- Coverage (vols 1-3): Matthew 769 notes, Mark 540, Luke 1,023, Acts 994; 3,326 verse notes, about 415,000 words, 2.5 MB.
- Format: zCom module (OSIS markup), one note per verse in KJV versification; needs a small SWORD reader in the build or a one-time extraction.
- Accuracy (against the 1930 scans on archive.org, wordpicturesinne01robe, 02robe_0, 03robe_0):
  - Matthew 5:3: 108 of 110 words match; Luke 2:2: 114 of 120 (book names shortened: "Ac" for "Acts"); Acts 2:38: 120 of 120.
  - The Greek is not Robertson's: he printed transliterations ("makarioi", "eulogētoi"); the module turned them into Greek letters and drops a final i: "μακαριο" for "μακαριοι", and "κα" for "και" 652 times in vols 1-3 (only 2 correct). The Greek must be repaired from the scans before storing word for word.
- Concerns:
  - Robertson quotes avoid-list writers by name: Vincent 74 times in vols 1-3, Meyer 6, Thayer 6, A. B. Bruce of the Expositor's Greek Testament (about 159 "Bruce"), Plummer (ICC Luke) 121, Moffatt 42.
  - He accepts that Matthew and Luke used Mark and the Logia ("Q"), and follows the critical Greek text: Mark 16:9-20, John 7:53-8:11 and the doxology of the Lord's Prayer are marked as not original.
  - "Jews" 444 and "Pharisees" 251, mostly descriptive.
- Recommend: yes for vols 1-3, if the founder accepts the quoted avoid-list names and the Greek is repaired. Otherwise wait.

## 4. J. A. Bengel, Gnomon of the New Testament (English, T. & T. Clark, 1857-58)

- Dates: Latin 1742; English "now first translated", revised and edited by A. R. Fausset (of JFB), T. & T. Clark, Edinburgh, 1857-58 (five volumes; translators Bandinel, Fausset, Bryce, Fletcher and others). A second English version by Charlton T. Lewis and Marvin R. Vincent (Philadelphia, 1860-62) exists. Public domain.
- Founder rule: on the cite list (`bengel`). Fits. Use the Fausset edition only: the Philadelphia version is co-translated by Marvin R. Vincent (the "Vincent" on the avoid list) and adds bracketed critical notes ("So Tisch., Alf., Treg.").
- Best source: no openly licensed transcription found. CrossWire has no module; Bible Hub and StudyLight carry it but their terms bar reuse (StudyLight: "Copying or storing of any Content on the Web Site for reproduction, redistribution or publication to third parties for commercial purposes is expressly prohibited"; Bible Hub: "you will have no rights to make any commercial use of this web site"); otseng/UniqueBible_Commentaries has `cGnomon` but the repo has no license and mixes in copyrighted works. Only the archive.org scans: gnomonofthenewte01benguoft (vol 1), gnomonofthenewte00benguoft (vol 3), gnomonofnewtesta0004mern (vol 4), gnomonofnewtesta05beng (vol 5), and the Cornell 1877 set cu31924092350499 to ...531; most marked NOT_IN_COPYRIGHT. These would need a mirror.
- Coverage: the whole New Testament, about 7 MB of OCR text.
- Accuracy (scan OCR against Bible Hub's copy of the same edition): Mark 3:17 84 of 90 words; Matthew 5:4-5 78 of 90; Romans 3:28 84 of 90. The English wording is the same edition; the OCR breaks the Greek ("vy irpaus", "yap") and loses the Hebrew, and Bengel is full of both.
- Concerns: his Revelation notes set dates (1836 for the fall of the beast, with tables of years); about 123 "Pope" and 127 "Antichrist" in the scans; Greek and Latin on every page.
- Recommend: not now. Revisit if a clean transcription appears or someone corrects the OCR with the Greek restored.

## 5. Ellicott, A New Testament Commentary for English Readers (1878-79)

- Dates: three volumes, Cassell (London) and Dutton (New York), 1878-79, edited by Charles John Ellicott. Public domain.
- Contributors (from the title pages): vol 1 Matthew, Mark, Luke: E. H. Plumptre; John: H. W. Watkins. Vol 2 Acts and 2 Corinthians: Plumptre; Romans and Galatians: W. Sanday; 1 Corinthians: T. Teignmouth Shore. Vol 3 Ephesians, Philippians, Colossians, Philemon: Alfred Barry; Thessalonians and 1 Peter: A. J. Mason; Pastorals: H. D. M. Spence; Hebrews: W. F. Moulton; James: E. G. Punchard; 2 Peter and Jude: Alfred Plummer; John's letters: W. M. Sinclair; Revelation: W. Boyd Carpenter.
- Founder rule: on the cite list (`ellicott`), but stored word for word the contributors matter:
  - Sanday (Romans, Galatians) later co-wrote the ICC Romans (ICC is on the avoid list), and by 1914-15 would neither affirm nor deny the virgin birth.
  - Plumptre (five books) was Broad Church, hoped for repentance after death, and wrote the Cambridge Bible Ecclesiastes (Cambridge Bible is on the avoid list).
  - Plummer (2 Peter, Jude) later wrote ICC volumes.
  - Boyd Carpenter (Revelation) moved from evangelical to broad church views.
  - Ellicott himself defended the Bible's inspiration.
- Best source: no openly licensed transcription; Bible Hub and StudyLight only (terms above). archive.org scans: newtestamentcomm01elli and newtestamentcomm03elli (Dutton 1878), vol 2 from the 1884 Cassell printing newtestamentcom00elllgoog; all NOT_IN_COPYRIGHT. Would need a mirror.
- Coverage: the whole NT, about 13 MB of OCR.
- Accuracy (scan OCR against Bible Hub): Matthew 5:3 114 of 120 words; John 3:16 117 of 120; Romans 3:28 108 of 120 (the 1884 Google scan is noisier).
- Concerns: Plumptre on Stephen's speech allows "an inaccuracy naturally incident to a quotation from memory"; "Meyer" named about 20 times and "Renan" 15.
- Recommend: not now. If pursued, the founder should first decide on Sanday's Romans and Galatians, and on Plumptre and Plummer.

## 6. Henry Alford, The Greek Testament (1849-61)

- Dates: four volumes 1849-61, revised to his death in 1871; reprints to 1878 and 1897. Public domain.
- Founder rule: does not fit. In his Prolegomena (vol 1, ch. 1, sec. 6, "Inspiration") he rejects verbal inspiration, says the evangelists in minor matters "were not supernaturally informed", and finds in Stephen's speech "at least two demonstrable historical inaccuracies". The notes lean constantly on Meyer (345 mentions in vol 1, avoid list) and De Wette (147). Not on the cite or avoid list; consider adding him to avoid.
- Best source: no clean transcription. The archive.org item GreekTestamentCriticalExegeticalCommentaryByHenry (scans of the 1863-78 editions) has `licenseurl: http://creativecommons.org/licenses/by/3.0/`; its OCR is about 15 MB, with the Greek unreadable (88 Greek-letter tokens in 751,000 words of vol 1). StudyLight has a copy but blocks automated access and bars reuse.
- Accuracy (two OCRs compared, 1863 CC BY item against the 1874 Boston printing): Prolegomena para. 14-15 117 of 120 words; Luke 2:2 note 90 of 120 (OCR errors and edition changes: "till recently" against "formerly"); para. 16 112 of 120.
- Recommend: no.

## Spot-check method

Each check takes about 90 to 200 words from the candidate text, finds the same place in OCR of a scan (or another copy of the same edition), and counts matching words with Python's difflib after normalising quotes and hyphenation. Most remaining differences are OCR errors in the scan, not errors in the transcription; the notes above say which ones are real.
