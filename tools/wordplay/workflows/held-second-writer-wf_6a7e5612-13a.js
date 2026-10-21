export const meta = {
  name: 'held-second-writer',
  description: 'For each held wordplay or allusion passage with one writer, search every citable work for a second writer or a better-supported note, verify and refute each find, write the mended note, then check it against its quotes',
  phases: [
    { title: 'Find', detail: 'three searchers per passage, each a different way' },
    { title: 'Verify', detail: 're-read every quote where it was found' },
    { title: 'Refute', detail: 'a skeptic tries to knock out each confirmed cite' },
    { title: 'Compose', detail: 'write the mended or new note from the surviving cites' },
    { title: 'Check', detail: 'a fresh checker reads each mended note against all its quotes; a second reader confirms each change' },
  ],
}

const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'

const RULE = `The owner's rule: cite only Bible-believing writers and theologians who love God, never those who liberalize the Bible; Christian writers only (Catholic and Orthodox writers who uphold Scripture count; rabbis and Jewish scholars do not). A source must be on the "cite" list in ${LW}/config/layer-sources.json (read it: each entry has an id, a Bible Hub code "biblehub" or a "url", and maybe "not_on" books where it may not be cited, e.g. the Pulpit Commentary is barred on Jeremiah and Lamentations). Never cite anything on its "avoid" list, even when Bible Hub shows it on the same page (Bible Hub also shows the Cambridge Bible, the Expositor's Greek Testament, the Expositor's Bible, Meyer and Vincent: never use them).

What counts as a writer stating a note (lessons from earlier checks, all strict):
1. He must say it in his own voice: that the verse alludes to, echoes, borrows, adapts or has in view the other passage, or that the words make the play, or what the name means. A bare cross-reference ("see Isa 14:15", "compare", "(Mat 11:23)", "So Eph 4:30") does not count, and a cross-reference made in both directions is still only a cross-reference.
2. A view he only reports ("some think", "the Fathers note", "it is generally understood") or rejects does not count, nor one he passes on from the Targum, Jarchi, Aben Ezra or "the Jewish writers".
3. He must state this same claim, not a different play in the same verse, and not only half of the note.
4. Bullinger's Companion Bible and Figures of Speech are one writer. A writer already cited for the claim does not count again. In the Catena Aurea each Father is his own writer (Chrysostom in the Catena and Chrysostom on Bible Hub are one writer); cite the Catena with source catena-aurea and name the Father.
5. His remark must be on this verse, or on the other verse of an allusion where he names this verse; a remark on a different verse that uses the same phrase does not count for this verse.`

const TOOLS = `Tools (python3 -I): ${W}/vw.py "<ref>" prints the BSB verse with its Hebrew or Greek words and Strong's keys. ${W}/cq.py all "<ref>" prints each local commentary on a verse (Gill, Clarke, Barnes, JFB, Keil and Delitzsch as kad, Henry's Concise as mhcc, Wesley, Companion Bible as cb, Figures of Speech as fos), cut at 2500 characters; "cq.py <work> <ref>" prints one in full; "cq.py check <work> <ref> <quote>" checks a quote is verbatim (exit 0). ${W}/osn.py "<ref>" prints the Aquifer Open Study Notes (a plain-English adaptation of the Tyndale Open Study Notes; cite id tyndale-notes) covering the verse, and "osn.py check <ref> <quote>" checks a quote. ${W}/cat.py "<ref>" prints the Catena Aurea on a Gospel verse, each segment under its Father's name, and "cat.py check <ref> <quote>" checks a quote and names the Father. Bible Hub commentary chapter pages: https://biblehub.com/commentaries/<code>/<book>/<chapter>.htm with <code> from the cite list (ellicott, pulpit, benson, poole, calvin, gsb, mhcw, bengel, maclaren, chrysostom, treasury, gill, barnes, jfb, kad, clarke, wes) and <book> lowercase with underscores (1_samuel, song_of_solomon). The NET Bible notes for one verse: https://classic.net.bible.org/verse.php?book=<Abbr>&chapter=<c>&verse=<v> (Abbr like Gen, Exo, 1Sa, Psa, Isa, Hos, Mat, Joh, Rom, 1Co, Rev). The Reformation Study Bible note for one verse: https://www.biblegateway.com/resources/reformation-study-bible/<OSIS like Eph.4.30>. Use WebFetch for web pages.`

