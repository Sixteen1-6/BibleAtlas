#!/bin/sh
# Rebuild out_p2f from out_p2r: second writers, then checked fixes with overrides.
set -e
W=/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp
J=/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows
cd $W
rm -rf out_p2f && cp -r out_p2r out_p2f
python3 -I apply_second.py out_p2f second_p2_confirmed.json | tail -1
python3 -I apply_tighten.py out_p2f $J/wf_f4837b2b-90e/journal.jsonl $J/wf_2fb58421-b92/journal.jsonl --fresh=$J/wf_dbdc6dbb-040/journal.jsonl --protect=second_p2_confirmed.json --override=override_p2.json
# matthew-27-45 L1: Gill and Pulpit only report the Fathers (p2c check)
python3 -I drop_cites.py out_p2f matthew-27-45 1 gill pulpit
# second writers for the notes the checks left with one writer (p2b), then a fresh check of every note that gained one
python3 -I apply_second.py out_p2f second_p2b_confirmed.json | tail -1
python3 -I finalize.py out_p2f
python3 -I apply_tighten.py out_p2f --fresh=$J/wf_33d31151-658/journal.jsonl --fresh=$J/wf_246ffb55-5f8/journal.jsonl --fresh=$J/wf_60293381-09f/journal.jsonl --fresh=$J/wf_710a5763-395/journal.jsonl --fresh=$J/wf_13599aa4-b78/journal.jsonl --fresh=$J/wf_b9cc03ac-5ed/journal.jsonl
python3 -I finalize.py out_p2f
