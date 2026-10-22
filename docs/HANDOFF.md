# Bible Atlas: handoff

**Keep this current:** section 0 must be rewritten whenever `main` changes, and the PR that changes `main` should update it.

Written 2026-10-20. Section 0 was last checked on 2026-10-22 at 03:15 UTC. The file is meant to let a new person, or a new AI session, take over Bible Atlas without a conversation. It covers:

- what the product is and what is live;
- who can do what (section 1, "Access");
- how it got here;
- how to build, check, deploy and roll back safely;
- the rules that bind every change;
- what is decided and what is open;
- where every document and work log lives, and whether it is still true.

## Check the current state first

Section 0 is true only while these three commands still give the values shown. This file went stale three times on 2026-10-20 and 2026-10-21 (PRs #47, #48 and #50 each merged after a section 0 was written), so do not skip this.

```
git ls-remote https://github.com/Sixteen1-6/BibleAtlas.git refs/heads/main
#   expect the merge of #58 (figures-at-deep) on top of 85f0994abcdb19a888d7235e0d086dd4aa46e28b (#56), or the
#   merge of a docs-only PR that rewrote this section on top of that: git log --oneline 85f0994..origin/main shows only those
gh pr list --repo Sixteen1-6/BibleAtlas --state open
#   expect #53, #54 and #55 (section 0, "Local work after #50") and the draft #57 (the Deep display, section 0, "In flight"),
#   plus any docs PR that rewrites this section until it merges
curl -s https://everyversemap.com/data/meta.json | grep -o '"buildId": *"[^"]*"'
#   expect the id in CI's "build …" line on #58's merge; a full local build of #58's last head gave "buildId": "9dda295d6650",
#   and the id is a hash of the outputs, so they should match     (PowerShell: (Invoke-RestMethod https://everyversemap.com/data/meta.json).buildId)
```

If any value differs, read what changed before acting: `gh pr list --repo Sixteen1-6/BibleAtlas --state all --limit 5` and `git log origin/main`. Then rewrite section 0.

A docs-only merge moves `main` without changing code or data, so the build id stays the one #58's merge produced (`9dda295d6650` in the local build); record the new `main` in section 0 when it merges.

**Who keeps section 0 current.** Whoever merges a PR or finishes a job re-runs the three commands and rewrites section 0 in the same sitting, and the PR that changes `main` should update section 0 itself (`CLAUDE.md`, "Start here"). Cloud sessions in the founder's claude.ai project also keep a living summary of the whole project, cloud and local, in a Claude Doc that is refreshed every three hours: https://claude.ai/code/artifact/852a3499-e493-45f8-96e2-ffa4cc3d3332. This file stays the source of record for the repository; the doc is the plain-words overview.

**Conventions.**

- Paths are relative to the repository root, except those said to be on the founder's PC.
- **Every repository line number in this file is at commit `75f6edc`** (main at 2026-10-20 20:27 UTC) unless another commit is named. Open one as a permalink: `https://github.com/Sixteen1-6/BibleAtlas/blob/75f6edc/<path>#L<n>` (a range is `#L<a>-L<b>`). On a later `main` the lines may have moved; search for the function or text named beside them. `config/layers.json` line numbers in section 8 moved with #50.
- Some files named here are on the founder's own Windows PC and matter only there. Two folders on it recur. **The scratch folder** is the per-session temporary folder of one local Claude Code job, and the desktop app may clean it up. **The work folder** is a durable copy (made 2026-10-20 21:10 UTC) of the six maps and the build log (`maps`), the voices and literary research (`voices`, `literary`), the Layers plan and the four returning passages (`layers`) and every PR body (`prs.json`); it does not follow later changes in the scratch folder. Paths inside those folders are written relative to them, for example `layers/plan.json` in the work folder. The six detailed maps this file draws on are in the repository as `docs/handoff/map-*.md`, with the founder's local paths replaced by plain descriptions (section 11). Where a decision needs a number, the number is written here.
- Times are UTC. The founder's PC and its git reflogs use EDT (UTC-4); where one is quoted, the UTC time comes first.

Terms used throughout:

- **The founder** is Shubhanshu, GitHub `Sixteen1-6`, the only collaborator on the repository. He sets the rules, and every PR has been merged from his account.
- **A cloud session** is a Claude Code session on claude.ai, in the founder's claude.ai project, that worked in a container and pushed a branch. Each commit names its session in a `Claude-Session:` trailer.
- **A local job** is a Claude Code run on the founder's Windows PC, committing under his git name with a `Co-Authored-By:` line. This file comes from one, part of a workflow of sibling jobs on 2026-10-20.
- **Simple, Study and Deep** are the app's three depth levels (section 5).
- **An extra** is a plug-in panel attached to a verse line (section 5).
- **Layers** means the "Layers of meaning" notes on wordplay, names, allusions and so on.
- **Ask** means "Ask the Bible".

## 0. State on 2026-10-22 at 03:15 UTC

**Live.** Before #58, https://everyversemap.com/ served the Pages deploy of `85f0994` (#56, run 39678704553, 21:25:44 to 21:30:08 UTC on 2026-10-21). Its data is `2aabdcc`'s (the merge of PR #50 at 02:50:58 UTC on 2026-10-21), build id `6e89a09cfa05`, because #51, #52 and #56 are docs only. Pages rebuilds and redeploys on every push to `main`, so the merge of #58 deploys the figures extras with a new build id (below).

- **Data after #58.** #58 writes `extras/figures.json` and `extras/figures/<book>.<k>.json`, so the id moves from `6e89a09cfa05`. A full local build of #58's last head on `85f0994` gave `9dda295d6650` and "5925 checks passed"; take the live id from CI's data build on the merge.
- **Data before #58.** Build id `6e89a09cfa05`, from CI's data build on `2aabdcc` ("build 6e89a09cfa05" in the CI log). #50 changed `config/layers.json`, so the id moved from `7bd9f13db417`. This was not checked against the live `meta.json` from the cloud container that wrote this section, which cannot reach everyversemap.com; run the third command above to confirm it.
- **Deploy.** Pages succeeded on each merge: 39535290262 (`2aabdcc`; build 02:51:03 to 02:54:51, deploy to 02:55:03), 39634211056 (`97861e5`), 39637776561 (`b466ab6`) and 39678704553 (`85f0994`, the one live before #58).
- **CI.** Run 39535290365 is green on `2aabdcc`, the last data change before #58: lint and unit tests pass, "5909 checks passed", "shelf: 58 works", and "layers of meaning: 1268 passages, 3105 layers checked; 1268 passages live with 3105 notes (3105 live because they cite a listed source); no drafts".

**Merged after `75f6edc`:**

| PR | Merged (UTC) | What it changed | Runs on main |
|---|---|---|---|
| #49, `handoff-2026-10-20` at `6041f31`, merge `b6d7f1e` | 2026-10-20 23:59:16 | This file, the six maps in `docs/handoff/` and `CLAUDE.md`. Docs only. | CI 39518497229, Deploy 39518497270, both green. |
| #50, `layers-mend-2026-10-20` at `0da9d1c`, merge `2aabdcc` | 2026-10-21 02:50:58 | The layers-mend job. Round 1 strengths recounted by distinct cite-list writers: 15 lowered, 11 raised, 121 kept. 350 cites added, 22 moved, 10 removed. Of the 4 hidden notes, the chinnam note in `job-19-25` is now cited and live and the other three are dropped. `1-samuel-6-6`, `proverbs-3-20`, `ecclesiastes-3-18` and `ecclesiastes-3-20` are back. `docs/evidence/layers-mend-2026-10-20.json` (7,705 lines) holds a record for every cite added or confirmed. A review commit paraphrases copied NET and R. T. France wording, replaces a modern rabbi's translation, removes an ESV fragment and stops citing Ellicott's Malachi volume on Malachi 3:1. 1,264 passages became 1,268, and 3,095 notes 3,105. | CI 39535290365, Deploy 39535290262, both green. |
| #51, `claude/project-thread-nvo8rb` at `fc7d12e`, merge `97861e5` | 2026-10-21 16:22:36 | Section 0 of this file rewritten for `2aabdcc`. Docs only. | CI 39634210902, Deploy 39634211056, both green; data unchanged. |
| #52, `layers-evidence-wording`, merge `b466ab6` | 2026-10-21 16:46:22 | `docs/evidence/layers-mend-2026-10-20.json`: three source pointers reworded so no translation's wording is quoted (1 Samuel 6:6, Job 2:3, Matthew 28:20), and this section. Docs only; the build does not read `docs/evidence/`. | CI 39637776575, Deploy 39637776561, both green; data unchanged. |
| #56, `claude/project-thread-f8krzu`, squashed as `85f0994` | 2026-10-21 21:25:41 | `docs/FOUNDER-DECISIONS.md` (the founder's 23 decisions), `docs/local-work/2026-10-20/` (the local jobs' notes, audits, Voices reports and mockups), a line in `CLAUDE.md` and this section. Docs only. | CI 39678704638, Deploy 39678704553, both green; data unchanged. |
| #58, `figures-at-deep` | 2026-10-22 | Figures at Deep, data only: `crates/atlas-cli/src/extra_figures.rs` builds three Deep-only note kinds, `parallelism`, `figure` and `contrast`, from `config/figures/<book>.json` and the 13 forms in `config/figure-forms.json`, into `extras/figures*`. Five seed notes (Psalm 1:6, Isaiah 6:10, Matthew 10:34, Genesis 6:6, 1 Samuel 1:2), each citing three or four interpreters word for word; `docs/evidence/figures-2026-10-21.json` records where each quote was found. Only works on the file's `quotable` list may be quoted: Gill, Spurgeon, the Geneva notes, the Companion Bible, Henry's Concise, Wesley and the church fathers are left off, per the approved Voices shortlist and decision 10. A cite of Keil and Delitzsch, JFB, the Pulpit Commentary, Ellicott or the Catena names the writer of its volume in its own `by` (`multi_writer`), and Barnes, Henry and the Catena are quoted only on the books their named writer wrote (`only_on`). Strength counts interpreters only. Touches none of the files `true-credits` holds. Nothing shows until the display (#57) lands. | Build id moves (above). |

#49 and #50 came from local jobs on the founder's PC; #51, #52, #56 and #58 from cloud sessions. All were merged from the `Sixteen1-6` account. Section 8 rows 3 to 5 were settled by #50. Before them, #47 (merge `5296d48`) and #48 (merge `75f6edc`) merged on 2026-10-20; section 4 and the PR bodies have their detail.

**In flight.**

| Branch, session or folder | What it is | What to do |
|---|---|---|
| `claude/ask-the-bible-u6macl` at `2f40b85`, no PR | Unchanged on GitHub since 13:53 UTC on 2026-10-20: only `.github/workflows/mirror-meaning-model.yml`, 1 commit ahead of `main` and now 10 behind. The cloud Ask session (`01F5MX8Zw1CM7AW18hxHzAeP`) went on to build the potion-base-8M model into the matcher in its container, unpushed: its status reports right first picks 396 to 422 of 545 dev messages and a full build passing 5,913 checks, with a blind judging of 305 held-out questions under way. | **Do not merge `2f40b85` on its own.** The next Ask PR from this branch carries the workflow into `main`, and that merge re-runs it against Hugging Face's current revision (the workflow's lines 34-37); pin `bf8b056651a2c21b8d2565580b8569da283cab23` or drop it first (section 8, row 8). That PR must be rebased on `2aabdcc` and must follow `CLAUDE.md`. |
| `mirror/potion-base-8M` at `dced885`, orphan | The model at Hugging Face revision `bf8b0566...`. | Never merge it. Never delete it: a `sources.json` pin will name this commit. |
| Cloud sessions "Push Bible Atlas to GitHub" (Layers) and "Wordplay, questions and scholarly sources" | Since #45 Layers merged #52 (docs) and #58, the data for three Deep-only note kinds, `figure`, `parallelism` and `contrast`, in new files (`config/figures/`, `config/figure-forms.json`, `extras/figures*`) outside the files `true-credits` holds. Their display is #57 (cloud thread "Arcs and card design at Deep"), which waits for the commentary notice (#53). These notes may stand alone at Deep and do not count toward rule 7. Wordplay is writing cited notes for them (664 character contrasts found, Bullinger's 4,988 figure examples indexed), second writers for 83 held passages and 314 new wordplay leads. | Its notes arrive through the Layers session as a PR. New `config/layers.json` passages wait for the `true-credits` module; new figure notes go in `config/figures/` and must pass `extra_figures.rs`. |
| All four cloud sessions | Stopped at 23:25 UTC on 2026-10-20 on the account's usage limit and resumed at 16:13 UTC on 2026-10-21, when the project's coordinator asked each to rebase on `2aabdcc`, follow `CLAUDE.md` and resume. Usage limits have paused them again since, for hours at a time. | Nothing; they resume by themselves. |
| Local work after #50 merged (02:51 UTC on 2026-10-21) | Copied to GitHub from the cloud on 2026-10-21 (thread "Local branches and notes"), with the local commits unchanged. Finished branches: `commentary-notice` (PR #53), `af-bt` (PR #54), `no-empty-selections` (PR #55, a draft with three questions for the founder). Uncommitted worktree work, saved as found: `wip/true-credits-2026-10-21` (41 files, the true-credits module) and `wip/af-lx-2026-10-21` (7 files, the lexicon module). The founder's decisions are `docs/FOUNDER-DECISIONS.md`; the work folder's notes are `docs/local-work/2026-10-20/` (README there). | Never merge a `wip/` branch: the local job owns it and may push a finished branch. Merge #53 first; #54 and #55 after it. |
| `docs/local-work/2026-10-20/voices/` (research only) | Seven reports, written 19:31 to 20:05 UTC on 2026-10-20, on which more Christian writers could be shown word for word at Deep, with the plans, build spec and shortlist drawn from them. **Ready from GitHub with an open license:** Matthew Henry's Complete Commentary and Calvin (Let's Church); Spurgeon's Treasury of David (`lyteword/chspurgeon-tod`, CC0); the Geneva notes; Poole and other Reformers and Puritans (EEBO-TCP, CC0; Poole after a repair pass); church fathers (`HistoricalChristianFaith/Commentaries-Database`, after filtering). **Need a mirror branch:** JFB, Clarke, Barnes (New Testament), Keil-Delitzsch, Robertson's Word Pictures, Scofield, Luther. **Not recommended:** Gill and Alford. | Founder decisions 1 to 8 and 23 answer the plans' questions. Adopting a writer needs a mirror where needed, a `sources.json` pin, a `NOTICE.md` credit, a shelf card and changes to `extra_voices.rs`. |
| `docs/local-work/2026-10-20/literary/` (design only) | `fit.md`, a literary-devices design: the BSB's own poetry lines (`\q1`, `\q2`; 8,180 of 31,084 verses carry poetry marks), the Layers kinds `figure` and `parallelism`, and a `structure` extra for chiasm, inclusio and foils; `catalogue.md` and `sources.md`; and the founder's mockups `mock-arcs.html`, `mock-card.html` and `mock-reader.html`. The cloud Layers and "Arcs and card design at Deep" sessions are building `figure`, `parallelism` and `contrast` and the Deep display from them. | #58 settles the kind names as `parallelism`, `figure` and `contrast` (its `mirror` form covers chiasm); a later `structure` extra should keep to them (section 8, row 14). The Deep display sits behind the commentary notice (#53). |
| `docs/local-work/2026-10-20/meaning/` | The local potion-base-8M held-out checks: scripts, word list and logs (the 3.9 MB vector file was left on the PC). | Read beside the Ask session's evaluation sets before the meaning-model decision (section 8, rows 7 to 9). |

