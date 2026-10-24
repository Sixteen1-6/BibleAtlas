export const meta = {
  name: 'r3-evidence-true-writers',
  description: 'Rewrite round 3 Layers evidence lines so each names the true writer under the true-credits rules, then check each rewrite',
  phases: [{ title: 'Rewrite' }, { title: 'Check' }],
}
const DIR = args.dir
const RULES = `
You are fixing the "evidence" lines of Bible Atlas Layers notes (config/layers.json shape) so they follow the true-credits rules merged in PR #63.
Each note's evidence is a short line (at most 400 characters) shown at Deep that says which writers state the note's point.

Rules:
1. Change only what each task's "why" list requires. Keep every other word as it is.
2. Name each writer as its "call_it" says. Barnes' Notes on most Old Testament books were written by other men: write "James G. Murphy (Barnes' Notes)" the first time, and the surname alone ("Murphy") after that in the same line. The same for Matthew Henry's continuators ("William Tong (Matthew Henry's Commentary)"), Poole's ("Richard Mayo (Poole's Annotations)", or "the continuation of Poole's Annotations" when the writer is unnamed) and the Concise Commentary on books it abridges from a continuator ("the Concise Commentary (abridging John Evans's continuation of Matthew Henry)"). Names such as Gill, Clarke, Keil and Delitzsch, Jamieson-Fausset-Brown (JFB), Ellicott, the Pulpit Commentary, Wesley, Benson, Calvin, Bengel, the Companion Bible and the Tyndale study notes stay as they are.
3. A dropped cite: take out what the evidence credits to that writer for that cite. If a sentence credits several writers, drop only that writer's name. Do not add any writer who is not in "kept".
4. The Pulpit Commentary, the NET Bible notes and the Reformation Study Bible are never quoted: where the evidence repeats five or more of their words in a row, give the same point in other plain words. Never put their words in quotation marks. Other writers' words may stay as they are.
5. Plain English. No em dashes, no en dashes as punctuation, no emoji, no semicolon chains longer than the original. At most 400 characters. Never name a scholar or work that is not in "kept" (the data sets STEPBible TAHOT, TAGNT, TBESH, TBESG and the BSB may stay where they already are; ancient texts such as the Septuagint may be named as witnesses).
6. Every claim must still match the kept writers' quotes (given in "quotes"). Do not strengthen a claim. Do not change the note's text or strength.
7. Never write the words "AI", "Claude" or anything about drafting tools.
Special task galatians-3-6 note 0 (the plain meaning): its only cite (Henry's Concise Commentary on Galatians) is gone, because the cite list names no writer for the Concise Commentary on Galatians. Choose, from the writers cited in galatians-3-6 note 1 (Gill, Clarke, Barnes and Wesley on Galatians 3:6), the one or two whose quotes state this plain meaning: "Paul points to Abraham, who believed God and was counted righteous because of his faith." Return them as new "cites" (source and on, exactly as note 1 has them), and write the evidence from their quotes. Leave galatians-3-6 note 1 to its own task.
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
          cites: { type: 'array', items: { type: 'object', properties: { source: { type: 'string' }, on: { type: 'string' } }, required: ['source', 'on'] } },
          changed: { type: 'string', description: 'one line: what was changed and why' },
        },
        required: ['passage', 'note', 'evidence', 'changed'],
      },
    },
  },
  required: ['results'],
}
const files = args.files
const done = await pipeline(
  files,
  (f) => agent(`${RULES}\nRead the tasks in ${DIR}/${f} (a JSON list; read it with the Read tool). For every task return the new evidence line (return it unchanged if no rule applies, and say so in "changed"). Count the characters of each line you return (you may use python3 -c "print(len(...))" in Bash) and keep it at 400 or fewer.`,
    { label: `rewrite ${f}`, phase: 'Rewrite', schema: OUT }),
  (r, f) => r && agent(`${RULES}\nYou are the checker. The tasks are in ${DIR}/${f}. A first writer proposed these lines:\n${JSON.stringify(r.results, null, 1)}\n\nCheck each proposal against the task (its "why" list, "kept" with "call_it" and "quotes", "dropped") and the rules. Fix anything wrong: a writer named wrongly, a dropped writer still credited, five or more words in a row repeated from the Pulpit Commentary, NET or Reformation Study Bible quotes, a claim the quotes do not support, more than 400 characters, an em dash, or any change the "why" list does not need. For galatians-3-6 note 0, check that each chosen cite's quote states the plain meaning. Return the final line for every task, with "changed" saying what you fixed (or "checked, no change").`,
    { label: `check ${f}`, phase: 'Check', schema: OUT }),
)
return done.filter(Boolean).flatMap(d => d.results)
