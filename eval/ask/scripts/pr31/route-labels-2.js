export const meta = {
  name: 'ask-route-labels',
  description: 'Judge which prepared Ask the Bible answers fit each typed question, to tune the matcher',
  phases: [{ title: 'Judge', detail: 'one judge per batch of typed questions' }],
}
const D = args.work + '/scratchpad/eval2/lab'
const OUT = {
  type: 'object',
  properties: {
    labels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, v: { type: 'string', enum: ['fits', 'near', 'no'] } }, required: ['id', 'v'] } },
        },
        required: ['q', 'verdicts'],
      },
    },
  },
  required: ['labels'],
}
const prompt = (b) => `People type anything into the question box of a Bible study app: questions about the Bible and faith, and statements of what they are going through. When one of the app's prepared answers fits what was typed, the app opens it (a short chain of Bible verses under the person's own words); otherwise it gathers verses for their words. Opening the wrong prepared answer is worse than opening none.

Read ${D}/${b}.json. Each item is what someone typed ("q") and a few prepared answers ("candidates": each with its question title and some of the ways people ask it). For every candidate give a verdict:
- "fits": this prepared answer is for the very thing the person asks or is going through, so they would feel it answers them (a statement "my dad died last week" fits "My mom or dad just died. How do I go on without them?"; "is god angry with me" does not fit "I'm angry at God. Is that allowed?").
- "near": the same area but not what they asked (a different relation, situation, or side of the question), so it would only partly answer.
- "no": anything else, including answers that only share words.
Judge by meaning, not shared words. Write your result to ${D}/${b}-out.json as {"labels": [{"q": ..., "verdicts": [{"id": ..., "v": ...}]}]} with every item and every candidate, and return the same. Do not edit any other file, and install nothing.`
const res = await parallel((args && args.batches ? args.batches : ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10']).map((b) => () => agent(prompt(b), { label: `judge:${b}`, phase: 'Judge', schema: OUT, effort: 'high' }).then((r) => ({ b, n: r ? r.labels.length : 0 }))))
return { res }