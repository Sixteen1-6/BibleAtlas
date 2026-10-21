#!/usr/bin/env python3
"""make_pointer_js.py: writes pointer.js (a Workflow script) from write4.js's shared rule texts, so both say the
same thing. pointer.js applies founder decision 9 (pointed cross-references count) to one-writer link notes:
a finder judges the script's candidates (pointers.py) and searches the Bible Hub pages, then a skeptic re-checks
every cite it adds."""
import os, re

D = os.path.dirname(os.path.abspath(__file__))
src = open(f'{D}/write4.js').read()


def const(name):
    m = re.search(r'^const ' + name + r' = (`[\s\S]*?`)\n', src, re.M)
    return f'const {name} = {m.group(1)}\n'


head = src[src.index('const W = '):src.index('const KINDS')]
cite = src[src.index('const CITE = {'):src.index('const LAYER = {')]

body = r'''
const STR = ['widely agreed', 'commonly held', 'some interpreters']
const ADD = { type: 'object', properties: { ...CITE.properties, target: { type: 'string', description: 'the linked passage this writer points to or states' } }, required: ['source', 'on', 'quote', 'url', 'points_only'] }
const FOUND = {
  type: 'object',
  properties: {
    notes: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' },
      add: { type: 'array', items: ADD, description: 'cites to add: writers not already cited who point to the linked passage (rule 1a) or state the note' },
      strength: { type: 'string', enum: STR, description: 'counting the writers already cited and the ones added, by the rules above' },
      text: { type: 'string', description: 'only when the text must change so that it says no more than the counted writers support; at most 300 characters' },
      evidence: { type: 'string', description: 'the full evidence (at most 400 characters) naming every cited writer and how he states or points to the note' },
      why: { type: 'string', description: 'one or two sentences: what was found, what was rejected and why' },
    }, required: ['key', 'add', 'strength', 'evidence', 'why'] } },
  },
  required: ['notes'],
}
const REFUTED = {
  type: 'object',
  properties: {
    cites: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, n: { type: 'integer', description: 'index in that note\'s add list' },
      verdict: { type: 'string', enum: ['keep', 'drop'] }, quote: { type: 'string', description: 'the corrected verbatim quote, only if the given one is not verbatim but the writer does point' },
      reason: { type: 'string' },
    }, required: ['key', 'n', 'verdict', 'reason'] } },
    notes: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, strength: { type: 'string', enum: STR },
      text: { type: 'string', description: 'the text the note should have (at most 300 characters), only when the proposed or current text says more than the kept writers support' },
      evidence: { type: 'string', description: 'corrected evidence, only when it must change' },
      reason: { type: 'string' },
    }, required: ['key', 'strength', 'reason'] } },
  },
  required: ['cites', 'notes'],
}

const items = args.items
const per = args.per || 4
const groups = []
for (let i = 0; i < items.length; i += per) groups.push(items.slice(i, i + per))
const ks = args.only || groups.map((_, k) => k)

const res = await pipeline(
  ks,
  (k) => agent(`You are strengthening notes in Bible Atlas, a Bible study app whose Deep level shows cited notes on what lies under each verse. Each note below links its verse to another passage, and so far too few writers back it. The owner ruled on 2026-10-20 that a writer's pointed cross-reference counts ("The see [quote] is fine"). Your job: find the writers on the cite list who point to the linked passage or state the note, and add them with verbatim quotes.

${RULE}

${TOOLS}

For each note:
1. "candidates" are places where a script found a reference to the linked passage in a local commentary's remark on the anchor verse ("run" counts the references in that run; five or more do not point). Judge each under rule 1a: is the reference attached to this verse's words, and does it name the linked passage? If so, open the remark with cq.py, choose a verbatim quote of 20 to 350 characters that contains the reference and the words it is attached to, and confirm it with cq.py check. Set points_only true unless the writer also states the note in his own words.
2. Then read the anchor verse's remark on the Bible Hub pages (ellicott, pulpit, benson, poole, calvin, gsb, mhcw, bengel, maclaren, chrysostom and treasury where they cover the book) and the NET note page, and the Catena (cat.py) for a Gospel verse, for any other cite-list writer who points to the same passage or states the note. Quote verbatim (url = the page). A modern copyrighted work (the NET notes and the like) also gets a "pointer" line.
3. Never add a writer already in the note's cites, nor one rule 6 forbids, and never count two cites of one writer.
4. Return the strength counting every writer already cited (who states the note) plus the ones you add, by rule 4 (3+ widely agreed, 2 commonly held, 1 some interpreters; Bullinger's two works count once, Henry's two once, Wesley as rule 7 says). If the note's text says more than the counted writers together support, give a corrected text (at most 300 characters, plain English, no writer names, exact BSB wording inside any quotation of four or more words, checked with vw.py); writers who only point support only that the passages are linked. Always return the full evidence (at most 400 characters) naming every cited writer and whether he states the note or only points.
Accuracy beats count: add nothing you are not sure of.

The notes:
${JSON.stringify(groups[k], null, 1)}`, { label: `find:${args.name}-${k}`, phase: 'Find', schema: FOUND }),
  (found, k) => {
    const adds = (found && found.notes || []).filter((n) => n.add && n.add.length)
    if (!adds.length) return { k, found, refuted: null }
    const show = adds.map((n) => ({ ...groups[k].find((g) => g.key === n.key), proposed: n }))
    return agent(`You are the skeptic for Bible Atlas, a Bible study app whose notes go live without further human review. A finder proposes adding cites to the notes below, under the owner's rule that a pointed cross-reference counts. Try to refute every added cite.

${RULE}

${TOOLS}

For each added cite (its index n in the note's "proposed.add"):
- Re-open it: cq.py check for a local work; WebFetch the url for a web page and find the words in the writer's remark on the verse in "on". A quote not found verbatim: give the exact quote if the writer does point, else drop.
- Does it point under rule 1a (attached to this verse's words, naming the linked passage, not one of five or more references in a run) or state the note? Is the writer allowed by rule 6? Is he already cited, or the same writer as one already cited (rule 4 and 7)? Drop it if any answer fails. Default to drop when unsure.
For each note, return the strength that the kept cites and the existing ones support, and a text (at most 300 characters) only if the current or proposed text says more than they support; writers who only point support only that the passages are linked.

${JSON.stringify(show, null, 1)}`, { label: `refute:${args.name}-${k}`, phase: 'Refute', schema: REFUTED }).then((refuted) => ({ k, found, refuted }))
  },
)
return res.filter(Boolean).map((r) => ({ k: r.k, notes: (r.found && r.found.notes || []).length, added: (r.found && r.found.notes || []).reduce((a, n) => a + (n.add || []).length, 0), kept: r.refuted ? r.refuted.cites.filter((c) => c.verdict === 'keep').length : 0 }))
'''

meta = """export const meta = {
  name: 'pointed-cross-references',
  description: 'Founder decision 9: find pointed cross-references and second writers for one-writer link notes, then a skeptic re-checks every added cite',
  phases: [
    { title: 'Find', detail: 'judge the script\\'s candidates and search the Bible Hub pages' },
    { title: 'Refute', detail: 'a skeptic re-opens and tests every added cite' },
  ],
}

"""
out = meta + head + cite + '\n' + const('RULE') + '\n' + const('TOOLS') + body
open(f'{D}/pointer.js', 'w').write(out)
print(len(out), 'characters written to pointer.js')
