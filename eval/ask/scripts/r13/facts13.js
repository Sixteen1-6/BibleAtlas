export const meta = {
  name: 'ask-fact-answers',
  description: 'Survey common Bible fact questions Ask misses, draft Bible-only prepared answers, review them two ways, fix',
  phases: [
    { title: 'Survey', detail: 'one agent per area lists common fact questions and checks what already answers them' },
    { title: 'Write', detail: 'writers draft chains of exact BSB words, phrasings, topics and examples' },
    { title: 'Review', detail: 'a Scripture-and-context reviewer and a matching reviewer per draft' },
    { title: 'Fix', detail: 'apply the reviews and re-run the checker until clean' },
  ],
}

const R = args.dir
const T = '/home/claude/bibleatlas/eval/ask/scripts/tools'
const TOOLS = `Tools (run with python3; all read-only except files you write in ${R}/drafts):
- python3 ${T}/verse.py "John 19:14" "Mark 15:33-34"   prints BSB text (use it for context too, e.g. "John 19:10-20")
- python3 ${T}/find.py WORD [WORD ...]                 BSB verses holding every word
- python3 ${T}/naves.py SUBJECT | --find WORD | --cites REF   Nave's subjects and their labels (index only)
- python3 ${R}/tools/qs.py WORD [WORD ...]              existing prepared questions matching words, with their first 3 parts
- python3 ${R}/tools/qs.py --id ID                      one existing question in full, with its examples
- python3 ${R}/tools/check_draft.py FILE.json           checks a draft the way the build does (exact BSB words, sizes, Nave's labels, examples); FAIL lines must be fixed, NOTE lines are worth a look
The repo is /home/claude/bibleatlas. Never edit anything in it. Do not run atlas, cargo or npm. Do not fetch anything from the web.`

const RULES = `"Ask the Bible" is a question box in a Bible app. Its owner's rule: the Bible interprets the Bible. A prepared answer is a CHAIN of 3 to 8 parts of Scripture and nothing else: each part is whole verses (at most 3 verses, given as "ref") or "words", a span of that verse's BSB text copied word for word (at least 3 words). No words of ours appear anywhere in an answer. The only heading is the question. Each part is used only where its own context supports it. The box shows the chain's parts in order, so the FIRST part (or first two) must state the very fact asked, plainly; later parts add what the Bible itself says around it. Where the Gospels or other books give more than one account (who saw Jesus first, the hours of the crucifixion), show them fairly rather than picking one. Where the Bible's text gives no direct answer (a year, how many books are in the Bible), give what the text does say if that is close and honest, or leave the question out.

Draft file format (JSON), exactly:
{"new": [ {"id": "who-killed-jesus", "group": "Jesus", "question": "Who killed Jesus?",
           "also": ["who crucified jesus", ...],            // 2 to 16 other ways people ask, plain lowercase, each at most 60 characters
           "signals": ["barabbas", ...],                     // 0 to 15 specific words or names people use that "also" does not hold, 1-3 lowercase words; never generic words (no "god", "jesus", "bible", "life", "die", "day")
           "topics": [{"subject": "PILATE, PONTIUS"}, {"subject": "JESUS, THE CHRIST", "only": ["Tried in front of Pilate"]}],  // 1 to 5 Nave's subjects; "only"/"skip" keep or drop labels by their start
           "chain": [{"ref": "Acts 4:27-28"}, {"ref": "John 10:18", "words": "No one takes it from Me, but I lay it down of My own accord."}, ...] } ],
 "examples": {"who-killed-jesus": ["who killed jesus christ", ...]},        // 20 to 30 per new question
 "add_examples": {"existing-id": ["...", ...]},                            // 3 to 8 per existing question, only where its first two parts already answer that wording
 "remove_also": {"existing-id": ["exact also text"]},                      // only to MOVE a phrasing to your new question (put it in the new question's also)
 "remove_examples": {"existing-id": ["exact example text"]}}               // only to MOVE an example to your new question
- Refs use the short book names the file already uses: Gen, Exod, Lev, Num, Deut, Josh, Judg, Ruth, 1 Sam, 2 Sam, 1 Kgs, 2 Kgs, 1 Chr, 2 Chr, Ezra, Neh, Esth, Job, Ps, Prov, Eccl, Song, Isa, Jer, Lam, Ezek, Dan, Hos, Joel, Amos, Obad, Jonah, Mic, Nah, Hab, Zeph, Hag, Zech, Mal, Matt, Mark, Luke, John, Acts, Rom, 1 Cor, 2 Cor, Gal, Eph, Phil, Col, 1 Thess, 2 Thess, 1 Tim, 2 Tim, Titus, Phlm, Heb, Jas, 1 Pet, 2 Pet, 1 John, 2 John, 3 John, Jude, Rev.
- id: lowercase words joined by hyphens, at most 48 characters, new and unique. group: "Jesus" for Jesus' life, death and rising; "Church and Bible" for every other Bible fact. question: a plain question ending in "?", at most 90 characters.
- The chain shows at most 1200 characters in all. Copy "words" from verse.py output exactly, punctuation included.
- Every part must be tied by the Bible's own data, or the build fails: it holds a word of the question or its "also" phrasings, or its verses sit under one of the question's Nave's subjects (kept lines), or it is within 4 verses of another part in the same chapter, or it shares a cross-reference, a quotation or a rare Hebrew or Greek root with another part. Choosing topics whose lines cite your verses, and phrasings that hold the key names, is the surest way.
- Never use the words scholar, theologian, commentator, denomination, interpret, esv or nave in a question, phrasing, signal or example. No scholars, church views or traditions in an answer.
- Examples are what real people type on a phone: lowercase, short or long, misspelled sometimes ("jesus mom", "who killd goliath"), sometimes framed ("my friend says...", "my kid asked..."). Each example must ask THIS fact only, so it teaches the matcher one answer. No example may repeat an existing example, question or phrasing (check_draft.py checks). When an example quotes the Bible, use only KJV or BSB wording, never another modern translation.
- A new question must be one people commonly ask, and narrow: one fact. It must not take over messages an existing question answers better (check with qs.py; read the existing question's chain and examples).`

