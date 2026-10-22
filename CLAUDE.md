# CLAUDE.md

Standing instructions for any Claude session working in this repository. They come from sections 6 ("Rules that must not be broken") and 7 ("Operating it") of [docs/HANDOFF.md](docs/HANDOFF.md), which gives the evidence and the file and line for each.

## Start here

- Read [docs/HANDOFF.md](docs/HANDOFF.md) first. Run its "Check the current state first" commands before acting: section 0 is true only while they give the values shown.
- Read [docs/FOUNDER-DECISIONS.md](docs/FOUNDER-DECISIONS.md) next: the founder's 23 decisions of 2026-10-20 and 21 override this file where they differ (for example decision 15, no AI credit anywhere, replaces "Disclose AI drafting" below).
- Rewrite section 0 of `docs/HANDOFF.md` after every merge to `main` and every finished job, in the same sitting. The PR that changes `main` should update it.
- If it's not local, it should all be pushed to GitHub. Anything kept only in a session's container or a local folder (evaluation sets, drafts, tools) is lost with it. The licensing rules below still decide what may enter this public repository.
- Every important task runs as its own reviewed workflow when one is available.

## Scripture and citation (the founder's rules)

- **Ask answers only in the Bible's words.** "The framework for interpreting the Bible is the Bible." Answers are chains of whole verses or exact BSB words, 3 to 8 parts, with nothing written in between. No scholars or church views in questions, phrasings, signals or examples. Every chain part must be tied by the Bible's own data, or the build fails. The only exception is the founder's own note. The page for someone asking about ending their life shows only its seven whole verses, then that note: Shubhanshu asked for "Scripture only" there on 2026-10-22, so the help line is gone.
- **Cite only Bible-believing Christian writers.** The founder's words, 2026-10-11: "cite ... bible believing people who fully believe the bible and theologians that love God, not people who are liberalizing the bible".
  - Catholic and Orthodox writers who uphold Scripture may be cited. Rabbis' commentaries and Jewish scholars may not.
  - Ancient texts (Targums, Mishnah, Josephus and so on) may be named in evidence only as witnesses, never as a citation.
  - The cite list and the avoid list are in `config/layer-sources.json`; any avoid-list name in a note's text, evidence or cite fails the build. The Pulpit Commentary is never cited on Jeremiah or Lamentations.
