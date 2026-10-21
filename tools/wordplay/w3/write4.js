export const meta = {
  name: 'write-cited-notes-4',
  description: 'Write cited Layers notes (plays on words, name meanings, allusions, figures, parallelism, contrasts) from mined leads, then a skeptic, a fresh checker and a second reader check every note',
  phases: [
    { title: 'Write', detail: 'one writer per batch of verses' },
    { title: 'Verify', detail: 'a skeptic re-checks every quote and claim' },
    { title: 'Check', detail: 'a fresh checker reads each note against its quotes' },
    { title: 'Confirm', detail: 'a second reader accepts, amends or rejects each change' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const KINDS = ['plain meaning', 'quotation', 'allusion', 'wordplay', 'name meaning', 'pattern', 'irony', 'fulfillment', 'figure', 'parallelism', 'contrast']
const STR = ['widely agreed', 'commonly held', 'some interpreters']

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
    figure_name: { type: 'string', description: 'figure notes only: Bullinger\'s figure and subdivision as figname.py shows it, shortened, e.g. "Metonymy of the Cause: the sword put for war", "Synecdoche of the Part: bread put for all food"; when Bullinger does not list the verse, the figure the cited writers name' },
    figure_words: { type: 'string', description: 'figure notes only: the exact BSB words of this verse that carry the figure, e.g. "the arrows of the Almighty"' },
    stands_for: { type: 'string', description: 'figure notes only: in plain words, what those words stand for, e.g. "the pain and terror God has sent on him"' },
    lines: { type: 'array', items: { type: 'string' }, description: 'parallelism notes only: each line word for word as the BSB has it, two or more' },
    relation: { type: 'string', enum: ['restates', 'sharpens', 'contrasts', 'builds', 'mirrors'], description: 'parallelism notes only: how the second line relates to the first' },
    people: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } }, required: ['name', 'refs'] }, description: 'contrast notes only: each person or group and the verse range that shows them (a person may come from another passage)' },
  },
  required: ['kind', 'strength', 'refs', 'cites', 'text'],
}
const OUT = {
  type: 'object',
  properties: {
    passages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          section: { type: 'string', enum: ['law-history', 'prophets-poetry', 'jesus', 'letters-revelation'] },
          ref: { type: 'string' },
          saying: { type: 'string' },
          layers: { type: 'array', items: LAYER },
        },
        required: ['id', 'section', 'ref', 'saying', 'layers'],
      },
    },
    additions: {
      type: 'array',
      items: { type: 'object', properties: { passage_id: { type: 'string' }, ref: { type: 'string' }, layers: { type: 'array', items: LAYER } }, required: ['passage_id', 'ref', 'layers'] },
    },
    dropped: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, kind: { type: 'string' }, reason: { type: 'string' } }, required: ['ref', 'kind', 'reason'] } },
  },
  required: ['passages', 'additions', 'dropped'],
}
const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'the passage or addition verse' },
          layer: { type: 'integer', description: '0-based index of the layer in that passage or addition' },
          verdict: { type: 'string', enum: ['keep', 'fix', 'drop'] },
          reason: { type: 'string' },
          fixed: LAYER,
        },
        required: ['ref', 'layer', 'verdict', 'reason'],
      },
    },
    passage_fixes: {
      type: 'array',
      items: { type: 'object', properties: { ref: { type: 'string' }, field: { type: 'string', enum: ['id', 'saying', 'section'] }, value: { type: 'string' }, reason: { type: 'string' } }, required: ['ref', 'field', 'value', 'reason'] },
    },
  },
  required: ['verdicts', 'passage_fixes'],
}
const CHECK = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          note: { type: 'string', description: 'the note id as given' },
          verdict: { type: 'string', enum: ['ok', 'fix', 'drop'] },
          strength: { type: 'string', enum: STR },
          text: { type: 'string', description: 'with fix, when the text must change: the full corrected text, at most 300 characters' },
          evidence: { type: 'string', description: 'when the evidence must change: the full corrected evidence, at most 400 characters' },
          remove_cites: { type: 'array', items: { type: 'integer' }, description: 'the n of each cite whose writer says nothing toward this note, or whose quote is not verbatim where given' },
          figure_name: { type: 'string', description: 'when it must change' },
          figure_words: { type: 'string', description: 'when it must change: exact BSB words' },
          stands_for: { type: 'string', description: 'when it must change' },
          lines: { type: 'array', items: { type: 'string' }, description: 'when they must change: exact BSB lines' },
          relation: { type: 'string', enum: ['restates', 'sharpens', 'contrasts', 'builds', 'mirrors'] },
          reason: { type: 'string' },
        },
        required: ['note', 'verdict', 'strength', 'reason'],
      },
    },
  },
  required: ['results'],
}
const CONFIRM = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          note: { type: 'string' },
          decision: { type: 'string', enum: ['accept', 'amend', 'reject'] },
          strength: { type: 'string', enum: STR },
          text: { type: 'string' },
          evidence: { type: 'string' },
          remove_cites: { type: 'array', items: { type: 'integer' } },
          figure_name: { type: 'string', description: 'when it must change' },
          figure_words: { type: 'string', description: 'when it must change: exact BSB words' },
          stands_for: { type: 'string', description: 'when it must change' },
          lines: { type: 'array', items: { type: 'string' }, description: 'when they must change: exact BSB lines' },
          relation: { type: 'string', enum: ['restates', 'sharpens', 'contrasts', 'builds', 'mirrors'] },
          reason: { type: 'string' },
        },
        required: ['note', 'decision', 'strength', 'reason'],
      },
    },
  },
  required: ['results'],
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

