#!/bin/bash
# grid.sh tag MODELPJSON: route dev2 and dev3 with model settings and score
S=$ASK_WORK/scratchpad; G=$S/g7; R6=$S/r6/dev2; R8=$S/r8
cd "$ATLAS_REPO/web"
PORT=5191 TOPN=5 MTOP=8 MODELP="$2" node $R8/rt8.cjs $R6/dev2.json $R8/g-d2-$1.json > /dev/null 2>&1
PORT=5191 TOPN=5 MTOP=8 MODELP="$2" node $R8/rt8.cjs $G/blind-fresh.json $R8/g-d3-$1.json > /dev/null 2>&1
cd $S
echo "== $1 $2"
HI=0.2,0.25,0.3 LR=1:0 python3 r8/pol9.py dev2 r8/g-d2-$1.json | tail -3
HI=0.2,0.25,0.3 LR=1:0 python3 r8/pol9.py dev3 r8/g-d3-$1.json | tail -3
