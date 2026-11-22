export const meta = {
  name: 'every-figure-cited-notes-2',
  description: 'Turn one cited hand-off of the figure catalogue (parallel lines, figures or contrasts) into notes for Deep: a writer checks each candidate quote and adds second writers, a skeptic re-checks every quote and claim, a second reader accepts, amends or rejects',
  phases: [
    { title: 'Write', detail: 'one writer per batch of candidates' },
    { title: 'Check', detail: 'a skeptic re-reads every quote and claim, fixes or drops' },
    { title: 'Confirm', detail: 'a second reader accepts, amends or rejects each note' },
  ],
}

const SP = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad'
const W = `${SP}/wp`
const F = `${W}/fig`
const LW = `${SP}/lw`
const NN = args.nn
const H = `${W}/every/h${NN}`
const PF = `${H}/forms.json`
const TODAY = args.today
const STR = ['widely agreed', 'commonly held', 'some interpreters']
const FORMS = args.forms_list

const CITE = {
  type: 'object',
  properties: {
    source: { type: 'string', description: 'a quotable cite-list id, and only these: henry, barnes, jfb, keil-delitzsch, ellicott, benson, poole, calvin, clarke, bengel, maclaren, chrysostom, catena-aurea, edersheim, augustine, lowth, jebb, boys, forbes, horne, bullinger-fos (word books strongs and easton may be cited but are not writers)' },
    work: { type: 'string', description: 'only for a source the cite list credits by its works: catena-aurea ("catena-aurea", or "catena-aurea-rabanus" for words the Catena gives to Rabanus), chrysostom ("chrysostom-galatians"), edersheim ("edersheim-life")' },
    url: { type: 'string', description: 'only for a source with no Bible Hub chapter page: bullinger-fos (https://archive.org/details/figuresofspeechu00bull/page/<printed page>/mode/1up), catena-aurea, edersheim and the Fathers (the exact page the words are on); never a whole work or site' },
    on: { type: 'string', description: 'the verse or range the remark is on, as the writer heads it: "Psalm 1:6", "Genesis 6:5-8", "1 Samuel 1"' },
    at: { type: 'string', description: 'optional: for bullinger-fos the heading the verse sits under ("Metonymy, of the Cause"); for catena-aurea the Father and the work ("Augustine, Tractates on John 15")' },
    quote: { type: 'string', description: 'the writer\'s own words, word for word as found, 20 to 400 characters, parts joined with "..." in order inside one remark' },
    read: { type: 'string', description: 'the edition or copy it was read in, from the table in the instructions' },
    retrieved: { type: 'string', description: 'the date it was read, as 2026-11-14' },
    found: { type: 'string', description: 'where you found the words: "cq.py barnes Isaiah 5:1", "cat.py Luke 15:4", "bm.py ellicott Isaiah 5:1", or the exact web page you fetched' },
    context: { type: 'string', description: 'for a web page: about 40 words around the quote, as the page has them' },
  },
  required: ['source', 'on', 'quote', 'read', 'retrieved', 'found'],
}
const NOTE = {
  type: 'object',
  properties: {
    n: { type: 'integer', description: 'the candidate\'s "n", so the note can be traced to its line in the hand-off' },
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
  required: ['n', 'id', 'kind', 'form', 'ref', 'strength', 'short', 'about', 'evidence', 'checked', 'cites'],
}
const DROP = { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, ref: { type: 'string' }, reason: { type: 'string' } }, required: ['n', 'ref', 'reason'] } }
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

const ABOUT = `Bible Atlas is a Bible study app. Its Deep level shows figures of speech, parallel lines and people set side by side, each note citing the writers who state it. The owner asked that every figure in the Bible that can be cited be shown ("add everything we can", "make sure we find every instance correctly"), and that only Bible-believing writers and theologians who love God be cited, never writers who liberalize the Bible; Christian writers only (Catholic and Orthodox writers who uphold Scripture count; rabbis and Jewish scholars do not). A search of the whole Bible against the commentaries found candidate places; each is a lead, not a note. Notes go live once they pass the build's checks, with no other review, so every claim must be right and every quotation real.`

