# Audit fixes plan, 20 October 2026

Bible Atlas (github.com/Sixteen1-6/BibleAtlas, live https://everyversemap.com/). This plan turns every gap in `CITATION-AUDIT.md` (beside this file) that no in-flight branch already covers into modules a build workflow can run. Each module names the audit items and founder decisions it serves, the files it owns (no other module or in-flight branch edits them while it runs), its checks and tests, its size and what it must wait for. Section 5 gives the order. Section 7 lists every audit recommendation that conflicts with a founder decision, quoting both. Section 8 records the review of the first version (22 findings) and how each was closed.

**Revised** on 20 and 21 October 2026, after that review. Two things have moved since the first version: PR #50 (LM) merged at 22:50 local time on 20 October as `2aabdcc`, so `main` now carries the Layers mend; and the commentary notice was committed at 23:40 the same night as `d12a4dd` on `commentary-notice` (29 files, not merged).

**What was read.** `CLAUDE.md` and `docs/HANDOFF.md` at `origin/main` `b6d7f1e` (read with `git show` and a `git archive` copy in a scratch folder; the local `main` checkout is 5 commits behind and was left as it is); `CITATION-AUDIT.md`; `voices\FOUNDER-DECISIONS-2026-10-20.md`; `voices\VOICES-BUILD-SPEC.md`; the in-flight workflow scripts `scripts\credits-2.js` (true-credits), `scripts\empty-2.js` (no-empty-selections) and `scripts\notice-2.js` (commentary notice) and their run results in `runs\`; the true-credits research notes (`...\scratchpad\ba\credits\dates.md`, in the sibling session's scratch folder); the uncommitted file list of the `BibleAtlas-notice` worktree. `C:\Users\shubh\Projects\bibleatlas-workfiles\2026-10-20\themes` did not exist when this was written, so the sourced-themes run's file list is not known yet (section 1 says how this plan stays clear of it).

**Read again for the revision** (all at `origin/main` `2aabdcc` unless named): the imports of `web/src/ui/ask/AskSheet.tsx`, `web/src/ui/extras/ask.extra.tsx` and `web/src/ui/Palette.tsx`, and every caller of `langName`; every `SourceNote` and `showSources(` call in `web/src`; `config/shelf.json` card ids and `config/layer-sources.json` cite ids; the notice job's `NOTICE-SPEC.md` and `check-notice.cjs` (the sibling session's scratch folder, `...\scratchpad\ba\notice\`) and the notice API as it stands uncommitted in `BibleAtlas-notice\web\src\ui\commentary\` (`accepted`, `askNotice()`, `<Commentary>`, `<Closed>`); `voices\VOICES-BUILD-SPEC.md` sections 1.2, 3.5, 5, 8.1 to 8.3 and 9; the file names in run `wf_e5046b06-4ad`'s result and `scripts\empty-2.js`; TC's `dates.md`; `CLAUDE.md` lines 15 to 49. On 21 October, after `git fetch`: the notice's commit `d12a4dd` (its file list, and the exports of `web/src/ui/commentary/state.ts` and `Gate.tsx`); the imports of every file in `web/src/ui/ask/` and of the files they import; PR #11's dates in `prs.json` (opened and merged 9 October 2026); `WordSky.tsx`, `WhyLinked.tsx`, `wordplay/Panel.tsx` 282 and 287, and the functions of `Explore.tsx`. The `themes` folder still did not exist, `true-credits` still has no commit of its own (its tip is LM's `0da9d1c`, clean worktree), TC's `CREDITS-SPEC.md` is not written yet, and no `no-empty-selections` branch exists yet.

**Nothing in the repository was changed.** Only this file was written.

**Binding decisions** (`FOUNDER-DECISIONS-2026-10-20.md`), in short:

- **10.** Credit the person who wrote the words, where the app read them, the original date and the true retrieval date.
- **11.** Cite everything; a credit tells a first-time reader who, when, what kind of work, and links to the page to check it; the evidence stays in the repository.
- **12.** Nothing a reader can click opens empty.
- **15.** No crediting of AI anywhere: "Just credit original source. The whole point is for us to be looking at original sources and this helps just compile them better. No crediting of AI." Every note must read as what its named sources say, with the sources' own words one tap away.
- **16.** Ask the Bible stays as it is.
- **17.** Theme descriptions are replaced by definitions from trusted, credited sources (a separate run).
- **18.** Every other audit question takes its recommended answer (questions 2 to 9, 11 to 13, 15 to 17), except where it would credit AI.
- **19.** "Describe what was done ('checked against the source') and never say who or what checked it; only use 'reviewed' when a person reviewed it." This settles question 11.

Also binding, from the same file: **decision 1**, the notice "the first time viewers look at commentary, any commentary" (built by `commentary-notice`), and **decision 4**, "Just cite exactly how the commentary shows" (quotations keep their own wording and punctuation).

## 0. Rules every module follows

1. **Worktree and branch.** Each module runs in its own worktree `C:\Users\shubh\Projects\BibleAtlas-af-<id>` on branch `af-<id>`, cut from `origin/main` when it starts (after the branches it waits for have merged). Copy a verified LF raw folder (`BibleAtlas-fixes\data\raw` or `BibleAtlas-layers\data\raw`) to `data\raw`, and link `web\node_modules` to `BibleAtlas-fixes\web\node_modules` with a junction. On Windows, set the three `GIT_CONFIG_*` LF variables from CLAUDE.md before `fetch` or `build`.
2. **Never push.** A module commits on its own branch with a plain subject about the visible effect, a short body and a `Co-Authored-By:` line. The integrator (section 2) opens the PR, and only with the founder's go-ahead, since a merge to `main` deploys at once.
3. **No AI credit (decision 15).** No new or changed string a reader can see credits AI. The test is one fixed list of case-sensitive credit phrases: "Drafted with", "AI help", "Claude", "AI reviewer", "AI session", "with AI", "by AI", "Not yet reviewed by a person". It is applied to credit-bearing strings only (rule 3's scope, the same as AF-CK's): `cite` and `detail` fields, `config/shelf.json`, `NOTICE.md`, `README.md`, the children of `SourceLine`, `SourceNote`, `Credit` and `Provenance`, and the `source` and credit fields of config files. It is never applied to Bible text or entry names (the BSB and the dictionaries name the city Ai), and never to Ask (rule 8): `web/src/ui/ask/*`, `web/src/ui/extras/ask.extra.tsx`, `config/questions.json`, `config/ask-examples.json` and the built `ask/` and `search/` data are exempt by path under decision 16, so Ask questions such as "Is it wrong to use AI?" and the founder's note ("even AI and algorithms", `AskSheet.tsx` 414) stay as they are. Reader text also never links a GitHub commit, PR or blob page of this repository, because those pages carry `Claude-Session:` trailers, `Co-Authored-By: Claude` lines and "Generated with Claude Code"; a file of this repository is linked as its raw file at a pinned commit (`raw.githubusercontent.com/Sixteen1-6/BibleAtlas/<sha>/<path>`), and PR numbers stay in `docs/HANDOFF.md` and the evidence files. Where text the app wrote has no source today, the module gives it a named source (fetched page, exact quote, recorded) or cuts it to what the Bible's text or a named source shows.
4. **Credit shape.** Every new credit uses the shared shape and the `Credit` and `SourceLine` components from AF-K (writer, about, work, part, written, edition, read_from, read_on or checked, url, quote). Simple: "From John Gill (1760s)." Study: writer, work, date, place. Both are tappable: one tap opens the full Deep credit in place, link and stored quote included, without changing the reader's level (decisions 11 and 15). Deep: the full line with where it was read, the read date and the exact link. Field names follow TC's `CREDITS-SPEC.md` (AF-K waits for it).
5. **Dates are true (decisions 10 and 19).** A read date is shown only where a record proves it. Otherwise the credit says "checked against the source by <date>; the date it was read was not recorded" (question 2's recommended answer, in decision 19's words) until a re-fetch records one. No date is ever guessed. No credit names who or what made a check; "reviewed" is used only for a named person's review.
6. **Evidence in the repository (decision 11).** Every fact a module researches (a writer's name, a date, a scan page, a quote, a fetched URL) goes in `docs/evidence/af-<id>-<date>.json`: URL, final URL, HTTP status, UTC time, SHA-256 of the body, and the exact quote (public domain) or a pointer (copyrighted: the heading or section and the hash, never the page's words). OpenBible.info's and CompellingTruth's own pages are always pointers (CLAUDE.md: "Nothing from those sites goes in the repository"). Evidence records describe the check ("checked against the source", "link checked", the date) and never name who or what made it, except a person's review, which names the person (decision 19).
7. **Nothing opens empty (decision 12).** Every new button, link or "All sources" target is opened in the browser check, and every work id a credit names must exist in the built `shelf.json` (AF-K's `check-credits.mjs`).
8. **Ask the Bible and the search box are not touched (decision 16; CLAUDE.md "Keep the search box as it is").** No module edits `web/src/ui/ask/*`, `web/src/ui/extras/ask.extra.tsx`, `crates/atlas-cli/src/ask.rs`, `config/questions.json`, `config/ask-examples.json` or `web/src/ui/Palette.tsx`. No module changes the output of any function or component those files import, directly or through the files they import. At `2aabdcc` that is: from `web/src/data/atlas.ts`, `langName`, `locate`, `verseIndex`, `chapterRange`, `label` and `rangeLabel`; from `web/src/ui/extras/kit.tsx`, `Passage`, `SourceNote`, `refName` and `Lead` (and `OrigLine` in `common.tsx`, which `Passage` draws, and `levelAtLeast` in `extras/level.ts`); from `extras/Sheet.tsx`, `Shell`; from `extras/data.ts`, `loadJson`; from `extras/open.ts`, `closeExtra`, `openPanel` and `setOpener`; `defineExtra` from `extras/types.ts`; `readerHere` from `extras/first-move.ts`; from `web/src/ui/ThemeThread.tsx`, `PreviewRow` (and its `useHoverPreview`); from `web/src/depth.ts`, `atLeast` and `deepen`; from `web/src/ui/common.tsx`, `useVerseLoad` and `NOT_LOADED`; `web/src/state.ts`; and `web/src/data/plain.ts`, `search.ts`, `thread.ts` and `text.ts`. A module that needs different output adds a new function beside the old one and calls it only from its own files (as AF-LX does with `langLabel` in `lex.ts`). Gate G's Ask and search capture proves it. The Ask and palette items are held (section 4).
9. **The extras rules and the founder's rules stand:** one quiet line, only where it applies, under about 70 characters, no jargon; Christian writers only at Deep after the notice; cite only Bible-believing writers; ancient texts only as witnesses; copyrighted works linked, never copied; the NET and the ESV never stored; plain English, no em dashes in what the app writes, no emoji.
10. **Commentary only behind the notice (decision 1).** The notice (`commentary-notice`, spec `NOTICE-SPEC.md` section 1) leaves some surfaces open because today they hold only facts about the text: the Aramaic notes, quotations, parallels, places, roads and paths, themes, the alphabet poems, word meanings, "Outside the Bible", "In their world", Nave's rows, the short "When ... · Written ..." line and the shelf cards. A module that adds to one of those surfaces a line that reports a writer's view, or quotes a commentary, study note or Bible dictionary (Tyndale, Easton, Smith), shows that line only through the notice's gate: inside the notice's `<Commentary line button>` block, or through `useGate()` (its `open` and `ask`), so that nothing of it renders while `accepted` is false and `askNotice()` has not resolved true (the names as committed in `d12a4dd`, `web/src/ui/commentary/state.ts` and `Gate.tsx`; if the notice's review renames them, the module uses the merged names). Otherwise it cuts the sentence to what the text shows, which also fits decision 15. Each new gated spot is added to the notice's list of gated surfaces and to its browser check (today `check-notice.cjs` in the notice job's scratch folder; the first module that needs it copies it to `bibleatlas-workfiles\2026-10-20\audit-fixes\tools\`). Naming a source as a credit ("From John Gill (1760s)") is not a view and stays open; lexicon meanings stay open as the notice's line rules (its spec's question 3, for the founder). Modules this bites: AF-X, AF-PA, AF-AR, AF-WP (they wait for `commentary-notice`); AF-ER and AF-PL keep to the notice's line as written in their sections.
11. **A cut never leaves an empty selection (decision 12).** When a module drops a passage, a link, a sentence or a note, and that leaves a set with fewer than two passages, a passage with no link, or an empty note, the line or chip that opened it is removed with it, or a sourced replacement is found. The browser check opens every verse the cut touched.
12. **Check the branches in flight before starting and before committing.** Each module lists the files every in-flight branch has changed: `git -C C:\Users\shubh\Projects\BibleAtlas diff --name-only origin/main...<branch>` for `true-credits`, `commentary-notice`, `no-empty-selections` and any WD or sourced-themes branch that exists (these branches are local and never pushed), plus `git -C <worktree> status --short` for their worktrees (`BibleAtlas-credits`, `BibleAtlas-notice` and any later one), since a run may hold work it has not committed. For `no-empty-selections`, until its fix commit exists, the provisional list in section 1 counts too. If any owned file is on a list, the module waits for that branch to merge. A module that "waits for nothing" below still runs this check, before it starts and again before it commits, and records both lists in its `pr.md`.

**The standard gate (G)**, run by every module before it commits:

- `cargo clippy --workspace --release -- -D warnings` and `cargo test --workspace --release`;
- `atlas build` and `atlas verify` (every check passes; the new count recorded against the count on `main` when the module started);
- `npm run build` in `web/` (`tsc --noEmit`, and the Ask matcher's 70% check, which must be unchanged);
- **Ask and search unchanged (rule 8):** the tool in `bibleatlas-workfiles\2026-10-20\audit-fixes\tools\` (written once by the first module that runs) builds the web app on the module's base commit and on its commit, and for 20 fixed Ask questions (opened at Deep, so every tie reason such as "shares the Aramaic word ..." shows) and 20 fixed search queries (listed in `same-ask-queries.json`, at least five whose rows or ties name an Aramaic word), captures the text of `AskSheet` and of the palette's rows. The two captures match byte for byte;
- `node web/scripts/check-credits.mjs` once AF-K has landed;
- once AF-K has landed: every `Credit` on the module's verses, tapped once at Simple, shows its exact link (the `href` equals the cite's `url`);
- browser checks at 1440x900 and 390x844, light and dark, Simple, Study and Deep, with no console errors, on the verses the module names;
- for a module under rule 10: with storage cleared, no writer's view and no commentary or dictionary quotation shows on its surfaces before the notice is finished, at any level; after finishing, they show;
- a scan for rule 3's credit phrases, in rule 3's scope, over the changed files and the built data: 0 new hits;
- a scan for U+2014 over the strings the app writes (UI strings, credits, notes the app wrote, config prose such as `note`, `deep`, `line`, `what` and `plain`): 0 new hits. Quotations and source text are exempt by field (`quote`, stored writers' words, the Bible text, the hard-verses and notes extras' source words), because decision 4 says to cite "exactly how the commentary shows"; a builder never changes a quotation to pass this scan;
- `git status` shows only the module's files, its evidence file and its fragments folder; nothing under `web/public/data/` or `data/`.

## 1. Already covered by work in flight (not in this plan)

| Branch or run | Covers (audit items) | Files it holds, so the modules here wait |
|---|---|---|
| `layers-mend-2026-10-20`, PR #50 (LM), **merged** 20 October 2026 as `2aabdcc` | C2 for the 147 round 1 notes; C3 in part (350 cites added for checked notes); 608 dated evidence records; Ellicott on Malachi 3:1 removed (D1) | nothing now; it is on `main` |
| `true-credits` (TC), built on LM (worktree `BibleAtlas-credits`; research done, design not yet written) | B2 (true writer per book), the Layers half of C1 (original dates, honest read labels), C4 (chapter and entry links, proposed), question 4, removal of every AI-drafting line (Layers passage lines, `Layers.tsx` 260, the hard-verses and hard-passages credits), the CLAUDE.md and HANDOFF rule on AI drafting, Layers facts for the shelf and NOTICE. Its Design phase writes `CREDITS-SPEC.md` in the TC job's scratch folder (`...\scratchpad\ba\credits\`), which fixes the citation shape AF-K uses | `config/layer-sources.json`, `config/layers.json`, `crates/atlas-cli/src/layers.rs`, `web/src/data/layers.ts`, `web/src/ui/Layers.tsx`, `config/hard-verses.json` (source lines), `web/src/ui/extras/hard-verses/Panel.tsx`, `web/src/ui/extras/hard-passages/Panel.tsx`, `config/shelf.json`, `NOTICE.md`, `CLAUDE.md`, `docs/HANDOFF.md` (scripts `credits-2.js`, Build phase) |
| `commentary-notice`, committed as `d12a4dd` (20 October 2026, 23:40; not merged) | the two-page notice before any commentary (not a credit; adjacent to A1 and B5). Its API at `d12a4dd`: `accepted` (signal), `askNotice()`, `useGate()`, `<Commentary line button>`, `<Closed>`, `CommentaryFoot`, the `commentary` flag on an extra (`extras/types.ts`). Its spec leaves open the surfaces listed in rule 10 | the 29 files of `d12a4dd`: `web/src/main.tsx`, `ChapterWhen.tsx`, `Dictionary.tsx`, `Layers.tsx`, `Sources.tsx`, `extras/README.md`, `extras/Sheet.tsx`, `extras/VerseExtras.tsx`, `extras/types.ts`, `dictionary.extra.tsx`, `dictionary/Panel.tsx`, `dictionary/model.ts`, `hard-passages/Panel.tsx`, `hard-verses.extra.tsx`, `hard-verses/Panel.tsx`, `notes.extra.tsx`, `notes/Panel.tsx`, `notes/model.ts`, `voices.css`, `voices.extra.tsx`, `voices/Panel.tsx`, `voices/model.ts`, `wordplay.extra.tsx`, `wordplay/Panel.tsx`, `wordplay/model.ts`, and new `web/src/ui/commentary/` (`Gate.tsx`, `Notice.tsx`, `commentary.css`, `state.ts`) |
| `no-empty-selections` (run `wf_e5046b06-4ad`; no branch yet, fix phase not yet run) | decision 12 for Wesley's bare references (139), Henry's Isaiah 36 pointer (22), pointer-only study notes (72), undrawable places (35), redirect-only dictionary entries (83) | **provisional until its fix commit exists**, from the run's named fix sites: `crates/atlas-cli/src/extra_voices.rs`, `extra_notes.rs`, `extra_real_map.rs`, `extra_dictionary.rs`, `verify.rs`, `voices.extra.tsx`, `voices/model.ts`, `notes.extra.tsx` (62 to 68, "A study note on ..."), `notes/Panel.tsx`, `notes/model.ts`, `dictionary/Panel.tsx`, `dictionary/model.ts` (the redirect fix, "list the entry it names instead"), `real-map.extra.tsx`, `real-map/MapPanel.tsx`, `real-map/model.ts`, `real-map/places.ts`, `web/src/data/shelf.ts`. Its browser sweep in `scripts\empty-2.js` (Links, Word, Themes, Paths and Top verses tabs, the theme and word chips, the Sources shelf, the map) has not run, so fixes may also land in `Explore.tsx`, `Connections.tsx`, `VerseThemes.tsx`, `WordStudy.tsx` or `Sources.tsx`: rule 12 catches those |
| Writers at Deep (WD, `voices\VOICES-BUILD-SPEC.md`, not started) | B5 in part (`copy` names the copy used; `lines` give translator, volume and part-writer, including Henry's complete commentary's continuators; `who` notes for about 9 Catena names), B13 cards for its six new works, its own avoid check | `extra_voices.rs` and `extra_voices/*`, `config/voices/*`, `config/voices-exclusions.json`, `voices.extra.tsx`, `voices/*`, `voices.css`, `.github/workflows/mirror-sword-modules.yml`, `Cargo.toml`, `Cargo.lock`, line 412 of `build.rs` (V1); its integrator VI edits `sources.json`, `NOTICE.md`, `config/shelf.json`, `config/layer-sources.json` and `docs/HANDOFF.md` section 0 in each of its PRs; V12 edits `config/layers.json` (Ecclesiastes). Its new cards (spec 3.5 and 5): `calvin-commentaries`, `jfb`, `henry-complete`, `barnes-nt`, `luther-galatians`, `luther-genesis`, and an update to the existing `keil-delitzsch` |
| Sourced themes (planning; folder not yet written) | A5's theme descriptions (decision 17) and question 14 | not known yet. This plan assumes it will hold `config/themes.json`, `config/theme-related.json`, `crates/atlas-cli/src/themes.rs`, `themes_review.rs`, `web/src/data/themes.ts`, the theme functions of `Explore.tsx` (`ThemeChips`, `ThemeList`, `WordsTraced`, `ThemeSource`, `Themes` and the theme-list signals at the top of the file), `ThemeThread.tsx`, `VerseThemes.tsx`, `ThemeSky.tsx` and `extras/themes.extra.tsx`, and that it will add shelf cards and NOTICE rows for the trusted sources behind its definitions. AF-TS waits for it; AF-X owns only the road and hub functions of `Explore.tsx` (`EXAMPLES`, `Step`, `Paths`, `Hubs`) |

## 2. Shared files and the integrator (AF-INT)

`config/shelf.json`, `NOTICE.md`, `README.md`, `config/layer-sources.json` (after TC merges), `CLAUDE.md` and `docs/HANDOFF.md` are edited by many modules and by WD's integrator. No module commits them. Each module writes what it needs as a fragment in `C:\Users\shubh\Projects\bibleatlas-workfiles\<date>\audit-fixes\<id>\` (`shelf-cards.json` as whole card objects with the fields to change, `notice.md`, `readme.md`, `layer-sources.json`, `claude-md.md`, plus `counts.json` and `pr.md`). A module may edit a shared file locally to run `atlas build`, but never commits it.

**AF-INT** owns those six files. For each PR in section 5 it applies that module's fragments to the current `main`, runs gate G and writes the PR body (Before / After / How / Checks, with exact counts, naming the decision it carries out).

**One holder per shared file, counting every branch in flight.** A shared file is held by at most one open branch at a time. The branches that count are this plan's PRs and every branch in section 1: TC (from now until it merges it holds `config/shelf.json`, `NOTICE.md`, `CLAUDE.md`, `docs/HANDOFF.md` and `config/layer-sources.json`), `commentary-notice`, `no-empty-selections`, each WD PR (VI edits `sources.json`, `NOTICE.md`, `config/shelf.json` and `config/layer-sources.json`) and sourced themes (expected to add shelf cards and NOTICE rows). Whichever opens second waits or rebases.

**Shelf and NOTICE fragments go only onto a main that has TC merged.** A module whose PR merges before TC carries only its own files. AF-INT holds its `shelf-cards.json` and `notice.md` fragments and applies them in **PR H**, the first PR after TC merges (cards and NOTICE lines only, each one checked as its module recorded it). A module whose PR comes after TC carries its own fragments. Where a module's surface needs a card that does not exist on `main` yet (AF-X's Treasury card), that module's PR waits for TC instead, so "All sources" never opens a missing card (decision 12). As section 5 stands, PR H carries the held fragments of AF-BT (NOTICE line 85; the BSB, TAHOT and Clear cards), AF-DT ("kept up to date" and "This copy"), AF-LX (the tbesg and tbesh cards and NOTICE lines), AF-AR (the witness cards; penner-names removed) and AF-ER (the Tyndale card), or fewer if TC merges earlier. A held fragment only changes card and NOTICE text, so the surfaces that link those cards already work before PR H (each of those card ids exists on `main` today). AF-BT's new `esv` card waits for AF-SH's PR, which brings the filter that hides it on Pages builds.

**Theme text on the shelf comes from the themes work.** No module here writes what a theme card says, or what `config/themes.json` and `config/theme-related.json` hold, because the sourced-themes run replaces what `themes.json` holds (decision 17). The sourced-themes run (or AF-TS, if that run leaves it) hands AF-INT the theme-lists card and the Checks sentences for those two files, and AF-INT applies them in AF-TS's PR. Until then AF-SH names the two files and nothing more.

**`docs/HANDOFF.md` section 0 is rewritten only at merge time.** CLAUDE.md requires each PR to rewrite it. AF-INT does that as the last commit of the PR that merges next, after rebasing it on the then-current `main` and just before the founder's go-ahead to merge, so open PRs never fight over it. This holds for the notice, no-empty-selections and WD's PRs too; AF-INT tells their runs so in each PR body it writes.

**`sources.json` is shared too**, under the same one-holder rule, not owned outright by AF-DT. AF-DT adds the date fields to every entry and lands before the first WD PR that adds an entry (PR-4, Calvin, in WD's order). Its PR body, and a one-line amendment to `VOICES-BUILD-SPEC.md` 8.3 that the founder or WD's run makes (not this plan), require the three date fields in every `source.json` fragment: "`source.json` (the `sources.json` entry, with `original` {by, work, date}, `version` and `copied` as AF-DT defines them)". The sourced-themes run is told the same. `sources.rs` first only warns about an entry without the fields; AF-CK turns the warning into a refusal once no open branch (WD, sourced themes) adds an entry without them.

**`crates/atlas-cli/src/build.rs` is shared by line.** AF-LX (about lines 466 to 469, the lexicon entry), AF-DT (the meta lines, about 525 to 545), AF-WR (at most one line) and WD's V1 (line 412) each edit only their own lines, rebase on the latest `main` before committing, and say in the PR body which lines they changed. `main.rs` (AF-K's `mod cite;`) and `verify.rs` (AF-CK's one line, and no-empty-selections' checks) are shared the same way. Whether CLAUDE.md's shared-code limit binds these edits is an open founder point (section 7, conflict 12).

**`web/src/ui/Explore.tsx` is shared by function**, not by line, because line numbers move: AF-X edits `EXAMPLES`, `Step`, `Paths` and `Hubs`; the themes work (sourced themes, then AF-TS) edits `ThemeChips`, `ThemeList`, `WordsTraced`, `ThemeSource`, `Themes` and the signals at the top. Each rebases on the latest `main` before committing.

**One shelf card per work.** A work cited in Layers has exactly one card, keyed by its cite id in `config/layer-sources.json` (after TC, its per-book ids): the card names that id in a new field, `layer` (for example `"layer": "jfb"`), and `shelf.rs` refuses two cards with the same `layer` id. Where WD's spec already names a card id for the work, that id is used, so WD's work configs need no change. If AF-SH lands first, it creates the card with the Layers count under that id, and WD's VI extends it (`datasets`, `licenseNote`, `copy`, `citation`, `find`) instead of adding one. If WD's card exists first, AF-SH adds `layer` and the Layers count to it. The overlapping works, as both plans stand: `jfb` (WD `jfb`), `keil-delitzsch` (the existing card, which WD updates), `barnes` for Albert Barnes's own New Testament notes (WD `barnes-nt`; the parts TC credits to Murphy, Pusey and others get their own cards), `henry` (WD `henry-complete`), `calvin` (WD `calvin-commentaries`), `wesley` (the existing `wesley-notes`), `henry-concise` and `catena-aurea` (existing cards), and `luther` (WD's PR-7 cite entry; its card is the one for the work the cite names). AF-INT sends this rule to WD's integrator as a fragment rule (`audit-fixes\int\wd-card-rule.md`) with that list.

## 3. The modules

Ids start with AF- so they cannot be confused with WD's V0 to V12. Sizes are the audit's: S is a few lines in one to three files (under half a day with checks); M is a data field, build code, UI and verify for one surface (one to three days); L needs reading or research per item (a workflow over several days).

### AF-K. The credit kit: one shape, one credit line, the right "All sources" card

- **Serves.** "Build this first" (the shared shape and the credit line, for every surface outside Layers); C5 (the component part); decisions 10, 11 and 12.
- **Owns.** New `web/src/ui/extras/credit.tsx` (`Credit`, which renders one citation by level, and `SourceLine({ work })`, which replaces `SourceNote` and calls `showSources(work)`); new `web/src/data/cite.ts` (the TypeScript citation type); new `crates/atlas-cli/src/cite.rs` (the citation type and checks for config files other than Layers); one line `mod cite;` in `crates/atlas-cli/src/main.rs`; new `web/scripts/check-credits.mjs`; one script line in `web/package.json` (`check:credits`).
- **Does.**
  - The line by level: Simple "From John Gill (1760s)."; Study "John Gill, An Exposition of the Old Testament (about 1763 to 1766), on Genesis 3:15."; Deep "John Gill, Baptist pastor in London, An Exposition of the Old Testament (about 1763 to 1766), on Genesis 3:15. Read on Bible Hub, in Larry Pierce's modernised text, 20 October 2026." plus "Read it there", linked to the exact page.
  - **One tap to the source (decisions 10, 11 and 15).** At Simple and Study the line is a button, not a tooltip. One tap opens the full Deep credit in place: writer, about, work, part, edition, read_from, written, read_on (or the checked label of rule 5), the exact link, and the stored public-domain quote where the caller passes one. The reader's level does not change, and a second tap closes it. The first screen stays calm, because nothing more shows until the tap. Both dates of decision 10 are in the opened credit at every level.
  - **Quotes and the notice.** The caller passes the stored quote. On a surface the notice leaves open (rule 10), a caller passes no commentary or Bible-dictionary quote unless it wraps the `Credit` in the notice's gate, so AF-K itself needs nothing from the notice.
  - No AI line (decision 15; the audit's AI line is dropped, section 7, conflict 1).
  - `cite.rs` checks:
    - a writer, or "unsigned" with a publisher;
    - a written date;
    - `read_on` as an ISO date not in the future, or `checked` (an ISO date, shown as "checked against the source by <date>; the date it was read was not recorded", rule 5), or "not recorded";
    - no `url` that is a work's home page (a listed set, starting with `https://www.studylight.org/commentaries/eng/bul.html` and the archive.org front page of Figures of Speech);
    - none of rule 3's credit phrases in any field (a citation's fields hold credits only, never Bible text or entry names, so the city Ai cannot trip it), and no field naming who or what made a check (decision 19).
  - `check-credits.mjs`:
    - every `work` passed to `SourceLine`, `Credit` or `showSources` in `web/src` is a card id in the built `web/public/data/shelf.json`; every `Credit` href is not a listed home page;
    - ids that are not literals are validated from their data: `showSources(l.shelf)` from the `shelf:` values in `web/src/ui/extras/voices/links.ts`, `showSources(w.shelf)` from the `shelf` fields of `config/voices/*.json`, `showSources(dict, slug)` from the dictionary ids the build ships; anything left is opened in the browser check;
    - it lists, as a warning, every `SourceNote`, every `<Provenance>` with no `work` (the Hubs and Themes footers, `Explore.tsx` 259 and 410) and every `showSources()` with no work, outside `web/src/ui/ask/*` and the definitions in `kit.tsx` (each still opens the top of the shelf, C5). At `2aabdcc` that is 14 SourceNotes in 12 files (aramaic (2), dictionary, hard-passages, hard-verses, notes, parallels, peshitta, quotes, real-map, themes.extra, voices, wordplay (2)) and 3 Provenance lines with no work (`Explore.tsx` 259 and 410, `WordSky.tsx` 246). AF-CK turns the warning into a failure once every surface module has swapped them (section 6, C5).
  - Field names are taken from TC's `CREDITS-SPEC.md`, so Layers and every other surface show one shape, fixed before any config adopts it. AF-K copies the spec it used into its fragments folder, because TC's scratch folder may be cleaned up.
  - **Spine.** `kit.tsx` is a spine file, and CLAUDE.md says "no change to the spine files". So the component goes in a new file, and `kit.tsx` stays as it is (section 7, conflict 9; it also keeps Ask's `SourceNote` unchanged, rule 8).
- **Checks and tests.** G.
  - Rust tests for each `cite.rs` rule (missing writer, "unsigned" with no publisher, a listed home page, a future date, a non-ISO date, a planted credit phrase from rule 3's list, a checker's name: each refused; a work title holding "Ai" passes).
  - `check-credits.mjs` fails on a planted wrong id in a fixture (a literal one and one in a `links.ts` fixture) and passes on `main` apart from the listed warnings.
  - The three levels, and the one-tap opening at Simple and Study, are shown once in a local, uncommitted demo panel; screenshots go in the PR.
- **Size.** M.
- **Waits for.** TC's Design phase output, `CREDITS-SPEC.md` (not TC's merge), which is cheap and comes first in TC's run. AF-Q, AF-SY, AF-PA and AF-AR wait for AF-K, so no config file takes up the audit's field names before the shape is fixed. It touches no in-flight file (rule 12 still runs).

### AF-BT. Bible text and word-for-word credits (first PR: the NET line is a permission term)

- **Serves.** B12, B8, C7 (gloss markers `<the>`, `<obj.>` and square brackets; the word tooltip's "HTd/Ncmpa"), C10 (the Clear alignment link at the pin); decisions 10 and 11.
- **Owns.** `web/src/data/net.ts`, `web/src/ui/Reader.tsx`, `web/src/ui/Pairs.tsx`.
- **Hands the integrator** (held for PR H, because AF-BT merges before TC; section 2). `NOTICE.md` line 85 (the "To see the NET Bible study tool" sentence the NET page does not contain). Shelf cards: the BSB card (translator committee, 2016, public domain since 2023); the Leningrad Codex date on the TAHOT card, after a catalogue check (recorded in evidence, so AF-SH does not redo it); the Clear card's dates. A new `esv` card for server deploys (B12, A17: "No ESV card for server deploys"): the English Standard Version, Crossway (first published 2001, checked against Crossway's copyright page), with the notice Crossway asks for, read live through the server one chapter at a time and never stored; it holds no ESV text, and it carries `"when": "esv"` so the shelf shows it only when `ESV_ENABLED` is true (`web/src/data/esv.ts`), never on Pages builds. Because that filter is AF-SH's (`Sources.tsx`), AF-INT applies the `esv` card in AF-SH's PR, not in PR H.
- **Does.**
  - The NET credit word for word as the publisher asks: "Scripture quoted by permission. Quotations designated (NET) are from the NET Bible® copyright ©1996, 2019 by Biblical Studies Press, L.L.C. http://netbible.com All rights reserved." Then "Read live from labs.bible.org." The "(NET)" link and the storage rules stay as CLAUDE.md says.
  - BSB: "English: Berean Standard Bible, by the Berean Bible Translation Committee (2016; public domain since 2023)", opening its card.
  - Hebrew: "Leningrad Codex (about AD 1008), tagged by STEPBible (TAHOT, CC BY 4.0)", after the date is checked against a catalogue record.
  - Word by word: "Word for word: STEPBible's English for each word (Tyndale House, version of 5 Oct 2026)", with a key: "[ ] words added for sense; < > a word English does not translate".
  - The tooltip codes in words, from STEPBible's own morphology key, credited.
  - The pairs note: "Links made by hand by the Berean Bible team (Greek) and BiblioNexus (Hebrew), published by Clear Bible / Biblica. Version of 11 May 2026, read 8 Oct 2026. The 18,945 links the app could not place are left out.", linked to the pinned tree `c99bd0ae`.
- **Checks and tests.** G.
  - The NET string is compared character for character with the NET copyright page fetched that day (recorded in evidence).
  - A script confirms that no NET text enters the build output or the service worker.
  - Browser: Genesis 1 and John 3 in BSB and NET, Word by word on at Study, the pairs note, the tooltip on a Hebrew word.
- **Size.** S.
- **Waits for.** Nothing (rule 12 still runs). It is the first PR, and it carries only its three owned files.

### AF-X. Cross-reference credit: the Treasury of Scripture Knowledge, OpenBible.info as score publisher, one description of votes

- **Serves.** B1 (every link surface outside the theme files, `WordSky.tsx` and `WhyLinked.tsx` included); A4 (the map parts: the dashed-arc key, the PageRank strip, the arc tooltip); C12 (outside the Themes tab); A11 (the road captions); C10 (a per-verse link to OpenBible.info); C13 (the depth hints); C6 and C7 (the `WordSky.tsx` tooltip and the raw "TBESG" in `WhyLinked.tsx`); C5 (Hubs and Paths open the right card); question 8.
- **Owns.** `web/src/ui/Connections.tsx`, `Wheel.tsx`, `WheelCards.tsx`, `Roads.tsx`, `AtlasMap.tsx`, `App.tsx`, `WordSky.tsx`, `WhyLinked.tsx`, `web/src/depth.ts` (the `DEPTH_INFO` strings only; `atLeast`, `deepen` and `TAB_DEPTH` are unchanged, since Ask imports the first two, rule 8), and in `web/src/ui/Explore.tsx` the functions `EXAMPLES`, `Step`, `Paths` and `Hubs` (shared by function, section 2). The theme functions are left for the sourced-themes run and AF-TS.
- **Hands the integrator** (in its own PR, which comes after TC). A new Treasury of Scripture Knowledge card, with title page, contributors and publisher checked against an Internet Archive scan (the audit quotes "Canne, Browne, Blayney, Scott, and others", Samuel Bagster and Sons). The openbible-xref card's text naming the Treasury and the score. `README.md` 195 (AF-X alone; AF-SH does not touch that line). A NOTICE row naming the Treasury as the source of most links.
- **Shared wording** (AF-W and AF-TS use the same words):
  - **Credit:** "Links: mostly the Treasury of Scripture Knowledge (<date from the scan>), as published with scores by OpenBible.info (file of 4 November 2024, CC BY 4.0)."
  - **Score, defined once:** "OpenBible.info's score for this link on 4 November 2024: readers' votes added to starting votes OpenBible.info gave from its own Topical Bible and Twitter search." Short form on rows and tooltips: "score 204 (OpenBible.info, 4 Nov 2024)".
- **Does.**
  - Every link surface uses the one credit and the one score wording.
  - "A link means readers judged two passages related", "Ribbons join books that cite each other", "links readers voted up", "reader-voted", "community votes" and "net votes" are replaced with true wording ("joined by the Treasury or by OpenBible.info's readers"; "books whose verses are cross-referenced"; "the highest-scored links").
  - Map:
    - dashed-arc key: "Dashed: a link a Layers of meaning note makes, from the writers it cites; not in the cross-reference list." (no AI);
    - the strip is titled "Most linked-to verses (PageRank)", with the Study line "Brighter: verses more linked to, by PageRank.";
    - the tooltip reads "score 204 on OpenBible.info, 4 November 2024".
  - C12:
    - "Most linked-to verses (PageRank)" with "It measures links, not importance" under each list;
    - the rank beside the count, or the order explained;
    - "central" reworded;
    - "PageRank, after Brin and Page (1998)" at Deep, with damping and iterations moved there from Study;
    - road steps read "score 5 (OpenBible.info, 4 November 2024)";
    - the drawn count shown at Simple and in the `App.tsx` header.
  - A11: each road caption in the two ends' own BSB words, for example "'He will crush your head' to 'that ancient serpent'". A pair whose ends share no wording is captioned with its two references alone. No caption names a writer's reading: the Paths tab is a surface the notice leaves open (rule 10), and decision 15 asks that notes read as what their sources say.
  - `WordSky.tsx` (about line 294): the title-only tooltip "Bible readers have linked these two verses too, so the map already joins them." becomes visible text in the shared wording ("already linked: a cross-reference joins these two verses, mostly from the Treasury").
  - `WhyLinked.tsx` (about line 126): "in STEPBible's TBESG" is written out ("Abbott-Smith's notes on Septuagint usage, in STEPBible's Greek lexicon (Tyndale House, CC BY 4.0)").
  - `WordSky.tsx` (about line 246): the "How are echoes found?" Provenance gains a work (`tahot` on an Old Testament word, `tagnt` on a New Testament one), and "(TAHOT, TAGNT)" is written out ("STEPBible's tagged Hebrew and Greek texts, Tyndale House").
  - C5: Paths and Hubs end with `SourceLine` on the Treasury card (`openbible-xref` for the scores); the Hubs Provenance (`Explore.tsx` 410) is replaced, its PageRank details moved to Deep as above.
  - Connections: "See this verse's links on OpenBible.info" (`https://www.openbible.info/labs/cross-references/search?q=Isaiah+53%3A5`, checked).
  - Depth hints: "Deep adds manuscripts, every link, the numbers and full citations"; "Simple shows the English and its most-voted links".
- **Checks and tests.** G.
  - A script finds 0 hits for "readers judged", "voted up", "community votes", "net votes", "reader-voted" and "Bible readers have linked" in the owned files.
  - Every quoted caption word is found in the BSB data.
  - The Treasury card is in the built shelf, and every new "All sources" opens it.
  - Evidence: the Internet Archive scan (item id, page, UTC time, and the title page's words, which are public domain) and OpenBible.info's own description of its data and votes, recorded as URL, final URL, UTC time, SHA-256 and a pointer to the section, never its words (rule 6).
  - Browser: Isaiah 53:5 (map tooltip, Connections, the OpenBible link), the Wheel and its cards, the default road, Paths, Hubs, the "already linked" mark at 390 width (seen without hover), a Septuagint bridge in `WhyLinked`. With storage cleared, no writer's view shows on any of these before the notice (rule 10).
- **Size.** M.
- **Waits for.** TC merged (its new card and NOTICE row need a main that has TC, section 2) and `commentary-notice` merged (rule 10). `Explore.tsx` is shared by function: if the sourced-themes build already holds the whole file when AF-X starts, AF-X's `Explore.tsx` items (the `EXAMPLES` captions, the `Step` score wording near "score", "Votes come from OpenBible.info readers", "reader-voted", the Hubs PageRank title and caveats, and the C5 line) wait for sourced themes to merge and then go in as a small follow-up PR of AF-X's own. Nothing of them is handed to AF-TS.

### AF-W. The Welcome card and the page description

- **Serves.** A4 (the Welcome line, the three starters, "Quoted centuries later", the `web/index.html` description); A17 (the page's "a source for everything" promise); question 8.
- **Owns.** `web/src/ui/Welcome.tsx`, `web/index.html`.
- **Does.**
  - The line becomes "Each arc is a cross-reference, mostly from the Treasury of Scripture Knowledge, as OpenBible.info publishes them with scores. Every panel ends with its sources."
  - The starters:
    - Isaiah 53:5 to 1 Peter 2:24, "(the BSB's own footnote)";
    - John 3:14 to Numbers 21:9;
    - Genesis 22:8 to John 1:36, "linked by the cross-references (score 13)".
  - "Quoted centuries later" becomes "Quoted in 1 Peter 2:24, as the BSB's footnote shows".
  - The meta description becomes "344,799 cross-references from the Treasury of Scripture Knowledge and OpenBible.info on one map, with the Hebrew, Aramaic and Greek, and the source of each fact." It changes in the `og:` and Twitter tags too, if present.
- **Checks and tests.** G.
  - A script checks each starter's footnote and score in the built data.
  - The first visit stays calm at Simple, and nothing extra loads.
- **Size.** S.
- **Waits for.** AF-X's wording. It goes in the same PR, so it waits for what AF-X waits for.

### AF-Q. Quotations

- **Serves.** A10, C10 (a link to the BSB footnote), C5 (opens the `bsb` card); decision 11.
- **Owns.** `web/src/ui/extras/quotes/Panel.tsx`, `quotes/model.ts`.
- **Does.**
  - The grades become "Same wording in the BSB", "Close wording in the BSB" and "Different wording in the BSB".
  - The caveat that the comparison is of the BSB's English shows on every card that is not word for word.
  - The echo hint becomes: "An echo: the BSB's footnote points here ("See ..."), but the words are not clearly quoted."
  - The quote and echo rule is explained in one line at Study.
  - A link to the chapter page that shows the BSB footnote, checked.
  - `SourceLine work="bsb"`.
- **Checks and tests.** G.
  - The counts are unchanged under the new names (96, 188 and 44 of 328).
  - Each new link returns 200 and shows the footnote.
  - Browser: one card of each grade and an echo.
- **Size.** S.
- **Waits for.** AF-K.

### AF-SY. The Syriac

- **Serves.** A13, C10 (a per-book Syriac link), C5 (`dsc-peshitta`); decision 11.
- **Owns.** `web/src/ui/extras/peshitta/Panel.tsx`, `peshitta/model.ts`, `crates/atlas-cli/src/extra_peshitta.rs`.
- **Does.**
  - "Translated around AD 350 to 450, as the Digital Syriac Corpus dates it."
  - For the later books and their date: quote a named source (the 1905 British and Foreign Bible Society edition's preface, read from its scan), or drop the century and say the date is unsure.
  - Per-book links where the corpus has stable URLs.
  - The Peshitta stays labelled a later translation (CLAUDE.md).
  - C5: the SourceNote at `peshitta/Panel.tsx` 116 becomes `SourceLine work="dsc-peshitta"`.
- **Checks and tests.** G.
  - Evidence: the corpus header quote and the preface quote.
  - Browser: Matthew 1 and 2 Peter 1 at Deep.
- **Size.** S.
- **Waits for.** AF-K.

### AF-PA. The parallels notes

- **Serves.** A9, C10 (links to the BSB's headings and footnotes), C5 (`bsb`); decisions 11 and 15.
- **Owns.** `web/src/ui/extras/parallels/notes.tsx`, `parallels/Panel.tsx`, `parallels/Compare.tsx`, `config/parallels.json`, `crates/atlas-cli/src/extra_parallels.rs`.
- **Does.**
  - The "What kind of parallel" notes move out of `notes.tsx` into `config/parallels.json` (which AF-PA owns), so `extra_parallels.rs` can check them; `notes.tsx` renders them from the built data.
  - Each kind note keeps to what the texts show where it can ("Both passages tell the same event; Luke's is longer"). A note that quotes a shelf work word for word (as the eras table quotes the Tyndale dictionary), or that names the writers who hold a view, is shown only through the notice's gate (rule 10): the parallels panel is a surface the notice leaves open.
  - "Most think one writer used the other" says "scholars differ" alone on the open panel, or names cite-list writers inside the gate.
  - The same for the three "Not counted here" reasons resting on "most take", "most read" or "scholars differ" (Luke 7:36).
  - Each of the 34 passages "added by hand" gets its own source in the AF-K shape in `config/parallels.json` (a BSB heading or footnote, a Treasury cross-reference with its score, or a cite-list commentary naming the pair, fetched and quoted). A passage with no source is dropped. If that leaves a set with fewer than two passages, the set and its line and chip are removed with it, or a sourced replacement is found (rule 11).
  - The credit: "Parallels named in the BSB's section headings (2016; copy of 26 August 2024); 34 passages added for this app, each with its source at Deep." No AI. C5: `SourceLine work="bsb"`.
  - The manuscript labels are credited: "STEPBible's Greek New Testament (TAGNT) marks this ...".
- **Checks and tests.** G.
  - New verify checks: every added passage has a source; every set has at least two passages; every quotation in a kind note is found word for word in its shelf work's pinned text, or, for a page that is not pinned, in the stored quote of its evidence record.
  - Browser: 1 Chronicles 16:34 with Psalm 106:1, Luke 7:36, a Synoptic set, and every verse whose set lost a passage. With storage cleared, no writer's view or dictionary quotation shows before the notice (rule 10).
  - The notice's list of gated surfaces and its browser check gain each gated kind note.
- **Size.** S to M.
- **Waits for.** AF-K, `commentary-notice` merged.

### AF-AR. The Aramaic notes' sources

- **Serves.** A6, C15, D1 (Penner), D2 (the Aramaic half: witnesses kept apart from writers); questions 5, 6 and 9; decisions 10, 11 and 15.
- **Owns.** `config/aramaic.json`, `web/src/ui/extras/aramaic/Panel.tsx`, `aramaic/model.ts`, `crates/atlas-cli/src/extra_aramaic.rs`.
- **Hands the integrator** (held for PR H if AF-AR merges before TC; section 2).
  - The Mishnah, 4 Ezra, Josephus, Philo and Targum cards: "The app names it as a witness, never as an authority" in place of "The app cites it ...".
  - The penner-names card removed, once its last cite is gone.
- **Does.**
  - Both SourceNotes (`aramaic/Panel.tsx` 371 and 486) become `SourceLine`: "From the writers and texts named under each note; Hebrew and Greek from the BSB and STEPBible's Greek and Hebrew (CC BY 4.0)." No AI. C5: they open the `tagnt` card (the word panel) and the `tahot` card (the Aramaic chapters).
  - **Writers' views go behind the notice (rule 10), and their names stay out of the note text** (CLAUDE.md: "Sources go in the evidence field, never in a note's text"). Each interpretive sentence moves out of the note into a new structured `views` array in `config/aramaic.json`: `{ "text": "...", "by": ["keil-delitzsch"] }`, where `by` holds work ids from the entry's own sources. The open panel shows the note cut to what the text shows (the word, the verse's own words, the BSB's footnote, the lexicon meaning). The views show only inside the notice's `<Commentary>` block, and the panel renders each one's holder from `by` ("Keil and Delitzsch hold that ..."), through `Credit`. Nothing a writer holds shows before the notice is finished, at any level.
  - Siloam: cite a cite-list commentary on John 9:7 that says it (fetched, quoted) as a view, or cut "perhaps pointing to Jesus as the one sent by God".
  - "Jesus most likely taught in Aramaic, the language most people in Galilee spoke every day" gets a named source, and becomes a view behind the notice if that source is a commentary or dictionary.
  - Rule 11: a note cut to nothing is removed, with its line under the verse and its chip.
  - The "How sure" labels become "clear from the text", "<N> writers cited: ..." and "scholars differ", with the reason at Deep. Not "most read it so" (section 7, conflict 7). The Layers strength words leave the Aramaic panel (question 9).
  - Lexicon meanings are marked "Meaning (from Abbott-Smith, via STEPBible)" at Study.
  - C15: each of the 125 source strings gets a page or section and a link, in a sibling `detail` array in the AF-K shape. The `sources` strings stay as they are, so `shelf.rs` matching is unchanged. Each web source gets a read date from this module's own fetch, and the "as cited by" wording stays.
  - Penner is dropped from the 4 entries (avoid list); where a point needs a source, a cite-list one replaces it.
  - The Deep list is split into "Writers" and "Ancient witnesses (not cited as authorities)", using each source's shelf group (`ancient`), so no shelf code changes.
- **Checks and tests.** G.
  - New verify checks: every `detail` passes `cite.rs`; no avoid-list name in `config/aramaic.json`; every `views` row has a non-empty `by` whose ids are in its entry's sources and on the cite list; no cite-list writer's name appears in a note's own text; no note is empty.
  - Browser: Raca, Cephas, Siloam, Talitha, Mammon, Jeremiah 10:11, Daniel 2:4, and every verse whose note was cut. With storage cleared, no view shows before the notice, at any level; after it, each view shows its holder and one tap reaches the source (rule 10, gate G).
  - The notice's list of gated surfaces and its browser check gain the Aramaic views.
- **Size.** M.
- **Waits for.** AF-K, `commentary-notice` merged.

### AF-LX. Lexicon credits: TBESH entries that are STEPBible's own, Middle Liddell, the loading credit

- **Serves.** B4, C7 (the "(AS)" and "(ML)" markers and the raw "Word type" codes), C11 (the language label), D1 (names inside Abbott-Smith stay his); question 5; decisions 10 and 11.
- **Owns.** `web/src/ui/WordStudy.tsx`, `web/src/data/lex.ts` (and the new `langLabel` in it), `crates/atlas-cli/src/parse.rs` (the lexicon reader), one line in `crates/atlas-cli/src/build.rs` near 469 (ship an origin field `o` per entry), `crates/atlas-cli/src/family.rs`. It does **not** edit `web/src/data/atlas.ts`: `langName` is also called by `AskSheet.tsx` 244 (the tie reason "shares the <language> word ...") and `Palette.tsx` 157 (the search rows), so changing it would change Ask and the search box (rule 8).
- **Hands the integrator** (held for PR H if AF-LX merges before TC; section 2). The tbesg and tbesh cards ("By: George Abbott-Smith (1922); abridged and tagged by STEPBible, Tyndale House"; "Brown, Driver and Briggs (1906), abridged by STEPBible"), with their dates and the catalogue check recorded in evidence (so AF-SH does not redo it), and the NOTICE lines.
- **Does.**
  - Each entry is credited from its marker:
    - (AS): "G. Abbott-Smith, A Manual Greek Lexicon of the New Testament (1922), as given in STEPBible's TBESG (Tyndale House), version of 5 Oct 2026, read 7 Oct 2026";
    - (ML): "Liddell and Scott, An Intermediate Greek-English Lexicon (1889), via TBESG";
    - the about 4,250 TBESH notes on people and places: "Written by STEPBible (Tyndale House)";
    - the about 2,740 outlines: Brown, Driver and Briggs, as question 5 rules (section 7, conflict 6).
  - The credit is chosen by the word's language, and no lexicon is named while an entry loads.
  - The markers are stripped from the definition text.
  - "Word type" is written in words from STEPBible's code key.
  - C11: a new `langLabel(L, root)` in `lex.ts` returns "Aramaic, written in Greek letters (scholars differ)" where `config/aramaic.json` rates it so, and otherwise exactly what `langName` returns. Only `WordStudy.tsx` (line 504 today) calls it; the Aramaic panel may call it later (AF-AR). `langName` and its other callers (`AskSheet.tsx`, `Palette.tsx`, `common.tsx`, `aramaic/Panel.tsx`) are unchanged. The label links to the Aramaic panel's reasons.
  - Hand-made family links (REMAP and the 62 TWINS) are marked "linked by this app", and `family.rs` ships a per-root flag for every Strong's derivation it corrected, which AF-TS reads.
  - Dates are read from `meta.json` fields once AF-DT lands (and shown only then).
  - An exact entry link where a stable URL exists; otherwise the dataset at its pin.
- **Checks and tests.** G.
  - Rust tests for the classifier (H0001H is STEPBible's; an outline entry is BDB; the (AS) and (ML) markers).
  - The build prints, and verify asserts within 1%: 5,464 (AS), 66 (ML), about 4,250 STEPBible's own, about 2,740 outlines.
  - Browser: a Greek word on a throttled network (no "Brown-Driver-Briggs" while it loads), a Hebrew name entry, an (ML) entry, γαββαθά (the word study shows the new label).
  - Gate G's Ask and search capture includes at least five questions and queries whose ties or rows name a word `config/aramaic.json` rates "scholars differ" (Gabbatha, Boanerges and Barnabas among them), and matches byte for byte.
- **Size.** M.
- **Waits for.** Nothing (rule 12 still runs). If no-empty-selections' browser sweep lands a fix in `WordStudy.tsx`, AF-LX waits for that merge.

### AF-WR. Word study: Abbott-Smith's references and the manuscript notes

- **Serves.** C8, A12, C7 (raw variant notes, the Hebrew pattern, the edition years); decisions 10 and 11.
- **Owns.** `web/src/ui/WordStudy.tsx` (after AF-LX merges), `web/src/data/variants.ts`, new `config/abbott-smith-abbreviations.json` (about 40 rows: abbreviation, full work, date, public-domain link or none), and the one line that ships it (in `build.rs`, or bundled; the module says which). The table holds names inside a quoted work's own words, so AF-CK exempts it from the avoid check by name, with question 5's reason.
- **Does.**
  - A "His references" block: "These are Abbott-Smith's own references", for example "MM = Moulton and Milligan, The Vocabulary of the Greek Testament, 1914 to 1929". Works on the avoid list (Thayer, ICC, Meyer, BDB) are expanded but not linked, because question 5's answer lets the avoid list govern what the app itself links.
  - The variant box credit: "From STEPBible's TAGNT (Tyndale House), which compares these printed editions; version of 5 Oct 2026, read 7 Oct 2026" (TAHOT for the Old Testament), plus "STEPBible marks this as a difference in meaning" and a one-line key for the underline.
  - Greek notes parsed into words: "Nestle-Aland 28 and 27, the Tyndale House GNT and Westcott-Hort read ἀνέκυψεν, 'he stood up'".
  - The Hebrew pattern widened to `\(\s*[HG]\d{4}[A-Za-z]?(?:[\/\\][HG]\d{4}[A-Za-z]?)*=[^)]*\)`.
  - Edition years: NA28 2012, NA27 1993, Tyndale House GNT 2017, SBLGNT 2010.
- **Checks and tests.** G.
  - A unit test of the pattern on Genesis 9:21 and two other multi-part codes.
  - A script over the built data: 0 raw codes left in the 3,866 Greek notes; the share of Hebrew notes still holding codes falls from 685 of 1,039 to 0; the table covers every abbreviation in the 1,876 definitions (unknowns printed, 0).
  - Browser: John 8:7, Genesis 9:21, ἄγγελος.
- **Size.** M.
- **Waits for.** AF-LX.

### AF-WW. Outside the Bible and In their world

- **Serves.** A14, B9, C10 (LSJ on Perseus, the UBS section), C11 (two lexicons that disagree); decisions 10 and 11.
- **Owns.** `web/src/ui/WordWorld.tsx`, `crates/atlas-cli/src/world.rs`.
- **Does.**
  - The lines become "Outside the Bible (LSJ): ..." and "In their world (UBS handbook): ...", with the caveat ("That is LSJ's earliest example, not the first time the word was used") on the line.
  - The UBS writer, date and section are shipped and shown: "From Edward R. Hope, All Creatures Great and Small (2005), adapted as Animals in the Bible (United Bible Societies, 2025), section 2.31 'Sheep, lamb'; shortened by this app. Version of 22 Sep 2026, read 8 Oct 2026."
  - LSJ's passage reference stays ("Herodotus 2.123"), and the Perseus entry is linked.
  - Where LSJ and Abbott-Smith disagree (ἀγάπη), both are named as views.
  - Open point for the founder, not a conflict: the avoid entry "UBS Handbook" (`config/layer-sources.json` 67) sits close to these Fauna, Flora and Realia articles, a different series. AF-WW credits the series by its exact name, and AF-CK confirms the check does not match it. If the founder meant the entry to cover every UBS help, he rules first.
- **Checks and tests.** G.
  - Build counts: 4,521 LSJ roots keep a reference; 1,358 UBS roots carry writer and section.
  - Perseus and UBS links: every URL pattern checked, plus 50 sampled.
  - Browser: λόγος, πρόβατον, ἀγάπη.
- **Size.** S to M.
- **Waits for.** Nothing (rule 12 still runs).

### AF-DT. Dataset dates: written, version and copied, in sources.json and meta

- **Serves.** C1 (datasets), question 3; decision 10.
- **Owns.**
  - `sources.json`, **shared** (section 2), held by AF-DT's PR only while it is open: adds `original` {by, work, date}, `version` (the upstream commit date) and `copied` (the date the pin was set, written by hand so build ids reproduce) to all 27 entries.
  - `crates/atlas-cli/src/sources.rs`: the new fields, and a **warning** (not yet a refusal) for any entry without them, so a WD or sourced-themes PR made from an older fragment still builds. AF-CK turns the warning into a refusal once no open branch adds an entry without the fields.
  - `crates/atlas-cli/src/fetch.rs`: records `git show -s --format=%cI` at fetch and fails on a mismatch with `version`.
  - The meta lines of `crates/atlas-cli/src/build.rs` (about 536), which carry the fields into `meta.json`.
  - New `web/src/data/dates.ts`: reads them from the loaded meta, without changing `atlas.ts` types.
- **Hands the integrator** (held for PR H if AF-DT merges before TC; section 2). Shelf fragments replacing "kept up to date" (7 cards) and the two meanings of "This copy: <month>". The display on the cards is AF-SH's. And, for the PR body and for WD's and the sourced-themes run's integrators, the fragment rule: every `source.json` fragment carries `original` {by, work, date}, `version` and `copied` as AF-DT defines them, with one worked example. The matching one-line amendment to `VOICES-BUILD-SPEC.md` 8.3 is the founder's or WD's run's to make (this plan only proposes it, section 2).
- **Does.** It records every value, re-measured from git and from the PR history (the audit's list is the expected value):
  - STEPBible `1f3423d4`, 2026-10-05, pinned 2026-10-07;
  - Clear `c99bd0ae`, 2026-05-11, pinned 2026-10-08;
  - UBS `33dcc8c6`, 2026-09-22, pinned 2026-10-08;
  - Syriac `833adc14`, 2026-03-10, pinned 2026-10-09;
  - Strong's `0acd2f25`, 2021-07-15, pinned 2026-10-09;
  - NEUU dictionaries `b8e82aa7`, 2026-03-16, pinned 2026-10-09;
  - Nave's table `720a8da`, 2026-10-03, pinned 2026-10-09;
  - Tyndale `1bd1bb39`, 2024-02-03, pinned 2026-10-08;
  - OpenBible geocoding 2021-11-01, pinned 2026-10-08;
  - Theographic 2026-04-21, pinned 2026-10-08;
  - Natural Earth 2022-06-02, pinned 2026-10-08;
  - the cross-references file of 2024-11-04, in `e1b254c` of 2026-07-10;
  - the BSB copy of 26 August 2024, in `48a9feb` of 2025-08-04;
  - the three voices works, whose pin dates are measured from `git log` of `sources.json`.

  Every value goes in the evidence file.
- **Checks and tests.** G.
  - `sources.rs` tests: a missing field warns (and is refused with AF-CK's switch on); a malformed date is refused at once.
  - `fetch` refuses a `version` that disagrees with the commit.
  - `meta.json` size before and after (raw and gzipped).
  - The build id reproduces on a second LF clone.
- **Size.** M.
- **Waits for.** Nothing (rule 12 still runs), but it must merge **before WD's PR-4**, the first WD PR that adds a `sources.json` entry. If a WD PR that adds an entry opens first, AF-DT waits for it to merge (one holder per shared file) and then adds the fields to that entry too. Its 27 multi-line entries and its `build.rs` meta lines go past CLAUDE.md's shared-code limit (section 7, conflict 12); if the founder rules that the limit binds, AF-DT keeps the dates in a new `config/source-dates.json` keyed by `sources.json` id and leaves `sources.json` untouched.

### AF-SH. The shelf tells the truth

- **Serves.**
  - B13; A17; C1 (the dates on cards);
  - C13 (Nave's "More than 20,000 subjects", the Bible Hub card's "two" commentaries, the README counts and license line);
  - B14 (the Tyndale card's two dates, from AF-ER's fragment); D1 (removing the Thayer card);
  - B1 (`Sources.tsx` 236; `README.md` 195 is AF-X's alone); A5 (the "reviewed list" wording in `Sources.tsx` 68 and 212);
  - B6 (website cards show a link's writer and date when the data has them);
  - questions 3, 5 and 11; decisions 10, 11, 12 and 15.
- **Owns.** `crates/atlas-cli/src/shelf.rs`, `web/src/ui/Sources.tsx`. Its own shelf, NOTICE and README changes are applied by AF-INT in its PR.
- **Does.**
  - The original writers on the dataset cards come from the modules that checked them, applied by AF-INT in PR H or in their own PRs: AF-BT's (the Leningrad Codex on TAHOT, the BSB committee, Clear, ESV), AF-LX's (Abbott-Smith on TBESG; Brown, Driver and Briggs on TBESH, as question 5 rules) and AF-X's (the Treasury on its own card and on the cross-references card). AF-SH neither redoes their catalogue checks nor rewrites those cards; it shows their dates.
  - The Bible Hub card says what is linked there: 18 commentaries, 5,401 times.
  - `shelf.rs` reads the Layers cites, so every cited work is counted (Keil and Delitzsch 839, not 1). Every cited work has a card, using TC's per-book table and WD's cards, and the build refuses a cited work with none (the B13 check).
  - **One card per work** (section 2). Each card for a Layers-cited work names its cite id in `layer`, and `shelf.rs` refuses two cards with one `layer` id. Where a card for the work already exists (an existing card, or one WD's VI added), AF-SH adds `layer` and the Layers count to it. Where none exists, it creates the card under the id WD's spec names (`jfb`, `henry-complete`, `barnes-nt`, `calvin-commentaries`), so WD's VI later extends that card instead of adding a second one. The list of overlapping ids is in section 2 and in AF-INT's `wd-card-rule.md`.
  - Ancient-group works show "named as a witness at N verses", not "cited".
  - The three dates from AF-DT on every card: "written 1922; this version 5 Oct 2026; copied 7 Oct 2026".
  - The lead: "The works this app draws on. Notes compiled for this app name, under each note, which of these they rest on."
  - The Deep "Checks" paragraph lists every hand-made file (`config/questions.json`, `hard-verses.json`, `layer-sources.json`, `layers.json`, `aramaic.json`, `parallels.json`, `eras.json`, `themes.json`, `theme-related.json`, `naves-display.json`, `shelf.json`, `ask-examples.json`) and what each holds, except the two theme files, which it names without describing (section 2: their sentences come from the themes work and are applied in AF-TS's PR). It no longer calls the NET openly licensed.
  - A "Compiled for this app" group: one card each for the Layers notes, the Aramaic notes, the parallels and the era table. The theme-lists card is not AF-SH's: it comes from the sourced-themes run or AF-TS (section 2). Each card says what the compilation rests on and its rules, and names the founder's choices by date where there are some ("the founder's choices of 9 October 2026"). No PR numbers or GitHub links (rule 3), "Reviewed by" only when a person has reviewed it, no AI wording, and no Ask card (section 7, conflicts 3 and 5).
  - "from a reviewed list" becomes "from the related-word list made for this app".
  - The Thayer card goes, and so does the penner-names card if AF-AR removed its last use.
  - Website cards show `by` and `published` when AF-HP's data has them.
  - A card with `"when": "esv"` (AF-BT's ESV card, applied in this PR) shows only when `ESV_ENABLED` is true, so Pages builds never list it.
  - README: the headline "a source for every fact" becomes "a named source for every fact the app adds to the Bible's words", counts are re-measured, and the license line lists CC BY-SA 4.0, the NET by permission, OFL and CC0.
  - NOTICE.md 3 and 73 are made true, and a new section, "Writing compiled for this app", says what it is and what it rests on. It carries no AI wording; whether MIT covers it is left to the founder (HANDOFF section 1).
- **Checks and tests.** G.
  - The shelf build's "matched" line now counts Layers cites (about 6,365 plus 239), with 0 unmatched.
  - Verify fails on a cited work with no card.
  - 0 "kept up to date".
  - `check-credits.mjs` passes for every surface.
  - Verify fails on two cards with one `layer` id; a test plants a second `jfb` card.
  - Browser: the shelf at three levels, a Layers-cited card's count, and "All sources" from five surfaces landing on the right card.
- **Size.** M (L if more than about 30 new cards need catalogue checks).
- **Waits for.** commentary-notice (`Sources.tsx`), TC (shelf, NOTICE, Layers cites), PR H (the held cards it shows), AF-DT, AF-X. Rule 12 also covers `Sources.tsx`, where no-empty-selections' shelf sweep may land a fix.

### AF-ER. Eras and the Written line, with each view's holder named

- **Serves.** A7, B14, C10 (links to the dictionary's articles); question 12; decisions 10, 11 and 15.
- **Owns.** `web/src/ui/ChapterWhen.tsx`, `web/src/data/eras.ts`, `config/eras.json`, `crates/atlas-cli/src/eras.rs`.
- **Hands the integrator** (held for PR H if AF-ER merges before TC; section 2). The Tyndale card: the print Tyndale Bible Dictionary (Elwell and Comfort, 2001, to be confirmed on its title page) and the 2023 open edition.
- **Does.**
  - The lines become "When (Tyndale Bible Dictionary): ..." and "Written (Tyndale Bible Dictionary): ...", or a short "per Tyndale" that opens More (behind the notice, as its spec says).
  - The Written line keeps the holder of the view it shows ("around the fifth century BC, most modern scholars say (4 views)").
  - The traditional view comes first for Job and Acts (question 12, and CLAUDE.md's "traditional date first").
  - The footer: "Chapters placed in the Tyndale Bible Dictionary's eras for this app, with the founder's choices of 9 October 2026 for Colossians, 1 and 2 Thessalonians, James, 2 Timothy and 1 and 2 Peter." No PR number or GitHub link (rule 3: PR #11 is named in `docs/HANDOFF.md` and the evidence file only), and no AI (section 7, conflict 1). The date is PR #11's, opened and merged on 9 October 2026 (`prs.json`).
  - At Deep: "Irenaeus, Against Heresies 5.30.3 (about AD 180), as quoted by the dictionary". Josephus is named as a witness, never a citation.
  - Each article and heading is linked where a stable URL exists.
- **Checks and tests.** G.
  - A new build check: every Written line that shows a held view names its holder (0 of 426 missing).
  - Job and Acts lead with the traditional view.
  - The existing word-for-word check still passes.
  - Browser: Job 1, Acts 1, 1 Kings 12, Colossians 1, with the notice still gating More.
- **Size.** M.
- **Waits for.** commentary-notice.

### AF-SN. Study notes: the writers and the change notice

- **Serves.** B7, C16, C5 (the notes' "All sources" opens the `aquifer-osn` card); decisions 10 and 11.
- **Owns.** `web/src/ui/extras/notes/Panel.tsx`, `notes.extra.tsx`, `notes/model.ts` (all three are on the notice's commit and on no-empty-selections' provisional list, so AF-SN starts only after both merge).
- **Does.**
  - The Study credit: "Notes by Bible scholars at Tyndale House Publishers (Tyndale Open Study Notes, 2023), rewritten in plain English by Mission Mutual (Aquifer Open Study Notes, version 1.1.2, 2026). CC BY-SA 4.0, changed here as described at Deep."
  - The lead: "What the Tyndale study notes say about this verse, as rewritten in plain English by Mission Mutual."
  - Check whether Tyndale names per-book contributors (front matter); show them, or say it does not.
  - At Deep, each note number links to its book file at the pin `bbb3f86`, with "Read from GitHub BibleAquifer/AquiferOpenStudyNotes at bbb3f86, version 1.1.2 of 18 September 2026" and the pin date.
  - C5: the SourceNote at `notes/Panel.tsx` 128 becomes `SourceLine work="aquifer-osn"`, with the Study credit above as its words.
  - It builds on no-empty-selections' change to the pointer-only notes ("A study note on ...", `notes.extra.tsx` 62 to 68) and does not undo it.
- **Checks and tests.** G.
  - 30 sampled pinned links return 200.
  - Browser: Genesis 1:1 and John 3:16 at Study and Deep, with the notice unchanged; "All sources" lands on the Aquifer card.
- **Size.** S.
- **Waits for.** commentary-notice merged, no-empty-selections merged.

### AF-DI. The old Bible dictionaries, and Smith's on the cite list

- **Serves.** B11, C19, C5 (the dictionary's "All sources" opens the `smith` or `easton` card); question 15; decisions 10 and 11.
- **Owns.** `web/src/ui/extras/dictionary/Panel.tsx`, `dictionary/model.ts`, `web/src/ui/Dictionary.tsx`, and `crates/atlas-cli/src/extra_dictionary.rs` only if the entry URL must be shipped. The panel, the model and the crate file are all named fix sites of no-empty-selections (the redirect-only entries, "list the entry it names instead"), and the panel and model are on the notice's commit, so AF-DI starts only after both branches merge.
- **Hands the integrator.** A `config/layer-sources.json` entry for Smith's as a reference work: "William Smith (ed.), A Dictionary of the Bible (1860 to 1863); American edition by F. N. and M. A. Peloubet (1884)". The smith and easton cards.
- **Does.**
  - "Easton's Bible Dictionary (M. G. Easton, 3rd ed. 1897; first published 1893)".
  - "Smith's Bible Dictionary (William Smith, 1860 to 1863; American edition by F. N. and M. A. Peloubet, 1884)".
  - "ED. marks a note by the 1884 American editors", shown only on entries that have one.
  - Each entry links its CCEL page, checked.
  - "dataset version of 16 Mar 2026, read 9 Oct 2026", from AF-DT.
  - The "out of date" sentence names kinds of statement only if a cited source supports it.
  - Smith's contributor list (1863) is checked against the avoid list. The check is recorded, and any barred contributor's entries are listed for the founder.
  - C5: the SourceNote at `dictionary/Panel.tsx` 74 becomes `SourceLine` on the card of the dictionary the entry is from (`smith` or `easton`); `showSources(dict, slug)` (line 25) is unchanged.
  - It keeps no-empty-selections' redirect fix as that branch merged it.
- **Checks and tests.** G.
  - 50 sampled CCEL links return 200 and show the entry's name.
  - Browser: Exodus 16:13 and Shechem at Study, an entry opened from the shelf, and "All sources" from a Smith entry and an Easton entry landing on their cards.
- **Size.** S (M with the contributor check).
- **Waits for.** commentary-notice merged, no-empty-selections merged, TC (`config/layer-sources.json`), AF-DT (for the dates; optional).

### AF-LC. Layers strength: ship the count and report what is above it

- **Serves.** C2 (part one), question 9; decision 9 ("See Gen. 3. 19" counts), decision 11.
- **Owns.** `crates/atlas-cli/src/layers.rs`, `web/src/data/layers.ts`.
- **Does.**
  - Counts distinct cited works whose role is "interpreter", per note, counting a writer's pointed cross-reference (decision 9).
  - Ships `writers` per note and `role` per cite.
  - Prints a report of every label above its count. Plain-meaning notes are left out, because they will show no strength word. There is no refusal yet.
- **Checks and tests.** G.
  - Rust tests: 3 interpreters allow "widely agreed"; 2 allow at most "commonly held"; a "See ..." cite counts; a reference-role cite does not; two cites of one work count once.
  - The report's count is recorded.
- **Size.** S.
- **Waits for.** TC merged (which carries LM).

### AF-LD. Layers credits at every level

- **Serves.** A1 (sources under every note below Deep), B3, C6 (the Layers tooltips), C7 (dataset codes in passage lines, if TC kept any), C2 (the display); question 9; decisions 10, 11 and 15.
- **Owns.** `web/src/ui/Layers.tsx`.
- **Does.**
  - Under every note at Simple and Study, the short credit from TC's data with the true writer ("From James G. Murphy (1863) and Keil and Delitzsch (1860s)."), drawn by AF-K's `Credit`, so one tap opens the full credit in place: the writer, the work, where it was read, both dates (decision 10), the exact link and the stored quote where there is one (decision 15). Deep keeps TC's full line. No AI line.
  - `Sources()` always shows the writer, then the place; sources are separated by semicolons; "on <verse>" attaches to each commentary (Malachi 1:1 shows Keil and Delitzsch and the true Barnes writer again).
  - Kind definitions, "Quoted in X, as the BSB's own footnotes show" and the dashed-arc meaning move out of title tooltips into tappable text.
  - Strength reads "widely agreed: 3 writers", with the rule one tap away ("3 or more of the writers cited; commonly held: 2; some interpreters: 1"). Plain-meaning notes show no strength word.
  - Any remaining "STEPBible TAHOT and TAGNT" reads "the Hebrew and Greek word lists from STEPBible (Tyndale House, Cambridge)".
  - It fits the notice's closed card.
- **Checks and tests.** G.
  - 0 credit or definition text left only in `title=`.
  - Browser: Isaiah 53:5 (the default), Genesis 3:15, Malachi 1:1, Genesis 2:7 at all three levels, with the notice still gating; at Simple, one tap on each credit reaches its link (gate G).
- **Size.** M.
- **Waits for.** TC, commentary-notice, AF-K, AF-LC.

### AF-WP. The Wordplay panel's credits and cites

- **Serves.** A3 (the panel and the alphabet-poem notes), C7 (the poem view's "TAHOT"), C5 (both SourceNotes open the right card); question 9; decisions 10, 11, 15 and 19.
- **Owns.** `web/src/ui/extras/wordplay/Panel.tsx`, `wordplay.extra.tsx`, `wordplay/model.ts`, `crates/atlas-cli/src/extra_wordplay.rs`.
- **Does.**
  - Each note's cites are shown from Study with their dates through `Credit` (one tap to the full credit and its link), with TC's true writers ("James G. Murphy (1863) and Keil and Delitzsch (1861 to 1875) on Genesis 2:7").
  - The notes' SourceNote (`wordplay/Panel.tsx` 233) becomes `SourceLine`: "From the writers named under each note. Hebrew and Greek checked against STEPBible's Hebrew and Greek word lists (Tyndale House, CC BY 4.0)." No AI, and no word on who or what checked it (decision 19). C5: it opens the `tahot` card (the `tagnt` card on a New Testament verse).
  - Strength shows as a count, from AF-LC.
  - Psalm 145:13 cites the BSB's own footnote.
  - The Psalm 111 and 112 contrast is attributed to a named writer (fetched quote), shown only behind the notice (rule 10), or cut.
  - **The alphabet-poem view stays open (the notice leaves it open, rule 10), so it holds only facts about the text.** Each of the 10 poem notes is cut to what the text shows (the letters, the line count, the BSB's own footnote). A statement that rests on a cite-list writer on the acrostic is credited to that writer and shown only through the notice's gate, or cut. Its wording: the Facts row "How checked" (282) becomes "Each letter is the first letter of its line in the Hebrew text from STEPBible (Tyndale House), checked against that text each time the app is built", and the SourceNote at 287 becomes `SourceLine work="tahot"`: "Hebrew text from STEPBible (Tyndale House), CC BY 4.0." No dataset code.
  - Rule 11: a poem note cut to nothing is removed with the line that opens it.
  - The "reviewed" code comments are corrected (`wordplay.extra.tsx` 14, `wordplay/model.ts` 2).
- **Checks and tests.** G.
  - A build check: every poem-note statement that remains has a source, and no poem note is empty.
  - A script: all 1,766 cites are reachable at Study.
  - Browser: Genesis 2:7, Genesis 3:1, Psalm 119, Psalm 145:13, Psalm 112, with the notice still gating; with storage cleared, the poem view shows no writer's view before the notice (rule 10).
  - The notice's list of gated surfaces and its browser check gain any poem statement that moved behind the gate.
- **Size.** M.
- **Waits for.** TC, commentary-notice, AF-K, AF-LC. Data fixes in `config/layers.json` (the 7 notes with no evidence, Genesis 29:34) are AF-LE's.

### AF-LR. Layers re-fetch: true read dates for every linked page

- **Serves.** C1 for Layers (step 1 of question 2's answer); decision 10.
- **Owns.** New `scripts/refetch-cites.mjs`; new `docs/evidence/layers-refetch-<date>.json` (URL, final URL, status, UTC time, SHA-256, `heading_found` for the cite's verse heading, `quote_found` for its stored quote); the read-date reader in `layers.rs` (so the build reads this file as TC reads the mend file); link fixes in `config/layers.json` only.
- **Does.**
  - Fetches the about 3,083 to 3,385 unique pages at 2 a second (StudyLight slower or by hand, since it answered 403 before).
  - Lists and fixes dead links.
  - The label says only what the fetch proves (decision 10's "truly retrieved timestamp"; TC's research, `dates.md`: "Never show a page's retrieval date on a cite whose own point was not re-read that day"):
    - a cite whose stored quote was found on the fetched page reads "read on <date> at <site>", because its point was re-read that day;
    - a cite whose page loaded and whose verse heading was found, but whose point was not re-read, reads "page retrieved <date>", which says the page was fetched and claims no reading. If TC's `CREDITS-SPEC.md` rules out any retrieval date on such a cite, it keeps TC's checked label instead, and the fetch goes in the evidence file only, as proof the link works;
    - every other cite keeps TC's label.
  - TC's spec settles the exact words where it gives them.
- **Checks and tests.** G.
  - A schema test of the evidence file.
  - A same-day re-run changes only times.
  - 0 dead links.
  - A test: no cite reads "read on" unless its evidence record has `quote_found: true` for that date.
  - Browser: one cite per site at Deep, one of each label.
- **Size.** S to M.
- **Waits for.** AF-LC. Skip it if TC's PR already ran the re-fetch.

### AF-LS. Layers strength mend, then the build refuses a label above the count

- **Serves.** C2 (part two), question 9; decisions 9 and 11.
- **Owns.** `config/layers.json` (only the notes in AF-LC's report), `crates/atlas-cli/src/layers.rs` (turning the report into a refusal).
- **Hands the integrator.** The CLAUDE.md line "The build does not check the count, so you must" becomes "The build refuses a label above the count."
- **Does.**
  - For each reported note: find another interpreter who states the point (fetched page, exact quote, UTC time), or lower the label honestly.
  - Where a passage is then left with no layer besides the plain meaning above "some interpreters" (rule 7 in `layers.rs`), find a writer or drop the passage, as #42 did.
  - Then the build refuses.
- **Checks and tests.** G.
  - The build passes with the refusal on; the report is empty.
  - A before-and-after table per note goes in the PR.
  - A second reader checks a 20-note sample.
- **Size.** M to L, set by the report's count.
- **Waits for.** AF-LR (or AF-LC if AF-LR is skipped). Never open at the same time as WD's V12 (`config/layers.json`).

### AF-LE. Layers reading pass: every named writer cited, every cite re-read

- **Serves.**
  - C3; A3's data (the 7 notes with no evidence; Genesis 29:34, whose evidence names Gill, Wesley and Henry but whose cites are others);
  - C7 (TAHOT, TBESH, TBESG and TAGNT codes in evidence);
  - step 2 of question 2's answer;
  - decisions 10 and 11.
- **Owns.** `config/layers.json`, `crates/atlas-cli/src/layers.rs` (refuse an evidence name that is not cited).
- **Does.**
  - For the about 750 notes whose evidence names an uncited writer, cite the writer (page read, quote recorded) or remove the name.
  - The 33 "NET Bible notes" mentions are cited by link only, or removed.
  - Sefaria stays named as where a witness was read, unlinked.
  - The 7 notes get evidence, and Genesis 29:34 is fixed.
  - Dataset codes in evidence are written in words.
  - Then the remaining cites are re-read work by work, largest first (Gill, Barnes, JFB, Keil and Delitzsch, Clarke, the Companion Bible, Wesley), storing the quote (public domain) or a pointer (copyrighted) and the UTC time, so every credit can say "read on <date>" truthfully (AF-LR's labels). A stored quote keeps the source's own wording and punctuation, em dashes included (decision 4; gate G exempts quotations).
  - Last, the refusal is turned on.
- **Checks and tests.** G.
  - The refusal is on with 0 hits.
  - An evidence record exists per cite.
  - A second reader checks a 5% sample per work.
- **Size.** L. It may land as one PR per work.
- **Waits for.** AF-LS. Never open at the same time as WD's V12 (`config/layers.json`, Ecclesiastes), nor as any other branch holding `config/layers.json`.

### AF-SF. Sefaria and OrthodoxWiki links

- **Serves.** D2 (the Sefaria links), D3 and question 7 (the OrthodoxWiki link), question 6; the CLAUDE.md witness rule.
- **Owns.** `config/hard-verses.json` (the one OrthodoxWiki read-more entry, about line 2247), `crates/atlas-cli/src/extra_hard_verses.rs` (`orthodoxwiki.org` in the allowed sites, line 49).
- **Hands the integrator.** The Mishnah card (lines 430 to 442) without its Sefaria `read` link; the Targum of Psalms card (528) without its Sefaria link; the orthodoxwiki card removed.
- **Does.** Drops the links, as the founder decided earlier (`5a9cae5`, recorded in `docs/HANDOFF.md` and the PR body, not in reader text). The witness cards stay. The passage that loses its OrthodoxWiki link keeps at least one other link (decision 12); if it has none, a sourced replacement on an allowed site is found first, or the passage is removed with its line (rule 11) and listed in the PR body.
- **Checks and tests.** G.
  - 0 `sefaria.org` and 0 `orthodoxwiki.org` links in the built data.
  - The existing verify rule (every passage has at least one link) passes.
  - Browser: that passage at Deep.
- **Size.** S.
- **Waits for.** TC (`config/hard-verses.json`). It runs just before AF-HP.

### AF-HP. Hard-passage links: writers and dates

- **Serves.** B6, C14, D3 (Catholic Answers and Christianity Today), C1 (web links), C5 (the panel's "All sources"); questions 2 and 7; decisions 10, 11, 12 and 19.
- **Owns.** `config/hard-verses.json` (read-more entries), `crates/atlas-cli/src/extra_hard_verses.rs` (`Link` gains `by`, `published` and `checked`; verify's `o.len() == 3` at 391 is loosened to the new fields), `web/src/ui/extras/hard-passages/Panel.tsx`, `hard-passages/model.ts`.
- **Does.**
  - Reads all 114 pages and records the writer, or "unsigned, Got Questions Ministries", plus the publication date and a true checked date (this module's fetch).
  - Renders "James Bejon, The Gospel Coalition, 2020. Link checked <date>." The words describe what was done and never name who or what did it (decision 19), in reader text and in the evidence file alike.
  - Keeps each Catholic Answers page whose named writer upholds Scripture and drops the others, with the reason recorded; checks the two Christianity Today writers (question 7).
  - Rule 11: where a drop would leave a passage with no link (verify requires at least one), a sourced replacement on an allowed site that answers the same question is found first (fetched, recorded). If there is none, the passage is removed from Hard passages with its line under the verse, and listed in the PR body with the reason; verify's rule is not loosened.
  - C5: the SourceNote at `hard-passages/Panel.tsx` 41 (whose AI wording TC removes) becomes `SourceLine work="bsb"`, and each link's site name opens that site's card (`gotquestions`, `gospel-coalition`, `ligonier`, `bible-org`, `desiring-god` and the rest already on the shelf).
  - Uses one name for Ligonier Ministries.
  - C14's "the question each pointer is about" is drafted and listed in the PR body for the founder to approve (the audit asks for his wording), and ships only on his yes.
- **Checks and tests.** G.
  - Rust tests for the new `Link` fields.
  - Verify: every link has `by` (or unsigned plus publisher) and `checked`.
  - Every kept page returns 200.
  - Every link's site has a card in the built shelf (`check-credits.mjs`).
  - Browser: Matthew 27:5, 2 Samuel 24:1, Matthew 1:1 at Deep, and every verse whose passage lost a link or was removed.
- **Size.** M.
- **Waits for.** TC, commentary-notice, AF-SF.

### AF-OA. "Often asked" kept unapproved until every view is cited

- **Serves.** A18, question 17, question 9 (one scale), question 11 ("Reviewed by" is for a person, as decision 19 settles), C5 (the panel's "All sources"); decisions 11, 15 and 19.
- **Owns.** `config/hard-verses.json` (view fields and scale words), `crates/atlas-cli/src/extra_hard_verses.rs` (`View` gains `cites` in the AF-K shape), `web/src/ui/extras/hard-verses/Panel.tsx`, `hard-verses/model.ts`.
- **Does.**
  - The build refuses `reviewed_by` on any card with a view that has no cite, or whose strength is above its count.
  - The 182 drafts move to the Layers scale ("widely held" becomes "widely agreed").
  - The panel shows the review date beside "Reviewed by <the person's name>", and nothing else about how a card was made: no line says who or what drafted or checked it, and "reviewed" appears only with a named person (decision 19). Where a view's cites were checked against their pages, it says "checked against the source <date>". No AI wording.
  - C5: the SourceNote at `hard-verses/Panel.tsx` 132 (whose AI wording TC removes) becomes `SourceLine work="bsb"`, so `check-credits.mjs` finds no SourceNote left.
  - Sourcing the 182 views is not in this plan; it is the work needed before any card is approved. Nobody fills `reviewed_by` (CLAUDE.md).
- **Checks and tests.** G.
  - Rust tests: a reviewed card with an uncited view is refused; a strength above its count is refused.
  - The live `cards.json` stays empty.
  - No browser check of drafts: `ATLAS_HARD_VERSE_DRAFTS=1` is never set in a workflow (CLAUDE.md).
- **Size.** M.
- **Waits for.** AF-HP (same files), TC, commentary-notice.

### AF-PL. Places, with OpenBible.info's weighed sources

- **Serves.** A8, B10, C5 (the map's "All sources" opens the `openbible-geo` card), question 13; decisions 10 and 11.
- **Owns.** `crates/atlas-cli/src/extra_real_map.rs` (the wording at 1681 to 1900, and shipping each place's weighed works with their years), `web/src/ui/extras/real-map/MapPanel.tsx`, `real-map/places.ts`, `real-map/model.ts` (all four on no-empty-selections' provisional list).
- **Does.**
  - "Babylon: OpenBible.info reads it here as another name for Rome", at least where the data marks it "may be symbolic" or scores it under 950, and on the map label.
  - "This app drew each tribe's land as an outline about 4 km around the towns Joshua lists that the map can place; it is not taken from an atlas."
  - "Distances measured by this app from the site OpenBible.info favours."
  - At Study: "Location from OpenBible.info, which weighed 18 reference works." At Deep, the works, labelled "OpenBible.info's sources" (section 7, conflict 8).
  - "OpenBible.info's score from the works it weighed, out of 100"; "OpenBible.info's note".
  - Robert Rouse (Theographic) is named at Study; "James Ussher's Annales Veteris Testamenti, 1650" at Deep.
  - C5: the SourceNote at `MapPanel.tsx` 322 becomes `SourceLine work="openbible-geo"`, its words naming Theographic and Natural Earth beside it (their cards `theographic` and `natural-earth`).
  - It keeps no-empty-selections' fix for the undrawable places as that branch merged it.
- **Checks and tests.** G.
  - Build counts: 939 places with weighed works; 217 "another name" lines name OpenBible.info.
  - A report of any avoid-listed work among the 108, for the founder.
  - Browser: Capernaum, Babylon on 1 Peter 5:13, a tribe's map, Bethlehem; "All sources" lands on the OpenBible.info geocoding card.
  - `meta.json` size before and after.
- **Size.** M.
- **Waits for.** no-empty-selections merged (it holds all four of AF-PL's files).

### AF-CW. Christian writers: Wesley and the Concise described truthfully, every Catena name explained

- **Serves.** B5 (the parts WD leaves), question 16, C17, C5 (the voices panel's "All sources"); decisions 10, 11 and 19.
- **Owns** (after WD's PR-2 and PR-3 merge): `config/voices/henry-concise.json` and `config/voices/wesley-notes.json` (their `lines`), `config/voices/catena-aurea.json` (`who` rows for the names WD does not cover), `crates/atlas-cli/src/extra_voices/catena.rs` (for the who-line check only; it passes to AF-FL when AF-CW merges), `web/src/ui/extras/voices/links.ts`, and the links section and the footer SourceNote of `voices/Panel.tsx`.
- **Hands the integrator.** The henry-concise and wesley-notes cards.
- **Does.**
  - Reads Wesley's prefaces from scans (the 1755 New Testament notes, the 1765 Old Testament notes) and states what he drew on: Bengel; Henry and Poole.
  - The Concise: "Matthew Henry (1662 to 1714) wrote Genesis to Acts; Romans to Revelation were finished after his death by other ministers. Shortened later into this Concise Commentary by an editor this copy does not name." The editor is named if the first edition gives one.
  - A who-and-when line for each of the about 42 Catena names WD's `who` list leaves, from a named reference (for example the Oxford translation's own list of authors), with evidence: "Gregory the Great, bishop of Rome, died 604".
  - C17: "Links checked <true date>"; GotQuestions and BibleRef marked "unsigned answers by Got Questions Ministries"; writers named where pages have them. The words describe the check and never name who or what made it (decision 19), in reader text and in the evidence file.
  - C5: the SourceNote at `voices/Panel.tsx` 194 becomes `SourceLine` on the card of the work shown (`catena-aurea`, `henry-concise`, `wesley-notes`, `keil-delitzsch`, and WD's new cards); the `showSources(l.shelf)` and `showSources(w.shelf)` buttons keep their data-driven ids, which `check-credits.mjs` validates from `links.ts` and `config/voices/*.json`.
- **Checks and tests.** G.
  - WD's verify (spec 1.10) still passes.
  - A new verify check in `catena.rs`: every shown Catena name has a who line.
  - Browser: John 3:16 and Matthew 1:1 at Deep, after the notice; "All sources" lands on the shown work's card.
- **Size.** L (the names research).
- **Waits for.** WD PR-2 and PR-3, and so commentary-notice. Rule 12 also covers no-empty-selections, which fixes Wesley's bare references in the voices files.

### AF-FL. The Fathers' locations in plain words

- **Serves.** C9; decision 11.
- **Owns.** New `config/voices/catena-places.json` (Latin shorthand to a plain title and a New Advent or CCEL link where the work is there), `crates/atlas-cli/src/extra_voices/catena.rs` (after AF-CW merges, which had it for its who-line check), `voices/Panel.tsx` (after AF-CW).
- **Does.**
  - "Hom. iv. [iii.] in Joan" becomes "Homilies on John, 4".
  - "ubi sup." and "ut sup." become "same work as above"; "non occ." becomes "Aquinas's source not found".
  - The original stays at Deep and in a tap.
  - If WD's fathers track (the original volumes) has landed exact citations, they are reused.
- **Checks and tests.** G.
  - Verify: every one of the 4,703 Latin locations is mapped, or reported (0 unmapped is the target).
  - 100 sampled links are checked.
  - Browser: John 1:1 at Deep.
- **Size.** L.
- **Waits for.** AF-CW, WD PR-3.

### AF-TS. Theme surfaces (after the sourced-themes run)

- **Serves.**
  - B1 (`VerseThemes.tsx` 349 to 357, `ThemeThread.tsx` 252);
  - the A5 items that are not descriptions:
    - "not a hand-picked list" (`Explore.tsx` 243, `themes.extra.tsx` 50);
    - "from a reviewed list";
    - the Strong's derivation tie (`ThemeThread.tsx` 401 to 431);
    - the Septuagint pairs' TBESG credit (656 to 689);
    - key verses at Simple;
    - the word meanings credited to STEPBible's lexicons at Study;
    - the footer's file link;
  - C12 ("Most connected of them"), C5 (the Themes footer's card), C6 (`ThemeThread.tsx` 252; `VerseThemes.tsx` 82 and 151), C18, C10 (Nave's headings);
  - question 11; decisions 11, 15, 17 and 19.
- **Owns.** In `web/src/ui/Explore.tsx`, the theme functions only (`ThemeChips`, `ThemeList`, `WordsTraced`, `ThemeSource`, `Themes` and the theme-list signals at the top; shared by function, section 2); `VerseThemes.tsx`, `ThemeThread.tsx` (except `PreviewRow` and `useHoverPreview`, whose output Ask relies on and which stay as they are, rule 8), `web/src/ui/extras/themes.extra.tsx`, `crates/atlas-cli/src/naves.rs` (ship which rows rest on a corrected reference). Whatever of these the sourced-themes run changed, AF-TS takes as that run merged it.
- **Hands the integrator** (in its own PR). The theme-lists card for the "Compiled for this app" group and the Checks sentences for `config/themes.json` and `config/theme-related.json`, taken from the sourced-themes run's fragment if it wrote one, or written by AF-TS from that run's design if not (section 2).
- **Does.**
  - The cross-reference credit in AF-X's words.
  - The method sentence under the Start-with grid and each journey ("not a hand-picked list", `Explore.tsx` 243 and `themes.extra.tsx` 50) is taken from the sourced-themes design, so it says truly where each theme's words now come from. The audit's wording ("The words were chosen for this app; every verse holding one of them is lit, so each can be checked in the original") is used only if that design keeps the words chosen for this app.
  - "from the related-word list made for this app". There is no "reviewed" and no AI (decision 19 settles question 11; section 7, conflict 2). The `why` reasons are not shipped unless sourced (decision 15).
  - "James Strong's dictionary (1890) derives שַׁבָּת from שָׁבַת", plus "corrected by this app" where AF-LX's `family.rs` flag says it changed the derivation.
  - "Abbott-Smith, via STEPBible's Greek lexicon (Tyndale House)" under the Septuagint pairs, through `Credit`.
  - Word meanings at Study name their lexicon ("Meaning from Brown, Driver and Briggs, abridged by STEPBible" or "from Abbott-Smith, via STEPBible"), with the same words AF-LX uses, unless the sourced-themes run already carries this.
  - Key verses at Simple.
  - "Most connected of them" is explained at Simple.
  - Tooltip-only credits become visible.
  - At Deep, Nave's rows resting on a fix are marked ("reference corrected by this app: the table reads JOS 10:12; 13"), with "read from Brady Stephenson's BibleData table, commit 720a8da of 3 Oct 2026, taken 9 Oct 2026". The heading is linked if CCEL has a stable per-subject URL.
  - The footer names the file the themes are built from and links it as its raw file at the commit the build used (`raw.githubusercontent.com/Sixteen1-6/BibleAtlas/<sha>/config/themes.json`), never a GitHub commit or blob page (rule 3), unless the sourced-themes run has replaced that footer with its sources.
  - C5: the SourceNote at `themes.extra.tsx` 57 becomes `SourceLine` on `naves` and `openbible-xref`, and the Themes footer in `Explore.tsx` opens the theme-lists card once it exists (until then `naves`).
  - Any item the sourced-themes plan already carries is struck from this module.
- **Checks and tests.** G.
  - Browser: the Themes tab, the Sabbath journey, a verse with Nave's rows, Joshua 10:12; "All sources" from the Themes footer and the themes line lands on a card about themes.
  - 0 credit left only in `title=`.
  - Gate G's Ask capture is unchanged (the Ask sheet draws `PreviewRow`).
- **Size.** M.
- **Waits for.** The sourced-themes run merged, AF-X merged, AF-LX merged (the `family.rs` flag).

### AF-CK. Whole-app credit checks

- **Serves.** D1 (the avoid list over every config file that names a writer), decision 15 (no AI credit anywhere a reader sees), decision 12 (every credited work id exists), and the rest of the audit's build checks; question 5.
- **Owns.** `crates/atlas-cli/src/cite.rs` (extended after AF-K), one line in `crates/atlas-cli/src/verify.rs`, `web/scripts/check-credits.mjs` (extended), and the switch in `crates/atlas-cli/src/sources.rs` that turns AF-DT's warning into a refusal.
- **Hands the integrator.** A `config/layer-sources.json` change: Strong's links point to entries that do not show BDB or Thayer, and the BDB credit exemption is recorded with question 5's reason (section 7, conflict 6).
- **Does.**
  - **Avoid list.** Runs it over `config/aramaic.json`, `shelf.json`, `hard-verses.json`, `eras.json`, `parallels.json` and `config/voices/*.json`. Exempt, each by name with its reason: names inside a writer's own quoted words (the approved voices rule); `config/abbott-smith-abbreviations.json` (AF-WR), whose Thayer, BDB, ICC and Meyer rows are names inside a quoted work's own words (question 5's reason); and the places weighed-works list (question 13), which is reported instead.
  - **No AI credit (rule 3, decision 15).** The refusal is the fixed list of case-sensitive credit phrases in rule 3 ("Drafted with", "AI help", "Claude", "AI reviewer", "AI session", "with AI", "by AI", "Not yet reviewed by a person"), applied only to credit-bearing strings: `cite` and `detail` fields, `config/shelf.json`, `NOTICE.md`, `README.md`, the text children of `SourceLine`, `SourceNote`, `Credit` and `Provenance` in `web/src`, and the `source` and credit fields of config files. It never scans Bible text or entry names (the BSB and the dictionaries name the city Ai). It exempts by path, under decision 16: `web/src/ui/ask/*`, `web/src/ui/extras/ask.extra.tsx`, `config/questions.json` (Ask questions such as "Is it wrong to use AI?"), `config/ask-examples.json`, and the built `ask/` and `search/` data.
  - **No named checker (decision 19).** The same credit-bearing strings may not say who or what made a check ("checked by" followed by a name or tool), and "reviewed" appears only beside a person's name.
  - Checks every `SourceLine`/`Credit` work id and every credit URL, and turns `check-credits.mjs`'s warning into a failure: any `SourceNote`, `<Provenance>` with no `work` or `showSources()` with no work outside `web/src/ui/ask/*` (and the definitions in `kit.tsx`) fails.
  - Turns `sources.rs`'s missing-date warning into a refusal once no open branch (WD, sourced themes) adds a `sources.json` entry without the fields (rule 12's lists show it).
- **Checks and tests.** G.
  - Tests with a planted avoid name in each config, a planted credit phrase in a `cite` field, a planted checker's name and a planted bad id: each refused.
  - Tests that pass: the founder's note on `AskSheet.tsx` 414 ("even AI and algorithms") and the Ask question "Is it wrong to use AI?" (`config/questions.json`), because they are exempt by path; an entry named "Ai" in a dictionary; the abbreviations table's Thayer row.
  - Clean on `main` at the time it runs, with Ask unchanged (gate G).
- **Size.** S.
- **Waits for.** AF-AR, AF-SH, AF-SF, AF-HP, AF-ER, AF-DI, AF-PA, AF-LX and AF-WR (the configs and tables it checks); every module that swaps a SourceNote or a bare Provenance (AF-Q, AF-SY, AF-PA, AF-AR, AF-WP, AF-SN, AF-DI, AF-PL, AF-HP, AF-OA, AF-CW, AF-X, AF-TS); TC; and no-empty-selections (`verify.rs`).

## 4. Held: these run only with the founder's yes

### AF-AS. Ask the Bible credits (held by decision 16)

- **Would serve.**
  - A2, all but question 10's items:
    - `AskSheet.tsx` 288 "Every word above is the Bible's (BSB)";
    - the ties naming their data (OpenBible.info, BSB footnotes, STEPBible);
    - `QUESTION_STOP` gaining but, against, out, than, every, over, after, let and know, and the 43 parts the build then refuses;
    - the "What the Bible says, in its own words" heading;
    - the gathered lead;
  - A15's Ask topic view (Nave's credit at Study);
  - A16 (the 988 Suicide & Crisis Lifeline, Find A Helpline run by ThroughLine, "Numbers checked <date>");
  - B15 (Orville J. Nave, 1896 to 1897, Brady Stephenson's table, the card opened);
  - C5 for Ask.
- **Would own.** `web/src/ui/ask/AskSheet.tsx`, `web/src/ui/extras/ask.extra.tsx`, `crates/atlas-cli/src/ask.rs`, `config/questions.json`.
- **Size.** M.
- **Not done in any case:** the AI line, "People ask", the founder's note and the signature (question 10, "FOR 10 dont do this").
- **Why held.** Section 7, conflict 3. The help line's 988 entry is a safety matter worth asking about first.

### AF-SP. Search palette credits (held by the search-box rule)

- **Would serve.** The palette part of A15: the footer "Verse text: BSB. Words: STEPBible." and "Nave's subject" on subject rows. Question rows get no label (Ask stays as it is; no AI label).
- **Would own.** `web/src/ui/Palette.tsx`.
- **Size.** S.
- **Why held.** Section 7, conflict 10.

## 5. Order

Merges land one at a time on `main`, because each merge deploys. Modules may be built in parallel as soon as what they wait for exists.

Every row also runs rule 12 before it starts and before it commits: if an owned file is on an in-flight branch's list, the row waits for that branch, whatever "After" says. Shelf and NOTICE fragments of rows that merge before TC wait for PR H (section 2), and `docs/HANDOFF.md` section 0 is rewritten only in the PR that merges next.

| PR | Module(s) | After |
|---|---|---|
| 1 | AF-BT (the NET line is a permission term; its three owned files only) | none (rule 12) |
| 2 | AF-K | TC's `CREDITS-SPEC.md` written (TC's Design phase, not its merge) |
| 3 | AF-DT | none (rule 12); must merge before WD's PR-4 |
| 4 | AF-LX | none (rule 12) |
| 5 | AF-WW | none (rule 12) |
| 6 | AF-Q, then AF-SY (two small PRs) | AF-K |
| 7 | AF-WR | AF-LX |
| in flight | commentary-notice (committed `d12a4dd`), TC, no-empty-selections; WD PR-1 (the mirror workflow) when WD starts | their own runs |
| 8 | AF-PA, then AF-AR | AF-K, commentary-notice |
| 9 | AF-ER | commentary-notice |
| H | AF-INT applies the held shelf and NOTICE fragments (AF-BT, AF-DT, AF-LX, AF-AR, AF-ER, as far as they merged before TC) | TC merged; the first PR after it |
| 10 | AF-X with AF-W | TC, commentary-notice; best before the sourced-themes build holds `Explore.tsx` (otherwise AF-X's `Explore.tsx` items follow sourced themes as a small PR of its own) |
| 11 | AF-LC | TC |
| 12 | AF-LD, then AF-WP | AF-LC, AF-K, commentary-notice |
| 13 | AF-SN | commentary-notice, no-empty-selections |
| 14 | AF-SF, then AF-HP | TC (and commentary-notice for AF-HP) |
| 15 | AF-SH | commentary-notice, TC, PR H, AF-DT, AF-X |
| 16 | AF-DI | commentary-notice, no-empty-selections, TC (AF-DT optional) |
| 17 | AF-LR, then AF-LS | AF-LC; not while WD's V12 or any other `config/layers.json` holder is open |
| 18 | AF-OA | AF-HP |
| 19 | AF-PL | no-empty-selections |
| 20 | AF-LE (one PR per work, largest first) | AF-LS; not while WD's V12 or any other `config/layers.json` holder is open |
| in flight | WD PR-2 and PR-3 | commentary-notice |
| 21 | AF-CW, then AF-FL | WD PR-2 and PR-3 |
| in flight | sourced themes | its own plan |
| 22 | AF-TS | sourced themes, AF-X, AF-LX |
| 23 | AF-CK | every module it checks, and no-empty-selections |
| held | AF-AS, AF-SP | the founder |

**Why this order.** The NET line first, because it is a permission term. Then the kit that every later credit uses, as soon as TC's spec fixes the shape, and the dataset dates, which must land before WD adds its first `sources.json` entry. The modules that touch no in-flight file come next, so they land while TC, the notice and no-empty-selections finish. The modules that add writers' views to open surfaces (AF-PA, AF-AR, AF-X, AF-WP) wait for the notice, so no commentary reaches a reader without it (decision 1). PR H then brings the held card and NOTICE text onto a main that has TC, and the Treasury credit (AF-X) follows at once, since it is the gap every visitor meets on the first screen and the map. The Layers chain starts as soon as TC merges, and its display (AF-LD, AF-WP) goes before the long reading work (AF-LS, AF-LE), so readers see true credits under every note early. The modules on no-empty-selections' files (AF-SN, AF-DI, AF-PL) follow its merge. AF-CK comes last, because it can only pass once every config file is clean and every SourceNote is swapped.

## 6. Every audit item, and where it goes

| Item | Module | Item | Module |
|---|---|---|---|
| Shared shape | TC (Layers), AF-K (the rest) | C1 | TC, AF-LR, AF-LE (Layers); AF-DT, AF-SH (datasets); AF-HP, AF-AR, AF-CW (web links) |
| A1 | AF-LD (TC supplies data) | C2 | LM, AF-LC, AF-LS, AF-LD, AF-WP |
| A2 | held, AF-AS (question 10's items: not done) | C3 | LM in part, AF-LE |
| A3 | AF-WP, AF-LE (data), AF-LC | C4 | TC |
| A4 | AF-W (Welcome, page), AF-X (map) | C5 | AF-K (component and check), then each SourceNote or bare Provenance swapped by its owner: AF-Q (`bsb`), AF-SY (`dsc-peshitta`), AF-PA (`bsb`), AF-AR (`tagnt`, `tahot`), AF-WP (`tahot`, `tagnt`), AF-SN (`aquifer-osn`), AF-DI (`smith`, `easton`), AF-PL (`openbible-geo`), AF-HP (`bsb` and the site cards), AF-OA (`bsb`), AF-CW (each work's card), AF-X (Hubs, Paths, `WordSky.tsx`: the Treasury card, `openbible-xref`, `tahot`/`tagnt`), AF-TS (`naves`, `openbible-xref`, the theme-lists card); AF-CK makes any left a failure; Ask held |
| A5 | sourced themes (descriptions), AF-TS (the rest, with the Study lexicon credit and the footer's file link) | C6 | AF-LD, AF-TS, AF-X (`WordSky.tsx` tooltip) |
| A6 | AF-AR | C7 | AF-LD, AF-LE (Layers), AF-LX, AF-BT, AF-WR, AF-WP (poem view), AF-X (`WhyLinked.tsx`, `WordSky.tsx`) |
| A7 | AF-ER | C8 | AF-WR |
| A8 | AF-PL | C9 | AF-FL |
| A9 | AF-PA | C10 | AF-X, AF-Q, AF-PA, AF-SY, AF-DI, AF-WW, AF-SN, AF-ER, AF-TS, AF-LX, AF-BT |
| A10 | AF-Q | C11 | AF-LX (label), AF-WW (two lexicons) |
| A11 | AF-X | C12 | AF-X, AF-TS |
| A12 | AF-WR | C13 | AF-X (hints), AF-SH (cards, README) |
| A13 | AF-SY | C14 | AF-HP (wording held for approval) |
| A14 | AF-WW | C15 | AF-AR |
| A15 | held, AF-SP and AF-AS | C16 | AF-SN |
| A16 | held, AF-AS | C17 | AF-CW |
| A17 | AF-SH, AF-W, AF-BT (the ESV card) | C18 | AF-TS |
| A18 | AF-OA | C19 | AF-DI |
| B1 | AF-X (with `README.md` 195, `WordSky.tsx`), AF-TS, AF-SH (`Sources.tsx` 236) | D1 | AF-CK, with AF-AR (Penner), AF-SH (Thayer), AF-WR (unlinked names) |
| B2 | TC | D2 | AF-AR, AF-SF |
| B3 | AF-LD (if TC has not) | D3 | AF-SF, AF-HP |
| B4 | AF-LX | | |
| B5 | WD in part, AF-CW | | |
| B6 | AF-HP, AF-SH (cards) | | |
| B7 | AF-SN | | |
| B8 | AF-BT | | |
| B9 | AF-WW | | |
| B10 | AF-PL | | |
| B11 | AF-DI | | |
| B12 | AF-BT (with the ESV card for server deploys) | | |
| B13 | AF-SH (TC facts, WD cards) | | |
| B14 | AF-ER | | |
| B15 | held, AF-AS | | |

Questions:

- 1: no AI line anywhere (decision 15);
- 2: TC, AF-LR, AF-LE;
- 3: AF-DT;
- 4: TC;
- 5: AF-LX, AF-AR, AF-SH, AF-CK;
- 6: AF-AR, AF-SF;
- 7: AF-SF, AF-HP;
- 8: AF-X, AF-W;
- 9: AF-LC, AF-LS, AF-LD, AF-WP, AF-AR;
- 10: not done (decision 16);
- 11: settled by decision 19 ("checked against the source"; "reviewed" only for a person); AF-OA, AF-TS, AF-SH, AF-HP, AF-CW, with the AI wording dropped;
- 12: AF-ER;
- 13: AF-PL;
- 14: sourced themes (decision 17);
- 15: AF-DI;
- 16: AF-CW;
- 17: AF-OA.

## 7. Conflicts between the audit and the founder's decisions

1. **The AI-drafting line.**
   - **Audit.** "Build this first": "For text the app wrote, the same component adds: 'Drafted with AI help (Claude), October 2026. Not yet reviewed by a person.'" Its check: "every block of app-written text has an AI line with a month". Question 1, recommended: "yes, one short line at every level". The same kind of line appears in:
     - A1, A3, A5, A6 and A9;
     - A4 ("Dashed: a link a Layers of meaning note makes (drafted with AI help)");
     - A7 ("placed in the dictionary's eras for this app by an AI session (Claude)");
     - A9 ("34 passages added by this app's editors with AI help");
     - A15 ("prepared question (with AI help)");
     - A16 ("Passages chosen for this app with AI help");
     - A17 ("saying drafted with AI help (Claude, Anthropic)").
   - **Founder,** decision 15: "Just credit original source. The whole point is for us to be looking at original sources and this helps just compile them better. No crediting of AI."
   - **Here.** Every AI line and that check are dropped. Text the app wrote is given a named source or cut to what a source or the text shows.
2. **"Checked by AI reviewers".**
   - **Audit,** question 11, recommended: "AI checks say 'checked by AI reviewers' (theme related words, PR #30; Often-asked drafts); 'Reviewed by' is kept for a person". A5: "Judged for this app by an AI reviewer (Claude) and checked by a second, 10 October 2026 (PR #30)" and "list checked by two AI reviewers".
   - **Founder,** decision 18: "except where it would credit AI (question 11's 'checked by AI reviewers': raised with the founder as a conflict)", and decision 15. Then **decision 19**, which settles it: "Describe what was done ('checked against the source') and never say who or what checked it; only use 'reviewed' when a person reviewed it."
   - **Here. Settled by decision 19; nothing left to confirm.** "Reviewed by" stays for a named person. The related-word lines lose "reviewed" without naming AI ("the related-word list made for this app"). Where a check was made, the words describe it ("checked against the source <date>", "link checked <date>") and name no checker, in reader text and in evidence records alike (rules 5 and 6; AF-HP, AF-CW, AF-WP, AF-OA). Often-asked shows no review line until a person reviews.
3. **Ask the Bible.**
   - **Audit.** A2's fixes beyond question 10:
     - "Reword 288 to 'Every verse in the chain is the Berean Standard Bible ...'";
     - "Name the data on each tie";
     - "Add the small words to QUESTION_STOP and mend the 43 parts";
     - "Gathered lead: 'Verses that share your words, found by search.'".

     A15: "Topic view: 'Verses Nave's Topical Bible (1896) lists under Mist'". A16: "call or text 988 ...", "Numbers checked 20 October 2026", "Sign the note". B15: "Nave's Topical Bible by Orville J. Nave (1896 to 1897) ...".
   - **Founder.** His words were "FOR 10 dont do this", recorded as decision 16: "Ask the Bible stays as it is (audit question 10: 'don't do this'). No AI line under chains, 'People ask' unchanged, the founder's note keeps its words". The computed task says "Ask the Bible stays exactly as it is."
   - **Here.** Held as AF-AS. Ask the founder whether the source-only credits (Nave's author, the help line's services and check date, the ties' data) may go in, since his own words named question 10 only. The 988 line is a safety matter worth raising first.
4. **Theme descriptions.**
   - **Audit.** Question 14, recommended: "if you, credit you; if not known, label them 'written for this app' with the import date". A5: "Theme names and descriptions written for this app with AI help (Claude), October 2026".
   - **Founder,** decision 17: "App-written theme descriptions are replaced by definitions from trusted, credited sources ... cited to their original authors."
   - **Here.** Left to the sourced-themes run; AF-TS adds no description label.
5. **"Written for this app" on the shelf.**
   - **Audit.** A17: "one card each for the Ask chains, Layers notes, Aramaic notes, theme lists, parallels and era table, saying drafted with AI help (Claude, Anthropic) ... and reviewed by whom", "does not say AI sessions typed them", "List every hand-typed file and who typed it in Checks".
   - **Founder.** Decision 15, and for the Ask card decision 16.
   - **Here.** AF-SH's cards say what each compilation rests on and its rules, with the founder's choices named by date, and "Reviewed by" only for a person. No PR numbers or links, because those GitHub pages carry Claude trailers and "Generated with Claude Code" (rule 3). Checks lists the files without saying who typed them. No Ask card, and no theme card from AF-SH (section 2).
6. **Crediting Brown-Driver-Briggs.**
   - **Audit.** Question 5, recommended: "credit the Hebrew outlines truthfully ('Brown, Driver and Briggs (1906), abridged by STEPBible') for now and decide separately whether to replace them".
   - **Founder.** The citation rule (CLAUDE.md, 2026-10-11): "cite ... bible believing people who fully believe the bible ... not people who are liberalizing the bible", and "any avoid-list name in a note's text, evidence or cite fails the build", with Brown-Driver-Briggs on the avoid list (`config/layer-sources.json` line 59). Decision 10 asks for the true writer.
   - **Here.** Decision 18 takes question 5's answer. AF-LX credits the outlines truthfully, and AF-CK records a named exemption. The founder is asked whether to replace the outlines.
7. **The Aramaic label "most read it so".**
   - **Audit.** A6: "Rename the labels ('clear from the text', 'most read it so', 'scholars differ')".
   - **Founder,** decision 11: "Every statement the app shows that is not the Bible's own words names its source".
   - **Here.** AF-AR uses "clear from the text", "<N> writers cited: ..." and "scholars differ". There is no unnamed majority label.
8. **OpenBible.info's weighed works.**
   - **Audit.** Question 13, recommended: "the names at Deep labelled as OpenBible.info's sources, not the app's citations", although "Many are outside the cite list".
   - **Founder.** "Cite only Bible-believing Christian writers" (CLAUDE.md).
   - **Here.** Decision 18 takes the answer. They are labelled OpenBible.info's sources, any avoid-listed work among the 108 is reported to the founder, and AF-CK exempts this list by rule.
9. **The spine file.**
   - **Audit.** "a new credit component beside SourceNote in web/src/ui/extras/kit.tsx"; C5: "Give SourceNote a work prop".
   - **Founder's rule.** CLAUDE.md: "no change to the spine files" (the extras README lists `kit.tsx`), whose scope outside parallel extras is still open.
   - **Here.** AF-K builds in a new file, `credit.tsx`, and leaves `kit.tsx` unchanged, so no ruling is needed unless the founder prefers `kit.tsx`.
10. **The search palette.**
    - **Audit.** A15: "Footer: 'Verse text: BSB. Words: STEPBible.' Label subject rows 'Nave's subject' and question rows 'prepared question (with AI help)'".
    - **Founder.** "Keep the search box as it is" (CLAUDE.md; PR #36 closed, `1096bcb`); decisions 15 and 16 for the question rows.
    - **Here.** Held as AF-SP until the founder says whether the rule covers the result rows. The question-row label is dropped in any case.
11. **Interim read labels.**
    - **Audit.** Question 2, recommended: "elsewhere 'Checked by 17 October 2026; the date read was not recorded'".
    - **Founder,** decision 10: "The original timestamp and the truly retrieved timestamp should both be there." Decision 19: "never say who or what checked it".
    - **Here.** Decision 18 takes the answer as an interim, in decision 19's words: "checked against the source by <date>; the date it was read was not recorded" (rule 5). AF-LR runs early and labels only what its fetch proves ("read on <date>" where the stored quote was found, "page retrieved <date>" where only the page was, unless TC's spec rules that out), and AF-LE completes it, so every Layers credit gets a true read date.
12. **The shared-code limit.**
    - **Audit, as this plan carries it out.** The fixes need shared edits: dates in all 27 `sources.json` entries and the `build.rs` meta lines (AF-DT), `mod cite;` in `main.rs` (AF-K), a line in `verify.rs` (AF-CK), the lexicon line in `build.rs` (AF-LX), and the abbreviations line (AF-WR).
    - **Founder's rule.** CLAUDE.md line 49: "at most five one-line insertions per extra in `main.rs`, `build.rs`, `verify.rs`, `sources.json` and `NOTICE.md` ... Whether these limits still bind outside parallel extra work is an open founder decision." WD's spec asks the same thing as its question 4.
    - **Here.** Open, for the founder, answered once for both plans. AF-K, AF-CK, AF-LX and AF-WR stay within the limit as written (one line each). AF-DT does not; if the limit binds, it keeps the dates in a new `config/source-dates.json` and leaves `sources.json` alone (AF-DT, "Waits for").
13. **Writers' names in the Aramaic notes.**
    - **Audit.** A6: name the writer of each interpretive sentence ("Keil holds that ...").
    - **Founder's rule.** CLAUDE.md: "Sources go in the evidence field, never in a note's text."
    - **Here.** No ruling needed. The note text stays clean; each view sits in a structured `views` row with a `by` field, and the panel renders the holder's name from it, behind the notice (AF-AR).

**Open points for the founder that are not conflicts:**

- C14's question lines for hard passages (his wording);
- whether the UBS avoid entry covers the Fauna, Flora and Realia articles (AF-WW);
- whether MIT should cover writing compiled for the app (AF-SH);
- whether to replace the Brown-Driver-Briggs outlines (conflict 6);
- the one-line amendment to `VOICES-BUILD-SPEC.md` 8.3 that asks every `source.json` fragment for AF-DT's three date fields (section 2), and the card rule for WD's VI (`wd-card-rule.md`, section 2): the founder or WD's run makes the change, not this plan;
- whether the shared-code limit binds (conflict 12).

## 8. Review record

The first version (20 October 2026, 22:10) was reviewed against `main`, the in-flight branches and the founder's decisions. The review found 22 problems: 1 blocker, 9 major, 12 minor. All 22 are closed in this version, as below. Nothing in the repository was changed.

| # | Severity | Finding, in short | Closed by |
|---|---|---|---|
| 1 | blocker | AF-LX's change to `langName` would alter Ask's tie reasons (`AskSheet.tsx` 244) and the search rows (`Palette.tsx` 157) | AF-LX no longer edits `atlas.ts`; a new `langLabel` in `lex.ts` is called only by `WordStudy.tsx`. Rule 8 lists every function Ask and the palette import, directly or through other files. Gate G compares Ask and palette text for 20 questions and 20 queries, byte for byte |
| 2 | major | AF-CK's loose AI check would fail on Ask (the founder's note, "Is it wrong to use AI?") or on the city Ai | Rule 3 and AF-CK: a fixed list of case-sensitive credit phrases, credit-bearing strings only, Ask exempt by path under decision 16, never Bible text or entry names; tests that the founder's note passes |
| 3 | major | AF-AR, AF-PA, AF-WP and AF-X put writers' views on surfaces the notice leaves open | Rule 10; all four wait for `commentary-notice` and show views only through its gate (`<Commentary>`, `useGate()`), or cut to what the text shows; AF-AR's views move to a `views` array; each gated spot joins the notice's check; gate G's cleared-storage step |
| 4 | major | no-empty-selections' file list incomplete; AF-SN and AF-DI did not wait for it | Section 1 lists its provisional fix sites; AF-SN and AF-DI wait for its merge; rule 12 has every module, "waits for nothing" included, diff its files against each in-flight branch before starting and before committing |
| 5 | major | `sources.json` claimed by AF-DT outright while WD's VI adds entries to it | Section 2: shared under the one-holder rule; AF-DT merges before WD's PR-4, warns before it refuses; AF-CK makes it a refusal later; the 8.3 amendment is the founder's or WD's to make |
| 6 | major | The one-open-PR rule counted only WD's PRs | Section 2 counts every in-flight branch; shelf and NOTICE fragments go only onto a main with TC (PR H); HANDOFF section 0 is rewritten only at merge time |
| 7 | major | AF-SH and WD would each make a card for the same works | Section 2's one-card-per-work rule keyed by the Layers cite id (`layer` field, refused if doubled), the overlapping ids listed, sent to WD as `wd-card-rule.md`; AF-SH's Does follows it |
| 8 | major | Decision 19 missing; conflict 2 left open; interim label named a checker | Decision 19 in the binding list; rule 5's label in its words; conflict 2 closed; AF-HP, AF-CW, AF-WP, AF-OA and the evidence rule describe the check and name no checker |
| 9 | major | Below Deep, credits were not one tap from the source | Rule 4 and AF-K: the Simple and Study line opens the full credit in place (both dates, link, stored quote); AF-LD and AF-WP use it; gate G checks every Simple credit reaches its link in one tap |
| 10 | major | C5 ("All sources" opens the right card) undone for several panels | Each owner swaps its SourceNote for `SourceLine` on a named card (AF-SN, AF-DI, AF-PL, AF-HP, AF-OA, AF-CW, AF-TS, and AF-X for the bare Provenance lines); `check-credits.mjs` warns on any left and validates data-driven ids; AF-CK makes it a failure; section 6 lists them |
| 11 | minor | ESV card, AF-TS's footer and lexicon credit, the poem view's TAHOT wording, `WordSky.tsx` and `WhyLinked.tsx` had no owner | AF-BT (ESV card, shown only when `ESV_ENABLED`), AF-TS, AF-WP, AF-X |
| 12 | minor | No owner for theme shelf and Checks text after sourced themes | Section 2: the themes work hands AF-INT the theme card and Checks sentences, applied in AF-TS's PR; AF-SH writes only the file names; AF-TS takes its method sentence from that design and waits for AF-LX |
| 13 | minor | `Explore.tsx` split by line numbers; the fallback dropped AF-X's items | Ownership by function (section 2); AF-X's fallback is a follow-up PR of its own after sourced themes |
| 14 | minor | `build.rs` and other shared code not named as shared; AF-LE lacked the V12 bar | Section 2 names `build.rs`, `main.rs` and `verify.rs` as shared by line; conflict 12 raises the shared-code limit; AF-LE and its order row carry the V12 bar |
| 15 | minor | Gate G's em dash scan would hit quoted sources | Gate G scans only strings the app writes and exempts quotations by field, naming decision 4 |
| 16 | minor | AF-AR put writers' names in note text | A structured `views` array with `by`; the panel renders the name; conflict 13 records why no ruling is needed |
| 17 | minor | AF-K would fix field names before TC's spec | AF-K waits for TC's `CREDITS-SPEC.md` (not TC's merge); AF-Q, AF-SY, AF-PA and AF-AR wait for AF-K |
| 18 | minor | Some checks had no owned file | AF-CW owns `catena.rs` for its check, then passes it to AF-FL; AF-PA moves the kind notes into `config/parallels.json` |
| 19 | minor | Some cuts could leave a selection empty | Rule 11, applied in AF-PA, AF-HP, AF-SF, AF-WP and AF-AR, with a browser check of every affected verse |
| 20 | minor | AF-LR's "Read at" overclaimed what was read | "read on <date>" only where the stored quote was found; "page retrieved <date>" where only the page was, unless TC's spec rules it out |
| 21 | minor | Reader-facing PR links lead to AI credit | Rule 3 bars GitHub commit, PR and blob links in reader text; AF-ER names "the founder's choices of 9 October 2026"; AF-SH's cards carry no PR links |
| 22 | minor | Double assignments and missing exemptions | `README.md` 195 is AF-X's alone; AF-SH shows AF-BT's and AF-LX's cards instead of redoing them; AF-CK exempts the abbreviations table by name; AF-X's OpenBible.info evidence is a pointer, not a quote |

**Also found while revising** (not in the review): the notice is now committed (`d12a4dd`), so section 1 and rule 10 use its committed file list and API; Ask also imports `Shell`, `loadJson`, `closeExtra` and `chapterRange`, now in rule 8; `hard-verses/Panel.tsx` 132 and the `WordSky.tsx` 246 Provenance also open the top of the shelf, now AF-OA's and AF-X's.


**Added 2026-10-21 by the founder's decision 22 (to module AF-LX):** in the word study, show Strong's own short definition first, credited "James Strong, Exhaustive Concordance of the Bible, 1890" (data already pinned as sources.json "strongs", Open Scriptures JSON, CC BY-SA, credited as such), then the fuller entry credited truthfully: Hebrew "abridged from Brown-Driver-Briggs, 1906" (decision 21), Greek "abridged from Abbott-Smith, 1922", each through STEPBible. Nothing in the word study may open empty: where Strong's has no entry for a key, show only the fuller entry.
