export const meta = {
  name: 'ask-fresh-questions-3',
  description: 'Write a fresh, never-seen set of questions people would type into Ask the Bible, for a blind measure',
  phases: [{ title: 'Write', detail: '2 writers, different kinds of askers' }],
}
const S = args.work + '/scratchpad'
const SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
}
const common = `You are writing test questions for "Ask the Bible", a question box in a Bible study web app: a person types any question and the box answers only with Bible verses. We need a fresh set nobody has tuned the search for, to measure it blind.

Read ${S}/eval2/seen.txt first: those ${'387'} questions are already used. Do not repeat any of them, and do not write a close rewording of one (same subject and same angle); new subjects and new angles only.

Write exactly 75 questions, one per array item, the way real people type into a search box on a phone: mostly lowercase, often no question mark, some short ("is vaping a sin"), some long and rambling with personal detail, a few with a common misspelling, slang, or a modern word the Bible never uses. Vary the wording; do not start more than a few with the same three words. No questions about self-harm or suicide (those take a separate path and are tested elsewhere). Do not number them. Do not read or quote the ESV. Do not edit any file. Return only the questions.`
const kinds = [
  `Write as many different everyday people bringing their real life to the box: grief, money and debt, work and bosses, marriage, dating, divorce, children and parenting, aging parents, illness and disability, addiction and recovery, loneliness, anxiety, anger, guilt and shame, temptation, conflict with friends or church, injustice, moving, school, technology and social media, decisions they face. Some are statements of what happened rather than questions ("my dad has dementia and doesnt know me").`,
  `Write as many different curious people, seekers, sceptics and believers asking about the Bible itself and about faith: who/what/where/when facts (people, places, numbers, events), what a named passage or book says (sometimes giving a book and chapter), doctrine (grace, the Trinity, baptism, the end times, heaven and hell, angels), hard passages and apparent contradictions, prayer and spiritual practices, Jesus' life and teaching, ethics of modern things ("is it wrong to..."), and how the Bible applies to science, history, other religions and culture.`,
]
phase('Write')
const out = await parallel(kinds.map((k, i) => () => agent(`${common}\n\n${k}`, { label: `writer:${i + 1}`, phase: 'Write', schema: SCHEMA })))
return { questions: out.filter(Boolean).flatMap((r) => r.questions) }