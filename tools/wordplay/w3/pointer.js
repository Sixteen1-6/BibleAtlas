export const meta = {
  name: 'pointed-cross-references',
  description: 'Founder decision 9: find pointed cross-references and second writers for one-writer link notes, then a skeptic re-checks every added cite',
  phases: [
    { title: 'Find', detail: 'judge the script\'s candidates and search the Bible Hub pages' },
    { title: 'Refute', detail: 'a skeptic re-opens and tests every added cite' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const CITE = {
  type: 'object',
  properties: {
    source: { type: 'string', description: 'id from the cite list in config/layer-sources.json (gill, clarke, barnes, jfb, keil-delitzsch, henry-concise, wesley, bullinger-cb, bullinger-fos, tyndale-notes, catena-aurea, ellicott, pulpit, poole, benson, calvin, henry, bengel, geneva, maclaren, chrysostom, spurgeon, net-notes, reformation-sb, church-fathers, ...)' },
    on: { type: 'string', description: 'the verse the remark is on: the commentator\'s own heading verse' },
    quote: { type: 'string', description: 'verbatim, 20 to 350 characters, parts joined with "..." in order, all inside one remark' },
    url: { type: 'string', description: 'where you read it: the local tool and verse (e.g. "cq.py gill Job 6:4", "osn.py Job 6:4", "cat.py Luke 2:25") or the exact web page' },
    at: { type: 'string', description: 'only for a source with no Bible Hub code and no local copy (net-notes, reformation-sb, church-fathers, tyndale-notes, catena-aurea, ...): what the cite points to, e.g. "NET Bible note on Hosea 1:9", "Aquifer Open Study Notes (adapted from the Tyndale Open Study Notes), note on Job 6:4", "Thomas Aquinas, Catena Aurea on Luke 2:25-32, quoting Ambrose"' },
    link: { type: 'string', description: 'only with "at": the page a reader can open (the verse page for NET or the Reformation Study Bible; https://tyndaleopenresources.com/ for the study notes; the ccel.org or newadvent.org page, else https://github.com/AlvaroBalbin/catena)' },
    writer: { type: 'string', description: 'for the Catena or the church fathers: the Father quoted' },
    points_only: { type: 'boolean', description: 'true when this writer only points to the linked passage (rule 1a) without stating the note in his own words' },
    pointer: { type: 'string', description: 'only for a modern work under copyright (net-notes, reformation-sb, gospel-coalition, ligonier, themelios, jets, bibleproject, beale, bruce, woudstra, leithart, bird, keener, capes): one line in your own words, with no quotation, saying where on the page and how the writer makes the point, e.g. "translators\' note on Genesis 5:29: relates the name Noah to the verb to rest, a sound play"' },
  },
  required: ['source', 'on', 'quote', 'url'],
}

const RULE = `The owner's rule: cite only Bible-believing writers and theologians who love God, never those who liberalize the Bible; Christian writers only (Catholic and Orthodox writers who uphold Scripture count; rabbis and Jewish scholars do not). He also said there is "way more" in the Bible than the app shows and to keep everything that can be cited. A source must be on the "cite" list in ${LW}/config/layer-sources.json (each entry has an id, a Bible Hub code "biblehub" or a "url", and maybe "not_on" books where it may not be cited; the Pulpit Commentary is barred on Jeremiah and Lamentations). Never cite anything on its "avoid" list, even when Bible Hub shows it on the same page (the Cambridge Bible, the Expositor's Greek Testament or Bible, Meyer, Vincent, the ICC). Notes that cite a listed source go live without further review, so every claim must be right and every citation real.

What counts as a writer stating a note (lessons from earlier checks, all strict):
1. He must say it in his own voice: that the verse alludes to, echoes, quotes or has in view the other passage; that the words make the play; what the name means and that it matters here; that the words are figurative and what they stand for; how the parallel lines answer each other; that the two people are set in contrast.
1a. Pointed cross-references count (the owner's decision of 2026-10-20: "The see [quote] is fine"). When a writer, in his remark on this verse, points the reader to the very passage a note links ("See Gen. 3. 19", "compare Isa 14:12", "(Mat 11:23)", "as in Ps 22:1"), that counts toward an allusion, quotation, fulfillment, pattern or contrast note linking those two passages. It counts only if the reference is attached to this verse's words and names that passage (or a range that contains its key verse); a long run of five or more references on a general theme does not point. A pointer alone never states a wordplay, a name meaning, a figure or how parallel lines answer each other; and a note whose writers only point may say no more than that the two passages are linked (for example "This line echoes ..." or "Compare ..."), unless a counted writer states more. The evidence says which writers only point ("Wesley points to Ezek 47:1-12").
2. A view he only reports ("some think", "the Fathers note", "it is generally understood") or rejects does not count, nor one he passes on from the Targum, Jarchi, Aben Ezra or "the Jewish writers".
3. He must state this same claim, not a different play in the same verse, and not only half of the note.
4. Bullinger's Companion Bible and Figures of Speech are one writer. In the Catena Aurea each Father is his own writer (Chrysostom in the Catena and Chrysostom on Bible Hub are one writer).
5. His remark must be on this verse, or on the other verse of an allusion where he names this verse.
6. Leave out words that deny Scripture (the owner's decisions 2 and 20 of 2026-10-20): never cite a remark that calls a book or its events fiction, denies a writer whom a book's title or opening verse names, or says the received text is in error. Never cite Ellicott on Psalms, Song of Solomon, Obadiah or Jonah (A. S. Aglen wrote those volumes and treats Jonah as possibly fiction), nor Ellicott, Keil and Delitzsch or the Pulpit Commentary on Ecclesiastes (each denies that Solomon wrote it), nor Calvin on Matthew 27:9, Acts 7:14 or 7:16, nor Keil and Delitzsch on Psalm 74:4, 86:1 or 130:1, nor the Pulpit Commentary on 2 Corinthians 3:7. Among the church fathers (Catena Aurea or New Advent and CCEL), never cite Origen, Didymus, Theodore of Mopsuestia, Pelagius, Arius, Nestorius, Apollinaris, Evagrius, Tatian, Novatian, Tertullian, Theodoret, Hippolytus, Victorinus, Clement of Alexandria, or (outside the Catena) Eusebius, and never the Catena's "Pseudo-Chrysostom" on Matthew (an unknown Arian writer); on Mark that name is Victor of Antioch and may be cited. The Catena's "Gloss" is not a writer and never counts.
7. Wesley's Old Testament notes abridge Matthew Henry and count as Henry; his New Testament notes abridge Bengel and count as Bengel. So Wesley never counts as a separate writer beside Henry or Henry's Concise (Old Testament) or Bengel (New Testament).`

const TOOLS = `Tools (python3 -I; write scratch files only under ${W}/tmp/):
- ${W}/vw.py "<ref>" prints the BSB verse with its Hebrew or Greek words, transliterations and Strong's keys; ranges work ("Micah 1:10-15").
- ${W}/cq.py all "<ref>" prints each local commentary on a verse (gill, clarke, barnes, jfb, kad = Keil and Delitzsch, mhcc = Henry's Concise, wesley, cb = Bullinger's Companion Bible, fos = Bullinger's Figures of Speech), cut at 2500 characters; "cq.py <work> <ref>" prints one in full; "cq.py check <work> <ref> <quote>" checks a quote is verbatim (exit 0). Their cite ids: kad = keil-delitzsch, mhcc = henry-concise, cb = bullinger-cb, fos = bullinger-fos; the others keep their names. A heading like "section gen 4:1" means the comment covers a run of verses starting there.
- ${W}/osn.py "<ref>" prints the Aquifer Open Study Notes (a plain-English adaptation of the Tyndale Open Study Notes; cite id tyndale-notes) covering the verse; "osn.py check <ref> <quote>".
- ${W}/cat.py "<ref>" prints the Catena Aurea on a Gospel verse, each segment under its Father's name (cite id catena-aurea); "cat.py check <ref> <quote>".
- Bible Hub chapter pages (WebFetch): https://biblehub.com/commentaries/<code>/<book>/<chapter>.htm with <code> ellicott, pulpit, benson, poole, calvin, gsb (geneva), mhcw (henry, Matthew Henry's complete commentary), bengel, maclaren, chrysostom, treasury (spurgeon) and <book> lowercase with underscores (1_samuel, song_of_solomon). Read down to this verse's remark.
- The Church Fathers (cite id church-fathers): only from the public-domain translations on New Advent (https://www.newadvent.org/fathers/) or CCEL (https://www.ccel.org/), with that page as url and link. Never cite the HistoricalChristianFaith database, historicalchristian.faith or other collections that carry modern copyrighted translations.
- The NET Bible notes for a verse: https://classic.net.bible.org/verse.php?book=<Abbr>&chapter=<c>&verse=<v> (Gen, Exo, 1Sa, Job, Psa, Isa, Mat, Joh, Rom, 1Co, Rev...). The Reformation Study Bible: https://www.biblegateway.com/resources/reformation-study-bible/<Job.6.4>.
- The app's live notes on a chapter: python3 -I -c "import json; [print(json.dumps(p, ensure_ascii=False)[:2500]) for p in json.load(open('${LW}/config/layers.json'))['passages'] if p['ref'].startswith('<Book> <chapter>:')]"`

const STR = ['widely agreed', 'commonly held', 'some interpreters']
const ADD = { type: 'object', properties: { ...CITE.properties, target: { type: 'string', description: 'the linked passage this writer points to or states' } }, required: ['source', 'on', 'quote', 'url', 'points_only'] }
const FOUND = {
  type: 'object',
  properties: {
    notes: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' },
      add: { type: 'array', items: ADD, description: 'cites to add: writers not already cited who point to the linked passage (rule 1a) or state the note' },
      strength: { type: 'string', enum: STR, description: 'counting the writers already cited and the ones added, by the rules above' },
      text: { type: 'string', description: 'only when the text must change so that it says no more than the counted writers support; at most 300 characters' },
      evidence: { type: 'string', description: 'the full evidence (at most 400 characters) naming every cited writer and how he states or points to the note' },
      why: { type: 'string', description: 'one or two sentences: what was found, what was rejected and why' },
    }, required: ['key', 'add', 'strength', 'evidence', 'why'] } },
  },
  required: ['notes'],
}
const REFUTED = {
  type: 'object',
  properties: {
    cites: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, n: { type: 'integer', description: 'index in that note\'s add list' },
      verdict: { type: 'string', enum: ['keep', 'drop'] }, quote: { type: 'string', description: 'the corrected verbatim quote, only if the given one is not verbatim but the writer does point' },
      reason: { type: 'string' },
    }, required: ['key', 'n', 'verdict', 'reason'] } },
    notes: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, strength: { type: 'string', enum: STR },
      text: { type: 'string', description: 'the text the note should have (at most 300 characters), only when the proposed or current text says more than the kept writers support' },
      evidence: { type: 'string', description: 'corrected evidence, only when it must change' },
      reason: { type: 'string' },
    }, required: ['key', 'strength', 'reason'] } },
  },
  required: ['cites', 'notes'],
}