const AREAS = [
  { key: 'birth', scope: "Jesus' birth, family, names and childhood: where and when he was born, his mother and Joseph, his brothers, the shepherds and angels, the magi and the star, Herod and the flight to Egypt, Nazareth and why he is called a Nazarene, why he is called Jesus, his circumcision and presentation, what happened when he was twelve, John the Baptist's relation to him." },
  { key: 'ministry', scope: "Jesus' ministry and his followers: his baptism (where, by whom), the temptation, how old he was when he began, the twelve (their names, who was called first, Peter, Andrew, James and John, Matthew the tax collector, the disciple Jesus loved, the closest three), the seventy-two sent out, the women who followed him, where he preached (synagogues, Galilee, the Sermon on the Mount), his hometown rejecting him, how long his ministry lasted." },
  { key: 'miracles', scope: "Jesus' miracles and teaching as facts: his first miracle, walking on water, feeding the five thousand, who he raised from the dead, healing the blind and lepers, calming the storm, the transfiguration (who was there), the Lord's Prayer (where taught), what he said was the greatest commandment, what he first preached, how many parables or miracles are recorded where the text gives it." },
  { key: 'trial', scope: "Jesus' last week, arrest and trials: the triumphal entry, the last supper (when, where), who betrayed him and for how much, why he was arrested, where he was arrested (the garden), Peter's denial, the high priest (Caiaphas, Annas), Pilate, Herod, Barabbas, Pilate washing his hands, whether Jesus answered Pilate, the flogging, the crown of thorns, and WHO KILLED JESUS (who was responsible; use Acts 4:27-28 and Acts 2:23 that name all parties and God's plan, the Gospels' record of Pilate handing him over and the soldiers crucifying him, John 10:17-18 that he laid down his life, Isaiah 53, and Luke 23:34; never lead with a verse that blames one people)." },
  { key: 'cross', scope: "Jesus' crucifixion, death and burial as facts: WHEN JESUS DIED (the day: the Passover, the day of Preparation before the Sabbath; the hours; under Pontius Pilate; Matt 26:2, John 19:14, John 19:31, Mark 15:42, Mark 15:25, Mark 15:33-37, Luke 3:1 are candidates; what day of the week), where he was crucified (Golgotha), who was crucified with him, the sign over the cross, the wine vinegar, his last words, the darkness, the earthquake and torn curtain, the dead raised from tombs, the centurion's words, why his legs were not broken, the spear, who stood at the cross (his mother), who buried him, how long he was in the tomb." },
  { key: 'risen', scope: "Jesus' resurrection appearances and ascension as facts: who saw him first, what the angels said at the tomb, the guards, the women not believed, the road to Emmaus, appearing to Peter alone, to Thomas, to the five hundred, to Paul, telling the disciples beforehand he would rise, why Galilee, how long he stayed (forty days), his last words before the ascension, where he ascended, what the two men in white said." },
  { key: 'acts', scope: "Acts and the early church as facts: who replaced Judas (Matthias), Pentecost (how many were baptized), the lame man at the Beautiful gate, Ananias and Sapphira, Stephen the first martyr, Philip and the Ethiopian, when and where Paul became a believer, whether Paul was one of the twelve, Cornelius the first Gentile believer, where believers were first called Christians, James leading the Jerusalem church, the Jerusalem council's decision, Paul's journeys and companions (Barnabas, Silas, Timothy, Luke), how long Paul was in Rome, how Peter got out of prison." },
  { key: 'books', scope: "Who wrote the Bible's books and other facts about the books as the Bible's own text states them: who wrote Acts, Luke, Revelation, Hebrews (the text does not name the writer: show what it says, or leave it out), Romans and Paul's letters, James, Peter's letters, the Psalms (David and others), Proverbs (Solomon, Agur, Lemuel), Ecclesiastes, the Law (Moses wrote), Lamentations, who wrote most of the New Testament, the first and last words of the Bible. Leave out questions the text cannot answer, such as how many books are in the Bible." },
  { key: 'genesis', scope: "Genesis as facts: how many days creation took and what was made each day, Adam and Eve (where they lived, their sons), Cain and Abel, Seth, Enoch who did not die, Methuselah the oldest, Noah (who built the ark, how long it rained, how long they were in the ark, where it landed, the rainbow, Noah's sons), the tower of Babel, Abraham (his wife Sarah, his sons Isaac and Ishmael, where he came from), Lot and Lot's wife, Sodom, Isaac and Rebekah, Jacob and Esau, Jacob's twelve sons, Jacob renamed Israel, Joseph's coat, Joseph sold into Egypt." },
  { key: 'exodus', scope: "Exodus to Joshua as facts: Moses (the basket and Pharaoh's daughter, the burning bush, how many plagues and which, the Red Sea, the Ten Commandments and where given, the golden calf, why Moses did not enter the promised land, how old he was when he died, who succeeded him), Aaron, Miriam, manna, the forty years in the wilderness, the twelve spies (Joshua and Caleb), Balaam's donkey, Jericho's walls, Rahab, the sun standing still." },
  { key: 'kings', scope: "Judges, Ruth, Samuel, Kings and Chronicles as facts: Samson (who cut his hair, how he died), Delilah, Gideon, Deborah, Ruth and Boaz, Samuel and Hannah, Saul the first king, who anointed David, David and Goliath, David's best friend Jonathan, Bathsheba and Uriah, Absalom, Solomon (his wives, the temple, his wisdom, his request), why the kingdom split in two (Rehoboam and Jeroboam), Elijah (the prophets of Baal, the chariot of fire, taken up), Elisha, Jezebel, Josiah the boy king, who destroyed the temple." },
  { key: 'prophets', scope: "The prophets, exile, writings and other people as facts: Daniel in the lions' den, the three men in the furnace, the writing on the wall, Jonah (the fish, how long, Nineveh), Esther, Nehemiah and the wall, Ezra, Job (who he was, what he lost, what he got back), Isaiah, Jeremiah, the seventy years of exile, Ezekiel's dry bones; and New Testament people: Mary Magdalene, Martha and Mary, Lazarus, Nicodemus, Zacchaeus, Joseph of Arimathea, John the Baptist's death, Herod." },
]

