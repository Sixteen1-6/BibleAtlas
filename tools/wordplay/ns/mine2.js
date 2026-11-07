export const meta = {
  name: 'new-writers-structures-2',
  description: "Round 2: find the chiasms, introverted and alternate parallels and other structures that Lowth, Jebb, Boys and Forbes set out, as structure entries or mirror notes in the BSB's words, then a second reader checks each against the writer's page",
  phases: [
    { title: 'Mine', detail: 'one reader per work: find each structure the writer sets out, write it, check it' },
    { title: 'Check', detail: 'a second reader re-reads every quote on its page and checks every entry' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const F = `${W}/fig`
const NS = `${W}/ns`
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const TODAY = args.today
const ENV = `ATLAS_SOURCES_EXTRA=${NS}/extra-sources.json`
const R = `${NS}/research.json`

const CITE = {
  type: 'object',
  properties: {
    source: { type: 'string' }, work: { type: 'string' }, on: { type: 'string' }, at: { type: 'string' }, url: { type: 'string' },
    quote: { type: 'string' }, read: { type: 'string' }, retrieved: { type: 'string' },
    found: { type: 'string', description: 'the search-inside or page-text address you fetched, the leaf, the printed page and how you know it' },
    time: { type: 'string', description: 'UTC time right after the read, from date -u, as 2026-11-01T03:40:12Z' },
  },
  required: ['source', 'on', 'quote', 'read', 'retrieved', 'found', 'time'],
}
const CAND = {
  type: 'object',
  properties: {
    target: { type: 'string', enum: ['structure', 'figure', 'addition'] },
    entry: { type: 'object', description: 'structure: one entry for config/structures.json; figure: one note for config/figures (kind parallelism); addition: {"note": "<id of a held note>", "cite": {...}} giving a second writer for a note already held' },
    cites: { type: 'array', items: CITE, description: 'every cite in the entry, with found and time for the record' },
    why: { type: 'string', description: 'what the writer says, in a sentence, and where' },
  },
  required: ['target', 'entry', 'cites', 'why'],
}
const OUT = {
  type: 'object',
  properties: {
    candidates: { type: 'array', items: CAND },
    looked: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, page: { type: 'string' }, why_not: { type: 'string' } }, required: ['ref', 'why_not'] }, description: 'structures the writer sets out that you could not write, and why (a tie that the build needs is missing, the BSB order differs, a reading that changes the Hebrew, a page not confirmed, the budget ran out)' },
    fetches: { type: 'number' },
    check: { type: 'string', description: 'the last lines strcheck.py and figcheck.py printed for your files' },
  },
  required: ['candidates', 'looked', 'fetches', 'check'],
}
const JUDGED = {
  type: 'object',
  properties: {
    candidates: { type: 'array', items: CAND, description: 'every candidate you keep, whole and corrected' },
    verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['accept', 'amend', 'reject', 'pending'] }, reason: { type: 'string' } }, required: ['id', 'verdict', 'reason'] } },
    check: { type: 'string' },
  },
  required: ['candidates', 'verdicts', 'check'],
}

const ABOUT = `Bible Atlas is a Bible study app. At its Deep level, behind a notice that this is commentary, it shows how passages are built: mirrors (chiasm, introverted parallelism), two threads taking turns (alternation), bookends (inclusio), refrains, and parallel lines. The owner (Shubhanshu) asked on 2026-11-01 that writers who believe the Bible and do not contradict it be added, and that large chiasms and structures be shown at Deep. Robert Lowth, John Jebb, Thomas Boys and John Forbes, the writers who first set out the Bible's parallel and introverted structures, are being added to the cite list now; their entries are in ${NS}/extra-sources.json (cite ids lowth, jebb, boys, forbes) and the research behind them, with each scan's page rule and quote rule, is in ${R} (keys lowth, jebb, boys, forbes). Only Bible-believing writers are cited, never liberal critics; everything goes live once it passes the build's checks, so every quotation must be real and every claim the writer's own.`

