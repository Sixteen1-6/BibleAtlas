# Bible Atlas: local build check on the founder's Windows PC (origin/main a46d819)

Checked 2026-10-20 in two sessions (11:05 to 13:56, cut off at 13:58; resumed 14:50 to 15:25). Full command output is on the founder's PC, in a local job's scratch folder:
`scratch/build.log` (session 2 starts at the line "=== SESSION 2").

## Verdict

- **Everything builds and passes natively on Windows. You don't need WSL.** README.md:81 says "On Windows, run everything inside WSL", but that is not required. `make` is not installed and isn't needed, because each Makefile target is one or two commands that run fine in PowerShell or Git Bash.
- **Three things break or drift on Windows, and each has a workaround:**
  1. **`atlas fetch` picks up Git's Windows defaults.**
     - It runs the system `git` (crates/atlas-cli/src/fetch.rs:110-111). That git uses Git for Windows' `core.autocrlf=true`, which lives in `C:/Program Files/Git/etc/gitconfig`.
     - Without `core.longpaths=true`, the fetch fails with "Filename too long" on 10 STEPBible files, but only under a deep path. The longest fetched path is 175 characters under the founder's main clone's `data\raw\` and 273 under the scratch worktree.
     - With `core.longpaths=true`, the fetch succeeds, but 228 of 357 source files come out CRLF. The build still succeeds, with a different buildId (37a161b535ed instead of the live 514b1f3bf2b1). Verify then fails 1 of 5909 checks.
     - Adding `core.autocrlf=false` still leaves 71 files CRLF (66 BSB .usfm and 5 natural-earth .geojson). Their upstream .gitattributes mark them as text, and `core.eol` defaults to native.
     - With `core.autocrlf=false`, `core.eol=lf` and `core.longpaths=true` set through `GIT_CONFIG_*` environment variables, all 357 files match the live site's `meta.json` hashes byte for byte.
  2. **`make serve` crashes on the first request.**
     - server/serve.mjs:9 builds the path with `resolve(new URL('../web/dist', import.meta.url).pathname)`, which gives `C:\C:\...\web\dist`.
     - The fix is `fileURLToPath`. Until then, `vite preview` is a working substitute, and it also serves `/api/esv` (web/vite.config.ts:14-16).
  3. **A clone checked out with CRLF line endings can't reproduce the live site byte for byte.**
     - The repo has no .gitattributes, so the founder's clone (`core.autocrlf=true`) has CRLF files. That makes `dist/index.html`, `404.html`, `sw.js` and `manifest.webmanifest` differ from live.
     - It also changes the `key` in `ask/meaning.json`. web/scripts/ask-meaning.mjs:167-173 hashes words.ts and its own source to make that key.
     - The data itself does not depend on the repo's line endings, only on the sources' line endings.
- **The local build reproduces the live site exactly.** From an LF worktree, with LF sources and the wasm that CI built, the Pages variant (`VITE_ESV=off`) produced a `web/dist` matching https://everyversemap.com/.
  - All 49 files reached from index.html, 404.html, sw.js and manifest.webmanifest (including all 45 hashed assets) are byte-identical.
  - On the data side, session 1 compared 2211 data files with live and found 0 differing.
  - meta.json matches once its 357 backslash paths are written with `/`.
  - ask/meaning.json matches from an LF checkout: `ask-meaning` reported "up to date" against the live file's key 87e1d1c85e65bc2a.
- **The wasm engine differs from live only because of the compiler version.** The founder's PC has rustc 1.99.0 (commit b940084d7e). The live `atlas-BuY3SbmO.wasm` names rustc commit 58cf8f9c35, and the deploy log confirms it is "rustc 1.99.1 (58cf8f9c3 2026-10-13)". Running `rustup update stable` would close the gap; that is the founder's call. Only the embedded `/rustc/<commit>/` paths differ, plus 4 offsets that depend on them, and the size is the same (75220 bytes). Because the wasm hash changes, `engine.worker`, `index-*.js` and the 13 lazy chunks get different hashed names too.

## Makefile targets translated and measured

The PC was shared with other workflows throughout: 22 threads at 100% load, cores clocked at 0.9 to 1.4 of 3.8 GHz, 0.8 GB of 15.4 GB RAM free, and Defender (MsMpEng) using about 13% of all CPU. Timings therefore vary a lot. The same vite build took 455 s in session 1 and 17.8 s in session 2.

| Make target (Makefile line) | Native command | Result | Wall |
|---|---|---|---|
| CI lint (ci.yml:32) | `cargo clippy --workspace --release -- -D warnings` | rc 0, no warnings | 48 s cold |
| CI tests (ci.yml:33) | `cargo test --workspace --release` | 218 passed (199 atlas-cli, 18 atlas-core, 1 atlas-wasm) | 434 s (compile 7m05s) |
| `test` (Makefile:39-41) | `cargo test --workspace`, then `cd web; npm run typecheck` | 218 passed; tsc rc 0 | 193 s (compile 2m51s) + 11.7 s |
| first `cargo run --release` of `fetch` | `cargo build --release -p atlas-cli` | rc 0 | 1087 s (18m06s; fat LTO, codegen-units=1, Cargo.toml:11-15) |
| `fetch` (Makefile:11-12), as is | `cargo run --release -q -p atlas-cli -- fetch` | rc 1, "Filename too long" on 10 STEPBible files (deep scratch path) | 77 s |
| `fetch`, longpaths only | same command, with `core.longpaths=true` | rc 0, but only 129 of 357 files match CI | 567 s |
| `build-data`, CRLF sources | `... -- build` | rc 0, buildId 37a161b535ed (wrong) | 500 s |
| `verify`, CRLF sources | `... -- verify` | rc 1: 5908 passed, 1 failed ("Nave's Jesus, the Christ includes 1 Corinthians 1:24 but not 1:10") | 184 s |
| `fetch`, LF (runs B and C) | `... -- --raw data/raw-lf fetch` with the 3 settings below | rc 0, 357 of 357 match live | 464 s fresh; 512 s re-fetching 2 checkouts (fetch always re-fetches all 17 repos) |
| `build-data`, LF | `... -- --raw data/raw-lf build` | rc 0, 2212 files, 120.6 MB, buildId 514b1f3bf2b1 (= live) | 273 s |
| `verify`, LF | `... -- verify` | 5909 checks passed | 372 s |
| one time | `rustup target add wasm32-unknown-unknown` | rc 0 | 23 s |
| `wasm` (Makefile:21-22) | `bash scripts/build-wasm.sh` in Git Bash (CRLF copy ran fine), or the two lines in the recipe below | 75220 bytes | 65 s |
| `install` (Makefile:24-25) | CI uses `npm ci` (ci.yml:44) | 98 packages, 0 vulnerabilities | 54 s / 129 s |
| prebuild hook (web/package.json:9) | `node scripts/ask-meaning.mjs` | trains the matcher (132402 texts) | 600 s the first time; 4.6 s when "up to date" |
| `web` (Makefile:28-29), CI variant | `npm run build` | rc 0 | 666 s under load |
| Pages variant (pages.yml:51-56) | `$env:VITE_ESV='off'; npm run build` | rc 0, 49 of 49 files byte-identical to live | 41 s |
| `dev` (Makefile:32-33) | `npm run dev` (checked as `vite --port 18433 --strictPort`) | ready in 7.7 s; `/`, main.tsx, meta.json and atlas.wasm all 200 | n/a |
| `serve` (Makefile:36-37) | `node server/serve.mjs` | crashes with ENOENT `C:\C:\...\web\dist\404.html` | n/a |
| `serve` substitute | `npx vite preview --port 8080` | `/` 200, wasm `application/wasm`, page drew Isaiah 53:5's links | n/a |
| `clean` (Makefile:43-44) | `Remove-Item -Recurse -Force target, web\dist, web\public\data, web\src\engine\atlas.wasm` | not run | n/a |

### For comparison: the same commit on GitHub's runners

These numbers come from the CI logs saved in the scratch folder, `ci-a46d819.log` and `deploy-a46d819.log`, both for 2026-10-20 14:02.

- **The whole CI job took 4 min 21 s:**
  - clippy plus release tests: 60 s
  - `make data`, including the atlas-cli release compile, with data/raw restored from the actions cache: 116 s
  - `make wasm`: 1.5 s
  - `npm ci` plus build: 64 s
- **The Pages job reached deploy in about 4 minutes.**
- **Individual steps on CI:**
  - atlas build "wrote 2212 files (120.6 MB) ... in 14.6s" (16.4 s in the Pages run). The founder's PC took 246 s and 430 s.
  - ask-meaning took 59.3 s and 75.8 s. The founder's PC took 554.8 s.
  - CI used rustc 1.99.1 (58cf8f9c3 2026-10-13) and Node 22.
- **Most of the gap is load, not Windows.** The founder's PC was 10 to 25 times slower, but the evidence points to the shared load, throttled clocks and Defender scanning rather than to Windows itself. The same vite build took 455 s in session 1 and 17.8 s in session 2. On an idle machine a cold native run should land in the 10 to 20 minute range, but that was not measured.

## Fastest correct recipe for the founder's PC (PowerShell)

This recipe produces output identical to CI. Run it from a clone checked out with LF endings. Step 1 is only needed if you want a site that matches the live one byte for byte. The data comes out right from the existing CRLF clone too, as long as step 2's variables are set when you fetch.

```powershell
# 0. One time
rustup target add wasm32-unknown-unknown