**Next, in order** (section 9 has the evidence):

1. Put `ask/meaning.json` under the build id, so returning visitors cannot keep old weights. It is code only, and anyone can open the PR.
2. Push the local work done after #50, and the local research folders, to GitHub where the licensing rules allow.
3. Make the build safe on Windows and pinned everywhere.
4. Decide the meaning model (section 8, rows 7 and 8) before the next Ask PR.

Items 2 and 3 of the previous list are done: this file is in the repository (#49) and the layers-mend work landed (#50). Recovering the Ask evaluation sets (section 9, item 8) can only be done by the founder, after the section 8 decision on where they may live.

## 1. What this is

Bible Atlas is a free, static web app, live as everyversemap.com.

- **The map.** It draws all 344,799 OpenBible.info cross-references between the 31,102 verses as arcs on one WebGL2 map.
- **The original languages.** The Hebrew, Aramaic and Greek sit under every verse, with word studies.
- **Themes and paths.** 163 themes are traced through specific original-language words. Paths and "roads" between verses come from a Rust graph engine compiled to WebAssembly.
- **Extras.** Thirteen panels attach to verse lines: quotations, parallels, places on a real map, Aramaic, wordplay, study notes, Christian writers, hard passages, a dictionary, the Syriac Peshitta and more.
- **Ask the Bible.** It answers 1,584 prepared questions with chains of Scripture only, and gathers verses for anything else.
- **Layers of meaning.** 1,264 passages carry 3,095 live notes on wordplay, names and allusions, each citing a Bible-believing writer.
- **Translations.** The reader always has the public-domain BSB. The NET is read live, and the ESV is available only behind a server proxy, which is off on the public site.
- **Pinned data.** All data is built ahead of time from open sources pinned by git commit, and the build refuses anything it cannot verify.
- **Depth.** Every visit starts at Simple; Study and Deep are one tap away. Since #48, Simple shows only the plain lines under a verse; study notes, Ask questions and "Often asked" start at Study.

The founder's main point for the app (PR #4): simple for anyone who walks in, with the power to go as deep as the Bible does. It was built between 2026-10-07 and 2026-10-20, almost entirely by Claude Code cloud sessions working to the founder's rules, and on 2026-10-20 by local jobs on his PC.

| Thing | Where |
|---|---|
| Repository | https://github.com/Sixteen1-6/BibleAtlas. Public, default branch `main`, created 2026-10-07. The only collaborator is `Sixteen1-6` (admin). No branch protection, no rulesets. Issues are enabled (none filed). |
| Live site | https://everyversemap.com/. `http://`, `www.` and https://sixteen1-6.github.io/BibleAtlas/ all redirect there with a 301. |
| Domain | everyversemap.com, with DNS at Squarespace: 4 GitHub A records on the apex, and `www` as a CNAME to `sixteen1-6.github.io`. Set by `web/public/CNAME` in `ab53468` (2026-10-11). HTTPS is enforced and the certificate runs to 2027-01-09. The domain is not verified on the GitHub account (no `_github-pages-challenge` TXT record; the Pages API gives `protected_domain_state` null). |
| Hosting | GitHub Pages, built by `.github/workflows/pages.yml` on every push to `main`: environment `github-pages`, deploys from main only. There is no server, so the ESV is off (`VITE_ESV=off`). With a server, `server/serve.mjs` plus `server/esv.mjs` serve the site and the ESV proxy. |
| Data sources | 27 sources in `sources.json`, from 17 git checkouts, each pinned to a 40-character commit. They are: OpenBible.info cross-references, geocoding and shapes; the BSB (scrollmapper, and usfm-bible for footnotes); KJV; ASV; STEPBible TAHOT, TAGNT, TBESH, TBESG and TFLSJ; Clear Bible alignments and MACULA Hebrew; Theographic; Natural Earth; Strong's; Nave's (used as an index only); the DSC Peshitta; the Tyndale Open Bible Dictionary; Aquifer/Tyndale Open Study Notes; UBS Fauna, Flora and Realia; Easton's and Smith's dictionaries; the Catena Aurea; Henry's Concise commentary; and Wesley's notes. Twelve hand-made tables in `config/` sit on top of these. The NET is read live from labs.bible.org; the ESV comes through the Crossway API. |
| License | Code: MIT (`LICENSE` line 3: "Copyright (c) 2026 Shubhanshu Pokharel"); GitHub's API reports it as NOASSERTION. Data: each source's own license, listed in `NOTICE.md`: public domain, CC BY 4.0 or CC BY-SA 4.0 (the Strong's JSON says only "CC BY-SA", with no version). The NET and the ESV are used by permission, non-commercially, and never stored. The authored content (Layers, hard verses, Aramaic notes, theme blurbs, Ask chains) has no license of its own, so it falls under MIT by default. Whether that is intended is not recorded (uncertain). |

**Access: who can do what.** Only the founder's accounts can do most things that change the project.

| Action | Account or role it needs | Can a successor do it? |
|---|---|---|
| Read the code, build, test, run the site locally | none (the repository is public) | Yes. |
| Open a PR | any GitHub account, from a fork | Yes; CI runs on pull requests (`ci.yml` triggers on `push` and `pull_request`), though GitHub may hold a first-time contributor's run until the founder approves it. |
| Merge a PR, push or revert on `main`, push a branch to the repository, run a workflow by hand, change settings, branch protection, Pages or secrets | write or admin on `Sixteen1-6/BibleAtlas` | No. `Sixteen1-6` is the only collaborator. The founder must merge, or add the successor as a collaborator. |
| Open the cloud sessions (`https://claude.ai/code/session_<id>`), the project `chan_011qDT8Q1c7gDodDspnZeS1d` and its 16 threads, and the project files (`/mnt/project-files/bible-atlas/...`) | the founder's claude.ai account | No, unless he shares them. This includes recovering the Ask evaluation sets from session `01F5MX8Z` (section 9, item 8). |
| Open the review pages (the Layers review artifact `GcZhxjKjNbKcKJvMUYQcBy`, and the Ask and Often-asked review pages) | the claude.ai account that made them | On 2026-10-20, Claude Code on the founder's PC (signed in to a claude.ai account) got "artifact not found" for the Layers page: deleted, or not shared with that account. Whether the founder's own login opens it is not recorded. |
| Change DNS for everyversemap.com (A records, `www`, the GitHub verification TXT) | the Squarespace account that holds the domain | No; the founder. Which Squarespace login holds it is not recorded. |
| Turn on the ESV on a server | a Crossway ESV API key | Who holds a key, if anyone, is not recorded. The repository has 0 secrets, and Pages runs with `VITE_ESV=off`. |
| Work on the founder's PC (his clones, the scratch and work folders, the worktrees) | the founder's machine | Only through him. |

**Founder decisions: how to ask and where to record them.** Ask the founder on GitHub (mention `@Sixteen1-6` on the PR or an issue) or in a thread of his claude.ai project. Until now his decisions are recorded in PR bodies, commit messages (for example `1096bcb`) and the `_comment` fields of `config/*.json`, and some only in claude.ai threads that a successor cannot read. Record each new decision where everyone can see it: a comment on the PR it affects, or a dated line in `docs/FOUNDER-DECISIONS.md`, which holds the 23 decisions of 2026-10-20 and 21 and overrides `CLAUDE.md` where they differ. No other contact details are given here, by rule (section 6).

## 2. Read in this order

1. This file.
2. `README.md`: what the app does, the quick start, how it is built. Its numbers are stale (section 9, item 7), and its "What it does" list predates Ask, Layers and most extras.
3. `NOTICE.md`: every source and license, the STEPBible changes, and the ESV and NET terms. It is current as of `0e04cdc` (2026-10-20).
4. `sources.json`: its `_comment` and each source's `note` say what is used, why, and what is withheld.
5. `web/src/depth.ts` lines 1 to 14: the three depth levels and the gating rule.
6. `web/src/ui/extras/README.md`: the contract for extras and the design rule (lines 5 to 11), the source rules (lines 43 and 175 to 179), and the five shared-file insertions (lines 45 and 243 to 248). The table at lines 22 to 30 is stale.
7. The founder's rules in the data files:
   - `config/layer-sources.json` `_comment`, lines 3 to 6: the citation rule;
   - `config/questions.json` `_comment`: the Ask rule;
   - `crates/atlas-cli/src/ask.rs` lines 1 to 25;
   - `crates/atlas-cli/src/layers.rs` lines 1 to 60.
8. `crates/atlas-cli/src/build.rs`, `run()` at lines 98 to 561, for the build order; then `crates/atlas-cli/src/verify.rs`, lines 52 to 320.
9. PR bodies, with `gh pr view <n> --repo Sixteen1-6/BibleAtlas`. They are the record of what was done and why. Start with:
   - #5, the first big release, with its follow-up list;
   - #26, where build ties replaced approval for Ask;
   - #38, the citation rule;
   - #42 and #44, the Layers round 2 conventions;
   - #43, the latest Ask round;
   - #46, the NET;
   - #47 and #48, the last two merges (section 0).
10. `IDEAS.md`, last. It has not been touched since 2026-10-07. Of its fifteen ideas, 4 have shipped, 3 are partial and 8 are not built (section 9, item 13).

At `75f6edc` there is no `CLAUDE.md` or `AGENTS.md` in the repository; section 6 says where the rules live instead. Branch `handoff-2026-10-20` adds a [`CLAUDE.md`](../CLAUDE.md) at the root, drawn from sections 6 and 7.

## 3. Where things stand (2026-10-20, at `75f6edc`)

| Surface | State |
|---|---|
| `main` | `75f6edc`, 310 commits. CI is green; the last 72 workflow runs all succeeded. 340 runs existed at 21:00 UTC on 2026-10-20; 332 succeeded and 8 failed. The last failure was run 38103716257 on 2026-10-11, when the build correctly refused a Layers note citing an avoid-listed source. |
| Live site | Equal to `main` (section 0). Pages deploys on every push to main. CI runs alongside it but does not gate the deploy. |
| Engine and data | 31,102 verses, 344,799 cross-references (341,385 with positive votes), and 300,821 Hebrew, 4,827 Aramaic and 137,646 Greek words, with 0 unmapped. `atlas.bin` holds 15 sections. The WebAssembly engine is 75,220 bytes. |
| Checks | 218 Rust unit tests (CLI 199, core 18, wasm 1) and 5,909 `atlas verify` checks. `clippy -D warnings` is clean on rustc 1.99. There are no TypeScript tests beyond `tsc --noEmit`. |
| Translations | BSB at every level. NET live from labs.bible.org since #46: at most two chapters in memory, notes linked rather than shown. The session tested it only against mocked answers; on 2026-10-20 a live request returned 200 with `Access-Control-Allow-Origin: *`. ESV is off on Pages. |
| Ask the Bible | 1,584 prepared questions live, each with a chain of 3 to 8 Scripture parts that the build ties to the Bible's own data. 66,514 training examples. The meaning matcher is `ask/meaning.json`, 1.76 MB gzipped. Gathered verses (when no prepared answer fits) were off topic 48% of the time on the hardest blind set (#41). Since #48 the "People ask" line under a verse starts at Study. |
| Layers | 1,264 passages and 3,099 notes in `config/layers.json`. 3,095 notes are live under the citation rule; 4 are hidden for lack of a citation. 0 passages have `reviewed_by`. At Deep the UI says "Not yet reviewed by a person" (`web/src/ui/Layers.tsx:260`). The layers-mend job is changing round 1 (section 0). |
| Hard verses ("Often asked") | 56 cards drafted, 0 approved, so the live `cards.json` is empty. Link-only "Hard passages" pointers for all 56 (verses plus 114 read-more links) are live at Deep. Since #48 the cards, once approved, start at Study. |
| Themes | 163 themes in 10 groups (9 at Study only), plus 379 reviewed related-word pairs. 70.7% of verses carry a theme at Simple (#24). |
| Other content | Aramaic: 34 words and 46 loan roots. Parallels: 307 sets. Eras: 17 eras for 66 books. Study notes: 16,923 (from Study on, since #48). Sources shelf: 58 works in 12 groups. Christian writers at Deep after opt-in: Catena on 3,774 verses, Henry on 31,055, Wesley on 16,704. |
| Repository settings | No branch protection. Merge, squash and rebase are all allowed; delete-branch-on-merge is off. 0 secrets, 0 webhooks. Secret scanning and push protection are on; Dependabot is off. GitHub's repository traffic (views of the repository on github.com, not of the site) for the 14 days to 2026-10-20: 50 views (5 unique); 0 stars. The site itself has no analytics or monitoring (section 10). |

Branches. There are 43 on GitHub, plus one local-only branch. 40 GitHub branches besides `main` are merged; 2 are not.

| Branch | Tip | In main? | PRs |
|---|---|---|---|
| `main` | `75f6edc` | (main) | |
| `claude/ask-the-bible-u6macl` | `2f40b85` | **no** (1 ahead, 7 behind) | #16 #26 #28 #29 #31 #32 #34 #35 #36 (closed) #40 #41 #43 |
| `mirror/potion-base-8M` | `dced885` | **no** (orphan; never merge) | none |
| `layers-mend-2026-10-20` (local only) | `a46d819`, uncommitted work | nothing committed yet | none |
| `simple-level-2026-10-20`, `small-fixes-2026-10-20` | `1bd6536`, `89c149f` | yes | #48, #47 |
| `claude/net-bible-6d3ryw` | `0e04cdc` | yes | #46 |
| `layers-wordplay-part2r`, `layers-wordplay-part2`, `layers-wordplay-part1` | `5e1ed7f`, `05fe581`, `7c37488` | yes | #45, #44, #42 |
| `layers-bullinger`, `layers-citations`, `layers-wordplay`, `layers-quote-marks` | `13f9d63`, `1a8d291`, `16a7444`, `9c195f6` | yes | #39, #38, #23, #10 |
| `claude/project-thread-1eyqzh` (Wordplay thread) | `b55d549` | yes | #15 #19 #20 #25 #33 #37 |
| `claude/themes-eras-review-b1ka8x` | `4907e5a` | yes | #11 #24 #27 #30 |
| `claude/project-thread-r2awql` (search) | `0327564` | yes | #2 #14 #21 |
| `claude/word-forms-family-i4ywp8` | `48c8e3f` | yes | #18 |
| `claude/sources-shelf-h2m7qu`, `claude/places-quote-data-lr4itd`, `claude/study-notes-f5sshe` | `795d687`, `4520822`, `2dc9051` | yes | #22, #17, #13 |
| `claude/map-colours-level-hints-wkbxen`, `claude/small-fixes-ued4kg`, `claude/hover-highlight-18rfr1`, `claude/jesus-aramaic-tf1tc8` | `39c97bf`, `1ccbd96`, `53954af`, `2367c90` | yes | #12, #9, #7, #8 |
| `claude/merge-all-ideas-tbjk33` (integration) | `bb2881b` | yes | #5 |
| `phase1-first-minute`, `claude/project-thread-68xr52` | `9a40805`, `7488edf` | yes | #1, #3 |
| `depth-levels`, `phase2-layers` | `7be1d3a`, `4a47c7d` | yes, via #5 | #4, #6 (both closed only because their bases were stacked) |
| `before-ideas-2026-10-08` | `41069d9` | yes (snapshot of main before #5) | none |
| 13 `ultracode/*` branches: living-sky, ideas-spine, theme-journeys, many-roads, hebrew-meets-greek, quotes, real-map, books-in-conversation, parallels, arrival, word-sky, time-periods, words-in-their-world | various, 2026-10-08 and 10-09 | yes, via #5 (`996130a`) | none of their own |

PRs: 48 in all. 45 merged, 3 closed, 0 open.

- **Bases.** Four PRs did not target `main`: #4 (base `phase1-first-minute`), #6 (base `depth-levels`), and #7 and #8 (base `claude/merge-all-ideas-tbjk33`, the integration branch). All four reached `main` through #5.
- **#4 and #6.** Not rejected; their work landed through #5.
- **#36.** A real rejection (section 8).
- **Reviews.** No PR has a GitHub review. The median time from open to merge was 10 minutes.
- **How PRs landed.** `main`'s first-parent line has 37 two-parent merge commits (including `a46d819`, `5296d48`, `75f6edc`, and `16af21d` for #42 and `9e2a746` for #27, which carry custom titles) and three squash merges with one parent: `99ba7ca` (#19), `d1a2bb1` (#20) and `fbfca22` (#25). Section 7 says how to revert each kind.
- **Direct pushes.** Two sets of commits went straight to main without a PR: the five opening commits (`a59dfb2` to `41069d9`) and `ab53468`, the custom domain.

Worktrees on the founder's PC (four):

- `BibleAtlas`: the main clone (CRLF), clean, at `5296d48`. A sibling job fetched and fast-forwarded it at 19:47 UTC (15:47 EDT); it has not fetched `75f6edc`;
- `BibleAtlas-fixes`: `small-fixes-2026-10-20` at `89c149f` (#47, merged), clean;
- `BibleAtlas-simple`: `simple-level-2026-10-20` at `1bd6536` (#48, merged), clean;
- `BibleAtlas-layers`: `layers-mend-2026-10-20`, with uncommitted work (section 0).

A fifth worktree, `BibleAtlas-handoff` (branch `handoff-2026-10-20`, from `75f6edc`), was added after 21:00 UTC to bring this file into the repository.

## 4. How it got here

- **2026-10-07.** The original import, `a59dfb2`, already had:
  - the WebGL2 map of all 344,799 cross-references, and the Wheel;
  - the BSB reader, with the ESV through a proxy;
  - word study with manuscript variants;
  - 16 themes, and paths and PageRank from the Rust engine compiled to wasm;
  - 192 checks.

  The same evening, still on main with no PR: new colours and `IDEAS.md` (`818c732`), the Pages deploy with `VITE_ESV=off` (`6dad5eb`), a clippy fix for Rust 1.99 (`8a70f1e`) and the link preview image (`41069d9`).
- **2026-10-08.** Parallel building:
  - #1, the "first minute" (hover and follow, Clear and Esc, Strongest/More/All);
  - #2, search;
  - #3, colour pairs from the Clear alignments;
  - #4, the depth levels;
  - 13 `ultracode/*` idea branches from one session (78 commits);
  - the first Layers card (#6);
  - the integration branch (#5).
- **2026-10-09.**
  - Into the integration branch first: #7, hover lighting (03:23 UTC), and #8, Aramaic and the Peshitta (04:03 UTC). They reached `main` through #5.
  - #5 merged into `main` at 05:53 UTC (`996130a`), the first big release; `before-ideas-2026-10-08` keeps the main it replaced. #1, #2 and #3 (base `main`) were marked merged in the same second, because their commits arrived through #5.
  - Then 13 merges into `main` between 06:44 and 09:52 UTC, about one every 15 minutes: #10, Layers quote marks; #9, small fixes; #12, map colours; #13, study notes; #14, KJV/ASV search; #17, places with Septuagint pairs; #11, era decisions; #15, wordplay; #16, Ask v1 with 73 draft chains; #19, 56 draft "Often asked" cards; #20, wordplay name fixes; #22, the Sources shelf; #23, 88 Layers passages.
- **2026-10-10.** The day's merges:
  - #24, 163 themes, and the alignment fix;
  - #21, search folding;
  - #25, 13 website cards on the shelf, shown only when the app cites them;
  - #26, Ask chains go live through the build's tie check instead of approval;
  - #18, word forms;
  - #27, Nave's rows;
  - #28 and #29, Ask rounds measured blind;
  - #30, related words;
  - #31, 663 answers;
  - #33, Christian writers and hard passages at Deep (the hard-passage pointers cite the 13 website cards, so they appear on the shelf);
  - #32, the meaning matcher, 871 answers.
- **2026-10-11.**
  - #34 and #35 add the founder's note above every Ask answer, in his own words.
  - #36 ("Ask or search the Bible" in the header) is closed, and its commit is reverted in `1096bcb`.
  - The founder sets the citation rule: cite only Bible-believing Christian writers. #37 applies it, and #38 makes Layers notes go live by that rule.
  - #39 adds Bullinger.
  - #40 brings Ask to 1,224 answers.
  - `ab53468` moves the site to everyversemap.com.
  - #41 reorders gathered verses by what blind readers found answered (`SHOW`).
- **2026-10-12 to 10-16.** No commits.
- **2026-10-17.** Layers round 2 from the Wordplay thread, with refuter passes: #42, then #44, then #45. Together they add 1,176 passages, for 1,264 passages and 3,095 live notes. #43 brings Ask to 1,584 answers.
- **2026-10-20.**
  - #46 adds the NET (`59d17f0`, then `0e04cdc`), and main becomes `a46d819` at 14:01 UTC.
  - The Ask session pushes the mirror workflow (`2f40b85`, 13:53 UTC), and the bot writes `mirror/potion-base-8M` (`dced885`).
  - A local workflow on the founder's PC maps the project, checks the build natively on Windows, and runs sibling jobs. #47 (map count and 37 broken links) merges at 19:35 UTC, and #48 (Simple keeps to the verse) at 20:27 UTC; main becomes `75f6edc`. The Layers mend, the voices research and the literary study are still in progress (section 0).

How the counts grew:

| What | Growth |
|---|---|
| Verify checks | 192, 784 (#5), 2,404 (#24), 4,838 (#31), 5,909 (#46) |
| Ask answers | 73 draft, 73 live, 663, 871, 1,224, 1,584 |
| Layers passages | 15, 70, 88, 470, 1,261, 1,264 |

## 5. How it works

```
sources.json (27 sources, 17 repo@commit checkouts)
  | atlas fetch   crates/atlas-cli/src/fetch.rs: system git, sparse, depth 1; curl only for Git LFS
  v
data/raw/<repo>@<commit10>/... + data/raw/manifest.lock.json          (gitignored)
  | atlas build   crates/atlas-cli/src/build.rs: also reads config/*.json; refuses any hash mismatch
  v
web/public/data/: atlas.bin + meta.json + about 2,200 JSON/TXT shards  (gitignored)
  | atlas verify  crates/atlas-cli/src/verify.rs: checksum of every file plus fact checks (5,909)
  | npm prebuild  web/scripts/ask-meaning.mjs: trains web/public/data/ask/meaning.json
  | scripts/build-wasm.sh -> web/src/engine/atlas.wasm                 (gitignored)
  v
web/ (Preact, @preact/signals, TypeScript, Vite) -> web/dist
  main thread: WebGL2 arc field, SVG overlay, panels
  worker 1: atlas.wasm graph engine;  worker 2: KJV/ASV search indexing;  service worker: public/sw.js
  -> GitHub Pages (pages.yml, VITE_ESV=off)   or   node server/serve.mjs (+ /api/esv)
```

**The idea** (`crates/atlas-core/src/lib.rs:12-16`): the Bible indexed like a code-intelligence index.

- A verse is a dense u32, from Gen 1:1 = 0 to Rev 22:21 = 31,101.
- A word is a (verse, position) pair, and a root is a dense u32.
- Cross-references are stored as CSR (compressed sparse rows), and root occurrences as an inverted index.
- The same `no_std` crate writes the binary at build time and reads it in WebAssembly at run time.

**Rust workspace** (`Cargo.toml`: 3 crates, edition 2021, `rust-version` 1.88, release with LTO, 1 codegen unit and `panic=abort`, plus a `wasm` profile with `opt-level "s"`):

- **`crates/atlas-core`** (no_std, no dependencies):
  - `canon.rs`: the 66 books;
  - `versification.rs`;
  - `container.rs`: the "ATLS" format with 32-byte section records and 8-byte-aligned payloads;
  - `graph.rs`: the CSR graph, PageRank (`pagerank(damping, iterations)` at `graph.rs:115`; the values, 0.85 and 40, are `PAGERANK_DAMPING` and `PAGERANK_ITERATIONS` at `crates/atlas-cli/src/build.rs:41-42`), the Dijkstra shortest path, up to k vertex-disjoint "roads", BFS neighbourhoods, and the book flow for the Wheel;
  - `refs.rs`: fuzzy reference parsing.
- **`crates/atlas-wasm`** (296 lines): no wasm-bindgen; `extern "C"` exports over linear memory with dlmalloc.
  - Exports: `atlas_load`, `atlas_path`, `atlas_paths`, `atlas_near`, `atlas_links_within`, `atlas_parse_ref`.
  - Built by `scripts/build-wasm.sh`, targeting `wasm32-unknown-unknown` with `--profile wasm`.
- **`crates/atlas-cli`** (36,842 lines in 32 files at `75f6edc`; 36,838 at `a46d819`, before #47 added 4 lines to `layers.rs`; depends only on serde, serde_json and sha2).
  - Commands: `fetch`, `build`, `verify`, `query xref|path|roads|near|word`, and `themes-review`. `--raw <dir>` and `--out <dir>` are accepted with any command (`main.rs:75-76`); `fetch` and `build` use `--raw`, and `build`, `verify`, `query` and `themes-review` use `--out`.
  - Every content module follows one plug-in shape: `build(...) -> Vec<(path, bytes)>` and `verify(&Loaded) -> Vec<(bool, String)>`.

**CLI module map** (lines and `#[test]` counts at `75f6edc`; "verify" says whether `atlas verify` checks the output beyond its checksum):

| Module | Lines | Reads (sources.json id or config) | Writes under `web/public/data` | verify | Tests |
|---|---|---|---|---|---|
| `main.rs` | 90 | | | | 0 |
| `build.rs` | 561 | everything below, in order (`run()`, lines 98 to 561) | `atlas.bin`, `meta.json`, `text/`, `lex/`, `dict/` and the rest | | 0 |
| `sources.rs` | 130 | `sources.json`, the lock | | | 0 |
| `fetch.rs` | 145 | `sources.json` | `data/raw/**`, the lock | | 1 |
| `parse.rs` | 757 | `bsb`, `openbible-xref`, `tahot`, `tagnt`, `tbesh`, `tbesg` | | | 2 |
| `align.rs` | 659 | `clear-align` (6 files) | aligned rows inside `text/<Book>.json` | in `verify.rs:147-192` | 3 |
| `english.rs` | 72 | BSB text | `e_off`/`e_verse`, `words.json`, `bsb.txt` | | 1 |
| `lexhtml.rs` | 143 | lexicon HTML | safe segments `[text, style, verse]` in `lex/` | | 1 |
| `family.rs` | 1,506 | `strongs` (Greek, Hebrew) | `forms/<n>.json` (word families) | via themes | 7 |
| `themes.rs` | 1,435 | `config/themes.json`, `config/theme-related.json` | `themes.json`, theme fields of `meta.json` | yes | 9 |
| `themes_review.rs` | 295 | built data | stdout | | 0 |
| `layers.rs` | 767 | `config/layers.json`, `config/layer-sources.json` | `layers.json` | checksum only | 10 |
| `lxx.rs` | 758 | TBESG notes and TBESH | `lxx.json` (Septuagint bridges) | in `verify.rs:201-283` | 9 |
| `eras.rs` | 2,668 | `tyndale-tbd`, `config/eras.json` | `eras.json` | yes | 15 |
| `extra_quotes.rs` | 2,605 | `bsb-usfm`, `macula-hebrew`, `tbesg`, `tbesh` | `extras/quotes.json`, `extras/quotes/notes.json` | yes | 12 |
| `extra_parallels.rs` | 1,260 | `bsb-usfm`, `config/parallels.json` | `extras/parallels.json`, `extras/parallels/<Book>.json` | yes | 7 |
| `extra_real_map.rs` | 4,561 | `openbible-geo`, `openbible-shapes`, `theographic`, `natural-earth` | `extras/real-map.json`, `extras/real-map/{places,base,people,events,shapes}.json` | yes | 18 |
| `extra_aramaic.rs` | 1,417 | `bsb-usfm`, TAHOT/TAGNT words, `config/aramaic.json` | `extras/aramaic.json`, `extras/aramaic/deep.json`, `origin` in `lemmas.json` | yes | 1 |
| `extra_peshitta.rs` | 1,049 | `dsc-peshitta` | `extras/peshitta.json`, `extras/peshitta/<Book>.json` | yes | 6 |
| `extra_notes.rs` | 689 | `aquifer-osn` | `extras/notes.json`, `extras/notes/<Book>.json` | yes | 2 |
| `extra_voices.rs` | 1,446 | `catena-aurea`, `henry-concise`, `wesley-notes`, `kjv` | `extras/voices.json`, `extras/voices/<Book>.<k>.json` | yes | 9 |
| `extra_wordplay.rs` | 392 | TAHOT words | `extras/wordplay.json` | yes | 2 |
| `extra_hard_verses.rs` | 556 | `config/hard-verses.json` | `extras/hard-verses.json` (also the Hard passages pointers), `extras/hard-verses/cards.json` | yes | 3 |
| `extra_dictionary.rs` | 370 | dictionaries from `shelf.rs` | `extras/dictionary.json`, `extras/dictionary/<book>.json` | yes | 2 |
| `extra_translations.rs` | 93 | `kjv`, `asv` | `search/kjv.txt`, `search/asv.txt` | checksum only | 1 |
| `shelf.rs` | 2,494 | `config/shelf.json`, `config/aramaic.json`, `config/hard-verses.json`, `easton`, `smith`, `sources.json` | `shelf.json`, `dict/<id>/index.json`, `dict/<id>/<letter>.json` | yes | 17 |
| `naves.rs` | 1,282 | `naves`, `theographic`, `openbible-geo`, `kjv`, `config/naves-display.json` | `naves/<Book>.json` | yes | 12 |
| `ask.rs` | 1,190 | `config/questions.json`, `config/ask-examples.json` (validated only), Nave's, quotes | `ask/index.json`, `ask/also.json`, `ask/signals.json`, `ask/q/<id>.json`, `ask/topics/<n>.json` | yes | 7 |
| `world.rs` | 6,897 | `tflsj`, `ubs-ffr`, `tahot` | the word study's "In their world": LSJ entries `world/<k>.json` and UBS Fauna, Flora and Realia `world/ubs.json`, `world/ubs/<n>.json`, under a 2.5 MB budget | yes | 42 |
| `loaded.rs` | 80 | built data | (reader for verify and query) | | 0 |
| `query.rs` | 155 | built data | stdout | | 0 |
| `verify.rs` | 320 | built data and config | | | 0 |

**Build order** (`build.rs::run`, lines 98 to 561):

1. Check inputs against the lock.
2. The BSB defines the verse numbering.
3. Cross-references.
4. TAHOT and TAGNT words.
5. Clear alignment.
6. Lexicons and the root table.
7. Postings, PageRank, degree, book flow and the English index.
8. Word families.
9. Themes and Layers.
10. Write every output (lines 357 to 479).
11. The build id: SHA-256 over the outputs' hashes, first 12 hex characters (lines 481 to 483). Identical inputs give an identical id: CI, Pages and the founder's PC all reproduced `514b1f3bf2b1` at `a46d819`, and CI and Pages both gave `7bd9f13db417` at `5296d48` and `75f6edc`.
12. Write `meta.json`.

**Hand-made tables in `config/`** (sizes are the committed LF blobs; a CRLF checkout on Windows is 1 to 2% larger, for example 3,076,995 bytes for `layers.json`):

| File | Contents |
|---|---|
| `themes.json` | 163 themes |
| `theme-related.json` | 379 related words |
| `layers.json` | 1,264 passages, 3.0 MB (3,022,861 bytes) |
| `layer-sources.json` | 43 citable works (38 with role "interpreter", 5 "reference") and 27 avoid entries |
| `questions.json` | 1,584 Ask questions, 2.6 MB (2,580,812 bytes) |
| `ask-examples.json` | 66,514 example messages, 4.9 MB (4,931,134 bytes) |
| `hard-verses.json` | 56 cards |
| `aramaic.json` | |
| `parallels.json` | 307 sets |
| `eras.json` | |
| `shelf.json` | 58 works |
| `naves-display.json` | |

No web code imports `config/` directly. Everything reaches the page through the build, except `ask-examples.json`, which `ask-meaning.mjs` reads (line 28).

**Web app** (`web/`, 120 TypeScript files, 27,542 lines at `75f6edc`):

- **Boot.** `main.tsx` loads `arrival.ts` first (boot hand-off, service worker registration in production). Then `App.tsx`, lines 116 to 147, runs in order: `loadAtlas`, the layers, the engine worker, restore from the URL hash, and Isaiah 53:5 when there is no link.
- **State and links.** State lives in signals in `web/src/state.ts`. Every view is a link (`web/src/url.ts`): `v`, `r`, `w`, `t`, `p`, `tab`, `x` for an open extra, and `ask`.
- **Engine.** Calls go through `web/src/engine/client.ts` (one promise per call) to `engine.worker.ts`.
- **Drawing.** `web/src/gl/arcs.ts` (1,258 lines) is an additive half-float field bucketed by vote strength, then tone-mapped. `renderSettled()` at line 769 is kept for a future share image. `ui/Wheel.tsx` draws the book-to-book flow.
- **Screens.**
  - `ui/Reader.tsx`: BSB, NET or ESV, with the originals at Study;
  - `ui/Connections.tsx`;
  - `ui/WordStudy.tsx`;
  - `ui/Explore.tsx`: Themes, Paths, Hubs;
  - `ui/Sources.tsx`: the Sources shelf, at Deep;
  - `ui/Palette.tsx`: search, with `/` or Ctrl+K;
  - `ui/ask/AskSheet.tsx`.
- **Data loaders.** One per data family in `web/src/data/` (23 files). `net.ts` and `esv.ts` hold at most 2 chapters and store nothing.
- **Depth levels** (`web/src/depth.ts`):
  - Simple: the map, the English reader, Links and Themes, the Simple extras (quotations, parallels, themes, places, Aramaic words, wordplay), the era line;
  - Study adds: originals, word-by-word, Word/Paths/Top verses, the vote filter, the Wheel, shared roots and Septuagint bridges, Nave's rows, the dictionary, and (since #48) study notes, the Ask "People ask" line and "Often asked";
  - Deep adds: other editions, manuscript detail, colour modes, Sources, the Deep extras, evidence and citations.

  Code gates with `atLeast(...)` (signals) or `levelAtLeast(...)` (extras). At `75f6edc`, `git grep -E "(level)?[aA]tLeast\('(study|deep)'\)"` over `web/src` finds 84 calls in 28 files: 54 of `atLeast` in 15 files and 30 of `levelAtLeast` in 13. Counting every call, whatever its argument, gives 61 and 34. An extra can also declare `level: 'study'` or `level: 'deep'`.
- **Extras spine** (`web/src/ui/extras/`).
  - Any `*.extra.tsx` file is found by `import.meta.glob` (`registry.ts:14`) and validated.
  - Most have a build module named `extra_<name>.rs`. The exceptions: `ask` is built by `ask.rs`, `themes` by `themes.rs`, and `hard-passages` by `extra_hard_verses.rs`. `extra_translations.rs` builds the KJV/ASV search text and has no extra.
  - The 13 extras, by order and level: quotes 10, hard-verses 11 (Study), hard-passages 12 (Deep), aramaic 15, parallels 20, themes 25, real-map 30, wordplay 35, ask 40 (Study), peshitta 40 (Deep), dictionary 50 (Study), notes 50 (Study), voices 55 (Deep). Those with no level show at Simple.
  - Extras wait for the reader's first move, so a first visit loads nothing extra.
- **Service worker** (`web/public/sw.js`, 398 lines).
  - Navigation is network-first with a 3-second wait; `meta.json` is network-first with 4 seconds.
  - `?v=<buildId>` data and hashed assets are served cache-first (`classify`, lines 127 to 133).
  - It never caches `/api/` or other origins (comments at lines 13 and 14; enforced at line 139).
  - `KILL` at line 24 removes it for everyone; `?sw=off` removes it in one browser.

**Ask the Bible** (`crates/atlas-cli/src/ask.rs` and `web/src/ui/ask/`). A typed question goes through these steps:

1. **The palette.** `matchAsk` in `ask.ts:382-424` handles exact phrasings, stem coverage of at least 60%, and Nave's subjects. A self-harm query gets a single "Help, and hope" row, and its link never carries the typed words.
2. **The live panel** loads `signals.json` and `meaning.json`, then `route()` (`route.ts:141-153`) tries, in order:
   1. an exact phrasing;
   2. the meaning matcher, at `MEANT = 0.35` (line 127);
   3. a word router, which the matcher can veto below `UNMEANT = 0.15` (line 133).
3. **Gathering.** If nothing opens, `gather()` in `gather.ts` (986 lines) ranks every verse it finds by `SHOW` weights (line 737) fitted on 6,134 blind-judged verses. The sheet shows the first 6, or 12 at Study (`FIRST` and `MORE`, `AskSheet.tsx:37-38`, applied at line 315); at Deep it also shows all of them and "How these verses were found" (lines 323 to 341).
4. **The founder's note** (`Listen`, `AskSheet.tsx:402-417`) sits above every panel; on the care path it comes after the help text instead (lines 442 and 447).

The matcher is trained at prebuild (and at predev) by `web/scripts/ask-meaning.mjs`:

- softmax regression with AdaGrad, seed 1;
- it fails the build below 70% self-match (line 202); it measured 77.9%;
- its skip key hashes `ask/index.json`, `also.json`, `signals.json`, `config/ask-examples.json`, `words.ts` and the script itself (line 167);
- training took 59 to 76 s on CI and up to 600 s on the founder's PC.

The build validates every chain (`ask.rs`):

- every part is word for word in the BSB, with 3 to 8 parts;
- every part is tied by question words, a Nave's subject, a cross-reference with positive votes, a BSB quotation footnote, a rare shared root, or the same passage;
- a part with no tie fails the build (lines 761 to 780);
- words such as "scholar", "theolog" or "esv" are refused (lines 94 to 104).

**Layers** (`crates/atlas-cli/src/layers.rs`, `web/src/ui/Layers.tsx`). A passage with any `reviewed_by` name goes live whole (lines 418 to 424); none has one yet. Otherwise a note goes live in two cases:

- it cites at least one work on the cite list in `config/layer-sources.json`;
- for wordplay, allusion, pattern, irony and fulfillment notes (`NEEDS_INTERPRETER`, line 50), at least one cited work must have the role "interpreter" (line 357).

Further rules:

- A passage shows only if a live note goes past the plain meaning (line 425).
- The build refuses a passage unless some note beyond the plain meaning is stronger than "some interpreters" (lines 413 to 415).
- Citations link to Bible Hub chapter pages built from a code and a book slug (lines 339 to 348; the Song of Solomon is `songs` since #47).

**Themes** (`crates/atlas-cli/src/themes.rs`, `web/src/data/themes.ts`, `web/src/data/thread.ts`).

- A theme traces Hebrew and Greek roots, never hand-picked verses.
- Theme ids never change; new themes are only appended.
- A related word never adds a verse or a root.
- The theme-links rule is implemented twice, in Rust and in TypeScript; `verify` pins it through `meta.themeLinks`.
- The theme thread exists only in TypeScript, ported from a `thread_final.py` prototype that is not in the repository.

**Servers** (`server/`).

- `esv.mjs`: `/api/esv?book&chapter`, one chapter per request, at most 500 verses in memory, the key passed in by its caller.
- `serve.mjs`: static `web/dist` plus `/api/esv`, on port 8080. It reads the key from the environment, `process.env.ESV_API_KEY` (line 11), and loads no `.env` file (usage at line 2: `ESV_API_KEY=... node server/serve.mjs`).
- Vite mounts the same proxy in dev (`configureServer`) and preview (`configurePreviewServer`), at `web/vite.config.ts:11-16`, with the key from `web/.env` (gitignored), which only Vite reads (`loadEnv`, line 21).

**CI** (`.github/workflows/ci.yml`). It runs on every push and PR:

1. stable Rust plus clippy and wasm32, and Node 22;
2. a cache of `data/raw`, keyed on `sources.json`;
3. `cargo clippy --workspace --release -- -D warnings`;
4. `cargo test --workspace --release`;
5. `make data`;
6. `make wasm`;
7. `npm ci` and `npm run build`.

**Pages** (`.github/workflows/pages.yml`) runs on a push to main (lines 7 to 9) or by hand (`workflow_dispatch`, line 10). It uses the same toolchain and runs `make data`, `make wasm` and `npm run build -- --base=/` with `VITE_ESV=off`, then deploys. It runs no clippy and no tests, and it does not wait for CI. Its concurrency group `pages` has `cancel-in-progress: true` (lines 17 to 19).

## 6. Rules that must not be broken

These are standing instructions from the founder, or legal limits. Each says where it is stated, and what enforces it where something does. Where nothing enforces a rule, it rests on the person.

**Where the rules live.** At `75f6edc`, no `CLAUDE.md`, `AGENTS.md` or `.claude` file exists on any branch (`git log --all -- CLAUDE.md AGENTS.md .claude` is empty). The cloud sessions got the founder's instructions from his claude.ai project and its thread messages. That is inferred from the PR bodies' project-thread links; the exact text is not visible from the repository. What is in the repository is cited below: code comments, `_comment` fields in `config/*.json`, and PR bodies. A session started outside that project, or a person on another machine, gets none of this unless they read this section. Recommendation: commit this section as `CLAUDE.md` at the repository root (section 9, item 2). Branch `handoff-2026-10-20` does so, drawing on this section and section 7.

**Licensing: ESV and NET**

- **The ESV is never stored.** It is never in the repository, the build, the service worker or a log.
  - It is reached only through the server proxy, one chapter per request, with at most 500 verses in memory.
  - Crossway's notice is shown, and the ESV is off on Pages.
  - The ESV is never named or quoted in Layers or hard verses; the build refuses "ESV" there.
  - Even a code comment's real translation wording was swapped for made-up wording (`68beaea`).
  - Stated in `server/esv.mjs:1-12`, `NOTICE.md:79-81`, `.github/workflows/pages.yml:3-5,52`, `layers.rs:6-12` and `extra_hard_verses.rs:6-12`.
  - Commercial use needs a Crossway license.
- **The NET is never stored.** It is never in the repository, the build, the service worker or the browser.
  - It is read live from labs.bible.org, with at most two chapters in memory.
  - Every chapter ends with "(NET)" linked to netbible.org (`NET_HOME`, `web/src/data/net.ts:16`), plus the copyright line (`NET_COPYRIGHT`, lines 17 and 18), which carries no URL.
  - The translators' notes are linked, never shown, because the permission covers the text "without the NET Bible notes".
  - The permission is for free, non-commercial use; it forbids using the text to solicit donations in print copies.
  - Stated in `web/src/data/net.ts:1-22`, `NOTICE.md:83-85` and PR #46. The service worker's same-origin rule (`sw.js:14`, enforced at line 139) keeps it out of the cache.
  - Uncertain: the copyright page also asks for "http://netbible.com". The app links https://netbible.com/copyright/ only on the Sources shelf (`web/src/ui/Sources.tsx:198`), and `NOTICE.md:85` cites it; whether it must also appear beside the text is not settled.
- **Copyrighted works are cited and linked, never copied.**
  - The app ships only public-domain, CC BY 4.0 and CC BY-SA 4.0 material.
  - Sources must be openly licensed, confirmed on the source's own page, with no NC (non-commercial) or ND (no-derivatives) licenses.
  - Stated in `NOTICE.md:73`, the `config/shelf.json` `_comment`, and `web/src/ui/extras/README.md:43,175-179`.
- **CompellingTruth and OpenBible.info answers are for internal comparison only.** Nothing from those sites goes in the repository (PR #32, commits `047fa7a` and `5763dc3`).
- **Specific source rules.**
  - Nave's Topical Bible is an index only: headings are shown, never its lines, and it never becomes a theme (`NOTICE.md:12`, `naves.rs:1-4`, `ask.rs:20-25`).
  - Map positions from OpenStreetMap (ODbL), Google Maps and Google Earth are excluded; 61 sites are withheld (PR #5 and #17, the `sources.json` notes).
  - Lexicon and study-note HTML is never passed to the browser; it is converted to plain segments (`lexhtml.rs:1-5`, `extra_notes.rs:14`).

**Scripture and citation (the founder's rules)**

- **Ask answers only in the Bible's words.** "The framework for interpreting the Bible is the Bible."
  - Answers are chains of whole verses or exact BSB words, with nothing written in between.
  - No scholars or church views appear in questions, phrasings, signals or examples.
  - Every chain part must be tied by the Bible's own data, or the build fails.
  - Stated in `ask.rs:1-25`, the `config/questions.json` `_comment` and PR #16. Enforced by `ask.rs:94-104`, `:562-579`, `:761-780` and `:836-838`.
  - There are only two exceptions: the self-harm help line (PR #16) and the founder's own note (PR #34, reworded by him in PR #35). The note says the tool cannot seek God for you and does not have the Holy Spirit.
- **Keep the search box as it is.** PR #36 was closed, and `1096bcb` reverted it: "Shubhanshu asked to keep the box as it is". The header still reads "Search a verse, phrase or Hebrew/Greek word" (`web/src/App.tsx:207`).
- **Cite only Bible-believing Christian writers.** The founder's words, 2026-10-11: "cite ... bible believing people who fully believe the bible and theologians that love God, not people who are liberalizing the bible".
  - Catholic and Orthodox writers who uphold Scripture may be cited.
  - Rabbis' commentaries and Jewish scholars may not; the Sefaria link was dropped.
  - Ancient texts (Targums, Mishnah, Josephus and so on) may be named in evidence only as witnesses, never as a citation.
  - Stated in `config/layer-sources.json:3-6` and PR #37. Enforced by `layers.rs:24-29, 50 and 357`: a note goes live only by the cite list, and any avoid-list name in the text, evidence or cite fails the build. CI caught one such note on 2026-10-11.
  - The Pulpit Commentary is never cited on Jeremiah or Lamentations (`not_on`, `layer-sources.json:16`).
- **Strength labels count writers.**
  - A "writer" is a distinct cited work (`source` id) whose role in `config/layer-sources.json` is "interpreter": 38 of the 43 citable works. The 5 "reference" works (bsb, tyndale-house, strongs, abbott-smith, easton) do not count. This is how the round 2 PRs (#42, #44) and the layers-mend plan count.
  - 3 or more writers: "widely agreed"; 2: "commonly held"; 1: "some interpreters".
  - **The build does not check the count.** It is a convention. The build checks only that some note beyond the plain meaning, live or not, is stronger than "some interpreters" (`layers.rs:413-415`), and that the kinds in `NEEDS_INTERPRETER` (line 50) cite an interpreter before they go live (line 357).
  - The two interact: lowering a strength honestly can make the build refuse a passage whose remaining notes are all "some interpreters". Then either find a second interpreter who states the point (record the fetched URL and the exact quote, as #38 and #42 did), or drop the passage, as #42 did with the 4 passages it sent back. The layers-mend plan names `genesis-3-1` and `exodus-16-15` as at risk.
  - The round 1 notes do not all follow the convention yet (section 8, row 4).
- **Quotations are checked against the BSB.**
  - Every quotation is BSB, and every quote of 4 or more words is matched against the BSB at build time.
  - Sources go in the evidence field, never in a note's text.
  - Greek wording is credited to the Gospel writer, since Jesus most likely taught in Aramaic (`4a47c7d`).
  - The Peshitta is always labelled a later translation (PR #8).
  - Disputed readings say "scholars differ" (the `config/aramaic.json` `_comment`).
- **Other people's words stay theirs.**
  - Christian writers and study notes are shown as their own words, never as the app's claim.
  - Writers appear only at Deep, after "Show what they wrote" (`extra_voices.rs:1-10`, `extra_notes.rs:1-10`, PR #33).
- **AI drafting is disclosed.**
  - Every AI-drafted passage and card says "Drafted with AI help (Claude) ...".
  - At Deep the UI says "Not yet reviewed by a person" (`Layers.tsx:255-263`).
- **Drafts never publish by accident.**
  - Unreviewed hard-verse cards publish only with `ATLAS_HARD_VERSE_DRAFTS=1` (`extra_hard_verses.rs:30`).
  - Layers drafts publish only with `ATLAS_LAYER_DRAFTS=1` (`layers.rs:45`).
  - No workflow or Makefile target sets either variable, and `verify` fails if a draft card ships (PR #19).
- **Who may set `reviewed_by` (proposed; not yet confirmed by the founder).** Any non-empty string in `reviewed_by` publishes a whole Layers passage, every note of it, past the citation rule (`layers.rs:418-424`), and publishes a hard-verse card (`extra_hard_verses.rs:303`). Nothing checks that the name is a person. So: only a named human reviewer, normally the founder, sets it, in a PR whose body says who reviewed what. A session never fills it on its own.
- **Founder's era and theme choices** (PR #11, `eras.rs:2075-2086`):
  - the traditional date comes first on the "Written" line;
  - Colossians and 1 and 2 Thessalonians are in AD 50 to 70;
  - James, 2 Timothy, and 1 and 2 Peter stay without an era;
  - the Sabbath theme stays as it was (revert `be40008`).
- **Eras quotes are exact.** Every eras quotation must appear word for word in the Tyndale Open Bible Dictionary (the `config/eras.json` `_comment`, checked at build).

**Determinism and pinned sources**

- **Every source is pinned.** Each one is pinned to an exact 40-character commit in `sources.json`, and `atlas fetch` checks out only the listed files.
  - `atlas build` refuses to run if the commit or a locked file hash does not match (`sources.json` `_comment`, `crates/atlas-cli/src/sources.rs:95-118`, `Inputs::open`).
  - Downloaded data is untrusted and is never committed: `/data/raw` and `/web/public/data` are gitignored ("Never commit data", `web/src/ui/extras/README.md:43`).
- **Mirror outside sources to GitHub first.** The build containers reach only github.com, so outside sources must be mirrored there and pinned like any other source (`2f40b85`). Never delete or force-push a pinned mirror branch.
- **Build what can be checked.**
  - Anything that does not match is left out rather than guessed, and the build prints what it dropped.
  - Hand-made tables fail the build on any reference or quote that cannot be checked (`align.rs:15-16`, `eras.rs:1-20`, `parse.rs:1-2`).
- **New source checklist.** A new source needs:
  - a `sources.json` entry with the full commit;
  - a `NOTICE.md` credit;
  - a card in `config/shelf.json`.

  Shelf facts are checked against the work, never guessed (`shelf.json:10`).
- **Build ids are reproducible.** A build id must reproduce on another machine. On Windows that needs the LF settings in section 7; otherwise the data silently differs.

**Checks that gate a change**

- `cargo clippy --workspace --release -- -D warnings` and `cargo test --workspace --release` must pass (`ci.yml:32-33`). CI uses an unpinned stable Rust.
- `atlas verify` must pass all checks (5,909 at `75f6edc`). It covers:
  - the checksum of every file;
  - structure: 31,102 verses, 1,189 chapters, more than 330,000 links, a valid CSR;
  - known facts: Gen 1:1, John 3:16, Dan 2:5 is Aramaic;
  - alignment pins;
  - a Gen 3:15 to Rev 12:9 path of 6 verses or fewer (`verify.rs:199`);
  - Septuagint bridges;
  - the Nestle-Aland double brackets;
  - 16 module verifiers (`verify.rs:52-320`).
- `npm run build` runs `tsc --noEmit` and fails if the meaning matcher finds its own question for fewer than 70% of examples.
- **Measure before claiming a gain.**
  - Ask changes are judged blind, on fresh, never-seen messages: readers judge every verse shown without knowing which version showed it, and main and the branch run the same day (every Ask PR from #28 to #43).
  - Search uses fixed sets of 117, 103 and 158 queries (#2, #14, #21).
- **Browser checks.**
  - Run at 1440x900 and 390x844 (or 375 wide), light and dark, at all three depth levels, with no console errors (PR #1, #8, #13, #15, #17, #22).
  - A first visit loads nothing extra (PR #9, #13, #22).
  - How, outside a cloud session: the repository has no browser test harness (`git grep -il playwright` finds only text in `web/src/ui/extras/README.md` and `config/layers.json`). The README's recipe (line 358) uses cloud-container paths: Chromium in `/opt/pw-browsers`, and the spine test `/mnt/project-files/bible-atlas/ultracode/ideas/spine-demo/test-spine.cjs` in the founder's claude.ai project files. On any other machine, run `npx vite preview` (or `npm run dev`) and check by hand with the browser's device toolbar at both sizes, in both themes and at all three levels, with the console open. A small committed Playwright script would make this repeatable (section 9, item 14).

**Product and engineering**

- **Depth levels.**
  - Every visit starts at Simple, and the first screen stays calm. Since #48, Simple keeps to the verse and its strongest links.
  - A feature picks Simple, Study or Deep and gates itself with `atLeast(...)` or `levelAtLeast(...)`, or an extra declares `level`; nothing compares level names (`web/src/depth.ts:1-14`, `web/src/ui/extras/level.ts`).
- **Extras design** (`web/src/ui/extras/README.md:5-11,140,156-160`):
  - one quiet line, only where it applies;
  - never an empty state or "0 results";
  - no jargon on the line ("pericope", "LXX", "Strong's", "lemma");
  - lines under about 70 characters;
  - anything uncertain labelled with `<Unsure>`;
  - nothing loaded from other sites at run time;
  - only the app's colour variables.
- **Shared-code limits** (the same README, lines 45 and 243 to 248):
  - no new crates;
  - never run `cargo fmt` on shared files;
  - at most five one-line insertions in shared files (`main.rs`, `build.rs`, `verify.rs`, `sources.json`, `NOTICE.md`) per extra, and no change to the spine files (`types.ts`, `registry.ts`, `VerseExtras.tsx`, `Sheet.tsx`, `open.ts`, `data.ts`, `kit.tsx`, `level.ts`, `extras.css`).
  - Scope: these were written for sessions adding extras in parallel. The spine itself was later changed on purpose: #17 (`0be1a9b`: `types.ts`, `VerseExtras.tsx`, `Sheet.tsx`), #22 (`6f5b508`: `kit.tsx`, `build.rs`, `main.rs`, `verify.rs`) and #27 (`c3cff66`: `open.ts`). The README's insertion anchors point at `ultracode/ideas-spine` line numbers (section 11). Whether the limits still bind outside parallel extra work is not recorded (section 8).
- **Heavy data loads late.** Heavy Ask data loads on the first question, never in the first download (PR #29, #31, #32, #43).

**Writing and PR style**

- **Plain English.**
  - No em dashes and no emoji; all 48 PR bodies have 0 em dashes.
  - Commit subjects are plain sentences about the visible effect, with the why in the body.
- **PR bodies.**
  - They follow Before / After / How / Checks (or Checked), with exact measured counts.
  - 34 of them open with a generated marker comment (`<!-- claude-projects-attribution ... -->` in 21, `<!-- ccr-projects-attribution -->` in 13) and a "Requested by Shubhanshu · project thread" line. That header is inserted by the tooling, not hand-written; do not copy it by hand.
  - Cloud commits carry a `Claude-Session:` trailer; local commits carry a `Co-Authored-By:` line instead.
- **People.** Quote the founder by first name. Never write anyone's email address anywhere.

## 7. Operating it

**Requirements** (`README.md:81`):

- git;
- Rust stable 1.88 or later;
- Node 20.19+ or 22.12+;
- `curl`, used only for Git LFS files (none are needed at `75f6edc`);
- for the engine, `rustup target add wasm32-unknown-unknown`.

The README says to use WSL on Windows. That is not needed (below).

**In a Linux container or on CI** (the documented way; the `Makefile` has 12 targets: all, data, fetch, build-data, verify, wasm, install, web, dev, serve, test, clean):

```
make all            # = make data (fetch, build-data, verify) + make wasm + make web
make test           # cargo test --workspace, then npm run typecheck in web/
make dev            # Vite dev server, http://localhost:5173 (ESV works if web/.env has ESV_API_KEY)
ESV_API_KEY=... make serve   # node server/serve.mjs on :8080 (web/dist plus /api/esv). Broken on native Windows.
```

To skip the network, reuse a verified raw folder with `--raw <dir>`, because `fetch` always re-fetches all 17 repositories (`fetch.rs:97-115`). The drafts can be previewed with `ATLAS_LAYER_DRAFTS=1` or `ATLAS_HARD_VERSE_DRAFTS=1` (never deploy them).

**A config-only change** needs `atlas build` and `atlas verify`; the CLI does not embed config. **Except for Ask config:** a change to `config/questions.json` or `config/ask-examples.json` also changes the matcher's inputs (`ask-meaning.mjs:28, 167`), and the matcher's weights carry a hash of the question ids that the page checks (`web/src/ui/ask/meaning.ts:100, 132`). So after `atlas build`, also run `npm run build` in `web/` (or `node web/scripts/ask-meaning.mjs`), and the 70% self-match check must pass. On a tree without built data, `ask-meaning.mjs` prints "skipped" (line 163) and the build goes on with no `meaning.json`.

**On the founder's Windows PC.** This was measured on 2026-10-20. Everything builds and passes natively, so WSL is not needed. `make` is not installed (`just` is), WSL Ubuntu is stopped, and the `wasm32-unknown-unknown` target was added during the check. The recipe, in PowerShell, starting in the folder that should hold the clone:

```
rustup target add wasm32-unknown-unknown                       # once (done on the founder's PC on 2026-10-20)
rustup update stable                                            # to 1.99.1, CI's toolchain on 2026-10-20; without it the wasm and asset names differ from live
# Only for a byte-identical site: an LF clone. The founder's main clone is CRLF.
git clone -c core.autocrlf=false -c core.eol=lf https://github.com/Sixteen1-6/BibleAtlas.git BibleAtlas-lf
Set-Location BibleAtlas-lf                                      # every command below runs from the clone's root
# REQUIRED for fetch: Git for Windows defaults to autocrlf=true and short paths.
$env:GIT_CONFIG_COUNT='3'
$env:GIT_CONFIG_KEY_0='core.autocrlf';  $env:GIT_CONFIG_VALUE_0='false'
$env:GIT_CONFIG_KEY_1='core.eol';       $env:GIT_CONFIG_VALUE_1='lf'
$env:GIT_CONFIG_KEY_2='core.longpaths'; $env:GIT_CONFIG_VALUE_2='true'
cargo build --release -p atlas-cli
cargo run --release -q -p atlas-cli -- fetch                    # or skip it and use --raw below
cargo run --release -q -p atlas-cli -- build                    # with a verified raw folder: ... -- build --raw <dir>
cargo run --release -q -p atlas-cli -- verify                   # expect 5925 checks passed (verify reads web\public\data, not --raw)
Remove-Item Env:GIT_CONFIG_*                                    # do not leave these set in a shell used on the CRLF clone
cargo build -q -p atlas-wasm --lib --target wasm32-unknown-unknown --profile wasm
Copy-Item target\wasm32-unknown-unknown\wasm\atlas_wasm.wasm web\src\engine\atlas.wasm
Set-Location web; npm ci; npm run build                         # CI variant. prebuild retrains the matcher first: 59 to 76 s on CI, up to 600 s on the founder's PC
$env:VITE_ESV='off'; npm run build; Remove-Item Env:VITE_ESV    # what Pages deploys
npm run dev                                                     # predev retrains the matcher too; or: npx vite preview --port 8080 (instead of make serve)
Set-Location ..; cargo test --workspace                         # debug: same 218 tests, 193 s instead of 434 s for --release
```

With the verified LF raw folder on the founder's PC (below), the build line is, with the scratch folder's full path in place of `<scratch folder>`:

```
cargo run --release -q -p atlas-cli -- build --raw <scratch folder>\wt\build\data\raw-lf
```

Why each piece of the recipe matters:

- **The fetch settings.**
  - Without `core.longpaths`, fetch fails with "Filename too long" under deep paths.
  - With longpaths only, 228 of 357 source files come out CRLF. The build then still succeeds but gives build id `37a161b535ed` (at `a46d819`), and only 1 of 5,909 checks fails (a Nave's check).
  - With all three settings, 357 of 357 files match the live hashes.
- **Backslashes in the lock and `meta.json`.** On Windows, `fetch.rs:124` writes backslashes into the lock paths, and they flow into `meta.json`. That file is then 483,659 bytes against 483,302 live (at `a46d819`); it is identical once the backslashes become `/`.
- **Remaining differences.**
  - A CRLF clone changes `dist/index.html`, `404.html`, `sw.js`, `manifest.webmanifest` and the `meaning.json` key (the weights are identical).
  - rustc 1.99.0 on the founder's PC against CI's 1.99.1 changes only the paths embedded in the wasm. The size is the same (75,220 bytes), but the wasm's hash changes, so `atlas-*.wasm`, `engine.worker`, `index-*.js` and 13 lazy chunks get different names. `rustup update stable` closes the gap; otherwise copy CI's wasm into `web\src\engine\atlas.wasm` for a byte-identical site. A different set of asset names is not a fault.
- **Git Bash pitfall.** In Git Bash, `--base=/` is rewritten to `C:/Program Files/Git/`. Use PowerShell, set `MSYS_NO_PATHCONV=1`, or drop the flag, since `/` is Vite's default.
- **A verified LF raw folder already exists.** It is at `wt/build/data/raw-lf` in the scratch folder (678 MB, 17 checkouts plus the lock, all 357 files equal to live as of 18:58 UTC on 2026-10-20). It is a leftover data folder: the worktree it was made in was removed. Reuse it with `--raw` as above, and set the GIT_CONFIG variables before any re-fetch into it. It sits in the temporary scratch folder and may be cleaned up.

Timings on the founder's PC were 10 to 25 times slower than CI, because other jobs were sharing the machine:

| Step | Founder's PC (2026-10-20) | CI |
|---|---|---|
| CLI release compile | 1,087 s | |
| Fetch | 464 s | |
| Build | 273 s | 14.6 s |
| Verify | 372 s | |
| `ask-meaning` | first run 600 s; 4.6 s when up to date | 59 to 76 s |
| Vite build | 17.8 s to 455 s | |
| Whole job | | 4 min 25 s (job "build" of run 39435599875 on `a46d819`: clippy plus tests 60 s, data 116 s, web 64 s) |

**Deploying.** A push or merge to `main` deploys by itself; Pages took 3 min 15 s for `75f6edc` and 5 min 6 s for `5296d48`. There is no staging site and no gate on CI. Because `pages.yml` has `cancel-in-progress: true` (lines 17 to 19), a second merge while a deploy is running cancels the first run, and only the last push deploys. To redeploy `main` by hand (the founder, or anyone with write access): `gh workflow run pages.yml --repo Sixteen1-6/BibleAtlas --ref main`. After a deploy, check three things:

- the live `data/meta.json` `buildId` (it changes only when the data changes; a web-only change such as #48 keeps it);
- the page's hashed asset names match the deploy log;
- one changed feature works at the live URL.

**Rolling back.**

1. Revert on `main`; Pages redeploys the previous state. Which command depends on how the PR landed (section 3):
   - a merge commit (two parents, for example `75f6edc`): `git revert -m 1 <merge commit>`;
   - a squash merge (one parent: `99ba7ca` #19, `d1a2bb1` #20, `fbfca22` #25): `git revert <commit>`.
   - Prefer a revert PR, so CI runs on it first (about 4 minutes): the merged PR's page on GitHub has a "Revert" button that opens one, or push a branch with the revert and open a PR. A direct push to `main` skips CI and deploys at once; keep it for an emergency, and only the founder can do it (section 1, "Access"). No rule on this is recorded.
2. If a bad service worker is the problem, set `KILL = true` in `web/public/sw.js:24` and deploy; it unregisters itself and clears its caches for everyone. `?sw=off` in the address does the same in one browser.

**ESV with a server.**

- For Vite (`npm run dev`, or `npx vite preview` on Windows): put `ESV_API_KEY` in `web/.env` (gitignored). Only Vite reads that file.
- For `server/serve.mjs`: set the key in the environment, `ESV_API_KEY=... node server/serve.mjs` (as `README.md:103` does with `make serve`). A key in `web/.env` alone leaves it answering 503. It works on Linux at `75f6edc`; on native Windows it needs `serve.mjs:9` changed to use `fileURLToPath` first (it resolves to `C:\C:\...`).
- Never commit the key, and never put it in client code. Who holds a Crossway key, if anyone, is not recorded (section 1, "Access").

**The cloud sessions' containers** (from PR bodies and commit messages):

- **Linux, with `make`.** The sessions ran `make data`, `make wasm`, clippy and tests, and checked the app in Chromium/Playwright at desktop and phone widths.
- **Network from the shell reaches github.com only.**
  - Hugging Face was unreachable, hence the mirror workflow (`2f40b85`).
  - labs.bible.org was unreachable, so the NET was tested against mocks (#46).
  - Sources therefore have to live in a GitHub repository at a pinned commit, and a GitHub Actions workflow is the way to bring an outside file in.
- **Web research, such as the 1,143 re-fetched citations in #38, happened somehow, but how is not recorded** (uncertain: probably the session's web tools rather than the shell).
- **Off-repo work is at risk.** Anything a session keeps in its container (evaluation sets, drafts, tools) is lost with the session unless it is pushed. Section 12 lists what is known to be off-repo.

## 8. Decisions waiting on the founder

| Decision | Evidence and where it is written |
|---|---|
| 1. Approve, edit or drop the 56 "Often asked" hard-verse cards. Until then the live `cards.json` is empty. Approving a card means adding the reviewer's name to its `reviewed_by` in `config/hard-verses.json` (section 6, "Who may set `reviewed_by`"). The 13 website cards on the Sources shelf (GotQuestions, The Gospel Coalition, Bible.org, Catholic Answers, Ligonier, Christianity Today, BibleProject, Desiring God, BiblicalTraining, CrossExamined, Answers in Genesis, OrthodoxWiki, BibleRef) are **already live**: the live `shelf.json` has 58 of 58 works, because the 56 link-only "Hard passages" pointers at Deep (#33) count as citations. Only the card texts wait. Also decide whether the 114 read-more links already live at Deep are fine under the Christian-writers rule. They are 51 GotQuestions, 12 Catholic Answers, 2 Christianity Today and 1 OrthodoxWiki among them. | PR #19, #25, #33, #37. `config/hard-verses.json`, where `reviewed_by` is empty on all 56. `extra_hard_verses.rs:36-50` lists the 13 allowed hosts; line 303 is the publish rule. CI log at `75f6edc`: "58 works ... 0 left out until the app cites them; 239 of 239 citations matched". 10 of the 13 website cards are marked "only when cited" in `config/shelf.json`. |
| 2. Whether Layers stays live with no person's review. 3,095 notes went live by the citation rule (#38); 0 of 1,264 passages has `reviewed_by`. Approving a passage means adding the reviewer's name to its `reviewed_by` in `config/layers.json`, which publishes every note of it. The review page https://claude.ai/artifact/GcZhxjKjNbKcKJvMUYQcBy covers only the first 88 passages. On 2026-10-20 Claude Code on the founder's PC got "artifact not found" for it (section 1, "Access"). Any ticks in it are not in the repository. | PR #23, #38. `Layers.tsx:260`. |
| 3. **Settled by #50, merged 2026-10-21 from the founder's account (section 0).** The 4 hidden Layers notes: give each a citation, approve it, or drop it. `1-samuel-25-25` (layers.json line 11005; wordplay, "some interpreters": nevel sounds like Nabal), `job-19-25` (14094; wordplay, "widely agreed": chinnam, "for nothing"), `isaiah-5-7` (19798; allusion, "some interpreters": tse'aqah, the cry of Egypt and Sodom) and `philemon-1-11` (46492; wordplay, "some interpreters": chrestos and Christos). **Being done by the layers-mend job** (batches b09, b10, b12, b19), without a recorded decision; the founder approves or changes its result through its PR. | PR #38, #39, #45. `layers/plan.json` in the work folder on the founder's PC. |
| 4. **Settled by #50, merged 2026-10-21 from the founder's account (section 0).** Recalibrate the round 1 Layers strengths to the writer-count convention (section 6). In the original 88 passages, 17 notes say "widely agreed" with one interpreter cited: Genesis 3:1 (Ellicott), 11:9 (Ellicott), 27:36 (Keener), 28:12 (Keil-Delitzsch); Exodus 16:15 (Poole); Leviticus 25:10 (Bruce); 2 Samuel 7:13 (JETS); Isaiah 5:7 (Keil-Delitzsch); Jeremiah 1:12 (Ellicott); Hosea 2:23 (Keil-Delitzsch); Mark 14:24 (Ellicott); Luke 10:33 (Ellicott); John 2:19 (Bengel), 4:10 (Pulpit); 1 Corinthians 16:22 (Capes); 2 Corinthians 3:18 (Ellicott); Revelation 1:5 (Pulpit). 23 notes in 20 passages say "commonly held" with one: Genesis 5:29, 11:9, 28:12, 50:20; Exodus 2:10, 12:13; Leviticus 23:10, 25:10; Deuteronomy 21:23; Ruth 1:20; 1 Samuel 2:10, 4:21; Psalm 41:9; Isaiah 7:14, 53:5; Jeremiah 23:6; Jonah 3:4; Mark 12:10; John 3:14, 4:10. 106 say "widely agreed" with two. Round 2 never overclaims. **Being done by the layers-mend job** (batches b01 to b21), without a recorded decision. Lowering strengths can trip the build (section 6); the plan names `genesis-3-1` and `exodus-16-15`. | `layers/plan.json` in the work folder on the founder's PC (every item, with its writers). PR #42, #44. |
| 5. **Settled by #50, merged 2026-10-21 from the founder's account (section 0).** The 4 passages sent back to the Wordplay thread in #42 never came back: 1 Samuel 6:6, Proverbs 3:20, Ecclesiastes 3:18 and 3:20. They were present at `47ec38b`, removed at `7c37488`, and are absent at `75f6edc`. Revive them or let them go. **Being revived by the layers-mend job** (batch b22, from `layers/returning-*.json` in the work folder), without a recorded decision. | PR #42, #44. |
| 6. Apply the citation rule evenly, or accept these as exceptions. (1) `layer-sources.json` bars BDB, Thayer, the UBS Handbooks and New Testament Studies, yet the word study ships TBESH (abridged from BDB) and UBS Fauna/Flora/Realia articles. (2) A Thayer shelf card is live (`shelf.json:361`). (3) The Aramaic notes still cite Penner's NTS article, Metzger, Brock and Dalman, and name Deissmann (`config/aramaic.json` lines 164, 506, 586, 663, 691, 720, 792, 797), although PR #37 says they rest only on the text and believing writers. (4) The eras "Written" views quote liberal and critical datings, labelled by holder (`eras.json:277,453,505` and 9 more books); these were approved in #11, before the 2026-10-11 rule. (5) Notes on Gen 28:12, Song 8:6, Isa 53:5 and Dan 7:13 report rabbis' or medieval Jewish readings, and Sefaria is named in 7 evidence lines. (6) The bare avoid-list matches "Meyer" and "Vincent" would also block F. B. Meyer or Vincent of Lerins. Not part of the layers-mend plan. | [`docs/handoff/map-content.md`](handoff/map-content.md) section 11 (items 1 to 4), section 2 "Problems found in Layers" item 5 (item 5) and section 10 (item 6). |
| 7. The Ask meaning model: go ahead, and on what budget. Measured sizes, gzipped: the whole token matrix 28.13 MB at F32, 14.06 MB at F16 and 6.77 MB at int8; reduced by PCA to 128 dimensions, int8, 3.61 MB (keeps 80.4% of variance), or to 64, 1.90 MB (53.8%). Vectors for all 31,102 verses: 8.09 MB at 256 dimensions int8, 4.11 MB at 128, 2.11 MB at 64 (raw; int8 vectors compress little). One vector per question: 0.41 MB at int8. For comparison, `meaning.json` is 1.76 MB and `atlas.bin` 3.56 MB gzipped. Also: whether to keep the 30 MB model blob on a branch of the public repository (every full clone downloads it). Credits would be MIT, BAAI/bge-base-en-v1.5, and the training set `minishlab/tokenlearn-c4-en-bge-base-v1.5` named in the mirror's README metadata, whose license has not been checked. | [`docs/handoff/map-ask.md`](handoff/map-ask.md) sections 5 and 6. `git show dced885:README.md`. Section 9, item 9. |
| 8. Whether the mirror workflow belongs on `main`. The next Ask PR will carry `.github/workflows/mirror-meaning-model.yml` into main, and that merge re-runs it against Hugging Face's latest revision (section 0). Pin the revision in the workflow, keep it as is, or drop it from the branch. | Section 0, the `claude/ask-the-bible-u6macl` row. |
| 9. Where the Ask evaluation sets and judgments should live. An instruction from the founder that anything not on the PC be pushed to GitHub was relayed to the 2026-10-20 local workflow; at `75f6edc` it is not recorded in any PR, issue or repository file (unrecorded for a successor); `CLAUDE.md` on branch `handoff-2026-10-20` records it. Some judged comparisons involve CompellingTruth and OpenBible.info answers, which by rule may not enter the repository. A private repository, or committing only the never-seen messages and labels, would satisfy both. | PR #32. `docs/handoff/map-ask.md` section 4 ("How it was evaluated" and "Where those sets live"). |
| 10. Whether this handoff, the six maps and a `CLAUDE.md` holding section 6 may go into the public repository. Branch `handoff-2026-10-20` prepares them as `docs/HANDOFF.md`, `docs/handoff/map-*.md` and `CLAUDE.md`, with the local paths on the founder's PC replaced by plain descriptions. They quote PR bodies; they hold no secrets or email addresses. | Section 9, item 2. |
| 11. Confirm the proposed rule on who may set `reviewed_by` (section 6). | `layers.rs:418-424`, `extra_hard_verses.rs:303`. |
| 12. Whether the extras shared-code limits (no spine changes, five insertions) still bind outside parallel extra work. | Section 6, "Shared-code limits". |
| 13. Which writers, if any, from the voices research to add at Deep, and whether to accept new mirror branches for them. | `voices/group-*.md` in the work folder on the founder's PC (section 0). |
| 14. Whether to build the literary-devices feature designed in `literary/fit.md` (work folder on the founder's PC). | Section 0. |
| 15. MACULA Septuagint equivalents. Issue Clear-Bible/macula-hebrew#145 asks whether they come from CATSS, which is non-commercial. It was opened 2026-10-07 by a third party and had 0 comments on 2026-10-20. The app uses them for 1,625 of 1,882 quotation word pairs, and `NOTICE.md` does not mention the question. Wait, note it, or drop the pairs. | PR #17, `NOTICE.md:25,31`. |
| 16. Protect `main` and gate the deploy on CI (branch protection and a required check, or make `pages.yml` depend on the tests), and say whether reverts go by PR or by direct push. At `75f6edc` a push that breaks a unit test still deploys if the data verifies. | Sections 7 and 10. |
| 17. Verify everyversemap.com on the GitHub account (a TXT record at Squarespace), as GitHub recommends against takeover. | Pages API: `protected_domain_state` is null. |
| 18. Whether to offer the ESV on a server (`IDEAS.md:39`: Fly.io or Render, with the key as a secret). It is free and non-commercial under Crossway's terms; any monetisation would need new licenses for the ESV and the NET. | `IDEAS.md:39`, `NOTICE.md:81,85`. |
| 19. The license of the authored content (Layers, hard verses, Aramaic notes, Ask chains). It is MIT by default at `75f6edc`. | `LICENSE`, `README.md:203`. |
| **Decided, for the record:** keep the search box (#36 closed, `1096bcb`). Cite only Bible-believing Christian writers (2026-10-11). Ask is the Bible's words only, plus the founder's note as reworded in #35. Ask chains go live by build ties instead of approval (#26). Layers notes go live by the cite list (#38). The era and Sabbath choices (#11). The Peshitta is shown only at Deep and labelled a translation (#8). Simple keeps to the verse; study notes, Ask lines and "Often asked" start at Study (#48, merged from the founder's account). | Section 6. |

## 9. Ranked next steps

Each item gives its evidence. Items 1 and 4 to 7 are code changes anyone can open as a PR; items marked "founder" need his account or decision.

1. **Put `ask/meaning.json` inside the integrity chain.** Self-contained, code only.
   - The problem: `ask-meaning.mjs` writes it after `atlas build`, so it is not in `meta.json`, not checked by `verify`, and not part of the build id. It is fetched with `?v=<buildId>` (`web/src/ui/extras/data.ts:17`) and served cache-first by the service worker (`sw.js:127-133`). A deploy that changes only `config/ask-examples.json`, `web/src/ui/ask/words.ts` or the trainer therefore leaves returning visitors on old weights. `meaning.ts:132` checks only the question ids.
   - The fix: fold the trainer key into the URL or the build id, in a way that also covers any later prebuild output (item 9).
2. **Move this handoff into the repository** (founder's OK first, section 8 row 10). Commit this file and the six maps (for example under `docs/handoff/`), and section 6 as `CLAUDE.md` at the root, then change the scratch-folder paths to repository paths. Branch `handoff-2026-10-20` does this, with this file as `docs/HANDOFF.md` and a `CLAUDE.md` drawn from sections 6 and 7; what remains is the founder's OK and the merge. Evidence: the scratch folder is a temporary folder that the app may clean up; at `75f6edc` no handoff, map or instructions file exists on any branch; #47's merge went unrecorded because this file was invisible from GitHub.
3. **Land the layers-mend work** (section 0). Wait for its PR; if the job stopped, resume from `layers/plan.json` in the work folder, the `bNN`/`bNNchk` folders and `layers/mend` in the scratch folder, and the uncommitted worktree, all on the founder's PC. Rebase on `75f6edc`, check the build (especially `genesis-3-1` and `exodus-16-15`), and have the founder rule on section 8 rows 3 to 5 before it merges.
4. **Make the build safe on Windows and pinned everywhere.**
   - Pass `-c core.autocrlf=false -c core.eol=lf -c core.longpaths=true` to the git calls in `crates/atlas-cli/src/fetch.rs:104-111`.
   - Write lock paths with `/` (`fetch.rs:124`).
   - Fix `server/serve.mjs:9` with `fileURLToPath`, and tighten its `startsWith(root)` guard (line 24), which admits sibling folders whose names start with "dist".
   - Add `.gitattributes` (`* text=auto eol=lf`).
   - Pin Rust in `rust-toolchain.toml`.
   - A source file key that is in `sources.json` but not yet in the lock panics in `Inputs::path` (`l.files[key]`, `sources.rs:122`). Either check the keys against the lock in `Inputs::open` (lines 95 to 118) and say "run atlas fetch", or make `path()` return a `Result`.
   - Optionally, add per-file sha256 values to `sources.json`.

   Evidence: section 7, and `docs/handoff/map-build.md`.
5. **Gate the deploy, and quiet CI.**
   - Make `pages.yml` run or wait for clippy and tests.
   - Pin the Rust toolchain; CI already broke once on a new Rust release (`8a70f1e`).
   - Bump the actions that target the deprecated Node 20, which warn on every run: `checkout@v4`, `setup-node@v4`, `cache@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`.
   - Optionally (founder, since it needs write access), delete merged branches: 40 GitHub branches besides `main` are merged; keep `before-ideas-2026-10-08` as the snapshot of main before #5, which leaves 39 to delete. `claude/ask-the-bible-u6macl` and `mirror/potion-base-8M` are not merged and must stay.
6. **Make the Sources shelf match what the app cites.**
   - `shelf.rs` reads citations only from `aramaic.json` and `hard-verses.json`. As a result, 28 works that Layers cites about 4,650 times have no card (31 cited ids lack a card, 4,988 cites; `wesley`, `net-notes` and `church-fathers` are covered by the Wesley, NET and Catena cards). Among them: Gill 1,029, Barnes 1,020, JFB 824, Clarke 542, Bullinger 536 (419 plus 117), Ellicott 238, Pulpit 219.
   - Existing cards undercount: Keil-Delitzsch shows 1 citation against 839.
   - The shelf says "Everything in this app comes from the works below" (`web/src/ui/Sources.tsx:153`), and `shelf.json:10` promises that drafted works "are added when they go live".
   - Fix the stale cards too: Thayer, live although banned; the Bible Hub card, which names "two commentaries"; and the Nave's card's "More than 20,000 subjects", against about 5,300 in `sources.json:54`.
   - Do this before adding writers from the voices research (item 11).
7. **Refresh the docs.**
   - `README.md`:
     - :18 and :127 say "192 data checks"; it is 5,909.
     - :18 and :131 say "61 KB" for the wasm; it is 75,220 bytes.
     - :121 gives "8.4 MB" for `atlas.bin`; this was not re-measured.
     - :118 says the build takes "about 2.5 s" and :156 says "2.3 to 2.5 s"; CI takes 14.6 s.
     - :160 says "85 KB" of JavaScript; the main chunk is 332.56 kB (124.66 kB gzipped).
     - :81 tells Windows users to use WSL; :89 says "a few minutes".
     - :203 gives the data license as "CC BY 4.0 and public domain" (it misses CC BY-SA and the NET).
     - "What it does" mentions none of: Ask, Layers, wordplay, hard passages, Christian writers, study notes, places, quotations, parallels, the Syriac or the depth levels.
     - The query list omits `roads`.
   - `web/src/ui/extras/README.md:22-30` ("The three extras", against 13), plus :165, :353 and :355, and the comments at `web/public/sw.js:27-28`, `web/src/arrival.ts:18` and `web/src/ui/extras/data.ts:12`, which still use the old `/BibleAtlas/` base.
   - `IDEAS.md`: mark the 4 shipped ideas and the 3 partial ones (item 13).
8. **Recover the Ask evaluation assets.** Founder only: it needs his claude.ai account, and it waits for the section 8 decision on where they may live (row 9). In order of value:
   1. what cannot be recreated: the 545 labelled dev messages behind `MEANT` (`route.ts:124-126`; #40, #43); the 271 tuning messages with their 6,134 verse judgments behind `SHOW` (`gather.ts:727-737`; #41); and the scripts that fitted `SHOW`, `LEAN` (`gather.ts:725`), `MEANT`, `UNMEANT`, `OPEN` and `NEAR`;
   2. the old blind test sets, as history only. Each round used a fresh blind set by design (#40: "269 never-seen questions held out for this"; #41: "299 fresh messages ... never used before"; #43: "300 never-seen messages"; only #34 reused the previous round's 270), so a later change needs a fresh set anyway.

   Evidence: no branch or commit holds such files (`git log --all --name-only` finds only `web/scripts/ask-meaning.mjs` and `scripts/build-wasm.sh` under any scripts folder). That they survive only in cloud session `session_01F5MX8Zw1CM7AW18hxHzAeP` is an inference (uncertain). The 871 reader-labelled messages (#34) and the gap messages (`d8e981c`) were folded into `config/ask-examples.json`, so they can no longer serve as held-out tests.
9. **The meaning model step for Ask** (after items 1 and 8, and the founder's go-ahead, section 8 row 7).
   - Why: PR #40 said gathered verses are "still about 40% off topic; that is the next change". That next change shipped as #41, four hours later from the same branch (merged 2026-10-11 08:02 UTC): the `SHOW` reranking (`gather.ts:737`), which moved the off-topic share from 53% to 48% on a harder blind set. #43 (2026-10-17) still calls gathered verses "off nearly half the time". The mirror came nine days later (`2f40b85`, 2026-10-20), and its only recorded intent is the commit message: "so sources.json can pin it like any other source". "Meaning" is also this project's name for the prepared-question matcher (`meaning.ts`, `ask-meaning.mjs`, `ask/meaning.json`), so whether the model was meant for question matching, for gathered verses or for both is not recorded.
   - A reconstructed plan (an inference, not a written plan):
     1. Pin `Sixteen1-6/BibleAtlas@dced885a21af0bfd69eaf34f214c9d2160d8b733` in `sources.json`.
     2. Add `NOTICE.md` and shelf credits: MIT, BAAI/bge-base-en-v1.5, and the training set `minishlab/tokenlearn-c4-en-bge-base-v1.5`, after checking its license (section 6 requires it).
     3. Write the model matrix and the verse and question vectors **in `atlas build`**, so they are in `meta.json`, checked by `verify` and part of the build id. If they were made in the Node prebuild like `meaning.json`, they would bypass the lock (a `sources.json` pin is checked only by `atlas fetch` and `atlas build`) and be cached stale under an unchanged `?v=` (item 1).
     4. Encode the query in the browser with one shared TypeScript WordPiece tokenizer, as `words.ts` is shared between the trainer and the page (`ask-meaning.mjs:182-185`).
     5. Add cosine similarity as a `SHOW` term or floor, refit on the 6,134 judged verses, refit `MEANT` and `UNMEANT` if the matcher changes, and test blind against main on a fresh set.
   - Evidence from a held-out check (`meaning/heldout.log` and `heldout2.log` in the work folder on the founder's PC). It measures **question matching only**: whether a held-out example ranks its own prepared question first. It measured no gathered verses and tested no verse embedding. On 2,000 held-out examples, the shipped blend gets 1,089 first answers right (1,418 in the top 3). One potion vector per question, added as a third voice, gives 1,155 (1,499); nearest examples by potion give 1,172 (1,534).
   - The cost the same logs show: at `MEANT = 0.35`, right opens fall from 658 (shipped) to 634 (with potion nearest examples) or 616 (one vector per question), and opens fall from 804 to 729 or 695. As a drop-in change, the matcher would open fewer right answers and send more messages to gathering, the weaker path; so `MEANT` and `UNMEANT` must be refit. The nearest-example forms (1,172; and 677 right opens for softmax plus potion nearest, half and half) need every example vector in the browser, 17.29 MB at int8 x 256, which cannot ship.
   - Caveats: the examples are synthetic and were written by the same agents who wrote the training examples, and 0.35 was tuned for the shipped blend. Static similarity also misreads oblique life statements: "car got repossessed this morning" scores closer to "Does God love me?" than to debt. Keep the page weight lazy.
10. **Layers rule-drift clean-up after the founder's decisions** (section 8 row 6). The strengths, the 4 hidden notes and the 4 returning passages are in item 3.
11. **More writers at Deep** (after the founder picks, section 8 row 13). Follow `voices/group-*.md` in the work folder on the founder's PC: start with the ones already on GitHub under open licenses; each needs a `sources.json` pin, a `NOTICE.md` credit, a shelf card and `extra_voices.rs` work, and the CrossWire ones need a mirror workflow like `2f40b85`.
12. **Share as image.**
    - Evidence: `IDEAS.md:11`; `renderSettled()` (`web/src/gl/arcs.ts:763-769`) was kept "For Phase 2's share image" (#5, #12) and has no caller.
13. **The other IDEAS.md items.** Of its 15 ideas, 4 shipped (offline, installable, quotations versus allusions, and the places half of "People and places"), and the rest stand as follows.
    - Partial: guided tours (no curated tours with next and back); keyboard stepping (only the arrow keys step through verses, `AtlasMap.tsx:361-370`; `J` and `K` do not); timeline (eras exist, no full timeline layout).
    - Not built: verse of the day (`Welcome.tsx:5-9` has three fixed starters); share as image (item 12); reading plans with a progress glow; the people graph of "People and places"; Louvain theme discovery; side-by-side translations; BSB audio; a WebGPU renderer; an ESV server deploy.
14. **Tests for the logic implemented twice, and a browser check.**
    - Five pieces of logic exist in both Rust and TypeScript: the container reader, English search tokenization (`english.rs` and `data/search.ts`), the English word split (`align.rs:80` and `data/align.ts`), the theme-links rule, and the TypeScript-only theme thread.
    - There are no TypeScript tests for 27,542 lines.
    - Add small parity fixtures, generated by the Rust build and checked in `npm run build`, and a small Playwright script for the browser checks in section 6.

## 10. Known gaps and risks

- **No gate before live.**
  - `main` is unprotected, and any push deploys.
  - Pages does not run the tests or clippy and does not wait for CI.
  - The median PR merged 10 minutes after opening, with no review.
  - Two direct pushes reached main (`a59dfb2` to `41069d9`, and `ab53468`).
- **Only one account can act.** Merging, reverting, DNS and the claude.ai sessions all need the founder (section 1, "Access").
- **Unpinned Rust with `-D warnings`.** A new stable Rust release can turn CI red with no code change; this happened on 2026-10-07 (`8a70f1e`).
- **Theological exposure without a person's review.**
  - 1,584 Ask chains are live without per-answer approval: only the build ties and AI readers stand behind them.
  - 3,095 Layers notes rest on AI drafting plus AI verification, disclosed only at Deep.
  - 114 hard-verse links to outside sites are public at Deep.
  - The layers-mend job is changing round 1 notes without a recorded founder decision (section 0).
- **Silent wrong data on Windows.** A default Git for Windows fetch produces CRLF sources. The lock is generated from those same files, so the build's own check passes, and only one Nave's check in `verify` catches it (section 7).
- **The Ask matcher can go stale.**
  - `ask/meaning.json` is outside the build id and served cache-first (section 9, item 1).
  - The matcher retrains on every CI and Pages run (59 to 76 s), and its skip key does not include the Node version (CI uses Node 22; the founder's PC has 24, with identical output).
- **Evidence that cannot be re-run from the repository.**
  - The blind sets, judged labels, fitting scripts, Layers quote stores and fetched source pages are not in the repository.
  - So are the Wordplay thread's drafts and merge tools, the review pages, and prototypes named in code (`thread_final.py` in `web/src/data/thread.ts:4`, the "lsj5" brief in `world.rs`).
  - Neither the 6,014 Layers citations nor the Ask tuning can be re-verified from the repository alone.
- **Stale live content.**
  - The shelf undercounts and misses 28 cited works (section 9, item 6).
  - 17 round 1 notes say "widely agreed" on one writer (until the layers-mend PR lands).
- **No site monitoring.** The site has no analytics, error reporting or uptime check (`git grep -iE 'analytics|plausible|gtag|goatcounter|umami|telemetry'` over `web/index.html`, `web/src` and `server` finds nothing). The only traffic figure is GitHub's repository traffic (section 3). Nobody learns whether people use the site, or when the NET fails for visitors. To check the NET by hand: open any chapter in NET on the live site, or run `curl -s -D - -o /dev/null -H "Origin: https://everyversemap.com" "https://labs.bible.org/api/?passage=John%203&type=json&formatting=plain"` and expect `200` and `Access-Control-Allow-Origin: *` (it gave both on 2026-10-20).
- **Licensing exposure.**
  - MACULA's CATSS question is unanswered.
  - The NET copyright line beside the text carries no URL; netbible.com/copyright is linked only from the Sources shelf (uncertain whether that is enough).
  - The NET and the ESV are free and non-commercial only.
  - potion-base-8M would ship without credits, and with an unchecked training-set license, if it were wired in hastily.
- **Runtime dependency on another site.** The NET depends on labs.bible.org (CORS worked on 2026-10-20). Its JSONP fallback runs a remote script in the page.
- **Mirror branch and workflow.**
  - `mirror/potion-base-8M` is unprotected; deleting it would break a future pin.
  - Its 28 MB blob is about two thirds of the 41.65 MiB clone pack.
  - The mirror workflow (`contents: write`) runs again on any push of its file, including the merge of the next Ask PR, and mirrors Hugging Face's latest revision (section 0).
- **Stale local data.** `build.rs:350-355` clears only `text/`, `lex/` and `dict/`. A file a module stops writing stays in a local `web/public/data`, and Vite copies it into `web/dist`. CI and Pages always start clean.
- **Domain not verified** on the GitHub account. Dependabot and code scanning are off.
- **Local servers.** `make serve` is broken on native Windows (`serve.mjs:9` resolves to `C:\C:\...`), and its path guard admits sibling folders that start with "dist".
- **Stale planning docs** (README numbers, IDEAS.md, the extras README table) can mislead a session that plans from them.
- **This handoff can go stale.** Until 2026-10-20 it and the six maps lived only in a scratch folder on the founder's PC, invisible from GitHub; branch `handoff-2026-10-20` puts them in the repository (section 9, item 2). Section 0 holds only while the three commands at the top give the values shown.

## 11. Document map

| Document | What it is | Current? |
|---|---|---|
| This file, `docs/HANDOFF.md` | The handoff. | Section 0 as of 2026-10-20 21:00 UTC (`75f6edc`). Added to the repository by branch `handoff-2026-10-20`; section 0 is rewritten whenever `main` changes. |
| [`docs/handoff/map-architecture.md`](handoff/map-architecture.md), [`map-history.md`](handoff/map-history.md), [`map-ask.md`](handoff/map-ask.md), [`map-content.md`](handoff/map-content.md), [`map-branches.md`](handoff/map-branches.md), [`map-build.md`](handoff/map-build.md) | The six detailed maps behind this file, with line-level evidence. | Written 2026-10-20 at `a46d819`. They predate #47 and #48 (`map-branches.md` line 8 says "No open PRs" and "46 PRs in all"), and their `layers.rs` line numbers past line 342 are 4 lower than at `75f6edc`. Added to the repository by branch `handoff-2026-10-20`, with local paths on the founder's PC replaced by plain descriptions; their facts are unchanged. |
| `layers/plan.json`, `voices/group-*.md`, `literary/fit.md`, in the work folder on the founder's PC | The sibling jobs' plan and reports (section 0). | Written 2026-10-20. Not in the repository. |
| `README.md` | Pitch, start links, quick start, architecture, performance table, ESV setup. | Partly stale: numbers, the WSL note, the feature list, the data license line (section 9, item 7). Last changed `0e04cdc`. |
| `NOTICE.md` (95 lines) | Every source's license, the STEPBible changes, LSJ/UBS, the dictionaries, Christian writers, ESV, NET, Tyndale. | Current as of `0e04cdc`. It does not mention the MACULA question. |
| `IDEAS.md` (39 lines) | The idea list from day one: 15 ideas. | Stale since `6dad5eb` (2026-10-07). 4 shipped, 3 partial, 8 not built (section 9, item 13). |
| `LICENSE` | MIT for the code. | Current. |
| `web/src/ui/extras/README.md` (402 lines) | The contract for extras, the design rule, the source rules, the shared-file insertions, a test recipe. | The rules are current, with the scope question in section 6. The table at :22-30 is stale (3 of 13), the insertion anchors point at `ultracode/ideas-spine` line numbers, :165, :353 and :355 use the old `/BibleAtlas/` base, and the test recipe (:358) works only in a cloud container. Last changed `f256636` (2026-10-09). |
| `docs/*.png`, `docs/tour.gif` | README screenshots. | From 2026-10-07. Not re-checked against the UI at `75f6edc` (uncertain). |
| `sources.json` `_comment` and per-source `note` | The pinning rule; what each source supplies and what is withheld. | Current (27 sources). |
| `_comment` fields in `config/*.json` | The rules for each hand-made table, including the founder's citation rule (`layer-sources.json:3-6`) and the Ask rule (`questions.json`). | Current. `shelf.json` cards are partly stale (section 9, item 6). |
| Header comments as specs | The design notes of record: `web/src/depth.ts:1-14`, `crates/atlas-cli/src/ask.rs:1-25`, `layers.rs:1-60`, `extra_hard_verses.rs:1-50`, `extra_voices.rs:1-10`, `web/src/data/net.ts:1-22`, `server/esv.mjs:1-12`, `web/public/sw.js:1-30`, `lexhtml.rs:1-5`, `crates/atlas-core/src/lib.rs:12-16`, `container.rs:3-17`. | Current, except the old-base example comments in `sw.js:27-28`, `arrival.ts:18` and `extras/data.ts:12`. |
| `Makefile` (12 targets) and the workflow comments in `.github/workflows/*.yml` | How to build and deploy. | Current. `make` is not on the founder's PC (use section 7). |
| PR bodies #1 to #48 | Before / After / How / Checks for each change, with measured numbers. The decisions of record. | Each is true as of its own date. Snapshot of #1 to #46: `prs.json` in the scratch and work folders on the founder's PC. |

## 12. Where the work logs are

- **PR bodies.** `gh pr view <n> --repo Sixteen1-6/BibleAtlas`. Closing notes exist as comments on #4 and #6 (`--comments`); #36 has none, and its reason is in revert commit `1096bcb`. A snapshot of #1 to #46 (title, branch, state, dates, full body) is `prs.json` in the scratch folder on the founder's PC (copied to the work folder). PR bodies link to claude.ai project threads in the founder's project `chan_011qDT8Q1c7gDodDspnZeS1d` (16 threads); 14 PRs carry no thread link (mostly Ask, plus the local #47 and #48).
- **Cloud sessions.** Open each as `https://claude.ai/code/session_<id>`, with the founder's claude.ai account. There are 19, found from the `Claude-Session` trailers on 216 commits:

  | Session id | Commits | What it did |
  |---|---|---|
  | `01GDgrBpfomsCbSfqcijgTXn` | 78 | The 13 ultracode branches |
  | `01F5MX8Zw1CM7AW18hxHzAeP` | 37 | Ask: #16 to #43 and the mirror workflow. The most likely place for the evaluation sets and for unpushed work (uncertain). |
  | `01KSvZFUjwhscpHwZiY2UUGi` | 31 | Lead thread, under the founder's git name: Pages, Phase 1, depth levels, all Layers PRs |
  | `01CV3N3cyQquPTsKuYJAD5d1` | 17 | Eras, themes, Nave's, related words |
  | `01CRsyMFywVGbdBiAR1GjbXu` | 9 | Wordplay thread: #15, #19, #20, #25, #33, #37, and the round 2 Layers drafts |
  | `01YWkSFJcj6FuifeVXgT3Vu1` | 7 | Word forms (#18) |
  | `01TV2VVB3zDbFGg56enr6Eb2` | 7 | Search (#2, #14, #21) |
  | `0197Yk7ESXwqiJSukbJTfMu2` | 7 | Integration branch, #5 |
  | `01VxvHqLgy4PjBwknUmYuR41` | 5 | Aramaic (#8) |
  | `01WVKMg9CgLALXiRPoYUqwB9` | 3 | Places (#17) |
  | `01YDkmdBjMQgxKmV8RCvxLpG` | 3 | Hover (#7) |
  | `01V8TdmB8HpaUTx3XBA4HEnH` | 2 | NET (#46) |
  | `012b5WmWv2LUC8i6fnFR2fmR` | 2 | Shelf (#22) |
  | `01NJrNPyY17Z1efRLxhxYdZL` | 2 | Study notes (#13) |
  | `01VRMN4GpqqHLc8Ca9QVNkyo` | 2 | #9, including `0147377`, "the four open review minors" of WordWorld |
  | `01E82vb6SqMrmBiKY6XJxqQb` | 1 | Custom domain |
  | `01KPhwZeawXqafR9SqMLMXQu` | 1 | #12 |
  | `01KDM9rFXp9GYCtYvZtgmX3k` | 1 | #3 |
  | `01AViz6aUYW9mRULSwEqTiWJ` | 1 | `818c732` |

  The list with dates is in `sessions.txt` in the work folder on the founder's PC and in [`docs/handoff/map-history.md`](handoff/map-history.md) section 7. #5's follow-up list named "five open review minors" for WordWorld; #9 (`0147377`) fixed four, and whether a fifth remains is not recorded.
- **Off-repo material** (known):
  - the Layers review page https://claude.ai/artifact/GcZhxjKjNbKcKJvMUYQcBy;
  - the Ask and Often-asked review pages;
  - screenshots in the claude.ai project folders `bible-atlas/ultracode/aramaic/shots/` (#8) and `bible-atlas/study-notes/` (#13);
  - the spine test `bible-atlas/ultracode/ideas/spine-demo/test-spine.cjs` and its demo extras in the same project files (`web/src/ui/extras/README.md:358`);
  - the Wordplay thread's round 2 drafts and merge tools;
  - the search "scratch harness" (#21);
  - the blind sets and labels (section 9, item 8);
  - everything in the scratch folder on the founder's PC, which held this file until branch `handoff-2026-10-20` brought it into the repository.
- **GitHub Actions.**
  - `75f6edc`: CI run 39492103204, Deploy run 39492103317;
  - `5296d48`: CI run 39484813609, Deploy run 39484813688;
  - `a46d819`: CI run 39435599875, Deploy run 39435597250;
  - PR #48: CI runs 39489079246 and 39489151094; PR #47: CI runs 39481398755 and 39481458683;
  - Mirror run 39434303112.

  Logs: `gh run view <id> --log --repo Sixteen1-6/BibleAtlas`. 340 runs existed at 21:00 UTC on 2026-10-20 (332 succeeded, 8 failed). `scratch/runs.tsv` in the scratch folder on the founder's PC is a table of the 332 runs up to `a46d819`. Saved logs, in the same place: `scratch/ci-a46d819.log`, `deploy-a46d819.log`, `hw-ci-75f6edc.log` and `hw-deploy-75f6edc.log`.
- **The founder's PC.**

  | Path | What it holds |
  |---|---|
  | `BibleAtlas` | The main clone (CRLF), clean, at `5296d48` (fast-forwarded by a sibling job at 19:47 UTC; `75f6edc` not yet fetched). |
  | `BibleAtlas-fixes` | `small-fixes-2026-10-20`, PR #47 (merged). |
  | `BibleAtlas-simple` | `simple-level-2026-10-20`, PR #48 (merged). |
  | `BibleAtlas-layers` | The Layers job's worktree, with uncommitted work (section 0). |
  | `scratch/build.log` (scratch folder) | The native build check, two sessions. |
  | `maps/map-build.md` (work folder) | The recipe write-up, now also `docs/handoff/map-build.md`. |
  | `wt/build/data/raw-lf` (scratch folder) | Verified LF sources, 678 MB (a leftover data folder, not a worktree). |
  | `scratch/target` (scratch folder) | Rust build output, 359 MB, safe to delete. |
  | `scratch/live/` (scratch folder) | A crawl of the live site at `a46d819`. |
  | `scratch/potion/` (scratch folder) | A local copy of the model, plus probe and size scripts. |
  | `meaning/` (work folder) | Held-out check scripts and results. |
  | `scratch/content/` (scratch folder) | Layers snapshots at five commits, and the citation-link lists. |
  | `layers/`, `tools/`, `g1scripts/` (scratch folder); `voices/`, `literary/` (work folder) | The sibling jobs' working folders (section 0). |

  The scratch folder belongs to one local session and may be cleaned up by the app. Copy anything worth keeping before relying on it (section 9, item 2).
- **Machine changes.** The `wasm32-unknown-unknown` target was added to the founder's stable Rust toolchain on 2026-10-20. A sibling job fetched and fast-forwarded the main clone to `5296d48` at 19:47 UTC. Nothing else outside the repository clones and the scratch folder was changed by this workflow, as far as recorded.
