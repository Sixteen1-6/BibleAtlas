export const meta = {
  name: 'wordplay-candidates',
  description: 'Sweep the whole Bible for plays on words, name meanings and allusions that Bible-believing writers note',
  phases: [
    { title: 'Sweep', detail: 'one agent per part of the Bible' },
    { title: 'Critic', detail: 'what the sweep missed' },
  ],
}

const S = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad'

const RULE = `The project owner's rule for anything cited (verbatim): "if we can cite everyhting then we should keep it but cite biblibcal sutff like bible beleiving people who fully beleive the bible and thelogians that love god. Not people who are libratizing the bible to mean soemthing else". So every candidate must be one that a Bible-believing writer notes. Writers that pass (use these ids): clarke (Adam Clarke's Commentary), gill (John Gill's Exposition), keil-delitzsch (Keil and Delitzsch, Old Testament), jfb (Jamieson-Fausset-Brown), henry (Matthew Henry), barnes (Albert Barnes' Notes), pulpit (the Pulpit Commentary), ellicott (Ellicott's Commentary for English Readers), poole (Matthew Poole), calvin (John Calvin's commentaries), spurgeon (Spurgeon's Treasury of David, Psalms), church-fathers (a named Church Father, with the work), bullinger (E. W. Bullinger, Figures of Speech Used in the Bible, 1898), lange (Lange's Commentary), bengel (Bengel's Gnomon), trapp (John Trapp). Never rely on these (they fail the rule or are not allowed): the Cambridge Bible for Schools and Colleges, the Expositor's Greek Testament, Meyer, BDB, Thayer, Vincent's Word Studies, the ICC, TheTorah.com, Working Preacher, Enter the Bible, JBL, the Jewish Encyclopedia, the UBS Handbooks, and any writer who treats Scripture as erring or as myth.`

const KINDS = `What to find, in the books assigned to you:
- wordplay: a play on words in the Hebrew, Aramaic or Greek: two words that sound alike set side by side (tohu va-bohu; na va-nad; mishpat / mispach), one word used in two senses, a word chosen to echo a name, a sound play across a passage. Not the alphabet poems (acrostics), which the app already has.
- name meaning: where the text explains or plays on what a person's or place's name means (Cain and "I have gotten", Isaac and laughter, Peniel, Ichabod), including names given in the story.
- allusion: where a passage deliberately recalls an earlier passage of Scripture by its words or picture without quoting it (John 1:1 and Genesis 1:1; John 20:22 and Genesis 2:7; Hosea 12:3-4 and Jacob in Genesis; Luke 9:31 "departure", exodus). In the New Testament, prefer allusions that are not plain quotations.
Be generous: the owner said there is "way more" than the app has. Aim for 40 to 70 strong candidates in your books, more if your books are rich. Skip anything doubtful, and skip a play only a critical scholar sees.`

const TOOLS = `Tools: a helper prints a verse's BSB text and its Hebrew or Greek words with Strong's keys: python3 ${S}/wp/vw.py "Genesis 4:12" "Micah 1:10-15". Use it to check the words of every candidate (every Strong's key you give must be one the helper prints for that verse; give it exactly as printed, e.g. H5128, H5110). The verses the app already covers, with the kinds of notes it has there, are in ${S}/wp/covered.json: skip a candidate on a covered verse unless its kind is missing there. Do not fetch web pages in this step (the budget is shared); name from your knowledge which writer notes it and where (their comment on which verse), and say how sure you are. Do not edit files outside ${S}/wp/.`

const CAND = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'the verse or short range, e.g. "Genesis 4:12"' },
          kind: { type: 'string', enum: ['wordplay', 'name meaning', 'allusion'] },
          words: { type: 'array', description: 'the original-language words it rests on, checked with the helper', items: { type: 'object', properties: { ref: { type: 'string' }, strong: { type: 'string' }, word: { type: 'string' }, translit: { type: 'string' } }, required: ['ref', 'strong'] } },
          target: { type: 'string', description: 'for an allusion: the earlier passage it recalls' },
          what: { type: 'string', description: 'one plain sentence: what the play or allusion is' },
          sources: { type: 'array', items: { type: 'object', properties: { source: { type: 'string', description: 'an id from the list' }, on: { type: 'string', description: 'the verse whose comment notes it' }, at: { type: 'string', description: 'for church-fathers or bullinger: writer, work and place' } }, required: ['source'] } },
          sure: { type: 'string', enum: ['high', 'medium'] },
        },
        required: ['ref', 'kind', 'what', 'sources', 'sure'],
      },
    },
  },
  required: ['candidates'],
}

const GROUPS = [
  ['genesis', 'Genesis'],
  ['law', 'Exodus, Leviticus, Numbers, Deuteronomy'],
  ['history', 'Joshua, Judges, Ruth, 1 and 2 Samuel, 1 and 2 Kings, 1 and 2 Chronicles, Ezra, Nehemiah, Esther'],
  ['poetry', 'Job, Psalms, Proverbs, Ecclesiastes, Song of Solomon'],
  ['major', 'Isaiah, Jeremiah, Lamentations, Ezekiel, Daniel'],
  ['minor', 'Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi'],
  ['gospels', 'Matthew, Mark, Luke, John, Acts'],
  ['letters', 'Romans through Revelation'],
]

phase('Sweep')
const swept = await parallel(GROUPS.map(([key, books]) => () => agent(
  `You are gathering plays on words, name meanings and allusions for a Bible study app (Bible Atlas). Your books: ${books}.

${KINDS}

${RULE}

${TOOLS}`,
  { label: `sweep-${key}`, phase: 'Sweep', schema: CAND },
)))
const all = swept.filter(Boolean).flatMap((r) => r.candidates)
log(`${all.length} candidates from ${swept.filter(Boolean).length} of ${GROUPS.length} sweeps`)

phase('Critic')
const seen = all.map((c) => `${c.ref} | ${c.kind}`).join('\n')
const more = await agent(
  `A sweep of the whole Bible for plays on words, name meanings and allusions that Bible-believing writers note has found the candidates listed at the end (verse | kind). Find what it MISSED: well-known plays on words and name meanings in Hebrew, Aramaic or Greek, and allusions, that are not in the list and not already covered (${S}/wp/covered.json). Think of Bullinger's lists of paronomasia and related figures, the plays the prophets make on town names, the names in Genesis 29-30 and 49, Jesus' sayings, Paul's wordplays, and allusions in Revelation. Return 30 to 80 more.

${KINDS}

${RULE}

${TOOLS}

Already found:
${seen}`,
  { label: 'critic', phase: 'Critic', schema: CAND },
)
const out = all.concat(more ? more.candidates : [])
return { count: out.length, candidates: out }
