export const meta = {
  name: 'forms-defined',
  description: "Give each proposed figure form Bullinger's own definition, word for word, with its printed page in the 1898 scan, then a second reader checks each",
  phases: [
    { title: 'Define', detail: 'find the definition in the local text and its printed page' },
    { title: 'Check', detail: 'a second reader checks the words and the page' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const TODAY = (args && args.today) || '2026-11-01'
const ITEMS = args.items

const DEF = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    heading: { type: 'string', description: "Bullinger's heading as printed, e.g. 'Epizeuxis; or, Duplication'" },
    defined: {
      type: 'object',
      properties: {
        source: { type: 'string' }, quote: { type: 'string' }, at: { type: 'string' }, url: { type: 'string' },
        read: { type: 'string' }, retrieved: { type: 'string' },
      },
      required: ['source', 'quote', 'at', 'url', 'read', 'retrieved'],
    },
    page_evidence: { type: 'string', description: 'how you know the printed page: the search-inside hit (leaf index and the printed number read on the page) and the url you fetched' },
    examples: { type: 'array', items: { type: 'string' }, description: 'up to 6 verse references Bullinger lists under this heading, as written in the local text' },
    ok: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'heading', 'defined', 'page_evidence', 'examples', 'ok', 'problems'],
}

const RULES = `Bullinger's Figures of Speech Used in the Bible (1898) is in the local file ${W}/fos.txt (the UniqueBible.app module of the 1898 text, from github.com/darrelwright/UniqueBible_Books at commit 4017a67). Read it with sed -n '<from>,<to>p' around the heading line given; never read the whole file.

The definition must be one sentence or phrase in Bullinger's own words, copied exactly from fos.txt (keep his spelling and punctuation; drop any "[Note: ...]" insertions and do not join sentences), at most 400 characters, and it must say what the figure is (not its Greek etymology alone). Check it with grep -F -c on fos.txt: the count must be at least 1.

Find the printed page of the heading in the archive.org scan figuresofspeechu00bull. Load WebFetch with ToolSearch ("select:WebFetch"). Use the search-inside service, for example
https://ia600409.us.archive.org/fulltext/inside.php?item_id=figuresofspeechu00bull&doc=figuresofspeechu00bull&path=/13/items/figuresofspeechu00bull&q=%22Duplication%22
(quote a distinctive phrase of the definition or heading). Each hit gives a page index ("page": n or a "par" with a page number). In this scan the printed page has been the leaf index minus 54 elsewhere in the book, but confirm it for this page: read the printed number from the hit's text or the OCR of that leaf, and if it differs say so. Two fetches at most per form.

Write the definition exactly as the repository's existing forms do:
{"source": "bullinger-fos", "quote": "<words>", "at": "<heading as printed>, p. <printed page>", "url": "https://archive.org/details/figuresofspeechu00bull/page/<printed page>/mode/1up", "read": "the UniqueBible.app module of the 1898 text, at github.com/darrelwright/UniqueBible_Books (commit 4017a67)", "retrieved": "${TODAY}"}
"at" is at most 120 characters. Plain English in anything you write yourself; no em dashes.`

phase('Define')
const out = await pipeline(
  ITEMS,
  it => agent(`${RULES}\n\nForm: ${JSON.stringify(it)}\nThe heading is at or near line ${it.line} of fos.txt. ${it.note || ''}\nReturn the definition. Set ok false if you could not confirm the words or the page.`,
    { label: `define:${it.id}`, phase: 'Define', schema: DEF }),
  (d, it) => d ? agent(`${RULES}\n\nYou are the second reader. Check this definition for the form ${it.id}: run grep -F -c on the quote yourself; read the lines around it to be sure it is Bullinger's definition of this figure and not of a neighbouring one; check the printed page with one search-inside fetch of your own (a different phrase from the same page if you can). Correct anything wrong and return the checked definition; set ok false if the page or words cannot be confirmed.\n\nProposed:\n${JSON.stringify(d, null, 1)}`,
    { label: `check:${it.id}`, phase: 'Check', schema: DEF }) : null,
)
return { today: TODAY, forms: out.map((x, i) => ({ item: ITEMS[i], checked: x })) }