const FORMATS = `Two places a structure can go:

1. config/structures.json (the app's "How it is built" extra, checked by ${F}/strcheck.py, a mirror of crates/atlas-cli/src/extra_structure.rs). Use it for a structure whose parts are whole sections (several verses each), or that crosses chapters, or a whole psalm or epistle. Read the 14 finished entries first: python3 -I -c "import json; [print(json.dumps(s, ensure_ascii=False)) for s in json.load(open('/tmp/pr68-structures.json'))['structures']]". Fields: id (lowercase, hyphens, ending in the kind's word as they do: "john-5-mirror"), kind (chiasm, alternation, inclusio or refrain; foil is two people and is not for this run), ref (the passage, in one book, may cross chapters: "2 Thessalonians 1:1-3:18"), strength, short (60 characters at most, plain words), about (300 at most, full plain sentences, no more than the writer states), members (in reading order: {mark, ref, words, tie}). Marks: chiasm A B ... B' A' nesting, at least four, at most one unprimed centre; alternation A B A B (or A B C A B C); inclusio exactly A and A'; refrain all R. Each member's ref is the range that part covers and words are exact BSB words of ONE verse in that range, found once there (copy them from vw.py's "==" line). tie: on the first member of each group of members that answer each other (A and A', B and B'), words found as whole words in EVERY member of that group. The build refuses a group with no tie, so a structure whose answering parts share no word in the BSB cannot go here (it may still be a mirror note in config/figures, below). evidence (400 at most) names the writer and how he lays it out; limit (optional) where writers differ; checked "${TODAY}"; cites.

2. config/figures (a parallelism note, checked by ${F}/figcheck.py). Use it for lines inside one chapter (usually one to four verses): kind "parallelism", form mirror (A B B' A'), turns (A B A' B'), same, opposite or building; lines [{ref, words, mark, key}] with exact BSB words of one verse each, in reading order, not overlapping; for a mirror or turns every line is marked; key is optional. No tie is needed here. Fields as in the seed notes: python3 -I -c "import json,glob; [print(json.dumps(n, ensure_ascii=False)) for f in glob.glob('${F}/config/figures/*.json') for n in json.load(open(f))['notes']]" (id like "matthew-7-6-mirror", ref one chapter, strength, short 52 at most, about 300 at most, lines, pairs optional, evidence, limit optional, checked, cites).

3. An addition: the writer states a structure or parallel that a note already held states (the list below). Give {"note": "<its id>", "cite": {...}} so he is added as a second writer; the strength rises when he is a new writer.

Cites (both places): {source, work (lowth and boys only: lowth-lectures or lowth-isaiah; boys-tactica-sacra or boys-key-psalms), on (the verse or range the remark is on), at (optional, 120 at most: the lecture, section or chapter of his book, "Sacred Literature, sect. XVI, p. 340"), url (the printed page of the scan: https://archive.org/details/<scan>/page/<printed page>/mode/1up, or page/n<leaf>/mode/1up for an unnumbered page, by the scan's page rule in the research), quote (his own words, 20 to 400 characters, word for word as the page has them, parts joined with "..." in order), read ("the 1820 printing, in the scan at archive.org/details/sacredliterature00jebb", and so on), retrieved "${TODAY}"}. Bullinger (bullinger-fos) may be cited too where his Figures of Speech lays out the same passage (python3 -I ${W}/figname.py "<ref>" shows his entries on a verse; ${W}/fos.txt is his text): his cites use url https://archive.org/details/figuresofspeechu00bull/page/<printed>/mode/1up and at "<heading>, p. <printed>", the printed page found with the search (search page minus 54), read "the UniqueBible.app module of the 1898 text, at github.com/darrelwright/UniqueBible_Books (commit 4017a67)". The local commentaries (python3 -I ${W}/cq.py all "<ref>": barnes, jfb, kad, clarke, mhc, calvin; ${F}/bm.py ellicott|benson "<ref>") may be cited where they state the same structure in their own words; never Gill, Spurgeon, the Pulpit, the Geneva notes, the Companion Bible or Wesley. strength: the number of different writers cited (3 or more "widely agreed", 2 "commonly held", 1 "some interpreters").`

