# Literary devices in Bible Atlas: how the feature fits the code

Repository github.com/Sixteen1-6/BibleAtlas, read at `origin/main` = `5296d48` (merge of PR #47), after `git fetch`. The clone was only read (`git show origin/main:<path>`); nothing was checked out, edited or committed there. The live site now serves build `7bd9f13db417`.

How this was measured (all scripts and outputs are in this folder):

- The pinned BSB USFM (`bsb-usfm`: usfm-bible/examples.bsb @ `48a9feb71f0a66f9b8f418b11ae25b7ad2e49a0d`) was read from the local fetch at `scratchpad/ba/wt/build/data/raw-lf/examples.bsb@48a9feb71f`. All 66 files match the SHA-256 in that fetch's `manifest.lock.json`, and three files fetched fresh from raw.githubusercontent.com at the pinned commit (Psalms, Proverbs, Isaiah) are byte for byte the same.
- `tools/poetry.py` parses the USFM the way `extra_quotes.rs::read_usfm` does (headings skipped, footnotes dropped, `\nd` upper-cased, runs of space as one) and also records the paragraph marker at each line start. It compares every poetry verse with the app's English (`bible_databases@e1b254cef8/formats/json/BSB.json`, the `bsb` source). Output: `poetry-stats.json`, `poetry-stats-verses.json`.
- `tools/cola.py` takes the live `text/<Book>.json` shards (downloaded from everyversemap.com into `dl/live/` for 11 books) and tests whether each English poetry line maps onto a contiguous run of Hebrew or Greek words through the existing word alignment (`row[2]`). It also measures the bytes a line field would add.
- Code read: `crates/atlas-cli/src/{layers.rs, extra_wordplay.rs, extra_parallels.rs, extra_quotes.rs, align.rs, naves.rs, eras.rs, build.rs, verify.rs}`, `web/src/{depth.ts, App.tsx, data/layers.ts, data/text.ts, data/align.ts, ui/Reader.tsx, ui/Pairs.tsx, ui/Layers.tsx, ui/mapKinds.ts, ui/colors.ts, ui/Roads.tsx, ui/ThemeSky.tsx, gl/layout.ts, ui/extras/*}`, `config/{layers.json, layer-sources.json, parallels.json, hard-verses.json}`, and the pinned Nave's CSV.
- `git grep` over all 44 remote branches for chiasm, inclusio, anthropomorphism, parallelism, merism and `\q1` found no code for this feature anywhere (only Ask question signal words and one hidden Nave's heading).

---

## 0. The short answer

The feature lives in three places, because the devices come in three shapes.

| Shape | Devices | Home in the code | Why there |
| --- | --- | --- | --- |
| The BSB's own poetry lines | every poem: the lines that parallelism is made of | **Reader markup.** The build reads `\q1`, `\q2`, `\qr`, `\b` and `\d` from the already pinned `bsb-usfm` and writes a small `poetry` field into each `text/<Book>.json`; `Reader.tsx` and `Pairs.tsx` draw each verse as its lines | It is how the BSB itself prints the text, so it makes no claim and needs no writer. It cannot be an extra: extras only add a line under a verse, they cannot change how a verse is drawn |
| One verse | anthropomorphism and anthropopathism, personification, merism, hyperbole, metaphor and simile, the kind of parallelism inside one verse | **New Layers kinds** in `config/layers.json` (two kinds: `figure` and `parallelism`), checked by `layers.rs` like every other note, and shown under the verse by a new extra that reads them from `layers.json` the way the Wordplay extra already does | Every Layers passage is one verse today, and the Layers checks (references, BSB quotes, cite list, avoid list, interpreter rule) are exactly the ones these notes need |
| Many verses | chiasm (mirror), inclusio (bookends), alternation, refrains, character juxtaposition (foils) | **A new extra** (`structure`): `config/structures.json`, `crates/atlas-cli/src/extra_structure.rs`, `extras/structure.json` plus `extras/structure/<Book>.json`, `web/src/ui/extras/structure.extra.tsx` and its panel; two new link kinds on the map (`mirror`, `foil`) | A ten-verse structure does not fit the Layers model (section 1.2), and its panel needs the passages side by side, which is what the extras spine and the Parallels panel already do |

Two facts decide most of the design:

1. **Poetry lines are already in a pinned source and split almost every poetry verse.** 8,180 of the USFM's 31,084 verses (26.3%) carry poetry line marks, in 55 books; 8,150 of them (99.6%) break into two or more lines inside the verse, 24,823 lines in all. Only 8 verses start in the middle of a line. So lines can be stored and drawn per verse with almost no loss.
2. **Layers cannot hold a multi-verse structure as it stands.** All 1,264 live Layers passages are exactly one verse and none overlap; `passageAt()` (`web/src/data/layers.ts`) returns the first passage whose range holds the verse, and `layers.json` is fetched at boot for every visitor (2.86 MB raw, 626 KB gzipped, about 924 bytes per note).

---

## 1. What exists today

### 1.1 Notes that already touch the devices

Measured on `config/layers.json` at `5296d48` (1,264 passages, 3,099 notes; kinds plain meaning, quotation, allusion, wordplay, name meaning, pattern, irony, fulfillment, setting):

- Bullinger's *Figures of Speech* (`bullinger-fos`, on the cite list as an interpreter) is cited by 117 notes. The figure is named in the cite's `at`, for example "E. W. Bullinger, Figures of Speech Used in the Bible (1898), Anthropopatheia (Condescension)". Figures named: Paronomasia 52, Ploce 23, Ellipsis 6, Paregmenon 6, Polyonymia 3, Polyptoton 3, Synecdoche 3, Anthropopatheia 2, Gnome 2, Syllepsis 2, Metonymy 2, Synoeceiosis 2, and one each of Meiosis, Heterosis, Idioma, Paroemia, Parechesis, Simile, Anacoluthon, Homoeoptoton, Polysyndeton, Epizeuxis, Hyperbole. So the convention for naming a figure and its source already exists.
- Words in note text and evidence: "contrast" or "foil" 85 notes, "parallel" 18, "mirror" 9, "simile" 4, "personif-" 4, "metaphor" 3, "anthropomorph-" 2, "hyperbole" 1, "refrain" 1. None says chiasm or inclusio. One `pattern` note describes a frame: 1 Samuel 2:10, Hannah's and David's songs bracketing the books of Samuel.
- Of the founder's examples, none of these verses has a Layers passage yet: Genesis 1:1, 4:4, 4:5, 6:6, 8:1, 25:23, 25:27; 1 Samuel 1:2, 1:6, 2:12, 2:26, 15:11; Luke 10:41-42, 18:11, 18:13, 18:14; Matthew 26:75; Isaiah 53:1; Exodus 6:6; Psalms 1:1, 8:1, 8:9, 23:1, 103:1, 139:8. Genesis 4:2, 1 Samuel 15:29, 16:7, Matthew 27:5 and John 10:11 have passages, so a device note there must be added to that passage, not as a second passage (section 1.2).
- The unreviewed hard-verse card `god-relents` (1 Samuel 15:29, "Does God change His mind?") is the question anthropopathism answers; only its pointer shows, at Deep.
- Nave's Topical Bible (already pinned: BradyStephenson/bible-data @ `720a8da6d2`, read by `naves.rs`) has a subject ANTHROPOMORPHISMS, hidden on the Themes tab by `config/naves-display.json` line 20. Its entry defines the term ("Figures of speech, which attribute human forms, acts, and affections to God") and lists more than 60 passages under sub-headings such as Walking (Genesis 3:8), Resting, Laughing (Psalm 2:4), Sleeping (Psalm 44:23), Grieved (Genesis 6:6) and Amazement. It also has IRONY (19 references), POETRY (acrostic, elegy, epic, sacred lyrics), PERSONIFICATION (wisdom in Proverbs 1, 8, 9), SARCASM and PARABLES. Nave (1896) is public domain and Nave was a Methodist army chaplain.

### 1.2 Why a multi-verse structure does not fit Layers as it is

- `layers.rs` writes each passage as `{v, end}`, and every one of the 1,264 is one verse (`v == end`), with no overlaps (measured on the live `layers.json`).
- `passageAt(list, v)` uses `Array.find`; `LayersCard` shows one passage. A chiasm passage such as Genesis 6:10 to 9:19 would cover the single-verse passages inside it, and whichever comes first in config order would hide the other.
- The reader marks a verse "Layers ›" from `new Set(passages.map(p => p.v))` (Reader.tsx line 142): a long passage would be marked only at its first verse.
- `layers.json` loads at boot (`App.tsx` line 121, `void loadLayers(atlas)`), so everything stored there is paid for by every visit.

Single-verse devices have none of these problems.

### 1.3 The closest existing analogues

| Existing piece | What it does | What the feature takes from it |
| --- | --- | --- |
| Wordplay extra, `extra_wordplay.rs` | 12 alphabet poems; every letter checked against the first letter of its word in TAHOT, 461 letters; a chapter line ("An alphabet poem in 22 parts of 8 verses") and a chapter panel; plays on words read from `layers.json` kinds | The model for a structure check against the original words; the model for reading Layers kinds into reader lines; `chapterNote` for whole-chapter structures |
| Parallels extra, `extra_parallels.rs` and `parallels/Compare.tsx` | 307 sets; each pair of passages measured for shared roots and English words (IDF weighted Dice) and lined up verse by verse; two columns with shared words underlined at Study and roots at Deep | Foils (two people's passages side by side) and the A and A' members of a mirror |
| `eras.rs` | Every quotation of the Tyndale Open Bible Dictionary checked word for word against the pinned XML | The model for checking any quoted line of Bullinger, Lowth or another pinned source word for word |
| `mapKinds.ts` | Quotation, echo and parallel links drawn on the map in colors of their own, only after the reader's line has loaded its data | Two more kinds: `mirror` and `foil` |
| `Roads.tsx` `NightStrip` | A small night sky (SVG, `arcPath`, `arcHeight`, the SKY gradient) with one road drawn as arcs | The nested arcs of a chiasm, drawn over the passage's own verses |

---

## 2. How the BSB USFM marks poetry (measured)

### 2.1 Markers

Counts of line-start markers across the 66 files: `\v` 31,084; `\q2` 12,545; `\p` 12,251; `\q1` 11,559; `\b` 3,953; `\s1` 3,015; `\li1` 1,343; `\r` 1,322; `\c` 1,189; `\qr` 223; `\pmo` 205; `\li2` 194; `\d` 118; `\s2` 80; `\qa` 44; `\pi1` 28; `\m` 22; `\pc` 15. There is no `\q3`, `\q4`, `\qc` or `\qm`: the BSB uses two indent levels only.

- `\q1` and `\q2`: the line and its indented partner. A verse usually opens with a bare `\q1` line followed by `\v N` and the first line's text.
- `\qr`: 223 right-aligned lines inside verses. They are refrains and responses: "Selah" 71, "declares the LORD." 62, "His loving devotion endures forever." 26 (every verse of Psalm 136), "And let all the people say, 'Amen!'" 12, "says the LORD." 9.
- `\b`: 3,953 stanza breaks; 2,232 poetry verses begin right after one.
- `\d`: 118 psalm titles (116 in Psalms, 1 in Habakkuk, 1 in Zechariah). `\qa`: 44 lines in Psalm 119, the Hebrew letter and its name for each of the 22 parts.

Example, Psalm 1:1 (`\q1` at 0, `\q2` at 18, `\q1` at 66, `\q2` at 102, in characters of the verse):

```
Blessed is the man
    who does not walk in the counsel of the wicked,
or set foot on the path of sinners,
    or sit in the seat of mockers.
```

Psalm 136:1 is `\q1` "Give thanks to the LORD, for He is good." then `\qr` "His loving devotion endures forever."

### 2.2 How many verses, and do lines split inside verses

| Measure | Count |
| --- | --- |
| Verses in the USFM / in the app's BSB | 31,084 / 31,102 (the 16 New Testament verses the BSB leaves out are absent from the USFM; so are Psalm 106:42 and Lamentations 2:1, see 2.3) |
| Verses that carry poetry line marks | **8,180 (26.3%)**, in 55 books: Old Testament 7,829, New Testament 351 |
| Of those, split into 2 or more lines inside the verse | **8,150 (99.6%)** |
| Lines in all | **24,823** |
| Lines per verse | 1: 30; 2: 4,352; 3: 1,019; 4: 1,706; 5: 453; 6: 466; 7: 101; 8: 44; 9 or more: 9 |
| Verses that begin in the middle of a line (a line crosses a verse boundary) | 8: Judges 5:11, Psalm 55:3, 80:2, 96:13, Proverbs 26:24, Isaiah 28:12, Zechariah 12:1, Luke 1:74 |
| Verses that start as prose and turn into poetry (a speech introduced, then quoted as poetry) | 442 (Genesis 2:23, 4:23, 9:25, Matthew 3:3 and the like) |
| Verses with a prose paragraph mark inside | 313 |

By book (poetry verses / all verses): Psalms 2,459 / 2,461 (100%), Lamentations 153 / 154, Proverbs 895 / 915 (98%), Job 992 / 1,070 (93%), Hosea 181 / 197 (92%), Isaiah 1,121 / 1,292 (87%), Jeremiah 623 / 1,364 (46%), Ezekiel 197 / 1,273 (15%), Genesis 59, Deuteronomy 93, 2 Samuel 69, Luke 68, Matthew 60, Revelation 52, Hebrews 41, Romans 40.

Proverbs 10 to 15 show why the lines matter for parallelism: of 183 two-line verses there, the second line of 147 (80%) begins with "but". Over all 4,352 two-line verses the second line most often begins with "and" (1,127) or "but" (319).

### 2.3 Can the lines be placed on the English the app shows

The app's English comes from the `bsb` source (BSB.json), not the USFM, so every break has to be placed on that text. Of the 8,180 poetry verses:

| Case | Verses | What the build does |
| --- | --- | --- |
| Same text, character for character (after ʼ = ’) | 7,937 (97.0%) | use the offsets as they are |
| BSB.json has the psalm title in front of verse 1, the USFM has it as a `\d` line | 116 (1.4%) | offsets shift by the title's length; the title becomes a line of its own |
| Wording differs (the USFM is a fork as of 26 August 2024; examples: Numbers 23:8 "those whom" against "what", Deuteronomy 32:5 "blemish" against "spot") | 127 (1.6%) | place each break by word alignment (an LCS over words, which `align.rs::pair`, line 111, already implements), accepting a break only when the word it starts on is matched exactly in BSB.json: 106 of the 127 place this way |
| Not placeable under that rule (a break falls on rewritten words): Nehemiah 9:15, Job 37:18, Psalm 45:2, 72:16, 86:14, 106:41, Isaiah 40:20, 44:15, 45:11, 55:13, Jeremiah 1:16, 2:3, 2:5, 2:11, 2:27, 10:22, 11:15, 31:21, Daniel 4:15, 4:23, Revelation 18:20 | 21 (0.26%) | show the verse unbroken (a looser rule, a break at the start of a rewritten stretch, would place 10 more) |
| Missing from the USFM | 2 | Psalm 106:42 lost its `\v 42` marker and first line, so its second line is glued onto 106:41 (which is why 106:41 is in the row above); Lamentations 2:1 is absent. The build must compare with BSB.json and drop lines that do not fit, never trust the USFM alone |

So 8,159 of the 8,182 poetry verses the app shows (99.7%) can be drawn as lines; 23 stay as they are today.

### 2.4 Can the Hebrew and Greek be split into the same lines

Through the alignment the app already ships (`row[2]`: English word to original word group), for 6,229 poetry verses of 11 books (Genesis, Job, Psalms, Proverbs, Song, Isaiah, Lamentations, Hosea, Amos, Matthew, Luke):

| Result | Verses |
| --- | --- |
| Every original word falls in one English line, in order: the Hebrew splits cleanly into the same lines | 5,354 (86.0%) |
| Hebrew word order crosses the English lines | 289 (4.6%) |
| One Hebrew word's English is spread over two lines | 269 (4.3%) |
| The alignment is partial (`align.rs` drops shifted links, so later words have no partner) | 110 (1.8%) |
| English differs from the USFM (titles, wording) | 207 (3.3%) |

By book, clean: Proverbs 873 / 895 (97.5%), Job 889 / 992 (89.6%), Psalms 2,163 / 2,459 (88.0%), Song 98 / 116, Matthew 55 / 60, Luke 58 / 68, Isaiah 858 / 1,121 (76.5%), Lamentations 115 / 153, Hosea 132 / 181, Amos 73 / 125. Where it is not clean, the Hebrew line stays whole under the English lines, as it is today.

---

## 3. Poetry lines in the reader

### 3.1 Build

- A new reader (in a small `poetry.rs`, or a poetry-aware variant of `extra_quotes.rs::read_usfm`, which today drops `\q` marks as spaces) records, per verse: the level of each line (1 for `\q1`, 2 for `\q2`, 3 for `\qr`), where it starts in the verse, whether a `\b` stanza break comes before the verse, and the `\d` title.
- Placement on `bsb.text` as in 2.3: exact, title prefix, or `align::pair` over words; otherwise no lines for that verse. The tally goes to stderr like the other modules ("poetry: 8,159 verses in lines, 21 left as prose, 2 missing from the USFM").
- Output: a book-level field in `text/<Book>.json`, so the `VerseRow` tuple (`[english, words, align?]`, where `align` is optional) keeps its shape:

```json
{ "book": "Ps", "chapters": [ ... ],
  "poetry": [[0, 1, 18, 2, 66, 1, 102, 2], ...] }
```

  one array per poetry verse: verse index within the book, then the first line's level (plus 8 when a stanza break comes before it), then `offset, level` for each later line. Offsets are UTF-16 code units, as `extra_quotes.rs::utf16_at` already computes for the web. Psalm titles: a level 4 "title" line at offset 0, so verse 1 of Psalm 51 shows its title on its own quiet line.
- Cost (measured with this encoding): 119,368 bytes raw over all 55 books, 31,408 gzipped. Psalms +27,411 raw (+1.3% on a 2,162,131-byte shard) and +5,462 gzipped (+0.9% on 628,892); Isaiah +21,756 / +5,444; Job +9,636 / +1,731; Proverbs +8,376 / +1,450.
- `atlas verify` pins: Psalm 1:1 has 4 lines at 0, 18, 66, 102; Psalm 136 has a refrain line in every verse; Proverbs 10:1 has 2 lines; Genesis 1:1 has none; Psalm 51:1 has a title line; more than 8,000 verses in lines.

### 3.2 Web

- `data/text.ts`: `BookText` gains an optional `poetry`, turned into a `Map<verseInBook, lines>` once per book.
- `ui/Reader.tsx` line 211 draws `english` as one string. In BSB mode it would draw one block per line, indented by level (a `\q2` line one step in, a refrain set to the right, a stanza gap before a `\b` verse), with the verse number on the first line. NET and ESV text (`liveVerses`) stay prose: the lines belong to the BSB.
- `ui/Pairs.tsx` `PairedEnglish` (word by word with color pairs) splits `englishParts(text)` at the same offsets, so color pairs still work line by line.
- Study and Deep, Hebrew and Greek: where the cola split cleanly (2.4), the original words under the verse break into the same lines, so a reader sees each Hebrew line under its English line. Elsewhere the original line stays whole.
- The search text (`bsb.txt`), word alignment and every quotation check are untouched, because the English string itself does not change.

---

## 4. One-verse devices as Layers kinds

### 4.1 Kinds and fields

`layers.rs` has a fixed `KINDS` list (line 52) and `deny_unknown_fields` on every spec, so new kinds and fields are deliberate code changes in three places: `layers.rs` (`KINDS`, `NEEDS_INTERPRETER` at line 50), `web/src/data/layers.ts` (types) and `web/src/ui/Layers.tsx` (`KIND_LABEL`, `KIND_ABOUT`). Two kinds keep the list short:

| Kind | Extra field (checked against a fixed list) | Label and the one-line "about" in plain English |
| --- | --- | --- |
| `parallelism` | `form`: `restated`, `opposite`, `building`, `climax` (the founder's own four) and optionally `lines`: the quoted words of each line it pairs | "Parallel lines": "The second line says the first again, or turns it, or carries it further" |
| `figure` | `figure`: `anthropomorphism`, `anthropopathism`, `personification`, `merism`, `hyperbole`, `metaphor`, `simile`, and any later one added to the list on purpose | "Figure of speech": "Words not meant literally, used to say something true more strongly" |

Both go in `NEEDS_INTERPRETER`: a word book alone cannot carry them.

### 4.2 Checks, reused and tightened

Everything in `layers.rs` applies as is: references resolve (`range`, line 362), every quotation of 4 or more words is in the BSB of the passage or its refs (`contains`, line 585, through `quotes`, line 604), words name roots that occur in the verse (`root_hits`, line 523), cites come from the cite list with an interpreter for these kinds (`cites`, line 293), the avoid list and the ESV ban apply everywhere, text at most 300 characters, evidence at most 400. Three additions:

1. **Lines are checked against the BSB's own lines.** A `parallelism` note's `lines` quotes must each fall inside one poetry line of that verse (from 3.1), and two quotes must fall in two different lines. This needs the poetry data before `layers::build` runs in `build.rs` (line 347), which is a reordering, not a new source.
2. **Short quotes are checked too.** Layers skips quotes under 4 words (`QUOTE_MIN_WORDS`, line 61) because they are glosses. A device often rests on one or two words ("His arm", "heavens and earth"), so for these two kinds every quoted span is checked, whatever its length.
3. **Strength is counted, not typed.** The rule is the number of writers who state the point (3 or more widely agreed, 2 commonly held, 1 some interpreters), but `layers.rs` only checks the label against a list; the content map found 17 round 1 notes marked "widely agreed" with one interpreter. For the new kinds the build should count distinct cited interpreter sources and fail when the label claims more. (It could do the same for every kind; that is a separate decision.)

Mechanical support from pinned data:

- **Nave's for anthropomorphism.** `naves::read` (naves.rs line 327) already parses the pinned CSV. Add `naves` to `config/layer-sources.json` as a `reference` (it can never carry a note alone, since these kinds need an interpreter), and have the build check that a cite of Nave's on a verse names a verse Nave lists under ANTHROPOMORPHISMS, and which sub-heading.
- **Bullinger by verse.** The Companion Bible's notes name the figure at each verse ("Figure of speech Anthropopatheia. App-6", as on StudyLight and in the copy of Isaiah notes at github.com/kckern/IsaiahExplorer `public/com/bullinger.*.json`, which has no license file). If a full public-domain text of the Companion Bible notes, or of *Figures of Speech*, is mirrored to a branch the way `.github/workflows/mirror-meaning-model.yml` mirrors the meaning model, then the build can check, as `eras.rs` does for Tyndale, that Bullinger names that figure at that verse. Earlier rounds used local copies that are not on GitHub (map-content section 12).

### 4.3 The line under the verse

A new extra, say `figures.extra.tsx` (order 36, just after Wordplay at 35), reads `layers.json` exactly as `wordplay/model.ts` does (`load()` does all the work; `note()` is one `Map.get`) and shows one quiet line:

- "God described in human terms: His arm" (Isaiah 53:1)
- "Opposites that mean everything: the heavens and the earth" (Genesis 1:1)
- "Two lines, one thought" or "Two lines, opposite thoughts" (a `parallelism` note)

The panel shows the verse in its lines with the quoted words lit, the note, and at Deep the evidence and sources (the same pieces `LayerItem` uses).

### 4.4 Weight

Every note added to `layers.json` is downloaded at boot: about 924 bytes raw and about 200 bytes gzipped per note (626,287 / 2,861,616 = 0.22). 1,000 device notes would add about 0.9 MB raw and 200 KB gzipped to every visit. Either keep the counts modest, or split `layers.json` so the boot download holds only what the reader's "Layers ›" marks need (passage verses and kinds) and the note text loads on the first selected verse, the way extras wait for `readerHere()`.

---

## 5. Multi-verse structures and foils: the `structure` extra

### 5.1 Config

`config/structures.json`, one entry per structure, written like `config/parallels.json` (references with OSIS book ids) and cited like Layers. Shapes (the wording below is checked BSB text, but the entries are examples of the format, not drafted content):

```json
{ "id": "psalm-8-bookends", "kind": "inclusio", "ref": "Ps 8:1-9",
  "members": [
    { "label": "A",  "ref": "Ps 8:1", "words": "O LORD, our Lord, how majestic is Your name in all the earth" },
    { "label": "A'", "ref": "Ps 8:9", "words": "O LORD, our Lord, how majestic is Your name in all the earth" } ],
  "text": "...", "evidence": "...", "cites": [ { "source": "...", "on": "Psalm 8:9" } ] }

{ "id": "pharisee-and-tax-collector", "kind": "foil", "ref": "Luke 18:9-14",
  "sides": [
    { "who": "Pharisee",      "refs": ["Luke 18:11-12"], "words": ["stood by himself"] },
    { "who": "tax collector", "refs": ["Luke 18:13"],    "words": ["stood at a distance"] } ],
  "text": "...", "cites": [ ... ] }
```

Kinds: `chiasm` (members A, B, ..., X, ..., B', A'), `inclusio` (A and A' only), `alternation` (A B A' B', as in 1 Samuel 2:11-26 where Samuel and Eli's sons take turns), `refrain`, `foil`. A foil's sides may hold several ranges (Judas: Matthew 26:14-16 and 27:3-5; Peter: 26:69-75), across chapters (Saul and David) or within one verse pair (Genesis 4:4-5).

### 5.2 Build checks (`extra_structure.rs`)

| Check | Reused from |
| --- | --- |
| Every reference parses and is a BSB verse; members sit inside the structure's `ref`, in order, without overlapping | `layers.rs::range` (line 362), `extra_parallels.rs::passage` and `overlaps` (lines 112-119) |
| Labels mirror: label i and label n-1-i are the same letter, primed on the way out; at most one unpaired centre (or a stated double centre) | new, about 20 lines, in the style of `extra_wordplay.rs::parts` |
| Every quoted word, of any length, is word for word in the BSB text of **its own member** (not just somewhere in the passage) | `layers.rs::normalize`, `parts`, `contains` (lines 554-603) |
| Each pair is tied by something a reader can see: a quoted word in both members, or a named Hebrew or Greek root that occurs in both | `layers.rs::root_hits` (line 523); for a foil, also `who` must be named in the BSB text of its side |
| The share of roots and English words each pair (and each pair of foil sides) has in common is measured and shipped for Deep, and a pair that shares nothing fails | `extra_parallels.rs::english`, `stem`, `weights`, `root_share`, `word_share` (lines 341-436) and its `STOP` list |
| Foil sides lined up verse by verse for the two-column panel | `extra_parallels.rs::align` (line 438) |
| Every cite on the cite list, an interpreter present, nothing from the avoid list, no ESV, short text and evidence | `layers.rs::cites`, `avoid`, `mentions_esv`, `too_long`, `check_sources` |
| Strength equals the count of distinct interpreters cited | new (4.2, point 3) |
| A pinned source's own words checked word for word, if one is mirrored | `eras.rs` (its quotation checks) |

The `layers.rs` checks are private methods of a private `Check` struct whose `fail()` hard-codes `config/layers.json` in every message (line 277), and the parallels helpers are private functions. Reusing them means moving them into a shared `checks.rs` (`pub(crate)`, the config path a parameter). That is a refactor of existing modules, larger than the "five one-line insertions" the extras README allows an extra on its own; it should be its own small change, with the existing 218 tests as the guard.

Wiring: one `mod` line in `main.rs`, one `build` line in `build.rs` (after `extra_parallels`, line 455), one `verify` line in `verify.rs`. `verify` pins: the Psalm 8 bookends found at 8:1 and 8:9, every pair's tie found, the number of structures.

### 5.3 Output and weight

- `extras/structure.json`: the index the line needs, loaded with the first selected verse (after `readerHere`): per structure `[kind, from, to, member bounds...]`. For scale, `extras/parallels.json` holds 307 sets in 9,639 bytes; 300 structures with member bounds would be about 15 to 20 KB raw, about 5 KB gzipped.
- `extras/structure/<Book>.json`: text, evidence, cites, quoted words, pair shares and foil rows, loaded when the panel opens (parallels' per-book files are 1.5 KB for Genesis and 2.0 KB for Psalms; with notes and cites, about 1 KB per structure).
- The panel's code is a lazy chunk, as in Parallels and Wordplay.

### 5.4 Web

- `structure.extra.tsx`, order about 38. `note()`: "A mirror pattern: Genesis 6:10–9:19" (under every verse of the structure, naming its centre on the centre verse), "Set side by side: Hannah and Peninnah". `chapterNote()` for a structure that is a whole chapter or psalm: "Psalm 8 opens and closes with the same words", as the alphabet poems do.
- Panel, a **ladder**: one row per member, indented one step per level toward the centre and back out, each with its BSB words and the tying words lit; above it a strip in the map's language, made like `NightStrip` (`Roads.tsx` line 279): the night-sky gradient, the passage's verses along the baseline, A to A' as the outer arc, B to B' inside it, the centre marked, drawn with `arcPath` and `arcHeight` from `gl/layout.ts` so the arcs nest the way the big map's do. Indentation is capped (four steps) and the strip spans the panel, so it holds at a 375 px phone width.
- Foils: two columns with rows lined up and shared words underlined, which is `parallels/Compare.tsx` (exported `Compare` and `useTexts`). Importing it from another extra's folder works with Vite; the cleaner route is to move `Compare` and `parallels/words.ts` into the spine's `kit`, which is a spine edit the README reserves for a deliberate change.
- Map: `mapKinds.ts` gains `mirror` (from a member to its partner) and `foil` (from one side to the other) beside `quote`, `echo` and `parallel`, and `colors.ts` `KIND` one or two colors. They show only after the line's data has loaded, as now, so the map still never fetches.

---

## 6. What shows at Simple, Study and Deep

| | Simple | Study | Deep |
| --- | --- | --- | --- |
| Poetry lines (BSB) | The verse in its lines, as the BSB prints it; psalm titles on their own line; refrains set right; stanza gaps | Same; the Hebrew or Greek under the English, split into the same lines where the alignment allows (86% of tested verses) | Same, plus words from other editions as today |
| One-verse devices (Layers kinds) | One quiet line under the verse ("God described in human terms: His arm"); in the Layers card, the lead note only, as now | Every note with its strength and its Hebrew or Greek word chips; a parallelism note shows the verse's lines with the paired words lit | The evidence, the sources with links (Bullinger's figure name in his own term, Nave's sub-heading), "Suggest a correction" |
| Structures | One line under the verses ("A mirror pattern: ...") or under the chapter heading; the panel's ladder and arc strip with a one-sentence lead | Each member's BSB text in the ladder, tying words underlined, strength; foils in two columns; `mirror` and `foil` arcs on the map from the selected verse | The Hebrew or Greek of each member with shared roots marked, the measured share per pair, evidence, sources, how it was checked |

The existing rule holds: Simple is one plain line, Study is the texts side by side, Deep adds the original words, the data and the sources (`web/src/ui/extras/level.ts`).

---

## 7. Page weight, together

| Piece | Raw | Gzipped | When it loads |
| --- | --- | --- | --- |
| Poetry lines, all 55 books | 119 KB | 31 KB | inside each book's text shard (Psalms +27 KB / +5.5 KB) |
| Device notes in `layers.json` | about 924 B per note | about 200 B per note | at boot, today (see 4.4) |
| `extras/structure.json` index (300 structures) | about 15 to 20 KB | about 5 KB | first selected verse |
| `extras/structure/<Book>.json` | about 1 KB per structure | | when the panel opens |
| Panel code | small lazy chunks | | when a panel opens |

For comparison: `layers.json` 2,861,616 bytes (626,287 gzipped), `text/Ps.json` 2,162,131 (628,892), `extras/wordplay.json` 7,168, `extras/parallels.json` 9,639.

---

## 8. Risks and open points

1. **The USFM is not the text the app shows.** 243 poetry verses differ (116 by titles, 127 by wording), Psalm 106:42 and Lamentations 2:1 are broken in the pinned USFM, and 21 verses cannot be placed under the strict rule. The build must always place lines onto BSB.json and drop what does not fit.
2. **Psalm titles change verse 1.** BSB.json joins 116 psalm titles to verse 1, so "Psalm 8:1" in the app begins "For the choirmaster. According to Gittith. A Psalm of David." Setting the title on its own line is a visible change in 116 places.
3. **A chiasm is one writer's layout.** Writers who see a mirror in the same passage often letter it differently or put the centre elsewhere. Storing one layout "as laid out by" its writer, and counting strength as the number of writers who state that the passage is a mirror with that centre, keeps the strength honest; counting writers who agree on every letter would leave very few structures.
4. **Sources for structures.** Public-domain (1930 or earlier) Bible-believing writers on structure include Bullinger (*Figures of Speech* 1898, the Companion Bible 1909-1922, whose structures are printed outlines; the StudyLight copy of its Genesis 4 notes, fetched in an earlier round, points to "Structure, p. 5" instead of giving it) and the older Anglican writers on parallelism and introversion (Lowth's lectures, Jebb, Boys, Forbes). None is on GitHub in a usable form that this search found, so each would be mirrored to a branch and pinned. Modern evangelical writers on structure would be cited and linked only, never quoted at length, as the 48 Layers notes that cite modern copyrighted works do today.
5. **Spine edits.** Poetry lines change `Reader.tsx`, `Pairs.tsx` and `data/text.ts` (core files, not an extra); sharing the Layers and Parallels checks needs a refactor of `layers.rs` and `extra_parallels.rs`; sharing `Compare` needs a spine edit or a cross-extra import. None of this is large, but it is more than the extras recipe's "change no other file".
6. **Shelf credit.** `shelf.rs` counts citations only from `config/aramaic.json` and `config/hard-verses.json`, so new works cited here (Nave's for this purpose, Lowth, Jebb) will not show their counts on the Sources shelf unless `shelf.rs` also reads the new config.
7. **No web tests.** The TypeScript has no unit tests beyond `tsc`; the line-drawing in the reader is the kind of change that needs a careful look at phone width in both themes and in word-by-word mode.
