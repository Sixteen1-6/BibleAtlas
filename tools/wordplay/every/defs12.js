export const meta = {
  name: 'define-twelve-patterns',
  description: 'Find a definition, word for word with its page and link, from a quotable writer on the cite list for each of the 12 patterns Bullinger does not name; a skeptic re-reads each one',
  phases: [
    { title: 'Find', detail: 'one finder per pattern' },
    { title: 'Check', detail: 'a skeptic re-reads the words on their page and judges whether they define the pattern' },
  ],
}

const SP = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad'
const W = `${SP}/wp`
const LW = `${SP}/lw`
const E = '/mnt/project-files/bible-atlas/figures/every'
const TODAY = args.today

const DEF = {
  type: 'object',
  properties: {
    source: { type: 'string', description: 'a quotable cite-list id whose writer does not change by book: horne, lowth, jebb, boys, forbes, easton, clarke, calvin, bengel, maclaren, edersheim, augustine' },
    work: { type: 'string', description: 'for a source the cite list credits by its works, the work id (horne-introduction, lowth-lectures, lowth-isaiah, jebb-sacred-literature, boys-tactica, boys-key-psalms, forbes-symmetrical, forbes-romans, edersheim-life, augustine-city-of-god, augustine-psalms)' },
    quote: { type: 'string', description: 'the words that define the pattern, word for word as the page has them, 20 to 400 characters; parts joined with "..." in order inside one passage' },
    at: { type: 'string', description: 'where in the work: "vol. 2, part 2, chapter 3, p. 412", "Lecture XXII, p. 314", "the entry Hymn", or for a commentary "on Ezekiel 4:1"' },
    url: { type: 'string', description: 'the exact page the words are on: an archive.org page link https://archive.org/details/<item>/page/<n>/mode/1up, a CCEL or Bible Hub page; never a whole work or site' },
    read: { type: 'string', description: 'the edition or copy the words were read in, e.g. "the archive.org scan introductionto02horn (London, 1828), page text as fetched", "sacred-texts.com\'s transcription, in the copy at github.com/jonnyg23/mahabrain (commit b00aa50)", "Let\'s Church\'s copy, at github.com/LetsChurch/lets.church (commit 71f6f0f)", "CCEL\'s text, at <page>"' },
    retrieved: { type: 'string' },
  },
  required: ['source', 'quote', 'at', 'url', 'read', 'retrieved'],
}
const FOUND = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    found: { type: 'boolean' },
    defined: DEF,
    found_in: { type: 'string', description: 'how you found and read the words: the tool command, or the exact page fetched and what it returned for the page number' },
    context: { type: 'string', description: 'about 40 words around the quote, as the copy or page has them' },
    why: { type: 'string', description: 'why these words define the pattern (not only one instance of it), and that the writer upholds Scripture in them' },
    alternatives: { type: 'array', items: { type: 'string' }, description: 'other candidate definitions you saw, each with source, place and the first words, in case this one fails' },
  },
  required: ['id', 'found', 'why'],
}
const VERDICT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    verdict: { type: 'string', enum: ['confirm', 'amend', 'refute'] },
    defined: DEF,
    found_in: { type: 'string' },
    context: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['id', 'verdict', 'reason'],
}

const ABOUT = `Bible Atlas is a Bible study app. Its Deep level shows figures of speech and story patterns, each under a form with a plain label and, where it can be given, the form defined in the words of a writer who defines it. The owner asked that only Bible-believing writers and theologians who love God be cited, never writers who liberalize the Bible; Christian writers only. Bullinger's Figures of Speech defines most forms, but twelve patterns are not his, and each needs a definition quoted word for word from a writer on the app's cite list, with the exact page and link, before its form can go in.`