const SURVEY_SCHEMA = { type: 'object', properties: {
  items: { type: 'array', items: { type: 'object', properties: {
    q: { type: 'string', description: 'the fact question in plain words' },
    status: { type: 'string', enum: ['new', 'covered', 'none'] },
    id: { type: 'string', description: 'for covered: the existing question id whose first two parts state the fact' },
    note: { type: 'string', description: 'the verses that answer it, or why it is covered or has no answer' },
    rank: { type: 'integer', description: '1 = asked very often, 3 = rarely' },
  }, required: ['q', 'status', 'note', 'rank'] } },
}, required: ['items'] }

const FIX_SCHEMA = { type: 'object', properties: {
  fixes: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['must', 'should', 'drop'] }, fix: { type: 'string' },
  }, required: ['id', 'severity', 'fix'] } },
}, required: ['fixes'] }

const DONE_SCHEMA = { type: 'object', properties: {
  file: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } }, fails: { type: 'integer' },
  dropped: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
}, required: ['file', 'ids', 'fails', 'notes'] }

const misses = args.misses.join('\n')

function surveyPrompt(a) {
  return `${RULES}\n\n${TOOLS}\n\nYour area: ${a.scope}\n\nTask: list the fact questions in your area that people (teenagers, friends, new believers, curious skeptics) most often ask about the Bible, in plain words, 20 to 30 of them. For EACH one, check whether an existing prepared question already answers it: search with qs.py using its key words (names, places), then read the candidate's first parts. Mark:\n- "covered" with that id only if the existing question's FIRST TWO parts state the fact asked (a related chain that states it only at part 5 is not covered);\n- "new" if no existing question's first two parts state it and the Bible's text does;\n- "none" if the Bible's text gives no answer.\nIn note, give the verse references that state the answer (check them with verse.py). Rank how often people ask.\n\nThese real test messages got no answer from the box (some in your area, most not; include every one in your area):\n${misses}\n\nStay inside your area; other agents cover the rest.`
}

