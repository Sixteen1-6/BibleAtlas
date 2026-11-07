export const meta = {
  name: 'ask-fresh-questions-13',
  description: 'Write about 520 new never-seen things people type into Ask the Bible, held out blind for the main-versus-branch test',
  phases: [{ title: 'Write', detail: '10 writers: 5 kinds of askers x 2 voices, each with its own angle' }],
}
const S = args.dir
const SCHEMA = { type: 'object', properties: { questions: { type: 'array', items: { type: 'string' } } }, required: ['questions'] }
const common = `You are writing test questions for "Ask the Bible", a question box in a Bible study web app: a person types any question or tells what they are going through, and the box answers only with Bible verses. We need a fresh set nobody has tuned the search for.

Read ${S}/seen14.txt first: those 6,407 lines are already used. Do not repeat any of them, and do not write a close rewording of one (same subject and same angle); new situations and new angles only.

Write exactly 52 items, one per array item, the way real people type into a search box on a phone: mostly lowercase, often no question mark, some short, some long and rambling with personal detail (numbers, names of apps, places, months), a few with a common misspelling, slang, or a modern word the Bible never uses. Vary the wording; do not start more than a few with the same three words. No self-harm or suicide (those take a separate path). Do not number them. Do not read or quote the ESV or any modern translation other than the BSB; when an item quotes the Bible, use KJV or BSB wording, or paraphrase. Do not read any file other than the one named above, and do not edit any file. Return only the items.`
const kinds = [
  `Write as many different everyday people telling the box what is happening to them, mostly as statements, not questions: grief and loss, money and debt, work, losing a job, marriage, dating, divorce, infertility, children and teenagers, aging parents, illness and pain, addiction, loneliness, anxiety, depression, anger, guilt and shame, temptation, betrayal, injustice, moving, school, social media, big decisions.`,
  `Write as many different everyday people asking the box short practical or moral questions about their own life: family, friends, work, money, sex and dating, habits, emotions, prayer and doubt, church life, and modern things (gaming, tattoos, crypto, dating apps, AI).`,
  `Write as many different curious people, seekers, sceptics and believers asking about faith and the Bible's teaching: God, Jesus, salvation and grace, the Trinity, baptism, the end times, heaven and hell, angels and demons, hard passages and apparent contradictions, prayer, and how the Bible meets science, history, other religions and culture.`,
  `Write as many different people asking plain FACT questions about the Bible's people, places, numbers and events, the kind a friend, a child or a quiz asks: who, what, where, when, how old, how many, which, why did X happen. Spread them over the whole Bible: Genesis, Moses and the exodus, judges, kings and prophets, exile, the life, death and rising of Jesus, his disciples, the early church and Paul, who wrote which book. About a third should be about Jesus' life, death and resurrection. Some are framed ("my kid asked...", "settle a bet...", "my friend says X, is that true").`,
  `Write as many different people who name a specific Bible verse by book, chapter and verse number (for example "romans 12:2", "1 john 4:18", "ps 46:10", "eccles 7:16") and ask what it means, whether it says what someone claims, whether it applies to them, or why it is quoted somewhere (a tattoo, a funeral, a wedding, a sports jersey, a meme, a sermon). Use many different verses from all over the Bible, not only the famous few; some name only a chapter ("isaiah 40").`,
]
const who = ['Write as teenagers, students and people in their twenties would.', 'Write as parents, older adults, and people for whom English is a second language would.']
const angles = [
  'Lean toward the ordinary and common: the things many people go through or wonder about every week.',
  'Lean toward people in many places and walks of life: different countries and cultures, different jobs, different church backgrounds and none.',
  'Lean toward the specific and unusual: odd details, edge cases, two things tangled together, and questions a child, a newcomer or a blunt sceptic would ask.',
]
phase('Write')
const jobs = []
kinds.forEach((k, i) => who.forEach((w, j) => jobs.push({ k, i, w, j, a: angles[(i + 2 * j) % 3], m: (i + 2 * j) % 3 })))
const out = await parallel(jobs.map((x) => () => agent(`${common}\n\n${x.k}\n\n${x.w} ${x.a}`, { label: `writer:${x.i + 1}${'ab'[x.j]}`, phase: 'Write', schema: SCHEMA }).then((r) => r && r.questions.map((q) => ({ q, kind: x.i, voice: x.j, angle: x.m })))))
log(`${out.filter(Boolean).length} of ${jobs.length} writers returned`)
return { questions: out.filter(Boolean).flat() }
