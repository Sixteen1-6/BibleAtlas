export const meta = {
  name: 'r3-reads-retry',
  description: 'Retry the round 3 Layers cites whose linked pages were not yet confirmed, on the linked page or a complete copy of the same work',
  phases: [{ title: 'Read' }],
}
const DIR = args.dir
const COMMON = `
You are re-reading web pages to make "reads" records for the Bible Atlas project's Layers notes. Each record says a cited writer's words were read on the exact page the citation links to, on a date and at a UTC time. Every quotation below was already found word for word in another copy of the same public-domain work; your job is to confirm it on a web page a reader can open. An earlier pass could not confirm these (rate limits, pages that would not load, or pages cut short), so this is a second try.

How to read:
- Use WebFetch (load it with ToolSearch "select:WebFetch" if needed). Make one call per page that asks about all of that page's quotations at once. WebFetch's reader can copy only about 125 characters word for word per answer, so ask it, for each numbered quotation, to answer FOUND or NOT FOUND (the same words in the same order; spacing, straight versus curly quote marks, hyphenation and the way Bible references are printed do not matter), and to copy the FIRST 8 WORDS and the LAST 5 WORDS of the matching text exactly as the page has them. If a word differs, ask it to copy the differing span exactly as the page has it and say so in remark.
- If WebFetch says the page is longer than it read and gives an offset, and some quotation is not yet found, call again with that offset for the quotations still missing. Repeat until all are found or the page ends. WebFetch cuts very long pages off at about 115,000 characters; if the text you receive stops before the verse you need, say so in remark.
- Right after each WebFetch call that confirms anything, run in Bash: date -u +%Y-%m-%dT%H:%M:%SZ and give that as "time" for the cites that call confirmed.
- WebFetch is limited to about 400 calls an hour shared by every agent. Do not repeat a call that already answered. If WebFetch reports a rate limit, run in Bash: sleep 120 (once), then try once more; if it still fails, or fails three times in a row for other reasons, stop and return the cites not yet read with status "not_read".
- Never use curl or any other tool to reach these sites; only WebFetch.
For every cite also give a verdict, under the founder's decision 20 (judge the cited comment on its own words): "respects", unless the cited comment itself calls the Bible text mistaken, a legend or myth, a later invention, or denies what the text says; then "denies", with up to 20 of its words in verdict_words.
A cite with never_quote true (the Pulpit Commentary, the NET notes, the Reformation Study Bible): never copy its words into your answer, not even the first words; still say FOUND or NOT FOUND, and write "pointer": where on the page the point is made, in your own plain words. Ask WebFetch for a short description, not a copy, for these.
Write plain English with no em dashes.
`
const OUT = {
  type: 'object',
  properties: {
    cites: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cid: { type: 'string' },
          status: { type: 'string', enum: ['found', 'not_found', 'not_read'] },
          found_at: { type: 'string', description: 'the url of the page where it was found' },
          time: { type: 'string', description: 'YYYY-MM-DDTHH:MM:SSZ from date -u right after the read' },
          first_words: { type: 'string' },
          last_words: { type: 'string' },
          pointer: { type: 'string' },
          verdict: { type: 'string', enum: ['respects', 'denies'] },
          verdict_words: { type: 'string' },
          remark: { type: 'string', description: 'anything odd: differences in wording (with the page wording), a different verse, a page cut short' },
        },
        required: ['cid', 'status'],
      },
    },
    chapter1: {
      type: 'array',
      items: {
        type: 'object',
        properties: { url: { type: 'string' }, decided: { type: 'string' }, denies_authorship: { type: 'boolean' } },
        required: ['url', 'decided', 'denies_authorship'],
      },
    },
  },
  required: ['cites'],
}
const PROMPT = {
  bh: (f) => `${COMMON}
Your pages are Bible Hub commentary chapter pages. Read the list in ${DIR}/${f} with the Read tool: each entry has the page url, the source, and its cites (cid, on, verse, pieces: the quotation pieces to find, never_quote, verse_page).
- Find every piece of every cite on the page url. A cite is found when all its pieces are found.
- If a cite is NOT FOUND on the chapter page after reading the whole page, try its verse_page once (a page that gathers every commentary on that verse); if found there, under the heading of the same commentary, give found_at = that verse_page and say in remark under which commentary's heading it sits.
- If the page url ends in /1.htm (chapter 1 of a book), also ask WebFetch what the introduction at the top of the page says about who wrote the book, and whether it denies that the writer the book itself names wrote it. Return one chapter1 entry for that page: decided (one sentence: what it says on who wrote the book), denies_authorship.`,
  cb: (f) => `${COMMON}
Your pages are StudyLight pages of the Companion Bible notes (E. W. Bullinger). Read the list in ${DIR}/${f} with the Read tool: each entry has the page url and its cites (cid, on, verse, pieces). Find every piece of every cite on the page url (the notes are short phrases keyed to words of each verse; the copy the pieces came from sometimes prints "=" where StudyLight prints a period or nothing, so report the page's own wording in first_words and last_words and describe any difference in remark). A cite is found when all its pieces are found, allowing only such punctuation differences. If the page will not load (WebFetch client error), wait with Bash sleep 60 and try once more; if it still fails, return not_read with a remark.`,
  ec: (f) => `${COMMON}
Your cites are in the Catena Aurea of Thomas Aquinas (Oxford translation, edited by John Henry Newman, 1841 to 1845). The app's copy of the Catena was transcribed from ecatholic2000.com, one page per Gospel chapter, so these cites are now read on those pages. Read the list in ${DIR}/${f} with the Read tool: each entry has the ecatholic2000 page url and its cites, each with "at" (the passage and the Father quoted), passage_title, pieces to find, note_evidence and note_text.
- On the page url, find the section for the passage (passage_title), and confirm each piece under the Father named in "at" (each Father's words open with his name in bold). found_at = the page url.
- The pages are long (often over 100,000 characters): if a piece is not in the first part, read on with the offset WebFetch gives.
- Say in remark the name as the page prints it before the quotation (for example "BEDE" or "PSEUDO-CHRYSOSTOM").
- If the page will not load, wait with Bash sleep 60 and try once more; if it still fails, return not_read with a remark.`,
  sp: (f) => `${COMMON}
Read the list in ${DIR}/${f} with the Read tool: six cites whose Bible Hub chapter page could not show the words (first_try says what happened). Find each one on a complete copy of the same work, as below, and give found_at = the page where you confirmed it. Make sure the page is the same commentary by the same writer (and for Matthew Henry, his complete commentary, not the Concise Commentary).
- Albert Barnes (cids c0473 Daniel 9:27, c0925 1 Corinthians 15:32, c0999 Hebrews 1:5): Bible Hub's chapter pages are too long and WebFetch cuts them off before these verses. BibliaPlus has Barnes verse by verse; this page works and has the Daniel quotation: https://www.bibliaplus.org/en/commentaries/4/albert-barnes-bible-commentary/daniel/9/27 . For the other two, use the same pattern with the book and verse (try the book slug "1-corinthians", then "1corinthians" or "i-corinthians"; and "hebrews"). If BibliaPlus fails for the New Testament ones, CCEL has Barnes's New Testament notes in chapter sections (open https://www.ccel.org/ccel/barnes/ntnotes.html and follow the contents to the chapter; for example Hebrews 1 may be https://ccel.org/ccel/barnes/ntnotes.xxii.i.viii.html).
- Matthew Henry (cids c0690 and c0695, Luke 1, the section on verses 5 to 25, his comment on verse 19 about the name Gabriel): read https://biblehub.com/commentaries/mhcw/luke/1.htm again and ask WebFetch directly for the sentences that mention Gabriel, using offsets to cover the whole page; if not there, try https://www.studylight.org/commentaries/eng/mhm/luke-1.html (Matthew Henry's complete commentary on StudyLight) with offsets.
- Jamieson, Fausset and Brown (cid c0318, Isaiah 1:1, "Isaiah--equivalent to 'The Lord shall save'"): try https://www.studylight.org/commentaries/eng/jfb/isaiah-1.html, then BibliaPlus's JFB (find its commentary id from https://www.bibliaplus.org/en/commentaries), then CCEL's JFB. Note that Bible Hub's JFB Isaiah 1 page lacked these words; if no copy has them, return not_found with a remark naming the pages tried.`,
}
const lanes = args.lanes
const out = await parallel(lanes.map((lane, li) => async () => {
  const res = []
  for (const [kind, f] of lane) {
    const r = await agent(PROMPT[kind](f), { label: `${kind} ${f}`, phase: 'Read', schema: OUT })
    res.push({ file: f, kind, result: r })
  }
  return res
}))
return out.filter(Boolean).flat()
