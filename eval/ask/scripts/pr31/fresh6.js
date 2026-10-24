export const meta = {
  name: 'ask-fresh-questions-6',
  description: 'Write a fresh blind set of things people type into Ask the Bible, mostly life statements',
  phases: [{ title: 'Write', detail: '3 writers, different kinds of askers' }],
}
const S = args.work + '/scratchpad'
const SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
}
const common = `You are writing test questions for "Ask the Bible", a question box in a Bible study web app: a person types any question or tells what they are going through, and the box answers only with Bible verses. We need a fresh set nobody has tuned the search for.

Read ${S}/eval2/seen6.txt first: those 1057 lines are already used. Do not repeat any of them, and do not write a close rewording of one (same subject and same angle); new situations and new angles only.

Write exactly 50 items, one per array item, the way real people type into a search box on a phone: mostly lowercase, often no question mark, some short, some long and rambling with personal detail (numbers, names of apps, places, months), a few with a common misspelling, slang, or a modern word the Bible never uses. Vary the wording; do not start more than a few with the same three words. No self-harm or suicide (those take a separate path). Do not number them. Do not read or quote the ESV. Do not edit any file. Return only the items.`
const kinds = [
  `Write as many different everyday people telling the box what is happening to them, mostly as statements, not questions ("my dad has dementia and doesnt know me anymore", "got passed over for the promotion again"): grief and loss, money, debt and bills, work, bosses and coworkers, losing a job, marriage trouble, dating and breakups, divorce, infertility and pregnancy, children and teenagers, aging parents and caregiving, illness, pain and disability, addiction and recovery, loneliness, anxiety and panic, depression, anger, guilt and shame, temptation, betrayal by friends or church, injustice and being wronged, moving, school and exams, social media, big decisions.`,
  `Write as many different everyday people asking the box short practical or moral questions about their own life ("how do i forgive my mom", "should i lend money to my brother again", "is it wrong to be rich", "what do i do when i cant sleep from worry"), about family, friends, work, money, sex and dating, habits, emotions, prayer and doubt, church life, and modern things (gaming, tattoos, crypto, dating apps, AI).`,
  `Write as many different curious people, seekers, sceptics and believers asking about the Bible itself and about faith: who/what/where/when facts (people, places, numbers, events), what a named passage or book says (sometimes giving a book and chapter), doctrine (grace, the Trinity, baptism, the end times, heaven and hell, angels), hard passages and apparent contradictions, prayer and spiritual practices, Jesus' life and teaching, and how the Bible applies to science, history, other religions and culture.`,
]
phase('Write')
const out = await parallel(kinds.map((k, i) => () => agent(`${common}\n\n${k}`, { label: `writer:${i + 1}`, phase: 'Write', schema: SCHEMA })))
return { questions: out.filter(Boolean).map((r, i) => r.questions.map((q) => ({ q, kind: i }))).flat() }
