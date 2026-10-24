# Old spelling and old meanings in the Puritan texts: what can be cited

Research for founder decision 7 ("cite something that translates it correctly where readers would get confused"), with decisions 3, 4 and 15 (credit the original source, cite exactly as it shows, no AI credit anywhere). 2026-10-20. Everything below was fetched and looked at; where something was not checked, it says so.

## The short answer

1. **EarlyPrint has exactly what we want, but its license fails the rule.** It holds all seven shortlisted texts (and Tyndale and Beza) with a standard modern spelling and a lemma on every word, in TEI XML, on Bitbucket (not GitHub). Its own About page says the whole corpus is under **Creative Commons Attribution-NonCommercial 3.0**, which is not on the allowed list, while each file's header repeats the TCP's CC0 statement. On 200 sampled changed words it was right 177 times, wrong 20, doubtful 3; filtered by the display rule below, 118 of the 119 words it would show were right. Use it only if EarlyPrint gives written permission.
2. **MorphAdorner's own spelling list is open and good enough with a strict rule.** MorphAdorner (Northwestern University, the program EarlyPrint used) publishes its early modern spelling table under an NCSA-style open license that names its "data files". Applied to the CC0 TCP text with the rule below, 190 of 200 shown words were right (9 wrong, 1 doubtful); with four more filters drawn from those errors, a fresh sample of 100 was 98 right and 2 wrong (both now on a never-gloss list). This is the recommended source for modern spellings.
3. **Old meanings come from Johnson (1755) and Webster (1828), quoted word for word.** Johnson's Dictionary has an open, carefully transcribed full text from Lexicons of Early Modern English (University of Toronto, CC BY 4.0); a spot check of "To prevent" against the 1755 page image matched word for word. Webster's 1828 is public domain and scanned on archive.org, but its only clean GitHub copies are an edited text of unclear origin; quote it from the original volumes. Webster 1828 fits the Bible-believing rule. Neither dictionary gives "humane" its old sense "human"; Webster's 1913 edition (public domain, on GitHub) does.
4. **How it shows:** the printed word always stays; the modern spelling sits beside it in small grey type the first time it appears in a note (later ones underlined, tap to see); an old meaning is a tap-to-read card quoting the dictionary's own words with its name, date and entry. Every source is named; nothing mentions AI.

## 1. EarlyPrint

**Where it lives.** The EarlyPrint GitHub organisation (github.com/earlyprint) has only three public repositories: `earlyprint.github.io` (the website), `epmetadata` (catalogue data) and `jupyterbook` (notebooks). The corpus itself is on Bitbucket: `bitbucket.org/eads004/eebotcp`, a parent repository with one git submodule per three-character prefix (`texts/A53` is `bitbucket.org/eads004/A53`). Its README gives the HTTPS clone route. Not on GitHub, so it would need a mirror branch.

| Text | Bitbucket repo and commit (master, 2026-10-20) | File | Bytes | SHA-256 |
|---|---|---|---|---|
| Bunyan, Holy City | eads004/A30 `322a37537341d3fd7068f799bec443cfb24c19ab` | A30152.xml | 5,263,293 | de84440ff77f600b17ca99da9e7e16f78cf8820710d72a7494cb387aaf010b49 |
| Manton, Psalm 119 | eads004/A51 `3643966913c16b5919f8619829fae03ab462dee6` | A51842.xml | 88,772,145 | 568331e456e8cc6483275c9c8dc0996fe1d00532844485ccba84760b6aa7a9cc |
| Owen, Hebrews 6 to 10 | eads004/A53 `4d77dc4653c35ed2ef85c832c6a40bad69a417e4` | A53678.xml | 46,963,478 | 0a300437ca69d45fe006f748ea6403ff11a9f03b4e1f078fa8421062c7155d77 |
| Owen, Psalm 130 | eads004/A53 (same) | A53721.xml | 13,464,282 | 0f030ba271d170210ca67c1411c5c15a4512a78b2282a35ddd92db0194b6ef24 |
| Sibbes, 2 Corinthians 1 | eads004/A60 `6e92586255b36ee5986e3eb6934ba7a55c065ac0` | A60194.xml | 28,386,770 | 58029688684fbf72077abd3ae86c74b50b160869ef96365a06ff67a09fb04282 |
| Manton, Jude | eads004/A89 `ae4356501c22fbe15235cd12f24efb812d2c9632` | A89503.xml | 18,753,548 | 29404e606f73dc08ab886e5d82baa70422735ebf47be5eac75936c1ba6a6211d |
| Watson, Beatitudes | eads004/A96 `34df8ad687363ffc5a45c84a0c227113d687ce44` | A96093.xml | 17,167,697 | 0538b4237472e104aa18576a1dedd7068ad48b1eeeebfabed56c8e3f7831f3c7 |

