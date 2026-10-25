export const meta = {
  name: 'r3-cb-scan',
  description: 'Read four Companion Bible notes in the Internet Archive scan, where StudyLight refuses the reader',
  phases: [{ title: 'Read' }],
}
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
          time: { type: 'string' },
          parts: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
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
const P = `You are reading scanned pages to make "reads" records for the Bible Atlas project's Layers notes: each record says a cited writer's words were read on the exact page the citation links to, at a UTC time, and gives the words as the page prints them.
Read ${args.file} with the Read tool: four cites of E. W. Bullinger's Companion Bible notes (on Matthew 1:23, Matthew 24:21, Hebrews 1:5 and Hebrews 1:6). Their StudyLight pages refuse WebFetch (client errors on www.studylight.org and studylight.org alike), so read them in the Internet Archive's scan of the Companion Bible instead. The project already links that scan, for example https://archive.org/details/CompanionBibleOT/Companion%20Bible%20NT/page/n429/mode/1up (item CompanionBibleOT, file "Companion Bible NT").
- Use WebFetch only (load it with ToolSearch "select:WebFetch"); never curl. Open https://archive.org/metadata/CompanionBibleOT to find the NT file's name, the server (d1 or server) and dir. Then search its text with the search-inside service: https://HOST/fulltext/inside.php?item_id=CompanionBibleOT&doc=DOC&path=DIR&q=%22PHRASE%22 , where DOC is the NT file's name without its extension (URL-encoded) and PHRASE is 3 to 6 distinctive words of a piece, URL-encoded (spaces %20, quote marks %22). If that form fails, try the other files' names, or doc= the base name of the file's _djvu.txt or _chocr.html.gz derivative.
- A match gives "page" (the scan leaf) and a snippet. Confirm every piece's words in the snippets (the OCR may have small errors; say which in remark), and copy the matching words into parts, in parts of at most 100 characters, as the snippet prints them.
- The page view link: check how the leaf maps to the reader's n index on this file using the project's own link above: search a phrase from the page it links (n429) if you can tell what is on it, or check against the file's _page_numbers.json if it exists; otherwise give found_at as https://archive.org/details/CompanionBibleOT/Companion%20Bible%20NT/page/n{page-1}/mode/1up and say in remark that the off-by-one was not checked.
- Right after each WebFetch call that confirms anything, run in Bash: date -u +%Y-%m-%dT%H:%M:%SZ and give that as "time".
- verdict under the founder's decision 20: "respects" unless the note itself calls the Bible text mistaken or denies what it says.
Write plain English with no em dashes.`
const r = await agent(P, { label: 'cb scan', phase: 'Read', schema: OUT })
return [r]
