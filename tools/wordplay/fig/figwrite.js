export const meta = {
  name: 'write-figure-notes',
  description: 'Write figure, parallelism and contrast notes for Deep in the Layers format, then a skeptic and a second reader check every note against its writers',
  phases: [
    { title: 'Write', detail: 'one writer per batch of verses' },
    { title: 'Check', detail: 'a skeptic re-reads every quote and claim, fixes or drops' },
    { title: 'Confirm', detail: 'a second reader accepts, amends or rejects each note' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const F = `${W}/fig`
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const TODAY = args.today
const STR = ['widely agreed', 'commonly held', 'some interpreters']
const FORMS = ['same', 'opposite', 'building', 'mirror', 'turns', 'metonymy', 'synecdoche', 'anthropopatheia', 'prosopopoeia', 'simile', 'metaphor', 'contrast', 'likeness']

const CITE = {
  type: 'object',
  properties: {
    source: { type: 'string', description: 'a quotable cite-list id, and only these: henry, barnes, jfb, keil-delitzsch, pulpit, ellicott, benson, poole, calvin, clarke, bengel, maclaren, chrysostom, catena-aurea, edersheim, bullinger-fos (word books strongs and easton may be cited but are not writers)' },
    by: { type: 'string', description: 'for jfb, keil-delitzsch, pulpit, ellicott and catena-aurea only: the writer of the quoted part, exactly as byw.py prints it' },
    on: { type: 'string', description: 'the verse or range the remark is on, as the writer heads it: "Psalm 1:6", "Genesis 6:5-8", "1 Samuel 1"' },
    at: { type: 'string', description: 'optional: for bullinger-fos the heading the verse sits under ("Metonymy, of the Cause"); for catena-aurea the Father and the work ("Augustine, Tractates on John 15")' },
    quote: { type: 'string', description: 'the writer\'s own words, word for word as found, 20 to 400 characters, parts joined with "..." in order inside one remark' },
    read: { type: 'string', description: 'the edition or copy it was read in, from the table in the instructions' },
    retrieved: { type: 'string', description: 'the date it was read, as 2026-10-22' },
    found: { type: 'string', description: 'where you found the words: "cq.py gill Psalm 1:6", "cat.py Luke 2:25", or the exact web page you fetched' },
    context: { type: 'string', description: 'for a web page: about 40 words around the quote, as the page has them' },
  },
  required: ['source', 'on', 'quote', 'read', 'retrieved', 'found'],
}
const NOTE = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: { type: 'string', enum: ['parallelism', 'figure', 'contrast'] },
    form: { type: 'string', enum: FORMS },
    ref: { type: 'string' },
    strength: { type: 'string', enum: STR },
    short: { type: 'string' },
    about: { type: 'string' },
    refs: { type: 'array', items: { type: 'string' } },
    lines: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, words: { type: 'string' }, mark: { type: 'string' }, key: { type: 'string' } }, required: ['ref', 'words'] } },
    pairs: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    figure: { type: 'object', properties: { name: { type: 'string' }, part: { type: 'string' }, ref: { type: 'string' }, words: { type: 'string' }, means: { type: 'string' } }, required: ['name', 'ref', 'words', 'means'] },
    sides: { type: 'array', items: { type: 'object', properties: { who: { type: 'string' }, label: { type: 'string' }, ref: { type: 'string' }, words: { type: 'string' } }, required: ['who', 'label', 'ref', 'words'] } },
    original: { type: 'object', properties: { note: { type: 'string' }, strong: { type: 'array', items: { type: 'string' } } }, required: ['note', 'strong'] },
    evidence: { type: 'string' },
    limit: { type: 'string' },
    checked: { type: 'string' },
    cites: { type: 'array', items: CITE },
  },
  required: ['id', 'kind', 'form', 'ref', 'strength', 'short', 'about', 'evidence', 'checked', 'cites'],
}
const DROP = { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, kind: { type: 'string' }, reason: { type: 'string' } }, required: ['ref', 'kind', 'reason'] } }
const OUT = { type: 'object', properties: { notes: { type: 'array', items: NOTE }, dropped: DROP, check: { type: 'string', description: 'the last line figcheck.py printed for your file' } }, required: ['notes', 'dropped', 'check'] }
const JUDGED = {
  type: 'object',
  properties: {
    notes: { type: 'array', items: NOTE, description: 'every note you keep, whole, with your corrections' },
    verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['keep', 'fix', 'drop', 'accept', 'amend', 'reject', 'restore'] }, reason: { type: 'string' } }, required: ['id', 'verdict', 'reason'] } },
    check: { type: 'string', description: 'the last line figcheck.py printed for your file' },
  },
  required: ['notes', 'verdicts', 'check'],
}

