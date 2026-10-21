export const meta = {
  name: 'verify-writers-and-pointers',
  description: 'Check links, shelf facts, verse placement, code and UX for the Christian writers and hard-verse pointers change',
  phases: [
    { title: 'Check', detail: 'links, Sefaria numbering, shelf facts, verse placement, code review, screen review' },
    { title: 'Verify', detail: 'a skeptic tries to refute each code and screen finding' },
  ],
}

const R = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/review'
const REPO = '/home/claude/bibleatlas'
const COMMON = `
Context: Bible Atlas, a Bible study web app (Rust data build in ${REPO}/crates, Preact/TypeScript site in ${REPO}/web). A change (uncommitted, full diff at ${R}/diff.patch) adds:
(a) a Deep-level "Christian writers" extra: public-domain notes by the Church Fathers (Aquinas's Catena Aurea, Gospels only), Matthew Henry's Concise Commentary and John Wesley's Notes, shown only after the reader taps "Show what they wrote" (remembered per device), plus "Read more on other websites" links per verse (BibleRef, GotQuestions, Historical Christian Faith, Bible Hub, NET Bible notes on classic.net.bible.org, and Sefaria for the Old Testament using Hebrew Bible verse numbers);
(b) "pointers" for the 56 "Often asked" hard-verse questions whose Claude-written answers are NOT yet approved by the owner: at Deep only, the verse shows a line "A hard passage: answers on <sites>" and the panel shows only the Bible passages side by side plus links (each site's own article title) — none of the unapproved answer text may appear;
(c) Sources-shelf cards (config/shelf.json) for the new works and websites.
Rules the change must keep: never store or show ESV text, and the word "ESV" must not appear in new outputs; only public domain / CC0 / CC BY 4.0 / CC BY-SA 4.0 data is stored; copyrighted websites are linked and cited only, never copied; anything Claude wrote stays off the live site until the owner approves it; the design rule is "simple for anyone who walks in, depth one tap away, never overwhelming" (levels Simple / Study / Deep).
Do NOT edit any file under ${REPO} and do not commit or push. Scratch files only under ${R}. Never run npx with a package the repo does not already depend on. WebFetch is shared and limited (about 400 fetches per hour across all agents): fetch only what your task lists, and say plainly which checks you could not do.`

const LINKS = {
  type: 'object',
  properties: {
    results: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['url', 'ok', 'note'] } },
    changes: { type: 'array', items: { type: 'string' }, description: 'Concrete changes to web/src/ui/extras/voices/links.ts or config/shelf.json, each with its evidence' },
    not_checked: { type: 'array', items: { type: 'string' } },
  },
  required: ['results', 'changes', 'not_checked'],
}
const FACTS = {
  type: 'object',
  properties: {
    cards: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, field: { type: 'string' }, current: { type: 'string' }, correct: { type: 'boolean' },
      suggested: { type: 'string', description: 'Replacement text if not correct, keeping the card style (plain words, no hype); empty if correct' },
      evidence: { type: 'string', description: 'Quoted sentence and its URL' } },
      required: ['id', 'field', 'current', 'correct', 'suggested', 'evidence'] } },
  },
  required: ['cards'],
}
const PLACEMENT = {
  type: 'object',
  properties: {
    checked: { type: 'integer' },
    problems: { type: 'array', items: { type: 'object', properties: { verse: { type: 'string' }, work: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' } }, required: ['verse', 'work', 'issue', 'evidence'] } },
    summary: { type: 'string' },
  },
  required: ['checked', 'problems', 'summary'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      file: { type: 'string' }, line: { type: 'integer' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      summary: { type: 'string' }, failure_scenario: { type: 'string' }, fix: { type: 'string' } },
      required: ['file', 'line', 'severity', 'summary', 'failure_scenario', 'fix'] } },
    notes: { type: 'string' },
  },
  required: ['findings', 'notes'],
}
const VERDICTS = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, real: { type: 'boolean' }, reason: { type: 'string' } }, required: ['index', 'real', 'reason'] } } },
  required: ['verdicts'],
}

