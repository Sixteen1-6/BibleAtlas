# What the computer's literary work holds that is not built yet

Checked 2026-11-01 against `main` at fad2d5e (its config is the same at 022b512), every remote branch, the Wordplay thread's round 3 hand-off (`/mnt/project-files/bible-atlas/wordplay/round3/`, project files) and the cloud figures folder. Each item was found by one reader and then checked by a second, who dropped anything already live or already queued. The local files it draws on are in this folder: `literary/catalogue.md`, `literary/sources.md`, `literary/fit.md`, `literary/research-results.json`, `literary/mock-tools/` and `voices/`.

Strength counts writers, as CLAUDE.md says: 3 or more is widely agreed, 2 commonly held, 1 some interpreters. A count below is the number of quotable writers the local catalogue names; each still needs the quote fetched and recorded before it can go in.

## Reader 1: Figures of speech and poetry forms

Checked on 2026-11-01 against main at fad2d5e, /mnt/project-files/bible-atlas/wordplay/round3/ (2026-10-25 hand-off), /mnt/project-files/bible-atlas/figures/, every remote branch and the open PRs (there are none).

Live, as claimed: config/figure-forms.json has 13 forms, and `synecdoche` has no `defined`. config/figures/ holds 5 notes: Ps 1:6 opposite, Isa 6:10 mirror, Matt 10:34 metonymy, Gen 6:6 anthropopatheia, 1 Sam 1:2 contrast. The copy in /mnt/project-files/bible-atlas/figures/config/ is an older pre-#63 copy of the same 5 notes, so nothing extra is queued there. The live forms with no note number eight, not seven: same, building, turns, synecdoche, prosopopoeia, simile, metaphor and likeness. Round 3 queues only Romans 10:21 for figures. None of the gap verses has a figure note on main or in round 3. The nearby Layers notes are on other devices: Isa 1:2 allusion, Gen 18:21 and 8:21 allusions, Deut 32:21 wordplay, and round 3's Ps 46:7 name meaning, which only mentions the refrain.

Dropped as queued. Branch origin/claude/project-thread-1eyqzh (tools/wordplay/runs.txt, last entry 2026-11-01 01:25Z) shows the Wordplay thread restarting its figure wave under PR #63 rules. A pilot, wf_654f4869-6e1, started today, and 61 wave-plan shards are to follow. fig/figwrite.js writes all 13 live forms.
- Its figure leads (r3/figcands.py: 3,026 candidates over 2,829 verses, 531 batches) come from Bullinger's Metonymy, Synecdoche and Parallelism indexes. They also come from a commentary scan (r3/figscan.py) for "parallelism", "antithetic", "parallel lines/clauses/members", "metonym", "synecdoch" and "contrast".
- Its 185 contrast batches (bcon1c-5c) sweep the narrative books. r3/add_catalogue_leads.py feeds catalogue.md section 7's contrast rows in as leads.
- So these gaps are queued, and I dropped them: Said twice (same), Opposite lines, Lines that build, Lines that take turns, and Character contrasts (which includes Romans 10:21).
- The Bullinger parts of the mirror and synecdoche items are queued too, so those two items are cut down to what the scan cannot find. "Chiasm", "chiasmus" and "merism" are not among its search terms.
- One caveat: the Bullinger index file itself (r3/fos_index.json) is not on GitHub, so I could not list it verse by verse.
- Not queued: anthropopatheia, prosopopoeia, simile and metaphor. No lead family targets them, though the writer may take one up if a lead suggests it. Every form missing from figure-forms.json is also outside Wordplay's scope.

Corrections to the claim:
- Chrysostom and the Catena Aurea are on the `quotable` list, so only the church-fathers group source is barred.
- Contrast sides are not tied to the note's chapter or book. extra_figures.rs checks only `ref` (one chapter, in the file's book) and `lines` (inside `ref`). So "sides must sit in one chapter" is wrong. Only a note's own `ref` and its lines must sit in one chapter.
- The figures build does check strength against the writer count (strength_for), unlike Layers. It also refuses a source cited twice in one note.
- A cite's `on` may name another verse. So JFB on Job 1:1 for a Genesis note would pass the build, credited to Fausset.
- Nave's is already pinned in sources.json as an index only. CLAUDE.md bars showing its lines, so it cannot join the cite list, and I removed it.
- unfoldingWord's notes have no named writer. The figures build refuses words whose writer is unnamed, so it could be a lead source at most.
- The cloud card's "Not yet found in a listed writer" for the numerical saying is confirmed, in extra.py and figures-to-add.html. So is the Proverbs 30:18 card, and that card should be corrected.

The founder decision on whether to build the literary-devices feature is still open (HANDOFF section 8, row 14).

## Reader 2: Character contrasts (foils)

