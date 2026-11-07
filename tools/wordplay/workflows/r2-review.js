export const meta = {
  name: 'r2-review',
  description: 'Review the new writers structures, mirror notes and additions against the Layers corrections of PR 76, then an adversarial second reader',
  phases: [{ title: 'Review', detail: 're-read each cite and fix each entry against the lessons' }, { title: 'Confirm', detail: 'second reader refutes wrong changes and catches misses' }],
}
const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const F = `${W}/fig`
const NS = `${W}/ns`
const R = `${NS}/research.json`
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const ENV = `ATLAS_SOURCES_EXTRA=${NS}/main-sources.json`
const TODAY = args.today
const FILE = args.file
const ITEM = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['note', 'structure', 'addition', 'revive'] },
    id: { type: 'string', description: 'the note or structure id (for an addition or revive, the target id)' },
    file: { type: 'string', description: 'config/figures or config/structures.json' },
    entry: { type: 'object', description: 'the whole final note or structure (for an addition or revive: the target, whole, with the new cite in its cites, the strength recounted and the evidence naming the new writer); every cite keeps found, and a cite you changed or read again gets found (the page you fetched, with the UTC time) and context' },
    verdict: { type: 'string', enum: ['keep', 'fix', 'drop'] },
    reason: { type: 'string' },
  },
  required: ['type', 'id', 'file', 'entry', 'verdict', 'reason'],
}
const CHANGE = { type: 'object', properties: { id: { type: 'string' }, field: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, lesson: { type: 'string' } }, required: ['id', 'field', 'before', 'after', 'lesson'] }
const OUT = { type: 'object', properties: { items: { type: 'array', items: ITEM }, changes: { type: 'array', items: CHANGE }, fetches: { type: 'number' }, check: { type: 'string', description: 'the last lines the checks printed' } }, required: ['items', 'changes', 'fetches', 'check'] }

const ABOUT = `Bible Atlas is a Bible study app. At its Deep level, behind a notice that this is commentary, it shows how passages are built (config/structures.json: mirrors or chiasms, alternations, bookends, refrains) and parallel lines and figures (config/figures), each citing the Christian writers who state it. The owner, Shubhanshu, asked on 2026-11-01 that writers who believe the Bible and do not contradict it be added, and that large chiasms and structures be shown at Deep; so Robert Lowth, John Jebb, Thomas Boys and John Forbes, who first set out the Bible's parallel and introverted structures, were added to the cite list (cite ids lowth, jebb, boys, forbes; Lowth's Isaiah, work lowth-isaiah, is proposed with these entries). Only Bible-believing writers are cited, never liberal critics. Everything goes live once it passes the build's checks, so every quotation must be real and every claim the writer's own.`

const SITUATION = `The entries in your group were found in those writers' scans by one reader and checked against the scan by a second; all pass the checks. They go to the app's maintainers next: notes and additions to config/figures to the Layers thread, structures to the thread that owns config/structures.json. The last batch of our notes that went to Layers came back with corrections. The lessons below are those corrections, with the real cases. These entries must already meet every one. Most will be right as they are: change only what a lesson, or a plain error, calls for, and never rewrite a sound sentence for style.
Item types: "note" (a parallelism note for config/figures), "structure" (an entry for config/structures.json), "addition" (a live note or structure already in the app, and one new cite from these writers to add to it: return the target whole with the cite added, the strength recounted and the evidence naming the new writer and saying only what his quote says; verdict drop if his quote does not state what the target states), "revive" (a note held out of an earlier hand-off for the reason given, and a cite from these writers: rebuild it so it can stand, under the same rules, or drop it).`

