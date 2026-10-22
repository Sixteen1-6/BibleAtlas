export const meta = {
  name: 'ask-live-judge',
  description: 'Judge Ask the Bible answers for 268 real questions, in context, and suggest Bible words, subjects and verses',
  phases: [{ title: 'Judge', detail: '8 readers, one batch each' }],
}
const S = args.work + '/scratchpad'
const T = args.repo + '/eval/ask/scripts/tools'
const VERDICT = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          kind: { type: 'string', enum: ['chain', 'live'] },
          chain_fit: { type: 'string', enum: ['fits', 'partly', 'wrong'] },
          verses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ref: { type: 'string' },
                verdict: { type: 'string', enum: ['answers', 'related', 'off'] },
                why: { type: 'string' },
              },
              required: ['ref', 'verdict'],
            },
          },
          misled_by: { type: 'array', items: { type: 'string' } },
          bible_words: {
            type: 'array',
            items: {
              type: 'object',
              properties: { word: { type: 'string' }, bsb: { type: 'array', items: { type: 'string' } }, verses_found: { type: 'number' } },
              required: ['word', 'bsb'],
            },
          },
          naves: { type: 'array', items: { type: 'string' } },
          targets: { type: 'array', items: { type: 'string' } },
          opens: { type: ['string', 'null'] },
          note: { type: 'string' },
        },
        required: ['q', 'kind'],
      },
    },
  },
  required: ['results'],
}
const prompt = (i) => `You are checking the "Ask the Bible" box of Bible Atlas, a Bible study web app. A person types any question; the box answers with Scripture only: whole verses or exact Berean Standard Bible (BSB) verse parts, never sentences of commentary. The rule given by the app's owner: "the framework for interpreting the Bible is the Bible". Some questions open a prepared chain of verses; any other question is answered live by a search that ranks verses by the question's words, the words the Bible uses for them, Nave's Topical Bible subjects, and cross-references.

Read ${S}/eval2/j1/batch-${i}.json (a JSON array) and ${S}/eval2/prepared.json (the 73 prepared questions: id, question, other phrasings). Judge every item in the batch.

For kind "chain" (a prepared chain opened): set chain_fit. "fits" when the opened question means what the person asked, "partly" when it is on the subject but answers a different question (e.g. "how do I get to heaven" opening "What is heaven like?"), "wrong" when it answers something else (e.g. "how do I love God" opening "Does God love me?"). For partly or wrong, set opens to the prepared id that does mean the same thing, or null when none does.

For kind "live": give each listed verse a verdict, reading it in its context (the line marked >> is the verse, with the verses around it):
- "answers": in its context it speaks straight to what the person asked; someone asking would recognise it as a word to them on this.
- "related": on the subject but does not answer (a story that only mentions it, a list, a law about a narrow case).
- "off": the search matched a word in another sense ("treat" found "treaty", "beat an addiction" found beatings, "worthless" found worthless idols, "christians" found the word in Acts 11:26 with nothing on the question), or the context turns it around (a speaker the Bible rebukes, a quotation the passage refutes).
Keep "why" to a few words. Also give, for live items:
- misled_by: the question's words that pulled in the wrong sense.
- bible_words: for a plain modern word in the question, the word or words the BSB itself uses for the same thing ("mom" -> mother, "boss" -> master, "addiction" -> mastered/slave, "racism" -> favoritism/partiality). Only words naming the same thing, not your conclusions about what the Bible would say. Check each with: python3 ${T}/find.py --count WORD (and without --count to see the verses), and give verses_found. Leave out words with 0 verses or mostly another sense.
- naves: Nave's Topical Bible subjects that fit, checked with: python3 ${T}/naves.py --find WORD and python3 ${T}/naves.py "SUBJECT".
- targets: up to 6 references (book chapter:verse, single verses or short ranges) that answer the question most directly in the Bible's own words, each checked in its context with: python3 ${T}/verse.py "REF" "REF2" ... Prefer verses that use the question's words or the Bible's word for them, read in context. On questions where churches disagree, give only verses that speak of the thing by name, not a side.
- opens: a prepared id whose question means the same thing as this question (so its chain should open), else null.
Leave a field out when you have nothing for it. note: anything else the search should know (one line).

Rules: use only the BSB through these tools; never use or quote the ESV. Do not edit any file in ${args.repo}. Do not install packages. Return every item of the batch, with q copied exactly.`
phase('Judge')
const out = await parallel([1, 2, 3, 4, 5, 6, 7, 8].map((i) => () => agent(prompt(i), { label: `judge:${i}`, phase: 'Judge', schema: VERDICT })))
const results = out.filter(Boolean).flatMap((r) => r.results)
log(`${results.length} questions judged from ${out.filter(Boolean).length} of 8 batches`)
return { results }