const KIND_GUIDE = {
  r3: `Kinds for this batch:
- wordplay: a sound play, pun or repeated root in the Hebrew or Greek of this verse. words lists the Strong's keys of the playing words.
- name meaning: what a person's or place's name means, only where the meaning matters to the verse (the name is given, changed or explained for its meaning, the passage plays on it, or the writers draw the lesson). A sound-alike that is not the real root is said that way ("sounds like"). Drop bare glosses of ordinary words and place names with no bearing on the verse.
- allusion: this verse echoes or borrows from another passage without quoting it outright. refs: this verse, then the other.
- quotation: this verse quotes another passage outright. Write it only when the writers say something about the quotation beyond its source: what the words meant in their first setting and how this verse uses them. refs: this verse, then the source.`,
  fig: `Kinds for this batch (all three show only at Deep; a note one writer states may stand alone as "some interpreters"):
- figure: a figure of speech in this verse, chiefly metonymy and synecdoche as Bullinger lists them (run ${W}/figname.py "<ref>" to see every figure and sub-heading Bullinger gives the verse, with his remark). Metonymy names one thing by another closely tied to it: a cause for its effect, an instrument for what it does, a container for what it holds, a sign for the thing signified ("the sword" for war). Synecdoche puts a part for the whole or the whole for a part, one kind for all its kind or one for many ("bread" for all food). If Bullinger names another figure for the same words (as he calls the arrows of God in Job 6:4 anthropopatheia, God described in human terms), use the figure he names. Fill figure_name (Bullinger's figure and subdivision, shortened, e.g. "Metonymy of the Cause: the sword put for war"), figure_words (the exact BSB words that carry it) and stands_for (what they stand for, in plain words). The text says in plain words which words stand for what and why that matters here, and names the figure once in plain words ("a figure of speech called metonymy"). A writer counts toward the note when he says in his own voice that those words stand for or mean that thing in this verse, even without naming the figure; the evidence must say that the figure's name comes from Bullinger (or whichever writer names it).
- parallelism: lines of this verse (or this verse and the next) that say the same thing in other words, set opposites side by side, sharpen or carry the thought further, or mirror each other, where a writer explains how the lines interpret each other. Fill lines (each line word for word from the BSB, two or more) and relation (restates, sharpens, contrasts, builds or mirrors). The text says what the pairing shows the reader, not only that it exists. Do not write a note that only says two lines are parallel.
- contrast: two people (or groups) the passage sets side by side so the reader weighs their choices (Hannah and Eli, Samuel and Eli's sons, David and Saul, Ruth and Orpah, Mary and Martha). The anchor verse is where the contrast is drawn. refs: the anchor verse first, then the other person's key verse. Fill people (each person or group with the verse range that shows them; one may come from another passage). Count only writers who state the contrast themselves. Where the New Testament itself draws the contrast (Hebrews 11:4 on Cain and Abel, Galatians 4 on Sarah and Hagar, Romans 9:13 on Jacob and Esau), add that verse to refs and let the text say so: it is the strongest witness. Be fair to both people: where Scripture is kinder to one (2 Peter 2:7-8 calls Lot righteous; Orpah did what Naomi urged; Jesus does not condemn Martha's service), the text says so and does not paint one side as simply bad. Two stories that only stand next to each other (Genesis 38 and 39, John 3 and 4) need a writer who draws the contrast in his own sentence.
A candidate whose only lead is a remark naming "parallelism" with no explanation of what the lines show is usually not worth a note: drop it.`,
}

