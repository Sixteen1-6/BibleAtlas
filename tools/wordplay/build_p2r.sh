#!/bin/sh
# Rebuild out_p2r from out_p2: strength recount + audit fixes, trimmed quotes, figure names.
set -e
W=/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp
J=/root/.claude/projects/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/subagents/workflows
cd $W
rm -rf out_p2r && cp -r out_p2 out_p2r
python3 -I apply_recal.py out_p2r $J/wf_86d0159c-163/journal.jsonl fixes_p2_audit.json
python3 -I fix_quotes_p2.py out_p2r
python3 -I apply_fos.py out_p2r
