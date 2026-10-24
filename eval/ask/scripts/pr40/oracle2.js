export const meta = {
  name: 'ask-r6-oracle-dev2',
  description: 'For each typed message, pick the prepared Ask the Bible answers that fit it, from all 1,224',
  phases: [{ title: 'Pick', detail: 'one reader per batch of messages' }],
}
const D = args.work + '/scratchpad/r6/dev2'
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
          subject: { type: 'string' },
        },
        required: ['q', 'fits', 'near', 'subject'],
      },
    },
  },
  required: ['picks'],
}
const prompt = (i) => `People type anything into the question box of a Bible study app: questions about the Bible and faith (some curious, strange, playful or hostile), and statements of what they are going through. The app has 1,224 prepared answers (short chains of Bible verses). ${D}/titles.txt lists each one's id and question title, one per line (id, a tab, the title). Their other ways of asking are in ${args.repo}/config/questions.json (grep -n '"id": "THE-ID"' and read its "also") if a title is unclear.

Read ${D}/o-${i}.json: a JSON array of what people typed, each with "cands", the prepared answers a word-and-meaning matcher thought closest (often right, often wrong, sometimes missing the right one). For each item, find among ALL 1,224 the prepared answers that fit it:
- "fits": made for the very thing the person asks or is going through, so they would feel it answers them ("laid off after 19 years" fits a question about losing a job; "my dad died last week" fits a question about a parent who died; "will my dog go to heaven" fits a question about pets in heaven, not one about what heaven is like).
- "near": the same area but not what they asked (a different relation, situation or side), so it would only partly answer.
Judge by meaning, not shared words. Check the cands, then search titles.txt for the key ideas and their synonyms (grep it) so you do not miss a better one. List ids exactly as in titles.txt; at most 3 fits and 3 near, best first; empty lists when nothing fits.
"subject": in 2 to 6 plain words, what the message is really asking about ("pets in heaven", "boss steals credit", "who wrote hebrews"), so messages with no fit can be grouped later.
Return every item with q copied exactly. Do not edit any file and install nothing.`
phase('Pick')
const out = await pipeline(args.batches, (i) => agent(prompt(i), { label: `oracle:${i}`, phase: 'Pick', schema: OUT, effort: 'high' }).then((r) => ({ i, picks: r ? r.picks : null })))
return { batches: out }