function writePrompt(a, items, file, part) {
  const list = items.map((it) => `- ${it.q}  [${it.status}${it.id ? ' ' + it.id : ''}] ${it.note}`).join('\n')
  return `${RULES}\n\n${TOOLS}\n\nYour area: ${a.scope}\n\nWrite the draft file ${file} (part ${part} of your area). Handle these fact questions:\n${list}\n\nFor each "new" item, write one new question with its chain, also, signals, topics and 20 to 30 examples (merge items that are the same fact into one question; drop any that turn out to be covered or unanswerable, and say so). For each "covered" item, add 3 to 8 add_examples to that existing id, only after reading its chain with qs.py --id and confirming its first two parts state the fact. If an existing question holds a phrasing or example that belongs to your new question rather than to it (for example "who was responsible for killing jesus" in what-happened-at-jesus-trial once a "Who killed Jesus?" question exists), move it with remove_also / remove_examples and add it to yours.\nRead every verse in its context with verse.py before using it. Copy words exactly. Then run check_draft.py on your file and fix every FAIL, and look at every NOTE (an untied part may still pass the build through a cross-reference or root, but prefer a topic or phrasing that ties it). Repeat until there are no FAIL lines. Return the file path, the ids you wrote, the number of FAIL lines left (0), anything dropped, and short notes.`
}

