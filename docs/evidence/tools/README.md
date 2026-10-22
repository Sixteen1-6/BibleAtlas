# Evidence tools

These scripts re-check the evidence files in `docs/evidence/`. They are not part of the build: `atlas build` and `atlas verify` read only the evidence files, and nothing here runs in CI. Python 3, standard library only (`checks_from_git.py` also needs git). Run each with `python -I`.

Downloaded pages and results go in a cache folder, `cache/` beside these scripts unless `EVIDENCE_CACHE` names another (see `_paths.py`); it is never committed. The repository root is found from where the scripts sit, or from `BIBLEATLAS_REPO`.

## When each citation was checked (`layers-checks-2026-10-11-to-17.json`)

- `checks_from_git.py [REPO] [COMMIT]`: for every cite of `config/layers.json` at `COMMIT` (default `2aabdcc`), the first commit of the latest unbroken run in which the cite is present, mapped to its pull request through the first-parent merges of main. Run on `2aabdcc` it gives the file's 5,751 rows (PR #38 823, #39 1, #42 1,533, #44 3,373, #45 21). The file names the cites as `config/layers.json` gives them after the true-credits batch, which changed only the `at` of cites to works cited directly and removed 13 cites under decision 20; 11 of those had a row here, so the file now holds 5,740.

## Who wrote the words (`credits-2026-10-21.json`)

The research matched each Bible Hub comment the app cites against archive.org scans of the printed volumes. The OCR texts are archive.org's `<identifier>_djvu.txt` files, saved as `cache/ia/<identifier>.txt`.

- `bh.py`: fetches a Bible Hub commentary chapter (kept in `cache/bh/`) and reduces it to text.
- `match.py`: compares a text with OCR texts in runs of seven words (shingles); the score is the share of runs found.
- `percite.py ROOT SOURCE CODE OUT.json CANDIDATES.json`: for every cite of one source, the comment on the cited verse, scored against the candidate scans for its book (`CANDIDATES.json` maps a book to archive.org identifiers).
- `findvol.py SOURCE CODE ROOT id1 id2 ...`: for each cited book, samples one chapter and counts its runs in each candidate volume, to find which volume holds the book.
- `true_authors.py`: the writer of every Barnes, Ellicott, Pulpit, Keil and Delitzsch, Jamieson-Fausset-Brown, Henry, Concise, Poole and Wesley cite by book, joined to the per-cite matches (`cache/res/*_percite.json`); writes `true_authors_percite.json`, the `cites` table of the attribution file.
- `examples.py`: picks, for each writer, one matched comment and ten of its words, with archive.org's search inside the scan for them (the records' `example`).
- `recheck.py`: scores again the chapters whose first match was weak.

## What was read on 2026-10-21 (`layers-credits-reads-2026-10-21.json`)

- `fetch.py URL ...`: fetches a page once and keeps it with its UTC time, final URL, HTTP status and SHA-256 (the fields of a reads record).
- `read_cite.py CODE "Book c:v" [--intro]`: the comment on one verse of a Bible Hub commentary page, and the authorship, canon, error and myth word lists of the Voices build run over it (and over the book's introduction with `--intro`), to find what to read closely under the founder's decision 20.
- `ia.py`: an archive.org scan's page index and search text, to find the leaf that holds a phrase (used for the Figures of Speech and Companion Bible page links).
- `decision20_groups.py`: the cites read for decision 20 (Ecclesiastes by Delitzsch, Salmon and Deane; F. W. Farrar; H. R. Reynolds and O. C. Whitehouse; E. H. Plumptre on Isaiah 36 to 39).
- `recount.py [passage ...]`: each note's writers counted by person, as the build keys them, and the notes whose strength label claims more.
- `audit_dates.py`: for every cite, the read or checked date the build will give it, as `layers.rs` finds it, and any cite with no record or with a record of another page.

A reading's verdict (respects or denies Scripture) is decided by reading the words; the word lists only point to what to read.