const FAM = {
  parallel: {
    live: `${LW}/config/figures/Ps.json, Prov.json and Isa.json (parallel lines of every form)`,
    fields: `- kind: parallelism.
- form: the form the cited writers' words state, which may differ from the candidate's (the search's guess): same (the second line says the first again in other words, or explains it), opposite (it answers with the opposite), building (each line adds to or completes the one before), mirror (words or lines go out and come back in reverse order, A B B' A'), turns (lines take turns, A B A' B'), climbing (each line takes up the last word of the one before and climbs), frame (a passage begins and ends with the same words), refrain (the same line comes back), beginnings (lines one after another begin with the same words).
- id: book, chapter, first verse, form, lowercase with hyphens: "psalm-1-6-opposite", "proverbs-10-1-opposite", "isaiah-1-3-same" (Psalms is "psalm"). Add "-2" when a live note already has that id.
- ref: the verses that hold the lines, in one chapter and no wider than the lines need. A writer may head his remark with one verse and mean lines in the next: put the note where the lines he means are.
- short: at most 52 characters, plain words a newcomer understands; may quote the BSB in curly quotes.
- about: at most 300 characters. Say how the lines answer each other and what that shows, in full plain sentences. Say no more than the cited writers state; word a reading as a reading ("can", "many read") when not every cited writer states it as fact.
- lines (at least two): each line's words are exact BSB text of one verse inside ref, found once in it, in reading order and not overlapping, punctuation as the BSB has it. Where the BSB sets the verse as poetry, each line is one of the BSB's own lines, part of one, or whole lines together, never the end of one and the start of the next (poetrycheck.py --lines prints them); in same, opposite, building and climbing no two of a note's lines are in one BSB line. A mirror's or turns' lines are all marked ("A", "B", "B'", "A'"; a mirror may have one unprimed centre). key is optional: one word or phrase found once, as whole words, in its line.
- pairs (optional): [first, answer] words that answer each other, each found once as whole words across the lines, the first in an earlier line.
- No figure and no sides.`,
    rule2: `2. The writer must state, in his remark on this passage, how these very lines answer each other in the way the form says: that the second says the first again in other words or explains it, that it sets the opposite against it, that the order is reversed, that the lines take turns, and so on. A general remark on Hebrew poetry, or the bare word "parallelism" with nothing a reader can check about these lines, does not count; neither does a view he only reports ("some think") or rejects, nor half of the note.`,
    step1: `Read the passage in the BSB (vw.py, and poetrycheck.py --lines for its poetry lines) and each quote in its full remark (cq.py <work> <ref>, bm.py). Keep a quote only if, in context, the writer states how these lines answer each other, as rule 2 says.`,
    checkb: `Does the writer state, in his own voice, how these very lines answer each other in the way the form says? Drop each cite that does not (a general remark on Hebrew poetry, a bare label, a view reported, a word explained, a different figure). Recount the strength from the cites left; a note left with no interpreter is dropped.`,
    checkc: `Is the form the right one? same needs the second line to say the first again in other words; opposite needs a true opposite; mirror a true reversed order; turns a true alternation; building lines that add to the one before. Are the lines the whole members that answer each other, in order, with the right marks, and are they the BSB's own poetry lines (run poetrycheck.py on your file)?`,
    look: `lines that are not the whole members, or not the BSB's poetry lines; a form the quotes do not state (a mirror without a true reversed order, opposite lines that are not opposites); a quote that is only a general remark on Hebrew poetry or a bare label`,
  },
  trope: {
    live: `${LW}/config/figures/Matt.json, Gen.json and Ps.json (metonymy, synecdoche, anthropopatheia and other figures)`,
    fields: `- kind: the form's kind in the forms file (figure for nearly all).
- form: the candidate's form, unless the cited writers plainly state another form in the forms list.
- id: book, chapter, first verse, form, lowercase with hyphens: "matthew-10-34-metonymy", "psalm-23-5-synecdoche" (Psalms is "psalm"). Add "-2" when a live note already has that id.
- ref: the verse or verses that hold the figure, in one chapter, no wider than the figure needs.
- short: at most 52 characters, plain words a newcomer understands; may quote the BSB in curly quotes.
- about: at most 300 characters. Say what the words say, what they stand for and what that shows, in full plain sentences. Say no more than the cited writers state; word a reading as a reading ("can", "many read") when not every cited writer states it as fact.
- figure (exactly one): name is the form's term as the forms file gives it (Metonymy, Synecdoche, Hyperbole, Hendiadys and so on; 40 characters at most); part is Bullinger's subdivision when he gives one for this place ("of the Cause", "of the Part"), shortened (60 at most), else left out; ref is one verse inside ref; words are exact BSB words of that verse that carry the figure, found once in it (the BSB may word the place differently from Bullinger's King James text: pick the BSB words that carry the same figure, and drop the candidate if the BSB does not keep it); means says in plain words what they stand for, as the writers explain it (160 at most).
- No lines and no sides.`,
    rule2: `2. The writer must state, in his remark on this place, that these words are figurative in the way the form says and what they stand for: for a metonymy, one thing put for another it is joined to (the cause for the effect, the container for what it holds); for a synecdoche, a part put for the whole or the whole for a part; for a hyperbole, more said than is meant to the letter; and so on, as the form's about in the forms file says. He need not name the figure, but the figure's name must come from a writer who names it for this place, usually Bullinger (figname.py shows where he does). A view he only reports or rejects does not count, nor a remark that only explains a word with no sense of a figure, nor a different figure on other words.`,
    step1: `Read the verse in the BSB (vw.py) and each quote in its full remark (cq.py <work> <ref>, cat.py, bm.py, figname.py for Bullinger). Keep a quote only if, in context, the writer states this figure for these words, as rule 2 says. A candidate is dropped when the BSB does not keep the figure Bullinger found in his King James text.`,
    checkb: `Does the writer state, in his own voice, that these very words are figurative in the way the form says, and what they stand for? Drop each cite that does not (a word explained with no sense of a figure, a view reported, the word used in passing, a different figure). Recount the strength from the cites left; a note left with no interpreter is dropped.`,
    checkc: `Is the form the right one, as the forms file's about defines it? Does the BSB keep the figure (the BSB may translate a figure away)? Is figure.part Bullinger's own subdivision for this place?`,
    look: `a figure the BSB has translated away; figure words that do not carry the figure; a means the writers do not give`,
  },
  contrast: {
    live: `${LW}/config/figures/1Sam.json and Gen.json (people set side by side)`,
    fields: `- kind: contrast.
- form: contrast (each shows up the other) or likeness (one is like the other), as the cited writers state it.
- id: book, chapter, first verse, form, lowercase with hyphens: "1-samuel-1-2-contrast" (Psalms is "psalm"). Add "-2" when a live note already has that id.
- ref: the first side's verses, in one chapter.
- short: at most 52 characters, plain words a newcomer understands; may quote the BSB in curly quotes.
- about: at most 300 characters. Say who is set beside whom and what each shows of the other, in full plain sentences, fair to both. Say no more than the cited writers state.
- sides (two): who (the person), label (a few plain words for how this side is shown), ref (the verses where the Bible shows it, which may be in another chapter or book), words (exact BSB words of the first verse of that ref that show it, found once in it).
- No lines and no figure.`,
    rule2: `2. The writer must state, in his remark on this passage, that these two are set against each other (or alike) in the way the note says. A view he only reports or rejects does not count, nor a remark on one of them alone.`,
    step1: `Read both sides' verses in the BSB (vw.py) and each quote in its full remark (cq.py <work> <ref>, cat.py, bm.py). Keep a quote only if, in context, the writer sets these two side by side in the way the note says.`,
    checkb: `Does the writer set these two side by side, in his own voice, in the way the note says? Drop each cite that does not. Recount the strength from the cites left; a note left with no interpreter is dropped.`,
    checkc: `Are both sides the right people, fairly labelled, with the right verses, and is the note fair to each?`,
    look: `a contrast unfair to one side; a side whose words do not show what its label says`,
  },
}[args.family]

