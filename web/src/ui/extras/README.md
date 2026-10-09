# Extras: one quiet line, one tap to go deeper

An extra adds one quiet line under the selected verse, only where it has something to say, and a panel one tap away with the passages side by side. Each extra lives in files of its own in this folder and in one Rust module, and plugs in without editing any shared list. This file is the recipe; follow it exactly.

The design rule: simple for anyone who comes in, never overwhelming, with the power to go as deep as the Bible does. So:

1. The simplest form comes first: one plain line, no jargon.
2. Depth is exactly one tap away: the panel.
3. At most one quiet line per extra, shown only where it applies. Never an empty state, never "0 results".
4. Reverent, accurate and humble. Label anything uncertain.
5. Levels: Simple is the one plain line. Study is the texts side by side. Deep adds the original words, the data and the sources.

## What the reader sees

- Under the selected verse, one line per extra that applies, in `order`. Two lines show; more wait behind "and N more". Nothing shows while data loads, if it fails, or where no extra applies.
- Tapping a line (or its ›) opens its panel. Verse names inside a line are links that take the reader to that verse.
- On phones (900 px wide or less) the panel is a bottom sheet over a dimmed page. On wider screens it is a side panel over the study column, widened into the reader's empty margin so two passages fit side by side.
- Escape, Back (and the phone's back gesture), the × button, a tap outside (phones) and a swipe down (phones) close it. Focus moves into the panel and back to the line.
- The open panel is part of the link: `#v=Matt.3.3&tab=connections&x=quotes`. A chapter panel is `&x=quotes.chapter`.
- An extra may also add one line under the chapter heading (`chapterNote`), with its own panel (`ChapterPanel`).

## The three extras

| Extra | id | File | order | The line | The panel |
| --- | --- | --- | --- | --- | --- |
| Quotations | `quotes` | `quotes.extra.tsx` | 10 | "Quoting Isaiah 40:3", "Quoted in Matthew 3:3 and 3 more" | the passages side by side |
| Parallels | `parallels` | `parallels.extra.tsx` | 20 | "Also told in Mark 2:1–12 and Luke 5:17–26" | the passages side by side |
| Places | `real-map` | `real-map.extra.tsx` | 30 | "Places: Bethlehem, Judea" | a real map |

All three leave `level` out (it defaults to `'simple'`), so the line shows at every level.

## Your files

Create only these. `<id>` is your id, and `<mod>` is your Rust module: `extra_quotes`, `extra_parallels` or `extra_real_map`.

| File | What it holds |
| --- | --- |
| `web/src/ui/extras/<id>.extra.tsx` | The extra: `export default defineExtra({ ... })`. |
| `web/src/ui/extras/<id>/` | Optional: more components and helpers. Files in subfolders are never picked up as extras. |
| `web/src/ui/extras/<id>.css` | Optional: styles, imported from your `.extra.tsx` with `import './<id>.css';`. Every class starts with `x-<id>-`, for example `x-real-map-pin`. |
| `crates/atlas-cli/src/<mod>.rs` | Builds and checks your data. |

Your build writes `web/public/data/extras/<id>.json`, plus any more files under `web/public/data/extras/<id>/`. That folder is git-ignored. Never commit data.

Apart from these files, you make at most five insertions in shared files (see "The shared files"). Change no other file. That includes the files in this folder: `types.ts`, `registry.ts`, `VerseExtras.tsx`, `Sheet.tsx`, `open.ts`, `data.ts`, `kit.tsx`, `level.ts`, `extras.css` and this README. If you need something the spine does not do, build it in your own files. If that is impossible, say so in your report.

## 1. The extra

Every extra has this shape (`types.ts` has the full contract):

```ts
export default defineExtra<Data>({
  id: 'quotes', //           the file name, and the x= value in links
  order: 10, //              place in the block, lowest first
  title: 'Quotations', //    the panel heading: short and plain
  load(a) { ... }, //        Promise<Data>; runs once, the result is kept
  note(verse, data) { ... }, // the line, or null; runs on every render
  Panel, //                  the panel behind the line
  // chapterNote(chapter, data) { ... },  optional: a line under the chapter heading
  // ChapterPanel,                        optional: its panel
  // tall: true,                          optional: on wider screens the panel reaches up over the map of links
});
```

A complete example, in the shape the real `quotes.extra.tsx` takes. The data format and the words are yours to choose.

```tsx
import { loadJson } from './data';
import { Facts, Lead, Passage, SideBySide, SourceNote } from './kit';
import { levelAtLeast } from './level';
import { type NoteLine, type PanelProps, type VerseRef, defineExtra } from './types';

/** web/public/data/extras/quotes.json, as the build writes it. */
interface QuotesFile {
  format: 1;
  /** [New Testament verse, the Old Testament verse it quotes] */
  pairs: [VerseRef, VerseRef][];
}

interface Data {
  quotes: Map<VerseRef, VerseRef[]>;
  quotedIn: Map<VerseRef, VerseRef[]>;
}

function add(m: Map<VerseRef, VerseRef[]>, key: VerseRef, v: VerseRef): void {
  const list = m.get(key);
  if (list) list.push(v);
  else m.set(key, [v]);
}

function line(words: string, vs: VerseRef[]): NoteLine {
  return vs.length === 1 ? [words, { verse: vs[0] }] : [words, { verse: vs[0] }, ` and ${vs.length - 1} more`];
}

function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const quoting = data.quotes.get(verse);
  const others = quoting ?? data.quotedIn.get(verse) ?? [];
  return (
    <>
      <Lead>{quoting ? 'These words come from an older passage.' : 'Later writers use these words.'}</Lead>
      <SideBySide>
        <Passage a={a} from={verse} navigate={navigate} />
        {others.map((v) => (
          <Passage key={v} a={a} from={v} navigate={navigate} />
        ))}
      </SideBySide>
      {levelAtLeast('deep') && <Facts rows={[['Source', 'The source, in plain words'], ['How matched', 'One plain sentence']]} />}
      <SourceNote>Quotations from the source, CC BY 4.0.</SourceNote>
    </>
  );
}

export default defineExtra<Data>({
  id: 'quotes',
  order: 10,
  title: 'Quotations',
  async load(a) {
    const file = await loadJson<QuotesFile>(a, 'extras/quotes.json');
    const quotes = new Map<VerseRef, VerseRef[]>();
    const quotedIn = new Map<VerseRef, VerseRef[]>();
    for (const [nt, ot] of file.pairs) {
      add(quotes, nt, ot);
      add(quotedIn, ot, nt);
    }
    return { quotes, quotedIn };
  },
  note(verse, d) {
    const ot = d.quotes.get(verse);
    if (ot) return line('Quoting ', ot);
    const nt = d.quotedIn.get(verse);
    return nt ? line('Quoted in ', nt) : null;
  },
  Panel,
});
```

### The line: `note()`

- Return `null` when the extra has nothing to say about the verse. Never return "0 …", "None", "No …" or an empty string.
- One short line, under about 70 characters, in words a first-time reader knows. No jargon on this line: no "pericope", "synoptic", "LXX", "MT", "Strong's", "lemma" or "toponym".
- Begin with the kind of thing it is: "Quoting …", "Quoted in …", "Also told in …", "Places: …".
- Write verses as links, not as text: `['Also told in ', { verse: m1, to: m2 }, ' and ', { verse: l1, to: l2 }]`. The app writes each name ("Mark 2:1–12") and links it. Name at most three, and say "and N more" for the rest.
- A line with no verse in it is a plain string: `'Places: Bethlehem, Judea'`.
- Make it a lookup such as `Map.get`, because it runs on every render. Do the work in `load()`.
- If `note()` throws, the line is hidden (and a warning is logged in development).
- `chapterNote(chapter, data)` follows the same rules, for a line under the chapter heading. Without a `ChapterPanel`, that line cannot be tapped and only its verse links work.

### The panel: `Panel`

`Panel` receives `{ a, data, verse, close, navigate }`. `ChapterPanel` receives `chapter` (`{ book, chapter }`) in place of `verse`.

1. Start with `<Lead>`: one plain sentence that says what the reader is looking at.
2. Then the texts: `<SideBySide>` holding one `<Passage>` per passage. They sit in two columns when there is room and stack on phones. `<Passage a from to? navigate note?>` shows its name, which takes the reader there, and the BSB English. At Deep it shows the Hebrew or Greek under each verse, and each word opens its word study.
3. At Deep only (`levelAtLeast('deep')`), show the data: `<h3>` headings, `<Facts rows={[[label, value], ...]} />`, how each link was made and how sure it is.
4. End with `<SourceNote>`, which names your source and its license in plain words: "Quotations from …, CC BY 4.0." It adds an "All sources" link.
5. Label anything uncertain, plainly, with `<Unsure>` next to what it qualifies: `<Unsure>location uncertain</Unsure>`, `<Unsure>traditional site</Unsure>`, `<Unsure>scholars differ</Unsure>`. Never present a guess as fact. STEPBible TIPNR descriptions are AI-written: never present them as scholarship, and if you use them at all, say what they are.
6. Move the reader only with `navigate(verse)`, open a word study only with `openWord(root, verse, pos)`, and open the Sources screen only with `showSources()`. Each one closes the panel the right way.
7. Add no Escape or other key handlers, history entries, URL parameters, focus traps or portals. The frame does all of that. Never use `<GoDeeper toTop>`. A plain `<GoDeeper to="deep">See the Hebrew and Greek</GoDeeper>` (from `'../Depth'`) is fine.
8. Load nothing from other sites at run time. Everything comes from `web/public/data/` through `loadJson` or `useJson`.
9. Use only the app's colour variables (`--ink`, `--muted`, `--line`, `--page`, `--surface`, `--surface-2`, `--accent`, `--accent-soft`, `--link`, `--focus`), so both themes work. If you need a colour of your own, such as water on a map, define it as `--x-<id>-<name>` three times: on `:root`, inside `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }`, and on `:root[data-theme='dark']`.
10. On desktop the panel is about 340 to 600 px wide, depending on the screen; on phones it is the full width. Its body scrolls.

### Data on the web side

- `loadJson<T>(a, 'extras/<id>.json')` fetches `web/public/data/extras/<id>.json` and adds the site's base path (`/BibleAtlas/` on GitHub Pages) and the build id for you. The result is cached. If the fetch fails, the promise rejects: your line simply does not show, and `load()` is tried again 30 seconds later.
- `useJson<T>(a, 'extras/<id>/<name>.json')` is for a heavier file that only the panel needs. It returns `undefined` while loading and `null` if the load failed. Show nothing, or `…`, until it arrives. Never show an error message.
- Verses are numbers (`VerseRef`): 0 is Genesis 1:1 and 31101 is Revelation 22:21. These are the same numbers as `vz.index(book, chapter, verse)` in the build and as `S.selected`. Write verse numbers into your JSON in the build, so the web side does no parsing. `verseOf(a, 'Isa.40.3')` exists for the rare id that comes from somewhere else.
- Keep `extras/<id>.json` small, under about 200 KB before compression, because it loads the first time a reader selects a verse. Put anything only the panel needs in separate files under `extras/<id>/`, and load those with `useJson`.
- Start `load()` with `await readerHere('<id>')` (from `first-move.ts`) unless the first screen needs your line. On a plain first visit the app selects a verse by itself; this waits for the reader's first tap, key or scroll, so that visit downloads nothing extra. A link to a verse, a chapter or your panel loads at once. Only `quotes` skips it, because the welcome card points to its line under Isaiah 53:5.

## 2. The data

### Choose and pin the source

1. Use only openly licensed sources: public domain, CC BY 4.0 or CC BY-SA 4.0. Confirm the license on the source's own page or repository, not a mirror's, and say in your report where you confirmed it. No NC or ND licenses. Never any ESV text.
2. The source must be in a git repository, pinned to an exact commit. Add it to `sources.json` (see "The shared files") with the same fields as the others: `id`, `title`, `provides`, `license`, `attribution`, `homepage`, `repo`, `commit` (the full 40-character SHA), `files` (a logical name for each path in the repository) and, optionally, `note`. The Sources screen then lists it with its license and checksums. You do not edit that screen.
3. `atlas fetch` checks out only the listed files at that commit and records their SHA-256 in `data/raw/manifest.lock.json`. `atlas build` refuses to run if a file no longer matches. Never commit downloaded data.
4. Treat downloaded data as untrusted. Parse it defensively, check every reference, count what you drop, and never run anything from it.
5. Credit the source in `NOTICE.md`, with one table row (see "The shared files").

### The Rust module: `crates/atlas-cli/src/<mod>.rs`

`build()` returns the files to write, and `run()` in `build.rs` writes them through its own `write()`. That way they are listed in `meta.json` with their checksums, `atlas verify` checks them, and they count towards the build id. `verify()` returns `(passed, what was checked)` pairs. This example reads a tab-separated file of reference pairs. Adapt the parsing to your source, and keep the two signatures.

```rust
//! Quotations: the Old Testament verses the New Testament quotes, from <source> (<license>).

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::fs;

const OUT: &str = "extras/quotes.json";

/// A reference as people or datasets write it ("Isaiah 40:3", "Isa.40.3",
/// "Mark 2:1-12") as its first and last verse numbers, if it is in the BSB.
fn verses(s: &str, vz: &Versification) -> Option<(u32, u32)> {
    atlas_core::refs::resolve(atlas_core::refs::parse(s.trim())?, vz)
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(inputs: &Inputs, vz: &Versification) -> Result<Vec<(String, Vec<u8>)>, String> {
    let path = inputs.path("quotes-source", "pairs");
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let mut pairs: Vec<(u32, u32)> = Vec::new();
    let mut unmapped = 0usize;
    for row in text.lines().filter(|l| !l.trim().is_empty() && !l.starts_with('#')) {
        let mut cols = row.split('\t');
        match (cols.next().and_then(|s| verses(s, vz)), cols.next().and_then(|s| verses(s, vz))) {
            (Some(nt), Some(ot)) => pairs.push((nt.0, ot.0)),
            _ => unmapped += 1,
        }
    }
    pairs.sort_unstable();
    pairs.dedup();
    eprintln!("quotes: {} pairs, {unmapped} rows not mapped to a verse", pairs.len());
    let doc = json!({ "format": 1, "pairs": pairs });
    Ok(vec![(OUT.to_string(), serde_json::to_vec(&doc).map_err(|e| e.to_string())?)])
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let path = d.dir.join(OUT);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let doc: Value = serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))?;
    let pairs = doc["pairs"].as_array().ok_or("quotes.json has no pairs")?;
    let (m, _) = d.resolve("Matt 3:3")?;
    let (i, _) = d.resolve("Isa 40:3")?;
    let has = |a: u32, b: u32| pairs.iter().any(|p| p[0].as_u64() == Some(a.into()) && p[1].as_u64() == Some(b.into()));
    Ok(vec![
        (pairs.len() > 100, format!("only {} quotation pairs", pairs.len())),
        (has(m, i), "Matthew 3:3 quotes Isaiah 40:3".to_string()),
    ])
}
```

- Turn references into verse numbers with `atlas_core::refs::parse` and `atlas_core::refs::resolve`, or `atlas_core::canon::by_osis("Isa")` and then `vz.index(book, chapter, verse)`. Both give `None` for a verse the BSB does not have. Count those, and never guess.
- `refs::parse` reads one book name followed by numbers: "Isaiah 40:3", "Isa.40.3", "Mark 2:1-12", "Mark 1:40-2:12". It does not read a range that names the book twice, such as "Prov.8.22-Prov.8.30". Split that at the `-` and resolve each end.
- Sources number some verses differently from the BSB (psalm titles, and a few chapters in Joel, Malachi and elsewhere). Map them onto the BSB, check the known cases in `verify()`, and note any change you make to the data in `NOTICE.md` if its license asks for that.
- If you need more from `run()` than `inputs` and `vz` (`bsb`, `words` and `lemmas` are in scope at every anchor), add it to your own call line and your own `build()`. Never move or change anyone else's line.
- `verify()` should check facts known independently of your code: a handful of well-known cases, a sensible count, and that every verse number is below `d.vz.verse_count()`.
- Format only your own module: `rustfmt --edition 2021 crates/atlas-cli/src/<mod>.rs`. Never run `cargo fmt`, or let an editor format on save, on the shared files.
- `cargo clippy --workspace --release -- -D warnings` must pass, so leave no unused code. Add no new crates: `serde`, `serde_json`, `sha2` and `atlas_core` are already there.

## 3. The shared files

You make at most five insertions, all at the anchors below. If you add no source, skip `sources.json` and `NOTICE.md`. Insert directly after the anchor line, and change nothing else: no other lines, no blank lines, no reordering, no reformatting. The line numbers are those on `ultracode/ideas-spine`. Check the anchor text before you insert.

Each insertion is at least one untouched line away from every other insertion and from the lines that PR #2 (search), PR #3 (color pairs) and hebrew-meets-greek change in the same files. In a scratch repository, the three extras merged with PR #2, PR #3 and hebrew-meets-greek (simulated at its planned anchors) in three different orders, and these five files merged cleanly every time.

### `crates/atlas-cli/src/main.rs`: one line

| Extra | After line | Anchor text | Insert |
| --- | --- | --- | --- |
| quotes | 14 | `mod english;` | `mod extra_quotes;` |
| real-map | 19 | `mod query;` | `mod extra_real_map;` |
| parallels | 21 | `mod verify;` | `mod extra_parallels;` |

### `crates/atlas-cli/src/build.rs`, in `run()`: one line

| Extra | After line | Anchor text |
| --- | --- | --- |
| quotes | 279 | `    let mut files: BTreeMap<String, Value> = BTreeMap::new();` |
| real-map | 298 | `    write(out, "atlas.bin", &bin, &mut files)?;` |
| parallels | 343 | `    }`, the brace that closes `for (b, book) in BOOKS.iter().enumerate() {` (two lines above `    let empty_verses = ...`) |

Insert, with your module name in place of `<mod>`:

```rust
    for (rel, bytes) in crate::<mod>::build(&inputs, &vz)? { write(out, &rel, &bytes, &mut files)?; }
```

### `crates/atlas-cli/src/verify.rs`, in `run()`: one line

| Extra | After line | Anchor text |
| --- | --- | --- |
| quotes | 76 | the line that ends `"PageRank in [0, 1]");` |
| real-map | 108 | `    }`, the brace that closes `for (b, bk) in BOOKS.iter().enumerate() {` |
| parallels | 117 | `    r.check(empty == 0, format!("{empty} verses have no original-language words"));` |

Insert:

```rust
    for (ok, what) in crate::<mod>::verify(&d)? { r.check(ok, what); }
```

### `sources.json`: your source objects

| Extra | After line | Anchor text |
| --- | --- | --- |
| quotes | 15 | `    },`, which closes the `openbible-xref` object |
| real-map | 26 | `    },`, which closes the `bsb` object |
| parallels | 42 | `    },`, which closes the `tahot` object |

Insert one object per source, with 4 spaces before the braces and 6 before each field. Each object ends with `},`, because another object follows:

```json
    {
      "id": "quotes-source",
      "title": "…",
      "provides": "…",
      "license": "CC BY 4.0",
      "attribution": "…, the exact attribution the license asks for",
      "homepage": "https://…",
      "repo": "https://github.com/…",
      "commit": "<the full 40-character SHA>",
      "files": { "pairs": "path/in/the/repo.tsv" }
    },
```

### `NOTICE.md`: one table row

| Extra | After line | Anchor |
| --- | --- | --- |
| quotes | 9 | the row for "Cross-references and vote counts" |
| real-map | 11 | the row for "Hebrew and Aramaic Old Testament (TAHOT)" |
| parallels | 12 | the row for "Greek New Testament (TAGNT)" |

Insert one row: `| <what the data is> | <who made it>, via <repository> | <license> |`. Put the exact attribution in the `attribution` field in `sources.json`, which the Sources screen shows. Do not edit the "Attribution:" line (line 16), because PR #3 changes it.

## 4. Build and check

```sh
W=/home/claude/wt/<your worktree>        # on your branch, made from ultracode/ideas-spine
export CARGO_TARGET_DIR=/home/claude/wt-target
cd "$W"

# Once: the dependencies, the engine, and a private copy of the sources already fetched (about 145 MB).
[ -e web/node_modules ] || ln -s /home/claude/bibleatlas/web/node_modules web/node_modules
[ -f web/src/engine/atlas.wasm ] || cp /home/claude/bibleatlas/web/src/engine/atlas.wasm web/src/engine/
[ -d data/raw ] || { mkdir -p data && cp -a /home/claude/bibleatlas/data/raw data/raw; }

# The data: fetch (this adds your source), build, verify.
cargo run --release -q -p atlas-cli -- fetch
cargo run --release -q -p atlas-cli -- build
cargo run --release -q -p atlas-cli -- verify

# What CI runs.
cargo clippy --workspace --release -- -D warnings
cargo test --workspace --release
(cd web && npm run build)
```

- Copy `data/raw`; never link it. `atlas fetch` writes into it, and the original belongs to the main clone.
- If a fetch or push fails with too many requests, a 5xx or a dropped connection, wait 20 to 60 seconds and try again, up to 6 times.
- Cargo builds take minutes. Use generous timeouts, or run them in the background.

To look at it the way GitHub Pages serves it, on your own port:

```sh
SP=<your scratchpad>
(cd web && VITE_ESV=off npx vite build --base=/BibleAtlas/ --outDir "$SP/pages/BibleAtlas" --emptyOutDir)
node /tmp/claude-0/-home-claude/630ee7b1-23be-5378-96da-233a3ad4bc10/scratchpad/ultracode/scout/tools/pages-server.mjs "$SP/pages" <port> --gzip-bin
# then open http://127.0.0.1:<port>/BibleAtlas/#v=Matt.3.3
```

Playwright's Chromium is in `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), and the module is `/opt/node22/lib/node_modules/playwright`. Never run `playwright install`. `/mnt/project-files/bible-atlas/ultracode/ideas/spine-demo/` holds the spine's own test (`test-spine.cjs`) and the temporary demo extras it ran against. Use them as a pattern, and never commit a demo. Stop your server when you are done.

Check, at 390×844 and at 1440×900, in light and in dark:

- the line under a verse it applies to, and nothing at all under a verse it does not apply to;
- the panel at Simple, and again at Deep;
- that Escape and Back close it, and that a link with `&x=<id>` opens it.

Before you commit:

- `git status` shows only your files and your insertions, and nothing under `web/public/data/` or `data/`;
- you have added no new npm or Rust dependencies;
- your report lists your insertions exactly: the file, the line, and the text.

## Reference

### From this folder

- `types.ts`: `VerseRef` (a number), `ChapterRef` (`{ book, chapter }`), `VerseLink` (`{ verse, to?, text? }`), `NoteLine` (a string, or strings and `VerseLink`s in reading order), `PanelProps<D>`, `ChapterPanelProps<D>`, `Extra<D>`, and `defineExtra(extra)`.
- `data.ts`: `loadJson<T>(a, file)` and `useJson<T>(a, file | null)`.
- `first-move.ts`: `readerHere(id)`, which holds a `load()` back until the reader's first move.
- `kit.tsx`:
  - components: `<Lead>`, `<SideBySide>`, `<Passage a from to? navigate note?>`, `<SourceNote>`, `<Unsure title?>` and `<Facts rows>`;
  - names and links: `refName(a, verse, to?)` ("Mark 2:1–12"), `verseHash(a, verse)` ("#v=Mark.2.1"), `verseOf(a, osis)`;
  - text: `usePassage(a, from, to?)` gives the verse rows, or `null` while they load;
  - actions: `openWord(root, verse?, pos?)` and `showSources()`.
- `level.ts`: `levelAtLeast(level)`, `Level` and `LEVELS`.

### From the app (use, never edit)

- `../../data/atlas`:
  - `label(a, v)` gives "Isaiah 40:3", and `rangeLabel(a, v, span)` a passage name;
  - `locate(a, v)` gives `{ book, chapter, verse }`, and `verseIndex(a, book, chapter, verse)` goes the other way;
  - `chapterName(a.books[book])`, `a.books[i]` (`osis`, `name`, `testament`), and `a.n`, the number of verses.
- `../../data/text`: `getVerse(a, v)` gives `[english, words]`, and `rootsOf(row)`.
- `../common`: `sharedRoots(a, rowA, rowB)` (the roots two verses share, rarest first), `RootChip` and `OrigLine`.
- `../Depth`: `GoDeeper`, without `toTop`.

### How the panel behaves (`open.ts`, `Sheet.tsx`)

- Opening a panel from its line adds one history entry. Escape, the × button, a tap outside or a swipe down take that entry back off, and Back closes the panel. After `navigate()`, the entry stays, so Back returns the reader to the verse they were on.
- A verse panel closes when another verse is selected, a chapter panel when the reader turns the chapter, and any panel when search opens.
- An unknown `x=` in a link, a failed load, and a panel that no longer applies are all dropped quietly.
- A link to an extra above the reader's level takes the reader to that level.
- A panel that throws shows one plain sentence ("Sorry, this could not be shown right now."), not an error.
