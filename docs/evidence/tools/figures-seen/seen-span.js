export const meta = {
  name: 'layers-seen-span',
  description: 'Re-read kept places: parallel lines marking three or more lines, figures of speech, the said-twice label, or refrains, each kept, cut, moved to the form that fits, or dropped',
  phases: [
    { title: 'Read', detail: 'two readers per batch' },
    { title: 'Judge', detail: 'a third reader settles any place they differ on' },
  ],
}

const SP = args.sp
const FILE = args.file
const N = args.n
const BATCH = args.batch || 30
const MODE = args.mode || 'lines'
const TOOL = `${SP}/wshow.py`

const SETUP = `You are checking places for Bible Atlas, a Bible study web app. At its deepest level ("Deep"), behind a notice that says it is commentary and not God's Word, the app marks figures of speech and parallel lines in the BSB (Berean Standard Bible). Shubhanshu, who owns the app, chose to also show places where the Bible's own words show a figure with no writer naming it. Each such place is marked "seen in the words" with no strength label and no source. Because nobody's name stands behind these places, a place may go live only when the verse itself plainly shows the figure: a careful reader of the BSB (or, where the place says so, of the Hebrew or Greek words shown) would see it without a commentary telling them. When in doubt, the place does not go live.

The places come from searches. A search's own note is shown, but it may be wrong. Judge from the verse.

To see places, run: python3 -I ${TOOL} ${FILE} <first> <end>   (0-based, end not included). It prints, for each place, the form (its plain label and Bullinger's definition), the reference, the marked words (with a warning if one is not in the verse), the BSB verse, its poetry lines where the BSB sets it as poetry, the verses before and after, and, where the place has Strong's tags, the Hebrew or Greek words with the tagged ones marked. To see any other verse: python3 -I ${TOOL} verse "Psalm 1:1". To list every verse of one book that holds some words: python3 -I ${TOOL} find "Psalm" "endures forever". Do not edit any file and do not use the web.

The live forms (id: label) you may name are: same: Said twice (the second line says the first again in other words); opposite: Said by its opposite (the second line sets the opposite against the first); building: Built on (the second line adds to or completes the first); climbing: Climbing lines (each line takes up words of the one before and goes a step higher); mirror: Mirrored lines (A B B' A'); turns: Alternating lines (A B A' B'); frame: Framed (the same words open and close); refrain: Refrain; beginnings: Like beginnings; metonymy: One thing named for another it goes with (cause for effect, container for contents, a name for the person, the earth for its people); synecdoche: A part for the whole or the whole for a part; anthropopatheia: Human parts or feelings said of God; prosopopoeia: Things spoken of as persons; simile: A likeness with "like" or "as"; metaphor: Said to be the thing it is like; numbers; apostrophe: Turning to speak to someone or something absent; hyperbole: Saying more than is meant, for force; irony; question: A question that is not asking; doubling: The same word twice for force; inflections: The same word in different forms; euphemism: A gentle word for a hard thing; hendiadys: Two words for one thing; paradox; understatement; many-ands: And, and, and; no-ands: Without "and"; contrast: People set side by side; likeness: People alike; acrostic; type; allegory; parable; antithesis: Opposites set together; antimetabole: Words repeated in reverse order; aposiopesis: Breaking off; meiosis: Belittling one thing to magnify another; exclamation; riddle; hypocatastasis: A likeness implied, neither thing named; proverb.

For parallel lines (same, opposite, building, climbing, mirror, turns): the marked words must be the BSB's own poetry lines (or whole groups of them) and the lines must truly stand in that relation. "Same" needs the second line to restate the first; a line that adds something new is "building"; a line that sets the opposite is "opposite". For a figure of speech the marked words must be the words that carry the figure (the word used for something else, the likeness, the question, the doubled word), not a stretch of the verse that merely contains them. For Strong's tags: they must point at the words that carry the figure; tags on words that have nothing to do with it (an object marker, a name that is not the figure) are wrong.`



