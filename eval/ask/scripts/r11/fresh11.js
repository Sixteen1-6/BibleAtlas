export const meta = {
  name: 'ask-fresh-questions-11',
  description: 'Write about 300 new never-seen things people type into Ask the Bible, held out blind for the main-versus-branch test',
  phases: [{ title: 'Write', detail: '6 writers: 3 kinds of askers x 2 voices, each with its own angle' }],
}
const S = args.work + '/scratchpad'
const SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
}
const common = `You are writing test questions for "Ask the Bible", a question box in a Bible study web app: a person types any question or tells what they are going through, and the box answers only with Bible verses. We need a fresh set nobody has tuned the search for.

Read ${S}/r11/seen11.txt first: those 4,619 lines are already used. Do not repeat any of them, and do not write a close rewording of one (same subject and same angle); new situations and new angles only.

Write exactly 52 items, one per array item, the way real people type into a search box on a phone: mostly lowercase, often no question mark, some short, some long and rambling with personal detail (numbers, names of apps, places, months), a few with a common misspelling, slang, or a modern word the Bible never uses. Vary the wording; do not start more than a few with the same three words. No self-harm or suicide (those take a separate path). Do not number them. Do not read or quote the ESV. Do not read any file other than the one named above, and do not edit any file. Return only the items.`
const kinds = [
  `Write as many different everyday people telling the box what is happening to them, mostly as statements, not questions ("my dad has dementia and doesnt know me anymore", "got passed over for the promotion again"): grief and loss, money, debt and bills, work, bosses and coworkers, losing a job, marriage trouble, dating and breakups, divorce, infertility and pregnancy, children and teenagers, aging parents and caregiving, illness, pain and disability, addiction and recovery, loneliness, anxiety and panic, depression, anger, guilt and shame, temptation, betrayal by friends or church, injustice and being wronged, moving, school and exams, social media, big decisions.`,
  `Write as many different everyday people asking the box short practical or moral questions about their own life ("how do i forgive my mom", "should i lend money to my brother again", "is it wrong to be rich", "what do i do when i cant sleep from worry"), about family, friends, work, money, sex and dating, habits, emotions, prayer and doubt, church life, and modern things (gaming, tattoos, crypto, dating apps, AI).`,
  `Write as many different curious people, seekers, sceptics and believers asking about the Bible itself and about faith: who/what/where/when/how old/how many facts (people, places, numbers, events), what a named passage or book says (sometimes giving a book and chapter), doctrine (grace, the Trinity, baptism, the end times, heaven and hell, angels), hard passages and apparent contradictions, prayer and spiritual practices, Jesus' life, death and teaching, and how the Bible applies to science, history, other religions and culture.`,
]
const who = ['Write as teenagers, students and people in their twenties would.', 'Write as parents, older adults, and people for whom English is a second language would.']
const angles = [
  'Lean toward the ordinary and common: the things many people go through or wonder about every week.',
  'Lean toward people in many places and walks of life: different countries and cultures (West Africa, India, the Philippines, Brazil, Korea, the Middle East, rural towns, big cities), different jobs (nurses, farmers, soldiers, drivers, shop workers, pastors, coders), different church backgrounds and none.',
  'Lean toward the specific and unusual: odd details, edge cases, situations with two things tangled together, and questions a child, a newcomer or a blunt sceptic would ask.',
]
phase('Write')
const jobs = []
kinds.forEach((k, i) => who.forEach((w, j) => jobs.push({ k, i, w, j, a: angles[(i + 2 * j) % 3], m: (i + 2 * j) % 3 })))
const out = await parallel(jobs.map((x) => () => agent(`${common}\n\n${x.k}\n\n${x.w} ${x.a}`, { label: `writer:${x.i + 1}${'ab'[x.j]}`, phase: 'Write', schema: SCHEMA }).then((r) => r && r.questions.map((q) => ({ q, kind: x.i, voice: x.j, angle: x.m })))))
log(`${out.filter(Boolean).length} of ${jobs.length} writers returned`)
return { questions: out.filter(Boolean).flat() }