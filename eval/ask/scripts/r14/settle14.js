export const meta = {
  name: 'ask-r14-settle',
  description: 'Merge each pair of new answers that two drafting areas both wrote into one answer, then review the merge',
  phases: [
    { title: 'Merge', detail: 'one agent per pair writes one merged answer and checks it' },
    { title: 'Review', detail: 'a second reader checks Scripture, context and matching, and fixes in place' },
  ],
}

const R = args.dir
const T = '/home/claude/bibleatlas/eval/ask/scripts/tools'
const TOOLS = `Tools (run with python3; all read-only except files you write in ${R}/settle):
- python3 ${T}/verse.py "John 19:14" "Mark 15:33-34"   prints BSB text (use it for context too, e.g. "John 19:10-20")
- python3 ${T}/find.py WORD [WORD ...]                 BSB verses holding every word
- python3 ${T}/naves.py SUBJECT | --find WORD | --cites REF   Nave's subjects and their labels (index only)
- python3 ${R}/tools/qs.py WORD [WORD ...]              existing prepared questions matching words, with their first 3 parts
- python3 ${R}/tools/qs.py --id ID                      one existing question in full, with its examples
- python3 ${R}/tools/check_draft.py FILE.json           checks a draft the way the build does (exact BSB words, sizes, Nave's labels, examples); FAIL lines must be fixed, NOTE lines are worth a look
The repo is /home/claude/bibleatlas. Never edit anything in it. Do not run atlas, cargo, npm or git. Do not fetch anything from the web. Do not install packages. Do not use any mcp__hearthbot__ tool.`

const FORMAT = `Draft file format (JSON), exactly:
{"new": [ {"id": "who-killed-jesus", "group": "Jesus", "question": "Who killed Jesus?",
           "also": ["who crucified jesus", ...],            // 2 to 16 other ways people ask, plain lowercase, each at most 60 characters
           "signals": ["barabbas", ...],                     // 0 to 15 specific words or names people use that "also" does not hold, 1-3 lowercase words; never generic words (no "god", "jesus", "bible", "life", "die", "day", "work", "friend")
           "topics": [{"subject": "PILATE, PONTIUS"}, {"subject": "JESUS, THE CHRIST", "only": ["Tried in front of Pilate"]}],  // 1 to 5 Nave's subjects; "only"/"skip" keep or drop labels by their start
           "chain": [{"ref": "Acts 4:27-28"}, {"ref": "John 10:18", "words": "No one takes it from Me, but I lay it down of My own accord."}, ...] } ],
 "examples": {"who-killed-jesus": ["who killed jesus christ", ...]},        // 20 to 30 per new question
 "add_examples": {"existing-id": ["...", ...]},                            // 3 to 8 per existing question, only where its first two parts already answer that message
 "remove_also": {"existing-id": ["exact also text"]},                      // only to MOVE a phrasing to your new question (put it in the new question's also)
 "remove_examples": {"existing-id": ["exact example text"]}}               // only to MOVE an example to your new question
- Refs use the short book names the file already uses: Gen, Exod, Lev, Num, Deut, Josh, Judg, Ruth, 1 Sam, 2 Sam, 1 Kgs, 2 Kgs, 1 Chr, 2 Chr, Ezra, Neh, Esth, Job, Ps, Prov, Eccl, Song, Isa, Jer, Lam, Ezek, Dan, Hos, Joel, Amos, Obad, Jonah, Mic, Nah, Hab, Zeph, Hag, Zech, Mal, Matt, Mark, Luke, John, Acts, Rom, 1 Cor, 2 Cor, Gal, Eph, Phil, Col, 1 Thess, 2 Thess, 1 Tim, 2 Tim, Titus, Phlm, Heb, Jas, 1 Pet, 2 Pet, 1 John, 2 John, 3 John, Jude, Rev.
- id: lowercase words joined by hyphens, at most 48 characters, new and unique. question: a plain question ending in "?", at most 90 characters.
- The chain shows at most 1200 characters in all. Copy "words" from verse.py output exactly, punctuation included.
- Every part must be tied by the Bible's own data, or the build fails: it holds a word of the question or its "also" phrasings, or its verses sit under one of the question's Nave's subjects (kept lines), or it is within 4 verses of another part in the same chapter, or it shares a cross-reference, a quotation or a rare Hebrew or Greek root with another part. Choosing topics whose lines cite your verses, and phrasings that hold the key words, is the surest way.
- Never use the words scholar, theologian, commentator, denomination, interpret, esv or nave in a question, phrasing, signal or example. No scholars, church views or traditions in an answer.
- No example may repeat an existing example, question or phrasing (check_draft.py checks). When an example quotes the Bible, use only KJV or BSB wording, never another modern translation. Never copy one of the test messages below word for word: write your own.
- A new question must be one people commonly bring, and narrow enough that its chain truly answers each of its examples. It must not take over messages an existing question answers better (check with qs.py; read the existing question's chain and examples).`

