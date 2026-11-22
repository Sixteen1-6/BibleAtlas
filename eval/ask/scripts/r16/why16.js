export const meta = {
  name: 'ask-r16-why',
  description: 'For each message round 15 still missed, find which verses answer it and why the box did not show them',
  phases: [{ title: 'Read', detail: 'one reader per batch of about 20 misses' }],
}
const D = args.dir
const T = '/home/claude/bibleatlas/eval/ask/scripts/tools'
const SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  q: { type: 'string' },
  cause: { type: 'string', enum: ['wrong-open', 'weak-chain', 'gather-missed', 'named-passage', 'no-answer'] },
  better_id: { type: 'string' },
  ideal: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, why: { type: 'string' } }, required: ['ref', 'why'] } },
  reach: { type: 'string', enum: ['word', 'named-chapter', 'nave', 'cross-ref', 'near-answer', 'meaning', 'none'] },
  harm: { type: 'boolean' },
  note: { type: 'string' },
}, required: ['q', 'cause', 'ideal', 'reach', 'harm', 'note'] } } }, required: ['results'] }

const prompt = (i) => `"Ask the Bible" is a question box in a Bible app that answers only with Bible verses (BSB). For each message it either OPENS a prepared answer (a chain of verses written for one question, field "chain" is its id and "heading" its question) or, when none fits well enough, GATHERS single verses: it takes the first content words of the message, the Nave's subjects they name, the verses of the prepared answers whose meaning is nearest, and the cross-references of the best found, then orders them by a fitted score. When a message names a book and chapter and verse, the named verse comes first, then its most voted cross-references one by one with the two verses either side of it, then the rest of that chapter in order; when it names only a chapter, a prepared answer opens only if its chain holds a verse of that chapter.

Read ${D}/batch-${i}.json. Each item is a real message the box did badly on in a blind test: "shown" lists the first 6 verses it showed with a blind judge's verdict (answers, related, off), and "note" is the judge's remark. For EACH item:
1. cause: "wrong-open" (a prepared answer opened that does not fit the message; if another existing prepared answer fits, give its id as better_id), "weak-chain" (the prepared answer that opened is the right subject, but its first parts do not answer this message), "gather-missed" (it gathered, and verses that answer were not among the first 6), "named-passage" (the message names a book, chapter or verse, and the box did not show the verse of that passage that answers), or "no-answer" (the Bible's text has no verse that speaks to it).
2. ideal: the 2 to 5 verses that best answer the message, most direct first, each with a few words of why. Read each in its context with verse.py before naming it; search with find.py and naves.py. Never quote or use any translation but the BSB.
3. reach: how the box could most plainly have found the first ideal verse: "word" (it holds an unusual word of the message), "named-chapter" (it is in the chapter the message names, and holds the message's words), "nave" (it sits under a Nave's subject the message names), "cross-ref" (it is a cross-reference of a verse that was shown), "near-answer" (it is in an existing prepared answer on this subject: name its id in better_id), "meaning" (only by meaning), or "none".
4. harm: true if any shown verse could wound or mislead this asker in their situation (for example a rebuke shown to someone grieving); say which in note.
5. note: one line.
Tools: python3 ${T}/verse.py "John 8:56-58"; python3 ${T}/find.py WORD [WORD ...]; python3 ${T}/naves.py SUBJECT | --find WORD | --cites REF; python3 ${D}/../qs.py WORD [WORD ...] or --id ID (existing prepared answers). Do not edit any file, do not fetch anything from the web, do not install packages, and do not use any mcp__hearthbot__ tool. Return every item of the batch, with q copied exactly.`

const n = args.n, from = args.from || 1, to = args.to || n
const out = await parallel(Array.from({ length: to - from + 1 }, (_, k) => from + k).map((i) => () => agent(prompt(i), { label: `why:${i}`, phase: 'Read', schema: SCHEMA })))
const results = out.filter(Boolean).flatMap((r) => r.results)
log(`${results.length} misses read from ${out.filter(Boolean).length} of batches ${from} to ${to}`)
return { results }