const FORMAT = `The note format (read these first):
- ${LW}/crates/atlas-cli/src/extra_figures.rs, its opening comment only (lines 1 to 75): what the build checks and refuses.
- ${LW}/config/figure-forms.json: the forms (kind, label, term, about) and the "quotable" list. ${PF} holds forms this hand-off proposes that are not in that file yet; they are checked with --forms.
- Live notes to copy the style of: ${FAM.live}. Never write a note a live note already holds.

Fields, and how to fill them:
- n: the candidate's "n".
${FAM.fields}
- refs (optional): other passages the note quotes or points to, such as where the Bible itself explains it.
- original (optional): only when the Hebrew or Greek adds something a cited writer states. strong lists roots as H or G and four digits (vw.py shows keys like H4912: write H4912), each found in the note's verses. The note must name its language: "In Hebrew"; for a G root in a Gospel the Gospel writer's Greek ("In Matthew's Greek", never Jesus' own words, since He most likely spoke Aramaic); elsewhere "In Greek" or "In Paul's Greek".
- evidence: at most 400 characters; names every cited writer, as resolve.py names him, and says how he states the note. Writers' names go here and in cites only.
- limit (optional, 300 at most): where the writers differ, or what the note does not claim.
- checked: "${TODAY}".
- cites: one per work (a work is never cited twice in a note). source, work (only where the cite list credits the source by its works), on, optional at, url (only for a source with no Bible Hub chapter page), quote, read, retrieved "${TODAY}", plus found and context for the record. A cite names no writer: the cite list says who wrote a source's words on each book, and the app credits that man.
  * Quotable works only (the "quotable" list in figure-forms.json). NEVER quote the Pulpit Commentary, Gill, Spurgeon, the Geneva notes, the Companion Bible (bullinger-cb), Henry's Concise (henry-concise), Wesley, the church fathers as a group (church-fathers), the NET notes or the Tyndale notes. You may read them for leads (the candidate's "others" are such leads), then find a quotable writer who states the point.
  * Before you keep a cite, run python3 -I ${W}/tc/resolve.py <source>@"<on>". "ok" false, or a non-empty "unnamed", means do not quote it there. Its "key" is the writer the strength counts: two cites with the same key are one writer. Barnes' Notes in the Old Testament are mostly other men's (Genesis: James G. Murphy; Joshua: T. E. Espin; Hosea to Malachi: E. B. Pusey); Keil and Delitzsch are Keil or Delitzsch by book; JFB is Jamieson, Fausset or Brown by book; Henry's complete commentary is his own only on Genesis to Acts.
  * bullinger-fos: give url https://archive.org/details/figuresofspeechu00bull/page/<printed page>/mode/1up and at "<the heading the verse sits under>, p. <printed page>". Find the page with WebFetch on https://ia600409.us.archive.org/fulltext/inside.php?item_id=figuresofspeechu00bull&doc=figuresofspeechu00bull&path=/13/items/figuresofspeechu00bull&q=%22<a few exact words, spaces as %20>%22 (ask for the page numbers it returns). The search's page number minus 54 is the printed page. One fetch per quote; never guess a page. Add a Bullinger cite only where figname.py shows him explaining this very place.
  * read is, by source and copy:
    - barnes, jfb, keil-delitzsch, clarke read with cq.py: "sacred-texts.com's transcription, in the copy at github.com/jonnyg23/mahabrain (commit b00aa50)"
    - henry, calvin read with cq.py mhc, calvin: "Let's Church's copy, at github.com/LetsChurch/lets.church (commit 71f6f0f)"
    - ellicott, benson read with bm.py: "StudyLight's transcription, in the MyBible module at github.com/batanus/bible-resources (commit 14a8b1a)"
    - bullinger-fos: "the UniqueBible.app module of the 1898 text, at github.com/darrelwright/UniqueBible_Books (commit 4017a67)"
    - catena-aurea read with cat.py: "Newman's Oxford translation, in the copy at github.com/AlvaroBalbin/catena (commit efe1bd0)"
    - a web page: "Bible Hub's transcription, at <the page>" (or "New Advent's translation, at <the page>", "CCEL's text, at <the page>")
- strength: the number of different writers among the interpreters cited, by resolve.py's key: 3 or more "widely agreed", 2 "commonly held", 1 "some interpreters". strongs and easton are word books and never count. A figure that only Bullinger states may stand alone as "some interpreters".

What the build refuses, and so must you:
- A note's own words (short, about, limit, the figure, the original note) name no writer or work: no Henry, Gill, Bullinger, Calvin, Augustine, Strong's and so on. Writers go in evidence and cites.
- Any quotation of four or more words in short, about, evidence, limit or the original note must be the BSB text of the note's ref or refs. So never put a writer's words in quotation marks outside his cite: paraphrase him in evidence.
- No em dashes in your own words (house style), no mention of the ESV, nothing on the avoid list in ${LW}/config/layer-sources.json, and nothing about how the note was made (never mention AI, drafting, reviewing, searching or checking).`

