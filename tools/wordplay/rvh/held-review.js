export const meta = {
  name: 'held-wordplay-review',
  description: 'Four-step check of the held Wordplay passages: a reviewer, a skeptic for its findings, a fresh critic, and a skeptic for the critic (resumes from finished reviews and skeptics passed in args)',
  phases: [
    { title: 'Review', detail: 'one reviewer per batch of passages' },
    { title: 'Verify', detail: 'a skeptic checks each finding' },
    { title: 'Critic', detail: 'fresh eyes on the fixed batch' },
    { title: 'Verify critic', detail: 'a skeptic checks the critic findings' },
  ],
}
// args: { sp: scratchpad, items: [{ batch: [passage ids], review?: <a finished review>, verdicts?: <a finished skeptic's results> }] }
const SP = args.sp
const ITEMS = args.items

const SETUP = `You are checking notes for Bible Atlas, a Bible study web app. Its "Layers" notes explain a verse's plain meaning, wordplay, name meanings, allusions, fulfillments and patterns, each backed by cites of Bible-believing commentaries. These 71 passages (214 notes) were held back from an earlier round and have now been mended and given second writers by the Wordplay thread; every note in them is NEW and under review. Notes go live WITHOUT human review once they cite a listed work and pass the build, so this check is the only one: be exact and skeptical, read the sources yourself, and never assume a note is right because it reads well.

TOOLS (run every command from the scratchpad: cd ${SP} && python3 -I ...; Python always with -I):
- python3 -I rvh/show.py <passage-id> ... : the passage, every note, each cite with the writer the cite list names for that book (Bible Hub's "Barnes' Notes" on most Old Testament books are other men's; Ellicott, the Pulpit Commentary and Jamieson-Fausset-Brown have a different writer per book; the Catena Aurea resolves to Aquinas as compiler, with the father it quotes in "at"), and every reads record (rec N) with its quote or pointer and where and when it was read.
- python3 -I rvh/src.py <source-id> "<Book c:v>" : that source's comment on the verse, from pinned local copies (gill clarke barnes jfb keil-delitzsch henry henry-concise wesley calvin geneva bullinger-cb bullinger-fos pulpit ellicott benson tyndale-notes catena-aurea). "python3 -I rvh/src.py check <source> "<ref>" "<quote>"" says VERBATIM, CLOSE (score) or NOT FOUND; "grep" finds sentences; "--full" before pulpit/ellicott/benson prints the whole chapter. For pulpit, ellicott and benson the local copy is StudyLight's transcription of the same words, so CLOSE 0.90+ counts as found; the Pulpit's homilies (from HOMILETICS on) are other men's words, never the Exposition's writer. Keil and Delitzsch, Calvin and others often comment on a whole section: the comment covering the verse counts.
- python3 -I wp/vw.py "<Book c:v>" : the BSB text of the verse and its Hebrew or Greek words with Strong's numbers.
- ${SP}/lwh/config/layer-sources.json (the cite list: roles, writers by book, works, denies, avoid list), ${SP}/lwh/config/shelf.json and ${SP}/lwh/crates/atlas-cli/src/layers.rs (the build's checks) may be read for reference.
- WebFetch only for a source with no local copy (poole, bengel, reformation-sb, net-notes, church-fathers, the modern works, and any other) or when a local copy cannot settle it; at most __FETCHES__ fetches in your whole task, because the fetch limit is shared with other checkers. Right after each successful fetch run: date -u +%Y-%m-%dT%H:%M:%SZ and keep that time with the URL. StudyLight pages often refuse; do not retry them.
STRICT: read-only. Never edit, create or delete any file in /home/claude/bibleatlas, ${SP}/lwh, ${SP}/wp or /mnt/project-files, never run git, never clone or download anything, never write outside ${SP}/rvh/tmp (you may write scratch files there only).

THE RULES A NOTE MUST MEET (the founder's rules and the build's):
1. Sources. Every cite is a Bible-believing Christian writer on the cite list for that book. The cited words must respect Scripture. No rabbis or Jewish commentaries, no avoid-list names. Ancient texts (Targums, Josephus) may appear in evidence only as witnesses. Church fathers only as New Advent, CCEL or the Catena give them, and never Origen, Tertullian, Hippolytus, Victorinus, Clement of Alexandria, Didymus, Theodore of Mopsuestia, Pelagius, the Opus Imperfectum, the Gloss or Lactantius, not even named in evidence.
2. Each cite's record must hold words the source really prints in its comment on the record's "on" verse (or the section comment covering it). A quote found only in another verse's comment is a problem: the cite's "on" or the quote must change. The Pulpit Commentary, the NET notes, the Reformation Study Bible and copyrighted modern works (The Gospel Coalition, Themelios, Ligonier, Leithart, Keener) are never quoted: their records carry a "pointer" (what the page says) instead, and evidence never repeats five or more of their words in a row or puts their words in quotation marks.
3. Strength counts writers, not works. Only cites whose writer STATES THE NOTE'S POINT in his own voice on that verse count; a view he only reports, or rejects, does not; a cite marked counts:false and reference works do not count. One man's two works count once (Bullinger's Companion Bible and Figures of Speech are one writer; Henry and the Concise Commentary are one; Wesley counts as Matthew Henry in the Old Testament and as Bengel in the New). 3 or more writers: "widely agreed"; 2: "commonly held"; 1: "some interpreters". A note may claim less than its count, never more. For a wordplay, name meaning or figure point, a bare cross-reference does not count; for a note that links two passages (quotation, allusion, fulfillment, pattern), a writer who on this verse points to the very passage linked does count. "plain meaning" notes are always "widely agreed" and are never lowered or counted.
4. Every passage must keep at least one note besides the plain meaning that is not "some interpreters" (the build refuses the passage otherwise). If an honest lower strength breaks this, the fix is a second writer who states the point (read on his page, with the time), or dropping the passage.
5. Text (shown to every reader, at most 300 characters): plain English for ordinary readers, no em dashes, no writer or source names. Every claim in it must be stated by the counted writers (a claim only one writer makes may stand only with wording such as "some see"). Words in quotation marks that run 4 or more words must be the BSB's exact words from the passage or the note's refs. Greek wording is credited to the book's writer ("In Luke's Greek", "In John's Greek", "In Paul's Greek"), never to Jesus' own speech; Hebrew is "In the Hebrew"; an Aramaic reading is called a reconstruction unless the text itself keeps the Aramaic; the Peshitta is "a later translation"; a disputed reading says "scholars differ". Transliterations and glosses must match the Hebrew or Greek of the verse (check with vw.py).
6. Evidence (shown one level deeper, at most 400 characters, no em dashes): says what each cited writer says, accurately, naming the writer the cite list gives for that book (e.g. "E. B. Pusey (Barnes' Notes)", "A. R. Fausset (Jamieson-Fausset-Brown)", "the continuation of Poole's Annotations" for Poole's unnamed continuator), never a set's figurehead for another man's words. It names only writers who are cited on this note (a plain meaning line "Rests on ..." that names writers must name only cited ones), says nothing a cited writer does not say in the cited comment, and for the never-quoted works stays within the record's pointer.
7. Kind, refs and words fit the note: refs include the passages the note links; each "words" entry names a Strong's root that occurs in that verse and is the word the note discusses.
Known kinds of problems in notes like these (an earlier review found one note in four needed a fix): evidence naming a writer who is not cited; a set credited to its figurehead; evidence going beyond a pointer or repeating a never-quoted work's words; a writer's claim taken from his comment on a different verse; text claims that no counted writer states; strength above the number of writers who state the point; a quote that is not on the page.

HOW TO FIX (prefer the smallest honest fix): rewrite text or evidence so it says only what the sources say; lower strength; mark a cite counts:false (it stays as a source but does not count) or drop it; drop a note; drop a passage. Changing a record's quote is allowed when the writer plainly states the point in that same comment: give the exact words from the local copy, and always give a fallback (the edits to make instead if those words cannot be confirmed on the linked web page). Adding a new cite needs its words read on the web page the cite links, with the URL and the time, and its source must have a part on the cite list for that book. Every value you propose must itself meet every rule above (count characters; no em dashes; names only cited writers).`