- **Strength labels count writers.** A writer is a distinct cited work whose role in `config/layer-sources.json` is "interpreter". 3 or more writers: "widely agreed"; 2: "commonly held"; 1: "some interpreters". The build does not check the count, so you must. If an honest lower strength makes the build refuse a passage, find a second interpreter who states the point (record the fetched URL and the exact quote) or drop the passage.
- **Quotations are checked against the BSB.** Every quotation is BSB. Sources go in the evidence field, never in a note's text. Credit Greek wording to the Gospel writer, since Jesus most likely taught in Aramaic. Always label the Peshitta a later translation. Disputed readings say "scholars differ".
- **Other people's words stay theirs.** Christian writers and study notes are shown as their own words, never as the app's claim. Writers appear only at Deep, after "Show what they wrote".
- **Disclose AI drafting.** Every AI-drafted passage and card says "Drafted with AI help (Claude) ...".
- **Drafts never publish by accident.** `ATLAS_LAYER_DRAFTS=1` and `ATLAS_HARD_VERSE_DRAFTS=1` are for local previews only; never set them in a workflow, a Makefile target or a deploy.
- **Never fill `reviewed_by` yourself.** Any name there publishes a whole Layers passage past the citation rule, or a hard-verse card. Only a named human reviewer, normally the founder, sets it, in a PR whose body says who reviewed what. (Proposed; not yet confirmed by the founder.)
- **Keep the search box as it is** (PR #36 closed, reverted in `1096bcb`).
- **The founder's era and theme choices stand** (PR #11): the traditional date first on the "Written" line; Colossians and 1 and 2 Thessalonians in AD 50 to 70; James, 2 Timothy, and 1 and 2 Peter without an era; the Sabbath theme as it was. Every eras quotation appears word for word in the Tyndale Open Bible Dictionary.

## Licensing

- **The ESV is never stored**: not in the repository, the build, the service worker or a log. It is reached only through the server proxy, one chapter per request, with at most 500 verses in memory and Crossway's notice shown. It is off on Pages. Never name or quote the ESV in Layers or hard verses, and keep real translation wording out of code comments too. Never commit an ESV API key or put it in client code. Commercial use needs a Crossway license.
- **The NET is never stored**: not in the repository, the build, the service worker or the browser. It is read live from labs.bible.org, with at most two chapters in memory. Every chapter ends with "(NET)" linked to netbible.org, plus the copyright line. The translators' notes are linked, never shown. The permission is for free, non-commercial use.
- **Copyrighted works are cited and linked, never copied.** Ship only public-domain, CC BY 4.0 and CC BY-SA 4.0 material, with the license confirmed on the source's own page and no NC or ND licenses.
- **CompellingTruth and OpenBible.info answers are for internal comparison only.** Nothing from those sites goes in the repository.
- Nave's Topical Bible is an index only: show its headings, never its lines, and never make it a theme. Leave out map positions from OpenStreetMap, Google Maps and Google Earth. Never pass lexicon or study-note HTML to the browser; convert it to plain segments.

## Pinned sources and determinism

- Every source is pinned to an exact 40-character commit in `sources.json`. `atlas build` refuses to run if a commit or a locked file hash does not match.
- Never commit data. `/data/raw` and `/web/public/data` are gitignored, and downloaded data is untrusted.
- Mirror an outside source to GitHub first and pin it like any other: the build containers reach only github.com. Never delete or force-push a pinned mirror branch such as `mirror/potion-base-8M`.
- Build only what can be checked. Leave out anything that does not match rather than guess, and print what was dropped.
- A new source needs a `sources.json` entry with the full commit, a `NOTICE.md` credit and a card in `config/shelf.json`. Shelf facts are checked against the work, never guessed.
- Build ids must reproduce on another machine. On Windows that needs the LF settings below; otherwise the data silently differs.

## Product rules

- **Depth levels.** Every visit starts at Simple and the first screen stays calm; Simple keeps to the verse and its strongest links. A feature picks Simple, Study or Deep and gates itself with `atLeast(...)` or `levelAtLeast(...)`, or an extra declares `level`. Nothing compares level names (`web/src/depth.ts`).
- **Extras** (`web/src/ui/extras/README.md`): one quiet line, only where it applies; never an empty state or "0 results"; no jargon on the line ("pericope", "LXX", "Strong's", "lemma"); lines under about 70 characters; anything uncertain labelled with `<Unsure>`; nothing loaded from other sites at run time; only the app's colour variables.
- **Shared code**, written for extras built in parallel: no new crates; never run `cargo fmt` on shared files; at most five one-line insertions per extra in `main.rs`, `build.rs`, `verify.rs`, `sources.json` and `NOTICE.md`; no change to the spine files. Whether these limits still bind outside parallel extra work is an open founder decision.
- **Heavy data loads late.** Heavy Ask data loads on the first question, never in the first download, and a first visit loads nothing extra.

## Checks that gate a change

- `cargo clippy --workspace --release -- -D warnings` and `cargo test --workspace --release` pass. CI uses an unpinned stable Rust.
- `atlas verify` passes every check (5,909 at `75f6edc`).
- `npm run build` in `web/` passes: `tsc --noEmit`, and the meaning matcher finds its own question for at least 70% of examples.
- Measure before claiming a gain. Ask changes are judged blind, on fresh, never-seen messages, with main and the branch run the same day. Search uses its fixed query sets (117, 103 and 158 queries).
- Browser checks run at 1440x900 and 390x844 (or 375 wide), light and dark, at all three depth levels, with no console errors. There is no committed browser harness: run `npx vite preview` (or `npm run dev`) and check by hand with the device toolbar and the console open.

## Build and verify

Requirements: git; Rust stable 1.88 or later; Node 20.19+ or 22.12+; `curl` (only for Git LFS files); `rustup target add wasm32-unknown-unknown`.

In a Linux container or on CI:

```
make all            # = make data (fetch, build-data, verify) + make wasm + make web
make test           # cargo test --workspace, then npm run typecheck in web/
make dev            # Vite dev server, http://localhost:5173
```

Natively on Windows (WSL is not needed), in PowerShell from the root of a clone:

```
$env:GIT_CONFIG_COUNT='3'                         # REQUIRED for fetch on Windows
$env:GIT_CONFIG_KEY_0='core.autocrlf';  $env:GIT_CONFIG_VALUE_0='false'
$env:GIT_CONFIG_KEY_1='core.eol';       $env:GIT_CONFIG_VALUE_1='lf'
$env:GIT_CONFIG_KEY_2='core.longpaths'; $env:GIT_CONFIG_VALUE_2='true'
cargo run --release -q -p atlas-cli -- fetch      # or skip it: ... -- build --raw <verified raw folder>
cargo run --release -q -p atlas-cli -- build
cargo run --release -q -p atlas-cli -- verify     # expect "5909 checks passed" at 75f6edc
Remove-Item Env:GIT_CONFIG_*
cargo build -q -p atlas-wasm --lib --target wasm32-unknown-unknown --profile wasm
Copy-Item target\wasm32-unknown-unknown\wasm\atlas_wasm.wasm web\src\engine\atlas.wasm
Set-Location web; npm ci; npm run build           # prebuild retrains the Ask matcher first
```

- A config-only change needs `atlas build` and `atlas verify`. A change to `config/questions.json` or `config/ask-examples.json` also needs `npm run build` in `web/`, and the 70% check must pass.
- For a site byte-identical to live, build from an LF clone (`git clone -c core.autocrlf=false -c core.eol=lf ...`) with CI's Rust (`rustup update stable`), and set `VITE_ESV=off` as Pages does. In Git Bash, `--base=/` is rewritten; use PowerShell, set `MSYS_NO_PATHCONV=1`, or drop the flag.
- `make serve` (`server/serve.mjs`) is broken on native Windows; use `npx vite preview` there. For the ESV, put `ESV_API_KEY` in `web/.env` (Vite only) or in the environment for `server/serve.mjs`.
- A push or merge to `main` deploys by itself: no staging site and no CI gate. After a deploy, check the live `data/meta.json` `buildId`, the hashed asset names against the deploy log, and one changed feature at the live URL.
- Roll back by reverting on `main`: `git revert -m 1 <merge commit>` for a merge, `git revert <commit>` for a squash merge. Prefer a revert PR, so CI runs on it first. For a bad service worker, set `KILL = true` in `web/public/sw.js` and deploy.

## Writing and PRs

- Plain English. No em dashes and no emoji.
- Commit subjects are plain sentences about the visible effect, with the why in the body.
- PR bodies follow Before / After / How / Checks, with exact measured counts. Do not hand-copy the generated attribution header that the tooling inserts.
- Local commits carry a `Co-Authored-By:` line; cloud commits carry a `Claude-Session:` trailer.
- Quote the founder by first name. Never write anyone's email address anywhere.