const ABOUT = `Bible Atlas is a Bible study app. Its Deep level shows three kinds of notes of its own, each citing the writers who state it: parallel lines ("parallelism"), figures of speech ("figure") and two people set side by side ("contrast"). The owner asked that every example that can be cited be shown, and that only Bible-believing writers and theologians who love God be cited, never writers who liberalize the Bible; Christian writers only (Catholic and Orthodox writers who uphold Scripture count; rabbis and Jewish scholars do not). The notes go live once they pass the build's checks, so every claim must be right and every quotation real.`

const FORMAT = `The note format (read these first, they are short):
- ${F}/README.md: the field list and everything the build refuses;
- ${F}/config/figure-forms.json: the 13 forms (kind, label, plain description) and the "quotable" list;
- ${F}/config/figures/*.json: five finished notes to copy the style of (Psalm 1:6 opposite lines, Isaiah 6:10 mirror, Matthew 10:34 metonymy, Genesis 6:6 anthropopatheia, 1 Samuel 1:2 contrast). Never write a note these already hold.

Forms: parallelism takes same (the second line says the first again in other words), opposite (it answers with the opposite), building (each line adds to or is built like the one before), mirror (words or lines go out and come back in reverse order, A B B' A'), turns (lines alternate, A B A' B'). figure takes metonymy, synecdoche, anthropopatheia, prosopopoeia (personification), simile, metaphor. contrast takes contrast (each shows up the other) or likeness (one is like the other).

Fields, and how to fill them:
- id: book, chapter, verse, form, lowercase with hyphens: "psalm-1-6-opposite", "1-samuel-1-2-contrast", "song-of-solomon-2-1-metaphor" (Psalms is "psalm"). Add "-2" for a second note of the same form on the same verse.
- ref: the note's own verses, in one chapter and no wider than the lines, figure or first side need: "Psalm 1:6", "1 Samuel 1:2-7".
- short: at most 52 characters, plain words a newcomer understands; may quote the BSB in curly quotes.
- about: at most 300 characters. Say what the reader sees in the verse and what it shows, in full plain sentences. Say no more than the cited writers state; word a reading as a reading ("can", "many read") when not every cited writer states it as fact.
- figure (figure notes only, exactly one): name is the figure's plain name as Bullinger gives it (Metonymy, Synecdoche, Anthropopatheia, Personification, Simile, Metaphor; 40 characters at most); part is his subdivision, shortened ("of the Cause", "of the Part", "Human Affections and Feelings"; 60 at most; leave it out when none fits); ref is the one verse; words are the exact BSB words that carry the figure, found once in that verse; means says in plain words what they stand for (160 at most).
- lines (parallel notes, at least two): each line's words are exact BSB text of one verse inside ref, found once in it, in reading order and not overlapping, punctuation as the BSB has it. A mirror's or turns' lines are all marked ("A", "B", "B'", "A'"; a mirror may have one unprimed centre). key is optional: one word or phrase found once, as whole words, in its line.
- pairs (parallel notes, optional): [first, answer] words that answer each other, each found once as whole words across the lines, the first in an earlier line.
- sides (contrast notes, exactly two): who is the name as the BSB gives it, and it must appear in that side's verses; label (40 at most) says what that side is or does; ref is the range that shows them (one side may come from another passage); words are exact BSB words from those verses.
- refs (optional): other passages the note quotes or points to.
- original (optional): only when the Hebrew or Greek adds something a cited writer states. strong lists roots as H or G and four digits (vw.py shows keys like H1870L: write H1870), each found in the note's verses. The note must name its language, or the build refuses it: "In Hebrew" (or "In Aramaic") for an H root; for a G root in a Gospel the Gospel writer's Greek, as "In Matthew's Greek", "In John's Greek" (never Jesus' own words, since He most likely spoke Aramaic); elsewhere "In Greek" or "In Paul's Greek".
- evidence: at most 400 characters; names every cited writer and says how he states the note. Writers' names go here and in cites only.
- limit (optional, 300 at most): where the writers differ, or what the note does not claim.
- checked: "${TODAY}".
- cites: one per work (a work is never cited twice in a note). source, by (where needed), on, optional at, quote, read, retrieved "${TODAY}", plus found and context for the record.
  * Quotable works only (the "quotable" list in figure-forms.json): henry, barnes, jfb, keil-delitzsch, pulpit, ellicott, benson, poole, calvin, clarke, bengel, maclaren, chrysostom, catena-aurea, edersheim, bullinger-fos, and the word books strongs and easton. NEVER quote Gill, Spurgeon, the Geneva notes, the Companion Bible (bullinger-cb), Henry's Concise (henry-concise), Wesley, the church fathers as a group (church-fathers), the NET notes or the Tyndale notes: their typed texts are not free to quote, or they are abridgments in other men's words. You may read them for leads, then find a quotable writer who states the point.
  * Some works may be quoted only on the books their named writer wrote: Barnes on Job, Psalms, Isaiah, Daniel and Matthew to Revelation (his Genesis is Murphy's; the rest of his Old Testament is the Speaker's Commentary and Pusey); Henry on Genesis to Acts (others finished Romans to Revelation); the Catena on the four Gospels; Poole on Genesis to Isaiah 58 (his continuators wrote the rest); Keil and Delitzsch on the Old Testament.
  * Works by several hands need by, the writer of the quoted part, exactly as python3 -I ${F}/byw.py <source> "<on>" ["<at>"] prints it (it also prints NOT QUOTED HERE where the writer is not known for certain or is barred; then do not quote that work there): jfb (Jamieson, Fausset or Brown by book), keil-delitzsch (Keil or Delitzsch), pulpit (each book's expositor; never Judges, Job, Ezekiel, Daniel, 1 Chronicles, Nehemiah, Esther, Ecclesiastes, Jeremiah, Lamentations or 2 Corinthians), ellicott (each book's writer) and catena-aurea (the Father quoted, from at). Run byw.py for every cite before you use it.
  * The Pulpit Commentary is quoted only from its exposition (the verse-by-verse notes), never from its homiletics or the homilies by various authors, which other men wrote. bm.py prints the exposition only.
  * read is, by source and copy:
    - barnes, jfb, keil-delitzsch, clarke read with cq.py: "sacred-texts.com's transcription, in the copy at github.com/jonnyg23/mahabrain (commit b00aa50)"
    - henry, calvin read with cq.py mhc, calvin: "Let's Church's copy, at github.com/LetsChurch/lets.church (commit 71f6f0f)"
    - pulpit, ellicott, benson read with bm.py: "StudyLight's transcription, in the MyBible module at github.com/batanus/bible-resources (commit 14a8b1a)"
    - bullinger-fos: "the UniqueBible.app module of the 1898 text, at github.com/darrelwright/UniqueBible_Books (commit 4017a67)"
    - catena-aurea read with cat.py: "Newman's Oxford translation, in the copy at github.com/AlvaroBalbin/catena (commit efe1bd0)"
    - a web page: "Bible Hub's transcription, at <the page>" (or "New Advent's translation, at <the page>", "CCEL's text, at <the page>")
- strength: the number of different interpreters cited: 3 or more "widely agreed", 2 "commonly held", 1 "some interpreters". strongs and easton are word books and never count. A figure, parallel or contrast that only Bullinger states may stand alone as "some interpreters".

What the build refuses, and so must you:
- A note's own words (short, about, limit, the figure, the sides, the original note) name no writer or work: no Henry, Gill, Bullinger, Calvin, Augustine, Strong's, Companion Bible and so on. Writers go in evidence and cites.
- Any quotation of four or more words in short, about, evidence, limit or the original note must be the BSB text of the note's ref, refs or sides. So never put a writer's words in quotation marks outside his cite: paraphrase him in evidence.
- No em dashes in your own words (house style), no mention of the ESV, nothing on the avoid list in ${F}/config/layer-sources.json, and nothing about how the note was made (never mention AI, drafting, reviewing or checking).`

