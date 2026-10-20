# Bible Atlas: content and sources

Angle: CONTENT AND SOURCES. Repository github.com/Sixteen1-6/BibleAtlas, main at a46d819 (PR #46, merged 2026-10-20). Live site https://everyversemap.com/, buildId 514b1f3bf2b1; its data/layers.json was last modified 2026-10-20 14:06:21 GMT, so the live data is this main.

## How this was measured

- Read config/*.json, sources.json, NOTICE.md, README.md, IDEAS.md, crates/atlas-cli/src/layers.rs, extra_hard_verses.rs, shelf.rs, eras.rs, web/src/ui/Layers.tsx, web/src/data/net.ts, web/src/ui/extras/voices/links.ts, every PR body in a local snapshot (prs.json), and the git history of each content file.
- Re-implemented the Layers "goes live" rule of layers.rs in Node (scratch/layers-stats.js, in a local job's scratch folder on the founder's PC) and compared it with the live site's own published files, downloaded from https://everyversemap.com/data/ (meta.json, layers.json, shelf.json, themes.json, eras.json, extras/*.json, into scratch/live/). They agree exactly.
- Spot-checked citation links with HTTP requests to biblehub.com, and read https://netbible.com/copyright/ and the GitHub API for Clear-Bible/macula-hebrew issue 145 on 2026-10-20.
- Did not run `atlas build` (no data/raw on the founder's PC; the repository was read-only for this task).

## 1. Live versus drafted, at a glance

| Content | In config at a46d819 | Live on everyversemap.com | Held back | What gates it |
| --- | --- | --- | --- | --- |
| Layers passages | 1,264 | 1,264 | 0 | a passage shows once one live note goes beyond the plain meaning |
| Layers notes | 3,099 | 3,095 | 4 hidden (no citation) | a note is live when it cites a listed source; a passage with a reviewer goes live whole |
| Layers passages with a reviewer (`reviewed_by`) | 0 of 1,264 | | | founder's review page |
| Hard-verse cards ("Often asked") | 56 | 0 cards. 56 pointers (passages and 114 read-more links, no card words) at Deep, on 116 verse lines | all 56 cards | `reviewed_by` empty on all 56 |
| Aramaic words and sections | 34 words in 63 verses, 5 Old Testament sections, 46 loan roots | all (live file: 34 entries, 71 verse keys, 12 chapter keys) | 0 | build checks only, no review gate |
| Parallel passage sets | 307, plus 37 `leftOut` | 307 | 0 | build checks |
| Themes | 163 in 10 groups | 163 (9 only from Study up) | 0 | build checks |
| Related-word pairs for themes | 379 across 126 themes | all | 0 | two-judge review, build checks |
| Nave's headings on the Themes tab | 146 hidden, 28 let through, 14 reference fixes | | | config/naves-display.json |
| Eras and dates | 17 eras, 71 chapter ranges in 45 books, 134 dating views for 66 books | all | James, 2 Timothy, 1 and 2 Peter deliberately get no era (eras.rs 2075 to 2085) | quotes checked word for word at build |
| Sources shelf | 58 works in 12 groups | 58 (the 10 `onlyWhenCited` website cards all show, because hard-verse pointers count as citations) | 0 | build checks |
| Christian writers ("voices") | Catena Aurea on 3,774 verses, Matthew Henry on 31,055, Wesley on 16,704; 43 verses have none | all, at Deep only, after the reader taps "Show what they wrote" | | PR #33 |
| Study notes (Aquifer) | 16,923 notes on 28,938 verses (PR #13) | all | | |
| Easton's and Smith's dictionaries | 3,962 and 4,561 entries (live shelf.json) | all | | |
| Ask the Bible questions | 1,584 (config/questions.json has no `reviewed_by` field since PR #26) | all | | build ties every chain part to the Bible's own data |

## 2. Layers of meaning

### Files

- `config/layers.json`: 1,264 passages. Each has id, section, ref, saying, source, reviewed_by and layers; each layer (note) has kind, strength, refs, optional words, evidence, cites, text.
- `config/layer-sources.json`: the cite list (43 works: 38 "interpreter", 5 "reference") and the avoid list (27 entries, 72 match strings). Rules in its `_comment`, lines 3 to 6.
- `crates/atlas-cli/src/layers.rs` (763 lines): checks and decides what goes live. Writes web/public/data/layers.json.
- `web/src/ui/Layers.tsx`, `web/src/data/layers.ts`: the card. Simple shows one note, Study all notes with their words, Deep the evidence, the "Sources:" line and the passage's source line.

### When a note goes live (layers.rs)

1. A passage with any name in `reviewed_by` goes live whole (lines 414 to 420). No passage has one.
2. Otherwise a note is live when its `cites` names at least one source on the cite list, and, for the kinds wordplay, allusion, pattern, irony and fulfillment (`NEEDS_INTERPRETER`, line 50), at least one cited source has role "interpreter", not only a word book (line 353).
3. A passage shows only when one live note goes beyond the plain meaning (line 421).
4. The build fails unless every passage has a note besides the plain meaning whose strength is not "some interpreters" (lines 409 to 411). With the round 2 convention that strength equals the number of writers who state the point themselves (3 or more "widely agreed", 2 "commonly held", 1 "some interpreters"; PR #42 and #44), this is the "at least two writers" bar that sent passages back in PR #42 and #44.
5. Other checks (lines 1 to 22): every reference resolves in the BSB; the `saying` is in the BSB text; every quotation of 4 or more words is in the BSB text of the passage or the note's refs; kind and strength come from fixed lists (lines 52 to 55); each `words` entry is a root that occurs in that verse; "ESV" appears nowhere; a "widely agreed" note shows words, an outside ref or evidence; text at most 300 characters, evidence at most 400; no avoid-list name in text, evidence, source line or a cite's on/at/url; the Pulpit Commentary is never cited on Jeremiah or Lamentations (`not_on`, line 335).
6. Drafts and hidden notes publish only with `ATLAS_LAYER_DRAFTS=1`. No workflow and no Makefile target sets it.
7. History: until PR #38 (2026-10-11) every note was a draft that needed the founder to approve its passage on a review page. PR #38 switched to "live when cited". The review page named in PR #23 (https://claude.ai/artifact/GcZhxjKjNbKcKJvMUYQcBy) could not be opened from the claude.ai account used for this check ("artifact not found").

### Counts

- Sections: law-history 309, prophets-poetry 520, jesus 135, letters-revelation 300.
- Kinds of the 3,095 live notes: plain meaning 1,264; allusion 939; wordplay 398; name meaning 296; pattern 86; quotation 44; setting 37; fulfillment 30; irony 1.
- Strengths of all 3,099: widely agreed 2,173; commonly held 770; some interpreters 156.
- 1,609 notes link Hebrew or Greek words; 2,961 have an evidence line.
- Growth: 15 passages (9779d71, 2026-10-08), 70 with 433 notes (PR #6), 88 with 492 (PR #23), first live 88 with 486 (PR #38), 488 (PR #39), 470 with 1,315 (PR #42), 1,261 with 3,087 (PR #44), 1,264 with 3,095 (PR #45).
- Origins: 88 round 1 passages, drafted in this repo on 2026-10-08 and 10-09 and cited on 10-11; 1,176 round 2 passages from the separate "Wordplay thread" (merged 10-17).
- Every passage's `source` line begins "Drafted with AI help (Claude) from the BSB, STEPBible ..." (1,176 share one wording; 88 have their own). Layers.tsx lines 255 to 263 show it at Deep with "Not yet reviewed by a person; each note names the sources it rests on."

### The 4 hidden notes (empty `cites`)

| Passage (line in config/layers.json) | Kind, strength | Point |
| --- | --- | --- |
| 1-samuel-25-25 (11005) | wordplay, some interpreters | nevel ("skin" of wine) sounds like Nabal |
| job-19-25 (14094) | wordplay, widely agreed | chinnam, "for nothing", in Job 1:9 and 2:3, related to the word for grace |
| isaiah-5-7 (19798) | allusion, some interpreters | tse'aqah, the cry of Egypt and Sodom; no evidence line |
| philemon-1-11 (46492) | wordplay, some interpreters | chrestos "useful" sounding like Christos |

All four are round 1 notes. Each needs a citation from the list or the founder's tick (PR #38, #39).

### Citations

- 6,014 cites; every one has `on`; 188 add `at`, 78 add `url`.
- 39 of the 43 listed works are used: Gill 1,029; Barnes 1,020; Keil and Delitzsch 839; Jamieson-Fausset-Brown 824; Clarke 542; Bullinger's Companion Bible 419; Wesley 319; Ellicott 238; Pulpit Commentary 219; Henry's Concise 159; Bullinger's Figures of Speech 117; Poole 66; Benson 55; Bengel 49; church fathers 17; Maclaren 16; The Gospel Coalition 14; Henry (full) 9; Calvin 9; Geneva notes 6; Themelios 6; Ligonier 5; Reformation Study Bible 5; BibleProject 4; JETS 4; Capes 3; Bird 3; Woudstra, Strong's, Edersheim, Easton, Leithart and Beale 2 each; Keener, F. F. Bruce, NET notes, Catena Aurea, Chrysostom and Spurgeon 1 each. Listed but never used: bsb, tyndale-house, abbott-smith, tyndale-notes.
- 48 notes cite modern copyrighted works (Keener, Beale, Bruce, The Gospel Coalition, Ligonier, Themelios, JETS, BibleProject and others); their evidence paraphrases rather than quotes at length.
- Links in the live data: 5,405 to biblehub.com chapter pages built by layers.rs lines 339 to 344; 419 to studylight.org, 418 of which are the Companion Bible's index page rather than the chapter; 117 to the archive.org home of Figures of Speech.

### The "second check"

- PR #23: three fact-checking agents read every one of 88 passages against the Hebrew and Greek; no factual errors, 12 notes reworded.
- PR #38: every citation was found by agents that quoted the page they fetched; all 1,143 were fetched again and checked by a second set of agents; 46 failed and were corrected or dropped; notes that claimed more than their sources were narrowed; a second search cited 8 more notes.
- PR #39: Bullinger's two works added to the cite list; Joshua 2:18 and Psalm 41:9 notes went live (488 of 492).
- PR #42 (Genesis to Song of Solomon): 1,516 of 1,517 quotes matched word for word against downloaded source texts and 33 Bible Hub quotes re-fetched; one agent per batch read each of 847 notes against its quotes, a second agent tried to refute each problem: 59 fixes upheld, 3 findings rejected; cites that only reported a view the writer rejected, or a rabbi's or Targum's view, were dropped; strengths reset to the number of writers; 86 cites moved to the verse heading the quote sits under; 8 Figures of Speech cites renamed; 10 passages sent back.
- PR #44 (Isaiah to Revelation): 3,217 locally held quotes matched against the source copies (sacred-texts files, Companion Bible and Figures of Speech databases, Wesley); 54 fixes upheld, 4 findings refuted; 3 passages set aside for having only one writer.
- PR #45: the 3 set-aside passages mended; 15 local quotes and 6 web quotes re-checked; 3 refuter findings fixed.
- None of this evidence (fetched pages, quote stores, source copies, the round 2 merge tools, the Wordplay thread's draft files) is in the repository. Only the resulting `cites` (source and verse) and paraphrased `evidence` are.

### Quote marks (PR #10)

Recounted on the live data with the logic of Layers.tsx lines 73 to 91: 190 links in 85 notes of 48 passages carry the gold quotation mark. The quotations data (extras/quotes.json, from the BSB's own footnotes) holds 328 quotations and 131 echoes; echoes are never marked.

### Wordplay extra (PR #15, #20)

The "A play on words" and "What a name means" lines under verses come from the live Layers notes. The twelve alphabet poems (461 letters, each checked against the first letter of its line in TAHOT by extra_wordplay.rs) are live (live extras/wordplay.json: 12 acrostics).

### Problems found in Layers

1. Broken Song of Solomon links. layers.rs line 342 builds the Bible Hub slug from the book name, giving `song_of_solomon`; Bible Hub uses `songs` (gill/song_of_solomon/1.htm returns 404, gill/songs/1.htm and kad/songs/1.htm return 200, checked 2026-10-20). 36 live cites in 22 notes of 10 passages link to 404 pages. web/src/ui/extras/voices/links.ts line 26 already has a correct slug table.
2. Broken Spurgeon link. Spurgeon's Bible Hub code `treasury` (layer-sources.json line 26) gives https://biblehub.com/commentaries/treasury/psalms/110.htm, a 404 (1 cite, hebrews-7-2).
3. Round 1 strengths were never recalibrated. Round 2 notes never claim more than their number of distinct interpreter sources, but in the 88 round 1 passages 17 notes are "widely agreed" with one interpreter cited (Genesis 3:1, 11:9, 27:36, 28:12; Exodus 16:15; Leviticus 25:10; 2 Samuel 7:13; Isaiah 5:7; Jeremiah 1:12; Hosea 2:23; Mark 14:24; Luke 10:33; John 2:19, 4:10; 1 Corinthians 16:22; 2 Corinthians 3:18; Revelation 1:5), 23 are "commonly held" with one, and 106 are "widely agreed" with two.
4. Four passages sent back in PR #42 never came back: 1 Samuel 6:6, Proverbs 3:20, Ecclesiastes 3:18 and 3:20 (present at 47ec38b, removed at 7c37488, absent at a46d819). The other six of those ten returned as "part 1c" in PR #44.
5. Gray areas under the Christian-writers rule (not build failures): notes at Genesis 28:12, Song of Solomon 8:6, Isaiah 53:5 and Daniel 7:13 mention rabbis' or medieval Jewish readings in their shown text; Sefaria is named in 7 evidence lines as where a Targum or Genesis Rabbah was read.

## 3. Hard verses ("Often asked")

- `config/hard-verses.json`: 56 cards, from judas-death (Acts 1:18) to global-flood (Genesis 7:19), with 182 views (65 "widely held", 65 "commonly held", 52 "some interpreters"), helps, evidence and a source line ("Drafted with AI help (Claude) from the BSB and the Bible's own cross-references, checked for accuracy and fairness by separate AI reviewers; read-more pages are linked, not copied").
- 114 read-more links to the 13 allowed hosts in extra_hard_verses.rs lines 36 to 50: GotQuestions 51, The Gospel Coalition 19, Bible.org 13, Catholic Answers 12, Ligonier 5 (labelled "Ligonier Ministries" 4 times and "Ligonier" once), Answers in Genesis 3, BibleProject 2, Desiring God 2, Christianity Today 2, BiblicalTraining 2, CrossExamined 1, BibleRef 1, OrthodoxWiki 1.
- `reviewed_by` is empty on all 56, so the live extras/hard-verses/cards.json is `{"cards":[],"format":1}`. Since PR #33 the build still writes a pointer for every card (its verses and read-more links, none of its words): the live extras/hard-verses.json has 56 pointers on 116 verse lines, shown at Deep as "Hard passages". The founder's review gates the card text only; the external links are already public.
- Hard verses use their own strength words and host allowlist, not layer-sources.json.
- History: PR #19 (drafted), #25 (shelf cards for the sites), #33 (pointers at Deep), #37 (five links replaced, 17 explanations rewritten to Bible-trusting answers), b55d549 (plainer wording).

## 4. Aramaic (config/aramaic.json, PR #8, #37)

- 34 words in 63 verses (14 said by Jesus), 5 Old Testament sections (Genesis 31:47 by TBESH and the BSB footnote; Jeremiah 10:11, Daniel 2:4 to 7:28, Ezra 4:8 to 6:18 and 7:12 to 26 by TAHOT tagging), 46 loan roots. Certainty: 20 widely agreed, 9 commonly held, 5 scholars differ. Languages: 20 Aramaic, 9 Aramaic or Hebrew, 5 Hebrew.
- 125 source strings: TBESG 34, TAGNT 34, BSB footnotes 18, Dalman 5, Buth and Pierce 5, TAHOT 5, Ken Penner 4, Mishnah 3, Stanton 2, Buth 2, Metzger 2, Josephus 2, and one each for Abbott-Smith, Targum of Psalms, 4 Ezra, Didache, Copper Scroll, Sebastian Brock, Philo, TBESH, Keil and Delitzsch.
- Live, no review gate. The build checks every reference, BSB wording, TAGNT Greek form (byte for byte), Strong's number, section boundary against TAHOT, length, and bans the abbreviation of any copyrighted translation the project never quotes.
- PR #37 says the Aramaic notes now rest on "the text itself, Abbott-Smith, Stanton (The Gospel Coalition), Buth and Pierce, and Keil". The file still cites Ken M. Penner's article in New Testament Studies (lines 506, 586, 663, 691), a journal on the Layers avoid list (layer-sources.json line 71); Bruce Metzger's Textual Commentary (lines 164, 720); Sebastian Brock (line 797); Dalman (5 strings); and names Deissmann in a Deep text (line 792). None of these is on the Layers cite list.

## 5. Parallels (config/parallels.json)

307 sets, all live: account 134, event 123, letter 17, list 13, song 11, prophecy 5, law 4. 37 links the BSB headings make are deliberately left out with reasons (for example the two genealogies of Jesus). Sets start from the BSB's own section headings (public domain); a few were added by hand (Psalm 106 with 1 Chronicles 16, Jude with 2 Peter 2, Ephesians with Colossians, the retold visions in Acts, parts of Jeremiah 52, Isaiah 38 and Exodus 34).

## 6. Themes, related words, Nave's and eras

- `config/themes.json`: 163 themes in 10 groups (promises 29, things 23, people 21, nature 18, worship 18, living 15, struggle 12, times 10, acts 9, body 8); 8 featured (lamb, light, shepherd, vine, bread, water, rock, fire); 9 broad words only from Study (name, word, servant, king, father, son, zion, seven, forty); 676 root entries, 27 deliberate exclusions, `skip_with` on 2 (seven, forty). Rule: each theme traces specific Hebrew, Aramaic and Greek words, never hand-picked verses; ids never change, new themes are only appended; a blurb may only paraphrase verses the theme lights. Reported coverage (PR #24): 70.7% of verses have a theme at Simple, 10.1% reach one through links. 140 new themes were checked for wrong senses with 29 fixes.
- `config/theme-related.json`: 379 reviewed pairs across 126 themes (10 limited by `english`, 4 with `sense` overrides, 17 with `not` lists covering 18 verses, 1 `gloss`). From 1,060 candidates, one judge agent kept or dropped each, and a second tried to refute every keep (PR #30). A related word never adds a verse or root to a theme.
- `config/naves-display.json`: 146 hidden headings (PR #27 reported 143), 28 let through, 14 reference fixes. Hidden: 1896 headings that read as slurs today, old senses (Abortion meaning miscarriage, Infidelity meaning unbelief), meta lists (Types; Quotations and Allusions), subjects too broad (God; Jesus, the Christ). Nave's never becomes a theme; only headings show, at Study, for a verse no theme reaches.
- `config/eras.json`: hand-entered from the Tyndale Open Bible Dictionary (CC BY-SA 4.0): 2 charts, 17 eras, 71 chapter ranges across 45 books, 66 book entries with 134 dating views, 1 correction (Abraham's birth, Gn 26:5 to Gen 21:5). Founder choices in PR #11: add Colossians and 1 and 2 Thessalonians; keep the traditional date first on the "Written" line; keep the Sabbath theme as it was. The dating views quote positions the dictionary reports and argues against, labelled by who holds them: "the liberal view" (Genesis, eras.json line 277), "Some critics" (Exodus), "the common critical view" (Leviticus), "critical scholars" (Joshua), "Most modern scholars" (Job), "Those who deny Solomonic authorship" (Ecclesiastes), "Scholars who deny the validity of biblical prophecy" (Nahum, line 453), "Some liberal scholars" (John, line 505), "Those who do not accept Pauline authorship" (1 and 2 Timothy, Titus).

## 7. Christian writers, study notes, dictionaries

- Voices (PR #33, #37): Catena Aurea (the Church Fathers on the Gospels), Matthew Henry's Concise Commentary and John Wesley's Notes, public domain, word for word; shown at Deep only after the reader opts in. Read-more links (voices/links.ts): BibleRef, GotQuestions, Keil and Delitzsch (Old Testament) and Jamieson-Fausset-Brown on Bible Hub, and the NET notes. Sefaria and Historical Christian Faith were removed in PR #37.
- Study notes: Aquifer Open Study Notes (adapted from Tyndale Open Study Notes), CC BY-SA 4.0, shown as the scholars' notes, never as the app's own claim.
- Easton's (1897) and Smith's (1884 American edition) dictionaries, public domain texts carried by CC BY-SA 4.0 and CC BY 4.0 collections; readable in the app from the Sources shelf, and listed under verses at Study.

## 8. The Sources shelf (config/shelf.json, crates/atlas-cli/src/shelf.rs)

- 58 works in 12 groups; live shelf.json has the same 58. Licenses: 23 public domain, 21 copyrighted (cited and linked only), 9 CC BY 4.0, 5 CC BY-SA 4.0. Rule (shelf.json `_comment`): the app ships only public domain, CC BY 4.0 and CC BY-SA 4.0 material; a copyrighted work is cited and linked, never quoted at length or stored; facts on each card are checked against the work, its publisher or a catalog, never guessed.
- shelf.rs counts citations only from config/aramaic.json and config/hard-verses.json. It does not read Layers. So 28 works that Layers cite have no card at all: Gill (1,029 cites), Barnes (1,020), Jamieson-Fausset-Brown (824), Clarke (542), Bullinger's two works (536), Ellicott (238), the Pulpit Commentary (219), Poole, Benson, Bengel, Matthew Henry's full commentary, Calvin, Geneva notes, Maclaren, Spurgeon, Chrysostom, Edersheim, the Reformation Study Bible, Themelios, JETS, Beale, F. F. Bruce, Woudstra, Leithart, Bird, Keener and Capes (the church fathers have only the Catena card). Works that do have a card (Keil and Delitzsch, Wesley, Henry's Concise, The Gospel Coalition, Ligonier, BibleProject, the NET) do not count their Layers citations: the Keil and Delitzsch card shows 1 citation (Aramaic) though Layers cite it 839 times. shelf.json line 10 says "Works only drafted in config/layers.json are added when they go live"; they went live on 2026-10-11 and 10-17. web/src/ui/Sources.tsx line 153 tells readers "Everything in this app comes from the works below", which is no longer true.
- Stale cards: Thayer (shelf.json line 361) is live with 0 citations and the text "Old, but still widely used", while layer-sources.json line 60 bans Thayer ("a Unitarian, who denied the Trinity"). The Bible Hub card (line 839) says the app links to two commentaries there and shows 0 citations; Layers link 16 Bible Hub commentaries 5,405 times.
- Inconsistent count: the Nave's card (line 201) says "More than 20,000 subjects"; sources.json line 54 says "About 5,300 subjects".

## 9. Licenses and constraints

| Source | License | What ships or shows | Constraint |
| --- | --- | --- | --- |
| BSB text, footnotes, headings | Public domain (dedicated 2023-04-30) | default text, search, word links, quotations data, parallels | none; all Layers and hard-verse quotations must be BSB |
| ESV | Copyright Crossway, free non-commercial API terms | only on a self-hosted copy with a key, through server/esv.mjs | one chapter per request, at most 500 verses cached (esv.mjs line 12), never stored, copyright line shown; Pages builds with VITE_ESV=off (pages.yml line 52) |
| NET Bible | Copyright Biblical Studies Press; quoted by permission in a free app | read live from labs.bible.org, at most 2 chapters in memory, never stored (net.ts lines 1 to 22, sw.js) | non-commercial; "(NET)" linked to netbible.org; copyright acknowledgment; the translators' notes are excluded, so they are only linked. netbible.com/copyright (read 2026-10-20) sends commercial publication to HarperCollins Christian Publishing |
| KJV, ASV | Public domain | search and build helpers only, never shown | |
| STEPBible TAHOT, TAGNT, TBESH, TBESG | CC BY 4.0 | words, grammar, lexicon | attribution string; changes must be noted (NOTICE.md lines 37 to 49) |
| STEPBible TFLSJ (LSJ) | CC BY 4.0 (formatting), CC BY-SA 4.0 (LSJ text) | up to 5 glosses per root with centuries (world/*.json) | derived files CC BY-SA 4.0; source not redistributed |
| UBS Fauna, Flora and Realia | CC BY-SA 4.0 | "In their world" articles | derived files CC BY-SA 4.0; required attribution lines |
| OpenBible.info cross-references | CC BY 4.0 | the map | attribution |
| OpenBible.info geocoding and shapes | CC BY 4.0 | places, regions | coordinates from OpenStreetMap (ODbL), Google Maps or Google Earth are left out (61 sites withheld, PR #5) |
| Theographic | CC BY-SA 4.0 | people and events (real-map/people.json, events.json) | share-alike; years only at Deep with the 4004 BC chronology caveat |
| Natural Earth | Public domain | base map | |
| Clear Bible alignments | CC BY 4.0 | color pairs (links only, no text) | |
| MACULA Hebrew | CC BY 4.0 | Septuagint word pairs, positions only | open question whether the equivalents come from CATSS (non-commercial): Clear-Bible/macula-hebrew issue 145, opened 2026-10-07, still open with 0 comments on 2026-10-20 |
| Strong's (Open Scriptures JSON) | Public domain text; JSON edition CC BY-SA (no version given) | derivation links only (forms/, themes related lists) | derived files share-alike |
| Nave's (BradyStephenson table) | CC BY 4.0 edition of a public-domain book | index only; headings shown, never entry text | |
| Digital Syriac Corpus (Peshitta) | CC BY 4.0 (TEI), base text public domain | at Deep, as a translation, never as Jesus' words | source is an uncorrected transcription; Noto Sans Syriac under SIL OFL 1.1 ships with the panel |
| Aquifer Open Study Notes | CC BY-SA 4.0 | notes one tap from a verse | derived notes CC BY-SA 4.0 |
| Tyndale Open Bible Dictionary | CC BY-SA 4.0 | eras and dates | the only source whose quotations are stored in the repo (config/eras.json, CC BY-SA 4.0, NOTICE.md line 95) |
| Easton's, Smith's | Public domain texts via CCEL Paragraphs (CC BY-SA 4.0) and NEUU dataset (CC BY 4.0) | dict/, extras/dictionary/ | built files CC BY-SA 4.0; never anything CCEL wrote |
| Catena Aurea, Henry, Wesley | Public domain texts (Catena code MIT, Let's Church CC0) | voices at Deep | |
| minishlab/potion-base-8M | MIT | nothing yet | in flight; see below |

Specific points:

- potion-base-8M. On 2026-10-20 a session added `.github/workflows/mirror-meaning-model.yml` on branch claude/ask-the-bible-u6macl (commit 2f40b85, not on main). It copies the model from Hugging Face, checks each file against Hugging Face's hashes, and commits it to branch mirror/potion-base-8M (dced885: README.md, config.json, tokenizer.json 683,666 bytes, model.safetensors 30,236,760 bytes, SOURCE.md) so sources.json can pin it. sources.json on main does not pin it, NOTICE.md and the shelf do not mention it, and no Ask code uses it yet (the current matcher in web/src/ui/ask/meaning.ts uses ask/meaning.json from web/scripts/ask-meaning.mjs). The mirror holds only `license: mit` metadata in the model card, no LICENSE file with a copyright line; the card says the model is distilled from BAAI/bge-base-en-v1.5 and trained on minishlab/tokenlearn-c4-en-bge-base-v1.5. A NOTICE row with the MIT text and those upstream credits will be needed when it ships.
- NET details. NOTICE.md line 85 says other uses need permission from Biblical Studies Press; the copyright page sends commercial publication to HarperCollins Christian Publishing. The app's acknowledgment string (net.ts lines 17 to 18) omits the "http://netbible.com" that the page's acknowledgment includes (the reader does link netbible.org). Any paid tier, ads or donation drive would need a fresh look at the ESV and NET terms.
- Repo licensing. LICENSE is MIT, "Copyright (c) 2026 Shubhanshu Pokharel". README line 203 still says data is "CC BY 4.0 and public domain sources", missing the CC BY-SA 4.0 sources and the NET. The authored content (Layers, hard verses, Aramaic notes, theme blurbs, Ask chains) has no separate license statement, so it falls under the MIT file by default. NOTICE.md line 3 says the repository holds no Bible text; config/layers.json, hard-verses.json and aramaic.json hold BSB quotations (public domain) and short TBESH and TBESG quotations (CC BY 4.0), which is allowed but not stated.

## 10. Who may be cited, and why (source rules)

- Founder's rule, 2026-10-11, in his words (PR #37): "cite ... bible believing people who fully believe the bible and theologians that love God, not people who are liberalizing the bible". Encoded in config/layer-sources.json line 3 and applied to Layers (PR #38), hard verses, Aramaic notes and the voices links (PR #37).
- His later choice (layer-sources.json line 5, PR #37, #38): Christian writers only. Catholic and Orthodox writers who uphold Scripture may be cited (hence Catholic Answers and OrthodoxWiki in the hard-verse links); rabbis' commentaries and Jewish scholars may not (avoid entries at lines 79 and 80; the Sefaria link was dropped).
- Ancient writings (Septuagint, Targums, Mishnah, Talmud, Midrash, Josephus, Philo, Dead Sea Scrolls, Apocrypha) may be named in evidence as witnesses, never as a note's citation (line 6; PR #37).
- The 43 works a Layers note may cite, each with a one-line reason (lines 9 to 51); the 27 it may not cite or name, with reasons (lines 54 to 80): Cambridge Bible, Expositor's Greek Testament, Expositor's Bible, Meyer, ICC, Brown-Driver-Briggs, Thayer, Vincent, TheTorah.com, Working Preacher, Enter the Bible, Biblical Archaeology Review, Jewish Encyclopedia, UBS Handbooks, Etymonline, Posen Library, JBL, New Testament Studies, Steiner, F. Scott Spencer, Scheffler, Kupp, Bockmuehl, Catrin H. Williams, Michelle Knight, medieval rabbis (17 names) and modern Jewish scholars (19 names).
- The Pulpit Commentary is not cited on Jeremiah or Lamentations, whose volume is by the higher critic T. K. Cheyne (line 16).
- A wordplay, allusion, pattern, irony or fulfillment note needs an interpreter, not just a word book (layers.rs line 50).
- Strength is honest and counted: 3 or more writers "widely agreed", 2 "commonly held", 1 "some interpreters" (PR #42, #44); each passage needs a note past the plain meaning stronger than "some interpreters" (layers.rs line 409).
- Ask the Bible: "the framework for interpreting the Bible is the Bible", so answers are chains of Scripture only, and the build rejects any question that names a scholar or a church view (config/questions.json `_comment`, PR #16). The two exceptions are the help line for someone in danger (PR #16) and the founder's own note on seeking God (PR #34, #35).

## 11. Inconsistencies in how the rule is applied

- The avoid list bans Brown-Driver-Briggs and the UBS Handbooks as Layers citations, but every Hebrew word study shows TBESH definitions "abridged from BDB" (sources.json tbesh; shelf.json says so), and the word study's "In their world" shows UBS Fauna, Flora and Realia handbook articles.
- Thayer is banned but keeps a live shelf card.
- New Testament Studies is banned, but the Aramaic notes cite Penner's NTS article 4 times; Metzger, Brock, Dalman and Deissmann are cited or named there although they are not on the cite list.
- The eras panel quotes "the liberal view", "critical scholars" and similar positions (reported by the evangelical Tyndale dictionary), which the founder approved before the 2026-10-11 rule.

## 12. Things that are not on GitHub (relevant to "push everything to GitHub")

- The Wordplay thread's draft files and the round 2 merge tools (PR #42, #44, #45).
- The quote stores and "source copies" used for the machine check (sacred-texts files, Companion Bible and Figures of Speech databases, Wesley) and the fetched pages behind the 1,143 re-checked citations (PR #38, #42, #44).
- The 4 passages the Wordplay thread still holds (1 Samuel 6:6, Proverbs 3:20, Ecclesiastes 3:18 and 3:20).
- The Layers review page (claude.ai artifact GcZhxjKjNbKcKJvMUYQcBy, PR #23) and any ticks stored there; it could not be opened from the claude.ai account used for this check.
- Screenshots kept in the Claude project folders `bible-atlas/ultracode/aramaic/shots/` (PR #8) and `bible-atlas/study-notes/` (PR #13).
- The meaning-model mirror is on GitHub, but only on branches claude/ask-the-bible-u6macl and mirror/potion-base-8M, not main.
