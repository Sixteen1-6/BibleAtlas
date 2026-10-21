export const meta = {
  name: 'atlas-hard-verses-wordplay-content',
  description: 'Write, double-check and fix Bible Atlas hard-verse cards and new wordplay passages',
  phases: [
    { title: 'Write', detail: 'one writer per group of questions, one for new wordplay passages' },
    { title: 'Check', detail: 'two independent checkers per group: accuracy, and fairness/plainness' },
    { title: 'Fix', detail: 'apply every valid finding and re-check quotes' },
  ],
}

const T = args.tools
const CONTEXT = `
You are helping build Bible Atlas (https://github.com/Sixteen1-6/BibleAtlas, live at https://sixteen1-6.github.io/BibleAtlas/), a web app that draws every Bible cross-reference as arcs on one map, with the original Hebrew, Aramaic and Greek under every verse. The owner, Shubhanshu, wants it to strengthen people's faith while staying credible.

THE MAIN DESIGN RULE: simple for anyone who walks in, with the power to go deep like the Bible itself, never overwhelming. The first thing a reader sees is plain words a 12-year-old or a first-time reader understands. Depth (original languages, scholarly detail, sources) waits one tap away at the app's "Study" and "Deep" levels.

HARD RULES (a violation is a defect):
- English Bible text is the BSB (Berean Standard Bible, public domain). Anything you put inside double quotation marks that is 4 or more words long MUST be exact BSB wording from one of the entry's references. Check every such quote with the tool: python3 -I ${T}/bible.py quote "the words" "Ref" ["Ref"...]  (prints OK or NOT FOUND). Shorter quoted glosses ("heel", "to laugh") are fine.
- Look verses up with: python3 -I ${T}/bible.py text "Acts 1:18" "Matthew 27:3-8" ; original words with Strong's keys: python3 -I ${T}/bible.py words "Amos 8:2" ; search the BSB: python3 -I ${T}/bible.py find "phrase" ; verses with a root: python3 -I ${T}/bible.py strong H7019 [Book]. Run python with -I and do not cd into data folders.
- Never mention, quote or paraphrase the ESV; the word "ESV" must not appear anywhere.
- References are written "Book C:V", "Book C:V-V" or "Book C:V-C:V", with full book names as the BSB names them: "Psalms 22:1" (or "Psalm"), "Song of Solomon 8:6", "1 Samuel 15:3". Every reference must resolve in the tool.
- Aramaic/Greek rule: Jesus most likely spoke Aramaic, so a note never presents the Gospel writers' Greek wording or a Greek-only pun as Jesus' own word choice. Say "in John's Greek", "Luke's verb" etc. An Aramaic reading is called a reconstruction ("most scholars think") unless the text itself keeps the Aramaic (talitha koum, Eloi Eloi lema sabachthani, abba, ephphatha, marana tha).
- STEPBible TIPNR descriptions are AI-written: never present them as scholarship.
- Never invent a citation. Name a scholar, book, church father, council or page only when you are certain of it. If unsure, describe the view without a name ("Many commentators since the early church...").
- Be reverent, accurate and humble. Do not hide what is hard in the text. Do not preach. Do not declare one Christian tradition right where Christians genuinely differ: give the main views fairly and say plainly that Christians differ.
`

