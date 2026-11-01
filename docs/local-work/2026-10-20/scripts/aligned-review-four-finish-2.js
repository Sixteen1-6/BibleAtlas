export const meta = {
  name: 'aligned-review-four-finish-2',
  description: 'Finish the Aligned review-four and transcript-intake batch from disk: 12 modules done, M9 to verify, I1 to fix, I2 I3 I4 I5 I8 M11 to build; verify each adversarially, integrate, three-lens review; nothing committed or deployed',
  phases: [
    { title: 'Build', detail: 'unfinished modules, each started when its dependencies finish' },
    { title: 'Verify', detail: 'adversarial verifier per module, up to two fix rounds' },
    { title: 'Integrate', detail: 'full suites, cross-module fixes' },
    { title: 'Review', detail: 'three-lens review of the whole diff, fix round' },
  ],
}

const WT = 'C:\\Users\\shubh\\Projects\\aligned-four'
const SP = 'C:\\Users\\shubh\\AppData\\Local\\Temp\\claude\\C--Users-shubh-Projects--claude\\c95b9c1e-a8f5-4a1c-b44b-12f09cca1a39\\scratchpad\\aligned'
const AW = 'C:\\Users\\shubh\\Projects\\aligned-workfiles\\2026-10-20-session-14b88e0a'
const NOTES = `${AW}\\review-four-module-notes-2.json`
const I1_ISSUES = `${AW}\\I1-open-issues-2.json`
const REVIEW_SPEC = `${WT}\\docs\\design\\review-four\\SPEC.md`
const INTAKE_SPEC = `${WT}\\docs\\design\\transcript-intake\\SPEC.md`

const MODULES = [
  { id: 'M1', name: 'M1 Contract text', spec: 'review', deps: [], done: true },
  { id: 'M2', name: 'M2 Engine, JavaScript', spec: 'review', deps: ['M1'], done: true },
  { id: 'M3', name: 'M3 Engine, Python', spec: 'review', deps: ['M1', 'M2'], done: true },
  { id: 'M4', name: 'M4 Page data', spec: 'review', deps: [], done: true },
  { id: 'M5', name: 'M5 Arc chart', spec: 'review', deps: ['M4'], done: true },
  { id: 'M6', name: 'M6 Link store', spec: 'review', deps: [], done: true },
  { id: 'M7', name: 'M7 Rep text and moment notes', spec: 'review', deps: [], done: true },
  { id: 'M8', name: 'M8 Record page', spec: 'review', deps: ['M4', 'M5', 'M6', 'M7'], done: true },
  { id: 'M9', name: 'M9 Live gate', spec: 'review', deps: ['M4', 'M8'], done: true },
  { id: 'I0', name: 'I0 Parser parity', spec: 'intake', deps: [], done: true },
  { id: 'I1', name: 'I1 Formatter, JavaScript', spec: 'intake', deps: ['I0'], fixFirst: true },
  { id: 'I2', name: 'I2 Formatter, Python', spec: 'intake', deps: ['I1'] },
  { id: 'I3', name: 'I3 Pipeline hook', spec: 'intake', deps: ['I2'] },
  { id: 'I4', name: 'I4 File reader', spec: 'intake', deps: ['I1'] },
  { id: 'I5', name: 'I5 Paste page intake', spec: 'intake', deps: ['I1', 'I4'] },
  { id: 'I6', name: 'I6 Separation, shared', spec: 'intake', deps: ['I0'], done: true },
  { id: 'I7', name: 'I7 Separation, Worker', spec: 'intake', deps: ['I6', 'M2'], done: true },
  { id: 'I8', name: 'I8 Separation, page', spec: 'intake', deps: ['I5', 'I6', 'I7'] },
  { id: 'I9', name: 'I9 Evaluation', spec: 'intake', deps: ['I6'], done: true },
  { id: 'M11', name: 'M11 Paste page on the record design', spec: 'review', deps: ['M8', 'I5', 'I8'] },
]