# 1. An LF clone (the founder's existing main clone is CRLF because of the system autocrlf=true)
git clone -c core.autocrlf=false -c core.eol=lf https://github.com/Sixteen1-6/BibleAtlas.git BibleAtlas-lf
cd BibleAtlas-lf

# 2. Make the sources the same as CI's (session-only, changes no git config file)
$env:GIT_CONFIG_COUNT = '3'
$env:GIT_CONFIG_KEY_0 = 'core.autocrlf';  $env:GIT_CONFIG_VALUE_0 = 'false'
$env:GIT_CONFIG_KEY_1 = 'core.eol';       $env:GIT_CONFIG_VALUE_1 = 'lf'
$env:GIT_CONFIG_KEY_2 = 'core.longpaths'; $env:GIT_CONFIG_VALUE_2 = 'true'

# 3. Data (make data). The first line is the 18-minute compile; later runs reuse target\
cargo build --release -p atlas-cli
cargo run --release -q -p atlas-cli -- fetch      # about 8 min, network: 17 repos on github.com
cargo run --release -q -p atlas-cli -- build      # about 4.5 min
cargo run --release -q -p atlas-cli -- verify     # 3 to 6 min, must say "5909 checks passed"
Remove-Item Env:GIT_CONFIG_*                      # in a CRLF clone this keeps git status sane

