export const meta = {
  name: 'held-evidence-true-writers',
  description: 'Rewrite the evidence lines of the held wordplay notes so each names the true writer, drops left-out cites and paraphrases never-quoted works, then check each rewrite',
  phases: [{ title: 'Rewrite' }, { title: 'Check' }],
}
// args: { dir: <tc2/out/ev>, files: ["ev_000.json", ...] } (mk_ev2.py writes the files; collect_ev.py gathers the checked lines)
const DIR = args.dir
const RULES = `
You are fixing the "evidence" lines of Bible Atlas Layers notes. Each note's evidence is one short line (at most 400 characters) shown at Deep that says which Christian writers state the note's point. The tasks are a JSON list; each task gives the note's "text" and "strength" (never change these), its current "evidence", a "why" list of what must change, "kept" (the cites that stay, each with "call_it", "quotes" and "never_quote") and "dropped" (cites that are gone).

Rules:
1. Change only what the task's "why" list requires. Keep every other word as it is.
2. A "credit X" item: the line names a many-handed set (Barnes' Notes, Matthew Henry's Commentary, Poole's Annotations, Ellicott's Commentary, the Pulpit Commentary, Jamieson-Fausset-Brown, Keil and Delitzsch) without naming the man who wrote that book's comment. Name him as "call_it" gives it the first time, for example "E. B. Pusey (Barnes' Notes)", "A. R. Fausset (Jamieson-Fausset-Brown)", "W. J. Deane (Pulpit Commentary)", "F. Gardiner (Ellicott's Commentary)", and the surname alone after that in the same line ("Pusey"). For Poole's unnamed continuator write "the continuation of Poole's Annotations" (leave out the words in brackets in its call_it). Never credit a set's figurehead (Barnes, Henry, Poole, Ellicott, Jamieson) for another man's words. Names the "why" list does not mention stay as they are.
3. A "cite dropped" item: take out what the evidence credits to that cite. If a sentence credits several writers, drop only that one. Correct any count the removal makes wrong (for example "Five church fathers" when three remain). Never add a writer or work that is not in "kept".
4. A barred-name item (Origen, Tertullian, Lactantius and the like): take out every word that credits him, and say nothing about why.
5. A "repeats words" item, and every kept cite with "never_quote": true: those works (the Pulpit Commentary, the NET Bible notes, the Reformation Study Bible, and copyrighted modern writers such as Leithart, Bolt, Gladd, Sproul, Keener, Carson and Selvaggio) are never quoted. Give their point in your own plain words, so that no five words in a row of the line match five words in a row of that cite's "quotes" (ignore case and punctuation), and never put their words in quotation marks. Check this with a short python3 script in Bash before you return. Other writers' words may stay as they are.
6. Plain English. No em dashes, no en dashes as punctuation, no emoji. At most 400 characters (count with python3). Never name a scholar or work that is not in "kept" (the BSB and STEPBible data may stay where they already are; ancient texts such as the Septuagint may be named as witnesses).
7. Every claim must still match the kept cites' quotes. Do not strengthen a claim. If a paraphrase would lose the point, keep the point and change the wording.
8. Never write the words "AI", "Claude", "checked by" or anything about drafting tools.
`
const OUT = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          note: { type: 'integer' },
          evidence: { type: 'string' },
          changed: { type: 'string', description: 'one line: what was changed and why' },
        },
        required: ['passage', 'note', 'evidence', 'changed'],
      },
    },
  },
  required: ['results'],
}
const done = await pipeline(
  args.files,
  (f) => agent(`${RULES}\nRead the tasks in ${DIR}/${f} with the Read tool. For every task return the new evidence line, with "note" exactly as the task gives it. Run the five-word check and the length count in Bash for each line before returning.`,
    { label: `rewrite ${f}`, phase: 'Rewrite', schema: OUT }),
  (r, f) => r && agent(`${RULES}\nYou are the checker. The tasks are in ${DIR}/${f} (read it with the Read tool). A first writer proposed these lines:\n${JSON.stringify(r.results, null, 1)}\n\nCheck each proposal against its task and the rules: a set's writer named wrongly or not at all, a figurehead credited for another man's words, a dropped or barred writer still credited, a count left wrong, five or more words in a row repeated from a never-quoted cite's quotes (run the check in python3), a claim the quotes do not support, more than 400 characters, an em dash, or a change the "why" list does not need. Fix anything wrong. Return the final line for every task in the file, with "changed" saying what you fixed (or "checked, no change").`,
    { label: `check ${f}`, phase: 'Check', schema: OUT }),
)
return done.filter(Boolean).flatMap(d => d.results)
