# AF-BT: Bible text and word-for-word credits

Branch `af-bt`, cut from `origin/main` `2aabdcc` on 21 October 2026, worktree `C:\Users\shubh\Projects\BibleAtlas-af-bt`. Not pushed. The PR body is the last section of this file; AF-INT opens the PR only with the founder's go-ahead (a merge deploys at once).

## Rule 12: files held by branches in flight

Before starting (21 October 2026, after `git fetch`, `origin/main` = `2aabdcc`):

- `true-credits` (`2aabdcc`): no committed changes; worktree `BibleAtlas-credits` clean.
- `commentary-notice` (`d12a4dd`): 29 files (`web/src/main.tsx`, `ChapterWhen.tsx`, `Dictionary.tsx`, `Layers.tsx`, `Sources.tsx`, `web/src/ui/commentary/*`, and 22 files under `web/src/ui/extras/`); worktree `BibleAtlas-notice` clean.
- `no-empty-selections` (`2aabdcc`): no committed changes; worktree `BibleAtlas-empty` clean.
- Also checked: `small-fixes-2026-10-20`, `simple-level-2026-10-20`, `handoff-2026-10-20`, `layers-mend-2026-10-20` and their worktrees.
- None holds `web/src/data/net.ts`, `web/src/ui/Reader.tsx` or `web/src/ui/Pairs.tsx`.

Before committing: see "Rule 12, again" below (filled in at commit time).

## Fragments in this folder

