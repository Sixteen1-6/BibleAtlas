# Voices build spec: more Christian writers at Deep, first batch

Written 2026-10-20 for the build workflow; **revised 2026-10-21** to close the three reviews of the first version (feasibility, reader and rules) and to follow the founder's decisions 10 to 19. Section 10 records each finding and where it is closed.

This is the architect's spec. It settles the files, data shapes, functions, checks, tests and sizes for (1) the shared change, (2) the Scripture-respect exclusions, (3) exact credit and dates, (4) long notes, (5) the first batch of works, (6) the Catena clean-up, (7) the mirror workflows and (8) the module plan. Section 9 holds the founder questions still open.

**Binding inputs.**

- `FOUNDER-DECISIONS-2026-10-20.md` beside this file, all of it, and in particular:
  - **10**: every credit names the person who wrote the words, the edition or site they were read from, the original date and the date the text was truly retrieved;
  - **11**: cite everything, so a first-time reader understands who, when, what kind of work, and can follow a link to check it; the evidence is kept in the repository;
  - **12**: nothing a reader can click opens empty;
  - **13, 15**: no crediting of AI anywhere, on any note, summary, source or credit; every note reads as what its named sources say, with their words one tap away;
  - **17**: "it goes for everything": app-written statements about people and history carry a credited source;
  - **18**: the citation audit's recommended answers, of which this spec uses question 2 (a read date only where the repository proves it), question 3 (three dates: written, this version, copied), question 4 (an unidentified part-writer is never credited to the figurehead), question 5 (the avoid list governs names the app itself credits), question 6 (ancient Jewish texts only as witnesses) and question 16 (Wesley's sources named; the Concise called a later abridgment);
  - **19**: checking is described ("checked against the source"), never credited; "reviewed" only where a named person reviewed.
