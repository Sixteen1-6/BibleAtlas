export const meta = {
  name: 'n12-review',
  description: 'Review the 12 new figures notes against the Layers corrections of PR 76, then an adversarial second reader',
  phases: [{ title: 'Review', detail: 're-read every cite and fix each note against the lessons' }, { title: 'Confirm', detail: 'second reader refutes wrong changes and catches misses' }],
}
const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const F = `${W}/fig`
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const TODAY = args.today
const FILE = args.file
const STR = ['widely agreed', 'commonly held', 'some interpreters']
const CITE = {
  type: 'object',
  properties: {
    source: { type: 'string' }, work: { type: 'string' }, url: { type: 'string' }, on: { type: 'string' }, at: { type: 'string' },
    quote: { type: 'string' }, read: { type: 'string' }, retrieved: { type: 'string' },
    found: { type: 'string', description: 'keep as given; for a web quote you changed, the exact page you fetched it from' },
    context: { type: 'string', description: 'for a web quote you changed: about 40 words around it, as the page has them' },
  },
  required: ['source', 'on', 'quote', 'read', 'retrieved', 'found'],
}
const NOTE = {
  type: 'object',
  properties: {
    id: { type: 'string' }, kind: { type: 'string', enum: ['parallelism', 'figure', 'contrast'] }, form: { type: 'string' }, ref: { type: 'string' },
    strength: { type: 'string', enum: STR }, short: { type: 'string' }, about: { type: 'string' },
    refs: { type: 'array', items: { type: 'string' } },
    lines: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, words: { type: 'string' }, mark: { type: 'string' }, key: { type: 'string' } }, required: ['ref', 'words'] } },
    pairs: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    figure: { type: 'object', properties: { name: { type: 'string' }, part: { type: 'string' }, ref: { type: 'string' }, words: { type: 'string' }, means: { type: 'string' } }, required: ['name', 'ref', 'words', 'means'] },
    sides: { type: 'array', items: { type: 'object', properties: { who: { type: 'string' }, label: { type: 'string' }, ref: { type: 'string' }, words: { type: 'string' } }, required: ['who', 'label', 'ref', 'words'] } },
    original: { type: 'object', properties: { note: { type: 'string' }, strong: { type: 'array', items: { type: 'string' } } }, required: ['note', 'strong'] },
    evidence: { type: 'string' }, limit: { type: 'string' }, checked: { type: 'string' },
    cites: { type: 'array', items: CITE },
  },
  required: ['id', 'kind', 'form', 'ref', 'strength', 'short', 'about', 'evidence', 'checked', 'cites'],
}
const CHANGE = { type: 'object', properties: { id: { type: 'string' }, field: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, lesson: { type: 'string', description: 'the lesson number, or "other: <why>"' } }, required: ['id', 'field', 'before', 'after', 'lesson'] }
const DROP = { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] } }
const REVIEWED = { type: 'object', properties: { notes: { type: 'array', items: NOTE }, changes: { type: 'array', items: CHANGE }, dropped: DROP, check: { type: 'string', description: 'the last lines figcheck.py and poetrycheck.py printed for your out.json' } }, required: ['notes', 'changes', 'dropped', 'check'] }
const CONFIRMED = {
  type: 'object',
  properties: {
    notes: { type: 'array', items: NOTE, description: 'every note that stands, whole, in its final form' },
    verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['accept', 'amend', 'restore', 'drop'] }, reason: { type: 'string' } }, required: ['id', 'verdict', 'reason'] } },
    changes: { type: 'array', items: CHANGE, description: 'the final list of edits against the input notes, yours and the first reader\'s that you kept' },
    check: { type: 'string', description: 'the last lines figcheck.py and poetrycheck.py printed for your final.json' },
  },
  required: ['notes', 'verdicts', 'changes', 'check'],
}

const ABOUT = `Bible Atlas is a Bible study app. Its Deep level shows notes on figures of speech ("figure"), parallel lines ("parallelism") and two people set side by side ("contrast"), each citing the Christian writers who state it. The owner, Shubhanshu, asked that only Bible-believing writers and theologians who love God be cited, never writers who liberalize the Bible, and that every claim be right and every quotation real. The notes go live once they pass the build's checks, so a wrong word reaches readers.`

