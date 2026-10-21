# Wordplay thread tools

These are the scripts the Wordplay thread (a Claude cloud session in Shubhanshu's claude.ai project) used to find, write, check and hand over the Layers notes on wordplay, names, allusions and, from round 3, figures of speech, parallelism and character contrasts. They are kept here because CLAUDE.md asks that nothing important live only in a session's container.

They are a record of how the notes were made, not a supported tool. Paths inside them point at the session's scratch folder (`/tmp/claude-0/.../scratchpad/wp`) and at local copies of public-domain commentaries that are not in this repository. No data, source text or quotation store is committed here: the quote rows hold short quotations from copyrighted works (the NET notes, the Reformation Study Bible and others), which may be cited but not copied into the repository.

## How a note is made

1. **Leads.** `mine3.py` mines candidate verses from ten local believing commentaries (Gill, Clarke, Barnes, JFB, Keil and Delitzsch, Henry's concise commentary, Wesley, the Companion Bible, Figures of Speech, the Tyndale open study notes). `r3/figscan.py` and `r3/figcands.py` do the same for Bullinger's figures. A triage workflow keeps the leads worth writing up.
2. **Writing and checking.** `w3/write3.js` (a Workflow script) writes each note with its cites, then a skeptic, a fresh checker and a second reader check it. `workflows/held-second-writer-*.js` searches every citable work for a second writer for passages held on one writer. `w3/contrast.js` sweeps the narrative books for character contrasts that believing writers state.
3. **Quote checks.** `cq.py` (the local commentaries), `osn.py` (Tyndale study notes), `cat.py` (Catena Aurea) and `vw.py` (BSB wording, Hebrew and Greek) confirm every quotation verbatim before it is kept.
4. **Hand-off files.** `w3/post3.py` and `w3/apply_held.py` turn workflow results into `new-passages.json`, `additions.json`, `quotes.json` and `held-back.json`, re-checking each quote and capping each strength by its distinct writers. `finalize.py` assigns quote rows to notes. The Layers thread merges the files into `config/layers.json`; this thread never edits that file.

## Rules the tools enforce

- Cite only works in `config/layer-sources.json`, and never a name on its avoid list. Church fathers only from New Advent or CCEL translations.
- A writer is a distinct interpreter. Reference works (BSB, Tyndale House, Strong's, Abbott-Smith, Easton) do not count, and Bullinger's two works count once, as do Henry's two.
- A writer counts only when he states the point in his own voice on that verse. Bare cross-references and views he only reports do not count.
- Strength: 3 or more writers "widely agreed", 2 "commonly held", 1 "some interpreters".

`runs.txt` is the thread's run log, with every workflow run id and decision in order.
