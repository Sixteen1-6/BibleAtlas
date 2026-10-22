# Group 2: Old Testament and Psalms writers for Deep

Checked 2026-10-20. Scope: Keil and Delitzsch, Spurgeon (The Treasury of David), Charles Simeon (Horae Homileticae), Ellicott (Old Testament volumes), the Pulpit Commentary (all books but Jeremiah and Lamentations).

Everything below was fetched and read, not guessed. The BibleAtlas clone was only read (sources.json, config/layer-sources.json, crates/atlas-cli/src/extra_voices.rs, the mirror workflow on origin/claude/ask-the-bible-u6macl). Nothing there was changed.

Scratch files (all under `C:\Users\shubh\AppData\Local\Temp\claude\C--Users-shubh-Projects--claude\d3907c69-e0f0-457b-bec9-6a76569849b3\scratchpad\ba\voices\`):

- `g2\cw-kd\` CrossWire KD module (KD.zip and its conf), `g2\kd.jsonl` its verses dumped, `g2\kd-stats.txt` coverage per book
- `g2\cw-tdavid\` CrossWire TDavid module, `g2\tdavid.jsonl`
- `g2\tod-lyteword\` clone of github.com/lyteword/chspurgeon-tod at 64450e7
- `g2\pg\79723.txt` Project Gutenberg's proofread Treasury of David vol. 1 (used only to check accuracy)
- `g2\ia-kd\`, `g2\ia-tod\`, `g2\ia-ell\`, `g2\ia-pulpit\`, `g2\ia-simeon\` Internet Archive OCR of the printed books (for spot checks)
- `g2\web\` copies of the license and terms pages quoted below
- `g2-scripts\` the small readers and checkers used (sword_dump.py, stats.py, tod_cover.py, spotcheck.py, avoidhits.py and others)

## Summary

| Writer and work | Best open transcription | License as stated | Fit with the rule | Recommend |
|---|---|---|---|---|
| Keil and Delitzsch, Biblical Commentary on the Old Testament | CrossWire SWORD module KD (crosswire.org, needs a mirror branch) | "DistributionLicense=Public Domain" | Yes, with notes (Delitzsch's Ecclesiastes) | Yes |
| Spurgeon, The Treasury of David | github.com/lyteword/chspurgeon-tod (on GitHub, CC0) | CC0 1.0 Universal | Yes, Spurgeon's own Exposition only | Yes |
| Simeon, Horae Homileticae | None clean. Only Internet Archive OCR of the 1832-33 set | Item marked NOT_IN_COPYRIGHT | Yes (not yet on the cite list) | Not now |
| Ellicott, Old Testament Commentary for English Readers | None clean. Only Internet Archive OCR of the 1882-84 set | Item marked NOT_IN_COPYRIGHT | Mixed: Aglen's Psalms and Jonah fail | No |
| The Pulpit Commentary | None clean. Bible Hub's text is Biblesoft's copyrighted database; only Internet Archive OCR is free | IA items carry no rights field; Bible Hub text "Copyright ... BibleSoft" | Mostly yes in the Exposition; homilies and intros mixed | Not now |

The two to build now are Keil and Delitzsch and Spurgeon. For the other three, no openly licensed, accurate transcription exists that I could find. Every clean digital copy online (Bible Hub, StudyLight, BibleSupport e-Sword modules, CCEL, Logos, SwordSearcher) is either copyrighted as a database, "used by permission", or under terms that forbid redistribution. The only free text is raw OCR from archive.org scans, which runs 2 to 8 percent wrong words and would need a proofreading project.

## How a source would be pinned

The build reaches only github.com, and sources.json pins a commit plus a SHA-256 of each file.

- Spurgeon: lyteword/chspurgeon-tod is already on GitHub. Pin commit `64450e77762f3ca54c99a229fbb7879e70832a83` (2026-05-28; the repo has more than 100 commits, so it is a real history, not a one-off dump) and list the psalm files.
- Keil and Delitzsch: no GitHub copy of the SWORD module exists. I searched GitHub repositories and code (mjdenham/sword-modules, otseng/UniqueBible_Commentaries, OpenChristianData, andresmessina-SDG/scriptura-sword-mirror and others). A mirror branch is needed, made the way `.github/workflows/mirror-meaning-model.yml` makes `mirror/potion-base-8M`: download `https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/KD.zip` (11,170,353 bytes, Last-Modified 7 Aug 2022), check its SHA-256 `ca3bdb6a04c0b717ee2faed71b432d58195db96f217f490ce6f7d9c36a2876f7`, and commit it with a SOURCE.md to e.g. `mirror/sword-KD`. CrossWire publishes no hash, so the workflow should record the one it saw and refuse a changed file.
- The SWORD zCom4 format is simple (three files per testament: .bzs block index, .bzv verse index, .bzz zlib blocks). `g2-scripts\sword_dump.py` reads it in about 40 lines; the Rust build would need the same. A CC0 Rust reader exists (github.com/Logoxide/sword-modules), but it was created on 2026-10-18, two days ago, so I would not depend on it.
- If TDavid from CrossWire were ever wanted as a check, the same mirror works: `https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/TDavid.zip`, 4,956,285 bytes, SHA-256 `d0081cba094f399ceb95f372e13068a4d76814de4529bc6794eab0f2ed6e89cc`. It is not needed, because lyteword is on GitHub and better structured.

## Keil and Delitzsch, Biblical Commentary on the Old Testament

- Dates: German 1861-1875 (Keil 1807-1888, Delitzsch 1813-1890); English by T. and T. Clark, Clark's Foreign Theological Library, 1864-1878 (translators James Martin, Francis Bolton, M. G. Easton and others). Public domain in the US.
- Who wrote what: Keil wrote the Pentateuch, the historical books, Jeremiah, Lamentations, Ezekiel, Daniel and the Minor Prophets. Delitzsch wrote Job, Psalms, Proverbs, Song of Songs, Ecclesiastes and Isaiah.
- Rule: on the cite list as `keil-delitzsch`, nothing on the avoid list. The work defends Mosaic authorship (Genesis 1:1 entry: what modern criticism adduces "is founded either upon misunderstanding and misinterpretation"), Daniel in the exile (Keil), and Isaiah's authorship of chapters 40-66 (Isaiah 40:1 entry: "the following arguments may be adduced in support of Isaiah's authorship"). I checked that the module's Isaiah is the earlier James Martin translation, not the 1890 fourth edition in which Delitzsch gave ground on Isaiah 40-66 (Isaiah 7:14 matches the 1890 scan at only 42 percent, while the Pentateuch and Psalms match their scans at 90 to 98 percent).
- Best source: CrossWire SWORD module KD, version 2.0 (2022-08-03). Its conf says `DistributionLicense=Public Domain` and `TextSource=https://en.wikisource.org/wiki/Biblical_commentary_the_Old_Testament`; History_2.0 "New source (wikisource) with introductions, fix typos on titles, notes and missing text". It began as a BibleWorks user module by Willem Swanepoel. The Wikisource index page carries `{{PD-old}}` (and `{{no source}}`, so it is not scan-backed there).
- Other copies seen and not used: HelloAO's free API (keil-delitzsch, Public Domain Mark, taken from worthy.bible) is not on GitHub; OpenChristianData's GitHub copy is CC BY-NC 4.0, which fails the rule; sacred-texts.com blocks automated access and reserves commercial licensing of files it prepared; StudyLight and CCEL terms forbid republishing.
- Coverage: all 39 books, every chapter. 23,734 verse slots filled from 9,775 distinct entries (one entry is linked across the verses it covers, and starts with its range, for example "Gen 22:1-4" or "Psa 22:16-18 (Hebrew_Bible_22:17-19)"). About 4.4 million words, 24.7 million characters of plain text. Book introductions sit inside the first verse's entry: 25 entries run over 40,000 characters (Psalms 1:1 holds 190,000, Isaiah 1:1 155,000, which also carries the general introduction to the prophets). These need splitting off, as Henry's introductions are left out today.
- Format: OSIS markup, UTF-8, KJV versification, keyed by verse. 71,106 scripture `<reference>` tags, 2,654 footnotes, a few tables. Hebrew and Greek are real Unicode (347,000 Hebrew and 83,000 Greek characters), except a few runs left in BibleWorks' old font code, mostly in the Isaiah 1:1 introduction (for example "„YJIYBINi" where נביאים should be).
- Size: KD.zip 11.2 MB; unpacked distinct entries 31 MB of OSIS.
- Accuracy (module against the T. and T. Clark scans on archive.org): Genesis 3:15, 96.8 percent of words matched; Genesis 22:1-4, 97.7 percent; Psalm 2:7-9, 92 percent; Psalm 22:16-18, 89.6 percent. Almost every difference is the module rewriting references ("Deu 14:2" for "Deut. xiv. 2"), Hebrew words, or OCR noise in the scan. I found no wrong English words in these passages.
- Concerns:
  - Delitzsch's Ecclesiastes says outright that the book "was not written by Solomon himself, but by a Jewish thinker of a much later age", and treats it as post-exilic. The founder should decide whether Ecclesiastes is shown (a `not_on: Ecclesiastes` like Pulpit's Jeremiah would do it).
  - Delitzsch dates Psalm 44 (and leans that way for 74) to the Maccabean age. Not a denial of Scripture, but a critical-leaning date.
  - Critics and rabbis are named constantly, mostly to answer them: Hitzig 2,027 times, Ewald 1,971, Knobel 595, Gesenius 326, Graf 256, Hupfeld 206; Kimchi 398, Rashi 227, Aben Ezra 88, Malbim 21, Maimonides 20. These names are on the Layers avoid list. The voices build does not run the avoid check today, but it must not be switched on for voices, or KD will never pass.
  - Some sharp lines, word for word: a quotation listing "carnal Jews, Gentile Romans, cruel Mohammedans, impious Papists"; Keil on Zechariah 12 that "Israel according to the flesh ... is rejected by God"; "Romish" 13 times.