const SITUATION = `These notes are finished: each was written by one reader and confirmed by a second, and all pass the checks. They are the notes for twelve new figure forms (acrostic, type, allegory, parable, antithesis, antimetabole, aposiopesis, meiosis, exclamation, riddle, hypocatastasis, proverb), going to the app's Layers maintainers. The last batch of our notes that went to them came back with corrections. The lessons below are those corrections, with the real before-and-after cases. These notes must already meet every one, so this hand-off needs none. Most notes will be right as they are: change only what a lesson, or a plain error, calls for, and never rewrite a sound sentence for style.`

const LESSONS = `The lessons (number each change by the lesson it applies):
1. Evidence says only what each cited quote says. Every claim the evidence makes for a writer must be in that writer's quoted words in his cite; a claim from elsewhere in his remark, or from a writer with no cite in the note, is trimmed (or the quote is widened, lesson 2). Cases: Jonah 3:10 ended "Bullinger files God's relenting in Jeremiah 18:8 under Anthropopatheia" with no Bullinger cite: the sentence was cut. 1 Samuel 15:11 said "Spence (Ellicott) says verse 11 speaks in human language", but his quote is on verse 29: it became "Spence (Ellicott), on verse 29: speaking in human language, the Lord is said to repent." Genesis 22:11 said Bullinger lists it "as the first of ten names said twice in Scripture, seven of them by God to men, Jacob, Moses and Samuel among them", which his quote did not say: it became "Bullinger lists the verse under Epizeuxis: when thus used, the figure calls special attention to the person and to a solemn moment of importance."
2. The quote must carry the point it is cited for. If the quoted words alone do not state what the note uses them for (that these words are figurative and what they stand for; how the lines answer; which words are the a and b members), widen the quote with more of the same remark, word for word, in the order he wrote it, parts joined with " ... ", 400 characters at most. Cases: Mark 7:9's Bullinger quote "Here the Irony is beautifully brought out by translating καλῶς (kalōs) “full well.”" was widened to add "καλῶς means with propriety, suitably, becomingly. ... “Well do ye reject.” No, ye do evil!"; Isaiah 55:8's "In verses 8 and 9 taken together, the figure is a simple Epanodos" was widened to show the a and b members and "Here in a and a we have “thoughts”; while in b and b we have “ways.”"; 2 Corinthians 12:13's Calvin quote was widened to include "that he had served them gratuitously". Isaiah 40:21's Delitzsch quote kept only the parts that carry the point and dropped a tail that did not.
3. cite.on is the verse or range the quoted remark is on, as the writer heads it, read in his copy. Cases: Exodus 13:9's cite "on" "Exodus 13:8" became "Exodus 13:8-9"; Exodus 16:6's "Exodus 16:2" became "Exodus 16:6-7".
4. For Bullinger (bullinger-fos), figure.part and the cite's at use his own heading words for the place the verse sits, as figname.py prints them, not a paraphrase. Case: Genesis 4:10's part "Human actions given to things" became "Inanimate things", and at "Prosopopoeia: human actions given to inanimate things, p. 864" became "Prosopopoeia: inanimate things, p. 864", with the evidence's wording following ("among inanimate things spoken of as persons").
5. Hebrew or Greek wording names its writer's language: "In James's Greek", "In Paul's Greek", "In Luke's Greek", "In John's Greek" (for a Gospel, the Gospel writer, never Jesus' own words), never a bare "In Greek" where the book's writer is known; "In Hebrew" for the Old Testament. Case: James 1:15's "In Greek the verbs are those of childbearing" became "In James's Greek the verbs are those of childbearing".
6. A limit never claims unnamed dissent ("some read", "others take", "many deny", "it is disputed") unless a cited writer's own quoted words say so; otherwise trim it to what the cited writers say, or leave the limit out.
7. Parallel lines in verses the BSB sets as poetry are its own lines: each line of a parallel note is one of the BSB's lines, part of one, or whole lines together, and for same, opposite, building and climbing no two of a note's lines share one (poetrycheck.py checks it; poetrycheck.py --lines "<ref>" prints a verse's lines). Case: Proverbs 26:3's three lines became two, since the BSB's first line is "A whip for the horse, a bridle for the donkey,", with short and about following ("The two lines are built alike"). Figure notes have no lines, so this touches only parallel notes.
8. The note's own words (short, about, figure.means, limit, the original note) are plain sentences in our words, saying no more than the cited writers state; they never copy a writer's phrasing closely. Case: Exodus 6:6's "Since a man's strength lies so largely in his arms" (a writer's own words) became "Since much of a man's strength is in his arms".
9. Strength is the number of different writers among the cites, by resolve.py's key (3 or more "widely agreed", 2 "commonly held", 1 "some interpreters"); two cites with one key are one writer; strongs and easton never count. If a cite falls, the strength and the evidence follow.
For these twelve forms also: figure.name is the form's name, the term's first name in ${W}/n12/forms12-main.json (Acrostic, Type, Allegory, Parable, Antithesis, Antimetabole, Aposiopesis, Meiosis, Exclamation, Riddle, Hypocatastasis, Proverb), and Bullinger's own term (Ecphonesis, Parœmia, Ænigma, Epanodos and so on) goes in evidence. A type, an allegory or a parable's meaning is the cited writers' reading: word it as theirs where they differ, and where the New Testament itself draws the type (Romans 5:14, 1 Corinthians 10:6 and 11, Galatians 4:24, Hebrews 9 and 10), put that verse in refs and let about say so.`