const OPS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['set_field', 'cite_counts_false', 'drop_cite', 'drop_note', 'drop_passage', 'set_record_quote', 'add_cite'] },
      field: { type: 'string', enum: ['text', 'evidence', 'strength', 'kind', 'refs', 'words', 'saying'] },
      value: { type: 'string', description: 'set_field: the complete new value (for refs or words, a JSON string)' },
      cite_index: { type: 'integer', description: 'index of the cite in the note (0-based)' },
      rec: { type: 'integer', description: 'set_record_quote: the rec number from show.py' },
      quote: { type: 'string', description: 'set_record_quote: the exact new words' },
      confirmed_on: { type: 'string', description: 'where the words were found: a local label from src.py, or the URL fetched' },
      read_time: { type: 'string', description: 'UTC time of the web read (date -u right after the fetch), if read on the web' },
      cite_json: { type: 'string', description: 'add_cite: the cite object as JSON' },
      record_json: { type: 'string', description: 'add_cite: {url, quote or pointer, time, how} as JSON' },
      fallback: { type: 'string', description: 'set_record_quote: the exact edits to make instead if the words cannot be confirmed on the linked page' },
    },
    required: ['type'],
  },
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    notes_checked: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          note_index: { type: 'integer' },
          problems: { type: 'array', items: { type: 'string' }, description: 'each problem with the evidence: what the source says or does not say' },
          categories: { type: 'array', items: { type: 'string', enum: ['quote-not-in-comment', 'claim-not-in-source', 'evidence-names-uncited-writer', 'evidence-misstates-source', 'wrong-writer-credit', 'strength-overclaims', 'text-rule', 'kind-refs-words', 'source-rule', 'passage-check-4', 'never-quoted-words', 'other'] } },
          ops: OPS_SCHEMA,
          checked: { type: 'string', description: 'what you ran or read to establish it' },
        },
        required: ['passage', 'note_index', 'problems', 'categories', 'ops', 'checked'],
      },
    },
    clean: { type: 'array', items: { type: 'string' }, description: 'passage#note for every note you checked and found clean' },
  },
  required: ['notes_checked', 'findings', 'clean'],
}
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          note_index: { type: 'integer' },
          verdict: { type: 'string', enum: ['confirm', 'amend', 'refute'] },
          reason: { type: 'string' },
          ops: OPS_SCHEMA,
        },
        required: ['passage', 'note_index', 'verdict', 'reason', 'ops'],
      },
    },
  },
  required: ['results'],
}
const setup = (n) => SETUP.replace('__FETCHES__', String(n))

