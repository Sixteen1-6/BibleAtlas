export const meta = {
  name: 'held-reads-retry',
  description: 'Read again the held passages\u2019 cites the first reads could not confirm: Bullinger scans, Calvin and Barnes cut-off pages, NET notes, the Catena on Luke and John',
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
A cite with never_quote true (the Pulpit Commentary, the NET notes, the Reformation Study Bible, and any copyrighted modern work): never copy its words into your answer, not even the first words; still say FOUND or NOT FOUND, and write "pointer": where on the page the point is made, in your own plain words, for example "the comment on verse 12, which ties the robbers' boast to the earth swallowing Korah's rebels (Numbers 16:30-33)". Ask WebFetch for a short description, not a copy, for these.
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

const FOS = (f) => `${COMMON}
Your cites are in E. W. Bullinger, Figures of Speech Used in the Bible (1898), the Internet Archive scan figuresofspeechu00bull. Read the list in ${DIR}/${f} with the Read tool: each cite has "at" (the figure's section), on, pieces, and first_try (what failed before).
An hour ago the search-inside service failed on most queries with an IncompleteRead error; it answered some. Two ways to read the scan:
1. Search inside: https://ia600409.us.archive.org/fulltext/inside.php?item_id=figuresofspeechu00bull&doc=figuresofspeechu00bull&path=/13/items/figuresofspeechu00bull&q=%22PHRASE%22 (PHRASE: 3 to 6 rare words of a piece, URL-encoded; if ia600409 fails, try ia800409). A match gives "page" (the scan page index) and a snippet. If a query fails, run Bash: sleep 30, and try one other phrase; after three failures in a row, use way 2 for the rest.
2. A page's own text: https://ia600409.us.archive.org/BookReader/BookReaderGetTextWrapper.php?path=%2F13%2Fitems%2Ffiguresofspeechu00bull%2Ffiguresofspeechu00bull_djvu.xml&mode=djvu_xml&page=N , where N is the scan page index (if the path is refused, open https://archive.org/metadata/figuresofspeechu00bull/files once to find the _djvu.xml file's name). The printed page number is N less 54 (checked: Romans 5:19 under Paregmenon is index 359, printed 305; Romans 9:18 under Paronomasia is index 373, printed 319; Romans 11:33 under Homoeopropheron is index 229, printed 175). To find a figure's pages, read the book's contents pages (indexes about 10 to 40) once and note the printed page where each of your figures begins, then read forward from that page's index until you reach the verse's example.
- Confirm every piece of a cite on one scan page or the next (OCR errors in Greek and Hebrew letters are expected; say which in remark). found_at = https://archive.org/details/figuresofspeechu00bull/page/n{N}/mode/1up with N the index where the words are; put "index N" and the printed page in remark.
- "time" is the UTC time right after the fetch that confirmed the cite. Fetch as few pages as you can: the WebFetch budget is shared.`
const OTHER = `${COMMON}
Read ${DIR}/other.json with the Read tool: eight cites whose first read failed (first_try says how). For each, read the words on a page a reader can open, and give that page as found_at:
- calvin on Ezekiel 16:53 and 20:38, and on Zechariah 1:17: the Bible Hub chapter pages are cut off by WebFetch (or, for Zechariah 1:17, Bible Hub's lecture stops and goes on in the next lecture). Read them on CCEL, which has Calvin's commentaries in the same translation (Calvin Translation Society): the Ezekiel volumes and the Zechariah volume are among https://ccel.org/ccel/calvin/calcom22 to https://ccel.org/ccel/calvin/calcom30 ; open the volume's contents, find the lecture on that verse, and confirm the pieces there. found_at = that CCEL section page.
- barnes on Romans 5:19: the Bible Hub chapter page is cut off and the verse page breaks off at "continued". Read it on StudyLight's Barnes' Notes (https://www.studylight.org/commentaries/eng/bnb/romans-5.html , or without www) or on another complete copy of Barnes' Notes on Romans 5:19 a reader can open; found_at = that page.
- net-notes on Isaiah 34:14 and Hebrews 1:1: classic.net.bible.org refused the reader twice. Run Bash: sleep 60, then try the same url once more; if it still fails, try https://netbible.org/bible/Isaiah+34 (or Hebrews+1) once. These notes are never quoted: give a pointer. If neither loads, return not_read.
- catena-aurea on Luke 10:18 and John 19:29: CCEL has only Matthew and Mark. The project reads Luke and John on ecatholic2000.com, one page per section of the Gospel, for example https://www.ecatholic2000.com/catena/untitled-72.shtml (Luke 11:14-16) and https://www.ecatholic2000.com/catena/untitled-98.shtml (John 10:31-38); find the section page for the passage in "at" (try nearby numbers), and confirm each piece under the Father named in "at". found_at = that page.`
const lanes = args.lanes
const out = await parallel(lanes.map(lane => async () => {
  const res = []
  for (const f of lane) {
    const r = await agent(f === 'other.json' ? OTHER : FOS(f), { label: `retry ${f}`, phase: 'Read', schema: OUT })
    res.push({ file: f, result: r })
  }
  return res
}))
return out.filter(Boolean).flat()
