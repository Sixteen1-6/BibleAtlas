export const meta = {
  name: 'new-cite-writers',
  description: 'Check each Bible-believing writer the founder named for the cite list: works, dates, scans, his words on Scripture, how to link a verse, then a second reader re-checks every claim',
  phases: [
    { title: 'Research', detail: 'one agent per writer finds works, dates, scans and his words on Scripture' },
    { title: 'Check', detail: 'a second reader re-opens every page and checks every claim word for word' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/nw'
const TODAY = (args && args.today) || '2026-11-01'

const WRITERS = [
  { id: 'spurgeon-treasury', who: 'C. H. Spurgeon, The Treasury of David (7 volumes, 1869 to 1885)',
    task: 'The cite list already has source "spurgeon" (Bible Hub code "tod") but its only part covers Psalms 104 to 118 (vol. V, 1878), so a cite on any other psalm is refused. Find all seven volumes on archive.org (ids like treasuryofdavid0001chsp to treasuryofdavid0007chsp; read https://archive.org/metadata/<id> and the title page leaf), and for each volume record the psalms it covers and its date as printed or as the library record gives it, with the url read. Then open two Bible Hub tod pages (https://biblehub.com/commentaries/tod/psalms/23.htm and /psalms/45.htm) and say exactly how the page separates Spurgeon\'s own words (EXPOSITION, and HINTS TO PREACHERS when unsigned) from the gathered "EXPLANATORY NOTES AND QUAINT SAYINGS" by other writers, each signed: a cite may quote only Spurgeon\'s own words. Propose the six missing parts (same shape as the existing vol. V part) and a rule line for the README.' },
  { id: 'spurgeon-sermons', who: 'C. H. Spurgeon, his sermons (New Park Street Pulpit and Metropolitan Tabernacle Pulpit, 1855 to 1917)',
    task: 'Find where his sermons can be read free, one sermon per page, with the sermon number, title, text and date printed on the page (try https://www.spurgeon.org/resource-library/sermons/ , https://www.ccel.org/ccel/spurgeon , https://www.spurgeongems.org/ , and StudyLight\'s "Spurgeon\'s Verse Expositions of the Bible" at https://www.studylight.org/commentaries/eng/spe.html ). For each site say: does WebFetch open it, does each page print the sermon\'s date and number, is the text public domain, what is the site\'s own credit line word for word. Spurgeon\'s sermons have no per-book writer, so propose a cite entry that lists works (one work per sermon, like "gospel-coalition" lists articles), with one fully checked sample work entry for a real sermon on a verse (title, number, date as printed, url, written_from).' },
  { id: 'lowth', who: 'Robert Lowth (1710 to 1787), Bishop of London',
    task: 'Works: Lectures on the Sacred Poetry of the Hebrews (Latin 1753; English translation by G. Gregory, 1787, two volumes; later editions) and Isaiah: A New Translation, with a Preliminary Dissertation and Notes (1778). Find free scans on archive.org (read the metadata and the title page; record title, translator, place, printer and year as printed). Find, in his own words, what he holds about Scripture (that it is inspired, God\'s word), quote and page url. Lowth\'s Isaiah proposes changes to the Hebrew text in places: say how a cite would avoid those (we never cite an emendation as the text) and whether anything in the parts we would cite denies Scripture in the sense of decision 23(3) (contradicting the text itself, such as the author a title or opening verse names). Find one or two pages where he names a parallelism or an inverted order on a named verse, with the archive.org page url and the exact words (he is public domain, so the quote is kept).' },
  { id: 'jebb', who: 'John Jebb (1775 to 1833), Bishop of Limerick',
    task: 'Work: Sacred Literature (London, 1820), on the parallelism of the New Testament, including introverted parallelism. Find the free scan on archive.org (metadata, title page as printed). Find his own words on Scripture (inspired, God\'s word), with page url. Find two pages where he sets out an introverted or other parallelism on a named verse (a New Testament verse preferably), with the archive.org page url and the exact words.' },
  { id: 'boys', who: 'Thomas Boys (1792 to 1880), Anglican clergyman and Hebrew scholar',
    task: 'Works: Tactica Sacra (London, 1824) and A Key to the Book of the Psalms (London, 1825); also check whether "The Suppressed Evidence" or other works bear on the structure of Scripture. Find free scans on archive.org or Google Books (metadata, title pages as printed). Find his own words on Scripture, with page url. Find two pages where he sets out an introverted (chiastic) structure on a named passage, with page url and exact words. He wrote about long structures across a whole psalm or epistle: say which passages, since large chiasms are now approved at Deep.' },
  { id: 'forbes', who: 'John Forbes (1800s), The Symmetrical Structure of Scripture (Edinburgh, 1854)',
    task: 'Identify the author exactly (which John Forbes; his church and post, from the title page or a named reference). Find the scan (metadata, title page as printed). His own words on Scripture, with page url. Two pages where he sets out an introverted structure on a named passage, with page url and exact words. Say whether he upholds Scripture; if anything in the book denies it, say where.' },
  { id: 'keach', who: 'Benjamin Keach (1640 to 1704), Particular Baptist minister',
    task: 'Work: Tropologia: A Key to Open Scripture Metaphors (London, 1681 and 1682), with later editions (1779; 1855 "A Key to Open Scripture Metaphors"; the Kregel reprint title "Preaching from the Types and Metaphors of the Bible" is copyrighted as a reprint but the text is public domain). Find a free scan of an old edition on archive.org (metadata, title page as printed, which edition, and whether it adds an editor\'s words). Also check his Book I on figures ("Troposchematologia"). His own words on Scripture, with page url. Two pages where he explains a named metaphor on a named verse, with page url and exact words. Say how a cite would link to a page (the book is arranged by metaphor, not by verse).' },
  { id: 'augustine', who: 'Augustine of Hippo, more of his works on New Advent',
    task: 'The cite list has only "augustine-tractates-john" under source "church-fathers". Propose the works most useful for wordplay, figures and allusions, each as a works entry exactly like augustine-tractates-john (translator and Nicene and Post-Nicene Fathers volume from the New Advent page\'s own translation line, read today): Expositions on the Psalms, On Christian Doctrine (book III treats tropes and figures), The Harmony of the Gospels, Sermons on New Testament Lessons, Homilies on the First Epistle of John, The City of God, Questions on the Heptateuch if New Advent has it. Give each work\'s New Advent url and the translation line word for word. Find one place in On Christian Doctrine book III where he names a figure (tropes, or that Scripture uses all the figures the grammarians name), with the page url and exact words.' },
  { id: 'macarthur', who: 'John MacArthur (born 1939), pastor of Grace Community Church (the founder wrote "James mcaurthes"; check that John MacArthur is the likely person and say so)',
    task: 'His words are under copyright, so a cite carries a pointer (our own short line saying what he says and where), never his words. Find where his teaching can be read free online one sermon or article per page with its date (Grace to You, https://www.gty.org/library/sermons-library ); does WebFetch open it; what is the site\'s copyright line word for word (and its copyright policy page: does it allow only non-commercial use? then we only link). His own words on Scripture (that it is inerrant), with page url (for the faith check only; this quote is not shipped). Propose a cite entry that lists works (one per sermon), and one fully checked sample work for a real sermon where he states a wordplay, allusion or figure on a named verse, with url, date as printed and a pointer line in our words.' },
  { id: 'keller', who: 'Timothy Keller (1950 to 2023), pastor of Redeemer Presbyterian Church, New York',
    task: 'His words are under copyright, so a cite carries a pointer only. Find where his teaching can be read free online with dates: The Gospel Coalition articles by him (thegospelcoalition.org, already a site on the cite list), Gospel in Life (gospelinlife.com: are sermon transcripts free?), Redeemer\'s sites. Does WebFetch open them; each site\'s copyright line word for word. His own words on Scripture\'s authority, with page url (faith check only). Say plainly anything a careful reader would weigh against the founder\'s rule (Bible-believing, not liberalizing), quoting where he says it, since the founder decides: decision 20 judges each cited passage on its own words. Propose a cite entry listing works, and one fully checked sample work where he states a wordplay, allusion or figure on a named verse, with url, date and a pointer line in our words.' },
]

const ENTRY = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    verdict: { type: 'string', enum: ['add', 'add-pointer-only', 'extend-existing', 'do-not-add', 'unsure'] },
    why: { type: 'string', description: 'one or two plain sentences' },
    faith: { type: 'object', description: '{quote (public domain only) or pointer, url, time, remark}' },
    writers: { type: 'array', items: { type: 'object' }, description: 'writers entries in the cite list shape' },
    works: { type: 'array', items: { type: 'object' }, description: 'works entries in the cite list shape, each with written and written_from from a page you read' },
    cite: { type: 'object', description: 'the cite entry (or, for extend-existing, the parts to add, as {add_parts:[...]} or {add_works:[...]})' },
    shelf: { type: 'array', items: { type: 'object' }, description: 'config/shelf.json cards' },
    credits: { type: 'array', items: { type: 'object' }, description: 'records for docs/evidence/credits-2026-10-21.json (named_by from a page read)' },
    link_rule: { type: 'string', description: 'how a cite on a verse links to the exact page the words are on' },
    quote_rule: { type: 'string', description: 'which words may be quoted, and which never (other writers, editors, emendations, copyrighted text)' },
    denies: { type: 'array', items: { type: 'object' }, description: 'passages that deny Scripture, for config denies, or [] with why none' },
    samples: { type: 'array', items: { type: 'object' }, description: '{on, kind, point (our words), quote or pointer, url, time} for real verse-level statements' },
    reads: { type: 'array', items: { type: 'object' }, description: 'every page opened: {url, time, what it showed}' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'verdict', 'why', 'writers', 'works', 'cite', 'shelf', 'credits', 'link_rule', 'quote_rule', 'denies', 'samples', 'reads', 'problems'],
}

const CHECKED = {
  type: 'object',
  properties: {
    entry: ENTRY,
    checks: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, url: { type: 'string' }, ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['claim', 'ok', 'note'] } },
    changed: { type: 'array', items: { type: 'string' }, description: 'what you corrected and why' },
  },
  required: ['entry', 'checks', 'changed'],
}

