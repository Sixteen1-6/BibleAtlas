#!/bin/sh
# out_r1t: the returned part-1 passages after the fresh check of the notes that gained a writer
set -e
W=/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp
J=/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows
cd $W
rm -rf out_r1t && cp -r out_r1s out_r1t
python3 -I apply_tighten.py out_r1t --fresh=$J/wf_33d31151-658/journal.jsonl --fresh=$J/wf_246ffb55-5f8/journal.jsonl --fresh=$J/wf_60293381-09f/journal.jsonl
python3 -I finalize.py out_r1t