function reviewPrompt(batch) {
  return `${setup(4)}

YOUR TASK: review every note in these passages: ${batch.join(', ')}.
Start with: cd ${SP} && python3 -I rvh/show.py ${batch.join(' ')}
For each note: read each cite's comment with src.py (or the web, within the limit), check its record quote is in that comment, decide whether the writer states the note's point in his own voice, recount the strength, and check text and evidence against every rule. Check each passage as a whole for rule 4.
Report at most ONE finding per note: put all of that note's problems in it, and give ops whose values are final (if text and evidence both change, give both complete new values). Do not report style preferences; report what breaks a rule or misstates a source. List every note you found clean in "clean" (as passage#index). notes_checked is the number of notes you checked.`
}
function verifyPrompt(batch, findings, round) {
  return `${setup(6)}

YOUR TASK: you are the skeptic. ${round === 1 ? 'A reviewer' : 'A second, fresh reviewer'} checked the notes of ${batch.join(', ')} and reported the findings below. For EACH finding, check it yourself against the sources (run show.py and src.py; do not trust the reviewer's reading) and decide:
- refute: the note is fine as it is, or the problem is not real (ops empty);
- confirm: the problem is real and the ops are right and meet every rule;
- amend: the problem is real but the ops need changing; give the corrected complete ops.
Check every proposed value for length, em dashes, uncited names, BSB quotes, strength count and rule 4, and that it says nothing the sources do not.
For each set_record_quote or add_cite you confirm or amend: the words must be confirmed on the page the record links (its url). Use WebFetch on that url (for a long Bible Hub chapter page that is cut off, the verse page https://biblehub.com/commentaries/<work>/<book>/<chapter>-<verse>.htm may be used and named in confirmed_on), run date -u right after, and put the URL in confirmed_on and the time in read_time. For a Figures of Speech (archive.org) or StudyLight page you cannot read, a VERBATIM local check is acceptable: set confirmed_on to the local label and leave read_time empty. If the words cannot be confirmed, return the finding's fallback as the ops instead.
${round === 2 ? 'These findings were made on the notes AFTER earlier confirmed fixes (listed with each finding as already_applied); keep the final values consistent with them. note_index, cite_index and rec use the numbering show.py prints (before any fix).\n' : ''}
FINDINGS:
${JSON.stringify(findings, null, 1)}`
}
function criticPrompt(batch, confirmed) {
  return `${setup(4)}

YOUR TASK: a fresh, independent review. Another reviewer and a skeptic have already checked the notes of ${batch.join(', ')}; the fixes they agreed are listed below and WILL be applied (show.py prints the notes BEFORE them, so apply them in your head). Look for anything still wrong in the notes as they will stand after those fixes: claims no counted writer states, strength above the count, evidence that misstates a source or names an uncited writer, wrong writer credits, never-quoted words repeated, text rules (BSB quotes, language credit, transliterations), quotes not in the comment, rule 4 for each passage, and anything the agreed fixes themselves got wrong. Read the sources yourself; do not repeat a problem the agreed fixes already solve.
Report findings in the same form. note_index, cite_index and rec always use show.py's numbering (before any fix), as the agreed fixes do. When your ops change a field an agreed fix also sets, give the complete final value. If you find nothing, return no findings.
AGREED FIXES (ops per note):
${JSON.stringify(confirmed, null, 1)}`
}
const keep = (vs) => (vs || []).filter(r => r.verdict !== 'refute').map(r => ({ passage: r.passage, note_index: r.note_index, ops: r.ops }))

