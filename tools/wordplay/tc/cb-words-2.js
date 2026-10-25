export const meta = {
  name: 'r3-cb-words-2',
  description: 'Copy the last 15 round 3 Companion Bible notes word for word from StudyLight (address without www), and find Keil on Daniel 9:27 in a complete copy',
  phases: [{ title: 'Read' }],
}
const DIR = args.dir
const COMMON = `
You are reading web pages to make "reads" records for the Bible Atlas project's Layers notes. Each record says a cited writer's words were read on the exact page the citation links to, at a UTC time, and gives the writer's words as that page prints them.
Use WebFetch (load it with ToolSearch "select:WebFetch" if needed). Never use curl or any other tool to reach these sites.
- Right after each WebFetch call that confirms anything, run in Bash: date -u +%Y-%m-%dT%H:%M:%SZ and give that as "time" for the cites that call confirmed.
- WebFetch is limited to about 400 calls an hour shared by every agent. Do not repeat a call that already answered.
For every cite also give a verdict, under the founder's decision 20 (judge the cited comment on its own words): "respects", unless the cited comment itself calls the Bible text mistaken, a legend or myth, a later invention, or denies what the text says; then "denies", with up to 20 of its words in verdict_words.
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
          found_at: { type: 'string' },
          time: { type: 'string', description: 'YYYY-MM-DDTHH:MM:SSZ from date -u right after the read' },
          parts: { type: 'array', description: 'one entry per piece, in order: the parts WebFetch copied, in order', items: { type: 'array', items: { type: 'string' } } },
          first_words: { type: 'string' },
          last_words: { type: 'string' },
          verdict: { type: 'string', enum: ['respects', 'denies'] },
          verdict_words: { type: 'string' },
          remark: { type: 'string' },
        },
        required: ['cid', 'status'],
      },
    },
  },
  required: ['cites'],
}
const CB = (f) => `${COMMON}
Your pages are StudyLight pages of E. W. Bullinger's Companion Bible notes. Read the list in ${DIR}/${f} with the Read tool: each entry has a page url and its cites (cid, on, verse, pieces). The urls use studylight.org without "www": the www address refuses WebFetch for these pages, but this one loads. Use the url exactly as given.
The pieces were taken from a copy that garbled some characters: it printed a period where the book has "=" or the word "a" or "A" (for example "Elkanah . Acquired by God" where StudyLight has "Elkanah = Acquired by God", "acquired as. possession" for "acquired as a possession"), and it abbreviates Bible books. Your job is to give the page's own wording of each piece, exactly.
- For each page, make one WebFetch call: number each piece and ask WebFetch to copy, character for character, the page's text that corresponds to it, from the same first word to the same last word, in consecutive parts of at most 100 characters each, cut between words, with nothing left out or added between the parts and no paraphrase; tell it that it may copy at most 100 characters per part but as many parts as needed. Ask it to keep "=" signs, punctuation and capital letters exactly as on the page. Where a piece itself has "..." (words it leaves out), copy each side separately and put a part "..." between them. If the answer leaves a piece out, summarizes it, or skips words between parts, ask again in a second call for just that piece. A cite is found when every piece is found on the page.
- Put the parts in "parts" exactly as WebFetch gave them (do not correct them yourself), and also give first_words and last_words. found_at = the url as given.
- Between your WebFetch calls run Bash: sleep 15. After a client error, run Bash: sleep 120 and try that page once more; if it still fails, mark its cites not_read with a remark and go on to the next page.`
const KD = `${COMMON}
Read ${DIR}/kd.json with the Read tool: one cite of Keil and Delitzsch (C. F. Keil wrote the Daniel volume) on Daniel 9:27, whose words could not be read because Bible Hub, StudyLight and BibliaPlus pages are cut off by WebFetch at about 100,000 to 115,000 characters before them (first_try lists what was tried).
Find the words in a complete copy a reader can open:
- The Internet Archive has scans of the English translation (C. F. Keil, Biblical Commentary on the Book of Daniel, T. and T. Clark, 1872, and later printings). Find an item with the advanced search, for example https://archive.org/advancedsearch.php?q=creator%3A%28Keil%29+AND+title%3A%28Daniel%29&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=date&rows=50&output=json , then search its text with the search-inside service: https://ia800000.us.archive.org/fulltext/inside.php?item_id=ITEM&doc=ITEM&path=/PATH&q=%22irrevocably%20concluded%22 (the service's host and path come from https://archive.org/metadata/ITEM : use its "server" as the host and its "dir" as the path). A match gives the scan page index ("page"); its page view is https://archive.org/details/ITEM/page/n{page-1}/mode/1up (check this off-by-one on one match by opening the page view if needed).
- Confirm the piece there (the OCR may have small errors and print the Hebrew badly; say so in remark), give found_at = that page view link, and in remark the item id, its title and date, and the search-inside url you used.
- If no copy has the words, return not_found with a remark naming the pages tried.`
const out = await parallel([
  async () => [await agent(CB('cb_00.json'), { label: 'cb cb_00', phase: 'Read', schema: OUT })],
  async () => [await agent(CB('cb_01.json'), { label: 'cb cb_01', phase: 'Read', schema: OUT }), await agent(KD, { label: 'kd daniel 9:27', phase: 'Read', schema: OUT })],
])
return out.filter(Boolean).flat()
