export const meta = {
  name: 'hard-verse-open-sources',
  description: 'Find openly licensed, verse-keyed theologian and scholar commentary, Haley 1874, and verse-level link-out targets for hard verses',
  phases: [{ title: 'Research' }, { title: 'Verify' }],
}

const COMMON = `Context: Bible Atlas (github.com/Sixteen1-6/BibleAtlas) is a Rust data build plus a Preact web app. It may ship only public domain, CC BY 4.0 or CC BY-SA 4.0 (or CC0) text; never NC or ND, never the ESV. Copyrighted sites may only be linked, never copied. The build downloads pinned sources from GitHub repos at exact commits (this container's shell can reach only github.com and raw.githubusercontent.com; your WebFetch and WebSearch tools can reach other sites for checking). This is research only: do not edit any repository or file. Check every claim against the source itself (the repo's LICENSE/README, a sample data file, the publisher page) and give the URL you checked. Say "unknown" rather than guess. Use plain, short sentences.`

const SITE = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          what: { type: 'string', description: 'what the work is, who wrote or translated it, when' },
          repo: { type: 'string', description: 'GitHub repo URL, or other URL if not on GitHub' },
          commit: { type: 'string', description: 'a current commit sha on the default branch if on GitHub, else empty' },
          files: { type: 'string', description: 'paths of the data files and their format, with a short real sample (under 400 chars)' },
          verseKeyed: { type: 'string', description: 'how passages are keyed to verses (e.g. OSIS refs per entry), and coverage: which books, roughly how many verses/entries' },
          license: { type: 'string', description: 'the license of the data AND of the underlying text, quoted from the source, with URLs checked' },
          usable: { type: 'string', enum: ['yes', 'no', 'unclear'] },
          why: { type: 'string', description: 'why usable or not; risks (e.g. modern translation still under copyright, NC clause, missing license file)' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'what', 'repo', 'license', 'usable', 'why', 'sources'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['candidates', 'notes'],
}

const TOPICS = [
  { key: 'fathers', prompt: `Find datasets of what the early Church Fathers and other pre-1900 theologians wrote about specific Bible verses, keyed by verse, hosted on GitHub. Start with github.com/HistoricalChristianFaith/Commentaries-Database (the data behind catenabible.com): its license, the license of the translations it quotes (e.g. Schaff's Ante-Nicene and Nicene and Post-Nicene Fathers, 1880s-1890s, public domain; but some entries may be modern copyrighted translations), its file format, how entries are keyed (book/chapter/verse ranges), how many fathers and entries, and whether each entry names its source work and translator so copyrighted translations can be filtered out. Look for any other such datasets too (e.g. Thomas Aquinas' Catena Aurea, public domain 1841 translation, on GitHub).` },
  { key: 'commentaries', prompt: `Find public-domain classic Bible commentaries in machine-readable, verse-keyed form hosted on GitHub: e.g. Matthew Henry (1706-1721), Jamieson-Fausset-Brown (1871), Albert Barnes' Notes, Adam Clarke, John Gill, Keil and Delitzsch (English translation 1860s-1890s), the Pulpit Commentary, Ellicott's Commentary, the Cambridge Bible for Schools, John Wesley's Notes, Geneva Bible notes. Many exist as SWORD/CrossWire modules or JSON/SQLite converted by hobbyists. For each: repo, commit, format, verse keys, coverage, and the license stated by the repo (a repo with no license file is a risk even for a public-domain text: say so). Prefer repos that state a public-domain or open license explicitly.` },
  { key: 'haley', prompt: `Find a machine-readable text of John W. Haley, "An Examination of the Alleged Discrepancies of the Bible" (1874; public domain), ideally on GitHub (also check Project Gutenberg, CCEL, Internet Archive, Wikisource for the existence and format of a transcription, and whether any copy is on GitHub). Describe its structure (doctrinal, ethical, historical discrepancies; each item gives two or more verse references, then a discussion), roughly how many discrepancy items and verse references it has, and how hard it would be to key each item to its verses automatically (are references marked up?). Also look for any other public-domain or openly licensed book or dataset that lists hard or disputed Bible verses with discussion (e.g. Torrey's "Difficulties in the Bible" 1907, public domain) and say where a clean text is.` },
  { key: 'links', prompt: `Find verse-level link-out targets a Bible app can link to for "what scholars and theologians say about this verse", with a predictable URL per verse. Check, by fetching real examples: BibleHub commentary pages (e.g. https://biblehub.com/commentaries/genesis/1-1.htm) and what commentaries they list; Blue Letter Bible verse pages with commentaries; the NET Bible's notes per verse (netbible.org / bible.org); StudyLight commentaries; Bible Gateway's free commentaries; catenabible.com per verse (Church Fathers); GotQuestions: does it have any verse or Bible-book index (for example a page listing questions about a book or chapter), or only a site search? Give the URL pattern, one working example URL, which books and verses it covers, whether it is free to read, and whether the site's terms allow plain linking. Do not copy their text.` },
]

const VERIFY = (key, found) => `${COMMON}

You are checking another researcher's findings on "${key}". Try to refute every candidate: open each repo's LICENSE and README yourself, open a real data file, and confirm the commit exists, the format and verse keys are as described, and the license really allows redistribution of the text (watch for modern copyrighted translations inside a public-domain collection, NC clauses, or a missing license). Correct any wrong field, set usable honestly, and add any important candidate the researcher missed. Return the corrected list in the same shape, and in notes say what you changed.

Findings to check (JSON):
${JSON.stringify(found).slice(0, 60000)}`

const results = await pipeline(
  TOPICS,
  (t) => agent(`${COMMON}\n\n${t.prompt}`, { label: `research:${t.key}`, phase: 'Research', schema: SITE }),
  (found, t) => agent(VERIFY(t.key, found), { label: `verify:${t.key}`, phase: 'Verify', schema: SITE }).then((v) => ({ key: t.key, found, verified: v })),
)
return { topics: results.filter(Boolean) }