const RULE = `Who may be cited, and when a writer counts (all strict; earlier checks dropped notes for each of these):
1. Quote only the quotable works listed above, in their own words, on the books their named writer wrote, with by where the work has several hands. Never quote Gill, Spurgeon, the Geneva notes, the Companion Bible, Henry's Concise, Wesley's notes (his Old Testament notes abridge Henry and his New Testament notes abridge Bengel: cite Henry or Bengel), the Tyndale or Aquifer study notes, the NET notes, or any modern work. Never cite Barnes on Genesis (that text is James G. Murphy's commentary) or on the Old Testament outside Job, Psalms, Isaiah and Daniel. When a commentator's sentence is really another writer's (Jamieson, Fausset and Brown end a sentence "[BENGEL]"), the evidence says whose it is; a sentence he quotes from a rabbi, the Targum or "the Jewish writers" is never used.
2. The writer must state the note himself, in his remark on this verse (or on the passage that holds it): for a figure, that these words are figurative and what they stand for (he need not name the figure, but the figure's name must come from a writer who does, usually Bullinger); for parallel lines, how the lines answer each other in the way the form says (one line explained by the other, the opposite set against it, the order reversed); for a contrast, that the two people are set against each other (or alike) in the way the note says. A view he only reports ("some think") or rejects does not count, nor a different figure on other words, nor half of the note.
3. Never cite Ellicott on Psalms, Song of Solomon, Obadiah, Jonah or Ecclesiastes, Keil and Delitzsch or the Pulpit Commentary on Ecclesiastes, the Pulpit Commentary on Jeremiah or Lamentations, Calvin on Matthew 27:9 or Acts 7:14 and 7:16, Keil and Delitzsch on Psalm 74:4, 86:1 or 130:1, or the Pulpit Commentary on 2 Corinthians 3:7; never a remark that calls a book or its events fiction, denies the writer a book's title names, or says the text is in error. Among the Fathers (Catena Aurea, or New Advent and CCEL translations only, never the HistoricalChristianFaith database), never Origen, Didymus, Theodore of Mopsuestia, Pelagius, Arius, Nestorius, Apollinaris, Evagrius, Tatian, Novatian, Tertullian, Theodoret, Hippolytus, Victorinus, Clement of Alexandria, or (outside the Catena) Eusebius; never the Catena's Pseudo-Chrysostom on Matthew; the Gloss is not a writer.
4. Never name in evidence a rabbi, a Jewish commentator or scholar, BDB, Thayer, the Cambridge Bible, the Expositor's, Meyer, Vincent, the ICC or the UBS Handbooks, even when a Christian writer quotes one. Ancient texts (the Septuagint, the Targums, Josephus) may be named only as witnesses.
5. Contrasts: be fair to both people. Where Scripture is kinder to one (2 Peter 2:7-8 calls Lot righteous; Orpah did what Naomi urged; Jesus does not condemn Martha's service), say so; never paint one side as simply bad. Where the New Testament itself draws the contrast (Hebrews 11:4, Galatians 4, Romans 9:13), put that verse in refs and let about say so.
6. Accuracy beats count: fewer, solid notes are better than many weak ones. Leave out a parallel the writers only label without saying how the lines answer each other, and a figure no writer explains.`