Also present (sizes only): Tyndale A14132 (918,338 bytes, eads004/A14 `85c322c6`), A68940 (18,475,104), A13203 (13,562,602), A16000 (697,004); Beza A10086 (9,158,573). Two files were downloaded again from Bitbucket at the commits above and matched the saved copies byte for byte. Manton's Psalm 119 file is 88.8 MB, close to GitHub's 100 MB file limit (a mirror would have to gzip it).

**Format.** TEI P5 XML (schema `tei_earlyprint.rng`). Every word is a `<w>` with `xml:id`, `lemma` and `pos` (NUPOS tags); a `reg` attribute is added only when the standard spelling differs from the printed one; punctuation is `<pc>`. Example from Owen on Psalm 130: `<w lemma="wait" pos="vvz" xml:id="A53721-005-b-0900">waiteth</w>`. Every word in the files checked has a lemma (0 missing in Bunyan's 65,613 and Owen's 166,891 words). The header states the policy: standard spellings "that preserves archaic forms ('loveth', 'seekest')", and it is true: of 16,738 -eth and -est verbs in the seven texts, 189 were changed. EarlyPrint also edits the printed words themselves in places (for example "vv" printed as "w"), keeping the TCP form in `orig` (539 words in the seven texts), so its text is not exactly the print; the app should keep using the TCP text.

**License, quoted from the source's own pages.**
- EarlyPrint's About page (live, and in github.com/earlyprint/earlyprint.github.io at `905a803fcf33313e26990280740138c6e2fc0058`, `about.md` lines 106 to 117): "All texts in the EarlyPrint Library corpus are covered by a Creative Commons Attribution-NonCommercial 3.0 Unported license." It adds that commercial licensing goes through Martin Mueller at Northwestern.
- Each file's own header keeps the TCP statement: "This Phase I text is available for reuse, according to the terms of Creative Commons 0 1.0 Universal." That statement is about the TCP keying; the standard spellings and lemmas are EarlyPrint's additions.
- The two statements conflict. Read on the cautious side, EarlyPrint's spellings are CC BY-NC 3.0, which is not public domain, CC0, CC BY or CC BY-SA.

**Accuracy on 200 sampled words.** A fixed random sample (seed 20261020) of 200 words EarlyPrint changed, 28 or 29 from each of the seven texts, leaving out changes of only a dot, a space or letter case, each judged by reading it in its sentence: **177 right, 20 wrong, 3 doubtful**. (Five of the "right" are words already modern that EarlyPrint gave a British form: plowed/ploughed, splendor/splendour, travelleth/traveleth, judgment/judgement, baptized/baptised. A reader would never be shown those.)