- Recommend: yes.

## Spurgeon, The Treasury of David

- Dates: seven volumes, 1869-1885, first in The Sword and the Trowel; Spurgeon died 1892. Public domain in the US.
- Rule: on the cite list as `spurgeon`. Spurgeon's own words fit the rule well; on Psalm 110 he rebukes critics who "dare to fly in the face of the Lord Jesus himself".
- Best source: github.com/lyteword/chspurgeon-tod, commit `64450e77762f3ca54c99a229fbb7879e70832a83`. LICENSE file at the repo root is the full "Creative Commons Legal Code / CC0 1.0 Universal" text; GitHub reports the license as CC0-1.0. The README says it is "a complete Markdown version of Charles H. Spurgeon's classic work" but does not say where the text came from. It shares the same typing errors as the CrossWire module, whose conf gives `TextSource=http://archive.spurgeon.org/treasury/`, so both come from the Spurgeon Archive text.
- Why lyteword over CrossWire TDavid: TDavid (`DistributionLicense=Public Domain`, About ends "It is now in the public domain.") puts each whole psalm on verse 1, with no verse keys. lyteword has a heading for each verse.
- Coverage: all 150 psalms, 188 Markdown files. Spurgeon's own Exposition has a verse heading on 2,436 of 2,461 verses (99.0 percent). Real gaps checked against the printed volumes: Psalm 110:1 ("The LORD said unto my Lord", the Old Testament verse the New quotes most) and Psalm 71:1 are missing from both lyteword and CrossWire, though the 1878 and 1881 printings have them. Psalm 84:1 is present but has no heading. Others without a heading: 39:13, 59:15, 64:8, 66:14, 89:26, 106:22,24,27,38,41, 114:3, 118:19, 131:2, 132:8-10, 135:21, 141:4, 143:10-11, 145:18,20 (not each checked against print).
- Sections per psalm: Exposition (Spurgeon, 0.71 million words), Explanatory Notes and Quaint Sayings (quotations from hundreds of other writers, 1.35 million words), Hints to the Village Preacher (0.14 million words), Works upon the Psalm (book lists).
- Format: Hugo Markdown with front matter; one file per psalm, Psalm 119 split into 22 files of eight verses. Headings "### Verse 3", "### Verses 1 & 2", "### Verses 5-8"; Psalm 119 uses "## Exposition Verse 105". The verse text is a blockquote; HTML entities such as `&mdash;` appear in the text.
- Size: 12.5 MB of Markdown (repo 14.4 MB).
- Accuracy: against Project Gutenberg's proofread volume 1 (ebook 79723, released 2026-10-04): Psalm 2:7, 99.0 percent (one error, "council" for "counsel"); 8:3-4, 99.7 percent; 19:1, 100 percent; 22:16, 99.6 percent ("with" for "within"); 23:1, 100 percent. Against archive.org scans: 23:4, 99.4 percent; 90:2, 100 percent; 91:1, 98 percent (spacing only); 139:7, 99.2 percent; 150:6, 100 percent; 110:4, 94.4 percent, with two real errors in the digital text: "will mot repent" and "all]lope" for "all hope". Overall a careful but not proofread transcription.
- Concerns:
  - Store only Spurgeon's own Exposition (and perhaps the Hints). The Explanatory Notes quote other writers word for word, including critics and rabbis: Ewald 11 times, De Wette 9, Hupfeld 6, Kimchi 24, Aben Ezra 12, Rashi 1, Maimonides 1. (Hits on "Cheyne" and "Vincent" there are the Puritans Francis Cheynell and Nathanael Vincent, not the avoided writers.)
  - Spurgeon's anti-Catholic language would appear word for word: "Small courtesy is more than Romanists and Puseyists deserve for their fooleries"; "even the most solemn of Popish rites we must abhor"; "Papists, Ritualists, Arians, Sceptics" among the haters of the church. About 13 such words in the Exposition.
  - The missing Psalm 110:1 and 71:1 expositions could be supplied from the Gutenberg volumes as they appear (volumes 1 and 2 are out so far) or typed from the scans.