const CITE = {
  type: 'object',
  properties: {
    target: { type: 'string', enum: ['existing', 'alternative'], description: 'existing: backs one of the passage\'s notes; alternative: backs the alternative note you propose' },
    layer: { type: 'integer', description: 'with target existing: the index of the note in the passage\'s layers that it backs' },
    source: { type: 'string', description: 'id from the cite list' },
    on: { type: 'string', description: 'the verse the remark is on, e.g. "Isaiah 63:10" (the commentator\'s own heading verse)' },
    url: { type: 'string', description: 'the exact page or local file the quote was read in' },
    writer: { type: 'string', description: 'for the Catena Aurea or the church fathers, the Father; else the work\'s writer' },
    quote: { type: 'string', description: 'verbatim, 20 to 400 characters, parts joined with "..." in order, all inside one remark' },
    states: { type: 'string', description: 'one sentence: how this writer states the claim in his own voice' },
  },
  required: ['target', 'source', 'on', 'url', 'quote', 'states'],
}
const FOUND = {
  type: 'object',
  properties: {
    cites: { type: 'array', items: CITE },
    alternative: {
      type: 'object',
      description: 'only when you propose a different note for this verse that at least two writers state in their own voice',
      properties: {
        kind: { type: 'string', enum: ['allusion', 'wordplay', 'name meaning', 'pattern', 'irony', 'fulfillment'] },
        refs: { type: 'array', items: { type: 'string' } },
        words: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, strong: { type: 'string' } }, required: ['ref', 'strong'] } },
        text: { type: 'string', description: 'at most 300 characters, plain English, no writer named, any 4+ word quotation exact BSB of the verse or a ref' },
        evidence: { type: 'string', description: 'at most 400 characters: which writers state it and how (names go here)' },
      },
      required: ['kind', 'refs', 'text', 'evidence'],
    },
    searched: { type: 'string', description: 'which works and verses you read, and what each said' },
  },
  required: ['cites', 'searched'],
}
const VERD = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: 'index of the cite in the list' },
          verdict: { type: 'string', enum: ['confirmed', 'quote-fixed', 'rejected'] },
          quote: { type: 'string', description: 'with quote-fixed: the exact corrected quote' },
          on: { type: 'string', description: 'the corrected heading verse if the given one is wrong' },
          reason: { type: 'string' },
        },
        required: ['n', 'verdict', 'reason'],
      },
    },
    alternative_ok: { type: 'boolean', description: 'only if an alternative note was proposed: is its text true to the verse, the BSB and the confirmed writers' },
    alternative_text: { type: 'string', description: 'a corrected text for the alternative note, if it needs one' },
    alternative_reason: { type: 'string' },
  },
  required: ['results'],
}
const REF = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'integer' }, refuted: { type: 'boolean' }, reason: { type: 'string' } },
        required: ['n', 'refuted', 'reason'],
      },
    },
  },
  required: ['results'],
}
const ADD = {
  type: 'object',
  properties: {
    n: { type: 'integer', description: 'the n of a surviving cite' },
    at: { type: 'string', description: 'for a url-type source (no Bible Hub code): what the cite points to, e.g. "Reformation Study Bible (2015), note on Ephesians 4:30", "NET Bible note on Hosea 1:9", "Aquifer Open Study Notes (adapted from the Tyndale Open Study Notes), note on Isaiah 14:3-23", "Thomas Aquinas, Catena Aurea on Matthew 11:20-24, quoting Chrysostom", "John Chrysostom, Homilies on Matthew 37 (New Advent)"; omit for Bible Hub and local commentary sources' },
    url: { type: 'string', description: 'for a url-type source: the page a reader can open (the verse page for NET and RSB; https://tyndaleopenresources.com/ for the study notes; the ccel.org or newadvent.org page for the Catena or a Father if found, else https://github.com/AlvaroBalbin/catena); omit for Bible Hub and local commentary sources' },
  },
  required: ['n'],
}
const COMPOSE = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      description: 'one entry per note changed or added; empty when no note reaches two writers',
      items: {
        type: 'object',
        properties: {
          layer: { type: 'integer', description: 'index of the existing note in the passage\'s layers, or -1 for a new note' },
          kind: { type: 'string', enum: ['allusion', 'wordplay', 'name meaning', 'pattern', 'irony', 'fulfillment'] },
          strength: { type: 'string', enum: ['widely agreed', 'commonly held', 'some interpreters'] },
          refs: { type: 'array', items: { type: 'string' } },
          words: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, strong: { type: 'string' } }, required: ['ref', 'strong'] } },
          evidence: { type: 'string', description: 'at most 400 characters' },
          text: { type: 'string', description: 'at most 300 characters' },
          keep: { type: 'array', items: { type: 'integer' }, description: 'for an existing note: the index of each of its current cites to keep' },
          add: { type: 'array', items: ADD },
        },
        required: ['layer', 'kind', 'strength', 'refs', 'evidence', 'text', 'add'],
      },
    },
    reason: { type: 'string' },
  },
  required: ['changes', 'reason'],
}
const CHECK = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          layer: { type: 'integer' },
          verdict: { type: 'string', enum: ['ok', 'fix', 'drop'] },
          strength: { type: 'string', enum: ['widely agreed', 'commonly held', 'some interpreters'] },
          text: { type: 'string', description: 'only with verdict fix, when the text must change: the full corrected text, at most 300 characters' },
          evidence: { type: 'string', description: 'only when the evidence must change: the full corrected evidence, at most 400 characters' },
          remove_cites: { type: 'array', items: { type: 'integer' }, description: 'the n of each cite whose writer says nothing toward this note, or whose quote is not verbatim where given' },
          reason: { type: 'string' },
        },
        required: ['layer', 'verdict', 'strength', 'reason'],
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
          layer: { type: 'integer' },
          decision: { type: 'string', enum: ['accept', 'amend', 'reject'] },
          strength: { type: 'string', enum: ['widely agreed', 'commonly held', 'some interpreters'] },
          text: { type: 'string', description: 'with amend: the full text you settle on, at most 300 characters' },
          evidence: { type: 'string', description: 'with amend, when the evidence must change: the full evidence, at most 400 characters' },
          remove_cites: { type: 'array', items: { type: 'integer' } },
          reason: { type: 'string' },
        },
        required: ['layer', 'decision', 'strength', 'reason'],
      },
    },
  },
  required: ['results'],
}