# 4. Engine (make wasm) without bash
cargo build -q -p atlas-wasm --lib --target wasm32-unknown-unknown --profile wasm
Copy-Item target\wasm32-unknown-unknown\wasm\atlas_wasm.wasm web\src\engine\atlas.wasm

# 5. Site
cd web
npm ci
npm run build                       # CI variant (ESV on); the first run spends about 10 min in ask-meaning
$env:VITE_ESV = 'off'; npm run build; Remove-Item Env:VITE_ESV   # what GitHub Pages deploys

# 6. Look at it
npm run dev                         # http://localhost:5173
npx vite preview --port 8080        # instead of make serve
```

Notes on the recipe:

- **Skip what you don't need.**
  - Use `cargo test --workspace` (193 s) instead of the release run (434 s) unless you want to match CI exactly. Both run the same 218 tests.
  - `cargo clippy` is only needed before a push.
  - A config-only change needs no Rust compile, only `build` and `verify`. The CLI embeds config only in a test (layers.rs:731).
- **Fetch is optional when sources are already present.** A fresh fetch repeats about 8 minutes of git network work every time. To reuse the verified sources that are still on disk, skip it and pass `--raw <dir>` to `build`. `build` refuses to run if any file differs from its manifest.lock.json.
- **Running the same steps in Git Bash:**
  - Prefix the fetch with `GIT_CONFIG_COUNT=3 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=false ...`.
  - Don't type `npm run build -- --base=/`. MSYS rewrites it to `--base=C:/Program Files/Git/`; this was seen in session 2, and vite only warns. Use `MSYS_NO_PATHCONV=1` or leave the flag out, since vite's default base is already `/` (vite.config.ts sets none).
  - Use `MSYS_NO_PATHCONV=1` for `git show origin/main:.github/...` as well.
- **PowerShell 5.1 passes `--` through `npm.ps1` correctly.** `npm run typecheck -- --version` ran `tsc --noEmit --version`.
- **A cold run took over an hour here, not "a few minutes".** README.md:89 says "takes a few minutes the first time". On the founder's loaded PC a cold run summed to about 65 to 75 minutes of wall time: CLI compile 18 min, fetch 8, build 4.5, verify 3 to 6, release tests 7, ask-meaning 10, site 1 to 11. CI does the same work in 4 to 5 minutes. To speed up local runs, building when the PC is otherwise idle matters more than any flag.
- **WSL is untested and not needed.** It is installed but stopped. If you ever use it, clone inside the Linux file system (not /mnt/c) and follow the README unchanged.

## Smaller facts

- **Lock paths use backslashes on Windows.**
  - fetch.rs:124 builds each lock path with `strip_prefix(raw).to_string_lossy()`, so on Windows every path gets one `\` (`bible_databases@e1b254cef8\sources/extras/...`).
  - build.rs:509 copies that path into meta.json, so local meta.json is 483659 bytes against 483302 live, with 357 differences.
  - Replacing `\\` with `/` makes it identical to live (scratch/fix-meta.mjs).
- **sources.json pins commits only, not file hashes (0 occurrences of sha256).** The lock is generated locally, so "inputs verified against manifest.lock.json" can't catch CRLF sources. The single Nave's verify check is the only guard. Build C prints "naves: JESUS, THE CHRIST is cut at 32767 characters"; the CRLF build never prints that line.
- **Fetch failed only on long paths, not on missing tools.** `atlas fetch` shells out to `git` and to `curl` (curl only for Git LFS files, and none were needed). Both are present on the founder's PC.
- **Build tools:** `make`, `mingw32-make` and `gmake` are absent. `just` is installed in `~/.cargo/bin`, so a justfile would be a cheap native task runner.
- **The fast-profile experiment was inconclusive.**
  - Setting `CARGO_PROFILE_RELEASE_LTO=false CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16` took 1338 s, longer than the 1087 s default, but both ran under unrelated load.
  - atlas-cli is 36,838 lines in one crate (world.rs 6,897 lines, extra_real_map.rs 4,561).
  - A real comparison needs an idle machine.
- **Node version:** CI uses Node 22 (ci.yml:20). The founder's PC has Node 24.13.0 and npm 11.6.2, and the output is byte-identical anyway.

## State left behind

- `wt\build\data\raw-lf`, in a local job's scratch folder on the founder's PC, is kept for reuse.
  - It holds 17 checkouts and manifest.lock.json (678 MB). All 357 files match the live meta.json (checked again at 14:58).
  - Its checkouts have no autocrlf setting of their own. To re-fetch into it, set the GIT_CONFIG_* variables first, or just `build --raw` from it.
- Everything else in that worktree was deleted. The worktree entry was pruned (`git worktree prune` listed only `worktrees/build`).
- The second worktree, `wt\build-lf`, was removed with `git worktree remove --force`.
- The main clone is unchanged: git status is clean and HEAD is a46d819.
- The other worktrees (`BibleAtlas-fixes`, `BibleAtlas-layers`) belong to other jobs and were not touched.
- One change outside the repo: `rustup target add wasm32-unknown-unknown` (session 1) added the wasm target to the stable toolchain.
- Scratch helpers in the same folder:
  - check-raw.mjs: raw sources against live hashes
  - crawl-live.mjs: downloads the live index.html and every asset it reaches
  - compare-dist.mjs: a local dist against that crawl
  - fix-meta.mjs: `\\` to `/` in meta.json
  - live\: the crawled live files