- `CLAUDE.md` and `docs/HANDOFF.md` in the clone at `origin/main` **`2aabdcc`** (PR #50, the Layers mend, merged after `b6d7f1e`; both files are unchanged since `b6d7f1e`).
- **Decisions 13 and 15 replace the CLAUDE.md and HANDOFF rule "Disclose AI drafting"** ("Every AI-drafted passage and card says 'Drafted with AI help (Claude) ...'"). Nothing this spec builds carries AI wording, and no module follows that rule. The rewrite of those two files belongs to the true-credits branch (TC), which holds `CLAUDE.md` and `docs/HANDOFF.md` until it merges (AUDIT-FIXES-PLAN.md section 1). If TC has not merged when PR-2 is ready, the integrator makes the rewrite in PR-2 by agreement with TC, one holder at a time. PR-2 also changes CLAUDE.md's "Writers appear only at Deep, after 'Show what they wrote'" to "Writers appear only at Deep, after the commentary notice".
- The commentary notice: `NOTICE-SPEC.md` (the notice job's scratch folder, `...\d3907c69-...\scratchpad\ba\notice\`) as built in commit **`d12a4dd`** on branch `commentary-notice` (local, not pushed). Its API is binding for the panel (1.9).
- `AUDIT-FIXES-PLAN.md` in the work folder, where it touches this work: its citation shape (AF-K) for field names, its dataset dates (AF-DT), its rule 3 (no AI credit phrases in credit strings; reader text never links a commit, PR or blob page of this repository, only raw files at a pinned commit), its rule 6 (evidence records), its one-holder rule for shared files, and its rule that `docs/HANDOFF.md` section 0 is rewritten only in the PR that merges next. AF-CW's scope shrinks: the Concise, Wesley and Catena credit lines are now V1's (5.0), so AF-CW keeps the who-lines for the Catena names this spec does not cover, `links.ts` and the panel's footer credit.

Where this spec differs from VOICES-PLAN.md or VOICES-PLAN-LUTHER-FATHERS.md it says so and why; otherwise those plans stand.

**Nothing in the repository was changed.** The clone was read with `git fetch` and `git show origin/main:...` only.

## 0. What was read and measured

Read: CLAUDE.md, docs/HANDOFF.md, sources.json, NOTICE.md, config/shelf.json, config/layer-sources.json, config/layers.json (at `2aabdcc`), crates/atlas-cli/src/{extra_voices.rs, sources.rs, fetch.rs, build.rs, shelf.rs, layers.rs, verify.rs}, web/src/ui/extras/{voices.extra.tsx, voices/model.ts, voices/Panel.tsx, voices/links.ts, registry.ts, data.ts, types.ts}, web/public/sw.js; commit `d12a4dd` (its voices, types and commentary files); in the work folder VOICES-SHORTLIST.md, VOICES-PLAN.md, VOICES-PLAN-LUTHER-FATHERS.md, group-1.md to group-4.md, group-luther.md, group-fathers.md, group-reformers.md, FOUNDER-DECISIONS-2026-10-20.md, CITATION-AUDIT.md, AUDIT-FIXES-PLAN.md, and the run results `wf_d99604b2-da9.json` (this spec's reviews), `wf_e5046b06-4ad.json` (no-empty-selections) and `wf_bd593f68-4bb.json` (the true-credits dates research). The research's downloaded copies (CrossWire confs and zips, Let's Church JSON, the verified LF raw folder) were read in place.

Facts this spec rests on (measured on 2026-10-20 or 2026-10-21):

1. **KD.zip holds 7 files.** `modules/comments/zcom4/kd/nt.bzs` and `nt.bzz` are empty (0 bytes). Section 7 has the full table.
2. **The SWORD index math holds.** Verse-index files are exactly (2 + books + chapters + verses) slots in KJV versification: Old Testament 24,115 slots, New Testament 8,246. JFB and KD use 12-byte entries, Barnes 10-byte entries. The pinned KJV, ASV and BSB files have identical per-chapter verse counts (929 and 260 chapters; 23,145 and 7,957 verses), so slots can be built from the app's own versification after checking those totals.
3. **The Catena's names, counted in the pinned files.** Origen 638 (Matthew 310, Mark 10, Luke 153, John 165); Didymus 9 (John); Eusebius 82; "Pseudo-Chrysostom" 439 in Matthew, 109 in Mark (101 tagged "Vict. Ant.") and 12 in Luke. In Matthew, by chapter: 1 to 8 (274), 11 (3), 19 to 24 (158), 27 (3), 28 (1); none in 9, 10 or 12 to 18. 427 Matthew quotations have no tag; 12 have one: "Homil. in Matt. Hom. i." (1:1), "ubi sup." (1:12-15), "vid. Phil. 3:2:3." (5:10), "Hom. xv." (6:2-4), "non occ." (6:5-6), "quoad sens." (8:1-4), "in loc." (11:7-10), "in fin. Hom. xxxix." (21:45-46), "non occ. sed vid. Gloss. ord." (22:1-14), "Pseudo Chrys. in Hom. de Cruce et Latr. ubi sup." and "Hom. vi. in Pass. [vol. iii. p. 733.]" (27:45-50), and "Hom. de Resur. iii." (28:1-7). The 27:39-44 quotation has no tag. The unfinished work on Matthew has no homilies on chapters 26 to 28. In Luke, 11 quotations come from sermons once credited to Chrysostom and 1, at Luke 16:22-26, is tagged "Chrys. Op. imp, Hom. 53.", the unfinished work. Matthew 23:13 (app verse 23931) holds only Origen, Pseudo-Chrysostom (untagged) and Origen. Josephus is quoted once (Matthew 2:21-23) and Clement of Alexandria once (Luke 21:34-36, spelled "Alexendria").
4. **Henry's complete commentary** (`mhc.json`): 5,360 entries; 1,111 on a verse 0; 4,246 of the other 4,249 print the KJV text of their section starting with their own first verse number; the 3 exceptions are Job 28:12 (prints from 14), Jeremiah 46:13 (from 12) and Jude 1:16 (from 15). The file names a continuator only in six places: "Completed by John Evans" (Romans 1:1), "Jeremiah Smith" (Titus 1:1, Philemon 1:1), "John Reynolds, of Shrewsbury" (2 John 1:0, a verse-0 entry, and 3 John 1:1) and "John Billingsley" (Jude 1:1). So 1 and 2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 1 and 2 Thessalonians, 1 and 2 Timothy, Hebrews, James, 1 and 2 Peter, 1 John and Revelation (17 books) name no writer. Henry died in 1714 having reached Acts.
5. **Calvin** (`calvin.json`): each book's "THE ARGUMENT" and the next section's printed verses (English and Latin, under a lone `{{ref:Bible:...}}` header) sit at the end of the entry before them. "THE FIRST EPISTLE TO TIMOTHY" occurs once (1 Timothy 1:1), "SECOND EPISTLE TO TIMOTHY" once (2 Timothy 1:1), and in plain text "Paul, a servant of God, and an apostle of Jesus Christ" once (Titus 1:1). The 13 Pastoral entries hold 9,532 words, the start of each chapter's comments. Philemon 1:1's body begins with a ref-only paragraph followed by the printed verses. Calvin says the words the BSB prints are wrong in three places: Matthew 27:9 ("the name of Jeremiah has been put down by mistake, instead of Zechariah"), Acts 7:14 ("this difference came through the error of the writers which wrote out the books") and Acts 7:16 ("it is manifest that there is a fault [mistake] in the word Abraham ... Wherefore this place must be amended").
6. **"Not on Ecclesiastes" reaches Layers.** On `main` at `2aabdcc`, 12 Layers notes in 8 Ecclesiastes passages cite Keil and Delitzsch or the Pulpit Commentary (15 cites; passages 3:18, 3:20, 5:4, 5:15, 6:10, 7:1, 7:6, 7:20). Two plain-meaning notes rest on those works alone: `ecclesiastes-3-20` and `ecclesiastes-6-10`.
7. **The texts Luther needs.** GITenberg's `1549.txt` (500,649 bytes, commit `e362c0a` of 2018-10-21), `48193-8.txt` (999,142 bytes, ISO-8859-1, `8d4140f` of 2018-10-06) and `27978.txt` (763,457 bytes, ASCII, CRLF, `8319ed1` of 2018-10-18). Project Gutenberg's page for ebook 1549 says "Most recently updated: February 17, 2024"; word-diffing it against the 2018 snapshot leaves only "VERSE 6." corrected to "VERSE 5." and "Jews" to "Jews.". The Galatians text ends "This text was converted to ASCII format for Project Wittenberg by Laura J. Hoelter and is in the public domain. You may freely distribute, copy or print this text." Lenker's Genesis volume 1 title page reads "Based on Dr. Henry Cole's translation from the original Latin. Revised, enlarged, parts retranslated and edited in complete form by John Nicholas Lenker" (Lutherans in All Lands Co., Minneapolis, 1904). Volume 2 has no "PART" lines; it has 50 Roman-numbered section headings, each after an indented outline with paragraph numbers (329 numbered outline lines).
8. **JFB and KD markup.** JFB's Genesis 1:1 entry is 107,643 characters and opens with the general introduction; its `type="introduction"` divs are empty milestones. KD opens each comment with a reference to its own range, has `<note>` footnotes and 40 small tables, and its conf declares `Feature=NoParagraphs`. The Ecclesiastes words "was not written by Solomon himself, but by a Jewish thinker of a much later age" are in KD's Ecclesiastes 1:1 entry (146,750 characters, the introduction in a verse slot).
9. **The commentary notice exists**: commit `d12a4dd` on `commentary-notice` (29 files, not merged, not pushed). The spine gates commentary: `commentary: true` and `closed(verse, data, a)` on an extra (`extras/types.ts`), `accepted` and `askNotice()` in `web/src/ui/commentary/state.ts`, `<CommentaryFoot/>` in `Gate.tsx`. It removes the voices opt-in, `voicesAllowed` and "Hide writers' notes", moves "Read more on other websites" behind the notice, and deletes the old `atlas.voices` key when a reader finishes the notice. Extras are imported eagerly at start (`registry.ts`, `import.meta.glob(..., { eager: true })`), so `voices/model.ts` runs at app start.
10. **Dates of each copy** (the third date a credit needs, decision 10):

| Work | Original | This version | Copied into the app |
|---|---|---|---|
| Catena Aurea | 1260s; Oxford translation 1841–45 | the Catena project's files at commit `efe1bd0` (2026-05-24); its records say ecatholic2000.com was read on 2026-07-10 | 2026-10-10 (`38749bd`) |
| Henry's Concise | from Henry's commentary of 1708 to 1714 and its completion of 1721 (V10 checks each volume); abridged later | CrossWire MHCC 2.0 of 2021-02-14 (TextSource CCEL `mhcc.txt`), in Let's Church's file of 2026-06-30 (`bb79df2`), pinned commit `71f6f0f` of 2026-10-09 | 2026-10-10 (`38749bd`) |
| Wesley | New Testament 1755; Old Testament 1765–66 | CrossWire Wesley 1.1 of 2001-11-28 ("based on the electronic edition by Sulu Kelley and Bill Brown"), in Let's Church's file of 2026-06-30 | 2026-10-10 (`38749bd`) |
| Calvin | Latin 1540–64; English 1843–55 | CrossWire CalvinCommentaries 1.1 of 2022-08-01 (TextSource CCEL), in Let's Church's file of 2026-06-30 | the date its pin is set |
| Henry complete | as the Concise | CrossWire MHC 2.2 of 2022-08-29 (from CCEL, "Thanks also to Logos Research, Inc. for providing CCEL with their text"), in Let's Church's file of 2026-06-30 | the date its pin is set |
| JFB | 1871 | CrossWire JFB 3.0 of 2021-02-15 (TextSource CCEL `jfb.txt`) | the mirror commit's date |
| Keil and Delitzsch | German 1861–75; English 1864–78 | CrossWire KD 2.0 of 2022-08-03 (TextSource Wikisource) | the mirror commit's date |
| Barnes | 1832–53 | CrossWire Barnes 1.1, SwordVersionDate 2002-01-01, no TextSource | the mirror commit's date |
| Luther | 1535 (Galatians); 1535–45 (Genesis) | Project Gutenberg ebooks 1549 (updated 2024-02-17), 48193 and 27978 (V0 records their dates) | the mirror commit's date |

Let's Church's files name their module (`"sourceModule": "MHC"`) but not its version, so a module version is shown only where V1, V6 or V10 proves which one the file follows (by comparing samples with the CrossWire zip). The Catena project's records give 2026-07-10 for its reading of ecatholic2000.com, later than the 2026-05-02 commit that last changed its Matthew file; V1 shows the records' own words and puts both dates in the evidence file.

11. **CCEL's terms.** Calvin, JFB, Henry's complete commentary and the live Concise all come from CCEL transcriptions. CCEL's copyright page (saved in the research, `research/ccel/ccel_copyright.html`) says: "These books may be used for personal, educational, or non-profit purposes. Contact us for permission to republish CCEL works or to use them commercially." The research rejected CCEL copies for Luther, Edwards and the fathers for exactly this reason (group-luther.md, group-fathers.md, group-reformers.md), but took CCEL's text through CrossWire for these four works.
12. **Keil and Delitzsch's provenance.** The Wikisource page the module names says "The source document of this text is not known", sits in "Texts without a source", and credits "Franz Delitzsch (1885–1892)" for all six volumes. `kd.conf` says "This module is based on the BibleWorks 8 user-created module by Willem Swanepoel, available here: http://bibleworks.oldinthenew.org/?page_id=151" (the domain no longer resolves; the 2020 archived page states no license), and the module's "„Y" BibleWorks font codes show that text is still in it. On 2022-08-03, when CrossWire made version 2.0, Wikisource text was under CC BY-SA 3.0 Unported (its footer moved to 4.0 in June 2023). The conf links the scan `biblicalcomm01keiluoft`.
13. **Barnes's conf** has no `Versification` line (SWORD's default is KJV) and no `TextSource`. The research found its John 3:16 note follows a printing later than that of 1858.
14. **Empty and nearly empty notes today** (run `wf_e5046b06-4ad`, no branch yet): 139 Wesley sections that are only a verse reference (Matthew 6:14 shows only "Mark 11:25."), and one Henry Concise section that only points elsewhere, over all 22 verses of Isaiah 36 ("See II Kin. 18:17-37, and the commentary thereon.").
15. **Long notes in today's data.** 781 of 814 Catena passages are over 2,000 characters in all, and 89 single quotations are; Henry Concise has 192 notes over 2,000, Wesley 61. Henry's complete sections have a median of about 7,900 characters after the printed verses; the longest is 80,366 (Matthew 24:4-31). Cutting Henry's openings at the last ". " before 700 characters would stop 422 of about 3,580 on a list marker ("Here we have, I.") and 371 inside a reference ("(Job xxvi.").
16. **JFB's text is a modernised e-text.** Collated against the 1873 printing (group-1.md section 5): "namely" for "viz.", "further" for "farther", "favor" for "favour", references abbreviated. The statement that travels with it: "These files are a derivative of an electronic edition prepared from text scanned by Woodside Bible Fellowship. This expanded edition ... is in the public domain".
17. **App verse numbers.** Ecclesiastes is app verses 17316 to 17537; Titus 29893 to 29938; Philemon starts at 29939; Galatians 29058 to 29206.

## 1. The shared change

### 1.1 In one paragraph

Each work gets its own files under `extras/voices/<work>/`, downloaded only when a reader opens that writer. A small index (`extras/voices/index.json`) says which works have words on each verse, who wrote them there, and when and from what copy, so the panel can list the writers on a verse by name without loading any notes. The commentary notice decides whether any words show at all; inside the open panel the reader opens the writers they want, and the choice is remembered on the device. Works are described by one hand-made file each in `config/voices/`, which also holds that work's exclusions, so new writers never edit a shared table. Long notes keep an opening in the part file and load the rest on "Read all". A writer is listed on a verse only where it has words there; everything left out is said, in plain lines that cannot be clicked. The three existing works move into the new format with the same notes and corrected credits.

### 1.2 The works table: `config/voices/<id>.json`

One file per work, named by its id; the build reads every `*.json` in the folder. Field names follow the citation shape of AUDIT-FIXES-PLAN.md (AF-K: `writer`, `about`, `work`, `part`, `written`, `edition`, `read_on`, `url`, `quote`) so the panel can use that credit component once it exists. Example (every field required unless marked optional):

```json
{
  "_comment": "A work shown at Deep under Christian writers. Read by crates/atlas-cli/src/extra_voices.rs. Every fact about a person, a book or history carries a src; the build refuses one without it.",
  "id": "jfb",
  "order": 1871,
  "writer": "Robert Jamieson, A. R. Fausset and David Brown",
  "short": "Jamieson-Fausset-Brown",
  "title": "A Commentary, Critical and Explanatory, on the Whole Bible",
  "written": "1871",
  "reader": "jfb",
  "sources": ["jfb"],
  "shelf": "jfb",
  "cite": "jfb",
  "license": "public-domain",
  "names": false,
  "long_chars": 2000,
  "copy": "CrossWire's JFB module, version 3.0, whose text is CCEL's jfb.txt, an expanded electronic edition prepared from text scanned by Woodside Bible Fellowship; copied unchanged to a branch of this app's repository.",
  "how": "Each note shows with the verse it is on; where the copy joins several verses, it shows on each of them.",
  "dates": {
    "version": { "date": "2021-02-15", "what": "CrossWire's JFB module, version 3.0", "from": "mods.d/jfb.conf: SwordVersionDate=2021-02-15" },
    "copied": "<UTC date of the mirror commit that sources.json pins>",
    "retrieved": null
  },
  "people": {
    "David Brown": { "about": "Free Church of Scotland professor, Aberdeen", "src": { "writer": "Robert Jamieson, A. R. Fausset and David Brown", "work": "A Commentary, Critical and Explanatory, on the Whole Bible, title page", "written": "1871", "part": "title page", "url": "https://archive.org/details/<identifier>", "read_on": "<date read>", "quote": "<the title page's words>" } }
  },
  "lines": [
    { "from": "Matthew 1:1", "to": "Romans 16:27", "writer": "David Brown", "short": "David Brown",
      "work": "A Commentary, Critical and Explanatory, on the Whole Bible", "written": "1871",
      "edition": "one-volume edition (Glasgow, 1871); this part by David Brown",
      "checked": { "url": "https://archive.org/details/<identifier>", "part": "preface, p. <n>", "read_on": "<date read>" } }
  ],
  "who": [],
  "hide": [],
  "reasons": {},
  "exclude": [],
  "fixes": []
}
```

- `id`: lowercase letters, digits, hyphens; equals the file name, the output folder and the shelf card id.
- `order`: the year the work was first written or printed; works list oldest first, ties by id.
- `writer`, `short`, `title`, `written`: the work-level fallbacks for a range with no `lines` row. `short` never contains a comma or the word "and" (it is joined into lists).
- `reader`, `sources`, `shelf`, `cite`, `license` (`public-domain` or `cc-by-sa-4.0`), `names` (true only for the Catena): as before. **The build refuses a work whose `cite` is not on the cite list**, which ties the voices to the founder's list of Bible-believing writers.
- `long_chars` (number or null): voices longer than this keep an opening and a long pointer (section 4). Null means no long files: the panel folds in place as today. Null for the three live works.
- `copy`: one sentence naming the copy chain, every link of it backed by an evidence record (3.2).
- `how`: one sentence for "How these are chosen".
- `dates` (3.6): `version` (what the copy is and its date, with the line or file that proves it), `copied` (the UTC date the pin was set, taken from git), `retrieved` (optional: a date the source's own records give for reading its own source, with whose records they are).
- `people`: for each named writer in `lines` or `who`, a short `about` ("Free Church of Scotland professor, Aberdeen") with its `src`. Shown at the start of the open section's book line.
- `src` (wherever it appears): `{ writer, work, written, part, url, read_on, quote }`. `writer` may be `"unsigned"` with the publisher; `quote` is the exact public-domain words that support the claim. The build refuses a `src` missing any field.
- `lines`: one row per range of verses, saying who wrote the words there (`writer`, and `short` for the extras line and the header), the `work`, its original date (`written`), the printing or translation (`edition`) and where the row was checked (`checked`: the scan's URL and page, or the copy's own title page, and the date it was read). A range with no row shows the work-level fields. A writer the copy cannot name is written as the approved wording for that case (audit question 4), never as the figurehead.
- `who` (Catena): `{ "name", "books": [], "note", "src" }`, a plain note after a quoted writer's name.
- `hide` (Catena): `{ "name", "books": [], "chapters": null, "tag": null, "not_tag": null, "reason", "count" }`, quotations left out (section 6).
- `reasons`: reason id to `{ "short", "why", "src" }`: `short` is shown where a quotation was left out, `why` once per passage with its source.
- `exclude`: this work's Scripture-respect exclusions (2.1). The work's own module owns them.
- `fixes`: `{ "on", "copy", "printed", "scan" }`, a slip in the copy corrected to the printed edition only when a scan proves it (3.3).

Build checks on these files (in `works.rs`): id equals file name and is unique; no unknown field; `reader` is known; every `sources` id is in `sources.json`; `shelf` names a card in group `writers` whose `datasets` equal `sources` as a set; `cite` is in the cite list; `license` is one of the two; `lines` name real verses, `from <= to`, do not overlap, and each has `writer`, `short`, `work`, `written`, `edition` and `checked`; every named `writer` in `lines` and `who` has a `people` entry (except the approved unnamed wordings); every `who`, `reasons` and `people` entry has a complete `src`; `dates.version` and `dates.copied` are present and valid dates; when `sources.json` carries AF-DT's `copied` for the same source, the two agree; every `hide.reason` is a key of `reasons`; no app-written string contains an em dash or an AI credit phrase (AUDIT-FIXES-PLAN.md rule 3's list); and none matches an avoid-list word at a word start (the avoid list governs whom the app itself names, shortlist question 12; old writers' own words are not checked). `works.rs` reads `config/layer-sources.json` through its own lenient structs (unknown fields ignored) and copies the two-line word-start matcher from `layers.rs` with a pointer to it, since `layers.rs` is not V1's.

### 1.3 Output files

All under `web/public/data/`. The old `extras/voices.json` and `extras/voices/<Book>.<k>.json` are no longer written; a page still running old code asks for `extras/voices.json`, gets a 404, and its line simply does not show.

**`extras/voices/index.json`** (loads with the reader's first move at Deep, as today):

```json
{
  "format": 2,
  "works": [
    {
      "id": "catena-aurea", "writer": "The Church Fathers", "short": "the Church Fathers",
      "title": "Catena Aurea (the Golden Chain)", "written": "1260s",
      "shelf": "catena-aurea", "license": "public-domain", "names": true,
      "copy": "...", "how": "...",
      "dates": { "version": "the Catena project's files at commit efe1bd0, 24 May 2026", "copied": "2026-10-10", "retrieved": "transcribed from ecatholic2000.com, which the Catena project records reading on 10 July 2026" },
      "people": {},
      "lines": [ { "from": 23145, "to": 26923, "writer": "the Church Fathers, as Thomas Aquinas gathered them", "short": "the Church Fathers", "work": "Catena Aurea: Commentary on the Four Gospels, Collected out of the Works of the Fathers", "written": "1260s", "edition": "the Oxford translation edited by John Henry Newman (London: J. G. F. and J. Rivington, 1841–45)", "scan": "<url of the checked scan>" } ],
      "who": [["Eusebius", [], "bishop of Caesarea and church historian (about 260 to 339), who sided with Arius before the Council of Nicaea and then signed its creed", { "work": "...", "part": "...", "url": "..." }]],
      "reasons": { "origen": { "short": "A quotation from Origen is left out here.", "why": "The Church later condemned some of his teaching.", "src": { "work": "...", "part": "...", "url": "..." } } }
    }
  ],
  "has": ["<base64 of 3,888 bytes>"],
  "parts": [[23145, 23540]],
  "long": [0],
  "left": [
    { "id": "kd-ecclesiastes", "work": "keil-delitzsch", "scope": "book", "from": 17316, "to": 17537, "state": "decided",
      "line": "Franz Delitzsch's notes on Ecclesiastes (in Keil and Delitzsch's commentary) are left out, because he holds that Solomon did not write the book." },
    { "id": "catena-23931", "work": "catena-aurea", "scope": "passage", "from": 23931, "to": 23931, "state": "decided",
      "line": "The Church Fathers' quotations on this verse are left out: two from Origen and one from the unfinished work on Matthew." }
  ]
}
```

- `works` is in display order (oldest first); an item's work is its position here. Verses are numbered as the app numbers them (0 is Genesis 1:1). In the index, `lines` rows carry `scan` (the checked URL) instead of the whole `checked` object, and `src` objects carry `work`, `part` and `url` only; the full records stay in config and the evidence file.
- **`has[w]`: one bit per verse where the work has at least one shown voice with words** (a "said" voice, 1.4). A voice of only verse links and punctuation, or only a pointer to another place ("See II Kin. 18:17-37, and the commentary thereon."), is not a said voice. Verse v is bit `v & 7` of byte `v >> 3`, base64 with the standard alphabet; 31,102 verses fit 3,888 bytes, 5,184 characters.
- `parts[w]`: the first verse of each part file, ascending; parts split only between chapters, and an item never crosses a chapter.
- `long[w]`: how many long files the work has.
- `left`: every left-out line a reader is told about outside a note: book scope, note scope, and a Catena passage whose quotations are all left out (scope `passage`). `state` is `decided` or `proposed`. Cite-only entries never appear here. A sentence or paragraph left out inside a shown note is marked in the note itself (2.4), not here.

**`extras/voices/<id>/<k>.json`** (one part file, fetched when the reader opens that writer):

```json
{ "format": 2, "work": "henry-complete",
  "items": [
    [2, 4, [["", ["We have here a further account of the first day's work, ...", {"k": "more"}], [0, 1]]], {"w": "The Creation. (b. c. 4004.)"}]
  ] }
```

- Item: `[from, to, voices, extra?]`, sorted by `(from, to)`, never crossing a chapter, with at least one said voice.
- Voice: `[who, text]`; `[who, text, [j, i]]`, a long voice whose `text` is its opening and whose whole text is entry `i` of long file `j`; or `[who, null, reason]`, a quotation left out (section 6). `who` is the quoted writer's name when the work has `names`, else `""`.
- Text: a string, or a list of runs. Run: a string; `[from, to, words]`, a verse link; or a mark `{ "k": ... }`:
  - `{"k": "cut", "id": "<exclusion id>"}`: a passage left out here (section 2);
  - `{"k": "more"}`: the opening of a long voice ends here (section 4);
  - `{"k": "gap", "t": "[Hebrew word not legible in this copy]"}`: a place the copy cannot show (KD's unproven font code, 5.3; later the Puritans' illegible letters);
  - reserved for the research tracks, rendered by their `t` text by any code that does not know them: `{"k": "page", "t": "vol. 10, p. 341"}` and `{"k": "gloss", "t": "tearm", "m": "term", "by": "<source id>"}`.
- Paragraphs inside string runs are split by a blank line, as today.
- `extra` (omitted when empty): `w`, the note's place in the original (section 3); `lab`, an optional label shown before the text (the fathers track's "spiritual reading").

**`extras/voices/<id>/long/<j>.json`** (fetched on "Read all"): `{ "format": 2, "work": "<id>", "texts": [Text, ...] }`, the whole texts of the work's long voices in canon order.

### 1.4 Build code

`crates/atlas-cli/src/extra_voices.rs` becomes the orchestrator, with readers and helpers as submodules in `crates/atlas-cli/src/extra_voices/` (the file stays; a folder of the same name holds its children).

```rust
// extra_voices.rs
pub fn build(root: &Path, inputs: &Inputs, vz: &Versification) -> Result<Vec<(String, Vec<u8>)>, String>;
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String>; // shared checks, then each work's reader checks
fn read(ctx: &Ctx, w: &works::Work) -> Result<Read, String> {
    match w.reader.as_str() {
        "catena" => catena::read(ctx, w),
        "henry-concise" => lets_church::henry(ctx, w),
        "wesley" => lets_church::wesley(ctx, w),
        "calvin" => calvin::read(ctx, w),
        "henry-full" => henry_full::read(ctx, w),
        "jfb" => jfb::read(ctx, w),
        "kd" => kd::read(ctx, w),
        "barnes" => barnes::read(ctx, w),
        "luther-galatians" => luther::galatians(ctx, w),
        "luther-genesis" => luther::genesis(ctx, w),
        other => Err(format!("config/voices: unknown reader {other:?}")),
    }
}
fn checks(d: &Loaded, view: &WorkView) -> Result<Vec<(bool, String)>, String>; // dispatches by reader to each module's checks()

pub struct Ctx<'a> { pub inputs: &'a Inputs, pub vz: &'a Versification, pub kjv: &'a [String] }
// asv: &'a [String] is added by V9, the first reader that needs it.
pub struct Note { pub from: u32, pub to: u32, pub voices: Vec<Voice>, pub place: Option<String> }
pub enum Voice { Said { who: String, text: Vec<Run> }, Left { who: String, reason: String } }
pub enum Run { Text(String), Verse(u32, u32, String), Cut(String), Gap(String), More }
pub struct Raw { pub place: String, pub from: u32, pub to: u32, pub text: String }
pub struct Read { pub notes: Vec<Note>, pub raw: Vec<Raw>, pub report: String }
```

- **`Raw`** is every source entry and heading slot with its place ("Ecclesiastes 1:1", "Ecclesiastes, book heading", "2 John 1:0"), in plain text after markup conversion (references become their printed labels, tags their text, white space runs one space), before any cut. Exclusions and credit checks match against it.
- **A said voice** has at least one word outside verse links and punctuation, and is not only a pointer phrase (`text::is_pointer`: a voice whose words, links aside, are only "See", "see on", "Compare", "For the exposition, see on", "and the commentary thereon" and the like, a list each reader may extend). A note left with no said voice after cuts and exclusions is dropped and counted. Where a pointer names one passage the same work comments on, the reader may instead place that passage's note here, with `w` saying where the writer put it ("From the note on Mark 13:1–37, to which this one points"); otherwise it is dropped and counted. If the no-empty-selections branch has merged by then, V1 follows its rule; otherwise V1 applies this one and lists every dropped note in the PR.

Submodules:

| File | Holds |
|---|---|
| `extra_voices/text.rs` | `Run` helpers, `paragraphs`, `runs` (the `{{ref:...}}` marks, stripping a `Bible:` prefix), `reference`, `book_named`, `ABBREVIATIONS`, `verse_marks`, entity decoding, `plain(runs)`, `is_said`, `is_pointer`, the lemma check (`quoted_in(words, verse_text) -> bool`: the first five words, letters only, lowercase), the sentence-end finder (1.5). Moved from today's file where it exists. |
| `extra_voices/works.rs` | `Work` (1.2), `load(root, inputs, cites, avoid) -> Result<Vec<Work>, String>` with every check in 1.2; `line_for(work, verse)`. |
| `extra_voices/exclude.rs` | `Exclusion`, `load(root, works)` (each work's `exclude` plus `config/voices-exclusions.json`; a missing shared file is an empty list), `apply(list, work, read, vz) -> Result<Vec<Left>, String>`, `status(list, works, cites) -> Vec<String>` (section 2). |
| `extra_voices/pack.rs` | `PART_BYTES = 500_000`, `LONG_BYTES = 250_000`, `OPENING_CHARS = 700`, `OPENING_MIN = 300`, `FILE_MAX = 1_500_000`; `pack(w, notes, vz) -> Result<Packed, String>`; `opening(runs) -> Option<Vec<Run>>`; `bitset_b64(bits) -> String`. |
| `extra_voices/catena.rs` | today's Catena reader, plus `hide`, `who` and the all-hidden passages (section 6). |
| `extra_voices/lets_church.rs` | today's `entries()`, `place()`, Henry Concise and Wesley readers, with the said-voice rule. |
| `extra_voices/{calvin, henry_full, sword, jfb, kd, barnes, gutenberg, luther}.rs` | created by V1 with only `read(_ctx: &Ctx, _w: &Work) -> Result<Read, String>` returning `Err("reader not built yet")` and `checks(_d: &Loaded, _v: &WorkView)` returning an empty list. Each module adds its own helpers and its known cases (as consts in its own file). Nothing else is stubbed, so `clippy -D warnings` finds no dead code. |

- `build.rs` line 412 (at `2aabdcc`) changes from `extra_voices::build(&inputs, &vz)` to `extra_voices::build(root, &inputs, &vz)`. `verify.rs` and `main.rs` do not change; `extra_voices::verify` dispatches to each reader's `checks()` as `read()` does, so after PR-2 only V1 ever edits `extra_voices.rs`.
- **The SWORD reader's one new dependency is `miniz_oxide`** (`inflate::decompress_to_vec_zlib` to read, `deflate::compress_to_vec_zlib` for the synthetic test module): two new crates in `Cargo.lock` (`miniz_oxide`, `adler2`) instead of flate2's four. The founder approved "one small library to read CrossWire's compressed files" (shortlist question 11). V5's PR lists the exact versions and licenses.

Build order inside `build()`: load works (1.2) and exclusions (2.1); read the KJV lines; for each work in order: `read`, apply `fixes`, apply exclusions, apply the said-voice rule, check each note is in one chapter and on real verses, `pack`; write the index; print one report line per work (placed, left out by reason, pointer and empty notes dropped, linked references, files, bytes) and one line listing exclusions waiting and `proposed` ones.

### 1.5 Packing rules (`pack.rs`)

1. Notes sort by `(from, to)`; two notes of one work on the same range stay two items.
2. **Long voices, per voice.** When the work's `long_chars` is set, a voice whose plain text is longer keeps an **opening**: the runs up to the last paragraph end after `OPENING_MIN` (300) and at or before `OPENING_CHARS` (700) characters; failing that, the last sentence end in that window; failing that, the last word boundary before 700 that is outside any open parenthesis or bracket. Then `{"k": "more"}`. The opening is always a prefix of the whole text.
   - A **sentence end** is ".", "?" or "!" followed by a space and then a capital letter, an opening quotation mark or an opening parenthesis. It does not count when the word before the stop is a number, a Roman numeral (I to XL, i to xl), a single letter, or an abbreviation in `text::ABBREVIATIONS` (v, ver, ch, chap, viz, Gen, Exod, Job, Ps, Matt and the rest), or while a parenthesis or bracket opened earlier in the opening is unclosed.
   - Whole texts go to the work's long files in canon order, each file at most `LONG_BYTES` (250,000 bytes), and the voice gets `[j, i]`.
   - Unit tests on Henry's Genesis 2:1 and 3:17 sections (list markers and references), and on a Catena voice (no long files when `long_chars` is null).
3. Part files fill chapter by chapter to `PART_BYTES` (500,000 bytes of item JSON) and break only between chapters. A single chapter larger than `FILE_MAX` fails the build.
4. No file over `FILE_MAX` (1,500,000 bytes); a single long text over 1,400,000 bytes fails the build with its place.
5. Everything is ordered and serialized deterministically, so build ids reproduce.

### 1.6 The panel (`web/src/ui/extras/`)

The notice owns whether any words show (1.9). The panel follows `d12a4dd`: no opt-in screen of its own, no `voicesAllowed`, no "Hide writers' notes" (its job is "Close commentary again" on the Sources shelf).

**The line** (`voices.extra.tsx`, `note()`): `Christian writers: ` followed by the distinct `short` names of the works on the verse (the `short` of each work's row for this verse), oldest first, joined as today ("a, b and c"). If the line would pass 70 characters it names as many as fit and ends "and N more". With every work of this batch built, John 3:16 reads "Christian writers: the Church Fathers, John Calvin and 5 more". No `short` contains a comma or "and", so lists read as lists.

**Closed** (`closed(verse, d, a)`, shown by the spine when a link opens the panel before the notice is finished): today's lead with the names and the verse ("The Church Fathers, Henry's Concise Commentary and John Wesley wrote about John 3:16."), the button "Show what they wrote", which opens the notice, and the source line in its short form (item 10 below).

**Open** (after the notice, `Panel.tsx`), in this order:

1. The lead, naming the works on the verse.
2. One quiet line under it: "These writers wrote in the language and quarrels of their time; their words are shown as each copy named below has them." (the approved answer to shortlist question 2, with "as printed" corrected, since several copies are not as printed), with "About these copies" linking the cards of the works on the verse, where each copy and its changes are named.
3. A hint, quiet: while no listed writer is open, "Choose a writer to read what they wrote. The app remembers your choice."; once one is open, "Tap a writer to open or close it."
4. **Left out here**, only when the index's `left` has entries for this verse: a short heading and one plain line per entry, in the quiet text colour, never a button, never a writer header, never in the extras line. A `proposed` entry shows "A passage is left out here until a decision on it is made." instead of its line.
5. One section per work with a `has` bit on the verse, oldest first. The header is `<h3><button aria-expanded aria-controls="...">`: line 1 the `short` in bold with an open or closed chevron; line 2, quiet, the row's `work` and `written` ("Commentary on the Gospel of John, 1553"). Tapping opens or closes the writer; the choice is remembered (1.7). The Catena's line 2 is "gathered by Thomas Aquinas in the Catena Aurea, 1260s", and its book line does not repeat it.
6. An open section shows:
   - **the book line**: the row's `writer`, then the `about` from `people` with a "source" link to its `src` (for example "David Brown, Free Church of Scotland professor, Aberdeen [source]"), then the `edition`, then the dates: "Written 1871. This copy: CrossWire's JFB module, version 3.0 of 15 February 2021, copied 2026-10-2x." (3.6), then "See the printed volume" when the row has a scan, then "About this book" (the shelf card);
   - its notes on the verse, each with "On verses 6–8" when it covers more than this verse, its place `w` as a quiet small heading above the text, its text (folded at 600 characters as today, or its stored opening), "Read all" and "Show less" (section 4);
   - inside a note, `[passage left out]` where a sentence or paragraph was cut, with that entry's line under the note;
   - in a Catena chain, each run of neighbouring left-out quotations as one quiet line ("A quotation from Origen is left out here."; "Two quotations are left out here: from Origen and from the unfinished work on Matthew."), then, once after the chain, each reason's `why` with its source link. Left-out lines do not count toward the first four Fathers, and "Show N more of the Fathers" counts only shown quotations;
   - the part file is fetched only when the section is open and comes into view (`IntersectionObserver`). Loading shows "…" in that section only; a failed load says "Sorry, these notes could not be shown right now." in that section only.
7. "Read more on other websites", unchanged in content, shown only here (after the notice).
8. "How these are chosen": one row per work on the verse, labelled with its `short` and a work label where one writer has two works ("Martin Luther, Galatians", "Matthew Henry, complete"), with its `how`; then "Verse numbers" (as today); then "Left out": "Passages found to deny Scripture are left out, and the place is marked; so are quotations from writers the early Church condemned, and books a copy keeps only in part. Each book's card lists what its copy leaves out or changes." with a link to the open works' cards.
9. `<CommentaryFoot/>` ("Commentary, not God's Word · See the notice again"), above the source line.
10. The source line: with works open, each open work's `copy`, license and short dates ("copied 10 October 2026"); with none open, one sentence naming the works on the verse ("The notes on this verse come from the works listed above; each is credited in full when you open it."). It links each work's shelf card, never a commit, PR or blob page of this repository.

**Files:** `voices.extra.tsx` (line, `closed()`, loader), `voices/model.ts` (types of 1.3, `load`, `worksOn(d, verse)`, `rowFor(d, w, verse)`, `partOf(d, w, verse)`, `longOf(d, w, j)`, `leftOn(d, verse)`, `noteLine(d, verse)`, `closedLine(d, verse, a)`, bitset decoding with `atob`, `voicesOpen` and its migration), `voices/Panel.tsx` (`Panel`, `WorkSection`, `BookLine`, `Note`, `Voice`, `Runs` rendering marks, `LeftHere`, `LeftInChain`), `voices/Credit.tsx` (only if AF-K's credit component has not landed; same shape), `voices.css` (new classes `x-voices-pick`, `x-voices-place`, `x-voices-left`, `x-voices-cut`, `x-voices-gap`, using only the app's colour variables; `x-voices-place` may set a copy's printed capitals in small capitals with `font-variant-caps`, which changes no character). `voices/links.ts` is AF-CW's. No spine file changes beyond what `d12a4dd` already makes.

### 1.7 Remembered picks

- `voicesOpen`: a signal of the set of open work ids, stored as a JSON array under `localStorage` key `atlas.voices.open`, every read and write in try/catch.
- **The migration runs once per device, at module load** (`voices/model.ts` loads at app start, fact 9), before any notice can finish: if `atlas.voices.open` is missing, it is written at once, to `["catena-aurea", "henry-concise", "wesley-notes"]` when `atlas.voices === '1'` or `atlas.commentary` is set (a reader who has already seen those three works), and to `[]` otherwise. Then `atlas.voices` is removed. So it works whether or not the notice has already deleted `atlas.voices`, and a reader who finishes the notice later starts with nothing open, as the founder's answer to shortlist question 13 asks ("listed by name, each opened by the reader and remembered").
- If storage is blocked, the set lives in memory only.
- An id that is no longer in the index is ignored and kept (it may come back in a later build).

### 1.8 What loads when

- First visit: nothing (unchanged).
- First move at Deep: `extras/voices/index.json` (about 70,000 to 100,000 bytes for ten works with their rows, people and dates, about 20 KB compressed; today's index is 31,439 bytes).
- Opening a writer: one part file of that writer when its section comes into view, at most 500,000 bytes, about 175 KB compressed.
- A migrated reader with the three live works open: up to three part files on first opening (up to about 525 KB compressed, as today's single per-book file of up to 500 KB is replaced). With all seven works of John 3:16 open and in view: up to about 1.2 MB compressed; sections out of view fetch nothing.
- "Read all" on a long voice: one long file, at most 250,000 bytes, about 85 KB compressed.
- Everything is fetched through `loadJson` with `?<buildId>`, so the service worker serves it cache-first after the first time; `sw.js` does not change.

### 1.9 How it fits the commentary notice

The notice (`d12a4dd`) owns the founder's rule that the first time a reader looks at any commentary they see a big, plain, two-page notice. Voices follows its contract and writes no notice of its own:

- `voices.extra.tsx` keeps `commentary: true` and supplies `closed(verse, d, a)` (1.6). The spine opens the notice when the line is tapped and the notice is not finished, and renders the closed state for a panel opened by a link; voices never calls `askNotice()` itself.
- The one invariant: **no writer's words render while `accepted` is false.** The spine guarantees it; V4's checks prove it on every path (line tap, shared link, Back and Forward).
- The panel keeps its existing one-paragraph lead ("not Scripture, and they do not always agree").
- V4 branches from the tip of `commentary-notice` (or from `main` after it merges), never from an older `main`, because the notice edits the same three files. PR-2 lands after `commentary-notice`.

### 1.10 verify (generalised)

Replaces today's three-work checks. It reads the file list from `meta.json` (`files`), never by walking the folder, so a local tree's stale old-format files cannot confuse it.

1. The index: `format` 2; each `has[w]` decodes to 31,102 bits; `parts[w]` ascending, first entry a chapter start; `long[w]` matches the long files in `meta.json`; under 200,000 bytes; every work has `dates.version` and `dates.copied`, every row `writer`, `short`, `work`, `written` and `edition`.
2. Every part file: items sorted, each on real verses inside one chapter and inside its part's range; every item has at least one said voice; every voice has words, a long pointer or a reason; `who` non-empty exactly when the work has `names` (or the voice is left out); every link a real verse; every long pointer resolves to a text whose start equals the opening, and the opening ends with `more`; every mark kind known (`cut`, `more`, `gap`, `page`, `gloss`).
3. **For each work, the verses its items cover equal its `has` bits exactly, and every set bit has a said voice on that verse.**
4. Clean text in every part and long file: no `{{`, `}}`, `#(`, no tag (`<` followed by a letter or `/`), no undecoded entity (`&amp;`, `&lt;`, `&#`), no carriage return, no "„Y", no "Gutenberg"; no voice whose text is empty.
5. No data file under `extras/voices/` over 1,500,000 bytes.
6. Each `left` entry: book, note and passage scope have no item of that work on the range; sentence and paragraph scope have their `cut` mark in that work's notes on the range.
7. Each work's shelf card is in the built `shelf.json`, group `writers`, listing its datasets.
8. Openings: none ends on a number, a Roman numeral or a single letter (expected 0).
9. Each work's own `checks()` (its known cases, and its note count above 98% of the count measured in its PR).

### 1.11 Size of the shared change alone

The three existing works repacked: the same 14.6 MB of notes (less the pointer-only notes dropped) in about 30 to 35 files instead of 81, with no long files. Each `meta.json` file entry costs about 150 to 160 bytes; the first batch brings the voices files to about 300, so `meta.json` (483 KB today, fetched on every visit) grows by about 30 to 50 KB uncompressed. Every voices PR records `meta.json` before and after, raw and gzipped.

## 2. Scripture respect: the exclusions

The founder: "Leave Luther passages out that deny scripture; commentaries are still okay", and the same for "any passage in any writer that denies Scripture" (decision 2). Every entry is committed, applied by the build, and checked against the text it removes.

### 2.1 Where entries live

- **A configured work's entries are in its own `config/voices/<id>.json`, `exclude`**, owned by that work's module, so modules built in parallel never edit a shared file for them.
- **`config/voices-exclusions.json`** holds only cite-only entries (Pulpit on Ecclesiastes) and entries for works not configured yet (Luther's Peter and Jude, his prefaces). V3 writes it; afterwards only the integrator adds to it. If it is missing, the build treats it as empty, so V1 builds and tests before V3's file exists.

```json
{
  "_comment": [
    "Passages left out of the writers' notes, and why. Shubhanshu, 2026-10-20: leave out passages that deny Scripture, in any writer; the rest of the commentary stays (docs/decisions.md, decision 2).",
    "Each entry names where, the exact words that identify the passage, the scope removed, why, and the line a reader sees. The build checks that the words are in the source where the entry says, removes the passage and marks the place.",
    "decided: who decided and where it is recorded (docs/decisions.md, by heading). Only Shubhanshu decides; a session never fills it. A session that finds a passage writes proposed instead; the passage is left out at once and listed in the PR for his ruling.",
    "An entry whose work is not configured waits for it; its words are checked when the work is added."
  ],
  "exclusions": [ ]
}
```

Entry fields:

| Field | Meaning |
|---|---|
| `id` | lowercase letters, digits, hyphens; unique across every file |
| `work` | in the shared file only: a work id, configured or planned, or null for a cite-only entry |
| `cite` | optional: a `config/layer-sources.json` cite id this entry also governs for Layers (2.7) |
| `scope` | `sentence`, `paragraph`, `note` or `book` |
| `on` | where: a book name for `book` scope, else a reference or range ("1 Peter 1:3-9") |
| `found` | optional: the `Raw` place of the words when not inside `on`: any source entry or heading slot, including verse-0 entries ("Ecclesiastes, book heading", "Ecclesiastes 1:1") |
| `words` | the exact words that identify the passage, in plain text as `Raw` has them |
| `matches` | how many times `words` occur where the entry says (default 1); the build fails on any other count |
| `removes` | required for `note` and `book` scope: how many source entries the entry removes; the build fails on any other count |
| `reason` | `denies-scripture`, `calls-text-wrong` (says words the BSB prints are a copyist's or a writer's mistake; section 9 question 3) or `incomplete-copy` |
| `why` | one plain sentence for the record |
| `line` | what the reader sees, one plain sentence |
| `decided` or `proposed` | exactly one of them, non-empty |
| `waiting` | optional note on what a planned work waits for (the build works out waiting itself) |

### 2.2 How the build applies an entry (`exclude::apply`)

- The words are matched as written, runs of white space as one space, against `Raw`: in `found` when given, else in the entries of `on`. **A passage that is not really there can never sit on the list.**
- `sentence`: removes the sentence or sentences the words lie in (from the sentence start before the first word to the sentence end after the last, by the sentence-end rule of 1.5), and puts `{"k": "cut", "id"}` there.
- `paragraph`: removes the paragraph, with the same mark.
- `note`: removes the whole note; the index gets a `left` line on the verses it covered.
- `book`: removes every note of the work in that book; the index gets a `left` line over the book.
- Applied after `fixes` and before the said-voice rule and packing, so bits, files and counts never include removed text. A note that a sentence or paragraph cut leaves with no words is dropped, and its entry's line goes to `left` for those verses.

### 2.3 Checks

At build: everything in 2.2; ids unique across all files; an entry whose work is not configured is printed as waiting (no field needed); `cite` on the cite list; `on` and `found` parse; strings plain (no em dash, no AI credit phrase). The build prints each entry as `in force`, `waiting for <work>` or `waiting for config/layer-sources.json not_on` (2.7), and the number of `proposed` entries. At verify: 1.10 item 6.

### 2.4 What the reader sees (honest, quiet)

- Inside a shown note, where a sentence or paragraph was removed: `[passage left out]` in the quiet text colour, with the entry's line under the note ("A passage is left out here because it denies that James is Scripture.").
- For a note, a book or an all-hidden Catena passage: the entry's line in the plain "Left out here" list under the lead (1.6 item 4), shown whether or not that writer has other notes on the verse, and never as something to open.
- For a Catena quotation left out among shown ones: section 6.
- For a `proposed` entry: "A passage is left out here until a decision on it is made."
- Never in the extras line; never red, never an icon.

### 2.5 The Scripture check for every new work

Before a work ships, its module runs `node scripts/voices-scan.mjs <work>` on the built part and long files and on `Raw` dumps of what the reader cut (introductions included, so a later change to a cut can be re-checked). The script groups hits by entry (one line per entry, with its count, so many hits in one place do not bury the rest) and prints each with work, reference, pattern and 200 characters of context. Patterns, case-insensitive, at word starts:

- authorship: `not (written|composed) by`, `not the (work|writing) of`, `was not .{0,40}(Moses|David|Solomon|Isaiah|Daniel|Paul|Peter|John|James|Jude)`, `not (Davidic|Mosaic|Solomonic|Pauline|Petrine)`, `(later|another|different|more recent) (hand|author|writer)`, `altogether different author`, `pseudonym`, `forg(ed|ery)`, `spurious`, `not genuine`, `interpolat`, `redactor`, `deutero-?(isaiah|zechariah|nom)` (never matching "Deuteronomy"), `second Isaiah`, `post-?exilic`, `Maccab`;
- canon: `no true apostol`, `not (an )?apostol`, `straw`, `not canonical`, `apocryphal`, `doubt\w* .{0,30}(epistle|book|canon)`;
- error: `error|mistake|by mistake|fault|crept in|amend|corrupt|inaccura|contradict|discrepan` within 60 characters of `evangelist|apostle|Moses|scripture|text|writer|historian|narrative|account|passage|place|name|word|copy|copies|transcrib`;
- `myth|legend|fable`.

Each hit is decided in the work's check file `docs/voices/checks/<work>.md` (committed with the work): "kept: <why it does not deny Scripture>" or "proposed exclusion <id>". The files describe what was checked, never who checked it (decision 19). Proposed entries go into the work's own `exclude` with `proposed`, and the PR body lists them for the founder. The method is written once in `docs/voices/checks/README.md`, including the class "claims that the received text (as the BSB prints it) contains a copyist's error" and the class of textual judgements that agree with the BSB's own omissions (Barnes on Acts 8:37, "unless it is spurious"; JFB and Barnes on 1 John 5:7), which are kept (section 9 question 3).

### 2.6 The first entries

In the shared file (V3):

```json
[
  { "id": "pulpit-ecclesiastes", "work": null, "cite": "pulpit", "scope": "book", "on": "Ecclesiastes",
    "words": "The writer assumes the role of Solomon",
    "reason": "denies-scripture",
    "why": "W. J. Deane's Ecclesiastes in the Pulpit Commentary holds that a later writer took Solomon's part.",
    "line": "",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, 'The lists', shortlist question 9)" },

  { "id": "luther-peter-jude-james", "work": "luther-peter-jude", "scope": "sentence", "on": "1 Peter 1",
    "words": "the Epistle of James is no true Apostolic Epistle",
    "reason": "denies-scripture", "why": "Luther denies that James is an apostle's letter.",
    "line": "A passage is left out here because it denies that James is Scripture.",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, decision 2)",
    "waiting": "Project Gutenberg ebook 29678 (Gillett, 1859), not in this batch" },
  { "id": "luther-peter-jude-jude", "work": "luther-peter-jude", "scope": "paragraph", "on": "Jude 1:1-2",
    "words": "cannot be looked upon as being that of one who was truly an Apostle",
    "reason": "denies-scripture", "why": "Luther denies that Jude was written by an apostle.",
    "line": "A passage is left out here because it denies that Jude is Scripture.",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, decision 2)", "waiting": "Project Gutenberg ebook 29678, not in this batch" },
  { "id": "luther-preface-james", "work": "luther-prefaces", "scope": "paragraph", "on": "James",
    "words": "I consider that it is not the writing of any apostle",
    "reason": "denies-scripture", "why": "Luther's preface to James denies that it is an apostle's writing.",
    "line": "A passage is left out here because it denies that James is Scripture.",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, decision 2)", "waiting": "Luther's prefaces (CrossWire module Luther), not in this batch" },
  { "id": "luther-preface-ecclesiastes", "work": "luther-prefaces", "scope": "paragraph", "on": "Ecclesiastes",
    "words": "certainly not written or set down by King Solomon with his own hand",
    "reason": "denies-scripture", "why": "Luther's preface to Ecclesiastes denies that Solomon wrote it.",
    "line": "A passage is left out here because it denies that Solomon wrote Ecclesiastes.",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, decision 2)", "waiting": "Luther's prefaces (CrossWire module Luther), not in this batch" }
]
```

In `config/voices/calvin-commentaries.json` (V6):

```json
[
  { "id": "calvin-1-timothy", "scope": "book", "on": "1 Timothy", "found": "1 Timothy 1:1", "words": "THE FIRST EPISTLE TO TIMOTHY", "matches": 1, "removes": 6,
    "reason": "incomplete-copy",
    "why": "This copy keeps only the start of each chapter's comments on the Pastoral letters (9,532 words in 13 entries); shown as it is, it would misrepresent Calvin.",
    "line": "Calvin's notes on 1 Timothy are left out: this copy keeps only the start of each chapter's comments (about 9,500 of Calvin's words on these letters).",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, 'The lists': the shortlist's first batch, row 2)" },
  { "id": "calvin-2-timothy", "scope": "book", "on": "2 Timothy", "found": "2 Timothy 1:1", "words": "SECOND EPISTLE TO TIMOTHY", "matches": 1, "removes": 4,
    "reason": "incomplete-copy", "why": "As calvin-1-timothy.",
    "line": "Calvin's notes on 2 Timothy are left out: this copy keeps only the start of each chapter's comments (about 9,500 of Calvin's words on these letters).",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, 'The lists')" },
  { "id": "calvin-titus", "scope": "book", "on": "Titus", "found": "Titus 1:1", "words": "Paul, a servant of God, and an apostle of Jesus Christ", "matches": 1, "removes": 3,
    "reason": "incomplete-copy", "why": "As calvin-1-timothy.",
    "line": "Calvin's notes on Titus are left out: this copy keeps only the start of each chapter's comments (about 9,500 of Calvin's words on these letters).",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, 'The lists')" },

  { "id": "calvin-matthew-27-9", "scope": "paragraph", "on": "Matthew 27:9",
    "words": "the name of Jeremiah has been put down by mistake, instead of Zechariah",
    "reason": "calls-text-wrong", "why": "Calvin holds that the name Jeremiah in Matthew 27:9 is a mistake.",
    "line": "A passage is left out here because it says a word of this verse is a mistake.",
    "proposed": "found by the Scripture check, 2026-10-21; section 9 question 3" },
  { "id": "calvin-acts-7-14", "scope": "sentence", "on": "Acts 7:14",
    "words": "this difference came through the error of the writers which wrote out the books",
    "reason": "calls-text-wrong", "why": "Calvin holds that the number in Acts 7:14 came from copyists' error.",
    "line": "A passage is left out here because it says a word of this verse is a copyist's mistake.",
    "proposed": "found by the Scripture check, 2026-10-21; section 9 question 3" },
  { "id": "calvin-acts-7-16", "scope": "paragraph", "on": "Acts 7:16",
    "words": "Wherefore this place must be amended",
    "reason": "calls-text-wrong", "why": "Calvin holds that the name Abraham in Acts 7:16 is a fault to be amended.",
    "line": "A passage is left out here because it says a word of this verse is a mistake.",
    "proposed": "found by the Scripture check, 2026-10-21; section 9 question 3" }
]
```

V6 sets each proposed entry's scope to the smallest that removes every sentence saying the text is wrong (the Acts 7:16 paragraph also holds "it is manifest that there is a fault [mistake] in the word Abraham"), and confirms `matches`.

In `config/voices/keil-delitzsch.json` (V8):

```json
[
  { "id": "kd-ecclesiastes", "cite": "keil-delitzsch", "scope": "book", "on": "Ecclesiastes", "found": "Ecclesiastes 1:1",
    "words": "was not written by Solomon himself, but by a Jewish thinker of a much later age", "matches": 1, "removes": "<measured by V8>",
    "reason": "denies-scripture",
    "why": "Franz Delitzsch's commentary on Ecclesiastes holds that Solomon did not write the book.",
    "line": "Franz Delitzsch's notes on Ecclesiastes (in Keil and Delitzsch's commentary) are left out, because he holds that Solomon did not write the book.",
    "decided": "Shubhanshu, 2026-10-20 (docs/decisions.md, 'The lists', shortlist question 9)" },
  { "id": "kd-psalm-74", "scope": "sentence", "on": "Psalm 74:4",
    "words": "a weighty instance in favour of the Maccabaean origin of the Psalm",
    "reason": "denies-scripture", "why": "Delitzsch favours a Maccabean date for a psalm whose title names Asaph.",
    "line": "A passage is left out here because it denies what the psalm's title says of its writer.",
    "proposed": "found by the rules review, 2026-10-21; section 9 question 2" },
  { "id": "kd-psalm-86", "scope": "sentence", "on": "Psalm 86:1",
    "words": "can only be called a Psalm by David as having grown out of Davidic and other model passages",
    "reason": "denies-scripture", "why": "Delitzsch denies that David wrote Psalm 86, whose title names him.",
    "line": "A passage is left out here because it denies what the psalm's title says of its writer.",
    "proposed": "found by the rules review, 2026-10-21; section 9 question 2" },
  { "id": "kd-psalm-130", "scope": "sentence", "on": "Psalm 130:1",
    "words": "Ps 86 is not Davidic",
    "reason": "denies-scripture", "why": "As kd-psalm-86.",
    "line": "A passage is left out here because it denies what a psalm's title says of its writer.",
    "proposed": "found by the rules review, 2026-10-21; section 9 question 2" }
]
```

V8 adds the 74:18 sentence the same way, and confirms every word list and `matches` against `Raw`. In Barnes (V11), `barnes-matthew-27-9` is proposed the same way for "a mistake made by ancient transcribers ... Probably this is the correct explanation" (V11 copies the exact words).

Notes on the first entries:

- The quoted words come from the research's and the reviews' readings; **each module confirms them against the pinned text**. A cite-only entry's words are confirmed on a scan by V12, which records the URL in the evidence file; the build cannot check them because the app has no copy.
- **Proverbs 1:7 to 9:18.** Delitzsch's introduction gives these chapters to "an altogether different author from Solomon, and one who is more recent". The words are in an introduction, which KD's reader cuts, so nothing of it is shown. `docs/voices/checks/keil-delitzsch.md` records it as "hidden only by the introduction cut"; any later change to that cut must re-check it and add an entry.
- Psalm 44: Delitzsch weighs a Maccabean date and rejects it ("Nevertheless many considerations are opposed to the composition of the Psalm in the time of the Maccabees"); kept. Calvin's view that Paul did not write Hebrews, which names no author: kept under question 2's proposed default.
- When Luther's prefaces are read, his doubts about Hebrews, Jude and Revelation (1522) get entries the same way; decision 2 already covers them.

### 2.7 The Layers side (module V12)

`not_on` in `config/layer-sources.json` stays the rule Layers enforces. An exclusion with `cite` is in force for Layers once that cite entry's `not_on` lists the book; until then the build prints it as waiting. V12 adds `"Ecclesiastes"` to `not_on` for `keil-delitzsch` and `pulpit` (with their `why` updated), and fixes the Ecclesiastes passages that cite them: on `main` at `2aabdcc`, 12 notes in 8 passages (15 cites). For each note it removes the cite, recounts the strength by the writer-count rule (3 or more interpreters "widely agreed", 2 "commonly held", 1 "some interpreters"), and where that leaves a note without a citation or a passage the build refuses, it finds a second interpreter who states the point (fetched URL and exact quote in the evidence) or drops the note or passage. `ecclesiastes-3-20` and `ecclesiastes-6-10`, whose plain-meaning notes rest on these works alone, are the first cases.

- **Acceptance adds:** no edited passage carries any AI line (decisions 13 and 15; TC removes the passage lines first, and V12 adds none); each edited note reads as what its named sources say, with their words one tap away in the citation shape TC ships.
- **When:** after TC merges (TC holds `config/layers.json` and `config/layer-sources.json` until then), after PR-5 (the Luther cite entry, which the integrator adds to the same file), and not while AF-LR, AF-LS or AF-LE hold `config/layers.json` (AUDIT-FIXES-PLAN.md section 5).

## 3. Exact credit

### 3.1 On screen

1. **The writer, the work and its date**: the section header (`short`; then `work` and `written`).
2. **Who wrote these words, from what printing, and when this copy was made**: the book line (1.6 item 6), built from the row and the work's `people` and `dates`. For example: "David Brown, Free Church of Scotland professor, Aberdeen [source]. A Commentary, Critical and Explanatory, on the Whole Bible (Glasgow, 1871); this part by David Brown. Written 1871. This copy: CrossWire's JFB module, version 3.0 of 15 February 2021, an expanded electronic edition that modernises some words; copied 2026-10-2x. See the printed volume."
3. **The place in the original**: the note's `w` where the source has one: Henry's section title ("The Creation. (b. c. 4004.)"), JFB's section heading, Luther's part or section heading with Lenker's paragraph numbers ("paragraphs 107 to 111 in Lenker's numbering"), the Catena's own citation at the head of each quotation (shown as today; its plain-words version is AF-FL's). No first-batch copy carries page numbers, so none are shown; volume and page arrive with the fathers track (`{"k": "page"}` and `w`).

Under the open writers, the source line names each copy used, with its license and dates; "About this book" opens the shelf card with the full citation and the list of what the copy leaves out or changes. Every fact a reader sees about a person or a book is one tap from its source (`src` or `checked`).

### 3.2 Where the facts come from

- `lines` rows are facts about books (writer of each part, work, original date, printing, translator). Each is checked against a dated scan of the volume (archive.org identifier and page) or the copy's own title page, never guessed; a row that cannot be checked is left out, and that range shows the work-level fields with "printing not identified" in place of the edition.
- `people`, `who` and `reasons` are facts about persons and history. Each carries a `src` from a public-domain believing work, preferably quoted: for example Smith and Wace, A Dictionary of Christian Biography (1877–87), for persons of the early Church; Percival, The Seven Ecumenical Councils (Nicene and Post-Nicene Fathers, series II, vol. 14, 1900), for the condemnations of 553 and later; Socrates, Church History 1.8, and Theodoret, Church History book 1 (NPNF II vols. 2 and 3), for Eusebius; a dated title page for a writer's post; and the dictionaries the app already ships (Easton's and Smith's) where they have the entry. **Where no source can be found, the claim is dropped.**
- **The evidence is kept in the repository** (decision 11): each module writes `docs/evidence/voices-<work>-<date>.json`, one record per fact: URL, final URL, HTTP status, UTC time, SHA-256 of the body, and the exact public-domain quote (AUDIT-FIXES-PLAN.md rule 6). Records say what was checked ("checked against the source"), never who or what checked it (decision 19). `node scripts/voices-evidence.mjs` (V1) fails a PR whose `src` or `checked` has no record, or whose quote is not found in the fetched text.

### 3.3 Words exactly as the copy has them

Allowed, and each named in NOTICE.md and on the shelf card for the work: joining a paragraph's lines; decoding entities; turning marked references into links whose words stay as the copy has them; leaving out whole parts (introductions, printed Bible text, outlines, translators' and editors' notes, a copy's own labels, Project Gutenberg's header and license); moving a footnote to follow its paragraph; replacing an unreadable run with the `gap` mark (5.3); setting a heading's printed capitals in small capitals by CSS; and the exclusions with their marks. Not allowed: changing spelling, modernising, abridging, paraphrasing, or correcting anything except a `fixes` entry, which corrects a slip of the copy to the printed edition only when a scan proves it (the Catena's "Clement of Alexendria" is the precedent).

**Every credit says "word for word from this copy", never "as printed".** Where the copy itself departs from the print, the credit says so on screen and in NOTICE.md: Calvin's American spelling (CCEL's transcription); JFB's modernised "expanded edition"; Graebner's abridged Galatians; Keil and Delitzsch's Wikisource text with no known source document; Barnes's unnamed printing.

### 3.4 NOTICE.md

Each work adds one row to the table at the top (what, from whom, license) and one paragraph in "Christian writers of the past" naming the whole copy chain with its dates and every change made to its text (texts in section 5). The section's closing sentence becomes: "The files built from these (web/public/data/extras/voices/) are public domain, except web/public/data/extras/voices/keil-delitzsch/, which is shared under CC BY-SA 4.0 as an adaptation of text shared under CC BY-SA 3.0 (5.3)." No NOTICE text carries AI wording.

### 3.5 Shelf cards

Group `writers`, one card per work, `datasets` equal to the work's sources, and `cites` naming the cite entry, as the existing `keil-delitzsch` card does, so these are the cards Layers cites resolve to and the shelf never shows two cards for one work (the shelf work of HANDOFF section 9 item 6 and AF-SH builds on them, and VI checks before each PR that no other branch has added a card for the same cite).

- `citation` gives the printed edition in full; `licenseNote` names the copy chain, its license and what the copy leaves out or changes; `when` gives the three dates ("written 1871; this version 15 Feb 2021; copied <date>", audit question 3); `find` links the pinned file in another repository, or the raw file of a mirror branch at its commit (`raw.githubusercontent.com/Sixteen1-6/BibleAtlas/<sha>/SOURCE.md`), never a commit, PR or blob page of this repository.
- `what` holds only what the title page says or what a `src` supports; the module records its evidence. `plain` is at most 48 characters and `what` at most 240 (`shelf.rs` refuses longer).

### 3.6 Dates (decision 10, audit questions 2 and 3)

Every work shows three dates, and a fourth where its source records one:

| Date | What it is | Where it comes from |
|---|---|---|
| written | when the words were first written or printed, per `lines` row where volumes differ | the dated scan or title page in `checked` |
| this version | what the copy is and its date: the CrossWire module and its `SwordVersionDate`; the Let's Church file and its last change; Project Gutenberg's "most recently updated" date; the module version a Let's Church file follows only where proven | the conf line, the upstream `git log -1` of the pinned file, or the fetched page, recorded in `dates.version.from` |
| copied | the UTC date this app's pin was set: the commit that first sets the pin in `sources.json`, or the mirror commit's date | `git log`, never guessed |
| retrieved (only where the source records it) | the date the source says it read its own source (the Catena project: ecatholic2000.com, 2026-07-10) | the source's own records, named as theirs |

- The app's own read date is "copied", which the repository proves (audit question 2). No credit shows a read date the repository does not prove.
- `copied` is written into `config/voices/<id>.json` (and, once AF-DT lands, into `sources.json` as AF-DT's `copied`), so builds stay reproducible; `node scripts/voices-dates.mjs` (V1) recomputes it and `version` from git and the pinned files and fails the PR on any difference.
- For the three live works (V1): version as in fact 10; copied 2026-10-10 (`38749bd`); the Catena's retrieved as its records say.

## 4. Long notes: the opening, with "Read all" loading the rest

The founder: "Opening and read all is allowed." (decision 8).

- Stored (1.5): for works with `long_chars`, a voice over that length keeps an opening of up to 700 characters, cut at a paragraph or sentence end, in its part file; its whole text goes to the work's long files. The Catena, the Concise and Wesley have no long files: their voices fold in place at 600 characters as today, and the Catena still shows its first four Fathers before "Show N more of the Fathers".
- Shown: a long voice shows its opening, then "…" and "Read all". "Read all" fetches long file `j` once (cached like any data file) and shows the whole text in place, **keeping the scroll position and moving focus to the first paragraph after the opening**. "Show less" scrolls the note's start into view and puts focus on "Read all". A note over about 10,000 characters also gets a "Show less" at its top. While loading, the button reads "Loading…"; if the fetch fails, the opening stays and a quiet "Sorry, the rest could not be loaded right now." appears.
- The opening always ends with the `more` mark, so verify can check that every long voice has one and that the opening is a prefix of its whole text.
- Expected share: almost every section of Henry's complete commentary and most of Keil and Delitzsch's notes are long; JFB, Barnes, Calvin and Luther mostly are not. The Puritans' book-length notes (Sibbes on 2 Corinthians 1:12, about 400 KB) fit the same design.

## 5. The first batch, in build order

**Order:** the shared change with the three live works (5.0); the Catena clean-up (section 6); the SWORD reader; Luther's Galatians and Genesis 1 to 9 (5.4); Keil and Delitzsch (5.3); Barnes on the New Testament (5.6). **Held until the founder rules on CCEL's terms (section 9 question 1):** Calvin's New Testament (5.1), JFB (5.2) and Henry's complete commentary (5.5), all three CCEL transcriptions. JFB is not mirrored until then either, since a public mirror is itself a republication.

For every work whose text is a CCEL transcription (the Concise, Calvin, JFB, Henry complete), the module reads CCEL's own page for the book (or the opening of its text file, as VOICES-PLAN.md found for `jfb.txt`), records its rights line ("Rights: Public Domain") in the evidence file, and quotes it beside CCEL's site policy in `sources.json` `license` and in NOTICE.md.

Common to every work: the module adds `config/voices/<id>.json` (with its `exclude`), its reader, its check file `docs/voices/checks/<id>.md` and its evidence file, and hands the integrator a full `sources.json` entry (every field `sources.rs` requires: id, title, provides, license, attribution, homepage, repo, commit, files, with note; plus AF-DT's `original`, `version` and `copied`), a NOTICE row and paragraph, a shelf card and any cite entry (8.3).

### 5.0 The three works already live: same notes, corrected credits

Acceptance for V1: **the same notes, with corrected credits.** Every note's (work, from, to, text) is identical to `main`'s, except the pointer-only and empty notes dropped by the said-voice rule (listed in the PR, about 139 Wesley sections and the Isaiah 36 Concise section, unless no-empty-selections has already removed them), as checked by `scripts/voices-compare.mjs` (V1, committed). The credits change as below. Today's known cases still pass in the new format.

| id | reader | cite | order | long_chars |
|---|---|---|---|---|
| `catena-aurea` | `catena` | `catena-aurea` | 1264 | null |
| `henry-concise` | `henry-concise` | `henry-concise` | 1708 | null |
| `wesley-notes` | `wesley` | `wesley` | 1755 | null |

**`catena-aurea`.**

- writer "The Church Fathers"; short "the Church Fathers"; title "Catena Aurea (the Golden Chain)"; written "1260s"; one row over the four Gospels: writer "the Church Fathers, as Thomas Aquinas gathered them"; work "Catena Aurea: Commentary on the Four Gospels, Collected out of the Works of the Fathers"; written "1260s"; edition "the Oxford translation edited by John Henry Newman (London: J. G. F. and J. Rivington, 1841–45)"; checked against a dated scan of a volume's title page (V1 records it).
- copy: "The Oxford translation edited by John Henry Newman (1841–45), transcribed from ecatholic2000.com, which the Catena project records reading on 10 July 2026, as kept in the Catena project's files on GitHub (AlvaroBalbin/catena, commit efe1bd0)."
- how: "Each passage shows with the verses Aquinas gathered it on; each quotation is under the name of the writer quoted."
- `who`: V1 seeds today's seven notes (Gloss, Greek Expositor, Pseudo-Chrysostom, Pseudo-Jerome, Pseudo-Augustine, Pseudo-Athanasius, Josephus), each with a `src` V1 finds (for example the Oxford translation's own notes or list of authors, or the Catholic Encyclopedia of 1907–14), so nothing shown today disappears between PR-2 and PR-3; a note V1 cannot source is dropped and listed in the PR. V2 adds the rest (section 6).

**`henry-concise`** (audit question 16, decision 10).

- writer "an editor this copy does not name, abridging Matthew Henry's commentary"; short "Henry's Concise Commentary"; title "Concise Commentary on the Whole Bible".
- Rows: Genesis to Acts: writer "an editor this copy does not name, abridging Matthew Henry's Exposition of the Old and New Testament"; Romans to Revelation: writer "an editor this copy does not name, abridging the part of the Exposition finished after Henry's death in 1714 by other ministers". Both: written "abridged from the Exposition (1708 to 1721, each volume's year checked by V1 or V10 on a scan); the abridgment's date is not established"; edition "as printed by Moody Press (28th printing), as CrossWire's MHCC module describes it ('This text matches the printed edition as published by Moody Press, 28th printing')". `people` gets Matthew Henry ("Nonconformist minister in Chester and Hackney, 1662 to 1714") with a `src`.
- copy: "CCEL's mhcc.txt, by way of CrossWire's MHCC module (version 2.0 of 14 February 2021), in Let's Church's file of 30 June 2026 (LetsChurch/lets.church, commit 71f6f0f); CCEL calls it 'An abridgment of the 6 volume Matthew Henry's Commentary on the Bible'."
- how: "Each note shows with the verses the abridgment's own headings name; a chapter it treats as a whole covers the whole chapter."
- sources.json `license` and NOTICE quote CCEL's two statements (the book-level mark and the site policy, fact 11). If the founder rules that CCEL's per-book mark does not suffice (section 9 question 1), the live Concise comes back to him too.

**`wesley-notes`** (audit question 16).

- writer "John Wesley"; short "John Wesley"; title "Explanatory Notes upon the Old and New Testaments".
- Rows: Matthew to Revelation: work "Explanatory Notes upon the New Testament", written "1755", edition "drawing on J. A. Bengel's Gnomon, as Wesley's preface says"; Genesis to Malachi: work "Explanatory Notes upon the Old Testament", written "1765–66", edition "drawing largely on Matthew Henry and Matthew Poole, as Wesley's preface says". V1 quotes each preface from a dated scan (for example `bim_eighteenth-century_explanatory-notes-upon-t_1755`, and the 1765 volumes) and puts the quote in the row's evidence; if a preface does not say it, that part of the row is dropped. `people`: John Wesley ("founder of Methodism, 1703 to 1791") with a `src`.
- copy: "Sulu Kelley and Bill Brown's electronic edition, by way of CrossWire's Wesley module (version 1.1 of 28 November 2001), in Let's Church's file of 30 June 2026 (LetsChurch/lets.church, commit 71f6f0f)."
- how: "Each note shows with the verse whose words it explains."

### 5.1 John Calvin, New Testament commentaries (held: section 9 question 1)

- **Source** (`sources.json`):

```json
{
  "id": "calvin-commentaries",
  "title": "John Calvin's Commentaries, in the Calvin Translation Society's English (Edinburgh, 1843–55), from the CrossWire SWORD module CalvinCommentaries, as kept in the Let's Church repository",
  "provides": "Calvin's own notes on 21 books of the New Testament, verse by verse. Shown at Deep, under the verse each note is on, once a reader has seen the commentary notice and opens Calvin.",
  "license": "Public domain (Calvin, 1540–64; the Calvin Translation Society's translation, 1843–55). The SWORD module marks it 'Public Domain'; its text is CCEL's transcription, whose site says 'These books may be used for personal, educational, or non-profit purposes. Contact us for permission to republish CCEL works or to use them commercially.' Used under Shubhanshu's ruling of <date> (docs/decisions.md). The Let's Church repository is CC0 1.0.",
  "attribution": "John Calvin, Commentaries, translated for the Calvin Translation Society (Edinburgh, 1843–55), public domain; transcribed by the Christian Classics Ethereal Library; from the CrossWire Bible Society's SWORD module CalvinCommentaries, version 1.1 (1 August 2022); as kept in the Let's Church repository, github.com/LetsChurch/lets.church (CC0 1.0), file of 30 June 2026.",
  "homepage": "https://github.com/LetsChurch/lets.church",
  "repo": "https://github.com/LetsChurch/lets.church",
  "commit": "71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239",
  "files": { "calvin": "packages/lets.bible/seed/commentaries/calvin.json" },
  "note": "Only the New Testament is used, and not 1 and 2 Timothy or Titus, which this copy keeps only as the start of each chapter's comments. Each note is placed on the verse the file gives. Each section's printed verses, each book's Argument and the next passage's verses in English and Latin, which the file prints at the end of the entry before, are left out, as are the translators' additions at the ends of five books.",
  "original": { "by": "John Calvin", "work": "Commentaries", "date": "1540–64" },
  "version": "<AF-DT: the pinned commit's date>",
  "copied": "<the UTC date of the commit that adds this entry>"
}
```

  `calvin.json` is git blob `df5a72fe665dd4f6734218b213dcf978ece5f481`, 35,706,368 bytes, SHA-256 `7d03ab006c4b0afec450181fb1b5a3ce5de115c4259b72d83d775eaa8f2a7736`. It joins the existing `lets.church@71f6f0fc8f` checkout.
- **License check:** the existing `entries()`: `work.license == "Public Domain"`; plus the founder's recorded CCEL rule.
- **Reader** (`extra_voices/calvin.rs`, `read`):
  1. New Testament entries only (`MAT` to `JUD`); Old Testament entries counted as "left for later".
  2. Each entry on its own verse (`verseEnd` ignored, as for Wesley).
  3. **Leading block:** a body that begins with a `{{ref:Bible:...}}` paragraph and the printed verses (English, then Latin, matched to the KJV verses with `quoted_in`) has that block left out and counted (Philemon 1:1 is the only New Testament entry like this).
  4. **Tail cut, only after the first comment paragraph:** cut at the earliest later paragraph that is only a `{{ref:Bible:...}}` mark, or is "THE ARGUMENT" or "ARGUMENT", or begins "COMMENTAR" in capitals; then drop trailing paragraphs with no lowercase letter. A note left with no words is dropped with a count, never shown empty.
  5. `CALVIN_TAILS`: 5 rows (the last entries of Romans, Ephesians, Philemon, Hebrews, Jude), each `(book, chapter, verse, first words of the translators' addition)`; the build cuts there and fails if the words are not found exactly once.
  6. References: strip `Bible:` before parsing; labels as the copy has them.
  7. Self-check: an entry that begins "N. " must have N equal to its verse, and its words to the first full stop must be in the KJV verse; entries that begin with a reference are skipped; mismatches listed; the build fails on any not in a fix table.
  8. **The Harmony on Mark and Luke.** Most of Calvin's notes on Mark and Luke are filed under Matthew. V6 measures whether the Harmony's section headers name their Mark and Luke parallels. If they do, each such note is placed on those verses too, with `w` "In Calvin's Harmony, with Matthew 3:1–6" (the size change is recorded). If not, `how`, NOTICE.md and the shelf card say "Calvin's notes on most of Mark and Luke are in his Harmony, under Matthew."
  9. Report: "voices calvin-commentaries: N notes on M verses in 21 books; L leading blocks, H section headers and A Arguments cut; 5 translators' additions cut; E empty notes dropped; 13 notes in 1 and 2 Timothy and Titus left out; P proposed exclusions in force; O Old Testament entries left for later".
- **Works config:** writer "John Calvin"; short "John Calvin"; title "Commentaries on the New Testament"; written "1540–64"; order 1540; cite `calvin`; long_chars 2000; `people`: John Calvin ("Reformer in Geneva, 1509 to 1564") with a `src` (for example Beza's Life of Calvin in the Calvin Translation Society's translation, 1844). Expected `lines` (V6 checks each against the volume's title page, and takes each book's Latin date from it or its preface): Matthew to Luke, Commentary on a Harmony of the Evangelists, translated by William Pringle, 3 vols., 1845–46; John, Pringle, 2 vols., 1847; Acts, Christopher Fetherstone's 1585 translation revised by Henry Beveridge, 2 vols., 1844; Romans, John Owen, 1849; 1 and 2 Corinthians, Pringle, 2 vols., 1848–49; Galatians and Ephesians, Pringle, 1854; Philippians to 2 Thessalonians, Pringle, 1851; Philemon, Pringle, 1856; Hebrews, John Owen, 1853; James to Jude, John Owen, 1855.
- **copy:** "The Calvin Translation Society's English, in CCEL's transcription (American spelling), by way of CrossWire's CalvinCommentaries module (version 1.1 of 1 August 2022), in Let's Church's file of 30 June 2026 (LetsChurch/lets.church, commit 71f6f0f)."
- **how:** "Each note shows with the verse Calvin comments on. On Matthew, Mark and Luke he wrote one Harmony of the three, filed mostly under Matthew."
- **Cite list:** `calvin` exists; no change.
- **Shelf card** (new): id `calvin-commentaries`; cites "Calvin"; plain "Bible commentary, 1540s–60s"; title "Commentaries on the New Testament"; by "John Calvin; translated for the Calvin Translation Society"; when "written 1540–64; this version 1 Aug 2022; copied <date>"; what "The Reformer's commentaries on the New Testament, verse by verse, in the Calvin Translation Society's English."; licenseNote "Public domain. CCEL's transcription (American spelling), by way of CrossWire's CalvinCommentaries module, in the Let's Church repository (CC0 1.0), commit 71f6f0f. Left out: the Old Testament for now, 1 and 2 Timothy and Titus, the printed verses, the Arguments and five translators' additions."; find: the GitHub blob of `calvin.json` at the commit in the Let's Church repository; citation "John Calvin, Commentaries, translated for the Calvin Translation Society, 45 vols. (Edinburgh, 1843–55), New Testament volumes."
- **NOTICE.md row:** "What John Calvin wrote on 21 books of the New Testament, in his own words, shown at Deep once a reader opens him (web/public/data/extras/voices/calvin-commentaries/)" | "John Calvin, Commentaries, Calvin Translation Society English (Edinburgh, 1843–55), CCEL's transcription, CrossWire SWORD module CalvinCommentaries 1.1, via LetsChurch/lets.church" | "Public domain (the text); CC0 1.0 (the Let's Church repository)".
- **NOTICE.md paragraph:** "Calvin's notes are copied word for word from this copy, CCEL's transcription of the Calvin Translation Society's English, which uses American spelling ("Savior"), by way of CrossWire's CalvinCommentaries module (version 1.1 of 1 August 2022) and Let's Church's file of 30 June 2026, copied into this app on <date>. CCEL's terms are quoted in sources.json; this use follows Shubhanshu's ruling of <date>. Each note is placed on the verse the file gives. Left out: the Old Testament (for now); 1 and 2 Timothy and Titus, which this copy keeps only as the start of each chapter's comments; each section's printed verses; each book's Argument and the next passage's verses in English and Latin, which the copy prints at the end of the note before; the translators' additions at the ends of Romans, Ephesians, Philemon, Hebrews and Jude; and passages that say words of Scripture are mistakes (config/voices/calvin-commentaries.json). References the copy marks become links where they name verses the Berean Standard Bible has."
- **checks():** note count above threshold (about 4,800 measured in the research); John 3:16's Calvin note contains "Christ opens up the first cause"; Romans 3:28's does not contain "Is he the God of the Jews only"; Matthew 5:3 has a Calvin note (the Harmony); Philemon 1:1 has a Calvin note with words; no Calvin note in the Old Testament, 1 Timothy, 2 Timothy, Titus, 2 John, 3 John or Revelation; no Calvin note contains "THE ARGUMENT", "COMMENTARIES ON", "Doddridge", "Macknight" or "put down by mistake"; `left` holds the three Calvin book entries.
- **Size:** about 11.6 MB of notes, about 4.0 MB compressed, about 24 to 30 files (more if the Harmony is placed on its parallels).

### 5.2 Jamieson, Fausset and Brown (1871) (held: section 9 question 1)

- **Source** (`sources.json`), after the JFB mirror row has run:

```json
{
  "id": "jfb",
  "title": "Jamieson, Fausset and Brown, A Commentary, Critical and Explanatory, on the Whole Bible (1871), from the CrossWire SWORD module JFB 3.0, mirrored unchanged on this repository's branch mirror/sword-JFB",
  "provides": "The three ministers' notes on the whole Bible. Shown at Deep, under the verses each note is on, once a reader has seen the commentary notice and opens them.",
  "license": "Public domain (1871). The SWORD module marks it 'Public Domain'; its text is CCEL's jfb.txt, whose accompanying statement says 'This expanded edition of the Jameison-Faussett-Brown Commentary is in the public domain and may be freely used and distributed'; CCEL's site says 'Contact us for permission to republish CCEL works or to use them commercially.' Used under Shubhanshu's ruling of <date> (docs/decisions.md).",
  "attribution": "Robert Jamieson, A. R. Fausset and David Brown, A Commentary, Critical and Explanatory, on the Whole Bible (1871), public domain; in an expanded electronic edition prepared from text scanned by Woodside Bible Fellowship, as kept by the Christian Classics Ethereal Library (jfb.txt); from the CrossWire Bible Society's SWORD module JFB, version 3.0 (15 February 2021); copied unchanged from crosswire.org to github.com/Sixteen1-6/BibleAtlas, branch mirror/sword-JFB, on <date>.",
  "homepage": "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=JFB",
  "repo": "https://github.com/Sixteen1-6/BibleAtlas",
  "commit": "<the 40-character tip of mirror/sword-JFB>",
  "files": {
    "conf": "mods.d/jfb.conf",
    "ot-bzs": "modules/comments/zcom/jfb/ot.bzs", "ot-bzv": "modules/comments/zcom/jfb/ot.bzv", "ot-bzz": "modules/comments/zcom/jfb/ot.bzz",
    "nt-bzs": "modules/comments/zcom/jfb/nt.bzs", "nt-bzv": "modules/comments/zcom/jfb/nt.bzv", "nt-bzz": "modules/comments/zcom/jfb/nt.bzz",
    "source": "SOURCE.md"
  },
  "note": "Read with the build's SWORD reader. A note the module links over several verses is placed once over those verses. The general and book introductions are left out. References keep the module's abbreviations.",
  "original": { "by": "Robert Jamieson, A. R. Fausset and David Brown", "work": "A Commentary, Critical and Explanatory, on the Whole Bible", "date": "1871" },
  "version": "<AF-DT>", "copied": "<the mirror commit's date>"
}
```

- **License check** (`sword::Module::open`): the conf, read with `\r` trimmed, has `DistributionLicense=Public Domain` and `TextSource=https://ccel.org/ccel/j/jamieson/jfb/cache/jfb.txt`; `SOURCE.md`'s table lists every pinned file with the SHA-256 the lock recorded.
- **The SWORD reader** (`extra_voices/sword.rs`, module V5), shared by JFB, KD, Barnes and later CrossWire works:
  - `pub struct Module`; `pub fn open(ctx, source_id, conf_key, prefix: &str) -> Result<Module, String>` reads the conf (`ModDrv`, `DataPath`, `SourceType`, `Encoding`, `BlockType`, `CompressType`, `Versification`, `DistributionLicense`). **A field the conf leaves out takes SWORD's default** (`Versification` KJV, `CompressType` ZIP, `BlockType` CHAPTER for zCom); only a stated value that is not supported is refused (anything but `ModDrv` zCom or zCom4, ZIP, UTF-8, KJV). Barnes's conf has no `Versification` line.
  - Slots: built from `ctx.vz` in SWORD order (module heading, testament heading, then per book a book heading and per chapter a chapter heading followed by its verses), after checking that the totals are 24,115 and 8,246. The verse-index size must equal slots times the entry size, or the build fails.
  - `pub fn entries(&self) -> Result<Vec<SlotEntry>, String>`: verse slots; consecutive verse slots with the same (block, offset, size) become one entry over a range, which must stay in one chapter; empty slots skipped. **Heading slots are returned too, marked as headings**, so `Raw` can hold their text (an introduction kept there can be matched by an exclusion's `found`); readers leave them out of notes. Blocks are decompressed once each with `miniz_oxide::inflate::decompress_to_vec_zlib` and checked against the stored uncompressed size.
  - `pub fn osis(text, here, ctx, report) -> Parsed { titles, runs, notes }`: `<reference osisRef>` to a verse link (label as the copy has it) when the target is a verse the BSB has; `<div ... type="x-p"/>`, `<lb/>` and `<p>` to paragraph breaks; `<hi>`, `<w>`, `<foreign>` to their text; `<title type="...">` returned with its type and position; `<note n>` returned as a footnote (KD); `<table>` rows to one paragraph each, cells joined by " | "; `<milestone>`, `<chapter>` and empty `<div>` milestones dropped; any other tag dropped with its text kept and its name counted.
  - `pub fn thml(text, here, ctx, report) -> Parsed`: `<scripRef passage>` to a link, `<i>`/`<b>` to text, `<br />` pairs to paragraph breaks, single `<br />` to a space.
  - Tests: a synthetic module built with `miniz_oxide::deflate::compress_to_vec_zlib` over a toy versification (2 books, 2 chapters, 3 verses): linked slots to a range, empty slots, heading slots marked, wrong index size refused, 10- and 12-byte entries, a conf with no `Versification` line; OSIS and ThML conversion.
- **JFB reader** (`extra_voices/jfb.rs`):
  1. Each entry's comment starts at its first section title (`type="x-s2"`, `"x-s3"` or `"x-s"`) or, if it has none, at the first paragraph that begins with its own verse number ("1." or "14-16."); text before that is an introduction and is left out, counted with its characters. Exceptions go in `JFB_STARTS`.
  2. The section title at the start becomes `w`; later titles stay as their own paragraphs.
  3. A note that begins "N." or "N-M." must cover verse N (and M): mismatches listed; the build fails on any not in `JFB_RANGES`.
  4. The 11 pointer chapters ("For the exposition, see on Mr 13:1-37" at Matthew 24, and Matthew 26, Mark 3 and 15, 2 Samuel 22, Psalms 70, 108, 139, 141, 144, 146) are pointers under the said-voice rule (1.4): each is replaced by JFB's note on the passage it names, placed here with `w` "From JFB's note on Mark 13:1–37, to which this one points", or dropped with a count where the target is not one passage.
- **Works config:** writer "Robert Jamieson, A. R. Fausset and David Brown"; short "Jamieson-Fausset-Brown"; title "A Commentary, Critical and Explanatory, on the Whole Bible"; written "1871"; order 1871; cite `jfb`; long_chars 2000. Expected `lines` by author, each checked by V7 against the 1871 preface on a dated scan: Genesis to Esther, writer and short "Robert Jamieson"; Job to Malachi "A. R. Fausset"; Matthew to Romans "David Brown"; 1 Corinthians to Revelation "A. R. Fausset". If the preface does not confirm a range, its row names the three together. `people` for each, from the title page ("St Paul's, Glasgow"; "St Cuthbert's, York"; "Professor, Aberdeen", as V7 reads them).
- **copy:** as in 1.2. **how:** "Each note shows with the verse it is on; where the copy joins several verses, it shows on each of them."
- **Cite list:** `jfb` exists.
- **Shelf card** (new): id `jfb`; cites "Jamieson-Fausset-Brown"; plain "Bible commentary, 1871"; title "A Commentary, Critical and Explanatory, on the Whole Bible"; by "Robert Jamieson, A. R. Fausset and David Brown"; when "written 1871; this version 15 Feb 2021; copied <date>"; what "A verse-by-verse commentary on the whole Bible by three ministers, named on its title page as of Glasgow, York and Aberdeen."; licenseNote "Public domain. An expanded electronic edition prepared from text scanned by Woodside Bible Fellowship, as kept by CCEL, by way of CrossWire's JFB module (version 3.0), mirrored unchanged on a branch of this app's repository. It modernises some words and spellings ('namely' for 'viz.', 'favor' for 'favour') and abbreviates references. Left out: the general and book introductions."; find: the mirror's raw `SOURCE.md` at its commit; citation "Robert Jamieson, A. R. Fausset and David Brown, A Commentary, Critical and Explanatory, on the Whole Bible (1871)." The `biblehub` card keeps its sentence while its JFB link stays (question 9).
- **NOTICE.md paragraph:** "Jamieson, Fausset and Brown's notes are copied word for word from an expanded electronic edition prepared from text scanned by Woodside Bible Fellowship, as kept by CCEL (jfb.txt), by way of CrossWire's JFB module (version 3.0 of 15 February 2021), mirrored unchanged on the branch mirror/sword-JFB on <date>. This copy modernises some words and spellings of the 1871 printing ("namely" for "viz.", "further" for "farther", "favor" for "favour") and abbreviates references ("Joh 1:3", "Pr 8:22"), which become links where they name verses the BSB has. A note the module links over several verses is shown once over those verses, with JFB's section heading as its place; a note that only points to another passage shows that passage's note. Left out: the general and book introductions."
- **V7 collation:** a short collation per author (three passages each) against a dated 1871 scan (for example `commentarycritic00jami` or `commentarycritic01jami_0`), recorded in `docs/voices/checks/jfb.md` with the differences found.
- **checks():** count above threshold; Genesis 1:1's JFB note contains "In the beginning" and not "INTRODUCTION TO THE PENTATEUCH", and is under 20,000 characters; John 3:16 lies inside a JFB note; Matthew 24:1's JFB note has words and its place names Mark 13; no JFB note contains "Faussett" outside quoted text; no tags.
- **Size:** about 10.2 MB of notes after the introductions, about 3.9 MB compressed, about 21 to 26 files. Mirror branch about 6.0 MB.

### 5.3 Keil and Delitzsch, Old Testament (English 1864–78)

- **Source** (`sources.json`), written out in full by V8 with every required field. Its credit names the whole chain (fact 12):
  - title "C. F. Keil and F. Delitzsch, Biblical Commentary on the Old Testament (English, Edinburgh: T. and T. Clark, 1864–78), from the CrossWire SWORD module KD 2.0, whose text came from Wikisource, mirrored unchanged on this repository's branch mirror/sword-KD";
  - license "Public domain (the 1864–78 English translation). The module's text came from Wikisource, 'Biblical commentary on the Old Testament', where on 3 August 2022, when CrossWire made version 2.0, it was shared under the Creative Commons Attribution-ShareAlike 3.0 Unported license (https://creativecommons.org/licenses/by-sa/3.0/); Wikisource says the source document of this text is not known. The mirrored module is shared under CC BY-SA 3.0 as it was. The files this app builds from it are an adaptation, shared under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/) as CC BY-SA 3.0 section 4(b) allows.";
  - attribution "C. F. Keil and F. Delitzsch, Biblical Commentary on the Old Testament, English translation (Edinburgh: T. and T. Clark, 1864–78), public domain. Text by Wikisource contributors, 'Biblical commentary on the Old Testament', https://en.wikisource.org/wiki/Biblical_commentary_the_Old_Testament (page revision <id> of <date>, recorded by V8), CC BY-SA 3.0; earlier, according to CrossWire, Willem Swanepoel's BibleWorks 8 user-created module; by way of the CrossWire Bible Society's SWORD module KD, version 2.0 (3 August 2022); copied unchanged to github.com/Sixteen1-6/BibleAtlas, branch mirror/sword-KD, on <date>; modified as described in NOTICE.md.";
  - repo this repository at the tip of `mirror/sword-KD`; files `conf` `mods.d/kd.conf`, `ot-bzs`, `ot-bzv`, `ot-bzz` under `modules/comments/zcom4/kd/`, and `source` `SOURCE.md` (the empty New Testament files are mirrored but not listed).
  - If the founder wants only a source that is itself under CC BY-SA 4.0, KD waits (section 9 question 5).
  - **Never reuse Wikisource's author line "Franz Delitzsch (1885–1892)".**
- **License check:** conf has `DistributionLicense=Public Domain` and `TextSource=https://en.wikisource.org/wiki/Biblical_commentary_the_Old_Testament`; `SOURCE.md` carries the CC BY-SA 3.0 notice and URI, "Text by Wikisource contributors" with the page URL, and the CrossWire chain (section 7); `SOURCE.md` hashes.
- **Reader** (`extra_voices/kd.rs`):
  1. Each entry's comment starts at its own range label: **the first `<reference osisRef>` whose range equals the entry's linked slots (or contains its first verse), wherever it sits**, since the conf declares `Feature=NoParagraphs`. Text before it is an introduction to a book or section, left out and counted. The label is used for placement and not shown. The build fails on any entry with no such label unless it is in `KD_STARTS`; a label whose range differs from the slots must be in `KD_RANGES`. V8 reports paragraphs per note; if notes come out as single blocks, openings fall back to sentence ends (1.5).
  2. Footnotes: a mark `[n]` at the note's place, and the footnote as a paragraph `[n] ...` after the paragraph that holds it.
  3. **The old BibleWorks font code** ("„Y..." runs) outside introductions: each run a dated scan proves gets a `fixes` row with the Hebrew word; every other run becomes `{"k": "gap", "t": "[Hebrew word not legible in this copy]"}`, counted, and its places listed in NOTICE.md. Verify bans any raw "„Y".
  4. Ecclesiastes: left out by `kd-ecclesiastes`; the Psalm entries of 2.6 as the founder rules.
- **Collation (V8):** a sample of each volume (three passages) against dated archive.org scans of the T. and T. Clark printings (the conf links `biblicalcomm01keiluoft`), recording in each row's `checked` which printing matches. A volume that matches none is labelled "printing not identified" in its row, or left out if the text differs in substance.
- **Works config:** writer "C. F. Keil and F. Delitzsch"; short "Keil-Delitzsch"; title "Biblical Commentary on the Old Testament"; written "German 1861–75; English 1864–78"; order 1861; cite `keil-delitzsch`; license `cc-by-sa-4.0`; long_chars 2000. `lines` per volume of the T. and T. Clark edition, each checked against its title page, with the writer and short per range: "C. F. Keil" for the Pentateuch, the historical books, Jeremiah, Lamentations, Ezekiel, Daniel and the Minor Prophets; "Franz Delitzsch" for Job, Psalms, Proverbs, the Song of Songs and Isaiah (Isaiah in James Martin's translation, made before Delitzsch's fourth edition; V8 records which German edition its title page names). Each row names its translator as the title page does. `people`: Keil ("Lutheran Old Testament scholar, 1807 to 1888") and Delitzsch ("Lutheran Old Testament scholar, 1813 to 1890") with `src`.
- **copy:** "Wikisource's text (its source document is not known; earlier, according to CrossWire, Willem Swanepoel's BibleWorks 8 module), by way of CrossWire's KD module (version 2.0 of 3 August 2022), mirrored unchanged on a branch of this app's repository." **how:** "Each note shows with the verses its own opening label names."
- **Cite list:** `keil-delitzsch` exists; `not_on` Ecclesiastes is V12's.
- **Shelf card** (update the existing `keil-delitzsch`): `datasets: ["keil-delitzsch"]`; when "written 1861–75 (German), 1864–78 (English); this version 3 Aug 2022; copied <date>"; what drops "The app links to it on Bible Hub." and ends with the title page's own words; licenseNote "The 1864–78 English translation is public domain. This copy is CrossWire's KD module (version 2.0), whose text came from Wikisource (CC BY-SA 3.0; its source document is not known); the files built from it are shared under CC BY-SA 4.0, crediting Wikisource contributors. Left out: introductions, and Ecclesiastes."; `cites` stay.
- **NOTICE.md row** license column: "Public domain (the translation); CC BY-SA 3.0 (Wikisource's text and the mirrored module); CC BY-SA 4.0 (the files built from it, an adaptation)". **Paragraph:** "Keil and Delitzsch's notes are copied word for word from CrossWire's KD module (version 2.0 of 3 August 2022), whose text came from Wikisource's 'Biblical commentary on the Old Testament' (https://en.wikisource.org/wiki/Biblical_commentary_the_Old_Testament), where it was shared under CC BY-SA 3.0 and where its source document is not known; CrossWire says the module is based on Willem Swanepoel's BibleWorks 8 module. It was mirrored unchanged on the branch mirror/sword-KD on <date>. Each note is placed on the verses its opening label names, and the label is not shown. Footnotes follow their paragraph. Where the copy keeps an old font code instead of a Hebrew word, the app shows "[Hebrew word not legible in this copy]" (listed below). Left out: introductions to books and sections, and Ecclesiastes, because it denies that Solomon wrote the book. The files built from this copy (web/public/data/extras/voices/keil-delitzsch/) are an adaptation shared under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/), as CC BY-SA 3.0 section 4(b) allows, with credit to Wikisource contributors."
- **checks():** count above threshold; Genesis 3:15 has a KD note; no KD note in Ecclesiastes and `left` holds `kd-ecclesiastes` over 17316 to 17537; the KD note covering Psalm 22:17 also covers 22:16 and 22:18; no KD note starts with a range label (`^[1-3]?[A-Z][a-z]{1,3} \d+:\d+`); no shown KD text contains "Hebrew_Bible_" or "„Y"; the gap count equals the NOTICE list.
- **Size:** about 22 MB of notes after introductions and Ecclesiastes, about 8.3 MB compressed, about 45 to 55 part files plus long files. Mirror branch about 11.5 MB.

### 5.4 Martin Luther: Galatians (Graebner, 1939, abridged) and Genesis 1 to 9 (Lenker, 1904 and 1910)

- **Sources** (`sources.json`), three entries, each from Project Gutenberg's current file mirrored by V0 (section 7), written out in full:
  - `luther-galatians`: repo this repository at the tip of `mirror/pg-1549`; files `text` (Project Gutenberg ebook 1549's plain text) and `source` `SOURCE.md`.
  - `luther-genesis`: `mirror/pg-48193`, same shape.
  - `luther-genesis-2`: `mirror/pg-27978`, same shape.
  - License field: "Public domain in the USA (Project Gutenberg's record of ebook N)". For Galatians, also the text's own words: "This text was converted to ASCII format for Project Wittenberg by Laura J. Hoelter and is in the public domain. You may freely distribute, copy or print this text."
  - Attribution, Galatians: "Martin Luther, Commentary on the Epistle to the Galatians, abridged and put into modern English by Theodore Graebner (Grand Rapids: Zondervan, 1939); keyed for Project Wittenberg (Concordia Theological Seminary) by Laura J. Hoelter; Project Gutenberg ebook 1549 (most recently updated 17 February 2024); copied unchanged to github.com/Sixteen1-6/BibleAtlas, branch mirror/pg-1549, on <date>; Project Gutenberg's header and license are not used." Genesis likewise, with Lenker's title pages.
  - If Project Gutenberg refuses the workflow's download, V0 falls back to the GITenberg snapshots already on GitHub (fact 7), the credit says "Project Gutenberg ebook 1549 as copied by GITenberg in October 2018", and Galatians needs its one placement fix again (the "VERSE 6." heading over 5:5, which Project Gutenberg corrected in 2024).
- **License check:** each mirrored `SOURCE.md` quotes Project Gutenberg's own rights line for the ebook ("Public domain in the USA"), read from its page by V0.
- **Plain-text helpers** (`extra_voices/gutenberg.rs`): `body(text) -> Result<&str, String>` between the "*** START OF" and "*** END OF" lines (fails if either is missing); `latin1(bytes) -> String`; `ascii_or_utf8(bytes) -> Result<String, String>`; paragraphs from blank lines (CRLF handled); `strip_footnotes` (bracket-balanced `[Footnote n: ...]` blocks and their `[n]` anchors, counted); `_..._` italics lose their underscores.
- **Galatians reader** (`luther::galatians`):
  1. Start at the first line `CHAPTER 1` (Graebner's preface and the front matter are left out); stop before the paragraph that begins "This text was converted to ASCII format" (the transcriber's note, whose license words go in `sources.json` instead); fail if either is missing.
  2. Chapters: lines `^CHAPTER (\d+)$`. Headings: lines `^\s+VERSES? (\d+)(?:(?: and |-|, ?)(\d+))?\.`. A heading and its continuation lines (the printed KJV words) are kept as the note's first paragraph, as Graebner prints them.
  3. Consecutive sections on the same verses merge into one note.
  4. Self-check: each heading's words are found in the KJV text of its verse(s) (`quoted_in`); the build fails on a mismatch not in a fix table. With Project Gutenberg's current file no fix is expected.
  5. V9 word-diffs the mirrored file against the 2018 GITenberg snapshot and records the differences in `docs/voices/checks/luther-galatians.md`.
- **Genesis reader** (`luther::genesis`): volume 1 (`latin1`, or as the mirrored file's encoding says), then volume 2.
  1. Start at the first `CHAPTER I.` line; chapters `^CHAPTER ([IVXL]+)\.`.
  2. Volume 1: part headings `^PART ([IVX]+)\. (.+)` (may run onto the next line) become `w` for the notes after them, kept in the copy's capitals (small capitals by CSS).
  3. Verse headings `^V\. (\d+)([a-d])?(?:, (\d+)([a-d])?)?\.` (a digit is required: "V. Moses has taught" is prose). A section runs from its heading to the next heading or part; text after a part heading and before its first verse heading goes on the verse in `GENESIS_PARTS`; text before a chapter's first heading goes on verse 1.
  4. Volume 1 stops before its first heading on 4:8 or later, so 4:8 to 4:15 come from volume 2 only; the notes dropped are counted.
  5. **Volume 2:** its Roman-numbered section headings ("IV. HOW CAIN MURDERED HIS BROTHER ...") become `w`, with the note's first and last paragraph numbers: "IV. How Cain murdered his brother ... ; paragraphs 107 to 111 in Lenker's numbering" (the heading's letters as printed). The indented outlines before each section (329 numbered outline lines and the "*" items) are cut and counted. Lenker's paragraph numbers are removed from the text (they are in the place). Translators' footnotes are stripped.
  6. Consecutive sections on the same verse merge.
  7. Self-check: each verse heading's italic quotation is found in the ASV text of its verse (`ctx.asv`, added here), and each `GENESIS_PARTS` row's first quotation in its verse; the build fails on a mismatch not in a fix table.
- **Works config:**
  - `luther-galatians`: writer "Martin Luther"; short "Martin Luther"; title "Commentary on the Epistle to the Galatians (abridged)"; written "lectures of 1531, printed 1535"; order 1535; cite `luther`; long_chars 2000; line for Galatians: edition "abridged and put into modern English by Theodore Graebner (Grand Rapids: Zondervan, 1939)", checked against the translator's preface in the file and CCEL's catalogue record of the print; plus "printed in 1535 from Georg Rörer's notes" only if V9 finds a source for it (else dropped).
  - `luther-genesis`: writer "Martin Luther"; title "Lectures on Genesis, chapters 1 to 9"; written "1535–45"; order 1535; cite `luther`; rows: Genesis 1:1 to 4:7, edition "Luther on the Creation: Henry Cole's translation, revised, enlarged and partly retranslated by John Nicholas Lenker (Minneapolis: Lutherans in All Lands Co., 1904)"; Genesis 4:8 to 9:29, edition "Luther on Sin and the Flood, translated by John Nicholas Lenker (Minneapolis, 1910)" (V9 copies the place and publisher as the title page prints them). Add "lectures prepared for print by his students (Veit Dietrich and others)" to both rows only with a source V9 records (for example Lenker's own introduction); else drop it.
  - `people`: Martin Luther ("Reformer in Wittenberg, 1483 to 1546") with a `src`.
  - `how`, Galatians: "Placed by Luther's own headings on each verse; several headings on one verse are shown as one note." Genesis: "Placed by Luther's own headings on each verse. On Genesis 1 to 4:7 each note names its part of the book; from 4:8 each names its section and Lenker's paragraph numbers."
- **Cite list** (new entry; the integrator adds it with this PR, under the one-holder rule for `config/layer-sources.json`):

```json
{ "id": "luther", "role": "interpreter", "name": "Martin Luther", "title": "Commentaries and lectures on the Bible", "by": "Martin Luther, Reformer", "when": "1513–1546", "url": "https://www.gutenberg.org/ebooks/author/155", "why": "Approved for his commentaries on Scripture by Shubhanshu on 2026-10-20 (docs/decisions.md, decision 2 and 'The lists'); passages that deny Scripture are left out (config/voices-exclusions.json)." }
```

  ("Martin Luther" matches no avoid-list word: the avoid entry "Luther Seminary" matches only that phrase.)
- **Shelf cards** (new): `luther-galatians` (cites "Luther"; plain "Commentary on Galatians, 1535, abridged"; title "Commentary on the Epistle to the Galatians (abridged)"; by "Martin Luther; abridged translation by Theodore Graebner"; when "written 1535; this version 17 Feb 2024; copied <date>"; what "Luther's lectures on Galatians in Theodore Graebner's abridged modern English version." The claim that it was "the book of his own he loved best" is not used: it rests on one remark in Graebner's preface, while Luther's 1537 letter to Capito named only The Bondage of the Will and the Catechism; licenseNote "Public domain in the USA, as Project Gutenberg's record of ebook 1549 says; keyed for Project Wittenberg by Laura J. Hoelter, whose note says it 'is in the public domain. You may freely distribute, copy or print this text.' Mirrored unchanged on a branch of this app's repository. Abridged by its translator, with no marks where Luther's words are left out."; datasets `["luther-galatians"]`) and `luther-genesis` (plain "Lectures on Genesis 1 to 9, 1535–45"; by "Martin Luther; translated by John Nicholas Lenker"; when "written 1535–45; these translations 1904 and 1910; copied <date>"; datasets `["luther-genesis", "luther-genesis-2"]`).
- **NOTICE.md paragraph:** "Martin Luther's Commentary on Galatians, in Theodore Graebner's abridged translation (1939), keyed for Project Wittenberg by Laura J. Hoelter, and his Lectures on Genesis 1 to 9, in John Nicholas Lenker's Luther on the Creation (1904, revising Henry Cole's translation) and Luther on Sin and the Flood (1910), are copied word for word from Project Gutenberg's ebooks 1549, 48193 and 27978, mirrored unchanged on this repository's branches on <date>. Graebner's version is abridged, with no marks where words are left out. Left out: Project Gutenberg's header and license, Graebner's preface, the transcriber's closing note, the translators' footnotes, and the outlines before each section of the second Genesis volume; Lenker's paragraph numbers are shown as each note's place instead of in its text. Where the two Genesis volumes overlap (4:8 to 4:15), only the second is used. Several of Luther's headings on one verse are shown as one note."
- **checks():** Galatians 2:20 has a Luther note with "I am crucified with Christ"; Galatians 5:5 and 5:6 each have their own; Genesis 1:1 has a Luther note; Genesis 4:14 has exactly one; Genesis 9:29 is covered; every Luther note is in Galatians or Genesis 1 to 9; no Luther note contains "Gutenberg", "PREFACE", "Project Wittenberg", "[Footnote" or "Translated by"; no Luther paragraph starts with a number and a full stop; no Genesis 4 note starts with an outline line.
- **Size:** about 0.45 MB (Galatians) and 1.6 MB (Genesis) of notes, about 0.75 MB compressed together, 5 to 7 files.

### 5.5 Matthew Henry, the complete Exposition, beside the Concise (held: section 9 question 1)

- **Source** (`sources.json`), written out in full: id `henry-complete`; title "Matthew Henry, An Exposition of the Old and New Testament (completed by other ministers), from the CrossWire SWORD module MHC, as kept in the Let's Church repository"; the same repo and commit as `henry-concise`; files `mhc` `packages/lets.bible/seed/commentaries/mhc.json` (git blob `4a9d8be1b6206b4c86a7c65a6dda39382e845d8a`, 40,809,275 bytes, SHA-256 `45344dafe2f9254a20498379288e772b095fb337b33896541362198f7aec340b`); license quoting the module ("Public Domain--Copy Freely"), CCEL's site policy and the founder's ruling; attribution naming the chain: "Logos Research's text, given to the Christian Classics Ethereal Library, from which CrossWire's MHC module (version 2.2 of 29 August 2022) was prepared, as kept in Let's Church's file of 30 June 2026, copied on <date>"; note "Each note is one of the sections, placed on the verses the section prints. The printed King James verses, prefaces, introductions and outlines are left out."
- **License check:** `entries()`, plus the founder's CCEL rule.
- **Reader** (`extra_voices/henry_full.rs`):
  1. Entries on a verse 0 (1,111 chapter introductions and outlines) and the five chapter-0 title entries are left out of notes, **but kept in `Raw`**, since 2 John's "Completed by" line is in a verse-0 entry.
  2. In each entry, the printed Scripture starts at the first paragraph that begins with "<v> " (`HENRY_FULL_STARTS`: Job 28:12 starts at 14, Jeremiah 46:13 at 12, Jude 1:16 at 15). Consecutive paragraphs that begin with a verse number in the section and whose words match the KJV verse are the printed verses: left out, counted.
  3. The paragraph just before them is the section title: the note's `w`.
  4. Text before the title (prefaces, chapter outlines) is left out, counted with its characters.
  5. Range: from the entry's verse to the last printed verse number, checked against `verseEnd`; differences listed; the larger, clamped to the chapter.
  6. Comment text through `text::runs` and `verse_marks`; a section that only points elsewhere follows the said-voice rule.
  7. Self-check: the build fails if any entry other than the three in the table lacks a printed-verse paragraph.
- **Works config:** writer "Matthew Henry"; short "Matthew Henry"; title "An Exposition of the Old and New Testament"; written "1708–21" (corrected by V10 from the scans); order 1708; cite `henry`; long_chars 2000.
  - `lines`, by volume for Genesis to Acts, writer "Matthew Henry", each volume's year read from a dated scan of its title page (volume 4 is 1712, not within 1708–1710).
  - **Romans to Revelation, one row per book naming its writer.** V10 finds the printed list of the ministers who finished the work, in a dated scan of the 1721 volume 6 or of a 19th-century edition that prints the list, and sets each row's `writer` and `short` to that minister with `checked` on the scan page, and `work` "completing Matthew Henry's Exposition after his death in 1714". The file's own lines confirm five (John Evans, Romans; Jeremiah Smith, Titus and Philemon; John Reynolds of Shrewsbury, 2 and 3 John; John Billingsley, Jude), and the build checks each of those is in `Raw` for its book. A book no scan names gets writer "a minister this edition does not name, completing Matthew Henry's Exposition after his death in 1714" and short "Matthew Henry's continuators" (audit question 4), never "Matthew Henry".
  - `fixes`: Matthew 27:25 "and one our children" to "and on our children", only if V10 finds it on a dated scan and records the page.
  - `people`: Matthew Henry, and each named continuator where a `src` can be found (else the row shows the name alone).
- **copy:** "Logos Research's text, by way of CCEL and CrossWire's MHC module (version 2.2 of 29 August 2022), in Let's Church's file of 30 June 2026 (LetsChurch/lets.church, commit 71f6f0f)." **how:** "Each of Henry's sections shows with every verse it covers, so one note may span a whole passage."
- **Cite list:** `henry` exists (Bible Hub `mhcw`).
- **Shelf card** (new): id `henry-complete`; cites "Matthew Henry"; plain "Bible commentary, 1708–21"; title "An Exposition of the Old and New Testament"; by "Matthew Henry; Romans to Revelation by other ministers, named book by book"; when "written 1708–21; this version 29 Aug 2022; copied <date>"; what "Henry's full commentary on every chapter of the Bible, finished from Romans on after his death in 1714 by other ministers." (with its `src`); licenseNote naming the chain and what is left out; citation with the volume years V10 confirms.
- **NOTICE.md paragraph:** "Matthew Henry's complete commentary, finished after his death in 1714 from Romans on by other ministers (each named where a printed list names them), is copied word for word from Logos Research's text as kept by CCEL, by way of CrossWire's MHC module (version 2.2 of 29 August 2022) and Let's Church's file of 30 June 2026, copied into this app on <date>. Each note is one of the sections, placed on the verses it prints, with the section's title as its place. Left out: the King James verses each section prints before the comment, the prefaces and introductions to volumes, books and chapters, and five title-only chapter entries. It is shown beside Henry's Concise Commentary, which stays."
- **checks():** count above threshold (about 4,240 sections); Genesis 1:3's note does not contain "And God said, Let there be light: and there was light. 4"; the Genesis 1:1 note has the place "The Creation. (b. c. 4004.)" and does not contain "PREFACE"; Job 28:14 lies inside a Henry complete note; John 3:16 is covered; the index's row for Romans names John Evans; no row from Romans to Revelation has writer "Matthew Henry"; every long voice has its `more` mark.
- **Size:** about 33.7 MB of notes, about 11.8 MB compressed; nearly every note is long, so about 10 part files and about 135 long files of up to 250,000 bytes.

### 5.6 Albert Barnes, Notes on the New Testament

- **Source** (`sources.json`), written out in full: id `barnes-nt`; title "Albert Barnes, Notes, Explanatory and Practical, on the New Testament, from the CrossWire SWORD module Barnes 1.1, mirrored unchanged on this repository's branch mirror/sword-Barnes"; repo this repository at the tip of `mirror/sword-Barnes`; files `conf` `mods.d/barnes.conf`, `nt-czs`, `nt-czv`, `nt-czz` under `modules/comments/zcom/barnes/`, `source` `SOURCE.md`; license "Public domain (1832–53; the SWORD module marks it 'Public Domain')"; attribution "Albert Barnes, Notes, Explanatory and Practical, on the New Testament (1832–53), <the printing V11 identifies, or 'in a printing after 1858 that this copy does not name'>, public domain; from the CrossWire Bible Society's SWORD module Barnes, version 1.1 (dated 2002-01-01), which names no source; copied unchanged to github.com/Sixteen1-6/BibleAtlas, branch mirror/sword-Barnes, on <date>."; note "Its \"Verse 16.\" labels and its prefaces are left out."
- **License check:** conf has `DistributionLicense=Public Domain` and `Description=Barnes' New Testament Notes`; `SOURCE.md` hashes. No `Versification` line: the reader takes SWORD's default (5.2).
- **Which printing (V11):** collate 3 to 5 notes against dated scans of the main printings (the first volumes of the 1830s, the revised printings of the 1850s, the Harper printing of 1868–72 and the edited reissue of 1884–85), name the printing that matches in each row's `edition` with `checked`, and name any editor whose words it carries (then that editor is credited in the row, decision 10). If none matches, the row's edition reads "a printing after 1858 that this copy does not name", **shown on screen in the book line, not only in NOTICE.md**, or Barnes waits for the founder (section 9 question 6).
- **Reader** (`extra_voices/barnes.rs`): `sword::Module` (zCom, `BlockType=CHAPTER` by default, files with the `c` prefix) and `sword::thml`. Heading slots (the prefaces) left out of notes, kept in `Raw`. A leading "Verse N." (or "Verses N-M.") label is dropped when it names the entry's verses, else kept and listed. Linked slots (7,463 slots, 7,431 texts) become ranges.
- **Works config:** writer "Albert Barnes"; short "Albert Barnes"; title "Notes, Explanatory and Practical, on the New Testament"; written "1832–53"; order 1832; cite `barnes`; long_chars 2000; `people`: Albert Barnes ("Presbyterian pastor in Philadelphia, 1798 to 1870") with a `src` (a dated title page that names his post).
- **copy:** "CrossWire's Barnes module (version 1.1), which names no source, mirrored unchanged on a branch of this app's repository." **how:** "Each note shows with the verse it is on; where the copy joins several verses, it shows on each of them."
- **Cite list:** `barnes` exists.
- **Shelf card** (new): id `barnes-nt`; cites "Barnes"; plain "New Testament notes, 1832–53"; title "Notes, Explanatory and Practical, on the New Testament"; by "Albert Barnes"; when "written 1832–53; this version (module dated 2002); copied <date>"; what "Notes on the whole New Testament, written for Sunday-school teachers and other ordinary readers." (with its `src`); licenseNote "Public domain, as CrossWire's Barnes module (version 1.1) marks it; the module names no source and no printing, and this copy follows <the printing V11 names, or a printing after 1858 not named>. Mirrored unchanged on a branch of this app's repository."
- **NOTICE.md paragraph:** "Albert Barnes's Notes on the New Testament (1832–53) are copied word for word from CrossWire's Barnes module, version 1.1, which names no source, mirrored unchanged on the branch mirror/sword-Barnes on <date>. This copy follows <the printing V11 names / a printing after 1858 that it does not name>. The module's "Verse 16." labels and its prefaces are left out; a note the module links over several verses is shown once over them; passages that say words of Scripture are mistakes are left out (config/voices/barnes-nt.json)."
- **checks():** count above threshold (about 7,400); John 3:16 has a Barnes note; no Barnes note starts with "Verse"; no Barnes note outside the New Testament; no tags.
- **Size:** about 14.9 MB of notes, about 5.1 MB compressed, about 30 to 35 files. Mirror branch about 6.1 MB.

### 5.7 The batch in numbers

| Work | Notes text | Compressed | Files (parts and long) | Verses (from the research) | Waits for |
|---|---|---|---|---|---|
| The three live works, repacked | 14.6 MB | 5.2 MB | about 32 | Catena 3,774; Concise 31,055; Wesley 16,704 (less the pointer-only notes) | PR-2 |
| Luther, Galatians and Genesis 1 to 9 | 2.1 MB | 0.75 MB | about 6 | 149 and 235 | PR-5 |
| Keil and Delitzsch | about 22 MB | 8.3 MB | about 60 | about 23,500 (Ecclesiastes left out) | PR-6; question 5 |
| Barnes, New Testament | 14.9 MB | 5.1 MB | about 33 | 7,463 | PR-7; question 6 if the printing is not found |
| Calvin, New Testament | 11.6 MB | 4.0 MB | about 26 | about 4,800, in 21 books | question 1 |
| Jamieson, Fausset and Brown | 10.2 MB | 3.9 MB | about 23 | 24,813 | question 1 |
| Henry, complete | 33.7 MB | 11.8 MB | about 145 | nearly every verse | question 1 |
| **All** | **about 109 MB** | **about 39 MB** | **about 325** | | |

- `web/public/data` grows from 121 MB to about 216 MB with everything built (GitHub Pages allows 1 GB).
- The index: about 70,000 to 100,000 bytes (limit 200,000).
- A reader pays at most about 175 KB compressed per writer opened and in view, and about 85 KB for "Read all" on a long voice.
- `meta.json` grows by about 50 KB uncompressed with everything built (about 325 entries); each PR records it.
- The repository grows by about 23.7 MB of mirror-branch blobs with JFB, about 17.6 MB without it, plus the three Gutenberg texts (about 2.3 MB).
- Fetch adds 76.5 MB of Let's Church files (Calvin and Henry complete) and the mirror checkouts; the build adds an estimated 10 to 20 s on CI.

## 6. The Catena clean-up

The founder approved the shortlist's answer: hide Origen, Didymus and the Arian writer shown as Pseudo-Chrysostom in Matthew, with a visible line that a quotation was left out; keep Eusebius with a one-line note; keep Victor of Antioch in Mark. "The Arian writer" is the writer of the unfinished work on Matthew, so only quotations from that work are hidden, not every use of the name in Matthew.

`config/voices/catena-aurea.json` (V2):

```json
"hide": [
  { "name": "Origen", "books": [], "reason": "origen", "count": 638 },
  { "name": "Didymus", "books": [], "reason": "didymus", "count": 9 },
  { "name": "Pseudo-Chrysostom", "books": ["Matthew"], "chapters": "covered", "not_tag": ["Hom. de Cruce", "in Pass.", "de Resur."], "reason": "arian-matthew", "count": "<recounted by V2: 426 certain, up to 435>" },
  { "name": "Pseudo-Chrysostom", "books": ["Luke"], "tag": "Op. imp", "reason": "arian-matthew", "count": 1 }
],
"reasons": {
  "origen": { "short": "A quotation from Origen is left out here.", "why": "The Church later condemned some of his teaching.", "src": { "...": "Percival, The Seven Ecumenical Councils (NPNF II vol. 14, 1900), the Second Council of Constantinople (553), its anathemas against Origen; quoted" } },
  "didymus": { "short": "A quotation from Didymus the Blind is left out here.", "why": "Later councils condemned him with Origen.", "src": { "...": "Percival, NPNF II vol. 14 (1900), the council that names him; quoted" } },
  "arian-matthew": { "short": "A quotation from the unfinished work on Matthew is left out here.", "why": "That work was once thought to be Chrysostom's; its writer is now held to have followed Arius, who denied that the Son is fully God.", "src": { "...": "the Oxford translation's own note on the writer, or a dictionary of the period such as Smith and Wace; quoted" } }
},
"who": [
  { "name": "Eusebius", "books": [], "note": "bishop of Caesarea and church historian (about 260 to 339), who sided with Arius before the Council of Nicaea and then signed its creed", "src": { "...": "Arius's letter to Eusebius of Nicomedia, in Theodoret, Church History, book 1 (NPNF II vol. 3, 1892), naming him; and Eusebius's letter to his church, in Socrates, Church History 1.8 (NPNF II vol. 2, 1890), on his signing" } },
  { "name": "Pseudo-Chrysostom", "books": ["Mark"], "note": "in Mark, mostly Victor of Antioch, a priest of the 400s whose notes on Mark were once thought to be Chrysostom's", "src": { "...": "Smith and Wace, or the Catholic Encyclopedia, on Victor of Antioch" } },
  { "name": "Pseudo-Chrysostom", "books": ["Matthew", "Luke"], "note": "a writer once thought to be Chrysostom", "src": { "...": "as V1 seeds it" } },
  { "name": "Clement of Alexandria", "books": [], "note": "teacher in Alexandria (died about 215)", "src": { "...": "Smith and Wace, or the Ante-Nicene Fathers' introduction to his works" } },
  { "name": "Josephus", "books": [], "note": "the Jewish historian of the first century, quoted by Aquinas as a witness; not a Christian writer", "src": { "...": "Smith's Bible Dictionary (which the app ships) or Easton's, on Josephus" } }
]
```

(V1 seeds the other rows: Gloss, Greek Expositor, Pseudo-Jerome, Pseudo-Augustine, Pseudo-Athanasius, each with a `src` or dropped, 5.0.)

- **Rules** (`catena.rs`): a quotation whose name (after `NAME_FIXES`) matches a `hide` row, in its books (empty for all), in its chapters (`"covered"`: the chapters the unfinished work covers, from a table V2 checks against the work's homily list), whose leading citation contains `tag` when one is given and none of `not_tag`, becomes a left-out voice `[name, null, reason]` in its place; the passage keeps its other quotations in order. The count per row must equal `count`, or the build fails.
- **Which Pseudo-Chrysostom quotations go** (fact 3): in Matthew, the 426 untagged quotations in the chapters the unfinished work covers (1 to 8, 11, 19 to 24) go. The 9 tagged quotations in those chapters ("Homil. in Matt. Hom. i.", "ubi sup.", "vid. Phil. 3:2:3.", "Hom. xv.", "non occ.", "quoad sens.", "in loc.", "in fin. Hom. xxxix.", "non occ. sed vid. Gloss. ord.") go only where V2 ties the words to the unfinished work (on a dated scan of the Oxford translation's notes or of the work itself) and records it; any V2 cannot tie stays, under the note "a writer once thought to be Chrysostom". The 4 quotations in Matthew 27 and 28 stay, under that note: the untagged one at 27:39-44 and the three tagged as other sermons ("Hom. de Cruce et Latr.", "Hom. vi. in Pass.", "Hom. de Resur. iii."). In Luke, the one tagged "Chrys. Op. imp" (16:22-26) goes; the other 11 stay. **The PR lists every quotation kept or reassigned, for the founder.**
- **A passage whose quotations are all left out** (Matthew 23:13: Origen, Pseudo-Chrysostom, Origen) is not an item: the Catena gets no `has` bit there, and the index gets a `left` entry of scope `passage` with the line "The Church Fathers' quotations on this verse are left out: two from Origen and one from the unfinished work on Matthew." (built from the reasons).
- **Panel:** neighbouring left-out quotations are one quiet line where they stood ("A quotation from Origen is left out here."; "Two quotations are left out here: from Origen and from the unfinished work on Matthew."); each reason's `why` is shown once after the chain, with its source link; the `who` note follows the name as the `WHO` map does today (the map is deleted from `Panel.tsx`); left-out lines do not count toward the first four Fathers.
- **The `who` notes are the app's own words**: V2 checks each against its `src` and quotes the source in the evidence file. The Eusebius note's two claims have two sources (Theodoret's book 1 for his siding with Arius before Nicaea; Socrates 1.8 for his signing); if either cannot be quoted, that clause is dropped. Clement of Alexandria and Josephus are listed in the PR for the founder (section 9 question 8).
- **NOTICE.md** (the Catena sentences, recounted from V2's data): "Quotations under the names Origen (638) and Didymus (9), whom the Church later condemned, and <N> quotations from an unfinished work on Matthew whose writer is now held to have followed Arius (<N−1> under "Pseudo-Chrysostom" in Matthew, 1 in Luke 16:22), are left out, and the app says so where each stood. The quotations under "Pseudo-Chrysostom" from other sermons (<M> in Matthew, 11 in Luke) and the 109 in Mark, mostly Victor of Antioch's, stay."
- **checks():** no shown Catena voice named Origen or Didymus; left-out voices number 638 (origen; 636 in items plus the 2 of Matthew 23:13 counted in its `left` line) and 9 (didymus); arian-matthew as V2 counts; Pseudo-Chrysostom voices shown: Mark 109, Luke 11, Matthew as V2 counts (at least 4); Eusebius shown 82 times; no Catena item on Matthew 23:13 and a `left` entry there; every shown name has a who line where the config has one; the existing Chrysostom on John 1:1 case still passes.

## 7. The mirror workflows

Two workflows, both pinned by a table of files written into the workflow, not read from upstream at run time.

**`.github/workflows/mirror-sword-modules.yml`**, modelled on `mirror-meaning-model.yml`. The matrix is `[KD, Barnes]` now; JFB's rows stay in the table, and JFB is added to the matrix only after the founder's CCEL ruling (section 9 question 1), since a public mirror is itself a republication.

```yaml
name: Mirror SWORD modules

# The build's sources are pinned git commits on github.com (sources.json), and
# the containers that build the data can only reach github.com. This copies
# public-domain commentary modules from crosswire.org, unpacks each zip, checks
# that the unpacked files are exactly the files in the table below (path, bytes
# and SHA-256, measured 2026-10-20), writes SOURCE.md with each module's license
# notice, and commits them unchanged to one branch per module,
# mirror/sword-<Module>, which sources.json then pins. CrossWire repacks some
# zips without changing the files in them, so only the files are checked. Any
# other change stops the run: the table is the pin. Never force-push or delete
# these branches. JFB is listed but not mirrored until it is added to the matrix.

on:
  workflow_dispatch:
  push:
    paths:
      - .github/workflows/mirror-sword-modules.yml

permissions:
  contents: write

jobs:
  mirror:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        module: [KD, Barnes]
    concurrency:
      group: mirror-sword-${{ matrix.module }}
      cancel-in-progress: false
    env:
      MODULE: ${{ matrix.module }}
      BRANCH: mirror/sword-${{ matrix.module }}
    steps:
      - name: Download the module and check every file in it
        run: |
          set -euo pipefail
          mkdir -p /tmp/m/out && cd /tmp/m
          curl -sSfL --retry 3 "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/$MODULE.zip" -o module.zip
          echo "ZIP_SHA=$(sha256sum module.zip | cut -d' ' -f1)" >> "$GITHUB_ENV"
          (cd out && unzip -q ../module.zip)
          python3 - <<'EOF'
          import hashlib, os
          FILES = {
            "JFB": [
              ("mods.d/jfb.conf", 2174, "aa2fc05a101dd622e7313b9c1b5dbabefcfcf1264ce82576d19c1c0e8b349bd4"),
              ("modules/comments/zcom/jfb/nt.bzs", 336, "4aa673c91e5d50c1a762e435914bfdfa9760ba01c90601da2b37639cf6b86db4"),
              ("modules/comments/zcom/jfb/nt.bzv", 98952, "695ca0063f406aa8a5542628a2f9ce0685ba0282d759b86f04656f19790c959a"),
              ("modules/comments/zcom/jfb/nt.bzz", 2441962, "40594e36e8efbde9507785f2b049ee55d6cefcfddc13cdd91b45ad6e69145920"),
              ("modules/comments/zcom/jfb/ot.bzs", 480, "0cb741bf07cf710e7ad5cabe90517aaf43ccdf3a92bab527e8925441fb52b00e"),
              ("modules/comments/zcom/jfb/ot.bzv", 289380, "9ca7806638bb062095fd49046c48e8b72a74c6fc645498b17d33d87d31f91556"),
              ("modules/comments/zcom/jfb/ot.bzz", 3191787, "58b063ebf038328915f99aeaf92b123d19ae22ba5ca5163c4c7a534cf60f384a"),
            ],
            "KD": [
              ("mods.d/kd.conf", 5032, "667cbe39b3d2f9b75a35429bee6ef6d3f7c4b453d5a9b097fe97996d68f8b39b"),
              ("modules/comments/zcom4/kd/nt.bzs", 0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
              ("modules/comments/zcom4/kd/nt.bzv", 98952, "7cc2b428668b09df5d81782a789028113481a7ee96f1f4a9643f439c9efb2b78"),
              ("modules/comments/zcom4/kd/nt.bzz", 0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
              ("modules/comments/zcom4/kd/ot.bzs", 576, "95c55f5a0fdc3bbccdf267787561a3f2ea00652cc315ad3c14f2e9f456eb0385"),
              ("modules/comments/zcom4/kd/ot.bzv", 289380, "03c62880ef488dc9dfa329d807b1bf2ca09903ea3116ae23ed4cd77e5589b324"),
              ("modules/comments/zcom4/kd/ot.bzz", 11145784, "2adfc1ca3811ee1325e0513fb498d1bfdb95c66f3fc1ce8858fa805c92df03f5"),
            ],
            "Barnes": [
              ("mods.d/barnes.conf", 437, "6895f7186042c5624117973892bc22dc27fa31a21e9f4fbb217793e8b5df9a5f"),
              ("modules/comments/zcom/barnes/nt.czs", 3120, "a39f80ec47d108a43fda634c1234fc03827f32eac1636d614c01b424dfcf6302"),
              ("modules/comments/zcom/barnes/nt.czv", 82460, "edd2d46416db52595af44811a49940527bba208bd6b73b7c30f480c21d63edae"),
              ("modules/comments/zcom/barnes/nt.czz", 6018995, "d26ada7eba82d4c0c24c18ad8d8a520c1dfd5761e2bdc8161c6888bc665ea40a"),
            ],
          }
          # Each module's license notice, written into SOURCE.md before any push.
          NOTICES = {
            "JFB": "Public domain (1871). CrossWire's text source: CCEL's jfb.txt, an expanded electronic edition prepared from text scanned by Woodside Bible Fellowship.",
            "KD": ("Text by Wikisource contributors, \"Biblical commentary on the Old Testament\", "
                   "https://en.wikisource.org/wiki/Biblical_commentary_the_Old_Testament. When CrossWire made "
                   "version 2.0 of this module (2022-08-03), Wikisource shared it under the Creative Commons "
                   "Attribution-ShareAlike 3.0 Unported license, https://creativecommons.org/licenses/by-sa/3.0/ ; "
                   "Wikisource says the source document of this text is not known. CrossWire's conf says the module "
                   "is based on Willem Swanepoel's BibleWorks 8 user-created module. These files are copied unchanged "
                   "from CrossWire's KD module and are shared under CC BY-SA 3.0 Unported, as their source was. "
                   "The underlying English translation (T. and T. Clark, 1864-78) is public domain."),
            "Barnes": "Public domain (1832-53). CrossWire's conf names no text source.",
          }
          module = os.environ["MODULE"]
          want = FILES[module]
          os.chdir("out")
          found = sorted(os.path.relpath(os.path.join(d, n)).replace(os.sep, "/") for d, _, ns in os.walk(".") for n in ns)
          names = sorted(p for p, _, _ in want)
          assert found == names, f"{module}: the zip holds {found}, expected {names}"
          rows = []
          for path, size, sha in want:
              data = open(path, "rb").read()
              got = hashlib.sha256(data).hexdigest()
              assert (len(data), got) == (size, sha), f"{path}: {len(data)} bytes, sha256 {got}; expected {size} bytes, {sha}"
              rows.append(f"| {path} | {size} | {sha} |")
          conf = next(p for p in names if p.startswith("mods.d/"))
          lines = [l.strip() for l in open(conf, encoding="utf-8").read().splitlines()]
          license = [l for l in lines if l.startswith(("DistributionLicense=", "TextSource=", "SwordVersionDate=", "Version="))]
          assert "DistributionLicense=Public Domain" in license, f"{conf}: {license}"
          url = f"https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/{module}.zip"
          open("SOURCE.md", "w", encoding="utf-8").write(
              f"# CrossWire SWORD module {module}, mirrored\n\n"
              f"Unpacked unchanged from {url}\n"
              "by .github/workflows/mirror-sword-modules.yml, which checks every file against the table below.\n"
              "The zip itself is not pinned: CrossWire repacks some zips without changing the files in them.\n\n"
              "## License and credit\n\n" + NOTICES[module] + "\n\n"
              "## From the module's conf\n\n" + "\n".join(license) + "\n\n"
              "| file | bytes | sha256 |\n|---|---|---|\n" + "\n".join(rows) + "\n")
          print(open("SOURCE.md", encoding="utf-8").read())
          EOF

      - name: Commit the copy to its own branch
        run: |
          set -euo pipefail
          # The branch keeps its history: a pinned commit must stay fetchable.
          mkdir /tmp/mirror && cd /tmp/mirror
          git init -q
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git remote add origin "https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${{ github.repository }}.git"
          if git ls-remote --exit-code origin "refs/heads/$BRANCH" > /dev/null; then
            git fetch -q origin "$BRANCH"
            git checkout -q -b "$BRANCH" FETCH_HEAD
          else
            git checkout -q --orphan "$BRANCH"
          fi
          cp -r /tmp/m/out/. .
          git add -A
          if git diff --cached --quiet; then
            echo "The branch already holds this copy: $(git rev-parse HEAD)"
            exit 0
          fi
          git commit -q -m "Mirror CrossWire SWORD module $MODULE (zip sha256 $ZIP_SHA, fetched $(date -u +%F))"
          git push -q origin "HEAD:refs/heads/$BRANCH"
          echo "Mirrored to $BRANCH at $(git rev-parse HEAD)"
```

**`.github/workflows/mirror-web-texts.yml`**, the same shape with `kind: file` rows (`url`, `path`, `bytes`, `sha256`, `notice`) and one branch per text. Its first rows are Project Gutenberg's current plain texts of ebooks 1549, 48193 and 27978 (`mirror/pg-1549`, `mirror/pg-48193`, `mirror/pg-27978`). V0 downloads each once by hand, measures its bytes and SHA-256 and the ebook page's "Most recently updated" date and rights line, writes them into the table, and only then pushes the workflow. Each `SOURCE.md` quotes Project Gutenberg's rights line and the page URL and, for 1549, the Project Wittenberg sentence. The fathers track adds its rows here later (`mirror/tertullian-cyril-john`, archive.org texts if chosen).

Notes:

- `SOURCE.md` holds only stable facts (no run date, no zip hash; those go in the commit message), so a second run finds nothing to commit. That makes merging the files into `main` safe: the merge's push re-runs them and changes nothing.
- The empty-file entries for KD are deliberate: the check is the exact set of files.
- Each file's fingerprint is checked twice more downstream: `atlas fetch` records its SHA-256 in the lock, and the reader refuses a file whose locked hash differs from the row in `SOURCE.md`.
- A push of a file under `.github/workflows/` needs a token with the `workflow` scope; if the push is refused for that, the founder pushes the branch or runs `gh auth refresh -s workflow`. `workflow_dispatch` works only once the file is on `main`.
- After each run, V0 records each branch's tip commit (40 characters) and the commit's UTC date (the `copied` date) in the build work folder for the integrator.

## 8. Build plan

### 8.1 Modules

Each module runs in its own worktree (`BibleAtlas-voices-<id>`), owns exactly the files listed, and may read anything. Shared files (`sources.json`, `NOTICE.md`, `config/shelf.json`, `config/layer-sources.json`, `config/voices-exclusions.json` after V3, `CLAUDE.md`, `docs/HANDOFF.md`) are edited only by the integrator (VI), from fragments the modules hand over (8.3). A module may make temporary local edits to shared files to run `atlas build`, but never commits them.

| Id | Module | Owns | Depends on | Tests | Acceptance |
|---|---|---|---|---|---|
| V0 | Mirror workflows | `.github/workflows/mirror-sword-modules.yml`, `.github/workflows/mirror-web-texts.yml` | none | the run logs; a second run commits nothing | `mirror/sword-KD`, `mirror/sword-Barnes`, `mirror/pg-1549`, `mirror/pg-48193`, `mirror/pg-27978` exist, their `SOURCE.md` tables and notices equal section 7's, tips and dates recorded; JFB later |
| V1 | Voices core (build) | `crates/atlas-cli/src/extra_voices.rs`; `extra_voices/{text, works, pack, exclude, lets_church, catena}.rs` (catena then passes to V2); read and checks stubs for the other readers; `config/voices/{catena-aurea, henry-concise, wesley-notes}.json` (catena-aurea then passes to V2); line 412 of `build.rs`; `scripts/voices-compare.mjs`, `scripts/voices-dates.mjs`, `scripts/voices-evidence.mjs`; `docs/evidence/voices-live-<date>.json` | none (this spec fixes the formats V3 and V4 use) | moved tests; parts split between chapters under the byte target; bitset round trip (verses 0, 7, 8, 31,101); opening at a paragraph or sentence end, never after a numeral, and a prefix of the whole; long pointer per voice resolves; no long files when `long_chars` is null; said-voice rule (bare link, pointer, empty after cuts); exclusions: sentence, paragraph, note and book scopes, words missing, words found twice, `removes` wrong, waiting worked out; works: not on the cite list refused, unknown field refused, missing `src` refused, lines on real verses, em dash and AI phrase refused | clippy and tests pass; `atlas build` and `atlas verify` pass; the three works the same notes as `main` with corrected credits and dates (5.0); file count, index size and `meta.json` growth recorded |
| V2 | Catena clean-up | `extra_voices/catena.rs`, `config/voices/catena-aurea.json`, `docs/voices/checks/catena-aurea.md` additions | V1 | hide by name, by book, by chapter table, by tag and `not_tag`; an all-hidden passage becomes a `left` entry; `count` mismatch fails | section 6 counts; each `who` and reason checked against its source; the kept and reassigned quotations listed |
| V3 | Exclusions and check method | `config/voices-exclusions.json` (2.6); `scripts/voices-scan.mjs`; `docs/voices/checks/README.md`; `docs/voices/checks/{catena-aurea, henry-concise, wesley-notes}.md` | the spec (lands with or after V1) | the build prints Luther's entries waiting and Pulpit waiting for `not_on`; the scan runs on the three live works and their `Raw` | the three live works' check files, every hit decided |
| V4 | Panel | `web/src/ui/extras/voices.extra.tsx`, `voices/model.ts`, `voices/Panel.tsx`, `voices/Credit.tsx` (if needed), `voices.css` | V1's format; branch from `commentary-notice`'s tip | `tsc --noEmit`; browser checks (8.4) | screenshots and a network log in the PR |
| V5 | SWORD reader | `extra_voices/sword.rs`; one line in `crates/atlas-cli/Cargo.toml` (`miniz_oxide`); `Cargo.lock` | V1; V0 for its acceptance | the synthetic-module tests of 5.2 | reads the mirrored KD and Barnes: slot counts 24,115 and 8,246, the non-empty and distinct counts of the research; ships no work |
| V6 | Calvin | `extra_voices/calvin.rs`, `config/voices/calvin-commentaries.json`, its check and evidence files | V1, V3; question 1 | leading block, tail cut after the first comment paragraph, empty notes dropped, Harmony parallels, `Bible:` prefix, lemma check | 5.1 |
| V7 | JFB | `extra_voices/jfb.rs`, `config/voices/jfb.json`, its check and evidence files | V0 (JFB row), V1, V3, V5; question 1 | introduction split; range-prefix check; title to place; pointer chapters | 5.2, with the collation |
| V8 | Keil and Delitzsch | `extra_voices/kd.rs`, `config/voices/keil-delitzsch.json`, its check and evidence files | V0, V1, V3, V5; question 5 | label anywhere; footnotes; tables; gap marks | 5.3, with the collation; confirms the Ecclesiastes and Psalm entries |
| V9 | Luther | `extra_voices/gutenberg.rs`, `extra_voices/luther.rs`, `config/voices/{luther-galatians, luther-genesis}.json`, their check and evidence files | V0, V1, V3 | heading patterns ("VERSES 8 and 9.", "V. 4, 5a.", "V. 5b, 6.", not "V. Moses"); volume 2 sections and outlines; paragraph numbers; footnotes; encodings | 5.4 |
| V10 | Henry complete | `extra_voices/henry_full.rs`, `config/voices/henry-complete.json`, its check and evidence files | V1, V3; question 1 | printed-Scripture detection; title as place; introduction cut; the three exceptions; continuators per book | 5.5 |
| V11 | Barnes | `extra_voices/barnes.rs`, `config/voices/barnes-nt.json`, its check and evidence files | V0, V1, V3, V5 | "Verse 16." label; ThML; the printing collation | 5.6 |
| V12 | Ecclesiastes cites (Layers) | `config/layers.json` (Ecclesiastes passages only); the `not_on` lines of `config/layer-sources.json`, through VI | TC merged; PR-5 merged; no other holder of `config/layers.json` | `atlas build`; writer counts by hand, recorded | 2.7; `pulpit-ecclesiastes` and the Layers half of `kd-ecclesiastes` print as in force |
| VI | Integrator | `sources.json`, `NOTICE.md`, `config/shelf.json`, `config/layer-sources.json` (the `luther` entry and V12's `not_on`), `config/voices-exclusions.json` after V3, `docs/decisions.md` (new, PR-2), `CLAUDE.md` and `docs/HANDOFF.md` (only what this work needs, and section 0 only in the PR that merges next), PR bodies | each module | full checks per PR (8.4) | one PR per row of 8.2, in order |

### 8.2 PR order

| PR | Contents | After |
|---|---|---|
| PR-1 | V0: the mirror workflows (KD, Barnes, the three Gutenberg texts) | none |
| PR-2 | V1, V3, V4: "Christian writers: each writer opens on its own and is remembered, with true credits and dates" (the three live works, same notes); `docs/decisions.md`; CLAUDE.md's writers line (and the AI rule, if TC has not merged) | `commentary-notice` merged; no-empty-selections merged or not holding the voices files; TC not holding `NOTICE.md` and `config/shelf.json` (or PR-2 rebases on it) |
| PR-3 | V2: the Catena clean-up | PR-2 |
| PR-4 | V5: the SWORD reader (`miniz_oxide` enters here) | PR-1, PR-2 |
| PR-5 | V9: Luther, and the `luther` cite entry | PR-1, PR-2; AF-DT merged (it must land before the first voices PR that adds a `sources.json` entry) |
| PR-6 | V8: Keil and Delitzsch | PR-4; question 5 |
| PR-7 | V11: Barnes | PR-4; question 6 if the printing is not identified |
| PR-8 | V6: Calvin | PR-2; question 1 |
| PR-9 | V7: JFB (with JFB added to the mirror matrix in a small PR first) | PR-4; question 1 |
| PR-10 | V10: Henry's complete commentary | PR-2; question 1 |
| PR-11 | V12: Ecclesiastes cites in Layers | TC merged; PR-5; not while AF-LR, AF-LS or AF-LE hold `config/layers.json` |

Modules may be built in parallel as soon as their dependencies exist; PRs land in this order so each one's measured counts are against a known `main`. **One holder per shared file, counting every branch in flight** (TC, `commentary-notice`, no-empty-selections, the audit-fixes PRs, sourced themes): whichever opens second waits or rebases. Each PR uses Before / After / How / Checks with exact counts, names the founder decision it carries out, and lists its proposed exclusions, its dropped pointer-only notes and (PR-3) its reassigned Catena quotations. `docs/HANDOFF.md` section 0 is rewritten only as the last commit of the PR that merges next, after rebasing on the then-current `main` (AUDIT-FIXES-PLAN.md section 2). Merging deploys at once, so each PR is checked on its preview build and, after merging, against the live `data/meta.json` build id and one changed verse at the live URL.

### 8.3 Fragments a work module hands the integrator

In the build work folder (`bibleatlas-workfiles/<date>/voices-build/<work>/`):

- `source.json`: the full `sources.json` entry, with every field `sources.rs` requires and AF-DT's `original` {by, work, date}, `version` and `copied`;
- `notice-row.md` and `notice-paragraph.md`;
- `shelf-card.json` (with `cites` and the three dates);
- `cite.json` (only Luther);
- `exclusions-shared.json` (only entries for the shared file: cite-only or for works not configured; a configured work's entries are in its own config);
- `counts.json` (notes, verses, files, bytes, gzip bytes, the report line, the verify count, dropped pointer-only notes);
- `pr.md` (Before / After / How / Checks draft).

The module's own evidence file (`docs/evidence/voices-<work>-<date>.json`) and check file are committed by the module, not handed over. The integrator applies the fragments in PR order, runs 8.4, and opens the PR only with the founder's go-ahead.

### 8.4 Checks for every PR

- `cargo clippy --workspace --release -- -D warnings` and `cargo test --workspace --release`.
- `atlas fetch` (a new source needs it; the Windows LF settings from CLAUDE.md when on the founder's PC), `atlas build`, `atlas verify` (all checks pass; the new count recorded against the count on `main`).
- `npm run build` in `web/`.
- `node scripts/voices-dates.mjs` and `node scripts/voices-evidence.mjs` (3.2, 3.6); the AI-credit phrase check of AUDIT-FIXES-PLAN.md rule 3 over every changed credit string; `git grep` for em dashes in what the app writes.
- The browser checks (1440x900 and 390x844, light and dark, Simple, Study and Deep, no console errors, first visit loads nothing extra, the index loads only at Deep):
  - John 3:16 (Calvin, JFB, Henry complete and Barnes as each lands): the line, the headers, a book line with its dates and source links, one part file fetched per open writer in view, "Read all" fetching one long file, focus and scroll as section 4 says;
  - Genesis 3:15 (Keil and Delitzsch); Ecclesiastes 1:2 (the Keil and Delitzsch line in "Left out here", plain text); Galatians 2:20 and Genesis 1:1 (Luther); Genesis 4:9 (a volume 2 place);
  - **Matthew 23:13: the Fathers are not listed; the quiet left-out line shows**; Matthew 5:3: a Catena chain with left-out quotations as quiet lines, the reasons once after the chain, four shown Fathers before "Show more";
  - 1 Timothy 1:1: Calvin's left-out line as plain text, and no Calvin header;
  - the notice: no words on any path before it is finished (line tap, a shared `#x=voices` link, Back and Forward); the closed state names the writers;
  - remembered picks: with the old key `atlas.voices = '1'` set, finish the notice from the Layers card on Isaiah 53:5, then open Christian writers at Deep: the three live works are open; a fresh reader starts with none open; picks survive a reload.
- `meta.json` size before and after, raw and gzipped; the build's report lines for the work copied into the PR body.
- The work's check file present, with every scan hit decided.

### 8.5 What waits for the two research tracks

**The church fathers from the original 19th-century volumes** (Chrysostom's homilies, Augustine on John and 1 John, Gregory on Job, Cyril on John, and the fathers list). Waiting: the choice of source (archive.org scans and OCR, Wikisource, or Historical Christian Faith with its gaps marked), its reader, its mirror rows, the approved and condemned lists, and the founder's CCEL rule, which the research applied to these sources and must be applied the same way (section 9 question 1). Hooks already in this batch: per-work `license` (Wikisource's CC BY-SA files, with the 3.0 to 4.0 route of 5.3); `w` and the `page` mark; left-out voices with `reasons`; `who` notes with sources; two works by one writer side by side (decision 5); `mirror-web-texts.yml`; the per-note `lab` for Gregory's "spiritual reading"; and, if Historical Christian Faith's per-verse files are used, folder pinning in `sources.rs` and `fetch.rs`, not built now.

**The Puritans' old spelling** (Owen, Manton, Watson, Bunyan, Sibbes, and Poole). Waiting: the cited sources for modern readings (EarlyPrint's standard spellings, Webster's 1828), the TEI reader (`extra_voices/tei.rs`) and the spelling table (`config/voices-spelling/<work>.json`, every entry with its source). Hooks: the `gloss` and `gap` marks; long voices with "Read all"; the Scripture check and exclusions, unchanged.

Not in this batch and not waiting on research: Spurgeon (waits for Project Gutenberg's volumes), Calvin's Old Testament, Cyril (needs the tertullian.org mirror), Luther's Church Postil and Psalms, Clarke and Scofield (their own founder questions in VOICES-PLAN.md).

## 9. Founder questions still open

1. **CCEL's terms.** Calvin, JFB, Henry's complete commentary and the live Concise are CCEL transcriptions, taken through CrossWire. The books are marked public domain (CrossWire's confs say "Public Domain"; `jfb.txt` opens with "Rights: Public Domain", and each module checks CCEL's own page for the other books), but CCEL's site says "These books may be used for personal, educational, or non-profit purposes. Contact us for permission to republish CCEL works or to use them commercially." The research rejected CCEL copies of Luther, Edwards and the fathers for this reason. *Asked for one recorded rule:* either CCEL's per-book public-domain mark suffices (as already accepted for Henry's Concise, Easton and Smith), and then Calvin, JFB and Henry complete go ahead and the same rule reopens CCEL copies elsewhere; or it does not, and then those three wait for another copy or CCEL's permission, and the live Concise comes back to you too. Until you rule, the three are out of the PR order and JFB is not mirrored.
2. **Where is the line for "denies Scripture"?** Some writers give a book or psalm another author or a later date than its own words do. *Proposed default:* leave out what contradicts the text itself: an author named in a title or opening verse, a book's own claims about itself, or its place in the Bible. Keep the rest, recorded in the work's check file. The cases found so far:
   - Keil and Delitzsch on Psalm 74, titled "A Maskil of Asaph": at 74:4 Delitzsch calls a word "a weighty instance in favour of the Maccabaean origin of the Psalm", and 74:18 leans the same way (proposed exclusions `kd-psalm-74`);
   - Psalm 86, titled "A prayer of David": "can only be called a Psalm by David as having grown out of Davidic and other model passages", repeated at Psalm 130:1, "Ps 86 is not Davidic" (`kd-psalm-86`, `kd-psalm-130`);
   - Proverbs 1:7 to 9:18, which Delitzsch's introduction gives to "an altogether different author from Solomon, and one who is more recent". Hidden today only because introductions are cut; any later change to that cut must re-check it;
   - kept under the default: Calvin's view that Paul did not write Hebrews, which names no author; and Psalm 44, where Delitzsch weighs a Maccabean date and rejects it ("Nevertheless many considerations are opposed to the composition of the Psalm in the time of the Maccabees"). (The first version of this spec said he dated Psalm 44 to the Maccabees; that was wrong.)
3. **Claims that the received text, as the BSB prints it, contains a copyist's or writer's error.** Calvin on Matthew 27:9 ("the name of Jeremiah has been put down by mistake, instead of Zechariah"), Acts 7:14 ("this difference came through the error of the writers which wrote out the books") and Acts 7:16 ("this place must be amended"); Barnes on Matthew 27:9 ("a mistake made by ancient transcribers ... Probably this is the correct explanation"). *Proposed default:* leave out the smallest passage that says the words are wrong, marked "A passage is left out here because it says a word of this verse is a mistake", and keep the rest of the note; these entries are in force at once as proposed. Textual judgements that agree with the BSB's own omissions (Barnes on Acts 8:37, "unless it is spurious"; JFB and Barnes on 1 John 5:7) are kept.
4. **Proposed exclusions.** May an exclusion that a session finds take effect at once (left out and marked, with the reader seeing "A passage is left out here until a decision on it is made.") while it waits for your ruling, with only you marking it "decided"? *Proposed:* yes; leaving out is the safe side, and every proposed entry is listed in the PR body. (The same shape as the still-unconfirmed rule on who may set `reviewed_by`.)
5. **Keil and Delitzsch's license route.** Its text came from Wikisource under CC BY-SA 3.0 (with no known source document, and earlier from a BibleWorks module of unstated license); the 1864–78 translation itself is public domain. CLAUDE.md ships only CC BY-SA 4.0 among share-alike licenses. *Proposed:* mirror the module unchanged under CC BY-SA 3.0 with its notice, and ship the app's built files, which are an adaptation, under CC BY-SA 4.0 as CC BY-SA 3.0 section 4(b) allows, saying so in NOTICE.md. Confirm, or say you want only a source that is itself under 4.0 (then KD waits).
6. **Barnes's printing.** If V11's collation cannot name the printing this copy follows, *proposed:* ship it with "a printing after 1858 that this copy does not name" in the book line on screen, or hold Barnes for you. Which?
7. **Graebner's Galatians.** Your decisions file still lists the Luther plan's question 14 as open, while the approved shortlist (question 3) put Galatians in the first batch "labelled abridged". It ships as "Commentary on the Epistle to the Galatians (abridged)", "abridged and put into modern English by Theodore Graebner"; it has no marks where Luther's words are left out (decision 4 asks that left-out words be "shown honestly"). Confirm, or wait for a full text.
8. **Two Catena voices without a recorded decision.** Clement of Alexandria, under "Leave out the disputed for now" in the approved fathers list, keeps his one Luke quotation with a who note (as the approved answer did for Eusebius). Josephus keeps his one Matthew quotation with the note "the Jewish historian of the first century, quoted by Aquinas as a witness; not a Christian writer" (CLAUDE.md allows him only as a witness; audit question 6). Confirm both, or hide either with a truthful line.
9. **Bible Hub links.** Once JFB and Keil and Delitzsch are stored, keep their chapter links under "Read more on other websites", drop them, or replace them (VOICES-PLAN.md question 13)? *Proposed default:* keep them for now.
10. **Shared-code limits** (HANDOFF section 8, row 12, and AUDIT-FIXES-PLAN.md section 7, conflict 12): confirm that the extras' limits (at most five one-line insertions in `sources.json` and `NOTICE.md`, no new crates) do not bind these planned, one-at-a-time PRs. Each new source is a multi-line `sources.json` entry with a NOTICE paragraph, and `miniz_oxide` is the one new library, in the place of the "one small library" you approved.

## 10. Review record

Three reviews of the first version (2026-10-20): feasibility (F, 20 findings) and reader (R, 17) in run `wf_d99604b2-da9`, and rules (S, 23, numbered here in the order the review gave them). Every blocker and major is closed; the minors are closed too except where noted.

| Finding | Severity | What it found | Closed in |
|---|---|---|---|
| F1 | blocker | long notes per item would shrink Catena chains | 1.3, 1.5, 4: long per voice; `long_chars` null for the live works |
| F2 | major | entries for unbuilt works failed the build; V1 needed V3's file | 2.1, 2.3: waiting worked out; missing file is empty |
| F3 | major | per-work verify cases had no owner | 1.4: `checks()` per reader, dispatched like `read()` |
| F4 | major | stubs would fail `clippy -D warnings` | 1.4: only `read` and `checks` stubbed; Ctx fields added when read; slots from `vz` |
| F5 | major | the notice contradicts 1.6, 1.7 and 1.9 | 1.6, 1.9: follows `d12a4dd`; V4 branches from it |
| F6 | major | the picks migration fails after the notice | 1.7: migration at module load, keyed also on `atlas.commentary` |
| F7 | major | `expect` meanings; Raw undefined; heading slots; verse-0 lines | 1.4 (Raw), 2.1 (`matches`, `removes`, `found`), 5.2 (heading slots), 5.5 (verse 0 in Raw) |
| F8 | major | modules could not edit shared exclusions | 2.1: per-work `exclude` in each work's config |
| F9 | major | Barnes's conf has no Versification | 5.2: SWORD defaults; a test |
| F10 | major | no retrieval date | 1.2 `dates`, 3.6 (with S1) |
| F11 | minor | `has` rule inconsistent | 1.3, 1.10 item 3: said voices only (the rules review's rule, which supersedes F11's fix of setting bits for all-hidden items) |
| F12 | minor | duplicate shelf cards | 3.5: `cites` on every card |
| F13 | minor | Catena notes lost between PR-2 and PR-3 | 5.0: V1 seeds today's seven rows, with sources |
| F14 | minor | KD labels with NoParagraphs | 5.3 reader step 1 |
| F15 | minor | incomplete `sources.json` entries | 5 (common rule), 5.1, 5.2, and "written out in full" for the rest |
| F16 | minor | page weight | 1.8; `LONG_BYTES` 250,000 |
| F17 | minor | stale files, private helpers, compare script | 1.10 (meta.json list), 1.2 (lenient structs), V1 owns `voices-compare.mjs` |
| F18 | minor | flate2 brings four crates | 1.4: `miniz_oxide` |
| F19 | minor | wrong Ecclesiastes numbers | 1.3: 17316 to 17537 |
| F20 | minor | names with commas read as lists | 1.2 (`short` rule), 1.6 |
| R1 | blocker | the panel did not fit the notice | 1.6, 1.9; CLAUDE.md line in PR-2 |
| R2 | major | migration after the notice | 1.7; browser check in 8.4 |
| R3 | major | long notes for Catena chains | as F1 |
| R4 | major | openings stop mid-thought | 1.5 rule 2; tests; verify item 8 |
| R5 | major | left-out lines crowd Matthew | 1.6 item 6, section 6: short lines, merged neighbours, why once, not counted |
| R6 | major | left-out lines against decision 12 | 1.3, 1.6 item 4, 2.4 (with S3). Not adopted: showing book lines only to readers who opened that writer |
| R7 | major | no dates, no "who was this" | 1.2 `people`, 1.6, 3.1, 3.6; decision numbering fixed |
| R8 | major | headers too long | 1.6 item 5: short name, then work and date; `<h3><button>` |
| R9 | major | no hint once open | 1.6 item 3 |
| R10 | minor | lists with "and"; wrong example | 1.2, 1.6 (John 3:16's real line) |
| R11 | minor | "Their words" and "Left out" rows | 1.6 items 2 and 8; proposed line in 2.4 |
| R12 | minor | Read all focus; cost with all open | 4, 1.6 item 6 (lazy fetch), 1.8 |
| R13 | minor | Luther Genesis places and outlines | 5.4 Genesis step 5; small capitals by CSS |
| R14 | minor | missing `how` and `copy` strings | written for every work in 5.0 to 5.6; row labels in 1.6 item 8 |
| R15 | minor | Galatians not labelled abridged in the header | 5.4: title "(abridged)" |
| R16 | minor | Eusebius note reads badly | section 6 |
| R17 | minor | Calvin missing on Mark and Luke | 5.1 reader step 8 |
| S1 | blocker | no retrieval date anywhere | 1.2, 1.3, 3.6, fact 10; `voices-dates.mjs`. The review asked for `copied` "from git, never typed by hand", AF-DT for a typed value: it is written once from git and checked against git |
| S2 | blocker | KD provenance and license misstated | fact 12, 5.3, section 7 (`SOURCE.md` notice), question 5 |
| S3 | blocker | selections that open empty | 1.3 `has`, 1.4 said voices, 1.6, 2.4, section 6 (Matthew 23:13), 5.1 (Philemon, tail cut), 1.10, 8.4 |
| S4 | blocker | unsourced app statements | 1.2 `src` and `people`, 3.2, section 6, 5.4 (cite entry), 3.5 (`what`) |
| S5 | major | Calvin cases missed; scan gaps | fact 5, 2.5 patterns, 2.6 proposed entries, question 3 |
| S6 | major | question 1 misstated KD | question 2 rewritten; 2.6 entries |
| S7 | major | `expect` two meanings | 2.1 `matches` and `removes`; 2.6 values; V1 tests |
| S8 | major | Catena hides non-Arian quotations | section 6 rules and counts; fact 3 |
| S9 | major | live works keep old credits | 5.0 |
| S10 | major | Henry's "other ministers" | 5.5 rows per book; volume dates; chain |
| S11 | major | CCEL's terms unreconciled | fact 11, 5.1, 5.2, 5.5, 5.0, question 1; three works held |
| S12 | major | JFB's modernised text | fact 16, 5.2 copy, NOTICE, card, collation |
| S13 | major | Barnes edition unknown | 5.6, question 6 |
| S14 | major | "Disclose AI drafting" not replaced | Binding inputs; 2.7 acceptance; PR-2 |
| S15 | minor | KD line credits both writers | 2.6 `kd-ecclesiastes` line |
| S16 | minor | panel lines promise too much | 1.6 items 2 and 8; 3.3 |
| S17 | minor | font code handled two ways | 5.3 step 3: the `gap` mark |
| S18 | minor | decisions cannot be re-checked; numbering | `docs/decisions.md` in PR-2; "shortlist question N" throughout |
| S19 | minor | Calvin line understates the cut | 2.6 Calvin lines; the 197,000 figure dropped |
| S20 | minor | Luther credits | 5.4 rows; "loved best" dropped |
| S21 | minor | old Galatians snapshot; Project Wittenberg uncredited | 5.4 (Project Gutenberg's current files mirrored, fallback named), section 7 |
| S22, S23 | minor | Clement and Josephus; Graebner still open | section 6, questions 7 and 8 |

Also changed: fact 6 recounted on `2aabdcc` (12 notes in 8 passages; the layers-mend dependency is now met, and V12 waits for TC instead); the review files are named check files (`docs/voices/checks/`), since no person reviews them (decision 19); evidence records follow AUDIT-FIXES-PLAN.md rule 6; and the PR order puts the works that need no ruling first.


## Founder rulings on section 9 (2026-10-21)

All ten questions take the recommended answers; the exact words are in FOUNDER-DECISIONS-2026-10-20.md item 23. In short: CCEL-sourced copies go ahead credited to CCEL; Clement of Alexandria's one Catena quotation is hidden with a truthful line; the "denies Scripture" line, the error-claim rule, provisional exclusions, Keil and Delitzsch under CC BY-SA 4.0, the Barnes printing line, Graebner's Galatians labelled abridged, Josephus labelled as a witness, and the Bible Hub links kept, all as proposed.
