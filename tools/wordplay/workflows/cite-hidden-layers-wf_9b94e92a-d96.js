export const meta = {
  name: 'cite-hidden-layers',
  description: 'Look for a Bible-believing commentary that makes each of the six uncited Layers plays, then verify every quote',
  phases: [
    { title: 'Find', detail: 'one agent per hidden note' },
    { title: 'Verify', detail: 'one skeptic re-reads every quote' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'

const NOTES = [
  { id: 'joshua-2-18', idx: 1, verses: ['Joshua 2:18', 'Joshua 2:21', 'Hosea 2:15', 'Joshua 2:15'], claim: 'The scarlet cord is tiqvah, a word that elsewhere means "hope"; the cord in the window is a sign of hope (the note also mentions Clement of Rome, 1 Clement 12, seeing in it redemption for all who believe and hope in God).' },
  { id: '1-samuel-25-25', idx: 2, verses: ['1 Samuel 25:18', '1 Samuel 25:25', '1 Samuel 25:37'], claim: 'A play between nevel (a skin or jar of wine, 25:18) and Nabal; when "the wine had gone out of Nabal" (25:37) the fool ends as an emptied wineskin.' },
  { id: 'job-19-25', idx: 1, verses: ['Job 1:9', 'Job 2:3'], claim: 'The accuser asks whether Job fears God "for nothing" (chinnam, 1:9); God says the accuser incited Him to ruin Job "without cause" (the same word chinnam, 2:3). The same word answers the accuser: Job suffers for nothing yet fears God for nothing.' },
  { id: 'psalm-41-9', idx: 2, verses: ['John 13:18', 'John 6:54', 'John 6:58', 'Psalms 41:9'], claim: 'In John 13:18 John uses trogo ("eats/shares My bread") rather than the Septuagint\'s esthio, the same verb he uses in John 6:54-58 for eating Christ\'s flesh; the betrayer ate with the bread from heaven.' },
  { id: 'isaiah-5-7', idx: 2, verses: ['Isaiah 5:7', 'Exodus 3:7', 'Genesis 18:21', 'Isaiah 1:10'], claim: 'The "cry" (tse\'aqah) of Isaiah 5:7 recalls the cry of the slaves in Egypt (Exodus 3:7) and the outcry against Sodom (Genesis 18:20-21); God\'s people now cause the cry He once rescued them from.' },
  { id: 'philemon-1-11', idx: 3, verses: ['Philemon 1:11', 'Philemon 1:10', 'Philemon 1:20'], claim: 'A play on chrestos ("useful") and Christos (Christ), which sounded alike: useless (a-chrestos) Onesimus has become useful (eu-chrestos) through Christ.' },
]

const CITE = {
  type: 'object',
  properties: {
    source: { type: 'string', description: 'id from the cite list in config/layer-sources.json, or bullinger-cb / bullinger-fos' },
    on: { type: 'string', description: 'the verse the comment is on, e.g. "Job 1:9"' },
    at: { type: 'string', description: 'only for sources without a Bible Hub code: where in the work, e.g. "Clement of Rome, 1 Clement 12"' },
    url: { type: 'string', description: 'the exact https page the quote was read on (Bible Hub chapter page, New Advent page) or, for local works, the url cq.py url gives' },
    quote: { type: 'string', description: 'verbatim, 20 to 400 characters, parts joined with "..." in order' },
    states_play: { type: 'string', description: 'one sentence: how this quote states the same play or allusion' },
  },
  required: ['source', 'on', 'url', 'quote', 'states_play'],
}
const FOUND = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    cites: { type: 'array', items: CITE },
    searched: { type: 'array', items: { type: 'string' }, description: 'works and verses read' },
    note: { type: 'string', description: 'if nothing found, say so plainly; if a source makes only part of the claim, say which part' },
  },
  required: ['id', 'cites', 'searched', 'note'],
}
const VERD = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          on: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'quote-fixed', 'rejected'] },
          quote: { type: 'string', description: 'the verbatim quote as confirmed or corrected' },
          reason: { type: 'string' },
        },
        required: ['id', 'source', 'on', 'verdict', 'reason'],
      },
    },
  },
  required: ['results'],
}