const RULES = `Rules that still hold (the earlier checks dropped notes for each):
- Quote only these works, in their own words, where resolve.py names their writer: henry, barnes, jfb, keil-delitzsch, ellicott, benson, poole, calvin, clarke, bengel, maclaren, chrysostom, catena-aurea, edersheim, bullinger-fos (and the word books strongs and easton, which never count as writers). Never quote the Pulpit Commentary, Gill, Spurgeon, the Geneva notes, the Companion Bible, Henry's Concise, Wesley, the NET or Tyndale notes, or any modern work.
- Never Ellicott on Psalms, Song of Solomon, Obadiah, Jonah or Ecclesiastes; Keil and Delitzsch on Ecclesiastes or Psalm 74:4, 86:1, 130:1; Calvin on Matthew 27:9 or Acts 7:14, 7:16; never a remark that calls a book or its events fiction or says the text errs; among the Fathers never Origen, Tertullian, Theodoret, Clement of Alexandria, Pseudo-Chrysostom on Matthew and the others the cite list bars; the Gloss is not a writer. Never name a rabbi, a Jewish commentator, BDB, Thayer, the Cambridge Bible, the Expositor's, Meyer, Vincent or the ICC in evidence.
- A writer states the note himself, on this verse: a view he only reports ("some think") or rejects does not count.
- A note's own words name no writer or work. Any quotation of four or more words in short, about, evidence, limit or the original note is BSB text of the note's ref or refs; a writer's words are paraphrased in evidence, never put in quotation marks outside his cite. No em dashes. No mention of the ESV. Nothing about how a note was made (never AI, drafting, reviewing or checking).
- Limits: short 52 characters, about 300, evidence 400, limit 300, figure.name 40, part 60, means 160, quote 20 to 400.`

const TOOLS = `Tools (run with python3 -I; never download, clone or install anything; write files only in ${F}/work/<your key>/):
- ${W}/vw.py "<ref>": the BSB verse word for word with its Hebrew or Greek words and Strong's keys.
- ${W}/figname.py "<ref>": every place Bullinger's Figures of Speech uses the verse, with the figure, the chain of headings above it, and his remark (the local copy of bullinger-fos).
- ${W}/cq.py <work> "<ref>": a local commentary in full on that verse: barnes, jfb, kad (keil-delitzsch), clarke, mhc (henry), calvin, fos (bullinger-fos). "cq.py all <ref>" shows them all, cut short. A heading like "section psa 1:4" means the remark covers verses from there: that is how you know what "on" should be.
- ${F}/bm.py <ellicott|benson> "<ref>": that work's remarks on the chapter.
- ${W}/cat.py "<ref>": the Catena Aurea on a Gospel verse, under each Father's name.
- ${W}/tc/resolve.py <source>@"<on>": who wrote that source's words there, and the writer key the strength counts.
- WebFetch, only for a cite whose found is a biblehub.com, newadvent.org or ccel.org page, and only when its quote must be widened or its on checked: at most 3 fetches for your whole group, and if one is refused, work without it. WebFetch gives about 120 characters word for word per answer, so ask for the exact words in pieces. Never use curl.
- Checks, both must end with 0 problems: ATLAS_SOURCES_EXTRA=${W}/ns/main-sources.json python3 -I ${F}/figcheck.py --quotes --forms ${W}/n12/forms-all.json <file> (the build's checks, and every local quote word for word), and python3 -I ${F}/poetrycheck.py <file>.`

