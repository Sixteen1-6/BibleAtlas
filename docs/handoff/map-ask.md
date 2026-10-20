# Ask the Bible, in depth

Repository: github.com/Sixteen1-6/BibleAtlas, read at main a46d819 (2026-10-20), with every remote branch. Live at https://everyversemap.com/. Every Ask the Bible commit and PR (#16 to #43) and the unmerged commit 2f40b85 carry the same cloud session: `Claude-Session: https://claude.ai/code/session_01F5MX8Zw1CM7AW18hxHzAeP`. Numbers marked "measured" were measured for this write-up; the rest are quoted from PR bodies or commit messages, with the PR or hash given.

## 1. The short version

- A typed question goes from the search box (`web/src/ui/Palette.tsx:97-104`) to `matchAsk` (`web/src/ui/ask/ask.ts:382-424`), which offers a help row, an exact prepared question, a free "live" row, and up to three near questions or Nave's subjects. Picking the live row opens `LiveBody` (`web/src/ui/ask/AskSheet.tsx:295-303`), which calls `route()` (`web/src/ui/ask/route.ts:141-153`): exact phrasing, then the meaning matcher at 35% sure (`MEANT`, `route.ts:127`), then a word router. If nothing opens, `gather()` (`web/src/ui/ask/gather.ts:739-977`) gathers verses.
- "Prepared answers" are the 1,584 questions in `config/questions.json` (measured), each answered by a "chain" of 3 to 8 parts: whole verses or exact BSB words, nothing written between them. "Ties" are the build's proof that each chain part belongs: the question's words, a Nave's subject, a cross-reference, a quotation, a shared rare Hebrew or Greek root, or the same passage (`crates/atlas-cli/src/ask.rs:340-413`). "Gathered verses" are what the box shows when no prepared answer fits.
- The meaning matcher is a softmax regression trained at site build time by `web/scripts/ask-meaning.mjs` on 66,514 example messages (measured) in `config/ask-examples.json`, blended half and half with a tf-idf nearest-examples vote in the browser (`web/src/ui/ask/meaning.ts`). It ships as `ask/meaning.json`, 1,757,048 bytes gzipped on the live site (measured by HEAD request), loaded only when the first live question opens.
- Evaluation was blind, by readers who judged every verse shown without knowing which version showed it, on fresh never-seen message sets each round, plus 545 labelled dev messages for tuning. None of those sets, judgments, labels, or the fitting scripts are in the repository, on any branch, or in history (searched every branch tree and every deleted path). They lived only in the cloud session.
- The unmerged commit 2f40b85 (branch `claude/ask-the-bible-u6macl`, 2026-10-20 13:53 UTC) adds `.github/workflows/mirror-meaning-model.yml`, which copied minishlab/potion-base-8M (MIT) from Hugging Face to the orphan branch `mirror/potion-base-8M` (commit dced885, run 39434303112, success). Nothing consumes it yet: no `sources.json` entry, no build step, no browser code. The name "meaning model" and PR #40's "that is the next change" point to the same target: judge verses and messages by meaning, not only by words, to cut the off-topic share of gathered verses (39 to 40% in #40, 48% on #41's harder set).
- Measured for this write-up: the model is 29,528 tokens x 256 floats (30.2 MB; 6.77 MB gzipped at int8, 3.61 MB at 128 dimensions). On 2,000 held-out example messages it is no better than the learned matcher alone (1,025 vs 1,037 right first), but as a third voice beside the shipped blend it raises right first answers from 1,089 to 1,172 (1,155 with one shippable vector per question). It misreads oblique life statements ("car got repossessed" is closer to "Does God love me?" than to debt). Scripts and outputs are on the founder's PC, in a local job's scratch folder: `scratch/potion/` (m2v.mjs encoder, probe.mjs, sizes.mjs, the mirrored model files) and `scratch/meaning/` (run.mjs reproduction, heldout.mjs, heldout2.mjs and their logs).

## 2. How a typed question becomes an answer

### 2.1 Search box to Ask rows

`web/src/ui/Palette.tsx:76-77` loads `ask/index.json` and `ask/also.json` when search opens (`loadAsk`, `ask.ts:119-126`). On each keystroke (`Palette.tsx:84-114`):