- `shelf-cards.json`: the `bsb` (checked, no change), `tahot` (the Leningrad Codex and its date), `clear-align` (who made the links, the version's dates), new `esv` (server deploys only) and `net-bible` (the acknowledgment word for word) cards. bsb, tahot, clear-align and net-bible go in PR H; esv in AF-SH's PR. **One field name to settle**: the plan writes the ESV filter as `"when": "esv"`, but `when` is every card's date; the fragment uses `"onlyWhen": "esv"` and leaves the name to AF-SH.
- `notice.md`: NOTICE.md line 85 rewritten (held for PR H), and an optional BSB row.
- `check-net-not-stored.mjs`: the check that no NET text is in the build output or the service worker.
- `counts.json`: the measured numbers.

## Found and not changed (outside this module's files)

- `server/esv.mjs` 15 to 16: the ESV notice says "copyright © 2001" where the ESV API's terms say "© 2001", and leaves out the terms' last two sentences ("The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language."). Only server deploys show it. Owner to be chosen.
- The NET card's `licenseNote` and `citation` (`config/shelf.json`) repeat the old NET line; a fix is in `shelf-cards.json`.
- The Gate G Ask-and-search capture tool was not written by this module. Instead, the import graph of `web/src/ui/ask/*`, `web/src/ui/extras/ask.extra.tsx` and `web/src/ui/Palette.tsx` was walked (36 files reached): none of the three files this module changes is in it, so Ask's and the palette's output cannot change. The first module that touches a file in that graph should write the capture tool.

## Rule 12, again (before committing, 21 October 2026)

`git fetch`: `origin/main` still `2aabdcc`. No branch commits `net.ts`, `Reader.tsx` or `Pairs.tsx`. But two runs now hold **uncommitted** edits to `web/src/ui/Reader.tsx` that were not there when this module started:

- `BibleAtlas-empty` (no-empty-selections): imports `OMITTED` from `./common` and uses it on the verse line. A three-way merge with `ce24306` is clean.
- `BibleAtlas-notice` (commentary-notice, beyond `d12a4dd`): puts the Translators' notes button behind the notice. A three-way merge with `ce24306` has one conflict: both sides change the import lines around `import ... from './Pairs'`. Keeping both sides resolves it.

Rule 12 says a module whose owned file is on such a list waits for that branch to merge. The commit is made (local, never pushed), so the work is not lost, and **the PR waits for AF-INT's call**: either AF-BT merges first, as section 5 orders, and those two runs rebase (one import conflict for the notice), or AF-BT rebases after them.

## Screenshots

`screens/` here: `before-*` from the live site (build `6e89a09cfa05`, the same data), `after-*` from `vite preview` of this branch, at 1440x900 and 390x844, light and dark, Study, Genesis 1 and John 3, BSB and NET, Word by word on. `*-report.json` holds the captured texts and tooltips.

## PR body

**Before**

- Under every NET chapter: "Scripture quoted by permission. ... Biblical Studies Press, L.L.C. All rights reserved. To see the NET Bible® study tool go to https://netbible.org." The acknowledgment left out "http://netbible.com", which the NET copyright page puts inside it, and the "study tool" sentence is not on that page (checked 21 October 2026: 0 matches).
- Under every BSB chapter: "English: Berean Standard Bible (public domain)." No translator, no date, no way to its card. "Hebrew and Aramaic: Leningrad Codex via STEPBible TAHOT (CC BY 4.0)." No date for the codex.
- With Word by word on, the English under each Hebrew or Greek word (STEPBible's, 447,744 words) was not credited, and its marks were not explained: 34,602 words carry < > (such as <obj.> on 11,003 Hebrew words) and 52,003 carry [ ].
- Each word's tooltip showed a raw code: "HTd/Ncmpa", "V-IAI-3S".
- The color-pairs note said "Alignment by Clear Bible (CC BY 4.0)", linked to the repository's current head, and did not say who made the links or that 18,945 links were left out. It also showed while the NET was on, when no colors are drawn.

**After**

- NET: "English: NET Bible (NET). Scripture quoted by permission. Quotations designated (NET) are from the NET Bible® copyright ©1996, 2019 by Biblical Studies Press, L.L.C. http://netbible.com All rights reserved. Read live from labs.bible.org." The acknowledgment is the page's, character for character (it is a permission term); the address links where the page links it; "(NET)" still links netbible.org.
- BSB: "English: Berean Standard Bible, by the Berean Bible Translation Committee (2016; public domain since 2023)." The name opens the BSB card on the Sources shelf.
- Hebrew: "Hebrew and Aramaic: Leningrad Codex (about AD 1008), tagged by STEPBible (TAHOT, CC BY 4.0)." Greek: "Greek: all the major printed editions, tagged by STEPBible (TAGNT, CC BY 4.0)." TAHOT and TAGNT open their cards.
- With Word by word on: "Word for word: STEPBible's English for each word (Tyndale House, version of 5 Oct 2026). [ ] words added for sense; < > a word English does not translate, such as <obj.>, the Hebrew sign of the object." In the New Testament it adds "based on the Berean Study Bible as it stood in July 2019", as TAGNT itself says. With a mouse it adds "Point to a word for its grammar, from STEPBible's key."
- Tooltips give the grammar in words from STEPBible's own keys (TEHMC, TEGMC): "Definite article (Hebrew) + Noun (Plural Masculine, Absolute)", "Verb Imperfect Active Indicative 3rd Singular".
- Color pairs: "Links made by hand by the Berean Bible team (Greek) and BiblioNexus (Hebrew), published by Clear Bible / Biblica (CC BY 4.0). Version of 11 May 2026, read 8 Oct 2026. The 18,945 links the app could not place are left out." The name links the pinned version (`c99bd0ae`); the count is read from the build's `meta.json`, so it follows the data. The note hides while the NET is shown.

**How**

- `web/src/data/net.ts`: the acknowledgment and the two addresses as constants, with where they were checked.
- `web/src/ui/Reader.tsx`: the credit lines, card links, the word-for-word note, the tooltips; the pairs note only when colors are drawn.
- `web/src/ui/Pairs.tsx`: `CardLink`, `WordsNote`, the new `PairsNote`, and `grammarTip`, which reads each grammar code part by part with the keys' words for its letters. Every code the app ships was checked against the keys' own phrases: 734 of 742 Hebrew and Aramaic parts (99.6% of parts in the text) and 1,098 of 1,167 Greek codes (97.6% of words) give the key's phrase exactly; the rest are places where a key's phrase repeats, drops or contradicts its own fields, all listed in the evidence file.
- `docs/evidence/af-bt-2026-10-21.json`: every fact, with the page or pinned file, status, time and SHA-256 (decision 11). Checks are described, never who made them (decision 19). No AI credit anywhere (decision 15).
- No data, Rust, Ask or search code changed. Shelf and NOTICE text is not in this PR: the corrected NOTICE.md NET paragraph and the BSB, TAHOT, Clear and NET cards wait for PR H, and the new ESV card (server deploys only) for AF-SH's PR.

**Checks**

- `cargo clippy --workspace --release -- -D warnings`: pass. `cargo test --release -p atlas-cli`: 199 passed.
- `atlas build`: build id `6e89a09cfa05`, unchanged. `atlas verify`: 5,909 checks passed, as on `main`.
- `npm run build` (VITE_ESV=off): pass; the Ask matcher finds its own question for 51,736 of 66,453 examples (77.9%). Main script 341.33 kB (127.97 kB gzipped), +8.58 kB (+3.24 kB gzipped) over `2aabdcc`.
- Ask and search unchanged: none of the three changed files is among the 36 files that `web/src/ui/ask/*`, `ask.extra.tsx` and `Palette.tsx` import, directly or through other files.
- No NET text stored: Genesis 1 and John 3 read live into memory; 53 probes searched in 4,457 files of `web/public/data`, `web/dist` and `sw.js`: 0 found.
- Browser, 1440x900 and 390x844, light and dark, Study: Genesis 1 and John 3 in the BSB and the NET with Word by word on, the pairs note, the tooltips on Hebrew and Greek words, and the BSB and TAHOT links (each opens its card, not empty): 0 console errors.
- New strings: 0 em dashes, 0 of rule 3's credit phrases.