The 20 errors fall into four kinds:
- A real word swapped for another real word: "then" made "than" where the sense is "then" (5), "ought" to "aught", "loose" to "lose" ("let them loose"), "alters" to "altars" ("it soon alters"), "bent" to "bend" ("their wit is bent"), "Rom" to "Rome" (a reference to Romans), "Nebuchadnezzar" to "Nabuchadnezzar".
- An ending dropped: "yeelds" to "yield", "fighting" to "fight", "Crossings" to "Cross", "Dark-sayings" to "Dark-saying".
- Names, numbers, citations and Latin: "Iob 16. 19" to "job", section "II" to "TWO", Latin "Ardens" to "Arden's", "Aug Confes" (Augustine's Confessions) to "Confess".
- Hyphens: "self-confidence" to "selfconfidence", "Bear-sheba" to "Bearsheba".

Focused samples on the risky pairs (judged the same way): "then" to "than" 20 right, 20 wrong (EarlyPrint makes this change 1,895 times in 6,021 "then"); "loose" to "lose" 2 right, 12 wrong, 1 doubtful; "ought" to "aught" 3 right, 12 wrong; "least" to "lest" 6 right, 2 wrong; "doe" to "do", "dye" to "die", "lye" to "lie", "meer" to "mere", "vail" to "veil" all 8 of 8 right.

With the display rule below (essentially: never touch a word that is already a modern word, keep endings, skip names and numbers), 119 of the 200 would be shown and 118 were right (the one wrong: "Confes").

**Does it mark words it could not standardize?** No. A word without `reg` is either already standard or not recognised; nothing tells the two apart. The only signal is `pos="zz"` (unknown), which falls on 22,354 words, almost all of them damaged words with an illegible gap (23,481 words contain a gap mark). A sample of 100 words left unchanged and not in MorphAdorner's standard list: 97 were real words needing nothing, 1 a missed old spelling ("indispensibly", 24 times in three texts), 1 untagged Latin, 1 doubtful ("Philosophers-stone").

Size of the job: the seven texts hold 2,770,538 words; 63,840 carry a `reg` (2.3%), of which 48,132 change letters (the rest change only a dot, space, apostrophe or hyphen). Tyndale's Jonah (A14132) is a different world: 4,104 of 11,687 words (35%) are respelled.

## 2. MorphAdorner's own standardization

**What it is.** MorphAdorner is Northwestern University's Java program for tokenizing, standard spellings, parts of speech and lemmas; EarlyPrint's header says its texts were "linguistically annotated with MorphAdorner". The public release is version 2.0.1 (2013). It is separate from EarlyPrint and has its own license.

**License, quoted** (morphadorner.northwestern.edu/morphadorner/licenses/, read live): "The MorphAdorner client and server source code and data files fall under the following NCSA style license." The license grants use, copying, modification and distribution, asking only that the copyright notice and disclaimers be kept and that Northwestern's name not be used to endorse products. The third-party section names code libraries only, nothing about the spelling data. NCSA is an attribution-only open license of the MIT and BSD family; it is not one of the four Creative Commons names on the founder's list, but it asks less than CC BY (the project already pins an MIT-licensed model). This should be confirmed with the founder (question 2).

**Where it lives.**
- Official: `https://morphadorner.northwestern.edu/morphadorner/download/morphadorner-2.0.1.zip`, 87,853,764 bytes, Last-Modified 2023-10-21, SHA-256 `2d5f74c1d6b00252a2e13eb390f1d111cfb475518b53302495ad2819a3be2bb7`. Inside it, `data/ememergedspellingpairs.tab` (7,601,380 bytes, SHA-256 `0ef74f63d7185960a4fcf9cabfe50e03559f15f68bf1545bb798f72e6087878f`, 357,931 printed-form to standard-form pairs) and `data/standardspellings.txt` (1,693,239 bytes, SHA-256 `ea74fff7b4317fc73f8735afa9174abc2e81cc381ab26c6f9ecc16f46c9b5123`). The zip holds no license file; the license is the web page above.
- The source repository the download page names (bitbucket.org/eplib/morphadorner) no longer answers.
- A GitHub copy exists: `github.com/dbpiper/MorphAdorner` at `60d27679010fdd30b07ddd8efeb51d270715be8e`, a personal "Mirror of the official MorphAdorner repo" with the NCSA text as LICENSE.md. Its three spelling files are identical to the official zip's except for line endings (LF instead of CRLF): `ememergedspellingpairs.tab` SHA-256 `7cc4bc235a81c9c1f72aff8059ca329c7cad5e1a0da56fcaebe27b0d4f175cb6`. It is unofficial, so the project should mirror the official zip's data files to its own branch and use dbpiper only as a cross-check.

**Two ways to use it.**
1. *The spelling-pairs table, word by word* (measured here). It is context-free: one printed form, one standard form. On the same 200 words EarlyPrint changed, the table gave a reading for 157: 144 right, 9 wrong, 4 doubtful; it was silent on 43 (including all of EarlyPrint's "then"/"than" errors, but also the useful "presidents"/"precedents" and "Gods"/"God's"). Its own errors are context-free ones: "mans" to "men", "chast" to "chased", "dyes" to "die", "Prophesie" to "Prophesy" for the noun.
2. *Running the MorphAdorner pipeline* on the TCP texts, which uses part of speech to choose (this is what EarlyPrint did, plus its own corrections). It would give EarlyPrint-like readings from CC0 text with open software. **Not tested here**: the downloaded program was not run. It could run once in a GitHub Actions workflow that commits its output to a mirror branch; results would need the same 200-word check, since EarlyPrint may have used a later version and hand corrections.

**Accuracy of the recommended path (table plus rule, on the TCP text).** A script (`spelling-scripts/ma_rule_sample.py`) reads the TCP XML itself, joins words split at line ends, prints the long s as s, leaves out margin notes and gaps, looks every word up in the table and applies the rule in section 5. Then:
- Fixed random sample of 200 words the rule would show (seed 20261020): **190 right, 9 wrong, 1 doubtful.** Wrong: "Lud" (a nation, Isaiah 66:19) to "Lord"; "thorow" to "thorough" twice where it means "through"; "Viol" and "viol" (the instrument) to "violent"; "Plu" (part of a damaged word) to "Plum"; "Holy Councel" (God's counsel) to "Council"; "Syr." (Syriac) to "Sir"; "e're" (ere) to "ever". Doubtful: "Oeconomicks" to "Economics" (right spelling, but it means household management).
- With four more filters (no words of three letters or fewer, no reading that adds more than two letters, nothing next to a gap, no capitalised word before a full stop, and a never-gloss list: thorow, Councel, e're, viol), a **fresh sample of 100** (seed 777): **98 right, 2 wrong**: "faine" to "feign" where it is "fain" (gladly), and "hearken" to "Harken" (the table itself has that entry). Both words go on the never-gloss list.
- Volume: of 2,669,343 words, the refined rule glosses 28,571 occurrences (1.07%), made of 2,800 distinct printed-to-modern pairs; the top 300 pairs cover 73% of occurrences, the top 1,000 cover 91%. A person can read the whole list of 2,800 pairs before shipping, which catches word-level traps like "thorow" and "viol".

The samples, with every verdict and note, are in `research/spelling/sample-ma-rule-200.tsv` and `sample-ma-rule-refined-100.tsv`; EarlyPrint's in `sample-200-judged.tsv` and the focused `sample-*-judged.tsv` files.

## 3. Old meanings: the dictionaries

Spelling tables cannot help with words spelled the modern way whose meaning has moved. In these texts: "conversation" meant conduct in 12 of 12 sampled places; "humane" meant "human" in 8 of 8 ("the humane nature" of Christ); "prevent" meant "go before" in 2 of 12 (both echo Psalm 119:147-148) and "hinder" in 10. EarlyPrint and MorphAdorner leave all three untouched, as they should.

### Johnson, A Dictionary of the English Language (London, 1755)

- **Copy:** Lexicons of Early Modern English (LEME, University of Toronto), lexicon 1345, full plain text at `https://leme.library.utoronto.ca/plainText/lexicon1345.txt`: 20,452,954 bytes, Last-Modified 2024-06-07, SHA-256 `ae6e9f3aed73f0cecc92910e86de7efa75bdee5d15aed0015acbbb89aee8cc4c`. Not on GitHub: needs a mirror branch.
- **License, quoted** (leme.library.utoronto.ca/help/termsofuse/): "Content on this site is licensed under a Creative Commons Attribution 4.0 International license." It covers "All files provided on the LEME website ... and the XML encoded texts of lexical works", "for any purpose, even commercially", with credit to "Lexicons of Early Modern English, ed. Ian Lancashire (Toronto: University of Toronto Press, 2018)."
- **Faithful to the print:** "To PREVE'NT" was compared with the 1755 page image (archive.org `b30451541_0002`, Wellcome Library copy, Public Domain Mark, leaf n417): word for word, including the authorities ("Hooker, b. v. s. 12", "Psalm xxi. 3", "Common Prayer", "King Charles"), with only the long s printed as s and line-end hyphens kept as soft hyphens. Its sense 4 reads: "To hinder; to obviate; to obstruct. This is now almost the only sense." Sense 1: "To go before as a guide; to go before, making the way easy."
- **Lookup by word:** entries start on their own line ("To PREVE'NT. v. a.", "CONVERSA'TION. n. s."); a simple index finds 35,753 headwords. Tested: let (three entries, including "LET. n. s. ... Hindrance; obstacle"), prevent, conversation (sense 4 "Behaviour; manner of acting in common life", citing 1 Peter), presently ("At present; at this time; now"), carriage, communicate, quick ("Living; not dead", citing Psalm cxxiv), meat.
- **Fit with the rule:** Johnson was a devout Anglican; the text gives over 2,000 Scripture references in the "Gen. ... xlv." style alone, and leans on Hooker, South and the Book of Common Prayer. Nearest in date to the Puritans (1650s to 1680s).
- **Not usable:** Johnson's Dictionary Online (University of Central Florida) allows "solely ... non-commercial research purposes" and forbids systematic download (its copyright page, read from the Wayback Machine copy of 2026-08-15; the live site refused the request). Wikisource's transcription holds only 38 entries (A to "abbreviate"). Two small GitHub projects are scrapers of that site with no license.

### Webster, An American Dictionary of the English Language (New York, 1828)

- **Original volumes:** archive.org `americandictiona01websrich` and `americandictiona02websrich` (University of California Libraries copy), each marked NOT_IN_COPYRIGHT. OCR text files: vol. 1 9,661,847 bytes, SHA-1 `47c8397c9db39168694abecdf0544d61d16cc8c2`; vol. 2 8,931,352 bytes, SHA-1 `53777d9e774f5e33f8ca6e0f865aa4b5fed2a6ee` (archive.org lists these hashes, so a mirror can check them). The volumes are unpaginated (only 38 of 960 leaves in vol. 2 carry a page number), so an entry is cited the standard way for dictionaries: "vol. 2, s.v. Prevent", with a link to the leaf image.
- **OCR quality:** readable but noisy: the PREVENT entry has "jwecenfed" for "prevented", "ohsolHc" for "obsolete", "acc,es.s" for "access"; "LET" comes out as "LET, V. I." An indexer still finds 43,017 headwords (the dictionary has about 70,000). Each entry the app quotes must be corrected by hand against the page image, which is practical for a list of a few hundred old-meaning words.
- **GitHub copies, checked:**
  - `github.com/akaitsurugi/webster1828` at `b52403774b5b24d01377bbab29f642be226e9bb4`, `webster1828.csv` (16,731,155 bytes, blob `ea4d694aa58f2deb2f2bd2a84c8c9fda63e6ac69`): **CC BY-SA 4.0** (LICENSE file and its CrossWire SWORD conf), 62,391 entries, clean and easy to look up. But it is an edited text, not the print: in PREVENT the quoted authors (Common Prayer, Pope, King Charles, Atterbury) are dropped, "Ps. cxix." becomes "Psalms 119:148", and the etymology is cut to "[Latin proevenio, supra.]". Its wording matches webstersdictionary1828.com exactly, and that site's owner (MasonSoft Technology) states that no part "may be reproduced or stored in any other website ... without the editors' prior written permission". The repository does not say where its text came from. Decision 4 ("cite exactly how it shows") rules it out for display; it is still a handy finding aid.
  - `github.com/DataWar/1828-dictionary` (MIT): its SQL dump contains the website's own HTML ("Did you mean one of these words?"), so it is a scrape of that site. Do not use.
  - Others listed by GitHub search (man4christ, kayson-argyle, sktzofrenic and more) were not examined.
- **Fit with the founder's Bible-believing rule: yes.** The dictionary itself shows it: Webster closes his preface by thanking "that great and benevolent Being" and hoping his talent "has not been 'kept laid up in a napkin'" (the parable of the talents); 2,546 entries in the digital text cite 5,806 Bible verses (for example CONVERSATION's first sense, "General course of manners; behavior; deportment; especially as it respects morals", cites Philippians 1:27); and he published his own revision of the King James Bible in 1833 (archive.org `TheHolyBible_201607`, "Noah Webster's revision of the KJV, 1833"). Note that the project's avoid list already turned away the Online Etymology Dictionary as "not a Bible-believing source", so the rule does apply to English dictionaries.

### Gaps and other believing sources

- **"humane" for "human":** neither Johnson (HUMANE: "Kind; civil; benevolent; good-natured") nor Webster 1828 (HUMANE: "Having the feelings and dispositions proper to man ...") gives the old sense. **Webster's 1913 edition does:** "1. Pertaining to man; human. [Obs.]" It is public domain and already on GitHub: `github.com/GITenberg/Webster-s-Unabridged-Dictionary_29765` at `296ecf5d49b6b6f141a8efc015cb3a32d31feff3`, `29765-8.txt` (28,930,485 bytes, blob `fd911c69df563c670d2d68b7bc0ff26590b387bd`; its metadata: "Public domain in the USA."). It labels old senses "[Obs.]" and "[Archaic]" (LET "To retard; to hinder ... [Archaic]"; CONVERSATION "General course of conduct; behavior. [Archaic]"; PRESENTLY "At present ... [Obs.]"), which makes it a good machine check of which words have an old sense. Its editors' faith was not confirmed from the file (its front matter is not in the Gutenberg text).
- **Trench, A Select Glossary of English Words Used Formerly in Senses Different from Their Present** (7th edition, revised by A. L. Mayhew, 1890): Project Gutenberg 70210, proofread by Distributed Proofreaders, public domain in the US; `pg70210.txt` 597,974 bytes, SHA-256 `ce5e5cc84d5ccb6dc70905d7f0f515d1bc420114327e00be312046b7e6003f8f`. Richard Chenevix Trench was Anglican Archbishop of Dublin. 496 headwords, exactly the "false friends" (prevent, carriage, allow, ghost, mansion, occupy, room, careful, silly, wit, cunning and more), often illustrated from 17th-century divines such as Gurnall and Hammond. It lacks let, conversation and presently. Not on GitHub: needs a mirror.
- **Wright, The Bible Word-Book** (1884), a glossary of archaic words in the King James Bible and Prayer Book: archive.org `biblewordbookglo00wrig`, NOT_IN_COPYRIGHT, OCR only (its CONVERSATION article reads cleanly). Would need proofreading. Not pursued further.

## 4. What else was measured

- EarlyPrint's display-rule result and the MorphAdorner table's results above come from scripts kept in `research/spelling-scripts/` (`ep_tokens.py`, `ep_stats.py`, `sample_reg.py`, `sample_focus.py`, `rule_test.py`, `ma_table_vs_sample.py`, `ma_rule_sample.py`, `dict_lookup.py`).
- The "is this a modern word" test uses `github.com/hermitdave/FrequencyWords` at `525f9b560de45753a5ea01069454e72e9aa541c6`, `content/2018/en/en_50k.txt` (blob `bbf5fa991058ff642732784b31af023f66462e1d`), the 50,000 commonest words in modern English subtitles; its README: "CC-by-sa-4.0 for content". It is a filter the reader never sees, and it misses some rarer modern words (edify, buffeted), which only means a few correct readings go unshown. A public-domain alternative is Alan Beale's 12dicts lists (not examined).

## 5. Proposal: how the app shows it

**Text.** The TCP words exactly as printed (long s as s, words split at line ends joined, gaps marked), per the build spec. No word is ever replaced.

**Modern spelling, where it qualifies.** The first time a qualifying word appears in a note, its modern spelling follows it in small grey type in brackets: *perswasion* [persuasion]. Later appearances in the same note get a dotted underline; tapping shows the modern spelling. A reader setting can turn the grey readings off. The build already reserves the mark `{"k": "gloss", "t": "perswasion", "m": "persuasion", "by": "<source id>"}`, which older pages render as plain `t`.

**Old meaning, where it qualifies.** A small dotted underline in a second style; tapping opens a card quoting the dictionary's own words, then its name, date and entry, linking to the page image. For example: *conversation*: "General course of manners; behavior; deportment; especially as it respects morals." Noah Webster, An American Dictionary of the English Language (New York, 1828), vol. 1, s.v. Conversation. Proposed new mark: `{"k": "sense", "t": "conversation", "m": "<the dictionary's words, exactly>", "by": "webster-1828", "at": "vol. 1, s.v. Conversation"}`.

**Credit line under each note**, naming only what that note used, written for a first-time reader, with no AI wording (decision 15): "Modern spellings in grey are from MorphAdorner's list of standard spellings for early modern English (Northwestern University, 2013). Old meanings are quoted from Samuel Johnson's Dictionary of the English Language (London, 1755), in the transcription by Lexicons of Early Modern English (University of Toronto), and Noah Webster's American Dictionary of the English Language (New York, 1828)." Each source also gets a shelf card and a NOTICE.md paragraph.

**Where the decisions live.** `config/voices-spelling/<work>.json`, one entry per printed form, every entry with its source: `{"printed": "perswasion", "reading": "persuasion", "by": "morphadorner-2.0.1"}`; old meanings as `{"printed": "conversation", "sense": "<quoted words>", "by": "webster-1828", "at": "vol. 1, s.v. Conversation", "where": "all"}` or with `"where"` listing marked occurrences; a work-level `"never"` list. The build fills spelling entries from the table by the rule and fails if any entry lacks `by`.

**The rule for a modern spelling** (all must hold):
1. The source gives a reading for this exact printed form (MorphAdorner's table, or EarlyPrint's `reg` if permission comes).
2. The reading differs in letters, not only in case, a hyphen, a space, an apostrophe or a full stop.
3. The printed form is not itself a modern English word. This one test removes every "then"/"than", "loose"/"lose", "ought"/"aught", "alters"/"altars", "bent"/"bend", "Gods"/"God's" and British-American swap.
4. The reading is a modern English word.
5. The reading keeps the printed word's ending (-s, -ed or -t, -ing, -eth, -est) and adds none.
6. Old grammar that King James readers know stays unglossed: thou, thee, ye, hath, doth, saith, -eth and -est verbs.
7. Not a number, a reference ("Rom. 9. 10"), an abbreviation (a capitalised word before a full stop), a word of three letters or fewer, a reading that adds more than two letters, or a word touching an illegible gap.
8. Not on the never-gloss list: printed forms that stand for two different modern words (so far thorow, Councel, faine, e're, viol, hearken), grown by reading the full list of pairs before each work ships. Leaving a word unglossed is always safe; it is shown as printed.

**The rule for an old meaning** (all must hold):
1. A cited dictionary marks a sense as old or no longer used (Johnson: "now almost the only sense" against another; Webster 1828: "Obs.", "[Not in use.]", "In all the preceding senses, the word is obsolete"; Webster 1913: "[Obs.]" or "[Archaic]"), or the word is in Trench's Select Glossary.
2. The passage uses that old sense. Words that carry it nearly everywhere in these texts (conversation, humane) are noted at every occurrence; words that are mixed (prevent: 2 of 12; let) only at occurrences marked one by one in the work's file and checked against the source.
3. The card quotes only that dictionary's own words, with its entry; never a paraphrase.

A starter list to check: let, prevent, conversation, humane, presently, carriage, communicate, quick, meat, presidents (precedents), entercourse, fantasy or phantasy (imagination), reliques (remains), fabrick (building), traffick (trade), Catholick (universal), Oeconomicks (household management), subtile, politick, career ("in their full carere"), stile (to call), naughty, wit, silly, careful, occupy, room, allow, ghost, usury, cunning, artillery, discover, sincere.

**Mirrors needed** (each a branch made by a workflow like `mirror-meaning-model.yml`, checking a fixed SHA-256): MorphAdorner's three data files plus its license page, from the official zip; LEME's Johnson text plus its terms page; Webster 1828's two OCR files (checked against archive.org's SHA-1); Trench's Gutenberg text. Already on GitHub: Webster 1913 (GITenberg) and the word list (hermitdave). EarlyPrint only if permission comes; its Manton file would have to be gzipped to stay well under GitHub's limits.

## 6. Not confirmed

- Running MorphAdorner's full pipeline on the TCP texts, and how close its output is to EarlyPrint's (not run).
- Whether EarlyPrint would grant open use of its spellings.
- Accuracy on Tyndale (1530s) and Beza (1581): not sampled; their spelling is much further from modern.
- The faith of Webster 1913's editors, and William Aldis Wright's.
- The old-meaning starter list: each word still has to be found and quoted in the dictionaries.

## 7. Questions for the founder, each with a recommended answer

1. **EarlyPrint's spellings are more accurate but its site says CC BY-NC (non-commercial), not on your list. Ask EarlyPrint for permission, or use the open MorphAdorner list?** Recommended: use MorphAdorner's list now (open, 98 of 100 right after the rule on a fresh sample, every pair read before shipping); write to EarlyPrint later only if you want its context-aware readings.
2. **MorphAdorner is a university spelling tool under an NCSA (MIT-style) license, not one of the four Creative Commons licenses you named, and it gives letters, not meanings. Does it need to pass the Bible-believing rule, and is its license acceptable?** Recommended: treat it like the TCP transcription itself (a tool for letters, not an interpreter), accept the NCSA license as no stricter than CC BY, and credit it plainly.
3. **Which dictionaries for old meanings?** Recommended: Johnson 1755 (LEME's transcription, CC BY 4.0) first, as the nearest in date and checked word for word against the print; Webster 1828 second, quoted from the original volumes; Trench's Select Glossary to decide which words qualify. Do not display the GitHub Webster 1828 copies (edited text of unclear origin).
4. **Words the older dictionaries do not cover, chiefly "humane" for "human" (Owen's "humane nature"): use Webster's 1913 dictionary, or leave them unglossed?** Recommended: use Webster 1913 for its "[Obs.]" senses only, once its editors' faith is confirmed from its own preface; until then leave them unglossed.
5. **Gloss every qualifying word the first time in each note, or only the larger changes?** Recommended: every word that passes the rule, first time in each note, with a setting to hide them. (About 37% of glossed occurrences differ only by a dropped final e, a doubled letter, y for i, -ick for -ic or -our for -or; those could be left out if the page feels busy.)
6. **Old meanings on mixed words like "prevent": mark occurrences one by one, or show the dictionary card on every occurrence?** Recommended: one by one for mixed words, every occurrence for words that are old nearly everywhere (conversation, humane); the card always quotes the dictionary, never a summary.

## Files

- `research/spelling.md` (this file)
- `research/spelling/`: EarlyPrint XML (`ep/`), token tables (`derived/`), TCP XML (`tcp/`), MorphAdorner data (`ma/`, `ma-official/`), Webster copies (`webster/`), Johnson (`johnson/`, with the LEME text, its terms page and the 1755 page images n416 and n417), Trench (`trench/`), Wright OCR (`wright/`), saved web pages (`web/`), word list (`wordlist/`), and all judged samples (`*.tsv`)
- `research/spelling-scripts/`: the scripts named in section 4