1. `isCare(query)` (`ask.ts:368-373`, regex `CARE`): words about ending one's life or self-harm. Then search drops its English word matches (`Palette.tsx:100`) and `matchAsk` returns a single `care` row ("Help, and hope"). The link id is just `care`, never the typed words (`askId`, `ask.ts:148-153`).
2. `matchAsk` (`ask.ts:382-424`):
   - `contentWords` (`words.ts:180-182`) drops STOP words (`words.ts:30-161`).
   - `asking` = reads as a question (`looksLikeQuestion`, `ask.ts:297-300`: ends with "?" or starts with a question word) or tells what is happening (`looksLikeTelling`, `ask.ts:308-310`: a word like my, husband, boss and 2 or more content words), unless the best verse found holds the query word for word (`quoted`, `Palette.tsx:103`, `holdsWords`, `ask.ts:313-316`).
   - More than 12 content words: one `live` row only if asking, else nothing (`ask.ts:389`).
   - `exactQuestion` / `opens` (`ask.ts:329-364`): the key from `askKey` (`ask.ts:263-271`, strips "what does the Bible say about", keeps KEEP words like make, know, not) matched against each question's title and `also` phrasings; a phrasing used by two questions opens neither. Exact match scores 100+.
   - Otherwise questions whose stems cover at least 60% of the typed stems (score 10+), and Nave's subjects named by the typed words (`ask.ts:408-416`).
   - If asking and no exact match, a `live` row goes first (`ask.ts:421-422`), keeping up to 400 characters (`LIVE_MAX`, `ask.ts:108`) in the link (`&ask=live:...`).

### 2.2 The panel and routing