const COMMON = `You are helping the Bible Atlas project add Bible-believing writers to its cite list (config/layer-sources.json), as the founder Shubhanshu asked on ${TODAY}: "if they beleive the bible the writeers shoudlbe added and if they dont contradict ... Also people like james mcaurthes, chalres suprogon, tim ekller and everyone open soruce maybe add their commentaries too". His standing rule: cite Bible-believing people who fully believe the Bible and theologians who love God, not people who liberalize the Bible; Christian writers only.

Read ${W}/formats.md first: it has the exact shapes of writers, works, cite, shelf and credit entries, copied from the repository, with their own comments. Match them exactly. You do not edit the repository; you return proposed entries.

Rules:
- Load WebFetch with ToolSearch ("select:WebFetch") and read every page yourself. Record each page you open in reads with its UTC time from \`date -u +%Y-%m-%dT%H:%M:%SZ\` (Bash). Never guess a date, a title, an edition or a quote: every written and written_from comes from a title page, a library record (archive.org metadata) or the page's own line that you read. If you could not read it, say so in problems and leave the field honest ("date not known", written_from "none found").
- Quotes are copied word for word from the page. Public-domain words may be quoted; copyrighted words never: give a pointer in our own plain words instead.
- archive.org: the metadata JSON is at https://archive.org/metadata/<id>; a printed page links as https://archive.org/details/<id>/page/<printed page>/mode/1up (or page/n<leaf>/mode/1up when the page has no printed number). The search-inside service finds words in a scan: https://<server>/fulltext/inside.php?item_id=<id>&doc=<id>&path=<dir>&q=%22<words>%22, with server (or d1) and dir from the metadata JSON; a working example: https://ia600409.us.archive.org/fulltext/inside.php?item_id=figuresofspeechu00bull&doc=figuresofspeechu00bull&path=/13/items/figuresofspeechu00bull&q=%22Gen.%20iv.%209%22 . Its hits give a page index; the printed page is read off that page. Use it to find pages rather than reading a whole book.
- about: at most 60 characters, no honorifics, from the title page or a named reference work (Wikipedia is accepted, as about_from shows in formats.md).
- Plain English in every line you write; no em dashes.
- Keep fetches lean: about 20 at most. Save your notes to ${W}/work/<writer id>/notes.md as you go (mkdir -p first).`

