#!/usr/bin/env python3
"""fam.py: builds every-cited2.js from every-cited.js, replacing the stories-only parts with text for one family
of forms chosen at run time by args.family ("parallel", "trope" or "contrast"). The schemas, the shared rules and
the tools block are kept word for word from every-cited.js, so both read the same."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'every-cited.js')).read()


def cut(a, b):
    i = src.index(a)
    j = src.index(b, i)
    return src[i:j]


head = cut('const SP =', 'const CITE = {')
schemas = cut('const CITE = {', 'const ABOUT')
about = cut('const ABOUT', 'const FORMAT')
fmt = cut('const FORMAT', 'const RULE')
rule = cut('const RULE', 'const TOOLS')
tools = cut('const TOOLS', 'const BATCHES')

# the cites bullets onward (shared by every family)
cites = fmt[fmt.index('- refs (optional)'):fmt.rindex('`')]
fmt_open = fmt[fmt.index('`') + 1:fmt.index('- Live notes to copy')]

FAM = r'''const FAM = {
  parallel: {
    live: `${LW}/config/figures/Ps.json, Prov.json and Isa.json (parallel lines of every form)`,
    fields: `- kind: parallelism.
- form: the form the cited writers' words state, which may differ from the candidate's (the search's guess): same (the second line says the first again in other words, or explains it), opposite (it answers with the opposite), building (each line adds to or completes the one before), mirror (words or lines go out and come back in reverse order, A B B' A'), turns (lines take turns, A B A' B'), climbing (each line takes up the last word of the one before and climbs), frame (a passage begins and ends with the same words), refrain (the same line comes back), beginnings (lines one after another begin with the same words).
- id: book, chapter, first verse, form, lowercase with hyphens: "psalm-1-6-opposite", "proverbs-10-1-opposite", "isaiah-1-3-same" (Psalms is "psalm"). Add "-2" when a live note already has that id.
- ref: the verses that hold the lines, in one chapter and no wider than the lines need. A writer may head his remark with one verse and mean lines in the next: put the note where the lines he means are.
- short: at most 52 characters, plain words a newcomer understands; may quote the BSB in curly quotes.
- about: at most 300 characters. Say how the lines answer each other and what that shows, in full plain sentences. Say no more than the cited writers state; word a reading as a reading ("can", "many read") when not every cited writer states it as fact.
- lines (at least two): each line's words are exact BSB text of one verse inside ref, found once in it, in reading order and not overlapping, punctuation as the BSB has it. Where the BSB sets the verse as poetry, each line is one of the BSB's own lines, part of one, or whole lines together, never the end of one and the start of the next (poetrycheck.py --lines prints them); in same, opposite, building and climbing no two of a note's lines are in one BSB line. A mirror's or turns' lines are all marked ("A", "B", "B'", "A'"; a mirror may have one unprimed centre). key is optional: one word or phrase found once, as whole words, in its line.
- pairs (optional): [first, answer] words that answer each other, each found once as whole words across the lines, the first in an earlier line.
- No figure and no sides.`,
    rule2: `2. The writer must state, in his remark on this passage, how these very lines answer each other in the way the form says: that the second says the first again in other words or explains it, that it sets the opposite against it, that the order is reversed, that the lines take turns, and so on. A general remark on Hebrew poetry, or the bare word "parallelism" with nothing a reader can check about these lines, does not count; neither does a view he only reports ("some think") or rejects, nor half of the note.`,
    step1: `Read the passage in the BSB (vw.py, and poetrycheck.py --lines for its poetry lines) and each quote in its full remark (cq.py <work> <ref>, bm.py). Keep a quote only if, in context, the writer states how these lines answer each other, as rule 2 says.`,
    checkb: `Does the writer state, in his own voice, how these very lines answer each other in the way the form says? Drop each cite that does not (a general remark on Hebrew poetry, a bare label, a view reported, a word explained, a different figure). Recount the strength from the cites left; a note left with no interpreter is dropped.`,
    checkc: `Is the form the right one? same needs the second line to say the first again in other words; opposite needs a true opposite; mirror a true reversed order; turns a true alternation; building lines that add to the one before. Are the lines the whole members that answer each other, in order, with the right marks, and are they the BSB's own poetry lines (run poetrycheck.py on your file)?`,
    look: `lines that are not the whole members, or not the BSB's poetry lines; a form the quotes do not state (a mirror without a true reversed order, opposite lines that are not opposites); a quote that is only a general remark on Hebrew poetry or a bare label`,
  },
  trope: {
    live: `${LW}/config/figures/Matt.json, Gen.json and Ps.json (metonymy, synecdoche, anthropopatheia and other figures)`,
    fields: `- kind: the form's kind in the forms file (figure for nearly all).
- form: the candidate's form, unless the cited writers plainly state another form in the forms list.
- id: book, chapter, first verse, form, lowercase with hyphens: "matthew-10-34-metonymy", "psalm-23-5-synecdoche" (Psalms is "psalm"). Add "-2" when a live note already has that id.
- ref: the verse or verses that hold the figure, in one chapter, no wider than the figure needs.
- short: at most 52 characters, plain words a newcomer understands; may quote the BSB in curly quotes.
- about: at most 300 characters. Say what the words say, what they stand for and what that shows, in full plain sentences. Say no more than the cited writers state; word a reading as a reading ("can", "many read") when not every cited writer states it as fact.
- figure (exactly one): name is the form's term as the forms file gives it (Metonymy, Synecdoche, Hyperbole, Hendiadys and so on; 40 characters at most); part is Bullinger's subdivision when he gives one for this place ("of the Cause", "of the Part"), shortened (60 at most), else left out; ref is one verse inside ref; words are exact BSB words of that verse that carry the figure, found once in it (the BSB may word the place differently from Bullinger's King James text: pick the BSB words that carry the same figure, and drop the candidate if the BSB does not keep it); means says in plain words what they stand for, as the writers explain it (160 at most).
- No lines and no sides.`,
    rule2: `2. The writer must state, in his remark on this place, that these words are figurative in the way the form says and what they stand for: for a metonymy, one thing put for another it is joined to (the cause for the effect, the container for what it holds); for a synecdoche, a part put for the whole or the whole for a part; for a hyperbole, more said than is meant to the letter; and so on, as the form's about in the forms file says. He need not name the figure, but the figure's name must come from a writer who names it for this place, usually Bullinger (figname.py shows where he does). A view he only reports or rejects does not count, nor a remark that only explains a word with no sense of a figure, nor a different figure on other words.`,
    step1: `Read the verse in the BSB (vw.py) and each quote in its full remark (cq.py <work> <ref>, cat.py, bm.py, figname.py for Bullinger). Keep a quote only if, in context, the writer states this figure for these words, as rule 2 says. A candidate is dropped when the BSB does not keep the figure Bullinger found in his King James text.`,
    checkb: `Does the writer state, in his own voice, that these very words are figurative in the way the form says, and what they stand for? Drop each cite that does not (a word explained with no sense of a figure, a view reported, the word used in passing, a different figure). Recount the strength from the cites left; a note left with no interpreter is dropped.`,
    checkc: `Is the form the right one, as the forms file's about defines it? Does the BSB keep the figure (the BSB may translate a figure away)? Is figure.part Bullinger's own subdivision for this place?`,
    look: `a figure the BSB has translated away; figure words that do not carry the figure; a means the writers do not give`,
  },
  contrast: {
    live: `${LW}/config/figures/1Sam.json and Gen.json (people set side by side)`,
    fields: `- kind: contrast.
- form: contrast (each shows up the other) or likeness (one is like the other), as the cited writers state it.
- id: book, chapter, first verse, form, lowercase with hyphens: "1-samuel-1-2-contrast" (Psalms is "psalm"). Add "-2" when a live note already has that id.
- ref: the first side's verses, in one chapter.
- short: at most 52 characters, plain words a newcomer understands; may quote the BSB in curly quotes.
- about: at most 300 characters. Say who is set beside whom and what each shows of the other, in full plain sentences, fair to both. Say no more than the cited writers state.
- sides (two): who (the person), label (a few plain words for how this side is shown), ref (the verses where the Bible shows it, which may be in another chapter or book), words (exact BSB words of the first verse of that ref that show it, found once in it).
- No lines and no figure.`,
    rule2: `2. The writer must state, in his remark on this passage, that these two are set against each other (or alike) in the way the note says. A view he only reports or rejects does not count, nor a remark on one of them alone.`,
    step1: `Read both sides' verses in the BSB (vw.py) and each quote in its full remark (cq.py <work> <ref>, cat.py, bm.py). Keep a quote only if, in context, the writer sets these two side by side in the way the note says.`,
    checkb: `Does the writer set these two side by side, in his own voice, in the way the note says? Drop each cite that does not. Recount the strength from the cites left; a note left with no interpreter is dropped.`,
    checkc: `Are both sides the right people, fairly labelled, with the right verses, and is the note fair to each?`,
    look: `a contrast unfair to one side; a side whose words do not show what its label says`,
  },
}[args.family]
'''

body = r'''
const FORMAT = `The note format (read these first):
- ${LW}/crates/atlas-cli/src/extra_figures.rs, its opening comment only (lines 1 to 75): what the build checks and refuses.
- ${LW}/config/figure-forms.json: the forms (kind, label, term, about) and the "quotable" list. ${PF} holds forms this hand-off proposes that are not in that file yet; they are checked with --forms.
- Live notes to copy the style of: ${FAM.live}. Never write a note a live note already holds.

Fields, and how to fill them:
- n: the candidate's "n".
${FAM.fields}
@@CITES@@`

@@RULE@@
@@TOOLS@@
const BATCHES = args.batches
const keyOf = (k) => `h${NN}-${String(k).padStart(2, '0')}`
const strip = (notes) => JSON.stringify(notes || [], null, 1)
const PCHK = `python3 -I ${F}/poetrycheck.py <file>`

const res = await pipeline(
  BATCHES,
  (k) => agent(`${ABOUT}

You turn one batch of candidates into notes. Print the batch with
python3 -I ${W}/every/mk_every.py show ${NN} ${k}
Each candidate gives: form (the form its note takes), figure and label (what the search took it for), ref (its verses), tier, quotes (sentences where a quotable writer names it, with the writer the cite list gives for that book and the verse he heads the remark with), bullinger (Bullinger's own words on it, if any), others (Gill, Wesley or Geneva sentences: leads for a second writer, never quoted), why (the search's own note on it), live (live figure notes whose verses meet it) and layers (live Layers notes on those verses). Leave out a candidate when a live figure note already has the same form on the same place.

${FORMAT}

${RULE}

${TOOLS}

For each candidate:
1. ${FAM.step1} A candidate whose quotes all fail is dropped, unless you find a quotable writer who does state it.
2. Trim each kept quote to at most 400 characters, word for word as the copy has it, parts joined with "..." in order inside one remark.
3. Look for a second and a third writer: the other local commentaries on the passage (cq.py all, bm.py ellicott and benson, cat.py on a Gospel), and, only where those fail, a Bible Hub page for Poole, Bengel or Maclaren.
4. Write the note.
Save your notes to ${H}/work/${keyOf(k)}/draft.json as {"notes": [...]}, run ${F}/figcheck.py --quotes --forms ${PF} on it${args.family === 'parallel' ? ' and ' + PCHK : ''}, fix every problem they print, and run them again until they print no problems. Return the notes exactly as saved (with found and context on each cite), each candidate you left out in dropped with its n and a short reason, and figcheck's last line.`, { label: `write:${keyOf(k)}`, phase: 'Write', schema: OUT }),
  (draft, k) => {
    if (!draft || !draft.notes || !draft.notes.length) return { k, draft, judged: null }
    return agent(`${ABOUT}

You are the skeptic for one batch of draft notes, before they go live. Find what is wrong and fix it, or drop the note. The drafts:
${strip(draft.notes)}

${FORMAT}

${RULE}

${TOOLS}

Check every note, hard:
a. Re-open every cite. Local works: figcheck.py --quotes --forms ${PF}, cq.py, cat.py check, bm.py. Web pages: fetch the page again and find the words in the writer's own remark on the verse in "on". Words not found as given are corrected to what the writer wrote, or the cite is dropped.
b. Read each quote in its context. ${FAM.checkb}
c. ${FAM.checkc}
d. Is the ref the note's own verses, in one chapter? Are all BSB words exact and found once in their verse?
e. Do short, about, limit and the original note say no more than the cited writers state, in plain words, with no writer named? Is a reading worded as a reading? Is the evidence true to each quote and does it name the man resolve.py names?
f. Is any cite forbidden by rule 1 or 3? Is the work quotable, and does resolve.py name its writer there (ok true, no unnamed)? Does each bullinger-fos cite give its scan page in url and at, found with the search, not guessed (search again only when found does not show the search and its page)? Does the strength count resolve.py's keys? Does an original note name its language?
When unsure that a claim is supported, drop it. Save the notes you keep, whole and corrected, to ${H}/work/${keyOf(k)}/checked.json as {"notes": [...]}, run figcheck.py --quotes --forms ${PF} on it${args.family === 'parallel' ? ' and ' + PCHK : ''} until they print no problems, and return them with one verdict per draft note (keep, fix or drop, with the reason) and figcheck's last line.`, { label: `check:${keyOf(k)}`, phase: 'Check', schema: JUDGED }).then((judged) => ({ k, draft, judged }))
  },
  (r) => {
    if (!r || !r.judged) return r
    if (args.stages === 2) return { ...r, final: r.judged }  // writer and skeptic only; Layers re-reads every note before merging
    const kept = r.judged.notes || []
    const ids = new Set(kept.map((n) => n.id))
    const dropped = (r.draft.notes || []).filter((n) => !ids.has(n.id))
    if (!kept.length && !dropped.length) return { ...r, final: null }
    return agent(`${ABOUT}

You are the second reader. A writer drafted notes for one batch, and a skeptic checked them. Read each note the skeptic kept with fresh eyes and decide: accept it, amend it (fix what is wrong, keep what is right), or reject it (its central claim is false, or no cited writer states it). You may restore a note the skeptic dropped only if you re-check its quotes and claim yourself and the skeptic's reason does not hold.

The skeptic's notes:
${strip(kept)}

The skeptic's verdicts:
${JSON.stringify(r.judged.verdicts || [], null, 1)}

Draft notes the skeptic dropped:
${strip(dropped)}

${FORMAT}

${RULE}

${TOOLS}

Look hardest for: about or short saying more than the quotes; a quote that does not state this note for this passage (only a word explained, a view reported, the word used in passing, a different figure); ${FAM.look}; a strength that counts a writer who does not state the note, or counts one man twice; a cite forbidden by rule 1 or 3; evidence that credits a set instead of the man resolve.py names; a quote not word for word (re-open any you doubt; for bullinger-fos pages, search again only when found does not show the search and its page). Save the final notes to ${H}/work/${keyOf(r.k)}/final.json as {"notes": [...]}, run figcheck.py --quotes --forms ${PF} on it${args.family === 'parallel' ? ' and ' + PCHK : ''} until they print no problems, and return them with one verdict per note you saw (accept, amend, reject or restore, with the reason) and figcheck's last line.`, { label: `confirm:${keyOf(r.k)}`, phase: 'Confirm', schema: JUDGED }).then((final) => ({ ...r, final }))
  },
)

return res.filter(Boolean).map((r) => ({
  k: r.k,
  drafted: (r.draft && r.draft.notes || []).length,
  dropped_by_writer: (r.draft && r.draft.dropped || []).map((d) => ({ n: d.n, ref: d.ref, reason: d.reason })),
  checked: r.judged ? (r.judged.notes || []).length : 0,
  final: r.final ? (r.final.notes || []).length : 0,
  final_ids: r.final ? (r.final.notes || []).map((n) => n.id) : [],
}))
'''

meta = '''export const meta = {
  name: 'every-figure-cited-notes-2',
  description: 'Turn one cited hand-off of the figure catalogue (parallel lines, figures or contrasts) into notes for Deep: a writer checks each candidate quote and adds second writers, a skeptic re-checks every quote and claim, a second reader accepts, amends or rejects',
  phases: [
    { title: 'Write', detail: 'one writer per batch of candidates' },
    { title: 'Check', detail: 'a skeptic re-reads every quote and claim, fixes or drops' },
    { title: 'Confirm', detail: 'a second reader accepts, amends or rejects each note' },
  ],
}

'''

# rule 2 and the stories-only sentence in rule 3 are replaced by the family's
r2a = rule.index('2. The writer must state')
r2b = rule.index('3. Never cite')
rule2 = rule[:r2a] + '${FAM.rule2}\n' + rule[r2b:]
rule2 = rule2.replace(' A parable is a story Jesus or a prophet tells; never call an event the Bible records as history a parable or a fable.', '')
cites = cites.replace('such as where the Bible itself explains the parable.', 'such as where the Bible itself explains it.')
tools2 = tools.replace(
    "- ${F}/figcheck.py --quotes",
    "- ${F}/poetrycheck.py --lines \"<ref>\" prints the BSB's own poetry lines of a verse (null for prose); poetrycheck.py <file> checks a file's parallel lines against them.\n- ${F}/figcheck.py --quotes")
out = meta + head + schemas + about + FAM + body.replace('@@CITES@@', cites).replace('@@RULE@@', rule2).replace('@@TOOLS@@', tools2)
open(os.path.join(HERE, 'every-cited2.js'), 'w').write(out)
print(len(out))

# every-cited3.js: the same, with the batch's reading gathered ahead by prep.py (pack.md) and the shared list of
# Bullinger's scan pages (bfpage.py), so writers and skeptics take fewer steps and no scan page is searched twice
v3 = out.replace("name: 'every-figure-cited-notes-2'", "name: 'every-figure-cited-notes-3'")
pairs = [
    ("You turn one batch of candidates into notes. Print the batch with\npython3 -I ${W}/every/mk_every.py show ${NN} ${k}\n",
     "You turn one batch of candidates into notes. Your batch's reading is already gathered in ${H}/work/${keyOf(k)}/pack.md (made by prep.py with the tools below: each candidate's line in the hand-off, vw.py, poetrycheck.py --lines, figname.py, cq.py all for the quotable local works, and the full remark each candidate quotes). Read it first, with the Read tool in parts, and run the tools only for what it lacks: other verses, bm.py, cat.py, resolve.py, a Bible Hub page.\n"),
    ("  * bullinger-fos: give url https://archive.org/details/figuresofspeechu00bull/page/<printed page>/mode/1up and at \"<the heading the verse sits under>, p. <printed page>\". Find the page with WebFetch",
     "  * bullinger-fos: give url https://archive.org/details/figuresofspeechu00bull/page/<printed page>/mode/1up and at \"<the heading the verse sits under>, p. <printed page>\". First run python3 -I ${W}/every/bfpage.py find \"<his words>\": if it gives a page for these same words, use it and put \"bfpage.py find\" and the record it printed in found. Otherwise find the page with WebFetch"),
    ("One fetch per quote; never guess a page.",
     "One fetch per quote; never guess a page. After each search, record it for the others with python3 -I ${W}/every/bfpage.py add \"<the words you searched>\" <the search's page number> (the one file outside your folder you may write, and only through that tool)."),
]
for a, b in pairs:
    assert v3.count(a) >= 1, a[:60]
    v3 = v3.replace(a, b)
v3 = v3.replace("search again only when found does not show the search and its page", "search again only when found shows neither the search and its page nor a bfpage.py record")
open(os.path.join(HERE, 'every-cited3.js'), 'w').write(v3)
print('v3', len(v3))