const tasks = [
  { key: 'links', schema: LINKS, prompt: `${COMMON}

Your task: test link patterns in ${REPO}/web/src/ui/extras/voices/links.ts that were never opened. Use WebFetch, one fetch per URL, and judge whether each page shows the intended verse or content.
1. Historical Christian Faith, 15 untested book slugs. Fetch https://historicalchristian.faith/<slug>/1/3 for each of: 2corinthians, galatians, ephesians, philippians, colossians, 1thessalonians, 1timothy, titus, philemon, hebrews, 1peter, 2peter, 1john, 2john, jude. A wrong slug silently shows a Matthew verse, so confirm the page names the right book and verse 1:3.
2. BibleRef Obadiah: links.ts treats all of Obadiah as covered. Fetch https://www.bibleref.com/Obadiah/1/Obadiah-1-5.html and https://www.bibleref.com/Obadiah/1/Obadiah-1-21.html; a "coming soon" page means not covered.
3. BibleRef Song of Songs folder: fetch https://www.bibleref.com/Song-of-Solomon/1/Song-of-Solomon-1-2.html (links.ts shows no BibleRef link for Song of Songs; just report whether that page has real commentary).
4. GotQuestions book pages, built as https://www.gotquestions.org/questions-about-<Name>.html with names from the NAMES table in links.ts. Fetch these: Song-Solomon, 1-Samuel, Psalms, Philemon, 3-John, Jude, Obadiah, Lamentations, Ecclesiastes, 2-Chronicles, 1-Thessalonians, Revelation. If one fails, find the right address (search or the site's own Bible-book index) and give it.
5. GotQuestions terms of use: find its terms or copyright/permissions page and report anything it says about linking to its pages.
Report every URL tried in results, and in changes list exact table edits needed (or none).` },
  { key: 'sefaria', schema: LINKS, prompt: `${COMMON}

Your task: confirm that the app's Sefaria links land on the right verse. Sefaria numbers the Old Testament the Hebrew way (English Joel 2:28 is Sefaria Joel 3:1). The app converts with ${REPO}/web/public/data/extras/voices/hebrew.json (runs listed readably in ${R}/hebrew-runs.txt) built in ${REPO}/crates/atlas-cli/src/extra_voices.rs (fn hebrew_runs and SEFARIA_NUMBERS).
Read ${R}/sefaria-cases.txt: 36 English verses, the Sefaria ref the app builds, and the English (BSB) text. Check them in batches of up to 10 with Sefaria's bulk text API, e.g. https://www.sefaria.org/api/bulktext/Exodus.20.13|Exodus.20.14 (refs joined by |; it returns each ref's English and Hebrew text). For each case decide whether Sefaria's English text at that ref is the same verse as the BSB text (wording differs between translations; judge by content). Pay special attention to Exodus 20:15 and 20:17, Deuteronomy 5:21, Nehemiah 7:68 and 7:70, 1 Kings 18:33-34, Numbers 26:1 and the Psalms.
Then confirm the "?with=Commentary" URL parameter is Sefaria's own way to open the commentary panel, for example from Sefaria's open-source code on GitHub (github.com/Sefaria/Sefaria-Project) — one or two fetches at most.
In results give one row per case (url = the app's Sefaria URL). In changes give exact fixes (for example rows to add to SEFARIA_NUMBERS) with evidence.` },
  { key: 'facts', schema: FACTS, prompt: `${COMMON}

Your task: check the facts on these Sources-shelf cards in ${REPO}/config/shelf.json against the works themselves, their publishers, Wikipedia, library catalogs or the sites' own About pages: catena-aurea, henry-concise, wesley-notes, bibleref, historical-christian-faith, biblehub, sefaria. Check every factual claim in the fields plain, by, when, what, licenseNote and citation: names, dates (e.g. Henry's commentary dates and his death in 1714 with others finishing it; Wesley's NT notes 1755 and OT notes 1765-66; the Catena Aurea written 1260s, its Oxford translation 1841-45 edited by John Henry Newman, published by J. G. F. and J. Rivington, 4 volumes; BibleRef launched 2017 by Got Questions Ministries and how much of the Old Testament it covers; Historical Christian Faith by Sean Kooyman since 2022, and whether some of its translations are made with AI; Bible Hub run by the Online Parallel Bible Project since 2004; Sefaria founded 2011 by Brett Lockspeiser and Joshua Foer, a nonprofit). Keep fetches to what you need (about 25 at most). Return one row per claim you checked, with a quoted sentence and URL as evidence; where a claim is wrong or unsupported, give a corrected text in the card's plain style (the 'what' field must stay at most 240 characters, 'plain' at most 48).` },
  { key: 'placement', schema: PLACEMENT, prompt: `${COMMON}

Your task (local files only, no web): check that the writers' notes sit on the right verses. The build (${REPO}/crates/atlas-cli/src/extra_voices.rs, read its module comment first) reads the raw sources:
- Catena: ${REPO}/data/raw/catena@efe1bd084d/data/catena/<matthew|mark|luke|john>.jsonl
- Matthew Henry: ${REPO}/data/raw/lets.church@71f6f0fc8f/packages/lets.bible/seed/commentaries/mhcc.json
- Wesley: ${REPO}/data/raw/lets.church@71f6f0fc8f/packages/lets.bible/seed/commentaries/wesley.json
and writes ${REPO}/web/public/data/extras/voices.json (index) and extras/voices/<Book>.<k>.json (items [work, from verse index, to verse index, voices]). Verse indexes count every verse of the Bible from 0 (Genesis 1:1) in the order of ${REPO}/web/public/data/bsb.txt (one verse per line); map indexes to references with ${REPO}/data/raw/bible_databases@e1b254cef8/formats/json/BSB.json (books > chapters > verses in the same order). Use Python with -I for scripts and keep scripts in ${R}.
For each of the 45 verses in ${R}/placement-samples.txt, plus Matthew 5:3, John 3:16, Psalm 23:1, Isaiah 53:5, Genesis 1:1, Romans 8:28, Mark 16:9, Luke 22:43 and any Gospel verse at a Catena passage boundary you choose: find what the built files show for that verse (each work), and find in the raw sources which notes should cover it. Report every mismatch: a note missing, a note on the wrong verse or range, a note cut off or merged with another, reference links pointing to the wrong verse, or text that is not the writer's (headings, markup, introductions). Also read the note text of a few items for leftover markup. Be concrete: verse, work, what the build shows vs what the source says.` },
  { key: 'code', schema: FINDINGS, prompt: `${COMMON}

Your task: adversarially review the diff ${R}/diff.patch (read the full new files too: crates/atlas-cli/src/extra_voices.rs, web/src/ui/extras/voices/*.ts(x), web/src/ui/extras/hard-verses/*, crates/atlas-cli/src/extra_hard_verses.rs). Look for real bugs: wrong verse math, off-by-one in runs or chapter splits, panics (unwrap/indexing on data), JSON shape mismatches between the Rust writer and the TypeScript reader, React/Preact hook-order bugs (hooks called conditionally), stale state when the verse changes, localStorage failures, links built wrong for some books, a pointer that could leak unapproved answer text (question, answer, views, evidence, source fields), the Sources shelf now listing sites only pointers cite, accessibility problems (buttons without labels, focus), and anything that breaks the extras README contract (web/src/ui/extras/README.md). You may run: cd ${REPO} && cargo test --release -q -p atlas-cli ; cd ${REPO}/web && npx tsc --noEmit -p . — nothing else that changes files. Report only findings with a concrete failure scenario (inputs -> wrong result). Rank most severe first.` },
  { key: 'screens', schema: FINDINGS, prompt: `${COMMON}

Your task: look at the change on screen like a first-time reader and like a deep student. Build and serve the site locally:
  cd ${REPO}/web && npx vite build --base=/BibleAtlas/ --outDir ${R}/dist  (vite is the repo's own dependency)
  mkdir -p ${R}/srv && ln -sfn ${R}/dist ${R}/srv/BibleAtlas && cd ${R}/srv && python3 -m http.server 4420 --bind 127.0.0.1  (run it in the background)
Use Playwright from /opt/node22/lib/node_modules/playwright (Chromium is preinstalled; do not run playwright install). Before loading, set localStorage: atlas.depth = "deep" and atlas.welcome = "hidden" (and try once with atlas.depth = "simple"). Pages: http://127.0.0.1:4420/BibleAtlas/#v=John.1.1&x=voices (writers, before and after tapping "Show what they wrote"), #v=Acts.1.18&x=hard-verses and #v=Gen.2.19&x=hard-verses (hard-passage pointers), #v=Joel.2.28&x=voices (Sefaria link should go to Joel.3.1), #v=Ps.23.1&x=voices. Take screenshots at 1280x900 and 390x844 into ${R}/shots, collect console errors, and read the screenshots. Judge against the design rule (simple first, depth one tap away, never overwhelming), plain wording, and the rule that unapproved answers never show (no question or answer text in pointer panels). Also confirm that at Simple level neither the writers' line nor the pointer line appears. Report concrete problems (file and line of the UI code where it comes from), most severe first; put the screenshot paths in notes. Stop the server when done.` },
]

phase('Check')
const results = await pipeline(
  tasks,
  t => agent(t.prompt, { label: `check:${t.key}`, phase: 'Check', schema: t.schema }),
  (res, t) => {
    if (!res || !(t.key === 'code' || t.key === 'screens') || res.findings.length === 0) return { key: t.key, res }
    const list = res.findings.map((f, i) => `${i}. [${f.severity}] ${f.file}:${f.line} ${f.summary}\n   Scenario: ${f.failure_scenario}\n   Fix: ${f.fix}`).join('\n')
    return agent(`${COMMON}

A reviewer reported the findings below about this change. For each one, try hard to REFUTE it: read the code it names (and the built data or screenshots under ${R} if it relies on them), trace the scenario, and decide whether it really happens and matters. Default to real=false when the scenario does not hold up. Return one verdict per index.

${list}`, { label: `verify:${t.key}`, phase: 'Verify', schema: VERDICTS }).then(v => ({ key: t.key, res, verdicts: v ? v.verdicts : null }))
  },
)
return results