const RULE = `Who may be cited, and when a writer counts (all strict; earlier checks dropped notes for each of these):
1. Quote only the quotable works, in their own words, where resolve.py names their writer. In evidence, name the man resolve.py names ("T. E. Espin (Barnes' Notes)", "Jamieson (Jamieson, Fausset and Brown)"). When a commentator's sentence is really another writer's (JFB ends a sentence "[BENGEL]"), the evidence says whose it is; a sentence he quotes from a rabbi, the Targum or "the Jewish writers" is never used.
${FAM.rule2}
3. Never cite Ellicott on Psalms, Song of Solomon, Obadiah, Jonah or Ecclesiastes, Keil and Delitzsch or the Pulpit Commentary on Ecclesiastes, the Pulpit Commentary on Jeremiah or Lamentations, Calvin on Matthew 27:9 or Acts 7:14 and 7:16, Keil and Delitzsch on Psalm 74:4, 86:1 or 130:1, or the Pulpit Commentary on 2 Corinthians 3:7; never a remark that calls a book or its events fiction or myth, treats a true account as a mere story, denies the writer a book's title names, or says the text is in error. Among the Fathers (Catena Aurea, or New Advent and CCEL translations only), never Origen, Didymus, Theodore of Mopsuestia, Pelagius, Arius, Nestorius, Apollinaris, Evagrius, Tatian, Novatian, Tertullian, Theodoret, Hippolytus, Victorinus, Clement of Alexandria, or (outside the Catena) Eusebius; never the Catena's Pseudo-Chrysostom on Matthew; the Gloss is not a writer.
4. Never name in evidence a rabbi, a Jewish commentator or scholar, BDB, Thayer, the Cambridge Bible, the Expositor's, Meyer, Vincent, the ICC or the UBS Handbooks, even when a Christian writer quotes one. Ancient texts (the Septuagint, the Targums, Josephus) may be named only as witnesses.
5. Accuracy beats count: a solid note on every candidate the writers support, but never a weak one to fill the count. Leave out a candidate whose quote does not carry the point and for which no quotable writer can be found who does.`