const RULES = `What the definition must be:
1. The writer's own words that say what the pattern is, in general, so a reader learns how to recognise it: not only a remark on one instance. A sentence on one verse counts when it states the pattern in general terms ("the prophets often taught by symbolic actions, which ..."). 20 to 400 characters.
2. From a quotable source on the cite list (${LW}/config/figure-forms.json "quotable"; ${LW}/config/layer-sources.json says who wrote each). A definition carries no verse, so the source's writer must not change by book: use a source credited by its works (horne, lowth, jebb, boys, forbes, edersheim, augustine) or one man's commentary on the whole Bible or Testament (clarke, calvin, bengel, maclaren) or Easton's Bible Dictionary (easton). Never Barnes, Keil and Delitzsch, Jamieson-Fausset-Brown, Henry, Ellicott, Poole, Benson or the Pulpit here (their writer changes by book), and never Bullinger (these are not his figures), Gill, Wesley, the Geneva notes, Spurgeon, the Companion Bible or any modern work.
3. The words must uphold Scripture: never a passage that treats an account as myth or fiction, or the text as in error. Never a definition the writer gives only to reject it, or one he credits to a rabbi or a Jewish writer.
4. Word for word as the copy or page has it. The url is the exact page the words are on (for an archive.org scan, the page link with the scan's page number for that leaf, found by the archive.org full-text search, never guessed); read names the edition or copy; retrieved "${TODAY}".

Tools (python3 -I; do not download, clone or install anything; write files only in ${W}/every/defs/work/<id>/):
- ${W}/every/defsearch.py "<regex>" [barnes clarke jfb kad mhc calvin] [--max N]: matching sentences in the local commentaries, with the verse heading (leads; Clarke and Calvin may be quoted, the others give leads to a quotable writer).
- ${W}/cq.py <clarke|calvin> "<ref>" prints that remark in full from the pinned copy; quote only from that print.
- ${W}/tc/resolve.py <source>@"<ref>" prints who wrote a source's words on a book; run it on two books far apart to show the writer does not change.
- WebFetch (never curl), sparingly: every agent in this project shares 400 web fetches an hour; at most 6 for your pattern. Archive.org full-text search inside a scan: https://ia800300.us.archive.org/fulltext/inside.php?item_id=<item>&doc=<item>&path=/<path>&q=%22<a few words, spaces as %20>%22 (if you do not know the path, fetch https://archive.org/metadata/<item> and ask for the "dir" and "server" fields first), which returns the scan's page numbers for each match; the page link is https://archive.org/details/<item>/page/n<leaf>/mode/1up for a leaf number, or /page/<printed page>/ when the search gives printed pages. Then fetch that page's text (https://archive.org/stream/<item>/<item>_djvu.txt is the whole OCR text and is cut off, so prefer the search's own snippet and the page view) to copy the words. Scans on the cite list: horne-introduction (introductionto02horn, vol. 2: interpretation of figurative language, parables, types, symbolical actions, Hebrew poetry and parallelism), lowth-lectures (bim_eighteenth-century_lectures-on-the-sacred-p_lowth-robert_1787_1, Lectures on the Sacred Poetry of the Hebrews: parallelism, the elegy, the ode, the parabolic style), lowth-isaiah, jebb (sacredliterature00jebb), boys (10353478bsb), forbes (symmetricalstruc00forbiala). Easton's Bible Dictionary: ccel.org/ccel/easton/ebd2.html and its entry pages. Clarke and Calvin: the local copies first.`

const ITEMS = args.items

const res = await pipeline(
  ITEMS,
  (it) => agent(`${ABOUT}

Your pattern: ${JSON.stringify(it)}
Its write-up from the catalogue (what the pattern is and its examples): ${E}/notes/${it.figure}.md, and its entry in ${E}/figures.json.

${RULES}

Find the best definition: the clearest general statement of the pattern by a quotable writer whose writer does not change by book, read word for word in a pinned copy or on its page. Try the local Clarke and Calvin first (defsearch.py with a few phrasings: for an acted sign "symbolic(al)? action", "sign", "by action"; for a lament "lamentation", "elegy", "funeral"; and so on), then Horne's Introduction, Lowth's Lectures, Jebb or Easton on the web. Save what you found to ${W}/every/defs/work/${it.id}/found.json. If nothing meets every rule, return found false with what you tried and the best near-misses in alternatives; never stretch a remark into a definition.`, { label: `find:${it.id}`, phase: 'Find', schema: FOUND }),
  (f, it) => {
    if (!f || !f.found) return { it, f, v: null }
    return agent(`${ABOUT}

You are the skeptic for one definition, before it is shown in the app. The pattern: ${JSON.stringify(it)} (write-up: ${E}/notes/${it.figure}.md).
The finder's result:
${JSON.stringify(f, null, 1)}

${RULES}

Check hard:
a. Re-read the words in the copy or on the page the url names (local copies with cq.py; a web page fetched again, at most 3 fetches). Are they word for word? Is the url the exact page they are on? Correct what is wrong.
b. Do the words define this pattern in general, so a reader could recognise it, or only describe one instance, or a different pattern? Do they say what the pattern is the way the catalogue's write-up means it?
c. Is the source quotable, is its writer the same on every book (or is it credited by its works), and do the words uphold Scripture (rule 3)?
d. Is "at" a true place in the work, and does "read" name the copy or scan?
Return confirm (all holds), amend (with the corrected definition, re-read by you), or refute (with the reason). When unsure, refute.`, { label: `check:${it.id}`, phase: 'Check', schema: VERDICT }).then((v) => ({ it, f, v }))
  },
)

return res.filter(Boolean).map((r) => ({ id: r.it.id, found: r.f, verdict: r.v }))