const LESSONS = `The lessons (number each change by its lesson):
1. Evidence says only what each cited quote says. Every claim the evidence makes for a writer must be in his quoted words in his cite; a claim from elsewhere in his remark, or from a writer with no cite in the entry, is trimmed (or the quote widened, lesson 2). Cases: Jonah 3:10 ended "Bullinger files God's relenting in Jeremiah 18:8 under Anthropopatheia" with no Bullinger cite: cut. 1 Samuel 15:11 said "Spence (Ellicott) says verse 11 speaks in human language", but his quote is on verse 29: it became "Spence (Ellicott), on verse 29: speaking in human language, the Lord is said to repent." Genesis 22:11 claimed more about Bullinger's list than his quote said: trimmed to what the quote says.
2. The quote must carry the point it is cited for: that these parts answer each other in the way the entry says (the first to the last, the second to the next to last; or the lines alternate; or a line is set against its opposite). If the quoted words alone do not say it, widen the quote with more of his words on the same page, word for word, in order, parts joined with " ... ", 400 characters at most. Cases: Isaiah 55:8's "In verses 8 and 9 taken together, the figure is a simple Epanodos" was widened to show which words are a and b ("Here in a and a we have “thoughts”; while in b and b we have “ways.”"); Mark 7:9's quote was widened to the words that say what the irony is. A quote of the Bible text he lays out is not his words and never carries the point.
3. cite.on is the verse or range his remark is on, as he heads it. Cases: "Exodus 13:8" became "Exodus 13:8-9" and "Exodus 16:2" became "Exodus 16:6-7" because the remarks were on those verses.
4. For Bullinger (bullinger-fos), at and any figure part use his own heading words for the place, as figname.py prints them. Case: "human actions given to inanimate things" became "inanimate things".
5. Hebrew or Greek wording names its writer: "In Paul's Greek", "In John's Greek", never a bare "In Greek" where the book's writer is known; "In Hebrew" for the Old Testament.
6. A limit never claims unnamed dissent ("some read", "others take") unless a cited writer's quoted words say so; otherwise trim it or leave the limit out.
7. Parallel lines in verses the BSB sets as poetry are its own lines: each line of a parallel note is one of the BSB's lines, part of one, or whole lines together, and for same, opposite, building and climbing no two of a note's lines share one. poetrycheck.py checks it; poetrycheck.py --lines "<ref>" prints a verse's lines. Case: Proverbs 26:3's three lines became two, the BSB's first line being "A whip for the horse, a bridle for the donkey,", and short and about followed. Structures' members are not checked for poetry lines.
8. Our own words (short, about, limit) are plain sentences that say no more than the cited writers state and never copy a writer's phrasing closely (Exodus 6:6's "Since a man's strength lies so largely in his arms", a writer's words, became "Since much of a man's strength is in his arms").
9. Strength is the number of different writers among the cites, by resolve.py's key (3 or more "widely agreed", 2 "commonly held", 1 "some interpreters"). One man's words count once: when a commentator quotes Lowth, Jebb or another writer (Clarke and Barnes often quote Lowth), those words are that writer's, so cite the writer himself from his own book, never twice.`

const RULES = `Rules that still hold:
- Quote only a writer's own words, by the quote rule for his work in the research (python3 -I -c "import json; print(json.dumps(json.load(open('${R}'))['<lowth|jebb|boys|forbes>'], ensure_ascii=False, indent=1))": scans, page rules, quote rules): never the Bible text he lays out, never his rearrangement of a verse, never words he quotes from another (Forbes quotes Jebb and Lowth; Boys quotes Lowth and Jebb; Jebb reviews Lowth), never notes Gregory or Michaelis added to Lowth's Lectures, never his Greek or Hebrew as the OCR gives it. Set the long s as s and correct only plain OCR misreadings.
- He must state the structure himself, and its members must be the BSB's, in its order. Where his parts depend on a change to the received Hebrew or Greek that the BSB does not follow, leave it out (decision 23(4)).
- Other quotable writers for a second cite: henry, barnes, jfb, keil-delitzsch, ellicott, benson, poole, calvin, clarke, bengel, maclaren, chrysostom, catena-aurea, edersheim, bullinger-fos. Never Gill, Spurgeon, the Pulpit, the Geneva notes, the Companion Bible, Henry's Concise or Wesley. Never Ellicott on Psalms, Song of Solomon, Obadiah, Jonah or Ecclesiastes; Keil and Delitzsch on Ecclesiastes. Never a rabbi or Jewish commentator, even when a writer quotes one (check for "Jarchi", "Kimchi", "Aben Ezra" by hand). Never a remark that calls a book or its events fiction or the text in error.
- Our own words name no writer or work; any quotation of four or more words in short, about, evidence or limit is BSB text of the entry's passage. No em dashes, no mention of the ESV, nothing about how an entry was made (never AI, drafting, reviewing or checking).
- Limits: notes short 52, about 300, evidence 400, limit 300; structures short 60, about 300, evidence 400; quotes 20 to 400 characters.`