const CARD_SPEC = `
A HARD-VERSE CARD (one JSON object per question) has these fields:
- id: lowercase-hyphenated slug, unique (use the id given to you).
- ref: the main verse where the card lives (the one given to you; you may adjust to the verse that best carries the question, keeping it a single verse).
- also: other single verses or short ranges where the same "People often ask" line should also show (e.g. the other account of a contradiction). 0-4 entries.
- question: how ordinary people actually ask it, plain words, ends with "?", at most 60 characters. It shows under the verse as "People often ask: <question>".
- answer: the Simple level. 2-3 plain sentences, at most 300 characters. Lead with the clearest honest answer. If Christians genuinely differ, say so in the answer instead of picking a side. No jargon (no "pericope", "redaction", "eschatological", "Septuagint", "textual criticism", "Masoretic").
- views: the Study level. 2 to 4 objects {label, strength, text, refs}. label: a short plain name for the explanation, at most 40 characters ("Two accounts of one death"). strength: exactly one of "widely held", "commonly held", "some interpreters" (how widely Christians who have studied it hold that explanation). text: at most 300 characters. refs: 0-4 references that support that view. Include real alternatives, not straw men. Where it is a real dispute between traditions (women in church, predestination, losing salvation, hell, divorce), the views are the main positions, each in its best light.
- helps: 1-6 references of other passages that help understand this one (they are drawn as arcs on the map). Do not repeat ref.
- read_more: 1-3 links out, each {site, title, url}. Prefer one GotQuestions article (site "GotQuestions") and, where useful, one from another reputable Christian site with a different angle. Allowed hosts: gotquestions.org, bibleproject.com, thegospelcoalition.org, biblicaltraining.org, bible.org, ligonier.org, desiringgod.org, christianitytoday.com, crossexamined.org, reasonablefaith.org, biblicalarchaeology.org, catholic.com, orthodoxwiki.org, britannica.com. EVERY url MUST come from a WebSearch result you actually got in this session (use the WebSearch tool, e.g. query "Judas death hanging falling contradiction" with allowed_domains ["gotquestions.org"]). Copy the url exactly; the title is the page's title as the search shows it. gotquestions.org cannot be fetched directly (robots), so the search result is the proof the page exists. If no matching result, leave it out. Never construct or guess a url.
- evidence: the Deep level, at most 400 characters: what the answer rests on (key verses, original-language facts, manuscript facts, well-known historical views with names ONLY if certain). Plain sentences.
- notes_for_reviewer: anything a human reviewer should know (doubts, places you were unsure). Not shown to readers.
All quotes of 4+ words in answer, views[].text and evidence must pass the quote tool against ref, also, views[].refs or helps.
`

const LAYER_SPEC = `
A LAYERED PASSAGE (the app's existing "Layers of meaning" format, config/layers.json) is one JSON object:
{
 "id": "amos-8-2" (lowercase slug from the ref),
 "section": one of "law-history" (Genesis-Esther), "prophets-poetry" (Job-Malachi), "jesus" (Matthew-John), "letters-revelation" (Acts-Revelation),
 "ref": "Amos 8:2" (the passage: one verse or a short range),
 "saying": a short phrase copied EXACTLY from the BSB text of ref (check with the quote tool),
 "source": "Drafted with AI help (Claude) from the BSB, STEPBible TAHOT, TAGNT, TBESH and TBESG, and OpenBible.info cross-references.",
 "reviewed_by": [],
 "layers": [ ...2 to 4 layers... ]
}
Each layer: {"kind", "strength", "refs", "words" (optional), "evidence" (optional), "text"}.
- kind: the first layer is "plain meaning" (what it says in its own setting); the others are "wordplay" or "name meaning" (you may add one "pattern", "allusion" or "irony" if it is strong).
- strength: exactly one of "widely agreed", "commonly held", "some interpreters". A "widely agreed" layer other than plain meaning needs words, a ref outside the passage, or an evidence note. Every passage needs at least one layer besides plain meaning that is not "some interpreters".
- refs: references the layer points to (include the passage itself if the layer is about it).
- words: [{"ref": "Amos 8:2", "strong": "H7019"}, ...] each naming a Strong's key (without its trailing letter, e.g. "H7200" matches "H7200G") that really occurs in that exact verse: check with the words tool. Include both halves of a pun.
- text: at most 260 characters, plain words a newcomer understands; give the transliteration of each Hebrew/Greek word in plain letters (qayits, qets) and say what it means. Example of the right tone: "In Hebrew the man is adam and the ground is adamah: the earthling is named after the earth he came from."
- evidence: at most 400 characters, shown at Deep as "Behind this note": what the claim rests on, sources only if certain.
`

const READ = `Read the questions you were given, look up every verse with the tool before writing, and write each card from the text itself.`