const show = (k) => `python3 -I -c "import json; g = json.load(open('${FILE}'))[${k}]; print(g['key'], g['form']); print(json.dumps({'notes': g['notes']}, ensure_ascii=False, indent=1))"`
const ks = args.only
const keyOf = (k) => `n12rv-${k}`

const res = await pipeline(
  ks,
  (k) => agent(`${ABOUT}

${SITUATION}

Your group is number ${k}. Print it with:
${show(k)}
Save the notes as ${F}/work/${keyOf(k)}/in.json (make the folder).

${LESSONS}

${RULES}

${TOOLS}

For each note:
1. Re-read every cite's remark in the copy it was read from (its read field says which; found keeps the page or file): cq.py for barnes, jfb, keil-delitzsch, clarke, henry and calvin; bm.py for ellicott and benson; figname.py for bullinger-fos; cat.py for the Catena; the web page for poole, bengel and the Fathers (fetch only under the limit above). Confirm that the quote is his word for word, that it carries the point (lesson 2), that on is the verse or range his remark is on (lesson 3), and that resolve.py names a writer there.
2. Go through lessons 1 to 9 and the rules, one by one, and fix what fails. A widened quote is still his exact words in order. When you change a quote from a local copy, figcheck --quotes must still find it; when you change a web quote, set found to the page you fetched and give context.
3. Recount the strength (lesson 9) and make the evidence name exactly the cited writers, each saying only what his quote says.
4. If a note cannot be made sound (its only writer does not state it, or the figure is not in the verse), drop it with the reason.
5. Set checked to "${TODAY}" on every note you keep. Keep every other field, and keep found on every cite.
Write the notes you keep to ${F}/work/${keyOf(k)}/out.json as {"notes": [...]}, run both checks on it, and fix until both end with 0 problems.
Return the notes you keep (whole), every change (id, field, before, after, lesson), the dropped notes with reasons, and the checks' last lines. If nothing needs changing, return the notes as they are with an empty changes list.`, { label: `check:${keyOf(k)}`, phase: 'Review', schema: REVIEWED }),
  (rev, k) => rev ? agent(`${ABOUT}

${SITUATION}

A first reader has gone through group ${k} against the lessons below and made the changes listed at the end. You are the second reader, and your job is adversarial: assume each change may be wrong until you have read the source yourself, and assume the first reader missed something.

The group as it was before the first reader: print it with
${show(k)}
The first reader's notes are in ${F}/work/${keyOf(k)}/out.json (if missing, use the notes below).

${LESSONS}

${RULES}

${TOOLS}

For each note:
1. For each change: read the writer's remark yourself in its copy. Restore the original wording when the change makes a quote not his exact words, misstates what he says, moves on away from the verse his remark is on, names a heading Bullinger does not use there, or cuts a true and quoted point. Keep it when it is right. Amend it when it is half right.
2. Then check the note afresh against lessons 1 to 9 and the rules, as if no one had: every evidence claim in its writer's quote; every quote carrying its point; on right; Bullinger's heading words; the language named; no unnamed dissent in limit; BSB poetry lines; our own words; strength by distinct writers; figure.name the form's name. Fix what the first reader missed.
3. Drop a note only when it cannot be made sound, and say why.
Keep found on every cite (for a web quote you change, the page you fetched, plus context), and checked "${TODAY}". Write the final notes to ${F}/work/${keyOf(k)}/final.json as {"notes": [...]}, run both checks, and fix until both end with 0 problems.
Return the final notes (whole), a verdict for each note of the group (accept: the first reader's version stands; amend: you changed it further; restore: you undid a change; drop), the final list of changes against the original notes, and the checks' last lines.

The first reader's changes:
${JSON.stringify(rev.changes, null, 1)}
The first reader dropped:
${JSON.stringify(rev.dropped, null, 1)}
The first reader's notes:
${JSON.stringify({ notes: rev.notes }, null, 1)}`, { label: `confirm:${keyOf(k)}`, phase: 'Confirm', schema: CONFIRMED }) : null,
)
const out = res.map((r, i) => r ? { key: keyOf(ks[i]), notes: r.notes.length, verdicts: r.verdicts.map(v => `${v.id}: ${v.verdict}`), changes: r.changes.length, check: r.check } : { key: keyOf(ks[i]), failed: true })
return out