const RESUME = `THIS BATCH HAS BEEN CUT OFF SEVERAL TIMES (2026-10-11 spend limit; 2026-10-20 session ends and limits). Nothing was committed. Modules M1 to M8, I0, I6, I7 and I9 are built and verified; M9 is built; I1 is built with open issues; the rest may be partly written on disk by cut-off builders. Start with git -C ${WT} status and git -C ${WT} diff of the files your module owns (and read its new untracked files). Keep what is right, finish what is missing, fix what is wrong. Do not redo finished work for its own sake and never revert another module's files. Every finished module's builder notes (deviations, needs, notes) are in ${NOTES}, keyed by module id; read the entries for your dependencies and your own module.`

const RULES = `Worktree: ${WT} (branch review-four, based on 4fa4835, which is current main). Read CLAUDE.md there first. Binding rules for this batch:
- The founder's standing instruction: respect the partner's framework fully and do not mess that part up at all. The partner's framework content is untouched: framework/rubric.phase0.json, metrics.json, lexicons.json, operating-rubric.*, framework/proposed/build/**, framework/source/**. (Module M1 owns the schema files, prompt.md, prompt.hash and CONFLICTS.md as the spec says, and is finished.) Key points select and never rewrite the model's words; the one practice focus, the three-fix maximum and recurrence gating stay as they are.
- Edit ONLY the files your module owns, exactly as listed for it in the spec's module table (review spec section 14, intake spec section 6). Partial-file ownership (for example "line 201 only") means only that part. If you need a change in a file you do not own, do not make it: list it under needs.
- Other modules are writing in the same worktree at the same time. Never run git stash, git checkout, git reset, git clean or any command that touches files you do not own. Never commit, push, deploy, or run wrangler deploy, versions upload or login. No network calls to any model provider; there is no key here; mock the provider.
- Run only your module's targeted tests (one vitest file or project, one pytest file), never the full npm test and the full Python suite together; the machine is shared by many agents.
- No em dashes, no emoji, plain specific English, never the partner's name. Two engine parity wherever both engines exist. Every test offline.
- Where the spec disagrees with the code, follow the code's reality, keep the spec's intent, and record the deviation.`

const BUILD = { type: 'object', properties: {
  module: { type: 'string' }, foundOnDisk: { type: 'string' },
  filesChanged: { type: 'array', items: { type: 'string' } },
  testsRun: { type: 'string' }, passed: { type: 'boolean' },
  deviations: { type: 'array', items: { type: 'string' } }, needs: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
}, required: ['module', 'foundOnDisk', 'filesChanged', 'testsRun', 'passed', 'deviations', 'needs', 'notes'] }
const VERIFY = { type: 'object', properties: {
  acceptancePassed: { type: 'boolean' },
  issues: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
  }, required: ['severity', 'file', 'issue', 'evidence', 'fix'] } },
}, required: ['acceptancePassed', 'issues'] }

const specNote = (m) => m.spec === 'review'
  ? `Your spec is ${REVIEW_SPEC}. Read sections 0, 1 and 14 first, then every section your module touches (the module table names them; section 13 lists your tests; section 9 lists design fixes assigned to modules, including yours).`
  : `Your spec is ${INTAKE_SPEC}. Read Decisions, sections 0 and 6 first, then every section your module touches (section 5 lists your tests). The review-four batch builds in the same worktree; its spec is ${REVIEW_SPEC} if you need context.`

