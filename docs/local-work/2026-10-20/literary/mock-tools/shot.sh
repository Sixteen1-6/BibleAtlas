#!/bin/sh
# shot.sh name hash width height
D="$(cd "$(dirname "$0")/.." && pwd)"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=$3,$4 --virtual-time-budget=6000 --screenshot="$(cygpath -w "$D/shots/$1.png")" "file:///$(cygpath -m "$D/mock-card.html")#$2" >/dev/null 2>&1
echo "$1 done"