function writerPrompt(g) {
  if (g.kind === 'wordplay') {
    return `${CONTEXT}\n${LAYER_SPEC}\nTASK: Draft NEW layered passages for wordplay and name meanings that the app does not have yet. These passages ALREADY exist and must NOT be repeated (choose others): ${args.existing}.\n\nCandidates to consider (use the strongest 14 to 18; you may add others you are confident about): ${g.candidates.join('; ')}.\n\nPick wordplay that is real and well established in the Hebrew or Greek, that an ordinary reader can enjoy once it is pointed out, and that is checkable in the words tool (both halves of the pun appear in the verses you name). Prefer "widely agreed" ones; label weaker ones honestly. For each passage, run the words tool on every verse you cite and the quote tool on the saying and every 4+ word quote. Return them as passages, plus notes_for_reviewer per passage id.`
  }
  return `${CONTEXT}\n${CARD_SPEC}\nTASK: Write hard-verse cards ("People often ask about this verse") for these questions, one card each, in this order:\n${g.items.map((q, i) => `${i + 1}. id ${q.id}: ref ${q.ref}${q.also ? `; also ${q.also}` : ''}. Question idea: ${q.q}`).join('\n')}\n\n${READ} Search the web (WebSearch) for each card's read_more links. Return all cards.`
}

function checkPrompt(g, draft, lens) {
  const what = g.kind === 'wordplay' ? `${LAYER_SPEC}\nThese are draft layered passages about wordplay and name meanings.` : `${CARD_SPEC}\nThese are draft hard-verse cards.`
  const lensText = lens === 'accuracy'
    ? `YOUR LENS: ACCURACY. Try hard to find what is WRONG. For every entry: (1) look up every reference with the tool and confirm it says what the entry claims; (2) run the quote tool on every 4+ word quotation; (3) check every Hebrew/Greek/Aramaic claim (words, meanings, transliterations, Strong's keys with the words tool, sound-plays) and every manuscript or historical claim; (4) check the Aramaic/Greek rule; (5) flag any named scholar, work or citation you cannot be sure is real and accurate; (6) for read_more, re-run WebSearch to confirm each url appears in results and matches the topic (flag any you cannot confirm); (7) check strength labels are honest (not "widely" when scholars are split); (8) check field limits (question <= 60 chars, answer/text <= 300, label <= 40, evidence <= 400; layer text <= 260). When unsure whether a claim is right, flag it.`
    : `YOUR LENS: FAIRNESS, PLAINNESS AND THE DESIGN RULE. Try hard to find what would confuse, mislead or put off a reader. For every entry: (1) is the Simple text (question + answer, or the first non-plain layer) in plain words a newcomer understands, with no jargon? (2) does it lead with the honest answer, without preaching and without hiding what is hard? (3) where Christians genuinely differ (Catholic, Orthodox, Protestant; Calvinist and Arminian; complementarian and egalitarian; traditional and conditional views of hell, etc.), are the main positions there, each fairly and in its best light, with no side declared the Bible's view? (4) are the views real alternatives rather than straw men, and are the strength labels honest? (5) is the question phrased the way ordinary people ask it? (6) is anything repetitive, too long, condescending, or likely to shake faith unnecessarily through careless wording, or to sound defensive or dismissive of honest doubt? (7) any wording that presents a guess as fact? Suggest exact replacement wording for each problem.`
  return `${CONTEXT}\n${what}\n${lensText}\n\nDRAFT (JSON):\n${JSON.stringify(draft)}\n\nReturn every problem as an issue with the entry id, the field, what is wrong, and an exact suggested fix. Do not rewrite entries that are fine. Return issues: [] only if you are confident there are none.`
}

