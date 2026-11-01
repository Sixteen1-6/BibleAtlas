export const meta = {
  name: 'write-layers-notes-63',
  description: 'Write Layers wordplay notes under PR #63 credits, each cite read on the page it links with the time, then a skeptic and a second reader check every note',
  phases: [
    { title: 'Write', detail: 'one writer per batch of verses' },
    { title: 'Check', detail: 'a skeptic re-reads every cite on its linked page and fixes or drops' },
    { title: 'Confirm', detail: 'a second reader accepts, amends or rejects each note' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const L = `${W}/lw28`
const TODAY = args.today
const KINDS = ['plain meaning', 'quotation', 'allusion', 'wordplay', 'name meaning', 'pattern', 'irony', 'fulfillment']
const STR = ['widely agreed', 'commonly held', 'some interpreters']

const CITE = {
  type: 'object',
  properties: {
    source: { type: 'string', description: 'an id from the cite list in config/layer-sources.json (gill, clarke, barnes, jfb, keil-delitzsch, henry, henry-concise, wesley, calvin, bullinger-cb, bullinger-fos, ellicott, benson, poole, bengel, pulpit, geneva, catena-aurea, ...)' },
    on: { type: 'string', description: 'the verse the remark is on: the commentator\'s own heading verse, as "Genesis 2:17"' },
    at: { type: 'string', description: 'only where the cite list needs it: bullinger-fos "E. W. Bullinger, Figures of Speech Used in the Bible (1898), <heading>"; catena-aurea the Father and passage' },
    url: { type: 'string', description: 'only when the cite does not link resolve.py\'s chapter page: bullinger-fos (https://archive.org/details/figuresofspeechu00bull/page/n<search page - 1>/mode/1up), a Bible Hub verse page or other page where a cut-off chapter page made you read it' },
    work: { type: 'string', description: 'only for a source the cite list credits by its works' },
    quote: { type: 'string', description: 'public-domain works: the writer\'s words, word for word as on the page read, 20 to 400 characters, parts joined with "..." in order inside one remark' },
    pointer: { type: 'string', description: 'only for the Pulpit Commentary, the NET notes and the Reformation Study Bible (copyrighted): where on the page and how the writer makes the point, in your own words, never his' },
    page: { type: 'string', description: 'the exact page you read the words on; it must be the page the cite links (resolve.py\'s link, or url when given)' },
    time: { type: 'string', description: 'the UTC time printed by date -u +%Y-%m-%dT%H:%M:%SZ right after you read the page, as 2026-11-01T02:40:11Z' },
    verdict: { type: 'string', enum: ['respects'], description: 'founder\'s decision 20: the cited comment respects Scripture in its own words (leave out any comment that denies it)' },
    remark: { type: 'string', description: 'one line on where on the page the words are, or anything a checker should know' },
  },
  required: ['source', 'on', 'page', 'time', 'verdict'],
}
const LAYER = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: KINDS },
    strength: { type: 'string', enum: STR },
    refs: { type: 'array', items: { type: 'string' } },
    words: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, strong: { type: 'string' } }, required: ['ref', 'strong'] } },
    evidence: { type: 'string' },
    cites: { type: 'array', items: CITE },
    text: { type: 'string' },
  },
  required: ['kind', 'strength', 'refs', 'evidence', 'cites', 'text'],
}
const PASSAGE = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    section: { type: 'string', enum: ['law-history', 'prophets-poetry', 'jesus', 'letters-revelation'] },
    ref: { type: 'string' },
    saying: { type: 'string' },
    layers: { type: 'array', items: LAYER },
  },
  required: ['id', 'section', 'ref', 'saying', 'layers'],
}
const ADDITION = { type: 'object', properties: { passage_id: { type: 'string' }, ref: { type: 'string' }, layers: { type: 'array', items: LAYER } }, required: ['passage_id', 'ref', 'layers'] }
const DROP = { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, kind: { type: 'string' }, reason: { type: 'string' } }, required: ['ref', 'kind', 'reason'] } }
const OUT = { type: 'object', properties: { passages: { type: 'array', items: PASSAGE }, additions: { type: 'array', items: ADDITION }, dropped: DROP, check: { type: 'string', description: 'the last line lcheck.py printed for your file' } }, required: ['passages', 'additions', 'dropped', 'check'] }
const JUDGED = {
  type: 'object',
  properties: {
    passages: { type: 'array', items: PASSAGE, description: 'every passage you keep, whole, with your corrections' },
    additions: { type: 'array', items: ADDITION },
    verdicts: { type: 'array', items: { type: 'object', properties: { note: { type: 'string', description: 'passage id or addition passage_id, and the layer index, as "genesis-2-17 #1"' }, verdict: { type: 'string', enum: ['keep', 'fix', 'drop', 'accept', 'amend', 'reject', 'restore'] }, reason: { type: 'string' } }, required: ['note', 'verdict', 'reason'] } },
    check: { type: 'string', description: 'the last line lcheck.py printed for your file' },
  },
  required: ['passages', 'additions', 'verdicts', 'check'],
}