const RULES = `Rules (strict):
- Quote only the writer's own words, by the quote rule for his work in the research: never the Bible text he lays out (the app shows only the BSB), never his own rendering or rearrangement of a verse, never words he quotes from another (Forbes quotes Jebb and Lowth; Boys quotes Lowth and Jebb; Jebb reviews Lowth): credit each man only from his own book. Never his Greek or Hebrew as the OCR gives it. Set the long s as s; correct only plain OCR misreadings.
- He must state the structure himself: which parts answer which (the first to the last, the second to the next to last), or that the lines alternate. A passage he only sets out as a table may be used when the page's own words say what answers what. Never build a structure he does not set out, and never add members he does not name.
- The members must be the BSB's: each member's words in one verse of its range, in reading order. Where his parts depend on a change to the received Hebrew or Greek (an emendation, a reading from an ancient version or a manuscript the BSB does not follow), leave the passage out (decision 23(4)). Where the BSB's order differs from his layout so that the parts no longer go out and come back, leave it out.
- Our own words (short, about, limit) name no writer or work and say no more than the writer states; any quotation of four or more words in them must be BSB text of the passage. No em dashes, no mention of the ESV, nothing about how the entry was made (never mention AI, drafting or checking).
- Never cite a rabbi or Jewish commentator, even where the writer quotes one (the avoid list in ${LW}/config/layer-sources.json; check also for "Jarchi" by hand). Never a remark that calls a book or its events fiction or the text in error.
- Do not repeat what the app holds or is getting. Already held (never write these again; offer an addition instead): the 14 structures in /tmp/pr68-structures.json; the figure notes this thread holds or has written (list them with: python3 -I -c "import sys; sys.path.insert(0,'${W}/n12'); import have; [print(n['id'], n['kind'], n['form'], n['ref']) for n in have.notes()]"); the frame and refrain notes the Layers thread is writing (Psalm 146, Psalm 136, Amos 4, Psalm 46 and others like them: leave one-chapter bookends and refrains to them).
- Wanted most: a second writer for genesis-43-mirror (Genesis 43:3-5) and leviticus-14-mirror in /tmp/pr68-structures.json, which only Bullinger states now; and for the live mirror note on Isaiah 6:10 and the opposite-lines note on Psalm 1:6. Look for these in your work first, then go on to every structure the writer sets out.`

const TOOLS = `Tools (run Python with python3 -I; do not download, clone or install anything; write files only in ${NS}/work/<your key>/):
- python3 -I ${W}/vw.py "<ref>": the BSB verse word for word ("Matthew 7:6", "John 5:19-30"). Copy member and line words from its "==" lines.
- ${ENV} python3 -I ${F}/strcheck.py --quotes --have /tmp/pr68-structures.json <file>: the build's checks on {"structures": [...]}; it must print "0 problems, 0 duplicates".
- ${ENV} python3 -I ${F}/figcheck.py --quotes <file>: the build's checks on {"notes": [...]}; it must print "0 problems".
- ${ENV} python3 -I ${W}/tc/resolve.py <source>@"<on>": who the cite list credits (for lowth and boys the work is needed; the checkers pass it from your cite).
- The writer's scans are read only through WebFetch (load it with ToolSearch "select:WebFetch"); the shell cannot reach archive.org. Use the search-inside service for the scan (server and path in the research's link rule) to find where he discusses a passage: search a distinctive word of his ("introverted", "epanodos", "alternate", "correspond", the book's name with the chapter in roman numerals as he prints it). Then read the page's OCR text to see what answers what (for example the item's _djvu.txt, or the BookReader page text; ask WebFetch for the passage on that page word for word, in pieces of about 120 characters, since it quotes no more at once). Find the printed page by the scan's page rule in the research, never by guessing.
- The web budget is shared by every agent in this session (400 fetches an hour) and archive.org also limits each hour: make at most 30 fetches, plan them, and when two fetches in a row are refused for the budget or the site's limit, stop fetching and return what you have, listing the rest in looked with "budget".`

const WORKS = [
  { key: 'jebb', who: 'John Jebb, Sacred Literature (1820)', hint: "His introverted parallelisms through the New Testament and the Psalms (Matthew 7:6 on pp. 339-340 and Matthew 6:24 on p. 336 are in the research samples; also his sections on the introverted parallelism, about p. 53 onward, and his long examples)." },
  { key: 'forbes', who: 'John Forbes, The Symmetrical Structure of Scripture (1854)', hint: "His introverted parallelisms and symmetrical analyses: John 5:19-30 (pp. 70-73), Psalm 37 (pp. 106-114), the Decalogue, the Sermon on the Mount, and his other examples." },
  { key: 'boys-tactica', who: 'Thomas Boys, Tactica Sacra (1824)', hint: "His introverted and alternate arrangements: Genesis 4:1-5 (p. 8), the epistles named in Part I (2 Thessalonians p. 21, 2 Peter p. 23, 1 Thessalonians p. 39, Philemon p. 61); Part II's tables are not in the scan, so a whole-epistle entry needs the members named on the Part I page itself." },
  { key: 'boys-key', who: 'Thomas Boys, A Key to the Book of Psalms (1825)', hint: "His arrangements of whole psalms and parts of psalms (introverted and alternate), and the Psalms he sets out as answering one another." },
  { key: 'lowth-isaiah', who: "Robert Lowth, Isaiah: A New Translation (1795), the Preliminary Dissertation and his notes", hint: "His kinds of parallel lines with their examples (synonymous, antithetic, synthetic; stanzas whose lines answer alternately, Isaiah 30:16 at p. xxiii), and his notes on parallel lines in Isaiah. Most of his examples are parallel lines: write them as parallelism notes (same, opposite, building, turns) or additions." },
  { key: 'lowth-lectures', who: "Robert Lowth, Lectures on the Sacred Poetry of the Hebrews (Gregory's translation; Lecture XIX on parallelism and the lectures near it)", hint: "His examples of each kind of parallel lines (Lecture XIX), his notes on the structure of the Psalms. Gregory's and Michaelis's notes are never his: do not quote them." },
]

