export const meta = {
  name: 'ask-fresh-questions-12',
  description: 'Write about 840 new never-seen things people type into Ask the Bible, held out blind for the gathering test',
  phases: [{ title: 'Write', detail: '12 writers: 3 kinds of askers x 2 voices x 2 angles' }],
}
const SCHEMA = {
  type: 'object',
  properties: { questions: { type: 'array', items: { type: 'string' } } },
  required: ['questions'],
}
const common = `You are writing test questions for "Ask the Bible", a question box in a Bible study web app: a person types any question or tells what they are going through, and the box answers only with Bible verses. We need a fresh set nobody has tuned the search for.

Read ${args.seen} first: those 5,374 lines are already used. Do not repeat any of them, and do not write a close rewording of one (same subject and same angle); new situations and new angles only.

Write exactly 70 items, one per array item, the way real people type into a search box on a phone: mostly lowercase, often no question mark, some short, some long and rambling with personal detail (numbers, names of apps, places, months), a few with a common misspelling, slang, or a modern word the Bible never uses. Vary the wording; do not start more than a few with the same three words. No self-harm or suicide (those take a separate path). Do not number them. Do not read or quote the ESV. Do not read any file other than the one named above, and do not edit any file. Return only the items.`
const kinds = [
  `Write as many different everyday people telling the box what is happening to them, mostly as statements, not questions ("my dad has dementia and doesnt know me anymore", "got passed over for the promotion again"). Cover a wide spread of life: grief and loss, money and debt, work and bosses, losing a job, marriage, dating, divorce, infertility, children and teenagers, aging parents, illness and disability, addiction, loneliness, anxiety, anger, guilt, temptation, betrayal, injustice, moving, school, social media, big decisions, and also smaller or odder things people still bring to God (a pet, a car, a neighbour's noise, a lawsuit, a court date, a visa, a fire, a flood, a farm, a sports loss, a band, a wedding gone wrong).`,
  `Write as many different everyday people asking the box short practical or moral questions about their own life ("how do i forgive my mom", "should i lend money to my brother again", "is it wrong to be rich"), about family, friends, work, money, sex and dating, habits, food and drink, body and health, emotions, prayer and doubt, church life, neighbours and strangers, law and government, animals and nature, and modern things (gaming, tattoos, crypto, dating apps, AI, streaming, gig work, vaping, cosmetic surgery, smart homes).`,
  `Write as many different curious people, seekers, sceptics and believers asking about the Bible itself and about faith: who/what/where/when/how many facts about less famous people, places, objects, numbers and events (not only the famous ones), what a named passage or book says, customs and daily life in Bible times (food, clothing, farming, trades, money, travel, weddings, burial), animals, plants and weather in the Bible, doctrine, hard passages and apparent contradictions, prayer and spiritual practices, Jesus' life and teaching, and how the Bible bears on science, history, other religions and culture.`,
]
const who = ['Write as teenagers, students and people in their twenties would.', 'Write as parents, older adults, and people for whom English is a second language would.']
const angles = [
  'Lean toward people in many places and walks of life: different countries and cultures (West Africa, India, the Philippines, Brazil, Korea, the Middle East, Eastern Europe, rural towns, big cities), different jobs (nurses, farmers, soldiers, drivers, fishermen, shop workers, pastors, coders, miners), different church backgrounds and none.',
  'Lean toward the specific and unusual: odd details, edge cases, situations with two things tangled together, rare subjects, and questions a child, a newcomer or a blunt sceptic would ask.',
]
phase('Write')
const jobs = []
kinds.forEach((k, i) => who.forEach((w, j) => angles.forEach((a, m) => jobs.push({ k, i, w, j, a, m }))))
const out = await parallel(jobs.map((x) => () => agent(`${common}\n\n${x.k}\n\n${x.w} ${x.a}`, { label: `writer:${x.i + 1}${'ab'[x.j]}${x.m + 1}`, phase: 'Write', schema: SCHEMA }).then((r) => r && r.questions.map((q) => ({ q, kind: x.i, voice: x.j, angle: x.m + 1 })))))
log(`${out.filter(Boolean).length} of ${jobs.length} writers returned`)
return { questions: out.filter(Boolean).flat() }