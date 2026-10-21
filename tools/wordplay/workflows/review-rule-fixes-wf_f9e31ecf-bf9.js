export const meta = {
  name: 'review-rule-fixes',
  description: 'Adversarially check the rewritten hard-passage views and Aramaic notes for accuracy, the citation rule and plain wording',
  phases: [{ title: 'Review' }],
}
const F = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/fixrule'
const FIND = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          where: { type: 'string', description: 'card id and view label, or Aramaic entry id' },
          problem: { type: 'string' },
          evidence: { type: 'string', description: 'the verse text or source that shows it, quoted' },
          fix: { type: 'string', description: 'exact replacement wording' },
          severity: { type: 'string', enum: ['must-fix', 'should-fix', 'nit'] },
        },
        required: ['file', 'where', 'problem', 'evidence', 'fix', 'severity'],
      },
    },
  },
  required: ['findings'],
}
const CONTEXT = `Context: Bible Atlas, a Bible study app. The owner's rule for anything it cites or explains: cite "bible believing people who fully believe the bible and theologians that love God", "not people who are liberalizing the bible to mean something else". Following that rule, we rewrote some explanations ("views") on hard-passage cards and some Aramaic word notes. The diffs are ${F}/hard.diff (config/hard-verses.json) and ${F}/aramaic.diff (config/aramaic.json); the full files are /home/claude/bibleatlas/config/hard-verses.json and /home/claude/bibleatlas/config/aramaic.json. Only review lines the diffs add (+). Bible text: the BSB is in /home/claude/bibleatlas/data/raw/bible_databases@e1b254cef8/formats/json/BSB.json (keys books[].name, chapters[].verses[].verse/text); read it with python3 -I. Limits: view text 300 characters, label 40. Style: plain English a newcomer understands, full sentences, no em-dashes. Do not edit any file; report findings only. Report nothing you are not sure of; an empty list is a fine answer.`
const lenses = [
  ['accuracy', 'Check every factual claim in the added lines against the Bible text and well-known facts: verse references say what the text claims, quotes match the BSB exactly, names and events are right (for example Abiathar at Nob, 2 Samuel 8:17, Kenites in 1 Samuel 15:6, Jonah in 2 Kings 14:25, Chrysostom on 1 Corinthians 15:29, the kings Matthew 1 skips, Keil and Delitzsch on Jeremiah 10:11). Also check each view\'s refs support what it says.'],
  ['rule-and-fairness', 'Check the added lines against the owner\'s rule: does any added sentence present Scripture as erring, as myth, or as meaning something other than what it says, or lean on a writer who does? Equally, does any rewrite overstate (claims something as certain or "widely held" that believing Christians actually differ on), misstate another believing view, or make a card\'s answer contradict its own views? Check each card\'s answer still matches its remaining views.'],
  ['plain-words', 'Check that each added line reads plainly for a newcomer, in full sentences, with no jargon left unexplained, within the length limits, and that it fits the card question it answers (read the card\'s question and other views in the full file).'],
]
const out = await parallel(lenses.map(([k, task]) => () => agent(`${CONTEXT}\n\nYour lens: ${task}`, { label: `review:${k}`, phase: 'Review', schema: FIND })))
return out.filter(Boolean).flatMap((r) => r.findings)