const LINES_RULE = `Each place below marks three or more of the BSB's poetry lines under one form: "same" (said twice) says every marked line restates the others, "opposite" that the lines set opposites against each other, "building" that each line adds to or completes the one before, "climbing" that each line takes up words of the one before and goes a step higher. A reader sees all the marked lines lit together under that one label, so every marked line must stand in that relation with the rest. A group of two lines restated by another group of two lines is fine (A A' restated as B B', when the second group says the first again). Not fine: a line that only introduces the others, answers them, gives a reason, adds a new thought or a new picture, sets an opposite inside a "same" place, or completes a sentence without restating; a speech formula such as "declares the LORD"; two separate pairs about different things marked as one place.

For each place answer one of:
- "all": every marked line stands in the relation; keep the place as it is.
- "trim": only some lines do; give in words the lines that do (two or more, the BSB's own lines copied exactly from the tool output, in order). Where the verse has two separate pairs, give the clearest pair.
- "drop": no two marked lines plainly stand in the relation.`

const FIGURE_RULE = `Each place below marks words under one figure of speech (or, for "contrast" and "likeness", people set side by side). A reader sees the marked words lit under the form's label, so the marked words must be the words that carry the figure and no more: the word or phrase named for another thing (for "the world" put for its people, mark "the world" or "the whole world", not "the world hates" or "not to the world"), the likeness with its "like" or "as", the question itself, the doubled word, the part put for the whole, the people set side by side. Not a clause or line that merely contains the figure, and not a verb or "not" or "if" beside it. Strong's tags, where a place has them, must point at the Hebrew or Greek words that carry the figure; a tag on any other word (another "all", an object marker, a name that is not the figure) is wrong. A figure that is only in the Hebrew or Greek (the BSB gives the plain meaning, as "language" for the Hebrew "lip") stands only where the original words shown plainly carry it; where the tagged word is shown with the plain meaning as its own sense, a reader would need a lexicon, so drop it.

For each place answer one of:
- "all": the figure is plain in the verse and the marked words are right; keep it as it is (set strip_original if its tags are wrong).
- "trim": the figure is plain but the marked words are too wide or wrong; give in words the words that carry it, each an exact piece of the BSB verse copied from the tool output, whole words only, as short as still shows the figure. Its tags are dropped with the cut.
- "drop": a careful reader would not see this figure in these words without a commentary telling them (a set name such as "the Prophets" or "speaking in tongues", a word in its ordinary sense, a figure only some would read there). When in doubt, drop.`

const FORM_RULE = `Each place below marks two or more of the BSB's poetry lines as "same" (said twice). A reader sees that label on the lines with no commentary, so it must be plain from the lines themselves that the later line says the first again in other words: the same thought, with words that match ("hear" and "listen", "my flesh" and "my skin", "rebuked the nations" and "destroyed the wicked"). Check the label against the lines:
- "building" (built on) when a later line adds something new to the first: a different thing (a second failing, another act), a cause or a result, or words that complete it;
- "climbing" when each line takes up words of the one before and goes a step higher ("What, O my son? / What, O son of my womb? / What, O son of my vows?");
- "turns" (alternating lines) when four lines run A B A' B' (scarlet / white as snow / crimson / like wool);
- "opposite" when a later line sets the opposite against the first.

For each place answer one of:
- "all": the later lines plainly say the first again; "same" stands.
- "form": the lines plainly stand in another of these relations; give its id in form (building, climbing, turns or opposite).
- "drop": no plain relation a reader would see without being told. When in doubt between "same" and another form, choose the other form only if it is plain; otherwise drop.`

const REFRAIN_RULE = `Each place below marks words as a refrain: words that come back, the same or nearly the same, again and again through one passage or book as its burden ("His loving devotion endures forever" through Psalm 136, "And there was evening, and there was morning" through Genesis 1, "So I will send fire upon ... to consume its citadels" through Amos 1 and 2). A reader sees the marked words lit under "Refrain" with no commentary, so it must be plain from the words themselves: the marked words must come back in other verses of the same book nearly word for word in the BSB (use the find command and name the verses in your reason), and they must be exactly the part of this verse that comes back, not a phrase that opens something different each time while the words that truly come back stand elsewhere, and not a whole verse around the repeated words. Not a refrain: a stock formula that recurs because it is how the text speaks ("declares the LORD", "Thus says the LORD", "the word of the LORD came to me", "Truly I tell you", "he said"); words said only once more right beside them (that is a doubling, or lines said twice); a phrase found once or twice in the book; words whose sense comes back but not their wording.

For each place answer one of:
- "all": the marked words plainly come back as a refrain and are the part that comes back; keep it as it is.
- "trim": a refrain is plain in this verse but the marked words are wider than the part that comes back, or are not the part that comes back; give in words the words of this verse that do come back, each an exact piece of the BSB verse copied from the tool output, whole words only. Its tags are dropped with the change.
- "drop": no words of this verse plainly come back as a refrain. When in doubt, drop.`