const bad = (v) => !v || !v.acceptancePassed || v.issues.some(i => i.severity !== 'minor')
const verifyPrompt = (m, round, report) => `You are an adversarial verifier for module ${m.name} (round ${round}). ${specNote(m)}

${RULES}
You do not edit anything.

Check the module's work in the worktree against its spec section and acceptance: read the actual diff of its files (git -C ${WT} diff -- <its files>, and new files), run its acceptance commands yourself, and try to break it: spec mismatches, missing tests, wrong error strings, two engine parity drift, goldens not regenerated, old reviews (rules version 1 to 4) no longer rendering or validating, copy rule violations (node scripts/lint-copy.mjs), accessibility, edits outside its ownership (compare git status against the ownership list), half-finished code left by a cut-off run, and any change to the partner's framework content. A deviation the builder recorded with a sound reason (see ${NOTES}) is not a defect. Builder's report: ${JSON.stringify(report)}`
const fixPrompt = (m, issues) => `You are the builder for module ${m.name}, fix round. ${specNote(m)}

${RULES}

The verifier found the issues below. Resolve every blocker and major, and minor ones where cheap; re-run the acceptance checks until they pass. If a fix would break an earlier test or golden that another module owns, list it under needs instead.

ISSUES: ${issues}`

const results = {}
const memo = {}
function run(id) {
  if (memo[id]) return memo[id]
  const m = MODULES.find(x => x.id === id)
  memo[id] = (async () => {
    if (m.done) { results[id] = { id, done: true }; return results[id] }
    await Promise.all(m.deps.map(run))
    let report, v = null
    if (m.fixFirst) {
      report = await agent(fixPrompt(m, `read them from ${I1_ISSUES} (the last re-verification's open blockers and majors, plus minors)`), { label: `fix:${m.id}`, phase: 'Verify', schema: BUILD })
    } else if (m.verifyOnly) {
      report = { module: m.name, note: `built in an earlier run; its notes are under "${m.id}" in ${NOTES}` }
    } else {
      report = await agent(`You are the builder for module ${m.name}. ${specNote(m)}

${RESUME}

${RULES}

Make the module complete and exactly as specified, including its tests and any golden or fixture files it owns (regenerate goldens with the commands the spec gives). Then run the module's acceptance checks and make them pass. Report what you found on disk, what you changed, what you ran, deviations from the spec, and needs outside your files.`, { label: `build:${m.id}`, phase: 'Build', schema: BUILD })
    }
    if (!report) { results[id] = { id, build: null }; return results[id] }
    v = await agent(verifyPrompt(m, 1, report), { label: `verify:${m.id}`, phase: 'Verify', schema: VERIFY })
    for (let round = 2; round <= 3 && bad(v); round++) {
      report = await agent(fixPrompt(m, JSON.stringify(v ? v.issues : [])), { label: `fix${round}:${m.id}`, phase: 'Verify', schema: BUILD })
      v = await agent(verifyPrompt(m, round, report), { label: `reverify${round}:${m.id}`, phase: 'Verify', schema: VERIFY })
    }
    results[id] = { id, build: report, last: v }
    log(`${m.id} done: acceptance ${v && v.acceptancePassed ? 'passed' : 'NOT passed'}, open majors ${v ? v.issues.filter(i => i.severity !== 'minor').length : '?'}`)
    return results[id]
  })()
  return memo[id]
}

phase('Build')
await Promise.all(MODULES.map(m => run(m.id)))

const summary = MODULES.map(m => {
  const r = results[m.id] || {}
  if (r.done) return { id: m.id, done: true }
  return { id: m.id, built: Boolean(r.build), acceptance: r.last ? r.last.acceptancePassed : false, open: r.last ? r.last.issues.filter(i => i.severity !== 'minor') : [], minor: r.last ? r.last.issues.filter(i => i.severity === 'minor').map(i => i.issue) : [], needs: r.build && r.build.needs ? r.build.needs : [], deviations: r.build && r.build.deviations ? r.build.deviations : [] }
})