- Recommend: yes.

## Charles Simeon, Horae Homileticae

- Dates: 21 volumes, London, Holdsworth and Ball, 1832-33 (Simeon 1759-1836; an earlier 11-volume form 1819-20). Public domain in the US.
- Rule: an evangelical Anglican who held all Scripture inspired; fits. Not on the cite list or the avoid list, so it would need a cite entry. No avoid-list names in the Psalms volume checked.
- Best source: no openly licensed transcription found. Not on CrossWire, CCEL, Wikisource, Project Gutenberg or any GitHub dataset. StudyLight shows it with "These files are public domain. Text Courtesy of BibleSupport.com. Used by Permission.", but StudyLight's terms say "All materials contained on StudyLight.org are protected by copyright" and forbid "Copying or storing of any Content ... for reproduction, redistribution or publication to third parties for commercial purposes". Logos sells it. The one free text is archive.org OCR, e.g. `horaehomileticae05simeuoft` (University of Toronto), whose metadata says `possible-copyright-status: NOT_IN_COPYRIGHT` and "no visible notice of copyright; stated date is 1832." archive.org's rights page says its Terms of Use "require that users make use of the Internet Archive's Collections at their own risk and ensure that such use is non-infringing". All 21 volumes are on archive.org across the Toronto, Princeton and Google sets.
- Coverage: the whole Bible, 2,536 discourses (sermon outlines), each on a chosen text, not on every verse. The Old Testament is discourses 1-1277 in volumes 1-10 (Matthew starts at 1278).
- Format: plain OCR text, one column; each discourse starts with its number and text ("Ps. xxiii. 1-6"), so it can be keyed to passages. Footnote marks and running heads are mixed into the text.
- Size: OT volumes 1-10, 17.1 MB of OCR text (about 2.5 million words).
- Accuracy: no clean copy to compare against, so I compared two independent scans (Toronto 1832 and Princeton 1833) of volume 5: Psalm 1 discourse, 95.6 percent agreement; Psalm 23, 94.5 percent; Psalm 51, 97.6 percent. Errors cluster in the italic Bible text ("ivant" for "want", "loill" for "will", "hiiquity"). Usable only after merging the two scans and proofreading.
- Concerns: OCR only; a proofreading project before it could be shown word for word. BadBull22/bible on GitHub already parses this OCR into outlines, which shows it can be done, but its own notes report OCR fragments left over.
- Recommend: not now. Good fit; no clean text.