const NOTE_RULES = `The app's rules for a note: text at most 300 characters, evidence at most 400; plain English a newcomer understands; any quotation of four or more words in the text must be the BSB's exact wording of the passage verse or of a verse in the note's refs (check with vw.py); Greek wording is said to be in that writer's Greek ("in Luke's Greek", "in Paul's Greek"), never presented as Jesus' own word choice; an Aramaic reading is called a reconstruction unless the text itself keeps the Aramaic; no writer, commentary or scholar is named in the text (names belong in evidence); every cited writer is named in the evidence, saying how he states the note or that he only cross-references it; never name a rabbi or Jewish scholar anywhere. Word keys ("words") are Strong's keys, exactly as vw.py prints them, of the words the note is about, and each must occur in the verse given in its ref. refs list the passage verse first, then the other verses the note names.
Strength must be honest: "widely agreed" when three or more different cited writers state this same note in their own voice; "commonly held" for two; "some interpreters" for one. The text must claim only what the counted writers state: when a writer backs only part of a note, either narrow the text to the part two or more writers state, or do not count him. A note stated by only some of its writers as a reading is worded as a reading ("can", "may", "many see").`

const ANGLES = [
  `Your search: every Bible Hub commentary on the cite list for this verse, for the other verse of the allusion, and for parallel passages (another Gospel's version of the saying, or the same phrase elsewhere where the writer names this verse). Read each chapter page down to this verse's remark in full. Also read the local commentaries in full with cq.py. Skip only what the quote rows show is already cited.`,
  `Your search: the cite-list works that are not Bible Hub commentaries. The NET Bible notes (the classic.net.bible.org verse page, notes included), the Aquifer Open Study Notes (osn.py) and, for a Gospel verse, the Catena Aurea (cat.py), the Church Fathers on New Advent (newadvent.org/fathers), Edersheim (ccel.org), the Reformation Study Bible (Bible Gateway resource page), Ligonier, The Gospel Coalition, BibleProject, Matthew Henry's complete commentary (Bible Hub code mhcw) and, for a Psalm, Spurgeon's Treasury of David (Bible Hub code treasury). A url source is cited with the url you read it in.`,
  `Your search: a better-supported note for this verse. If the passage's note cannot get a second writer, is there a different wordplay, name meaning, allusion, pattern, irony or fulfillment in this very verse that two or more different cite-list writers state in their own voice? Read the local commentaries in full (cq.py all, then cq.py <work> for each), the study notes (osn.py), and the Bible Hub pages for the verse. Propose it as "alternative" only if you have at least two such writers with verbatim quotes (target "alternative"), and make sure the app does not already show it on this verse or a verse next to it (python3 -I -c "import json; [print(json.dumps(p, ensure_ascii=False)[:3000]) for p in json.load(open('${LW}/config/layers.json'))['passages'] if p['ref'].startswith('<Book chapter>:')]"). If you also find a second writer for the passage's own note, return that too (target "existing").`,
]

