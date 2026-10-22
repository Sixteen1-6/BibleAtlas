export const meta = {
  name: 'ask-relabel-new-answers',
  description: 'For each labelled dev message, find which of the 360 new prepared Ask the Bible answers fit it, so the new matcher can be tuned fairly',
  phases: [{ title: 'Pick', detail: 'one reader per batch of about 50 messages' }],
}
const D = args.work + '/scratchpad/r7/relabel'
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
          best: { type: 'string' },
        },
        required: ['q', 'fits', 'near', 'best'],
      },
    },
  },
  required: ['picks'],
}
const prompt = (i) => `People type anything into the question box of a Bible study app: questions about the Bible and faith (some curious, strange, playful or hostile), and statements of what they are going through. The app had 1,224 prepared answers (short chains of Bible verses) and has just gained 360 more. ${D}/new-titles.txt lists the 360 new ones (id, a tab, the question title); ${D}/titles.txt lists all 1,584. A new answer's other ways of asking are in ${args.repo}/config/questions.json (grep -n '"id": "THE-ID"' and read its "also") if a title is unclear.

Read ${D}/m-${i}.json: a JSON array of messages people typed. Each has "fits" and "near": the older answers a careful reader already found for it ("fits": made for the very thing asked; "near": same area, only partly answers), and "hints": new answers a word-and-meaning matcher thought close (often wrong, sometimes missing the right one).

For each message, decide which of the 360 NEW answers fit it, by the same standard:
- "fits": a new answer made for the very thing the person asks or is going through, so they would feel it answers them ("laid off after 19 years" fits losing a job; "will my dog go to heaven" fits pets in heaven, not what heaven is like).
- "near": a new answer in the same area that would only partly answer (a different relation, situation or side).
Judge by meaning, not shared words. Check the hints, then grep new-titles.txt for the message's key ideas and their synonyms so you do not miss one. List only ids from new-titles.txt, exactly as written; at most 3 fits and 3 near, best first; empty lists when none fits.
"best": of everything that fits (the older "fits" given and your new fits), the one id that answers it best, or "" when nothing fits.
Return every message of the batch with q copied exactly. Do not edit any file and install nothing.`
phase('Pick')
const out = await pipeline(args.batches, (i) => agent(prompt(i), { label: `relabel:${i}`, phase: 'Pick', schema: OUT, effort: 'high' }).then((r) => ({ i, picks: r ? r.picks : null })))
return { batches: out }