const WRITE_RULES = `How to write each note (the app's Layers format):
1. Keep a candidate only if writers on the cite list state it in their own voice under the rules above. Search beyond the leads: the local works with cq.py, osn.py and cat.py, then the Bible Hub pages and the NET notes, for second and third writers. Never cite a writer for something he does not say.
2. A new passage must have at least one note beyond the plain meaning that two or more different writers state in their own voice (commonly held or widely agreed), except that figure, parallelism and contrast notes may carry a passage alone at any strength. Any other note only one writer states is "some interpreters": it may sit beside a firmer note or go into an addition for an existing passage, but it cannot carry a new passage alone; when such a candidate has only one writer and no existing passage, put it in "dropped" with the reason "one writer: <who>".
3. Each cite: source id from the cite list, on = the commentator's own heading verse for the remark, a verbatim quote of 20 to 350 characters copied from the tool output or the web page (parts joined in order with "..."), and url = where you read it. Run cq.py check, osn.py check or cat.py check on every local quote. A source with no Bible Hub code and no local copy also gets "at" and "link".
4. Strength counts distinct writers who state the note in their own voice, or point to the linked passage as rule 1a allows: three or more "widely agreed" (evidence required), two "commonly held", one "some interpreters". A cross-reference that does not point under rule 1a may stay as a supporting cite only if the evidence says so, and never counts.
5. A wordplay, name meaning or figure note lists the Hebrew or Greek words it rests on in "words": {ref, strong}, each strong exactly as vw.py prints it for that verse. refs list this verse first, then the other verses the note names.
6. A new passage: id is the book name in lowercase with hyphens, then chapter and verse (genesis-4-12, 1-samuel-25-25, psalm-2-7, song-of-solomon-8-6); section law-history (Genesis to Esther), prophets-poetry (Job to Malachi), jesus (Matthew to John), letters-revelation (Acts to Revelation); ref is the verse; saying is 3 to 15 words copied exactly from the BSB verse. Its first layer is "plain meaning": strength "widely agreed", refs [the verse], a one-sentence evidence, one cite of a commentary that explains the verse, and text saying plainly what the verse says. Then the other notes.
7. A verse whose existing_passage is set gets only notes the app does not already have there, as additions for that passage id, with no plain meaning layer. Read the live notes on the chapter first and never duplicate one.
8. Text: at most 300 characters, plain English a newcomer understands, full sentences, no em-dashes, no writer or source names, and nothing about how the note was made (never mention AI, drafting, reviewing or checking). The note must read as what its cited writers say, so a reader who taps through finds them saying it. Give Hebrew or Greek sounds simply. For Greek wording say whose Greek ("in John's Greek"); never present a Greek-only pun as Jesus' own words; call an Aramaic reading a reconstruction unless the text keeps the Aramaic. Any quotation of four or more words must be the exact BSB wording of this verse or of one of the note's refs (check with vw.py); otherwise paraphrase without quote marks. Say no more than the counted writers state; word a reading as a reading ("can", "may", "many see") when not every counted writer states it as fact.
9. Evidence: at most 400 characters; names every cited writer and how he states the note (or that he only cross-references it). Never name BDB, Thayer, the Cambridge Bible, the Expositor's, Meyer, Vincent, the ICC, the Jewish Encyclopedia or the UBS Handbooks, and never a rabbi or Jewish commentator (Rashi or Jarchi, Kimchi, Aben Ezra or Ibn Ezra, Ramban, Rambam, Abarbanel, Sforno, Malbim) or a modern Jewish scholar, even when a Christian writer quotes one. Ancient texts (Septuagint, Targums, Josephus) may be mentioned only as witnesses.
10. Accuracy beats count. Fewer, solid notes are better than many weak ones.`