const RULE = MODE === 'figure' ? FIGURE_RULE : MODE === 'form' ? FORM_RULE : MODE === 'refrain' ? REFRAIN_RULE : LINES_RULE

const SPAN = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          id: { type: 'string' },
          verdict: { type: 'string', enum: MODE === 'form' ? ['all', 'form', 'drop'] : ['all', 'trim', 'drop'] },
          form: { type: 'string', description: 'for form: the form id that fits (building, climbing, turns or opposite)' },
          words: { type: 'array', items: { type: 'string' }, description: 'for trim: the words to keep, each copied exactly from the tool output' },
          strip_original: { type: 'boolean', description: 'for all: true when the place\'s Strong\'s tags do not point at the words that carry the figure' },
          reason: { type: 'string', description: 'one or two sentences, quoting the verse' },
        },
        required: ['i', 'id', 'verdict', 'reason'],
      },
    },
  },
  required: ['results'],
}

const batches = []
for (let s = 0; s < N; s += BATCH) batches.push([s, Math.min(N, s + BATCH)])

function readPrompt(b, k) {
  return `${SETUP}

${RULE}

Read places ${b[0]} to ${b[1] - 1} (run: python3 -I ${TOOL} ${FILE} ${b[0]} ${b[1]}). Give one result per place, in order, with its index i and id.${k ? ' Read each verse line by line before you look at the marked words.' : ''}`
}

const same = (x, y) => x && y && x.verdict === y.verdict && (x.verdict !== 'trim' || JSON.stringify(x.words || []) === JSON.stringify(y.words || [])) && (x.verdict !== 'all' || !!x.strip_original === !!y.strip_original) && (x.verdict !== 'form' || x.form === y.form)

phase('Read')
const results = await pipeline(
  batches,
  b => parallel([
    () => agent(readPrompt(b, 0), { label: `span ${b[0]}-${b[1] - 1} a`, phase: 'Read', schema: SPAN }),
    () => agent(readPrompt(b, 1), { label: `span ${b[0]}-${b[1] - 1} b`, phase: 'Read', schema: SPAN }),
  ]),
  async (pair, b) => {
    const A = new Map(((pair[0] && pair[0].results) || []).map(x => [x.i, x]))
    const B = new Map(((pair[1] && pair[1].results) || []).map(x => [x.i, x]))
    const agreed = {}
    const split = []
    for (let i = b[0]; i < b[1]; i++) {
      const x = A.get(i), y = B.get(i)
      if (same(x, y)) agreed[i] = { verdict: x.verdict, words: x.words, form: x.form, strip_original: !!x.strip_original, how: 'both', reason: x.reason }
      else split.push({ i, a: x || 'missing', b: y || 'missing' })
    }
    let judged = []
    if (split.length) {
      const lines = split.map(d => `- place ${d.i}: reader 1 ${JSON.stringify(d.a)}; reader 2 ${JSON.stringify(d.b)}`).join('\n')
      const j = await agent(`${SETUP}

${RULE}

Two readers answered differently on these places. Read each yourself (python3 -I ${TOOL} ${FILE} <i> <i+1>) and decide. When in doubt between marking more and fewer, mark fewer; when in doubt whether the figure (or any pair of lines) plainly stands, drop.

${lines}`, { label: `judge ${b[0]}-${b[1] - 1} (${split.length})`, phase: 'Judge', schema: SPAN })
      judged = (j && j.results) || []
    }
    for (const x of judged) {
      // a judge's new form stands only where a reader proposed it
      const d = split.find(t => t.i === x.i)
      const proposed = d ? [d.a, d.b].filter(t => t && t.verdict === 'form').map(t => t.form) : []
      if (x.verdict === 'form' && !proposed.includes(x.form)) agreed[x.i] = { verdict: 'drop', how: 'third', reason: `the judge chose ${x.form}, which no reader proposed: ${x.reason}` }
      else agreed[x.i] = { verdict: x.verdict, words: x.words, form: x.form, strip_original: !!x.strip_original, how: 'third', reason: x.reason }
    }
    return { batch: b, verdict: agreed }
  },
)
const done = results.filter(Boolean)
log(`${done.length} of ${batches.length} batches read`)
return { file: FILE, n: N, results: done }
