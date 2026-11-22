export const meta = {
  name: 'layers-seen-sample',
  description: 'Last check of a sample of kept "seen in the words" places: two skeptics, a third read for any split',
  phases: [
    { title: 'Check', detail: 'two skeptics read the whole sample' },
    { title: 'Settle', detail: 'a third reader settles any place they split on' },
  ],
}

const SP = args.sp
const FILE = args.file
const N = args.n
const TOOL = `${SP}/wshow.py`

const SETUP = `You are checking places for Bible Atlas, a Bible study web app. At its deepest level ("Deep"), behind a notice that says it is commentary and not God's Word, the app marks figures of speech and parallel lines in the BSB (Berean Standard Bible). Shubhanshu, who owns the app, chose to also show places where the Bible's own words show a figure with no writer naming it. Each such place is marked "seen in the words" with no strength label and no source. Because nobody's name stands behind these places, a place may go live only when the verse itself plainly shows the figure: a careful reader of the BSB (or, where the place says so, of the Hebrew or Greek words shown) would see it without a commentary telling them. When in doubt, the place does not go live.

The places come from searches. A search's own note is shown, but it may be wrong. Judge from the verse.

To see places, run: python3 -I ${TOOL} ${FILE} <first> <end>   (0-based, end not included). It prints, for each place, the form (its plain label and Bullinger's definition), the reference, the marked words (with a warning if one is not in the verse), the BSB verse, its poetry lines where the BSB sets it as poetry, the verses before and after, and, where the place has Strong's tags, the Hebrew or Greek words with the tagged ones marked. To see any other verse: python3 -I ${TOOL} verse "Psalm 1:1". Do not edit any file and do not use the web.

The live forms (id: label) you may name are: same: Said twice (the second line says the first again in other words); opposite: Said by its opposite (the second line sets the opposite against the first); building: Built on (the second line adds to or completes the first); climbing: Climbing lines (each line takes up words of the one before and goes a step higher); mirror: Mirrored lines (A B B' A'); turns: Alternating lines (A B A' B'); frame: Framed (the same words open and close); refrain: Refrain; beginnings: Like beginnings; metonymy: One thing named for another it goes with (cause for effect, container for contents, a name for the person, the earth for its people); synecdoche: A part for the whole or the whole for a part; anthropopatheia: Human parts or feelings said of God; prosopopoeia: Things spoken of as persons; simile: A likeness with "like" or "as"; metaphor: Said to be the thing it is like; numbers; apostrophe: Turning to speak to someone or something absent; hyperbole: Saying more than is meant, for force; irony; question: A question that is not asking; doubling: The same word twice for force; inflections: The same word in different forms; euphemism: A gentle word for a hard thing; hendiadys: Two words for one thing; paradox; understatement; many-ands: And, and, and; no-ands: Without "and"; contrast: People set side by side; likeness: People alike; acrostic; type; allegory; parable; antithesis: Opposites set together; antimetabole: Words repeated in reverse order; aposiopesis: Breaking off; meiosis: Belittling one thing to magnify another; exclamation; riddle; hypocatastasis: A likeness implied, neither thing named; proverb.

For parallel lines (same, opposite, building, climbing, mirror, turns): the marked words must be the BSB's own poetry lines (or whole groups of them) and the lines must truly stand in that relation. "Same" needs the second line to restate the first; a line that adds something new is "building"; a line that sets the opposite is "opposite". For a figure of speech the marked words must be the words that carry the figure (the word used for something else, the likeness, the question, the doubled word), not a stretch of the verse that merely contains them. For Strong's tags: they must point at the words that carry the figure; tags on words that have nothing to do with it (an object marker, a name that is not the figure) are wrong.`


const VERDICT = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          id: { type: 'string' },
          pass: { type: 'boolean', description: 'true only if the verse plainly shows this form at these marked words, and any tags point at the words that carry it' },
          reason: { type: 'string', description: 'one or two sentences, quoting the verse' },
        },
        required: ['i', 'id', 'pass', 'reason'],
      },
    },
  },
  required: ['results'],
}

function prompt(k) {
  return `${SETUP}

These places have already been read and kept; you are the last check before they go live, and your job is to find any that should not. Read every one (run: python3 -I ${TOOL} ${FILE} 0 ${N}). For each, pass it only if the verse plainly shows this form at these marked words: the form is the right one, the marked words carry it (for parallel lines, the BSB's own lines standing in that relation), and any Strong's tags point at the words that carry it. Fail it if a careful reader would need a commentary to see it, if another live form fits it better, or if the marked words are the wrong span. Give one result per place, in order, with its index i (0 to ${N - 1}) and id.${k ? ' Start from the last place and work back to the first.' : ''}`
}

phase('Check')
const [a, b] = await parallel([
  () => agent(prompt(0), { label: 'skeptic 1', phase: 'Check', schema: VERDICT }),
  () => agent(prompt(1), { label: 'skeptic 2', phase: 'Check', schema: VERDICT }),
])
const A = new Map(((a && a.results) || []).map(x => [x.i, x]))
const B = new Map(((b && b.results) || []).map(x => [x.i, x]))
const split = []
const verdict = {}
for (let i = 0; i < N; i++) {
  const x = A.get(i), y = B.get(i)
  if (x && y && x.pass === y.pass) verdict[i] = { pass: x.pass, how: 'both', reasons: [x.reason, y.reason] }
  else split.push({ i, a: x || 'missing', b: y || 'missing' })
}
if (split.length) {
  phase('Settle')
  const lines = split.map(d => `- place ${d.i}: skeptic 1 ${JSON.stringify(d.a)}; skeptic 2 ${JSON.stringify(d.b)}`).join('\n')
  const j = await agent(`${SETUP}

Two skeptics checked these kept places and split, or one gave no answer. Read each yourself (python3 -I ${TOOL} ${FILE} <i> <i+1>) and decide whether it passes: the verse plainly shows this form at these marked words, and any tags point at the words that carry it. When in doubt, it fails.

${lines}`, { label: `settle ${split.length}`, phase: 'Settle', schema: VERDICT })
  for (const x of (j && j.results) || []) verdict[x.i] = { pass: x.pass, how: 'third', reasons: [x.reason] }
}
const passed = Object.values(verdict).filter(v => v.pass).length
log(`${passed} of ${N} passed`)
return { file: FILE, n: N, passed, verdict }