const ROUND1 = `This is round 2. Round 1 (the same task) was cut short by the shared web budget. Read what it did and planned for this work first: ${NS}/work/<key>/fetches.md (its "Next run" list is the plan; skip what it already found to be absent). Round 1 kept these five notes, which are held now: never write them again (python3 -I -c "import json; [print(n['id'], n['ref']) for n in json.load(open('${NS}/mined1.json'))['notes']]"). Keep round 1's files as they are; this round's files end in 2 (structures2.json, notes2.json, checked-structures2.json, checked-notes2.json). Append to fetches.md what you fetched this time, with the UTC times.`

const mine = (w) => agent(`${ABOUT}

${ROUND1.replace('<key>', w.key)}

You read one work: ${w.who}. ${w.hint}
Its research entry (scan, page rule, quote rule, samples already found): python3 -I -c "import json; r = json.load(open('${R}'))['${w.key.split('-')[0]}']; print(json.dumps(r, ensure_ascii=False, indent=1))"

${FORMATS}

${RULES}

${TOOLS}

How to work: plan your fetches from round 1's list. Search the scan for the places where he sets out a structure; for each, read what he says answers what, then write it in the BSB's words as a structure entry, a mirror (or other parallelism) note, or an addition. Save structures to ${NS}/work/${w.key}/structures2.json as {"structures": [...]}, notes to ${NS}/work/${w.key}/notes2.json as {"notes": [...]}, run the checks until they print 0 problems, and return every candidate with its cites (with found and time), everything you looked at but could not write in looked, the number of fetches you made, and the checks' last lines.`, { label: `mine2:${w.key}`, phase: 'Mine', schema: OUT })

const check = (m, w) => agent(`${ABOUT}

You are the second reader for the structures found in ${w.who}. Check each candidate hard before it goes live:
${JSON.stringify(m.candidates, null, 1)}

${FORMATS}

${RULES}

${TOOLS}

For each candidate:
a. Re-read every quote of a scan on its page (one fetch each at most; the found field says where it was read). The words must be the writer's own, word for word, on that page, and the page in url must be the printed page by the scan's page rule. A quote not found as given is corrected or the cite dropped. If the budget refuses your fetch, mark the candidate "pending" with the reason and keep it whole, unless you can confirm it from the quote's found record and another candidate's read of the same page.
b. Does the writer himself say which parts answer which, as the entry has them? Are the members or lines the parts he names, in the BSB's order and words, with the right marks, nesting and ties? Does short or about say more than he does?
c. Is anything forbidden by the rules (his Bible renderings quoted, another man's words credited to him, a changed Hebrew reading, a rabbi, a duplicate of what is held)?
d. Bullinger and commentary cites: re-check each with the local copies (figcheck.py and strcheck.py --quotes check them word for word).
Save the candidates you keep to ${NS}/work/${w.key}/checked-structures2.json and checked-notes2.json, run the checks until they print 0 problems, and return them whole and corrected, one verdict per candidate (accept, amend, reject or pending, with the reason; use the entry's id, or "addition:<note id>"), and the checks' last lines.`, { label: `check2:${w.key}`, phase: 'Check', schema: JUDGED })

const BY = Object.fromEntries(WORKS.map((w) => [w.key, w]))
const LANES = [['forbes', 'boys-tactica', 'lowth-lectures'], ['boys-key', 'jebb', 'lowth-isaiah']]
const lanes = await parallel(LANES.map((keys) => async () => {
  const out = []
  for (const k of keys) {
    const w = BY[k]
    const m = await mine(w)
    let j = null
    if (m && m.candidates && m.candidates.length) j = await check(m, w)
    out.push({ key: k, mined: m, judged: j })
    log(`${k}: ${m ? (m.candidates || []).length : 0} found, ${j ? (j.candidates || []).length : 0} kept, ${m ? m.fetches : 0} fetches`)
  }
  return out
}))
return lanes.filter(Boolean).flat().map((r) => ({ key: r.key, mined: r.mined ? (r.mined.candidates || []).length : 0, looked: r.mined ? (r.mined.looked || []).length : 0, fetches: r.mined ? r.mined.fetches : 0, kept: r.judged ? (r.judged.candidates || []).length : 0 }))
