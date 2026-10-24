#!/bin/bash
# both.sh PORT NEARJSON tag: route dev3 and dev2 with NEAR overrides, print scores
G=$ASK_WORK/scratchpad/g7
R6=$ASK_WORK/scratchpad/r6/dev2
cd "$ATLAS_REPO/web"
PORT=$1 NEAR="$2" TOPN=5 MTOP=8 node $G/rt7.cjs $G/blind-fresh.json $G/nr-f-$3.json > /dev/null 2>&1
PORT=$1 NEAR="$2" TOPN=5 MTOP=8 node $G/rt7.cjs $R6/dev2.json $G/nr-d-$3.json > /dev/null 2>&1
(cd $G/dev3 && python3 pol.py $G/nr-f-$3.json | grep -E "0.35|0.4 " | sed "s#^#$3 fresh #")
(cd $R6 && python3 pol.py $G/nr-d-$3.json | grep -E "0.35|0.4 " | sed "s#^#$3 dev2  #")
