export const meta = {
  name: 'verse-link-tables',
  description: 'Build and test per-book URL tables for verse-level link-outs (BibleHub, NET notes, Church Fathers, BibleRef/GotQuestions, Sefaria)',
  phases: [{ title: 'Tables' }, { title: 'Check' }],
}

const BOOKS = 'Genesis, Exodus, Leviticus, Numbers, Deuteronomy, Joshua, Judges, Ruth, 1 Samuel, 2 Samuel, 1 Kings, 2 Kings, 1 Chronicles, 2 Chronicles, Ezra, Nehemiah, Esther, Job, Psalms, Proverbs, Ecclesiastes, Song of Songs, Isaiah, Jeremiah, Lamentations, Ezekiel, Daniel, Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi, Matthew, Mark, Luke, John, Acts, Romans, 1 Corinthians, 2 Corinthians, Galatians, Ephesians, Philippians, Colossians, 1 Thessalonians, 2 Thessalonians, 1 Timothy, 2 Timothy, Titus, Philemon, Hebrews, James, 1 Peter, 2 Peter, 1 John, 2 John, 3 John, Jude, Revelation'

const COMMON = `Bible Atlas is a free Bible study web app. At its deepest level it will show, under a verse, a few links to other sites where a reader can read more about that verse. We only link; we never copy their text. Your job: work out the exact URL for any verse on one site, as a template plus a table of the site's slug (or code) for each of the 66 books, in this order (index 0 to 65): ${BOOKS}. The app numbers verses the way English Bibles do (the Berean Standard Bible, close to the KJV). Use your WebFetch tool to open real pages and confirm. Test at least: the first verse of every book (66 fetches, or as many as the site allows; if rate-limited, test at least 25 spread across the canon including every single-chapter book), plus Psalm 23:1, Psalm 51:1, Song of Songs 2:1, 1 Samuel 17:4, Joel 2:28, Malachi 4:5, Daniel 4:1, John 3:16, Acts 8:37, 3 John 1:14, Revelation 12:17. Report exactly which URLs you fetched and what each returned (a real verse page, a redirect, a 404, a "coming soon" page, a page for the wrong verse). If a verse or a whole book is missing on the site, say so: the app will hide the link there. Do not guess any slug you did not test: mark it untested. Do not edit any file. Plain, short sentences.`

const SCHEMA = {
  type: 'object',
  properties: {
    site: { type: 'string' },
    label: { type: 'string', description: 'plain words for the link, e.g. "Classic commentaries (BibleHub)"' },
    template: { type: 'string', description: 'URL template with {slug}, {c}, {v}, and any other placeholders you define in notes' },
    slugs: { type: 'array', items: { type: ['string', 'null'] }, description: '66 entries, index 0 Genesis to 65 Revelation; null where the site has no page for the book' },
    tested: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, result: { type: 'string' } }, required: ['url', 'result'] } },
    gaps: { type: 'string', description: 'books, chapters or verses the site lacks or numbers differently, and how the app should handle each' },
    terms: { type: 'string', description: 'what the site says about linking, quoted with the URL' },
    notes: { type: 'string' },
  },
  required: ['site', 'label', 'template', 'slugs', 'tested', 'gaps', 'terms', 'notes'],
}

const SITES = [
  { key: 'biblehub', prompt: `Site: BibleHub verse commentary pages, for example https://biblehub.com/commentaries/genesis/1-1.htm (lists many classic commentaries on that verse).` },
  { key: 'net', prompt: `Site: the NET Bible's translators' notes for a verse. Find the most stable verse-level URL: check classic.net.bible.org (for example https://classic.net.bible.org/verse.php?book=Gen&chapter=1&verse=1), netbible.org, and net.bible.org, and pick the one that shows that verse with its notes. Say which is more likely to last.` },
  { key: 'fathers', prompt: `Site: early Church writers on a verse. Compare catenabible.com (find its verse URL pattern, e.g. https://catenabible.com/mt/1 or similar) and historicalchristian.faith (its by-verse page; its data is at github.com/HistoricalChristianFaith/Commentaries-Database). Pick the one with a stable, predictable verse URL that covers the most of the Bible, and give its table. Note which books have few or no entries is NOT needed; the link may show a page with no entries, but say what such a page looks like.` },
  { key: 'questions', prompt: `Site: questions and answers about a verse from Got Questions Ministries. BibleRef.com has per-verse pages (for example https://www.bibleref.com/John/3/John-3-16.html) but not for every book or chapter yet. GotQuestions.org has a page of questions for each book of the Bible (start from https://www.gotquestions.org/questions-about-books-Bible.html). Give two tables in one answer: put the BibleRef template and slugs in template/slugs, and for every book say in notes (as a JSON object {bookIndex: url}) the exact GotQuestions book-questions page URL. For BibleRef, find which books (and, where partial, which chapters) actually have content rather than a "coming soon" page; put that in gaps as precisely as you can (e.g. "OT: only Genesis 1-11 and Psalms 1-30 done").` },
  { key: 'sefaria', prompt: `Site: Sefaria, Jewish texts and commentaries, Old Testament books only (null for the New Testament). Verse URL like https://www.sefaria.org/Genesis.1.1 (check whether "?with=Commentary" or a similar parameter opens the commentary panel, and whether it works without JavaScript). Sefaria numbers verses by the Hebrew text, which differs from English Bibles in places (many Psalm titles count as verse 1, Malachi 4 is Malachi 3:19-24, Joel 2:28-32 is 3:1-5, Joel 3 is 4, Daniel 4:1-3 is 3:31-33, and others). Find out whether Sefaria accepts English numbering in the URL (it may have an English versification option); if not, list the books where the numbering differs so the app can link those books to the chapter instead of the verse.` },
]

const tables = await pipeline(SITES, (s) => agent(`${COMMON}\n\n${s.prompt}`, { label: `table:${s.key}`, phase: 'Tables', schema: SCHEMA }))
const ok = tables.filter(Boolean)
phase('Check')
const check = await agent(`${COMMON}\n\nYou are checking five other researchers' URL tables. For each site, fetch at least 12 URLs they did NOT test, built from their template and slugs (pick tricky books: numbered books, Song of Songs, Psalms, Obadiah, Philemon, Jude, 2 John, Lamentations, Ecclesiastes, Revelation), and report each result. Correct any slug that fails, and say whether each table is safe to ship. Return the corrected tables.\n\nTables (JSON):\n${JSON.stringify(ok).slice(0, 90000)}`, {
  label: 'check:all',
  phase: 'Check',
  schema: { type: 'object', properties: { tables: { type: 'array', items: SCHEMA }, verdicts: { type: 'string' } }, required: ['tables', 'verdicts'] },
})
return { tables: ok, check }