## Ellicott, An Old Testament Commentary for English Readers

- Dates: five volumes, London, Cassell, 1882-1884 (Ellicott 1819-1905; later reissued in the eight-volume Bible Commentary, 1905). Public domain in the US.
- Contributors (from the title pages): Genesis R. Payne Smith; Exodus George Rawlinson; Leviticus C. D. Ginsburg; Numbers C. J. Elliott; Deuteronomy and Joshua C. H. Waller; Judges F. W. Farrar; Ruth R. Sinker; 1 Samuel H. D. M. Spence; 2 Samuel F. Gardiner; Kings Alfred Barry; Chronicles C. J. Ball; Ezra and Nehemiah W. B. Pope; Esther R. Sinker (order of the volume 3 title page); Job Stanley Leathes; Psalms A. S. Aglen; Proverbs J. W. Nutt; Ecclesiastes G. Salmon; Song of Solomon A. S. Aglen; Isaiah, Jeremiah and Lamentations E. H. Plumptre; Ezekiel F. Gardiner; Daniel H. Deane; Hosea and Amos H. R. Reynolds and O. C. Whitehouse; Joel and Micah S. L. Warren; Obadiah and Jonah A. S. Aglen; Nahum to Haggai A. C. Jennings; Zechariah and Malachi W. H. Lowe.
- Rule: on the cite list as `ellicott` with no `not_on`. Reading the volumes shows that is too broad:
  - Aglen's Psalms denies the titles in places: on Psalm 23, "The mention of the house of Jehovah seems decisive against the Davidic authorship ... it must have been through the mind of some later writer"; Psalm 14 (titled "of David") is headed "The Hope of the Exiles"; he dates psalms to the exile and discusses Maccabean psalms. This is against the rule.
  - Aglen's Jonah leaves open that the book is "the creation of fiction" and "even if unhistorical" still true in lesson, against Jesus' own use of Jonah (Matthew 12:40).
  - Plumptre's Isaiah keeps one author "substantially", but grants the other view "so strong a prima facie case" and leans on "Mr. Cheyne". Farrar (Judges) later rejected endless punishment and wrote for the Expositor's Bible (on the avoid list). Whitehouse (Hosea, Amos) later became a higher critic; that introduction approves Wellhausen and Duhm on Hosea's marriage. C. J. Ball later wrote the Expositor's Bible Jeremiah.
  - The rest (Payne Smith, Rawlinson, Waller, Leathes, Deane, Gardiner, Lowe on Zechariah) read as believing.