const ABOUT = `Bible Atlas is a Bible study app. Its Layers card shows short notes on a passage, from the plain meaning outward (plays on words, allusions, name meanings), each citing the writers who state it. The owner asked that every example that can be cited be shown, and that only Bible-believing writers and theologians who love God be cited, never writers who liberalize the Bible; Christian writers only (Catholic and Orthodox writers who uphold Scripture count; rabbis and Jewish scholars do not). Notes go live once they pass the build's checks, so every claim must be right and every quotation real.`

const FORMAT = `The Layers format (look at three live notes of the same kind first: python3 -I -c "import json; [print(json.dumps(p, ensure_ascii=False)[:3000]) for p in json.load(open('${LW}/config/layers.json'))['passages'] if p['id'] in ('exodus-15-1', 'psalm-40-1', 'hebrews-6-14')]").
- A new passage: id is the book name in lowercase with hyphens, then chapter and verse (genesis-2-17, 1-samuel-15-29; Psalms is psalm); section law-history (Genesis to Esther), prophets-poetry (Job to Malachi), jesus (Matthew to John), letters-revelation (Acts to Revelation); ref is the verse; saying is 3 to 15 words copied exactly from the BSB verse. Its first layer is "plain meaning": strength "widely agreed", refs [the verse], a one-sentence evidence, one cite of a commentary that explains the verse, and text saying plainly what the verse says. Then the other notes.
- A verse with an existing passage (existing_passage in the batch) gets only notes the app does not already have there, as an addition {passage_id, ref, layers} with no plain meaning layer. Read its live notes first and never repeat one.
- A layer: kind (here chiefly "wordplay": a play on Hebrew or Greek words that English can hide, such as a doubled verb or one word used two ways); strength; refs (the passage verse first, then the other verses the note names); words (for a wordplay, the Strong's key of each playing word in each verse it names, exactly as vw.py prints it, such as H4191; a key ending in a letter, H4191G, may be given without the letter); evidence (at most 400 characters: names every cited writer, by the name resolve.py gives for that book, and how he states the note); cites; text (at most 300 characters).
- Text: plain English a newcomer understands, full sentences, no em dashes, no writer or source names, and nothing about how the note was made (never mention AI, drafting, reviewing or checking). The text says no more than its cited writers state. Give Hebrew or Greek sounds simply (ga'oh ga'ah). For Greek wording say whose Greek ("in Luke's Greek"); never present Greek wording as Jesus' own words, since He most likely spoke Aramaic. Any quotation of four or more words in the text must be the exact BSB text of the passage verse or a verse in refs.
- Strength counts distinct writers (resolve.py's key) who state the note in their own voice: 3 or more "widely agreed", 2 "commonly held", 1 "some interpreters". A "widely agreed" or "commonly held" note beyond the plain meaning must carry a new passage; a note only one writer states may go only into an addition for a live passage. When a candidate has only one writer and no live passage, drop it with "one writer: <who>".
- Never fill reviewed_by, and nothing goes in a passage beyond the fields above.`

