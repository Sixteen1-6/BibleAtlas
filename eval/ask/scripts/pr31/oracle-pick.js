export const meta = {
  name: 'ask-oracle-pick',
  description: 'For each fresh typed question, pick the prepared Ask the Bible answers that fit it, from all 663',
  phases: [{ title: 'Pick', detail: '3 readers, 75 questions each' }],
}
const S = args.work + '/scratchpad'
const OUT = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          fits: { type: 'array', items: { type: 'string' } },
          near: { type: 'array', items: { type: 'string' } },
        },
        required: ['q', 'fits', 'near'],
      },
    },
  },
  required: ['picks'],
}
const prompt = (i) => `People type anything into the question box of a Bible study app: questions about the Bible and faith, and statements of what they are going through. The app has 663 prepared answers (short chains of Bible verses); ${S}/ask/sig/titles.txt lists each one's id and question title (one per line). Their fuller ways of asking are in ${S}/ask/sig/b1.json to b8.json if a title is unclear.

Read ${S}/eval2/o${i}.json (a JSON array of what people typed). For each, find among all 663 the prepared answers that fit it:
- "fits": made for the very thing the person asks or is going through, so they would feel it answers them ("laid off after 19 years" fits a question about losing a job; "my dad died last week" fits "My mom or dad just died...").
- "near": the same area but not what they asked (a different relation, situation, or side of the question), so it would only partly answer.
Judge by meaning, not shared words. List ids exactly as in titles.txt; at most 3 fits and 3 near, best first; empty lists when nothing fits. Search the whole list (grep it for the key ideas and their synonyms), not only the obvious words. Return every item with q copied exactly. Do not edit any file and install nothing.`
phase('Pick')
const out = await parallel([1, 2, 3].map((i) => () => agent(prompt(i), { label: `oracle:${i}`, phase: 'Pick', schema: OUT, effort: 'high' })))
return { picks: out.filter(Boolean).flatMap((r) => r.picks) }
