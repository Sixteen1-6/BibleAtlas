export const meta = {
  name: 'r3-cb-words',
  description: 'Copy each round 3 Companion Bible note word for word from its StudyLight page, and read three cut-off cites on complete copies',
  phases: [{ title: 'Read' }],
}
const DIR = args.dir
const RDIR = args.rdir
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
const PROMPT = {
  cb: (f) => `${COMMON}
Your pages are StudyLight pages of E. W. Bullinger's Companion Bible notes. Read the list in ${DIR}/${f} with the Read tool: each entry has a page url and its cites (cid, on, verse, pieces).
The pieces were taken from a copy that garbled some characters: it printed a period where the book has "=" or the word "a" or "A" (for example "Elkanah . Acquired by God" where StudyLight has "Elkanah = Acquired by God", "acquired as. possession" for "acquired as a possession", "for El,. king" for "for El, a king", "occurs only here.. paraphrase" for "occurs only here. A paraphrase"). Your job is to give the page's own wording of each piece, exactly.
- For each page, make one WebFetch call: number each piece and ask WebFetch to copy, character for character, the page's text that corresponds to it, from the same first word to the same last word, in consecutive parts of at most 100 characters each, cut between words, with nothing left out or added between the parts and no paraphrase; tell it that it may copy at most 100 characters per part but as many parts as needed. Ask it to keep "=" signs, punctuation and capital letters exactly as on the page. If the answer leaves a piece out, summarizes it, or skips words between parts, ask again in a second call for just that piece. A cite is found when every piece is found on the page.
- Put the parts in "parts" exactly as WebFetch gave them (do not correct them yourself), and also give first_words and last_words (the page's first 8 and last 5 words of the first and last piece).
- StudyLight sometimes refuses WebFetch with a client error. Between your WebFetch calls run Bash: sleep 20. After a client error, run Bash: sleep 300 and try that page again; after a second client error on the same page, sleep 600 and try once more; if it still fails, mark its cites not_read with a remark and go on to the next page (do not give up on the other pages).`,
  sp: (f) => `${COMMON}
Read the list in ${RDIR}/${f} with the Read tool: three cites whose Bible Hub pages were cut off before the words (first_try says what happened). Ask WebFetch, for each piece, FOUND or NOT FOUND and the first 8 and last 5 words of the matching text exactly as the page has them (WebFetch's reader copies only about 125 characters word for word per answer). Give found_at = the page where you confirmed it, and make sure it is the same commentary by the same writer.
- Albert Barnes on Job 1:1 (c0213): BibliaPlus has Barnes verse by verse, for example https://www.bibliaplus.org/en/commentaries/4/albert-barnes-bible-commentary/daniel/9/27 ; use the same pattern for job/1/1.
- Keil and Delitzsch on Daniel 9:25 (c0470) and 9:27 (c0479), written by C. F. Keil: find a verse-by-verse copy, for example on BibliaPlus (look up its commentary id for Keil and Delitzsch from https://www.bibliaplus.org/en/commentaries ), or StudyLight's Keil and Delitzsch (https://www.studylight.org/commentaries/eng/kdo/daniel-9.html, reading on with offsets). If a page is long, read on with the offset WebFetch gives. If no complete copy has the words, return not_found with a remark naming the pages tried.`,
}
const lanes = args.lanes
const out = await parallel(lanes.map((lane) => async () => {
  const res = []
  for (const [kind, f] of lane) {
    const r = await agent(PROMPT[kind](f), { label: `${kind} ${f}`, phase: 'Read', schema: OUT })
    res.push({ file: f, kind, result: r })
  }
  return res
}))
return out.filter(Boolean).flat()
