export const meta = {
  name: 'contrast-sweep',
  description: 'Sweep the Bible stories for characters set side by side (Hannah and Eli, David and Saul) that Bible-believing writers state, with an anchor verse and verbatim quotes',
  phases: [{ title: 'Sweep', detail: 'one agent per book or chapter range' }],
}
const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
const C = `${W}/r3/contrast_chunks.json`
const SPANS = [
  ['Genesis', 1, 25], ['Genesis', 26, 50], ['Exodus', 1, 40], ['Numbers', 1, 36], ['Joshua', 1, 24], ['Judges', 1, 21], ['Ruth', 1, 4],
  ['1 Samuel', 1, 15], ['1 Samuel', 16, 31], ['2 Samuel', 1, 24], ['1 Kings', 1, 22], ['2 Kings', 1, 25], ['2 Chronicles', 1, 36],
  ['Esther', 1, 10], ['Daniel', 1, 12], ['Jonah', 1, 4], ['Matthew', 1, 14], ['Matthew', 15, 28], ['Mark', 1, 16], ['Luke', 1, 12],
  ['Luke', 13, 24], ['John', 1, 11], ['John', 12, 21], ['Acts', 1, 14], ['Acts', 15, 28], ['Job, Proverbs, the Prophets and Psalms', 0, 0],
  ['Romans to Revelation', 0, 0],
]
const FOUND = {
  type: 'object',
  properties: {
    contrasts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          anchor: { type: 'string', description: 'the verse where the passage sets the two side by side, e.g. "1 Samuel 2:21"' },
          other: { type: 'string', description: 'the other person\'s key verse, e.g. "1 Samuel 2:22"' },
          people: { type: 'string', description: 'who is set against whom, e.g. "Samuel and Eli\'s sons"' },
          what: { type: 'string', description: 'one line: what the contrast shows' },
          writers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'id on the cite list' },
                on: { type: 'string' },
                url: { type: 'string', description: 'local tool and verse, or the web page' },
                quote: { type: 'string', description: 'verbatim, the writer stating the contrast in his own voice' },
              },
              required: ['source', 'on', 'url', 'quote'],
            },
          },
        },
        required: ['anchor', 'other', 'people', 'what', 'writers'],
      },
    },
    searched: { type: 'string' },
  },
  required: ['contrasts', 'searched'],
}
const out = await pipeline((args && args.only) ? args.only.map((i) => SPANS[i]) : SPANS, (s) => {
  const span = s[1] ? `${s[0]} ${s[1]} to ${s[2]}` : s[0]
  return agent(`You are finding material for Bible Atlas, a Bible study app whose Deep level will show "contrast" notes: places where a Bible story sets two people (or groups) side by side so the reader weighs their choices, such as Hannah and Eli (1 Samuel 1), Samuel growing up beside Eli's sons (1 Samuel 2), David and Saul, Ruth and Orpah, Abigail and Nabal, Mary and Martha, the Pharisee and the tax collector, Barnabas and Ananias. The app owner asked for every example a Bible-believing writer states, not only these.

Your span: ${span}.

Find every such contrast in your span that at least one writer on the app's cite list states in his own voice: the writer himself says the two are set in contrast, placed side by side, opposed or compared to show their different hearts or choices. A writer merely telling both stories, or one cross-reference, does not count. Think through the stories in your span (read them with vw.py), then search the writers for each likely pair: the local works with cq.py (Gill, Clarke, Barnes, Jamieson-Fausset-Brown, Keil and Delitzsch, Henry's Concise, Wesley, Bullinger's Companion Bible), the study notes with osn.py, the Catena with cat.py for the Gospels, and Bible Hub's Matthew Henry (mhcw), Ellicott, Pulpit, Benson and Poole chapter pages (WebFetch https://biblehub.com/commentaries/<code>/<book>/<chapter>.htm). A script also gathered remarks using the word "contrast" in your books; they are only hints (most are not about people): python3 -I -c "import json; [print(json.dumps(c, ensure_ascii=False)) for c in json.load(open('${C}')) if c['book'] in '${s[0]}']" | head -c 60000

The owner's rule: cite only Bible-believing writers and theologians who love God; Christian writers only; never rabbis or Jewish scholars; a source must be on the "cite" list in ${LW}/config/layer-sources.json and not on its "avoid" list (Bible Hub also shows the Cambridge Bible, the Expositor's and Meyer: never use them). The Pulpit Commentary may not be cited on Jeremiah or Lamentations.

Tools (python3 -I): ${W}/vw.py "<ref>" prints the BSB verse; ${W}/cq.py all "<ref>" prints each local commentary on a verse (cut at 2500 characters), "cq.py <work> <ref>" one in full (works gill, clarke, barnes, jfb, kad, mhcc, wesley, cb; cite ids keil-delitzsch for kad, henry-concise for mhcc, bullinger-cb for cb); ${W}/osn.py "<ref>" prints the study notes (cite id tyndale-notes); ${W}/cat.py "<ref>" the Catena Aurea (cite id catena-aurea). Bible Hub cite ids: henry (mhcw), ellicott, pulpit, benson, poole. Check local quotes with "cq.py check <work> <ref> <quote>", "osn.py check" or "cat.py check".

For each contrast give the anchor verse (where the text sets them side by side), the other person's key verse, who and what, and every writer you found stating it, each with a verbatim quote copied from the tool output or page (20 to 350 characters) and where you read it. Return a contrast with one writer too; a later stage looks for more. In "searched", list the pairs you checked and found no writer for.`, { label: `sweep:${span}`, phase: 'Sweep', schema: FOUND })
})
return out.filter(Boolean).flatMap((r) => r.contrasts)