const VERIFY_RULES = `Check every layer of the draft below as a skeptic. For each layer:
a. Re-open every cite: cq.py check, osn.py check or cat.py check for local works; WebFetch the url for web sources and find the quote in the writer's own remark on the verse given in "on". A quote not found verbatim is fixed (copy it exactly) or its cite is dropped; a layer left without a working cite is dropped.
b. Read each quote in its context: does the writer state this same note in his own voice under the rules above, or point to the linked passage as rule 1a allows? A writer who only reports a view, states something else, or gives a cross-reference that does not point under rule 1a does not count. Drop any cite rule 6 forbids. A plain meaning layer's cite must explain the verse.
c. Check the language facts with vw.py: the Strong's keys occur in that verse, the transliterations are right, the sound play or figure really is in the words, the name meaning is the one the writers give.
d. Check the text rules: at most 300 characters, plain, no writer names, the Greek and Aramaic rules, exact BSB wording inside any quotation of four or more words, strength honest for how many writers state it in their own voice, every cited writer in the evidence, and no new passage whose only note beyond the plain meaning is a "some interpreters" note of a kind other than figure, parallelism or contrast. For a figure note: figure_words are the exact BSB words of the verse, figure_name matches what figname.py shows Bullinger names (or the writer who names it), stands_for is what the cited writers say. For a parallelism note: every line is exact BSB wording and the relation fits. For a contrast note: the people and their verse ranges are right.
Return keep, fix (with the whole corrected layer in "fixed") or drop, with a one-line reason. When unsure whether a claim is supported, drop it. Also check each passage's id, saying (exact BSB words) and section, and report corrections in passage_fixes.`

const CHECK_RULES = `Earlier checks found these faults, so look hard for them: the text states as fact what the writers offer as a reading; the text says more than the quotes (a detail, a motive, a claim no cited writer states, or that the verse does not say); a cited writer whose quote only explains a word, gives a cross-reference that does not point under rule 1a (or a pointer counted toward a wordplay, name meaning, figure or parallelism note), reports a view, or finds a different play, counted toward the strength; a note resting on pointers that says more than that the passages are linked; a cite rule 6 forbids; a quote that is not verbatim where given, or whose "..." joins two remarks; a fact wrong about the other verse (check with vw.py); a word key that is not the note's subject or not in the verse; a cited writer missing from the evidence; a sentence that is confusing or contradicts itself; for figure, parallelism and contrast notes, figure_words or lines that are not the exact BSB wording (check with vw.py), a figure_name Bullinger does not give the verse (figname.py), a stands_for or relation the writers do not support, or people and verse ranges that are wrong. Figure, parallelism and contrast notes may stand at "some interpreters"; do not drop one only for having one writer.
For each note: read its quotes, re-open a source (cq.py, osn.py, cat.py, or WebFetch the url) whenever a quote is too short to judge, and check the Hebrew or Greek and the other verse with vw.py. Return one result per note id: ok, fix (give the strength, and the full corrected text or evidence when it must change; keep what is right, change only what is wrong, keep any 4+ word BSB quotation exact), or drop (only when the central claim is false or no cited writer states it). Always return the strength the note should have, counting only writers who state it in their own voice or point to the linked passage as rule 1a allows. List in remove_cites any cite whose writer says nothing toward the note or whose quote you could not find.`

const FILE = args.file
const show = (k) => `python3 -I -c "import json; b = json.load(open('${FILE}'))[${k}]; print(b['key']); print(json.dumps(b['verses'], ensure_ascii=False, indent=1))"`
const guide = KIND_GUIDE[args.mode || 'r3']
const ks = args.only || Array.from({ length: args.count }, (_, k) => k)

function review(draft, check) {
  const verdicts = {}
  for (const v of (check && check.verdicts) || []) { const k = `${v.ref}#${v.layer}`; if (!verdicts[k]) verdicts[k] = v }
  const fixes = {}
  for (const f of (check && check.passage_fixes) || []) (fixes[f.ref] = fixes[f.ref] || []).push(f)
  const judged = (ref, layers) => layers.map((l, i) => {
    const v = verdicts[`${ref}#${i}`]
    if (!v || v.verdict === 'drop') return null
    if (v.verdict === 'fix') return v.fixed || null
    return l
  }).filter(Boolean)
  const passages = (draft.passages || []).map((p) => {
    const q = { ...p }
    for (const f of fixes[p.ref] || []) q[f.field] = f.value
    q.layers = judged(p.ref, p.layers)
    return q
  })
  const additions = (draft.additions || []).map((a) => ({ ...a, layers: judged(a.ref, a.layers).filter((l) => l.kind !== 'plain meaning') })).filter((a) => a.layers.length)
  return { passages, additions }
}