function reviewPrompt(file, lens) {
  const lenses = {
    scripture: `You are the SCRIPTURE AND CONTEXT reviewer. For every new question in the file: read each part with verse.py, with 4 or 5 verses around it. Check: (1) the first part, or first two, plainly states the fact asked; (2) every part is used where its own context supports it, and a cut span does not change what the verse means; (3) nothing in the chain suggests something the Bible does not say; (4) where accounts differ, the chain shows them fairly; (5) on sensitive matters (who killed Jesus) the chain gives the Bible's whole witness and never leads with a verse blaming one people; (6) a better, plainer verse that states the fact was not missed (search with find.py). Also check add_examples: the existing question's first two parts must state what each added example asks.`,
    matching: `You are the MATCHING reviewer. For every new question in the file: (1) search with qs.py (several word choices) for an existing question that already answers the same fact in its first two parts; if one exists, the new question should be dropped and its examples moved to add_examples of that id; (2) check whether the new question would take messages an existing question answers better: compare scopes and examples with qs.py --id; narrow the new question's also, signals and examples if so, or move a phrasing from the existing one if it belongs to the new one; (3) the also phrasings and examples are realistic, varied (short, long, misspelled, framed), and each asks THIS fact only; (4) signals are specific names or rare words, never generic words that would pull unrelated messages; (5) no example quotes a modern translation other than the BSB; (6) remove_also / remove_examples moves are right. Also check add_examples: each must be a way of asking what that existing question's first two parts answer.`,
  }
  return `${RULES}\n\n${TOOLS}\n\n${lenses[lens]}\n\nThe draft file is ${file}. Read it, run check_draft.py on it, and return a list of fixes: id (question id or "file"), severity ("must" for anything wrong, "drop" to remove a question, "should" for clear improvements), and the exact fix (which part, which replacement verse or words, which phrasing or example to change). Do not edit the file. Return an empty list if it is right.`
}

function fixPrompt(file, fixes) {
  const list = fixes.map((f) => `- [${f.lens}/${f.severity}] ${f.id}: ${f.fix}`).join('\n')
  return `${RULES}\n\n${TOOLS}\n\nYou own the draft file ${file}. Two reviewers returned these fixes:\n${list || '(none)'}\n\nApply every "must" and "drop" fix and every "should" fix you agree with after checking it with the tools; where you disagree, leave it and say why in notes. Edit the file in place (keep it valid JSON). Then run check_draft.py on it and fix every FAIL until none is left. Return the file, the ids it now holds, the FAIL count (0), what was dropped, and notes.`
}

phase('Survey')
const results = await pipeline(
  AREAS,
  (a) => agent(surveyPrompt(a), { label: `survey:${a.key}`, phase: 'Survey', schema: SURVEY_SCHEMA }),
  async (sv, a) => {
    if (!sv) return []
    const keep = sv.items.filter((it) => it.status !== 'none')
    const fresh = keep.filter((it) => it.status === 'new').sort((x, y) => x.rank - y.rank).slice(0, 16)
    const covered = keep.filter((it) => it.status === 'covered')
    const dropped = keep.filter((it) => it.status === 'new').length - fresh.length
    if (dropped > 0) log(`${a.key}: ${dropped} rarer new questions left out (cap 16)`)
    const groups = []
    for (let i = 0; i < fresh.length; i += 6) groups.push(fresh.slice(i, i + 6))
    if (!groups.length) groups.push([])
    groups[0] = groups[0].concat(covered)
    return parallel(groups.map((g, i) => () => {
      const file = `${R}/drafts/${a.key}-${i + 1}.json`
      return agent(writePrompt(a, g, file, i + 1), { label: `write:${a.key}-${i + 1}`, phase: 'Write', schema: DONE_SCHEMA })
    }))
  },
  (written) => parallel((written || []).filter(Boolean).map((w) => async () => {
    const [s, m] = await parallel([
      () => agent(reviewPrompt(w.file, 'scripture'), { label: `review:scripture:${w.file.split('/').pop()}`, phase: 'Review', schema: FIX_SCHEMA }),
      () => agent(reviewPrompt(w.file, 'matching'), { label: `review:matching:${w.file.split('/').pop()}`, phase: 'Review', schema: FIX_SCHEMA }),
    ])
    const fixes = [].concat((s && s.fixes || []).map((f) => ({ ...f, lens: 'scripture' })), (m && m.fixes || []).map((f) => ({ ...f, lens: 'matching' })))
    const done = await agent(fixPrompt(w.file, fixes), { label: `fix:${w.file.split('/').pop()}`, phase: 'Fix', schema: DONE_SCHEMA })
    return { written: w, fixes: fixes.length, done }
  })),
)
return { results }
