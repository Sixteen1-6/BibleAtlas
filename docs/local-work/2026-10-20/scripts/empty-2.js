export const meta = {
  name: 'bible-atlas-no-empty-selections-2',
  description: 'Find and fix every place in Bible Atlas where a reader can click something that opens empty (first the Christian writers panel the founder hit), by checking every verse against the data and clicking through the app in a browser; fix in code with build-time guarantees; verify; nothing pushed',
  phases: [
    { title: 'Find', detail: 'data sweep over every verse; browser sweep over the app' },
    { title: 'Fix', detail: 'one builder in worktree BibleAtlas-empty' },
    { title: 'Verify', detail: 'two adversaries, a fix round' },
  ],
}
const REPO = 'C:\\Users\\shubh\\Projects\\BibleAtlas'
const WT = 'C:\\Users\\shubh\\Projects\\BibleAtlas-empty'
const FIXES = 'C:\\Users\\shubh\\Projects\\BibleAtlas-fixes'
const SC = 'C:\\Users\\shubh\\AppData\\Local\\Temp\\claude\\C--Users-shubh-Projects--claude\\d3907c69-e0f0-457b-bec9-6a76569849b3\\scratchpad\\ba\\empty'
const COMMON = `PROJECT: Bible Atlas (github.com/Sixteen1-6/BibleAtlas, live https://everyversemap.com/), a Preact and TypeScript site in web/ over a Rust data build (crates/atlas-cli). Read CLAUDE.md, docs/HANDOFF.md and web/src/ui/extras/README.md in ${REPO} (main b6d7f1e). The extras rule already says: "never an empty state or 0 results", "at most one quiet line per extra, shown only where it applies".
THE FOUNDER'S REPORT (2026-10-20): "in the app we can click 'Christian writers' and click a writer and it appears empty, presumably because they didn't write for that verse. It should only appear for verses they wrote on so you can't click anything that's empty. That goes for any empty selection." The Christian writers extra is web/src/ui/extras/voices/ (model.ts: worksOn reads a per-verse bit index from extras/voices.json; partOf picks a part file by chapter; notesOn filters that file's items by verse range) built by crates/atlas-cli/src/extra_voices.rs. On John 3:16 all three writers do show notes, so the empty case is on other verses or another path to a writer.
A full local data build exists at ${FIXES}\\web\\public\\data (built from a46d819 plus PR #47; the data is the same as live apart from layers.json) and the engine at ${FIXES}\\web\\src\\engine\\atlas.wasm; web\\node_modules is at ${FIXES}\\web\\node_modules. The live data is also at https://everyversemap.com/data/. Use Node and Playwright (npx playwright, or install under ${SC}). Never push. Plain English, no em dashes. Scratch only under ${SC}.`

phase('Find')
const F = { type: 'object', properties: { cases: { type: 'array', items: { type: 'object', properties: { surface: { type: 'string' }, how: { type: 'string', description: 'exact steps or the verse and level' }, count: { type: 'integer' }, examples: { type: 'array', items: { type: 'string' } }, cause: { type: 'string', description: 'file and line, and why it is empty' }, fix: { type: 'string' } }, required: ['surface', 'how', 'count', 'examples', 'cause', 'fix'] } } }, required: ['cases'] }
const finds = (await parallel([

  ['browser', `BROWSER SWEEP. Run the site from ${FIXES}\\web with node node_modules\\vite\\bin\\vite.js --port <free port> --strictPort (first load can take 60 seconds). With Playwright, at each level (Simple, Study, Deep) on a sample of at least 300 verses chosen to cover every book and every extra (include verses where a writer's note is on a whole chapter or a verse range), click every line, tab, button, chip and link that opens something (extras lines and their panels, writer sections and "About this book", "Read all", "Show N more", the Links, Word, Themes, Paths and Top verses tabs, theme chips, word chips, the Sources shelf and its cards, Ask results, the map's verse picks) and record every one that opens an empty or near-empty view (no items, only a heading, "0", "Sorry", a lone ellipsis that never resolves). Report each with steps and a screenshot path.`],
].map(([k, t]) => () => agent(`${COMMON}\n\n${t}`, { label: `find:${k}`, phase: 'Find', schema: F })))).filter(Boolean)
finds.push({ sweep: 'data sweep over all 31,102 verses (finished in an earlier run)', resultsFile: 'C:\\Users\\shubh\\Projects\\bibleatlas-workfiles\\2026-10-20\\runs\\wf_e5046b06-4ad.json', scripts: `${SC}` })

phase('Fix')
const B = { type: 'object', properties: { commit: { type: 'string' }, fixed: { type: 'array', items: { type: 'string' } }, guarantees: { type: 'array', items: { type: 'string' } }, checks: { type: 'array', items: { type: 'string' } } }, required: ['commit', 'fixed', 'guarantees', 'checks'] }
const fix = await agent(`${COMMON}\n\nYou are the builder. Create the worktree: git -C ${REPO} fetch -q origin; git -C ${REPO} worktree add -b no-empty-selections ${WT} origin/main; copy ${FIXES}\\data\\raw to ${WT}\\data\\raw (clean LF sources); link web\\node_modules to ${FIXES}\\web\\node_modules with a junction (cmd /c mklink /J). Fix every case below at its cause, so a reader can never click something that opens empty: prefer making the data and its index agree at build time (crates/atlas-cli) and adding an atlas verify check that fails if any line or chip would promise what its panel cannot show, plus the smallest UI guard where a view could still come up empty. Keep the extras rules (one quiet line, only where it applies; at most five one-line insertions in shared files). Note: another branch (commentary-notice) is changing web/src/ui/extras/voices/Panel.tsx to add a notice; keep your voices changes to model.ts and the Rust build where you can, to avoid a conflict. Then run in Git Bash from ${WT}: cargo run --release -q -p atlas-cli -- build; -- verify; cargo test --release -p atlas-cli; cargo clippy --workspace --release -- -D warnings; npx tsc --noEmit in web; re-run the data sweep script from ${SC} against the new build and show zero mismatches. Commit on branch no-empty-selections with a plain subject about the visible effect, a short body and "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Never push.\n\nCASES: ${JSON.stringify(finds)}`, { label: 'fix', phase: 'Fix', schema: B })

phase('Verify')
const V = { type: 'object', properties: { pass: { type: 'boolean' }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } } }, required: ['pass', 'findings'] }
const vs = (await parallel([
  'repeat the browser sweep on the fixed build (run the site from the worktree with its new data) over a fresh sample of 300 verses at all three levels, plus every example the finders listed, and report anything that still opens empty',
  'check the fix did not hide real content: for 200 verses compare what each extra and tab shows before (live site or the old build) and after, and flag any line, writer, note or chip that disappeared although it had something to show; check the new verify check fails on a deliberately broken index',
].map((lens, i) => () => agent(`${COMMON}\n\nYou are an adversary for the change on branch no-empty-selections in ${WT}. ${lens}. Do not edit. pass = true only with no blocker or major.\n\nFIX: ${JSON.stringify(fix)}`, { label: `verify:${i + 1}`, phase: 'Verify', schema: V })))).filter(Boolean)
let fix2 = null
if (vs.some(v => !v.pass)) {
  fix2 = await agent(`${COMMON}\n\nFix every blocker and major below in ${WT}, rebuild, re-verify and re-run the data sweep, and commit with the same Co-Authored-By line. Never push.\n\nFINDINGS: ${JSON.stringify(vs.flatMap(v => v.findings))}`, { label: 'fix2', phase: 'Verify', schema: B })
}
return { finds, fix, verify: vs, fix2 }