- Best source: no openly licensed transcription. Bible Hub's text says "Text Courtesy of BibleSupport.com. Used by Permission."; StudyLight's says "These files are public domain. Text Courtesy of BibleSupport.com. Used by Permission." with the StudyLight terms above. SwordSearcher and Bible Analyzer sell modules. The free text is archive.org OCR of the Princeton Theological Seminary copies, `oldtestamentcomm01elli` to `oldtestamentcomm05elli`, each marked `possible-copyright-status: NOT_IN_COPYRIGHT`.
- Coverage: all 39 books in five volumes; about 3.0 million words of OCR.
- Format: two-column OCR text with verse notes like "(1) Shepherd.-"; would need parsing and cleanup.
- Size: 19.6 MB of OCR text for the five volumes.
- Accuracy (OCR against the BibleSupport text on Bible Hub, read only to measure): Genesis introduction, 97.0 percent ("iu" for "in", "jjopularity"); Psalm 23 introduction, 82.8 percent ("poctiy", "biinqiiet"); Isaiah 53:5, about 65 percent after alignment ("pimishnient", "rejjentant", "liijlit"). Volume 4 is poor.
- Recommend: no. No clean open text, and if one is ever made, leave out Aglen's books (Psalms, Song of Solomon, Obadiah, Jonah) and review Isaiah, Judges, Hosea and Amos first. The founder may also want `not_on` added to the `ellicott` cite entry for Psalms and Jonah at least, since Layers notes can cite it today.

## The Pulpit Commentary