const RULE = `The owner's rule: cite only Bible-believing writers and theologians who love God, never those who liberalize the Bible; Christian writers only (no rabbis or Jewish scholars as authorities). Bible Atlas shows a note live only when it cites a work on the cite list in ${LW}/config/layer-sources.json (read it: each entry has an id, a role and either a Bible Hub commentary code "biblehub" or a "url"; mind any "not_on" books). Two more works are being added: bullinger-cb (E. W. Bullinger's Companion Bible notes) and bullinger-fos (Bullinger, Figures of Speech Used in the Bible, 1898). Never cite a work on that file's "avoid" list.`

const TOOLS = `Tools:
- python3 -I ${W}/cq.py all "<ref>" prints local copies of Gill, Clarke, Barnes, JFB, Keil and Delitzsch, Henry's Concise, Wesley, the Companion Bible (cb) and Figures of Speech (fos) on a verse; "cq.py <work> <ref>" prints one in full; "cq.py check <work> <ref> <quote>" confirms a quote verbatim. Work ids there map to cite ids: kad=keil-delitzsch, mhcc=henry-concise, cb=bullinger-cb, fos=bullinger-fos.
- python3 -I ${W}/vw.py "<ref>" prints the BSB verse with its Hebrew/Greek words and Strong's keys.
- WebFetch for Bible Hub commentary chapter pages: https://biblehub.com/commentaries/<code>/<book>/<chapter>.htm, where <code> is the work's biblehub code from layer-sources.json and <book> is lowercase with underscores (1_samuel, psalms, philemon). Also New Advent for church fathers (https://www.newadvent.org/fathers/). Quote only text you actually read on the page.`

const found = await pipeline(
  NOTES,
  (n) => agent(`You are finding citations for one hidden note in Bible Atlas, a Bible study app. The note stays hidden until it cites a Bible-believing commentary that states the same play on words or allusion.

The note (${n.id}, layer ${n.idx}): ${n.claim}
Verses: ${n.verses.join(', ')}.
Print the note itself: python3 -I -c "import json; p=[p for p in json.load(open('${LW}/config/layers.json'))['passages'] if p['id']=='${n.id}'][0]; print(json.dumps(p['layers'][${n.idx}], ensure_ascii=False, indent=1))"

${RULE}

${TOOLS}

Search the local works on every listed verse first, then Bible Hub pages for the listed interpreters (Ellicott, Pulpit, Benson, Poole, Calvin, Geneva, Bengel, Henry's full commentary, Gill, Barnes, JFB, Keil and Delitzsch, Clarke, Wesley, Spurgeon's Treasury for Psalms, Maclaren, Chrysostom) on those verses, and a church father where the note names one. A cite counts only if the writer, in his own words, states the same play or allusion (not merely mentions the word, and not merely a different typology). If a writer states only part of it, say which part in note and still give the cite. Return at most 3 cites, best first, each with a verbatim quote and the exact url you read it on. If none states it, return no cites and say so; do not stretch.`,
    { label: `find:${n.id}`, phase: 'Find', schema: FOUND }),
)

const withCites = found.filter((f) => f && f.cites.length)
log(`${withCites.length} of ${NOTES.length} notes have candidate cites`)
let verified = { results: [] }
if (withCites.length) {
  verified = await agent(`You are a skeptic checking citations before they make hidden notes live in Bible Atlas, a Bible study app. ${RULE}

${TOOLS}

For each cite below: re-read the source (cq.py check for local works; WebFetch the url for Bible Hub or New Advent) and confirm the quote is verbatim on that page and in that writer's comment on that verse. Then judge whether the quote, in context, really states the same play or allusion the note makes (print the note with: python3 -I -c "import json; p=[p for p in json.load(open('${LW}/config/layers.json'))['passages'] if p['id']=='<id>'][0]; print(json.dumps(p['layers'], ensure_ascii=False, indent=1))"). Also confirm the source id is on the cite list (or is bullinger-cb / bullinger-fos) and not barred for that book. Verdict confirmed, quote-fixed (give the exact corrected quote) or rejected, with a one-line reason. When unsure, reject.

Notes and their candidate cites:
${JSON.stringify(withCites.map((f) => ({ id: f.id, layer: NOTES.find((n) => n.id === f.id).idx, cites: f.cites, finder_note: f.note })), null, 1)}`,
    { label: 'verify:all', phase: 'Verify', schema: VERD })
}
return { found, verified }
