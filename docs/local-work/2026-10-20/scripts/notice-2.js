export const meta = {
  name: 'bible-atlas-commentary-notice-2',
  description: 'Build the founder\'s commentary notice: the first time a reader opens any commentary, a big, plain two-page notice that it is people\'s words, not God\'s Word; design it, build it on its own branch, verify adversarially (levels, phone, accessibility, storage blocked), screenshot it; nothing pushed',
  phases: [
    { title: 'Design', detail: 'where it triggers, the words, the two pages, a mockup' },
    { title: 'Build', detail: 'one builder in worktree BibleAtlas-notice' },
    { title: 'Verify', detail: 'three adversaries, then a fix round' },
  ],
}
const REPO = 'C:\\Users\\shubh\\Projects\\BibleAtlas'
const WT = 'C:\\Users\\shubh\\Projects\\BibleAtlas-notice'
const SC = 'C:\\Users\\shubh\\AppData\\Local\\Temp\\claude\\C--Users-shubh-Projects--claude\\d3907c69-e0f0-457b-bec9-6a76569849b3\\scratchpad\\ba\\notice'
const HANDOFF = 'C:\\Users\\shubh\\Projects\\.claude\\BIBLE-ATLAS-HANDOFF.md'
const COMMON = `PROJECT: Bible Atlas (github.com/Sixteen1-6/BibleAtlas, live https://everyversemap.com/), a Preact and TypeScript site in web/ over a Rust data build. Read ${HANDOFF} sections 5 and 6 (how it works, the rules) and web/src/ui/extras/README.md. The worktree ${WT} (branch commentary-notice off origin/main) is yours; create it if missing with: git -C ${REPO} fetch -q origin; git -C ${REPO} worktree add -b commentary-notice ${WT} origin/main. A full local data build and the engine already exist in C:\\Users\\shubh\\Projects\\BibleAtlas-fixes: copy its web\\public\\data folder and web\\src\\engine\\atlas.wasm into the same places in ${WT}, and link web\\node_modules to BibleAtlas-fixes\\web\\node_modules with a directory junction (cmd /c mklink /J). Run the site with node node_modules\\vite\\bin\\vite.js --port <free port> --strictPort from ${WT}\\web (the first load can take 30 to 60 seconds on this busy PC); use Playwright (npx playwright, or install under ${SC}) for screenshots. Never push. Plain English, no em dashes, no emoji. Scratch files only under ${SC}.
THE FOUNDER'S REQUEST, in his words (2026-10-20): "the first time viewers look at commentary, any commentary, just give a disclaimer that it's a commentary and not God's word. Make this disclaimer very big and easy to understand and make sure they have to click like 2 pages, not just click okay once." Context: the app shows people's words about the Bible in several places: the Christian writers at Deep (web/src/ui/extras/voices/, which already has a one-click "Show what they wrote" opt-in remembered as atlas.voices), the study notes (web/src/ui/extras/notes*), the Layers of meaning notes (web/src/ui/Layers.tsx, drafted with AI help from cited writers, shown in the Links panel even at Simple), hard passages at Deep, the old Bible dictionaries, and the dating views on the "Written" line. Scripture itself (the BSB, NET, the original words, Ask the Bible's chains of verses, cross-references, themes) is not commentary and must never be gated.`

phase('Design')
const D = { type: 'object', properties: { specPath: { type: 'string' }, mockupPath: { type: 'string' }, surfaces: { type: 'array', items: { type: 'string' } }, words: { type: 'string' }, decisions: { type: 'array', items: { type: 'string' } } }, required: ['specPath', 'mockupPath', 'surfaces', 'words', 'decisions'] }
const design = { finishedInEarlierRun: true, resultsFile: 'C:\\Users\\shubh\\Projects\\bibleatlas-workfiles\\2026-10-20\\runs\\wf_d039351c-426.json', specPath: `${SC}\\NOTICE-SPEC.md`, mockupPath: `${SC}\\notice-mock.html`, founderRules: 'No AI wording anywhere in the notice or in any credit (founder decisions 13 and 15 in C:\\Users\\shubh\\Projects\\bibleatlas-workfiles\\2026-10-20\\voices\\FOUNDER-DECISIONS-2026-10-20.md).' }

phase('Build')
const B = { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, tests: { type: 'array', items: { type: 'string' } }, screenshots: { type: 'array', items: { type: 'string' } }, commit: { type: 'string' }, notes: { type: 'string' } }, required: ['files', 'tests', 'screenshots', 'commit', 'notes'] }
const build = await agent(`${COMMON}

You are the builder. Implement ${SC}\\NOTICE-SPEC.md exactly (mockup ${SC}\\notice-mock.html) in ${WT}. Keep it one small shared module for the notice plus the smallest possible hooks in each commentary surface; follow the extras README rules for shared files. Then: npx tsc --noEmit in web; run the site and take screenshots under ${SC}\\shots (first open of each commentary surface, both notice pages, after accepting, a second visit with no notice, storage blocked, Simple, Study and Deep, 1440 and 390 px, dark and light); check the browser console has no errors. Commit on branch commentary-notice with a plain subject about the visible effect, a short body, and "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Never push.

DESIGN: ${JSON.stringify(design)}`, { label: 'build', phase: 'Build', schema: B })

phase('Verify')
const V = { type: 'object', properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } } }, required: ['pass', 'findings'] }
const LENSES = [
  ['coverage', 'coverage and correctness: find any way to see commentary words without passing the notice (every surface, deep links such as #x=voices or #x=notes, shared links, the Layers card at every level, hover, search results, a second tab, cleared storage, blocked storage), and any place the notice wrongly gates Scripture'],
  ['access', 'accessibility and the founder\'s "very big and easy to understand": keyboard only, screen reader names and order, focus kept in the dialog and returned after, 200 percent zoom, 390 px phone, reduced motion, dark and light contrast, plain words a child can follow, exactly two pages that cannot be skipped by Escape or a click outside'],
  ['craft', 'craft and fit: the app\'s quiet look kept (tokens, fonts, no emoji, no em dashes), the BSB verse quoted exactly from the repository data, no regressions in the voices, notes, Layers, hard passages or dictionary panels, tsc clean, no console errors, and the commit touches only what it should'],
]
const vs = (await parallel(LENSES.map(([k, lens]) => () => agent(`${COMMON}\n\nYou are an adversary for the commentary notice built in ${WT} (spec ${SC}\\NOTICE-SPEC.md; builder report below). Run the site yourself and try to break it through one lens: ${lens}. Do not edit. pass = true only with no blocker or major.\n\nBUILD: ${JSON.stringify(build)}`, { label: `verify:${k}`, phase: 'Verify', schema: V })))).filter(Boolean)
let fix = null
if (vs.some(v => !v.pass)) {
  fix = await agent(`${COMMON}\n\nFix every blocker and major below in ${WT}, re-run tsc and the screenshots, and commit the fix as a new commit with the same Co-Authored-By line. Never push.\n\nFINDINGS: ${JSON.stringify(vs.flatMap(v => v.findings))}`, { label: 'fix', phase: 'Verify', schema: B })
}
return { design, build, verify: vs, fix }