`AskSheet` (`AskSheet.tsx:420-451`) renders by kind:
- `question`: `QuestionBody` (`AskSheet.tsx:272-291`) loads `ask/q/<id>.json` and shows the chain (`Chain`, `ChainPart`, 141-177), at Study lights the wider set on the map, at Deep shows "Why each verse is here" (`WhyEach`, 223-255) from the ties, and all verses by book.
- `topic`: a Nave's subject's verses (`TopicBody`, 346-365).
- `care`: help line (988, Samaritans 116 123, findahelpline.com) then seven whole passages (`HOPE`, 368-376: Ps 34:18, 1 Kgs 19:3-5, Ps 42:11, 2 Cor 1:8-10, Ps 40:1-2, Lam 3:21-23, Matt 11:28-29).
- `live`: `LiveBody` (295-303) first loads `ask/signals.json` and `ask/meaning.json` (this is the "loaded on first ask" moment), then `route(ix, text)`:
  1. `exactQuestion` (route.ts:143-144).
  2. Meaning matcher: the likeliest prepared question opens if its likelihood is at least `MEANT = 0.35` (route.ts:127, 147-148).
  3. Word router `routes()` (route.ts:76-119): idf-weighted share of the best "way of asking" (title, `also`, or a signal) that was said (`said`), share of the typed words the question covers (`covers`), and a title bonus; score = said x (0.4 + 0.6 covers) + 0.1 own. Opens only if said >= 0.75, covers >= 0.5, score >= 0.6, a margin of 0.08 over a runner-up that also passes `said` (`OPEN`, route.ts:122), and the meaning matcher does not rule it out: likelihood >= `UNMEANT = 0.15` (route.ts:133-138).
  4. Nothing opens: `GatheredBody` (AskSheet.tsx:305-344) lazily imports `gather.ts` (the word tables left the first download in PR #29: 122.7 to 116.2 kB gzipped) and shows the first 6 verses (`FIRST`, line 37), 12 at Study (`MORE`), the full list and "How these verses were found" at Deep.
- Every panel except care starts with `Listen` (AskSheet.tsx:405-417), the founder's own note (PR #34, reworded in PR #35); on the care path it comes after the verses so the help line stays first. It says the tool "finds verses by math, by how alike words and meanings are".

A prepared answer reached from a live question keeps the person's own words as the heading; at Deep it says "These verses were prepared for the question ..." (AskSheet.tsx:287).

Threshold history (from `git log -p`): `MEANT` 0.8 (080da4f, 2026-10-10) to 0.7 (5763dc3) to 0.4 (ce2b097, when the nearest-examples blend arrived) to 0.35 (38374b5, PR #40). `UNMEANT` 0.05 (5763dc3) to 0.15 (ce2b097). `NEAR` {k 30, power 3} (ce2b097) to {k 20, power 4} (b78dce2, PR #43). `OPEN` unchanged since 159c356.

### 2.3 The words (web/src/ui/ask/words.ts)

The one tokenizer for routing and for training, imported by the page and loaded by the build through Vite (`ask-meaning.mjs:182-188`), so build and page read text the same way. `terms(s)` (words.ts:233-239): lowercase, drop apostrophes, split on non letters or digits, drop STOP (words.ts:30-161: question words, pronouns, "deal", "cope", "help" and other words of asking), drop PLAIN (line 185: "want", "today", "lol", contractions) and bare numbers, map synonym groups to their head word through SAME (lines 191-225, 26 groups such as "die died ... funeral", "child son daughter ... newborn", "porn pornography"), except OTHER (line 229: "made", "fire", "scar", "rag" keep their own sense), else a rough stem (`stem`, lines 172-177).

### 2.4 The meaning matcher

Training, `web/scripts/ask-meaning.mjs` (runs as `predev` and `prebuild` in `web/package.json`, after `make data` has written `public/data/ask`):
- Rows (lines 62-71): every question's title and `also` phrasings weigh 2, signals and examples 1 (`KINDS`, line 32).
- Softmax regression over the `terms` of each row, AdaGrad, 8 epochs, rate 0.5, L2 1e-3, seed 1 (mulberry32, lines 33, 50-59, 76-114). Every class updates on every row, so words also learn where they do not point.
- `prune` (120-133): each word's weights shifted to median 0, rounded to 1/100, kept only if at least 1.0.
- Gate (194-202): fails the build if fewer than 70% of examples find their own question.
- `texts` (151-159): every training text's words, so the page can find the nearest examples.
- Output `ask/meaning.json`: `{format: 2, key, ids, scale, w, texts}`; `key` is a SHA-256 of the inputs (skip when unchanged, lines 167-177), `ids` an FNV-1a hash of the question ids (lines 40-47).

Measured by rerunning the same code in a local scratch folder on `config/questions.json` and `config/ask-examples.json` at a46d819 (Node 24.13, the founder's PC): 132,402 training texts (487 empty after `terms`), 18,655 words, 18,286 words and 235,856 weights kept, 51,736 of 66,453 non-empty examples (77.9%) find their own question (PR #32 reported 81% at 871 questions), training 264 s (233 to 570 s on 90% of the data in the held-out runs below, depending on what else the founder's PC was running). File 3,906,841 bytes raw, 1,709,789 gzipped (weights 891,219 gz, texts 817,457 gz); the live file is 1,757,048 gzipped. The skip-if-unchanged key does not help CI: `web/public/data` is built fresh, so both `ci.yml` and `pages.yml` retrain on every push to main.

Runtime, `web/src/ui/ask/meaning.ts`:
- `weigh()` (131-151): refuses weights whose `ids` hash does not match the index (132-134); sums the weights of the typed terms; softmax; then blends half and half (`NEAR.share 0.5`, line 31) with `closest()` (80-97): tf-idf cosine against every training text, the 20 nearest, each counted as similarity to the 4th power, summed per question.
- `meanings()` gives the top questions with likelihoods; `likelihood()` one question's.

### 2.5 Gathered verses (web/src/ui/ask/gather.ts)

1. Clean up: possessives ("Lot's wife"), "God's" (742-747); phrase patterns `PHRASES` (339-448, 103 patterns, measured) replace idioms and life situations with BSB wordings ("lost my job" to "supply needs", "daily bread"...), and are removed from the words; `namedBooks` (565-618) reads "in john 1", "the book of romans", misspelt book names; `FILLER` (305-314), personal numbers and time spans (318-319), two-letter words except "ox" and "ax".
2. Concepts (674-702), up to 8: each word, its BSB forms (`formsOf`, 481-502), and its Bible words from `BIBLE_WORDS` (31-289, 256 entries, measured), a table of today's words to BSB words ("racism": favoritism, partiality, "jew greek"...). `INSTEAD` (294-298) words are looked for only through their Bible words ("job" is not the man Job). Misspellings are mended only by dropped letters, swapped neighbours or a vowel in a long word, with the same consonant outline (`meant`, `slips`, `skeleton`, 508-548).
3. Nave's subjects named by the concepts (782-801), at most 4, never wider than 1,500 verses (`WIDE_SUBJECT`), never old senses (`OLD_SENSE`), never figurative lines (`f` ranges).
4. Prepared questions: those sharing 60% of the stems (`matchingQuestions`, 979-986) add their wider sets; the router's near questions plus the meaning matcher's top 3 (`LEAN`, 725) lean candidates toward their chain verses (884-891); the meaning matcher's top 10 (`SHOW.top`) feed the final ordering.
5. Score (898-914): 3.5 x share of concepts held (idf weighted) + Nave's + most-cited + 0.5 PageRank + density + teaching genre + "why" reason clause + whole Bible phrase + named book + 3 x leaning; then +0.15 per cross-reference link (2+ votes) among the best 200 (917-929).
6. What shows first (`SHOW`, 737; 935-968, PR #41): a pool of the 10 best by score plus the first 3 parts of the 5 nearest chains, ordered by 5.8 x matcher likelihood of the surest chain holding the verse + 2.3 x how many of the 10 nearest chains hold it + 1 x words + 1.2 x whole phrase + 0.7 x links + 1.9 x teaching. The weights were "learned from 6,134 verses judged blind for 271 tuning messages" (42bb301). Up to 400 verses (`MAX`) are listed.

Nothing in this pipeline measures whether a verse's meaning matches the question. Its signals are words, Nave's labels, cross-references and which prepared chains the matcher thinks are near.

## 3. Prepared answers, chains, ties

### 3.1 config/questions.json (measured at a46d819)

- 1,584 questions in 8 groups: God 107, Jesus 147, Saved 63, Living 358, Hard times 157, Family 286, Death and the future 97, Church and Bible 369.
- 12,008 chain parts (2,816 are exact word spans, the rest whole verses); chain lengths 3:1, 4:6, 5:27, 6:97, 7:360, 8:1,093. 5,813 distinct references; the most reused are Rom 12:18 (47 chains), Ps 34:18 (46), Ps 147:3 (44), Ps 62:8 and Heb 13:5 (39).
- 20,489 `also` phrasings (3 to 16 each, median 13); 43,815 signals (20 to 40 each, median 28); 3,412 topic links to 903 distinct Nave's subjects (GOD 162, AFFLICTIONS AND ADVERSITIES 147, CHILDREN 104).
- Shape: `{id, group, question, also[], signals[], topics[{subject, only[], skip[]}], chain[{ref, words?}]}` (ask.rs:155-191, `deny_unknown_fields`).

### 3.2 config/ask-examples.json

`{examples: {question id: [messages]}}`; 1,584 keys, 66,514 messages, 32 to 60 per question, median 56 characters, longest 400 (measured). Never shown. Included: 871 messages that readers labelled (PR #34) and the gap messages each new answer was written for (d8e981c), so some former evaluation messages are now training data.

### 3.3 Build checks, crates/atlas-cli/src/ask.rs

`build()` (857-978) collects every problem before failing, so one run lists them all (905-914):
- id: lowercase words and digits with hyphens, at most 48 characters (628-640); group one of `GROUPS` (80-89).
- question at most 90 characters, ends with "?" (648-651); 2 to 16 `also`, each at most 60 (652-657); at most 60 signals, 1 to 3 lowercase words, no repeats (658-670).
- `OUTSIDE` words (94-104: scholar, theolog, commentat, denomination, "christians believe", gotquestions, esv, nave, interpret) are refused in questions, phrasings, signals and examples (`plain`, 562-579; 836-838): "this box speaks only in the Bible's words".
- chain 3 to 8 parts (`CHAIN`, 106), a part at most 3 verses, a word span at least 3 words and word for word in the BSB (`find_words`, 485-524), at most 1,200 characters shown (`CHAIN_MAX`).
- 1 to 5 Nave's topics, every `only`/`skip` label must exist (582-615).
- Ties (`ties`, 340-413): `w` question words the part shows (stems via `asked_stems`/`meets`, 256-291, with `QUESTION_STOP` 136-146), `s` Nave's subjects it sits under, `x` cross-references with more votes for than against (300-307), `q` BSB quotation footnotes, `r` the rarest shared Hebrew or Greek root that is a noun, verb or adjective, used at most 1,000 times, and not a light verb (125-131, 313-332), `p` within 3 verses in one chapter. A part with no tie fails the build (761-780). This replaced owner approval in PR #26 (then 583 of 583 parts tied).
- Examples (`examples`, 807-855): every question 10 to 60, each trimmed and at most 400 characters, no `OUTSIDE` word, not another question's phrasing, not duplicated within or across questions.
- Output under `web/public/data/ask/`: `index.json` (format 2: groups, questions with chain ranges, every Nave's subject and count), `also.json`, `signals.json`, `q/<id>.json` (chain with ties, top verses, wider set), `topics/<n>.json` (250 subjects per shard, with figurative ranges `f`).
- `verify()` (981-1073) adds 6 checks to `atlas verify`; 7 unit tests (1075-1190).
- Live gzipped sizes (measured): index.json 152,075; also.json 223,641; signals.json 249,063; meaning.json 1,757,048; atlas.bin 3,556,707.

## 4. How it was evaluated

| Round | Set | Result |
|---|---|---|
| PR #28 | 268 tuning questions judged in context; 120 fresh questions judged blind old vs new | top-8 answering 19% to 31%, off 42% to 26%; fresh: answering verses 96 to 125, 22 better, 8 worse; right chain opens 94 to 153 of 268 |
| PR #29 | 149 never-seen questions (75 faith, 74 life statements) and 149 earlier | never-seen: answering 74 to 90, off 843 to 745, questions answered 46 to 50; only 8 of 74 statements answered |
| PR #31 | 150 untuned (50 statements, 50 practical, 50 Bible); router thresholds on 682 earlier questions | answering 78 to 153, off 763 to 607, answered 36 to 60; of 431 judged opens, 353 fit, 73 near, 5 wrong |
| PR #32 (5763dc3) | 270 never-seen, blind | answered (first 6) 116 to 152, off 828 to 581 |
| PR #34 (ce2b097) | 1,096 labelled messages before they joined the examples | right opens 390 to 442, wrong 45 to 45; 270 test: 152 vs 151 answered, off 584 vs 569 |
| PR #40 | 269 held-out, blind, main and branch same day; 545 labelled dev messages (tuning) | answered 204 to 209, off 379 to 363; off share prepared 9% to 7%, gathered 39% to 40%; dev: right opens 236 to 297, wrong 19 to 14, top-3 fits 393 to 452 |
| PR #41 | 299 fresh, blind; SHOW fit on 6,134 judged verses for 271 tuning messages | answered 143 to 147, off 747 to 684; gathered 75 to 79 of 191 answered, off share 53% to 48%; prepared 22% off |
| PR #43 | 300 never-seen, blind vs main; 545 dev messages | answered 160 to 181, off 634 to 576 of 1,800; dev right opens 297 to 308, wrong 14 to 15 |

Where those sets live: not in the repository. `git ls-tree` over all 41 non-mirror remote branches and `git log --all --diff-filter=D` find no eval, label, judgment, held-out or tuning file; `web/scripts/` holds only `ask-meaning.mjs`. The code that fitted `SHOW`, `MEANT`, `UNMEANT`, `OPEN` and `NEAR` is not in the repo either, only the constants. The comparison with CompellingTruth and OpenBible.info (PR #32, 047fa7a, 5763dc3) was "internal only; nothing from those sites is in the repository", by rule. So the sets, the reader judgments, the 545 labelled dev messages and the fitting scripts exist only in the cloud session's container (session_01F5MX8Zw1CM7AW18hxHzAeP), if it still exists.

## 5. The unmerged work: 2f40b85 and mirror/potion-base-8M

- Timeline (UTC, 2026-10-20, from CI runs and commit dates): 13:36 the Ask branch pointed at main's 96ee1d0 (CI run 39431903694 ran on that sha for the branch); 13:53:10 commit 2f40b85 (parent 96ee1d0) adds `.github/workflows/mirror-meaning-model.yml` (94 lines); 13:53:15 the workflow ran on that push (run 39434303112, success) and pushed dced885 at 13:53:20. No PR was opened. The branch is now 3 commits behind main (#46: 59d17f0, 0e04cdc, merge a46d819).
- The workflow (on `workflow_dispatch` and on push of the workflow file, any branch; `contents: write`): reads the model's current revision from the Hugging Face API, downloads README.md, config.json, tokenizer.json and model.safetensors, checks each against the SHA-256 (LFS files) or git blob id (small files) Hugging Face lists, writes SOURCE.md, and commits to the orphan branch `mirror/potion-base-8M`, keeping its history "so a pinned commit stays fetchable". The commit message gives the reason: "The data containers can only reach github.com".
- Branch content at dced885 (measured, hashes match SOURCE.md): README.md 5,203 B; config.json 202 B; tokenizer.json 683,666 B (sha256 e67e803f...); model.safetensors 30,236,760 B (sha256 f65d0f32...), stored as a plain git blob, not LFS, so `atlas fetch`'s sparse git fetch (`crates/atlas-cli/src/fetch.rs:93-117`) would get it without the LFS path through media.githubusercontent.com (fetch.rs:43-87, today used by macula-hebrew). Hugging Face revision bf8b056651a2c21b8d2565580b8569da283cab23. Not mirrored: the `onnx` folder, vocab.txt, tokenizer_config.json, modules.json, special_tokens_map.json (listed in the run log).
- The model (measured): Model2Vec static embeddings. config.json: tokenizer baai/bge-base-en-v1.5, `apply_pca 256`, `apply_zipf true`, `normalize true`. One tensor `embeddings`, F32, shape [29,528, 256]. Tokenizer: BERT normalizer (lowercase), BERT pre-tokenizer, WordPiece, 29,528 entries (5,828 "##" pieces), unknown token [UNK]. Encoding a text is: tokenize without special tokens, drop [UNK], average the rows, L2 normalize. No neural network runs; it is a table lookup and a mean, which fits a static site with no server.
- What it is not yet: no `sources.json` entry, no NOTICE.md or shelf entry, no build step, no browser code, no test or eval. `git grep` for potion, model2vec, embedding or minishlab across every branch finds only the workflow file.

## 6. Reconstructing the next change

Evidence, in order:
1. PR #40 (2026-10-11): "Gathered verses for questions with no close prepared answer are still about 40% off topic; that is the next change."
2. PR #41 (same day) was that change, in its first form: reorder gathered verses by what readers found answered (`SHOW`). On a harder fresh set the gathered off share went 53% to 48%. Still about half.
3. PR #43 (2026-10-17) attacked it from the other side: 360 new prepared answers because "about one fresh message in four had no prepared answer that fit it, so the box fell back to gathering verses, which are off nearly half the time".
4. 2f40b85 (2026-10-20) brings in "the meaning model", pinned like any source. The same session, the same branch, nothing else after it.

So the next change was to add a meaning signal the box does not have: how close in meaning a verse (and a message) is to what was typed. Today every signal in `gather.ts` is lexical or second-hand (words, Nave's, cross-references, which chains the word-based matcher thinks are near), and `meaning.ts` measures closeness to examples by shared words only (tf-idf). The word "meaning" in the workflow's name ties it to `meaning.ts`/`meaning.json`; the problem statement ties it to gathered verses. The most likely plan, as an inference from the code and constraints, not from any written plan:

1. Pin the mirror in `sources.json` as a new source (repo https://github.com/Sixteen1-6/BibleAtlas, commit dced885a21af0bfd69eaf34f214c9d2160d8b733, files model.safetensors, tokenizer.json, config.json, README.md; license MIT), so `atlas fetch` puts it in `data/raw/BibleAtlas@dced885a21/` with its SHA-256 in `manifest.lock.json` and `atlas build` refuses a changed file (`sources.rs:93-121`).
2. Build time: embed every BSB verse (31,102) and, for the matcher, every question (title plus phrasings, or a centroid of its examples), quantize, and publish lazily loaded files under `web/public/data/ask/`.
3. Browser: tokenize the typed text with the same WordPiece, average the needed rows, and use cosine similarity as (a) a new `SHOW` term or a floor that drops gathered verses far in meaning from the question, refitted on the 6,134 judged verses, and possibly (b) a third component beside the softmax and tf-idf halves in `weigh()`.
4. Measure blind on a fresh set against main, as every round did, and gate the build like the 70% check.

### 6.1 Rust or Node at build time

- Rust (`atlas build`): already has the BSB text (`Sources.text`), `data/raw` through `Inputs`, and writes `ask/`. It has only 4 dependencies (atlas-core, serde, serde_json, sha2; `crates/atlas-cli/Cargo.toml`), but none is needed: safetensors is an 8-byte length, a JSON header and little-endian floats, and WordPiece is a short greedy longest-match loop. Verse embeddings would sit naturally beside the other data.
- Node (`ask-meaning.mjs` or a sibling prebuild script): the project's parity rule for Ask is "the same code the page runs" (`words.ts` loaded through Vite, `ask-meaning.mjs:182-188`). The query must be tokenized in TypeScript in the browser, so one TypeScript WordPiece used at both ends avoids build and page disagreeing. The script can read `data/raw` (fetched by `make data` before `npm run build` in both workflows) and `public/data/text/<Book>.json`.
- I wrote the encoder in plain JS for this write-up (`scratch/potion/m2v.mjs`, about 60 lines, no dependencies), so either language is small work. The 135,218 Ask config texts hold 1,220,186 tokens (9.0 per text, only 2 [UNK]); embedding 125,025 of them took 21.5 s in plain JS on the founder's PC while other jobs ran. The BSB (31,102 verses) is the same order of work.

### 6.2 Sizes (measured on the mirrored model)

| What | Raw | Gzipped |
|---|---|---|
| Token matrix F32, 29,528 x 256 (as mirrored) | 30.24 MB | 28.13 MB |
| Same, F16 | 15.12 MB | 14.06 MB |
| Same, int8 with a scale per row | 7.68 MB | 6.77 MB |
| PCA to 128, int8 (keeps 80.4% of variance) | 3.90 MB | 3.61 MB |
| PCA to 64, int8 (keeps 53.8%) | 2.01 MB | 1.90 MB |
| Vocabulary as a word list | 0.22 MB | 0.11 MB |
| 31,102 verses x 256 int8 (+ scale) | 8.09 MB | int8 vectors compress little (the matrix: 12%) |
| 31,102 verses x 128 / x 64 int8 | 4.11 / 2.11 MB | |
| 66,514 examples x 256 int8 | 17.29 MB | not practical |
| 1,584 question vectors x 256 F32 / int8 | 1.62 / 0.41 MB | |

Baselines: meaning.json 1.76 MB gzipped, loaded on first live question; atlas.bin 3.56 MB gzipped at start; main bundle 118.4 kB gzipped (PR #31). Shipping the whole matrix would add about 4 times meaning.json to the first live question. The Ask config uses only 16,954 of the 29,528 token ids (57.4%). Two lighter shapes fit the project's existing patterns (`ask/topics/<n>.json` shards, per-book `text/<Book>.json`): shard the token matrix by id so a message fetches only the rows of its tokens (about 9 tokens per message), and shard verse vectors by book so only the pool's verses are fetched; or reduce dimensions with PCA. Which one the session would have chosen is not recorded.

### 6.3 Does a static model see what people mean? (measured, small)

A probe with the mirrored model (cosine similarity; scratch/potion/probe.mjs):
- "did Jesus have a beard": 0.661 to "What did Jesus look like?", 0.303 to the prophets' strange acts. Good on questions worded like the title.
- "he left me for his secretary": 0.224 to "My spouse cheated on me", next 0.187. Weakly right.
- "car got repossessed this morning": 0.170 to "I'm drowning in debt" but 0.189 to "Does God love me?" and 0.188 to "What did Jesus look like?". Wrong. "they took my car because I missed payments": 0.199 to debt, 0.258 to the cheating question.
- Bible words fall into pieces: "righteousness" is righteous + ##ness, "propitiation" prop + ##itia + ##tion, "repossessed" rep + ##oss + ##essed, "fentanyl" fen + ##tan + ##yl.

A held-out check on the matcher (measured; `scratch/meaning/heldout.mjs`). Every 10th example of each question was held out (7,377 messages), the shipped training code was rerun on the rest (570 s), and 2,000 of the held-out messages, spread evenly, were scored. "Potion near" is the same 20-nearest, 4th-power vote as `meaning.ts`, but by potion cosine over all 125,025 training texts. "Opens" counts messages whose top likelihood is at least 0.35 (`MEANT`).

| Method | Right first | Right in top 3 | Opens at 0.35 | Right opens |
|---|---|---|---|---|
| softmax only | 1,037 | 1,371 | 916 | 705 (77%) |
| shipped: softmax + tf-idf nearest, half and half | 1,089 | 1,418 | 804 | 658 (82%) |
| potion nearest only | 1,025 | 1,367 | 677 | 558 (82%) |
| shipped + potion nearest, a third each | 1,172 | 1,534 | 729 | 634 (87%) |
| softmax + potion nearest, half and half | 1,174 | 1,501 | 802 | 677 (84%) |

The shippable form, one vector per question (the normalized mean of its training texts; 1,584 x 256, 0.41 MB at int8), scored as a softmax over cosine / 0.05 (`scratch/meaning/heldout2.mjs`, same split and same 2,000 messages): alone 962 right first and 1,297 in top 3; as a third voice beside the shipped blend 1,155 right first, 1,499 in top 3, 695 opens of which 616 right (89%). Almost all of the gain of the nearest-example form, without shipping example vectors; the query side still needs the token matrix (section 6.2).

Caveats: these are the synthetic examples written by the same agents who wrote the training examples, not real messages or the reader-labelled dev set, so they overstate accuracy for everyone; 0.35 was tuned for the shipped blend; and nearest-example voting needs every example's vector in the browser (17.3 MB at int8 x 256), which is not shippable. Still, the direction is clear: as a third voice the static model adds about 8% more right first answers (1,089 to 1,172) and its opens are surer, while alone it is no better than the learned weights.

So the model is a feature to add, not a replacement for the learned matcher, and its value for gathered verses can only be known by the same blind judging.

## 7. Constraints any next step must keep

1. Network: "The data containers can only reach github.com" (2f40b85). Hence the mirror. Models and data must arrive through `sources.json` and git; no Hugging Face, and likely no Python model2vec package, at build time in those containers.
2. Pinned sources: every input pinned to a git commit, SHA-256 recorded in `data/raw/manifest.lock.json`, build refuses a mismatch (`sources.json` `_comment`, `sources.rs:93-121`). The mirror records the Hugging Face revision in SOURCE.md. Deleting `mirror/potion-base-8M` would make the pinned commit unfetchable.
3. Deterministic builds: `ask-meaning.mjs` is seeded and order-fixed and skips when its inputs' SHA-256 is unchanged; `meta.json` records commits and checksums. Embedding and quantizing must be order-fixed too. CI uses Node 22 (both workflows); the founder's PC has Node 24.
4. Page weight: heavy Ask files load late (index and also on search open; signals, meaning and the gather tables on the first live question). The PR history treats size as a cost (1.4 to 1.7 MB in #43; first download cut in #29).
5. `meaning.json` binding: weights carry the id hash and are ignored if it does not match the index (`meaning.ts:132-134`). Any embedding file needs the same, plus the data version query that `loadJson` adds (`extras/data.ts`), which the service worker uses to cache data.
6. Static hosting: GitHub Pages, no server (`pages.yml`, `VITE_ESV=off`), so query embedding must run in the browser.
7. Bible words only: a model may only choose and order verses; it never writes. The only non-Bible words are the help line and the founder's note, which already says the tool works "by math, by how alike words and meanings are".
8. Build gates and evaluation: the 70% matcher gate, the Ask build checks, `atlas verify`; and the habit of blind judged fresh sets run against main the same day.
9. Licences and credits: potion-base-8M is MIT (README in the mirror); a source row in `sources.json`, `NOTICE.md` and the Sources shelf would be expected, as for every other source.

## 8. Open work

- 2f40b85 is unmerged with no PR; its branch is 3 commits behind main. The mirror branch exists (dced885) and nothing reads it.
- The next change itself (pin, build-time embeddings, browser encoder, new `SHOW` term or floor, refit, blind evaluation) has no code anywhere.
- The evaluation sets, reader judgments, 545 labelled dev messages and fitting scripts are only in the cloud session. The founder's request in the 2026-10-20 local run ("if its not local it should all be pushed to my github") applies to them first; without them the next change cannot be compared with #40 to #43 on the same footing.
- Gathered answers are still about half off topic on hard fresh sets (48%, PR #41); prepared answers 7% on #40's set, 22% on #41's harder set.
- PR #36 (Ask findable from the first screen) was closed and its commit reverted; the header still reads "Search a verse, phrase or Hebrew/Greek word" (`web/src/App.tsx:207`).

## 9. Founder rules seen on this angle

- The Bible is the framework for interpreting the Bible: nothing writes or interprets; answers are whole verses or exact BSB words (ask.rs:3-6, PR #16, every Ask PR).
- No scholars, church views or other frameworks in questions, phrasings, signals or examples (`OUTSIDE`, ask.rs:94-104).
- Every chain part tied by the Bible's own data, or the build fails (PR #26).
- Exceptions: the help line for someone in danger (PR #16) and the founder's own note on seeking God (PR #34, #35, in Shubhanshu's words).
- The typed words never enter the link on the care path (ask.ts:148-153).
- Nave's is an index only: subject headings shown, never entry text (ask.rs:20-23, NOTICE.md:12).
- Other sites (CompellingTruth, OpenBible.info answers) for internal comparison only; nothing from them in the repository (PR #32).
- Cite only Bible-believing writers (PR #37, #38; for notes and links, not Ask's verses).
- Every source pinned by commit and hash (sources.json).
- Measure blind on never-seen questions before claiming a gain (every Ask PR from #28).