const results = await pipeline(
  ITEMS,
  async (it) => {
    if (it.review) return { batch: it.batch, review: it.review, prior: it }
    const r = await agent(reviewPrompt(it.batch), { label: `review:${it.batch[0]}`, phase: 'Review', schema: FINDINGS_SCHEMA })
    return { batch: it.batch, review: r, prior: it }
  },
  async (st) => {
    const { prior, ...s } = st
    if (!s.review) return { ...s, verdicts: null, kept: [] }
    if (prior.verdicts) return { ...s, verdicts: prior.verdicts, kept: keep(prior.verdicts) }
    const f = s.review.findings || []
    if (!f.length) return { ...s, verdicts: [], kept: [] }
    const v = await agent(verifyPrompt(s.batch, f, 1), { label: `verify:${s.batch[0]}`, phase: 'Verify', schema: VERDICT_SCHEMA })
    const vs = (v && v.results) || null
    return { ...s, verdicts: vs, kept: keep(vs) }
  },
  async (st) => {
    if (!st.review || st.verdicts === null) return { ...st, critic: null }
    const c = await agent(criticPrompt(st.batch, st.kept), { label: `critic:${st.batch[0]}`, phase: 'Critic', schema: FINDINGS_SCHEMA })
    return { ...st, critic: c }
  },
  async (st) => {
    const cf = (st.critic && st.critic.findings) || []
    if (!st.critic) return { ...st, verdicts2: null }
    if (!cf.length) return { ...st, verdicts2: [] }
    const withPrior = cf.map(f => ({ ...f, already_applied: st.kept.filter(k => k.passage === f.passage && k.note_index === f.note_index).map(k => k.ops) }))
    const v = await agent(verifyPrompt(st.batch, withPrior, 2), { label: `verify2:${st.batch[0]}`, phase: 'Verify critic', schema: VERDICT_SCHEMA })
    return { ...st, verdicts2: (v && v.results) || null }
  },
)
const out = results.map((r, i) => r || { batch: ITEMS[i].batch, failed: true })
const failed = out.filter(r => r.failed || !r.review || r.verdicts === null || r.verdicts2 === null || !r.critic).map(r => r.batch[0])
log(`${out.length} batches; incomplete: ${failed.length ? failed.join(', ') : 'none'}`)
return { results: out, incomplete: failed }
