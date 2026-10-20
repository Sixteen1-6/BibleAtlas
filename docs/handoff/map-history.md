# Bible Atlas: history and decisions (2026-10-07 to 2026-10-20)

Angle: HISTORY AND DECISIONS. Sources read: all 46 PR bodies in a local snapshot (`prs.json`), PR comments and base branches (fetched read-only with `gh pr view`), and every commit message in `git log --all` of the founder's main clone (main at `a46d819`). All times are UTC unless marked; the founder's merge commits carry -0400 (US Eastern), so a UTC date after midnight is often the previous evening for him.

## 1. At a glance (measured)

| Measure | Value |
| --- | --- |
| PRs | 46: 43 merged, 3 closed unmerged (#4, #6, #36) |
| Commits in all branches | 308 (306 on main); 205 non-merge, 103 merge |
| Non-merge authors | "Claude" 169, "Shubhanshu" 32 (30 of them made by a Claude session under the founder's git name), "Shubhanshu Pokharel" 3 (squash merges #19, #20, #25), github-actions 1 |
| Commits with a `Claude-Session` trailer | 216, from 19 distinct cloud sessions |
| Non-merge commits with no session | 2: the original import `a59dfb2` and the bot's mirror commit `dced885` |
| Commits per day (all) | 10-07: 5, 10-08: 97, 10-09: 106, 10-10: 56, 10-11: 26, 10-12 to 10-16: 0, 10-17: 13, 10-20: 5 |
| Growth `a59dfb2..main` | 219 files changed, +235,129 / -897 lines; 239 tracked files now (67 at import) |
| Project threads | One claude.ai project, `chan_011qDT8Q1c7gDodDspnZeS1d`, 16 threads linked from PR bodies; 12 PRs carry no thread link (11 Ask the Bible PRs from #26 on, and #21) |
| PR review | No GitHub reviews on any PR; 2 PR comments in all (closing #4 and #6). Median 10 minutes from PR open to merge; 26 of 43 merged in under 15 minutes |
| Unmerged branches | `claude/ask-the-bible-u6macl` (1 commit ahead: `2f40b85`), `mirror/potion-base-8M` (`dced885`) |

## 2. Dated timeline

### 2026-10-07: import and first public deploy
- 22:59 `a59dfb2` "Bible Atlas: original project" (67 files, 10,571 lines, no session trailer). Already had: the WebGL2 arc map of all 344,799 OpenBible.info cross-references, the Wheel, the BSB reader (ESV through a server proxy and API key), word study with manuscript variants, "why connected", 16 word-traced themes, connection paths and PageRank from a Rust engine compiled to WebAssembly (`atlas.bin` 8.4 MB, `atlas verify` 192 checks), and link-addressable views (`#v=`, `#w=`, `#p=`).
- 23:04 `818c732` new colors (Spectrum, Reach, Genre arc modes; night sky; paper theme) and `IDEAS.md` (session `01AViz6a`).
- 23:32 `6dad5eb` deploy to GitHub Pages on every push to main, `VITE_ESV=off` on Pages, new README. 23:41 `8a70f1e` clippy fix for Rust 1.99 (minimum Rust becomes 1.88). 23:45 `41069d9` link preview image. This commit is saved as branch `before-ideas-2026-10-08`.

### 2026-10-08: the first wave, built in parallel
- 01:36 Phase 1, "a clearer first minute" (`e95efe3`, `9a40805`, PR #1): open on Isaiah 53:5, welcome card, plain labels, one link count, weak links hidden, arc hover and follow.
- 01:54 Search finds the verse people mean (`c64fd7c`, PR #2). 02:08 Color pairs (`7488edf`, PR #3).
- 04:58 Depth levels Simple, Study, Deep (`7be1d3a`, PR #4, stacked on #1).
- 05:03 the integration branch `claude/merge-all-ideas-tbjk33` starts (PR #5).
- 05:24 to 23:20 the thirteen "ultracode" branches, all from session `01GDgrBp` (78 commits): living-sky, the extras spine (`ideas-spine`), theme-journeys, many-roads, hebrew-meets-greek, quotes, real-map (Places), books-in-conversation, parallels, arrival, word-sky, time-periods, words-in-their-world. Review fixes land the same evening.
- 05:33 Layers of meaning card with 15 drafted passages (`9779d71`, PR #6); 10:40 sections and length limits (`f8e13c6`); 10:47 70 passages, 433 notes (`39a44c5`).
- 14:28 to 15:19 merge fixes and wiring on the integration branch (`92ffba9`, `7ca1e9e`, `eb27cd5`).

### 2026-10-09: first big release, then a feature per hour
- 00:03 to 03:08 hover a verse or word to light it everywhere (PR #7), merged into the integration branch 03:23.
- 01:26 Layers: Greek wording credited to the Gospel writers, not Jesus (`4a47c7d`).
- 01:52 to 03:54 Jesus' Aramaic words and the Syriac at Deep (PR #8), merged into the integration branch 04:03.
- 05:53 PR #5 merged to main (`996130a`): the first live release of everything above. #1, #2, #3 auto-marked merged; #4 and #6 closed 05:54 with a comment that they landed through #5.
- 06:44 #10 Layers quotation marks. 06:48 #9 small fixes and speed-ups. 06:58 #12 map colours and level hints. 07:09 #13 study notes. 07:35 #14 search reads KJV and ASV wording. 07:49 #17 Places events, regions, tribes and Septuagint word pairs. 08:04 #11 eras for Colossians and 1 to 2 Thessalonians. 08:16 #15 wordplay and alphabet poems. 08:29 #16 Ask the Bible, first version (73 draft chains). 09:27 #19 "Often asked" cards (56 drafts). 09:34 #20 wordplay name fixes. 09:48 #22 Sources shelf. 09:52 #23 18 wordplay passages for Layers, 88 in all.
- Opened this day, merged next day: #18 word forms and families, #21 search folding, #24 163 themes.

### 2026-10-10: themes deepen, Ask the Bible grows from 73 to 871 answers
- 06:01 #24 themes. 06:07 #21 search folding. 06:33 #25 shelf cards for the hard-verse sites. 07:29 #26 all 73 Ask chains live, approval replaced by a build tie check. 08:09 #18 word forms. 08:50 #27 Nave's rows in the Themes tab. 09:48 #28 Ask phrasings and Bible words for modern questions. 11:13 #29 Ask reads questions as typed, measured blind. 12:04 #30 themes through a related word. 16:48 #31 663 prepared answers. 21:36 #33 Christian writers and hard passages at Deep. 22:14 #32 meaning matcher, 871 answers.

### 2026-10-11: the founder's theology rules, then the custom domain
- 01:02 #34 the founder's note on hearing God above every Ask answer. 01:11 #35 his reworded note.
- 01:24 #36 "easy to find from the first screen" opened; closed 01:30; reverted 01:31 (`1096bcb`, "Shubhanshu asked to keep the box as it is").
- 02:46 #37 cite only Bible-believing writers (hard passages, Aramaic notes, links). 03:09 #38 Layers notes go live when they cite a listed Bible-believing source. 03:40 #39 Bullinger and Ellicott added. 04:16 #40 353 more Ask answers (1,224).
- 05:34 UTC (01:34 EDT) `ab53468` "Serve the site from everyversemap.com": pushed straight to main with no PR (session `01E82vb6`). Builds at `/` instead of `/BibleAtlas/`, adds `web/public/CNAME`.
- 08:02 #41 Ask orders gathered verses by what answered askers.

### 2026-10-12 to 2026-10-16: no commits
The Wordplay thread's round 2 research (the 1,176 passages merged on 10-17) happened somewhere with no commit in this repo.

### 2026-10-17: Layers round 2 and 360 more Ask answers
- 08:41 #42 Layers: 382 more cited passages, Genesis to Song of Solomon (470 passages, 1,315 notes). 13:55 #43 Ask: 360 more (1,584). 16:23 #44 Layers: Isaiah to Revelation (1,261 passages, 3,087 notes). 17:25 #45 the three mended passages (1,264 passages, 3,095 notes).

### 2026-10-20: the NET Bible, and a meaning model in flight
- 13:51 `59d17f0` NET as a version; 13:54 `0e04cdc` its notes linked, not shown; 14:01 #46 merged (main `a46d819`).
- 13:53 `2f40b85` (Ask session) adds `.github/workflows/mirror-meaning-model.yml` on the unmerged Ask branch; 13:53:20 the workflow's bot commits `dced885` to `mirror/potion-base-8M` (minishlab/potion-base-8M, MIT, 30,236,760-byte `model.safetensors`). Nothing on main reads it yet; `sources.json` (27 sources) does not pin it.

## 3. By feature area

### Map
- Import: WebGL2 arc field of 344,799 links, HDR-style tone mapping, Wheel. `818c732` Spectrum/Reach/Genre colors.
- PR #1 (`e95efe3`, `9a40805`): arc hover names both ends and net votes, click follows the arc, Clear button and Esc, "Show: Strongest / More / All" replaces the vote slider, book runs named (Law, History, Prophets, Gospels, Paul's letters), Click/Tap wording by device.
- living-sky (`7a09fba`, `d969674`, `dc8b584`): the map draws itself Genesis to Revelation (about 2 s, 0.6 s back from the Wheel), links grow strongest first; arcs bucketed by votes so 50,314 are drawn instead of 344,799 at the default; `dispose()` and `renderSettled()` (kept for a future share image).
- books-in-conversation (`5f70d58`, `bf14559`, `c14f44e`): Wheel ribbons and books open cards (pair card, book card), tablets get the phone sheet at 900 px, "Key verses" renamed "Most connected verses" with "PageRank measures links, not importance".
- many-roads (`238dc1a` to `be52ae6`): up to three disjoint "roads" between two verses (`Adjacency::roads`, `atlas query roads`, `atlas_paths` in wasm); `62f7593` restored `shortest_path` speed after a 7% regression (wasm 62,578 bytes).
- PR #7 hover lighting everywhere (`836391b`, `38fea2c`, `6c6aca7`): `data-lv`/`data-lr` attributes and one document listener, so pointing re-renders nothing.
- PR #12 (`4d119f0`): quotations pink, echoes pink dashed (Study), parallels sky blue, theme thread lamp gold, three road golds; the level switch says what each level adds.

### Reader and versions
- Import: BSB with original text inline or word by word; ESV only through `server/esv.mjs` (one chapter at a time, at most 500 verses held).
- PR #1: selected verse stays in view as fonts load; "Psalm 23"; link counts open Links.
- PR #4 depth levels (`7be1d3a`, `web/src/depth.ts`): Simple / Study / Deep, every visit starts Simple, level remembered per browser, phone panes become Read / Explore.
- PR #9: offline verse load failures say so and retry.
- PR #46 (`59d17f0`, `0e04cdc`): BSB | NET picker on every copy including Pages; NET read live from labs.bible.org a chapter at a time, at most two chapters in memory, "(NET)" link and copyright line; translators' notes linked on netbible.org at Study and Deep, never shown. Search, map, pairs and Ask stay BSB. Tested only against mocked service answers (the build container could not reach labs.bible.org).

### Color pairs
- PR #3 (`7488edf`, session `01KDM9rF`): each Hebrew, Aramaic or Greek word shares a color with its BSB words, a "word for word" line, from Clear Bible alignments (CC BY 4.0): 383,751 of 386,390 links kept, 31,085 verses.
- PR #24 (`e19040c`, `263b700`): 1,833 verses were aligned to an older BSB wording, so links landed one to three words off (Revelation 5:12 paired "glory" with "and"). Those links are now left out (later tuned to 18,945 links in 2,033 verses), so such words show gray instead of wrong.

### Word study
- Import: root, transliteration, grammar, lexicon, every occurrence, manuscript notes.
- hebrew-meets-greek (`cfdafda`, `b018bb7`, `db49cb8`, `43558c8`, `c1a7741`): Septuagint word bridges from Abbott-Smith's notes (8,446 pairs over 2,788 Greek roots after fixes); honest Nestle-Aland notes (double brackets, trust only NA27).
- word-sky (`2f4b430` to `8dda987`): "Echoes of <verse>" list and optional gold echo arcs.
- words-in-their-world (24 commits, `0dcf2df` to `e519ebd`): "Outside the Bible" (first LSJ sense with writer and century, from STEPBible TFLSJ) and "In their world" (UBS Fauna, Flora and Realia articles). Many data-truth fixes: Aeschylus dated 5th century BC not 4th (`e08b018`), "Poll." is Pollux (`f407d1c`), Heraclitus and Democritus re-dated (`c0ace76`, `c546fc2`), misprints set right (`67dbff8`).
- PR #8 Aramaic (`353eda4`, `3d01634`, `4e04216`): `config/aramaic.json` 34 words, 63 verses, 5 OT sections, 46 roots; labels "Aramaic, written in Greek letters"; Syriac Peshitta at Deep only, labelled a translation from the Greek (AD 350 to 450), never Jesus' own words.
- PR #18 (`1af6e7d` to `707aa70`, session `01YWkSFJ`): every form of a word and its family (Strong's derivations, TBESH/TBESG), 122 hand-checked cases, `atlas verify` 2,443 checks.

### Themes
- Import: 16 themes. `f2cf79c` seven more (Passover, Redeemer, Atonement, The Anointed One, Sabbath rest, The kingdom, Firstborn) = 23.
- theme-journeys (`3c04e45`, `23cee01`, `3f3aaff`, `947ea77`): a gold thread through each theme, small night skies per theme card.
- PR #11 eras answers (see decisions). `37aa849` added Genesis 2:2 to Sabbath; reverted by `be40008` on the founder's choice.
- PR #24 (session `01CV3N3c`): 163 themes in 10 groups, 8 featured; Themes tab follows the picked verse; coverage 19.5% of verses before, now 70.7% own theme at Simple plus 10.1% through links; nine broad words only at Study.
- PR #27: Nave's Topical Bible (1896) headings at Study for the 3,948 verses no theme reached; 143 headings hidden with reasons (slurs, old senses, meta lists); Nave's never becomes a theme.
- PR #30: themes reached through a related word ("Sabbath rest, a related word: rested"), 379 reviewed pairs in `config/theme-related.json`; a related word never adds a verse or root to a theme.

### Layers and wordplay
- PR #6 / `9779d71`, `f8e13c6`, `39a44c5`: the Layers card; `config/layers.json` checked by `layers.rs` (every reference, word, 4+ word quotation against the BSB, note at most 300 characters, evidence at most 400, any ESV mention rejected); drafts publish only with `ATLAS_LAYER_DRAFTS=1`.
- PR #10: gold quotation mark on links that are direct quotations (132 links in 33 of 70 passages).
- PR #15 (session `01CRsyMF`): wordplay line and walk, twelve alphabet poems with 461 letters checked against TAHOT. PR #20: Mareshah and hyphenated names.
- PR #23: 18 wordplay passages, 88 passages and 492 notes, all on the Layers review page `https://claude.ai/artifact/GcZhxjKjNbKcKJvMUYQcBy`.
- PR #38 (`56b698b`, `1478aa0`, `fbb5e4b`, `37f9b03`, `759a4a6`, `308e4b6`, `75bdd67`, `1a8d291`): a note goes live once it cites a work on `config/layer-sources.json` (41 works then, 43 now; 27 avoided works and writers). All 1,143 citations re-fetched by a second set of agents; 46 failed and were fixed or dropped. 486 of 492 notes live.
- PR #39: Bullinger's Companion Bible and Figures of Speech added; 488 of 492 live.
- PR #42, #44, #45: round 2 from the Wordplay thread: 1,264 passages and 3,095 live notes. Quotes machine-checked against source copies (1,516 of 1,517 in part 1; 3,217 in part 2), each problem put to a second agent that tried to refute it (59 fixes upheld in part 1, 54 in part 2).
- Now measured in `config/layers.json`: 1,264 passages, 3,099 notes, 3,095 with cites, 4 without (hidden), 0 passages with `reviewed_by`.

### Places and quotations
- quotes (`f95d739` to `e0a901d`): where the NT quotes the OT, from the BSB's own footnotes (328 quotations, 131 echoes after `e0a901d` made 1 Peter 2:24 a quotation of Isaiah 53:5).
- real-map (`f08ff41`, `58c1f0b`, `76a7419`): Places line and a self-drawn offline map from OpenBible.info geocoding, Theographic and Natural Earth; positions from OpenStreetMap and Palestine Grid left out; PR #5 also dropped Google Maps and Google Earth positions (61 sites withheld in all).
- parallels (`eea4390`, `3741414`): 302 curated sets (now 307 in config) of parallel passages lined up verse by verse.
- PR #17 (session `01WVKMg9`): Septuagint's own word pairs from MACULA Hebrew (1,625 of 1,882 pairs), Theographic events with years, OpenBible.info region shapes (122), tribes' lands drawn around Joshua 13 to 19 towns, taller desktop panel.
- time-periods (`9a42482` to `6a492dc`): "When" and "Written" lines quoted word for word from the Tyndale Open Bible Dictionary (`config/eras.json`, 17 eras, 71 ranges).

### Study notes and hard verses
- PR #13 (session `01NJrNPy`): Aquifer Open Study Notes (adaptation of Tyndale Open Study Notes, CC BY-SA 4.0), 16,923 notes covering 28,938 of 31,102 verses; Matthew Henry and other older commentaries were not added then for lack of a clean pinned source.
- PR #19: "Often asked" cards, 56 drafts in five groups, links only to listed https sites, `atlas verify` fails if a draft ever publishes.
- PR #33: at Deep, "Christian writers" (Catena Aurea, Matthew Henry's Concise, Wesley's Notes, public domain, shown only after "Show what they wrote") and "Hard passages" (passages plus outside links for all 56 questions, no draft words).
- PR #37: the Bible-believing citation rule applied to hard passages, Aramaic notes and the writer links (details in section 5).

### Sources shelf
- PR #9 folded file lists. PR #22 (session `012b5WmW`): Sources becomes a shelf of 46 works in 9 groups with plain cards ("Read it" for open works, "Find it" for copyrighted ones); Easton's (1897) and Smith's (1884) dictionaries readable in the app. PR #25: 13 website cards, shown only when a published answer cites them (`onlyWhenCited`). Now: `config/shelf.json` has 12 groups and 58 works.

### Ask the Bible (session `01F5MX8Z`, branch `claude/ask-the-bible-u6macl`, 12 merged PRs plus #36)
| PR | Date | Prepared answers | What changed |
| --- | --- | --- | --- |
| #16 | 10-09 | 73 drafts | Chains of whole verses or exact BSB parts; live gathering from Nave's and cross-references; "Help, and hope" path |
| #26 | 10-10 | 73 live | Review gate replaced by a build check that ties every chain part to the question by the Bible's own data (583 parts tied) |
| #28 | 10-10 | 73 | Chains open on common phrasings; Bible words for modern questions |
| #29 | 10-10 | 73 | Filler words dropped, safe misspelling rules, wider help-line wording; word tables lazy loaded |
| #31 | 10-10 | 663 | 590 new answers with "signals"; `route.ts` matcher |
| #32 | 10-10 | 871 | Softmax "meaning matcher" trained at build time (`web/scripts/ask-meaning.mjs`) on 40,455 examples |
| #34, #35 | 10-11 | 871 | The founder's note above every answer |
| #36 | 10-11 | closed | Findability on the first screen, withdrawn |
| #40 | 10-11 | 1,224 | 353 more; open threshold 0.35 |
| #41 | 10-11 | 1,224 | Gathered verses ordered by learned weights |
| #43 | 10-17 | 1,584 | 360 more; 20 closest examples instead of 30 |
Now measured: 1,584 questions, 66,514 example messages in `config/ask-examples.json`, 0 with `reviewed_by`.

### Search (session `01TV2VVB`)
- PR #2: typo-tolerant references ("Mathew 5:3", "John 3 v 16"), coverage scoring with rare words weighted, word-order re-rank on `data/bsb.txt`.
- PR #14: KJV and ASV (public domain) wording counted in a worker; two-verse results.
- PR #21: number, spelling, joined-word and contraction folding (`web/src/data/fold.ts`, about 600 spellings, about 90 joined words).
- `68beaea` replaced real translation wording in a code comment with made-up wording.

### Arrival (first load, offline, errors, domain)
- arrival (`4e09968`, `cc5d451`, `59974f2`, `6519916`, `3c83ad7`): typed links like `/John.3.16` resolved by `404.html`; offline service worker with a kill switch; web manifest and icons; the boot sky painted in inline SVG; a calm error screen with "Report on GitHub".
- PR #1 welcome card; PR #9 local server serves 404.html like Pages; `ab53468` everyversemap.com.

### Performance
- living-sky arc buckets (50,314 of 344,799 arcs drawn by default); `511fa6a` the worker reuses the page's copy of `atlas.bin` instead of a second 8.4 MB fetch; `62f7593` path speed restored.
- `947ea77` theme skies on a phone from about 100 ms to 33 to 43 ms; sky cache capped at 12 MB.
- PR #9: Aramaic, Parallels and Syriac data wait for the reader's first move (`first-move.ts`, `readerHere`); WordWorld split into its own chunk (about 2.9 kB gzipped).
- PR #21: folded indexes built in the search worker (about 1.5 s off the main thread).
- PR #29: Ask word tables move out of the first download (122.7 to 116.2 kB gzipped); PR #31 main bundle 118.4 kB.
- Ask `meaning.json` grows 350 KB (`080da4f`) to 570 KB (#32), 1.07 MB (#34), 1.4 MB (#40), 1.7 MB gzipped (#43), loaded on the first question.
- `atlas verify` checks grow: 192 at import, 784 (#5), 858 (#13), 964 (#16), 1,328 (#22), 2,404 (#24), 3,041 (#27), 4,244 (#30), 4,838 (#31), 5,244 (#34), 5,909 (#46). Cargo tests: 140 (#5), 146 (#17), 175 in atlas-cli (#18).

## 4. The three closed PRs
- **#4 Simple, Study and Deep** (base `phase1-first-minute`, closed 2026-10-09 05:54:57): not rejected. Its commits landed in main through #5 (`996130a`, last commit `7be1d3a`); GitHub could not mark it merged because its base was a stacked branch. Closing comment on the PR says so.
- **#6 Layers of meaning** (base `depth-levels`, closed 05:54:55): same reason, landed through #5 up to `4a47c7d`; the comment adds that the 70 passages stay drafts until approved on the review page.
- **#36 Ask the Bible: easy to find from the first screen** (base main, closed 2026-10-11 01:30:59): a real rejection. It would have relabelled the header box "Ask or search the Bible" and filled the empty palette with four starter questions. Revert `1096bcb` (01:31:20): "Shubhanshu asked to keep the box as it is, reachable as before." The commit and its revert both reached main inside #40, which notes they cancel out.

## 5. The founder's decisions and standing preferences

### Product and design
1. **"Simple for anyone who walks in, with the power to go as deep as the Bible does."** PR #4 calls it "Shubhanshu's main point for the app"; restated as the design rule at the top of `web/src/ui/extras/README.md` (lines 5 to 11): simplest form first, depth exactly one tap away, at most one quiet line per extra, never an empty state or "0 results", "Reverent, accurate and humble. Label anything uncertain."
2. **Every visit starts at Simple**; features gate with `atLeast('study')` / `atLeast('deep')` and never compare level names (`web/src/depth.ts` lines 1 to 14).
3. **The first screen stays calm.** Repeated in PR #5, #7 ("Nothing new shows on the first screen until you point at something"), #12, #13, #22, #27 (Simple never loads Nave's).
4. **Keep the Ask box as it is** (PR #36 closed, revert `1096bcb`).
5. **Eras and Sabbath** (PR #11, his three answers): add Colossians and 1 to 2 Thessalonians to "Events from AD 50 to 70"; keep the traditional date first on the "Written" line; keep the Sabbath theme unchanged (revert `be40008`), with related words handled separately (later PR #30). PR #24 repeats "Sabbath is unchanged, as Shubhanshu chose".
6. **Live site deploys only from main** (PR #1); main was saved as `before-ideas-2026-10-08` before the big merge (PR #5).

### Faith and sources
7. **Ask the Bible speaks only in the Bible's words.** "The owner's rule for this box is that the Bible is the framework for interpreting the Bible. So nothing here writes or interprets" (PR #16). The build rejects any chain part not word for word in its verse and any question that names a scholar or church view. Repeated in every Ask PR ("Answers are still only whole verses or exact BSB verse parts, with nothing written by us").
8. **Two exceptions to rule 7.** A safety path for self-harm searches ("Help, and hope": 988, Samaritans, a helpline finder, then whole verses; the link never carries what was typed; PR #16, widened in #29 and `159c356`). And the founder's own note above every answer, in his words (PR #34), reworded by him in PR #35 to say the tool "cannot seek him for you", lists gathering with believers, prayer and reading the Word, and "We do not believe this tool has the Holy Spirit... But we believe God can use anything for his purposes, even AI and algorithms." On the help path the note follows the verses.
9. **Cite only Bible-believing writers** (2026-10-11). PR #37 quotes him: "cite ... bible believing people who fully believe the bible and theologians that love God, not people who are liberalizing the bible". Recorded with the date in `config/layer-sources.json` `_comment`. Effects: Barr, Brown, Fitzmyer, Rabinowitz, Rosenthal and Thayer dropped from the Aramaic notes; 5 read-more links replaced; 17 hard-passage explanations rewritten (for example Jonah a real prophet, 2 Kings 14:25); Historical Christian Faith and Bible Hub's mixed verse page dropped.
10. **Christian writers only** (his later choice the same day, `fbb5e4b`, PR #37, PR #38): Catholic and Orthodox writers who uphold Scripture stay; rabbis' commentaries, modern Jewish scholars and the Sefaria link go. Ancient texts (Septuagint, Targums, Mishnah, Talmud, Josephus, Philo, Dead Sea Scrolls, Apocrypha) may be named only as historical witnesses, never as a note's citation.
11. **A many-handed work can be barred per book**: the Pulpit Commentary is never cited on Jeremiah and Lamentations because that volume is by the higher critic T. K. Cheyne (`37f9b03`, `not_on`).
12. **Keep every wordplay and allusion that can be cited**, citing only writers who hold the whole Bible true (PR #42).
13. **Strength labels follow the number of believing writers**: three or more "widely agreed", two "commonly held", one "some interpreters"; a passage whose main note beyond the plain meaning has only one writer is refused by the build (PR #42, #44, #45; `crates/atlas-cli/src/layers.rs` line 54).
14. **Approval before publishing**: Layers, "Often asked" cards and the first Ask chains were drafts until he approved each on a review page (PR #6, #15, #16, #19, #23). Two gates were later replaced by checks: Ask chains by the build's Bible-data tie check (PR #26), Layers notes by the cite list (PR #38). The "Often asked" gate still stands.
15. **Accuracy about Jesus' words**: Greek wording is credited to the Gospel writers because Jesus most likely taught in Aramaic (`4a47c7d`); the Peshitta is labelled a translation centuries later (PR #8); disputed readings are labelled disputed.

### Licensing and data
16. **ESV is never stored**: proxy only, one chapter at a time, at most 500 verses, off on Pages (`6dad5eb`, `server/esv.mjs`, `NOTICE.md` "ESV" section); PRs #2, #14, #17 state "No ESV text is stored or used"; Layers build rejects any ESV mention (PR #6); even a code comment's translation wording was replaced with made-up wording (`68beaea`).
17. **NET is read live, never stored, notes linked not shown** (PR #46, `0e04cdc`, `NOTICE.md` "NET Bible"): at most two chapters in memory, "(NET)" linked with the copyright line as netbible.com/copyright asks of free apps; the permission covers the text "without the NET Bible notes".
18. **Copyrighted works are cited and linked, never copied** (PR #19 "linked and never copied", PR #22, #25, `NOTICE.md` line 73). Sites used to check Ask chains (CompellingTruth, OpenBible.info) were an internal comparison only (PR #32).
19. **No Bible text or source data in the repo**: sources pinned by commit in `sources.json`, fetched and hashed (`NOTICE.md` line 3); "Never commit data" (`web/src/ui/extras/README.md` line 43). LSJ raw files stay in gitignored `data/raw`; Pages ships only excerpts (PR #5).
20. **Open map positions only**: OpenStreetMap, Palestine Grid, Google Maps and Google Earth positions withheld (`58c1f0b`, `92ffba9`).
21. **Builds check licenses**: study notes build stops if the source stops naming CC BY-SA 4.0 (PR #13); Peshitta build refuses a file whose header lacks the license (`3d01634`).

### How work is presented and checked
22. **PR format "Before / After / How / Checks"**: all 46 PR bodies follow it; 34 open with "Requested by Shubhanshu" and a project thread link. Plain English, short sentences; 0 em dashes across all 46 PR bodies (the 4 in commit messages quote UI text).
23. **Commit subjects are plain sentences about the visible effect** ("Search finds the verse people mean"), with the why in the body.
24. **Blind, measured evaluations** for search and Ask: fresh, never-seen question sets, readers not told which version showed which, main and branch run the same day (PR #28, #29, #31, #32, #40, #41, #43). Search uses fixed sets (117 famous verses, 103 other-wording verses, 158 queries).
25. **Independent reviewers and refuters**: two reviews in PR #1, three in PR #11, a three-angle review with 23 fixes in PR #15, two judges in PR #24, every citation re-fetched in PR #38, refute passes in #42, #44, #45.
26. **Browser checks at 1440x900 and 390x844, light and dark, at all three levels**, with no console errors (PR #1, #8, #13, #15, #17, #22 and others).
27. **First visit downloads nothing extra**: extras wait for the reader's first move (PR #9, #13, #22).

## 6. Measured evaluation record

| PR | Test set | Before | After |
| --- | --- | --- | --- |
| #2 | 117 well-known verses typed from memory | first 71, top 3 80 | first 101, top 3 113 |
| #14 | 103 verses in KJV or other wording | first 84 | first 99 (117-set: 101 to 105) |
| #21 | 158 new queries | first 143 | first 155 |
| #28 | 268 tuning questions, top 8 | answer 19%, off 42% | answer 31%, off 26% |
| #28 | 120 fresh, blind old vs new | 96 answering verses | 125 (22 better, 8 worse) |
| #29 | 149 never-seen | 74 answering, 843 off | 90 answering, 745 off |
| #31 | 150 blind (50 life statements, 50 life questions, 50 Bible questions) | 78 answering, 763 off, 36 answered | 153, 607, 60 |
| #32 | 270 never-seen, first six verses | 116 answered, 828 off | 152, 581 |
| #34 | 1,096 labelled messages | 390 right opens | 442 (wrong 45 both) |
| #40 | 269 held-out | 204 answered, 379 off | 209, 363 |
| #41 | 299 fresh | 143 answered, 747 off (gathered off 53%) | 147, 684 (48%) |
| #43 | 300 never-seen vs main | 160 answered, 634 of 1,800 off | 181, 576 |

## 7. Cloud sessions (from `Claude-Session` trailers)

| Session | Commits | Active (UTC) | Worked on | PRs |
| --- | --- | --- | --- | --- |
| session_01GDgrBpfomsCbSfqcijgTXn | 78 | 10-08 05:24 to 10-09 05:08 | The 13 `ultracode/*` upgrade and idea branches: living-sky, ideas-spine (extras slot), theme-journeys, many-roads, hebrew-meets-greek, quotes, real-map, books-in-conversation, parallels, arrival, word-sky, time-periods, words-in-their-world | landed via #5 |
| session_01F5MX8Zw1CM7AW18hxHzAeP | 37 | 10-09 07:08 to 10-20 13:53 | Ask the Bible end to end; the meaning-model mirror workflow `2f40b85` (unmerged) | #16, #26, #28, #29, #31, #32, #34, #35, #36, #40, #41, #43 |
| session_01KSvZFUjwhscpHwZiY2UUGi | 31 | 10-07 23:32 to 10-17 17:20 | Lead thread, commits under the founder's git name: Pages deploy and README, clippy fix, link image, Phase 1, depth levels, all Layers work through round 2 | #1, #4, #6, #10, #23, #38, #39, #42, #44, #45 |
| session_01CV3N3cyQquPTsKuYJAD5d1 | 17 | 10-09 06:45 to 10-10 11:52 | Eras review, 163 themes, alignment shift fix, Nave's rows, related words | #11, #24, #27, #30 |
| session_01CRsyMFywVGbdBiAR1GjbXu | 9 | 10-09 07:04 to 10-11 02:39 | The "Wordplay thread": wordplay extra, Often asked cards, name fixes, shelf site cards, Christian writers, Bible-believing citation rule; also drafted the passages merged in #23 and (per PR text) round 2 | #15, #19, #20, #25, #33, #37 |
| session_01YWkSFJcj6FuifeVXgT3Vu1 | 7 | 10-09 07:44 to 10-10 07:58 | Word forms and families | #18 |
| session_01TV2VVB3zDbFGg56enr6Eb2 | 7 | 10-08 01:54 to 10-09 09:29 | Search | #2, #14, #21 |
| session_0197Yk7ESXwqiJSukbJTfMu2 | 7 (plus 25 untrailered merge commits on its branch) | 10-08 05:03 to 10-09 05:45 | Integration branch `claude/merge-all-ideas-tbjk33`, wiring, merging #7 and #8 | #5 |
| session_01VxvHqLgy4PjBwknUmYuR41 | 5 | 10-09 01:52 to 03:54 | Jesus' Aramaic words, Syriac Peshitta | #8 |
| session_01WVKMg9CgLALXiRPoYUqwB9 | 3 | 10-09 07:16 to 07:38 | Places events, regions, tribes; Septuagint word pairs (MACULA) | #17 |
| session_01YDkmdBjMQgxKmV8RCvxLpG | 3 | 10-09 00:03 to 03:08 | Hover lighting | #7 |
| session_01V8TdmB8HpaUTx3XBA4HEnH | 2 | 10-20 13:51 to 13:54 | NET Bible | #46 |
| session_012b5WmWv2LUC8i6fnFR2fmR | 2 | 10-09 09:31 to 09:41 | Sources shelf, Easton's and Smith's | #22 |
| session_01NJrNPyY17Z1efRLxhxYdZL | 2 | 10-09 06:54 to 06:56 | Study notes | #13 |
| session_01VRMN4GpqqHLc8Ca9QVNkyo | 2 | 10-09 06:32 to 06:46 | Small fixes from the #5 follow-up list | #9 |
| session_01E82vb6SqMrmBiKY6XJxqQb | 1 | 10-11 05:34 | Custom domain everyversemap.com (`ab53468`, direct to main) | none |
| session_01KPhwZeawXqafR9SqMLMXQu | 1 | 10-09 06:46 | Map colours and level hints | #12 |
| session_01KDM9rFXp9GYCtYvZtgmX3k | 1 | 10-08 02:08 | Color pairs | #3 |
| session_01AViz6aUYW9mRULSwEqTiWJ | 1 | 10-07 23:04 | New colors and IDEAS.md (`818c732`) | none |

Project threads seen in PR bodies (all in `chan_011qDT8Q1c7gDodDspnZeS1d`): `...WWh2qg4Z` (Phase 1, depth, Layers: #1 #4 #6 #10 #23 #38 #39 #42 #44 #45), `...BCEyFX` (search: #2 #14), `...E19aiU` (#3), `...56FsjF` (#5), `...5ZoCDT` (#7), `...8i7tFr` (#8), `...JommJJ` (#9), `...3ESZst` (themes: #11 #24 #27 #30), `...T8S8HM` (#12), `...H96wgZ` (#13), `...MNDS8K` (Wordplay thread: #15 #19 #20 #25 #33 #37), `...N5TNvQ` (Ask: #16), `...86a484` (#17), `...TaD2Ha` (#18), `...Jm7fYN` (#22), `...Pz1Mun` (#46).

## 8. Open, in-flight or promised work (with evidence)
1. **Meaning model upgrade for Ask the Bible, in flight.** `2f40b85` (2026-10-20, Ask session) is the only commit on `claude/ask-the-bible-u6macl` not in main: a workflow that mirrors minishlab/potion-base-8M to `mirror/potion-base-8M` "so sources.json can pin it". The mirror commit `dced885` exists; nothing pins or reads it yet.
2. **Gathered Ask answers are still weak.** PR #40: "about 40% off topic; that is the next change"; PR #41 lowered it to 48% on a harder set; PR #29: statements of what someone is going through "still mostly fail... That is the next round's work"; PR #41: prepared answers 22% off on the harder set.
3. **56 "Often asked" cards await the founder's approval** (PR #19); `config/hard-verses.json` has 0 with `reviewed_by`. The 13 site cards on the shelf stay hidden until one is published (PR #25).
4. **4 Layers notes stay hidden until reviewed** (PR #39, #44, #45); no Layers passage has `reviewed_by` set.
5. **Wordplay passages sent back.** PR #42 returned 10 passages to the Wordplay thread; PR #44 says 6 came back with a second writer. The other 4 are not accounted for in any later PR.
6. **Share image.** `renderSettled()` was added "for a share image" (`d969674`) and kept for "Phase 2's share image" (PR #5, #12); no share image exists. IDEAS.md "Share as image" is still open.
7. **Unbuilt IDEAS.md items**: verse of the day, guided tours, reading plans with a progress glow, J/K chapter tour, timeline mode, people graph, Louvain theme discovery, side-by-side translation compare, audio, WebGPU renderer, hosting with the ESV (Fly.io or Render). Built since: offline mode, installable app, quotations versus allusions, places.
8. **MACULA licensing question open**: Clear-Bible/macula-hebrew#145 asks whether the Septuagint equivalents come from CATSS (non-commercial); no answer recorded (PR #17).
9. **README is behind the app.** Its "What it does" list has no Ask the Bible, Layers, Wordplay, Often asked or Hard passages, Christian writers, Study notes, Places, Quotations, Parallels, Syriac or depth levels (0 mentions each); it still says "On Windows, run everything inside WSL".
10. **NET needs a live check**: PR #46 was tested only against mocked labs.bible.org answers.
11. **Work that lives outside GitHub** (relevant to the request that everything not local be pushed): the review pages (Layers review artifact `GcZhxjKjNbKcKJvMUYQcBy`, and the pages for Ask and Often asked), blind evaluation question sets and judged labels, the search "scratch harness" (PR #21), prototypes named in code (`thread_final.py` in `web/src/data/thread.ts` line 4, the "lsj5" brief in `crates/atlas-cli/src/world.rs`), screenshots in the claude.ai project folders (`bible-atlas/ultracode/aramaic/shots/`, `bible-atlas/study-notes/`), and the Wordplay thread's round 2 drafts. None of these are in the repository.

## 9. Risks
- **Ask answers ship without the founder's line-by-line approval** since PR #26: 1,584 prepared answers are live on the strength of a build tie check and agent readers. That fits rule 7 mechanically but is the most theologically exposed surface.
- **Merges are fast and unreviewed on GitHub** (median 10 minutes, no reviews); and `ab53468` went to main without a PR while Pages deploys on every push to main.
- **Consistency of the citation rule**: `config/layer-sources.json` avoids "the UBS Handbooks" for Layers, yet the word study still shows UBS Fauna, Flora and Realia articles ("In their world"); the founder may want that checked against rule 9.
- **Payload**: `meaning.json` is about 1.7 MB gzipped on the first question and grows with each batch; a static embedding model would add more.
- **Public repo history**: `mirror/potion-base-8M` holds a 30 MB `model.safetensors` in a normal git commit, and the mirror workflow (`contents: write`, triggered on push to its own path) lives on an unmerged branch.
- **Third-party dependence**: NET relies on labs.bible.org CORS or JSONP at runtime; MACULA's CATSS question is unresolved.
- **Draft queues age**: 56 cards and 4 notes have waited since 10-09 to 10-11 with no recorded approvals; the Layers review artifact predates round 2 (it listed 88 passages; there are now 1,264).
- **Evidence trail off-repo**: blind test sets, judged labels and review pages are not versioned with the code, so later sessions cannot re-run the measurements in section 6.
