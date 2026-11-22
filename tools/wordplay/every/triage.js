export const meta = {
  name: 'every-triage',
  description: 'Before writing a hand-off of figure notes, mark the candidates whose figure the BSB has translated away, so writers read only the ones that can become notes',
  phases: [{ title: 'Triage', detail: 'one reader per chunk of candidates: does the BSB keep the words that carry the figure?' }],
}

// args: { nn, files: [path of a JSON list of {n, ref, form, bsb, lead, words, others}, ...] }
const SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          verdict: { type: 'string', enum: ['keep', 'lost', 'unsure'] },
          bsb_words: { type: 'string', description: 'the BSB words that carry the figure (keep), or the BSB words that stand where the figure was (lost)' },
          reason: { type: 'string' },
        },
        required: ['n', 'verdict', 'bsb_words', 'reason'],
      },
    },
  },
  required: ['verdicts'],
}

const RULE = `Each candidate below is a place where E. W. Bullinger (Figures of Speech, 1898) names a figure (metonymy, synecdoche and the like) in the King James wording. Our notes show the figure in the BSB's own words: a note needs exact BSB words of that verse that carry the same figure. Writers drop a candidate when the BSB has translated the figure away, for example:
- Bullinger: "house" put for the family. BSB: "you and all your family". Lost: the BSB says the meaning outright.
- Bullinger: "her strength" put for the fruits. BSB: "it will no longer yield its produce to you". Lost.
- Bullinger: "the mouth of Pharaoh" put for his command. BSB: "as Pharaoh had instructed". Lost.
- Bullinger: "the whole earth" put for its people. BSB: "the whole world had one language". Keep: "the whole world" still stands for the people.
- Bullinger: "sin" put for a sin offering. BSB: "sin is crouching at your door". Keep (the word is there; whether the sense fits is the writer's call, not yours).

For each candidate give one verdict:
- lost: the BSB plainly has no word or phrase that carries this figure as Bullinger reads it, because it states the plain meaning instead, or leaves the words out. Name the BSB words that stand where the figure was.
- keep: some BSB words still carry the figure (the same word, or another word that is still a figure of the same kind for the same thing). Name them.
- unsure: anything else, including a Bullinger remark too short to tell which words he means, or a place where the figure might be in the BSB words but you cannot tell.

Be strict about "lost": a wrong "lost" removes a note for good, while a wrong "keep" only costs a writer's time. Judge only whether the BSB keeps the figure's words, not whether the figure is real, cited, or well chosen. Use only the text in the candidates file: read it with the Read tool and run no other tools. Answer for every candidate in it, by its n.`

phase('Triage')
const files = args.files
const results = await parallel(files.map((f, i) => () => agent(
  `${RULE}\n\nThe candidates file (hand-off ${args.nn}, chunk ${i + 1} of ${files.length}): ${f}\nIt is a JSON list; each item has n, ref, form, bsb (the BSB text of the place), lead (Bullinger's heading), words (his words on the place, quoting the King James) and others (other writers' words, if any).`,
  { label: `triage:${args.nn}:${i}`, phase: 'Triage', schema: SCHEMA, effort: 'medium' })))
const out = []
results.forEach((r, i) => {
  const [lo, hi] = args.ranges[i]  // the n of each file's first and last candidate (n run in order within a file)
  const want = new Set(Array.from({ length: hi - lo + 1 }, (_, j) => lo + j))
  for (const v of (r && r.verdicts) || []) if (want.has(v.n)) { out.push(v); want.delete(v.n) }
  for (const n of want) out.push({ n, verdict: 'unsure', bsb_words: '', reason: 'no verdict returned' })
})
const tally = {}
for (const v of out) tally[v.verdict] = (tally[v.verdict] || 0) + 1
log(`${out.length} candidates: ${JSON.stringify(tally)}`)
return { nn: args.nn, verdicts: out, tally }
