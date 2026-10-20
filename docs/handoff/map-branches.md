# Bible Atlas: branches, open work and health

Checked 2026-10-20, about 15:00 to 15:30 UTC, against github.com/Sixteen1-6/BibleAtlas (main at a46d819, merge of PR #46) and https://everyversemap.com/. Read only: nothing in the repository was edited, committed or pushed. Scratch evidence (logs, live downloads) is on the founder's PC, in a local job's scratch folder.

## Headline

- 41 remote branches (40 plus main). 38 are fully merged into main. 2 are not: `claude/ask-the-bible-u6macl` (1 commit, a new workflow, no PR) and `mirror/potion-base-8M` (an orphan branch the bot wrote, holding a 30 MB model). The local clone matches GitHub exactly (all 41 tips identical, `main...origin/main` clean).
- No open PRs, no issues (open or closed), 46 PRs in all: 43 merged, 3 closed (#4, #6, #36). #4 and #6 landed anyway through #5; #36 was withdrawn and its commit reverted (1096bcb).
- The live site is main a46d819: same data build id (514b1f3bf2b1), same hashed JS and CSS file names, 19 of 19 sampled data files match their meta.json SHA-256, and the NET feature from PR #46 is in the live bundle.
- CI is green: the last 30 runs all succeeded; across all 332 runs ever, 8 failed, the last on 2026-10-11 (a Layers note citing a source on the avoid list, caught by the build as designed).
- There are no TODO, FIXME, XXX or HACK markers anywhere in tracked files. The open work lives in PR bodies, IDEAS.md (stale since 2026-10-07), one code comment (share image) and the review state of the content configs.

## 1. Branches

Measured with `git rev-list --count origin/main..<branch>` and `git merge-base --is-ancestor`. "PRs" are from a local snapshot of the PR bodies (prs.json), by head branch. Dates are the tip's commit date (UTC).

| Branch | Tip | Date | In main? | PRs from it |
| --- | --- | --- | --- | --- |
| main | a46d819 | 2026-10-20 | (is main) | |
| claude/net-bible-6d3ryw | 0e04cdc | 2026-10-20 | yes | #46 |
| claude/ask-the-bible-u6macl | 2f40b85 | 2026-10-20 | **NO, 1 ahead, 3 behind** | #16, #26, #28, #29, #31, #32, #34, #35, #36 (closed), #40, #41, #43 |
| mirror/potion-base-8M | dced885 | 2026-10-20 | **NO, orphan (no common history)** | none |
| layers-wordplay-part2r | 5e1ed7f | 2026-10-17 | yes | #45 |
| layers-wordplay-part2 | 05fe581 | 2026-10-17 | yes | #44 |
| layers-wordplay-part1 | 7c37488 | 2026-10-17 | yes | #42 |
| layers-bullinger | 13f9d63 | 2026-10-11 | yes | #39 |
| layers-citations | 1a8d291 | 2026-10-11 | yes | #38 |
| claude/project-thread-1eyqzh | b55d549 | 2026-10-11 | yes | #15, #19, #20, #25, #33, #37 |
| claude/themes-eras-review-b1ka8x | 4907e5a | 2026-10-10 | yes | #11, #24, #27, #30 |
| claude/word-forms-family-i4ywp8 | 48c8e3f | 2026-10-10 | yes | #18 |
| claude/project-thread-r2awql | 0327564 | 2026-10-10 | yes | #2, #14, #21 |
| layers-wordplay | 16a7444 | 2026-10-09 | yes | #23 |
| claude/sources-shelf-h2m7qu | 795d687 | 2026-10-09 | yes | #22 |
| claude/places-quote-data-lr4itd | 4520822 | 2026-10-09 | yes | #17 |
| claude/study-notes-f5sshe | 2dc9051 | 2026-10-09 | yes | #13 |
| claude/map-colours-level-hints-wkbxen | 39c97bf | 2026-10-09 | yes | #12 |
| claude/small-fixes-ued4kg | 1ccbd96 | 2026-10-09 | yes | #9 |
| layers-quote-marks | 9c195f6 | 2026-10-09 | yes | #10 |
| claude/merge-all-ideas-tbjk33 | bb2881b | 2026-10-09 | yes | #5 |
| claude/jesus-aramaic-tf1tc8 | 2367c90 | 2026-10-09 | yes | #8 |
| claude/hover-highlight-18rfr1 | 53954af | 2026-10-09 | yes | #7 |
| phase2-layers | 4a47c7d | 2026-10-09 | yes (via #5) | #6 (closed) |
| depth-levels | 7be1d3a | 2026-10-08 | yes (via #5) | #4 (closed) |
| phase1-first-minute | 9a40805 | 2026-10-08 | yes | #1 |
| claude/project-thread-68xr52 | 7488edf | 2026-10-08 | yes | #3 |
| before-ideas-2026-10-08 | 41069d9 | 2026-10-07 | yes (snapshot of main before #5) | none |
| ultracode/words-in-their-world | e519ebd | 2026-10-09 | yes (via #5) | none |
| ultracode/time-periods | 6a492dc | 2026-10-09 | yes (via #5) | none |
| ultracode/word-sky | 8dda987 | 2026-10-09 | yes (via #5) | none |
| ultracode/arrival | 3c83ad7 | 2026-10-09 | yes (via #5) | none |
| ultracode/hebrew-meets-greek | 4cbdbc3 | 2026-10-09 | yes (via #5) | none |
| ultracode/books-in-conversation | c14f44e | 2026-10-08 | yes (via #5) | none |
| ultracode/theme-journeys | 947ea77 | 2026-10-08 | yes (via #5) | none |
| ultracode/many-roads | be52ae6 | 2026-10-08 | yes (via #5) | none |
| ultracode/real-map | 76a7419 | 2026-10-08 | yes (via #5) | none |
| ultracode/parallels | 3741414 | 2026-10-08 | yes (via #5) | none |
| ultracode/quotes | e0a901d | 2026-10-08 | yes (via #5) | none |
| ultracode/ideas-spine | f770466 | 2026-10-08 | yes (via #5) | none |
| ultracode/living-sky | dc8b584 | 2026-10-08 | yes (via #5) | none |

Notes:

- The 13 `ultracode/*` branches never had their own PRs. PR #5 (merged 2026-10-09 as 996130a) merged each one with a merge commit, plus #1, #4, #6, #7 and #8. `before-ideas-2026-10-08` is the snapshot of main saved before #5, as the #5 body says.
- Branches are reused: `claude/ask-the-bible-u6macl` carried 12 PRs, `claude/project-thread-1eyqzh` 6. `delete_branch_on_merge` is off, so nothing is cleaned up after a merge.
- main has 306 commits (first a59dfb2, 2026-10-07). 35 of its 44 first-parent commits are merges. Pushed straight to main with no PR: the 5 opening commits of 2026-10-07 (a59dfb2 to 41069d9) and ab53468 "Serve the site from everyversemap.com" (2026-10-11, a Claude session). #19, #20 and #25 were squash-merged (99ba7ca, d1a2bb1, fbfca22).
- 19 distinct Claude sessions left `Claude-Session` trailers on main. The busiest: session_01GDgrBpfomsCbSfqcijgTXn (78 commits), session_01F5MX8Zw1CM7AW18hxHzAeP (36, Ask the Bible), session_01KSvZFUjwhscpHwZiY2UUGi (31, Layers).

### The two unmerged branches

**`claude/ask-the-bible-u6macl` at 2f40b85** (2026-10-20 13:53 UTC, session_01F5MX8Zw1CM7AW18hxHzAeP). One commit past its merge base 96ee1d0 (main after #45), and 3 behind main (59d17f0, 0e04cdc, a46d819, the NET work). It adds only `.github/workflows/mirror-meaning-model.yml` (94 lines). That workflow, on `workflow_dispatch` or on a push that touches the file, downloads `minishlab/potion-base-8M` (MIT) from huggingface.co, checks each file against the SHA-256 or git blob id Hugging Face lists, writes a SOURCE.md and commits the files to the orphan branch `mirror/potion-base-8M` with `GITHUB_TOKEN` (`permissions: contents: write`). Its stated reason (lines 3 to 7): the containers that build the data can reach only github.com, so the model is mirrored there "which sources.json can then pin like any other source". No PR is open for it, and nothing on main or this branch uses the model yet. This is in-flight work: the next step implied is a sources.json entry pinning `Sixteen1-6/BibleAtlas@dced885` and code that uses the model, most likely for Ask the Bible's meaning matching (the session that wrote it wrote every Ask the Bible PR).

**`mirror/potion-base-8M` at dced885** (2026-10-20 13:53:20 UTC, author github-actions[bot], from run 39434303112 "Mirror the meaning model", success, 13 s). Orphan commit "Mirror minishlab/potion-base-8M at bf8b056651a2c21b8d2565580b8569da283cab23" with README.md (5,203 B), config.json (202 B), tokenizer.json (683,666 B), model.safetensors (30,236,760 B, sha256 f65d0f32...a223de2) and SOURCE.md. It is not meant to be merged. The model blob is 28.2 MB on disk, about two thirds of the whole clone's 41.65 MiB pack.

## 2. Open, in-flight and promised work

### In flight
1. Meaning model mirror (above). Branch pushed, no PR, not wired in. Evidence: 2f40b85, dced885, run 39434303112.
2. Ask the Bible quality. #40 ends "Gathered verses for questions with no close prepared answer are still about 40% off topic; that is the next change." #41 cut the gathered off-topic share from 53% to 48% on a harder set; #43 says gathered verses "are off nearly half the time". So the fallback path is still the known weak spot, and the model mirror looks like the next attempt.

### Waiting on the founder
3. "Often asked" hard-verse cards: all 56 in `config/hard-verses.json` have an empty `reviewed_by`, so all are drafts and none is published. Live `data/extras/hard-verses/cards.json` is `{"cards":[],"format":1}` (23 bytes). #19 and #25 say they wait for the founder to approve each card; the 13 site cards on the Sources shelf for those answers stay hidden until then (#25).
4. Ask the Bible is still hard to find from the first screen. #36 (header "Ask or search the Bible", four sample questions) was closed and its commit reverted (d27ae81 then 1096bcb, both 2026-10-11). The header still reads "Search a verse, phrase or Hebrew/Greek word" (`web/src/App.tsx:207`).
5. Layers: all 1,264 passages in `config/layers.json` have an empty `reviewed_by`; notes go live through the citation rule instead. 3,095 of 3,099 notes are live (4 held back for lack of a qualifying citation, per #45 and the live `layers.json`). A person-review pass has never been recorded, and the UI says so ("Not yet reviewed by a person", `web/src/ui/Layers.tsx:260`).

### Promised but not done
6. Share as image. `web/src/gl/arcs.ts:763-769` keeps `renderSettled()` "For Phase 2's share image"; #5's follow-up list and #12 both say it is left for that. `renderSettled` has no caller anywhere in `web/src`.
7. MACULA licensing question. #17 notes that Clear-Bible/macula-hebrew#145 asks whether MACULA's Septuagint equivalents come from CATSS (non-commercial). Checked today: still open, 0 comments, opened 2026-10-07 by a third party. The app uses those equivalents for 1,625 of 1,882 quotation word pairs. NOTICE.md:25 and :31 record only what MACULA's license says, not the open question.
8. PR #5 "Follow-up work (not for this PR)" list, status checked against later PRs and the code:

| Item | Status |
| --- | --- |
| Map colours for quotations, parallels, threads, roads | Done, #12 |
| Extras wait for the reader's first move | Done, #9 (real-map keeps its own copy, "for now") |
| A cue for what each depth level adds | Done, #12 |
| Licensed Septuagint-Hebrew alignment | Done, #17 (MACULA), with the open question in item 7 |
| Places: Events.csv, regions, tribes, taller panel | Done, #17 |
| Sources screen folds file lists | Done, #9 |
| Layers mark direct quotations | Done, #10 |
| Offline: Palette and Connections catch failed loads | Done, #9 |
| Local server serves 404.html | Done, #9 |
| Living sky: safe dispose | Done, #12 |
| Share image via renderSettled | **Not done** (item 6) |
| Word sky overlay slot, mark echoes already linked | Done, #12 |
| Hubs use linkCount, remove unused .wheel CSS | Done, #9 |
| Lazy-load WordWorld | Done, #9; "its five open review minors" not traceable to any later PR |
| Owner's review of theme senses and eras | Done, #11 |

### IDEAS.md (last changed 2026-10-07 in 6dad5eb, before almost everything was built)

| Idea (IDEAS.md line) | State in code |
| --- | --- |
| Verse of the day (7) | Not built. `web/src/ui/Welcome.tsx:5-9` has three fixed starters (Isaiah 53:5, John 3:14, Genesis 22:8); nothing is seeded by date. |
| Guided tours (9) | Partly. Theme journeys (`web/src/ui/ThemeThread.tsx`, numbered steps along a theme's gold thread) and connection paths cover the Lamb, the shepherd and Genesis 3:15 to Revelation 12:9, but there are no curated multi-stop tours with next and back. |
| Share as image (11) | Not built (hook only, item 6). |
| Reading plans with a progress glow (13) | Not built. localStorage holds only depth, welcome, color pairs and voices preferences. |
| Keyboard tour J and K (15) | Partly: with the map focused, ArrowLeft and ArrowRight step verse by verse (`web/src/ui/AtlasMap.tsx:361-370`). No J or K. |
| Timeline mode (19) | Partly: a per-chapter "When" line with a timeline strip and an era button that lights the era on the map (`web/src/ui/ChapterWhen.tsx`, `config/eras.json`). The map itself is never laid out by date of writing. |
| Quotations versus allusions (21) | Built: Quotations extra, quotations pink and echoes dashed on the map (`web/src/ui/mapKinds.ts`, #10, #12). |
| People and places (23) | Places built (real map, regions, tribes, events, people tied to places; #17, `crates/atlas-cli/src/extra_real_map.rs`), from OpenBible.info and Theographic rather than TIPNR. No people graph. |
| Theme discovery with Louvain (25) | Not built. Themes are hand-made (163 in `config/themes.json`); "Often linked with" is a lift statistic, not community detection. |
| Compare translations side by side (27) | Not built. The reader switches BSB, NET or ESV one at a time (`web/src/state.ts:12`). |
| Audio (29) | Not built. |
| Offline mode (33) | Built: `web/public/sw.js` (lazy: files are saved on first use, nothing large is fetched ahead). |
| WebGPU renderer (35) | Not built. |
| Installable app (37) | Built: `web/public/manifest.webmanifest`, icons, shortcuts. |
| Deploy with the ESV (39) | Not built. Pages still has `VITE_ESV=off` (`.github/workflows/pages.yml:52`); #46 added the NET, read live from labs.bible.org, as the live site's second version instead. |

IDEAS.md lists none of what was actually built after 2026-10-07 (Ask the Bible, Layers, hard verses, study notes, Aramaic, Peshitta, themes, word families and more), so it no longer describes the project.

### Stale documentation (facts measured today)
- `README.md:18` and `:127` say 192 data checks; `atlas verify` passes 5,909 (CI log of a46d819).
- `README.md:18` and `:131` say the engine is 61 KB of WebAssembly; the build wrote 75,220 bytes.
- `README.md:118` and `:156` say the data build takes 2.3 to 2.5 s; CI reports 14.6 s and 16.4 s for `atlas build`.
- `README.md:160` says app JavaScript is 85 KB (32 KB gzipped); the main chunk alone is 332.56 kB (124.66 kB gzipped), in 20 JS chunks.
- `README.md:81` says Windows users must use WSL; clippy and the unit tests run natively on the founder's PC (section 7).
- `web/src/ui/extras/README.md:22-30` describes "The three extras"; there are 13 (`web/src/ui/extras/*.extra.tsx`). Lines 165, 353 and 355 still use the `/BibleAtlas/` base path, which ab53468 dropped for the custom domain. Same for the example comments at `web/public/sw.js:27-28` and `web/src/arrival.ts:18`.

## 3. TODO, FIXME, "next", "later", "not yet" scan

Searched every tracked file except the lock files (and, for the broad words, the three large data configs).
- TODO, FIXME, XXX, HACK: 0 hits.
- "next", "later", "not yet", "for now", "pending": every hit in code is ordinary prose or variable names (for example `later` in `extra_peshitta.rs` means "later Syriac versions"; `pending` in `engine/client.ts` is a request map). The only planned-work comment in code is `web/src/gl/arcs.ts:768` ("Phase 2's share image").
- Product-facing "not yet": `web/src/ui/Layers.tsx:260`, `web/src/ui/extras/hard-verses/Panel.tsx:57`, `web/src/ui/extras/wordplay/Panel.tsx:161` ("Not yet reviewed by a person"); `web/src/ui/extras/peshitta/Panel.tsx:69` and `sources.json:227` (the Syriac source is an uncorrected transcription).
- `README.md:197` "Ideas for later" points to the stale IDEAS.md.
- NOTICE.md: no open items of its own (the MACULA question is not mentioned there).

## 4. CI and Pages

Workflows on main: `CI` (`.github/workflows/ci.yml`, every push and PR: clippy with `-D warnings`, `cargo test --workspace --release`, `make data`, `make wasm`, `npm ci` and `npm run build`) and `Deploy to GitHub Pages` (`.github/workflows/pages.yml`, push to main and manual: same build with `VITE_ESV=off`, `--base=/`, then `actions/deploy-pages@v4`). Also listed: `Mirror the meaning model` (exists only on the ask-the-bible branch) and the one-off legacy `pages-build-deployment`.

- `gh run list --limit 30`: 30 of 30 succeeded (2026-10-17 06:47 to 2026-10-20 14:02 UTC).
- All 332 runs ever: CI 282 success and 6 failure; Deploy 40 success and 2 failure; Mirror 1 success; legacy Pages 1 success. The failures: 2026-10-07 (clippy on Rust 1.99, `chunks_exact`, fixed by 8a70f1e, which broke the first deploys too), 2026-10-08 on `ultracode/real-map` (2) and `claude/merge-all-ideas-tbjk33` (2, same clippy lint), and 2026-10-11 on `layers-citations` 1478aa0 (a note citing the Expositor's Greek Testament, which is on the avoid list). No failure on main since 2026-10-07.
- Run times: CI about 200 to 305 s, Deploy about 240 to 270 s.
- CI on a46d819: 218 unit tests (199 + 18 + 1), build 514b1f3bf2b1, 5,909 checks, `npm ci` reports 0 vulnerabilities.
- Warning on every run: actions/checkout@v4, setup-node@v4, cache@v4, configure-pages@v5, upload-artifact@v4 and deploy-pages@v4 target Node.js 20, which GitHub has deprecated and now forces onto Node 24.
- Pages (`gh api repos/Sixteen1-6/BibleAtlas/pages`): status built, build_type workflow, cname everyversemap.com, https_enforced true, certificate approved for everyversemap.com and www.everyversemap.com, expires 2027-01-09 (GitHub renews it). `protected_domain_state` is null: the domain is not verified on the account (no `_github-pages-challenge-...` TXT record).
- Pages health: valid; apex has the 4 GitHub A records (185.199.108-111.153), no AAAA; www is a CNAME to sixteen1-6.github.io; DNS is at Squarespace (nsa1 to nsa4.squarespacedns.com). http, www and the old https://sixteen1-6.github.io/BibleAtlas/ all 301 to https://everyversemap.com/.
- Environment `github-pages`: deployments limited to branch `main`, admins can bypass. Latest deployment a46d819, state success, 2026-10-20 14:06:26 UTC.

## 5. Does the live site match main? Yes

- `https://everyversemap.com/`: 200, Last-Modified 2026-10-20 14:06:20 GMT, which is when deploy run 39435597250 (a46d819) published.
- It loads `/assets/index-DeNn5wLQ.js`, `/assets/atlas-C48sN3M4.js`, `/assets/index-C0yGIuLS.css`; the deploy log's Vite output names exactly these files.
- `data/meta.json`: buildId 514b1f3bf2b1, 2,211 files listed (2,212 with meta.json itself, as the log says), 120.6 MB, 27 sources whose ids and commits equal main's `sources.json` one for one. Both the CI run and the deploy run of a46d819 computed buildId 514b1f3bf2b1 on separate runners, so the deterministic build reproduces.
- 19 data files sampled across meta.json (every 150th plus ask/index.json, eras.json, lxx.json, themes.json) downloaded with `?v=514b1f3bf2b1`: 19 of 19 SHA-256 match.
- The live main chunk contains the netbible.org strings from PR #46.
- Counts live: 344,799 cross-references, 31,102 verses, 300,821 Hebrew, 4,827 Aramaic and 137,646 Greek words, 0 unmapped rows.
- `data/ask/meaning.json` (3,906,877 bytes) is served but is not in meta.json's file list, because `web/scripts/ask-meaning.mjs` writes it during `npm run build`, after `atlas build` and `atlas verify`. The service worker serves `?v=<buildId>` data cache-first (`web/public/sw.js:126-145`), and the build id does not cover `config/ask-examples.json` or the training code (`crates/atlas-cli/src/ask.rs:41-45`: only the matcher reads the examples). So a deploy that changes only the examples or the trainer would leave returning visitors on the old meaning.json. The page's `idsHash` check (`web/src/ui/ask/meaning.ts:100-132`) catches a changed question list, not changed weights.
- The NET service the reader depends on answers today: `https://labs.bible.org/api/?passage=John+3&type=json&formatting=plain` returned 200 with `Access-Control-Allow-Origin: *`, so the plain fetch path works and the JSONP fallback (which runs a script from labs.bible.org in the page) should rarely be needed. #46 says the reader was tested only against mocked answers.

## 6. Repository settings

- Public, default branch main, created 2026-10-07, license NOASSERTION on the API (the LICENSE file is MIT; NOTICE.md covers data), homepage field empty, no topics. Description: "Every cross-reference in the Bible on one map, with the original Hebrew, Aramaic and Greek under every verse."
- Branch protection: none on main ("Branch not protected"), no rulesets; every one of the 41 branches is unprotected.
- Merge options: merge commit, squash and rebase all allowed; auto-merge off; delete branch on merge off.
- Collaborators: only Sixteen1-6 (admin). Webhooks 0, deploy keys 0.
- Actions: enabled, all actions allowed, SHA pinning not required, default `GITHUB_TOKEN` permission read, cannot approve PRs. Secrets: 0. Variables: 0. Environments: 1 (`github-pages`).
- Security: secret scanning and push protection on; Dependabot alerts and security updates off; no code scanning.
- Traffic, last 14 days: 50 views (5 unique), 3,317 clones (544 unique, mostly CI and cloud sessions). 0 stars, 0 forks.

## 7. Local health on the founder's PC (Windows, native, no WSL)

Detached worktree of a46d819 in a local job's scratch folder (`wt/health-main`), with the target dir there too.
- `cargo clippy --workspace --release -- -D warnings`: passed, 1 min 25 s.
- `cargo test --workspace --release`: passed, 218 tests (199 + 18 + 1, the same counts as CI), 13 min 14 s wall time (release build, sharing the CPU with another build on the founder's PC).
- So the Rust side builds and tests natively on Windows with cargo 1.99 (msvc); README.md:81's "run everything inside WSL" is only needed for `make` and the shell script `scripts/build-wasm.sh`.
- Not run here: `make` (not installed), the data fetch and build, and the web build; CI covers them on every push.

## 8. Risks

- No branch protection and every merge to main deploys straight to the live domain. A bad push to main goes live in about 4 minutes with no review gate other than CI, which runs in parallel and does not block the deploy.
- `mirror/potion-base-8M` is meant to be pinned by commit. Branches are unprotected and nothing cleans them up today, but a cleanup of old branches could delete it and break the pin. It also adds 28 MB to every full clone.
- The custom domain is not verified on the account, which GitHub recommends to prevent takeover if Pages is ever switched off.
- Ask the Bible's meaning.json is outside the checksummed, build-id-keyed data (section 5), so it can go stale in returning visitors' service worker caches.
- The MACULA Septuagint data's license is in question upstream (item 7), unanswered for 13 days.
- The NET reader depends on a third-party service and was tested only against mocks; its JSONP fallback executes remote script.
- Node 20 based actions are deprecated (warnings on every run).
- IDEAS.md and several README figures are stale, so they mislead anyone (or any session) planning from them.
- Founder review backlog: 56 hard-verse cards and 1,264 Layers passages have no recorded human reviewer.

## 9. Founder rules found while looking

- Layers may cite only Bible-believing Christian writers (Catholic and Orthodox included when they uphold Scripture); an avoid list is enforced by the build: `config/layer-sources.json:3-5`, `config/layers.json` `_comment`, PR #38 (founder's rule 2026-10-11).
- Ask the Bible: "the framework for interpreting the Bible is the Bible", so answers are chains of Scripture only, every part tied by the Bible's own data: `crates/atlas-cli/src/ask.rs:3-5`, `config/questions.json:2`.
- The Ask note, in the founder's rewording, says the tool cannot seek God for you and does not have the Holy Spirit: PR #35.
- Hard-verse cards publish only after the founder approves each one (`reviewed_by`): PR #19, `config/hard-verses.json` `_comment`.
- Copyrighted text is never stored: the ESV (README.md, NOTICE.md:26) and the NET text, with NET notes linked, never shown: `web/src/data/net.ts:4-14`, PR #46.
- Every source is pinned by commit in `sources.json`, fetched only from github.com and checked by SHA-256; data under ODbL or from Google Maps or Google Earth is left out: README.md "How it is built", PR #5, #17.
- Uncertain things are labelled plainly with `<Unsure>`: `web/src/ui/extras/README.md:156`.
- Owner's choice on eras (Colossians placed, James, 2 Timothy and 1 and 2 Peter left without an era): `crates/atlas-cli/src/eras.rs:2075-2086`, PR #11.