function fixPrompt(g, draft, issues) {
  const what = g.kind === 'wordplay' ? LAYER_SPEC : CARD_SPEC
  return `${CONTEXT}\n${what}\nTASK: Two independent checkers reviewed the draft below. Apply every issue that is valid, after verifying it yourself with the tools (look up the verse, run the quote tool, re-run WebSearch for any url you keep or add). If an issue is wrong, keep the original and say why in notes_for_reviewer. Drop any read_more url you cannot confirm in a WebSearch result. If an entry cannot be made accurate, drop it and say so in dropped. Finally re-run the quote tool on every 4+ word quotation in the final entries and the words tool on every words entry.\n\nDRAFT:\n${JSON.stringify(draft)}\n\nISSUES:\n${JSON.stringify(issues)}\n\nReturn the complete final entries (all of them, not only changed ones).`
}

const VIEW = { type: 'object', properties: { label: { type: 'string' }, strength: { type: 'string' }, text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } }, required: ['label', 'strength', 'text', 'refs'] }
const LINK = { type: 'object', properties: { site: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' } }, required: ['site', 'title', 'url'] }
const CARD = { type: 'object', properties: { id: { type: 'string' }, ref: { type: 'string' }, also: { type: 'array', items: { type: 'string' } }, question: { type: 'string' }, answer: { type: 'string' }, views: { type: 'array', items: VIEW }, helps: { type: 'array', items: { type: 'string' } }, read_more: { type: 'array', items: LINK }, evidence: { type: 'string' }, notes_for_reviewer: { type: 'string' } }, required: ['id', 'ref', 'also', 'question', 'answer', 'views', 'helps', 'read_more', 'evidence', 'notes_for_reviewer'] }
const WORD = { type: 'object', properties: { ref: { type: 'string' }, strong: { type: 'string' } }, required: ['ref', 'strong'] }
const LAYER = { type: 'object', properties: { kind: { type: 'string' }, strength: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } }, words: { type: 'array', items: WORD }, evidence: { type: 'string' }, text: { type: 'string' } }, required: ['kind', 'strength', 'refs', 'text'] }
const PASSAGE = { type: 'object', properties: { id: { type: 'string' }, section: { type: 'string' }, ref: { type: 'string' }, saying: { type: 'string' }, source: { type: 'string' }, reviewed_by: { type: 'array', items: { type: 'string' } }, layers: { type: 'array', items: LAYER }, notes_for_reviewer: { type: 'string' } }, required: ['id', 'section', 'ref', 'saying', 'source', 'reviewed_by', 'layers', 'notes_for_reviewer'] }
const CARDS_OUT = { type: 'object', properties: { cards: { type: 'array', items: CARD }, dropped: { type: 'array', items: { type: 'string' } } }, required: ['cards'] }
const PASSAGES_OUT = { type: 'object', properties: { passages: { type: 'array', items: PASSAGE }, dropped: { type: 'array', items: { type: 'string' } } }, required: ['passages'] }
const ISSUES = { type: 'object', properties: { issues: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, field: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' }, severity: { type: 'string', enum: ['must-fix', 'should-fix', 'minor'] } }, required: ['id', 'field', 'problem', 'fix', 'severity'] } } }, required: ['issues'] }

const results = await pipeline(
  args.groups,
  (g) => agent(writerPrompt(g), { label: `write:${g.name}`, phase: 'Write', schema: g.kind === 'wordplay' ? PASSAGES_OUT : CARDS_OUT }),
  async (draft, g) => {
    if (!draft) return null
    const checks = await parallel(['accuracy', 'fairness'].map((lens) => () =>
      agent(checkPrompt(g, draft, lens), { label: `check-${lens}:${g.name}`, phase: 'Check', schema: ISSUES })))
    const issues = checks.filter(Boolean).flatMap((c, i) => c.issues.map((x) => ({ ...x, lens: i === 0 ? 'accuracy' : 'fairness' })))
    log(`${g.name}: ${issues.length} issues found`)
    return { draft, issues }
  },
  async (r, g) => {
    if (!r) return null
    const fixed = await agent(fixPrompt(g, r.draft, r.issues), { label: `fix:${g.name}`, phase: 'Fix', schema: g.kind === 'wordplay' ? PASSAGES_OUT : CARDS_OUT })
    return { group: g.name, kind: g.kind || 'cards', issues: r.issues, final: fixed || r.draft, fixed: !!fixed }
  },
)
return results
