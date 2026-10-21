# Bible Atlas: architecture and code map

Repository: github.com/Sixteen1-6/BibleAtlas, read at `main` = `a46d819` (merge of PR #46, 2026-10-20). Live at https://everyversemap.com/ (GitHub Pages, custom domain from `web/public/CNAME`).

Method: static reading of every source file plus `git log`/`git show` for other branches, and a local snapshot of the PR bodies (`prs.json`) for intent. The data pipeline was not run (`atlas fetch` downloads the pinned sources) and the site was not built. The Rust side was compiled offline on the founder's PC with the target directory in a local job's scratch folder (the repository stayed clean): `cargo test --workspace --offline --locked` passed 218 of 218 (CLI 199, core 18, wasm 1) and `cargo clippy --workspace --release --offline --locked -- -D warnings` passed, on rustc 1.99.0 (x86_64-pc-windows-msvc). Only that host target is installed, so `make wasm` would first need `rustup target add wasm32-unknown-unknown`, and `dlmalloc 0.2.14` (wasm-only dependency) is not in the local cargo cache. All counts below are measured from the tree unless marked "from a PR body". Line numbers are for `a46d819`.

---

## 1. The whole system in one picture

```
sources.json  (27 sources, 17 distinct repo@commit checkouts, every file SHA-256 locked)
   |  atlas fetch   crates/atlas-cli/src/fetch.rs   (system git: sparse, depth-1, blob:none; curl for Git LFS)
   v
data/raw/<repo>@<commit10>/...  +  data/raw/manifest.lock.json        (gitignored)
   |  atlas build   crates/atlas-cli/src/build.rs   (reads config/*.json too; refuses on any hash mismatch)
   v
web/public/data/   atlas.bin + meta.json + thousands of JSON/TXT shards   (gitignored)
   |  atlas verify  crates/atlas-cli/src/verify.rs  (checksums of every file + fact checks; 5,909 checks per PR #46)
   |  web prebuild  web/scripts/ask-meaning.mjs     (trains ask/meaning.json from the build output + config/ask-examples.json)
   |  scripts/build-wasm.sh  -> web/src/engine/atlas.wasm (atlas-core compiled for wasm32, gitignored)
   v
web/  Preact + signals + TypeScript, Vite build -> web/dist
      main thread: WebGL2 arc field, SVG overlay, panels
      Web Worker 1: atlas.wasm graph engine (paths, roads, neighborhoods, links-within, reference parsing)
      Web Worker 2: KJV/ASV search indexing (data/extra.worker.ts)
      Service worker: public/sw.js (offline copy, versioned caches)
   |
   +-- GitHub Pages (pages.yml, VITE_ESV=off, --base=/)
   +-- or server/serve.mjs (web/dist + /api/esv proxy with ESV_API_KEY)
```

The key design idea (README.md "The data model", crates/atlas-core/src/lib.rs:12-16): it is indexed like a code-intelligence index. Every verse is a dense `u32` (Genesis 1:1 = 0, Revelation 22:21 = 31,101), every original-language word is (verse, position), every Hebrew/Aramaic/Greek root is a dense `u32`, cross-references are a CSR adjacency, and root occurrences are an inverted index. The same Rust crate (`atlas-core`) writes the binary at build time and reads it at run time inside WebAssembly, so the format cannot drift.

## 2. Top-level layout

| Path | What it is |
| --- | --- |
| `Cargo.toml` | Workspace: `crates/atlas-core`, `crates/atlas-cli`, `crates/atlas-wasm`; edition 2021, `rust-version = "1.88"`; `[profile.release]` LTO, 1 codegen unit, `panic = "abort"`; `[profile.wasm]` inherits release with `opt-level = "s"`, `strip = true` |
| `Makefile` | 11 targets (section 8) |
| `sources.json` | The pinned external datasets (section 4.1). 474 lines, 47 KB |
| `config/` | 12 hand-made JSON tables, 11.3 MB in all (section 4.2) |
| `crates/` | Rust: core 1,594 lines in 6 files, CLI 36,838 lines in 32 files, wasm 296 lines |
| `web/` | The site: 120 `.ts`/`.tsx` files (27,535 lines), 25 CSS files (6,720 lines) under `web/src`; `web/public` static files; `web/scripts/ask-meaning.mjs` |
| `server/` | `esv.mjs` (ESV proxy, 107 lines), `serve.mjs` (production static server, 44 lines) |
| `scripts/build-wasm.sh` | The only repo-level script (26 lines) |
| `.github/workflows/` | `ci.yml` (45 lines), `pages.yml` (74 lines) |
| `docs/` | Only screenshots and `tour.gif` used by README.md |
| `README.md`, `NOTICE.md`, `IDEAS.md`, `LICENSE` | Project front page, data licenses and credits (26.8 KB), idea list, MIT |
| `.gitignore` | Ignores `/target`, `/data/raw`, `/web/public/data`, `/web/src/engine/atlas.wasm`, `/web/dist`, `/web/node_modules`, `.env`, `web/.env` |

## 3. The Rust workspace

### 3.1 `crates/atlas-core` (no_std, no dependencies)

`crates/atlas-core/Cargo.toml` has an empty `[dependencies]`. `src/lib.rs:17` is `#![no_std]` with `alloc`.

| Module | Lines | What it holds |
| --- | --- | --- |
| `canon.rs` | 158 | The 66 books (`BOOKS`, line 61) with OSIS, STEPBible and alias names, `Testament`, `Genre` (genre keys used by the map's Genre colors), `by_osis`, `by_step`, `FIRST_NT_BOOK = 39` (line 139) |
| `versification.rs` | 158 | Dense verse numbering from two prefix-sum arrays (`book_chapter_start`, `chapter_start`): `index`, `locate`, `chapter_of`, `verses_in` |
| `container.rs` | 259 | The `.atlas` binary container (section 3.2): `Container::parse` (zero-copy reader that validates magic, version, 8-byte alignment and bounds, lines 103-128) and `ContainerWriter` (lines 161-220) |
| `graph.rs` | 638 | `XrefGraph` (CSR of every cross-reference, edges per verse sorted strongest first, line 18), `RawEdge`, `build` (dedupe keeps highest vote, line 42), `validate`, `pagerank` (line 115), `links_within` (line 152), `book_flow` (line 170); `Adjacency` (undirected view of positively voted edges, line 186), `hop_cost` (1000 + 3000/(1+log2 votes), line 198), `shortest_path` (Dijkstra, line 259), `roads` (up to k vertex-disjoint paths, line 274), `neighborhood` (BFS strongest first, line 360) |
| `refs.rs` | 351 | Parses references as people type them ("jn 3:16", "II Kings 2:11", "Song of Songs 2"), fuzzy book names by edit distance, `parse` (line 213), `resolve` to a verse range (line 244) |
| `lib.rs` | 30 | Re-exports |

### 3.2 The `atlas.bin` container

Format (crates/atlas-core/src/container.rs:3-17): magic `ATLS`, `u32` version (= 1), section count, reserved; then 32-byte records (16-byte ASCII name, dtype, element count, byte offset, reserved); payloads each 8-byte aligned. Dtypes: u8=0, u16=1, u32=2, i16=3, f32=4, i32=5 (i32 is defined but no section uses it).

Sections written by crates/atlas-cli/src/build.rs:373-389 (15 sections):

| Section | Type | Content | Read by |
| --- | --- | --- | --- |
| `vz_bchap` | u32 | first chapter index of each book (67) | wasm `load`, CLI `Loaded`, web `bookChapterStart` |
| `vz_chap` | u32 | first verse of each chapter (1,190) | wasm, CLI, web `chapterStart` |
| `v_book` | u8 | book of each verse | web `verseBook` |
| `v_rank` | f32 | PageRank normalized so top = 1 (damping 0.85, 40 iterations, build.rs:41-42) | web "Top verses", threads, search ranking; verify checks range |
| `v_degree` | u32 | positive-vote degree per verse | web; Ask build ties |
| `x_off`, `x_dst`, `x_span`, `x_votes` | u32, u32, u16, i16 | the cross-reference CSR | wasm, CLI, web map and panels |
| `b_flow` | u32 | 66x66 book-to-book link counts | web Wheel (`ui/WheelCards.tsx`) |
| `l_off`, `l_verse`, `l_pos` | u32, u32, u16 | root postings: every place each root occurs | web word study, themes, echoes, Ask; verify samples about 4,000 postings |
| `e_off`, `e_verse` | u32, u32 | English word -> verses index over BSB (vocabulary in `words.json`) | web `data/search.ts` |

The web maps every section straight onto a typed array (`web/src/data/atlas.ts:162-187`, `readContainer`), then derives `xSrc` and a reverse CSR (`xInOff`, `xInEdge`) in `loadAtlas` (lines 200-259). The TypeScript reader does not re-check alignment or bounds the way the Rust one does.

### 3.3 `crates/atlas-wasm` (the browser engine)

`src/lib.rs` (296 lines): no wasm-bindgen; plain `extern "C"` functions over linear memory, `dlmalloc` as the allocator on wasm32, a one-instance `Global` state (`UnsafeCell`, sound because one worker calls it sequentially, lines 39-46). The state holds only `Versification`, `XrefGraph` and `Adjacency` (it loads 6 of the 15 sections, lines 86-101).

Exports: memory helpers `atlas_alloc`, `atlas_free`, `atlas_out_ptr`, `atlas_out_len`; `atlas_load` (returns verse count or -2); queries `atlas_path` (line 120), `atlas_paths` (roads, line 142), `atlas_near` (line 164), `atlas_links_within` (mask of verses, line 183), `atlas_parse_ref` (line 198). Errors: -1 not loaded, -2 bad data, -3 not found, -4 bad input. One native test (`ffi_round_trip`) drives the exact FFI surface.

Built by `scripts/build-wasm.sh`: `cargo build -p atlas-wasm --lib --target wasm32-unknown-unknown --profile wasm`, copied to `web/src/engine/atlas.wasm`. `ATLAS_BUILD_STD=1` is an offline fallback that rebuilds core/alloc from rust-src.

### 3.4 `crates/atlas-cli` (the `atlas` binary)

Dependencies: `atlas-core`, `serde`, `serde_json`, `sha2` only (`crates/atlas-cli/Cargo.toml`). The extras recipe forbids adding crates (web/src/ui/extras/README.md "Add no new crates").

Commands (crates/atlas-cli/src/main.rs:71-90). The binary finds the repo root by walking up to the nearest `sources.json` (line 49), so it must run from inside the repo.

| Command | Module | What it does |
| --- | --- | --- |
| `atlas fetch` | `fetch.rs` | One sparse, depth-1, `--filter=blob:none` git checkout per (repo, commit) into `data/raw/<repo>@<commit10>`; Git LFS pointers replaced via `curl` from media.githubusercontent.com with SHA-256 check and an `.git/lfs-cache`; writes `data/raw/manifest.lock.json` |
| `atlas build` | `build.rs` | Raw sources + config -> `web/public/data` (section 3.5) |
| `atlas verify` | `verify.rs` | Checks the output (section 3.7) |
| `atlas query xref|path|roads|near|word` | `query.rs` | Terminal graph queries (`roads` takes `--min-votes`, `--k`; `xref` takes `--top`). README lists four; `roads` is undocumented there |
| `atlas themes-review [--group] [--theme] [--samples]` | `themes_review.rs` | Review sheet for themes, read from built data, seeded samples |

Global options: `--raw <dir>` (default `data/raw`), `--out <dir>` (default `web/public/data`). Environment: `ATLAS_LAYER_DRAFTS=1` (layers.rs:181) and `ATLAS_HARD_VERSE_DRAFTS=1` (extra_hard_verses.rs:283, 423) publish unreviewed drafts; no workflow sets either (PR #5).

### 3.5 The build, step by step (`build.rs::run`, lines 98-561)

1. `Inputs::open` (sources.rs:95-118): every source in `sources.json` must be in the lock with the same commit and every locked file must match its SHA-256, else the build stops.
2. BSB text and the verse numbering (`parse::bsb`, line 104). The BSB defines the 31,102-verse numbering everything else is mapped onto.
3. Cross-references (`parse::xrefs`, line 112) -> `XrefGraph::build` + `validate`.
4. Original words: `parse::tahot` (Hebrew/Aramaic, 4 files) and `parse::tagnt` (Greek, 2 files), lines 118-131, with tallies of unmapped rows.
5. Word alignment (`align::build`, lines 134-152) from Clear-Bible/Alignments, matched by LCS on both ends; shifted links dropped.
6. Lexicons TBESH and TBESG (lines 154-164); root table with sense-borrowing rules (lines 166-222).
7. Root postings (inverted index, lines 224-252), PageRank, degree, book flow (lines 254-267), English index (`english::build`, line 270).
8. Word families from Strong's derivations (`family.rs`, lines 272-308).
9. Themes (`themes::build`, lines 310-343) and layers of meaning (`layers::build`, lines 345-347).
10. Writes: `text/`, `lex/`, `dict/` are deleted first (lines 350-355); then quotes, `atlas.bin`, real-map, peshitta, translations, world, `lemmas.json` (with Aramaic `origin` map), wordplay, `words.json`, `bsb.txt`, notes, voices, `themes.json`, hard verses, `layers.json`, Ask, Nave's, per-book `text/<Book>.json`, parallels, Aramaic, eras, shelf + dictionaries, `lex/<n>.json` (500 roots per shard), `forms/<n>.json`, `lxx.json` (lines 357-479).
11. Every write goes through `write()` (lines 59-67), which records bytes and SHA-256 in `meta.json.files`. Build id = first 12 hex of SHA-256 over every output hash (lines 481-483), so identical inputs give an identical id.
12. `meta.json` (lines 519-545): counts, unmapped tallies, alignment stats, PageRank params, `lexShard`, word flags (aramaic 1, otherEditionsOnly 2, variant 4, significant 8), books, sources with locked file hashes, container sections, files, plus theme fields merged from `themes.meta`.

Every extra module follows one plugin shape: `build(...) -> Result<Vec<(String, Vec<u8>)>, String>` and `verify(&Loaded) -> Result<Vec<(bool, String)>, String>`; `run()` writes the returned files through `write()`.

### 3.6 CLI module map

| Module | Lines | Reads (sources.json id / config) | Writes under web/public/data | verify? | #[test] |
| --- | --- | --- | --- | --- | --- |
| `main.rs` | 90 | | | | 0 |
| `sources.rs` | 130 | `sources.json`, lock | | | 0 |
| `fetch.rs` | 145 | `sources.json` | `data/raw/**`, lock | | 1 |
| `parse.rs` | 757 | `bsb`, `openbible-xref`, `tahot`, `tagnt`, `tbesh`, `tbesg` | | | 2 |
| `align.rs` | 659 | `clear-align` (6 files) | aligned rows inside `text/<Book>.json` | in verify.rs:147-192 | 3 |
| `english.rs` | 72 | BSB text | `e_off`/`e_verse`, `words.json`, `bsb.txt` | | 1 |
| `lexhtml.rs` | 143 | lexicon HTML | safe segments `[text, style, verse]` in `lex/` | | 1 |
| `family.rs` | 1,506 | `strongs` (greek, hebrew) | `forms/<n>.json` | via themes | 7 |
| `themes.rs` | 1,435 | `config/themes.json`, `config/theme-related.json` | `themes.json`, theme fields of `meta.json` | yes | 9 |
| `themes_review.rs` | 295 | built data | stdout | | 0 |
| `layers.rs` | 763 | `config/layers.json`, `config/layer-sources.json` | `layers.json` | checksum only | 10 |
| `lxx.rs` | 758 | TBESG notes + TBESH | `lxx.json` | in verify.rs:201-283 | 9 |
| `eras.rs` | 2,668 | `tyndale-tbd`, `config/eras.json` | `eras.json` | yes | 15 |
| `extra_quotes.rs` | 2,605 | `bsb-usfm`, `macula-hebrew`, `tbesg`, `tbesh` | `extras/quotes.json`, `extras/quotes/notes.json` | yes | 12 |
| `extra_parallels.rs` | 1,260 | `bsb-usfm`, `config/parallels.json` | `extras/parallels.json`, `extras/parallels/<Book>.json` | yes | 7 |
| `extra_real_map.rs` | 4,561 | `openbible-geo`, `openbible-shapes`, `theographic`, `natural-earth` | `extras/real-map.json`, `extras/real-map/{places,base,people,events,shapes}.json` | yes | 18 |
| `extra_aramaic.rs` | 1,417 | `bsb-usfm`, TAHOT/TAGNT words, `config/aramaic.json` | `extras/aramaic.json`, `extras/aramaic/deep.json`, `origin` in `lemmas.json` | yes | 1 |
| `extra_peshitta.rs` | 1,049 | `dsc-peshitta` | `extras/peshitta.json`, `extras/peshitta/<Book>.json` | yes | 6 |
| `extra_notes.rs` | 689 | `aquifer-osn` | `extras/notes.json`, `extras/notes/<Book>.json` | yes | 2 |
| `extra_voices.rs` | 1,446 | `catena-aurea`, `henry-concise`, `wesley-notes`, `kjv` | `extras/voices.json`, `extras/voices/<Book>.<k>.json` | yes | 9 |
| `extra_wordplay.rs` | 392 | TAHOT words | `extras/wordplay.json` | yes | 2 |
| `extra_hard_verses.rs` | 556 | `config/hard-verses.json` | `extras/hard-verses.json`, `extras/hard-verses/cards.json` | yes | 3 |
| `extra_dictionary.rs` | 370 | dictionaries from `shelf.rs` | `extras/dictionary.json`, `extras/dictionary/<book>.json` | yes | 2 |
| `extra_translations.rs` | 93 | `kjv`, `asv` | `search/kjv.txt`, `search/asv.txt` | checksum only | 1 |
| `shelf.rs` | 2,494 | `config/shelf.json`, `config/aramaic.json`, `config/hard-verses.json`, `easton`, `smith`, sources.json | `shelf.json`, `dict/<id>/index.json`, `dict/<id>/<letter>.json` | yes | 17 |
| `naves.rs` | 1,282 | `naves`, `theographic`, `openbible-geo`, `kjv`, `config/naves-display.json` | `naves/<Book>.json` | yes | 12 |
| `ask.rs` | 1,190 | `config/questions.json`, `config/ask-examples.json` (validated only), Nave's, quotes | `ask/index.json`, `ask/also.json`, `ask/signals.json`, `ask/q/<id>.json`, `ask/topics/<n>.json` | yes | 7 |
| `world.rs` | 6,897 | `tflsj`, `ubs-ffr`, `tahot` | `world/<k>.json`, `world/ubs.json`, `world/ubs/<n>.json` (2.5 MB budget) | yes | 42 |
| `loaded.rs` | 80 | built data | (reader for verify/query) | | 0 |
| `query.rs` | 155 | built data | stdout | | 0 |
| `verify.rs` | 320 | built data + config | | | 0 |

Unit tests: 218 `#[test]` functions in the workspace (core 18, wasm 1, CLI 199); all 218 pass natively on the founder's Windows PC (run offline, 2026-10-20). PR #5 recorded 140 on 2026-10-09.

### 3.7 `atlas verify`

`verify.rs::run` (lines 52-320) builds one `Report` and calls `r.check(ok, what)`:

1. Every output file in `meta.json.files` matches its SHA-256 (lines 56-60). This alone is one check per file, so the total grows with the number of shards (about 1,584 `ask/q/*.json` alone).
2. Structure: 31,102 verses, 1,189 chapters, `bsb.txt` one line per verse, CSR valid, more than 330,000 links, root postings consistent, PageRank in [0, 1] (lines 62-84).
3. About 4,000 sampled postings land on a word that really has that root (lines 86-96).
4. Independent facts: Genesis 1:1 English and בראשית with 7 words, John 3:16 begins Οὕτως, John 1:1 has λόγος three times, Daniel 2:5 Aramaic and 1:1 Hebrew, every book's 1:1 has original words, 2 Corinthians 13:13/14 split, no verse without original words, אֱלֹהִים over 2,000 times, Genesis 1:1 has 10 or more links (lines 105-145).
5. Alignment pins: John 3:16 "loved" = ἠγάπησεν, Isaiah 5:30 "sea" = יָם, six "never land on the wrong word" pins, Daniel 12:5 two "bank"s, over 30,000 aligned verses (lines 147-192).
6. Gen 3:15 to Rev 12:9 path of 6 verses or fewer (lines 194-199).
7. Septuagint bridges: table shape, 11 must-have pairs, 4 must-not pairs, 2,000+ Greek roots, 30% or more of 8+-vote cross-testament links bridged (lines 201-283).
8. Nestle-Aland double-bracket words only in Mark 16:8-20 and John 7:53-8:11, 300 or more (lines 285-309).
9. Module verifies, in call order: notes, voices, hard verses, world, quotes, wordplay, themes, eras, real-map, peshitta, parallels, Aramaic, shelf, dictionary, Ask, Nave's (16 modules).

Measured history of the total (from PR bodies): 195 (PR #3), 784 (PR #5), 2,404 (PR #24/#25), 4,838 (PR #31), 5,244 (PR #34), 5,191 (PR #37), 5,909 (PR #46, the latest).

## 4. The data pipeline

### 4.1 `sources.json`

27 sources in 17 distinct repo@commit checkouts (`sources.json` top keys `_comment`, `sources`; schema in crates/atlas-cli/src/sources.rs:10-24: `id, title, provides, license, attribution, homepage, repo, commit, files{logical name: path}, note?`).

| id | Repo @ commit (10) | Files | Read by |
| --- | --- | --- | --- |
| `openbible-xref` | scrollmapper/bible_databases @ e1b254cef8 | 1 | build.rs:112 |
| `bsb` | scrollmapper/bible_databases @ e1b254cef8 | 1 | build.rs:104 |
| `kjv` | scrollmapper/bible_databases @ e1b254cef8 | 1 | extra_translations.rs, extra_voices.rs:947, naves.rs:537 |
| `asv` | scrollmapper/bible_databases @ e1b254cef8 | 1 | extra_translations.rs |
| `bsb-usfm` | usfm-bible/examples.bsb @ 48a9feb71f | 66 | extra_quotes.rs:47, extra_parallels.rs:38, extra_aramaic.rs:474 |
| `naves` | BradyStephenson/bible-data @ 720a8da6d2 | 1 | naves.rs:30 |
| `openbible-geo` | openbibleinfo/Bible-Geocoding-Data @ 7eb18a5ee6 | 2 | extra_real_map.rs:45, naves.rs:507 |
| `openbible-shapes` | same @ 7eb18a5ee6 | 123 | extra_real_map.rs:43 |
| `theographic` | robertrouse/theographic-bible-metadata @ cfb1c485d4 | 3 | extra_real_map.rs:46, naves.rs:480 |
| `natural-earth` | nvkelso/natural-earth-vector @ ca96624a56 | 5 | extra_real_map.rs:47 |
| `tahot` | STEPBible/STEPBible-Data @ 1f3423d424 | 4 | build.rs:121, world.rs:4066 |
| `tagnt` | same | 2 | build.rs:124 |
| `tbesh` | same | 1 | build.rs:156, extra_quotes.rs:1241 |
| `tbesg` | same | 1 | build.rs:157, extra_quotes.rs:1240 |
| `tflsj` | same | 2 | world.rs:3995 |
| `dsc-peshitta` | srophe/syriac-corpus @ 833adc148c | 27 | extra_peshitta.rs:54 |
| `tyndale-tbd` | mvh-solutions/aquiferized-tbd-english @ 1bd1bb39b6 | 27 | eras.rs:56 |
| `easton`, `smith` | neuu-org/bible-dictionary-dataset @ b8e82aa7ca | 1 each | shelf.rs:65-66 |
| `aquifer-osn` | BibleAquifer/AquiferOpenStudyNotes @ bbb3f86016 | 67 | extra_notes.rs:39 |
| `ubs-ffr` | ubsicap/ubs-open-license @ 33dcc8c671 | 3 | world.rs:4075 |
| `clear-align` | Clear-Bible/Alignments @ c99bd0ae69 | 6 | build.rs:135-141 |
| `macula-hebrew` | Clear-Bible/macula-hebrew @ 47db250bd5 | 1 | extra_quotes.rs:94 |
| `strongs` | openscriptures/strongs @ 0acd2f251c | 2 | build.rs:274-275 |
| `catena-aurea` | AlvaroBalbin/catena @ efe1bd084d | 5 | extra_voices.rs:68 |
| `henry-concise`, `wesley-notes` | LetsChurch/lets.church @ 71f6f0fc8f | 2, 1 | extra_voices.rs:69-70 |

Licenses are public domain, CC BY 4.0 or CC BY-SA 4.0 (plus "CC BY-SA" unversioned for the Strong's JSON edition, and CC0 for the Let's Church repo). The NET Bible and the ESV are deliberately not sources: they are read live, one chapter at a time, and never stored (sections 5.7 and 6).

### 4.2 `config/*.json` (hand-made tables, all validated by the build)

| File | Size | Content (measured) | Read by | Purpose |
| --- | --- | --- | --- | --- |
| `themes.json` | 92 KB | 163 themes, 10 groups, 8 featured, `links` and `near` rules | themes.rs:31 | Themes traced through specific Hebrew/Greek roots, never hand-picked verses |
| `theme-related.json` | 53 KB | 379 related words | themes.rs:32, verify via themes::verify | Labelled "related word" reasons on a verse's themes card; never adds verses |
| `layers.json` | 3.1 MB | 1,264 passages | layers.rs:43 | Layers of meaning notes; checked word for word against BSB |
| `layer-sources.json` | 21 KB | `cite` 43, `avoid` 27 | layers.rs:44 | Who a Layers note may cite (founder's rule of 2026-10-11) |
| `questions.json` | 2.6 MB | 1,584 questions | ask.rs:59 | Ask the Bible chains of Scripture (3 to 8 parts) |
| `ask-examples.json` | 5.0 MB | examples for 1,584 questions | ask.rs:60 (10 to 60 per question, ask.rs:116), web/scripts/ask-meaning.mjs:28 | Training text for the meaning matcher; never shown |
| `hard-verses.json` | 190 KB | 56 questions | extra_hard_verses.rs:29, shelf.rs:59 | "Often asked" cards; drafts gated |
| `aramaic.json` | 87 KB | 34 words, 5 sections, 46 loan roots | extra_aramaic.rs:38, shelf.rs:58 | Aramaic words line and Aramaic OT sections |
| `parallels.json` | 21 KB | 307 sets, 37 left out | extra_parallels.rs:37 | Parallel passages |
| `eras.json` | 77 KB | 17 eras, 71 ranges, 66 books, 2 charts, 1 correction | eras.rs:1556 | When events happened and books were written (Tyndale Open Bible Dictionary quotes) |
| `shelf.json` | 58 KB | 12 groups, 58 works | shelf.rs:57 | The Sources shelf cards |
| `naves-display.json` | 20 KB | hide 146, show 28, fix 14 | naves.rs:31 | Which Nave's subjects the Themes tab may name |

Web files mention these config files only in comments and in user-facing text on the Sources tab; no web code imports a config file directly. The one non-Rust reader is `web/scripts/ask-meaning.mjs` (reads `config/ask-examples.json`).

### 4.3 Output tree `web/public/data/` (producer -> web consumer)

| File(s) | Written by | Loaded by (web) | When |
| --- | --- | --- | --- |
| `meta.json` | build.rs:545 | data/atlas.ts:203 (with `?t=<now>`) | boot |
| `atlas.bin` | build.rs:373-390 | data/atlas.ts:207, engine worker (copy passed from page, engine/client.ts:48-54) | boot |
| `lemmas.json`, `words.json`, `themes.json` | build.rs:407, 409, 413 | data/atlas.ts:211-213 | boot |
| `text/<Book>.json` | build.rs:421-454 | data/text.ts:31 | first verse of a book |
| `bsb.txt` | build.rs:410 | data/plain.ts:13 | first search |
| `search/kjv.txt`, `search/asv.txt` | extra_translations.rs | data/plain.ts:48 via data/extra.worker.ts | search |
| `lex/<n>.json` | build.rs:463-475 | data/lex.ts:26 | word study |
| `forms/<n>.json` | build.rs:476-478 | data/forms.ts:27 | word study, themes |
| `lxx.json` | build.rs:479 | data/bridges.ts:34 | first cross-testament link |
| `layers.json` | build.rs:415 | data/layers.ts:73, extras/wordplay/model.ts:185 | after boot |
| `eras.json` | eras.rs | data/eras.ts:114 | chapter line |
| `naves/<Book>.json` | naves.rs | data/naves.ts:39 | Themes tab at Study |
| `shelf.json`, `dict/<id>/...` | shelf.rs | data/shelf.ts:96, 157, 166 | Sources tab, dictionary extra |
| `world/...` | world.rs | data/world.ts:80, 85, 89 | word study "Outside the Bible" |
| `ask/index.json`, `also.json`, `signals.json`, `q/<id>.json`, `topics/<n>.json` | ask.rs | ui/ask/ask.ts:116-134, ui/ask/route.ts:26 | search open, first question |
| `ask/meaning.json` | web/scripts/ask-meaning.mjs (not atlas build) | ui/ask/meaning.ts:47 | first question typed (1.7 MB gzipped per PR #43) |
| `extras/<id>.json` and `extras/<id>/...` | the extra_* modules | ui/extras/<id>/model.ts and Panel.tsx | first selected verse / panel open |

## 5. The web app (`web/`)

### 5.1 Stack and build

- `web/package.json`: dependencies `preact ^11`, `@preact/signals ^2.11`, four `@fontsource` packages; dev `vite ^8.3`, `@preact/preset-vite`, `typescript ^7`, `@types/node`. Scripts: `predev` and `prebuild` run `node scripts/ask-meaning.mjs`; `build` = `tsc --noEmit && vite build`; `typecheck`. There are no web unit tests; type-checking is the only automated check on the TypeScript.
- `web/vite.config.ts`: Preact plugin, an `esv-proxy` plugin that mounts `server/esv.mjs` at `/api/esv` in `vite dev` and `vite preview` with `ESV_API_KEY` from `web/.env`; `worker.format = 'es'`; `build.target = 'es2022'`, `assetsInlineLimit: 0` (so `atlas.wasm` stays a file).
- `web/index.html`: meta and Open Graph tags for everyversemap.com, an inline boot script and the `#boot` night sky (line 167), `#app` (line 211), module entry `/src/main.tsx`.
- `web/public/`: `sw.js` (service worker, 398 lines), `404.html` (turns typed paths like `/John.3.16` into `#v=` links, works for both a github.io subpath and the custom domain), `manifest.webmanifest`, icons, `og.jpg`, `CNAME`.

### 5.2 Boot sequence

1. `main.tsx` imports `arrival.ts` first (boot sky hand-off, service worker registration in production only, update and offline notices, `?sw=off` support switch), then fonts and `styles.css`, then renders `<ErrorBoundary><App/></ErrorBoundary>`.
2. `App.tsx:116-147`: `loadAtlas` (meta, atlas.bin, lemmas, words, themes in parallel) -> `S.atlas` -> `loadLayers` -> `new Engine(...)` -> `restoreFromHash` -> if no link and the welcome card is still shown, select Isaiah 53:5 (`FIRST_VERSE`, line 68) -> `pathFromHash` -> `syncHash` -> `followLink` (lights a linked theme, finds a linked path, opens Explore on phones) -> listens to `hashchange`.
3. Keyboard: `/` or Ctrl/Cmd+K opens the palette, Escape clears (lines 160-172).

### 5.3 State, depth and links

- `web/src/state.ts` (234 lines): all app state as `@preact/signals`. Core: `atlas`, `engine`, `selected`, `hovered`, `pointedVerse`, `pointedRoot`, `reading`, `study`, `studyKin`, `tab`, `theme`, `path`, `marks`, `groupEdges`, `minVotes` (default 8), `translation` (`BSB|NET|ESV`), `netNotes`, `mapMode`, `arcColor` (stored), `view`, `welcome` (stored), `interlinear`, `showOtherEditions`, `paletteOpen`, `mobilePane`, Sources shelf signals, `pageTheme` (stored). Helpers `selectVerse` (line 113), `clearAll`, `openSources`, `openRoot`, and a small history-step mechanism (`step`, `writeAddress`, `stepBack`, lines 173-219) so Back undoes shelf steps. localStorage keys: `atlas.arcColor`, `atlas.welcome`, `atlas.theme`, `atlas.depth` (all wrapped in try/catch).
- `web/src/depth.ts` (68 lines): `depth` signal (`simple|study|deep`, stored), `atLeast(d)`, `deepen(d)` (never steps back up), `DEPTH_INFO` sentences (line 24), `atLeast` (line 51), `deepen` (line 56) and `TAB_DEPTH` (line 61): Links and Themes at Simple, Word, Paths and Top verses at Study, Sources at Deep (Sources also opens at any level when asked, `S.sourcesAsked`).
- `web/src/url.ts` (136 lines): every view is a link. Parameters: `v` (verse) or `r` (book.chapter being read), `w`/`wv`/`wp` (word study root, verse, position), `t` (theme), `p` (path `A~B`) and `road` (2 or 3), `tab`, `src`/`read`/`term` (Sources shelf), `x` (open extra panel, from `ui/extras/open.ts`), `ask` (open question, from `ui/ask/ask.ts`). A shared link opens as deep as the view it points at.

### 5.4 Engine (WebAssembly in a worker)

- `engine/client.ts` (107 lines): `Engine` class, promise per request id, fails all pending calls if the worker errors. Methods `path`, `paths` (roads, k = 3), `near`, `linksWithin`, `parseRef`. It hands the worker a copy of the page's `atlas.bin` buffer so the file downloads once.
- `engine/engine.worker.ts` (135 lines): `WebAssembly.instantiateStreaming` of `atlas.wasm?url`, decodes the output buffer per op.
- Call sites (all six ops are used): App.tsx:99 (`path`), Roads.tsx:112-168 (`parseRef`, `paths`), Connections.tsx:121 (`near`), Palette.tsx:94 and Welcome.tsx:12 (`parseRef`), AskSheet.tsx:80, ChapterWhen.tsx:379, ThemeThread.tsx:53, WordStudy.tsx:79 (`linksWithin`, with a pure-TS fallback `linksWithinRows` in data/thread.ts:303).

### 5.5 Drawing

- `gl/arcs.ts` (1,258 lines): `ArcField`, the WebGL2 arc field. Pass 1 accumulates instanced arcs into a half-float target with additive blending, bucketed by votes (30+, 8-29, 1-7, 0 or fewer); pass 2 tone-maps (1 - exp(-k x)) over a night-sky gradient; pass 3 draws the focus (selection, path, theme thread, road) on top. Opening reveal and focus animations; none under `prefers-reduced-motion`. Pass 1 reruns only on view, size, vote filter or color mode changes. Exposes `data-drawn`, `data-anim`, `data-focus` on the canvas for tests.
- `gl/layout.ts` (75 lines): verse x-positions (books separated by `BOOK_GAP`), arc height and SVG path shared with the overlay. `gl/motion.ts` (81 lines): one rAF driver that stops when idle.
- `ui/AtlasMap.tsx` (685 lines): the map component (WebGL field + SVG overlay + influence strip), pan, zoom, hover, selection; HUD at Study (vote filter) and Deep (color modes). `ui/colors.ts`: one palette for shader, overlay, wheel and legend. `ui/mapKinds.ts`: quotation/echo/parallel links colored on the map only after the reader's own lines loaded their data. `ui/mapSlot.ts`: overlay slot used by Word sky.
- `ui/Wheel.tsx` (1,085 lines) + `ui/WheelCards.tsx`: the 66-book chord wheel from `b_flow` (Study and up, top bar "Arcs | Wheel").
- 2D canvas skies: `ui/ThemeSky.tsx` (MiniSky per theme card, ThemeHero), `ui/Roads.tsx` (one small sky per road), `ui/WordSky.tsx` (echoes; drawn on the map at Deep).

### 5.6 Screens, panels and tabs

`App.tsx:200-272` lays out: top bar (brand with live link count, search box opening the palette, `DepthControl`, translation segment BSB/NET(/ESV), page theme cycle, Arcs/Wheel at Study), the map, then `main.work` with mobile Read/Explore tabs, the `Reader`, and the study aside with tabs.

| UI | File | Lines | Notes |
| --- | --- | --- | --- |
| Reader | `ui/Reader.tsx` | 308 | Chapter text (BSB, NET via data/net.ts, ESV via data/esv.ts), original words under each verse at Study, word-by-word mode with color pairs (`ui/Pairs.tsx`, BSB only), other editions toggle at Deep, the extras lines under the selected verse (`extras/VerseExtras.tsx`), `ChapterWhen` line, `Welcome` card |
| Links tab | `ui/Connections.tsx` | 172 | A verse's links with votes, shared roots at Study, `WhyLinked` Septuagint bridges for the 5 strongest cross-testament links, `LayersCard`, `VerseThemesLine`, nearby verses via engine `near` |
| Word tab | `ui/WordStudy.tsx` | 579 | Root meaning, grammar (`data/morph.ts`), manuscript evidence (`data/variants.ts`, details at Deep), forms and family (`data/forms.ts`), distribution, occurrences, `WordSky` echoes, lazily imported `WordWorld` (LSJ and UBS) |
| Themes tab | `ui/Explore.tsx` `Themes` | 415 | Theme list by group with `MiniSky`, `ThemeJourney` thread (`ui/ThemeThread.tsx`, `data/thread.ts`), `VerseThemeCard` (`ui/VerseThemes.tsx`), Often linked with, Nave's rows at Study |
| Paths tab | `ui/Explore.tsx` `Paths` + `ui/Roads.tsx` | 518 | Up to three disjoint roads between two verses |
| Top verses tab | `ui/Explore.tsx` `Hubs` | | PageRank leaders |
| Sources tab | `ui/Sources.tsx` (lazy import, App.tsx:44-50) + `ui/Dictionary.tsx` | 417 + 322 | The shelf from `shelf.json`; Easton's and Smith's readers |
| Palette | `ui/Palette.tsx` | 176 | Reference (engine `parseRef`), English phrase (`data/search.ts`, two-stage ranking, `data/fold.ts` spelling/number folding, KJV/ASV extra text in a worker), Strong's or transliteration, Ask questions |
| Ask sheet | `ui/ask/AskSheet.tsx` | 451 | See 5.9 |
| Depth switch | `ui/Depth.tsx` | 96 | `DepthControl`, `GoDeeper` links |
| Boot error | `boot/ErrorBoundary.tsx` | 199 | Render errors replace the page; effect errors are logged and ignored |
| Pointing | `ui/pointing.ts` | 152 | `data-lv` / `data-lr` attributes light the same verse or root everywhere via one generated style rule |
| Shared bits | `ui/common.tsx` | 130 | `useVerseLoad`, `Snippet`, `OrigLine`, `RootChip`, `Distribution`, `Provenance` |

### 5.7 Data loaders (`web/src/data/`, 23 files)

`atlas.ts` (container + boot JSON + helpers like `locate`, `label`, `linkCount`, `versesWithRoot`, `langName`), `text.ts` (per-book rows `[english, words[], align?]`, word row `[surface, translit, gloss, root, morph, flags, note?]`), `align.ts`, `lex.ts`, `forms.ts`, `morph.ts`, `variants.ts`, `search.ts` (696 lines), `fold.ts` + `fold-words.ts`, `plain.ts`, `extra.worker.ts`, `themes.ts` (591 lines, the verse-themes and theme-links rule), `thread.ts` (312 lines, the gold thread rule), `echoes.ts` (pure, IDF-scored echoes), `bridges.ts` (lxx.json), `layers.ts`, `eras.ts`, `naves.ts`, `shelf.ts`, `world.ts`, `esv.ts` (two chapters max, `/api/esv`), `net.ts` (labs.bible.org, plain fetch with JSONP fallback, two chapters max, nothing stored).

### 5.8 The extras system (`web/src/ui/extras/`)

A plugin spine: any file `*.extra.tsx` in this folder is picked up by `import.meta.glob` (registry.ts:14) and validated at load (registry.ts:16-31: id = file name, numeric order, title, level, `load`, `note`, `Panel`). Contract in `types.ts` (`Extra<D>`: `id`, `order`, `title`, `level?`, `load(a)`, `note(verse, data)`, `Panel`, optional `tall`, `chapterNote`, `ChapterPanel`). Spine files: `VerseExtras.tsx` (two lines then "and N more"), `Sheet.tsx` (bottom sheet on phones, side panel on desktop), `open.ts` (`x=` link parameter and history), `data.ts` (`loadJson`/`useJson`, adds base path and `?v=<buildId>`), `kit.tsx` (Lead, SideBySide, Passage, Facts, SourceNote, Unsure), `level.ts`, `first-move.ts` (`readerHere()` delays loads until the reader's first action). Each panel is lazily imported.

The 13 extras on main (order, level):

| id | order | Title | Level | Data |
| --- | --- | --- | --- | --- |
| `quotes` | 10 | Quotations | Simple | extras/quotes.json, quotes/notes.json |
| `hard-verses` | 11 | Often asked | Simple | extras/hard-verses.json, cards.json |
| `hard-passages` | 12 | Hard passages | Deep | extras/hard-verses.json (pointers only) |
| `aramaic` | 15 | Aramaic and Hebrew | Simple | extras/aramaic.json, aramaic/deep.json |
| `parallels` | 20 | Parallel passages | Simple | extras/parallels.json, parallels/<Book>.json |
| `themes` | 25 | Themes | Simple | themes.json (already loaded) |
| `real-map` | 30 | Places | Simple, `tall` | extras/real-map.json + 5 panel files |
| `wordplay` | 35 | Wordplay | Simple | extras/wordplay.json + layers.json |
| `ask` | 40 | Ask the Bible | Simple | ask/* |
| `peshitta` | 40 | Syriac translation | Deep | extras/peshitta.json, peshitta/<Book>.json |
| `dictionary` | 50 | Old Bible dictionaries | Study | extras/dictionary.json, dictionary/<book>.json, dict/ |
| `notes` | 50 | Study notes | Simple (line widens at Study, notes.extra.tsx:64) | extras/notes.json, notes/<Book>.json |
| `voices` | 55 | Christian writers | Deep | extras/voices.json, voices/<Book>.<k>.json |

Each extra pairs with one Rust module (`extra_<name>.rs`) and optional CSS (`<id>.css`, classes prefixed `x-<id>-`).

### 5.9 Ask the Bible

- Build side: `crates/atlas-cli/src/ask.rs` checks every chain (references resolve, quoted words are word for word in the BSB, 3 to 8 parts, every part tied to the question or another part by its words, a Nave's subject, a cross-reference, a quotation or a shared root) and writes `ask/`.
- Model side: `web/scripts/ask-meaning.mjs` (209 lines) trains a softmax regression over the same tokenizer the page runs (`web/src/ui/ask/words.ts`, loaded in Node through a Vite SSR server), keyed by a hash of its inputs (skips when unchanged), fails if under 70% of examples find their own question, writes `web/public/data/ask/meaning.json`.
- Page side: `ui/ask/ask.ts` (index, link state `ask=`), `route.ts` (which prepared question a text opens), `meaning.ts` (the learned matcher; checks the question-id fingerprint), `gather.ts` (986 lines; for any other question, gathers and ranks verses from BSB text, Nave's subjects and prepared answers, no words of its own), `AskSheet.tsx` (the panel, reusing the extras Sheet frame), `ask.css`.

### 5.10 Depth levels (what each level adds)

| Simple | Study adds | Deep adds |
| --- | --- | --- |
| Map (no HUD), Reader in English, Links and Themes tabs, Simple extras, era line, welcome card | Original words under each verse, word-by-word + color pairs, Word / Paths / Top verses tabs, map HUD (vote filter), Wheel, shared roots and Septuagint bridges on links, broad Study themes, Nave's rows, dictionary extra, NET translators' notes link | Other-edition words toggle, manuscript detail in word study, map color modes, Word sky echoes drawn on the map, Sources tab, Deep extras (hard passages, Peshitta, Christian writers), evidence and citations in Layers and panels |

Gating is always `atLeast('study'|'deep')` or `levelAtLeast(...)` (the rule is written at depth.ts:13-14): 87 occurrences in 29 files outside depth.ts and level.ts (2 of them in comments), plus `deepen(...)` where opening a view implies a level (state.ts `openRoot`, url.ts).

### 5.11 Offline and caching

`public/sw.js`: navigations network-first with a 3 s timeout then the saved `index.html` (or `404.html`); `data/meta.json` network-first with 4 s; data files with `?v=<buildId>` and hashed `assets/` are cache-first; never `/api/`; same-origin GET only (so NET and labs.bible.org are never cached). Versioned caches (`atlas-shell-v1@<base>`, `atlas-data@<base>`), carried-over assets on update, a `KILL` switch (line 23) and `?sw=off`. Registered only in production (`arrival.ts:272`).

### 5.12 CSS

Global `styles.css` (1,540 lines) and `arrival.css`; feature sheets in `ui/` (`themes.css` 890, `wheel.css` 715, `shelf.css`, `when.css`, `roads.css`, `world.css`, `bridges.css`, `wordsky.css`, `ask/ask.css`) and one per extra (`extras/*.css`, `extras.css`). Colors are CSS variables with light/dark variants (`:root`, `prefers-color-scheme`, `[data-theme]`).

## 6. `server/`

- `server/esv.mjs`: `createEsvHandler({apiKey})` for `/api/esv?book=<0-65>&chapter=<n>`; one chapter per request, an LRU of at most 500 verses in memory, never written to disk, `Cache-Control: no-store`, the key only ever sent to api.esv.org. Used by `serve.mjs` and by `vite.config.ts` in dev and preview.
- `server/serve.mjs`: zero-dependency static server for `web/dist` plus `/api/esv`, gzip for text types, immutable caching except HTML and `meta.json`, unknown paths get `404.html` like GitHub Pages. Port `PORT` or 8080.

## 7. Scripts

- `scripts/build-wasm.sh`: see 3.3. Bash; runs under Git Bash or WSL.
- `web/scripts/ask-meaning.mjs`: see 5.9; runs as `predev`/`prebuild`; prints "skipped" when `public/data/ask` does not exist yet.

## 8. Makefile targets (and the commands without make)

`ATLAS := cargo run --release -q -p atlas-cli --`

| Target | Runs | Without make (the founder's PC has no make) |
| --- | --- | --- |
| `all` | `data wasm web` | the three below |
| `data` | `fetch build-data verify` | `cargo run --release -q -p atlas-cli -- fetch`, then `build`, then `verify` (needs git and curl on PATH) |
| `fetch` / `build-data` / `verify` | the three CLI commands | as above |
| `wasm` | `scripts/build-wasm.sh` | `rustup target add wasm32-unknown-unknown` once, then `bash scripts/build-wasm.sh` |
| `install` | `cd web && npm install` | same |
| `web` | install + `npm run build` | `cd web && npm install && npm run build` |
| `dev` | install + `npm run dev` (port 5173) | `cd web && npm run dev` |
| `serve` | `node server/serve.mjs` (port 8080) | broken on native Windows (risk 4); use `cd web && npm run preview` instead, which also mounts the ESV proxy |
| `test` | `cargo test --workspace`, `npm run typecheck` | same |
| `clean` | `rm -rf target web/dist web/public/data web/src/engine/atlas.wasm` | |

Of these Windows equivalents, only `cargo test` and `cargo clippy` were run (both pass); the rest were read from the code. `wasm` needs the wasm32 target, which is not installed on the founder's PC.

## 9. CI and deploy

- `.github/workflows/ci.yml`: on every push and pull request (no branch filter). One `build` job on ubuntu-latest: install stable Rust (minimal + clippy) and the wasm32 target, Node 22 with npm cache, cache `data/raw` keyed by `hashFiles('sources.json')`, then `cargo clippy --workspace --release -- -D warnings`, `cargo test --workspace --release`, `make data`, `make wasm`, `cd web && npm ci && npm run build`.
- `.github/workflows/pages.yml`: on push to `main` and manual dispatch. `build` job: same toolchain and cache, `make data` (includes verify), `make wasm`, `npm ci` and `npm run build -- --base=/` with `VITE_ESV=off`, `configure-pages`, `upload-pages-artifact` of `web/dist`; `deploy` job: `deploy-pages`. Concurrency group `pages`, cancel in progress. No clippy or cargo test here, and no dependency on ci.yml.
- Not on main: `.github/workflows/mirror-meaning-model.yml` on branch `claude/ask-the-bible-u6macl` (commit `2f40b85`, 2026-10-20). It copies `minishlab/potion-base-8M` (MIT) from Hugging Face, checks hashes, and commits it to branch `mirror/potion-base-8M` (that run already happened: `dced885`, 30,236,760-byte `model.safetensors`, plus `tokenizer.json`, `config.json`, `README.md`, `SOURCE.md`), so that `sources.json` can pin it. Nothing on main uses it yet.

## 10. Logic that exists twice (Rust and TypeScript)

Kept in step by comments and by `atlas verify` pins, not by shared code:

| Rule | Rust | TypeScript |
| --- | --- | --- |
| Container reader | atlas-core container.rs | data/atlas.ts `readContainer` |
| English tokenization for search | atlas-cli english.rs | data/search.ts |
| English word split for alignment | align.rs `english_words` (line 80) | data/align.ts `WORD` regex |
| Theme links rule | themes.rs `Links::through` | data/themes.ts (constants from `meta.themeLinks`) |
| Theme thread | (none; prototype `thread_final.py` is not in the repo) | data/thread.ts |

Reference parsing is shared for real (the wasm `atlas_parse_ref` uses atlas-core refs.rs), and the Ask tokenizer is shared for real (ask-meaning.mjs loads `ui/ask/words.ts`).

## 11. Recipes

- New extra: follow `web/src/ui/extras/README.md` (one `.extra.tsx`, optional folder and CSS, one `extra_<name>.rs` with `build`/`verify`, at most five one-line insertions in `main.rs`, `build.rs`, `verify.rs`, `sources.json`, `NOTICE.md`; plus a work in `config/shelf.json`).
- New source: add to `sources.json` with a full 40-character commit, run fetch, read it with `inputs.path(id, key)`, credit it in `NOTICE.md` and give it a `config/shelf.json` work.
- New theme: `config/themes.json` (+ optional `theme-related.json`), then `atlas build`, `atlas verify`, `atlas themes-review --theme <id>`.
- New study tab: add to `S.Tab` (state.ts:11), `TABS` (App.tsx:30) and `TAB_DEPTH` (depth.ts).

## 12. Documentation that no longer matches the code

1. README.md:18 and :127 say "192 data checks"; that figure dates from the first README (`6dad5eb`, 2026-10-07). PR #46 reports 5,909.
2. README.md:18 and :131 "61 KB" of WebAssembly, :121 "atlas.bin (8.4 MB)" and :160 "App JavaScript 85 KB (32 KB gzipped)" are from the same date and were not re-measured in later PRs; the app has since grown by many features and `ask/meaning.json` alone is 1.7 MB gzipped.
3. README.md "Query from the terminal" lists xref, path, near, word; `query roads` exists (query.rs:73).
4. `web/src/ui/extras/README.md:22` "The three extras" table lists 3; there are 13. Its anchor line numbers refer to `ultracode/ideas-spine`, not main.
5. IDEAS.md lists as future work several things that shipped: offline mode (sw.js), installable app (manifest), quotations versus allusions (extra_quotes), people and places (real-map), and part of the timeline (eras).
6. README "Quick start" says to use WSL on Windows; `make serve` is the only target that actually breaks natively (risk 4).

## 13. Risks found

1. Deploy is not gated on unit tests or clippy. `pages.yml` runs `make data` (with verify) and `tsc` through `npm run build`, but not `cargo test` or `cargo clippy`, and it does not wait for `ci.yml`. A push to main that breaks a Rust unit test still deploys if the data verifies.
2. CI uses an unpinned `stable` toolchain with `clippy -D warnings`, so a new Rust release can fail CI with no code change (PR #5 already had to fix clippy for Rust 1.99, `as_chunks`).
3. `ask/meaning.json` is outside the build's integrity chain: it is written by the web prebuild after `atlas build`, so it is not in `meta.json.files`, not checksummed by verify, and does not change the build id. It is fetched with `?v=<buildId>` (ui/extras/data.ts:17) and the service worker serves `?v=` data cache-first (public/sw.js:126-131, 145). If only `config/ask-examples.json`, `ui/ask/words.ts` or `ask-meaning.mjs` change (ask.rs only validates the examples, ask.rs:899-903), the build id stays the same and returning visitors can keep old weights indefinitely. The ids fingerprint in meaning.ts:132 catches a changed question list, not changed weights.
4. `server/serve.mjs:9` builds its root with `new URL(...).pathname`, which on Windows resolves to `C:\C:\...\web\dist` (measured with Node 24 on the founder's PC). Every request then misses, falls to a non-existent `404.html`, and `createReadStream` emits an unhandled error. `make serve` / `node server/serve.mjs` is unusable on native Windows; `fileURLToPath` would fix it. Also the `startsWith(root)` guard (line 24) admits sibling folders whose names start with `dist`.
5. `build.rs:350-355` clears only `text/`, `lex/`, `dict/`. Files a module stopped writing (for example a renamed `ask/q/<id>.json`, old `extras/*` shards) stay in a local `web/public/data`, are not listed in `meta.json`, are not verified, and Vite copies them into `web/dist`. CI is a clean checkout, so the live site is not affected; a local `make web` + `serve` is.
6. `Inputs::open` (sources.rs:95-118) checks commits and the hashes of locked files but not that every file key in `sources.json` is in the lock; adding a file to an existing source at the same commit and building without fetching panics at `l.files[key]` (sources.rs:122) instead of saying "run atlas fetch". `make data` always fetches first, so this only bites manual builds.
7. Five rules are implemented twice in Rust and TypeScript (section 10); only the theme-links rule has verify pins. English tokenization and alignment splitting rely on comments to stay in step.
8. There are no automated tests for 27,535 lines of TypeScript beyond `tsc`; PR bodies show browser checks were done by hand in each session.
9. The README asks for WSL on Windows; the founder's PC has WSL stopped, no make and no wasm32 target. Natively, the Rust unit tests and clippy pass; fetch/build/verify/wasm/dev are untested here.

## 14. Open and in-flight work seen from this angle

- Branch `claude/ask-the-bible-u6macl` is 1 commit ahead of main (`2f40b85`, mirror workflow) with no PR; branch `mirror/potion-base-8M` (`dced885`) holds the mirrored model. Next step implied: pin it in `sources.json` and use it in the Ask meaning matcher.
- PR #36 ("Ask the Bible: easy to find from the first screen", closed unmerged 2026-10-11): header label "Ask or search the Bible" and four starter questions in the empty palette. Main still shows "Search a verse, phrase or Hebrew/Greek word" (App.tsx:207).
- PR #5 "Follow-up work" items, checked against main: local server 404 handling (done, serve.mjs:29-34), lazy WordWorld (done, WordStudy.tsx:26), map colours for quotes and parallels (done, ui/mapKinds.ts), extras waiting for the first move (done, first-move.ts); `renderSettled()` exists (arcs.ts:769) but the share image it was meant for does not.
- IDEAS.md items still open: verse of the day, guided tours, share as image, reading plans, J/K keyboard tour, theme discovery by community detection, side-by-side translations, audio, WebGPU, and deploying with the ESV on a server.
- Drafts: unreviewed layers and hard-verse cards are built and checked but never published (no workflow sets `ATLAS_LAYER_DRAFTS` or `ATLAS_HARD_VERSE_DRAFTS`).