const res = await pipeline(
  ks,
  (k) => agent(`You are writing notes for Bible Atlas, a Bible study app whose Deep level shows cited notes on what lies under each verse. Your verses and the leads a script found for them in the commentaries: print them first with
${show(k)}
The leads are only hints: some are noise, and the leads name only the local works that used a marker word.

${RULE}

${TOOLS}

${guide}

${WRITE_RULES}`, { label: `write:${args.name}-${k}`, phase: 'Write', schema: OUT }),
  (draft, k) => {
    if (!draft || (!draft.passages.length && !draft.additions.length)) return { k, draft, verify: null, reviewed: { passages: [], additions: [] } }
    return agent(`You are checking draft notes for Bible Atlas, a Bible study app, before they go live without further review.

${RULE}

${TOOLS}

${guide}

The rules the writer followed:
${WRITE_RULES}

${VERIFY_RULES}

Draft (passages, then additions; layer indexes are 0-based within each passage or addition):
${JSON.stringify({ passages: draft.passages, additions: draft.additions }, null, 1)}`, { label: `verify:${args.name}-${k}`, phase: 'Verify', schema: VERDICTS }).then((verify) => ({ k, draft, verify, reviewed: review(draft, verify) }))
  },
  (r) => {
    const notes = []
    for (const p of r.reviewed.passages) p.layers.forEach((l, i) => { if (l.kind !== 'plain meaning') notes.push({ note: `${p.ref}#p${i}`, saying: p.saying, ...l, cites: l.cites.map((c, n) => ({ n, ...c })) }) })
    for (const a of r.reviewed.additions) a.layers.forEach((l, i) => notes.push({ note: `${a.ref}#a${i}`, ...l, cites: l.cites.map((c, n) => ({ n, ...c })) }))
    if (!notes.length) return { ...r, notes, check: null, confirm: null }
    return agent(`You are checking notes for Bible Atlas, a Bible study app whose notes go live without further human review, so each must say no more than its sources say. Each note cites Bible-believing writers, each with the verbatim quote that backs it ("url" is where it was read).

${JSON.stringify(notes, null, 1)}

${RULE}

${TOOLS}

${guide}

${CHECK_RULES}`, { label: `check:${args.name}-${r.k}`, phase: 'Check', schema: CHECK }).then((check) => ({ ...r, notes, check }))
  },
  (r) => {
    if (!r.check) return { ...r, confirm: null }
    const changed = r.check.results.filter((x) => x.verdict !== 'ok' || (x.remove_cites && x.remove_cites.length))
    if (!changed.length) return { ...r, confirm: { results: [] } }
    return agent(`You are the second reader for changes proposed to notes in Bible Atlas, a Bible study app whose notes go live without further human review. A first checker proposed the changes below. Make sure each change is right: the problem is real, the new text is true, faithful to the cited writers and no weaker than the sources allow, and a drop is deserved.

The notes as written, with their quotes:
${JSON.stringify(r.notes.filter((n) => changed.some((c) => c.note === n.note)), null, 1)}

${RULE}

${TOOLS}

${guide}

Proposed changes:
${JSON.stringify(changed, null, 1)}

For each proposed change return: accept (right as given), amend (the problem is real but the fix needs work: give the strength and the full text, and the evidence if it changes, that you settle on), or reject (the original was fine; return its original strength). For a drop, accept only if you also find the central claim false or unstated by every cited writer; otherwise amend or reject. Check every 4+ word quotation against the BSB with vw.py, re-open a source whenever the change turns on what a writer said, and keep texts at most 300 characters.`, { label: `confirm:${args.name}-${r.k}`, phase: 'Confirm', schema: CONFIRM }).then((confirm) => ({ ...r, confirm }))
  },
)
return res.filter(Boolean).map((r) => ({ k: r.k, passages: r.reviewed.passages.length, additions: r.reviewed.additions.length, notes: (r.notes || []).length }))
