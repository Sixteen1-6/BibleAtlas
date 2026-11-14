export const meta = {
  name: 'ask-r14-answers',
  description: 'Survey common life situations, Bible facts and quoted verses Ask misses; draft Bible-only answers; review two ways; fix',
  phases: [
    { title: 'Survey', detail: 'one agent per area lists what people commonly bring and checks what already answers it' },
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

const AREAS = [
  { key: 'work', kind: 'life', scope: "Work and jobs: bosses and managers (harsh, unfair, much younger, playing favorites), coworkers who steal tips or take credit, write-ups and unfair rules, being docked pay, being overworked with no day off, being treated as a kid at work, being much older than the team, harassment or creepy comments from a boss or customer, temptations to cheat the company (fuel cards, time, stock) and making it right, quitting or staying, rude customers, being underpaid, working on the Sabbath, losing a job or work identity." },
  { key: 'money', kind: 'life', scope: "Money and housing: rent going up, bills and unexpected costs (vet, car, repairs), losing a wallet or money, debt, lending to family or friends who misuse it or never pay back, relatives always asking for money, friends or in-laws who expect free work or favors, someone taking advantage of an elderly parent's money, cosigning, small-stakes gambling and lotteries, pushy salespeople and scams, disagreements over a refund or purchase, church taxes and tithing questions, contentment when others have more." },
  { key: 'dating', kind: 'life', scope: "Dating and singleness: crushes and mixed signals, a reply that crushed you, being dumped again and again, late-night 'u up' texts, a partner who controls who you see, a much older partner (including a teen with an adult), waiting until marriage and being mocked for it, dating apps and judging Christians, trips together and how things look, being paired up by a pastor or family, hookup culture on trips or at college, breakups, liking someone who is not a believer, loneliness in singleness." },
  { key: 'marriage', kind: 'life', scope: "Marriage: a spouse always on the phone, rebuilding trust after an affair and the urge to check up, never arguing or always arguing, in-laws who interfere because they helped with money, a spouse's ex texting, a spouse who is at church every night, one spouse tracking every dollar, a spouse returning to work or changing careers, big purchases or midlife plans, decisions made without asking, trips apart, stepchildren and inheritance, aging together." },
  { key: 'parenting', kind: 'life', scope: "Parenting: a child afraid that a parent will die, a teen expressing himself in ways a parent hates and a parent's angry silence, reading a child's diary or phone, sleepovers and safety, a child who told classmates someone is in hell, letting a child go to college far away, a father who feels no bond with a new baby, a child's first grief (a pet), discipline, a child who left the faith, praying for grown children." },
  { key: 'family', kind: 'life', scope: "Family and relatives: a mean, aging parent who wants to move in, an elderly parent being used by someone for money, family secrets coming out at a funeral, jealousy when a younger sibling marries first, whether to speak up about a friend's or sibling's rushed marriage, a sibling dating someone much older, relatives of another faith asking you to join a ritual at a wedding or home, honoring hard parents, a brother in a violent crowd, family who only call when they need something, family pressure to marry." },
  { key: 'youth', kind: 'life', scope: "School and young adults: hiding failure from parents (pretending to attend university), a lie that grew, being falsely accused (of cheating or using AI), finding leaked exam answers, wanting to transfer or quit, homesickness, roommates and flatmates, enjoying power over others online or as a leader, peer pressure on trips and at parties, being mocked for faith or purity, faith that feels like an aesthetic or a performance, not being taken seriously because you are young, going to a fellowship for the free food, a resident adviser or friend who does not know how to help someone crying." },
  { key: 'hardship', kind: 'life', scope: "Hard times: feeling numb after years of caring for the dying (compassion fatigue), being wrongly imprisoned or punished and fighting bitterness, being robbed (a stolen pet, a stolen car) when police can do nothing, losing what you built (a channel, a business, a career), losing your identity when you cannot work, dark winters and low mood after moving abroad, being the only widow in a couples' group, a parent who feels nothing for a new baby, seeing a loved one ruin their health, sudden losses before a trip or holiday." },
  { key: 'church', kind: 'life', scope: "Church life: going to church or fellowship for the wrong reasons, worship music that annoys you or a neighbor who plays it loud, short mission trips that felt like tourism, being filmed or shown on a church livestream, a pastor pairing people for marriage, church elders who do not take the young seriously, officially leaving a church to stop paying church tax, a parent who calls depression a demon, being told to switch to a Christian counselor, a spouse who is always at church, visiting another church and taking communion, being judged by Christians." },
  { key: 'conscience', kind: 'life', scope: "Conscience and gray areas: a job that means playing or making things you think are wrong (filthy songs at weddings), a tattoo from an artist of another religion, dancing or performing, being with a group that fights, going to court to reduce a fine you deserved, small-stakes poker with coworkers, superstitions (burying a statue to sell a house, fortune tellers, charms), putting things in a casket, how things look to others, taking part in another religion's ceremony (a puja, a bar mitzvah kippah), whether a small lie to keep the peace is wrong." },
  { key: 'patriarchs', kind: 'fact', scope: "Genesis people and their families as facts: Terah and the idols (Josh 24:2), Abraham's age when he left Haran, Abraham's servant (Eliezer of Damascus in Gen 15:2; Gen 24 does not name him), Lot and his daughters, Isaac and Rebekah, Jacob's wives and which sons each bore, Joseph's full brothers, Joseph's Egyptian name and wife, why Joseph used an interpreter, Judah and Tamar, Esau and Edom, Ishmael, Noah's raven and dove, Nimrod, Melchizedek, Enoch, how the world was filled after the flood." },
  { key: 'exodusjudges', kind: 'fact', scope: "Moses to Ruth as facts: Moses' wife Zipporah and where she was from, Jethro, Moses' sons, the Hebrew midwives Shiphrah and Puah, Moses' age before Pharaoh (80), Aaron's sons, Eldad and Medad, the bronze serpent, Korah, the judges (how many, the first: Othniel; Ehud, Deborah and Barak, Jael, Gideon's many wives and seventy sons, Abimelech, Jephthah, Samson), Orpah and what became of her, Naomi, Boaz as kinsman-redeemer." },
  { key: 'kingsprophets', kind: 'fact', scope: "Samuel to Malachi as facts: how many sons Jesse had (1 Sam 16 and 1 Chr 2 shown fairly), David's mighty men, Michal, who reigned longest (Manasseh, 55 years) and shortest, the king who cut and burned Jeremiah's scroll (Jehoiakim) and the rewriting, Obadiah of 1 Kings 18 and the prophet Obadiah (show what the text says), Hosea's wife and children's names, how old Daniel was in the lions' den (show what the text gives), the height of Haman's gallows, how many returned with Zerubbabel (Ezra 2), Nineveh's 120,000, Jonah, Isaiah's sons, Ezekiel's wife." },
  { key: 'gospels', kind: 'fact', scope: "Gospel facts: the pool of Bethesda, how long Lazarus was dead, how many times Jesus found the disciples asleep in Gethsemane, who asked 'What is truth?', the wedding at Cana, the offering of two birds at Jesus' presentation (Lev 12:8), Simon of Cyrene and his sons, the widow's son at Nain, the high priest tearing his clothes, the charcoal fires in John 18 and 21, how far the boat was in John 21, Joseph of Arimathea's tomb, Malchus' ear, Zacchaeus, Bartimaeus, Jairus, Nicodemus, Legion, the 153 fish, the boy with the loaves, who the disciple Jesus loved was." },
  { key: 'actsletters', kind: 'fact', scope: "Acts and the letters as facts: Paul a tentmaker, Paul's teacher Gamaliel, Paul from Tarsus, how long Paul was blind, Ananias of Damascus, the 120 in the upper room, the 3,000 baptized at Pentecost, Elymas (Bar-Jesus) and Sergius Paulus, Eutychus, Lydia, Priscilla and Aquila, Apollos, Paul's shipwreck on Malta, Paul's thorn, Acts 20:35 'more blessed to give than to receive', Michael and the body of Moses (Jude 9), Onesimus, Demas, Andronicus and Junia (Rom 16:7, the text itself), Timothy's mother and grandmother." },
  { key: 'teaching', kind: 'fact', scope: "Teaching questions about puzzling texts and topics: the seven spirits before the throne (Rev 1:4; Isa 11:2; Rev 4:5; 5:6), whether the Holy Spirit is called he, whether God is also pictured as a mother (Matt 23:37; Isa 66:13; Isa 49:15), the Abyss, the streets of gold, whether the kingdoms were Satan's to give (Luke 4:6; John 12:31; 1 John 5:19), whether it rained before the flood (Gen 2:5-6), whether demons know the future, whether Judas gets a throne (Matt 19:28; Acts 1:20-26), the worm that does not die (Mark 9:48; Isa 66:24), the women with wings in Zechariah 5, Malachi 3:6 and the change from the old covenant to the new, praying on mountains, soul ties (1 Cor 6:16), a mother god, whether Elohim means many gods, getting a new name (Gen 17:5; Acts 13:9; Rev 2:17), the cloud of witnesses (Heb 11-12), whether Christians keep the feasts (Col 2:16-17; Zech 14:16), whether Satan was ever a baby (created: Ezek 28:15), whether we need glasses in heaven (bodies made new)." },
  { key: 'versesot', kind: 'verse', scope: "Old Testament verses people most often quote and ask about, which no prepared answer yet holds as its first part: for example Gen 50:20, Exod 14:14, Exod 20:12 (honoring a hard parent), Num 6:24-26, Deut 31:6, Josh 1:9, Josh 24:15, 1 Sam 16:7, Ruth 1:16, Ps 23, Ps 46:10, Ps 84:10, Ps 118:24, Ps 127:3, Prov 3:5-6, Prov 22:6, Prov 27:17, Song 2:15 (the little foxes), Eccl 3:1, Isa 40:31, Isa 41:10, Isa 43:2, Jer 29:11, Lam 3:22-23, Mic 6:8, Zeph 3:17. Check each with qs.py; take only those not already answered." },
  { key: 'versesnt', kind: 'verse', scope: "New Testament verses people most often quote and ask about, which no prepared answer yet holds as its first part: for example Matt 5:16, Matt 6:33, Matt 7:7, Matt 11:28, Matt 18:20, Matt 19:28, Luke 6:38, John 3:16, John 10:10, John 14:6, Acts 20:35, Rom 8:28, Rom 12:2, 1 Cor 10:13, 1 Cor 12 (the body), 1 Cor 13, 2 Cor 5:17 (new creation and an old record), 2 Cor 12:9, Gal 6:9, Eph 6:10-18, Phil 4:6-7, Phil 4:13, 1 Tim 4:12 (let no one despise your youth), Heb 11:1, Heb 12:1 (the cloud of witnesses), Jas 1:2-4, 1 Pet 5:7, Jude 9, Rev 3:20. Check each with qs.py; take only those not already answered." },
]
const CAP = { life: 10, fact: 14, verse: 12 }

const SURVEY_SCHEMA = { type: 'object', properties: {
  items: { type: 'array', items: { type: 'object', properties: {
    q: { type: 'string', description: 'the situation, fact question or verse question in plain words' },
    status: { type: 'string', enum: ['new', 'covered', 'none'] },
    id: { type: 'string', description: 'for covered: the existing question id whose first two parts answer it' },
    note: { type: 'string', description: 'the verses that answer it, or why it is covered or has no answer' },
    rank: { type: 'integer', description: '1 = brought very often, 3 = rarely' },
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

// The 180 blind-fresh13 messages round 13 still missed (kind | message), from eval/ask/verdicts/r13.
const MISSES = [
"0 | working black friday at best buy 5am to 3pm. havent had a day off in 11 days and people are already camping outside",
"0 | finally texted my crush first and 6 hours later he replied \"lol\". thats it. just lol",
"0 | landlord sent the renewal and rent is going up $275 in december. cant find anything cheaper within an hour of my job",
"0 | dropped out after one semester and every sunday the same sweet lady at church asks how college is going. i just say good",
"0 | everyone at my new job is like 45 and they call me kiddo in meetings. i have a degree and im 23",
"0 | i hate it here and i want to transfer so bad but my scholorship only works at this school",
"0 | lost my wallet with my id and debit card the night before my flight home for thanksgiving. have to be at the airport at 6am",
"0 | coworker keeps taking the cash tips off my tables when im in the back. manager is on his side bc theyre friends",
"0 | got a puppy in july and the vet bills are already $1,100. my landlord doesnt even know i have him",
"0 | keep getting dumped right around the 3 month mark. like clockwork. whats wrong with me",
"0 | im an RA and a girl on my floor comes to my door crying every single night and i lowkey have no idea what im doing",
"0 | got written up for clocking in 4 minutes late. i was literally in the parking lot",
"0 | phone screen is totally shattered and i cant afford a new one, half the time i cant even read my texts",
"0 | best friend is getting married at 20 to a guy she met in june and ngl i think its a huge mistake. do i say something or just smile in the pics",
"0 | little sister is 2 years younger than me and just got engaged. im happy for her but i also cried in my car after",
"0 | my bf wants me to stop hanging out with my guy friends, ive known some of them since 3rd grade",
"0 | ai detector flagged my english essay as 87% ai and i wrote every word myself. teacher gave me a zero",
"0 | me and my husband run a laundromat in the bronx. 3 dryers broke the same week, the repair guy want $4,200 and we are already 2 months behind with the supplier",
"0 | cashier at a gas station in tulsa. lady paid with a fake $100 and my manager is taking it out of my check, thats almost 2 days of work for me",
"0 | my fiances parents are hindu and want a small puja the morning of our wedding, just to bless both families they say. do i sit through it or will it hurt them if i dont",
"0 | hospice nurse 11 years. i used to cry with every family and now i feel nothing, not even at my own aunts funeral last week. that scares me more than anything",
"0 | my husbands kids from his first marriage want us to sign the house over to them now \"to skip probate\". we are 72 and 74 and he already said yes without asking me",
"0 | mother in law co-signed our mortgage and now she thinks she gets a say in what color we paint the kitchen and when we have kids",
"0 | 8 months since his affair and i check the mileage on his car every night to see if it matches where he said he went. now im the one who feels crazy",
"0 | married 9 years and we have never had one real argument. my wife says thats not healthy and wants us to see a counselor. i thought this was the goal??",
"0 | since our hamster died my 7 yr old asks every night at bedtime if im going to die and when. last night she cried for an hour and i didnt know what to say",
"0 | 15 yr old son started wearing eyeliner and black nail polish to school. my husband hasnt said one word to him in 2 weeks, they eat dinner in silence absolutly",
"0 | husband drinks like 6 energy drinks a day and his heart was doing 150 in the er last month. he says at least its not beer",
"0 | got out in march after 11 years in prison for a robbery i did not do. the state said sorry and gave me a bus ticket. how am i supposed to not hate everybody",
"0 | when i die and go to heaven will i still have to wear my glasses",
"0 | was satan ever a baby",
"0 | grandpa's funeral was saturday and two men showed up who look exactly like him. turns out he had a whole other family in tacoma. grandma is 86 and she was sitting right there",
"0 | i was the only widow in a couples small group of 12. i still go but i sit at the end of the table like the odd number. its been 3 years",
"0 | my 7 yr old told her whole class that her friends grandpa is in hell because he didnt go to church. the teacher called me and i honestly dont know where she got it",
"0 | funeral director here. a family asked me to put a bottle of crown royal and a lottery ticket in the casket with their dad. i did it. was that wrong",
"0 | 3 years on my youtube channel, 4,200 subscribers, and one copyright strike over a song playing in the background at a restaurant and its all gone ngl",
"0 | im 16 and my manager at the drive thru is like 30 and keeps calling me sweetheart and asking what i did this weekend. its probably nothing right, hes definately just being friendly",
"0 | getting baptized sunday and i almost drowned in my uncles pool when i was 6. what if i panic and grab the pastor in front of everybody",
"0 | somebody posted the final exam answers in a shared google drive the night before. i havent opened it. the link is still sitting in my messages",
"0 | our dog got stolen out of the backyard in broad daylight and i watched the guy do it on the ring camera from work. police say theres nothing they can do",
"0 | my husband job send him to riyadh for 2 years and we go with the kids but i cannot work there. i was nurse 15 years. i dont know who i am if i am not working",
"0 | my wife had the baby in august and im the one who feels nothing for him. i hold him and its like holding someone elses kid. dads arent supposed to get this right",
"0 | moved from lagos to aberdeen in october and its dark by 3:30. my kids ask if the sun is broken and honestly i feel like something in me is too",
"0 | first time at a catholic funeral and everyone went up for the bread so i went too. my coworker said i wasnt supposed to. did i do something realy bad",
"0 | a boy of 19 who mow my mother lawn call her grandma, and now she give him half her pension every month. she is 88 and say he is the only one who visit her. what i do",
"1 | my parents wrote my profile on a christian matrimony site and put 'prays daily, homely, no bad habits'. i do not pray daily and im not homely lol. the boys family is visiting on sunday in chennai. do i just play along",
"1 | honestly i only started going to the international student fellowship for the free dinner on fridays. 4 months in and im still mostly there for the jollof. is god ok with that or am i using them",
"1 | cousin in pampanga keeps asking me to gcash him for 'emergencies' and everyone knows its for online sabong. tita says family helps family no matter what. do i keep sending it",
"1 | first payslip in munich and theres 38 euros kirchensteuer gone every month. all my coworkers just officially left the church to stop paying. if i sign out on paper am i leaving god or just a tax",
"1 | roommate is on day 51 of 75 hard and keeps saying shes more disciplined than christians who cant even read the bible 10 min a day. she kinda has a point and it stings",
"1 | guy in the room next to mine in halls blasts hillsong at 7am every single day. im a christian and its making me hate worship songs lol. how do i love this man",
"1 | my sister is 17 and dating a 25 yr old from her gym and my parents are fine with it bc he plays drums on the worship team. am i crazy for thinking this is wrong",
"1 | turnitin said my essay is 41% ai and i wrote every word myself at 3am. hearing is on the 12th. how do i stay calm when im telling the truth and nobody believes me",
"1 | au pair in lyon. the dad keeps 'accidentally' walking in when im in the bathroom and comments on my clothes. i need this visa and the money and the kids love me. what do i do",
"1 | admin on a minecraft server with like 300 players and i banned a 12 yr old for a week just bc he was annoying me. he messaged me crying. i think i like the power too much",
"1 | lowkey i swipe left on every guy whose hinge says christian bc in my experience theyre the most judgy. im a christian too lol. am i the problem?",
"1 | my fyp is all christian girl aesthetic stuff, linen dresses, iced coffee next to a pastel study bible, cottagecore prayer journals. sometimes i feel like my faith is just a vibe im curating",
"1 | gap year in thailand and everyone at the hostels hooks up with someone new every week. im 19, never done anything, and i feel like the odd one out on every island. how do i not cave just to fit in",
"1 | my brother is in the ultras for our club in belgrade and every derby ends with flares and a fight. i go with him but i never throw punches. am i still part of it",
"1 | our church in lagos has a singles fellowship and the pastor pairs people up and announces it from the pulpit. he paired me with a brother i honestly do not like. if i say no am i fighting gods will",
"1 | came back from a 10 day mission trip in the dominican republic where we painted a school wall that i found out gets repainted by every group that comes. was it just poverty tourism with selfies",
"1 | mum keeps saying i have a 'spirit of laziness' bc i sleep till noon. i literally have a depression diagnosis and im on a waitlist for help. how do i make her see its not a demon",
"1 | i dj weddings on weekends in cape town and couples keep requesting songs with the filthiest lyrics. its my main income. if i play them am i part of it",
"1 | mum wants me to find a christian therapist bc mine is a lesbian. but this woman is the first person who actually helped my panic attacks. do i have to switch",
"1 | he only ever texts 'u up' after midnight and i always answer. how do i stop being so available for someone who doesnt want me in daylight",
"1 | 23, guy, decided to wait till marriage and the lads at my rugby club in cork take the piss every single weekend. even my older brother joins in. how do i not get bitter",
"1 | failed every module first year and ive been pretending to go to uni for 4 months. my mum still packs me lunch and she definately thinks im in second year. how do i tell her",
"1 | flatmates named the group chat after me being skint and always late on splitwise. honestly fair. how do i stop being that guy",
"1 | church livestream zoomed in on me crying at the altar sunday and now its the youtube thumbnail with 12k views. i want it gone but i dont want to make a fuss or seem ungrateful",
"1 | the best tattoo artist in my city is an open satanist, pentagrams all over the studio, but hes booked till june and honestly so kind. does it matter whose hands put the ink in",
"1 | got into a dance conservatory in amsterdam on a full ride and my dad says dancing on a stage for strangers is sensual and he wont come to a single show. do i go anyway",
"1 | bereal went off at a house party and my parents think i was at the library. i didnt post it but now my friends keep asking where my bereal is. how did one lie get this big",
"1 | bf wants to take me to cancun for my birthday and says we'll get a room with two beds. my mom says it looks bad even if nothing happens. does how it looks even matter",
"1 | 13 yr old got invited to a sleepover and we never met the parents. dont even know who else lives in that house. am i overprotective if i say no",
"1 | after 10 years home with the kids my wife wants to go back to nursing. i should be happy for her but ngl i feel wierd about it",
"1 | got a ticket for 52 in a 35. i was speeding, no excuse. is it dishonest to go to court and try to get it knocked down",
"1 | old widow next door, her grass is up to my knees now. she is very proud and always say she is fine. how i can help without embarassing her",
"1 | my husbands ex wife texts him late at night about stuff that has nothing to do with their kids. he says im being insecure",
"1 | guys from work do poker friday nights, $5 buy in. thats not really gambling right",
"1 | last year i used the company gas card to fill up my own car twice when i was broke before payday. nobody noticed. how do i make it right without losing my job",
"1 | im 64 and my husband just bought a motorcycle and wants to ride across the country this summer. our kids think hes having a crisis",
"1 | daughter left her diary on the bed and i read it. now i know things i cant unknow and she has no idea",
"1 | wife is on her phone through every dinner. i put mine away and she doesnt even notice",
"1 | guy selling solar panels wont get off my porch. how do i say no without being rude, im trying to be a good christian",
"1 | brother in law calls me every time a pipe leaks because im a plumber. never once offered to pay. how do i bring it up",
"1 | my new manager is younger than my daughter and talk to me like i am stupid. i have 30 years in this work",
"1 | tax refund came, $2,400. husband wants a new tv, i want to pay down the car. who wins lol",
"1 | wife wants a girls trip to vegas with her friends from work. i trust her, i dont trust vegas",
"1 | our daughter got into a college 2,000 miles away and we want her to pick the one 40 min from home. are we being selfish",
"1 | husband is at church every night of the week, worship practice, deacon meeting, mens group. hes never home with us",
"1 | wife tracks every dollar i spend on an app and asks about each one. i feel like a kid on an allowance",
"2 | astro 101 question. if creation was only a few thousand years ago how are we seeing light from galaxies millions of light years away. did god just make the light already on its way here",
"2 | my neuro professor said love is just dopamine and oxytocin, literally chemicals. so when 1 john says god is love does that make god a brain chemical or is the bible talking about something else",
"2 | someone on tiktok said the holy spirit is actually a she because ruach is a feminine word in hebrew. is that real or just grammar",
"2 | jesus says he wanted to gather jerusalem like a hen gathers her chicks. so does god have mom energy too or is he only ever called father",
"2 | in luke 8 the demons literally beg jesus not to send them into the abyss. what is the abyss and why would demons be scared of anything",
"2 | revalation 1 says grace from the seven spirits which are before his throne. i thought there was ONE holy spirit, who are the other 6",
"2 | why does heaven have streets of gold. doesnt jesus say not to care about treasure on earth? feels kinda flexy for god ngl",
"2 | satan showed jesus all the kingdoms of the world and said ill give you all this because its been handed to me. were they actually satans to give??",
"2 | genesis 2 says god had not caused it to rain and a mist watered the ground. so did it literally never rain untill noahs flood? thats like 1600 years of no rain",
"2 | physics major here. in quantum mechanics some things are actually random, like which way an electron spin comes out when you measure it. does god know the result ahead of time or does random mean even he doesnt",
"2 | 1 kings 20 a prophet tells his buddy hit me, the buddy says no, and then a lion kills him for saying no. bro i also wouldnt punch my friend. what",
"2 | revelation 6 says the stars fell to earth like figs shaken off a tree. stars are way bigger than earth, one would swallow the whole planet. how does that work",
"2 | mark 9 says hell is where their worm dieth not and the fire is not quenched. what worm?? is there an actual worm",
"2 | are there girl angels? every angel in the bible seems like a guy but zechariah 5 has two women with wings like a stork. who are they",
"2 | my best friends bar mitzvah is in november and the invite says men wear a kippah. can i wear one as a christian or is that like pretending to be jewish",
"2 | malachi 3:6 says i am the lord, i change not. but the old testament has no pork, animal sacrifices, stoning for the sabbath, and then the new testament drops all of it. how is that not god changing",
"2 | every august my halmoni goes up to a prayer mountain near paju and sleeps 3 nights in a tiny prayer cave. this year she wants me to come with her. is going up a mountain to pray actually from the bible or is it just korean church culture",
"2 | rafted the grand canyon in may and the guide kept saying 2 billion years of rock layers. my church says noahs flood carved it in one year. does the bible say anything about how long the water took to go down",
"2 | john 5 in my bsb goes from verse 3 straight to verse 5?? my lolas bible has an angel that went down at a certain season and troubled the water at bethesda. where did verse 4 go, and did the angel thing really happen",
"2 | fortune teller at the palengke told my tita her husband would get sick before christmas and he did. pastor says its demons. but how can demons know something that hasnt happened yet, can they see the future",
"2 | matthew 19:28 jesus tells the twelve ye also shall sit upon twelve thrones. judas was one of the twelve standing right there. so does judas get a throne or does matthias take his chair",
"2 | romans 16:7 salute andronicus and junia, who are of note among the apostles. our ladies group argued 40 minutes if junia was a woman and if that means a woman was an apostle. what does the verse really say",
"2 | who is the disciple whom jesus loved in johns gospel, and why does it never just say his name",
"2 | if only 8 people came off the ark how are there 8 billion of us now? my nephew in nairobi did it on his calculator and says the numbers dont work",
"2 | ladies from a church called world mission society stopped me outside westfield in sydney and asked if i knew about god the mother. they showed me revelation 22:17, the Spirit and the bride say, Come. is there a mother god in the bible",
"2 | youth leader says if you sleep with someone you create a soul tie that follows you forever until you break it in prayer. is soul tie actually in the bible or just a church word",
"2 | realtor told my mother (80, catholic all her life) to bury a little st joseph statue upside down by the for sale sign so the house sells before christmas. superstition or harmless",
"2 | hebrews 12 says we are compassed about with so great a cloud of witnesses. does that mean my husband who passed in 2019 is watching me run my race? i talk to his photo every night before bed",
"2 | our messianic jewish friends build a sukkah in their backyard every october for the feast of tabernacles and invited us to eat in it. zechariah 14 says all nations will go up to keep that feast someday. are christians supposed to keep it",
"2 | my hebrew lecturer said elohim is a plural word. so did the israelites believe in many gods at first and only later one god?",
"2 | in our church in tirunelveli the pastor gives everyone a new bible name at baptism, so i became david. now my appa is angry i dropped the family name. is getting a new name when you are baptized from the bible",
"3 | bible quiz at youth on thursday and i blanked, whats the name of the pool in jerusalem where jesus healed the guy who couldnt walk",
"3 | whats moses wifes name and where was she from? doing a family tree poster for religion class",
"3 | lazarus had been dead how many days by the time jesus finally showed up",
"3 | how many times did jesus go back and find peter james and john asleep in the garden. ngl i would of fallen asleep too",
"3 | started judges on my bible in a year app this week (day 61 lol) and theres so many names. how many judges are there total",
"3 | pharaoh gave joseph an egyptian name and an egyptian wife right? what were their names",
"3 | moses was like 80 when he went back to face pharaoh?? is that right, im 26 and already feel behind lol",
"3 | my friend says abrahams dad sold idols for a living. is that in the bible or just a story people tell",
"3 | who said \"what is truth\" to jesus. it was in a song at chapel this morning and nobody at my table knew",
"3 | about how many people came back to jerusalem from babylon with zerubbabel",
"3 | paul made tents for money?? my roommate said that in our dorm at 2am and i thought she was trolling me",
"3 | who reigned the longest out of all the kings of israel and judah",
"3 | who was pauls teacher back before he became a christian",
"3 | gideon had 70 sons?? thought that was a typo. how many wives did he have",
"3 | davids brothers, was it 7 or 8? 1 samuel and 1 chronicles dont match up on my reading plan",
"3 | daniel in the lions den, how old was he by then? every cartoon draws him like 20",
"3 | how many people were in the upper room when the holy spirit came at pentecost",
"3 | after paul saw the light on the way to damascus how long was he blind",
"3 | who wrote lamentations",
"3 | simon of cyrene who carried the cross, mark says he was the father of alexander and rufus. why would mark name his sons, were they famous or something",
"3 | jesus was buried in joseph of arimatheas own new tomb. so after easter did joseph just get his tomb back and get buried there later? asking for my 10 year old",
"3 | john 21 peter puts his coat ON and then jumps in the lake to swim to jesus. who gets dressed to go swiming lol. how far out was the boat",
"3 | peter denied jesus standing by a charcoal fire and then after jesus rose he made them breakfast on a charcoal fire. coincidence or did john put that on purpose",
"3 | who actually got married at the wedding in cana? my nan swore till the day she died it was john the disciples own wedding",
"3 | when they brought baby jesus to the temple his parents gave two birds instead of a lamb. pastor said that proves they were poor, where is that rule",
"3 | the widow at nain, jesus walks up and touches the coffin and the dead young man sits up and starts talking. where is nain, and wasnt touching a coffin against the law for a jew",
"3 | at jesus trial the high priest tore his own clothes. why tear clothes? my mum in lagos tears her wrapper at funerals, same thing or different",
"3 | genesis 24 abrahams servant finds rebekah at the well with the 10 camels but the chapter never says his name. my son keeps saying eliezer, where does he get that from",
"3 | noah sent out a raven first, before the dove right? what happend to the raven, did it ever come back to the ark",
"3 | was abrahams dad terah an idol worshiper? and how old was abraham when they left haran, my daughters sunday school sheet says 75",
"3 | how many of josephs brothers had the same mother as him, only benjamin? and who were the moms of the other 10. i drew the family tree on the back of a receipt and got lost",
"3 | why joseph speak to his brothers through interpreter in egypt when he understand every word they say? what language they speak at home",
"3 | what were the names of the 2 midwives who wouldnt kill the hebrew baby boys? my daughter wants one of them for her baby due in february",
"3 | numbers 11 two guys called eldad and medad start prophesying in the camp and joshua wants moses to stop them. who were they and why werent they at the tent with the others",
"3 | who was the very first judge after joshua died. our church quiz team meets in march and we only know gideon and samson",
"3 | is it true oprahs name was supposed to be orpah from the book of ruth? and what happened to orpah after she went back to moab",
"3 | 1 samuel 16 says jesse had 8 sons with david the youngest but 1 chronicles 2 only lists 7. so which is it, what happened to number 8",
"3 | jeremiah 36 the king cuts the scroll with a knife a few columns at a time and throws it in the fire. which king did that and did jeremiah have to write the whole thing again",
"3 | hosea named his kids not loved and not my people?? what were their actual names. our kids are named after bible people and i just want to make sure lol",
"3 | jonah 4 god says nineveh has 120,000 people that cannot discern between their right hand and their left. is that only the little kids or everybody in the city",
"3 | 1 kings 18 says obadiah hid 100 prophets in two caves from jezebel. is this the same obadiah that wrote the short book or a different guy",
"3 | how tall were the gallows haman built for mordecai? 50 cubits is like 75 feet, for one man??",
"3 | how many jews came back from babylon with zerubbabel? ezra 2 says the whole assembly was 42,360 but when i add up the list on my phone calculator i get way less",
"3 | 3000 people baptized on the day of pentecost. where in jerusalem did they find enough water to baptize that many in one day",
"3 | paul made a sorcerer go blind on the island of cyprus. what was the mans name, i think the bible gives him 2 names",
"3 | who wrote lamentations? my bible doesnt put any name at the top",
"4 | got out of pollsmoor in april and gave my life to jesus inside. 2 corinthians 5:17 says old things are passed away, all things are become new. so do i still have to tell employers about my record or is new creature only about how god sees me",
"4 | the speaker at our young couples retreat in nairobi said song of songs 2:15, the little foxes that spoil the vines, means small sins that ruin a relationship. is that what the foxes actually are or did he make it up",
"4 | im 19 and just got asked to lead the youth band at our church in chennai and the uncles wont take me seriously. 1 tim 4:12 let no man despise thy youth. can i pull that verse on them or is that disrespectful",
"4 | jude 9 says michael the archangel argued with the devil about the body of moses. where is that story?? checked deuteronomy 34 and its not there. catholic from kraków and we never once covered jude in religion class",
"4 | running my first marathon in iten in feb. hebrews 12:1 says we are compassed about with so great a cloud of witnesses. is that saying dead people are in the stands watching us run",
"4 | acts 20:35 paul says remember the words of the lord jesus, it is more blessed to give than to receive. searched all four gospels on my phone and jesus never says that?? where did paul get it",
"4 | church in daegu says 1 corinthians 12 means everyone has to join a ministry team or youre a useless body part. i teach at a hagwon 6 days a week. is that really what the chapter says",
"4 | i do outreach for farmworkers in salinas and the women get harassed in the fields constantly. in ruth 2 boaz tells his young men not to touch her. was ruth actually in danger out there? why did he have to say that",
"4 | exodus 20:12 honour thy father and thy mother. dad is 91, mean as a snake, and wants to move in with us. does honoring him mean i have to say yes",
"4 | joshua 24:15 as for me and my house we will serve the lord has hung over our front door since 1992. both our grown kids quit church. is the sign a lie now? did joshuas own family keep it",
"4 | acts 20:35 paul says remember the words of the lord jesus, it is more blessed to give than to recieve. i looked through all 4 gospels and cant find jesus saying it. where did paul get it",
"4 | psalm 84:10 i had rather be a doorkeeper in the house of my god. ive been the usher at the front door for 33 years. what did a doorkeeper do back then"
]
const misses = (args.misses || MISSES).join('\n')
const WHO = { life: 'people (teenagers, students, workers, parents, the old, new believers, people from many countries)', fact: 'people (teenagers, friends, new believers, curious skeptics, parents, quiz teams)', verse: 'people (believers, new readers, people in hard times)' }

function surveyPrompt(a) {
  return `${RULES[a.kind]}\n\n${TOOLS}\n\nYour area: ${a.scope}\n\nTask: list what ${WHO[a.kind]} most often bring to the box in your area, in plain words, 20 to 30 items. For EACH one, check whether an existing prepared question already answers it: search with qs.py using several key words, then read the candidates' first parts (qs.py --id). Mark:\n- "covered" with that id only if the existing question's FIRST TWO parts answer it (a related chain that answers it only at part 5 is not covered);\n- "new" if no existing question's first two parts answer it and the Bible's text does;\n- "none" if the Bible's text gives no answer.\nIn note, give the verse references that answer it (check them with verse.py). Rank how often people bring it.\n\nThese real test messages got no good answer from the box (some in your area, most not; the number is the kind: 0 what is happening to me, 1 what should I do, 2 faith and teaching, 3 plain facts, 4 a named verse). Include every one in your area as an item, in general words:\n${misses}\n\nStay inside your area; other agents cover the rest.`
}

function writePrompt(a, items, file, part) {
  const list = items.map((it) => `- ${it.q}  [${it.status}${it.id ? ' ' + it.id : ''}] ${it.note}`).join('\n')
  return `${RULES[a.kind]}\n\n${TOOLS}\n\nYour area: ${a.scope}\n\nWrite the draft file ${file} (part ${part} of your area). Handle these items:\n${list}\n\nFor each "new" item, write one new question with its chain, also, signals, topics and 20 to 30 examples (merge items that are the same into one question; drop any that turn out to be covered or unanswerable, and say so). Look at two or three existing questions of the same group with qs.py --id first, to match their style. For each "covered" item, add 3 to 8 add_examples to that existing id, only after reading its chain with qs.py --id and confirming its first two parts answer each added message. If an existing question holds a phrasing or example that belongs to your new question rather than to it, move it with remove_also / remove_examples and add it to yours.\nRead every verse in its context with verse.py before using it. Copy words exactly. Then run check_draft.py on your file and fix every FAIL, and look at every NOTE (an untied part may still pass the build through a cross-reference or root, but prefer a topic or phrasing that ties it). Repeat until there are no FAIL lines. Return the file path, the ids you wrote, the number of FAIL lines left (0), anything dropped, and short notes.`
}

function reviewPrompt(a, file, lens) {
  const first = { fact: 'the first part, or first two, plainly states the fact asked', life: 'the first part, or first two, speaks most directly to the situation in the heading and in each example', verse: 'the named verse is the first part or follows a part that sets its scene, and the parts after it show what it means from its context and the rest of Scripture' }[a.kind]
  const lenses = {
    scripture: `You are the SCRIPTURE AND CONTEXT reviewer. For every new question in the file: read each part with verse.py, with 4 or 5 verses around it. Check: (1) ${first}; (2) every part is used where its own context supports it, and a cut span does not change what the verse means; (3) nothing in the chain suggests something the Bible does not say, or applies a promise or a command beyond its sense; (4) where accounts differ, the chain shows them fairly; (5) on sensitive matters (abuse, harassment, grief, depression, other religions, who killed Jesus) the chain gives the Bible's whole witness, never tells a victim to endure abuse, never shames the hurting, and never insults people of other churches or faiths; (6) a better, plainer verse was not missed (search with find.py). Also check add_examples: the existing question's first two parts must answer each added message.`,
    matching: `You are the MATCHING reviewer. For every new question in the file: (1) search with qs.py (several word choices) for an existing question that already answers the same thing in its first two parts; if one exists, the new question should be dropped and its examples moved to add_examples of that id; (2) check whether the new question would take messages an existing question answers better: compare scopes and examples with qs.py --id; narrow the new question's also, signals and examples if so, or move a phrasing from the existing one if it belongs to the new one; (3) the also phrasings and examples are realistic, varied (short and long, misspelled, framed, from many kinds of people), and each is a message THIS chain truly answers; (4) signals are specific names or rare words, never generic words that would pull unrelated messages; (5) no example quotes a modern translation other than the BSB, and none copies a test message word for word; (6) remove_also / remove_examples moves are right. Also check add_examples: each must be a message that existing question's first two parts answer.`,
  }
  return `${RULES[a.kind]}\n\n${TOOLS}\n\n${lenses[lens]}\n\nThe draft file is ${file}. Read it, run check_draft.py on it, and return a list of fixes: id (question id or "file"), severity ("must" for anything wrong, "drop" to remove a question, "should" for clear improvements), and the exact fix (which part, which replacement verse or words, which phrasing or example to change). Do not edit the file. Return an empty list if it is right.`
}

function fixPrompt(a, file, fixes) {
  const list = fixes.map((f) => `- [${f.lens}/${f.severity}] ${f.id}: ${f.fix}`).join('\n')
  return `${RULES[a.kind]}\n\n${TOOLS}\n\nYou own the draft file ${file}. Two reviewers returned these fixes:\n${list || '(none)'}\n\nApply every "must" and "drop" fix and every "should" fix you agree with after checking it with the tools; where you disagree, leave it and say why in notes. Edit the file in place (keep it valid JSON). Then run check_draft.py on it and fix every FAIL until none is left. Return the file, the ids it now holds, the FAIL count (0), what was dropped, and notes.`
}

const RUN = args.only ? AREAS.filter((a) => args.only.includes(a.key)) : AREAS
log(`areas: ${RUN.map((a) => a.key).join(', ')}`)
phase('Survey')
const results = await pipeline(
  RUN,
  (a) => agent(surveyPrompt(a), { label: `survey:${a.key}`, phase: 'Survey', schema: SURVEY_SCHEMA }),
  async (sv, a) => {
    if (!sv) return []
    const keep = sv.items.filter((it) => it.status !== 'none')
    const all = keep.filter((it) => it.status === 'new').sort((x, y) => x.rank - y.rank)
    const fresh = all.slice(0, CAP[a.kind])
    const covered = keep.filter((it) => it.status === 'covered')
    if (all.length > fresh.length) log(`${a.key}: ${all.length - fresh.length} rarer new items left out (cap ${CAP[a.kind]}): ${all.slice(fresh.length).map((it) => it.q).join(' | ')}`)
    const groups = []
    for (let i = 0; i < fresh.length; i += 5) groups.push(fresh.slice(i, i + 5))
    if (!groups.length) groups.push([])
    groups[0] = groups[0].concat(covered)
    return parallel(groups.map((g, i) => () => {
      const file = `${R}/drafts/${a.key}-${i + 1}.json`
      return agent(writePrompt(a, g, file, i + 1), { label: `write:${a.key}-${i + 1}`, phase: 'Write', schema: DONE_SCHEMA })
    }))
  },
  (written, a) => parallel((written || []).filter(Boolean).map((w) => async () => {
    const name = w.file.split('/').pop()
    const [s, m] = await parallel([
      () => agent(reviewPrompt(a, w.file, 'scripture'), { label: `review:scripture:${name}`, phase: 'Review', schema: FIX_SCHEMA }),
      () => agent(reviewPrompt(a, w.file, 'matching'), { label: `review:matching:${name}`, phase: 'Review', schema: FIX_SCHEMA }),
    ])
    const fixes = [].concat((s && s.fixes || []).map((f) => ({ ...f, lens: 'scripture' })), (m && m.fixes || []).map((f) => ({ ...f, lens: 'matching' })))
    const done = await agent(fixPrompt(a, w.file, fixes), { label: `fix:${name}`, phase: 'Fix', schema: DONE_SCHEMA })
    return { written: w, fixes: fixes.length, done }
  })),
)
return { results }
