# Local work of 2026-10-20 and 21

These files were made by the Claude Code jobs that ran on the founder's Windows computer on 2026-10-20 and 21, in the work folder `C:\Users\shubh\Projects\bibleatlas-workfiles\2026-10-20`. They were copied here unchanged from the cloud on 2026-10-21 at about 17:00 UTC, with line endings set to LF, so that they are no longer only on that computer. Paths inside them that start with `C:\` or name a scratch folder point at that computer.

The founder's decisions from the same work are in [../../FOUNDER-DECISIONS.md](../../FOUNDER-DECISIONS.md). They override `CLAUDE.md` where the two differ.

| Path | What it is |
|---|---|
| `CITATION-AUDIT.md` | The audit of every citation and credit the app shows, and the questions the founder answered in decisions 15 to 20. |
| `AUDIT-FIXES-PLAN.md` | The plan that splits the audit's fixes into modules (AF-BT, AF-LX, TC and others). Each module owns named files; a thread changing one of those files checks the plan first. |
| `audit-fixes/af-bt/` | The Bible text credits module: its PR text, measured counts, shelf-card and NOTICE fragments held for a later PR, and the check that no NET text is stored. Its code is the `af-bt` branch. Screenshots were left on the computer. |
| `audit-fixes/af-lx/` | The lexicon credits module's shelf-card and NOTICE fragments. Its unfinished code is on `wip/af-lx-2026-10-21`. |
| `audit-fixes/tools/` | A capture tool and query list for checking that Ask and search answers do not change. |
| `voices/` | Seven "Voices" reports (`group-*.md`) on which more Christian writers could be shown word for word at Deep, the plans and build spec drawn from them, the approved shortlist, the old-spelling study and the raw research results. |
| `literary/` | The literary-devices design (`fit.md`), the catalogue of figures, parallelism and contrasts with their sources (`catalogue.md`, `sources.md`), and the founder's mockups `mock-arcs.html`, `mock-card.html` and `mock-reader.html`. Open a mockup in a browser; `mock-arcs.html#ex=ps1&level=deep&view=desktop&theme=dark` is the view the founder uses. |
| `layers/` | The Layers mend job's plan (22 batches, 154 items) and its apply result. That job merged as PR #50. |
| `meaning/` | The potion-base-8M held-out checks of the Ask meaning model: the scripts, word list and logs. The 3.9 MB vector file `meaning.json` was left out, since the build can make it again. |
| `NOT-BUILT-YET.md` | Added 2026-11-01: what the literary, wordplay and Voices work here holds that is not live or queued yet, checked against `main` and the Wordplay thread's round 3, grouped by the thread that should pick it up. |
| `literary/mock-tools/`, `literary/judging/`, `literary/shots/` | Added 2026-11-01: the scripts and data that built the mockups (`mock-data.json`, `devices.src.json`, `content.py`), the earlier "before credits" mockup and template, the founder's mockup screenshots, and the judging job's tools, text captures and screen matrix. |
| `layers/returning-*.json` | Added 2026-11-01: the four passages the mend job brought back (1 Samuel 6:6, Proverbs 3:20, Ecclesiastes 3:18 and 3:20), as drafted. |
| `maps/`, `HANDOFF-as-written.md`, `prs.json` | Added 2026-11-01: the six maps and the handoff as the local job first wrote them (before local paths were replaced), its build log and session list, and every PR body up to #48. `docs/HANDOFF.md` and `docs/handoff/` supersede them. |
| `runs/`, `scripts/` | Added 2026-11-01: the local workflow run records and the restart scripts. |
| `audit-fixes/af-bt/grammar-check.*`, `audit-fixes/af-bt/screens/*.json`, `audit-fixes/af-lx/ask-capture/` | Added 2026-11-01: AF-BT's wording check and before/after screen reports, and AF-LX's capture of live Ask answers at `2aabdcc`. |
| `voices/research/spelling/`, `spelling-scripts/`, `hcf/` | Added 2026-11-01: the judged samples and scripts of the old-spelling study, and the church-fathers grouping and skip report. |

Changed on the way in (2026-11-01): the AI-credit lines in `layers/returning-*.json`, `literary/mock-card.before-credits.html` and `literary/mock-tools/mock-card.template.before-credits.html` were reworded to "Drawn from ..." (decision 15). One sentence of `voices/voices-research-results.json` here leaves out a NET quotation the computer's copy has.

Left on the computer: the downloaded research texts under `voices/research/` (CCEL, Internet Archive, New Advent, Wikisource, EarlyPrint and others; about 960 MB, and not ours to redistribute), the derived vector files `meaning/meaning.json` and `meaning/heldout2.json.w.json` (the build can make them again), the judging job's `node_modules` and its per-shot images in `literary/judging/tools/out/x/` (the text captures beside them are here), and AF-BT's before/after screenshots. The folder was last changed on 2026-10-21; nothing in it or in the clone and its worktrees is newer.