const TOOLS = `Tools (python3 -I; never download, clone or install anything; write files only in ${NS}/review/work/<your key>/):
- ${W}/vw.py "<ref>": the BSB verse word for word. ${W}/figname.py "<ref>": Bullinger's entries on a verse. ${W}/cq.py all "<ref>" and cq.py <barnes|jfb|kad|clarke|mhc|calvin> "<ref>": the local commentaries. ${F}/bm.py <ellicott|benson> "<ref>".
- ${ENV} python3 -I ${W}/tc/resolve.py <source>@"<on>": who the cite list credits there, and the writer key the strength counts.
- Checks, which must end with 0 problems: notes: ${ENV} python3 -I ${F}/figcheck.py --quotes --forms ${NS}/main-figure-forms.json <file with {"notes": [...]}> and python3 -I ${F}/poetrycheck.py <same file>; structures: ${ENV} python3 -I ${F}/strcheck.py --quotes --have ${NS}/main-structures.json <file with {"structures": [...]}> (for an addition to a live structure, run it without --have, since the target is already there).
- The scans: each cite's found says how its second reader read it (the BookReader page text or djvu text on an ia8xxxxx.us.archive.org server, with the page index, or the search-inside service). To re-read a page, WebFetch that same page-text URL and ask for the passage word for word in pieces of about 120 characters. At most 4 fetches for your whole group, only where a quote must be widened or on checked; if a fetch is refused, stop fetching and work from what the found records show. Never guess a page.`

const show = (k) => `python3 -I -c "import json; g = json.load(open('${FILE}'))[${k}]; print(g['key']); print(json.dumps(g['items'], ensure_ascii=False, indent=1))"`
const keyOf = (k) => `r2rv-${k}`

const res = await pipeline(
  args.only,
  (k) => agent(`${ABOUT}

${SITUATION}

Your group is number ${k}. Print it with:
${show(k)}
Make the folder ${NS}/review/work/${keyOf(k)}/ and save the group there as in.json.

${LESSONS}

${RULES}

${TOOLS}

For each item:
1. Read each cite's quote against what his found record shows and, where needed, the page itself; check the quote carries the point (lesson 2), on is right (lesson 3), and resolve.py names a writer there. For the local writers, re-read them with cq.py, bm.py or figname.py.
2. Go through lessons 1 to 9 and the rules one by one and fix what fails. A widened quote is still his exact words in order.
3. Recount the strength and make the evidence name exactly the cited writers, each saying only what his quote says.
4. Drop an item only when it cannot be made sound, and say why.
5. Set checked to "${TODAY}" on every entry you keep. Keep found on every cite; on a cite you re-read or changed, set found to what you read (page URL and UTC time) and retrieved to "${TODAY}".
Write the kept notes to ${NS}/review/work/${keyOf(k)}/notes.json as {"notes": [...]} and structures to structures.json as {"structures": [...]} (targets of additions included, by their file), run the checks, and fix until they end with 0 problems.
Return every item (type, id, file, the whole entry, verdict, reason), every change (id, field, before, after, lesson), your number of fetches and the checks' last lines.`, { label: `check:${keyOf(k)}`, phase: 'Review', schema: OUT }),
  (rev, k) => rev ? agent(`${ABOUT}

${SITUATION}

A first reader went through group ${k} against the lessons below and made the changes listed at the end. You are the second reader, and your job is adversarial: assume each change may be wrong until you have checked it yourself, and assume the first reader missed something.

The group as it was before: print it with
${show(k)}

${LESSONS}

${RULES}

${TOOLS}

For each item:
1. For each change, check it against the writer's words (his quote and found record, the page if needed, the local copy for the commentaries). Restore the original when the change makes a quote not his exact words, misstates him, moves on away from his remark, or cuts a true and quoted point; amend it when half right.
2. Then check the entry afresh against lessons 1 to 9 and the rules, as if no one had, and fix what was missed.
3. Drop only what cannot be made sound, with the reason.
Keep found on every cite (on a cite you re-read or change, what you read and when, with retrieved "${TODAY}"), and checked "${TODAY}". Write the final notes to ${NS}/review/work/${keyOf(k)}/final-notes.json and structures to final-structures.json, run the checks, and fix until they end with 0 problems.
Return every item in its final form (type, id, file, whole entry, verdict, reason), the final list of changes against the original items, your number of fetches and the checks' last lines.

The first reader's changes:
${JSON.stringify(rev.changes, null, 1)}
The first reader's items:
${JSON.stringify(rev.items, null, 1)}`, { label: `confirm:${keyOf(k)}`, phase: 'Confirm', schema: OUT }) : null,
)
return res.map((r, i) => r ? { key: keyOf(args.only[i]), items: r.items.map(x => `${x.id}: ${x.verdict}`), changes: r.changes.length, fetches: r.fetches, check: r.check } : { key: keyOf(args.only[i]), failed: true })
