export const meta = {
  name: 'layers-seen-read2',
  description: 'Read every "seen in the words" figure place that passed the build checks against its BSB verse, with the stricter span and label rules: two readers, then a judge for any disagreement',
  phases: [
    { title: 'Read', detail: 'two independent readers per batch of places' },
    { title: 'Judge', detail: 'a third reader settles every place either reader questioned' },
  ],
}

const SP = args.sp
const NN = args.nn
const BATCH = args.batch || 40
const N = args.n
const FILE = args.file
const TOOL = `${SP}/wshow.py`

const SETUP = `You are checking places for Bible Atlas, a Bible study web app. At its deepest level ("Deep"), behind a notice that says it is commentary and not God's Word, the app marks figures of speech and parallel lines in the BSB (Berean Standard Bible). Shubhanshu, who owns the app, chose to also show places where the Bible's own words show a figure with no writer naming it. Each such place is marked "seen in the words" with no strength label and no source. Because nobody's name stands behind these places, a place may go live only when the verse itself plainly shows the figure: a careful reader of the BSB (or, where the place says so, of the Hebrew or Greek words shown) would see it without a commentary telling them. When in doubt, the place does not go live.

The places come from searches. A search's own note is shown, but it may be wrong. Judge from the verse.

To see places, run: python3 -I ${TOOL} ${FILE} <first> <end>   (0-based, end not included). It prints, for each place, the form (its plain label and Bullinger's definition), the reference, the marked words (with a warning if one is not in the verse), the BSB verse, its poetry lines where the BSB sets it as poetry, the verses before and after, and, where the place has Strong's tags, the Hebrew or Greek words with the tagged ones marked. To see any other verse: python3 -I ${TOOL} verse "Psalm 1:1". Do not edit any file and do not use the web.

The live forms (id: label) you may name are: same: Said twice (the second line says the first again in other words); opposite: Said by its opposite (the second line sets the opposite against the first); building: Built on (the second line adds to or completes the first); climbing: Climbing lines (each line takes up words of the one before and goes a step higher); mirror: Mirrored lines (A B B' A'); turns: Alternating lines (A B A' B'); frame: Framed (the same words open and close); refrain: Refrain; beginnings: Like beginnings; metonymy: One thing named for another it goes with (cause for effect, container for contents, a name for the person, the earth for its people); synecdoche: A part for the whole or the whole for a part; anthropopatheia: Human parts or feelings said of God; prosopopoeia: Things spoken of as persons; simile: A likeness with "like" or "as"; metaphor: Said to be the thing it is like; numbers; apostrophe: Turning to speak to someone or something absent; hyperbole: Saying more than is meant, for force; irony; question: A question that is not asking; doubling: The same word twice for force; inflections: The same word in different forms; euphemism: A gentle word for a hard thing; hendiadys: Two words for one thing; paradox; understatement; many-ands: And, and, and; no-ands: Without "and"; contrast: People set side by side; likeness: People alike; acrostic; type; allegory; parable; antithesis: Opposites set together; antimetabole: Words repeated in reverse order; aposiopesis: Breaking off; meiosis: Belittling one thing to magnify another; exclamation; riddle; hypocatastasis: A likeness implied, neither thing named; proverb.

For parallel lines (same, opposite, building, climbing, mirror, turns): the marked words must be the BSB's own poetry lines (or whole groups of them) and the lines must truly stand in that relation. "Same" needs the second line to restate the first; a line that adds something new is "building"; a line that sets the opposite is "opposite". For a figure of speech the marked words must be the words that carry the figure (the word used for something else, the likeness, the question, the doubled word), not a stretch of the verse that merely contains them. For Strong's tags: they must point at the words that carry the figure; tags on words that have nothing to do with it (an object marker, a name that is not the figure) are wrong.`

const STRICT = `Rules the last checks of earlier files taught (a sample of every file is read again by two skeptics, and these are what failed):
- Parallel lines: every marked line must stand in the relation with the rest. "Same" only when the later line plainly says the first again in other words; when it names a different thing (a second failing, another act), a cause or a result, or completes the sentence, it is "building"; when each line takes up words of the one before and goes a step higher, "climbing"; four lines running A B A' B', "turns". A line that only introduces the others, answers them, or gives a reason does not belong. If only some marked lines stand, give the lines that do as the new words.
- Figures of speech: the marked words must be the words that carry the figure and no more: for "the world" put for its people, "the world", not "the world hates"; for a euphemism, the gentle word ("sleep"), not the clause around it ("We will not all sleep"); the question itself, without "said the LORD" or the narration around it. No stray punctuation at the start.
- A refrain is a line that comes back at intervals through one passage as its burden (look at the verses around with the verse tool). Mark only the words that come back in this verse. A stock formula that recurs because it is how the text speaks ("declares the LORD", "Truly I tell you", "he said") is not a refrain.
- An acrostic shows in the Hebrew: the verse (or each of its lines) begins with the letter of the alphabet that follows the one before. Check the first Hebrew word of this verse and of the verses around it with the verse tool, and keep the place only where the letters plainly run in order through the passage. A word or name spelled by the first letters of a few words or verses (a hidden acrostic) is not plain.
- A set name read in its ordinary sense ("the Prophets", "speaking in tongues", "the Passover", "O house of Israel") is not a figure, and neither is a word in its ordinary meaning.
- A figure seen only in the Hebrew or Greek needs Strong's tags on the very words that carry it. If the BSB words shown do not carry it and the tags are missing or are a run of other words, drop it.`

