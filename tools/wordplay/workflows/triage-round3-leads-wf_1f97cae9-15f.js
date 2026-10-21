export const meta = {
  name: 'triage-round3-leads',
  description: 'Sort mined commentary leads into real candidate plays on words, significant name meanings and Scripture allusions, and noise',
  phases: [{ title: 'Triage', detail: 'one agent per 40 leads' }],
}
const F = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/r3/tri.json'
const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const OUT = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          keep: { type: 'boolean' },
          what: { type: 'string', description: 'with keep: one line naming the play, the name and its meaning, or the passage alluded to' },
          why: { type: 'string', description: 'with drop: a few words' },
        },
        required: ['id', 'keep'],
      },
    },
  },
  required: ['results'],
}
const chunks = Array.from({ length: args.count }, (_, k) => k)
const out = await pipeline(chunks, (k) => agent(`You are sorting leads for Bible Atlas, a Bible study app that shows cited notes on plays on words, name meanings and allusions in each verse. A script searched Bible-believing commentaries (Gill, Clarke, Barnes, Jamieson-Fausset-Brown, Keil and Delitzsch, Henry, Wesley, Bullinger's Companion Bible and Figures of Speech, and the Tyndale-based study notes) for marker words, and kept each verse where two or more of them used a marker. Most leads are noise. Print yours: python3 -I -c "import json; print(json.dumps(json.load(open('${F}'))[${k}], ensure_ascii=False, indent=1))"

For each lead decide keep or drop. Keep when the snippets plausibly show a writer stating, about THIS verse:
- wordplay: a play on words, sound play, pun or repeated root in the Hebrew or Greek of this verse;
- name meaning: the meaning of a person's or place's name where the meaning matters to the verse (the name is given, changed or explained for its meaning, or the passage plays on it, or the writer draws a lesson from it). Drop bare glosses of ordinary words (Elohim means strong, a word "signifies" something), place-name etymologies with no bearing on the verse, and names whose meaning the writers call unknown;
- allusion: this verse quotes, alludes to, echoes or borrows from the other passage of Scripture named in "target" (the writer says so, not just "see" or "compare"). Drop allusions to customs, history or other books, and cases where the target is only a cross-reference list.
Drop noise: "equivocate" meaning to deceive, "sound like" thunder, "the name of the Lord", a marker inside a remark about a different verse, and similar. When the snippet is cut too short to judge, you may open the commentary with python3 -I ${W}/cq.py all "<ref>" (osn.py "<ref>" for the study notes). When still unsure, keep: a later writer will check it fully. Return one result for every id.`, { label: `triage:${k}`, phase: 'Triage', schema: OUT }))
return out.filter(Boolean).flatMap((r) => r.results)
