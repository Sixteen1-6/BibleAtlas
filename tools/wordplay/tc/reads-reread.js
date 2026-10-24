export const meta = {
  name: 'r3-reads-reread',
  description: 'Re-read each page that round 3 Layers cites link to, confirm the quotation there and record the read time, for the reads evidence',
  phases: [{ title: 'Read' }],
}
const DIR = args.dir
const COMMON = `
You are re-reading web pages to make "reads" records for the Bible Atlas project's Layers notes. Each record says a cited writer's words were read on the exact page the citation links to, on a date and at a UTC time. Every quotation below was already found word for word in another copy of the same public-domain work; your job is to confirm it on the linked page itself.

How to read:
- Use WebFetch (load it with ToolSearch "select:WebFetch" if needed). Make one call per page that asks about all of that page's quotations at once. WebFetch's reader can copy only about 125 characters word for word per answer, so ask it, for each numbered quotation, to answer FOUND or NOT FOUND (the same words in the same order; spacing, straight versus curly quote marks, hyphenation and the way Bible references are printed do not matter), and to copy the FIRST 8 WORDS and the LAST 5 WORDS of the matching text exactly as the page has them.
- If WebFetch says the page is longer than it read and gives an offset, and some quotation is not yet found, call again with that offset for the quotations still missing. Repeat until all are found or the page ends.
- Right after each WebFetch call that confirms anything, run in Bash: date -u +%Y-%m-%dT%H:%M:%SZ and give that as "time" for the cites that call confirmed.
- WebFetch is limited to about 400 calls an hour shared by every agent. Do not repeat a call that already answered. If WebFetch reports a rate limit or fails three times in a row, stop and return the cites not yet read with status "not_read".
- Never use curl or any other tool to reach these sites; only WebFetch.
For every cite also give a verdict, under the founder's decision 20 (judge the cited comment on its own words): "respects", unless the cited comment itself calls the Bible text mistaken, a legend or myth, a later invention, or denies what the text says; then "denies", with up to 20 of its words in verdict_words.
A cite with never_quote true (the Pulpit Commentary, the NET notes, the Reformation Study Bible): never copy its words into your answer, not even the first words; still say FOUND or NOT FOUND, and write "pointer": where on the page the point is made, in your own plain words, for example "the comment on verse 12, which ties the robbers' boast to the earth swallowing Korah's rebels (Numbers 16:30-33)". Ask WebFetch for a short description, not a copy, for these.
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
          remark: { type: 'string', description: 'anything odd: differences in wording, a different verse, OCR errors' },
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
- If a cite is NOT FOUND on the chapter page after reading the whole page, try its verse_page once (a page that gathers every commentary on that verse); if found there, give found_at = that verse_page.
- If the page url ends in /1.htm (chapter 1 of a book), also ask WebFetch what the introduction at the top of the page says about who wrote the book, and whether it denies that the writer the book itself names wrote it. Return one chapter1 entry for that page: decided (one sentence: what it says on who wrote the book), denies_authorship.`,
  cb: (f) => `${COMMON}
Your pages are StudyLight pages of the Companion Bible notes (E. W. Bullinger). Read the list in ${DIR}/${f} with the Read tool: each entry has the page url and its cites (cid, on, verse, pieces). Find every piece of every cite on the page url (the notes are short phrases keyed to words of each verse). A cite is found when all its pieces are found. If the page will not load or the notes are not on it, return not_found with a remark saying what the page showed.`,
  catena: (f) => `${COMMON}
Your cites are in the Catena Aurea of Thomas Aquinas (Oxford translation, edited by John Henry Newman, 1841 to 1845). Read the list in ${DIR}/${f} with the Read tool: entries by Gospel, each cite with "at" (the passage and the Father quoted), pieces to find, and note_evidence and note_text.
- The translation is on CCEL: Matthew https://www.ccel.org/ccel/aquinas/catena1.html, Mark https://www.ccel.org/ccel/aquinas/catena2.html, Luke https://www.ccel.org/ccel/aquinas/catena3.html, John https://www.ccel.org/ccel/aquinas/catena4.html. Open the volume's contents page, find the section for the passage named in "at" (for example "Mark 12:18-27"), open that section page, and confirm each piece under the Father named in "at". found_at = the section page's url (a page for that passage, never the volume's contents page).
- Two cites have no pieces (cid c0687, Bede on Mark 12:18-27, and cid c0755, Augustine on John 10:31-38): find on the section page the sentence of that Father that states what note_evidence says he says, and return its first 8 and last 5 words; if no sentence of his states it, return not_found with a remark.
- If CCEL will not load, return not_found with a remark.`,
  fos: (f) => `${COMMON}
Your cites are in E. W. Bullinger, Figures of Speech Used in the Bible (1898). Read the list in ${DIR}/${f} with the Read tool: each cite has "at" (the figure's section), on, and pieces.
The scan is the Internet Archive item figuresofspeechu00bull. Its OCR text can be searched with the Internet Archive's search-inside service, which returns each match's text and its scan page index:
https://ia600409.us.archive.org/fulltext/inside.php?item_id=figuresofspeechu00bull&doc=figuresofspeechu00bull&path=/13/items/figuresofspeechu00bull&q=%22Gnome%22
(replace the q value with a phrase in double quotes, URL-encoded: spaces as %20, quote marks as %22).
- For each cite, search a distinctive phrase of 3 to 6 words from one of its pieces (the OCR has errors, so if there is no match try another phrase). A match gives "page" (the scan page index) and a text snippet. Confirm that the snippets of the matches you find agree with the pieces, searching more phrases as needed, so that every piece is confirmed on the same scan page or the next one.
- The page view of a scan page is https://archive.org/details/figuresofspeechu00bull/page/n{page}/mode/1up. Check once whether the service's "page" is the same index as the page view's n: Layers already cites Genesis 4:9 under Anthropopatheia at https://archive.org/details/figuresofspeechu00bull/page/n930/mode/1up, so search "Gen. iv. 9" or a phrase of that example and see whether it comes back as page 930 or 931. Then give found_at = the page view link of the scan page where the cite's words are, and in remark the printed page number if a snippet shows it, and the search-inside URL you used.
- "time" is the UTC time right after the search that confirmed the cite.`,
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
