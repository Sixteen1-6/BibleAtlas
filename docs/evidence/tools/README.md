# Evidence tools

These scripts re-check the evidence files in `docs/evidence/`. They are not part of the build: `atlas build` and `atlas verify` read only the evidence files, and nothing here runs in CI. Python 3, standard library only (`checks_from_git.py` also needs git). Run each with `python -I`.

Downloaded pages and results go in a cache folder, `cache/` beside these scripts unless `EVIDENCE_CACHE` names another (see `_paths.py`); it is never committed. The repository root is found from where the scripts sit, or from `BIBLEATLAS_REPO`.

## When each citation was checked (`layers-checks-2026-10-11-to-17.json`)

- `checks_from_git.py [REPO] [COMMIT]`: for every cite of `config/layers.json` at `COMMIT` (default `2aabdcc`), the first commit of the latest unbroken run in which the cite is present, mapped to its pull request through the first-parent merges of main. Run on `2aabdcc` it gives the file's 5,751 rows (PR #38 823, #39 1, #42 1,533, #44 3,373, #45 21). The file names the cites as `config/layers.json` gave them on 2026-10-21, after the true-credits batch had changed the `at` of cites to works cited directly and removed 13 cites under decision 20; 11 of those had a row here, so the file holds 5,740. 18 of its rows name cites removed on 2026-10-24 (the `left_out` records of `docs/evidence/layers-reads-2026-10-24.json`; 3 of them are in `proverbs-1-27`, now in `docs/held/`); they match no live cite.

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

## Figures seen in the words (`figures-seen/words-NN.json`)

The figure catalogue's hand-off files (`words-NN.jsonl`, in the project's shared folder at `bible-atlas/figures/every/work/`) list places where the BSB's own words show a figure that no cited writer names. Every place is read against its verse before it goes in `config/figures-seen/`, and `docs/evidence/figures-seen/words-NN.json` records how each was settled; each file's PR also adds its hand-off as it was read (`docs/evidence/figures-seen/handoff/words-NN.jsonl`, the `i` of each record is its line, from 0) and its drop log (`words-NN-drops.jsonl`: each place left out, with the reason). Point `SEEN_WORK` at `docs/evidence/figures-seen/handoff` to run the scripts from the repository. The scripts are in `figures-seen/`; the `.js` files are workflow scripts for Claude Code's Workflow tool, each taking `sp` (this folder) and the arguments named at its top.

- `wshow.py NN i j` (or `wshow.py FILE.jsonl i j`, or `wshow.py verse "Psalm 1:1"`): prints places for reading: the form and Bullinger's definition, the marked words (flagging any not in the verse), the BSB verse, its poetry lines, the verses either side, and the Hebrew or Greek words behind any Strong's tags. It reads the built data (`web/public/data`, or `SEEN_DATA`), `config/figure-forms.json` and the hand-off files (`SEEN_WORK`).
- `seen-read.js` (`nn`, `n`, `batch`): two readers per batch of about 40 places, one asking whether the figure is plainly there, one whether the marked words, form and tags are right; a third read of every place either questioned. `seen-mop.js` judges any disputed place a run left without a judgement.
- `sapply.py NN RESULT CHECKED REPO LOGDIR RUN`: keeps a place both readers passed, or one the third reader kept (a new form stands only where a reader proposed it), checks each as the build does, and writes `config/figures-seen/`, the drop log and the evidence record.
- `spre.py NN OUT.jsonl` (from words-09 on): runs the build's checks on a hand-off before anyone reads it. Stray punctuation before marked words and Strong's tags that are a search's stretch (they light G3588 or H0853, number eight, or light more words of the verse than there are tags) come off; a place the build would then refuse, or a figure found only in the Hebrew or Greek whose tags came off, goes to `OUT-refused.jsonl` and is not read. `seen-read2.js` (`nn`, `n`, `file`, `batch`) reads `OUT.jsonl` as `seen-read.js` does, with the rules earlier samples taught given to the readers up front, and `sapply.py` takes the file as a seventh argument.
- `smop.py NN MOP READ EVIDENCE REPO LOGDIR CHECKED`: settles the places `seen-mop.js` judged as `sapply.py` settles a judged place.
- `srecheck.py NN EVIDENCE REPO LOGDIR`: checks every kept place again as the build now checks it (added after a review of the build checks on 2026-11-22): overlapping entries are joined, which marks the same words, and a place the build would refuse is dropped. `sapply.py` and `spre.py` join overlapping entries the same way (`sapply.tidy`).
- `strim.py NN EVIDENCE REPO` and `stags.py NN EVIDENCE REPO`: for files read before those rules were in `sapply.py`, take stray punctuation off the front of kept places' words and take off tags that are a stretch, or that were chosen for a question's or parallel lines' words that have since changed.
- `sspan.py make|apply` with `seen-span.js`: every kept place that marks three or more poetry lines as said twice, opposite, building or climbing is read again: kept whole, cut to the lines that stand in the relation (its tags go with the cut), or dropped. With `figure`, every kept figure of speech is read again for its words (kept, cut to the words that carry it, or dropped); with `form`, every place marked said twice is read again for its label (kept, moved to the form its lines plainly show where a reader proposed it, or dropped). A file whose last-check sample misses the bar gets the re-read that answers its misses, then a fresh sample.
- `ssample.py NN EVIDENCE CONFIGDIR OUT [K] [ROUND]` with `seen-sample.js` and `sdrop.py`: a seeded sample of 25 kept places read by two more readers, a third settling any split. A file goes in only when 24 or more pass (the bar set with the catalogue), and every place a sample fails is dropped.