phase('Research')
const results = await pipeline(
  WRITERS,
  w => agent(`${COMMON}\n\nWriter: ${w.who}\nYour id for this writer: ${w.id}\n\nTask: ${w.task}\n\nReturn the proposed entries. verdict: add (public domain, upholds Scripture), add-pointer-only (copyrighted, upholds Scripture), extend-existing (already on the list; give only what to add), do-not-add or unsure (say why).`,
    { label: `research:${w.id}`, phase: 'Research', schema: ENTRY }),
  (r, w) => r ? agent(`${COMMON}\n\nYou are the second reader. Another agent proposed these entries for ${w.who}. Re-open every url it relies on (reads, samples, faith, written_from, named_by) and check each claim yourself: titles, dates and editions as printed, the psalm ranges or works named, the about line and its source, quotes word for word, that each sample's page really carries those words on that verse, that copyrighted words appear nowhere except as our own pointer lines, and that the verdict fits the founder's rule. Fix what is wrong, drop what you cannot confirm (say so in changed), and return the corrected entry with a list of checks.\n\nProposed entry:\n${JSON.stringify(r, null, 1)}`,
    { label: `check:${w.id}`, phase: 'Check', schema: CHECKED }) : null,
)

return { today: TODAY, results: results.map((x, i) => ({ id: WRITERS[i].id, checked: x })) }