const TOOLS = `Tools (run with python3 -I). Do not download, clone or install anything, and write files only in your folder ${F}/work/<batch key>/:
- ${W}/vw.py "<ref>" prints the BSB verse word for word with its Hebrew or Greek words and Strong's keys ("Psalm 1:6", "Micah 1:10-15"). Copy lines, figure words and side words from its "==" line.
- ${W}/figname.py "<ref>" prints every place Bullinger's Figures of Speech uses the verse, with the figure and the chain of headings above it and his remark.
- ${W}/cq.py all "<ref>" prints the local commentaries on a verse (clarke, barnes, jfb, kad = keil-delitzsch, mhc = henry, Matthew Henry's complete commentary, calvin, fos = bullinger-fos; it also prints gill, mhcc, geneva and cb, which may give leads but are never quoted; ignore wesley), cut at 2500 characters; "cq.py <work> <ref>" prints one in full. A heading like "section psa 1:4" means the remark covers verses from there. Prefer these local copies to the web for Henry and Calvin.
- ${F}/bm.py <pulpit|ellicott|benson> "<ref>" prints that work's remarks on the chapter from a pinned copy (the Pulpit's exposition only). Use it instead of the web for these three.
- ${F}/byw.py <source> "<on>" ["<at>"] prints the by a cite needs, or NOT QUOTED HERE with the reason.
- ${W}/cat.py "<ref>" prints the Catena Aurea on a Gospel verse, under each Father's name; "cat.py check <ref> <quote>".
- Use only these tools and pages. Never read other folders in the scratchpad: their copies are not pinned, and a cite read there is dropped.
- Bible Hub chapter pages, with the WebFetch tool only (never curl): https://biblehub.com/commentaries/<code>/<book>/<chapter>.htm, <code> one of poole, calvin, bengel, maclaren, chrysostom, and <book> lowercase with underscores (1_samuel, song_of_solomon; Psalms is psalms). Ask WebFetch for the remark on your verse word for word; it gives at most about 120 characters verbatim per answer, so ask for a long quote in pieces. Every agent in this session shares 400 web fetches an hour: fetch only pages likely to hold a second or third writer, at most 8 per batch, and if a fetch is refused for the budget, stop fetching and work from the local copies. The Fathers: newadvent.org/fathers or ccel.org pages.
- ${F}/figcheck.py --quotes <file> runs the build's checks on a file holding {"notes": [...]}, and checks every quote from a local copy word for word. Every note you return must pass it.
- The live Layers notes on a chapter, so you do not repeat one: python3 -I -c "import json; [print(json.dumps(p, ensure_ascii=False)[:2000]) for p in json.load(open('${LW}/config/layers.json'))['passages'] if p['ref'].startswith('<Book> <chapter>:')]"`