const items = args.items
const per = args.per || 4
const groups = []
for (let i = 0; i < items.length; i += per) groups.push(items.slice(i, i + per))
const ks = args.only || groups.map((_, k) => k)

const res = await pipeline(
  ks,
  (k) => agent(`You are strengthening notes in Bible Atlas, a Bible study app whose Deep level shows cited notes on what lies under each verse. Each note below links its verse to another passage, and so far too few writers back it. The owner ruled on 2026-10-20 that a writer's pointed cross-reference counts ("The see [quote] is fine"). Your job: find the writers on the cite list who point to the linked passage or state the note, and add them with verbatim quotes.

${RULE}

${TOOLS}

For each note:
1. "candidates" are places where a script found a reference to the linked passage in a local commentary's remark on the anchor verse ("run" counts the references in that run; five or more do not point). Judge each under rule 1a: is the reference attached to this verse's words, and does it name the linked passage? If so, open the remark with cq.py, choose a verbatim quote of 20 to 350 characters that contains the reference and the words it is attached to, and confirm it with cq.py check. Set points_only true unless the writer also states the note in his own words.
2. Then read the anchor verse's remark on the Bible Hub pages (ellicott, pulpit, benson, poole, calvin, gsb, mhcw, bengel, maclaren, chrysostom and treasury where they cover the book) and the NET note page, and the Catena (cat.py) for a Gospel verse, for any other cite-list writer who points to the same passage or states the note. Quote verbatim (url = the page). A modern copyrighted work (the NET notes and the like) also gets a "pointer" line.
3. Never add a writer already in the note's cites, nor one rule 6 forbids, and never count two cites of one writer.
4. Return the strength counting every writer already cited (who states the note) plus the ones you add, by rule 4 (3+ widely agreed, 2 commonly held, 1 some interpreters; Bullinger's two works count once, Henry's two once, Wesley as rule 7 says). If the note's text says more than the counted writers together support, give a corrected text (at most 300 characters, plain English, no writer names, exact BSB wording inside any quotation of four or more words, checked with vw.py); writers who only point support only that the passages are linked. Always return the full evidence (at most 400 characters) naming every cited writer and whether he states the note or only points.
Accuracy beats count: add nothing you are not sure of.

The notes:
${JSON.stringify(groups[k], null, 1)}`, { label: `find:${args.name}-${k}`, phase: 'Find', schema: FOUND }),
  (found, k) => {
    const adds = (found && found.notes || []).filter((n) => n.add && n.add.length)
    if (!adds.length) return { k, found, refuted: null }
    const show = adds.map((n) => ({ ...groups[k].find((g) => g.key === n.key), proposed: n }))
    return agent(`You are the skeptic for Bible Atlas, a Bible study app whose notes go live without further human review. A finder proposes adding cites to the notes below, under the owner's rule that a pointed cross-reference counts. Try to refute every added cite.

${RULE}

${TOOLS}

For each added cite (its index n in the note's "proposed.add"):
- Re-open it: cq.py check for a local work; WebFetch the url for a web page and find the words in the writer's remark on the verse in "on". A quote not found verbatim: give the exact quote if the writer does point, else drop.
- Does it point under rule 1a (attached to this verse's words, naming the linked passage, not one of five or more references in a run) or state the note? Is the writer allowed by rule 6? Is he already cited, or the same writer as one already cited (rule 4 and 7)? Drop it if any answer fails. Default to drop when unsure.
For each note, return the strength that the kept cites and the existing ones support, and a text (at most 300 characters) only if the current or proposed text says more than they support; writers who only point support only that the passages are linked.

${JSON.stringify(show, null, 1)}`, { label: `refute:${args.name}-${k}`, phase: 'Refute', schema: REFUTED }).then((refuted) => ({ k, found, refuted }))
  },
)
return res.filter(Boolean).map((r) => ({ k: r.k, notes: (r.found && r.found.notes || []).length, added: (r.found && r.found.notes || []).reduce((a, n) => a + (n.add || []).length, 0), kept: r.refuted ? r.refuted.cites.filter((c) => c.verdict === 'keep').length : 0 }))
