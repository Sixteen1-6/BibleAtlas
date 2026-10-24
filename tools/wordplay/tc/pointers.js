export const meta = {
  name: 'r3-pointers',
  description: 'Write pointers (where on the page, in other words) for Pulpit, NET and Reformation Study Bible cites, which are never quoted',
  phases: [{ title: 'Write' }, { title: 'Check' }],
}
const OUT = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { cid: { type: 'string' }, pointer: { type: 'string' } }, required: ['cid', 'pointer'] } } }, required: ['items'] }
const RULE = `The Bible Atlas project never quotes the Pulpit Commentary, the NET Bible notes or the Reformation Study Bible (copyrighted text as the sites carry it). For each cite, a "pointer" says where on the page the cited point is made, in your own plain words: which verse's comment, and what it says, briefly. Example: "the comment on verse 12, which ties the robbers' boast of swallowing their victims alive to the earth swallowing Korah's rebels (Numbers 16:30-33)". Rules: at most 200 characters; never five or more words in a row from quote_seen (the words as the page has them; common Bible names and references are fine); no quotation marks around its words; plain English, no em dashes; say only what quote_seen shows, nothing more. quote_seen is what was read on the page; note_text is the note it supports.`
const files = args.files
const r = await pipeline(files,
  f => agent(`${RULE}\nRead the items in ${args.dir}/${f} with the Read tool and write a pointer for each.`, { label: `write ${f}`, phase: 'Write', schema: OUT }),
  (w, f) => w && agent(`${RULE}\nThe items are in ${args.dir}/${f}. Proposed pointers:\n${JSON.stringify(w.items, null, 1)}\nCheck each against its item: fix any pointer that repeats five or more words in a row of quote_seen (check it word by word; you may use python3 in Bash), says more than quote_seen shows, names the wrong verse, or is over 200 characters. Return every pointer, fixed or as it was.`, { label: `check ${f}`, phase: 'Check', schema: OUT }))
return r.filter(Boolean).flatMap(x => x.items)