const RULE = `Who may be cited, and when a writer counts (all strict):
1. A cite's source must be on the cite list in ${LW}/config/layer-sources.json. Run python3 -I ${W}/tc/resolve.py <source>@"<on>" for every cite: it prints who wrote that source's words on that book ("ok" false, or a non-empty "unnamed", means do not cite it there), the writer key the strength counts, and "link", the page the cite links in the app. Barnes' Notes on Genesis are James G. Murphy's, on 1 Kings George Rawlinson's, on Hosea to Malachi E. B. Pusey's; Keil and Delitzsch are Keil or Delitzsch by book; JFB is Jamieson, Fausset or Brown by book; Henry's complete commentary is his own only on Genesis to Acts; Wesley's Old Testament notes count as Henry and his New Testament notes as Bengel; Bullinger's two books are one writer.
2. The writer must state the note himself, in his remark on this verse (or on the passage that holds it): that the words make this play (the verb doubled for certainty, the one word used two ways). A view he only reports ("some think") or rejects does not count, nor a sentence he quotes from a rabbi, the Targum or "the Jewish writers", nor a translation with no comment, nor a different play in the same verse.
3. Never cite Ellicott on Psalms, Song of Solomon, Obadiah, Jonah or Ecclesiastes; Keil and Delitzsch or the Pulpit Commentary on Ecclesiastes; the Pulpit Commentary on Jeremiah or Lamentations; Calvin on Matthew 27:9 or Acts 7:14 and 7:16; Keil and Delitzsch on Psalm 74:4, 86:1 or 130:1; Delitzsch on Psalm 86 or Proverbs 1; never a remark that calls a book or its events fiction, denies the writer a book's title names, or says the text is in error. Never name in evidence a rabbi, a Jewish scholar, BDB, Thayer, the Cambridge Bible, the Expositor's, Meyer, Vincent, the ICC or the UBS Handbooks. Ancient texts (the Septuagint, the Targums, Josephus) may be named only as witnesses.
4. The Pulpit Commentary, the NET notes and the Reformation Study Bible are copyrighted: cite them with a pointer, never their words. Every other cite carries the writer's own words as quote.
5. Every cite is read on the page it links, and the read is recorded: page (that page) and time (run date -u +%Y-%m-%dT%H:%M:%SZ right after the WebFetch that showed you the words). Bible Hub chapter pages: https://biblehub.com/commentaries/<code>/<book>/<chapter>.htm, as resolve.py's link shows. WebFetch stops at about 115,000 characters, so a long chapter page can lose its later verses: then read the Bible Hub verse page (https://biblehub.com/commentaries/<book>/<chapter>-<verse>.htm, checking the words sit under the named commentary) or, for Barnes, https://www.bibliaplus.org/en/commentaries/4/albert-barnes-bible-commentary/<book>/<chapter>/<verse>, and give that page as url. bullinger-fos: find the page with WebFetch on https://ia600409.us.archive.org/fulltext/inside.php?item_id=figuresofspeechu00bull&doc=figuresofspeechu00bull&path=/13/items/figuresofspeechu00bull&q=%22<a few exact words, spaces as %20>%22 (ask for the page numbers it returns); url is https://archive.org/details/figuresofspeechu00bull/page/n<that page minus 1>/mode/1up, at names the heading, page is that url, and the remark gives the search page and the printed page (search page minus 54). Never guess a page. Every agent in this session shares about 400 web fetches an hour: fetch only the pages you need, and if a fetch is refused for the budget, wait a minute and try once more.
6. Accuracy beats count: fewer, solid notes are better than many weak ones.`

const TOOLS = `Tools (run with python3 -I; write files only in ${L}/work/<batch key>/; never download, clone or install anything, and never read other folders in the scratchpad):
- ${W}/vw.py "<ref>" prints the BSB verse word for word with its Hebrew or Greek words, transliterations and Strong's keys ("Genesis 2:16-17").
- ${W}/figname.py "<ref>" prints every place Bullinger's Figures of Speech uses the verse, with the heading and his remark.
- ${W}/cq.py all "<ref>" prints the local commentaries on a verse (gill, clarke, barnes, jfb, kad = keil-delitzsch, mhc = henry, Matthew Henry's complete commentary, calvin, mhcc = henry-concise, wesley, cb = bullinger-cb, fos = bullinger-fos, geneva), cut at 2500 characters; "cq.py <work> <ref>" prints one in full. Use them to find writers and words fast; the read itself is on the linked web page.
- ${W}/fig/bm.py <ellicott|benson|pulpit> "<ref>" prints that work's remarks on the chapter (the Pulpit for leads and pointers only).
- ${W}/cat.py "<ref>" prints the Catena Aurea on a Gospel verse.
- ${W}/tc/resolve.py <source>@"<on>" as rule 1 says.
- ${L}/lcheck.py <file> checks a file holding {"passages": [...], "additions": [...]} the way the build does as far as a script can (references, saying, kinds, lengths, BSB quotations, Strong's keys, the cite list and who wrote each cite, quotes against the local copies, page against link, time, strength against distinct writers). Every passage and addition you return must pass it: fix every problem it prints and run it again until it prints "0 problems".`

const FILE = args.file
const show = (k) => `python3 -I -c "import json; b = json.load(open('${FILE}'))[${k}]; print(b['key']); print(json.dumps(b['verses'], ensure_ascii=False, indent=1))"`
const ks = args.only || Array.from({ length: args.count }, (_, k) => k)
const keyOf = (k) => `${args.name}-${k}`
const strip = (x) => JSON.stringify(x || [], null, 1)