const BASE = `"Ask the Bible" is a question box in a Bible app. Its owner's rule: the Bible interprets the Bible. A prepared answer is a CHAIN of 3 to 8 parts of Scripture and nothing else: each part is whole verses (at most 3 verses, given as "ref") or "words", a span of that verse's BSB text copied word for word (at least 3 words). No words of ours appear anywhere in an answer. The only heading is the question. Each part is used only where its own context supports it. The box shows the chain's parts in order, so the FIRST part (or first two) carries the answer; later parts add what the Bible itself says around it.`

const RULES = {
  fact: `${BASE} Fact questions: the first part (or first two) must state the very fact asked, plainly. Where the Gospels or other books give more than one account, show them fairly rather than picking one. Where the Bible's text gives no direct answer, give what the text does say if that is close and honest, or leave the question out. A teaching question about a puzzling text ("who are the seven spirits", "is the Holy Spirit a she") is answered by the verses that speak to it most plainly, the text itself first, then the Scripture that explains it; never by a church tradition. group: "Jesus" for Jesus' life, death and rising; "God" for God himself, the Spirit and angels; "Death and the future" for death, heaven, hell and the end; "Church and Bible" for every other Bible fact or teaching.\n\n${FORMAT}`,
  life: `${BASE} Life situations: people tell the box what is happening to them or ask what to do, often in long, chatty messages. The first part (or first two) must speak most directly to that situation, as a friend who knows the Bible would open it; later parts add comfort, wisdom, warning or hope from Scripture. Use each verse in its own sense: do not turn a promise made to one person into a guarantee for everyone, and do not use a verse about masters, kings or husbands to tell someone to stay under abuse, harassment or danger. For harassment, abuse, grooming or danger to a young or vulnerable person, the chain shows God's care for the oppressed, that such deeds are wrong and are brought to light, and the wisdom of seeking safety and help (for example Prov 22:3, Prov 31:8-9, Eph 5:11, Ps 10:17-18), never that they should endure it quietly. Never shame someone who is grieving, depressed, doubting or ill. The question heading names the situation in the person's own plain words ("A coworker keeps stealing my tips. What should I do?"). group: "Living" for work, money, school, conscience, church life and daily choices; "Family" for dating, marriage, parenting, in-laws and relatives; "Hard times" for grief, loss, injustice suffered, illness and despair.\n\n${FORMAT}\n- Examples for a life situation are what real people type on a phone: mostly long and specific (two or three sentences about their own life, with details, slang and typos, as the test messages below are), some short; each must be a message this chain truly answers.`,
  verse: `${BASE} Verse questions: people quote or name a verse and ask what it means, whether it applies to them, or how it fits another verse. A prepared answer for a verse holds that verse (as the first part, or right after a part that sets its scene), then the Scripture around it and across the Bible that shows what it means: its own context first, then the verses that explain or apply it. The question heading names the verse ("What does 'Iron sharpens iron' in Proverbs 27:17 mean?"). group: the group of the verse's subject ("Living", "Family", "Hard times", "God", "Jesus", "Saved", "Death and the future", "Church and Bible").\n\n${FORMAT}\n- Examples name or quote the verse the way people do (by reference, by a few words, misspelled, inside a life story, as the test messages below are).`,
}


