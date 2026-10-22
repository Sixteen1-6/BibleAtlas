export const meta = {
  name: 'ask-fresh-questions',
  description: 'Write 150 fresh questions people would type into a Bible question box, unseen by the search',
  phases: [{ title: 'Write', detail: '3 writers, 50 questions each, different kinds of askers' }],
}
const S = args.work + '/scratchpad/eval2'
const SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' }, minItems: 50, maxItems: 50 } },
  required: ['questions'],
}
const KINDS = [
  'people in the middle of real life: work, money, family, marriage, children, health, grief, loneliness, addiction, conflict, guilt, school, dating, ageing. Many are statements, not questions ("my dad has cancer"). Mix short and long.',
  'people curious about what the Bible says or teaches: doctrine (God, Jesus, salvation, the Spirit, the end), ethics (is X a sin, should Christians do Y, modern issues), prayer and church life. Plain words, the way a non-scholar types.',
  'people asking about the Bible itself and its stories: who was X, why did Y happen, what does a passage or phrase mean, places, numbers, hard passages, how the Bible came to be. Include some skeptics and some children or teens.',
]
const prompt = (k) => `Write 50 questions that real people would type into the search box of a Bible study app called "Ask the Bible". The box answers with Bible verses only.

This batch: ${k}

Write them as people really type: mostly lowercase, little punctuation, some contractions without apostrophes (dont, im), an occasional typo, one to thirty words. Every question different in subject; no two about the same thing. Do NOT reuse or lightly reword any question in ${S}/seen.txt (read it first: these were already used).

Do not look at any code or other files. Return exactly 50 questions.`
phase('Write')
const out = await parallel(KINDS.map((k, i) => () => agent(prompt(k), { label: `writer:${i + 1}`, phase: 'Write', schema: SCHEMA })))
return { questions: out.filter(Boolean).flatMap((o) => o.questions) }