const FILE = args.file
const show = (k) => `python3 -I -c "import json; b = json.load(open('${FILE}'))[${k}]; print(b['key']); print(json.dumps(b['verses'], ensure_ascii=False, indent=1))"`
const ks = args.only || Array.from({ length: args.count }, (_, k) => k)
const keyOf = (k) => `${args.name}-${k}`
const strip = (notes) => JSON.stringify(notes || [], null, 1)

const res = await pipeline(
  ks,
  (k) => agent(`${ABOUT}

You write the notes for one batch of verses. Print your verses and the leads a script found for them with
${show(k)}
The leads are hints only: some are noise, and a lead's kind or target is a guess. Each verse may give a figure note, a parallel note, a contrast note, more than one, or none. Leave out a candidate whose verse already has a live Layers note of the same kind on the same words.

${FORMAT}

${RULE}

${TOOLS}

How to work: for each verse read the BSB (vw.py), Bullinger (figname.py, cq.py fos) and the commentaries (cq.py all, bm.py pulpit, ellicott and benson; then the Bible Hub pages for Poole, Bengel and the others, to find second and third writers). Write each note only when at least one writer states it as rule 2 says. Save your notes to ${F}/work/${keyOf(k)}/draft.json as {"notes": [...]}, run ${F}/figcheck.py --quotes on it, fix every problem it prints, and run it again until it prints "0 problems". Return the notes exactly as saved (with found and context on each cite), each candidate you left out in dropped with a short reason, and figcheck's last line.`, { label: `write:${keyOf(k)}`, phase: 'Write', schema: OUT }),
  (draft, k) => {
    if (!draft || !draft.notes || !draft.notes.length) return { k, draft, judged: null }
    return agent(`${ABOUT}

You are the skeptic for one batch of draft notes, before they go live. Find what is wrong and fix it, or drop the note. The drafts:
${strip(draft.notes)}

${FORMAT}

${RULE}

${TOOLS}

Check every note, hard:
a. Re-open every cite. Local works: figcheck.py --quotes, cq.py, cat.py check. Web pages: fetch the page again and find the words in the writer's own remark on the verse in "on". Words not found as given are corrected to what the writer wrote, or the cite is dropped.
b. Read each quote in its context. Does the writer state this very figure, these lines answering each other in this way, or this contrast, in his own voice, about this verse? Drop each cite that does not (it only explains a word, reports a view, finds a different figure, or names a figure without saying anything a reader can check). Recount the strength from the cites left; a note left with no interpreter is dropped.
c. Is the form the right one? A mirror needs a true reversed order; opposite lines need the second to answer the first with its opposite; metonymy and synecdoche as the writers name them; a contrast needs two people the writers set against each other.
d. Are the lines the whole members that answer each other, in order, with the right marks? Is the figure's words the words that carry it, and its meaning what the writers say? Are the sides the right people, fairly labelled, with the right verses?
e. Do short, about, limit and the original note say no more than the cited writers state, in plain words, with no writer named? Is a reading worded as a reading? Is the evidence true to each quote?
f. Is any cite forbidden by rule 1 or 3? Is the work quotable, on a book its named writer wrote, with by exactly as byw.py prints it? Does an original note name its language?
When unsure that a claim is supported, drop it. Save the notes you keep, whole and corrected, to ${F}/work/${keyOf(k)}/checked.json as {"notes": [...]}, run figcheck.py --quotes on it until it prints "0 problems", and return them with one verdict per draft note (keep, fix or drop, with the reason) and figcheck's last line.`, { label: `check:${keyOf(k)}`, phase: 'Check', schema: JUDGED }).then((judged) => ({ k, draft, judged }))
  },
  (r) => {
    if (!r || !r.judged) return r
    const kept = r.judged.notes || []
    const ids = new Set(kept.map((n) => n.id))
    const dropped = (r.draft.notes || []).filter((n) => !ids.has(n.id))
    if (!kept.length && !dropped.length) return { ...r, final: null }
    return agent(`${ABOUT}

You are the second reader. A writer drafted notes for one batch, and a skeptic checked them. Read each note the skeptic kept with fresh eyes and decide: accept it, amend it (fix what is wrong, keep what is right), or reject it (its central claim is false, or no cited writer states it). You may restore a note the skeptic dropped only if you re-check its quotes and claim yourself and the skeptic's reason does not hold.

The skeptic's notes:
${strip(kept)}

The skeptic's verdicts:
${JSON.stringify(r.judged.verdicts || [], null, 1)}

Draft notes the skeptic dropped:
${strip(dropped)}

${FORMAT}

${RULE}

${TOOLS}

Look hardest for: about or short saying more than the quotes; a quote that does not state this note (only a word explained, a view reported, a different figure); a form that does not fit (a mirror without a true reversed order, opposite lines that are not opposites); lines that are not the whole members, or marks that do not match; a contrast unfair to one side; a strength that counts a writer who does not state the note; a cite forbidden by rule 1 or 3; a quote not word for word (re-open any you doubt). Save the final notes to ${F}/work/${keyOf(r.k)}/final.json as {"notes": [...]}, run figcheck.py --quotes on it until it prints "0 problems", and return them with one verdict per note you saw (accept, amend, reject or restore, with the reason) and figcheck's last line.`, { label: `confirm:${keyOf(r.k)}`, phase: 'Confirm', schema: JUDGED }).then((final) => ({ ...r, final }))
  },
)

return res.filter(Boolean).map((r) => ({ k: r.k, drafted: (r.draft && r.draft.notes || []).length, checked: r.judged ? (r.judged.notes || []).length : 0, final: r.final ? (r.final.notes || []).length : 0 }))