I checked every claim against main at fad2d5e, all remote branches, the one open PR (#66, which is unrelated) and the two cloud folders. All of the gaps hold up. Main has one contrast note, 1-samuel-1-2-contrast. config/figures/ holds only 1Sam, Gen, Isa, Matt and Ps, and Gen and Matt contain figure notes, not contrasts. config/layers.json has no contrast kind. No remote branch has a figures file beyond those five. The cloud figures README lists only the five seed notes. The only contrast queued in wordplay/round3 is romans-10-21, and it has not been written in the figures format. No output from the character-contrast run is anywhere in the folders I was allowed to read.

The recounts are correct. Under figure-forms.json `quotable` and the writers named in layer-sources.json: 7 rows have 3 or more writers (1, 4, 25, 29, 33, 37, 40), 18 rows have 2, 13 rows have 1, and row 34 has 0. romans-10-21 has 2 writers: Poole on Romans is Richard Mayo, plus Benson. Wesley is not quotable, and his New Testament notes count as Bengel anyway. Spurgeon is cited only on Psalms 104 to 118. church-fathers lists no City of God. extra_figures.rs refuses a note that crosses a chapter (around line 520). Panel.tsx caps the strip at 40 ticks. mapKinds.ts has no foil kind.

I changed three things in the list:
1. The Psalm 1 whole-psalm contrast was listed twice, as catalogue row 25 and as mock entry ps1-two-ways. I merged the two into the first gap.
2. Two source suggestions broke the rule that a cite needs a writer layer-sources.json names for that book:
   - Poole has no named writer outside Genesis to Song of Solomon, Isaiah 1 to 58, and Romans, so he cannot be a third writer for any New Testament pair except in Romans.
   - Henry's words count only for Genesis to Acts (plus Simon Browne on 1 Corinthians and William Tong on Revelation), so he cannot be quoted on 3 John.
   - JFB on Romans is Brown, not Fausset.
3. I added a format point. Paul does not name Sarah in Galatians 4, so the BSB of Galatians 4 most likely does not either. A side's `who` must be named in its verses, so that side would be "the free woman". I could not check this against the BSB text, because there is no local copy in this container.

The mock-tools files (devices.src.json, content.py) are not in the repository. Their entries are taken on the earlier report's word.

## Reader 3: Wordplay and double meanings

I checked every claimed gap against these sources:
- live main fad2d5e: config/layers.json (1,265 passages), config/figures/*.json, config/figure-forms.json, config/hard-verses.json and web/src;
- round 3 in /mnt/project-files/bible-atlas/wordplay/round3/ (the 2026-10-25 r3-new-passages.json with 216 passages, r3-additions.json with 11 entries, held/r3-held-back.json, r3-moved-to-figures.json);
- the shared figures folder (config, built and catalogue);
- the Wordplay tools branch claude/project-thread-1eyqzh;
- open PR #66.

None of the 18 items is live or queued. The 1eyqzh branch only takes the catalogue's section 7 contrast rows as leads, through tools/wordplay/r3/add_catalogue_leads.py. The Matthew 23:37 entry in hard-verses.json is about free will, not the doubled name. Round 3's luke-13-35 mentions the Luke 13:34-35 lament but has no note on the doubling. web/src has no Epizeuxis, Polyptoton or Eironeia notes. No Deep figure form exists yet for doubling, doubled verbs or irony: figure-forms.json has 13 forms and none of these.

I checked the BSB wording of every verse against the pinned bsb-usfm commit 48a9feb. The claims hold:
- Genesis 2:16 'eat freely' and 2:17 'surely die'
- Genesis 3:4 'not surely die'
- Genesis 37:33 'surely been torn'
- Luke 22:15 'eagerly desired'
- Acts 7:34 'indeed seen'
- Exodus 3:16 'surely attended'
- Psalm 93:3, where the BSB gives 'floodwaters', 'rivers' and 'seas'

I checked the writer counts against config/layer-sources.json. Two corrections:
- Amos 4:4 has 6 writers, not 7. Wesley's Old Testament notes have counts_as matthew-henry, so Wesley and Henry count once.
- On 1 Corinthians 4:8 the Henry text is by Simon Browne, so the credit must name him. The count stays at 7.

The other mappings are right:
- Keil and Delitzsch: Keil wrote Genesis, Exodus, Samuel, Jeremiah and Amos; Delitzsch wrote Psalms and Isaiah.
- JFB: Jamieson wrote Genesis to Esther, Fausset Job to Malachi and 1 Corinthians, Brown Matthew to Romans.
- Barnes on Genesis is Murphy. No item counts Barnes on 1 Kings, where the text is Rawlinson's, or on Judges, where it is Hervey's.
- The Pulpit Commentary is kept off Jeremiah, and JFB is dropped on Acts 9:4 because its note there quotes De Wette, a critic.

No item breaks a CLAUDE.md citation rule once these are applied.

The side finding on empty evidence is checked too: exactly the six named live notes have empty evidence, and round 3 does not touch them. Nothing was changed.

## Reader 4: Designs and build plans

I checked each claimed gap against origin/main at 547d0ff, the remote branches, open PRs (#66 is the only one), and the shared wordplay/round3 and figures folders. Nothing in the repo was changed. Main has moved two commits since fad2d5e. #65 (merge 547d0ff) is a site-code-only layout fix with an unchanged build id; #66 (blank screen on scroll) is open. Neither touches the literary or voices work.

**Dropped (2):**
- **More device notes beyond the 5 seeds.** This work is queued, not missing. The Wordplay thread's branch `claude/project-thread-1eyqzh` (tools/wordplay/README.md and runs.txt) has the figure pipeline (`fig/figwrite.js`, `figcheck.py`, `figpost.py`) ported to #63's credit rules. A pilot run `wf_654f4869-6e1` started on 2026-11-01. 61 figure-wave shards are planned for metonymy, synecdoche and parallelism from Bullinger's index. Contrast waves are seeded from the local `catalogue.md` section 7 contrast rows (`r3/add_catalogue_leads.py`). `r3-moved-to-figures.json` (romans-10-21) still stands. The founder examples that need new forms (Genesis 1:1 merism, Psalm 8:1 and 8:9 bookends, Psalm 139:8) are covered by the forms and structure items below.
- **Phone layout for devices.** Already live. Every extra, figures included, opens through `web/src/ui/extras/Sheet.tsx`, which is a bottom sheet with a close button at 900 px wide and below. `figures.css` already has rules for 900 px, 420 px and touch screens (`pointer: coarse`), with a ladder step per line. What is still open is only the founder's choice of putting the mirror outline under the verse or in its own sheet. That choice is in the founder-questions item, and the ladder cap belongs to the unbuilt structure extra.

**Amended (1):**
- **Forms.** I removed "anthropomorphism apart from anthropopatheia". The live `anthropopatheia` form already covers human parts: its definition is "human passions, actions, or attributes" and its about line is "feelings, actions or parts". So Isaiah 53:1 "His arm" fits a live form. I also noted that merism has no Bullinger heading and no listed writer defines it yet (per `figures/catalogue/figures-to-add.html`, 2026-10-24).

**Confirmed (21):**
- No poetry lines: no poetry field, and `\q` marks are dropped.
- `figures.extra.tsx` declares `level: 'deep'`.
- extra_figures.rs line 520 refuses a note whose verses cross a chapter.
- mapKinds.ts has only quote, echo and parallel.
- LayersCard stands apart from the figures extra.
- App.tsx line 136 still runs `void loadLayers(atlas)` at boot.
- layers.rs checks only that a strength label is on the STRENGTHS list, not the writer count.
- docs/FOUNDER-DECISIONS.md records no literary-design answers, and HANDOFF section 8 row 14 is still open.
- No `config/voices/` and no Origen handling (Didymus appears only as Thomas's name).
- No `miniz_oxide` crate; the only mirror branch is `mirror/potion-base-8M`.
- Neither `luther` nor `keach` is on the cite list. Clarke is an interpreter there and on the figures `quotable` list, while VOICES-SHORTLIST says to leave Clarke out over the Sonship.

None of the surviving items breaks CLAUDE.md citation rules. Every writer named is on the cite list, or (Luther, the four Fathers, the Puritans, Keach and De Laune) is a Protestant, Catholic or Orthodox Christian writer approved in decisions 1 to 5 and 23. Origen and the other condemned writers are only being removed.

# The items, by who should pick them up

## For the Wordplay thread (find and cite)

- **Mirror (chiasm) examples the queued wave will not find, those named only as 'chiasmus': Keil and Delitzsch at 1 each on Prov 22:1, Isa 40:21, Prov 10:3, 14:31, Ps 56:8, 63:8, 148:8, Job 17:1, 27:19; Philemon 5 (Bengel, Greek order)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md sections 3 and 4
  - Now: Only Isa 6:10 is live. Bullinger's mirror examples (Matt 7:6, 2 Chr 32:7-8, Gen 3:19, 2 Sam 3:1, Gal 2:16, Gen 4:4-5) are within Wordplay's queued figure wave (Bullinger's Parallelism index), so they are left out here. The wave's commentary scan (r3/figscan.py) does not search for 'chias', so these are not queued
  - Needs: A second writer for each to rise above 'some interpreters'; Philemon 5 must be drawn on the Greek words (TAGNT); Keil and Delitzsch's words on Proverbs 1 are left out (denies), which affects none of these
  - Why: One-verse chiasms that a named believing writer states, which fit tier 1 of the catalogue's evidence bar
- **God in human terms beyond Gen 6:6. Ex 32:14: Bullinger, Clarke, Keil and Delitzsch, Henry and JFB on 32:7 = 5. At 3: Gen 18:21 (Bullinger, JFB, Calvin) and Ps 2:4 (Bullinger, JFB, Clarke). At 2: Gen 11:5 (Henry, Keil and Delitzsch), Jonah 3:10 (JFB, Calvin), Gen 8:21 (Bullinger, Calvin), Ps 44:23 (Henry, Clarke), Isa 53:1 (Bullinger, JFB). 1 Sam 15:11 with 15:29 (Keil and Delitzsch only, once Gill, Wesley and the Concise are dropped). Bodily pictures, Bullinger only: Ex 15:6, Ps 8:3, 2 Chr 16:9, Gen 22:12**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 8; sources.md section 5
  - Now: Only Gen 6:6 is live. None of the queued wave's lead families (metonymy, synecdoche, parallelism, contrast) targets it. Gen 18:21, Gen 8:21 and 1 Sam 15:29 carry live Layers allusion notes on other points, not this figure
  - Needs: Limits to respect: no theophanies (Gen 3:8, Gen 18 as an appearance), never Christ's body, Isa 53:1 read of the Messiah. Show both believing views on whether God's feelings are real (Keil and Delitzsch against Calvin and Bullinger). Ellicott on Jonah (Aglen) is excluded
  - Why: One of the founder's three named devices (anthropomorphism); Bullinger lists 779 verses, and several examples are 'widely agreed'
- **Personification (prosopopoeia). Isa 55:12, trees clap their hands: Bullinger, Clarke, Keil and Delitzsch = 3 quotable. Ps 98:8: Calvin's own words, Barnes, Clarke = 3 (Bible Hub's 'most beautiful prosopopoeia' is translator's footnote 113, not Calvin). Hab 2:11: JFB, Calvin = 2. Bullinger only: Gen 4:10, Jas 1:15, 1 Cor 13:4, Job 28:22, Lev 18:25, Ps 85:10**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 9; sources.md section 5
  - Now: Form `prosopopoeia` live; 0 notes; no lead family in the queued wave targets it. Gen 4:10's live Layers notes are on names, 'bloods' and Hebrews, not the personification
  - Needs: Wisdom in Prov 8 stays out unless both believing readings (personification, Christ the Wisdom of God) are shown with their writers. Ellicott on Psalms (Aglen) is excluded
  - Why: One of the founder's named devices; a live form with no example; Isa 55:12 is 'widely agreed'
- **Simile and metaphor. At 4: Ps 23:1 (Bullinger, JFB, Henry, Calvin) and John 15:5 (Bullinger, Henry, JFB, Clarke). At 3: Matt 5:13 (Bullinger, Henry, Calvin) and Ps 42:1 simile (Bullinger, Henry, Calvin). At 2: Ps 1:3-4 (Bullinger, Clarke), Isa 40:6 (Bullinger, Keil and Delitzsch), Hos 6:4 (Henry, Keil and Delitzsch). The implied picture (Bullinger's Hypocatastasis): Matt 16:6 (Bullinger, Henry, Calvin = 3), Ps 22:16 (Bullinger, Keil and Delitzsch), Acts 20:29 (Bullinger, Barnes)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 12
  - Now: Forms `simile` and `metaphor` live; 0 notes; no lead family in the queued wave targets them; no form for the implied picture. John 15:1-2 has live Layers notes (vine allusions, airei/kathairei wordplay), not on 15:5
  - Needs: Never label Matt 26:26 ('This is My body'); keep John's 'I am' notes to the picture; decide whether hypocatastasis gets its own form or is explained under metaphor
  - Why: The most common figures in Scripture, with two live forms that are empty; Ps 23:1 and John 15:5 are 'widely agreed'
- **The doubled verb (Polyptoton), catalogue examples not in round 3: Gen 2:16-17 'dying you shall die' (Bullinger, Henry, Clarke, Keil and Delitzsch = 4); Luke 22:15 (Bullinger, Clarke, Barnes = 3); Acts 7:34 (Bullinger, Barnes, Calvin = 3); Gen 3:4 (Bullinger, Keil and Delitzsch = 2); Gen 37:33 and Ex 3:16 (Bullinger 1)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 16 (The doubled verb)
  - Now: None live (no Layers passage on any of these verses). Round 3 (2026-10-25/r3-new-passages.json) queues the same device only on Ex 15:1, Ps 40:1, Heb 6:14 and Mark 4:12, as Layers wordplay notes; not a figures form, so outside Wordplay's figure wave
  - Needs: Fits the round 3 Layers wordplay pattern: a reads record for each cite under PR #63's rules
  - Why: Gen 2:17 is the clearest case, the BSB hides it ('surely'), and it is 'widely agreed'
- **7 foil pairs that still have 3 or more quotable writers: 1 Cain and Abel (Gen 4:2-8; Heb 11:4, 1 John 3:12; Henry 4:3, Clarke 4:5, Calvin 4:4), 4 Sarah and Hagar (Gal 4:22-31; Fausset in JFB on Gal 4:27, Barnes 4:21, Calvin 4:22), 25 the righteous and the wicked, Psalm 1 as a whole-psalm contrast, 1:1-3 against 1:4-6 (Henry 1:1, Clarke 1:1, Delitzsch in K&D 1:4; the mock entry ps1-two-ways also cites Spurgeon), 29 Mary and Martha (Luke 10:38-42; Brown in JFB 10:39 and 10:42, Calvin 10:38, Bengel 10:39), 33 Pharisee and tax collector (Luke 18:9-14; Henry 18:9, Brown 18:11, Barnes 18:13, Calvin 18:14, Bengel 18:10-11), 37 the two criminals (Luke 23:32-43; Brown 23:43, Barnes 23:42, Calvin 23:41), 40 Adam and Christ (Rom 5:12-21; Bullinger FoS Antithesis 5:19, Brown 5:15, Barnes 5:12, Calvin 5:12, Clarke 5:12)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 7, table rows 1, 4, 25, 29, 33, 37, 40. Psalm 1 is also in mock-tools/devices.src.json entry ps1-two-ways and content.py CHAPTER['ps1'], with split_note "as Spurgeon divides the psalm". mock-tools is not in the repository.
  - Now: Absent, and not queued on any remote branch. config/figures/ has a contrast only in 1Sam.json. Gen.json has only the 6:6 anthropopatheia figure. There are no Gal, Luke or Rom files. Ps.json has only the 1:6 parallelism (opposite) note, not the whole-psalm contrast.
  - Needs: A dated reads or quote-check record for each quote, on the Bible Hub chapter page or a pinned copy. For row 40, confirm that Figures of Speech (not only the Companion Bible) lists Romans 5:19 under Antithesis, and give the page. For Psalm 1, credit the split to the psalm's own "Not so the wicked!" (1:4), not to Spurgeon.
  - Why: These are the strongest pairs: widely agreed even without the writers who cannot be quoted. Each needs a figures note, each quote read again on a dated page, and a quote-check record in docs/evidence/. The catalogue quotes were read on 2026-10-20 in local copies, with no url, read or retrieved fields. For Psalm 1, Spurgeon cannot be quoted in a figure note, and layer-sources.json cites him only on Psalms 104 to 118, so the mock's 4 writers drop to 3. The 1-3 / 4-6 split may not be credited to him. For Sarah and Hagar, Galatians 4 never names Sarah, so that side's `who` has to be "the free woman" to pass the build (not checked against the BSB here).
- **18 pairs at 2 quotable writers (commonly held): 2 Cain's and Seth's lines (Henry 4:25, Calvin 4:25), 5 Isaac and Ishmael (Fausset in JFB Gal 4:29, Barnes Gal 4:29), 6 Jacob and Esau (Calvin 25:27, Henry 25:29), 7 Leah and Rachel (Henry 29:31, Calvin 29:18), 12 Samuel and Eli's sons (Henry 2:11, Keil 2:17-18), 13 Saul and David (Bullinger 2 Sam 3:1, Henry 1 Sam 16:14), 15 Abigail and Nabal (Henry 25:2, Keil 25:3), 16 David and Uriah (Henry, Clarke 11:11), 17 Naaman and Gehazi (Keil 5:27, Clarke 5:27), 20 Mordecai and Haman (Henry 6:1, Jamieson in JFB 7:10, 8:2), 23 Jonah and the sailors (Fausset in JFB 1:5, Henry 1:4), 26 Zechariah and Mary (Brown 1:34, Calvin 1:18), 28 Simon and the sinful woman (Barnes 7:45, Calvin 7:44), 30 Good Samaritan (Barnes 10:30, Calvin 10:30), 35 Mary of Bethany and Judas (Henry, Clarke John 12:1), 36 Peter and Judas (Henry Matt 27:3, Fausset in JFB 2 Cor 7:10), 38 Barnabas and Ananias (Barnes 5:1, Henry 5:1), 39 Diotrephes and Demetrius (Fausset in JFB 3 John 12, Barnes 3 John 11)**
  - Where in the local work: catalogue.md section 7 rows 2, 5, 6, 7, 12, 13, 15, 16, 17, 20, 23, 26, 28, 30, 35, 36, 38, 39
  - Now: Absent from config/figures/ on main and on every remote branch. Only 1 Samuel 25:3 has related wording: a plain-meaning Layers note (Keil) in the cloud's round-3 files (wordplay/round3/2026-10-25/r3-new-passages.json), not yet on main and not a contrast.
  - Needs: A third quotable writer whom layer-sources.json names for that book: Benson, Ellicott, Maclaren, Edersheim, Calvin, Clarke or Bengel (New Testament). Poole has a named writer only on Genesis to Song of Solomon, Isaiah 1 to 58 and Romans, so he cannot serve for rows 26 to 39. Henry is credited only for Genesis to Acts, so he cannot serve for 3 John. The Pulpit Commentary is linked only, never quoted. For row 13, confirm the 2 Samuel 3:1 entry and its page in Figures of Speech, not only the Companion Bible. For row 12, the Repeated Alternation layout of 1 Samuel 1:1 to 4:1 is the Companion Bible's, which cannot be quoted.
  - Why: The catalogue labels 10 of these widely agreed: rows 2, 5, 6, 12, 15, 16, 26, 36, 38, 39. That count relied on Gill, Augustine or the Companion Bible, which the figures build cannot quote. So each must ship as commonly held, or get a third quotable writer with a fetched URL and an exact quote.
- **13 pairs with 1 quotable writer, and 1 with none: 3 Abram and Lot (Clarke 13:18), 8 Caleb and Joshua against the ten (Jamieson in JFB Num 14:24; Gill dropped), 9 Ruth and Orpah (Henry 1:6), 11 Hannah and Eli (Henry 1:9), 14 Saul and Jonathan (Henry 14:1), 18 Ahaz and Hezekiah (Keil 2 Chr 29:3), 19 Vashti and Esther (Henry 2:1), 21 Jeremiah and Hananiah (Calvin 28:1), 22 Nebuchadnezzar and Belshazzar (Calvin Dan 5:17), 24 Wisdom and Folly (Delitzsch Prov 9:13), 27 Magi and Herod (Henry Matt 2:1), 31 Prodigal and elder brother (Clarke 15:25; Gill dropped), 32 Rich man and Lazarus (Henry 16:19; the Concise version is the same writer and cannot be quoted), 34 Rich ruler and Zacchaeus (Gill 19:2 only, so 0)**
  - Where in the local work: catalogue.md section 7 rows 3, 8, 9, 11, 14, 18, 19, 21, 22, 24, 27, 31, 32, 34
  - Now: Absent, and not queued
  - Needs: A second quotable interpreter for each, named by layer-sources.json for that book, with a fetched URL and an exact quote (Poole is not usable on Jeremiah, Daniel or the Gospels). Row 34 needs at least one.
  - Why: These would ship as some interpreters at best. Row 34 has no writer the figures build can quote, so it cannot go in until a writer is found. Rows 8 and 31 lose their second writer because Gill cannot be quoted.
- **romans-10-21 contrast: disobedient Israel (10:21) against whoever believes and confesses (10:9-10). Cites: Poole, Wesley, Benson**
  - Where in the local work: /mnt/project-files/bible-atlas/wordplay/round3/r3-moved-to-figures.json (cloud; this pair is not in the local catalogue)
  - Now: Absent: there is no config/figures/Rom.json on main or any branch. round3/README.md says the thread "will redo it in that format", and the 2026-10-25 README says the file "still stands", but it has not been rewritten.
  - Needs: A third quotable writer on Romans 10:21, such as Barnes, Brown in JFB (JFB on Romans is Brown), Calvin or Bengel
  - Why: It is labelled widely agreed, but Wesley cannot be quoted (and his New Testament notes count as Bengel), and Poole on Romans is Richard Mayo under layer-sources.json. That leaves 2 writers (Mayo, Benson): commonly held. Benson is cited on 10:18, not 10:21. The `who` of each side must also be named in the BSB of its verses, which has not been checked.
- **Held-back rows 45 to 50: Judah and Joseph (Gen 38-39), Rahab and Achan (Josh 2; 7), Gideon and Abimelech (Judg 8-9), Jael and Sisera's mother (Judg 5:24-30), Elijah and the prophets of Baal (1 Kgs 18:20-40, optional), Nicodemus and the Samaritan woman (John 3-4)**
  - Where in the local work: catalogue.md section 7 rows 45-50
  - Now: Absent
  - Needs: A quotable writer stating each contrast, or leave them out
  - Why: No writer was found who states these contrasts, so they are held back. The catalogue suggests Woudstra for row 46. In layer-sources.json Woudstra's only work is woudstra-genesis-3-15, and his Joshua commentary is copyrighted, so it could be cited and linked but not quoted in a figure note.
- **Genesis 2:17 (with 2:16): the doubled verbs 'dying you shall die' and 'eating you shall eat', which the BSB gives as 'surely die' and 'eat freely'**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md, doubled-verb table (about line 681); also the closing notes, item 5 (about line 884)
  - Now: Not live, not in round 3 and not on any branch. On main, Genesis 2:17 appears only as a ref in the hosea-6-7 allusion. figures-to-add.html uses it as the sample verse for Polyptoton, but no note exists. No Polyptoton form is in figure-forms.json.
  - Needs: Bullinger, Figures of Speech, under Polyptoton. Matthew Henry ('Dying thou shalt die, denoting a sure and dreadful sentence'). Adam Clarke ('Literally, a death thou shalt die'). C. F. Keil (Keil and Delitzsch, Pentateuch vol. I): the infinitive 'intensifies the latter'. That is 4 writers, so 'widely agreed'. Do not use Barnes on Genesis, which is James G. Murphy's text. Use passage id genesis-2-17 with Genesis 2:16 in refs. Each cite needs a reads record from the linked page.
  - Why: A clear Hebrew figure that the BSB hides, and the best-supported doubled verb in the local work.
- **Genesis 3:4: 'You will not surely die', the serpent's 'dying you shall not die', which turns God's doubled verb against Him**
  - Where in the local work: literary/catalogue.md, doubled-verb table (about line 682)
  - Now: Not live and not in round 3. On main the verse appears only in the john-8-44 allusion, with no note on the doubled verb.
  - Needs: Bullinger, under Polyptoton ('Here the serpent emphatically denies Jehovah's words'). Keil ('ye will positively not die'). That is 2 writers, so 'commonly held'.
  - Why: Pairs with Genesis 2:17: the serpent echoes God's emphatic form in order to deny it.
- **Genesis 37:33: 'Joseph has surely been torn to pieces!', literally 'tearing, he is torn'**
  - Where in the local work: literary/catalogue.md, doubled-verb table (about line 683)
  - Now: Not live and not in round 3. On main, genesis-50-20 mentions 37:33 only for a different wordplay.
  - Needs: Only Bullinger, under Polyptoton ('The figure employed shows the intensity of Jacob's feelings'). That is 1 writer, so 'some interpreters', unless a second interpreter is found (record the fetched URL and the exact quote).
  - Why: The doubled verb carries Jacob's grief.
- **Luke 22:15: 'I have eagerly desired', literally 'with desire I have desired'**
  - Where in the local work: literary/catalogue.md, doubled-verb table (about line 684)
  - Now: Not live and not in round 3.
  - Needs: Bullinger, under Polyptoton. Adam Clarke ('A Hebraism for, I have desired most earnestly'). Albert Barnes, Gospels volume ('This is a Hebrew form of expression, and means I have greatly desired'). That is 3 writers, so 'widely agreed'.
  - Why: A Hebrew way of speaking kept in the Greek, which the BSB smooths over. Credit the Greek wording to Luke.
- **Acts 7:34: 'I have indeed seen', literally 'seeing I have seen' (Stephen quoting Exodus 3:7)**
  - Where in the local work: literary/catalogue.md, doubled-verb table (about line 685)
  - Now: Not live and not in round 3.
  - Needs: Bullinger, under Polyptoton ('Lit. it is "Seeing I have seen"'). Albert Barnes, Acts volume ('The repetition of this word is in accordance with the usage of the Hebrew writers'). That is 2 writers, so 'commonly held'. Calvin only translates the phrase, so he does not count.
  - Why: The doubled verb from Exodus survives in Stephen's Greek.
- **Exodus 3:16: 'I have surely attended to you', literally 'visiting I have visited'**
  - Where in the local work: literary/catalogue.md, doubled-verb table (about line 686)
  - Now: Not live and not in round 3. Live exodus-3-14 and the round 3 addition to it cover a different verse.
  - Needs: Only Bullinger, under Polyptoton. That is 1 writer, so 'some interpreters', unless a second interpreter is found.
  - Why: The same doubled verb as Joseph's 'God will surely visit you' (Genesis 50:24, BSB), here fulfilled.
- **Matthew 23:37: 'O Jerusalem, Jerusalem', the doubled name**
  - Where in the local work: literary/catalogue.md, Doubling table (about line 645)
  - Now: Not live and not in round 3. The only live Epizeuxis notes are isaiah-28-10 and revelation-18-2. Round 3's luke-13-35 cites the parallel lament but says nothing of the doubling. The Matthew 23:37 entry in hard-verses.json is about free will.
  - Needs: Bullinger, under Epizeuxis. Matthew Henry ('The repetition is emphatical, and bespeaks abundance of commiseration'). David Brown, JFB ('the redoubling of the opening word'). John Gill ('The word is repeated to show our Lord's affection'). Calvin ('implied in the repetition of the name'). That is 5 writers, so 'widely agreed'.
  - Why: The best-supported doubling in the local work, and one a reader would notice at Simple.
- **Luke 10:41: 'Martha, Martha'**
  - Where in the local work: literary/catalogue.md, Doubling table (about line 647)
  - Now: Not live and not in round 3.
  - Needs: Bullinger, under Epizeuxis. Matthew Henry ('he speaks as one in earnest'). David Brown, JFB ('emphatically redoubling upon the name'). Gill ('great intimacy and friendship'). That is 4 writers, so 'widely agreed'.
  - Why: A doubled name that shows Jesus' earnestness and affection.
- **Acts 9:4: 'Saul, Saul, why do you persecute Me?'**
  - Where in the local work: literary/catalogue.md, Doubling table (about line 648)
  - Now: Not live and not in round 3.
  - Needs: Bullinger, under Epizeuxis. Albert Barnes, Acts volume ('The repetition of the name would fix his attention'). Gill ('doubled to denote vehemency and affection'). That is 3 writers, so 'widely agreed'. Leave JFB out: its note there quotes De Wette, a critic.
  - Why: A doubled name at the call of Paul.
- **2 Samuel 18:33: 'O my son Absalom! My son, my son'**
  - Where in the local work: literary/catalogue.md, Doubling table (about line 644)
  - Now: Not live and not in round 3.
  - Needs: Bullinger, under Epizeuxis. Gill ('which repetition expresses the vehemence of his affections'). Robert Jamieson, JFB ('the redundancy and vehemence of his mournful ejaculations'). That is 3 writers, so 'widely agreed'.
  - Why: The repetition carries David's grief.
- **Jeremiah 22:29: 'O land, land, land'**
  - Where in the local work: literary/catalogue.md, Doubling table (about line 649)
  - Now: Not live and not in round 3.
  - Needs: Bullinger, under Epizeuxis. C. F. Keil, Keil and Delitzsch on Jeremiah ('The triple repetition of the summons ... gives it a special emphasis'). Gill ('the word is repeated three times'). Calvin ('the repetition was not superfluous'). That is 4 writers, so 'widely agreed'. The Pulpit Commentary is never cited on Jeremiah.
  - Why: A threefold summons, which the BSB keeps.
- **Genesis 22:11: 'Abraham, Abraham!'**
  - Where in the local work: literary/catalogue.md, Doubling table (about line 646)
  - Now: Not live and not in round 3. On main, genesis-22-14 mentions 22:11 only in a plain-meaning note.
  - Needs: Bullinger, under Epizeuxis. Gill ('calls him by name, and doubles it, to raise a quick and immediate attention'). That is 2 writers, so 'commonly held'.
  - Why: A doubled name at the binding of Isaac.
- **Isaiah 6:3: 'Holy, holy, holy'**
  - Where in the local work: literary/catalogue.md, Doubling table (about line 643); also the Epizeuxis sample verse in /mnt/project-files/bible-atlas/figures/catalogue/figures-to-add.html
  - Now: Not live and not in round 3. Live revelation-4-8 quotes the verse only in an allusion. Round 3's isaiah-6-2 is a different verse and does not mention 6:3.
  - Needs: Bullinger, under Epizeuxis. Calvin ('this repetition rather points out unwearied perseverance'). That is 2 writers, so 'commonly held'. Calvin warns against resting proof of the Trinity on the threefold 'holy' alone, so the note must not make that argument.
  - Why: The best-known doubling in Scripture.
- **1 Samuel 15:11, 15:29 and 15:35: one Hebrew verb, nacham, is 'regret' in 15:11 and 15:35 and 'change His mind' (twice) in 15:29. God 'regrets', yet 'He is not a man, that He should change His mind'**
  - Where in the local work: literary/catalogue.md, section 8 (about line 383); mock-tools/devices.src.json entry 'sam15-key'; mock-tools/content.py
  - Now: Partly live. The live figure note in config/figures/Gen.json (Genesis 6:6) links nacham to 1 Samuel 15:29. Live 1-samuel-15-29 has a plain-meaning note and a Numbers 23:19 allusion. Live genesis-5-29 notes nacham in Genesis 5:29 and 6:6. No live or queued note sets out the play inside 1 Samuel 15 itself, and none is in round 3. The god-relents card in hard-verses.json touches these verses but is not a wordplay note.
  - Needs: Only C. F. Keil (Keil and Delitzsch, Books of Samuel), on 15:29, sets it against 15:11 ('theomorphically' and 'anthropomorphically'). That is 1 writer, so 'some interpreters'. Gill, Wesley (who counts as Henry) and Henry's Concise do not state the shared word, so they do not count. A second interpreter who states it is needed for a higher strength.
  - Why: A real double use of one word in one chapter, and Scripture's own key to God's 'regret'.
- **Judges 14:14: Samson's riddle, 'Out of the eater came something to eat, and out of the strong came something sweet'**
  - Where in the local work: literary/catalogue.md, 'Riddle and proverb' table (about line 808)
  - Now: Not live and not in round 3. The live riddle notes are habakkuk-2-6, john-1-15, john-2-19 and 1-corinthians-13-12.
  - Needs: Only Bullinger, under Aenigma; the catalogue names no commentator. That is 1 writer, so 'some interpreters'. A second interpreter is needed for a higher strength.
  - Why: The Bible's best-known riddle. The text calls itself a riddle.
- **Psalm 93:3: the same Hebrew word, neharot (rivers), three times, and the same verb three times. The BSB varies the words ('floodwaters', 'rivers', 'seas'; checked in the pinned bsb-usfm) and so hides the repetition**
  - Where in the local work: literary/catalogue.md, section 3 (about lines 120 and 146)
  - Now: Not live as a Layers note or a figure note, and not in round 3. Live config/figures/Ps.json covers only Psalm 1:6.
  - Needs: Franz Delitzsch (Keil and Delitzsch, the Psalms): 'The thought is unfolded in a so-called "parallelism with reservation."' That is 1 writer, so 'some interpreters'.
  - Why: The clearest case found where the BSB hides a repeated Hebrew word. It may fit better as a Deep parallelism note (form 'building') than in Layers.
- **Verbal irony, saying the opposite of what is meant, in eight verses: 1 Kings 18:27, Job 12:2, 1 Corinthians 4:8, Amos 4:4, 1 Kings 22:15, Mark 7:9, 2 Corinthians 12:13, Judges 10:14**
  - Where in the local work: literary/catalogue.md, section 13 (lines 574 to 585)
  - Now: None of the eight verses has a Layers note, a figure note or a round 3 note. The live 'irony' kind covers situational irony. figure-forms.json has no irony form. figures-to-add.html lists Eironeia, with Judges 10:14 as its sample.
  - Needs: Corrected counts from the catalogue's lists:
- 1 Corinthians 4:8: 7 writers (Bullinger, Henry, JFB's Fausset, Clarke, Barnes, Gill, Calvin). The Henry text on 1 Corinthians is by Simon Browne, so credit him.
- Amos 4:4: 6 writers, not 7 (Bullinger, Henry, Keil, Clarke, Gill, Calvin). Wesley's Old Testament notes count as Henry.
- 1 Kings 22:15: 6 (Bullinger, Henry, Jamieson, Clarke, Keil, Gill).
- 1 Kings 18:27: 5 (Bullinger, Jamieson, Clarke, Gill, Henry).
- Job 12:2: 5 (Bullinger, Fausset, Clarke, Delitzsch, Gill).
- 2 Corinthians 12:13: 4 (Bullinger, Barnes, Gill, Calvin).
- Mark 7:9: 3 (Bullinger, Clarke, Gill).
- Judges 10:14: 2 (Bullinger, Gill).
Keach and De Laune are not on the cite list. Genesis 3:22 is left out: believing writers differ on whether it is irony, so it either shows both readings or stays out.
  - Why: Speech whose meaning is the opposite of its words, which a reader can easily miss. Several verses are well attested.
- **Forms in the local designs missing from config/figure-forms.json: climax (one of the founder's four parallelism forms), merism (Genesis 1:1 'the heavens and the earth', Psalm 139:2), hyperbole, bookends (inclusio), refrain; plus the catalogue's other recommended first additions (rhetorical question, euphemism, hendiadys, irony, saying less, word doubled, many 'and's, acrostic, apostrophe, type)**
  - Where in the local work: fit.md 4.1 and 5.1; /mnt/project-files/bible-atlas/figures/catalogue/figures-to-add.html (2026-10-24, '12 to add first' and 'Patterns Bullinger does not name')
  - Now: 13 forms live: same, opposite, building, mirror, turns, metonymy, synecdoche, anthropopatheia, prosopopoeia, simile, metaphor, contrast, likeness. Wordplay's queued figure waves write only to existing forms. Anthropomorphism ('His arm', Isaiah 53:1) is already covered: the live anthropopatheia form defines it as 'human passions, actions, or attributes' and labels it 'feelings, actions or parts'
  - Needs: Bullinger, Figures of Speech (1898), archive.org figuresofspeechu00bull, the printed page for each form (Climax/Gradatio, Hyperbole, Epanadiplosis for bookends, Amoebaeon for refrain). Merism has no Bullinger heading and no listed writer defines it yet
  - Why: Notes on these devices cannot pass extra_figures.rs until their forms exist. Each needs a definition from a quotable cite-list writer.

## For the Layers thread (forms, data and build checks)

- **Climbing or stair-step lines (Bullinger's Anadiplosis, Climax, Anabasis; Keil and Delitzsch's 'parallelism with reservation'): Ps 121:3-4 (Keil and Delitzsch, JFB = 2); Ps 29:1-2 (Henry, Calvin = 2); Ps 93:3 (Keil and Delitzsch 1, visible only in the Hebrew: neharot three times); Ps 92:9 (Keil and Delitzsch 1); Hos 2:21-22 (Bullinger's Climax 1)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 3 (Forms and Examples tables); cloud figures-to-add 'Lines that climb like stairs'
  - Now: No form in figure-forms.json; no notes. Not in Wordplay's figure wave, whose writer (fig/figwrite.js) may use only the 13 live forms
  - Needs: A `defined` quote from Bullinger's Anadiplosis or Climax, with the page of the archive.org scan figuresofspeechu00bull
  - Why: The catalogue names it as its own kind with several writers; the BSB hides Ps 93:3, so it needs the `original` field
- **Inclusio or bookends. Ps 8:1 and 8:9: Bullinger, Henry, Clarke, Keil and Delitzsch, JFB = 5 quotable (Spurgeon and Gill do not count). Ps 118:1 and 29: Henry, JFB, Clarke, Keil and Delitzsch = 4. 2 Sam 1:19 and 27: Bullinger, Henry, JFB = 3. Ps 103:1 and 22: Bullinger, Henry = 2. Ps 146 (Bullinger 1); Matt 4:23 and 9:35 (Henry 1, crosses chapters); Eccl 1:2 and 12:8 (Bullinger, Clarke, Henry; crosses chapters; Keil and Delitzsch, Ellicott (Salmon) and the Pulpit are barred on Ecclesiastes)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 5; cloud figures-to-add 'A frame around a whole psalm'
  - Now: No form; no notes; not in round 3 or Wordplay's wave. Live Layers on 2 Sam 1:19 is only a wordplay on tsevi
  - Needs: A `defined` quote from Bullinger's Epanadiplosis with its page. Lines must lie inside the note's one-chapter ref, so the whole psalm is the ref; for the cross-chapter cases the far end goes in `refs`
  - Why: The catalogue's cleanest and easiest device to detect, at 'widely agreed' on several psalms. Bullinger defines it himself ('The Latins called it INCLUSIO')
- **Apostrophe (turning to speak to the heavens, the sea, Death): Isa 1:2 (Bullinger, Clarke, Calvin = 3); Ps 114:5 (Bullinger, Clarke = 2; Spurgeon does not count); 1 Cor 15:55 (Clarke, Barnes = 2); Deut 32:1 (Bullinger)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 9 (Apostrophe rows); cloud figures-to-add, among its 12 'to add first'
  - Now: No form; no notes. Isa 1:2 has a live Layers allusion note (the call to heaven and earth echoes Deut 32:1), which is a different point
  - Needs: A `defined` quote from Bullinger's Apostrophe with its page; keep the note's wording clear of the live Isa 1:2 allusion
  - Why: Bullinger treats it as a figure separate from Prosopopoeia; Isa 1:2 reaches 'widely agreed'
- **Synecdoche: the form has no definition, and merisms the queued scan will not find. Keil and Delitzsch only (1 each): Gen 1:1, Deut 6:7, Ps 113:3. Whether to show the modern word 'merism'**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md sections 10 and 17
  - Now: `synecdoche` is the only live figure form without `defined`; 0 notes. Bullinger's synecdoche and metonymy examples (Ps 121:8, Ps 139:2, Matt 6:11, Gen 6:12, Rom 12:1, Acts 2:41, Gen 42:38, Ps 23:5) are within the queued wave (Bullinger's Synecdoche and Metonymy indexes), so they are left out here. The scan does not search for 'merism'
  - Needs: A Bullinger Synecdoche `defined` quote with its scan page; a second writer for each Keil and Delitzsch merism; the founder's word on 'merism', since unfoldingWord, the only believing source that uses it, names no writer and cannot be quoted in a figure note
  - Why: Every note in this form will show without a definition until one is added; the cloud card itself says merism has no Bullinger heading
- **Hyperbole. John 21:25: Bullinger, Henry, Clarke, Barnes, Calvin = 5 (JFB dissents). At 3: Luke 14:26 (Bullinger, Henry, Barnes) and Gal 4:15 (Bullinger, JFB, Clarke). At 2: Ps 6:6 (Bullinger, JFB), Matt 5:29 (Bullinger, Calvin), Deut 1:28 (Bullinger, Henry; Keil and Delitzsch dissent), 1 Kgs 1:40 (Bullinger 1). Matt 19:24: proverb or hyperbole? (Henry, Ellicott)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 11; cloud figures-to-add, first of its 12
  - Now: No form; no notes (Bullinger's Hyperbole is cited once in Layers, revelation-18-5, as support only)
  - Needs: A Bullinger `defined` quote and page. Limits: never tell the needle-gate story as fact, never apply this to the Bible's numbers, show dissents
  - Why: Keeps readers from taking deliberate overstatement literally; several 'widely agreed' examples
- **Verbal irony. 1 Cor 4:8: Bullinger, JFB, Clarke, Barnes, Calvin, and Henry's continuator Simon Browne = 6. At 5: Amos 4:4 (Bullinger, Henry, Clarke, Keil and Delitzsch, Calvin) and 1 Kgs 22:15 (Bullinger, Henry, JFB, Clarke, Keil and Delitzsch). At 4: 1 Kgs 18:27 (Bullinger, JFB, Clarke, Henry) and Job 12:2 (Bullinger, JFB, Clarke, Keil and Delitzsch). Then 2 Cor 12:13 (Bullinger, Barnes, Calvin = 3), Mark 7:9 (Bullinger, Clarke = 2), Judg 10:14 (Bullinger 1)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 13
  - Now: No figures form. Layers mentions irony on other verses (john-4-10, Judg 3:15, Num 16:13, Ruth 1:1, Zeph 1:11; round 3 Jer 21:8), none on these verses
  - Needs: A Bullinger Eironeia `defined` quote and page; Gen 3:22 only with both readings (JFB and Keil and Delitzsch deny irony there)
  - Why: Missing it reverses the meaning; five or more examples reach 'widely agreed'
- **Rhetorical question (Erotesis): Jer 13:23 (Bullinger, Keil and Delitzsch, JFB, Henry = 4); Gen 18:14 (Bullinger, Henry, Clarke = 3); Ex 15:11 (Bullinger, Calvin) and Rom 8:31 (Bullinger, Clarke) at 2; John 8:46, Ps 106:2, Rom 11:34 (Bullinger 1)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 14; cloud figures-to-add, among its 12 'to add first'
  - Now: No form; no notes
  - Needs: A Bullinger Erotesis `defined` quote and page
  - Why: Low risk, and the plain statement behind the question helps readers; two examples reach 'widely agreed'
- **Numerical sayings ('three ... even four'): Amos 1:3 (Henry, JFB, Clarke = 3); Job 5:19 (JFB, Clarke = 2); Micah 5:5 (Clarke 1); Prov 6:16 and 30:18 (Keil and Delitzsch 1 each)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 15
  - Now: No form; no notes. The cloud card (figures/catalogue/extra.py and figures-to-add.html, Proverbs 30:18) says 'Who defines it: Not yet found in a listed writer', which the local catalogue contradicts
  - Needs: A `defined` quote from Keil and Delitzsch ('numerical proverb'; Delitzsch on Proverbs, whose words are left out only on Proverbs 1) or JFB on Job 5:19, since Bullinger gives none; writers differ on 'many' versus 'full measure', so a limit is needed
  - Why: Amos 1:3 is 'widely agreed', and Bullinger has no heading for it, so the definition must come from another writer; the cloud card should be corrected
- **Doubling for weight (Epizeuxis): Matt 23:37 (Bullinger, Henry, JFB, Calvin = 4); Luke 10:41 (Bullinger, Henry, JFB = 3); Jer 22:29 (Bullinger, Keil and Delitzsch, Calvin = 3); Isa 6:3, 2 Sam 18:33, Acts 9:4 at 2; Gen 22:11 (Bullinger 1)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 16 (Doubling)
  - Now: No form; none of these verses is live or in round 3 (round 3's doubled-noun notes are Gen 9:25 and Song 1:1 in Layers)
  - Needs: A Bullinger Epizeuxis `defined` quote and page; Calvin's caution that the threefold 'holy' in Isa 6:3 is no proof of the Trinity by itself; avoid JFB's De Wette gloss on Acts 9:4
  - Why: Easy to see in English; Matt 23:37 and two others are 'widely agreed'
- **Refrains and like beginnings. Refrains: Ps 136 (Bullinger, JFB, Clarke, Calvin = 4); Amos 4:6-11, 'yet you did not return' (Bullinger, Henry, JFB, Clarke = 4); Isa 9:12, 17, 21 and 10:4 (Bullinger, Henry, Keil and Delitzsch = 3; crosses chapters); Ps 46:7 and 11, Ps 80:3, 7, 19 (Bullinger, Henry = 2 each); Ps 42-43 and Rev 2-3 (Bullinger 1). Like beginnings (Anaphora): Ps 29 (Keil and Delitzsch, Henry, Calvin = 3); Ps 150 (Bullinger, Henry = 2); Matt 5:3-11 and Phil 4:8 (Bullinger 1)**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 16 (Refrains, Like beginnings)
  - Now: No form; no notes. Amos 4:9-11 have live Layers allusion notes (Deuteronomy curses), and round 3 queues a Ps 46:7 name-meaning note (immanu) that mentions the refrain; neither is the refrain figure
  - Needs: `defined` quotes from Bullinger's Amoebaeon, Cycloides and Anaphora; Isaiah 9-10 needs `refs` for the 10:4 end, or a split note, since lines must lie in the note's one chapter
  - Why: Shows how whole passages are built; several 'widely agreed'; the BSB already sets 223 refrain lines
- **Smaller figures. Euphemism: 1 Thess 4:14 (Bullinger, Barnes = 2) and Judg 3:24 (Bullinger, Keil and Delitzsch = 2; Gill does not count). Hendiadys: Acts 1:25 (Bullinger, Barnes = 2). Paradox (Oxymoron): 2 Cor 12:10 (Bullinger, Barnes = 2; Henry is not credited on 2 Corinthians). Understatement (Tapeinosis): John 6:37 (Clarke), Rom 1:16 and others (Bullinger). Many-ands and no-ands: Joshua 7:24, Luke 15:20, Exodus 15:9, Bullinger only. Riddle and proverb: pointers only**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 17
  - Now: No forms; no notes. John 11:11, death as sleep, is already a live Layers wordplay note
  - Needs: Second writers for the Bullinger-only cases. Never present John 3:5 or Matt 3:11 as hendiadys, or 'sleep' as unconsciousness (Bullinger's own views)
  - Why: The cloud catalogue's first 12 include euphemism, hendiadys, understatement and many-ands, but none has a form or note; most reach only 'commonly held' or 'some interpreters'
- **Side finding: six live wordplay or name-meaning notes have empty evidence: genesis-22-8, exodus-12-13, ruth-3-9, isaiah-5-7 and john-6-35 (wordplay) and 1-corinthians-10-4 (name meaning)**
  - Where in the local work: CITATION-AUDIT.md, section A3 (line 56), which listed seven. genesis-2-7 has evidence now.
  - Now: Checked on main fad2d5e: exactly these six have an empty evidence field, with 3 to 5 cites each. No round 3 file, branch or HANDOFF entry queues a fix.
  - Needs: The writers already cited on each note. Write the evidence from their own words on the linked pages, and add reads records in docs/evidence/.
  - Why: CLAUDE.md puts sources in the evidence field. Without it a reader at Deep cannot see which cited writer states the point.
- **Build checks fit.md proposes that are not built: (1) a parallelism note's lines checked against the BSB USFM's own lines; (2) a Nave's cross-check under ANTHROPOMORPHISMS (a reference only, never the sole source); (3) a check that Bullinger names that figure at that verse, from a mirrored text**
  - Where in the local work: fit.md 4.2
  - Now: extra_figures.rs checks lines against BSB.json text, quotes of 4 or more words, roots and writer-counted strength. It has no USFM-line, Nave's or Bullinger-by-verse check. The Wordplay figcheck.py ports the existing checks only
  - Needs: a Bullinger text mirrored to a GitHub branch and pinned; the kckern/IsaiahExplorer copy has no license and must not be used
  - Why: These would let the build itself confirm the device, not only the quotations.
- **Make layers.rs count strength by distinct interpreter writers and fail a label that claims more, as extra_figures.rs already does**
  - Where in the local work: fit.md 4.2 point 3
  - Now: Since #63, layers.rs works out each cite's writer key (resolve().key, test counts_writers_by_person) but only tallies it. The strength check is still `STRENGTHS.contains` (line 1546). CLAUDE.md on main still says 'The build does not check the count, so you must'
  - Why: fit.md calls this 'a separate decision'. Since the keys now exist, enforcing the count is a small step, and it would make the writer-count rule enforced by the build rather than by hand.

## For the Arcs and card thread (display at Deep)

- **Pairs that run across chapters and books, and sides with several ranges: Saul and David (1 Sam 15-2 Sam 3), Peter and Judas (Matt 26:69-75 and 27:3-5; Judas's side needs 26:14-16 and 27:3-5), Mary of Bethany and Judas (John 12, Matt 26, Mark 14), Sarah and Hagar (Gen 16/21 with Gal 4), the rich ruler and Zacchaeus (Luke 18-19)**
  - Where in the local work: catalogue.md section 7 rows 4, 13, 34, 35, 36; fit.md section 5 line 223 ("A foil's sides may hold several ranges"); research-results.json fit.founderQuestions (one passage only, or across chapters?)
  - Now: extra_figures.rs fails a note whose ref crosses a chapter ("a note sits in one chapter", around line 520), and each side has a single ref. web/src/ui/extras/figures/Panel.tsx spans lo..hi across both sides, capped at 40 ticks (line 300).
  - Why: With a single range per side, a Judas side cannot hold both 26:14-16 and 27:3-5. Sides in different books, such as Genesis and Galatians, would give a strip whose verse-number ends mislead. The founder has not answered the fit.md question on foils across chapters.
- **A foil link kind on the big map, and the two-column Compare view for foils (web/src/ui/extras/parallels/Compare.tsx)**
  - Where in the local work: fit.md lines 58-60, 253-254; catalogue.md line 359; research-results.json fit.recommendations (add `foil` to mapKinds.ts and colors.ts KIND; reuse Compare for Cain and Abel, Hannah and Peninnah, the Pharisee and the tax collector, Judas and Peter)
  - Now: web/src/ui/mapKinds.ts has no foil, mirror or contrast kind. Figures notes are drawn only as overlay arcs at Deep, and contrasts use the figures Panel strip, not Compare.
  - Why: The local design draws a foil as a quieter arc between the two sides on the main map, with the sides lined up verse by verse. Live shows only the two sides' labels. The founder question on new colours or lamp gold is still open.
- **Device marks at Simple and Study, not only Deep. Simple: one quiet line under the verse, only when the device is plain in the BSB or widely agreed, with a short source line. Study: the card with BSB lines, strength, Hebrew chips and both believing readings**
  - Where in the local work: mock-card.html 'How the card decides what shows'; mock-reader.html 'Rules this follows' and its level table; judging out/card-*-simple/study.txt
  - Now: figures.extra.tsx on main declares level: 'deep'; nothing shows at Simple or Study
  - Why: Every mockup puts a calm Simple line and a Study card ahead of Deep. Both mockups ask the founder whether Simple should show a device line at all, so this waits on his answer (see the founder-questions item).
- **Multi-verse and cross-chapter structures: a `structure` extra (config/structures.json, extra_structure.rs, extras/structure.json plus per-book files, a ladder panel, an arc strip) for bookends, alternation, refrains, long mirrors and foils across chapters**
  - Where in the local work: fit.md section 5 (5.1 to 5.4); mock-card.html sheet for Hannah and Peninnah over 1 Samuel 1:2 to 2:5; judging out/pc-hannah-light-simple-sheet.txt
  - Now: Not built. extra_figures.rs line 520 refuses a note that 'crosses a chapter', so the live 1-samuel-1-2-contrast stops inside chapter 1 and 1 Samuel 2:5 cannot be reached. Wordplay's queued contrast waves use the same one-chapter format. HANDOFF section 8 row 14 says a later structure extra must keep the kind names parallelism, figure and contrast
  - Needs: cite-list interpreters for each structure. A chiasm's layout is one writer's: store it 'as laid out by' him and count writers who agree on the mirror and its centre
  - Why: Examples from fit.md: Psalm 8:1 and 8:9 bookends; the 1 Samuel 2:11-26 alternation of Samuel and Eli's sons; the Psalm 136 refrain; a Genesis 6:10 to 9:19 mirror; Judas against Peter; Saul and David. The mockups' phone ladder (at most four steps, holding at 375 px) belongs to this panel; the live figures ladder is not capped. fit.md also proposes a shared checks.rs and reusing parallels/Compare.tsx for the two-column foil view.
- **Map: link kinds `mirror` and `foil` in mapKinds.ts and colors.ts; a 'lens' that rises from the map when a form sits inside one or two verses; an ember arc between two people's verses; whole-psalm outlines drawn faintly at Deep**
  - Where in the local work: mock-arcs.html 'The arc grammar'; fit.md 1.3 and 5.4
  - Now: Partly built. figures/MapArcs.ts draws the selected verse's notes in violet at Deep through ui/mapSlot.ts. mapKinds.ts LinkKind is only 'quote' | 'echo' | 'parallel'; there is no lens and no faint psalm outline
  - Why: Only half of the mockups' arc grammar is live. The lens is how a one-verse device shows on the map.
- **A Literary devices card next to the Layers card at Study and Deep, including verses that already have a Layers passage (1 Samuel 15:29, Genesis 4:2, 1 Samuel 16:7, Matthew 27:5, John 10:11)**
  - Where in the local work: mock-card.html (the 'Beside a Layers card' state for 1 Samuel 15:29); fit.md 1.1
  - Now: LayersCard is drawn in Connections.tsx; the figures panel is a separate extra with its own sheet, and no card sits beside LayersCard
  - Why: The founder's mockup shows the two cards side by side, so a reader on a verse with a Layers passage sees both.

## For the "Make the site easy to use" thread

- **BSB poetry lines in the reader: each poetry verse drawn as its own lines, the indented partner line one step in, refrains set right, gaps between stanzas, psalm titles on their own line**
  - Where in the local work: docs/local-work/2026-10-20/literary/fit.md sections 2 and 3; mock-reader.html (Psalm 1, Psalm 19 with its title line); judging out/disc-reader-1440.txt
  - Now: Not built at 547d0ff. No poetry field in text/<Book>.json; Reader.tsx and Pairs.tsx draw each verse as one string; extra_quotes.rs::read_usfm drops \q marks as spaces. No branch or PR touches it
  - Needs: none new (pinned usfm-bible/examples.bsb @ 48a9feb71f)
  - Why: Per fit.md: 8,180 of 31,084 USFM verses carry poetry marks, and 8,159 of the 8,182 the app shows can be placed. The source is already pinned (bsb-usfm @ 48a9feb71f). Cost is 119 KB raw, 31 KB gzipped, across 55 books. The design is a book-level `poetry` array placed on BSB.json, with 116 psalm titles on their own line. Proposed verify pins: Psalm 1:1 breaks at 0/18/66/102, every Psalm 136 verse has a refrain line, Proverbs 10:1 has 2 lines, Genesis 1:1 has none. Check at 375 to 390 px in word-by-word mode.
- **At Study, split the Hebrew or Greek into the same lines as the English, with the pair letters (A B C ... C' B' A') on the Hebrew words**
  - Where in the local work: fit.md 2.4 and 3.2; mock-reader.html Isaiah 6:10 at Study; judging out/pr-isa6-light-study-a.txt
  - Now: Not built. The figures Panel shows Hebrew word chips at Deep only; the interlinear does not split by line
  - Why: In 5,354 of 6,229 tested poetry verses (86%), every original word falls inside one English line, using the existing row[2] alignment (Proverbs 97.5%, Job 89.6%, Psalms 88.0%, Isaiah 76.5%). Where the split is not clean, the Hebrew line stays whole. Depends on the poetry-lines item.
- **Load Layers late: split layers.json so the first download holds only the passage verses and kinds the 'Layers ›' marks need, and the note text loads on the first selected verse**
  - Where in the local work: fit.md 1.2 and 4.4
  - Now: App.tsx line 136 on 547d0ff still runs `void loadLayers(atlas)` right after the atlas loads, for every visitor; data/layers.ts fetches the whole layers.json. fit.md measured 2.86 MB raw, 626 KB gzipped, at 5296d48
  - Why: Round 3 adds 216 passages, so this grows with every Layers note. CLAUDE.md: heavy data loads late, and a first visit loads nothing extra.

## Needs a decision from Shubhanshu

- **Large chiasms and whole-passage structures: Ps 23 and Ps 103 (Bullinger), Bullinger's 63 lettered Correspondence structures, the Companion Bible's roughly 2,300 structures, Boys, Jebb and Forbes, and alternations over whole passages such as Ps 19, Heb 1-2 and 1 Sam 2:11-3:1; plus the proposed three-tier chiasm evidence bar after Blomberg's nine criteria**
  - Where in the local work: docs/local-work/2026-10-20/literary/catalogue.md section 4 (Proposed evidence bar), section 6, section 19 item 1; sources.md section 4
  - Now: Not live. The planned `structure` extra (config/structures.json, extra_structure.rs) does not exist. HANDOFF section 8 row 14 (whether to build the literary-devices feature) is still open. The Companion Bible is not quotable, so a structure from Bullinger's Figures of Speech alone stays 'some interpreters'. Notes must sit in one chapter
  - Needs: Founder ruling; Blomberg is living and copyrighted, so he may only be cited and linked, after his standing is confirmed
  - Why: The device most easily over-found; the catalogue asks the founder whether large structures belong at all, and whether Jebb, Boys and Forbes join the cite list
- **Candidate writers named in sources.md, none yet on the cite list: Lowth (1787/1829 lectures only), Jebb (1820, the only witness for Prov 23:15-16), Boys (1824, 1825), Forbes (1854), Horne (1818-1846 editions only), Keach and De Laune's Tropologia (CC0; the textcreationpartnership/A37483 @ e290ad3 pin is not checked: this session cannot reach that repository), and Blomberg, who would supply only the chiasm test**
  - Where in the local work: docs/local-work/2026-10-20/literary/sources.md sections 0, 4 and 6; catalogue.md section 18 (Candidates)
  - Now: None is in config/layer-sources.json or on the figure-forms `quotable` list; none is on the avoid list. Two names are removed from the claim. Nave's is already pinned in sources.json as an index only, and CLAUDE.md bars showing its lines, so it cannot be a cite (its subject headings ANTHROPOMORPHISMS, IRONY and PERSONIFICATION may still serve as leads). unfoldingWord's notes name no writer, which the figures build refuses (decision 10), so it can be a lead source at most
  - Needs: Founder approval; for each: a sources.json pin, a NOTICE.md credit, a config/shelf.json card, a cite-list entry naming the writer, and a place on `quotable`. Blomberg is copyrighted: cite and link only
  - Why: These writers would supply second writers for chiasm, parallelism and anthropopatheia; per sources.md each passes the believing rule in his own words
- **Augustine, City of God XV.1 (Cain and Abel) and XV.17 (the two lines of Cain and Seth)**
  - Where in the local work: catalogue.md section 7 intro, rows 1 and 2; sources.md line 166; research-results.json sources.recommendations
  - Now: Cannot be cited. config/layer-sources.json church-fathers lists ten works, and the only Augustine one is augustine-tractates-john. church-fathers is not on the figure-forms.json quotable list.
  - Needs: A City of God entry in layer-sources.json works, and founder approval to quote it
  - Why: The catalogue calls this the oldest believing statement of a foil. Using it needs a City of God work entry (NPNF, New Advent, with a shelf card and a NOTICE credit), and a decision on whether a single named father's work may be quoted in figure notes. Without Augustine, row 2 falls to 2 writers.
- **Rows 41 to 44 (Moses and Christ, Heb 3:1-6; the two sons, Matt 21:28-32; the wise and foolish builders, Matt 7:24-27; the wise and foolish virgins, Matt 25:1-13), which rest on Scripture alone. Henry and Calvin (row 42) and Gill (row 44) comment, but their words were not recorded.**
  - Where in the local work: catalogue.md section 7 rows 41-44
  - Now: Absent; the build cannot accept them as they stand
  - Needs: Henry and Calvin on Matt 21:28-32, and writers on Heb 3:5-6 (not Henry: his part ends at Acts), Matt 7:24-27 and Matt 25:2, with exact quotes
  - Why: extra_figures.rs requires at least one interpreter cite per note, so a contrast drawn by Jesus or Hebrews alone cannot ship. Either find writers or decide that a contrast Scripture draws can stand on Scripture alone.
- **Open founder questions from the mockups: violet for devices or the Layers gold (live uses violet); Bullinger's old figure names at Deep with plain names elsewhere; whether a structure only one writer sees (Psalm 19 in four parts) shows at Deep as 'a structure some readers see'; whether showing both believing readings of Genesis 6:6 is right; a Simple line or start at Study; 'restates, opposes, builds, climax' or whole phrases; the size of the Simple source line; the phone mirror outline under the verse or as its own sheet**
  - Where in the local work: mock-card.html 'Questions this raises for the founder'; mock-reader.html 'Questions for the founder'
  - Now: No answer in docs/FOUNDER-DECISIONS.md (decisions 1 to 23 cover voices, credits and audits only). #57 chose violet and the labels 'Said twice', 'Opposite lines', 'Lines that build' without one. HANDOFF section 8 row 14 (whether to build fit.md) is still open
  - Why: These answers decide the Simple and Study items, the structure item and the phone outline choice.
- **Keach and De Laune's Tropologia (1681) as a second book that defines the forms, beside Bullinger, for 'God in human terms' and 'things spoken of as persons'**
  - Where in the local work: mock-card.html (last founder question); mock-arcs.html sources (De Laune from Tropologia, TCP A37483 @ e290ad3, CC0)
  - Now: Not on the cite list or in sources.json; only bullinger-fos defines forms (10 of 13 have a definition; synecdoche, contrast and likeness have none)
  - Needs: EEBO-TCP A37483 at a pinned commit (CC0), mirrored to GitHub
  - Why: A second public-domain definer by Bible-believing Baptist writers. It needs the founder's yes, a cite-list entry, a sources.json pin, a NOTICE.md credit and a shelf card.
- **Clarke is quoted in a live figure note (1-samuel-1-2-contrast) and is on the figures `quotable` list, while VOICES-SHORTLIST.md says to leave Clarke out for calling the eternal Sonship of Christ 'anti-scriptural, and highly dangerous'**
  - Where in the local work: docs/local-work/2026-10-20/voices/VOICES-SHORTLIST.md line 37 and question 2 ('leave the writer out instead'); mock-card and mock-reader cite Clarke
  - Now: config/figure-forms.json quotable includes 'clarke'; Clarke is an interpreter in config/layer-sources.json; round 3 on the shared folder adds 119 more Clarke cites
  - Why: Decision 20 judges each contributor's cited passages on their own words, so citing Clarke's sound passages is probably allowed. The founder should still confirm that the shortlist's leave-out covers only showing Clarke's whole commentary at Deep, not citing him.

## Other (Voices plan and tools)

- **A clean, pinned Bullinger text: a mirror branch (for example mirror/literary-sources) of the 1898 archive.org scans figuresofspeechu00bull and cu31924029277047, checked by sha1, and optionally CrossWire KD, JFB, Clarke and Barnes for build-time quote checks**
  - Where in the local work: docs/local-work/2026-10-20/literary/sources.md sections 2 and 4 (mirror plan); catalogue.md section 18 (What must be mirrored), section 19 item 6
  - Now: Not done. The only mirror branch on origin is mirror/potion-base-8M. Figure quotes are checked against the unlicensed darrelwright/UniqueBible_Books module @4017a67 (docs/evidence/figures-2026-10-21.json). Wordplay's figwrite.js finds scan page numbers one WebFetch at a time through archive.org's search-inside service, not from a pinned copy
  - Needs: A mirror workflow like mirror-meaning-model.yml, pinned in sources.json
  - Why: Every new form above needs a Bullinger definition and page, and the feature leans on Bullinger more than on any other writer
- **Hannah and Peninnah extras from the mock: the side-by-side rows through Hannah's song (1 Sam 1:2-2:5), Henry's frank limit quote about both women, and the separate hannah-crossing mirror entry (Bullinger only, some interpreters)**
  - Where in the local work: mock-tools/devices.src.json entries[7] hannah-foil (view.at "1 Samuel 1:2, 2:5", limitV Henry quote) and entries[8] hannah-crossing; content.py PAIR['1Sam.1.2'] rows 1:2, 1:4-7
  - Now: Live note 1-samuel-1-2-contrast has sides Peninnah 1:2-7 and Hannah 1:2-11. Its limit is in the app's own words ("Setting them side by side does not make Hannah faultless."). There is no separate mirror note. A 1:2-2:5 view would cross a chapter, which the build refuses.
  - Why: A small difference: live follows the build's rule that writers' words go only in cites. If wanted, Henry's frankness could go in the Henry cite's quote. Nothing important is missing.
- **Voices V1 shared change: one config/voices/<id>.json per work; extras/voices/index.json under 200,000 bytes; per-work part files of at most 500,000 bytes, fetched only when a writer is opened; the build refuses a work whose cite is not on the cite list; generalised verify**
  - Where in the local work: voices/VOICES-BUILD-SPEC.md 1.1 to 1.11, 8.1 (V1), 8.2 (PR-2)
  - Now: Not built. extra_voices.rs lines 68 to 70 hard-code CATENA, HENRY (henry-concise) and WESLEY; there is no config/voices/ and no branch for it
  - Why: Every new writer at Deep depends on this. Decision 23 approves the plan and says the shared-code limits do not bind these PRs.
- **Voices V4 panel: the line 'Christian writers: ...' (under 70 characters, ending 'and N more'); the line 'These writers wrote in the language and quarrels of their time...'; each writer opened by the reader and remembered in localStorage atlas.voices.open; 'Left out here' lines; 'How these are chosen'; a book line per work with three dates**
  - Where in the local work: VOICES-BUILD-SPEC.md 1.6, 1.7, 1.9; VOICES-SHORTLIST.md questions 2 and 13
  - Now: Not built. No localStorage picks, no 'language and quarrels' line and no left-out lines in web/src/ui/extras/voices
  - Why: Shortlist questions 13 and 2, approved by the founder.
- **Voices long notes: store an opening of up to 700 characters and fetch the whole text (long file of at most 250,000 bytes) on 'Read all', keeping the scroll position and moving focus**
  - Where in the local work: VOICES-BUILD-SPEC.md section 4; FOUNDER-DECISIONS decision 8
  - Now: Partly built. voices/Panel.tsx folds in place with 'Read all' and 'Show less', but there are no long files
  - Why: Needed for Henry complete and Keil and Delitzsch, whose notes are mostly long, and later for the Puritans.
- **Voices V3 exclusions (config/voices-exclusions.json): leave out the smallest passage that denies Scripture or calls the received words in error, marked as left out: Calvin on Matthew 27:9 and Acts 7:14 and 7:16; Barnes on Matthew 27:9; Delitzsch on Psalm 74, 86 and 130:1; Delitzsch on Proverbs 1:7 to 9:18; Luther's prefaces on James and Jude**
  - Where in the local work: VOICES-BUILD-SPEC.md 2.1 to 2.6, section 9 questions 2 to 4
  - Now: Not built for voices. #63 did only the Layers-side leave-outs (`denies` in layer-sources.json)
  - Why: Decisions 2, 20 and 23 (items 3 to 5) require these before any of these works ship.
- **Voices V2 Catena clean-up: hide Origen (638 quotations), Didymus (9), the Arian 'Pseudo-Chrysostom' in Matthew (439) and Clement of Alexandria's Luke 21:34-36 quotation, each with a visible line; keep Eusebius with a who note, Josephus labelled a witness, not a Christian writer, and Victor of Antioch**
  - Where in the local work: VOICES-BUILD-SPEC.md section 6 and fact 3; VOICES-SHORTLIST.md question 5
  - Now: Not built. No code or config on main handles Origen (Didymus appears only as Thomas's Greek name); the live Catena shows these quotations
  - Why: Founder-approved (shortlist question 5; decision 23 items 2 and 9).
- **Voices V0 mirror workflows: mirror-sword-modules.yml and mirror-web-texts.yml creating mirror/sword-KD, mirror/sword-Barnes, mirror/pg-1549, mirror/pg-48193, mirror/pg-27978, each with a SOURCE.md and SHA-256 hashes**
  - Where in the local work: VOICES-BUILD-SPEC.md section 7 and 8.1 (V0)
  - Now: Not built; git ls-remote shows only mirror/potion-base-8M
  - Why: The build containers reach only github.com, so Keil and Delitzsch, Barnes and Luther cannot be pinned without these mirrors.
- **Voices V5 SWORD reader (extra_voices/sword.rs, adds the miniz_oxide crate) for the CrossWire modules**
  - Where in the local work: VOICES-BUILD-SPEC.md 8.1 (V5), fact 2
  - Now: Not built; no miniz_oxide in any Cargo.toml
  - Why: JFB, Keil and Delitzsch and Barnes need it. Decision 23 allows the one new library.
- **Voices first batch works: Calvin NT (21 books); JFB; Keil and Delitzsch OT (Ecclesiastes left out); Luther's Galatians and Genesis 1 to 9; Henry's complete commentary beside the Concise (continuators credited by name); Barnes NT**
  - Where in the local work: VOICES-BUILD-SPEC.md 5.1 to 5.7 and 8.2 (PR-5 to PR-10); VOICES-SHORTLIST.md first batch
  - Now: None built; only the Catena, Henry's Concise and Wesley are shown at Deep
  - Needs: CrossWire modules (JFB 3.0, KD 2.0, Barnes 1.1) mirrored; Let's Church files for Calvin and Henry complete; GITenberg 1549, 48193 and 27978
  - Why: The founder approved the lists and answered all ten spec questions (decision 23). Each work needs a sources.json pin, a NOTICE.md credit, a shelf card and a cite-list entry; `luther` is not on the cite list yet.
- **Church fathers from the original 19th-century volumes: Chrysostom's homilies, Gregory the Great's Morals on Job (labelled 'spiritual reading'), Augustine on John and 1 John, Cyril of Alexandria on John**
  - Where in the local work: VOICES-SHORTLIST.md first batch rows 4 to 6 and row 11; VOICES-BUILD-SPEC.md 8.5; VOICES-PLAN-LUTHER-FATHERS.md
  - Now: Not built; the fathers appear only inside the Catena
  - Needs: a pinned copy of the Nicene and Post-Nicene Fathers English volumes, or the HCF repository with folder pinning
  - Why: Approved by the founder (shortlist question 4; decisions 3 to 5). This waits on choosing the source, with the original series, translator, volume and page credited.
- **Puritans and Poole with their old spelling kept as printed, plus a cited modern reading where a reader would be confused (EarlyPrint's standard spellings, Webster's 1828), via a TEI reader and config/voices-spelling/<work>.json**
  - Where in the local work: VOICES-BUILD-SPEC.md 8.5; FOUNDER-DECISIONS decision 7; VOICES-SHORTLIST.md second batch rows 14 and 15
  - Now: Not built
  - Needs: EarlyPrint standardized spellings; Webster 1828; EEBO-TCP texts (CC0)
  - Why: Decision 7 asks that every modern reading come from a cited source, never invented.