const res = await pipeline(
  ks,
  (k) => agent(`${ABOUT}

You write the notes for one batch of verses. Print your verses and the leads for them with
${show(k)}
The leads are hints from an earlier study whose quotes were read in local copies with no page recorded; every quote must be read again on its linked page. Each verse may give a new passage, an addition, or nothing.

${FORMAT}

${RULE}

${TOOLS}

How to work: for each verse read the BSB and its Hebrew or Greek (vw.py), Bullinger (figname.py, cq.py fos) and the commentaries (cq.py all), then read each writer you will cite on the page resolve.py links, recording page and time. Look for second and third writers beyond the leads. Save your work to ${L}/work/${keyOf(k)}/draft.json as {"passages": [...], "additions": [...]}, run ${L}/lcheck.py on it, fix every problem, and run it again until it prints "0 problems". Return the passages and additions exactly as saved, each candidate you left out in dropped with a short reason, and lcheck's last line.`, { label: `write:${keyOf(k)}`, phase: 'Write', schema: OUT }),
  (draft, k) => {
    if (!draft || (!(draft.passages || []).length && !(draft.additions || []).length)) return { k, draft, judged: null }
    return agent(`${ABOUT}

You are the skeptic for one batch of draft notes, before they go live. Find what is wrong and fix it, or drop the note. The drafts:
${strip({ passages: draft.passages, additions: draft.additions })}

${FORMAT}

${RULE}

${TOOLS}

Check every layer, hard:
a. Re-read every cite on the page it links (WebFetch that page; for bullinger-fos the search service and the page it gives). Find the words in the writer's own remark on the verse in "on". Words not found as given are corrected to what the page has, or the cite is dropped. Set page and time from your own read (date -u right after it).
b. Read each quote in its context. Does the writer state this very note in his own voice about this verse? Drop each cite that does not (it only translates, reports a view, or finds a different play). Recount the strength from the cites left by resolve.py's key. A new passage left with no note beyond the plain meaning above "some interpreters" is dropped (an addition may keep one writer).
c. Check the Hebrew or Greek with vw.py: the Strong's keys are in those verses, the sounds are right, the play really is in the words.
d. Does the text say no more than the cited writers state, in plain words, with no writer named? Are BSB quotations exact? Is the evidence true to each quote, naming each writer as resolve.py names him?
e. Is any cite forbidden by rule 1, 3 or 4?
When unsure that a claim is supported, drop it. Save what you keep, whole and corrected, to ${L}/work/${keyOf(k)}/checked.json as {"passages": [...], "additions": [...]}, run lcheck.py on it until it prints "0 problems", and return it with one verdict per layer of the drafts (keep, fix or drop, with the reason) and lcheck's last line.`, { label: `check:${keyOf(k)}`, phase: 'Check', schema: JUDGED }).then((judged) => ({ k, draft, judged }))
  },
  (r) => {
    if (!r || !r.judged) return r
    const kept = { passages: r.judged.passages || [], additions: r.judged.additions || [] }
    if (!kept.passages.length && !kept.additions.length && !(r.draft.passages || []).length && !(r.draft.additions || []).length) return { ...r, final: null }
    return agent(`${ABOUT}

You are the second reader. A writer drafted notes for one batch, and a skeptic checked them. Read each layer the skeptic kept with fresh eyes and decide: accept it, amend it (fix what is wrong, keep what is right), or reject it (its central claim is false, or no cited writer states it). You may restore a layer the skeptic dropped only if you re-read its quotes on their pages yourself and the skeptic's reason does not hold.

The skeptic's notes:
${strip(kept)}

The skeptic's verdicts:
${strip(r.judged.verdicts)}

The writer's drafts:
${strip({ passages: r.draft.passages, additions: r.draft.additions })}

${FORMAT}

${RULE}

${TOOLS}

Look hardest for: text saying more than the quotes; a quote that does not state this note; a play that is not in the Hebrew or Greek; a strength that counts a writer who does not state the note, or two cites of one writer; a cite forbidden by rule 1, 3 or 4; a quote not word for word on its page (re-read any you doubt and record your own page and time). Save the final notes to ${L}/work/${keyOf(r.k)}/final.json as {"passages": [...], "additions": [...]}, run lcheck.py on it until it prints "0 problems", and return them with one verdict per layer you saw (accept, amend, reject or restore, with the reason) and lcheck's last line.`, { label: `confirm:${keyOf(r.k)}`, phase: 'Confirm', schema: JUDGED }).then((final) => ({ ...r, final }))
  },
)

return res.filter(Boolean).map((r) => ({ k: r.k, drafted: r.draft ? (r.draft.passages || []).length + (r.draft.additions || []).length : 0, checked: r.judged ? (r.judged.passages || []).length + (r.judged.additions || []).length : 0, final: r.final ? (r.final.passages || []).length + (r.final.additions || []).length : 0 }))
