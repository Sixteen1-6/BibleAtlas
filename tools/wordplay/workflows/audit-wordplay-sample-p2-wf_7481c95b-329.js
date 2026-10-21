export const meta = {
  name: 'audit-wordplay-sample-p2',
  description: 'Fresh-eyes audit of a random sample of the Isaiah to Revelation cited wordplay notes, to estimate their error rate before hand-off',
  phases: [{ title: 'Audit', detail: 'four independent auditors, 15 notes each' }],
}
const W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          layer: { type: 'integer' },
          verdict: { type: 'string', enum: ['sound', 'minor', 'wrong'] },
          problem: { type: 'string', description: 'empty when sound; otherwise exactly what is wrong, with the evidence' },
          fix: { type: 'string', description: 'corrected text or field, when minor or wrong' },
        },
        required: ['passage', 'layer', 'verdict', 'problem'],
      },
    },
  },
  required: ['results'],
}
const res = await parallel([0, 1, 2, 3].map((k) => () => agent(`You are auditing notes written for Bible Atlas, a Bible study app, before they go live without further human review. Each note explains a play on words, a name meaning or an allusion in one verse, and cites Bible-believing commentaries.

Print your 15 notes: python3 -I -c "import json; print(json.dumps(json.load(open('${W}/audit_p2.json'))[${k}], ensure_ascii=False, indent=1))"

Tools (python3 -I): ${W}/vw.py "<ref>" prints the BSB verse with Hebrew/Greek words and Strong's keys; ${W}/cq.py all "<ref>" prints Gill, Clarke, Barnes, JFB, Keil and Delitzsch (kad, Old Testament only), Henry's Concise (mhcc), Wesley, the Companion Bible (cb) and Bullinger's Figures of Speech (fos) on that verse; "cq.py <work> <ref>" prints one in full. Cite source ids map: keil-delitzsch=kad, henry-concise=mhcc, bullinger-cb=cb, bullinger-fos=fos. Do not use the web.

For each note, judge with fresh eyes:
1. Is every factual claim in its text true: the Hebrew or Greek words and their sounds, the meanings, which verses use them, and what the other verse says? Check with vw.py.
2. Does at least one cited commentary really state this same play, name meaning or allusion on the verse given in its "on"? Read it in cq.py.
3. Is the strength honest (widely agreed needs three or more different writers stating it, commonly held two; Bullinger's two works are one writer), and is the text plain, accurate English a newcomer understands, with no overclaiming?
4. The app's rules: Greek wording is said to be in that writer's Greek ("in John's Greek"), never as what Jesus said in Greek; an Aramaic reading is called a reconstruction unless the text itself keeps the Aramaic; source names go in "evidence", never in "text"; text is at most 300 characters.
Verdict: sound; minor (a small wording or strength fix, give it); wrong (a false claim or a citation that does not support it). When unsure whether a claim is true, mark it and say why.`, { label: `audit:p2-${k}`, phase: 'Audit', schema: SCHEMA })))
return res.filter(Boolean).flatMap((r) => r.results)