const READ = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          id: { type: 'string' },
          keep: { type: 'boolean', description: 'true only if the verse plainly shows this kind of figure at these words' },
          form_ok: { type: 'boolean', description: 'the form named is the right one of the live forms' },
          better_form: { type: 'string', description: 'when form_ok is false: the live form id that fits, or "none"' },
          words_ok: { type: 'boolean', description: 'the marked words are the right span for this figure' },
          original_ok: { type: 'boolean', description: 'only for places with Strong\'s tags: the tags point at the words that carry the figure' },
          reason: { type: 'string', description: 'one or two sentences, quoting the verse' },
        },
        required: ['i', 'id', 'keep', 'form_ok', 'words_ok', 'reason'],
      },
    },
  },
  required: ['results'],
}

const JUDGE = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          id: { type: 'string' },
          final: { type: 'string', enum: ['keep', 'drop'] },
          form: { type: 'string', description: 'the live form id it keeps (the same as now, or the better one)' },
          words: { type: 'array', items: { type: 'string' }, description: 'only if the marked words must change: the new list, each an exact substring of the BSB verse, copied from the tool output' },
          strip_original: { type: 'boolean', description: 'true to drop the Strong\'s tags because they do not point at the figure' },
          reason: { type: 'string' },
        },
        required: ['i', 'id', 'final', 'form', 'strip_original', 'reason'],
      },
    },
  },
  required: ['results'],
}

const batches = []
for (let s = 0; s < N; s += BATCH) batches.push([s, Math.min(N, s + BATCH)])

function readPrompt(b, lens) {
  const [s, e] = b
  const L = lens === 'figure'
    ? 'Your lens: is the figure really there? Read each verse in its context and ask whether a careful reader would see this very figure in these words without being told. Be strict: a place that only might be read that way is not plain.'
    : 'Your lens: are the marked words and the form exactly right? Check each marked span is the part of the verse that shows the figure (for parallel lines, the BSB\'s own lines, in the right relation), that the form is the right live form, and that any Strong\'s tags point at the words that carry it. Also say whether the figure is plainly there.'
  return `${SETUP}

${STRICT}

${L}

Read places ${s} to ${e - 1} of words-${NN} as checked (run: python3 -I ${TOOL} ${FILE} ${s} ${e}). Read every one; give one result per place, in order, with its index i and id. Set keep to false for any place that does not plainly show its figure. Give original_ok only for places that have Strong's tags.`
}

function judgePrompt(b, disputed) {
  const lines = disputed.map(d => `- place ${d.i} (${d.id}): reader 1 ${JSON.stringify(d.a)}; reader 2 ${JSON.stringify(d.b)}`).join('\n')
  return `${SETUP}

${STRICT}

Two readers checked these places independently and at least one of them questioned each. Read each place yourself (python3 -I ${TOOL} ${FILE} <i> <i+1>) and decide. Keep a place only if the verse plainly shows a live form at the marked words; if the figure is plain but the form is wrong, keep it under the right form; if the figure is plain but the marked words are wrong, give the right words copied exactly from the BSB verse; set strip_original when the Strong's tags do not point at the figure. Otherwise drop it.

${lines}`
}

phase('Read')
const results = await pipeline(
  batches,
  b => parallel([
    () => agent(readPrompt(b, 'figure'), { label: `read ${b[0]}-${b[1] - 1} figure`, phase: 'Read', schema: READ }),
    () => agent(readPrompt(b, 'words'), { label: `read ${b[0]}-${b[1] - 1} words`, phase: 'Read', schema: READ }),
  ]),
  async (pair, b) => {
    const [a, c] = pair
    const want = []
    for (let i = b[0]; i < b[1]; i++) want.push(i)
    const byI = r => new Map(((r && r.results) || []).map(x => [x.i, x]))
    const A = byI(a), B = byI(c)
    const ok = x => x && x.keep && x.form_ok && x.words_ok && x.original_ok !== false
    const disputed = []
    const clean = []
    for (const i of want) {
      const x = A.get(i), y = B.get(i)
      if (ok(x) && ok(y)) clean.push(i)
      else disputed.push({ i, id: (x || y || {}).id || '', a: x || 'missing', b: y || 'missing' })
    }
    let judged = null
    if (disputed.length) {
      for (let k = 0; k < disputed.length; k += 25) {
        const part = disputed.slice(k, k + 25)
        const j = await agent(judgePrompt(b, part), { label: `judge ${b[0]}-${b[1] - 1} (${part.length})`, phase: 'Judge', schema: JUDGE })
        judged = (judged || []).concat((j && j.results) || [])
      }
    }
    return { batch: b, clean, disputed, judged, readers: [a, c] }
  },
)
const done = results.filter(Boolean)
const missing = batches.filter(b => !done.some(r => r.batch[0] === b[0]))
log(`${done.length} of ${batches.length} batches read; ${missing.length} incomplete`)
return { nn: NN, results: done, incomplete: missing }
