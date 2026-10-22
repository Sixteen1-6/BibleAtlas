export const meta = {
  name: 'ask-crazy-questions',
  description: 'Write the strangest, hardest and most unexpected things people could type into Ask the Bible, to test it',
  phases: [{ title: 'Write', detail: '4 writers, different kinds of hard questions' }],
}
const C = args.work + '/scratchpad/crazy'
const SCHEMA = { type: 'object', properties: { questions: { type: 'array', items: { type: 'string' } } }, required: ['questions'] }
const common = `You are writing test questions for "Ask the Bible", the question box of a Bible study web app: a person types anything and the box answers only with Bible verses (no commentary). The owner wants it tested with the craziest, hardest questions people could think of, to make sure its answers stay logically sound.

Read ${C}/seen8.txt first: those lines are already used; do not repeat them or closely reword one.

Write exactly 30 items, one per array item, typed the way real people type into a box on a phone (mostly lowercase, some without a question mark, a few with typos or slang). Vary the wording and the subjects widely. No self-harm or suicide (a separate path handles those). Do not number them. Do not read or quote the ESV. Do not edit any file. Return only the items.`
const kinds = [
  `Absurd, funny and childlike questions people really ask about the Bible and God: "did adam have a belly button", "will there be wifi in heaven", "did noah take dinosaurs on the ark", "what did jesus eat for breakfast", "can angels get tired", "is my hamster going to heaven", "would jesus play fortnite", "did jesus ever laugh", "how tall was goliath in feet".`,
  `Paradoxes, trick questions and skeptics' gotchas: "can god make a rock so heavy he cant lift it", "who made god", "if god knows the future why pray", "if jesus is god who was he praying to", "how did judas die, hanging or falling", "who killed goliath, david or elhanan", "why did god harden pharaohs heart then punish him", "where did cains wife come from", "is the bible sexist", "why does god allow evil if hes good", "prove god exists", "the bible is just made up". Include a few hostile or mocking ones.`,
  `Odd, edgy and modern moral situations: "is it a sin to swear at a video game", "can i get a tattoo of a bible verse", "is it wrong to use chatgpt to write my prayers", "would jesus own a gun", "is crypto gambling", "can christians do yoga", "is it ok to pray for my team to win", "is cremation a sin", "can i be baptized in a hot tub", "i accidentally laughed during a funeral", "is it a sin to lie about santa claus", "my friend says halloween is satanic", "can i eat blood sausage", "is it wrong to have a crush on my teacher", "is masturbation a sin", "can i marry my second cousin".`,
  `Very short, vague, one-word or strange inputs and odd facts: "why", "help", "666", "rapture when", "jesus wept", "is lucifer hot", "the mark of the beast is the vaccine", "ghosts real?", "aliens in the bible", "nephilim", "what language is heaven", "whats the shortest verse", "how old was mary", "who was the first king of israel", "how many books are in the bible", "what day was jesus born", "is the earth flat bible", "zombies in matthew 27", "dragons bible", "unicorns in the bible".`,
]
phase('Write')
const out = await parallel(kinds.map((k, i) => () => agent(`${common}\n\n${k}`, { label: `crazy:${i + 1}`, phase: 'Write', schema: SCHEMA })))
return { questions: out.filter(Boolean).map((r, i) => r.questions.map((q) => ({ q, kind: i }))).flat() }
