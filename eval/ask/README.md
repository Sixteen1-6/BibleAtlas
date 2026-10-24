# Ask the Bible: test sets, labels, verdicts and scripts

"Ask the Bible" is the question box of Bible Atlas. It answers only with Bible verses. Each change to it, from PR #28 to the word-meaning model rounds on branch `claude/ask-the-bible-u6macl` (up to `f5a0f44`, not merged yet), was measured on the files in this folder.

Nothing here is read by the build, the site or CI. The folder is a record, so the next change can be measured the same way and the old numbers can be checked.

## What the test messages are

Every message in `sets/` was written for testing. None was typed by a real visitor, and no visitor data is stored anywhere in this folder. The messages imitate what people type on a phone: questions about the Bible and faith, practical questions about their own lives, and statements of what they are going through. Some are strange, hostile, misspelled or very short on purpose.

Where a message quotes a Bible saying word for word, the wording is the KJV's or the BSB's. Two messages first used wording that also matches some modern translations under copyright (Matthew 18:20 in `set7-150` and Matthew 12:30 in `set9-120`); they were changed to the KJV and BSB wording in every set, run and verdict file that carries them, together, so the runs and verdicts still line up. Other quoted fragments in the messages are paraphrases or everyday sayings.

## The rule for blind sets

- A blind set is used for one yes or no only. Main and the branch run it on the same day. The verses both versions show are mixed into batches with no mark of which version showed which. The verses are judged once, then scored.
- Once its verdicts have been read, a blind set is seen. After that it may be used for tuning, never for a claim.
- Only PR #34 reused a blind set (`set97-270`, from PR #32).
- **Every set in this folder is now seen.** The blind sets, in order: `heldout-120` (PR #28), `set3-149` (PR #29), `set4-150` (PR #31 work, not reported in the PR), `set6-150` (PR #31), `set97-270` (PR #32 and #34), `blind-269` (PR #40), `blind-fresh-299` (PR #41), `blind-fresh9-300` (PR #43), `blind-fresh10-305` (r9) and `blind-fresh11-312` (r11, the newest).
- The next yes or no needs a fresh set. It must avoid every line of `sets/seen12-5374.txt`, every example in `config/ask-examples.json` and every phrasing in `config/questions.json`. `scripts/pr34/prep.py` does that check (the steps are under "A blind yes or no" below).
- Some sets became training examples. On `main` at `b466ab6`, and still at `f5a0f44`, `config/ask-examples.json` holds, word for word, 1,043 of the 1,096 pool messages, 85 of `blind-fresh-299`, 82 of `crazy-177`, 66 of `dev-268`, 11 of `heldout-120`, 7 of `heldout2-149`, 5 of `set3-149`, and 1 each of `blind-269`, `set4-150`, `set5-225` and `set9-120` (so 89 of `dev-682`, 66 of `devq-813` and 1 of `set97-270`). It holds none of `set6-150`, `set7-150`, `dev2-545`, `dev4-594`, `blind-fresh9-300`, `blind-fresh10-305` or `blind-fresh11-312`.

## Words used here

- **Prepared answer**: one of the chains of verses in `config/questions.json`. **Opens** means the box shows a prepared answer. **Routed** covers both the matcher's pick and the word router's pick. **Exact** means the message is a prepared question in its own words.
- **Gathered**: no prepared answer opened, so the box ranks single verses (`gather.ts`). In the runs this is `how: "live"`.
- **Labels**: for a message, the prepared answers that fit it (`fits`), the ones in the same area that only partly answer (`near`), and a few words on its subject. Right, near and wrong opens are counted against them.
- **Verdict**: for a message and one verse the box showed, `answers`, `related` or `off`, with a few words of why. The scores count the first 6 verses shown (the first 8 before PR #32).
- **Run**: what one version of the box showed for each message of a set: how it answered, and the verses with their BSB words and the passage around them.
- **Router view** (`rt` files): for each message, the router's top word routes and the matcher's top meanings with their likelihoods. The open thresholds are fitted on these and the labels.
- **r9**: the word-meaning model (potion-base-8M) work from commit `16d39f7` on branch `claude/ask-the-bible-u6macl`. Its model tuning was done in a folder called r8, so both names appear in the scripts.
- **r10**: the review fixes on the same branch: `0ecdeb5` (every word piece's vector kept, in 4 bits) and `7d1c403` (the model compares 1,000 texts in full, not 300).
- **r11**: the blind round of the branch at `7d1c403` against `main` at `b466ab6`, on `blind-fresh11-312`, run on 2026-10-21.
- None of r9, r10 or r11 was merged when this folder was last brought up to date.

## Layout

| Folder | What it holds |
|---|---|
| `sets/` | The test messages, one file per set, named by set and count, and the seen list. |
| `labels/<round>/` | The labels, and the router views scored against them. |
| `verdicts/<round>/` | The verdicts, the batches that were judged (`*-batches/`), and the runs they judged. |
| `scripts/<round>/` | The runners, mixers, writing, judging and labelling Workflow scripts, scorers and fitting scripts, under the round they were first used in. `scripts/tools/` holds the verse lookups and `workdir.py`. |
| `manifest.json` | Every copied file with its sha256, the sha256 of its source, its old name or names, and how it was changed. |

Files over 4 MB are stored gzipped (`.json.gz`). No number in any data file was changed. Verdicts that existed only as workflow outputs are stored as their `result` object (`{"results": [...]}`). Workflow scripts that were never saved in the working folder came from the record of each Workflow run; they have no old name in `manifest.json`.

## Every file

Counts are messages unless they say otherwise. "Each" means every file in the row has that count.

### sets/

| Path | What it is | Round | Count |
|---|---|---|---|
| `sets/heldout-120.json` | Fresh messages judged blind, old search against new | PR #28 blind | 120 |
| `sets/dev-268.json` | The tuning messages of PR #28 and #29 (text only). 58 of them are among the 271 SHOW tuning messages. | PR #28, #29 | 268 |
| `sets/heldout2-149.json` | Earlier messages looked at while tuning PR #29 (`scripts/pr29/fresh.js`) | PR #29 | 149 |
| `sets/set3-149.json` | Never-seen faith questions and life statements (`scripts/pr29/fresh3.js`) | PR #29 blind | 149 |
| `sets/set4-150.json` | Untuned messages judged blind during PR #31 work (`fresh3.js` run again) | PR #31 | 150 |
| `sets/set5-225.json` | Messages for router and matcher tuning, kinds 0 to 2, 75 each (`scripts/pr31/fresh5.js`) | PR #31, #32 | 225 |
| `sets/set6-150.json` | Untuned messages: 50 life statements, 50 practical, 50 Bible (`scripts/pr31/fresh6.js`) | PR #31 blind | 150 |
| `sets/dev-682.json` | The router fit's dev messages: dev-268, heldout-120, heldout2-149 and set3-149 together. Each is tagged with its old source file (`all.json` = dev-268, `heldout.json`, `heldout2.json`, `set3.json`); the 4 messages that are in both set3 and heldout2 carry `heldout2.json`, so 145 carry `set3.json`. | PR #31, #32 | 682 |
| `sets/crazy-177.json` | Strange and hard messages: 39 absurd, 42 skeptic or paradox, 46 modern moral, 50 short or odd. 120 were written by `scripts/pr32/crazy.js`; the other 57 are the hand-written examples in its prompt. | PR #32 development | 177 |
| `sets/set9-120.json` | Never-seen strange messages, 30 of each of 4 kinds (`scripts/pr32/crazy2.js`). The first part of set97. | PR #32 blind | 120 |
| `sets/set7-150.json` | Never-seen messages, kinds 0 to 2, 50 each (`scripts/pr32/fresh7.js`). The second part of set97. | PR #32 blind | 150 |
| `sets/set97-270.json` | set9 followed by set7. Its kind codes mix the two sets' schemes. | PR #32 blind, PR #34 | 270 |
| `sets/pool-1096.json` | The labelled pool, 12 kinds (0 to 11, as in `scripts/pr34/gen.js`) | PR #34 | 1,096 |
| `sets/blind-269.json` | Held-out set (`gen.js`). Kind 0 life situations; kinds 1 and 2 other questions. | PR #40 blind | 269 |
| `sets/dev2-545.json` | Labelled dev messages, 12 kinds (`gen.js`: 600 written, 545 kept). MEANT and UNMEANT were tuned on them. | PR #40, #43, r9, r10 | 545 |
| `sets/blind-fresh-299.json` | Fresh blind set (`scripts/pr41/fresh8.js`), later labelled and used as dev ("dev3" in the scripts) | PR #41 blind, then dev | 299 |
| `sets/devq-813.json` | dev2-545 followed by dev-268: the input of the SHOW feature export | PR #41 | 813 |
| `sets/blind-fresh9-300.json` | Never-seen set. Kind 0 life statements, 1 practical questions, 2 Bible and faith (`scripts/pr43/fresh9.js`). | PR #43 blind | 300 |
| `sets/dev4-594.json` | Dev messages with kind, voice and angle fields (`scripts/r9/fresh10.js`). Labels are in `labels/r9/`. | r9 dev, r10 | 594 |
| `sets/blind-fresh10-305.json` | Never-seen set with kind, voice and angle fields (`fresh10.js`: 900 written, 594 kept as dev4 and 305 as this set) | r9 blind | 305 |
| `sets/blind-fresh11-312.json` | Never-seen set with kind, voice and angle fields (`scripts/r11/fresh11.js`) | r11 blind | 312 |
| `sets/seen12-5374.txt` | Every message of every set in this folder (5,370) and 4 messages typed while checking the page in a browser, sorted, one per line, so a new set repeats none. It was made here and replaces `seen11-4615.txt`, the r9 list (`fresh11.js` was given it with the same 4 extra lines), which left out crazy-177, set7-150 and set9-120. | r11 | 5,374 lines |

Kind, voice and angle, in `dev4-594`, `blind-fresh10-305` and `blind-fresh11-312` (kind alone in `blind-fresh9-300`):

- Kind 0: statements of what is happening in someone's life. Kind 1: short practical or moral questions about their own life. Kind 2: questions about the Bible and faith.
- Voice 0: teenagers, students and people in their twenties. Voice 1: parents, older adults, and people for whom English is a second language.
- Angle 0: the ordinary and common. Angle 1: people in many places and walks of life (countries and cultures, jobs, church backgrounds and none). Angle 2: the specific and unusual (odd details, edge cases, two things tangled together, and questions a child, a newcomer or a blunt sceptic would ask).
- `fresh10.js` had a writer for each of the 18 combinations. `fresh11.js` had six writers, one angle each: (kind, voice, angle) = (0, 0, 0), (0, 1, 2), (1, 0, 1), (1, 1, 0), (2, 0, 2) and (2, 1, 1), 52 messages each.

### labels/

| Path | What it is | Round | Count |
|---|---|---|---|
| `labels/pr31/dev-682-and-set5-225-labels.json` | Message, then answer id, then fits, near or no (`scripts/pr31/route-labels.js`, then `route-labels-2.js`) | PR #31, #32 | 897 messages (673 dev, 224 set5); 583 fits, 1,123 near, 4,917 no |
| `labels/pr31/set5-225-oracle-labels.json` | For set5: the fitting and near answers, chosen from all answers (`scripts/pr31/oracle-pick.js`) | PR #31, #32 | 225 |
| `labels/pr31/dev-268-rt.json` | Router view of the first router (open the answer that plainly fits) | PR #31 | 268 |
| `labels/pr31/dev-682-rt-sig.json`, `set5-225-rt-sig.json` | Router view with signals: the final OPEN check | PR #31 | 682 and 225 |
| `labels/pr31/router-terms-sig.json` | `tt.cjs` output: the router terms of every prepared question, its phrasings and its signal words, and of every typed message. `feats.py` reads it as `tt-sig.json`. | PR #31 | 663 answers, 1,057 messages |
| `labels/pr32/dev-682-rt-m.json`, `set5-225-rt-m.json` | Router and matcher view, top 3 meanings | PR #32 | 682 and 225 |
| `labels/pr34/pool-1096-labels.json` | Fits, near and subject | PR #34 | 1,096; 1,225 fits, 2,251 near, 186 with no fit |
| `labels/pr34/pool-1096-rt.json`, `pool-1096-rt-nn.json` | Router view before PR #34, and with the nearest-example blend | PR #34 | 1,096 each |
| `labels/pr40/dev2-545-labels.json` | Fits, near and subject: the labels behind MEANT | PR #40 | 545; 697 fits, 1,088 near, 25 with no fit |
| `labels/pr40/dev2-545-rt-base.json`, `dev2-545-rt-new.json` | Router view before and after PR #40's 353 new answers | PR #40 | 545 each |
| `labels/pr43/blind-fresh-299-labels.json` | Fits, near and subject for blind-fresh (the help-line message has none) | PR #41 to #43 | 298; 284 fits, 694 near |
| `labels/pr43/new-answers-relabel/out-1.json` to `out-17.json` | Which of the 360 answers PR #43 added fit or are near, and the best answer overall (`scripts/pr43/relabel.js`) | PR #43 | 843 in all (545 dev2, 298 blind-fresh); 128 fits, 388 near |
| `labels/pr43/dev2-545-nr-base.json`, `-nr-new.json`, `-nr-new-built.json` | Router and matcher view of dev2: before PR #43, with the new answers and the old NEAR, and as built | PR #43 | 545 each |
| `labels/pr43/dev2-545-nr-new-k15p3.json`, `-k20p2`, `-k20p3`, `-k20p4`, `-k25p3`, `-k30p3s4`, `-k30p3s6`, `-k30p4` | The NEAR grid on dev2 (k, power, share). k20p4 shipped. | PR #43 | 545 each |
| `labels/pr43/blind-fresh-299-nr-base.json`, `-nr-new.json`, `-nr-new-k20p3.json`, `-nr-new-k20p4.json` | The same views of blind-fresh | PR #43 | 299 each |
| `labels/r9/dev4-594-and-blind-fresh9-300-labels.json` | Fits, near and subject, against all 1,584 answers | r9 | 894 (594 dev4, 300 blind-fresh9); 927 fits, 2,249 near, 226 with no fit |
| `labels/r9/dev4-594-rt.json`, `blind-fresh9-300-rt.json` | Router views whose candidates were shown when labelling | r9 | 594 and 300 |
| `labels/r9/dev2-545-rt-words.json`, `blind-fresh-299-rt-words.json` | Router views with the words-only matcher, before the model | r9 | 545 and 299 |
| `labels/r9/dev2-545-model-base.json`, `blind-fresh-299-model-base.json` | Router views with the MODEL of `16d39f7` (rerank 300, k 20, power 8, share 0.5); `7d1c403` later raised rerank to 1000 | r9 | 545 and 299 |
| `labels/r9/dev2-545-model-{s4,s6,p4,k30,r1000}.json`, `blind-fresh-299-model-{s4,s6,p4,k30,r1000}.json` | The MODEL grid: share 0.4 and 0.6, power 4, k 30, rerank 1000 | r9 | 545 or 299 each |
| `labels/r10/dev2-545-rt-4bit.json`, `blind-fresh-299-rt-4bit.json`, `dev4-594-and-blind-fresh9-300-rt-4bit.json` | Router views at `0ecdeb5`: every word piece's vector in 4 bits, rerank 300. The `open` stored in the last two (80 of 298, 62 of 894) is far below what `pol10.py`'s rule gives from the same rows (174 and 318) and what the rerank 1000 runs store (177 and 320), so score them with the rule. | r10 | 545, 298 and 894 |
| `labels/r10/dev2-545-rt-rerank1000.json`, `blind-fresh-299-rt-rerank1000.json`, `dev4-594-and-blind-fresh9-300-rt-rerank1000.json` | The same at `7d1c403` (rerank 1000) | r10 | 545, 298 and 894 |
| `labels/r10/dev2-545-questions.json`, `blind-fresh-299-questions.json`, `dev4-594-and-blind-fresh9-300-questions.json` | The message lists those views were run on: dev2, blind-fresh without the help-line message, and dev4 followed by blind-fresh9 | r10 | 545, 298 and 894 |
| `labels/r11/dev2-545-rt-main.json`, `blind-fresh-299-rt-main.json`, `dev4-594-and-blind-fresh9-300-rt-main.json` | Main's router views of the same three lists (a worktree at `b466ab6`, whose Ask is the same as at `85f0994`), run on 2026-10-22 for the PR's main against branch counts. The branch's views that day (at `f5a0f44`) were byte for byte the `rt-rerank1000` views above. | r11 | 545, 298 and 894 |
| `labels/r11/jesus-life-5-questions.json`, `jesus-life-5-rt-main.json`, `jesus-life-5-rt-branch.json` | Five questions about Jesus' life that the founder's friends asked or that come near them (how old he was when he died, where he was born, where he died, who killed him, when he died), routed on main and on the branch | r11 | 5 |

### verdicts/

| Path | What it is | Round | Count |
|---|---|---|---|
| `verdicts/pr28/dev-268-verdicts.json` | Verdicts in context: chain fit for opened chains, answers, related or off for gathered verses, and target verses (`scripts/pr28/live-judge.js`) | PR #28 | 268; 94 chains (77 fit, 15 partly, 2 wrong); 1,281 verdicts (238 answers, 499 related, 544 off) |
| `verdicts/pr28/dev-268-batches/batch-1.json` to `batch-8.json` | What was judged: chain parts or gathered verses, with context | PR #28 | 268 |
| `verdicts/pr28/dev-268-new-verdicts.json`, `dev-268-new-batches/batch-1.json` to `batch-6.json` | Second round, on verses new in the tuning runs (`live-judge-2.js`) | PR #28 | 106; 627 verdicts |
| `verdicts/pr28/heldout-120-verdicts.json`, `heldout-120-batches/batch-1.json` to `batch-6.json` | Blind, old and new search mixed (`heldout-judge.js`) | PR #28 | 118; 1,412 verdicts |
| `verdicts/pr28/dev-268-base.json`, `dev-268-v6.json` | The site before PR #28, and PR #28's final tuning run | PR #28 | 268 each |
| `verdicts/pr28/heldout-120-base.json`, `heldout-120-new.json` | Old and new search | PR #28 | 120 each |
| `verdicts/pr29/heldout2-149-verdicts.json`, `heldout2-149-batches/batch-1.json` to `batch-11.json` | Blind, on heldout2 and the PR #29 iterations (`scripts/pr29/judge-round2.js`) | PR #29 | 228; 2,526 verdicts |
| `verdicts/pr29/heldout2-149-new-verdicts.json`, `heldout2-149-new-batches/batch-1.json`, `batch-2.json` | Verses new in later iterations (`judge-round2-b.js` with `{"dir": "j5", "n": 2}`) | PR #29 | 99; 446 verdicts |
| `verdicts/pr29/set3-149-verdicts.json`, `set3-149-batches/batch-1.json` to `batch-8.json` | Blind on set3 (`judge-round2-b.js` with `{"dir": "j6", "n": 8}`) | PR #29 | 153; 1,643 verdicts |
| `verdicts/pr29/heldout2-149-live.json`, `heldout2-149-new.json` | The live site after PR #28, and PR #29's final version | PR #29 | 149 each |
| `verdicts/pr29/set3-149-base.json`, `set3-149-new.json` | Live site and PR #29 | PR #29 | 149 each |
| `verdicts/pr29/dev-268-r5.json` | A PR #29 iteration run on dev-268: the chain or the gathered verses for each message. `rtscore.py` reads it as `r5-all.json`. | PR #29 | 268 |
| `verdicts/pr31/set4-150-verdicts.json`, `set4-150-batches/batch-1.json` to `batch-8.json` | Blind on set4 (`scripts/pr31/blind-judge-4.js`) | PR #31 | 144; 1,353 verdicts |
| `verdicts/pr31/set6-150-verdicts.json`, `set6-150-batches/batch-1.json` to `batch-8.json` | Blind on set6 (`blind-judge-6.js`) | PR #31 | 150; 1,745 verdicts |
| `verdicts/pr31/set4-150-base.json`, `set4-150-new.json`, `set6-150-base.json`, `set6-150-new.json` | Before and after | PR #31 | 150 each |
| `verdicts/pr32/set7-150-verdicts.json`, `set7-150-batches/batch-1.json` to `batch-8.json` | Blind on set7: live site, branch and route variants (`scripts/pr32/blind-judge-9.js`) | PR #32 | 150; 1,602 verdicts |
| `verdicts/pr32/set9-120-verdicts.json`, `set9-120-batches/batch-1.json` to `batch-8.json` | Blind on set9 (`blind-judge-9.js`). The 8 batches hold exactly the 1,265 pairs judged. | PR #32 | 117; 1,265 verdicts |
| `verdicts/pr32/gather-variants-verdicts.json`, `gather-variants-batches/batch-1.json` to `batch-12.json` | Verses not yet judged from gather variants A to C and route variants (`judge10.js`) | PR #32 | 257; 1,592 verdicts |
| `verdicts/pr32/gather-variants-new-verdicts.json`, `gather-variants-new-batches/batch-1.json` to `batch-10.json` | The same for gather variants E to G | PR #32 | 208; 832 verdicts |
| `verdicts/pr32/chains-verdicts.json`, `chains-batches/batch-1.json` to `batch-3.json` | Chains in `chains-run.json` | PR #32 | 27; 155 verdicts |
| `verdicts/pr32/set7-150-live.json`, `-new.json`, `-new-w.json`, `-new-x.json` | Live site and three branch route variants on set7 | PR #32 | 150 each |
| `verdicts/pr32/set9-120-live.json`, `-new.json`, `-new-w.json`, `-new-x.json` | The same on set9 | PR #32 | 120 each |
| `verdicts/pr32/set97-gather-A.json`, `-B`, `-C`, `-E`, `-F`, `-G` | Every set97 message gathered (`run4.cjs`), six gather variants set through `LEAN`: A the default; B `{"meant": 0, "floor": 0.5}` and C `{"meant": 0, "floor": 1}`, where the floor raised each of the top 3 meanings; then, after a change that let the floor raise only the likeliest meaning, E `{"floor": 1}`, F `{"floor": 1, "meant": 0}` and G `{"floor": 2}` | PR #32 | 270 each |
| `verdicts/pr32/chains-run.json` | Chains of named answers for message and answer pairs not yet judged | PR #32 | 28 |
| `verdicts/pr32/set97-final.json` | PR #32's final version | PR #32 | 270 |
| `verdicts/pr32/set97-rt.json`, `set97-rt-w.json`, `set97-rt-x.json` | Router and matcher views of set97. MEANT was chosen on x. | PR #32 | 270 each |
| `verdicts/pr32/crazy-177-live.json`, `crazy-177-new.json` | Live site and branch on crazy-177. Their verdicts are left out (see below). | PR #32 development | 177 each |
| `verdicts/pr34/set97-nn-verdicts.json`, `set97-nn-batches/batch-1.json` to `batch-3.json` | Blind on verses new in `set97-nn.json` | PR #34 | 100; 247 verdicts |
| `verdicts/pr34/set97-nn.json` | PR #34 (nearest-example blend) | PR #34 | 270 |
| `verdicts/pr40/blind-269-verdicts-1.json`, `blind-269-verdicts-2.json` | Blind, base and branch mixed, judged in two parts | PR #40 | 135 and 132; 2,448 verdicts |
| `verdicts/pr40/blind-269-batches-1/batch-1.json` to `batch-5.json`, `blind-269-batches-2/batch-1.json` to `batch-5.json` | The batches of the two parts (1,258 and 1,190 pairs, exactly the pairs judged). Together they were the folder `r6/jb`, batches 1 to 10. | PR #40 | 135 and 132 |
| `verdicts/pr40/blind-269-base.json`, `blind-269-new.json` | Main `877dae7` and the branch | PR #40 | 269 each |
| `verdicts/pr41/show-fit-verdicts.json`, `show-fit-batches/batch-1.json` to `batch-25.json` | The verdicts SHOW was fitted on: for each dev message that falls to gathering, the top 10 then shown and the first 3 parts of the 5 nearest chains | PR #41 | 271; 6,134 verdicts (1,229 answers, 2,019 related, 2,886 off) of 6,135 verses |
| `verdicts/pr41/devq-813-features.json.gz` | Every gathered candidate with its ranking features, words and context. `fit.py` reads it. | PR #41 | 813 (271 gathered); 28,080 candidates |
| `verdicts/pr41/dev-271-features.json.gz` | The same features for the 271 gathered messages, joined to their verdicts, without words and context | PR #41 | 271 |
| `verdicts/pr41/devq-813-new.json.gz` | The SHOW branch on devq-813 | PR #41 | 813 |
| `verdicts/pr41/blind-fresh-299-verdicts.json`, `blind-fresh-299-batches/batch-1.json` to `batch-8.json` | Blind, first 6 shown of base and branch | PR #41 | 298; 2,241 verdicts |
| `verdicts/pr41/blind-fresh-299-base.json`, `blind-fresh-299-new.json` | Main `ab53468` and the SHOW branch | PR #41 | 299 each |
| `verdicts/pr43/blind-fresh9-300-verdicts.json`, `blind-fresh9-300-batches/batch-1.json` to `batch-12.json` | Blind, first 6 shown of base and branch | PR #43 | 300; 2,448 verdicts |
| `verdicts/pr43/blind-fresh9-300-base.json`, `blind-fresh9-300-new.json` | Main `16af21d` and the branch | PR #43 | 300 each |
| `verdicts/r9/blind-fresh10-305-verdicts.json`, `blind-fresh10-305-batches/batch-1.json` to `batch-12.json` | Blind, first 6 shown of base and branch | r9 | 305; 2,551 verdicts (538 answers, 1,002 related, 1,011 off) |
| `verdicts/r9/blind-fresh10-305-base.json`, `blind-fresh10-305-new.json` | Main `a46d819` and the branch | r9 | 305 each |
| `verdicts/r10/blind-fresh10-305-4bit.json` | The branch at `0ecdeb5` run again on blind-fresh10. 294 of the first 6 verses it shows were never judged, so it cannot be scored in full. | r10 | 305 |
| `verdicts/r11/blind-fresh11-312-verdicts.json`, `blind-fresh11-312-batches/batch-1.json` to `batch-8.json` | Blind, first 6 shown of base and branch (`judge10.js`). One of the 2,547 pairs in the batches has no verdict. | r11 | 312; 2,546 verdicts (468 answers, 1,027 related, 1,051 off) |
| `verdicts/r11/blind-fresh11-312-base.json`, `blind-fresh11-312-new.json` | Main `b466ab6` and the branch at `7d1c403` | r11 | 312 each |
| `verdicts/r11/blind-fresh11-312-diff-48.json`, `-diff-rt-base.json`, `-diff-rt-new.json` | The messages where what opens differs (24 open a prepared answer only on main, 22 only on the branch, 2 open different answers), and the router view of each side for them (`rt10.cjs`) | r11 | 48 each |

### scripts/

| Path | What it is | Round |
|---|---|---|
| `scripts/pr28/run.cjs` | Browser runner, early format: a chain, or the top K gathered verses with context | PR #28, #29 |
| `scripts/pr28/live-judge.js` | Judging Workflow (`ask-live-judge`) that made `dev-268-verdicts.json`: chain fit, verdicts, the Bible's words for modern words, Nave's subjects and target verses. It uses `find.py` and `naves.py`. | PR #28 |
| `scripts/pr28/live-judge-2.js` | Judging Workflow (`ask-live-judge-2`) that made `dev-268-new-verdicts.json` | PR #28 |
| `scripts/pr28/heldout-judge.js` | Judging Workflow of the first blind round (`heldout-120-verdicts.json`) | PR #28 |
| `scripts/pr28/batches.py`, `score.py` | Blind mixer and scorer for the early format | PR #28, #29 |
| `scripts/pr29/fresh.js` | Writer Workflow (`ask-fresh-questions`) for heldout2-149 | PR #29 |
| `scripts/pr29/fresh3.js` | Writer Workflow (`ask-fresh-questions-3`) for set3-149 and, run again, set4-150 | PR #29, #31 |
| `scripts/pr29/judge-round2.js`, `judge-round2-b.js` | Judging Workflow (`ask-judge-round2`): the first version made `heldout2-149-verdicts.json`; the second, which takes `dir` and `n`, made `heldout2-149-new-verdicts.json` and `set3-149-verdicts.json` | PR #29 |
| `scripts/pr29/cmp.py` | Compares two runs message by message, worst changes first | PR #29 |
| `scripts/pr31/fresh5.js`, `fresh6.js` | Writer Workflows (`ask-fresh-questions-5` and `-6`) for set5-225 and set6-150 | PR #31 |
| `scripts/pr31/blind-judge-4.js`, `blind-judge-6.js` | Judging Workflows (`ask-blind-judge-4` and `-6`) for `set4-150-verdicts.json` and `set6-150-verdicts.json` | PR #31 |
| `scripts/pr31/route-labels.js`, `route-labels-2.js` | Labelling Workflow (`ask-route-labels`): fits, near or no for each message's candidate answers. The first version ran batches l1 to l10; the second takes `batches` and ran m1 to m4 and n1 to n3. Together they made `dev-682-and-set5-225-labels.json`, the labels behind OPEN. | PR #31 |
| `scripts/pr31/oracle-pick.js` | Labelling Workflow (`ask-oracle-pick`) for `set5-225-oracle-labels.json`, from all 663 answers | PR #31 |
| `scripts/pr31/rt.cjs`, `tt.cjs` | Router view of each message; router terms for every phrasing and message | PR #31, #32 |
| `scripts/pr31/batches4.py`, `score9.py` | Blind mixer and scorer for the "shown" format (chain or gathered) | PR #31, #32 |
| `scripts/pr31/rtscore.py`, `tune.py`, `tune2.py` | OPEN checks and grids against labels. `rtscore.py` takes a router view (for example `rt-all.json`) and reads `r5-all.json`. | PR #31 |
| `scripts/pr31/router.py`, `evalr.py`, `feats.py`, `fit.py`, `bm.py` | OPEN refit with signals: a Python copy of `route.ts`, the label scorer, a feature dump, a threshold grid and a BM25 baseline. Run `feats.py` (it reads `tt-sig.json` and writes `feats.pkl`), then `fit.py`. | PR #31 |
| `scripts/pr32/run2.cjs` | The browser runner of every blind round since: help line, exact, routed or gathered, and up to 8 verses with words and context. `LEAN` and `OPEN` can be set from the environment. | PR #32 to r11 |
| `scripts/pr32/run3.cjs`, `run4.cjs` | run2 for a named answer's chain, and run2 with every message gathered | PR #32 |
| `scripts/pr32/batches5.py` | Blind mixer for the first 8 shown verses, skipping verses already judged | PR #32 to #40 |
| `scripts/pr32/judge10.js` | Judging Workflow (`ask-blind-judge-10`): each shown verse in context gets answers, related or off | PR #32 to r11 |
| `scripts/pr32/blind-judge-9.js` | Judging Workflow (`ask-blind-judge-9`) for `set7-150-verdicts.json` (`{"dir": ".../eval2/j9"}`) and `set9-120-verdicts.json` (`{"dir": ".../crazy9/j"}`) | PR #32 |
| `scripts/pr32/fresh7.js` | Writer Workflow (`ask-fresh-questions-7`) for set7-150 | PR #32 |
| `scripts/pr32/cls_prep.py`, `tok.cjs`, `cls.py`, `lr.py`, `knn.py`, `mx.mjs`, `mev.py`, `combo.py` | Meaning matcher experiments that chose the softmax matcher and PR #32's MEANT 0.7 and UNMEANT 0.05 | PR #32 |
| `scripts/pr32/combo2.py`, `combo3.py`, `combo4.py`, `thr.py`, `offwhy.py` | Route rule, MEANT and gather variant scored on set97 from the verdicts (LEAN and MEANT); opens by likelihood; words quoted in "off" reasons. The combo scripts take two arguments, the scratchpad and tasks folders: `python3 combo4.py $ASK_WORK/scratchpad $ASK_WORK/tasks`. | PR #32 |
| `scripts/pr32/keep.mjs` | How harder pruning of the matcher's weights changes size and opens | PR #32 |
| `scripts/pr32/crazy.js`, `crazy-score.py` | Writer Workflow (`ask-crazy-questions`) for 120 of crazy-177, and the crazy round's scorer | PR #32 |
| `scripts/pr32/crazy2.js` | The same writer (`ask-crazy-questions-2`) run with the crazy9 folder and `seen9.txt`, for set9-120 | PR #32 |
| `scripts/pr34/gen.js`, `prep.py` | Writer Workflow (`ask-r6-questions`) for pool-1096, dev2-545 and blind-269, and the check that removes repeats of earlier sets, examples and phrasings | PR #34, #40 |
| `scripts/pr34/obatch.py`, `oracle.js` | Labelling batches (each message with up to 10 candidate answers) and the labelling Workflow, from all 871 answers | PR #34 |
| `scripts/pr34/policy2.py` | MEANT sweep on the pool labels (MEANT 0.4, UNMEANT 0.15) | PR #34 |
| `scripts/pr34/knn.mjs`, `knn-b.log` | Held-out fit of the nearest-example blend (K 30, power 3, half and half), and its results | PR #34 |
| `scripts/pr34/cal2.mjs`, `cal2-a.log`, `score.mjs` | Held-out fit of the matcher's training settings, its results, and a top-3 scorer | PR #34 |
| `scripts/pr40/rt6.cjs`, `pol.py` | Router view with top N meanings; MEANT sweep at UNMEANT 0.15 that chose MEANT 0.35 | PR #40, #43 |
| `scripts/pr40/oracle2.js` | Labelling Workflow for dev2, from all 1,224 answers | PR #40 |
| `scripts/pr40/score.py`, `diffq.py` | Blind scorer for blind-269, and how each message moved | PR #40 |
| `scripts/pr41/fresh8.js` | Writer Workflow (`ask-fresh-questions-8`) for blind-fresh-299 | PR #41 |
| `scripts/pr41/fx.cjs`, `gather_x.ts` | Feature export of every gathered candidate. `gather_x.ts` is an uncommitted copy of `gather.ts` that `fx.cjs` imports. | PR #41 |
| `scripts/pr41/fit.py`, `fit3.py`, `coef.py` | The SHOW fit: two logistic models over 41 features with 5-fold cross-validation, then the 6-feature weights | PR #41 |
| `scripts/pr41/fit2.py`, `cut.py`, `err.py`, `div.py`, `mix.py` | SHOW alternatives tried and rejected | PR #41 |
| `scripts/pr41/batches6.py`, `score.py` | Blind mixer for the first 6 shown verses, and the blind-fresh scorer. `batches6.py`'s docstring still calls it `batches5.py`. | PR #41 to r11 |
| `scripts/pr43/pol8.py` | Routing scores with the labels that know the 360 new answers | PR #43 |
| `scripts/pr43/relabel.js` | Labelling Workflow (`ask-relabel-new-answers`) for `new-answers-relabel/`, which `pol8.py`, `pol9.py` and `pol10.py` read | PR #43 |
| `scripts/pr43/rt7.cjs`, `both.sh` | Router view with NEAR set from the environment, and the NEAR grid driver | PR #43 |
| `scripts/pr43/fresh9.js` | Writer Workflow (`ask-fresh-questions-9`) for blind-fresh9: three kinds of messages in two voices | PR #43 |
| `scripts/pr43/oracle3.js`, `score9.py` | Labelling Workflow for blind-fresh, and the blind-fresh9 scorer | PR #41 to #43 |
| `scripts/r9/rt8.cjs`, `pol9.py`, `grid.sh` | Router view with `NEAR` and `MODELP` (JSON) set from the environment and an optional third argument naming an `index.json`; the open threshold scorer that chose MEANT.model 0.25 (its docstring still calls it `pol8.py`); the MODEL grid driver | r9 |
| `scripts/r9/emb.mjs` | WordPiece tokenizer and mean-pooled potion-base-8M vectors | r9 |
| `scripts/r9/proto.mjs` to `proto4.mjs`, `proto1.log` to `proto4.log` | The model alone and blended (k, power, share); int8 against PCA and prototypes; only the word pieces the examples use; 128-bit codes with rerank 300. Each log is its script's output. | r9 |
| `scripts/r9/fresh10.js` | Writer Workflow (`ask-fresh-questions-10`) for dev4-594 and blind-fresh10-305: 3 kinds, 2 voices and 3 angles, 50 messages each | r9 |
| `scripts/r9/oracle.js`, `score10.py` | Labelling Workflow for dev4 and blind-fresh9, from all 1,584 answers, and the blind-fresh10 scorer | r9 |
| `scripts/r10/rt10.cjs` | `rt8.cjs` that also records whether the model voted (`used`) | r10, r11 |
| `scripts/r10/pol10.py` | Open threshold scorer on dev2, dev3 (blind-fresh) and dev4 (dev4 with blind-fresh9): the matcher opens at `HM` when the model voted and `HW` when not | r10 |
| `scripts/r10/bench.mjs`, `bench.log` | The model's own vote with the vectors stored as 32, 8 or 4 bits, all pieces or only those the examples use. It chose 4 bits for every piece. | r10 |
| `scripts/r10/rerank.mjs`, `rerank.log` | The model's own vote at rerank 300, 1,000 and 3,000, read from the built `model.bin`. It chose 1,000. | r10 |
| `scripts/r10/score10b.py`, `rt10.log`, `rt1000.log` | `score10.py` with the 4-bit run added; the routed counts of the two sets of router views | r10 |
| `scripts/r11/fresh11.js` | Writer Workflow (`ask-fresh-questions-11`) for blind-fresh11-312: six writers, 52 messages each | r11 |
| `scripts/r11/score11.py` | The blind-fresh11 scorer: `score10.py` with the r11 names, and how many differing messages each side won | r11 |
| `scripts/tools/verse.py`, `bible.py`, `find.py`, `naves.py` | Print the BSB text of references; find BSB verses by word; look up Nave's Topical Bible subjects (from the pinned `bible-data` copy that `make data` fetches). The judging Workflows call them. | PR #28 to r11 |
| `scripts/tools/workdir.py` | Rebuilds the working folder the scripts were written in (next section) | none |

## Running the scripts

The scripts were copied as they were, with one kind of change: their container paths now come from the environment or from Workflow arguments.

- `ASK_WORK`: the working folder that `workdir.py` makes. It holds `scratchpad/` and `tasks/`, laid out as when the rounds were run.
- `ATLAS_REPO`: a clone of Bible Atlas with `make data` and `make wasm` run.
- `PLAYWRIGHT`: the Playwright package, for the browser runners. It defaults to `playwright`.
- The Workflow scripts take the absolute paths as arguments, each only what it reads:
  - `{"work"}`: every writer (`fresh.js`, `fresh3.js`, `fresh5.js` to `fresh11.js`, `crazy.js`, `crazy2.js`), `oracle-pick.js` and `route-labels.js`; `route-labels-2.js` also takes `batches`.
  - `{"work", "repo"}`: `heldout-judge.js`, `live-judge.js`, `live-judge-2.js`, `judge-round2.js`, `blind-judge-4.js` and `blind-judge-6.js`; `judge-round2-b.js` also takes `dir` (a folder name under `eval2/`) and `n`.
  - `{"dir", "n", "repo"}`: `judge10.js`; `{"dir", "repo"}`: `blind-judge-9.js`. Here `dir` is the absolute path of the batch folder.
  - `{"work", "batches"}`: `scripts/pr34/oracle.js`; `{"work", "repo", "batches"}`: `oracle2.js`, `oracle3.js`, `r9/oracle.js` and `relabel.js`.
  - `{"blind", "n"}`: `gen.js`, which reads no file.
  - `repo` is a clone of Bible Atlas that holds this folder: the judges run `scripts/tools/verse.py` from `<repo>/eval/ask/scripts/tools`.

`scripts/tools/bible.py` reads the app's own text from `$ATLAS_REPO/web/public/data/text` (or `BSB_TEXT`), and its `ATLAS_REPO` defaults to the clone that holds it. The old copy of that text it was used with had verse text identical to the build's in all 66 books.

Every other file name inside the scripts is the old name, relative to the old folder. So build the working folder first:

```
python3 eval/ask/scripts/tools/workdir.py              # writes eval/ask/work/, which git ignores
export ASK_WORK=$PWD/eval/ask/work ATLAS_REPO=$PWD
export PLAYWRIGHT=$(npm root -g)/playwright            # only for the browser runners
```

It checks every sha256, unpacks the `.gz` files, and writes each verdict file as `tasks/<id>.output` the way the scorers read it. `manifest.json` gives each file's old name. Then run a script from its old folder, for example `cd $ASK_WORK/scratchpad/r9 && python3 score10.py whv9b29zp`.

### A blind yes or no

1. **Write a fresh set.** `scripts/r11/fresh11.js` is the latest writer Workflow. It reads `$ASK_WORK/scratchpad/r11/seen11.txt` and its prompt says that file has 4,619 lines: copy `sets/seen12-5374.txt` there (or change the name in the script) and change the count in the prompt. Run it with `{"work": "<ASK_WORK>"}` and save the result.
2. **Remove repeats.** `prep.py` takes no paths. Copy `sets/seen12-5374.txt` to `$ASK_WORK/scratchpad/r6/seen.txt`, save the writer's questions as a JSON list in `$ASK_WORK/scratchpad/r6/blind-raw.json` (for example `python3 -c "import json,sys; json.dump(json.load(open(sys.argv[1]))['result']['questions'], open(sys.argv[2], 'w'))" <result>.output $ASK_WORK/scratchpad/r6/blind-raw.json`), then run `cd $ASK_WORK/scratchpad/r6 && python3 prep.py blind`. It drops every message already in the seen list, in `config/ask-examples.json`, in `config/questions.json` or in `r6/pool.json`, and repeats within the new set, and writes `r6/blind.json`, which overwrites the working copy of blind-269. Add the new set's lines to the seen list.
3. **Serve both versions on the same day.** Make two worktrees, one on `main` and one on the branch. In each, run `make data`, `make wasm` and `npm ci` in `web/`. Start a dev server in each: `npx vite --port 5191 --strictPort` for main and `--port 5192` for the branch. (r11 used the other ports: 5192 for main and 5191 for the branch.)
4. **Run the box on every message.** `PORT=5191 node eval/ask/scripts/pr32/run2.cjs <set>.json base.json`, then the same with `PORT=5192` into `new.json`.
5. **Mix the verses blind.** `echo '[]' > none.json` and `python3 eval/ask/scripts/pr41/batches6.py <batch folder> 12 none.json base.json new.json`. Each batch lists each message with the union of the first 6 verses both versions showed, in reference order, with no mark of which version showed which.
6. **Judge.** Run `scripts/pr32/judge10.js` as a Workflow with `{"dir": "<batch folder>", "n": 12, "repo": "<ATLAS_REPO>"}`. Every verse gets answers, related or off, read in its context. Save the result.
7. **Score.** `scripts/r11/score11.py`, `scripts/r9/score10.py`, `scripts/pr43/score9.py`, `scripts/pr41/score.py` and `scripts/pr40/score.py` are the same scorer with different run names. Copy one and change the names. It counts messages with an answering verse among the first 6 shown, off verses and answering verses, split into routed and gathered.
8. **Decide once.** After the verdicts are read the set is seen. Record the numbers in the table below.

### Dev labels and the open thresholds

1. Router view: `PORT=5191 TOPN=3 MTOP=3 node eval/ask/scripts/r10/rt10.cjs eval/ask/labels/r10/dev2-545-questions.json rt.json` (the r10 runs), or `TOPN=5 MTOP=8` with `scripts/r9/rt8.cjs` as in r9.
2. Labels, only for a new dev set: `scripts/pr34/obatch.py <rt.json> 50` reads `$ASK_WORK/scratchpad/r6/<rt.json>` and `r6/titles.txt` (id, a tab and the title of each answer in `config/questions.json`) and writes `r6/o-1.json` and on. `scripts/r9/oracle.js` reads `r9/lab/o-<i>.json` and `r9/lab/titles.txt`, so copy them there, then run it as a Workflow with `{"work": "<ASK_WORK>", "repo": "<ATLAS_REPO>", "batches": [1, 2, ...]}`. Its prompt names 1,584 answers, the count in `config/questions.json` at `b466ab6` and `f5a0f44`; change it when that count changes.
3. Score: `cd $ASK_WORK/scratchpad/r10 && HM=0.25 python3 pol10.py dev2 rt1000-dev2.json` (use `dev3` with the blind-fresh views and `dev4` with the dev4 and blind-fresh9 views). `r8/pol9.py`, `pol8.py` and `pol.py` are the earlier versions; `cd $ASK_WORK/scratchpad && HI=0.25 LR=1:0 python3 r8/pol9.py dev2 <rt.json>` gives the r9 numbers.

### SHOW

`cd $ASK_WORK/scratchpad/g7 && python3 coef.py` prints SHOW's weights. To remake the features, copy `scripts/pr41/gather_x.ts` to `web/src/ui/ask/gather_x.ts` in a checkout of `ab53468`, the commit before SHOW (`42bb301`): it is that commit's `gather.ts` plus the export code. Do not commit it. Serve that checkout and run `node eval/ask/scripts/pr41/fx.cjs eval/ask/sets/devq-813.json fx-dev.json`. On a later `main` the copy no longer fits `gather.ts`.

### The word-meaning model

`proto.mjs` to `proto4.mjs` read the model from `$ASK_WORK/scratchpad/model/m`. Put `tokenizer.json` and `model.safetensors` there from branch `mirror/potion-base-8M` (commit `dced885a21af0bfd69eaf34f214c9d2160d8b733`).

`scripts/r10/bench.mjs` and `rerank.mjs` load `web/src/ui/ask/pieces.ts` through Vite and read `$ATLAS_REPO/web/public/data/ask/` (`index.json`, `also.json`, `model.bin`) as built by `web/scripts/ask-meaning.mjs`, so build the branch first; `bench.mjs` also reads the model through `ask-meaning.mjs`. Both read the labels from `$ASK_WORK`.

### Checked when this folder was made

On 2026-10-21 these were rerun from a working folder rebuilt by `workdir.py`, and they gave the recorded numbers:

- `score10.py`: answered 171 to 178 of 305, off 652 to 630 of 1,825, answering verses 413 to 447.
- `scripts/pr43/score9.py`: 160 to 181, off 634 to 576. `scripts/pr41/score.py`: 143 to 147, off 747 to 684. `scripts/pr40/score.py`: 204 to 209, off 379 to 363.
- `coef.py`: SHOW's weights exactly (mp 5.8, mn 2.3, text 1, closest 1.2, xBest 0.7, teach 1.9).
- `combo4.py`: 152 of 270 answered and 585 off at MEANT 0.7.
- `policy2.py`: 390 right and 45 wrong before PR #34; 442 right and 45 wrong at MEANT 0.4 with UNMEANT 0.15.
- `pol.py` on dev2: right opens 236 to 297, wrong 19 to 14, top-3 fits 393 to 452. `pol8.py`: 297 to 308, wrong 14 to 15.
- `pol9.py`: dev2 right first pick 396 to 422, right opens 308 to 366, wrong 19 to 17; blind-fresh right opens 142 to 151, wrong 12 to 5.

On 2026-10-22, after the r10 and r11 files were added, from a new working folder:

- `score11.py wqzj14x8c`: the r11 numbers in the table below. `score10b.py whv9b29zp`: the r9 numbers again, and 294 unjudged verses for the 4-bit run.
- `pol10.py` with `HM=0.25`: the r10 numbers in the table below.
- `rtscore.py rt-all.json` runs with `r5-all.json`, and `feats.py` then `fit.py` run with `tt-sig.json`.
- All 107,891 shown and text fields and 670,433 context lines in the runs and batches match the BSB text of the app's build, exactly or as one unbroken part. The one apparent exception, Acts 8:36-38, spans the BSB's empty verse 37 and is BSB. The 28,080 feature words were checked the same way on 2026-10-21.

## Results by round

From `docs/handoff/map-ask.md` section 4 and the notes kept with these files. "Answered" counts messages with at least one answering verse among the first verses shown. "Off" counts verses.

| Round | Set | Result |
|---|---|---|
| PR #28 | 268 tuning questions judged in context; 120 fresh questions judged blind old vs new | top-8 answering 19% to 31%, off 42% to 26%; fresh: answering verses 96 to 125, 22 better, 8 worse; right chain opens 94 to 153 of 268 |
| PR #29 | 149 never-seen questions (75 faith, 74 life statements) and 149 earlier | never-seen: answering 74 to 90, off 843 to 745, questions answered 46 to 50; only 8 of 74 statements answered |
| PR #31 | 150 untuned (50 statements, 50 practical, 50 Bible); router thresholds on 682 earlier questions | answering 78 to 153, off 763 to 607, answered 36 to 60; of 431 judged opens, 353 fit, 73 near, 5 wrong |
| PR #32 (5763dc3) | 270 never-seen, blind | answered (first 6) 116 to 152, off 828 to 581 |
| PR #34 (ce2b097) | 1,096 labelled messages before they joined the examples | right opens 390 to 442, wrong 45 to 45; 270 test: 152 vs 151 answered, off 584 vs 569 |
| PR #40 | 269 held-out, blind, main and branch same day; 545 labelled dev messages (tuning) | answered 204 to 209, off 379 to 363; off share prepared 9% to 7%, gathered 39% to 40%; dev: right opens 236 to 297, wrong 19 to 14, top-3 fits 393 to 452 |
| PR #41 | 299 fresh, blind; SHOW fit on 6,134 judged verses for 271 tuning messages | answered 143 to 147, off 747 to 684; gathered 75 to 79 of 191 answered, off share 53% to 48%; prepared 22% off |
| PR #43 | 300 never-seen, blind vs main; 545 dev messages | answered 160 to 181, off 634 of 1,800 to 576 of 1,798; dev right opens 297 to 308, wrong 14 to 15 |
| r9, not merged | blind-fresh10, 305 never-seen, blind, main `a46d819` against the branch the same day; dev2 and blind-fresh as dev | answered 171 to 178 of 305, off 652 to 630 of 1,825, answering verses 413 to 447; off share routed 19% to 14%, gathered 46% to 47%; dev2 right first pick 396 to 422, right opens 308 to 366, wrong 19 to 17; blind-fresh right opens 142 to 151, wrong 12 to 5 |
| r10, not merged | 1,493 labelled messages with a fitting answer (530 dev2, 295 blind-fresh, 668 dev4 and blind-fresh9) | 4 bits for every piece: the model's own first pick right for 785, against 773 with full 32-bit vectors (`bench.log`); rerank 1,000: first pick 766 to 783, top three 929 to 952 (`rerank.log`); routing at 0.25 (`pol10.py`), rerank 300 to 1,000: dev2 364 right and 19 wrong both times (408 and 409 opens), blind-fresh 154 to 156 right and 4 to 3 wrong, dev4 and blind-fresh9 202 to 207 right and 46 to 43 wrong |
| r11, not merged | blind-fresh11, 312 never-seen, blind, main `b466ab6` against the branch at `7d1c403` the same day | answered 163 to 164 of 312, off 737 of 1,871 to 683 of 1,869, answering verses 365 to 386; routed 113 to 111 (off 23% to 24%), gathered 199 to 201 (off 48% to 44%); of the messages where the two differ, the branch did better on 88 and main on 55 |
| r11 dev, not merged | The three labelled dev lists (545 dev2, 298 blind-fresh, 894 dev4 and blind-fresh9; seen, so tuning only), main `b466ab6` against the branch at `f5a0f44` on 2026-10-22 (`pol10.py`, `HM=0.25`) | right opens 308 to 363, 141 to 156 and 189 to 207 (638 to 726 in all); wrong opens 15 to 19, 8 to 3 and 70 to 42 (93 to 64); opens 343 to 408, 177 to 177 and 330 to 320; the matcher's first pick fits 390 to 422, 171 to 183 and 281 to 318 |

Notes on the rounds:

- PR #32: routed answers were about 17% off and gathered answers about 47% off. 89% of the 6 gathered verses shown came from the chains of the matcher's top 3 meanings (LEAN in `gather.ts`), so most off verses are chains of the wrong meaning.
- PR #32's off count: the PR says 581. Rerunning the scorer on `set97-final.json` gives 584, and `combo4.py` gives 585.
- PR #41: within the judged pool, the best possible order would have answered 246 messages with 61 off, so meaning at the level of single verses is the remaining gap. blind-fresh is harder than blind-269: 64% of it falls to gathering.
- PR #43: routed 21% to 19% off, gathered 43% to 40% off. 27 messages opened a new answer and 16 of them answered. Two misroutes to note: a Numbers 31 question opened a dating answer, and "are israelites hebrews jews the same" opened the Black Hebrew Israelite answer. Adding examples to old answers alone gave nothing.
- r11: the commands that day were `PORT=5192 node run2.cjs r11/blind-fresh11.json r11/bf11-main.json` (main, in a worktree at `b466ab6`) and `PORT=5191 ... r11/bf11-branch.json` (the branch), then `python3 g7/batches6.py r11/batches 8 r11/none.json r11/bf11-main.json r11/bf11-branch.json`, then `judge10.js` with `{"dir": ".../r11/batches", "n": 8}`. One verse the branch shows has no verdict. 48 messages differ in what opens: 24 open a prepared answer only on main, 22 only on the branch, and 2 open different answers.
- Earlier notes called dev-268 "the blind set of PR #32". It was the tuning set of PR #28 and #29. PR #32's blind set is set97: set9 followed by set7.

## Left out on purpose

- **Every comparison with other websites' answers.** Some rounds compared the box with the answers of two outside question-and-answer sites, the ones the repository's `CLAUDE.md` names as for internal comparison only. By rule nothing from those or any other website's answers is in this repository. So the crazy round's verdicts, its judging Workflow, the audit of chains against outside references, and every file that held those sites' answers or links are left out. `crazy-177-live.json`, `crazy-177-new.json` and `crazy-score.py` are kept, but the round cannot be rescored from here.
- **Licensed Bible text.** No ESV or NET text is in this folder. All verse text is BSB, from the app's own build. The ESV is named only in the scripts' instructions never to use or quote it.
- **Copies.** Byte twins of files kept here, drafts, four partial copies of the blind-fresh10 verdicts, and for r11 the partial judging run (`whnxbunq6`, 4 of 8 batches) and the judges' own work files. All 855 verdicts in the blind-fresh10 partial copies, and all 1,261 in the r11 partial run, are the same as in the full verdicts. Also `r10/rt-dev4-594.json`, which is the 594 dev4 rows of `rt-dev4.json`, and `r10/rtpr-branch-*.json`, byte twins of the rerank 1000 views.
- **Things the scripts can remake.** The labelling input batches (`o-N.json`) and `titles.txt`, which come from `config/questions.json`; the matcher training dumps (`cls-*.json`, `feats.pkl`, `lr-model.pkl`); the older seen lists, which `seen12-5374.txt` contains (prep.py's own `r6/seen.txt` also held the examples and phrasings); the potion-base-8M files, which are pinned on `mirror/potion-base-8M`.
- **Runs of little value now.** The PR #43 runs with extra examples added to old answers (`g7/rt-dev2-ex.json`, `rt-fresh-ex.json`, `nr-d-ex30s7.json`, `nr-d-ex60.json`, `nr-d-ex60s7.json` and the `nr-f-` set): they were made with 14,664 written examples that were put back and never committed, so they cannot be rerun; on dev2 right opens were 297 before and 296 with them. Also the PR #31 LEAN runs on set5 that were never judged (`eval2/s5-lean3.json`, `s5-lean6.json`, `s5-nolean.json`), other matcher experiments (`keep/cal.mjs`, `keep/coll.mjs`), earlier r8 router views (`r8/rt-d2-model.json`, `rt-d3-model.json`, `rt-f9.json`), an earlier feature export (`g7/fx-dev-old.json`, 29.7 MB), and the browser-check screenshots of r10 (`r10/ui*/`).

## Gaps

- `tune.py` defaults to `labels-q1.json`, which `dev-682-and-set5-225-labels.json` contains. `cls_prep.py` reads example files that later became `config/ask-examples.json`.
- The scripts that ran the blind-fresh10 round are `run2.cjs`, `batches6.py` and `judge10.js`, but the exact commands of that day were not recorded.