- Dates: London, Kegan Paul, Trench and Co., 1880-1897 (US by Funk and Wagnalls; reissued 1909-1919). Editors H. D. M. Spence (1836-1917) and Joseph S. Exell (1849-1909). Public domain in the US.
- Expositors (Old Testament): Genesis Thomas Whitelaw; Exodus George Rawlinson; Leviticus F. Meyrick; Numbers R. Winterbotham; Deuteronomy W. L. Alexander; Joshua J. J. Lias; Judges Lord A. C. Hervey; Ruth James Morison; Samuel R. Payne Smith; 1 Kings Joseph Hammond; 2 Kings George Rawlinson; Chronicles P. C. Barker; Ezra to Job George Rawlinson; Psalms George Rawlinson; Proverbs W. J. Deane and S. T. Taylor-Taswell; Ecclesiastes W. J. Deane; Song R. A. Redford; Isaiah George Rawlinson; Jeremiah and Lamentations T. K. Cheyne (left out by the rule); Ezekiel E. H. Plumptre; Daniel J. E. H. Thomson; Minor Prophets W. J. Deane and others (from the archive.org catalogue record of the 23-volume reprint).
- Rule: on the cite list as `pulpit`, `not_on` Jeremiah and Lamentations. Findings:
  - Rawlinson's Isaiah answers the critics ("On certain modern theories as to the authorship"), though he cites Cheyne's 1880 Isaiah 182 times as a reference.
  - Deane's Ecclesiastes takes the same view as Delitzsch: "cleverly personated authorship ... The writer assumes the role of Solomon", Persian period. Same founder decision as for Keil and Delitzsch.
  - Each volume has, besides the Exposition, "Homiletics" and "Homilies by various authors". The homilists are many and unvetted; for example W. F. Adeney (Judges homilies) later wrote Expositor's Bible volumes and accepted higher criticism.
  - The Genesis volume opens with introductions by F. W. Farrar and Principal John Tulloch (a Broad Church liberal). Leave those out.
- Best source: no openly licensed transcription. Bible Hub's copy says "The Pulpit Commentary, Electronic Database. Copyright © 2001, 2003, 2005, 2006, 2010 by BibleSoft, inc., Used by permission". StudyLight's says "These files are public domain. Text Courtesy of BibleSupport.com. Used by Permission." with its restrictive terms. Logos, SwordSearcher and Bible Analyzer sell it. Free text is only archive.org OCR: University of Toronto (`pulpitcommentar01spen` Genesis, `pulpitcommentary08spen` Judges and Ruth, and others), Cornell (50 volumes, `cu31924...`), and 1913 reprints such as `pulpitcommentary0001edit` (Isaiah I) and `pulpitcommentary0000jose` (Ecclesiastes). Unlike Simeon and Ellicott, these items carry no `possible-copyright-status` field; only the 1880 Oxford/Google scans (`pulpitcommentar00unkngoog` etc.) are marked NOT_IN_COPYRIGHT.
- Coverage: all 66 books; the Cornell set is 50 volumes.
- Format: two-column OCR, "Ver. 1.-" headings in the Exposition, homilies after; running heads and footnotes mixed in.
- Size: about 135 MB of OCR text for the 50 Cornell volumes (each 1.3 to 3.9 MB); the Old Testament is most of it. Genesis alone is 540,000 words.
- Accuracy (OCR against Biblesoft's text on Bible Hub, read only to measure): Genesis 1:1, 91.8 percent ("la" for "is", "termimcs", "scripturea"); Genesis 1:26, 92.4 percent; Isaiah 7:14, 82.1 percent; Isaiah 9:6, 89.1 percent ("sioulders", "shail"); Ecclesiastes 12:13, 97.1 percent. Biblesoft's text itself is Americanized ("favor", "color") and has its own slips ("gerumlius" for "gerundius").
- Recommend: not now. If it is ever proofread, store the Exposition only, skip Jeremiah and Lamentations, skip the introductions and the homilies, and decide on Ecclesiastes.

## Things the founder should decide

1. Ecclesiastes: both Delitzsch (in Keil and Delitzsch) and Deane (Pulpit) say a later writer wrote in Solomon's person. Show these, or add `not_on: Ecclesiastes`?
2. Ellicott's cite entry: add `not_on` for Aglen's books (Psalms, Song of Solomon, Obadiah, Jonah), and perhaps Judges (Farrar) and Hosea and Amos (Whitehouse)?
3. Spurgeon: Exposition only, or Exposition and Hints? The Explanatory Notes should stay out, since they quote critics and rabbis.
4. The avoid-list check must stay off the voices text: Keil and Delitzsch name Kimchi, Rashi, Ewald and Hitzig thousands of times while answering them.
5. Simeon fits the rule but would need a cite entry and an OCR-cleaning project; Pulpit and Ellicott likewise if wanted later.
