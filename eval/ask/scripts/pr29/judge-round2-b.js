export const meta = {
  name: 'ask-judge-round2',
  description: 'Judge, blind, the verses old and new Ask the Bible searches show for fresh questions',
  phases: [{ title: 'Judge', detail: '11 readers, one batch each' }],
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
          kind: { type: 'string', enum: ['live'] },
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
          note: { type: 'string' },
        },
        required: ['q', 'kind', 'verses'],
      },
    },
  },
  required: ['results'],
}
const D = (args && args.dir) || 'j4'
const prompt = (i) => `You are checking the "Ask the Bible" box of Bible Atlas, a Bible study web app. A person types any question; the box answers with Scripture only (Berean Standard Bible verses, never commentary). The owner's rule: "the framework for interpreting the Bible is the Bible". A search ranks verses for questions that have no prepared answer.

Read ${S}/eval2/${D}/batch-${i}.json (a JSON array of questions, each with verses that one of several versions of the search shows, in reference order). Give every listed verse a verdict, reading it in its context (the line marked >> is the verse, with the verses around it):
- "answers": in its context it speaks straight to what the person asked; someone asking would recognise it as a word to them on this.
- "related": on the subject but does not answer (a story that only mentions it, a list, a law about a narrow case).
- "off": the search matched a word in another sense, or the context turns it around (a speaker the Bible rebukes, a quotation the passage refutes), or it has nothing to do with the question, or it would wound the person who asked (for example "wives, submit" shown to someone describing abuse).
Keep "why" to a few words. If you need more context, run: python3 ${T}/verse.py "Book 1:1-10". On questions where churches disagree, judge only whether the verse speaks of the thing asked about, not which side it supports. Use only the BSB through these tools; never use or quote the ESV. Do not edit any file. Return every question of the batch with q copied exactly and every listed verse judged. note: one line only if something stands out for the search.`
phase('Judge')
const N = Array.from({ length: (args && args.n) || 11 }, (_, i) => i + 1)
const out = await parallel(N.map((i) => () => agent(prompt(i), { label: `judge:${i}`, phase: 'Judge', schema: VERDICT })))
const ok = out.filter(Boolean)
log(`${ok.length} of ${N.length} batches judged`)
return { results: ok.flatMap((r) => r.results) }