const MERGED = { type: 'object', properties: {
  file: { type: 'string' }, keep: { type: 'string' }, examples: { type: 'integer' }, fails: { type: 'integer' }, notes: { type: 'string' },
}, required: ['file', 'keep', 'examples', 'fails', 'notes'] }
const REVIEWED = { type: 'object', properties: {
  file: { type: 'string' }, keep: { type: 'string' }, changes: { type: 'array', items: { type: 'string' } }, fails: { type: 'integer' }, notes: { type: 'string' },
}, required: ['file', 'keep', 'changes', 'fails', 'notes'] }

const show = (p) => p.sides.map((s) => `- ${s.id} in ${R}/drafts/${s.file}`).join('\n')
const near = (p) => p.near && p.near.length ? `\nKeep it distinct from these neighbours, which stay as they are (read them; no example of yours may be one their chains answer better, and say in notes if one of their examples belongs to yours): ${p.near.join(', ')} (in ${R}/drafts; find them with grep).` : ''

function mergePrompt(p) {
  const out = `${R}/settle/${p.key}.json`
  return `${RULES[p.kind]}\n\n${TOOLS}\n\nTwo drafting agents, working on different areas, each wrote a new prepared question for the same thing:\n${show(p)}\nBoth were reviewed already. The box must hold only one. Read both in full (the question entry in "new" and its list under "examples"), and any "remove_examples" / "remove_also" in each file that moved messages into it.${near(p)}\n\nWrite ONE merged question to the new file ${out}, in the draft format but holding only {"new": [the merged question], "examples": {its id: [...]}}. Rules for the merge:\n- id: keep the id of the side whose heading fits best (or write a new id if neither does). question: the plainest heading in the person's own words.\n- chain: take the stronger chain, the one whose first two parts speak most directly to every example; you may swap in a part from the other chain where it is plainly better, re-reading it in context with verse.py. 3 to 8 parts, at most 1200 characters shown, every part tied.\n- also: the union of both, without near-repeats, at most 16, each at most 60 characters. signals: the specific ones from both, at most 15, never generic words. topics: at most 5, the ones that tie the chain.\n- examples: the union of both lists, without near-repeats (two messages that differ only in a word or two count once), at most 45; each must be a message this chain's first two parts answer. Keep the long, specific ones.\nDo not edit the drafts. Run check_draft.py on ${out} and fix every FAIL until none is left. Return the file, the kept id, the example count, the FAIL count (0) and short notes (which chain you took and why, what you dropped).`
}

function reviewPrompt(p, m) {
  const out = `${R}/settle/${p.key}.json`
  return `${RULES[p.kind]}\n\n${TOOLS}\n\nTwo drafts both wrote a question for the same thing:\n${show(p)}\nAnother agent merged them into ${out} (notes: ${m ? m.notes : 'none'}).${near(p)}\n\nYou are the second reader. Check the merged file both ways:\n1. Scripture and context: read every part with verse.py with 4 or 5 verses around it. The first part, or first two, must speak most directly to the heading and to each example; each part is used where its own context supports it; a cut span does not change the verse's meaning; nothing applies a promise or command beyond its sense; on sensitive matters (abuse, danger to a young person, depression, other religions) the chain gives the Bible's whole witness, never tells anyone to endure abuse quietly and never shames the hurting.\n2. Matching: no good phrasing or example of either original was lost without reason; the examples are realistic and varied, and each is one this chain answers; signals are specific; with qs.py, no existing question already answers this in its first two parts, and the merged question does not take messages an existing question answers better.\nFix what is wrong by editing ${out} in place (keep it valid JSON), re-run check_draft.py until there is no FAIL, and return the file, the kept id, the list of changes you made (empty if none), the FAIL count (0) and notes.`
}

const PAIRS = args.pairs
phase('Merge')
const res = await pipeline(PAIRS,
  (p) => agent(mergePrompt(p), { label: `merge:${p.key}`, phase: 'Merge', schema: MERGED }),
  (m, p) => agent(reviewPrompt(p, m), { label: `review:${p.key}`, phase: 'Review', schema: REVIEWED }).then((r) => ({ key: p.key, sides: p.sides, merged: m, reviewed: r })),
)
return { results: res }