const TOOLS = `Tools (run with python3 -I). Do not download, clone or install anything, and write files only in your folder ${H}/work/<batch key>/:
- python3 -I ${W}/every/mk_every.py show ${NN} <batch index> prints your batch's candidates.
- ${W}/vw.py "<ref>" prints the BSB verse word for word with its Hebrew or Greek words and Strong's keys ("Isaiah 5:1", "Luke 15:4-7"). Copy figure words from its "==" line.
- ${W}/figname.py "<ref>" prints every place Bullinger's Figures of Speech uses the verse, with the figure and the chain of headings above it and his remark.
- ${W}/cq.py all "<ref>" prints the local commentaries on a verse (clarke, barnes, jfb, kad = keil-delitzsch, mhc = Henry's complete commentary, calvin, fos = bullinger-fos; it also prints gill, mhcc, geneva and cb, which may give leads but are never quoted; ignore wesley), cut at 2500 characters; "cq.py <work> <ref>" prints one in full. A heading like "section isa 5:1" means the remark covers verses from there.
- ${F}/bm.py <ellicott|benson> "<ref>" prints that work's remarks on the chapter from a pinned copy (bm.py pulpit may give leads; the Pulpit is never quoted).
- ${W}/tc/resolve.py <source>@"<on>" prints who wrote that source's words there, the writer key the strength counts, and the link the app gives the cite.
- ${W}/cat.py "<ref>" prints the Catena Aurea on a Gospel verse, under each Father's name; "cat.py check <ref> <quote>".
- Use only these tools and pages. Never read other folders in the scratchpad: their copies are not pinned, and a cite read there is dropped.
- Bible Hub chapter pages, with the WebFetch tool only (never curl): https://biblehub.com/commentaries/<code>/<book>/<chapter>.htm, <code> one of poole, bengel, maclaren, chrysostom, and <book> lowercase with underscores (1_samuel, song_of_solomon; Psalms is psalms). Ask WebFetch for the remark on your verse word for word; it gives at most about 120 characters verbatim per answer, so ask for a long quote in pieces. Every agent in this project shares 400 web fetches an hour: the local copies come first, fetch at most 4 pages for the whole batch, and if a fetch is refused for the budget, stop fetching.
- ${F}/poetrycheck.py --lines "<ref>" prints the BSB's own poetry lines of a verse (null for prose); poetrycheck.py <file> checks a file's parallel lines against them.
- ${F}/figcheck.py --quotes --forms ${PF} <file> runs the build's checks on a file holding {"notes": [...]}, and checks every quote from a local copy word for word. Every note you return must pass it.`


