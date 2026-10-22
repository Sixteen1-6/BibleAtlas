export const meta = {
  name: 'ask-blind-judge-6',
  description: 'Judge, blind, every verse the old and new Ask the Bible show for 150 never-seen questions',
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
const prompt = (i) => `You are checking the "Ask the Bible" box of Bible Atlas, a Bible study web app. A person types any question or tells what they are going through; the box answers with Scripture only (Berean Standard Bible verses, never commentary). The owner's rule: "the framework for interpreting the Bible is the Bible".

Read ${S}/eval2/j8/batch-${i}.json (a JSON array of what people typed, each with verses that one of two versions of the box shows, in reference order; you are not told which version showed which). For each verse, "shown" is the exact words the box shows (sometimes only part of a verse) and "context" is the passage around it (the lines marked >> are the verse). Give every listed verse a verdict, reading the shown words in their context:
- "answers": in its context it speaks straight to what the person asked or is going through; someone typing that would recognise it as a word to them on this.
- "related": on the subject but does not answer (a story that only mentions it, a list, a law about a narrow case).
- "off": matched a word in another sense (a name, a place, a different meaning), or the context turns it around (a speaker the Bible rebukes, a quotation the passage refutes), or it has nothing to do with what was typed.
Keep "why" to a few words. If you need more context, run: python3 ${T}/verse.py "Book 1:1-10". On questions where churches disagree, judge only whether the verse speaks of the thing asked about, not which side it supports. Use only the BSB through these tools; never use or quote the ESV. Do not edit any file and do not install anything. Return every question of the batch with q copied exactly and every listed verse judged, with ref copied exactly. note: one line only if something stands out.`
phase('Judge')
const out = await parallel([1, 2, 3, 4, 5, 6, 7, 8].map((i) => () => agent(prompt(i), { label: `blind6:${i}`, phase: 'Judge', schema: VERDICT })))
const results = out.filter(Boolean).flatMap((r) => r.results)
log(`${results.length} questions judged from ${out.filter(Boolean).length} of 8 batches`)
return { results }
