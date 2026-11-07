"""Turn the stopped workflow scripts into restart scripts that skip finished agents.

Each finished agent is replaced by a stub naming the durable file that holds its
result, so the remaining agents read it instead of redoing the work.
"""
import re

N = r"C:\Users\shubh\AppData\Local\Temp\claude\C--Users-shubh-Projects--claude\c95b9c1e-a8f5-4a1c-b44b-12f09cca1a39\scratchpad"
RUNS = r"C:\\Users\\shubh\\Projects\\bibleatlas-workfiles\\2026-10-20\\runs"
DECISIONS = r"C:\\Users\\shubh\\Projects\\bibleatlas-workfiles\\2026-10-20\\voices\\FOUNDER-DECISIONS-2026-10-20.md"


def edit(name, fn):
    path = f"{N}\\{name}"
    s = open(path, encoding="utf-8").read()
    t = fn(s)
    assert t != s, name
    open(path, "w", encoding="utf-8").write(t)
    print("edited", name)


def cut_call(s, start, end_marker):
    """Remove from `start` up to and including the first `end_marker` after it."""
    i = s.index(start)
    j = s.index(end_marker, i) + len(end_marker)
    return s[:i], s[j:]


# Literary design: the catalogue is finished.
def lit(s):
    s = s.replace("name: 'bible-atlas-literary-devices-design-continue'", "name: 'bible-atlas-literary-devices-design-3'")
    head, tail = cut_call(s, "const cat = await agent(", "{ label: 'research:catalogue', phase: 'Research', schema: R })")
    stub = ("const cat = { study: 'device catalogue (finished in an earlier run)', resultsFile: '" + RUNS + "\\\\wf_fdc86239-4f4.json', "
            "notes: [`${SC}\\\\catalogue.md`], readThem: 'read the catalogue notes and the results file' }")
    return head + stub + tail


# Commentary notice: the design is finished.
def notice(s):
    s = s.replace("name: 'bible-atlas-commentary-notice'", "name: 'bible-atlas-commentary-notice-2'")
    head, tail = cut_call(s, "const design = await agent(", "{ label: 'design', phase: 'Design', schema: D })")
    stub = ("const design = { finishedInEarlierRun: true, resultsFile: '" + RUNS + "\\\\wf_d039351c-426.json', "
            "specPath: `${SC}\\\\NOTICE-SPEC.md`, mockupPath: `${SC}\\\\notice-mock.html`, "
            "founderRules: 'No AI wording anywhere in the notice or in any credit (founder decisions 13 and 15 in " + DECISIONS + ").' }")
    return head + stub + tail


# True credits: the dates study is finished; add the no-AI-credit decision.
def credits(s):
    s = s.replace("name: 'bible-atlas-true-credits'", "name: 'bible-atlas-true-credits-2'")
    i = s.index("  ['dates', `RETRIEVAL DATES")
    j = s.index("Save ${SC}\\\\dates.md.`],", i) + len("Save ${SC}\\\\dates.md.`],")
    s = s[:i] + s[j:]
    s = s.replace(
        "].map(([k, t]) => () => agent(`${COMMON}\\n\\n${t}`, { label: `research:${k}`, phase: 'Research', schema: R })))).filter(Boolean)",
        "].map(([k, t]) => () => agent(`${COMMON}\\n\\n${t}`, { label: `research:${k}`, phase: 'Research', schema: R })))).filter(Boolean)\n"
        "res.push({ study: 'retrieval dates and original dates (finished in an earlier run)', resultsFile: '" + RUNS + "\\\\wf_bd593f68-4bb.json', notes: `${SC}\\\\dates.md` })",
        1,
    )
    s = s.replace(
        "record that evidence so anyone can re-check it.`",
        "record that evidence so anyone can re-check it. ALSO, the founder's later decisions (items 13 and 15 in " + DECISIONS + "): NO crediting of AI anywhere. \"Just credit original source. The whole point is for us to be looking at original sources and this helps just compile them better. No crediting of AI.\" So this change also removes every AI-drafting line from what readers see (each Layers passage's source line, which today begins \"Drafted with AI help (Claude) from ...\", becomes a plain list of the sources; Layers.tsx's \"Not yet reviewed by a person\" line goes; the hard-verses and hard-passages credits lose their AI wording), and updates the rule in CLAUDE.md and docs/HANDOFF.md section 6 that says to disclose AI drafting. Every note must then read as what its named sources say, with the sources' own words one tap away.`",
        1,
    )
    return s


# No empty selections: the data sweep is finished.
def empty(s):
    s = s.replace("name: 'bible-atlas-no-empty-selections'", "name: 'bible-atlas-no-empty-selections-2'")
    i = s.index("  ['data', `DATA SWEEP.")
    j = s.index("Report each mismatch class with counts and examples.`],", i) + len("Report each mismatch class with counts and examples.`],")
    s = s[:i] + s[j:]
    s = s.replace(
        "].map(([k, t]) => () => agent(`${COMMON}\\n\\n${t}`, { label: `find:${k}`, phase: 'Find', schema: F })))).filter(Boolean)",
        "].map(([k, t]) => () => agent(`${COMMON}\\n\\n${t}`, { label: `find:${k}`, phase: 'Find', schema: F })))).filter(Boolean)\n"
        "finds.push({ sweep: 'data sweep over all 31,102 verses (finished in an earlier run)', resultsFile: '" + RUNS + "\\\\wf_e5046b06-4ad.json', scripts: `${SC}` })",
        1,
    )
    return s


def sources(s):
    return s.replace("name: 'bible-atlas-voices-sources-research'", "name: 'bible-atlas-voices-sources-research-2'")


edit("literary-2.js", lit)
edit("notice-2.js", notice)
edit("credits-2.js", credits)
edit("empty-2.js", empty)
edit("sources-2.js", sources)