phase('Integrate')
const INTEG = { type: 'object', properties: {
  suites: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
  fixed: { type: 'array', items: { type: 'string' } }, remaining: { type: 'array', items: { type: 'string' } },
  promptChanges: { type: 'string', description: 'every change this batch made to framework/prompt.md, listed so it can later be carried back into framework/proposed/prompt.md' },
  founderDecisions: { type: 'array', items: { type: 'string' } },
  notes: { type: 'string' },
}, required: ['suites', 'fixed', 'remaining', 'promptChanges', 'founderDecisions', 'notes'] }
const integrate = await agent(`You are the integrator for the review-four batch in ${WT}. Every module has finished; nothing else is writing in this worktree now. Specs: ${REVIEW_SPEC} and ${INTAKE_SPEC}. Read CLAUDE.md.

1. Resolve every module's "needs" (cross-file changes a module could not make), every open blocker or major issue, and cheap minor ones, editing whatever batch file is required, and record each change. All module notes, including the finished ones', are in ${NOTES}. Needs that are founder decisions (for example the prompt margin of about 4.9 percent under the 420,000 cap, or committing the record screenshots) go to founderDecisions, not into edits of the partner's framework text.
2. Run the full suites ONE AT A TIME, in this order, fixing failures between runs: npm run lint; node --test framework/tests/framework.test.mjs; uv run --project pipeline python framework/tests/validate_examples.py; npm test (vitest, all projects); npm run test:py; npm run e2e (Playwright). Also npx tsc --noEmit -p worker, and uv run ruff check and mypy in pipeline.
3. Prove the framework guard: git -C ${WT} diff --stat -- framework/rubric.phase0.json framework/metrics.json framework/lexicons.json framework/operating-rubric.json framework/operating-rubric.txt framework/proposed/build framework/source must print nothing.
4. List every change to framework/prompt.md (it must be carried back to framework/proposed/prompt.md later, not now).
5. Never commit, push or deploy. No em dashes, no emoji.

MODULE SUMMARY: ${JSON.stringify(summary)}`, { label: 'integrate', phase: 'Integrate', schema: INTEG })

phase('Review')
const LENSES = [
  { key: 'correctness', text: 'correctness and parity: read the whole diff (git -C WT diff and untracked files) for bugs, two engine drift, validator and verification behaviour on old and new reviews, the prompt budget, the Worker route and its refusal codes, the formatter verbatim rule, the .docx reader on hostile input, and the cost bound of the separation route' },
  { key: 'framework', text: "framework fidelity: confirm no rubric content changed, the one practice focus and recurrence gating are intact, the new prompt text says only what the spec says, the CONFLICTS.md C-22 entry is accurate, key points select and never rewrite the model's words, and the next call steps cannot coach a first occurrence" },
  { key: 'design', text: "the founder's design bar (product UI like Linear, Attio, Stripe record views; quiet, one accent, no card soup, no decorative glyphs) and accessibility: run the dev server (node scripts/sync-site.mjs, then node scripts/dev.mjs on a free port), screenshot review.html for each sample and paste.html at 1440 and 390, light and dark, with a Playwright script under the scratchpad, and judge against review spec sections 7 to 9 and intake spec section 2; check axe results from the e2e suite; stop the server afterwards" },
]
const reviews = (await parallel(LENSES.map(l => () => agent(`You review the finished review-four batch in ${WT} through one lens: ${l.text.replace('WT', WT)}. Specs: ${REVIEW_SPEC}, ${INTAKE_SPEC}. Write scratch files only under ${SP}\\build-review-four\\. Do not edit the repository. Report issues with severity, evidence and a concrete fix.`, { label: `review:${l.key}`, phase: 'Review', schema: VERIFY })))).filter(Boolean)
let finalFix = null
if (reviews.flatMap(r => r.issues).some(i => i.severity !== 'minor')) {
  finalFix = await agent(`You are the integrator again in ${WT}. Fix every issue below (and the minor ones where cheap), then re-run the full suites one at a time in the order: npm run lint, node --test framework/tests/framework.test.mjs, npm test, npm run test:py, npm run e2e. Never commit, push or deploy. Report the final suite results.

ISSUES: ${JSON.stringify(reviews.flatMap(r => r.issues))}`, { label: 'final-fix', phase: 'Review', schema: INTEG })
}
return { summary, integrate, reviews, finalFix }