const BATCHES = args.batches
const keyOf = (k) => `h${NN}-${String(k).padStart(2, '0')}`
const strip = (notes) => JSON.stringify(notes || [], null, 1)
const PCHK = `python3 -I ${F}/poetrycheck.py <file>`

const res = await pipeline(
  BATCHES,
  (k) => agent(`${ABOUT}

You turn one batch of candidates into notes. Print the batch with
python3 -I ${W}/every/mk_every.py show ${NN} ${k}
Each candidate gives: form (the form its note takes), figure and label (what the search took it for), ref (its verses), tier, quotes (sentences where a quotable writer names it, with the writer the cite list gives for that book and the verse he heads the remark with), bullinger (Bullinger's own words on it, if any), others (Gill, Wesley or Geneva sentences: leads for a second writer, never quoted), why (the search's own note on it), live (live figure notes whose verses meet it) and layers (live Layers notes on those verses). Leave out a candidate when a live figure note already has the same form on the same place.

${FORMAT}

${RULE}

${TOOLS}

For each candidate:
1. ${FAM.step1} A candidate whose quotes all fail is dropped, unless you find a quotable writer who does state it.
2. Trim each kept quote to at most 400 characters, word for word as the copy has it, parts joined with "..." in order inside one remark.
3. Look for a second and a third writer: the other local commentaries on the passage (cq.py all, bm.py ellicott and benson, cat.py on a Gospel), and, only where those fail, a Bible Hub page for Poole, Bengel or Maclaren.
4. Write the note.
Save your notes to ${H}/work/${keyOf(k)}/draft.json as {"notes": [...]}, run ${F}/figcheck.py --quotes --forms ${PF} on it${args.family === 'parallel' ? ' and ' + PCHK : ''}, fix every problem they print, and run them again until they print no problems. Return the notes exactly as saved (with found and context on each cite), each candidate you left out in dropped with its n and a short reason, and figcheck's last line.`, { label: `write:${keyOf(k)}`, phase: 'Write', schema: OUT }),
  (draft, k) => {
    if (!draft || !draft.notes || !draft.notes.length) return { k, draft, judged: null }
    return agent(`${ABOUT}

You are the skeptic for one batch of draft notes, before they go live. Find what is wrong and fix it, or drop the note. The drafts:
${strip(draft.notes)}

${FORMAT}

${RULE}

${TOOLS}

Check every note, hard:
a. Re-open every cite. Local works: figcheck.py --quotes --forms ${PF}, cq.py, cat.py check, bm.py. Web pages: fetch the page again and find the words in the writer's own remark on the verse in "on". Words not found as given are corrected to what the writer wrote, or the cite is dropped.
b. Read each quote in its context. ${FAM.checkb}
c. ${FAM.checkc}
d. Is the ref the note's own verses, in one chapter? Are all BSB words exact and found once in their verse?
e. Do short, about, limit and the original note say no more than the cited writers state, in plain words, with no writer named? Is a reading worded as a reading? Is the evidence true to each quote and does it name the man resolve.py names?
f. Is any cite forbidden by rule 1 or 3? Is the work quotable, and does resolve.py name its writer there (ok true, no unnamed)? Does each bullinger-fos cite give its scan page in url and at, found with the search, not guessed (search again only when found does not show the search and its page)? Does the strength count resolve.py's keys? Does an original note name its language?
When unsure that a claim is supported, drop it. Save the notes you keep, whole and corrected, to ${H}/work/${keyOf(k)}/checked.json as {"notes": [...]}, run figcheck.py --quotes --forms ${PF} on it${args.family === 'parallel' ? ' and ' + PCHK : ''} until they print no problems, and return them with one verdict per draft note (keep, fix or drop, with the reason) and figcheck's last line.`, { label: `check:${keyOf(k)}`, phase: 'Check', schema: JUDGED }).then((judged) => ({ k, draft, judged }))
  },
  (r) => {
    if (!r || !r.judged) return r
    if (args.stages === 2) return { ...r, final: r.judged }  // writer and skeptic only; Layers re-reads every note before merging
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

Look hardest for: about or short saying more than the quotes; a quote that does not state this note for this passage (only a word explained, a view reported, the word used in passing, a different figure); ${FAM.look}; a strength that counts a writer who does not state the note, or counts one man twice; a cite forbidden by rule 1 or 3; evidence that credits a set instead of the man resolve.py names; a quote not word for word (re-open any you doubt; for bullinger-fos pages, search again only when found does not show the search and its page). Save the final notes to ${H}/work/${keyOf(r.k)}/final.json as {"notes": [...]}, run figcheck.py --quotes --forms ${PF} on it${args.family === 'parallel' ? ' and ' + PCHK : ''} until they print no problems, and return them with one verdict per note you saw (accept, amend, reject or restore, with the reason) and figcheck's last line.`, { label: `confirm:${keyOf(r.k)}`, phase: 'Confirm', schema: JUDGED }).then((final) => ({ ...r, final }))
  },
)

return res.filter(Boolean).map((r) => ({
  k: r.k,
  drafted: (r.draft && r.draft.notes || []).length,
  dropped_by_writer: (r.draft && r.draft.dropped || []).map((d) => ({ n: d.n, ref: d.ref, reason: d.reason })),
  checked: r.judged ? (r.judged.notes || []).length : 0,
  final: r.final ? (r.final.notes || []).length : 0,
  final_ids: r.final ? (r.final.notes || []).map((n) => n.id) : [],
}))