const HELD = W + '/h3/held.json'
const show = (pid) => `python3 -I -c "import json; [print(json.dumps(x, ensure_ascii=False, indent=1)) for x in json.load(open('${HELD}')) if x['passage']['id']=='${pid}']"`
const brief = (pid) => `You are working on Bible Atlas, a Bible study app whose notes go live without human review, so every cite must be exact and fair. The passage below was held back from the app: its notes beyond the plain meaning each have only one writer who states them in his own voice (each cite's verbatim quote is in "quotes", with "note" giving the layer it backs), or it has no such note at all, so the build refuses it (every passage needs at least one note beyond the plain meaning that two or more different writers state).

Print it (the passage and its quote rows): ${show(pid)}

${RULE}

${TOOLS}`

const items = args.pids
const res = await pipeline(
  items,
  async (pid) => {
    const finds = (await parallel(ANGLES.map((a, i) => () => agent(`${brief(pid)}

${a}

Return every cite you find with the exact url or local file you read it in and a verbatim quote copied from it (never retyped from memory). Do not return a writer who only cross-references, only reports the view, states something else, or is already cited for that note in the quote rows (unless his existing quote is only a cross-reference and you found his own-voice statement). In "searched", list what you read and what each work said, so the next reader can trust a "none".`, { label: `find:${pid}-${i}`, phase: 'Find', schema: FOUND })))).filter(Boolean)
    const cites = []
    const alts = []
    for (const f of finds) {
      for (const c of f.cites || []) {
        if (!cites.some((x) => x.source === c.source && x.on === c.on && x.target === c.target && (x.writer || '') === (c.writer || '') && (x.layer ?? -1) === (c.layer ?? -1))) cites.push(c)
      }
      if (f.alternative) alts.push(f.alternative)
    }
    log(`${pid}: ${cites.length} cites found, ${alts.length} alternatives`)
    return { pid, finds: finds.map((f) => f.searched), cites, alts }
  },
  async (r) => {
    if (!r.cites.length) return { ...r, stop: 'no cites found' }
    const verified = await agent(`${brief(r.pid)}

You are checking citations before they make a note live. For each cite below, open its url (WebFetch) or local file (cq.py check, osn.py check or cat.py check; grep the local data) and confirm: the quote is there verbatim, in that writer's own remark and on the verse given in "on" (the commentator's own heading verse; correct "on" if it is wrong); the source id is on the cite list and not barred for that book; and the quote states the claim in the writer's own voice under the rules above. A "target" of "existing" backs the passage's note at "layer"; "alternative" backs the alternative note below. Verdict confirmed, quote-fixed (give the exact quote as it appears) or rejected, with a one-line reason. When unsure, reject.

Cites (n is the index):
${JSON.stringify(r.cites.map((c, n) => ({ n, ...c })), null, 1)}

Alternative notes proposed (check each text with vw.py: true to the verse, at most 300 characters, any 4+ word quotation exact BSB, no writer named in the text, and backed by the confirmed alternative cites):
${JSON.stringify(r.alts, null, 1)}`, { label: `verify:${r.pid}`, phase: 'Verify', schema: VERD })
    return { ...r, verified }
  },
  async (r) => {
    if (r.stop) return r
    const passed = (r.verified ? r.verified.results : []).filter((x) => x.verdict !== 'rejected').map((x) => x.n)
    if (!passed.length) return { ...r, stop: 'no cite verified' }
    const vq = (n) => (r.verified.results.find((x) => x.n === n) || {})
    const list = passed.map((n) => ({ n, ...r.cites[n], ...(vq(n).quote ? { quote: vq(n).quote } : {}), ...(vq(n).on ? { on: vq(n).on } : {}) }))
    const refuted = await agent(`${brief(r.pid)}

A first checker confirmed the cites below. Your job is to try to knock each one out. Earlier checkers passed cites that turned out to be bare cross-references, views the writer only reported, a writer backing only half of a note, a remark on a different verse, or a quote whose "..." joined two remarks. Re-open each source yourself (WebFetch the url, or cq.py, osn.py or cat.py for local works) and read the writer's whole remark around the quote. Mark refuted true if any rule above fails or if you cannot confirm it; otherwise refuted false, with the reason.

Cites:
${JSON.stringify(list, null, 1)}`, { label: `refute:${r.pid}`, phase: 'Refute', schema: REF })
    const ok = new Set(((refuted && refuted.results) || []).filter((x) => !x.refuted).map((x) => x.n))
    const survivors = list.filter((c) => ok.has(c.n))
    return { ...r, refuted, survivors }
  },
  async (r) => {
    if (r.stop) return r
    if (!r.survivors.length) return { ...r, stop: 'every cite refuted' }
    const compose = await agent(`${brief(r.pid)}

Searchers found, a checker verified and a skeptic failed to refute the cites below (n is each cite's number). Write the mended note or notes for this passage so it can go live.

Surviving cites:
${JSON.stringify(r.survivors, null, 1)}

Alternative notes the searchers proposed, with the checker's view:
${JSON.stringify({ proposed: r.alts, alternative_ok: r.verified.alternative_ok, alternative_text: r.verified.alternative_text, alternative_reason: r.verified.alternative_reason }, null, 1)}

${NOTE_RULES}

How to write the changes:
- For a passage note that gains writers (target "existing"): give layer (its index), its kind, the strength the counted writers now support, refs, words, evidence and text; "keep" lists the index of each current cite to keep (keep a current cite that only cross-references as a supporting link only if the evidence says it only cross-references; drop a cite whose writer says nothing toward the note); "add" lists each surviving cite to add, with "at" and "url" for a url-type source. Narrow or hedge the text so it says no more than the counted writers state together (read their quotes, and their full remarks with cq.py, osn.py, cat.py or WebFetch when a quote is short).
- For a new note (target "alternative"): layer -1, with kind, strength, refs, words (Strong's keys that occur in the verse, from vw.py), evidence, text and the cites to add. Write it fresh from the surviving cites; do not copy a searcher's text without checking it against the quotes and the BSB.
- Count only distinct writers who state the note in their own voice. Return no change for a note that still has only one such writer, and return an empty list if nothing reaches two writers.
- Check every 4+ word quotation in the text against the BSB with vw.py, and keep the text at most 300 characters and the evidence at most 400.`, { label: `compose:${r.pid}`, phase: 'Compose', schema: COMPOSE })
    return { ...r, compose }
  },
  async (r) => {
    if (r.stop) return r
    if (!r.compose || !r.compose.changes.length) return { ...r, stop: 'nothing reached two writers' }
    const notes = r.compose.changes.map((ch, k) => {
      const layer = ch.layer >= 0 ? ch.layer : 100 + k
      const kept = (ch.keep || []).map((j) => ({ current_cite: j, of_layer: ch.layer, quote: null }))
      const added = (ch.add || []).map((a) => {
        const s = r.survivors.find((x) => x.n === a.n)
        if (!s) return null
        return { source: s.source, on: s.on, ...(a.at ? { at: a.at } : {}), ...(a.url ? { url: a.url } : {}), writer: s.writer, quote: s.quote, read_in: s.url }
      }).filter(Boolean)
      const cites = [...kept, ...added].map((c, n) => ({ n, ...c }))
      const note = { kind: ch.kind, strength: ch.strength, refs: ch.refs, words: ch.words || [], evidence: ch.evidence, text: ch.text }
      return { layer, note, cites }
    })
    const view = { passage: r.pid, notes }
    const KEPT = `A layer number of 100 or more marks a new note. A cite with "current_cite" is one the passage's note already had: it is that cite (by index) in the passage's layer "of_layer", and its quote is the quote row with that "note" number, source and on. Print the passage and its quote rows: ${show(r.pid)}`
    const checked = await agent(`You are checking notes for Bible Atlas, a Bible study app whose notes go live without further human review, so each must say no more than its sources say. Each note explains a play on words, a name meaning, an allusion or a fulfillment in a verse, and cites Bible-believing writers, each with the verbatim quote that backs it ("read_in" is where it was read).

${JSON.stringify(view, null, 1)}

${KEPT}

${TOOLS}

${RULE}

${NOTE_RULES}

Earlier checks found these faults, so look hard for them: the text states as fact what the writers offer as a reading; the text says more than the quotes (a detail, a motive, a claim no cited writer states, or that the verse does not say); a cited writer whose quote only explains a word, gives a cross-reference, reports a view, or finds a different play, counted toward the strength; a quote that is not verbatim where given, or whose "..." joins two remarks; a fact wrong about the other verse (check it with vw.py); a word key that is not the note's subject or not in the verse; a cited writer missing from the evidence; a sentence that is confusing or contradicts itself.
For each note: read its quotes, re-open each source (cq.py, osn.py, cat.py, or WebFetch the read_in page) to confirm the quote and read the whole remark, and check the Hebrew or Greek and the other verse with vw.py. Return one result per note (use its "layer" number): ok, fix (give the strength, and the full corrected text or evidence when it must change; keep what is right, change only what is wrong, keep any 4+ word BSB quotation exact), or drop (only when the central claim is false or no cited writer states it). Always return the strength the note should have, counting only writers who state it in their own voice. List in remove_cites any cite whose writer says nothing toward the note or whose quote you could not find.`, { label: `check:${r.pid}`, phase: 'Check', schema: CHECK })
    if (!checked) return { ...r, view, stop: 'check failed' }
    const changed = checked.results.filter((x) => x.verdict !== 'ok' || (x.remove_cites && x.remove_cites.length))
    if (!changed.length) return { ...r, view, checked, confirmed: { results: [] } }
    const confirmed = await agent(`You are the second reader for changes proposed to notes in Bible Atlas, a Bible study app whose notes go live without further human review. A first checker proposed the changes below. Your job is to make sure each change is right: that the problem is real, that the new text is true, faithful to the cited writers, and no weaker than the sources allow, and that a drop is deserved.

The notes as written, with their quotes:
${JSON.stringify(view, null, 1)}

${KEPT}

${TOOLS}

${RULE}

${NOTE_RULES}

Proposed changes:
${JSON.stringify(changed, null, 1)}

For each proposed change return: accept (the change is right as given), amend (the problem is real but the fix needs work: give the strength and the full text, and the evidence if it changes, that you settle on), or reject (the original was fine; keep it, and return its original strength). For a drop, accept only if you also find the central claim false or unstated by every cited writer; otherwise amend it into a fixed note or reject. Check every 4+ word quotation against the BSB with vw.py, re-open a source whenever the change turns on what a writer said, and keep texts at most 300 characters.`, { label: `confirm:${r.pid}`, phase: 'Check', schema: CONFIRM })
    return { ...r, view, checked, confirmed }
  },
)
return res.filter(Boolean).map((r) => ({ pid: r.pid, stop: r.stop || null, searched: r.finds, cites: r.cites, alts: r.alts, verified: r.verified || null, refuted: r.refuted || null, survivors: r.survivors || [], compose: r.compose || null, view: r.view || null, checked: r.checked || null, confirmed: r.confirmed || null }))
