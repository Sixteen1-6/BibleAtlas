# More writers at Deep: the later commentators

Plan written 2026-10-20. Research only: nothing in the Bible Atlas clone (C:\Users\shubh\Projects\BibleAtlas, main at 5296d48) was changed. The plan rests on the research notes group-1.md to group-4.md and voices-research-results.json in this folder: twenty-four works researched, and sixteen of them re-checked by a separate, sceptical pass that fetched each source again, with its commit, its license words and samples of its text. Where the check pass and the research disagree, this plan follows the check pass.

Measured for this plan (scripts in the session scratchpad, folder `vplan`): the plain-text size of every shortlisted work after the cuts the build would make; the Old Testament part of the Let's Church Calvin file, which no research group had looked at; today's built voices files (in the BibleAtlas-fixes worktree, whose voices code is the same as main's); the SHA-256 of every file inside the CrossWire modules the research downloaded (Appendix A); and the two public-domain C. S. Lewis books on GitHub.

This is the first of two plans. The second, VOICES-PLAN-LUTHER-FATHERS.md beside this file, covers Luther, the Reformers and Puritans, and the church fathers. It was written first, from this track's research notes, and its section 6.2 lists the build changes both tracks need. This plan agrees with that list and only adds what this track needs (section 5.2). Questions both plans ask are marked, so the founder answers them once.

The founder's rule (PR #37): cite only "bible believing people who fully believe the bible and theologians that love God, not people who are liberalizing the bible". Catholic and Orthodox writers who uphold Scripture are kept; Jewish scholars and rabbis are not cited; writers the early church condemned are out. config/layer-sources.json holds the cite and avoid lists. Every source must be a pinned git commit on github.com; anything else is first mirrored to a branch of the repository. Public domain here means published in 1930 or earlier (or never renewed), and the transcription itself must carry a plain statement that it is free to copy.

## 0. In short

- **Eleven works make the shortlist, in three rounds** (section 2). Round 1: Jamieson, Fausset and Brown on the whole Bible; Keil and Delitzsch on the Old Testament; Calvin on 21 New Testament books; Spurgeon's own Exposition in The Treasury of David. Round 2: Matthew Henry's full commentary; Barnes on the New Testament. Round 3: Poole, Clarke and the 1917 Scofield notes, then McGarvey and Pendleton's Fourfold Gospel and B. W. Johnson's People's New Testament as a second tier.
- **Four of the eleven are already on github.com.** Henry's full commentary and Calvin come from the same Let's Church commit that henry-concise and wesley-notes already pin. Spurgeon comes from lyteword/chspurgeon-tod, Poole from the Text Creation Partnership. The other seven are CrossWire SWORD modules: one mirror workflow, modelled on mirror-meaning-model.yml, copies them to branches, and the build needs a small SWORD reader, which means its first compression library (section 5.3).
- **Not now** (section 4): Gill (the editor of the only electronic text reserves all rights), the Geneva notes (no license line upstream, and a modern editor's glosses mixed in as if Geneva's), Robertson (Greek damaged throughout, conflicting license), Ryle (only a modernised text exists), Calvin's Old Testament (this plan found Psalms, Zechariah and Malachi cut to one short entry a chapter and Isaiah 49 to 66 missing), and Simeon, Ellicott, the Pulpit Commentary, Bengel, Alford, Bullinger's Companion Bible and Spurgeon's sermons.
- **Every work here would show the hard words of its day, word for word.** The ones the founder must decide on before anything ships: Scofield's note at Genesis 9:1 that "from Ham will descend an inferior and servile posterity"; the words "savage", "barbarian" and "negro" in Henry, Barnes and Clarke; Calvin's attacks on "Papists" (493 times in the New Testament); Clarke's rejection of the eternal Sonship of Christ at Luke 1:35; and Delitzsch's view that Solomon did not write Ecclesiastes.
- **Page weight.** Today the writers' notes are 14.6 MB in 81 files, about 5.2 MB over the wire. The whole shortlist adds about 140 MB of text (about 50 MB compressed). That only works if each writer gets its own files, fetched when a reader opens that writer: then one writer costs at most about 175 KB over the wire, and the site stays far under GitHub Pages' 1 GB limit (section 5.7).
- **C. S. Lewis cannot be stored.** His Christian books stay under US copyright until 2029 (The Pilgrim's Regress) through 2054 (Reflections on the Psalms) and later. The only two of his books that are public domain in the US are poems from 1919 and 1926, written before he became a Christian. A shelf card, a facts-only list of where he writes on a passage, and links are possible (section 6).

## 1. What the build does today

- `crates/atlas-cli/src/extra_voices.rs` reads three works: `catena-aurea` (AlvaroBalbin/catena), and `henry-concise` and `wesley-notes` (Let's Church `mhcc.json` and `wesley.json` at commit `71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239`). Each reader checks the source's own license marker and stops the build if it changes (`license != "public-domain"` for the Catena; `work.license != "Public Domain"` for Let's Church, in `entries()`).
- Notes are placed by KJV verse numbers. Henry by his own headings ("Verses 1-9"), with a fix table `HENRY_ENDS` for six headings that name too few verses; Wesley by the verse the module gives, moved when the words it explains are in a later verse. Book introductions and chapter outlines are left out. An item is `[work, from, to, voices]` and never crosses a chapter.
- Output: `extras/voices.json` (`has`, one character per verse, '0' plus a bit per work, so at most three works) and `extras/voices/<Book>.<k>.json`, each holding every work's notes for a run of chapters, split at about 500,000 bytes. The panel fetches one whole part file when a reader at Deep chooses "Show what they wrote".
- `verify` checks exactly three works ('0' to '7', `w < 3`), the index under 200,000 bytes, every part file under 1,500,000 bytes, and known cases (Chrysostom on John 1:1, Henry on Genesis 1:1 and John 3:16, Wesley on John 9:38).
- The web hard-codes the three works: `WORKS` in `web/src/ui/extras/voices/model.ts`, the rows of "How these are chosen" and the source line in `Panel.tsx`. "Read more on other websites" (`links.ts`) already links Keil and Delitzsch and JFB on Bible Hub chapter by chapter, and the shelf card `keil-delitzsch` has no dataset and says "The app links to it on Bible Hub."
- Measured today: 81 part files, 14,609,361 bytes (Catena 5.63 MB, Henry Concise 3.77 MB, Wesley 5.31 MB), 5,155,521 bytes compressed (gzip ratio 0.353); the index is 31,439 bytes (4,739 compressed). The whole `web/public/data` folder is 121 MB.
- The voices build never runs the avoid-list check (only `layers.rs` and `world.rs` do). `atlas-cli` depends only on serde, serde_json and sha2.

## 2. Ranked shortlist

Ranked by: how plainly the writer passes the founder's rule; how clean the license and the text are; what the work adds where the app has only Henry's Concise and Wesley; and how much work it takes. "Text" is the plain text after the cuts in each entry (measured for this plan); built files come out within a few percent of it, and travel compressed at about 35 percent.

| # | Writer and work | Source | New coverage | Text | Main concern |
|---|---|---|---|---|---|
| 1 | Jamieson, Fausset and Brown, Commentary Critical and Explanatory (1871) | CrossWire JFB 3.0, mirror | whole Bible, 24,813 verses | 10.4 MB | Names Meyer 53 times; papacy as the apostasy |
| 2 | Keil and Delitzsch, Biblical Commentary on the Old Testament (English 1864-78) | CrossWire KD 2.0, mirror | all 39 OT books, 23,734 verses | 23.1 MB | Ecclesiastes not by Solomon; rabbis and critics named hundreds of times |
| 3 | John Calvin, Commentaries, New Testament (Calvin Translation Society 1843-55) | Let's Church `calvin.json`, same pinned commit | 21 NT books in full | 11.7 MB | "Papist" 493 times |
| 4 | C. H. Spurgeon, The Treasury of David, his own Exposition (1869-85) | lyteword/chspurgeon-tod on GitHub | Psalms, 2,435 of 2,461 verses | 3.9 MB | The transcription behind it says "All rights reserved" |
| 5 | Matthew Henry, Exposition of the Old and New Testament, complete (1706-21) | Let's Church `mhc.json`, same pinned commit | every chapter, in full | 33.7 MB | Largest; same writer as the Concise |
| 6 | Albert Barnes, Notes on the New Testament (1832-53) | CrossWire Barnes, mirror | all 27 NT books, 7,463 verses | 14.9 MB | Edition not named; "savage", "negro" |
| 7 | Matthew Poole, Annotations upon the Holy Bible (1683-85) | TCP A55363 and A55368 on GitHub | whole Bible except Leviticus 10:12 to 11:24 | 17.1 MB | 1680s spelling; illegible letters in 7,128 notes |
| 8 | Adam Clarke, Commentary and Critical Notes (1810-26) | CrossWire Clarke 2.0, mirror | whole Bible, 21,051 verse notes | 20.1 MB | Rejects the eternal Sonship; serpent as an ape |
| 9 | C. I. Scofield, Reference Bible notes, 1917 edition | CrossWire Scofield 2.1, mirror | 3,207 notes over 66 books | 0.8 MB | Genesis 9:1 note on Ham |
| 10 | J. W. McGarvey and P. Y. Pendleton, The Fourfold Gospel (1914) | CrossWire TFG 1.5, mirror | Gospels and Acts | about 2.5 MB | Restoration Movement view of baptism |
| 11 | B. W. Johnson, The People's New Testament (1889-91) | CrossWire PNT 1.1, mirror | 26 NT books (Philemon missing) | about 2.0 MB | Overlaps Wesley and Henry; second tier |

Why this order. JFB is the plainest fit (three conservative authors, no critics among them), covers the whole Bible at a modest size, and has the strongest license chain of any mirrored work. Keil and Delitzsch is the Old Testament depth the app links to today and defends the Old Testament against the critics, but the founder must first decide on Ecclesiastes. Calvin needs no mirror and is the Reformer's own exegesis, but its polemic is the heaviest of the round. Spurgeon is the best-loved work on the Psalms and needs no mirror, but its license rests on a decision (question 5). Henry's full commentary is clean and already pinned, but it repeats a writer the app already shows, so it waits on question 6. Barnes adds a new New Testament voice. Poole, Clarke and Scofield each need a decision or a repair pass first. The last two are useful but add little beside the others.

### 2.1 Jamieson, Fausset and Brown

- **Work:** A Commentary, Critical and Explanatory, on the Whole Bible, the one-volume edition of 1871. Robert Jamieson (Church of Scotland) wrote Genesis to Esther; David Brown (Free Church) Matthew to Romans; A. R. Fausset (Church of England) Job to Malachi and 1 Corinthians to Revelation. Already on the cite list as `jfb`.
- **Source:** CrossWire SWORD module JFB, version 3.0 (2021-02-15, "New source from https://ccel.org/"), `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/JFB.zip`, 5,687,740 bytes, SHA-256 `257f743e1c9265618827c236e9b4ccb40ae7a6af348dfe814b555494c4b687fe`. CrossWire repacked this zip on 2026-10-20, so the zip's hash will change again; the mirror must check the unpacked files (Appendix A), which do not change when the zip is repacked.
- **License words:** `jfb.conf`: "DistributionLicense=Public Domain", "TextSource=https://ccel.org/ccel/j/jamieson/jfb/cache/jfb.txt". CCEL's own jfb.txt opens "Rights: Public Domain" (check pass). The statement that travels with this text (StudyLight's JFB pages): "This expanded edition of the Jameison-Faussett-Brown Commentary is in the public domain and may be freely used and distributed." Take it from CrossWire, as Henry's Concise was, not from CCEL, whose site policy asks permission to republish.
- **Coverage:** all 66 books, 1,189 chapters; 16,882 notes covering 24,813 verses; about 1.84 million words. Eleven chapters have no notes, only a pointer to a parallel ("For the exposition, see on Mr 13:1-37" at Matthew 24; also Matthew 26, Mark 3 and 15, 2 Samuel 22, Psalms 70, 108, 139, 141, 144 and 146).
- **Size:** 10.4 MB of text after the cuts; about 3.9 MB compressed.
- **Accuracy:** against the 1873 printing: Genesis 1:1 94.6 percent of words, Psalm 23:1 81.8, John 3:14-16 85.9; every difference is OCR noise in the scan or the module's own reference abbreviations ("Pr", "Joh", "Ro"), "namely" for "viz." and "further" for "farther".
- **Word for word, the founder should know:** at 2 Thessalonians 2:3 it reads the man of sin as "the apostasy of Romanism", about 14 such places, and "Romish" 30 times; "blind/obstinate Jews" about 13 times; it names Meyer (on the avoid list) 53 times and Kimchi 15 times as writers it weighs. "Faussett" is misspelled in the module four times.
- **Build notes:** the Genesis 1:1 entry carries all four general introductions (107,643 characters): leave them out, as Henry's are. Range notes begin "14-16." and are stored once and linked from the other verses: place each once over its range. The eleven pointer chapters become one short note on the chapter with the pointer as a verse link, or are left out (a small table, like `HENRY_ENDS`). Once JFB is stored, the Bible Hub JFB link in "Read more on other websites" says nothing new and can go (question 13).

### 2.2 Keil and Delitzsch

- **Work:** Biblical Commentary on the Old Testament, T. and T. Clark's English edition, 1864-1878 (German 1861-1875). Keil wrote the Pentateuch, the historical books, Jeremiah, Lamentations, Ezekiel, Daniel and the Minor Prophets; Delitzsch Job, Psalms, Proverbs, Song of Songs, Ecclesiastes and Isaiah. Already on the cite list as `keil-delitzsch`, with no `not_on`.
- **Source:** CrossWire KD, version 2.0 (2022-08-03), `https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/KD.zip`, 11,170,353 bytes, SHA-256 `ca3bdb6a04c0b717ee2faed71b432d58195db96f217f490ce6f7d9c36a2876f7`. No copy on GitHub.
- **License words:** `kd.conf`: "DistributionLicense=Public Domain", "TextSource=https://en.wikisource.org/wiki/Biblical_commentary_the_Old_Testament"; the Wikisource index page carries {{PD-old}} and also {{no source}}. The chain is thin: version 1 was a BibleWorks user module, and the Wikisource pages were put up in May 2022 by the volunteer who also uploaded Clarke and Scofield. Only {{PD-old}} and CrossWire's "Public Domain" stand behind it (see question 9 on Wikisource).
- **Coverage:** all 39 books and 929 chapters; 23,734 verse slots from 9,775 distinct entries; about 4.4 million words. Isaiah is the earlier translation by James Martin, not Delitzsch's 1890 fourth edition, in which he gave ground on Isaiah 40 to 66 (Isaiah 7:14 matches the 1890 scan at only 42 percent).
- **Size:** 23.1 MB after leaving out the 25 entries over 40,000 characters that are book introductions (2.2 MB; Psalms 1:1 alone is about 225,000 characters); about 8.5 MB compressed.
- **Accuracy:** Genesis 3:15 96.8 percent, Genesis 22:1-4 97.7, Psalm 2:7-9 92, Psalm 22:16-18 89.6, against the T. and T. Clark scans; no wrong English words found. A few Hebrew runs are in BibleWorks' old font code ("„YJIYBINi" for נביאים), mostly in the Isaiah 1:1 introduction, which is left out anyway.
- **Word for word, the founder should know:** Delitzsch writes that Ecclesiastes "was not written by Solomon himself, but by a Jewish thinker of a much later age", and dates Psalm 44 to the Maccabees. A quotation lists "carnal Jews, Gentile Romans, cruel Mohammedans, impious Papists"; Keil on Zechariah 12 says "Israel according to the flesh ... is rejected by God"; "Romish" 13 times. Critics and rabbis are named constantly, mostly to answer them: Hitzig 2,027 times, Ewald 1,971; avoid-list names 812 times (Kimchi 398, Rashi 227, Aben Ezra 88, Malbim 21, Maimonides 20, Meyer 19, Abarbanel 14).
- **Build notes:** each entry opens with its range ("Gen 22:1-4", "Psa 22:16-18 (Hebrew_Bible_22:17-19)"): place by that range and drop the label; 2,654 footnotes follow their paragraph; 71,106 OSIS references become verse links. A `not_on` for Ecclesiastes, if the founder chooses it, is read from the cite entry so the Layers notes and the voices agree. The "Read more" link to Keil and Delitzsch on Bible Hub and the shelf card's "The app links to it" sentence change when it ships.

### 2.3 John Calvin, New Testament commentaries

- **Work:** Calvin's commentaries in the Calvin Translation Society's English, Edinburgh 1843-55 (Acts is Fetherstone's 1585 translation revised by Beveridge). Already on the cite list as `calvin`.
- **Source:** github.com/LetsChurch/lets.church at `71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239` (already pinned), `packages/lets.bible/seed/commentaries/calvin.json`, git blob `df5a72fe665dd4f6734218b213dcf978ece5f481`, 35,706,368 bytes, SHA-256 `7d03ab006c4b0afec450181fb1b5a3ce5de115c4259b72d83d775eaa8f2a7736`. No mirror.
- **License words:** repository LICENSE "CC0 1.0 Universal"; the file's header `"license":"Public Domain"`, `"sourceModule":"CalvinCommentaries"`; the SWORD conf "DistributionLicense=Public Domain", "TextSource=http://www.ccel.org/". The same `entries()` license check the build already runs covers it.
- **Coverage:** 4,859 New Testament entries, 2.11 million words. In full: Matthew, Mark, Luke (as the Harmony of the Gospels, which files most comments under Matthew: Mark has 78 entries, Luke 370), John, Acts, Romans to 2 Thessalonians, Philemon, Hebrews, James, 1 and 2 Peter, 1 John and Jude. Calvin wrote nothing on 2 and 3 John or Revelation. 1 and 2 Timothy and Titus are cut to one short entry a chapter, keyed to verse 1 and holding only the comment on verse 1 (about 9,500 of 197,000 words); the research's plan to fill them from pillar-commentary-data failed in the check pass, and CrossWire has the same cut. Leave those three books out, or show each stub only on verse 1 (question 11).
- **Size:** 11.7 MB; about 4.0 MB compressed.
- **Accuracy:** John 3:16 159 of 160 words against the CTS scan ("Savior" for "Saviour"); John 1:1 118 of 120; Romans 3:28 120 of 150 and 5:1 144 of 150 (OCR line breaks, American spelling, the translator's footnote not transcribed). CCEL changed British spellings to American.
- **Word for word, the founder should know:** "Papist" 493 times in the New Testament (check pass; the research said about 980), "Pope" about 200, "Antichrist" 58 (often of the Pope), the "Sophists" (the schoolmen) 31, the Anabaptists 23, Servetus 12; remarks on the Jews' "malice" and "obstinacy" ("perverted by the Jews with their accustomed malice", Matthew 1:22). The app keeps Catholic writers in the Catena, and readers will see Calvin attack them by name.
- **Build notes:** an entry often ends with the next passage's verse text in English and Latin (Romans 3:28 ends with 3:29-30): cut it. The last entries of Romans, Ephesians, Philemon, Hebrews and Jude carry the translators' own new translation and appendices (the Hebrews 13:24 entry is 8,149 words, comparing Doddridge, Macknight and Moses Stuart): cut them. Strip stray OSIS tags (`<div eID`). The Harmony's comments could later also show on the Mark and Luke parallels the app already knows from the BSB section headings ("On Matthew 5:3, from the Harmony of the Gospels").

### 2.4 Spurgeon, The Treasury of David (his own Exposition only)

- **Work:** seven volumes, 1869-1885. Store only Spurgeon's Exposition, and perhaps his Hints to the Village Preacher. Leave out the Explanatory Notes and Quaint Sayings: they quote hundreds of other writers word for word, critics and rabbis among them (Ewald 11, De Wette 9, Hupfeld 6, Kimchi 24, Aben Ezra 12). On the cite list as `spurgeon`.
- **Source:** github.com/lyteword/chspurgeon-tod at `64450e77762f3ca54c99a229fbb7879e70832a83` (2026-05-28, more than 100 commits): 188 Markdown files, of which 149 are psalms and 22 are the eight-verse parts of Psalm 119 (the rest are index pages). No mirror.
- **License words:** LICENSE is the full "Creative Commons Legal Code / CC0 1.0 Universal" text; GitHub reports CC0-1.0. The README does not say where the text came from. It shares its typing errors with CrossWire's TDavid, whose conf says "DistributionLicense=Public Domain", "It is now in the public domain." and "TextSource=http://archive.spurgeon.org/treasury/". **The check pass failed the license:** the Spurgeon Archive's Treasury pages say "Copyright © 2001 by Phillip R. Johnson. All rights reserved." (Wayback copy, 2015), so lyteword's CC0 is a third party's label on that transcription, the same pattern for which Gill was turned down. The difference from Gill: the Archive's text is a straight transcription of an 1869-85 book, which under US law most likely carries no new copyright, while Gill's only text is an edition its editor modernised and reserves. Safe alternative: Project Gutenberg's proofread volumes ("for the use of anyone anywhere in the United States"), volumes 1 and 2 out so far (ebook 79723 is volume 1), mirrored to a branch as each appears. See question 5.
- **Coverage:** all 150 Psalms; Exposition headings on 2,435 of 2,461 verses. Missing in every copy: the expositions of Psalm 110:1 and 71:1. Psalm 84:1 is there without a heading; about 20 other verses have none (106:22, 24, 27, 38, 41; 132:8-10; 143:10-11 and others).
- **Size:** Exposition 3.9 MB (0.71 million words), Hints 0.8 MB; about 1.4 MB compressed for the Exposition.
- **Accuracy:** against Gutenberg's proofread volume 1: Psalm 2:7 99.0 percent ("council" for "counsel"), 8:3-4 99.7, 19:1 100, 22:16 99.6, 23:1 100; against scans, 23:4 99.4, 90:2 100, 91:1 98, 139:7 99.2, 150:6 100, 110:4 94.4 with two real errors ("will mot repent", "all]lope" for "all hope"). Careful, not proofread.
- **Word for word, the founder should know:** "Small courtesy is more than Romanists and Puseyists deserve for their fooleries"; "even the most solemn of Popish rites we must abhor"; "Papists, Ritualists, Arians, Sceptics" among the church's enemies; about 13 such words in the Exposition. The Exposition names no one on the avoid list.
- **Build notes:** read only the `## Exposition` section (and `## Hints to the Village Preacher` if wanted) and its headings "### Verse 3", "### Verses 1 & 2", "### Verses 5-8", "## Exposition Verse 105" (Psalm 119). Text before the first verse heading (Spurgeon's Title and Division notes) is left out, as Henry's introductions are, unless the founder wants it on the whole psalm. A fix table places the headless verses. HTML entities become characters; Spurgeon's own punctuation stays as printed. A verify check that no Spurgeon note names Kimchi, Ewald or Hupfeld proves the Explanatory Notes stayed out.

### 2.5 Matthew Henry, the complete Exposition

- **Work:** An Exposition of the Old and New Testament, 1706-1721. Henry died in 1714 having finished Acts; Romans to Revelation were completed by other Nonconformist ministers, of whom the file names John Evans (Romans), Jeremiah Smith (Titus, Philemon), John Reynolds of Shrewsbury (2 and 3 John) and John Billingsley (Jude); the others are unnamed, so the label can only say "completed by other ministers". On the cite list as `henry`.
- **Source:** Let's Church at the same pinned commit, `packages/lets.bible/seed/commentaries/mhc.json`, git blob `4a9d8be1b6206b4c86a7c65a6dda39382e845d8a`, 40,809,275 bytes, SHA-256 `45344dafe2f9254a20498379288e772b095fb337b33896541362198f7aec340b` (from the SWORD module MHC). No mirror.
- **License words:** repository CC0 1.0 (the LICENSE henry-concise already lists); the file's `"license": "Public Domain"`, `"sourceModule": "MHC"`; `mhc.conf`: "Public Domain--Copy Freely." and "DistributionLicense=Public Domain". The same chain as the Concise already shipped.
- **Coverage:** all 66 books and 1,189 chapters; 5,360 sections; 7.29 million words, 6.47 million after the printed KJV verses are dropped.
- **Size:** 33.7 MB after dropping the KJV paragraphs (4.2 MB) and the book prefaces (23 entries over 40,000 characters, 1.2 MB); about 11.8 MB compressed. Seven times the Concise.
- **Accuracy:** against the 1828 Philadelphia edition: Genesis 1 94.8 percent ("enquiry" for "inquiry"), Psalm 23 introduction 94.4 (the e-text lacks "therefore" once), John 3:16 91.7 (OCR noise only). A slip at Matthew 27:25: "and one our children".
- **Word for word, the founder should know:** about 122 phrases like "blind/obstinate/wicked/unbelieving Jews"; 77 "papist/popery/popish"; 15 "Romish"; 37 uses of "savage(s)", "barbarian(s)" or "negro" taken together; avoid-list names 12 times (Maimonides 10, Kimchi 2).
- **Build notes:** each section prints its KJV verses first ("3 And God said, Let there be light ... 5 And God called"). Read the printed verse numbers as the section's range, check them against `verseEnd` where the file gives one, then drop the paragraph. Leave out the prefaces in first entries, the five "chapter 0" title stubs (Obadiah, Philemon, 2 and 3 John, Jude) and the verse-0 chapter introductions, as the Concise does. Label Romans to Revelation as completed by others. Henry Complete and Henry Concise on the same verse is the founder's call (question 6).

### 2.6 Albert Barnes, Notes on the New Testament

- **Work:** Notes, Explanatory and Practical, New Testament, 1832-1853. On the cite list as `barnes`. Barnes was tried for heresy in 1835 over his Romans (original sin and imputation), suspended by his synod and restored by the 1836 General Assembly: a Calvinist doctrinal dispute, not one over Scripture. Store the New Testament only: the "whole Bible" Barnes sold today puts other men's work under his name (its Genesis is James G. Murphy's), and no licensed copy of his own Job, Psalms, Isaiah and Daniel was found.
- **Source:** CrossWire Barnes, `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Barnes.zip`, 5,812,827 bytes, SHA-256 `9e8edc0333875c214124371b3862df118ad3a76ade7753cb2faeed3484615baf`, last changed 2013-07-16. Mirror.
- **License words:** `barnes.conf`: "Description=Barnes' New Testament Notes", "DistributionLicense=Public Domain" (Version 1.1). No TextSource line. StudyLight's Barnes pages: "These files are public domain."
- **Coverage:** all 27 books and 260 chapters; 7,431 notes (7,463 verses with linked ones); 2.74 million words.
- **Size:** 14.9 MB; about 5.1 MB compressed.
- **Accuracy:** John 3:16 83.9 percent against the 1858 printing, because the module follows another, probably later, edition (it adds "He hates the sin, but loves the sinner"); Acts 2:38 96.4 (OCR noise only); Ephesians 2:8 86.3. NOTICE.md must say the edition is not named.
- **Word for word, the founder should know:** at 2 Thessalonians 2:3 he reports the Papacy as the man of sin; about 91 "Mahomet/Mohammedan/Turk" (Revelation read as history); about 101 uses of "savage(s)", "barbarian(s)" or "negro" taken together; 37 "papist/popery"; avoid-list names 11 times.
- **Build notes:** ThML markup; each note opens "Verse 16." and its lemma in italics: drop the "Verse 16." label, keep the lemma. `<scripRef passage="...">` become verse links. BlockType CHAPTER, so its files are `nt.czs/czv/czz`.

### 2.7 Matthew Poole, Annotations upon the Holy Bible

- **Work:** Vol. I 1683 (Genesis to Isaiah), Vol. II 1685. Poole wrote the notes himself only "to the fifty eighth of Isaiah"; Nonconformist ministers finished the rest after his death in 1679. On the cite list as `poole`.
- **Source:** github.com/textcreationpartnership/A55363 at `41a5d66565a933814dd6a5486595f6a2ae45e29f` (A55363.xml, 16,464,179 bytes, SHA-256 `fc494999def0b470be3e1d826d1bb310fe2e627da7d9946067485ddc92fbe6b5`) and A55368 at `eadd8a9fdb03365d0d54aa36287b7defb034cc8c` (A55368.xml, 17,124,322 bytes, SHA-256 `88e15a73286b932440edfa76936b374ba63360ffea2d62d0d3ba514c5cf9a6e6`). No mirror. The modern-spelling Poole on StudyLight, Bible Hub and e-Sword is "Used by Permission" and not usable.
- **License words:** in each XML's `<availability>` and README: "This Phase I text is available for reuse, according to the terms of Creative Commons 0 1.0 Universal. The text can be copied, modified, distributed and performed, even for commercial purposes, all without asking permission." The header asks that "due credit and attribution is given to their original source": NOTICE.md must give it.
- **Coverage:** all 66 books; 58,571 notes (29,766 and 28,806). Missing: Leviticus 10:12 to 11:24 ("2+ pages missing"), where the chapter divisions also run off by one; 20 duplicate pages in Vol. I.
- **Size:** 17.1 MB of note text (3.15 million words); about 6.0 MB compressed.
- **Accuracy:** keyed by hand from page images with 5 percent proofread. 2,901 notes in Vol. I and 4,227 in Vol. II contain an illegible mark (13,264 and 13,030 marks), mostly single letters ("H•ppiness"). Matthew 5:3, John 3:16 and Genesis 3:15 agree word for word with an independent modern text apart from spelling.
- **Word for word, the founder should know:** 1680s spelling and capitals ("onely", "Iews", "justifie"); about 210 "papist/popery/popish" in Vol. II and 19 places tying the antichrist to Rome; Kimchi 4 times.
- **Build notes:** shares the TEI reader the other plan needs for the Puritans (its section 6.3: join split words, long s as s, gaps as "[…]", keep the spelling otherwise). Notes are `<note place="bottom">` at the words they explain inside each verse's `<p n="16">`; margin notes (cross-references, most of the illegible text) are left out. Mark Leviticus 10:12 to 11:24 missing; label the notes from Isaiah 59 on as finished by others. A repair pass against the 1683 and 1685 scans on archive.org would remove most gaps; until then they show as gaps (question 7 of the other plan, on old spelling).

### 2.8 Adam Clarke, Commentary and Critical Notes

- **Work:** 1810-1826. Methodist; on the cite list as `clarke`.
- **Source:** CrossWire Clarke, version 2.0 (2021-10-19), `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Clarke.zip`, 8,627,265 bytes, SHA-256 `56bb33d3bf0f50c1609f4dd10ac81e7450bb0e8aae93bf340074ccb5e207a44f`. Mirror.
- **License words:** `clarke.conf`: "DistributionLicense=Public Domain", "TextSource=https://en.wikisource.org/wiki/Commentary_and_critical_notes_on_the_Bible". The conf's history says the module's first source text was lost and version 2.0 was rebuilt from sacred-texts' copy by way of Wikisource, where one volunteer uploaded the pages in 2021 tagged {{PD-old}} and {{No source}}. sacred-texts does not list Clarke among the texts it produced itself, so its own limits do not apply.
- **Coverage:** all 66 books and 1,189 chapters; 21,051 verse notes and 1,255 book or chapter introductions; 3.61 million words.
- **Size:** 20.1 MB; about 7.4 MB compressed (less if the introductions are left out, as Henry's are).
- **Accuracy:** Genesis 3:1 96.7 percent against the 1843 New York edition; Psalm 23:1 85.7 (scan noise; the typo "Bablylonish"); Isaiah 53:5 88 ("favor" for "favour").
- **Word for word, the founder should know:** at Luke 1:35 Clarke writes that "the doctrine of the eternal Sonship of Christ is, in my opinion, anti-scriptural, and highly dangerous". He affirms Christ's full deity, but the Nicene Creed confesses the Son "begotten of the Father before all worlds", so this note sits against the creed of the early church. At Genesis 3:1 he argues the tempter was a creature "of the simia or ape genus", not a snake. He is Arminian and argues against Calvinist readings. About 98 "papist/popery", 68 "Romish", 34 "blind/obstinate/wicked Jews", 139 "Mahomet/Mohammedan/Turk", about 78 uses of "savage(s)", "barbarian(s)" or "negro" together; avoid-list names 198 times (Kimchi 143, Maimonides 27, Aben Ezra 15).
- **Build notes:** OSIS; chapter summaries sit in each chapter's first entry; Hebrew and Greek are in their own scripts. Ships only after question 4.

### 2.9 Scofield Reference Bible notes, 1917

- **Work:** C. I. Scofield, 1909, revised 1917 (only the 1917 text is in the module; the 1967 New Scofield is in copyright). Not on the cite list or the avoid list. Scofield held the Bible inspired and without error; the notes are dispensational and premillennial and teach the gap theory at Genesis 1:2, as the already cited Bullinger does.
- **Source:** CrossWire Scofield, version 2.1 (2023-01-18), `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Scofield.zip`, 487,890 bytes, SHA-256 `a3dda2e08db778c6aa5e47805bba236f744cb1c521dd2a94ba6ea02b241cfe77`. Mirror.
- **License words:** `scofield.conf`: "DistributionLicense=Public Domain", "TextSource=https://en.wikisource.org/wiki/Scofield_Reference_Bible_Notes". Wikisource: "This work was published before January 1, 1931, and is in the public domain worldwide", its text under the "Creative Commons Attribution-ShareAlike License", and "The source document of this text is not known." The check pass says attribution and share-alike apply to the stored notes (question 9).
- **Coverage:** 3,207 verse notes and 7 short introductions (the other 1,014 module slots are empty chapter markers); 66 books.
- **Size:** 0.8 MB.
- **Accuracy:** against the 1917 Library of Congress scan: Genesis 1:2 reads "imitations" for "intimations" and drops an "a"; Genesis 1:1 note 2 is missing; Genesis 9:1 and Revelation 1:20 match, except that references are rewritten as "(See Scofield "Genesis 8:21")".
- **Word for word, the founder should know:** Genesis 9:1, note 5: "A prophetic declaration is made that from Ham will descend an inferior and servile posterity", a racial reading. Genesis 11:1: "a man-made unity, the papacy ... Protestantism, with its innumerable sects". Revelation 1:20 and 2:1: "Thyatira is the Papacy ... Romanism weds Christian doctrine to pagan ceremonies". Names Meyer 3 times and Thayer once (both on the avoid list).
- **Build notes:** turn "(See Scofield "Genesis 8:21")" back into a plain verse link; restore Genesis 1:1 note 2 and "intimations" from the scan only if the founder agrees to small corrections named in NOTICE.md. Needs a cite entry.

### 2.10 McGarvey and Pendleton, The Fourfold Gospel (with McGarvey on Acts)

- **Source:** CrossWire TFG 1.5, `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/TFG.zip`, 1,031,301 bytes, SHA-256 `c4f95f62d37c005dc233fef8cd998222641b84a399d828b612f4beccc838adec`. Mirror.
- **License words:** `tfg.conf`: "DistributionLicense=Public Domain". No TextSource; the About dates the Acts commentary "(1863, 1882)", so the edition behind it is unstated.
- **Coverage and size:** Matthew 868, Mark 577, Luke 1,002, John 771 and Acts 1,003 entries, 8 in 1 Corinthians; about 2.5 MB of text.
- **Accuracy:** 94 to 95 of 100 words at Matthew 16:18 and John 3:5 against the 1914 scan.
- **Founder should know:** McGarvey (1829-1911) wrote for years against the higher criticism. The notes teach baptism for the remission of sins (Restoration Movement). They quote the Cambridge Bible at John 3:5 and name Meyer in 11 entries, both on the avoid list. Needs a cite entry. RawCom format with GBF markup (its own small reader).

### 2.11 B. W. Johnson, The People's New Testament

- **Source:** CrossWire PNT 1.1, `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/PNT.zip`, 871,345 bytes, SHA-256 `880a29670938148c3b5f1715cc78ef534104414baeeea2db5c5c2acc6fb1ed6c`. Mirror.
- **License words:** `pnt.conf`: "DistributionLicense=Public Domain". No TextSource; the module dates from 2001.
- **Coverage and size:** 26 books, 6,085 verse slots (Philemon is missing, though the research said 27); about 2.0 MB.
- **Accuracy:** Acts 2:38 94 of 100 words; John 3:5 and Matthew 16:18 match apart from two small slips.
- **Founder should know:** Disciples of Christ, Restoration view of baptism; names Meyer in 19 entries; "Pope" in 11 entries and "Papacy" in 6; one Abarbanel and one Maimonides. Needs a cite entry. Adds little where Wesley, Henry, Barnes and the Fourfold Gospel already speak.

## 3. Not writers' voices, but worth adding beside them

These are reference works, not interpreters, so they do not belong in the writers' panel.

| Work | Source and license | What it would add | Notes |
|---|---|---|---|
| Treasury of Scripture Knowledge (Bagster, about the 1830s), as curated by CrossReferences.org | github.com/CrossReferences-org/bible-cross-references at `d80dee38106c42982bb6c0834ceebb8a517e368a`, `tsv/crossreferences_bsb.tsv`, 5,180,420 bytes, SHA-256 `54f5a7faada7695b8584aa2e46d57bf8fb593fc6ee8762bc2295851fed6b11bf`. LICENSE: CC BY 4.0; README: "The cross-reference data in this repository is licensed under CC BY 4.0." | 63,663 phrase anchors on 29,056 verses, in the BSB's own words: the links the map already shows (98.3 percent of its pairs are already in OpenBible), grouped under the words of the verse they explain | Credit it as CrossReferences.org's curated set ("not a verbatim copy of TSK"), not as the Treasury itself. The repository is six months old and the pinned commit one day old. Never use the French S21 anchors ("Used with permission"). |
| R. A. Torrey, The New Topical Text Book (1897) | CrossWire Torrey 1.3 (mirror), 422,465 bytes, SHA-256 `9db6e3f1720f868cc9d68cf030db53d157f9726883f0afd49553d05ab4cb7c80`; `torrey.conf`: "DistributionLicense=Public Domain", About: "No copyright notice appears on the book, and it is a reprint of the original edition which is out of copyright." | 628 topics, about 21,700 reference groups, used like Nave's | Torrey edited The Fundamentals. Headings lightly edited ("Holy Spirit" for "Holy Ghost"). RawLD format. Needs a cite entry. |

## 4. Not now, and why

| Writer and work | Why not now | What would change it |
|---|---|---|
| John Gill, Exposition of the Old and New Testaments | Every electronic Gill is Larry Pierce's Online Bible text: "Modernised and adapted for the computer. Editor: Larry Pierce. All Rightes Reserved". HelloAO's public-domain mark is a third party relabelling it. Also the largest work (about 8.8 million words) and full of rabbis (Kimchi 3,088, Aben Ezra 2,630, Maimonides 517) and polemic (369 "papist/popery/popish", 127 places tying antichrist to Rome). | Written permission from Online Bible, or a new transcription from the 1809-11 London scans (they read at 98.5 to 99.5 percent even through OCR). Meanwhile Gill stays cite-only, and could take the Bible Hub link JFB leaves (question 12). |
| Geneva Bible notes (Let's Church `geneva.json`) | The check pass failed the license: CrossWire's `geneva.conf` (2001) has no DistributionLicense line, and the only public-domain words are Let's Church's own label. A modern editor's glosses are mixed in as if Geneva's (Genesis 35:4: "a cake of wax ... blessed by the Pope", in neither 1561 nor 1599), and may be that editor's own writing. Judges, Jonah, Philemon and Ezekiel 41 and 42 are missing; the Genesis Argument drops a clause. | A clean text from the CC0 TCP 1560/1561 editions after a repair pass (12,647 of its 26,525 margin notes have a gap). |
| A. T. Robertson, Word Pictures, vols 1-3 (1930) | Both checks failed. The module turned Robertson's transliterations into broken Greek ("κα" for "και" 652 times, 2 right). The conf says "Copyrighted; Free non-commercial distribution" for the module (vols 5 and 6 were renewed in 1960 and stay in copyright to 2027 and 2028), while its About says vols 1-4 are public domain. He quotes Vincent 74 times, Meyer 6, Thayer 6, accepts Q and follows the critical text. | Greek rebuilt from the scans, a mirror of Matthew to Acts only, and the founder's acceptance of the quoted names. |
| J. C. Ryle, Expository Thoughts on the Gospels | The only GitHub copy (BenjaminPoole's vault, Apache 2.0) is Grace Gems' modernised text: "Holy Ghost" 0 times against "Holy Spirit" 262, "Roman Catholic" 11 times where the 1857 volumes checked have none, each section's passage in NKJV, ESV or NET. The license test is met (Grace Gems: "virtually everything on our website is public domain"); the words are not Ryle's. | Align the vault text to the 1857 Carter scans (NOT_IN_COPYRIGHT) word by word, taking the scan's word where they differ. A good later project; Ryle should go on the cite list. |
| Calvin, Old Testament | Measured for this plan in the same `calvin.json`: Genesis, the Harmony of the Law (Exodus to Deuteronomy), Joshua, Isaiah 1-48, Jeremiah 1-51, Lamentations, Ezekiel 1-20 (where his lectures stop), Daniel and Hosea to Haggai look full (about 3.9 million words). But Psalms (166 entries, 127,000 words for the five printed volumes), Zechariah (14 entries) and Malachi (4) are cut to one short entry a chapter, as the Pastorals are, and Isaiah 49 to 66 is missing (the check pass saw this too). None of it has been checked against the scans. | A check pass like group 3's on the full books, then ship them without Psalms, Zechariah and Malachi (the Old Testament part is 22.9 MB as it stands, about 22 MB without those three). |
| Charles Simeon, Horae Homileticae | A good fit (evangelical Anglican), but there is no transcription: only archive.org OCR, with errors clustering in the Bible text. Outlines keyed to passages, not verses. | Merging two scans and proofreading; a cite entry. |
| Ellicott's Commentary for English Readers, Old and New Testaments | OCR only (2 to 8 percent wrong words; Bible Hub's clean text is "Used by Permission"). Several contributors fail the rule as stored word for word: Aglen's Psalms denies Davidic titles and his Jonah allows "the creation of fiction"; Sanday (Romans, Galatians) later would neither affirm nor deny the virgin birth; Plumptre, Plummer, Whitehouse and Farrar lean critical. | Not worth an OCR project. Separately, the `ellicott` cite entry needs `not_on` (question 10). |
| The Pulpit Commentary | The clean text is Biblesoft's copyrighted database; the free text is 135 MB of OCR. Deane's Ecclesiastes takes the same line as Delitzsch; Farrar and Tulloch introductions; unvetted homilists. | Not worth it now. |
| Bengel, Gnomon (Fausset edition) | No clean text; the OCR breaks the Greek and loses the Hebrew. Avoid the Lewis and Vincent translation (Vincent is on the avoid list). | A corrected transcription. |
| Henry Alford, The Greek Testament | Fails the rule: his Prolegomena reject verbal inspiration and find "at least two demonstrable historical inaccuracies" in Stephen's speech; he leans on Meyer (345 mentions in vol. 1) and De Wette. | Never. Add him to the avoid list (question 10). |
| E. W. Bullinger, The Companion Bible notes | No licensed transcription: the one GitHub copy (otseng/UniqueBible_Commentaries) has no license, sits among plainly copyrighted works, and turns every "a" and "=" into "." Distinctive teaching would appear word for word (the Church begins after Acts 28, soul sleep, the gospel in the stars, four men crucified). | A fresh OCR of a public-domain scan with hand correction. Stays cited as `bullinger-cb`. |
| Spurgeon's sermons by text | No copy that is both free and faithful: OpenChristianData is CC BY-NC and modernised ("you sons of Jacob" for "ye"); Spurgeon Gems and the Spurgeon Center reserve rights; CCEL asks permission. | A link-out list ("Spurgeon preached on this verse", sermon number, title, link) built from the public-domain volume indexes. |

## 5. Build plan

### 5.1 The pattern every new work follows

Each work is built the way henry-concise, wesley-notes and catena-aurea are:

1. **sources.json:** one entry with `id`, `title`, `provides`, `license`, `attribution`, `homepage`, `repo`, a 40-character `commit` and the exact `files`, plus a `note` on how its notes are placed. `atlas fetch` takes only those files and records their SHA-256 in `manifest.lock.json`; `atlas build` stops if any changes.
2. **A reader in the voices build** that checks the source's own license words and stops if they change, places each note by KJV verse numbers, never across a chapter, and counts what it placed and dropped for the build report.
3. **Small fix tables** in the code, each entry with its reason, like `HENRY_ENDS`: headings that name the wrong verses, pointer chapters, known slips.
4. **verify:** known cases for the work (5.6).
5. **NOTICE.md:** a row in the "Christian writers of the past" table and sentences in its paragraph naming every change made to the text.
6. **Sources shelf:** a card in `config/shelf.json`, group "writers", listing the dataset (the shelf's verify requires every dataset to be on a card).
7. **Panel:** a heading, a book line with the date, an "About this book" link to the card, and a row in "How these are chosen".
8. **Cite list:** the writer named in `config/layer-sources.json` `cite` (Scofield, McGarvey and B. W. Johnson are not there yet).

### 5.2 Shared changes (one change for both plans)

The other plan's section 6.2 lists these, and this track needs every one of them: a table of works instead of three constants (in the build, in `voices.json` and read by the web); an index that holds more than three works (one bitset per work); files per work (`extras/voices/<work>/<Book>.<k>.json`), fetched only for the writers a reader opens; long notes in their own files; an optional "where in the work" field; readers choosing which writers to show; one SWORD reader, one TEI reader and one mirror workflow; the avoid list kept off writers' notes; shelf cards first. This plan adds:

- **Who wrote which book.** JFB (Jamieson, Brown, Fausset), Keil and Delitzsch (Keil or Delitzsch by book), Henry (continuators from Romans) and Poole (others from Isaiah 59) change author by book. Put a by-book override in the works table, so the heading can read "Keil and Delitzsch" and the book line "This book by C. F. Keil".
- **Two Henrys.** If both Henry works are kept, show them under one heading with two book lines, or let the full commentary take the Concise's place at Deep (question 6).
- **License per work.** If the Wikisource-derived works (Keil and Delitzsch, Clarke, Scofield) are treated as CC BY-SA (question 9), their built files carry that license, which per-work files make possible; NOTICE.md's sentence "The files built from these ... are public domain" must then name the exceptions.
- **Links that become redundant.** When JFB and Keil and Delitzsch ship, their Bible Hub links in `links.ts` and the `biblehub` and `keil-delitzsch` shelf cards change.

### 5.3 The mirror workflow and the SWORD reader

**Mirror.** One workflow, `.github/workflows/mirror-sword-modules.yml`, built like `mirror-meaning-model.yml` (on branch `claude/ask-the-bible-u6macl`, which made `mirror/potion-base-8M` at `dced885`):

- For each module in its list (JFB, KD, Barnes, Clarke, Scofield, TFG, PNT, and Torrey if section 3 is wanted; the other plan adds Luther): download `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/<Name>.zip`, unzip it, and check every unpacked file's size and SHA-256 against the table written into the workflow (Appendix A, from the copies the research downloaded on 2026-10-20). CrossWire repacks some zips (JFB's on 2026-10-20), which changes the zip's hash but not the files inside, so the files are what is checked. Refuse any change.
- Commit the unpacked files unchanged, with a SOURCE.md that gives the URL, the date, the zip's hash as seen, each file's size and SHA-256, and the conf's DistributionLicense line, to its own branch (`mirror/sword-JFB`, `mirror/sword-KD`, and so on), keeping the branch's history so a pinned commit stays fetchable.
- sources.json then pins `https://github.com/Sixteen1-6/BibleAtlas` at that branch's commit and lists the conf, the module files and SOURCE.md.

**Reader.** About 60 lines of Rust in a new `sword.rs`:

- The conf's `ModDrv` decides the layout. zCom (Barnes, Clarke, Scofield, PNT): `.bzs` block index of 12-byte entries, `.bzv` verse index of 10-byte entries (block, offset, 2-byte size), `.bzz` zlib blocks; Barnes uses the `c` prefix (`nt.czs/czv/czz`, BlockType CHAPTER). zCom4 (JFB and KD, though JFB sits in a `zcom` folder): the same with 12-byte verse entries (4-byte size). RawCom (TFG): `nt.vss` of 6-byte entries into the plain `nt` file. RawLD (Torrey): `.idx` of 6-byte entries into `.dat`.
- Verse slots follow SWORD's KJV versification, with a slot for each book and chapter heading (the research's `zcom.py` shows the order). Entries the module links over several verses share one block offset: read the text once and place it over the run.
- zlib needs a library. The build has none today (only serde, serde_json and sha2). Add `flate2` with its pure-Rust backend; it is the usual choice and adds no system dependency. Every other reader stays dependency-free.
- Markup: OSIS (JFB, KD, Clarke, Scofield), ThML (Barnes, PNT) and GBF (TFG) reduced to paragraphs and verse links, the way the Let's Church readers already turn `{{ref:...}}` into links. The `ABBREVIATIONS` table gains the modules' forms ("Joh", "Mr", "Ro" are already partly there).

### 5.4 Work by work

| Work (id) | sources.json | License check: the build stops unless | Placement | Left out or fixed |
|---|---|---|---|---|
| JFB (`jfb`) | mirror `mirror/sword-JFB`: `jfb.conf`, 6 module files, SOURCE.md | conf says "DistributionLicense=Public Domain" and SOURCE.md's hashes match | each distinct entry over the verses that share it; "14-16." prefix checked against them | general introductions in Genesis 1:1; book introductions; 11 pointer chapters by table |
| Keil and Delitzsch (`keil-delitzsch`) | mirror `mirror/sword-KD`: `kd.conf`, 4 module files, SOURCE.md | as above | by the range label each entry opens with | 25 introduction entries over 40,000 characters; range labels; Ecclesiastes if `not_on` |
| Calvin NT (`calvin`) | Let's Church at the pinned commit, `calvin.json` | `work.license == "Public Domain"` (the existing `entries()`) | the verse the file gives, like Wesley | next passage's English and Latin verse text; translators' appendices in 5 entries; stray OSIS tags; Old Testament books; Pastoral stubs (question 11) |
| Spurgeon (`spurgeon-tod`) | lyteword at `64450e7`: the 171 psalm files and LICENSE (or a folder, if the other plan's folder fetching is built) | LICENSE contains "CC0 1.0 Universal" | his verse headings under "## Exposition" | Explanatory Notes, Works upon the Psalm, Title and Division (unless wanted); headless verses by table |
| Henry complete (`henry-complete`) | Let's Church at the pinned commit, `mhc.json` | as for the Concise | the verse numbers printed in each section's KJV paragraph, checked against `verseEnd` | the KJV paragraphs; prefaces; chapter-0 stubs; verse-0 introductions |
| Barnes NT (`barnes`) | mirror `mirror/sword-Barnes` | conf as above | the module's verse; linked verses as a run | "Verse 16." labels |
| Poole (`poole`) | TCP A55363 at `41a5d66`, A55368 at `eadd8a9` (two sources, one work) | `<availability>` says "Creative Commons 0 1.0 Universal" | the `<p n>` verse each bottom note sits in, within its chapter division | margin notes; Leviticus 10:12 to 11:24 marked missing; the off-by-one divisions there by table |
| Clarke (`clarke`) | mirror `mirror/sword-Clarke` | conf as above | the module's verse | chapter summaries and introductions (as Henry's) |
| Scofield (`scofield-1917`) | mirror `mirror/sword-Scofield` | conf as above | the module's verse | empty chapter slots; "(See Scofield ...)" made a plain link |
| Fourfold Gospel (`fourfold-gospel`) | mirror `mirror/sword-TFG` | conf as above | the module's verse | GBF codes |
| People's NT (`peoples-nt`) | mirror `mirror/sword-PNT` | conf as above | the module's verse | none known |

Slips in the texts (Henry's "one our children", Clarke's "Bablylonish", Spurgeon's "will mot repent", Scofield's "imitations") are either left as the copy has them, or corrected against the printed edition in a committed table and named in NOTICE.md, as the Catena's "Clement of Alexendria" is. The plan suggests correcting only slips proved by a scan.

### 5.5 NOTICE.md, the cite list and the shelf

- **NOTICE.md:** the "Christian writers of the past" row grows by one source per work, and the paragraph names each change: JFB's introductions left out and its pointer chapters; Keil and Delitzsch's introductions and range labels; Calvin's trailing verse text, appendices and the books left out; Spurgeon's sections left out; Henry's KJV paragraphs, prefaces and the continuators; Barnes's unnamed edition; Poole's gaps, spelling and the TCP credit its header asks for; Clarke's and Scofield's Wikisource chain. The Wikisource works carry CC BY-SA attribution if the founder chooses that (question 9).
- **Cite list** (`config/layer-sources.json`): add `scofield`, `mcgarvey`, `johnson-pnt` (and later `ryle`, `simeon`, `torrey`); add `not_on: ["Ecclesiastes"]` to `keil-delitzsch` and `pulpit` if the founder decides so; add `not_on` to `ellicott` for Aglen's Psalms, Song of Solomon, Obadiah and Jonah at least; add Alford to `avoid` (question 10).
- **Shelf:** cards for each new dataset in group "writers"; the existing `keil-delitzsch` card gets its dataset and loses "The app links to it on Bible Hub"; one card can list several datasets (Poole's two volumes).

### 5.6 verify

Generalise the shared checks (any number of works, each work's bits against its own notes, names only for works whose voices carry names, the index and per-file limits), then add known cases:

- **JFB:** its note on Genesis 1:1 is there without "GENERAL INTRODUCTION"; John 3:16 lies inside its "14-16" note; Matthew 24 has the pointer to Mark 13 (or no JFB note).
- **Keil and Delitzsch:** Genesis 3:15 has a note; the "Psa 22:16-18" note covers Psalm 22:16-18 and no shown text starts with a range label; no KD note is longer than 40,000 characters; no Ecclesiastes note if `not_on` is chosen; no shown text contains the old font code ("„Y").
- **Calvin:** John 3:16's note is there; Romans 3:28's note does not end with the text of 3:29; Hebrews 13:24's note does not name Doddridge or Macknight; no note contains "<div"; no Calvin note in 1 Timothy, 2 Timothy, Titus or the Old Testament unless chosen.
- **Spurgeon:** Psalm 23:1 has his Exposition; Psalm 119:105's note is on 119:105; Psalm 84:1 has a note; no Spurgeon note names Kimchi, Ewald or Hupfeld (so the Explanatory Notes stayed out).
- **Henry complete:** the note on Genesis 1:3-5 does not contain "And God said, Let there be light: and there was light. 4"; Romans 1 shows the "completed by" label.
- **Barnes:** John 3:16 has a note; no note starts "Verse"; no Barnes note in the Old Testament.
- **Poole:** John 3:16 has a note; no Poole note in Leviticus 10:12 to 11:24; no shown text contains "<gap".
- **Clarke, Scofield, TFG, PNT:** Clarke on Genesis 3:1; Scofield on Genesis 1:2 with no "(See Scofield"; the Fourfold Gospel on Matthew 16:18; Johnson on Acts 2:38.

### 5.7 Page weight

Measured text after the cuts in section 2, and its gzip size at the ratio measured for each work (0.34 to 0.375; GitHub Pages sends JSON compressed). Files at the 500,000-byte split, at least one per book.

| Round | Work | Text | Compressed | About how many files |
|---|---|---|---|---|
| today | Catena, Henry Concise, Wesley | 14.6 MB | 5.2 MB | 81 shared files |
| 1 | JFB | 10.4 MB | 3.9 MB | 75 |
| 1 | Keil and Delitzsch | 23.1 MB | 8.5 MB | 75 |
| 1 | Calvin NT | 11.7 MB | 4.0 MB | 40 |
| 1 | Spurgeon, Exposition | 3.9 MB | 1.4 MB | 8 |
| 2 | Henry complete | 33.7 MB | 11.8 MB | 120 |
| 2 | Barnes NT | 14.9 MB | 5.1 MB | 45 |
| 3 | Poole | 17.1 MB | 6.0 MB | 90 |
| 3 | Clarke | 20.1 MB | 7.4 MB | 95 |
| 3 | Scofield 1917 | 0.8 MB | 0.3 MB | 66 |
| 3 | Fourfold Gospel | 2.5 MB | 0.9 MB | 8 |
| 3 | People's NT | 2.0 MB | 0.7 MB | 26 |
| | **Shortlist in all** | **140 MB** | **about 50 MB** | **about 650** |

- **Round by round:** round 1 adds 49 MB (17.8 MB compressed), round 2 another 49 MB (16.9), round 3 another 43 MB (15.3).
- **The site:** `web/public/data` is 121 MB today. The whole shortlist takes it to about 260 MB, and the other plan's rounds (about 15 MB, then about 17 MB for the Puritans) to about 295 MB. GitHub Pages allows a published site of up to 1 GB. The data is built in the Pages workflow, not committed, so the repository does not grow, but the build gets slower (Henry complete alone is a 41 MB file to parse) and the fetch gets seven mirror checkouts and two TCP checkouts more.
- **One reader, one verse:** with today's design (every work in one part file) a part file would reach several megabytes, past verify's 1,500,000-byte limit, so per-work files are not optional. With them, opening one writer costs at most one file of up to 500 KB, about 175 KB over the wire, saved by the service worker after the first time. A verse such as John 3:16 could have twelve writers; fetching them all at once would be about 2 MB over the wire, which is why the panel should list the writers first and fetch each one only when it is shown or opened (question 14).
- **The index:** one bitset per work is 5,184 characters. Three works today, eleven here and fourteen in the other plan make 28, about 145 KB, under verify's 200,000 bytes; bitsets of whole-Bible works are almost all one character and compress to very little. It loads with the reader's first move at Deep, as now.

### 5.8 Order of work

1. **Shared build changes** with the other plan (5.2 and its 6.2), and the mirror workflow and SWORD reader (5.3), each as its own PR.
2. **Round 1:** Calvin NT first (no mirror; it exercises the works table and per-work files on a known source), then JFB, Keil and Delitzsch, and Spurgeon once question 5 is answered.
3. **Round 2:** Henry complete (after question 6), Barnes NT.
4. **Round 3:** Poole with the TEI reader the other plan builds for the Puritans; Clarke (after question 4); Scofield (after questions 2 and 10); then the Fourfold Gospel and the People's New Testament.
5. **Beside the voices:** the Treasury of Scripture Knowledge phrase grouping and Torrey's topical index, if wanted (question 15).

Each PR in the repo's Before / After / How / Checks form, with the build report's counts and the new verify lines in the Checks.

## 6. C. S. Lewis

### Can he be stored?

No, not his Christian writing, and not for decades.

- **The US rule.** A book first published from 1931 to 1977 is protected in the US for 95 years from publication, to the end of that year. Lewis's books were first published in Britain, and where a US copyright had lapsed for want of renewal it was restored on 1 January 1996 (the Uruguay Round Agreements Act), because the books were still protected in Britain. So every Lewis book from 1931 on is protected for 95 years whether or not it was renewed. Lewis died on 22 November 1963, so in Britain his books are protected to the end of 2033.
- **When his books become free in the US** (1 January of the year shown): The Pilgrim's Regress (1933) 2029; The Problem of Pain (1940) 2036; The Screwtape Letters (1942) 2038; the broadcast talks, Broadcast Talks (1942), Christian Behaviour (1943) and Beyond Personality (1944), 2038 to 2040, and Mere Christianity, the revised 1952 text, 2048; Miracles (1947) 2043; Reflections on the Psalms (1958) 2054, the first that would suit Deep; The Four Loves (1960) 2056; Letters to Malcolm (1964) 2060; "Modern Theology and Biblical Criticism" (read in 1959, first printed in Christian Reflections, 1967) 2063.
- **Canada is different, and does not help.** Canada's term was life plus 50 when Lewis's books came free there in 2014, and its 2022 extension did not bring them back, which is why Canadian sites such as Faded Page offer them. GitHub Pages serves from the US, so copying them would break US law.
- **What is public domain in the US:** two books of poems, both under his pen name Clive Hamilton and both on GitHub: Spirits in Bondage (1919), github.com/GITenberg/Spirits-in-Bondage--A-Cycle-of-Lyrics_2003 at `3f6598f68f7e5b4f4956ca5addcd3071dd7fd5e5`, and Dymer (1926), github.com/GITenberg/Dymer_70106 at `098953adff822983b369f987a42360415e2c15c8`. Both `metadata.yaml` files say "rights: Public domain in the USA." Both were written before he became a Christian (Spirits in Bondage takes a dark view of God), and neither comments on Bible verses. They fail the founder's rule as content and have no place in the panel.

### Before he is cited at all

Lewis is on neither list. The founder should weigh his view of Scripture first. In a letter to Clyde Kilby of 7 May 1959 he wrote that any view of the Bible's authority must allow that some of its narratives are not history (the parables), that this may extend to Jonah and Job, and that inspiration is not uniform in mode or degree. In Reflections on the Psalms (chapter 11, "Scripture") he accepts that the creation account in Genesis may draw on older pagan stories. On the other side, "Modern Theology and Biblical Criticism" is one of the sharpest defences of the Gospels as history against the critics of his day. (Checked this run: the Kilby letter's content, through a transcription and catalogue records; the Reflections passage only through a secondary source.)

### What else could be done

1. **A shelf card**, as for other works the app cites but does not ship: who he was, the books, and where to find them, with no text. With `onlyWhenCited` it shows only once the app cites him.
2. **A facts-only list of where he writes on a passage:** verse, book, chapter title and page in a named edition, with a link to find the book. Where an author discusses a verse is a fact, not his words, so it can be stored. It must be made by reading the books (bought or borrowed), not copied from another site's index. Reflections on the Psalms covers dozens of psalms by name; Miracles and Mere Christianity touch a handful of New Testament passages. Perhaps 100 to 200 verses in all. It could show at Deep as "C. S. Lewis wrote on this psalm: Reflections on the Psalms, chapter 6".
3. **Layers notes could point to him** with a one-line citation and no quotation, if the founder adds him to the cite list after weighing the points above. Short quotation can be fair use in law, but the app so far shows only text it can store, so pointers are safer.
4. **Ask permission.** The Lewis estate licenses his words through his publishers; a free app could ask for a small set of excerpts, but a fee or a refusal is likely.
5. **Wait.** On 1 January 2029 The Pilgrim's Regress comes free in the US; it is an allegory, not comment on verses. The first book of real use at Deep, Reflections on the Psalms, comes free on 1 January 2054.

## 7. Questions the founder must answer

1. **Round 1.** May Jamieson, Fausset and Brown, Keil and Delitzsch, Calvin on 21 New Testament books and Spurgeon's own Exposition be added first, in that order, with Henry's full commentary and Barnes next, and Poole, Clarke and Scofield after?
2. **Hard words of their day** (same as question 1 of the Luther and fathers plan; answer once). Every writer here calls Catholics "Papists" or "Romish" and some speak harshly of the Jews. Henry, Barnes and Clarke use "savage", "barbarian" and "negro". Scofield's Genesis 9:1 note says "from Ham will descend an inferior and servile posterity". Show them word for word with a short line that these writers wrote in the language and quarrels of their time; leave out such notes with a visible mark that a note was left out; or leave out a writer (Scofield) altogether?
3. **Ecclesiastes.** Delitzsch (in Keil and Delitzsch) writes that Solomon did not write it; the Pulpit Commentary's Deane says the same and is cited today. Show their Ecclesiastes, or add `not_on: Ecclesiastes` to both cite entries and leave it out of the voices?
4. **Adam Clarke.** At Luke 1:35 he calls the eternal Sonship of Christ "anti-scriptural, and highly dangerous" (he affirms Christ's full deity, but the Nicene Creed says "begotten of the Father before all worlds"), and at Genesis 3:1 he makes the tempter an ape. Show Clarke whole, show him without those two notes with a mark, or leave him out?
5. **Spurgeon's text.** The only verse-keyed Treasury of David on GitHub (lyteword, CC0) is the Spurgeon Archive's transcription, whose pages say "All rights reserved". A straight transcription of an 1869-85 book most likely carries no new copyright. Accept it on that ground (and, if so, should the same reasoning reopen Gill? Gill's text differs, being a modernised edition its editor reserves), or wait for Project Gutenberg's proofread volumes (two of seven out) and mirror them as they appear?
6. **Two Henrys.** Show Henry's full commentary in place of the Concise at Deep, show both, or keep only the Concise?
7. **Rabbis and critics named inside old writers** (same as question 10 of the other plan). Keil and Delitzsch name Kimchi, Rashi, Ewald and Hitzig hundreds of times, mostly to answer them; Clarke names rabbis 198 times; JFB names Meyer 53 times. Confirm the avoid list governs what the app itself cites, not old writers' own words.
8. **Mirror branches** (as question 13 of the other plan). May the build mirror the CrossWire modules JFB, KD, Barnes, Clarke, Scofield, TFG and PNT to branches, and add one compression library (flate2) to the Rust build to read them?
9. **Wikisource.** Keil and Delitzsch, Clarke and Scofield all reached CrossWire through Wikisource pages tagged public domain (Scofield's page also puts its text under CC BY-SA). Treat all three as public domain, as CrossWire and the {{PD-old}} tags say, or mark their built files CC BY-SA 4.0 with credit to Wikisource, as the dictionaries' files are?
10. **Cite and avoid lists.** Add Scofield, McGarvey and B. W. Johnson to the cite list now, and Ryle and Simeon later; add `not_on` to Ellicott for Aglen's Psalms, Song of Solomon, Obadiah and Jonah (and perhaps Farrar's Judges and Whitehouse's Hosea and Amos); and add Alford to the avoid list?
11. **Calvin's gaps.** His 1 and 2 Timothy and Titus survive in this copy only as the comment on verse 1 of each chapter. Leave the three books out, or show each piece only on its verse 1? And may his Old Testament books that are complete follow after a check against the scans, leaving out Psalms, Zechariah, Malachi and Isaiah 49 to 66?
12. **John Gill.** Write to Online Bible (Larry Pierce) for permission, fund a fresh transcription from the 1809-11 scans, or keep Gill cite-only and link him on Bible Hub in the place of the JFB link once JFB is stored?
13. **Bible Hub links.** When JFB and Keil and Delitzsch are stored, drop their Bible Hub links, keep them for whole-chapter reading, or replace them with writers the app cannot store (Gill)?
14. **Too many writers** (same as question 12 of the other plan). With both plans, a verse like John 3:16 could have a dozen writers. Show them all, or let readers choose, and which writers are on before they choose? Fetching every writer at once costs about 2 MB on such a verse; fetching each when opened costs about 175 KB.
15. **Beside the voices.** Add the Treasury of Scripture Knowledge's phrase grouping of the cross references (CC BY 4.0, credited to CrossReferences.org) and Torrey's New Topical Text Book as a second topical index beside Nave's?
16. **C. S. Lewis.** Add a shelf card and a facts-only list of where he writes on a passage? And, given his 1959 letter on Jonah and Job, may he be cited at all?

## Appendix A. Files inside the CrossWire modules

SHA-256 of the files unpacked from the zips the research downloaded on 2026-10-20 (zip hashes in section 2). The mirror workflow should check these, not the zip's hash.

| Module | File | Bytes | SHA-256 |
|---|---|---|---|
| JFB | mods.d/jfb.conf | 2174 | aa2fc05a101dd622e7313b9c1b5dbabefcfcf1264ce82576d19c1c0e8b349bd4 |
| JFB | modules/comments/zcom/jfb/nt.bzs | 336 | 4aa673c91e5d50c1a762e435914bfdfa9760ba01c90601da2b37639cf6b86db4 |
| JFB | modules/comments/zcom/jfb/nt.bzv | 98952 | 695ca0063f406aa8a5542628a2f9ce0685ba0282d759b86f04656f19790c959a |
| JFB | modules/comments/zcom/jfb/nt.bzz | 2441962 | 40594e36e8efbde9507785f2b049ee55d6cefcfddc13cdd91b45ad6e69145920 |
| JFB | modules/comments/zcom/jfb/ot.bzs | 480 | 0cb741bf07cf710e7ad5cabe90517aaf43ccdf3a92bab527e8925441fb52b00e |
| JFB | modules/comments/zcom/jfb/ot.bzv | 289380 | 9ca7806638bb062095fd49046c48e8b72a74c6fc645498b17d33d87d31f91556 |
| JFB | modules/comments/zcom/jfb/ot.bzz | 3191787 | 58b063ebf038328915f99aeaf92b123d19ae22ba5ca5163c4c7a534cf60f384a |
| KD | mods.d/kd.conf | 5032 | 667cbe39b3d2f9b75a35429bee6ef6d3f7c4b453d5a9b097fe97996d68f8b39b |
| KD | modules/comments/zcom4/kd/nt.bzv | 98952 | 7cc2b428668b09df5d81782a789028113481a7ee96f1f4a9643f439c9efb2b78 |
| KD | modules/comments/zcom4/kd/ot.bzs | 576 | 95c55f5a0fdc3bbccdf267787561a3f2ea00652cc315ad3c14f2e9f456eb0385 |
| KD | modules/comments/zcom4/kd/ot.bzv | 289380 | 03c62880ef488dc9dfa329d807b1bf2ca09903ea3116ae23ed4cd77e5589b324 |
| KD | modules/comments/zcom4/kd/ot.bzz | 11145784 | 2adfc1ca3811ee1325e0513fb498d1bfdb95c66f3fc1ce8858fa805c92df03f5 |
| Barnes | mods.d/barnes.conf | 437 | 6895f7186042c5624117973892bc22dc27fa31a21e9f4fbb217793e8b5df9a5f |
| Barnes | modules/comments/zcom/barnes/nt.czs | 3120 | a39f80ec47d108a43fda634c1234fc03827f32eac1636d614c01b424dfcf6302 |
| Barnes | modules/comments/zcom/barnes/nt.czv | 82460 | edd2d46416db52595af44811a49940527bba208bd6b73b7c30f480c21d63edae |
| Barnes | modules/comments/zcom/barnes/nt.czz | 6018995 | d26ada7eba82d4c0c24c18ad8d8a520c1dfd5761e2bdc8161c6888bc665ea40a |
| Clarke | mods.d/clarke.conf | 3457 | 64fdb0aed5abf24c57263867612ab0168d19bbd2479e73a512b8984dd382750e |
| Clarke | modules/comments/zcom/clarke/nt.bzs | 336 | c63f303a8e57441938534373c8c669b2f31d5c34e30867ceb483f237bff93d6b |
| Clarke | modules/comments/zcom/clarke/nt.bzv | 82460 | 38c05f586fd9fcbd0c9a48f8cd1fb16d66cf3d3f75565a1540e2bd2ea34aa5eb |
| Clarke | modules/comments/zcom/clarke/nt.bzz | 3512777 | db07ce745636e481bd8f085fa150e8db5ee4512c031a251c870e23f3a7085bfe |
| Clarke | modules/comments/zcom/clarke/ot.bzs | 480 | fd19d0310f077312a1ab5f909d7b09b6423e1f285200c2ed29124340fe42fa09 |
| Clarke | modules/comments/zcom/clarke/ot.bzv | 241150 | 45bebbfe0a9c6e2cab310f069e8d5640b206bb11534fd4ed0643b7c5a8cf29da |
| Clarke | modules/comments/zcom/clarke/ot.bzz | 5036154 | b2b0c5a5d008bd99335e00c183a118e636a677c1b4401625fcc3d0d075be3bfc |
| Scofield | mods.d/scofield.conf | 2402 | 2b603a57ae51a9780f1c4d57d374c74333c925b0d0c5a294506d96f6b4e53eae |
| Scofield | modules/comments/zcom/scofield/nt.bzs | 336 | 05a1486371d07fdecfc0c8f9fc83f23df9199bee42604148e6a9d4404fde469b |
| Scofield | modules/comments/zcom/scofield/nt.bzv | 82460 | 5cd27a67d0880820a0d6566a0e6e8d065a6a4a24747a9265cf8e83d01e83f55f |
| Scofield | modules/comments/zcom/scofield/nt.bzz | 240334 | 9776ecb262e6ef7fe3f935504b7c2df4ad81507756642c46a27e752abab22915 |
| Scofield | modules/comments/zcom/scofield/ot.bzs | 480 | 647c76415ef79216ced50a9198d267c07a5114faa03506746a0e6e9029719839 |
| Scofield | modules/comments/zcom/scofield/ot.bzv | 241150 | fcf11866f8f866c9fc4bcb7bbe9c9077e8f5735fb0a7105170351581928c1cbf |
| Scofield | modules/comments/zcom/scofield/ot.bzz | 282714 | 0cf7c8fbe2a874bb6f39df8857d7f513cb9b09da121823843e78873b7e372cb2 |
| TFG | mods.d/tfg.conf | 770 | ab785e04a0dc35f40aebe7e312e25a2f0ee7f979bfb124b5d24fb8373fc72e7f |
| TFG | modules/comments/rawcom/tfg/nt | 2912509 | 35cf8a75472c8796111a3ee9e34a18ac67dcb9e80c5953fd337eea7e4b564cb1 |
| TFG | modules/comments/rawcom/tfg/nt.vss | 49476 | 4dbf3d66e2232f94ad356bb8002c9ed9b6c5f23fdc8af09f37a77a795092277d |
| PNT | mods.d/pnt.conf | 585 | 348eb60aa34d843ff374e50851c3c6baaf9d066da69b45f8ab412a302909c677 |
| PNT | modules/comments/zcom/pnt/nt.bzs | 312 | 622968f07b8182b486398df9118c4d64d86b6e6a58ac40a0997690f665b39750 |
| PNT | modules/comments/zcom/pnt/nt.bzv | 82460 | 4bf9903f194af9880814bf86059cf9adcf32dde574d47557e8279ee5e7c98436 |
| PNT | modules/comments/zcom/pnt/nt.bzz | 860326 | 214c9c8f6ec97a8500bf32dcac4e63e5e62e34db37aaa22820a81584eb761fd8 |
| Torrey | mods.d/torrey.conf | 1134 | 0615c4d12750ae4b155361fde7a3336984f551b1624896d5defe33b0a8c52def |
| Torrey | modules/lexdict/rawld/torrey/torrey.dat | 1710456 | 28655d77eae87460d2c65e11751ab1aa25484ebc9e106dc31b441eeff2c3a24c |
| Torrey | modules/lexdict/rawld/torrey/torrey.idx | 3768 | 6a06e206495ae886972a9e617bdabaca0b0e3c2fbc51a722cd57e08c34c5bace |

## Appendix B. How the sizes were measured

Plain text after the cuts each entry names: markup removed, `{{ref:...|label}}` kept as its label, repeated linked entries counted once. Henry complete: paragraphs that begin with a verse number and a capital (the printed KJV) dropped, 4.22 MB; entries over 40,000 characters (prefaces) listed separately. Keil and Delitzsch: entries over 40,000 characters (introductions) listed separately, 2.24 MB. Calvin: split into New and Old Testament by book code. Poole: the text of every `<note place="bottom">`, line-end hyphens joined and gaps written "[…]". Spurgeon: the research's extract of the Exposition. Scofield, the Fourfold Gospel and the People's New Testament: the research's own sizes. Compressed sizes use gzip at level 6 on each work's text, the same measure that gives today's files 0.353.
