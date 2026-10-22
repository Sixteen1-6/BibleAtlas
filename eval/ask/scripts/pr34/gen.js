export const meta = {
  name: 'ask-r6-questions',
  description: 'Write many never-seen things people might type into Ask the Bible, of every kind, to train and to test it',
  phases: [{ title: 'Write', detail: 'one writer per kind of question' }],
}
const SCHEMA = { type: 'object', properties: { questions: { type: 'array', items: { type: 'string' } } }, required: ['questions'] }
const common = (n) => `You are writing test messages for "Ask the Bible", the question box of a Bible study web app: a person types anything and the box answers only with Bible verses (no commentary). The owner wants it to handle any question at all by citing the Bible, and wants it tested with the craziest and hardest things people could type, as well as ordinary ones.

Write exactly ${n} items, one per array item, typed the way real people type into a box on a phone: mostly lowercase, many without a question mark, some with typos, slang or texting style, some long and rambling, some two or three words. Every item must be different in subject, not only in wording: spread them over as many different subjects, people, books, situations and feelings as you can, including unusual ones nobody would think of first. No self-harm or suicide (a separate path handles those). Do not number them. Do not read or quote the ESV. Do not edit any file and install nothing. Return only the items.`
const kinds = [
  `Absurd, funny, childlike and curious questions about the Bible, God, heaven, angels, animals and Bible people ("did adam have a belly button", "will my cat be in heaven", "did jesus ever get sick", "what did the disciples do for fun").`,
  `Skeptics', atheists' and other religions' challenges, gotchas, apparent contradictions and mocking questions, some hostile ("if god is all powerful why cant he stop cancer", "the bible was written by men", "why did god kill babies in egypt", "mormons say...", "muslims say jesus wasnt crucified").`,
  `Modern moral questions the Bible does not name directly: technology, money, work, sex, drugs, medicine, politics, entertainment, sports, food, body, law ("is it a sin to sell feet pics", "can i invest in weed stocks", "is ivf ok", "should christians vote", "is it wrong to ghost someone").`,
  `Very short, vague, one-word, misspelled or garbled inputs, half-remembered verses and phrases ("eagles wings verse", "the one about the mustard seed", "jeremiah 29 11 meaning", "plans to prosper", "footprints in the sand", "grace", "hell?", "why me", "jesus vs satan desert").`,
  `First-person statements of what is happening in someone's life right now, with concrete details, about grief, illness, disability, aging, pregnancy and children, family conflict, in-laws, siblings ("my twins were born at 26 weeks and one didnt make it", "dad has dementia and doesnt know me anymore").`,
  `First-person statements about work, money, school, exams, addiction, crime, prison, immigration, loneliness, dating, sex, marriage trouble, divorce, church hurt, doubt and losing faith, with concrete details ("got caught shoplifting at target", "my pastor had an affair and the church split", "visa denied again").`,
  `Practical "how do i" and "should i" questions about living the Christian life and hard decisions ("how do i forgive my dad", "should i break up with my non christian boyfriend", "how do i start reading the bible", "should i tithe if im in debt", "how do i know gods will for college").`,
  `Bible facts, people, places, numbers, events, books, trivia and odd details ("how many wives did solomon have", "where was the garden of eden", "who wrote hebrews", "what happened to the 12 apostles", "what did jesus write in the sand", "how long did methuselah live", "what language did jesus speak").`,
  `Doctrine and theology, end times, salvation, sacraments, the Trinity, Holy Spirit, predestination, denominational debates, Mary, saints, purgatory, speaking in tongues, women in ministry, Sabbath, food laws ("can you lose your salvation", "is the rapture real", "why do catholics pray to mary", "is baptism needed to be saved").`,
  `Questions from children and teenagers in their own words, about school, friends, parents, bullying, phones, games, crushes, body changes, fears, pets, and God ("my parents fight every night", "is it a sin to play gta", "does god care about my test tomorrow", "can i date at 14").`,
  `Long, rambling, multi-part messages (40 to 120 words) mixing a story and a question, and messages from people whose English is not their first language ("hello i am from nigeria and my uncle say my sickness is from witchcraft is this true what bible say", "so basically my boyfriend and i...").`,
  `Feelings, inner struggles and spiritual experiences: fear, shame, guilt, anger, envy, pride, lust, boredom, emptiness, numbness, feeling far from God, dreams and visions, hearing voices, sensing demons, unanswered prayer, joy and gratitude ("i feel nothing when i pray anymore", "i had a dream my grandma came back", "i cant stop comparing myself on instagram").`,
]
const blindKinds = [
  `Imagine 100 different visitors to a Bible app on one ordinary day: of every age, country, background and belief, some Christians, some curious, some hurting, some joking, some hostile. Write what each one types into the question box: about a third tell what is happening in their life, a third ask about the Bible, God or faith, and a third ask something odd, edgy, modern or skeptical.`,
  `Imagine 100 people who have never used a Bible app trying out its question box late at night: tired, worried, curious, bored, angry, testing it with weird things, asking what they have always wondered. Write what each one types. Mix life situations, Bible questions, moral questions, strange and funny questions, and short garbled inputs.`,
  `Imagine a youth group, a prison Bible study, a hospital waiting room, a college dorm and a retirement home each passing a phone around and typing questions into a Bible app's question box, 20 from each place. Write what each person types, in their own voice.`,
]
const set = args && args.blind ? blindKinds : kinds
const n = args && args.n ? args.n : 100
phase('Write')
const out = await parallel(set.map((k, i) => () => agent(`${common(n)}\n\n${k}`, { label: `${args && args.blind ? 'blind' : 'pool'}:${i + 1}`, phase: 'Write', schema: SCHEMA })))
return { questions: out.map((r, i) => (r ? r.questions.map((q) => ({ q, kind: i })) : [])).flat() }
